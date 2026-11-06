import { z } from "zod";
import { createRouter } from "./middleware";
import { adminProcedure, verifyAdminPassword, setAdminPassword } from "./adminAuth";
import { publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { subscribers, leads, campaigns, discountCodes, availabilityBlocks } from "@db/schema";
import { eq, desc, count, gte, isNotNull } from "drizzle-orm";
import { TIME_SLOTS, SLOT_START_MINUTES, HOME_BASE, driveMinutesFor, driveBetween, serviceSummary, serviceParts, serviceKinds, floodPrices, floodReportCharges, computeQuote, travelFeeForTown, type QuoteInput, type ServiceKind } from "@contracts/rates";
import { quoteInputSchema } from "./publicRouter";
import { getSetting, getSettings, setSetting, RATE_OVERRIDES_KEY, loadRates } from "./queries/settings";
import { getStripe } from "./payments";
import { sendReceiptFor } from "./receipts";
import { sendInvoiceFor } from "./invoices";
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
  floodReportEmail,
  deliver,
} from "./messages";
import { TRPCError } from "@trpc/server";
import { getPriceWatchReport, runPriceWatch, loadBfybModel } from "./priceWatch";
import { floodReportPdfBuffer, type FloodReportData } from "./floodReportPdf";
import { brandedEmailHtml, EMAIL_CID } from "./emailTemplate";
import { brandLogo } from "./brand";

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
      // Marking a job done fires the customer's receipt (once per job) — but
      // only when it's actually paid. Unpaid jobs get the invoice instead,
      // either from the 5pm batch or the board's "Send invoice" button.
      let receipt = null;
      if (input.status === "completed") {
        const [row] = await getDb().select().from(leads).where(eq(leads.id, input.id)).limit(1);
        if (row && (row.paidOnline || row.paidOfflineAt)) receipt = await sendReceiptFor(input.id);
      }
      return { ok: true as const, receipt };
    }),

  // PayID / bank / cash landed — tick it off on the board (or untick on a mistake).
  // Ticking paid fires the receipt (once per job); unticking leaves any sent
  // receipt alone — the customer already has it, no take-backs by email.
  markLeadPaid: adminProcedure
    .input(z.object({ id: z.number(), paid: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(leads)
        .set({ paidOfflineAt: input.paid ? new Date() : null })
        .where(eq(leads.id, input.id));
      const receipt = input.paid ? await sendReceiptFor(input.id) : null;
      return { ok: true as const, receipt };
    }),

  // Manual invoice for a completed-but-unpaid job (the 5pm batch also sends
  // these automatically — this is the mid-day "send it now" button).
  sendInvoice: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const invoice = await sendInvoiceFor(input.id);
      return { ok: true as const, invoice };
    }),

  // Tick-off: the job's done, the money side is sorted (paid, or at least
  // invoiced), and it moves off the Jobs board into Finished jobs.
  finishLead: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const paid = row.paidOnline || row.paidOfflineAt;
      if (!paid && !row.invoiceSentAt) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Not ready to tick off — the customer hasn't paid and no invoice has gone out. Send the invoice or mark it paid first.",
        });
      }
      await db
        .update(leads)
        .set({ finishedAt: new Date(), status: "completed" })
        .where(eq(leads.id, input.id));
      return { ok: true as const };
    }),

  // A flood job phoned in — Ben takes the details over the phone and starts
  // the job card himself, so it lands in Flood reports ready for the report.
  createFloodLead: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        phone: z.string().trim().min(6).max(40),
        email: z.string().trim().toLowerCase().email().max(320).optional().or(z.literal("")),
        address: z.string().trim().min(3).max(500),
        suburb: z.string().trim().max(255).optional(),
        cause: z.string().trim().max(100).optional(),
        rooms: z.string().trim().max(100).optional(),
        activeLeak: z.string().trim().max(30).optional(),
        insurance: z.string().trim().max(30).optional(),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const model = await loadBfybModel();
      const inspectionPrice = floodPrices(model).inspection;
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
          flood: {
            name: input.name,
            phone: input.phone,
            email: input.email || undefined,
            address: input.address,
            suburb: input.suburb ?? "",
            cause: input.cause || "Phoned in",
            rooms: input.rooms || "Not sure",
            activeLeak: input.activeLeak || "Not sure",
            insurance: input.insurance || "Not sure",
            notes: input.notes || undefined,
          },
        }),
        bookingJson: null,
        status: "new",
      });
      const id = Number((result[0] as { insertId?: number }).insertId ?? 0);
      return { ok: true as const, id, reference: `MCC-${String(id).padStart(4, "0")}` };
    }),

  // ── Quote-only leads ──────────────────────────────────────────────
  // Ben prices a job for someone (over the phone, on site, wherever) and
  // saves it WITHOUT a booking date. No calendar slot is blocked, no
  // automated emails fire — it's just a saved price, ready to convert to a
  // booking when the customer says yes.
  saveQuote: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        phone: z.string().trim().max(40).optional().or(z.literal("")),
        email: z.string().trim().toLowerCase().email().max(320).optional().or(z.literal("")),
        address: z.string().trim().max(500).optional().or(z.literal("")),
        suburb: z.string().trim().max(255).optional().or(z.literal("")),
        town: z.string().trim().max(100).optional().or(z.literal("")),
        notes: z.string().trim().max(2000).optional().or(z.literal("")),
        quote: quoteInputSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rates = await loadRates();
      const town = input.town || input.suburb || "";
      const quote: QuoteInput = {
        ...input.quote,
        travelFee: travelFeeForTown(town || null, 0, rates),
        discountPercent: 0,
      };
      const breakdown = computeQuote(quote, rates, await loadBfybModel());
      const result = await db.insert(leads).values({
        name: input.name,
        email: input.email || "",
        phone: input.phone || "",
        address: input.address || null,
        suburb: input.suburb || town || null,
        distanceKm: null,
        travelFee: breakdown.travelFee,
        total: breakdown.total,
        quoteJson: JSON.stringify({
          input: quote,
          breakdown,
          quoteOnly: true,
          notes: input.notes || undefined,
        }),
        bookingJson: null,
        status: "new",
      });
      const id = Number((result[0] as { insertId?: number }).insertId ?? 0);
      return { ok: true as const, id, reference: `MCC-${String(id).padStart(4, "0")}`, total: breakdown.total };
    }),

  // ── Flood job reports ─────────────────────────────────────────────
  // Ben logs what happened on a flood callout; the report prices itself off
  // the published flood rates (live BFYB model when the watch has one) and
  // produces the insurer-ready PDF.
  floodReportData: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      let parsed: { flood?: unknown; floodReport?: FloodReportData } = {};
      try { parsed = JSON.parse(lead.quoteJson); } catch { /* fall through */ }
      const prices = floodPrices(await loadBfybModel());
      return {
        lead: {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          suburb: lead.suburb,
          status: lead.status,
          total: lead.total,
          createdAt: lead.createdAt,
        },
        flood: parsed.flood ?? null,
        report: parsed.floodReport ?? null,
        prices,
      };
    }),

  saveFloodReport: adminProcedure
    .input(
      z.object({
        id: z.number(),
        attendedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        technicians: z.number().int().min(1).max(6),
        standardHours: z.number().min(0).max(200),
        afterHoursHours: z.number().min(0).max(200),
        fans: z.number().int().min(0).max(40),
        fanDays: z.number().int().min(0).max(60),
        inspectionCharged: z.boolean(),
        summary: z.string().trim().max(4000),
        workDone: z.string().trim().max(4000),
        readings: z.string().trim().max(4000),
        insurerNotes: z.string().trim().max(4000),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      const prices = floodPrices(await loadBfybModel());
      const { lines, total } = floodReportCharges(input, prices);
      if (total <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to charge — add hours, fans or the inspection" });
      }
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(lead.quoteJson); } catch { /* fall through */ }
      const prev = parsed.floodReport as FloodReportData | undefined;
      const report: FloodReportData = {
        attendedAt: input.attendedAt,
        technicians: input.technicians,
        standardHours: input.standardHours,
        afterHoursHours: input.afterHoursHours,
        fans: input.fans,
        fanDays: input.fanDays,
        inspectionCharged: input.inspectionCharged,
        summary: input.summary,
        workDone: input.workDone,
        readings: input.readings,
        insurerNotes: input.insurerNotes,
        rates: prices,
        savedAt: new Date().toISOString(),
        emailedAt: prev?.emailedAt,
      };
      parsed.floodReport = report;
      parsed.breakdown = { lines, travelFee: 0, total };
      await db.update(leads).set({ quoteJson: JSON.stringify(parsed), total }).where(eq(leads.id, input.id));
      return { ok: true as const, total };
    }),

  emailFloodReport: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [lead] = await db.select().from(leads).where(eq(leads.id, input.id)).limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(lead.quoteJson); } catch { /* fall through */ }
      const report = parsed.floodReport as FloodReportData | undefined;
      if (!report) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Save the report first" });
      if (!lead.email) throw new TRPCError({ code: "BAD_REQUEST", message: "No customer email on this job" });
      const smtp = await loadSmtpConfig();
      if (!isSmtpConfigured(smtp)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gmail settings aren't saved yet" });
      }
      const breakdown = parsed.breakdown as { lines?: { label: string; amount: number }[]; total?: number } | undefined;
      const lines = breakdown?.lines ?? [];
      const total = breakdown?.total ?? lead.total;
      const pdf = await floodReportPdfBuffer(lead, (parsed.flood as never) ?? null, report, lines, total);
      const em = floodReportEmail(lead as never, total, report.attendedAt);
      const ref = bookingReference(lead as never);
      await sendMail(smtp, lead.email, em.subject, em.text, [
        { filename: `Flood-Report-${ref}.pdf`, content: pdf, contentType: "application/pdf" },
        { filename: "logo.png", content: brandLogo(), contentType: "image/png", cid: EMAIL_CID.logo },
      ], brandedEmailHtml(em.text));
      report.emailedAt = new Date().toISOString();
      await db.update(leads).set({ quoteJson: JSON.stringify(parsed) }).where(eq(leads.id, input.id));
      return { ok: true as const, emailedTo: lead.email };
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

  // Manual rating + count — the homepage badge runs off these until the
  // Places API is connected (and as a fallback if the key ever stops working).
  saveGoogleManual: adminProcedure
    .input(z.object({ rating: z.number().min(1).max(5), count: z.number().int().min(1).max(100000) }))
    .mutation(async ({ input }) => {
      const { saveGoogleManual } = await import("./googleReviews");
      await saveGoogleManual(input.rating, input.count);
      return { ok: true as const };
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
        lines: string[]; // main work items, one per line
        extras: string[]; // treatment/extras the customer chose
        warning: string | null; // e.g. pet stains without stain treatment
        notes: string | null;
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
        // Full street address for the run sheet — the suburb is only added
        // when the address line doesn't already end with it (Google-style
        // addresses like "…, Armidale, New South Wales, 2350" already do).
        const addr = (row.address ?? "").trim();
        const sub = (row.suburb ?? "").trim();
        const where = addr
          ? sub && !addr.toLowerCase().includes(sub.toLowerCase())
            ? `${addr}, ${sub}`
            : addr
          : sub;
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
        const startMin = SLOT_START_MINUTES[b.preferredSlot] ?? 480;
        const q = JSON.parse(row.quoteJson) as { input: Parameters<typeof serviceSummary>[0] };
        const quoteInput = q.input;
        const sp = serviceParts(quoteInput, false);
        // Plain-English flag: pet stains on the job but no stain treatment
        // paid for — so the operator knows not to reach for stain chemicals.
        const treatmentBooked = Boolean(
          quoteInput && (quoteInput.stainPackage || quoteInput.enzymePreSpray || quoteInput.stainTypes.length > 0),
        );
        const cond = b.condition;
        const stainsNoted = Boolean(cond?.stains && cond.stains !== "none");
        const petStain = Boolean(
          cond?.stainTypes?.includes("pet-urine") ||
            (cond?.pets === "inside" && stainsNoted) ||
            /pet|dog|cat|puppy|urine/i.test(b.notes ?? ""),
        );
        jobs.push({
          id: row.id,
          ref: bookingReference(row as never),
          name: row.name,
          phone: row.phone,
          where,
          town: b.town || row.suburb || "Armidale",
          lines: sp.main,
          extras: sp.extras,
          warning:
            petStain && !treatmentBooked
              ? "Pet stains on this one, but no stain treatment booked — straight clean only, no stain chemicals."
              : null,
          notes: b.notes || null,
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
      const paid = row.paidOnline || row.paidOfflineAt;
      let sent: { emailSent: boolean; smsSent: boolean; detail: string };
      let receipt: Awaited<ReturnType<typeof sendReceiptFor>> | null = null;
      let invoice: Awaited<ReturnType<typeof sendInvoiceFor>> | null = null;
      if (paid) {
        sent = await deliver(lead, followUpEmail(lead, reviewUrl), followUpSms(lead, reviewUrl));
        receipt = await sendReceiptFor(input.id);
      } else {
        // Unpaid — invoice email carries the thank-you + review ask, with
        // card/PayID/bank payment options and the PDF attached.
        invoice = await sendInvoiceFor(input.id);
        sent = { emailSent: invoice.sent, smsSent: false, detail: invoice.detail };
      }
      await db
        .update(leads)
        .set({ status: "completed", followUpSentAt: new Date() })
        .where(eq(leads.id, row.id));
      return { ok: true as const, ...sent, receipt, invoice, reviewUrlSet: Boolean(reviewUrl) };
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
