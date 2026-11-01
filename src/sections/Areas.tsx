import { FALLBACK_TOWNS, RATES, travelFeeForTown, money } from "@contracts/rates";

export default function Areas() {
  const towns = FALLBACK_TOWNS.filter((t) =>
    ["Armidale", "Uralla", "Guyra", "Walcha"].includes(t.name),
  );

  return (
    <section id="areas" className="bg-mintlight py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-black leading-tight text-charcoal md:text-5xl">
              Based in Armidale. On the road across the New England.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-charcoal/80">
              Travel is priced by road distance, not by town name and not by mood —
              free in Armidale, then {money(RATES.travel.perKmEachWay)} per kilometre
              each way outside town. Enter your address in the quote builder and it
              works itself out.
            </p>
          </div>

          <div className="offset-shadow border-[1.5px] border-charcoal bg-background p-7 md:p-9">
            <h3 className="text-sm font-bold uppercase tracking-widest text-forest">
              Typical travel fees
            </h3>
            <ul className="mt-5 divide-y-[1.5px] divide-charcoal/20">
              {towns.map((t) => (
                <li key={t.name} className="flex items-baseline justify-between py-3">
                  <span className="text-lg font-semibold text-charcoal">{t.name}</span>
                  <span className="font-display text-xl font-black text-forest">
                    {travelFeeForTown(t.name, t.km) === 0 ? "Free" : money(travelFeeForTown(t.name, t.km))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-charcoal/70">
              Further out? If you're more than about {RATES.travel.maxServiceKm}km from
              Armidale the calculator will ask you to call — we'll still come, we just
              quote the travel by hand.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
