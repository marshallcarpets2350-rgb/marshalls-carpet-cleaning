// Quote page — one-page scrolling carpet booking form in Marshall's voice.
// Rug pick-up and lounge/mattress quotes live on their own pages (/rugs, /lounge).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Header from "@/sections/Header";
import FlowArt from "@/components/FlowArt";
import Footer from "@/sections/Footer";
import type { TravelResult } from "@/components/AddressField";
import NewsletterForm from "@/components/NewsletterForm";
import { competitorEstimates } from "@/lib/competitors";
import { trpc } from "@/providers/trpc";
import { useRates } from "@/lib/useRates";
import {
  BUSINESS,
  BFYB_MODEL,
  computeQuote,
  money,
  conditionComplete,
  recommendDirtiness,
  estimateJobMinutes,
  emptyCondition,
  emptyAccess,
  TIME_SLOTS,
  type BookingDetails,
  type CleanPurpose,
  type ConditionAnswers,
  type ConfirmBy,
  type Dirtiness,
  type PaymentChoice,
  type QuoteInput,
  type LoungeItem,
  type MattressItem,
} from "@contracts/rates";
import StepWhereWho, { contactValid, type Contact } from "@/components/wizard/StepWhereWho";
import StepJob, { ROOMS } from "@/components/wizard/StepJob";
import { StepCarpet } from "@/components/wizard/StepCarpet";
import { StepExtras } from "@/components/wizard/StepExtras";
import StepItems from "@/components/wizard/StepItems";
import { StepWhen } from "@/components/wizard/StepWhen";
import { StepPayment } from "@/components/wizard/StepPayment";
import { StepReview } from "@/components/wizard/StepReview";

const SECTION_IDS = [
  "q-where",
  "q-job",
  "q-carpet",
  "q-extras",
  "q-lounge",
  "q-when",
  "q-payment",
];

const MISSING_LABELS = [
  "your name, phone and email",
  "the reason for the clean and at least one room",
  "the carpet questions",
  "",
  "",
  "a day and time (or 'call me to arrange')",
  "how you'd like to pay",
];

