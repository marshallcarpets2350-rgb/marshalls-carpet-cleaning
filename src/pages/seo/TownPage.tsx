/**
 * Town landing pages — one per service town outside Armidale. Each targets
 * "carpet cleaning {town}" searches with genuinely local copy, the real
 * travel fee up front (the brand promise: the price before we knock), and
 * per-page Service schema. Not doorway pages: fees, drive times and the
 * town notes differ and are all true.
 */
import { Link } from "react-router";
import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import FlowArt from "@/components/FlowArt";
import { usePageMeta } from "@/lib/usePageMeta";
import { BUSINESS, money } from "@contracts/rates";

interface TownConfig {
  slug: string;
  town: string;
  km: number;
  drive: string; // "about 25 minutes"
  direction: string; // "south down the New England Highway"
  travelFee: number;
  intro: string;
  localTitle: string;
  localBody: string[];
  faqExtra: { q: string; a: string };
}

const TOWNS: TownConfig[] = [
  {
    slug: "carpet-cleaning-uralla",
    town: "Uralla",
    km: 23,
    drive: "about 25 minutes",
    direction: "south down the New England Highway",
    travelFee: 32,
    intro:
      "Uralla is our closest run out of Armidale — about 25 minutes south down the highway. We clean in Uralla most weeks: the heritage cottages around the main street, the brick homes on the outskirts, and the rentals turning over between tenants.",
    localTitle: "Older homes, honest pricing.",
    localBody: [
      "A lot of Uralla's housing has character — and character means carpet that's seen a few decades. Older carpet takes a gentler hand and hotter extraction, and it's exactly the work we do every day across the New England.",
      "The $32 travel fee is the whole story on travel — it's added once per visit, shown in your quote before you book, and it doesn't change on the day.",
    ],
    faqExtra: {
      q: "Do you do end-of-lease cleans in Uralla?",
      a: "Yes — and you get a proper receipt for your property manager, with the rooms and the work itemised. If the carpets need it, tick the stain and pet options in the quote and they're priced in before we arrive.",
    },
  },
  {
    slug: "carpet-cleaning-guyra",
    town: "Guyra",
    km: 38,
    drive: "about 40 minutes",
    direction: "north up the New England Highway",
    travelFee: 48,
    intro:
      "Guyra sits about 40 minutes north of us, up on the top of the Tablelands. We clean across town — the weatherboard places near the highway, farmhouses just out of town, and everything in between.",
    localTitle: "High-country winters, wet carpets — sorted.",
    localBody: [
      "Guyra cold is real cold, and a carpet cleaned in a Guyra winter can take days to dry on its own. Every clean with us includes drying fans at no charge, so your rooms are back to normal in hours, not days — even in July.",
      "The $48 travel fee covers the round trip, once per visit. It's in your quote before you book — no surprises when we pull up.",
    ],
    faqExtra: {
      q: "Will my carpet actually dry in a Guyra winter?",
      a: "Yes — drying fans come free with every clean, and they're the difference between dry-by-dinner and damp-for-days at 1,300 metres. If rain or a cold snap is forecast, we bring extra.",
    },
  },
  {
    slug: "carpet-cleaning-walcha",
    town: "Walcha",
    km: 96,
    drive: "about an hour and a quarter",
    direction: "south through the hills",
    travelFee: 126,
    intro:
      "Walcha is our longest regular run — about an hour and a quarter south of Armidale through the hills. We clean across Walcha and the surrounding properties: town homes, the older cottages near the centre, and farmhouses further out.",
    localTitle: "Worth doing properly while we're there.",
    localBody: [
      "At the $126 travel fee, the smart move is bundling: lounges, mattresses and rugs done in the same visit all share the one trip — the travel's already paid, so the extras only cost their own price.",
      "We batch Walcha bookings where we can, so getting in a week or two early gives you the best choice of days.",
    ],
    faqExtra: {
      q: "Is it worth it for a smaller job?",
      a: "Usually, yes — bundle it. A couple of rooms plus the lounge suite and a rug or two in the same visit spreads the $126 travel across everything, so each job on the visit only carries a share of the trip.",
    },
  },
];

