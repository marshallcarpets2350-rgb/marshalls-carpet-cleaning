// The items step for the soft-furnishing quote pages. Two modes:
//   "lounge" — lounges & mattresses (the /lounge page)
//   "rugs"   — rugs for the Thursday/Friday pick-up run (the /rugs page)
import { Stepper, StepHeading } from "./ui";
import {
  RATES,
  RUG_SIZES,
  money,
  rugCount,
  type Dirtiness,
  type LoungeItem,
  type MattressItem,
  type MattressSize,
  type RugItem,
} from "@contracts/rates";

const MATTRESS_SIZES: { size: MattressSize; label: string }[] = [
  { size: "single", label: "Single" },
  { size: "double", label: "Double" },
  { size: "queen", label: "Queen" },
  { size: "king", label: "King" },
];

const DIRTINESS: { value: Dirtiness; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Regular upkeep, no visible marks" },
  { value: "medium", label: "Medium", hint: "Traffic lanes, lived-in look" },
  { value: "heavy", label: "Heavy", hint: "Stains, pets, or long overdue" },
];

export function DirtinessPicker({
  value,
  onChange,
}: {
  value: Dirtiness;
  onChange: (d: Dirtiness) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Soiling level">
      {DIRTINESS.map((d) => (
        <button
          key={d.value}
          type="button"
          role="radio"
          aria-checked={value === d.value}
          onClick={() => onChange(d.value)}
          className={`border-[1.5px] border-charcoal px-3 py-2.5 text-left transition-colors ${
            value === d.value ? "bg-forest text-background" : "bg-background hover:bg-mintlight"
          }`}
        >
          <span className="block font-bold">{d.label}</span>
          <span className={`block text-xs ${value === d.value ? "text-background/80" : "text-charcoal/60"}`}>
            {d.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function StepItems({
  mode,
  lounges,
  setLounges,
  mattresses,
  setMattresses,
  rugs,
  setRugs,
  kicker = "Step 2 · The items",
  title,
  sub,
}: {
  mode: "lounge" | "rugs";
  lounges: LoungeItem[];
  setLounges: (fn: (prev: LoungeItem[]) => LoungeItem[]) => void;
  mattresses: MattressItem[];
  setMattresses: (fn: (prev: MattressItem[]) => MattressItem[]) => void;
  rugs: RugItem[];
  setRugs: (fn: (prev: RugItem[]) => RugItem[]) => void;
  kicker?: string;
  title?: string;
  sub?: string;
}) {
  if (mode === "rugs") {
    return (
      <div className="space-y-10">
        <StepHeading
          kicker={kicker}
          title="Which rugs are we collecting?"
          sub="Priced by size — collected Thursday or Friday 3–5pm, washed and dried at our premises, and back on your floor Monday. Free pickup in Armidale; beyond town it's a flat $1 per km."
        />

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="mb-3 font-bold text-charcoal">Rug sizes</p>
            {rugCount(rugs) > 0 && rugCount(rugs) < RATES.rug.bulkCount && (
              <p className="text-sm font-semibold text-forest">
                Book {RATES.rug.bulkCount} or more and the rug total drops {RATES.rug.bulkPercentOff}%
              </p>
            )}
            {rugCount(rugs) >= RATES.rug.bulkCount && (
              <p className="text-sm font-semibold text-forest">
                {RATES.rug.bulkPercentOff}% bulk discount applied ✓
              </p>
            )}
          </div>
          <div className="grid gap-px border-[1.5px] border-charcoal bg-charcoal sm:grid-cols-2 md:grid-cols-3">
            {RUG_SIZES.map((s) => {
              const qty = rugs.find((r) => r.size === s.id)?.qty ?? 0;
              return (
                <div key={s.id} className={`p-4 transition-colors ${qty > 0 ? "bg-mintlight" : "bg-background"}`}>
                  <p className="font-bold text-charcoal">{s.label}</p>
                  <p className="text-xs text-charcoal/60">{s.area} · {money(s.price)} each</p>
                  <div className="mt-3">
                    <Stepper
                      value={qty}
                      label={`${s.label} rugs`}
                      onChange={(n) =>
                        setRugs((prev) => {
                          const rest = prev.filter((r) => r.size !== s.id);
                          return n === 0 ? rest : [...rest, { size: s.id, qty: n }];
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-charcoal/60">
            Not sure of the size? Pick the closest — we confirm it at pickup and adjust with you before anything is charged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <StepHeading
        kicker={kicker}
        title={title ?? "Which pieces are we cleaning?"}
        sub={sub ?? "Lounges are priced per seat with three soiling levels; mattresses by size. Add as many pieces as you like — it all combines into one price."}
      />

      {/* Lounges */}
      <div>
        <p className="mb-3 font-bold text-charcoal">Lounges &amp; upholstery</p>
        <div className="space-y-4">
          {lounges.map((l, i) => (
            <div key={i} className="border-[1.5px] border-charcoal bg-background p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-bold text-charcoal">Lounge {i + 1}</p>
                <button
                  type="button"
                  onClick={() => setLounges((prev) => prev.filter((_, j) => j !== i))}
                  className="text-sm font-bold text-destructive underline-offset-4 hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold text-charcoal/80">How many seats?</p>
                  <Stepper
                    value={l.seats}
                    min={1}
                    max={10}
                    label="seats"
                    onChange={(n) =>
                      setLounges((prev) => prev.map((x, j) => (j === i ? { ...x, seats: n } : x)))
                    }
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-charcoal/80">
                    Recliner seats (+{money(RATES.lounge.reclinerPerSeat)}/seat)
                  </p>
                  <Stepper
                    value={l.reclinerSeats}
                    max={l.seats}
                    label="recliners"
                    onChange={(n) =>
                      setLounges((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, reclinerSeats: n } : x)),
                      )
                    }
                  />
                </div>
              </div>
              <div className="mt-4">
                <DirtinessPicker
                  value={l.dirtiness}
                  onChange={(d) =>
                    setLounges((prev) => prev.map((x, j) => (j === i ? { ...x, dirtiness: d } : x)))
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setLounges((prev) => [...prev, { seats: 3, dirtiness: "light", reclinerSeats: 0 }])
            }
            className="border-[1.5px] border-dashed border-charcoal bg-transparent px-5 py-3 font-bold text-forest hover:bg-mintlight"
          >
            + Add a lounge
          </button>
        </div>
      </div>

      {/* Mattresses */}
      <div>
        <p className="mb-3 font-bold text-charcoal">Mattresses</p>
        <div className="grid gap-px border-[1.5px] border-charcoal bg-charcoal sm:grid-cols-2">
          {MATTRESS_SIZES.map(({ size, label }) => {
            const item = mattresses.find((m) => m.size === size);
            const qty = item?.qty ?? 0;
            return (
              <div key={size} className={`p-5 ${qty > 0 ? "bg-mintlight" : "bg-background"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-charcoal">{label}</p>
                    <p className="text-xs text-charcoal/60">from {money(RATES.mattress.base[size])}</p>
                  </div>
                  <Stepper
                    value={qty}
                    label={`${label} mattresses`}
                    onChange={(n) =>
                      setMattresses((prev) => {
                        const rest = prev.filter((m) => m.size !== size);
                        return n === 0
                          ? rest
                          : [...rest, { size, dirtiness: item?.dirtiness ?? "light", qty: n }];
                      })
                    }
                  />
                </div>
                {qty > 0 && (
                  <div className="mt-4">
                    <DirtinessPicker
                      value={item?.dirtiness ?? "light"}
                      onChange={(d) =>
                        setMattresses((prev) =>
                          prev.map((m) => (m.size === size ? { ...m, dirtiness: d } : m)),
                        )
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
