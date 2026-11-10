import { useEffect } from "react";
import AddressField, { type TravelResult } from "@/components/AddressField";
import { Field, StepHeading, PillGroup } from "./ui";
import { trpc } from "@/providers/trpc";
import type { ConfirmBy } from "@contracts/rates";

export interface Contact {
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
}

export function contactValid(c: Contact): boolean {
  return (
    c.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(c.email) &&
    c.phone.trim().length >= 6
  );
}

export default function StepWhereWho({
  contact,
  setContact,
  travel,
  setTravel,
  confirmBy,
  setConfirmBy,
}: {
  contact: Contact;
  setContact: (c: Contact) => void;
  travel: TravelResult | null;
  setTravel: (t: TravelResult | null) => void;
  confirmBy: ConfirmBy;
  setConfirmBy: (c: ConfirmBy) => void;
}) {
  // Text confirmations only appear once SMS is connected in admin settings —
  // until then every booking confirms by email, so nobody's promised a text
  // that can't send.
  const smsOn = trpc.public.messagingConfigured.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const smsAvailable = smsOn.data?.sms === true;

  useEffect(() => {
    // Only force email once the server has answered — not while it's loading.
    if (smsOn.isSuccess && !smsAvailable && confirmBy !== "email") setConfirmBy("email");
  }, [smsOn.isSuccess, smsAvailable, confirmBy, setConfirmBy]);

  return (
    <div className="space-y-8">
      <StepHeading
        kicker="Step 1 · Your details"
        title="Where are we coming?"
        sub="The address sets the travel fee — the rest is so we can confirm the job back to you."
      />

      <div className="border-[1.5px] border-charcoal bg-background p-5 md:p-6">
        <AddressField value={travel} onChange={setTravel} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cname" label="Your name">
          <input
            id="cname"
            className="input-sharp"
            autoComplete="name"
            value={contact.name}
            onChange={(e) => setContact({ ...contact, name: e.target.value })}
          />
        </Field>
        <Field id="cphone" label="Phone">
          <input
            id="cphone"
            className="input-sharp"
            type="tel"
            autoComplete="tel"
            value={contact.phone}
            onChange={(e) => setContact({ ...contact, phone: e.target.value })}
          />
        </Field>
      </div>
      <Field id="cemail" label="Email">
        <input
          id="cemail"
          className="input-sharp max-w-md"
          type="email"
          autoComplete="email"
          value={contact.email}
          onChange={(e) => setContact({ ...contact, email: e.target.value })}
        />
      </Field>

      <div>
        {smsAvailable ? (
          <>
            <p className="mb-2 font-bold text-charcoal">How should we confirm the booking?</p>
            <PillGroup
              label="Confirm by"
              value={confirmBy}
              onChange={(v) => setConfirmBy(v as ConfirmBy)}
              options={[
                { value: "either", label: "Either" },
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
              ]}
            />
          </>
        ) : (
          <p className="font-bold text-charcoal">
            We'll email your booking confirmation the moment it lands.
          </p>
        )}
        <p className="mt-3 text-sm text-charcoal/60">
          Nothing is booked yet and nothing is charged — we call or email to lock in the day first.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 border-[1.5px] border-charcoal/20 bg-mintlight/40 p-4">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-forest"
          checked={contact.marketingOptIn}
          onChange={(e) => setContact({ ...contact, marketingOptIn: e.target.checked })}
        />
        <span className="text-sm leading-relaxed text-charcoal/80">
          <span className="font-bold text-charcoal">Email me seasonal deals and cleaning reminders</span>
          {" "}— a few emails a year, like the pre-Christmas and end-of-lease slots. Unsubscribe anytime.
        </span>
      </label>
    </div>
  );
}
