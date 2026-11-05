import { Link } from "react-router";
import Header from "@/sections/Header";
import FlowArt, { DotCreek } from "@/components/FlowArt";
import Reviews from "@/sections/Reviews";
import { BUSINESS } from "@contracts/rates";
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

const STATS: { value: string; label: string }[] = [
  { value: "5.0★", label: "Google rating" },
  { value: "60 seconds", label: "to receive your quote" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <FlowArt />

      <main className="flex flex-1 flex-col justify-center bg-creamlight py-8 md:py-10">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="inline-block border-[1.5px] border-charcoal bg-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-charcoal">
                Armidale · Uralla · Guyra · Walcha
              </p>
              <h1 className="mt-3 font-display text-4xl font-black leading-[1.05] text-charcoal md:text-5xl">
                Your price, before we knock on the door.
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-charcoal/80">
                Hot water extraction carpet cleaning across Armidale &amp; the New
                England. Pick what you need cleaned below and the price builds on
                screen while you tap. No callbacks, no surprises on the day.
              </p>

              <div className="mt-5 grid max-w-md grid-cols-2 divide-x-[1.5px] divide-charcoal border-[1.5px] border-charcoal bg-background">
                {STATS.map((s) => (
                  <div key={s.label} className="px-3 py-3 md:px-5">
                    <p className="font-display text-lg font-black text-forest md:text-2xl">
                      {s.value}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-charcoal/65 md:text-sm">
                      {s.label}
                    </p>
                  </div>
                ))}
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
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map((t) => (
              <Link
                key={t.title}
                to={t.to}
                className="group flex flex-col border-[1.5px] border-charcoal bg-background p-5 text-center no-underline transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_28px_-12px_rgb(30_30_30/0.4)] md:p-6"
              >
                <h2 className="flex min-h-[4.5rem] flex-col justify-center font-display text-2xl font-black leading-tight text-charcoal md:min-h-[5.5rem] md:text-3xl">
                  <span>{t.title}</span>
                  {t.under && (
                    <span className="block text-lg font-black text-charcoal/70 md:text-xl">
                      {t.under}
                    </span>
                  )}
                </h2>
                <p className="mx-auto mt-4 max-w-xs flex-1 text-sm leading-relaxed text-charcoal/70">
                  {t.sub}
                </p>
                <span className="btn-pill mx-auto mt-6 !px-6 !py-2.5 text-base group-hover:-translate-y-0.5">
                  {t.to === "/flood" ? "Get help now →" : "Start this quote →"}
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-8 text-center text-charcoal/75">
            Rather talk it through?{" "}
            <a href={BUSINESS.phoneHref} className="font-bold text-forest">
              Call {BUSINESS.phone}
            </a>{" "}
            — you'll talk to the person who'll be doing the clean.
          </p>
        </div>
      </main>

      <DotCreek seed={4711} />

      <Reviews />

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
    </div>
  );
}
