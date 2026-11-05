import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { BUSINESS } from "@contracts/rates";
import type { FloodRequest } from "./messages";
import { subscribers, leads, discountCodes, availabilityBlocks } from "@db/schema";
import { eq, and, isNotNull, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getStripe } from "./payments";
import { loadRates } from "./queries/settings";
import {
  bookableDates,
  buildAvailability,
  canStart,
  isoDay,
  slotAllowedNow,
  spansForBooking,
  sydneyToday,
  type BookedSpan,
} from "@contracts/calendar";
import {
  computeQuote,
  estimateJobMinutes,
  slotsNeededFor,
  driveMinutesFor,
  driveBetween,
  isMorningOnlyTown,
  morningOnlySlotAllowed,
  isRugPickupDay,
  travelFeeForTown,
  rugPickupTravelFee,
  RATES,
  BOOKING_DAYS_AHEAD,
  BOOKING_NOTICE_DAYS,
  TIME_SLOTS,
  SLOT_MINUTES,
  type BookingDetails,
  type QuoteInput,
} from "@contracts/rates";

const quoteInputSchema = z.object({
  carpetAreaM2: z.number().min(0).max(10000),
  carpetDirtiness: z.enum(["light", "medium", "heavy"]),
  maintenance: z.enum(["none", "two"]),
  lounges: z.array(
    z.object({
      seats: z.number().int().min(0).max(20),
      dirtiness: z.enum(["light", "medium", "heavy"]),
      reclinerSeats: z.number().int().min(0).max(20),
      added: z.boolean().optional(),
    }),
  ),
  mattresses: z.array(
    z.object({
      size: z.enum(["single", "double", "queen", "king"]),
      dirtiness: z.enum(["light", "medium", "heavy"]),
      qty: z.number().int().min(0).max(20),
      added: z.boolean().optional(),
    }),
  ),
  rugs: z.array(
    z.object({
      size: z.enum(["xs", "s", "m", "l", "xl"]),
      qty: z.number().int().min(0).max(50),
      added: z.boolean().optional(),
    }),
  ),
  stainPackage: z.boolean(),
  dirtGum: z.boolean(),
  enzymePreSpray: z.boolean(),
  stainTypes: z
    .array(z.enum(["pet-urine", "food-drink", "mud-traffic", "not-sure"]))
    .default([]),
  stainsBand: z.enum(["none", "under-5", "over-5", "ten-plus"]).optional(),
  preVacuumRooms: z.number().int().min(0).max(60),
  dryingFans: z.number().int().min(0).max(8),
  travelFee: z.number().min(0).max(2000),
  discountPercent: z.number().min(0).max(100),
  roomCounts: z.record(z.string(), z.number().int().min(0).max(40)).optional(),
  crossSellApplied: z.boolean().optional(),
});

const bookingSchema = z.object({
  purpose: z.enum(["moving-out", "living", "selling"]).nullable(),
  propertyType: z.enum(["single", "double"]).nullable(),
  condition: z.object({
    pets: z.enum(["none", "outside", "inside"]).nullable(),
    smell: z.enum(["no", "up-close", "noticeable"]).nullable(),
    stains: z.enum(["none", "under-5", "over-5", "ten-plus"]).nullable(),
    stainTypes: z
      .array(z.enum(["pet-urine", "food-drink", "mud-traffic", "not-sure"]))
      .max(4),
    vacuumed: z.enum(["week", "month", "longer"]).nullable(),
  }),
  recommended: z.enum(["light", "medium", "heavy"]).nullable(),
  access: z.object({
    method: z.enum(["be-there", "agent", "lockbox", "someone-else", "leave-out"]).nullable(),
    agency: z.string().trim().max(255),
    spot: z.string().trim().max(500),
    code: z.string().trim().max(100),
    name: z.string().trim().max(255),
    mobile: z.string().trim().max(40),
    parking: z.enum(["close", "stairs-or-far"]).nullable(),
  }),
  payment: z.enum(["pay-now", "invoice", "cash"]).nullable(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  preferredSlot: z.number().int().min(0).max(TIME_SLOTS.length - 1).nullable(),
  confirmBy: z.enum(["either", "phone", "email"]),
  notes: z.string().trim().max(2000),
  town: z.string().trim().max(100).default(""),
  jobMinutes: z.number().int().min(0).max(2000).default(0),
  rugPickup: z.boolean().default(false),
  // 2-cleans-a-year plan — the second visit, booked into the schedule too
  secondVisit: z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slot: z.number().int().min(0).max(TIME_SLOTS.length - 1),
    })
    .nullable()
    .default(null),
});


