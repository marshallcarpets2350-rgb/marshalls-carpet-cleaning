/**
 * High-intent service pages — "end of lease carpet cleaning armidale" and
 * "pet urine carpet cleaning armidale" searches. Every price named here is
 * the real one from the quote engine.
 */
import { Link } from "react-router";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import FlowArt from "@/components/FlowArt";
import { usePageMeta } from "@/lib/usePageMeta";
import { BUSINESS, RATES, money } from "@contracts/rates";

function CtaBand({ heading, sub }: { heading: string; sub: string }) {
  return (
    <section className="border-t-[1.5px] border-charcoal bg-charcoal py-14 text-background md:py-20">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
        <h2 className="font-display text-3xl font-black md:text-5xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-xl text-background/80">{sub}</p>
        <Link to="/quote" className="btn-pill mt-8 inline-block no-underline">Book your clean.</Link>
      </div>
    </section>
  );
}

function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-8 space-y-4">
      {items.map((f) => (
        <div key={f.q} className="border-[1.5px] border-charcoal bg-background p-5">
          <p className="font-bold text-charcoal">{f.q}</p>
          <p className="mt-2 leading-relaxed text-charcoal/75">{f.a}</p>
        </div>
      ))}
    </div>
  );
}

export function EndOfLeasePage() {
  usePageMeta(
    "End of Lease Carpet Cleaning Armidale | Bond-Back Ready — Marshall's",
    "End-of-lease carpet cleaning in Armidale with the price locked before we knock. Itemised receipt for your property manager, pet stain and odour treatment priced in the quote. Book online in 60 seconds.",
    "/end-of-lease-carpet-cleaning-armidale",
    {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "End of lease carpet cleaning",
      provider: {
        "@type": "LocalBusiness",
        name: "Marshall's Carpet Cleaning",
        telephone: "+61423581223",
        url: "https://marshallscarpetcleaning.com.au/",
      },
      areaServed: { "@type": "City", name: "Armidale, NSW" },
      url: "https://marshallscarpetcleaning.com.au/end-of-lease-carpet-cleaning-armidale",
    },
  );

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>
        <section className="border-b-[1.5px] border-charcoal bg-creamlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              End of lease — Armidale NSW
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
              End-of-lease carpet cleaning your property manager signs off.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/80">
              Armidale rentals turn over hard at the end of every uni semester — and
              the final inspection always comes down to the carpets. We clean
              to the checklist agents actually use: worn tracks, stains, pet
              smells — and give you the receipt to prove it was done properly.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/quote" className="btn-pill no-underline">Book your clean.</Link>
              <a href={BUSINESS.phoneHref} className="font-bold text-forest no-underline hover:underline">
                Call {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              What the final inspection actually checks
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Traffic lanes</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  The grey tracks through doorways and halls are the first thing an
                  agent photographs. Our steam clean lifts what a vacuum never
                  will — and we vacuum first, free with every clean, so the
                  steam clean can work properly.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Stains &amp; pet marks</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Tick the stain types in your quote and the treatment is priced
                  in — pet urine {money(RATES.stainCauseFee["pet-urine"])}, food
                  and drink {money(RATES.stainCauseFee["food-drink"])}, every extra
                  type half price. No surprises on the day.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">The paper trail</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  You get a receipt listing the rooms and the work — exactly what
                  your property manager asks for when your bond is on the line.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-mintlight py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              Moving out soon?
            </h2>
            <Faq
              items={[
                {
                  q: "How close to handover should I book?",
                  a: "The day before you hand the keys back is ideal — our drying fans (free with every clean) have carpets dry within hours, so everything's fresh for the inspection. End-of-semester weeks book out fast, so a week or two of notice helps.",
                },
                {
                  q: "Do you clean rentals outside Armidale?",
                  a: "Yes — Uralla, Guyra and Walcha with a flat travel fee ($32 / $48 / $126) that's in your quote before you book.",
                },
                {
                  q: "The last tenant had pets and I can smell it — is that fixable?",
                  a: `Almost always. Our enzyme pre-spray (${money(RATES.extras.enzymePreSpray)} once per job) breaks down the source of the smell deep in the carpet instead of covering it up. If the wee has soaked right through to the underlay, we'll tell you honestly on the day — that's a different fix.`,
                },
              ]}
            />
          </div>
        </section>

        <CtaBand
          heading="Lock in your bond-back clean."
          sub="The quote you build is the price on the day — stains and travel included."
        />
      </main>
      <Footer />
    </div>
  );
}

