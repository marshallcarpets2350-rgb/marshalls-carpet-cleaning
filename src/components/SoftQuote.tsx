// Shared one-page scrolling quote for the soft-furnishing services.
// Two kinds:
//   "lounge" — /lounge — lounges & mattresses, on-site visit, fabric add-ons
//   "rugs"   — /rugs   — rug pick-up & clean, Friday 3–5pm run
// No progress rail, no steps — one page down, Continue at the bottom, then a
// review & send screen. Same engine, same live calendar, same server as the
// carpet quote.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Header from "@/sections/Header";
import FlowArt from "@/components/FlowArt";
import Footer from "@/sections/Footer";
import type { TravelResult } from "@/components/AddressField";
import NewsletterForm from "@/components/NewsletterForm";
import { trpc } from "@/providers/trpc";
import { useRates } from "@/lib/useRates";
import { competitorEstimates } from "@/lib/competitors";
import {
  BUSINESS,
  BFYB_MODEL,
  computeQuote,
  money,
  estimateJobMinutes,
  emptyCondition,
  emptyAccess,
  rugCount,
  rugPickupTravelFee,
  RUG_SIZES,
  TIME_SLOTS,
  type BookingDetails,
  type ConfirmBy,
  type LoungeItem,
  type MattressItem,
  type PaymentChoice,
  type QuoteInput,
  type RugItem,
} from "@contracts/rates";
import StepWhereWho, { contactValid, type Contact } from "@/components/wizard/StepWhereWho";
import StepItems from "@/components/wizard/StepItems";
import { StepExtras } from "@/components/wizard/StepExtras";
import { StepWhen } from "@/components/wizard/StepWhen";
import { StepPayment } from "@/components/wizard/StepPayment";
import { StepReview } from "@/components/wizard/StepReview";
import { OptionCard } from "@/components/wizard/ui";

const COPY = {
  lounge: {
    title: "Lounge, mattress & upholstery.",
    blurb: (
      <>
        Lounges are priced per seat with three soiling levels, mattresses by size
        — answer your way down and the price builds as you go. Rugs have their own{" "}
        <Link to="/rugs" className="font-bold text-forest underline-offset-4 hover:underline">
          pick-up &amp; clean service
        </Link>
        , and carpet has its own{" "}
        <Link to="/quote" className="font-bold text-forest underline-offset-4 hover:underline">
          carpet quote
        </Link>
        .
      </>
    ),
    empty: "Add a lounge or mattress and your price builds here.",
    missingItems: "at least one lounge or mattress",
  },
  rugs: {
    title: "Rug pick-up & clean.",
    blurb: (
      <>
        We collect your rugs on Fridays between 3 and 5pm, wash and dry
        them at our premises, and have them back on your floor Monday. Free pickup
        in Armidale — beyond town it's a flat $1 per km. Lounges, mattresses and
        carpet have their own quotes —{" "}
        <Link to="/lounge" className="font-bold text-forest underline-offset-4 hover:underline">
          lounge &amp; mattress
        </Link>{" "}
        and{" "}
        <Link to="/quote" className="font-bold text-forest underline-offset-4 hover:underline">
          carpet
        </Link>
        .
      </>
    ),
    empty: "Pick your rug sizes and your price builds here.",
    missingItems: "at least one rug",
  },
} as const;

