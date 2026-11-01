import { Link } from "react-router";
import { RATES, RUG_SIZES, money } from "@contracts/rates";

export default function Pricing() {
  return (
    <section id="pricing" className="bg-foreground py-20 text-background md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="max-w-2xl font-display text-4xl font-black leading-tight md:text-5xl">
          Published prices. No "from" tricks.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-background/75">
          These are the same numbers the calculator uses — what you see is what the
          quote says, and what the quote says is what you pay.
        </p>

        <div className="mt-12 grid gap-px border-[1.5px] border-background/40 bg-background/40 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-foreground p-7">
            <h3 className="font-display text-xl font-black text-mint">Carpet</h3>
            <p className="mt-4 font-display text-4xl font-black">{money(RATES.carpet.perM2.light)}<span className="text-lg font-bold text-background/60">/m²</span></p>
            <ul className="mt-4 space-y-2 text-sm text-background/80">
              <li>Deep clean — {money(RATES.carpet.perM2.medium)}/m²</li>
              <li>Restoration — {money(RATES.carpet.perM2.heavy)}/m²</li>
              <li>Stepped rates — the bigger the house, the cheaper the metre</li>
              <li>Minimum charge {money(RATES.minimumCharge)}</li>
            </ul>
          </div>

          <div className="bg-foreground p-7">
            <h3 className="font-display text-xl font-black text-mint">Lounges</h3>
            <p className="mt-4 font-display text-4xl font-black">{money(RATES.lounge.perSeat.light)}<span className="text-lg font-bold text-background/60">/seat</span></p>
            <ul className="mt-4 space-y-2 text-sm text-background/80">
              <li>Medium — {money(RATES.lounge.perSeat.medium)}/seat</li>
              <li>Heavy — {money(RATES.lounge.perSeat.heavy)}/seat</li>
              <li>Recliners +{money(RATES.lounge.reclinerPerSeat)}/seat</li>
            </ul>
          </div>

          <div className="bg-foreground p-7">
            <h3 className="font-display text-xl font-black text-mint">Mattresses</h3>
            <p className="mt-4 font-display text-4xl font-black">{money(RATES.mattress.base.single)}<span className="text-lg font-bold text-background/60">+</span></p>
            <ul className="mt-4 space-y-2 text-sm text-background/80">
              <li>Double — {money(RATES.mattress.base.double)}</li>
              <li>Queen — {money(RATES.mattress.base.queen)}</li>
              <li>King — {money(RATES.mattress.base.king)}</li>
            </ul>
          </div>

          <div className="bg-foreground p-7">
            <h3 className="font-display text-xl font-black text-mint">Volume saves</h3>
            <p className="mt-4 font-display text-4xl font-black">−$5<span className="text-lg font-bold text-background/60"> / $150</span></p>
            <ul className="mt-4 space-y-2 text-sm text-background/80">
              <li>Every $150 on the quote takes another $10 off</li>
              <li>Steps down to {money(RATES.carpet.tiers[2].perM2)}/m² by 80m², {money(RATES.carpet.tiers[3].perM2)}/m² beyond</li>
              <li>Five or more rugs — {RATES.rug.bulkPercentOff}% off the rug total</li>
            </ul>
          </div>
        </div>

        {/* Rug pick-up & clean — its own run, its own prices */}
        <div className="mt-10 border-[1.5px] border-background/40">
          <div className="border-b-[1.5px] border-background/40 px-7 py-4">
            <h3 className="font-display text-xl font-black text-mint">
              Rugs — picked up Thu &amp; Fri 3–5pm, back Monday
            </h3>
            <p className="mt-1 text-sm text-background/70">
              Free pickup and delivery in Armidale — outside town it's $1 per km.
              Book {RATES.rug.bulkCount} or more
              rugs and the rug total drops {RATES.rug.bulkPercentOff}%.
            </p>
          </div>
          <div className="grid gap-px bg-background/40 sm:grid-cols-3 md:grid-cols-5">
            {RUG_SIZES.map((s) => (
              <div key={s.id} className="bg-foreground px-7 py-5">
                <p className="font-bold">{s.label}</p>
                <p className="text-xs text-background/60">{s.area}</p>
                <p className="mt-1 font-display text-2xl font-black">{money(s.price)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-background/75">
          Every quote also takes $10 off each full $150, automatically. Travel is
          calculated by road distance — free in Armidale, flat rates for Uralla,
          Guyra and Walcha, and $1 per kilometre each way everywhere else, shown
          in your quote before you book.
        </p>

        <div className="mt-8">
          <Link to="/quote" className="btn-pill">
            Build my exact price →
          </Link>
        </div>
      </div>
    </section>
  );
}
