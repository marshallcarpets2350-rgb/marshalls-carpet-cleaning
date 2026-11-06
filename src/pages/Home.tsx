import { Link } from "react-router";
import Header from "@/sections/Header";
import FlowArt from "@/components/FlowArt";
import { Snowfall } from "@/components/Seasonal";
import { RatingBadge } from "@/sections/Reviews";
import { BUSINESS, christmasOn, seasonWindowFor } from "@contracts/rates";
import vanImg from "@/assets/van.jpg";

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
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <Snowfall />
      <FlowArt />

      <main className="flex flex-1 flex-col justify-center bg-creamlight py-6 md:py-8">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="inline-block border-[1.5px] border-charcoal bg-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-charcoal">
                Armidale · Uralla · Guyra · Walcha
              </p>
              {christmasOn() && (
                <p className="mt-3 inline-block border-[1.5px] border-charcoal bg-background px-3 py-1.5 text-sm font-bold text-charcoal">
                  🎄 Booked in before Christmas? December is nearly full — grab a spot while there's room 🦌
                </p>
              )}
              {promo && (
                <p className="ml-0 mt-3 inline-block border-[1.5px] border-charcoal bg-[#FEF2F2] px-3 py-1.5 text-sm font-bold text-[#B91C1C] md:ml-2">
                  🏷️ {promo.label} — {promo.percent}% off, ends {promoEnd}
                </p>
              )}
              <h1 className="mt-3 font-display text-4xl font-black leading-[1.05] text-charcoal md:text-5xl">
                Your price, before we knock on the door.
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal/80">
                Hot water extraction carpet cleaning across Armidale &amp; the New
                England. Pick what you need cleaned below and the price builds on
                screen while you tap — 60 seconds, no callbacks, no surprises on the day.
              </p>

              <div className="mt-5">
                <RatingBadge />
              </div>
            </div>

            <div className="hidden lg:block">
              <img
                src={vanImg}
                alt="The Marshall's Carpet Cleaning van"
                className="offset-shadow w-full -rotate-1 border-[1.5px] border-charcoal"
              />
            </div>
          </div>

          {/* The three ways in — big, centred, impossible to miss */}
          <div className="mt-8 grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
            {TILES.map((t) => (
              <Link
                key={t.title}
                to={t.to}
                className="group flex flex-col border-[1.5px] border-charcoal bg-background p-4 text-center no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)] md:p-6"
              >
                <h2 className="flex min-h-[3.5rem] flex-col justify-center font-display text-xl font-black leading-tight text-charcoal md:min-h-[5rem] md:text-3xl">
                  <span>{t.title}</span>
                  {t.under && (
                    <span className="block text-base font-black text-charcoal/70 md:text-xl">
                      {t.under}
                    </span>
                  )}
                </h2>
                <p className="mx-auto mt-3 max-w-xs flex-1 text-xs leading-relaxed text-charcoal/70 md:text-sm">
                  {t.sub}
                </p>
                <span className="btn-pill mx-auto mt-5 !px-5 !py-2 text-sm md:!px-6 md:!py-2.5 md:text-base group-hover:-translate-y-0.5">
                  {t.to === "/flood" ? "Get help now →" : "Start this quote →"}
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-charcoal/75 md:text-base">
            Rather talk it through?{" "}
            <a href={BUSINESS.phoneHref} className="font-bold text-forest">
              Call {BUSINESS.phone}
            </a>{" "}
            — you'll talk to the person who'll be doing the clean.
          </p>
        </div>
      </main>

      <footer className="border-t-[1.5px] border-charcoal bg-charcoal py-4 text-center text-sm text-background/80">
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
          {" · "}
          <a href="/admin" className="text-background/40 no-underline hover:text-mint">
            Admin
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
          {promo ? `🏷️ ${promo.percent}% off until ${promoEnd} — book your clean →` : "Book your clean — 60-second price →"}
        </Link>
      </div>
    </div>
  );
}
