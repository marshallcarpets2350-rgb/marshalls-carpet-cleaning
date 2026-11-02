import { z } from "zod";
import { createRouter } from "./middleware";
import { adminProcedure, verifyAdminPassword, setAdminPassword } from "./adminAuth";
import { publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { subscribers, leads, campaigns, discountCodes, availabilityBlocks } from "@db/schema";
import { eq, desc, count, gte, isNotNull } from "drizzle-orm";
import { TIME_SLOTS, SLOT_START_MINUTES, HOME_BASE, driveMinutesFor, driveBetween, serviceSummary, serviceKinds, type ServiceKind } from "@contracts/rates";
import { getSetting, getSettings, setSetting, RATE_OVERRIDES_KEY } from "./queries/settings";
import { getStripe } from "./payments";
import { sendReceiptFor } from "./receipts";
import {
  loadSmtpConfig,
  isSmtpConfigured,
  sendMail,
  campaignBodyWithFooter,
} from "./mailer";
import {
  parseBooking,
  bookingReference,
  confirmationEmail,
  confirmationSms,
  followUpEmail,
  followUpSms,
  deliver,
} from "./messages";
import { TRPCError } from "@trpc/server";
import { getPriceWatchReport, runPriceWatch } from "./priceWatch";

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from"];

const money0 = z.number().min(0).max(100000);

/** Shape of the owner's editable rate card — mirrors RateOverrides in
 *  contracts/rates.ts. Every field optional; missing = built-in default. */
const rateOverridesSchema = z.object({
  minimumCharge: money0.optional(),
  carpetTiers: z
    .array(z.object({ upTo: money0.nullable(), perM2: money0 }))
    .max(8)
    .optional(),
  carpetMultiplier: z
    .object({ light: money0.optional(), medium: money0.optional(), heavy: money0.optional() })
    .optional(),
  loungePerSeat: z
    .object({ light: money0.optional(), medium: money0.optional(), heavy: money0.optional() })
    .optional(),
  reclinerPerSeat: money0.optional(),
  mattressBase: z
    .object({
      single: money0.optional(),
      double: money0.optional(),
      queen: money0.optional(),
      king: money0.optional(),
    })
    .optional(),
  stainCauseFee: z
    .object({
      "pet-urine": money0.optional(),
      "food-drink": money0.optional(),
      "mud-traffic": money0.optional(),
      "not-sure": money0.optional(),
    })
    .optional(),
  rugPrices: z
    .object({
      xs: money0.optional(),
      s: money0.optional(),
      m: money0.optional(),
      l: money0.optional(),
      xl: money0.optional(),
    })
    .optional(),
  rugBulkPercentOff: z.number().min(0).max(100).optional(),
  travelFreeRadiusKm: money0.optional(),
  travelPerKmEachWay: money0.optional(),
  travelFlatByTown: z.record(z.string(), money0).optional(),
  rugPerKm: money0.optional(),
  volumeEvery: money0.optional(),
  volumeOff: money0.optional(),
  maintenanceTwoOff: z.number().min(0).max(1).optional(),
});

export const adminRouter = createRouter({
  login: publicQuery
    .input(z.object({ password: z.string().min(1).max(200) }))
    .mutation(async ({ input }) => {
      const token = await verifyAdminPassword(input.password);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Wrong password" });
      }
      return { token };
    }),

  stats: adminProcedure.query(async () => {
    const db = getDb();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [activeSubs] = await db
      .select({ n: count() })
      .from(subscribers)
      .where(eq(subscribers.status, "active"));
    const [totalSubs] = await db.select({ n: count() }).from(subscribers);
    const [newLeads] = await db
      .select({ n: count() })
      .from(leads)
      .where(eq(leads.status, "new"));
    const [monthLeads] = await db
      .select({ n: count() })
      .from(leads)
      .where(gte(leads.createdAt, monthStart));
    const [campaignCount] = await db.select({ n: count() }).from(campaigns);

    const smtp = await loadSmtpConfig();

    return {
      activeSubscribers: activeSubs.n,
      totalSubscribers: totalSubs.n,
      newLeads: newLeads.n,
      leadsThisMonth: monthLeads.n,
      campaignsSent: campaignCount.n,
      smtpConfigured: isSmtpConfigured(smtp),
    };
  }),

  // --- BFYB price watch ---
  priceWatch: adminProcedure.query(async () => {
    return getPriceWatchReport();
  }),

  priceWatchRun: adminProcedure.mutation(async () => {
    return runPriceWatch();
  }),

  listLeads: adminProcedure.query(async () => {
    return getDb().select().from(leads).orderBy(desc(leads.createdAt)).limit(500);
  }),

  updateLeadStatus: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "contacted", "booked", "completed"]),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(leads)
        .set({ status: input.status })
        .where(eq(leads.id, input.id));
      // Marking a job done fires the customer's receipt (once per job).
      const receipt = input.status === "completed" ? await sendReceiptFor(input.id) : null;
      return { ok: true as const, receipt };
    }),

  // PayID / bank / cash landed — tick it off on the board (or untick on a mistake).
  markLeadPaid: adminProcedure
    .input(z.object({ id: z.number(), paid: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(leads)
        .set({ paidOfflineAt: input.paid ? new Date() : null })
        .where(eq(leads.id, input.id));
      return { ok: true as const };
    }),

  listSubscribers: adminProcedure.query(async () => {
    return getDb()
      .select()
      .from(subscribers)
      .orderBy(desc(subscribers.createdAt))
      .limit(2000);
  }),

  setSubscriberStatus: adminProcedure
    .input(z.object({ id: z.number(), status: z.enum(["active", "unsubscribed"]) }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(subscribers)
        .set({ status: input.status })
        .where(eq(subscribers.id, input.id));
      return { ok: true as const };
    }),

  listDiscountCodes: adminProcedure.query(async () => {
    return getDb()
      .select()
      .from(discountCodes)
      .orderBy(desc(discountCodes.createdAt))
      .limit(200);
  }),

  createDiscountCode: adminProcedure
    .input(
      z.object({
        code: z
          .string()
          .trim()
          .min(3)
          .max(50)
          .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
        percentOff: z.number().int().min(1).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .insert(discountCodes)
        .values({ code: input.code.toUpperCase(), percentOff: input.percentOff })
        .onDuplicateKeyUpdate({
          set: { percentOff: input.percentOff, active: true },
        });
      return { ok: true as const };
    }),

  setDiscountActive: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(discountCodes)
        .set({ active: input.active })
        .where(eq(discountCodes.id, input.id));
      return { ok: true as const };
    }),

  listBlocks: adminProcedure.query(async () => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    return getDb()
      .select()
      .from(availabilityBlocks)
      .where(gte(availabilityBlocks.date, today))
      .orderBy(availabilityBlocks.date, availabilityBlocks.slot)
      .limit(500);
  }),

  blockSlot: adminProcedure
    .input(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        slot: z.number().int().min(0).max(TIME_SLOTS.length - 1),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .insert(availabilityBlocks)
        .values({ date: input.date, slot: input.slot })
        .onDuplicateKeyUpdate({ set: { date: input.date } });
      return { ok: true as const };
    }),

  unblockSlot: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb()
        .delete(availabilityBlocks)
        .where(eq(availabilityBlocks.id, input.id));
      return { ok: true as const };
    }),

  // Holiday / time off — block every slot on each day in a date range, or
  // clear a whole day back open. Customers stop seeing the day immediately.
  blockRange: adminProcedure
    .input(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const start = new Date(`${input.from}T00:00:00`);
      const end = new Date(`${input.to}T00:00:00`);
      if (end < start) return { ok: true as const, days: 0 };
      let days = 0;
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) continue; // Sundays are never offered anyway
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        for (let slot = 0; slot < TIME_SLOTS.length; slot++) {
          await db
            .insert(availabilityBlocks)
            .values({ date, slot })
            .onDuplicateKeyUpdate({ set: { date } });
        }
        days++;
      }
      return { ok: true as const, days };
    }),

  unblockDay: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      await getDb()
        .delete(availabilityBlocks)
        .where(eq(availabilityBlocks.date, input.date));
      return { ok: true as const };
    }),

  // Remove a booking/enquiry entirely — for accidental double-ups and test
  // bookings. The calendar frees the time straight away.
  deleteLead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().delete(leads).where(eq(leads.id, input.id));
      return { ok: true as const };
    }),

  listCampaigns: adminProcedure.query(async () => {
    return getDb()
      .select()
      .from(campaigns)
      .orderBy(desc(campaigns.sentAt))
      .limit(200);
  }),

  sendCampaign: adminProcedure
    .input(
      z.object({
        subject: z.string().trim().min(1).max(500),
        body: z.string().trim().min(1).max(20000),
        testTo: z.string().trim().toLowerCase().email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const smtp = await loadSmtpConfig();
      if (!isSmtpConfigured(smtp)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Email sending isn't set up yet. Add your SMTP details in the Settings tab first.",
        });
      }

      const db = getDb();

      // Test send — one address, no campaign record
      if (input.testTo) {
        await sendMail(
          smtp,
          input.testTo,
          `[TEST] ${input.subject}`,
          campaignBodyWithFooter(input.body, input.testTo),
        );
        return { ok: true as const, sent: 1, failed: 0, test: true };
      }

      const audience = await db
        .select()
        .from(subscribers)
        .where(eq(subscribers.status, "active"));

      let sent = 0;
      let failed = 0;
      for (const sub of audience) {
        try {
          await sendMail(
            smtp,
            sub.email,
            input.subject,
            campaignBodyWithFooter(input.body, sub.email),
          );
          sent++;
        } catch {
          failed++;
        }
      }

      await db.insert(campaigns).values({
        subject: input.subject,
        body: input.body,
        audienceCount: audience.length,
        sentCount: sent,
        failCount: failed,
        status: failed === audience.length && audience.length > 0 ? "failed" : "sent",
      });

      return { ok: true as const, sent, failed, test: false };
    }),

  // --- Prices (Admin → Settings) -------------------------------------------
  // The owner's rate card overrides. Null resets everything to the built-in
  // figures; quotes already sent keep the price the customer saw.
  getRateOverrides: adminProcedure.query(async () => {
    const raw = await getSetting(RATE_OVERRIDES_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }),

  saveRateOverrides: adminProcedure
    .input(z.object({ overrides: rateOverridesSchema.nullable() }))
    .mutation(async ({ input }) => {
      await setSetting(
        RATE_OVERRIDES_KEY,
        input.overrides ? JSON.stringify(input.overrides) : "",
      );
      return { ok: true as const };
    }),

  // --- Before/after gallery (Admin → Settings) ------------------------------
  addGalleryItem: adminProcedure
    .input(
      z.object({
        caption: z.string().trim().max(120).default(""),
        suburb: z.string().trim().max(60).default(""),
        beforeDataUrl: z.string().max(7_500_000),
        afterDataUrl: z.string().max(7_500_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { addGalleryItem } = await import("./gallery");
      return addGalleryItem(input);
    }),

  removeGalleryItem: adminProcedure
    .input(z.object({ id: z.string().min(1).max(40) }))
    .mutation(async ({ input }) => {
      const { removeGalleryItem } = await import("./gallery");
      await removeGalleryItem(input.id);
      return { ok: true as const };
    }),

  getStripeSettings: adminProcedure.query(async () => {
    const key = (await getSettings(["stripe_secret_key"])).stripe_secret_key ?? "";
    return {
      configured: Boolean(key.trim()),
      // show just the tail so the owner can tell which key is saved      keyHint: key.trim() ? `…${key.trim().slice(-4)}` : "",
    };
  }),

  saveStripeSettings: adminProcedure
    .input(z.object({ stripe_secret_key: z.string().trim().max(255) }))
    .mutation(async ({ input }) => {
      if (input.stripe_secret_key) {
        if (!/^(sk_live_|sk_test_|rk_live_|rk_test_)/.test(input.stripe_secret_key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That doesn't look like a Stripe secret key — it starts with sk_live_ or sk_test_.",
          });
        }
        await setSetting("stripe_secret_key", input.stripe_secret_key);
      }
      // Sanity-check the key by making a harmless API call
      const stripe = await getStripe();
      if (!stripe) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No key saved." });
      }
      try {
        await stripe.balance.retrieve();
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Stripe rejected that key — check you copied the whole secret key.",
        });
      }
      return { ok: true as const };
    }),

  getGoogleSettings: adminProcedure.query(async () => {
    const { googleReviewsStatus } = await import("./googleReviews");
    return googleReviewsStatus();
  }),

  saveGoogleSettings: adminProcedure
    .input(z.object({ google_api_key: z.string().trim().max(255) }))
    .mutation(async ({ input }) => {
      if (!input.google_api_key) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Paste the Google API key first." });
      }
      const { saveGoogleApiKey } = await import("./googleReviews");
      try {
        const data = await saveGoogleApiKey(input.google_api_key);
        return { ok: true as const, rating: data?.rating ?? null, count: data?.userRatingCount ?? null };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Google rejected that key — check it and try again.",
        });
      }
    }),

  refreshGoogleReviews: adminProcedure.mutation(async () => {
    const { refreshGoogleReviews } = await import("./googleReviews");    try {
      const data = await refreshGoogleReviews();
      if (!data) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save a Google API key first." });
      }
      return { ok: true as const, rating: data.rating, count: data.userRatingCount, fetchedAt: data.fetchedAt };
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err instanceof Error ? err.message : "Refresh failed — try again in a minute.",
      });
    }
  }),

  getSmtpSettings: adminProcedure.query(async () => {
    const s = await getSettings(SMTP_KEYS);    return {
      smtp_host: s.smtp_host ?? "",
      smtp_port: s.smtp_port ?? "587",
      smtp_user: s.smtp_user ?? "",
      smtp_from: s.smtp_from ?? "",
      hasPassword: Boolean(s.smtp_pass),
    };
  }),

  saveSmtpSettings: adminProcedure
    .input(
      z.object({
        smtp_host: z.string().trim().max(255),
        smtp_port: z.string().trim().max(10),
        smtp_user: z.string().trim().max(320),
        smtp_from: z.string().trim().max(320),
        smtp_pass: z.string().max(255).optional(), // empty = keep existing
      }),
    )
    .mutation(async ({ input }) => {
      await setSetting("smtp_host", input.smtp_host);
      await setSetting("smtp_port", input.smtp_port);
      await setSetting("smtp_user", input.smtp_user);
      await setSetting("smtp_from", input.smtp_from);
      if (input.smtp_pass) await setSetting("smtp_pass", input.smtp_pass);
      return { ok: true as const };
    }),

  testSmtp: adminProcedure
    .input(z.object({ to: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ input }) => {
      const smtp = await loadSmtpConfig();
      if (!isSmtpConfigured(smtp)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Save your SMTP settings first.",
        });
      }
      try {
        await sendMail(
          smtp,
          input.to,
          "Marshall's Carpet Cleaning — email setup test",
          "Your newsletter email settings are working. You can now send campaigns from the admin dashboard.",
        );
        return { ok: true as const };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Send failed: ${err instanceof Error ? err.message : "unknown error"}`,
        });
      }
    }),

  changePassword: adminProcedure
    .input(
      z.object({
        current: z.string().min(1).max(200),
        next: z.string().min(8).max(200),
      }),
    )
    .mutation(async ({ input }) => {
      const token = await verifyAdminPassword(input.current);
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is wrong" });
      }
      await setAdminPassword(input.next);
      // Old tokens are invalidated automatically (they derive from the hash)
      return { ok: true as const };
    }),

  // --- The run sheet: one day, every job, drives mapped around them ---
  daySchedule: adminProcedure
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(leads).where(isNotNull(leads.bookingJson));
      type Job = {
        id: number;
        ref: string;
        name: string;
        phone: string;
        where: string;
        town: string;
        service: string;
        kinds: ServiceKind[];
        total: number;
        paidOnline: boolean;
        payment: string | null;
        slot: number;
        startMin: number;
        endMin: number;
        status: string;
      };
      const jobs: Job[] = [];
      const pickups: { id: number; ref: string; name: string; phone: string; where: string; rugs: string; collection: string; note: string }[] = [];
      for (const row of rows) {
        const b = parseBooking(row as never) ;
        if (!b || b.preferredDate !== input.date) continue;
        const where = [row.address, row.suburb].filter(Boolean).join(", ");
        if (b.rugPickup) {
          const q = JSON.parse(row.quoteJson) as { input: Parameters<typeof serviceSummary>[0] };
          const collection =
            b.access?.method === "leave-out"
              ? `left out — ${b.access.spot || "spot on the notes"}`
              : "someone home to hand them over";
          pickups.push({
            id: row.id,
            ref: bookingReference(row as never),
            name: row.name,
            phone: row.phone,
            where,
            rugs: serviceSummary(q.input, true),
            collection,
            note: b.notes ?? "",
          });
          continue;
        }
        if (b.preferredSlot === null || b.preferredSlot === undefined) continue;
        const startMin = SLOT_START_MINUTES[b.preferredSlot] ?? 420;
        const q = JSON.parse(row.quoteJson) as { input: Parameters<typeof serviceSummary>[0] };
        jobs.push({
          id: row.id,
          ref: bookingReference(row as never),
          name: row.name,
          phone: row.phone,
          where,
          town: b.town || row.suburb || "Armidale",
          service: serviceSummary(q.input, false),
          kinds: serviceKinds(q.input),
          total: row.total,
          paidOnline: row.paidOnline,
          paidOfflineAt: row.paidOfflineAt,
          payment: b.payment,
          slot: b.preferredSlot,
          startMin,
          endMin: startMin + (b.jobMinutes || 60),
          status: row.status,
        });
      }
      jobs.sort((a, b) => a.startMin - b.startMin);

      // Drive legs: home → job 1 → job 2 → … → home. In-town hops still take
      // ~10 minutes real road time, so same-town legs get a 10-minute floor.
      const IN_TOWN_MIN = 10;
      const legs: { from: string; to: string; minutes: number; slackMin: number | null }[] = [];
      let prevTown: string = HOME_BASE.town;
      let prevEnd: number | null = null;
      for (const j of jobs) {
        const minutes = Math.max(
          IN_TOWN_MIN,
          prevEnd === null
            ? driveMinutesFor(j.town)
            : driveBetween(prevTown, j.town),
        );
        legs.push({
          from: prevEnd === null ? "Home" : prevTown,
          to: j.town,
          minutes,
          slackMin: prevEnd === null ? null : j.startMin - prevEnd - minutes,
        });
        prevTown = j.town;
        prevEnd = j.endMin;
      }
      const homeDrive = jobs.length ? Math.max(IN_TOWN_MIN, driveMinutesFor(prevTown)) : 0;
      const leaveHomeMin = jobs.length
        ? jobs[0].startMin - legs[0].minutes - 10 // 10 min to load up & breathe
        : null;
      const arriveHomeMin = jobs.length ? (prevEnd ?? 0) + homeDrive : null;

      const waypointAddresses = jobs.map((j) => j.where || j.town);
      const mapsUrl =
        jobs.length > 0
          ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(HOME_BASE.address)}&destination=${encodeURIComponent(HOME_BASE.address)}&waypoints=${encodeURIComponent(waypointAddresses.join("|"))}&travelmode=driving`
          : null;

      return { date: input.date, jobs, legs, pickups, leaveHomeMin, arriveHomeMin, homeDrive, mapsUrl };
    }),

  // --- Customer messages from the board ---
  sendConfirmationFor: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      const lead = row as never as Parameters<typeof confirmationEmail>[0];
      const sent = await deliver(lead, confirmationEmail(lead), confirmationSms(lead), { attachTerms: true });
      const channel = [sent.emailSent && "email", sent.smsSent && "SMS"].filter(Boolean).join(" + ");
      await db
        .update(leads)
        .set({
          confirmationSentAt: sent.emailSent || sent.smsSent ? new Date() : row.confirmationSentAt,
          confirmationDetail: channel
            ? `Sent by ${channel}${sent.detail ? ` — ${sent.detail}` : ""}`
            : sent.detail || "Not sent",
        })
        .where(eq(leads.id, row.id));
      return { ok: true as const, ...sent };
    }),

  completeAndThank: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found" });
      const reviewUrl = (await getSetting("google_review_url"))?.trim() || null;
      const lead = row as never as Parameters<typeof followUpEmail>[0];
      const sent = await deliver(lead, followUpEmail(lead, reviewUrl), followUpSms(lead, reviewUrl));
      const receipt = await sendReceiptFor(input.id);
      await db
        .update(leads)
        .set({ status: "completed", followUpSentAt: new Date() })
        .where(eq(leads.id, row.id));
      return { ok: true as const, ...sent, receipt, reviewUrlSet: Boolean(reviewUrl) };
    }),

  getMessagingSettings: adminProcedure.query(async () => {
    const s = await getSettings(["google_review_url", "twilio_sid", "twilio_from", "twilio_token"]);
    return {
      google_review_url: s.google_review_url ?? "",
      twilio_sid: s.twilio_sid ?? "",
      twilio_from: s.twilio_from ?? "",
      hasTwilioToken: Boolean(s.twilio_token),
    };
  }),

  saveMessagingSettings: adminProcedure
    .input(
      z.object({
        google_review_url: z.string().trim().max(500),
        twilio_sid: z.string().trim().max(100),
        twilio_from: z.string().trim().max(40),
        twilio_token: z.string().max(100).optional(), // empty = keep existing
      }),
    )
    .mutation(async ({ input }) => {
      if (input.google_review_url && !/^https?:\/\//.test(input.google_review_url)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The review link needs to be the full https:// link from your Google Business profile.",
        });
      }
      await setSetting("google_review_url", input.google_review_url);
      await setSetting("twilio_sid", input.twilio_sid);
      await setSetting("twilio_from", input.twilio_from);
      if (input.twilio_token) await setSetting("twilio_token", input.twilio_token);
      return { ok: true as const };
    }),
});