/** Manual blocks + every booked job's footprint on the calendar. */
async function calendarLoad(): Promise<{
  blocked: Set<string>;
  spans: BookedSpan[];
}> {
  const db = getDb();
  const blocked = new Set<string>();
  const blocks = await db
    .select()
    .from(availabilityBlocks)
    .where(gte(availabilityBlocks.date, isoDay(sydneyToday())));
  for (const b of blocks) blocked.add(`${b.date}:${b.slot}`);
  const booked = await db
    .select({ bookingJson: leads.bookingJson })
    .from(leads)
    .where(isNotNull(leads.bookingJson));
  const spans: BookedSpan[] = [];
  for (const l of booked) {
    try {
      const b = JSON.parse(l.bookingJson!) as Partial<BookingDetails>;
      if (
        b.preferredDate &&
        b.preferredSlot !== null &&
        b.preferredSlot !== undefined &&
        !b.rugPickup // rug pickups batch into the Thu/Fri arvo run
      ) {
        // Multi-day jobs block the start day AND every continuation workday —
        // spansForBooking splits the overflow onto the following days.
        spans.push(
          ...spansForBooking(
            b.preferredDate,
            b.preferredSlot,
            slotsNeededFor(b.jobMinutes ?? 60),
            b.town ?? "",
          ),
        );
      }
    } catch {
      // ignore malformed rows
    }
  }
  return { blocked, spans };
}


const emailSchema = z.string().trim().toLowerCase().email().max(320);