export default function Quote() {
  const rates = useRates();
  // The competitor model our 17%-under check prices from — kept current by the
  // daily price watch; falls back to the shipped model until the query lands.
  const bfybQ = trpc.public.bfybChecked.useQuery(undefined, { staleTime: 60 * 60 * 1000, retry: 1 });
  const bfybModel = bfybQ.data?.model ?? BFYB_MODEL;
  // --- one-page form: form view vs review view ---
  const [review, setReview] = useState(false);

  // --- step 1: where & who ---
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "" });
  const [travel, setTravel] = useState<TravelResult | null>(null);
  const [confirmBy, setConfirmBy] = useState<ConfirmBy>("either");

  // --- step 2: your home ---
  const [purpose, setPurpose] = useState<CleanPurpose | null>(null);
  const [mode, setMode] = useState<"rooms" | "area">("rooms");
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  // Same-visit soft furnishings — lounges & mattresses the customer adds to
  // this booking (10% off the added pieces). Rugs stay on their own page:
  // they're a Thursday/Friday pick-up run, never same-day.
  const [csLounges, setCsLounges] = useState<LoungeItem[]>([]);
  const [csMattresses, setCsMattresses] = useState<MattressItem[]>([]);
  const [areaInput, setAreaInput] = useState("");

  // --- step 3: carpet condition ---
  const [condition, setCondition] = useState<ConditionAnswers>(emptyCondition);
  const [carpetDirtiness, setCarpetDirtiness] = useState<Dirtiness>("light");

  // --- step 4: add-ons ---
  const [enzymePreSpray, setEnzymePreSpray] = useState(false);

  // --- step 5: your schedule ---
  const [whenDate, setWhenDate] = useState<string | null>(null);
  const [whenSlot, setWhenSlot] = useState<number | null>(null);
  const [whenFlexible, setWhenFlexible] = useState(false);

  // --- step 6: payment ---
  const [payment, setPayment] = useState<PaymentChoice | null>(null);

  // --- step 8: review ---
  const [notes, setNotes] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<{ code: string; percentOff: number } | null>(null);
  const [codeError, setCodeError] = useState("");
  const [slotConflict, setSlotConflict] = useState(false);

  const [submitted, setSubmitted] = useState<{ reference: string; total: number } | null>(null);
  const [paidResult, setPaidResult] = useState<{ reference: string; total: number } | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paidSession = searchParams.get("paid");
  const paymentCancelled = searchParams.get("payment") === "cancelled";

  const utils = trpc.useUtils();
  const submitLead = trpc.public.submitLead.useMutation({
    onSuccess: (r) => {
      if (r.checkoutUrl) {
        // "Pay now" → straight to Stripe's hosted checkout for the full amount
        window.location.href = r.checkoutUrl;
        return;
      }
      setSubmitted({ reference: r.reference, total: r.total });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") {
        setSlotConflict(true);
        utils.public.listAvailability.invalidate();
      }
    },
  });

  // Returning from Stripe's checkout — confirm the payment landed.
  const verifyPayment = trpc.public.verifyPayment.useMutation({
    onSuccess: (r) => {
      if (r.paid && r.reference && r.total !== undefined) {
        setPaidResult({ reference: r.reference, total: r.total });
        window.scrollTo({ top: 0 });
      }
    },
  });
  const verifyRef = verifyPayment.mutate;
  useEffect(() => {
    if (paidSession && !verifyPayment.isPending && !verifyPayment.isSuccess && !verifyPayment.isError) {
      verifyRef({ sessionId: paidSession });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidSession]);

  // Cancelled at the Stripe checkout → land them back on the form.
  useEffect(() => {
    if (paymentCancelled) setReview(false);
  }, [paymentCancelled]);

  // Service entry points from the homepage tiles. Rug and lounge/mattress
  // services live on their own pages — send people straight there.
  useEffect(() => {
    const svc = searchParams.get("service");
    if (svc === "rugs") {
      navigate("/rugs", { replace: true });
      return;
    }
    if (svc === "upholstery" || svc === "mattress") {
      navigate(`/lounge?service=${svc}`, { replace: true });
      return;
    }
    if (svc === "carpet") setRoomCounts((p) => (Object.keys(p).length > 0 ? p : { bed: 3, living: 1 }));
    const pur = searchParams.get("purpose");
    if (pur === "moving-out" || pur === "living" || pur === "selling") setPurpose(pur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- pricing ---
  const carpetAreaM2 = useMemo(() => {
    if (mode === "area") return Math.max(0, Number(areaInput) || 0);
    return ROOMS.reduce((s, r) => s + (roomCounts[r.key] ?? 0) * r.m2, 0);
  }, [mode, roomCounts, areaInput]);

  // Plain-English list of what was counted — shown on the review page.
  const roomsSummary = useMemo(() => {
    const carpetBit =
      carpetAreaM2 === 0
        ? ""
        : mode === "area"
          ? `${carpetAreaM2} m² of carpet (area entered directly)`
          : `${ROOMS.filter((r) => (roomCounts[r.key] ?? 0) > 0)
              .map((r) => `${roomCounts[r.key]}× ${r.label.toLowerCase()}`)
              .join(", ")} — ${carpetAreaM2} m² all up`;
    const softBits = [
      ...csLounges
        .filter((l) => l.seats > 0)
        .map((l) =>
          `${l.seats}-seater lounge` +
          (l.reclinerSeats > 0 ? ` (${l.reclinerSeats} recliner seat${l.reclinerSeats === 1 ? "" : "s"})` : "") +
          " — same visit",
        ),
      ...csMattresses
        .filter((m) => m.qty > 0)
        .map((m) => `${m.qty}× ${m.size} mattress — same visit`),
    ];
    return [carpetBit, ...softBits].filter(Boolean).join("; ");
  }, [mode, roomCounts, carpetAreaM2, csLounges, csMattresses]);

  // Rooms the pre-vacuum would cover — actual rooms, or a fair guess from m².
  const totalRooms = useMemo(() => {
    if (mode === "area") return carpetAreaM2 > 0 ? Math.max(1, Math.ceil(carpetAreaM2 / 16)) : 0;
    return ROOMS.reduce((s, r) => s + (roomCounts[r.key] ?? 0), 0);
  }, [mode, roomCounts, carpetAreaM2]);

  const quoteInput: QuoteInput = useMemo(
    () => ({
      carpetAreaM2,
      carpetDirtiness,
      maintenance: "none",
      lounges: csLounges.map((l) => ({ ...l, added: true })),
      mattresses: csMattresses.map((m) => ({ ...m, added: true })),
      rugs: [], // rugs are their own Thursday/Friday pick-up run — never same-day
      stainPackage: false, // stain treatment is priced from the stain answers now
      dirtGum: false,
      enzymePreSpray,
      stainTypes: condition.stains === "none" ? [] : condition.stainTypes,
      stainsBand: condition.stains ?? undefined,
      preVacuumRooms: totalRooms, // pre-vacuum is FREE on every clean — kept for the time estimate
      dryingFans: 0,
      travelFee: travel?.outOfRange ? 0 : (travel?.fee ?? 0),
      discountPercent: appliedCode?.percentOff ?? 0,
      // room counts let the BFYB comparison model their price exactly
      roomCounts: mode === "rooms" ? roomCounts : undefined,
      crossSellApplied: csLounges.length + csMattresses.length > 0,
    }),
    [carpetAreaM2, carpetDirtiness, condition, enzymePreSpray, totalRooms, travel, appliedCode, mode, roomCounts, csLounges, csMattresses],
  );

  const breakdown = useMemo(() => computeQuote(quoteInput, rates, bfybModel), [quoteInput, rates, bfybModel]);
  // Price for each clean-level card: the full discounted total if that level
  // were picked — every price on the page is the pay-this number, never a
  // pre-discount figure.
  const levelTotals = useMemo(() => {
    if (carpetAreaM2 === 0) return null;
    const t = {} as Record<Dirtiness, number>;
    for (const d of ["light", "medium", "heavy"] as Dirtiness[]) {
      t[d] = computeQuote({ ...quoteInput, carpetDirtiness: d }, rates, bfybModel).total;
    }
    return t;
  }, [carpetAreaM2, quoteInput, rates, bfybModel]);
  const jobMinutes = useMemo(() => estimateJobMinutes(quoteInput), [quoteInput]);
  // Electrodry only joins the panel when the daily watch has verified their
  // specials within the freshness window — otherwise we're not certain and
  // they stay hidden.
  const electroModel = bfybQ.data?.electro?.model ?? null;
  const competitors = useMemo(
    () =>
      competitorEstimates(quoteInput, {
        roomCounts: mode === "rooms" ? roomCounts : undefined,
        suburb: travel?.suburb,
      }, bfybModel, electroModel),
    [quoteInput, mode, roomCounts, travel, bfybModel, electroModel],
  );
  // The savings figure must match the two numbers on the page: their
  // displayed total (ex-travel) vs our displayed final total. Anything
  // BFYB can't price (mattresses etc.) simply isn't in their number — so
  // when they're partial our saving is understated, never overstated.
  const savingsBaseFor = (_c: (typeof competitors)[number]): number | null =>
    breakdown.cleaningTotal;

  // --- per-section validation ---
  const coreValid = [
    contactValid(contact),
    purpose !== null && !breakdown.isEmpty,
    carpetAreaM2 === 0 || conditionComplete(condition),
    true,
    true, // soft furnishings are optional — nothing to validate
    whenFlexible || (whenDate !== null && whenSlot !== null),
    payment !== null,
  ];
  const allValid = coreValid.every(Boolean);
  const missing = MISSING_LABELS.filter((l, i) => l && !coreValid[i]);

  const openReview = () => {
    if (!allValid) return;
    setSlotConflict(false);
    setReview(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const backToForm = (section?: number) => {
    setSlotConflict(false);
    setReview(false);
    if (section !== undefined && SECTION_IDS[section]) {
      requestAnimationFrame(() => {
        document
          .getElementById(SECTION_IDS[section])
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      window.scrollTo({ top: 0 });
    }
  };

  const applyCode = async () => {
    setCodeError("");
    if (!codeInput.trim()) return;
    try {
      const r = await utils.public.validateCode.fetch({ code: codeInput.trim() });
      if (r.valid) setAppliedCode({ code: r.code, percentOff: r.percentOff });
      else {
        setAppliedCode(null);
        setCodeError("That code isn't active — check the spelling or leave it blank.");
      }
    } catch {
      setCodeError("Couldn't check the code just now — you can still submit and we'll honour it.");
    }
  };

  const handleSubmit = () => {
    if (submitLead.isPending || !coreValid.every(Boolean)) return;
    setSlotConflict(false);
    const booking: BookingDetails = {
      purpose,
      propertyType: null,
      condition,
      recommended: recommendDirtiness(condition),
      access: emptyAccess,
      payment,
      preferredDate: whenFlexible ? null : whenDate,
      preferredSlot: whenFlexible ? null : whenSlot,
      confirmBy,
      notes: notes.trim(),
      town: travel?.suburb ?? "",
      jobMinutes,
      rugPickup: false,
      secondVisit: null,
    };
    submitLead.mutate({
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      address: travel?.addressLabel,
      suburb: travel?.suburb,
      distanceKm: travel?.km ?? null,
      quote: quoteInput,
      booking,
      discountCode: appliedCode?.code,
      origin: window.location.origin,
    });
  };

  // ===================== back from Stripe: confirming =====================
  if (paidSession && !paidResult) {
    return (
      <div className="min-h-dvh">
        <Header />
        <FlowArt />
        <main className="bg-creamlight py-20">
          <div className="mx-auto max-w-2xl px-4 md:px-6">
            <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8 md:p-12">
              {verifyPayment.isError ? (
                <>
                  <p className="text-sm font-bold uppercase tracking-widest text-destructive">Couldn't confirm the payment</p>
                  <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                    Give us a quick call.
                  </h1>
                  <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
                    If the money's left your account, your booking is safe — we can see it.
                    Call <a className="font-bold text-forest" href={BUSINESS.phoneHref}>{BUSINESS.phone}</a> and
                    he'll confirm it on the spot.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold uppercase tracking-widest text-forest">Payment received</p>
                  <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                    Confirming your booking…
                  </h1>
                  <p className="mt-5 text-lg text-charcoal/70">One tick while we check it with Stripe.</p>
                </>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ===================== paid in full online =====================
  if (paidResult) {
    return (
      <div className="min-h-dvh">
        <Header />
        <FlowArt />
        <main className="bg-creamlight py-20">
          <div className="mx-auto max-w-2xl px-4 md:px-6">
            <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8 md:p-12">
              <p className="text-sm font-bold uppercase tracking-widest text-forest">Paid — booking locked in</p>
              <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                Done and dusted.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
                Booking <strong className="font-display text-forest">{paidResult.reference}</strong> is
                paid in full —{" "}
                <strong className="font-display text-forest">{money(paidResult.total)}</strong>.
                A receipt is on its way to your email, and we'll confirm your
                time shortly.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/" className="btn-pill">Back to the site</Link>
                <a href={BUSINESS.phoneHref} className="btn-pill-dark">Call {BUSINESS.phone}</a>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ===================== success screen =====================
  if (submitted) {
    const fmtLong = (iso: string) =>
      new Date(iso + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
    const whenText = whenFlexible
      ? "We'll call you to find a day that works"
      : whenDate && whenSlot !== null
        ? `You've asked for ${fmtLong(whenDate)}, ${TIME_SLOTS[whenSlot]} — it's in the schedule already, and we'll confirm it`
        : "We'll call you to lock in a day";
    return (
      <div className="min-h-dvh">
        <Header />
        <FlowArt />
        <main className="bg-creamlight py-20">
          <div className="mx-auto max-w-2xl px-4 md:px-6">
            <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-8 md:p-12">
              <p className="text-sm font-bold uppercase tracking-widest text-forest">Booking received</p>
              <h1 className="mt-3 font-display text-4xl font-black text-charcoal md:text-5xl">
                Thanks {contact.name.split(" ")[0]} — it's with us.
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
                Your reference is{" "}
                <strong className="font-display text-forest">{submitted.reference}</strong> and
                your quoted total is{" "}
                <strong className="font-display text-forest">{money(submitted.total)}</strong>.
              </p>
              <p className="mt-3 leading-relaxed text-charcoal/80">
                {whenText}. {payment === "pay-now"
                  ? "Once it's confirmed you'll get a secure payment link — nothing is charged before that."
                  : payment === "invoice"
                    ? "We'll email your invoice after the job — bank transfer or card, whichever suits."
                    : "You'll pay cash on the day, and the receipt lands in your email."}
              </p>
              <div className="mt-8 border-t-[1.5px] border-charcoal/20 pt-8">
                <h2 className="font-display text-2xl font-black text-charcoal">
                  Want the monthly deals too?
                </h2>
                <p className="mt-2 text-charcoal/75">
                  One email a month, subscriber-only discounts. Your call.
                </p>
                <div className="mt-4">
                  <NewsletterForm source="quote-success" />
                </div>
              </div>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/" className="btn-pill">Back to the site</Link>
                <a href={BUSINESS.phoneHref} className="btn-pill-dark">Call {BUSINESS.phone}</a>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ===================== wizard =====================
  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main className="bg-creamlight py-12 pb-28 md:py-16 lg:pb-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h1 className="font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
            Book your clean.
          </h1>
          <p className="mt-3 max-w-xl text-lg text-charcoal/75">
            One page — answer your way down and the price moves as you go. The
            Continue button at the bottom takes you to the review &amp; send page.
            Lounges and mattresses can join this same visit (10% off, a few
            questions down). Rugs are their own{" "}
            <Link to="/rugs" className="font-bold text-forest underline-offset-4 hover:underline">
              Thursday/Friday pick-up &amp; clean
            </Link>
            . Nothing is booked or charged until we confirm it with you.
          </p>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
            {/* ============ LEFT: the one-page form ============ */}
            <div>
              {paymentCancelled && (
                <p className="mb-6 border-[1.5px] border-destructive bg-background px-4 py-3 text-sm font-semibold text-destructive" role="alert">
                  The card payment was cancelled — nothing was charged, and the booking wasn't sent.
                  Pick a payment option on this step and send again, or choose cash/invoice instead.
                </p>
              )}

              {!review ? (
                <>
                  <div className="space-y-12">
                    <section id="q-where">
                      <StepWhereWho
                        contact={contact} setContact={setContact}
                        travel={travel} setTravel={setTravel}
                        confirmBy={confirmBy} setConfirmBy={setConfirmBy}
                      />
                    </section>
                    <section id="q-job">
                      <StepJob
                        purpose={purpose} setPurpose={setPurpose}
                        mode={mode} setMode={setMode}
                        roomCounts={roomCounts} setRoomCounts={setRoomCounts}
                        areaInput={areaInput} setAreaInput={setAreaInput}
                        carpetAreaM2={carpetAreaM2}
                      />
                    </section>
                    <section id="q-carpet">
                      <StepCarpet
                        condition={condition} setCondition={setCondition}
                        dirtiness={carpetDirtiness} setDirtiness={setCarpetDirtiness}
                        areaM2={carpetAreaM2}
                        levelTotals={levelTotals}
                      />
                    </section>
                    <section id="q-extras">
                      <StepExtras
                        stainPackage={false} setStainPackage={() => {}}
                        enzymePreSpray={enzymePreSpray} setEnzymePreSpray={setEnzymePreSpray}
                        rugsOnly={false}
                      />
                    </section>
                    <section id="q-lounge">
                      <StepItems
                        mode="lounge"
                        lounges={csLounges} setLounges={setCsLounges}
                        mattresses={csMattresses} setMattresses={setCsMattresses}
                        rugs={[]} setRugs={() => {}}
                        kicker="Optional · same visit"
                        title="Lounge or mattress too? Add it here — 10% off."
                        sub="Same crew, same day, one booking. Anything you add here is cleaned while we're already at your place, so the added pieces come in 10% under their usual price. Rugs are different — they're a Thursday/Friday pick-up & clean, with their own quote."
                      />
                    </section>
                    <section id="q-when">
                      <StepWhen
                        date={whenDate} slot={whenSlot} flexible={whenFlexible}
                        town={travel?.suburb ?? ""}
                        jobMinutes={jobMinutes}
                        rugsOnly={false}
                        onPick={(d, s) => {
                          if (d === null) { setWhenFlexible(true); setWhenDate(null); setWhenSlot(null); }
                          else { setWhenFlexible(false); setWhenDate(d); setWhenSlot(s); }
                        }}
                      />
                    </section>
                    <section id="q-payment">
                      <StepPayment payment={payment} setPayment={setPayment} />
                    </section>
                  </div>

                  {/* The one and only Continue — opens the review & send page */}
                  <div className="mt-12 text-center">
                    <button
                      type="button"
                      onClick={openReview}
                      disabled={!allValid}
                      className="btn-pill px-10 py-4 text-xl disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Continue → check it &amp; send
                    </button>
                    {!allValid && (
                      <p className="mx-auto mt-3 max-w-md text-sm text-charcoal/60">
                        Still needed: {missing.join(" · ")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => backToForm()}
                    className="btn-pill-dark mb-8"
                  >
                    ← Back to the form
                  </button>
                  <StepReview
                  contact={contact} confirmBy={confirmBy} travel={travel}
                  purpose={purpose}
                  condition={condition} dirtiness={carpetDirtiness} breakdown={breakdown}
                  stainPackage={false}
                  enzymePreSpray={enzymePreSpray} preVacuum={false}
                  roomCount={totalRooms} jobSummary={roomsSummary}
                  payment={payment}
                  date={whenFlexible ? null : whenDate} slot={whenFlexible ? null : whenSlot}
                  rugsOnly={false} hasCarpet={carpetAreaM2 > 0} jobMinutes={jobMinutes}
                  kicker="Nearly done · review & send"
                  stepOf={{ where: 0, job: 1, carpet: 2, extras: 3, when: 5, payment: 6 }}
                  notes={notes} setNotes={setNotes}
                  codeInput={codeInput} setCodeInput={setCodeInput}
                  appliedCode={appliedCode} codeError={codeError} applyCode={applyCode}
                  submitting={submitLead.isPending}
                  submitError={submitLead.isError && !slotConflict ? `Couldn't send just now — try again, or call ${BUSINESS.phone}.` : null}
                  slotConflict={slotConflict}
                  canSubmit={allValid}
                  onSubmit={handleSubmit}
                  onGoToStep={backToForm}
                />
                </>
              )}
            </div>

            {/* ============ RIGHT: live summary ============ */}
            <aside className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto" aria-label="Quote summary">
              <div className="offset-shadow-sm border-[1.5px] border-charcoal bg-background">
                <div className="border-b-[1.5px] border-charcoal bg-charcoal px-6 py-4">
                  <p className="text-center font-display text-2xl font-black uppercase tracking-widest text-mint">Your price</p>
                </div>
                <div className="px-6 py-5">
                  {breakdown.isEmpty ? (
                    <p className="text-charcoal/60">
                      Count your rooms and your price builds here.
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {breakdown.lines.map((l, i) => (
                          <li key={i} className="flex items-baseline justify-between gap-3">
                            <span className="font-semibold text-charcoal">{l.label}</span>
                            <span className="whitespace-nowrap font-bold">{money(l.amount)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Discounts shown as their own rows, so the lines above
                          plus these always add up to the total below. */}
                      {(breakdown.rugDiscount > 0 ||
                        breakdown.maintenanceDiscount > 0 ||
                        breakdown.codeDiscount > 0 ||
                        breakdown.volumeDiscount > 0 ||
                        breakdown.undercutDiscount > 0) && (
                        <ul className="mt-3 space-y-2 border-t-[1.5px] border-charcoal/20 pt-3 text-sm">
                          {breakdown.rugDiscount > 0 && (
                            <li className="flex items-baseline justify-between gap-3 font-semibold text-[#15803D]">
                              <span>{rates.rug.bulkPercentOff}% off — {rates.rug.bulkCount}+ rugs</span>
                              <span className="whitespace-nowrap">−{money(breakdown.rugDiscount)}</span>
                            </li>
                          )}
                          {breakdown.maintenanceDiscount > 0 && (
                            <li className="flex items-baseline justify-between gap-3 font-semibold text-[#15803D]">
                              <span>2-cleans-a-year plan</span>
                              <span className="whitespace-nowrap">−{money(breakdown.maintenanceDiscount)}</span>
                            </li>
                          )}
                          {breakdown.codeDiscount > 0 && (
                            <li className="flex items-baseline justify-between gap-3 font-semibold text-[#15803D]">
                              <span>
                                {appliedCode
                                  ? `Code ${appliedCode.code} — ${appliedCode.percentOff}% off`
                                  : "Discount code"}
                              </span>
                              <span className="whitespace-nowrap">−{money(breakdown.codeDiscount)}</span>
                            </li>
                          )}
                          {breakdown.volumeDiscount > 0 && (
                            <li className="flex items-baseline justify-between gap-3 font-semibold text-[#15803D]">
                              <span>{money(rates.volumeDiscount.off)} off every {money(rates.volumeDiscount.every)}</span>
                              <span className="whitespace-nowrap">−{money(breakdown.volumeDiscount)}</span>
                            </li>
                          )}
                          {breakdown.undercutDiscount > 0 && (
                            <li className="flex items-baseline justify-between gap-3 font-semibold text-[#15803D]">
                              <span>Price-beat discount</span>
                              <span className="whitespace-nowrap">−{money(breakdown.undercutDiscount)}</span>
                            </li>
                          )}
                        </ul>
                      )}

                      <div className="mt-4 space-y-2 border-t-[1.5px] border-charcoal/20 pt-4 text-sm">
                        {breakdown.minimumApplied && (
                          <p className="text-charcoal/70">
                            Minimum charge {money(rates.minimumCharge)} applies
                          </p>
                        )}
                        <p className="flex justify-between font-semibold text-charcoal">
                          <span>
                            Travel
                            {travel?.km ? ` (~${Math.round(travel.km)}km)` : ""}
                          </span>
                          <span>
                            {travel
                              ? travel.outOfRange
                                ? "Call us"
                                : breakdown.travelFee === 0
                                  ? "Free"
                                  : money(breakdown.travelFee)
                              : "Add your address"}
                          </span>
                        </p>
                        {!breakdown.isEmpty && breakdown.onsiteWork && (
                          <p className="text-charcoal/60">
                            About {(Math.round((jobMinutes / 60) * 2) / 2).toString().replace(/\.5$/, "½")} hours on site — the calendar keeps enough room around it.
                          </p>
                        )}
                      </div>

                      <div className="mt-5 border-t-[1.5px] border-charcoal pt-4">
                        <p
                          key={breakdown.total}
                          className="total-pop font-display text-5xl font-black text-forest"
                          aria-live="polite"
                        >
                          {money(breakdown.total)}
                        </p>
                        <p className="mt-1 text-sm text-charcoal/60">
                          {travel?.outOfRange
                            ? "Cleaning total — travel quoted by phone for your area"
                            : "Total, all in. This is the number."}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!breakdown.isEmpty && (
                <div className="mt-4 border-[1.5px] border-charcoal bg-background">
                  <div className="border-b-[1.5px] border-charcoal bg-creamlight px-5 py-3">
                    <p className="text-sm font-bold uppercase tracking-widest text-charcoal">
                      Their price for the same job
                    </p>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    {competitors.filter((c) => c.total !== null).map((c) => {
                      const base = savingsBaseFor(c);
                      const saves =
                        c.total !== null && base !== null && c.total - c.travelAmount > base
                          ? c.total - c.travelAmount - base
                          : null;
                      return (
                        <div key={c.key}>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-bold text-charcoal">{c.name}</p>
                            {c.total !== null && (
                              <p className="whitespace-nowrap font-display text-2xl font-black text-[#E8710A]">
                                {money(c.total)}
                                {c.partial ? "+" : ""}
                              </p>
                            )}
                          </div>
                          {c.missing
                            .filter((m) => !m.startsWith("Their travel surcharge"))
                            .map((m) => (
                              <p key={m} className="mt-0.5 text-xs text-charcoal/50">
                                {m.split(" — ")[0]} not in their price
                              </p>
                            ))}
                          {saves !== null && (
                            <p className="mt-1 font-display text-lg font-black text-[#15803D] md:text-xl">
                              🎉 Marshall's saves you{" "}
                              <span className="whitespace-nowrap">
                                {money(saves)}
                                {c.partial ? " or more" : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mt-4 border-[1.5px] border-charcoal bg-creamlight p-4 text-center">
                <p className="text-sm font-bold text-charcoal">
                  Holding a cheaper written quote for the same job?
                </p>
                <p className="mt-1 text-sm text-charcoal/70">
                  <a href={BUSINESS.phoneHref} className="font-bold text-forest">
                    Call {BUSINESS.phone}
                  </a>{" "}
                  — we'll beat it. Residential or commercial.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* ============ mobile bottom price bar ============ */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-charcoal bg-background lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-charcoal/50">
              Your price
            </p>
            <p className="font-display text-3xl font-black text-forest" aria-live="polite">
              {breakdown.isEmpty ? "—" : money(breakdown.total)}
            </p>
          </div>
          {!review ? (
            <button
              type="button"
              onClick={openReview}
              disabled={!allValid}
              className="btn-pill disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLead.isPending || !allValid}
              className="btn-pill disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitLead.isPending ? "Sending…" : "Send booking"}
            </button>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
