// Checkout cross-sell — one-tap extra services at 10% off, added straight to
// this booking. Only the ADDED services are discounted (the carpet they came
// for stays at full price); the engine draws the "10% off" line itself.
import type { LoungeItem, MattressItem, RugItem, Rates, RugSize } from "@contracts/rates";
import { money, RUG_SIZES } from "@contracts/rates";
import { OptionCard } from "./ui";

const LOUNGE_DEFAULT: LoungeItem = { seats: 3, reclinerSeats: 0, dirtiness: "light", added: true };
const MATTRESS_DEFAULT: MattressItem = { size: "queen", dirtiness: "light", qty: 1, added: true };
const RUG_DEFAULT: RugItem = { size: "m", qty: 1, added: true };

export function CrossSell({
  rates,
  lounges,
  mattresses,
  rugs,
  setLounges,
  setMattresses,
  setRugs,
}: {
  rates: Rates;
  lounges: LoungeItem[];
  mattresses: MattressItem[];
  rugs: RugItem[];
  setLounges: (v: LoungeItem[]) => void;
  setMattresses: (v: MattressItem[]) => void;
  setRugs: (v: RugItem[]) => void;
}) {
  const off = (n: number) => Math.round(n * 0.9);
  const loungePrice = Math.round(LOUNGE_DEFAULT.seats * rates.lounge.perSeat.light);
  const mattressPrice = Math.round(
    rates.mattress.base.queen * rates.mattress.dirtinessMultiplier.light,
  );
  const rugPrice = rates.rugPrices[RUG_DEFAULT.size];

  const OPTIONS = [
    {
      title: "3-seat lounge clean",
      hint: `Usually ${money(loungePrice)} — ${money(off(loungePrice))} added to this booking. Cleaned on-site while we're there.`,
      selected: lounges.length > 0,
      toggle: () => setLounges(lounges.length > 0 ? [] : [LOUNGE_DEFAULT]),
    },
    {
      title: "Queen mattress",
      hint: `Usually ${money(mattressPrice)} — ${money(off(mattressPrice))} added to this booking. Other sizes on the day, just ask.`,
      selected: mattresses.length > 0,
      toggle: () => setMattresses(mattresses.length > 0 ? [] : [MATTRESS_DEFAULT]),
    },
    {
      title: "Medium rug — pick-up & clean",
      hint: `Usually ${money(rugPrice)} — ${money(off(rugPrice))} added to this booking. Taken with us, washed and dried, back Monday.`,
      selected: rugs.length > 0,
      toggle: () => setRugs(rugs.length > 0 ? [] : [RUG_DEFAULT]),
    },
  ];

  return (
    <div className="border-[1.5px] border-charcoal bg-creamlight p-5 md:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Before you lock it in</p>
      <h3 className="mt-1 font-display text-2xl font-black text-charcoal">
        While we're there — add a service, save 10%
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
        One tap adds it to this booking at 10% off the added service. Sizes are
        confirmed on arrival, and you can take it back off on the review screen
        before anything's final.
      </p>
      <div className="mt-4 grid gap-3" role="group" aria-label="Add an extra service at 10% off">
        {OPTIONS.map((o) => (
          <OptionCard
            key={o.title}
            selected={o.selected}
            onClick={o.toggle}
            title={o.title}
            hint={o.hint}
            badge={o.selected ? "Added — 10% off" : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SoftQuote cross-sell — the rug quick-pick version for /lounge and /rugs.
// /lounge: rugs ride along with the visit (taken on the day, back within the
// week). /rugs: extra rugs join the same pickup. Either way the ADDED rugs
// (flagged `added`) get 10% off; the service they came for stays full price.
// ---------------------------------------------------------------------------

const RUG_PICK_SIZES: RugSize[] = ["s", "m", "l"];

export function SoftCrossSell({
  kind,
  rates,
  rugs,
  setRugs,
}: {
  kind: "lounge" | "rugs";
  rates: Rates;
  rugs: RugItem[]; // cross-sell rugs only (kept separate from the main items)
  setRugs: (v: RugItem[]) => void;
}) {
  const off = (n: number) => Math.round(n * 0.9);
  const toggle = (size: RugSize) => {
    const i = rugs.findIndex((r) => r.size === size);
    setRugs(
      i >= 0 ? rugs.filter((_, j) => j !== i) : [...rugs, { size, qty: 1, added: true }],
    );
  };

  return (
    <div className="border-[1.5px] border-charcoal bg-creamlight p-5 md:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-forest">Before you lock it in</p>
      <h3 className="mt-1 font-display text-2xl font-black text-charcoal">
        {kind === "lounge"
          ? "Rugs too? Add pick-up & clean, save 10%"
          : "Got another rug? It rides along for 10% off"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
        {kind === "lounge"
          ? "We take your rugs when we do the lounge, wash and dry them at our premises, and drop them back within the week. Added to this booking, the rugs are 10% off."
          : "Since we're coming anyway, extra rugs join the same pickup at 10% off each — washed, dried and back on your floor Monday."}
      </p>
      <div className="mt-4 grid gap-3" role="group" aria-label="Add a rug at 10% off">
        {RUG_PICK_SIZES.map((size) => {
          const meta = RUG_SIZES.find((x) => x.id === size)!;
          const price = rates.rugPrices[size];
          const selected = rugs.some((r) => r.size === size);
          return (
            <OptionCard
              key={size}
              selected={selected}
              onClick={() => toggle(size)}
              title={`${meta.label} rug (${meta.area})`}
              hint={`Usually ${money(price)} — ${money(off(price))} added to this booking.`}
              badge={selected ? "Added — 10% off" : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
