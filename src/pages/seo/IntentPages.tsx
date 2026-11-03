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
              Armidale turns over hard at the end of every uni semester — and the
              final inspection always lands on the carpets. We clean to the
              checklist agents actually use: traffic lanes, stains, pet odour,
              and the receipt to prove it was done professionally.
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
                  agent photographs. Hot water extraction lifts what a vacuum
                  never will — and pre-vacuum is free with every clean, which is
                  what lets the extraction work properly.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Stains &amp; pet marks</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Tick the stain types in your quote and the treatment is priced
                  in — pet urine {money(RATES.stainCauseFee["pet-urine"])}, food
                  and drink {money(RATES.stainCauseFee["food-drink"])}, each extra
                  type half price. No surprise add-ons on the day.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">The paper trail</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  You get an itemised receipt naming the rooms and the work —
                  exactly what a property manager asks for when the bond is on
                  the line.
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
                  a: "The day before keys go back is ideal — carpets are dry within hours with the fans we bring free, and everything's fresh for the inspection. Semester-end weeks book out, so a week or two of notice helps.",
                },
                {
                  q: "Do you clean rentals outside Armidale?",
                  a: "Yes — Uralla, Guyra and Walcha with a flat travel fee ($30 / $60 / $100) that's in your quote before you book.",
                },
                {
                  q: "The last tenant had pets and I can smell it — is that fixable?",
                  a: `Almost always. The enzyme pre-spray (${money(RATES.extras.enzymePreSpray)} once per job) breaks down the source of the odour in the backing rather than covering it. If urine has gone through to the underlay we'll tell you honestly on the day — that's a different fix.`,
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
              it was masked. Urine soaks into the backing, and bacteria living
              there bring the smell back with the first humid day. We treat the
              source, and we tell you honestly when it's gone further.
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
                  Applied before the main clean, once per job. The enzyme breaks
                  down what the bacteria are feeding on in the backing — the
                  smell goes because its source is gone, not because it's covered.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Urine stain treatment — {money(RATES.stainCauseFee["pet-urine"])}</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  Tick "pet urine" in your quote and it's priced in before we
                  arrive. Extra stain types on the same job are half price —
                  you'll see every dollar before you book.
                </p>
              </div>
              <div className="border-[1.5px] border-charcoal bg-background p-6">
                <p className="font-bold text-charcoal">Honest limits</p>
                <p className="mt-2 text-sm leading-relaxed text-charcoal/75">
                  If urine has soaked through to the underlay or the floor
                  beneath, treating the carpet alone won't fix it. We'll tell you
                  on the day rather than take the money and hope.
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
                  a: "Yes — heavy marking is priced into the quote (heavy soiling is a per-metre multiplier, not a surprise fee), and the stain + enzyme treatments cover the whole job once. Bad jobs are where the price-first promise matters most.",
                },
                {
                  q: "Will the stains definitely come out?",
                  a: "Most urine marks lift with treatment. A stain that has taken the dye out of the fibre is damage, not dirt, and no product brings colour back — we'll point out which is which before we start.",
                },
                {
                  q: "How long until we can walk on it?",
                  a: "Drying fans come free with every clean — rooms are usually dry within hours, not overnight, so the house is back to normal the same day.",
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
