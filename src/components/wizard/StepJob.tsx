// Step 2 of the carpet wizard — the reason for the clean, and the carpeted
// rooms. Rug pick-up and lounge/mattress quotes live on their own pages.
import { Stepper, OptionCard, StepHeading } from "./ui";
import type { CleanPurpose } from "@contracts/rates";

// Room list written in our own words and our own order. The internal keys map
// to the comparison model, but nothing customer-facing mirrors a competitor.
export const ROOMS = [
  { key: "living", label: "Lounge room", hint: "your main living space", m2: 25 },
  { key: "livingLg", label: "Large lounge room", hint: "a big one, or combined lounge & dining", m2: 36 },
  { key: "dining", label: "Dining room", hint: "a separate dining room", m2: 16 },
  { key: "bed", label: "Bedroom — standard", hint: "a kids' or guest bedroom", m2: 16 },
  { key: "bedLarge", label: "Main bedroom", hint: "the big one — parents' retreat", m2: 25 },
  { key: "wir", label: "Walk-in robe — standard", hint: "just off the bedroom", m2: 4 },
  { key: "wirLarge", label: "Walk-in robe — large", hint: "dressing-room size", m2: 9 },
  { key: "hall", label: "Hallway — short run", hint: "about 3 m long", m2: 3 },
  { key: "hall2", label: "Hallway — medium run", hint: "about 6 m long", m2: 6 },
  { key: "hall3", label: "Hallway — long run", hint: "about 9 m long", m2: 9 },
  { key: "hall4", label: "Hallway — full length", hint: "about 12 m long", m2: 12 },
  { key: "stairs", label: "Staircase", hint: "one standard flight", m2: 5 },
] as const;

export default function StepJob({
  purpose,
  setPurpose,
  mode,
  setMode,
  roomCounts,
  setRoomCounts,
  areaInput,
  setAreaInput,
  carpetAreaM2,
}: {
  purpose: CleanPurpose | null;
  setPurpose: (p: CleanPurpose) => void;
  mode: "rooms" | "area";
  setMode: (m: "rooms" | "area") => void;
  roomCounts: Record<string, number>;
  setRoomCounts: (fn: (prev: Record<string, number>) => Record<string, number>) => void;
  areaInput: string;
  setAreaInput: (s: string) => void;
  carpetAreaM2: number;
}) {
  return (
    <div className="space-y-10">
      <StepHeading
        kicker="Step 2 · Your home"
        title="What's the occasion, and which rooms?"
        sub="The reason for the clean shapes what we recommend — an end-of-lease clean is judged against an inspection checklist, a freshen-up isn't."
      />

      {/* Purpose */}
      <div className="space-y-3" role="radiogroup" aria-label="Reason for the clean">
        {(
          [
            ["moving-out", "End of lease", "Vacating a rental — cleaned to the standard property managers inspect against"],
            ["living", "Freshening up", "It's our home — regular upkeep or a one-off deep clean"],
            ["selling", "Selling or re-letting", "Presentation clean before buyers or new tenants walk through"],
          ] as const
        ).map(([value, title, hint]) => (
          <OptionCard
            key={value}
            title={title}
            hint={hint}
            selected={purpose === value}
            onClick={() => setPurpose(value)}
          />
        ))}
      </div>

      {/* Rooms */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="font-bold text-charcoal">Carpet — count your rooms</p>
          <div className="flex gap-2" role="tablist" aria-label="How do you want to measure?">
            {(
              [
                ["rooms", "Count my rooms"],
                ["area", "I know my m²"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`border-[1.5px] border-charcoal px-3 py-1.5 text-sm font-bold ${
                  mode === m ? "bg-charcoal text-background" : "bg-background hover:bg-mintlight"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "rooms" ? (
          <div className="mt-4 grid gap-px border-[1.5px] border-charcoal bg-charcoal sm:grid-cols-2 md:grid-cols-3">
            {ROOMS.map((r) => {
              const count = roomCounts[r.key] ?? 0;
              return (
                <div
                  key={r.key}
                  className={`p-4 transition-colors ${count > 0 ? "bg-mintlight" : "bg-background"}`}
                >
                  <p className="font-bold text-charcoal">{r.label}</p>
                  <p className="text-xs text-charcoal/60">{r.hint} · ~{r.m2} m²</p>
                  <div className="mt-3">
                    <Stepper
                      value={count}
                      label={r.label}
                      onChange={(n) => setRoomCounts((prev) => ({ ...prev, [r.key]: n }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 max-w-xs">
            <label htmlFor="area" className="mb-2 block text-sm font-bold text-charcoal">
              Total carpet area (m²)
            </label>
            <input
              id="area"
              className="input-sharp"
              inputMode="decimal"
              placeholder="e.g. 85"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
        )}
        {carpetAreaM2 > 0 && (
          <p className="mt-3 text-sm text-charcoal/60">
            {carpetAreaM2} m² of carpet — the next step works out how dirty it is.
          </p>
        )}
      </div>

      <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/70">
        Rugs, lounges or mattresses to do as well? They have their own quote pages —{" "}
        <a href="/rugs" className="font-bold text-forest underline-offset-4 hover:underline">
          rug pick-up &amp; clean
        </a>{" "}
        and{" "}
        <a href="/lounge" className="font-bold text-forest underline-offset-4 hover:underline">
          lounge, mattress &amp; upholstery
        </a>
        .
      </p>
    </div>
  );
}
