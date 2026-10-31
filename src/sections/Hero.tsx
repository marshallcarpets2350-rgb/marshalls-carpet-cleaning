import { Link } from "react-router";
import { BUSINESS } from "@contracts/rates";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* cream block backdrop */}
      <div
        aria-hidden="true"
        className="absolute -right-24 top-10 h-72 w-72 rotate-3 bg-cream md:right-10 md:h-96 md:w-[34rem]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-20 bottom-0 h-40 w-64 -rotate-2 bg-mintlight"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 md:px-6 md:pb-28 md:pt-24">
        <p className="mb-6 inline-block border-[1.5px] border-charcoal bg-background px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-forest">
          Armidale · Uralla · Guyra · Walcha
        </p>

        <h1 className="max-w-3xl font-display text-5xl font-black leading-[1.02] text-charcoal md:text-7xl">
          Your price,{" "}
          <span className="relative inline-block">
            <span aria-hidden="true" className="absolute inset-x-0 bottom-1 -z-10 h-5 bg-cream md:h-8" />
            before
          </span>{" "}
          we knock on the door.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal/80 md:text-xl">
          Hot water extraction carpet cleaning across {BUSINESS.area}. Build your own
          quote in about a minute — rooms, lounges, mattresses, stains and travel,
          priced on screen while you tap. No callbacks, no surprises on the day.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link to="/quote" className="btn-pill text-lg">
            Build my quote →
          </Link>
          <a href={BUSINESS.phoneHref} className="btn-pill-dark text-lg">
            Call {BUSINESS.phone}
          </a>
        </div>

        <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-px border-[1.5px] border-charcoal bg-charcoal">
          {[
            { k: "$4.00/m²", v: "flat rate carpet" },
            { k: "$150", v: "minimum charge" },
            { k: "60 sec", v: "to your price" },
          ].map((s) => (
            <div key={s.v} className="bg-background px-4 py-5">
              <dt className="font-display text-2xl font-black text-forest md:text-3xl">{s.k}</dt>
              <dd className="mt-1 text-sm font-semibold text-charcoal/70">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
