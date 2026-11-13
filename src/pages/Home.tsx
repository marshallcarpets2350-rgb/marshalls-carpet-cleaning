import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import Header from "@/sections/Header";
import FlowArt from "@/components/FlowArt";
import { Snowfall } from "@/components/Seasonal";
import { RatingBadge } from "@/sections/Reviews";
import { trpc } from "@/providers/trpc";
import { BUSINESS, promoText, seasonWindowFor } from "@contracts/rates";
import vanImg from "@/assets/van.webp";

/** Keeps the aggregateRating in the homepage's LocalBusiness schema in step
 *  with the live Google numbers — the static value in index.html is just the
 *  baseline until this lands (it's what earns the ★ stars in search results). */
function useLiveRatingSchema() {
  const q = trpc.public.googleReviews.useQuery(undefined, { staleTime: 60 * 60 * 1000, retry: 1 });
  const rating = q.data?.rating;
  const count = q.data?.userRatingCount;
  useEffect(() => {
    if (!rating || !count) return;
    const el = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    if (!el) return;
    try {
      const data = JSON.parse(el.textContent || "{}");
      if (data["@type"] !== "LocalBusiness") return;
      data.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: rating.toFixed(1),
        reviewCount: String(count),
      };
      el.textContent = JSON.stringify(data);
    } catch {
      /* malformed schema — leave it as-is */
    }
  }, [rating, count]);
}

/** One-screen homepage: if the content is taller than the viewport, gently
 *  scale it down so everything (incl. the service buttons) always fits.
 *  Runs on phones too — the page is height-locked there, no scrolling. */
function useFitToScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const parent = el.parentElement;
      let s = 1;
      if (parent) {
        const natural = el.getBoundingClientRect().height / scaleRef.current;
        // 3% safety margin — display fonts swap in after first paint and
        // make the content slightly taller than the first measurement
        const avail = parent.clientHeight * 0.97;
        if (natural > avail) s = Math.max(avail / natural, 0.55);
      }
      if (Math.abs(s - scaleRef.current) > 0.004) {
        scaleRef.current = s;
        setScale(s);
      }
    };
    measure();
    const t1 = setTimeout(measure, 250);
    const t2 = setTimeout(measure, 1200);
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return { ref, scale };
}

const TILES: { title: string; under?: string; sub: string; to: string }[] = [
  {
    title: "Carpet cleaning",
    sub: "Rooms, stairs and hallways — the price builds as you tap.",
    to: "/quote",
  },
  {
    title: "Rug pick-up & clean",
    sub: "Collected, washed and dried at our premises — back on your floor Monday.",
    to: "/rugs",
  },
  {
    title: "Lounge, mattress",
    under: "and upholstery",
    sub: "Priced per seat with three soiling levels.",
    to: "/lounge",
  },
  {
    title: "Flood & water damage",
    under: "24/7 emergency",
    sub: "Extraction, structural drying, insurer-ready reports — price in writing before we start.",
    to: "/flood",
  },
];