export function PetUrinePage() {
  usePageMeta(
    "Pet Urine & Odour Carpet Cleaning Armidale | Marshall's Carpet Cleaning",
    `Dog and cat urine stains and smell treated properly in Armidale — enzyme pre-spray ${money(RATES.extras.enzymePreSpray)}, stain treatment priced in your quote, honest advice if it's through to the underlay. Book online.`,
    "/pet-urine-carpet-cleaning-armidale",
    {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Pet urine and odour carpet treatment",
      provider: {
        "@type": "LocalBusiness",
        name: "Marshall's Carpet Cleaning",
        telephone: "+61423581223",
        url: "https://marshallscarpetcleaning.com.au/",
      },
      areaServed: { "@type": "City", name: "Armidale, NSW" },
      url: "https://marshallscarpetcleaning.com.au/pet-urine-carpet-cleaning-armidale",
    },
  );

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>
        <section className="border-b-[1.5px] border-charcoal bg-creamlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Pet stains &amp; odour — Armidale NSW
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
              Pet urine treated properly — not perfumed over.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/80">
              If the smell came back a week after a clean, it wasn't cleaned —
              it was covered up. Pet wee soaks deep into the carpet backing, and
              that's where the smell lives. We treat the source — and if it's
              gone further than the carpet, we'll tell you honestly.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/quote" className="btn-pill no-underline">Book your clean.</Link>
              <a href={BUSINESS.phoneHref} className="font-bold text-forest no-underline hover:underline">
                Call {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              How we treat it — and what it costs
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Enzyme pre-spray — {money(RATES.extras.enzymePreSpray)}</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Sprayed on before the main clean, once per job. It breaks down
                  the source of the smell deep in the carpet — the smell goes
                  because its food is gone, not because it's perfumed over.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Urine stain treatment — {money(RATES.stainCauseFee["pet-urine"])}</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Tick "pet urine" in your quote and it's priced in before we
                  arrive. Extra stain types on the same job are half price —
                  you see every dollar before you book.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Honest limits</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  If the wee has soaked through to the underlay or the floor
                  underneath, cleaning the carpet alone won't fix it. We'll tell
                  you straight on the day, rather than take your money and hope.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-mintlight py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              The usual questions
            </h2>
            <Faq
              items={[
                {
                  q: "There's a lot of it — twenty-plus marks across the house. Worth it?",
                  a: "Yes. Heavily marked carpet just costs more per metre — you pick the level and see the price before you book, so it's never a surprise fee. The stain and enzyme treatments each cover the whole job once.",
                },
                {
                  q: "Will the stains definitely come out?",
                  a: "Most wee marks come out with treatment. A spot that's bleached the colour out of the carpet is damage, not dirt — nothing brings the colour back. We'll show you which is which before we start.",
                },
                {
                  q: "How long until we can walk on it?",
                  a: "Drying fans come free with every clean — rooms are usually dry within hours, so the house is back to normal the same day.",
                },
              ]}
            />
          </div>
        </section>

        <CtaBand
          heading="Get the smell gone for good."
          sub="Enzyme and stain treatment priced into your quote before we knock."
        />
      </main>
      <Footer />
    </div>
  );
}

