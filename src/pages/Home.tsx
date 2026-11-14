import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

/** One-screen homepage. Phones/tablets are scaled by the pure-CSS .mcc-fit
 *  rules in index.css, so their FIRST paint (even the static prerender) is
 *  already the final size — no JS, no rescale (Ben 14 Nov: the page visibly
 *  jumped through states on load). This hook now only runs on desktop
 *  (≥1024px): measures ONCE in a layout effect, re-measures only when the
 *  window WIDTH actually changes — height-only resizes are just browser
 *  chrome showing/hiding and must not rescale the page. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function useFitToScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  useIsoLayoutEffect(() => {
    let lastW = window.innerWidth;
    const measure = () => {
      if (window.innerWidth < 1024) return; // mobile: .mcc-fit CSS owns the fit
      const el = ref.current;
      if (!el) return;
      const parent = el.parentElement;
      let s = 1;
      if (parent) {
        const natural = el.getBoundingClientRect().height / scaleRef.current;
        const avail = parent.clientHeight * 0.97;
        if (natural > avail) s = Math.max(avail / natural, 0.55);
      }
      if (Math.abs(s - scaleRef.current) > 0.004) {
        scaleRef.current = s;
        setScale(s);
      }
    };
    measure();
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
    <div className="flex h-svh flex-col overflow-hidden">
      <Header />
      <Snowfall />
      <FlowArt />

      <main className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-creamlight py-2 md:py-6 lg:py-2">
        <div
          ref={fitRef}
          className="mx-auto mcc-fit"
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
            <div className="text-center lg:text-left">
              <p className="inline-block border-[1.5px] border-charcoal bg-background px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-charcoal">
                Armidale · Uralla · Guyra · Walcha
              </p>
              {promo && (
                <p className="ml-0 mt-3 inline-block border-[1.5px] border-charcoal bg-[#FEF2F2] px-3 py-1.5 text-sm font-bold text-[#B91C1C] md:ml-2 lg:mt-2">
                  {promoText(promo)}, ends {promoEnd}
                </p>
              )}
              <h1 className="mt-3 font-display text-3xl font-black leading-[1.05] text-charcoal md:mt-3 md:text-5xl lg:mt-2 lg:text-[2.35rem]">
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
                width="1400"
                height="753"
                className="offset-shadow mx-auto w-full -rotate-1 border-[1.5px] border-charcoal lg:h-52 lg:w-auto xl:h-60"
              />
            </div>
          </div>

          {/* The four ways in — a compact 2×2 on phones so the whole grid
              fits the first screen; desktop keeps the big 4-across row */}
          <p className="mt-4 text-center font-display text-3xl font-black text-charcoal md:mt-6 lg:hidden">
            What do you need cleaned?
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:mt-4 md:gap-6 lg:mt-5 lg:grid-cols-4 lg:gap-4">
            {TILES.map((t) => (
              <Link
                key={t.title}
                to={t.to}
                className="group flex flex-col border-[1.5px] border-charcoal bg-background p-4 text-center no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)] md:p-6 lg:p-4"
              >
                <h2 className="flex min-h-[5.5rem] flex-col justify-center font-display text-2xl font-black leading-tight text-charcoal md:min-h-[5rem] md:text-3xl lg:min-h-[3.75rem] lg:text-2xl">
                  <span>{t.title}</span>
                  {t.under && (
                    <span className="block text-lg font-black text-charcoal md:text-xl lg:text-lg">
                      {t.under}
                    </span>
                  )}
                </h2>
                <p className="mx-auto mt-3 max-w-xs flex-1 text-base leading-snug text-charcoal/70 md:mt-3 md:text-sm md:leading-relaxed lg:mt-2">
                  {t.sub}
                </p>
                <span className="btn-pill mx-auto mt-3 !px-6 !py-3 text-lg md:mt-5 md:!px-6 md:!py-2.5 md:text-base lg:mt-3 group-hover:-translate-y-0.5">
                  {t.to === "/flood" ? "Get help now →" : "Start this quote →"}
                </span>
              </Link>
            ))}
          </div>
        </div>
        </div>
      </main>

      <footer className="border-t-[1.5px] border-charcoal bg-charcoal py-2 text-center text-sm text-background/80 md:py-4 md:text-sm lg:py-2">
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
      <div className="h-16 lg:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-[1.5px] border-charcoal bg-[#1A6FD1] lg:hidden">
        <Link
          to="/quote"
          className="flex items-center justify-center gap-2 py-4 text-center text-lg font-bold text-white no-underline"
        >
          {promo ? `🏷️ ${promoText(promo)} until ${promoEnd} — book your clean →` : "Book your clean — 60-second price →"}
        </Link>
      </div>
    </div>
  );
}