export default function Home() {
  const win = seasonWindowFor();
  const promo = win?.season.promo ?? null;
  const promoEnd = win?.end.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const { ref: fitRef, scale: fitScale } = useFitToScreen();
  useLiveRatingSchema();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <Snowfall />
      <FlowArt />

      <main className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-creamlight py-2 md:py-6 lg:py-2">
        <div
          ref={fitRef}
          className="mx-auto"
          style={
            fitScale < 1
              ? {
                  transform: `scale(${fitScale})`,
                  transformOrigin: "center center",
                  width: `${100 / fitScale}%`,
                  marginLeft: `calc((100% - ${100 / fitScale}%) / 2)`,
                }
              : undefined
          }
        >
        <div
          className="mx-auto w-full max-w-6xl px-4 md:px-6"
          style={fitScale < 1 ? { maxWidth: `${1152 / fitScale}px` } : undefined}
        >
          <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
            <div>
              <p className="inline-block border-[1.5px] border-charcoal bg-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-charcoal">
                Armidale · Uralla · Guyra · Walcha
              </p>
              {promo && (
                <p className="ml-0 mt-3 inline-block border-[1.5px] border-charcoal bg-[#FEF2F2] px-3 py-1.5 text-sm font-bold text-[#B91C1C] md:ml-2 lg:mt-2">
                  {promoText(promo)}, ends {promoEnd}
                </p>
              )}
              <h1 className="mt-2 font-display text-2xl font-black leading-[1.05] text-charcoal md:mt-3 md:text-5xl lg:mt-2 lg:text-[2.35rem]">
                Your price, before we knock on the door.
              </h1>
              <p className="mt-4 hidden max-w-xl text-lg leading-relaxed text-charcoal/80 md:block lg:mt-3 lg:text-base">
                Steam carpet cleaning across Armidale &amp; the New England. Pick
                what you need cleaned below and the price builds on screen while
                you tap — 60 seconds, no callbacks, no surprises on the day.
              </p>

              <div className="mt-5 hidden md:block lg:mt-3">
                <RatingBadge />
              </div>
            </div>

            <div className="hidden lg:block">
              <img
                src={vanImg}
                alt="The Marshall's Carpet Cleaning van"
                className="offset-shadow mx-auto w-full -rotate-1 border-[1.5px] border-charcoal lg:h-52 lg:w-auto xl:h-60"
              />
            </div>
          </div>

          {/* The four ways in — a compact 2×2 on phones so the whole grid
              fits the first screen; desktop keeps the big 4-across row */}
          <p className="mt-3 text-center font-display text-2xl font-black text-charcoal md:mt-6 lg:hidden">
            What do you need cleaned?
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:mt-4 md:gap-6 lg:mt-5 lg:grid-cols-4 lg:gap-4">
            {TILES.map((t) => (
              <Link
                key={t.title}
                to={t.to}
                className="group flex flex-col border-[1.5px] border-charcoal bg-background p-3 text-center no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)] md:p-6 lg:p-4"
              >
                <h2 className="flex min-h-[4.5rem] flex-col justify-center font-display text-xl font-black leading-tight text-charcoal md:min-h-[5rem] md:text-3xl lg:min-h-[3.75rem] lg:text-2xl">
                  <span>{t.title}</span>
                  {t.under && (
                    <span className="block text-base font-black text-charcoal md:text-xl lg:text-lg">
                      {t.under}
                    </span>
                  )}
                </h2>
                <p className="mx-auto mt-2 max-w-xs flex-1 text-sm leading-snug text-charcoal/70 md:mt-3 md:text-sm md:leading-relaxed lg:mt-2">
                  {t.sub}
                </p>
                <span className="btn-pill mx-auto mt-3 !px-5 !py-2 text-base md:mt-5 md:!px-6 md:!py-2.5 md:text-base lg:mt-3 group-hover:-translate-y-0.5">
                  {t.to === "/flood" ? "Get help now →" : "Start this quote →"}
                </span>
              </Link>
            ))}
          </div>
        </div>
        </div>
      </main>

      <footer className="border-t-[1.5px] border-charcoal bg-charcoal py-2 text-center text-xs text-background/80 md:py-4 md:text-sm lg:py-2">
        <p>
          <span className="font-bold text-background">Marshall's Carpet Cleaning</span>
          {" · "}Armidale NSW 2350{" · "}
          <a href={BUSINESS.phoneHref} className="whitespace-nowrap font-bold text-mint no-underline">
            {BUSINESS.phone}
          </a>
          {" · "}
          <a href={`mailto:${BUSINESS.email}`} className="text-background/80 no-underline hover:underline">
            {BUSINESS.email}
          </a>
          {" · "}
          <a href="/terms" className="text-background/60 no-underline hover:text-mint">
            Terms
          </a>
        </p>
      </footer>
      {/* Sticky mobile booking bar — the quote is always one tap away */}
      <div className="h-14 lg:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-charcoal bg-[#1A6FD1] lg:hidden">
        <Link
          to="/quote"
          className="flex items-center justify-center gap-2 py-3.5 text-center text-base font-bold text-white no-underline"
        >
          {promo ? `🏷️ ${promoText(promo)} until ${promoEnd} — book your clean →` : "Book your clean — 60-second price →"}
        </Link>
      </div>
    </div>
  );
}