export function CostGuidePage() {
  usePageMeta(
    "Carpet Cleaning Cost in Armidale NSW — What Sets the Price | Marshall's",
    "What carpet cleaning costs in Armidale and why — room size, condition, stains, travel and add-ons explained with no teaser rates. See your exact price online in 60 seconds.",
    "/carpet-cleaning-cost-armidale",
    {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Carpet cleaning",
      provider: {
        "@type": "LocalBusiness",
        name: "Marshall's Carpet Cleaning",
        telephone: "+61423581223",
        url: "https://marshallscarpetcleaning.com.au/",
      },
      areaServed: { "@type": "City", name: "Armidale, NSW" },
      url: "https://marshallscarpetcleaning.com.au/carpet-cleaning-cost-armidale",
    },
  );

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>
        <section className="border-b-[1.5px] border-charcoal bg-creamlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Price guide — Armidale NSW
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
              What does carpet cleaning cost in Armidale?
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/80">
              The honest answer: it depends on your rooms, your carpet, and what's
              happened to it. Here's what moves the price — and how to see your
              own number in about a minute. No phone call needed.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/quote" className="btn-pill no-underline">See my price.</Link>
              <a href={BUSINESS.phoneHref} className="font-bold text-forest no-underline hover:underline">
                Call {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              The five things that set your price
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">1. Room size</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  We charge for the square metres we actually clean, measured room
                  by room in your quote — not a flat "per room" guess that prices
                  a study the same as a lounge room.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">2. Condition</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  A light freshen-up costs less than a family-worn clean, which costs
                  less than a heavy rescue job. You pick the level and the price
                  changes before you book — never after.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">3. Stains and pet treatment</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Tell us what's there and it's priced into the quote up front.
                  Pet urine treatment has its own fixed price — see the{" "}
                  <Link to="/pet-urine-carpet-cleaning-armidale" className="font-bold text-forest no-underline hover:underline">pet urine page</Link>.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">4. Add-ons</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  <Link to="/lounge" className="font-bold text-forest no-underline hover:underline">Lounges priced per seat</Link>,
                  mattresses per size, and{" "}
                  <Link to="/rugs" className="font-bold text-forest no-underline hover:underline">rugs picked up free on Fridays</Link>.
                  Add them in the same quote and they share the one visit.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">5. Travel</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Free inside Armidale. Flat fees outside it — {money(32)} Uralla,{" "}
                  {money(48)} Guyra, {money(126)} Walcha — shown in your quote
                  before you book, never added on the day.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">What's always free</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Pre-vacuum before the wet clean, and drying fans with every job —
                  rooms dry in hours, not overnight. Both included, every time.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-creamlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              Why we don't advertise a "whole house from $99" deal
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">The teaser rate</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  A cheap headline price gets a foot in your door — then pre-spray
                  is extra, stains are extra, and "your carpet is dirtier than
                  standard". The real price appears on your doorstep.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Our way</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Measure your rooms, answer six quick questions, and watch the
                  final price build on screen. The number you accept is the number
                  on the invoice — that's the whole trick.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">No surprises</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Every line of your quote is itemised in writing before you book.
                  If a stain needs treatment, you approved that price before we
                  knocked.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-mintlight py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              The usual questions
            </h2>
            <Faq
              items={[
                {
                  q: "Can I get an exact price without a callout?",
                  a: "Yes — that's what the online quote is for. Room sizes and condition give an exact price for most homes. For anything unusual, like flood damage, we'll be upfront if we need to look at it first.",
                },
                {
                  q: "Is there a minimum charge?",
                  a: "Small jobs have a minimum charge — you'll see it in your quote if it applies, before you book. That way even one small room is worth doing, knowing the number first.",
                },
                {
                  q: "Do you price end-of-lease cleans differently?",
                  a: "Same pricing, same quote — just tell us it's an end-of-lease clean so we allow the time agents expect. You get a receipt listing the rooms and the work for your property manager. More on the end of lease page.",
                },
              ]}
            />
          </div>
        </section>

        <CtaBand
          heading="Your exact price in 60 seconds."
          sub="Six quick questions, price on screen, book the day that suits you."
        />
      </main>
      <Footer />
    </div>
  );
}
