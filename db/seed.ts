import { getDb } from "../api/queries/connection";
import { discountCodes, settings } from "./schema";
import { createHash } from "node:crypto";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Default admin password: marshall2026 — change it in Admin → Settings.
  const hash = createHash("sha256").update("marshall2026").digest("hex");
  await db
    .insert(settings)
    .values({ key: "admin_password_hash", value: hash })
    .onDuplicateKeyUpdate({ set: { value: hash } });

  // Prefill SMTP defaults (password stays empty until the Gmail app password is added)
  const defaults: [string, string][] = [
    ["smtp_host", "smtp.gmail.com"],
    ["smtp_port", "587"],
    ["smtp_user", "Marshallcarpets2350@gmail.com"],
  ];
  for (const [key, value] of defaults) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
  }

  // Welcome discount for new newsletter subscribers
  await db
    .insert(discountCodes)
    .values({ code: "WELCOME10", percentOff: 10, active: true })
    .onDuplicateKeyUpdate({ set: { percentOff: 10, active: true } });

  console.log("Done.");
  process.exit(0);
}

seed();
