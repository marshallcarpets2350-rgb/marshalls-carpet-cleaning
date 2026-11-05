import { useState } from "react";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import FlowArt from "@/components/FlowArt";
import { Field, PillGroup } from "@/components/wizard/ui";
import { trpc } from "@/providers/trpc";
import { track } from "@/lib/track";
import { BUSINESS } from "@contracts/rates";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Stop the water",
    body: "Turn the tap, the valve, or the mains off if you can reach it safely. Every minute it runs, the damage grows.",
  },
  {
    title: "Think power",
    body: "Water near power points or appliances? Switch the power off at the meter box — only if it's dry and safe to reach. Never stand in water to do it.",
  },
  {
    title: "Lift what you can",
    body: "Furniture legs on foil or containers, valuables and rugs off the wet floor. Don't walk on wet carpet more than you have to.",
  },
  {
    title: "Photograph everything",
    body: "Before we arrive, photograph the water, the source and every affected room. Your insurer will ask for exactly this.",
  },
  {
    title: "Get us moving",
    body: "Grab the 24/7 number above or send the form below — either way it lands in our hands instantly, and we call you straight back.",
  },
];

const CAUSES = [
  { value: "Burst pipe", label: "Burst pipe" },
  { value: "Storm or rain", label: "Storm / rain" },
  { value: "Appliance or hose", label: "Appliance / hose" },
  { value: "Sewer or toilet", label: "Sewer / toilet" },
  { value: "Not sure", label: "Not sure" },
];
const ROOMS = [
  { value: "1–2 rooms", label: "1–2 rooms" },
  { value: "3–4 rooms", label: "3–4 rooms" },
  { value: "Most of the house", label: "Most of the house" },
];
const YES_NO = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
  { value: "Not sure", label: "Not sure" },
];

