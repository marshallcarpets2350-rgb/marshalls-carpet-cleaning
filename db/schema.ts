import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  mediumtext,
  timestamp,
  int,
  double,
  boolean,
  unique,
} from "drizzle-orm/mysql-core";

export const subscribers = mysqlTable("subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  source: varchar("source", { length: 50 }).notNull().default("website"),
  status: mysqlEnum("status", ["active", "unsubscribed"])
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leads = mysqlTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  address: varchar("address", { length: 500 }),
  suburb: varchar("suburb", { length: 255 }),
  distanceKm: double("distance_km"),
  travelFee: double("travel_fee").notNull().default(0),
  total: double("total").notNull(),
  quoteJson: text("quote_json").notNull(),
  bookingJson: text("booking_json"), // wizard answers: purpose, condition, access, when, payment
  stripeSessionId: varchar("stripe_session_id", { length: 255 }), // online payment Checkout session
  paidOnline: boolean("paid_online").notNull().default(false),
  paidOfflineAt: timestamp("paid_offline_at"), // PayID/bank/cash received — marked in the admin
  confirmationSentAt: timestamp("confirmation_sent_at"), // booking confirmation email/SMS
  confirmationDetail: varchar("confirmation_detail", { length: 500 }), // channel + any send notes
  followUpSentAt: timestamp("follow_up_sent_at"), // post-job thanks + review ask
  reminderSentAt: timestamp("reminder_sent_at"), // day-before "see you tomorrow"
  nudgeSentAt: timestamp("nudge_sent_at"), // 6-month freshen-up nudge
  receiptSentAt: timestamp("receipt_sent_at"), // payment receipt email + PDF
  invoiceSentAt: timestamp("invoice_sent_at"), // invoice email + PDF (unpaid jobs, 5pm batch)
  pickedUpAt: timestamp("picked_up_at"), // rug runs: stage-1 tick (Fri pickup) — the final tick is the Mon return
  finishedAt: timestamp("finished_at"), // owner ticked the job off — moves it to Finished jobs
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false), // ticked the deals/reminders box at booking — express consent for marketing email
  status: mysqlEnum("status", ["new", "contacted", "booked", "completed"])
    .notNull()
    .default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Slots blocked off in the admin (booked elsewhere, day off, etc.).
// A slot is also unavailable once a lead has picked it.
export const availabilityBlocks = mysqlTable(
  "availability_blocks",
  {
    id: serial("id").primaryKey(),
    date: varchar("date", { length: 10 }).notNull(), // yyyy-mm-dd
    slot: int("slot").notNull(), // index into TIME_SLOTS
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("blocks_date_slot").on(t.date, t.slot)],
);

export const campaigns = mysqlTable("campaigns", {
  id: serial("id").primaryKey(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  audienceCount: int("audience_count").notNull().default(0),
  sentCount: int("sent_count").notNull().default(0),
  failCount: int("fail_count").notNull().default(0),
  status: mysqlEnum("status", ["sent", "failed"]).notNull().default("sent"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const discountCodes = mysqlTable("discount_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  percentOff: int("percent_off").notNull(),
  active: boolean("active").notNull().default(true),
  uses: int("uses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  // MEDIUMTEXT — gallery photos live here as data URLs (up to 5 MB a side).
  value: mediumtext("value"),
});

export type Subscriber = typeof subscribers.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
