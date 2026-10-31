// Stripe integration — Checkout Sessions for "pay now online" bookings.
// No Stripe.js on the client: we redirect to Stripe's hosted checkout page,
// so only the secret key is needed (kept in the settings table, never sent
// to the browser).
import Stripe from "stripe";
import { getSetting } from "./queries/settings";

export async function getStripe(): Promise<Stripe | null> {
  const key = (await getSetting("stripe_secret_key"))?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function isStripeConfigured(): Promise<boolean> {
  return (await getStripe()) !== null;
}