export const publicRouter = createRouter({
  subscribe: publicQuery
    .input(
      z.object({
        email: emailSchema,
        name: z.string().trim().max(255).optional(),
        source: z.string().trim().max(50).default("website"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.email, input.email))
        .limit(1);
      if (existing[0]) {
        if (existing[0].status === "unsubscribed") {
          await db
            .update(subscribers)
            .set({ status: "active", source: input.source })
            .where(eq(subscribers.id, existing[0].id));
          return { ok: true as const, resubscribed: true };
        }
        return { ok: true as const, already: true };
      }
      await db.insert(subscribers).values({
        email: input.email,
        name: input.name ?? null,
        source: input.source,
      });
      return { ok: true as const, already: false };
    }),

  unsubscribe: publicQuery
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(subscribers)
        .set({ status: "unsubscribed" })
        .where(eq(subscribers.email, input.email));
      return { ok: true as const };
    }),

  validateCode: publicQuery
    .input(z.object({ code: z.string().trim().max(50) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(discountCodes)
        .where(
          and(
            eq(discountCodes.code, input.code.toUpperCase()),
            eq(discountCodes.active, true),
          ),
        )
        .limit(1);
      const code = rows[0];
      if (!code) return { valid: false as const };
      return { valid: true as const, percentOff: code.percentOff, code: code.code };
    }),

  listAvailability: publicQuery
    .input(
      z
        .object({
          town: z.string().trim().max(100).optional(),
          jobMinutes: z.number().min(0).max(2000).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const town = input?.town ?? "";
      const span = slotsNeededFor(input?.jobMinutes ?? 60);
      const { blocked, spans } = await calendarLoad();
      return buildAvailability(span, town, blocked, spans);
    }),

  // Lets the Payment step word the "pay now" option correctly.
  // The live rate card (owner's Settings overrides merged over the
  // built-in figures) — the quote pages re-price with this on load.
  rates: publicQuery.query(async () => loadRates()),

  // Address autocomplete via Google Places (New), server-side. Returns
  // google:false when unconfigured/failing so the client falls back to the
  // free Photon lookup without the customer noticing a thing.
  addressSearch: publicQuery
    .input(z.object({ q: z.string().trim().min(3).max(160) }))
    .query(async ({ input }) => {
      const { autocompleteAddress } = await import("./googlePlaces");
      return autocompleteAddress(input.q);
    }),

  addressResolve: publicQuery
    .input(z.object({ placeId: z.string().trim().min(5).max(400) }))
    .query(async ({ input }) => {
      const { resolveAddress } = await import("./googlePlaces");
      return resolveAddress(input.placeId);
    }),

  paymentsConfigured: publicQuery.query(async () => {
    return { configured: (await getStripe()) !== null };
  }),

  messagingConfigured: publicQuery.query(async () => {
    const { isSmsConfigured } = await import("./messages");
    return { sms: await isSmsConfigured() };
  }),

  // When the daily price watch last confirmed BFYB's live prices — feeds the
  // "checked {date}" line on the comparison table so it can never go stale.
  bfybChecked: publicQuery.query(async () => {
    const { getPriceWatchReport, loadBfybModel, loadElectroModel } = await import("./priceWatch");
    const r = await getPriceWatchReport();
    const model = await loadBfybModel();
    // Null unless the daily watch verified Electrodry's specials within the
    // freshness window — the panel hides them when we're not certain.
    const electro = await loadElectroModel();
    return { checkedAt: r?.fetchOk ? r.checkedAt : null, model, electro };
  }),

  // Live Google rating + reviews for the homepage — cached server-side and
  // refreshed weekly. Null until the Google key is saved in Admin → Settings.
  googleReviews: publicQuery.query(async () => {
    const { getGoogleReviews } = await import("./googleReviews");
    return getGoogleReviews();
  }),

  // Before/after job photos for the /work gallery.
  gallery: publicQuery.query(async () => {
    const { listGallery } = await import("./gallery");
    return listGallery();
  }),

  submitLead: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        email: emailSchema,
        phone: z.string().trim().min(6).max(40),
        address: z.string().trim().max(500).optional(),
        suburb: z.string().trim().max(255).optional(),
        distanceKm: z.number().min(0).max(500).nullable(),
        quote: quoteInputSchema,
        booking: bookingSchema.optional(),
        discountCode: z.string().trim().max(50).optional(),
        origin: z.string().url().max(200).optional(), // for Stripe redirect URLs
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // A booking without an address is a job we can't drive to — the wizard
      // requires it, and this backstops stale pages or hand-built requests.
      if (input.booking && !(input.address && input.address.trim())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "We need the job address to book you in — add it on the first step and send again.",
        });
      }

      // If a time was picked, it must still fit — someone else may have
      // booked while the form was open. Rug-only pickups batch into the
      // Thursday/Friday arvo run, so they only need a valid pickup day.
      const span = slotsNeededFor(estimateJobMinutes(input.quote));
      const town = input.booking?.town || input.suburb || "";
      let load: { blocked: Set<string>; spans: BookedSpan[] } | null = null;
      if (input.booking?.preferredDate || input.booking?.secondVisit) {
        load = await calendarLoad();
      }
      if (input.booking?.preferredDate) {
        if (input.booking.rugPickup) {
          if (!isRugPickupDay(input.booking.preferredDate)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Rug pickups run Thursday and Friday afternoons, 3–5pm. Pick a highlighted day and send again.",
            });
          }
        } else if (
          input.booking.preferredSlot !== null &&
          input.booking.preferredSlot !== undefined
        ) {
          if (
            !bookableDates().includes(input.booking.preferredDate) ||
            !slotAllowedNow(input.booking.preferredDate, input.booking.preferredSlot) ||
            !canStart(
              input.booking.preferredDate,
              input.booking.preferredSlot,
              span,
              town,
              load!.blocked,
              load!.spans,
            )
          ) {
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "That time was just taken. Pick another slot on the When step and send again.",
            });
          }
        }
      }

      // The plan's second clean is a real booking too — it must fit the same
      // rules, including around the first clean if they landed on one day.
      const sv = input.booking?.secondVisit;
      if (sv && !input.booking?.rugPickup) {
        const spans = [...load!.spans];
        if (input.booking?.preferredDate && input.booking?.preferredSlot !== null && input.booking?.preferredSlot !== undefined) {
          spans.push({
            date: input.booking.preferredDate,
            slot: input.booking.preferredSlot,
            span,
            town,
          });
        }
        if (
          !bookableDates().includes(sv.date) ||
          !canStart(sv.date, sv.slot, span, town, load!.blocked, spans)
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "The second clean's time was just taken. Pick another slot for it on the When step and send again.",
          });
        }
      }

      // Re-validate the discount code server-side
      let discountPercent = 0;
      if (input.discountCode) {
        const rows = await db
          .select()
          .from(discountCodes)
          .where(
            and(
              eq(discountCodes.code, input.discountCode.toUpperCase()),
              eq(discountCodes.active, true),
            ),
          )
          .limit(1);
        if (rows[0]) {
          discountPercent = rows[0].percentOff;
          await db
            .update(discountCodes)
            .set({ uses: rows[0].uses + 1 })
            .where(eq(discountCodes.id, rows[0].id));
        }
      }

      // Server-side re-computation — the total we store is the total we
      // computed. Travel is re-priced here too (flat town rates included) so
      // the client never names its own fee.
      const rates = await loadRates();
      const serverTravel =
        input.distanceKm !== null && input.distanceKm !== undefined
          ? input.distanceKm > rates.travel.maxServiceKm
            ? 0
            : input.booking?.rugPickup
              ? rugPickupTravelFee(input.distanceKm, rates, town || input.suburb)
              : travelFeeForTown(town || input.suburb, input.distanceKm, rates)
          : input.quote.travelFee;
      const quote: QuoteInput = {
        ...input.quote,
        discountPercent,
        travelFee: serverTravel,
      };
      const { loadBfybModel } = await import("./priceWatch");
      const breakdown = computeQuote(quote, rates, await loadBfybModel());

      const result = await db.insert(leads).values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address ?? null,
        suburb: input.suburb ?? null,
        distanceKm: input.distanceKm,
        travelFee: breakdown.travelFee,
        total: breakdown.total,
        quoteJson: JSON.stringify({ input: quote, breakdown }),
        bookingJson: input.booking
          ? JSON.stringify({
              ...input.booking,
              // Server-computed, so tomorrow's availability maths is honest.
              town,
              jobMinutes: estimateJobMinutes(quote),
            })
          : null,
      });

      const leadId = Number(result[0].insertId);
      const reference = `MCC-${String(leadId).padStart(4, "0")}`;

      // 2-cleans-a-year plan — the second visit lands in the schedule as its
      // own booking right now, so the calendar blocks it off immediately.
      if (input.booking?.secondVisit && !input.booking.rugPickup) {
        const sv = input.booking.secondVisit;
        await db.insert(leads).values({
          name: input.name,
          email: input.email,
          phone: input.phone,
          address: input.address ?? null,
          suburb: input.suburb ?? null,
          distanceKm: input.distanceKm,
          travelFee: breakdown.travelFee,
          total: breakdown.total,
          quoteJson: JSON.stringify({ input: quote, breakdown }),
          bookingJson: JSON.stringify({
            ...input.booking,
            preferredDate: sv.date,
            preferredSlot: sv.slot,
            secondVisit: null,
            town,
            jobMinutes: estimateJobMinutes(quote),
            notes:
              `2-cleans-a-year plan — visit 2 of 2 (auto-booked with ${reference}). ` +
              input.booking.notes,
          }),
        });
      }

      // "Pay now online" → straight into Stripe's hosted checkout for the
      // full amount. If Stripe isn't configured yet, the booking still lands
      // and we send a payment link manually.
      let checkoutUrl: string | null = null;
      if (input.booking?.payment === "pay-now") {
        const stripe = await getStripe();
        const origin = input.origin ?? "";
        if (stripe && origin.startsWith("http")) {
          try {
            const session = await stripe.checkout.sessions.create({
              mode: "payment",
              customer_email: input.email,
              line_items: [
                {
                  quantity: 1,
                  price_data: {
                    currency: "aud",
                    unit_amount: Math.round(breakdown.total * 100),
                    product_data: {
                      name: `Marshall's Carpet Cleaning — ${reference}`,
                      description: input.booking.preferredDate
                        ? input.booking.rugPickup
                          ? `Rug pickup ${input.booking.preferredDate}, 3:00 – 5:00 PM`
                          : `Booked for ${input.booking.preferredDate}${input.booking.preferredSlot !== null ? `, ${TIME_SLOTS[input.booking.preferredSlot]}` : ""}`
                        : "Cleaning — time to be confirmed",
                    },
                  },
                },
              ],
              success_url: `${origin}/quote?paid={CHECKOUT_SESSION_ID}`,
              cancel_url: `${origin}/quote?payment=cancelled`,
            });
            await db
              .update(leads)
              .set({ stripeSessionId: session.id })
              .where(eq(leads.id, leadId));
            checkoutUrl = session.url;
          } catch (err) {
            // Stripe hiccup — don't lose the booking over it
            console.error("Stripe checkout failed:", err);
          }
        }
      }

      // Booking confirmation — the customer picked how they want to hear from
      // us (email / text / either). A send hiccup must never lose a booking,
      // so this is best-effort and the outcome lands on the lead for the admin.
      if (input.booking) {
        try {
          const { confirmationEmail, confirmationSms, deliver, notifyOwner } = await import("./messages");
          const leadRow = {
            id: leadId,
            name: input.name,
            email: input.email,
            phone: input.phone,
            address: input.address ?? null,
            suburb: input.suburb ?? null,
            total: breakdown.total,
            quoteJson: JSON.stringify({ input: quote, breakdown }),
            bookingJson: JSON.stringify({ ...input.booking, town, jobMinutes: estimateJobMinutes(quote) }),
            paidOnline: false,
          };
          const sent = await deliver(leadRow, confirmationEmail(leadRow), confirmationSms(leadRow), { attachTerms: true });
          const channel = [sent.emailSent && "email", sent.smsSent && "SMS"]
            .filter(Boolean)
            .join(" + ");
          await db
            .update(leads)
            .set({
              confirmationSentAt: sent.emailSent || sent.smsSent ? new Date() : null,
              confirmationDetail: channel
                ? `Sent by ${channel}${sent.detail ? ` — ${sent.detail}` : ""}`
                : sent.detail || "Not sent",
            })
            .where(eq(leads.id, leadId));
          // Loud heads-up to the business inbox — type + price in the subject,
          // full job details in the body. Best-effort; never breaks a booking.
          await notifyOwner(leadRow);
        } catch (err) {
          console.error("Confirmation message failed:", err);
        }
      }

      return {
        ok: true as const,
        reference,
        total: breakdown.total,
        checkoutUrl,
      };
    }),

  // Flood & water damage emergency — minimal form, instant alert. No slot
  // checks, no quote engine: water damage is triaged by phone, and the owner
  // gets an emergency email the moment this lands.
  floodEmergency: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        phone: z.string().trim().min(6).max(40),
        email: z.string().trim().toLowerCase().email().max(320).optional().or(z.literal("")),
        address: z.string().trim().min(3).max(500),
        suburb: z.string().trim().max(255).optional(),
        cause: z.string().trim().max(100),
        rooms: z.string().trim().max(100),
        activeLeak: z.string().trim().max(30),
        insurance: z.string().trim().max(30),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { floodPrices } = await import("../contracts/rates");
      const { loadBfybModel } = await import("./priceWatch");
      const model = await loadBfybModel();
      const inspectionPrice = floodPrices(model).inspection;

      const flood: FloodRequest = {
        name: input.name,
        phone: input.phone,
        email: input.email || undefined,
        address: input.address,
        suburb: input.suburb ?? "",
        cause: input.cause,
        rooms: input.rooms,
        activeLeak: input.activeLeak,
        insurance: input.insurance,
        notes: input.notes || undefined,
      };

      const result = await db.insert(leads).values({
        name: input.name,
        email: input.email || "",
        phone: input.phone,
        address: input.address,
        suburb: input.suburb ?? null,
        distanceKm: null,
        travelFee: 0,
        total: inspectionPrice,
        quoteJson: JSON.stringify({
          input: null,
          breakdown: {
            lines: [
              {
                label: "Flood & water damage — emergency inspection & assessment",
                amount: inspectionPrice,
              },
            ],
            travelFee: 0,
            total: inspectionPrice,
          },
          flood,
        }),
        bookingJson: null,
        status: "new",
      });
      const leadId = Number((result[0] as { insertId?: number }).insertId ?? 0);
      const reference = `MCC-${String(leadId).padStart(4, "0")}`;

      // The whole point: the owner's inbox lights up IMMEDIATELY.
      try {
        const { floodOwnerAlert, floodCustomerEmail } = await import("./messages");
        const { loadSmtpConfig, isSmtpConfigured, sendMail } = await import("./mailer");
        const smtp = await loadSmtpConfig();
        if (isSmtpConfigured(smtp)) {
          const alert = floodOwnerAlert(flood, reference, inspectionPrice);
          const { brandedEmailHtml } = await import("./emailTemplate");
          await sendMail(smtp, BUSINESS.email, alert.subject, alert.text, undefined, brandedEmailHtml(alert.text));
          if (flood.email) {
            const cust = floodCustomerEmail(flood);
            await sendMail(smtp, flood.email, cust.subject, cust.text, undefined, brandedEmailHtml(cust.text));
          }
        }
      } catch (err) {
        // Never let an alert failure lose the emergency — the lead row stands.
        console.error("Flood emergency alert failed:", err);
      }

      return { ok: true as const, reference };
    }),

  // After Stripe sends the customer back, confirm the money actually landed.
  verifyPayment: publicQuery
    .input(z.object({ sessionId: z.string().trim().min(5).max(255) }))
    .mutation(async ({ input }) => {
      const stripe = await getStripe();
      if (!stripe) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payments not configured" });
      }
      const db = getDb();
      const rows = await db
        .select()
        .from(leads)
        .where(eq(leads.stripeSessionId, input.sessionId))
        .limit(1);
      const lead = rows[0];
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found for that payment" });
      }
      if (lead.paidOnline) {
        return {
          ok: true as const,
          paid: true,
          reference: `MCC-${String(lead.id).padStart(4, "0")}`,
          total: lead.total,
        };
      }
      const session = await stripe.checkout.sessions.retrieve(input.sessionId);
      if (session.payment_status !== "paid") {
        return { ok: true as const, paid: false };
      }
      await db.update(leads).set({ paidOnline: true }).where(eq(leads.id, lead.id));
      // Money landed (booking pay-now or invoice card link) — receipt out.
      const { sendReceiptFor } = await import("./receipts");
      await sendReceiptFor(lead.id);
      return {
        ok: true as const,
        paid: true,
        reference: `MCC-${String(lead.id).padStart(4, "0")}`,
        total: lead.total,
      };
    }),
});