const SERVICES = [
  { to: "/quote", label: "Carpet cleaning", body: "Hot water extraction, priced per square metre with the total locked before we knock." },
  { to: "/lounge", label: "Lounges & mattresses", body: "Per-seat pricing, recliners included, mattresses by size — all in the same quote." },
  { to: "/rugs", label: "Rug pick-up & clean", body: "Collected from your door, cleaned and returned. Free pick-up with any clean." },
  { to: "/flood", label: "Flood & water damage", body: "24/7 emergency extraction and drying, with an insurer-ready report." },
];

export function townSlugs() {
  return TOWNS.map((t) => t.slug);
}

export function TownPage({ slug }: { slug: string }) {
  const t = TOWNS.find((x) => x.slug === slug);
  if (!t) return null;

  usePageMeta(
    `Carpet Cleaning ${t.town} NSW | Marshall's Carpet Cleaning`,
    `Carpet cleaning in ${t.town} with the price shown before we knock. ${money(t.travelFee)} travel, drying fans free with every clean, online quote in 60 seconds. Lounges, mattresses, rugs and flood restoration too.`,
    `/${t.slug}`,
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
      areaServed: { "@type": "City", name: `${t.town}, NSW` },
      url: `https://marshallscarpetcleaning.com.au/${t.slug}`,
    },
  );

  const faqs = [
    {
      q: `How much is travel to ${t.town}?`,
      a: `${money(t.travelFee)} flat, once per visit — it's in your quote before you book and doesn't change on the day. Everything else is priced exactly as it is in Armidale.`,
    },
    {
      q: "How do I book?",
      a: "Build your quote online in about a minute — the price you see is the price you pay. Pick your day and we'll confirm the arrival time the day before.",
    },
    t.faqExtra,
  ];

  return (
    <div className="min-h-dvh">
      <Header />
      <FlowArt />
      <main>
        {/* hero */}
        <section className="border-b-[1.5px] border-charcoal bg-creamlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <p className="text-sm font-bold uppercase tracking-widest text-forest">
              Carpet cleaning — {t.town} NSW
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-tight text-charcoal md:text-6xl">
              Carpet cleaning in {t.town}, priced before we knock.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-charcoal/80">{t.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/quote" className="btn-pill no-underline">Book your clean.</Link>
              <a href={BUSINESS.phoneHref} className="font-bold text-forest no-underline hover:underline">
                Call {BUSINESS.phone}
              </a>
            </div>
          </div>
        </section>

        {/* travel fee card */}
        <section className="py-14 md:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 md:px-6 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">{t.localTitle}</h2>
              {t.localBody.map((p) => (
                <p key={p.slice(0, 24)} className="mt-4 leading-relaxed text-charcoal/80">{p}</p>
              ))}
            </div>
            <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-7 md:p-9">
              <p className="text-sm font-bold uppercase tracking-widest text-forest">Travel to {t.town}</p>
              <p className="mt-2 font-display text-5xl font-black text-charcoal">{money(t.travelFee)}</p>
              <ul className="mt-4 space-y-2 text-charcoal/80">
                <li>• {t.drive} {t.direction} — {t.km}km from Armidale</li>
                <li>• Once per visit, no matter how much we clean</li>
                <li>• Shown in your quote before you book — locked in</li>
              </ul>
            </div>
          </div>
        </section>

        {/* services */}
        <section className="border-t-[1.5px] border-charcoal bg-mintlight py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              What we do in {t.town}
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <Link
                  key={s.to + s.label}
                  to={s.to}
                  className="border-[1.5px] border-charcoal bg-background p-5 no-underline transition-transform hover:-translate-y-1"
                >
                  <p className="font-bold text-charcoal">{s.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal/70">{s.body}</p>
                  <p className="mt-3 text-sm font-bold text-forest">More →</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* faq */}
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h2 className="font-display text-3xl font-black text-charcoal md:text-4xl">
              {t.town} questions
            </h2>
            <div className="mt-8 space-y-4">
              {faqs.map((f) => (
                <div key={f.q} className="border-[1.5px] border-charcoal bg-background p-5">
                  <p className="font-bold text-charcoal">{f.q}</p>
                  <p className="mt-2 leading-relaxed text-charcoal/75">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* cta */}
        <section className="border-t-[1.5px] border-charcoal bg-charcoal py-14 text-background md:py-20">
          <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
            <h2 className="font-display text-3xl font-black md:text-5xl">
              {t.town}, your price is one minute away.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-background/80">
              The quote you build is the price on the day — travel included.
            </p>
            <Link to="/quote" className="btn-pill mt-8 inline-block no-underline">Book your clean.</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