export default function SoftQuote({ kind }: { kind: "lounge" | "rugs" }) {
  const rates = useRates();
  const bfybQ = trpc.public.bfybChecked.useQuery(undefined, { staleTime: 60 * 60 * 1000, retry: 1 });
  const bfybModel = bfybQ.data?.model ?? BFYB_MODEL;
  const copy = COPY[kind];
  const isRugs = kind === "rugs";

  // --- form vs review view ---
  const [review, setReview] = useState(false);

  // --- where & who ---
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "" });
  const [travel, setTravel] = useState<TravelResult | null>(null);
  const [confirmBy, setConfirmBy] = useState<ConfirmBy>("either");

  // --- the items ---
  const [lounges, setLounges] = useState<LoungeItem[]>([]);
  const [mattresses, setMattresses] = useState<MattressItem[]>([]);
  const [rugs, setRugs] = useState<RugItem[]>([]);

  // --- cross-sell: extra rugs at 10% off (kept apart from the main items) ---
  const [csRugs, setCsRugs] = useState<RugItem[]>([]);

  // --- add-ons (lounge page: fabric treatments) ---
  const [stainPackage, setStainPackage] = useState(false);
  const [enzymePreSpray, setEnzymePreSpray] = useState(false);

  // --- schedule ---
  const [whenDate, setWhenDate] = useState<string | null>(null);
  const [whenSlot, setWhenSlot] = useState<number | null>(null);
  const [whenFlexible, setWhenFlexible] = useState(false);

  // --- rug pickup: where do we grab them from? ---
  const [pickupPlan, setPickupPlan] = useState<"leave-out" | "be-there" | null>(null);
  const [pickupSpot, setPickupSpot] = useState("");

  // --- payment ---
  const [payment, setPayment] = useState<PaymentChoice | null>(null);

  // --- review ---
  const [notes, setNotes] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<{ code: string; percentOff: number } | null>(null);
  const [codeError, setCodeError] = useState("");
  const [slotConflict, setSlotConflict] = useState(false);

  const [submitted, setSubmitted] = useState<{ reference: string; total: number } | null>(null);
  const [paidResult, setPaidResult] = useState<{ reference: string; total: number } | null>(null);
  const [searchParams] = useSearchParams();
  const paidSession = searchParams.get("paid");
  const paymentCancelled = searchParams.get("payment") === "cancelled";

  const utils = trpc.useUtils();
  const submitLead = trpc.public.submitLead.useMutation({
    onSuccess: (r) => {
      if (r.checkoutUrl) {
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

  useEffect(() => {
    if (paymentCancelled) setReview(false);
  }, [paymentCancelled]);

  // Entry points — /lounge?service=upholstery|mattress pre-adds an item.
  useEffect(() => {
    if (isRugs) return;
    const svc = searchParams.get("service");
    if (svc === "upholstery")
      setLounges((p) => (p.length > 0 ? p : [{ seats: 3, dirtiness: "light", reclinerSeats: 0 }]));
    if (svc === "mattress")
      setMattresses((p) => (p.length > 0 ? p : [{ size: "queen", dirtiness: "light", qty: 1 }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasItems = isRugs
    ? rugCount(rugs) > 0
    : lounges.some((l) => l.seats > 0) || mattresses.some((m) => m.qty > 0);

  // Same-visit bundle: the FIRST kind of item the customer starts with is the
  // service they came for — full price. If they add the other kind (lounge ↔
  // mattress) to the same visit, those added pieces get 10% off.
  const firstKindRef = useRef<"lounge" | "mattress" | null>(null);
  const hasLounges = lounges.some((l) => l.seats > 0);
  const hasMattresses = mattresses.some((m) => m.qty > 0);
  if (firstKindRef.current === null && !isRugs) {
    if (hasLounges) firstKindRef.current = "lounge";
    else if (hasMattresses) firstKindRef.current = "mattress";
  }
  const bundleActive = !isRugs && hasLounges && hasMattresses;

  const quoteInput: QuoteInput = useMemo(
    () => ({
      carpetAreaM2: 0,
      carpetDirtiness: "light",
      maintenance: "none",
      lounges: isRugs
        ? []
        : lounges.map((l) => ({ ...l, added: bundleActive && firstKindRef.current === "mattress" })),
      mattresses: isRugs
        ? []
        : mattresses.map((m) => ({ ...m, added: bundleActive && firstKindRef.current === "lounge" })),
      rugs: [...rugs, ...csRugs],
      crossSellApplied: bundleActive || csRugs.length > 0,
      stainPackage: isRugs ? false : stainPackage,
      dirtGum: false,
      enzymePreSpray: isRugs ? false : enzymePreSpray,
      stainTypes: [],
      preVacuumRooms: 0,
      dryingFans: 0,
      travelFee: travel?.outOfRange
        ? 0
        : isRugs && travel
          ? rugPickupTravelFee(travel.km, rates, travel.suburb)
          : (travel?.fee ?? 0),
      discountPercent: appliedCode?.percentOff ?? 0,
    }),
    [isRugs, lounges, mattresses, rugs, csRugs, stainPackage, enzymePreSpray, travel, appliedCode, bundleActive],
  );

  const breakdown = useMemo(() => computeQuote(quoteInput, rates, bfybModel), [quoteInput, rates, bfybModel]);
  const jobMinutes = useMemo(() => estimateJobMinutes(quoteInput), [quoteInput]);
  const electroModel = bfybQ.data?.electro?.model ?? null;
  const competitors = useMemo(
    () => competitorEstimates(quoteInput, { suburb: travel?.suburb }, bfybModel, electroModel),
    [quoteInput, travel, bfybModel, electroModel],
  );

  // Plain-English list of the items — shown on the review page.
  const itemsSummary = useMemo(() => {
    const rugBits = [...rugs, ...csRugs]
      .filter((r) => r.qty > 0)
      .map((r) => `${r.qty}× ${RUG_SIZES.find((x) => x.id === r.size)?.label.toLowerCase() ?? r.size} rug`);
    if (isRugs) return rugBits.join(", ");
    return [
      ...lounges.filter((l) => l.seats > 0).map((l) => {
        const bits = [`${l.seats}-seater lounge`];
        if (l.reclinerSeats > 0) bits.push(`(${l.reclinerSeats} recliner seat${l.reclinerSeats === 1 ? "" : "s"})`);
        return bits.join(" ");
      }),
      ...mattresses.filter((m) => m.qty > 0).map((m) => `${m.qty}× ${m.size} mattress`),
      ...rugBits,
    ].join(", ");
  }, [isRugs, rugs, csRugs, lounges, mattresses]);

  // --- sections + validation ---
  const sectionKeys = isRugs
    ? (["where", "items", "when", "payment"] as const)
    : (["where", "items", "extras", "when", "payment"] as const);
  const SECTION_IDS = sectionKeys.map((k) => `s-${kind}-${k}`);

  const validByKey: Record<(typeof sectionKeys)[number], boolean> = {
    where: contactValid(contact) && travel !== null,
    items: hasItems && !breakdown.isEmpty,
    ...(isRugs ? {} : { extras: true }),
    when:
      (whenFlexible || (isRugs ? whenDate !== null : whenDate !== null && whenSlot !== null)) &&
      (!isRugs || (pickupPlan !== null && (pickupPlan === "be-there" || pickupSpot.trim().length > 0))),
    payment: payment !== null,
  } as Record<(typeof sectionKeys)[number], boolean>;

  const missingByKey: Record<(typeof sectionKeys)[number], string> = {
    where: "your address, name, phone and email",
    items: copy.missingItems,
    ...(isRugs ? {} : { extras: "" }),
    when: isRugs
      ? "a pickup day (or 'call me to arrange') and where we'll collect the rugs"
      : "a day and time (or 'call me to arrange')",
    payment: "how you'd like to pay",
  } as Record<(typeof sectionKeys)[number], string>;

  const allValid = sectionKeys.every((k) => validByKey[k]);
  const missing = sectionKeys.filter((k) => !validByKey[k] && missingByKey[k]).map((k) => missingByKey[k]);

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
        document.getElementById(SECTION_IDS[section])?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (submitLead.isPending || !allValid) return;
    setSlotConflict(false);
    const booking: BookingDetails = {
      purpose: null,
      propertyType: null,
      condition: emptyCondition,
      recommended: null,
      access:
        isRugs && pickupPlan
          ? {
              ...emptyAccess,
              method: pickupPlan,
              spot: pickupPlan === "leave-out" ? pickupSpot.trim() : "",
            }
          : emptyAccess,
      payment,
      preferredDate: whenFlexible ? null : whenDate,
      preferredSlot: whenFlexible || isRugs ? null : whenSlot,
      confirmBy,
      notes: notes.trim(),
      town: travel?.suburb ?? "",
      jobMinutes,
      rugPickup: isRugs,
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
                    we'll confirm it on the spot.
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
    const whenText = whenFlexible
      ? "We'll call you to find a day that works"
      : whenDate && isRugs
        ? `You've asked for a pickup ${new Date(whenDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}, 3:00 – 5:00 PM — we'll confirm it`
        : whenDate && whenSlot !== null
          ? `You've asked for ${new Date(whenDate + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}, ${TIME_SLOTS[whenSlot]} — it's in the schedule already, and we'll confirm it`
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
                  <NewsletterForm source={`${kind}-success`} />
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

  // ===================== the one-page form =====================
  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main className="bg-creamlight py-12 pb-28 md:py-16 lg:pb-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h1 className="font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-charcoal/75">{copy.blurb}</p>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
            {/* ============ LEFT: the form ============ */}
            <div>
              {paymentCancelled && (
                <p className="mb-6 border-[1.5px] border-destructive bg-background px-4 py-3 text-sm font-semibold text-destructive" role="alert">
                  The card payment was cancelled — nothing was charged, and the booking wasn't sent.
                  Pick a payment option and send again, or choose cash/invoice instead.
                </p>
              )}

              {!review ? (
                <>
                  <div className="space-y-12">
                    <section id={`s-${kind}-where`}>
                      <StepWhereWho
                        contact={contact} setContact={setContact}
                        travel={travel} setTravel={setTravel}
                        confirmBy={confirmBy} setConfirmBy={setConfirmBy}
                      />
                    </section>
                    <section id={`s-${kind}-items`}>
                      <StepItems
                        mode={kind}
                        lounges={lounges} setLounges={setLounges}
                        mattresses={mattresses} setMattresses={setMattresses}
                        rugs={rugs} setRugs={setRugs}
                        sub={isRugs ? undefined : "Lounges are priced per seat with three soiling levels; mattresses by size. Add as many pieces as you like — it all combines into one price. Mix lounges and mattresses in the same visit and the extra pieces come in 10% under their usual price."}
                      />
                    </section>
                    {!isRugs && (
                      <section id={`s-${kind}-extras`}>
                        <StepExtras
                          stainPackage={stainPackage} setStainPackage={setStainPackage}
                          enzymePreSpray={enzymePreSpray} setEnzymePreSpray={setEnzymePreSpray}
                          rugsOnly={false}
                          fabricOnly
                        />
                      </section>
                    )}
                    <section id={`s-${kind}-when`}>
                      <StepWhen
                        date={whenDate} slot={whenSlot} flexible={whenFlexible}
                        town={travel?.suburb ?? ""}
                        jobMinutes={jobMinutes}
                        rugsOnly={isRugs}
                        kicker={isRugs ? "Step 3 · Pickup day" : "Step 4 · Your schedule"}
                        onPick={(d, s) => {
                          if (d === null) { setWhenFlexible(true); setWhenDate(null); setWhenSlot(null); }
                          else { setWhenFlexible(false); setWhenDate(d); setWhenSlot(s); }
                        }}
                      />
                      {isRugs && (
                        <div className="mt-8 space-y-4">
                          <h3 className="font-display text-2xl font-black text-charcoal">
                            Where do we grab the rugs?
                          </h3>
                          <p className="max-w-lg text-charcoal/75">
                            No need to wait around for us — most people just leave them out.
                          </p>
                          <div className="grid gap-4" role="radiogroup" aria-label="Rug collection">
                            <OptionCard
                              selected={pickupPlan === "leave-out"}
                              onClick={() => setPickupPlan("leave-out")}
                              title="We'll leave them out for you"
                              hint="Rolled up somewhere dry and easy to reach — we collect between 3 and 5pm, no one needs to be home."
                            >
                              <label className="block text-sm font-bold text-charcoal">
                                Where exactly?
                                <input
                                  type="text"
                                  className="input-sharp mt-2 w-full"
                                  placeholder="e.g. front porch, under the carport, by the side gate"
                                  value={pickupSpot}
                                  maxLength={200}
                                  onChange={(e) => setPickupSpot(e.target.value)}
                                />
                              </label>
                            </OptionCard>
                            <OptionCard
                              selected={pickupPlan === "be-there"}
                              onClick={() => setPickupPlan("be-there")}
                              title="Someone will be home"
                              hint="We'll knock between 3 and 5pm and take them off your hands."
                            />
                          </div>
                        </div>
                      )}
                    </section>
                    <section id={`s-${kind}-payment`}>
                      <StepPayment payment={payment} setPayment={setPayment} kicker={isRugs ? "Step 4 · Payment" : "Step 5 · Payment"} />
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
                    purpose={null}
                    condition={emptyCondition} dirtiness="light" breakdown={breakdown}
                    stainPackage={stainPackage && !isRugs}
                    enzymePreSpray={enzymePreSpray && !isRugs} preVacuum={false}
                    roomCount={0} jobSummary={itemsSummary}
                    payment={payment}
                    date={whenFlexible ? null : whenDate} slot={whenFlexible ? null : whenSlot}
                    rugsOnly={isRugs} hasCarpet={false} jobMinutes={jobMinutes}
                    pickupNote={
                      isRugs && pickupPlan
                        ? pickupPlan === "leave-out"
                          ? `rugs left out (${pickupSpot.trim()})`
                          : "someone home 3–5pm"
                        : undefined
                    }
                    kicker="Nearly done · review & send"
                    stepOf={
                      isRugs
                        ? { where: 0, job: 1, carpet: 1, extras: 1, when: 2, payment: 3 }
                        : { where: 0, job: 1, carpet: 1, extras: 2, when: 3, payment: 4 }
                    }
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
                    <p className="text-charcoal/60">{copy.empty}</p>
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
                            {isRugs ? "Pickup & delivery" : "Travel"}
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
                        {breakdown.onsiteWork && (
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

              {!isRugs && !breakdown.isEmpty && (
                <div className="mt-4 border-[1.5px] border-charcoal bg-background">
                  <div className="border-b-[1.5px] border-charcoal bg-creamlight px-5 py-3">
                    <p className="text-sm font-bold uppercase tracking-widest text-charcoal">
                      Their price for the same job
                    </p>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    {competitors.filter((c) => c.total !== null).map((c) => {
                      // Compare the two numbers on the page: their displayed
                      // total (ex-travel) vs our displayed final total. Items
                      // they don't publish (e.g. mattresses) just aren't in
                      // their number, so a partial comparison understates the
                      // saving — never overstates it.
                      const oursBase = breakdown.cleaningTotal;
                      const saves =
                        c.total !== null && c.total - c.travelAmount > oursBase
                          ? c.total - c.travelAmount - oursBase
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
