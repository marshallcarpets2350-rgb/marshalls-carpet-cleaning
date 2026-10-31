// Step 6 — payment: the customer's choice. Pay now runs through Stripe's
// hosted checkout; cash and invoice are handled by us after the job.
import { trpc } from "@/providers/trpc";
import type { PaymentChoice } from "@contracts/rates";
import { PAYMENT_LABELS } from "@contracts/rates";
import { OptionCard, StepHeading } from "./ui";

export function StepPayment({ payment, setPayment, kicker = "Step 6 · Payment" }: { payment: PaymentChoice | null; setPayment: (p: PaymentChoice) => void; kicker?: string }) {
  const configured = trpc.public.paymentsConfigured.useQuery(undefined, { staleTime: 60_000 });
  const live = configured.data?.configured === true;

  const OPTIONS: { value: PaymentChoice; hint: string }[] = [
    {
      value: "pay-now",
      hint: live
        ? "Secure card payment — Visa, Mastercard, Apple Pay. When you hit Send you'll go straight to the checkout, and your booking is locked in paid."
        : "We'll text or email you a secure payment link once we've confirmed the booking. Nothing is charged before that.",
    },
    { value: "invoice", hint: "We do the job first, then email you an invoice — pay by PayID, bank transfer or card." },
    { value: "cash", hint: "Cash on the day, or instant bank transfer to our PayID — the PayID is in your confirmation email. A receipt is still emailed to you for your records." },
  ];

  return (
    <div className="space-y-8">
      <StepHeading kicker={kicker} title="How would you like to pay?" sub="Entirely up to you — the price is the same whichever you choose. No card surcharge, no booking fee." />
      <div className="grid gap-4" role="radiogroup" aria-label="Payment method">
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.value}
            selected={payment === o.value}
            onClick={() => setPayment(o.value)}
            title={PAYMENT_LABELS[o.value]}
            hint={o.hint}
            badge={o.value === "pay-now" && live ? "Instant confirmation" : undefined}
          />
        ))}
      </div>
      <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/70">
        {live
          ? "Card details are never typed into this website — \"pay now\" takes you to Stripe's own secure checkout page."
          : "Card details are never typed into this website — card payments arrive as a secure link you can pay from your phone."}
      </p>
    </div>
  );
}
