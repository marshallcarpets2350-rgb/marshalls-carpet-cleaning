/**
 * Commercial landing page — "commercial carpet cleaning armidale" searches.
 * Aimed at offices, motels/hotels, clubs and property managers: the angles
 * that matter to them are written quotes before work, itemised ABN invoices,
 * after-hours availability and maintenance pricing. Every price named here
 * comes from the live quote engine (contracts/rates.ts).
 */
import { Link } from "react-router";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import FlowArt from "@/components/FlowArt";
import { usePageMeta } from "@/lib/usePageMeta";
import { BUSINESS, RATES, money } from "@contracts/rates";

// money() rounds to whole dollars — per-m² rates need cents.
const money2 = (n: number) => `$${n.toFixed(2)}`;

const firstTier = RATES.carpet.tiers[0].perM2;
const lastTier = RATES.carpet.tiers[RATES.carpet.tiers.length - 1].perM2;
const maintenancePct = Math.round(RATES.maintenance.two * 100);

const FITS = [
  {
    title: "Offices & shopfronts",
    body: "Traffic lanes in entries and corridors cop the worst of it. We clean after hours or on weekends by arrangement, so trading never stops for us.",
  },
  {
    title: "Motels, hotels & short stays",
    body: "Room-turn cleans between guests, whole-floor runs in the quiet season, and spot treatment for the rooms that need extra help.",
  },
  {
    title: "Real estates & property managers",
    body: "End-of-lease cleans with an itemised receipt your bond department can file, pet stain and odour treatment priced into the quote up front, and honest written reports when carpet is past saving.",
  },
  {
    title: "Clubs, churches & halls",
    body: "Big open areas are where the stepped rate does the work — the bigger the floor, the cheaper the metre.",
  },
];

const FAQS = [
  {
    q: "Do you take regular maintenance contracts?",
    a: `Yes — book two or more cleans a year and every clean drops ${maintenancePct}%. Motels and offices usually settle into a quarterly or twice-yearly rhythm.`,
  },
  {
    q: "Can you work outside trading hours?",
    a: "Yes — early mornings, evenings and weekends by arrangement. Carpets are typically dry within 4–6 hours, so an evening clean is ready for the morning trade.",
  },
  {
    q: "Do you provide tax invoices?",
    a: `Every job comes with an itemised ABN tax invoice (${BUSINESS.abn}) — card, PayID or bank transfer, whatever suits your accounts team.`,
  },
  {
    q: "How is pricing worked out?",
    a: `By the square metre, measured or estimated with you up front: ${money2(firstTier)}/m² stepping down to ${money2(lastTier)}/m² on large areas, with a ${money(RATES.minimumCharge)} minimum callout. You get the figure in writing before we start — it doesn't change on the day.`,
  },
];

export function CommercialPage() {
  usePageMeta(
    "Commercial Carpet Cleaning Armidale — Offices, Motels & Real Estates | Marshall's",
    `Commercial carpet cleaning across Armidale & the New England: offices, motels, clubs and real estate work from ${money2(firstTier)}/m² with the price in writing before we start. After-hours available, itemised ABN invoices, maintenance plans save ${maintenancePct}%.`,
    "/commercial-carpet-cleaning-armidale",
    {
      "@context": "https://schema.org",
      "@type": "Service",
      serviceType: "Commercial carpet cleaning",
      provider: {
        "@type": "LocalBusiness",
        name: "Marshall's Carpet Cleaning",
        telephone: "+61423581223",
        url: "https://marshallscarpetcleaning.com.au/",
      },
      areaServed: ["Armidale", "Uralla", "Guyra", "Walcha"],
      url: "https://marshallscarpetcleaning.com.au/commercial-carpet-cleaning-armidale",
    },
  );

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>
        <section className="bg-creamlight py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Commercial &amp; real estate
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
              Carpets that cop the foot traffic.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/80">
              Offices, motels, clubs and rental portfolios across Armidale &amp; the New England.
              Hot water extraction priced by the square metre —{" "}
              <strong>
                {money2(firstTier)}/m² stepping down to {money2(lastTier)}/m² on large areas
              </strong>{" "}
              — with the figure in writing before we start. No callbacks, no surprises on the invoice.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/quote" className="btn-pill no-underline">Book your clean.</Link>
              <a href={BUSINESS.phoneHref} className="btn-pill-dark no-underline">
                Call {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-background py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              Who we already work for
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {FITS.map((f) => (
                <div key={f.title} className="border-[1.5px] border-charcoal bg-creamlight p-6">
                  <p className="font-display text-xl font-black text-charcoal">{f.title}</p>
                  <p className="mt-2 leading-relaxed text-charcoal/75">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-mintlight py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              The paperwork's the easy part
            </h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                `Itemised ABN tax invoices (${BUSINESS.abn}) — card, PayID or bank transfer`,
                "Written quote before work starts — the number doesn't move on the day",
                `Maintenance plans: two or more cleans a year saves ${maintenancePct}% on every visit`,
                "Insurer-ready reports on water damage, with photos and moisture readings",
                "Fully insured, and happy to send a certificate of currency to your accounts team",
                "After-hours and weekend cleans by arrangement — your trading hours stay yours",
              ].map((line) => (
                <li key={line} className="flex gap-3 border-[1.5px] border-charcoal bg-background p-5">
                  <span className="font-black text-forest">✓</span>
                  <span className="leading-relaxed text-charcoal/80">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-background py-16 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              Asked by every property manager
            </h2>
            <div className="mt-8 space-y-4">
              {FAQS.map((f) => (
                <div key={f.q} className="border-[1.5px] border-charcoal bg-creamlight p-5">
                  <p className="font-bold text-charcoal">{f.q}</p>
                  <p className="mt-2 leading-relaxed text-charcoal/75">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-[1.5px] border-charcoal bg-charcoal py-14 text-background md:py-20">
          <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
            <h2 className="font-display text-3xl font-black md:text-5xl">
              Send us the floor plan — we'll send back a number.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-background/80">
              Measure roughly and build the quote online, or call and we'll come out and measure
              for nothing. Either way the price is in writing before we start.
            </p>
            <Link to="/quote" className="btn-pill mt-8 inline-block no-underline">Book your clean.</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