export default function Flood() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [cause, setCause] = useState<string | null>(null);
  const [rooms, setRooms] = useState<string | null>(null);
  const [activeLeak, setActiveLeak] = useState<string | null>(null);
  const [insurance, setInsurance] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sentRef, setSentRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flood = trpc.public.floodEmergency.useMutation({
    onSuccess: (r) => {
      setSentRef(r.reference);
      window.scrollTo(0, 0);
    },
    onError: (e) => setError(e.message || "That didn't send — call the emergency line instead."),
  });

  const valid =
    name.trim().length > 0 &&
    phone.trim().length >= 6 &&
    address.trim().length >= 3 &&
    cause !== null &&
    rooms !== null &&
    activeLeak !== null &&
    insurance !== null;

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />

      {/* Emergency strip — the number unlocks with four quick answers below */}
      <div className="bg-[#B91C1C] text-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <p className="text-sm font-bold uppercase tracking-widest">
            Flood or water damage emergency
          </p>
          <a
            href="#emergency-number"
            className="whitespace-nowrap font-display text-xl font-black no-underline md:text-2xl"
          >
            Get the 24/7 emergency number →
          </a>
        </div>
      </div>

      <main className="bg-creamlight">
        {/* ============ hero ============ */}
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h1 className="max-w-3xl font-display text-4xl font-black leading-[1.05] text-charcoal md:text-6xl">
              Water where it shouldn't be.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-charcoal/80">
              Burst pipes, storm water, washing machine hoses — we extract the
              water, dry the structure, and write the report your insurer will
              ask for. Flood work is priced by how fast someone gets there, so
              this line is answered around the clock.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#emergency-number" className="btn-pill no-underline">
                Get the emergency number
              </a>
              <a
                href="#emergency-form"
                className="border-[1.5px] border-charcoal bg-background px-6 py-3 font-bold text-charcoal no-underline transition-transform hover:-translate-y-0.5"
              >
                Send an emergency request →
              </a>
            </div>
            <p className="mt-3 text-sm text-charcoal/60">
              Four quick answers and the 24/7 number is yours — no accounts, no queues.
            </p>
          </div>
        </section>

        {/* ============ the number gate ============ */}
        <section id="emergency-number" className="border-t-[1.5px] border-charcoal bg-background py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <NumberGate />
          </div>
        </section>

        {/* ============ do this right now ============ */}
        <section className="border-t-[1.5px] border-charcoal bg-background py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-5xl">
              Do this right now.
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="border-[1.5px] border-charcoal bg-creamlight p-5">
                  <p className="font-display text-3xl font-black text-forest">{i + 1}</p>
                  <p className="mt-2 font-bold text-charcoal">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-charcoal/75">{s.body}</p>
                </div>
              ))}
              <div className="border-[1.5px] border-[#B91C1C] bg-background p-5">
                <p className="font-display text-3xl font-black text-[#B91C1C]">!</p>
                <p className="mt-2 font-bold text-charcoal">Anyone in danger?</p>
                <p className="mt-1 text-sm leading-relaxed text-charcoal/75">
                  Call 000 first. Flooded electrics, sewage and structural damage are
                  not DIY jobs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ how flood pricing works ============ */}
        <section className="border-t-[1.5px] border-charcoal py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">How pricing works</p>
            <h2 className="mt-2 font-display text-3xl font-black text-charcoal md:text-5xl">
              No panic pricing.
            </h2>
            <p className="mt-3 max-w-2xl text-charcoal/75">
              Flood work is priced off a fixed rate card — inspection, hourly
              extraction and drying, and per-fan equipment hire — never by how
              stressed you sound on the phone. We scope the job, you get the
              full price in writing before we start, and that number doesn't
              move. Your insurer gets the same figures in the report.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Inspection &amp; assessment</p>
                <ul className="mt-3 space-y-1.5 text-sm text-charcoal/75">
                  <li>• Thermal imaging &amp; moisture readings</li>
                  <li>• Scope of works within 24 hours</li>
                  <li>• Written for your insurer</li>
                </ul>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Extraction &amp; drying</p>
                <ul className="mt-3 space-y-1.5 text-sm text-charcoal/75">
                  <li>• High-powered portable extraction — units &amp; tight access are fine</li>
                  <li>• Most extractions run 1–3 hours</li>
                  <li>• After-hours rates apply 7 PM – 7 AM, stated up front</li>
                </ul>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Drying equipment</p>
                <ul className="mt-3 space-y-1.5 text-sm text-charcoal/75">
                  <li>• Most jobs need 2–4 fans for 1–3 days</li>
                  <li>• Quoted from the scope, in writing</li>
                  <li>• Monitored until moisture readings clear</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-charcoal/60">
              We dry the structure and document it. Rebuilding — plaster, carpet
              replacement, cabinetry — is a builder's job, and the insurance
              claim itself stays with you: we hand you the report they need.
            </p>
          </div>
        </section>

        {/* ============ emergency form ============ */}
        <section id="emergency-form" className="border-t-[1.5px] border-charcoal bg-background py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            {sentRef ? (
              <div className="border-[1.5px] border-charcoal bg-creamlight p-8 text-center">
                <p className="font-display text-4xl font-black text-forest">Got it — {sentRef}.</p>
                <p className="mx-auto mt-3 max-w-md text-charcoal/80">
                  Your emergency request just landed in our hands. Keep your phone
                  on you — we're calling {phone} back.
                </p>
                <p className="mt-4 text-charcoal/80">
                  Need us faster?{" "}
                  <a href="#emergency-number" className="font-bold text-forest">
                    Grab the 24/7 number above
                  </a>{" "}
                  — it takes ten seconds.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-bold uppercase tracking-widest text-forest">Emergency request</p>
                <h2 className="mt-2 font-display text-3xl font-black text-charcoal md:text-5xl">
                  Skip the phone tag.
                </h2>
                <p className="mt-3 text-charcoal/75">
                  Four quick answers and this lands with us instantly — a call
                  back follows, usually within minutes.
                </p>
                <form
                  className="mt-8 space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!valid || flood.isPending) return;
                    setError(null);
                    flood.mutate({
                      name: name.trim(),
                      phone: phone.trim(),
                      email: email.trim() || "",
                      address: address.trim(),
                      suburb: suburb.trim() || undefined,
                      cause: cause!,
                      rooms: rooms!,
                      activeLeak: activeLeak!,
                      insurance: insurance!,
                      notes: notes.trim() || undefined,
                    });
                  }}
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field id="flood-name" label="Your name">
                      <input id="flood-name" className="input-sharp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </Field>
                    <Field id="flood-phone" label="Best phone">
                      <input id="flood-phone" className="input-sharp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
                    </Field>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field id="flood-address" label="Street address">
                      <input id="flood-address" className="input-sharp" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
                    </Field>
                    <Field id="flood-suburb" label="Suburb / town">
                      <input id="flood-suburb" className="input-sharp" value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Armidale" />
                    </Field>
                  </div>
                  <Field id="flood-email" label="Email (optional — we'll send the next steps)">
                    <input id="flood-email" className="input-sharp" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
                  </Field>
                  <div>
                    <p className="mb-2 font-bold text-charcoal">What happened?</p>
                    <PillGroup options={CAUSES} value={cause} onChange={setCause} />
                  </div>
                  <div>
                    <p className="mb-2 font-bold text-charcoal">How much of the house?</p>
                    <PillGroup options={ROOMS} value={rooms} onChange={setRooms} />
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="mb-2 font-bold text-charcoal">Is it still leaking?</p>
                      <PillGroup options={YES_NO} value={activeLeak} onChange={setActiveLeak} />
                    </div>
                    <div>
                      <p className="mb-2 font-bold text-charcoal">Insurance claim?</p>
                      <PillGroup options={YES_NO} value={insurance} onChange={setInsurance} />
                    </div>
                  </div>
                  <Field id="flood-notes" label="Anything else? (optional)">
                    <textarea id="flood-notes" className="input-sharp min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Water came through the kitchen ceiling about an hour ago…" />
                  </Field>
                  {error && (
                    <p className="border-[1.5px] border-destructive bg-background px-4 py-3 text-sm font-semibold text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                  <button type="submit" disabled={!valid || flood.isPending} className="btn-pill w-full disabled:cursor-not-allowed disabled:opacity-40 md:w-auto">
                    {flood.isPending ? "Sending…" : "Send emergency request"}
                  </button>
                  <p className="text-sm text-charcoal/60">
                    Prefer to talk?{" "}
                    <a href="#emergency-number" className="font-bold text-forest">
                      Get the 24/7 emergency number
                    </a>{" "}
                    — four quick answers and it's yours.
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/**
 * The 24/7 number, unlocked by four quick details. It's deliberately light —
 * name, phone, email, address, done — because nobody mid-flood has patience
 * for paperwork. The moment it unlocks, the job lands on the flood board and
 * the owner gets an alert, so help is already moving while they dial.
 */
function NumberGate() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);

  const unlock = trpc.public.floodUnlock.useMutation({
    onSuccess: (r) => {
      track("flood_unlock", { reference: r.reference });
      setRef(r.reference);
    },
    // Even if the save hiccups, don't stand between them and help.
    onError: () => setRef(""),
  });

  const valid =
    name.trim().length > 0 &&
    phone.trim().length >= 6 &&
    /.+@.+\..+/.test(email.trim()) &&
    address.trim().length >= 3;

  if (ref !== null) {
    return (
      <div className="border-[1.5px] border-[#B91C1C] bg-creamlight p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#B91C1C]">
          You're in — here's the 24/7 line
        </p>
        <a
          href={BUSINESS.phoneHref}
          className="mt-3 inline-block font-display text-5xl font-black text-charcoal no-underline md:text-6xl"
        >
          {BUSINESS.phone}
        </a>
        <p className="mx-auto mt-4 max-w-md text-charcoal/80">
          Tap to call — day or night. And because we already have your details
          {ref ? ` (${ref})` : ""}, we'll be ringing you back even while you're
          dialling.
        </p>
        <p className="mt-3 text-sm text-charcoal/60">
          No answer? We're elbow-deep in another job — leave a message and we
          call straight back.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-widest text-[#B91C1C]">
        24/7 emergency line
      </p>
      <h2 className="mt-2 font-display text-3xl font-black text-charcoal md:text-5xl">
        The number, in four quick answers.
      </h2>
      <p className="mt-3 text-charcoal/75">
        Pop in your details and the emergency number appears straight away. No
        accounts, no waiting on approval — and the moment you send it, we have
        everything we need to call you back and get moving.
      </p>
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid || unlock.isPending) return;
          setError(null);
          unlock.mutate({
            name: name.trim(),
            phone: phone.trim(),
            email: email.trim(),
            address: address.trim(),
          });
        }}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="gate-name" label="Full name">
            <input id="gate-name" className="input-sharp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field id="gate-phone" label="Best phone">
            <input id="gate-phone" className="input-sharp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="gate-email" label="Email">
            <input id="gate-email" className="input-sharp" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" />
          </Field>
          <Field id="gate-address" label="Address of the property">
            <input id="gate-address" className="input-sharp" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
          </Field>
        </div>
        {error && (
          <p className="border-[1.5px] border-destructive bg-background px-4 py-3 text-sm font-semibold text-destructive" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={!valid || unlock.isPending} className="btn-pill w-full disabled:cursor-not-allowed disabled:opacity-40 md:w-auto">
          {unlock.isPending ? "One moment…" : "Show me the emergency number"}
        </button>
        <p className="text-sm text-charcoal/60">
          That's all — four fields, ten seconds, and the number's yours.
        </p>
      </form>
    </div>
  );
}
