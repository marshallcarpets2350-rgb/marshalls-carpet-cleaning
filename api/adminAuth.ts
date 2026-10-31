import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { publicQuery } from "./middleware";
import { getSetting } from "./queries/settings";
import { env } from "./lib/env";

const PASSWORD_KEY = "admin_password_hash";

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function tokenFor(passwordHash: string): string {
  return createHmac("sha256", `${passwordHash}:${env.appSecret}`)
    .update("marshall-admin-session")
    .digest("hex");
}

export async function verifyAdminPassword(
  password: string,
): Promise<string | null> {
  const stored = await getSetting(PASSWORD_KEY);
  if (!stored) return null;
  if (hashPassword(password) !== stored) return null;
  return tokenFor(stored);
}

export async function setAdminPassword(password: string): Promise<void> {
  const { setSetting } = await import("./queries/settings");
  await setSetting(PASSWORD_KEY, hashPassword(password));
}

async function assertAdminToken(token: string | undefined): Promise<void> {
  const stored = await getSetting(PASSWORD_KEY);
  if (!stored || !token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  }
  const expected = tokenFor(stored);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expired — sign in again" });
  }
}

/** Procedure that requires a valid admin token in the Authorization header. */
export const adminProcedure = publicQuery.use(async ({ ctx, next }) => {
  const header = ctx.req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  await assertAdminToken(token);
  return next();
});
