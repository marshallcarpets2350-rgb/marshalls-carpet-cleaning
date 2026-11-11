// Step 3 — the carpet: condition questions that drive a recommended clean level.
import { useEffect, useMemo, useState } from "react";
import type { ConditionAnswers, Dirtiness } from "@contracts/rates";
import { RATES, money, carpetStandardForArea, conditionComplete, recommendDirtiness, recommendationReasons } from "@contracts/rates";
import { PillGroup, StepHeading } from "./ui";

const LEVELS: { value: Dirtiness; name: string; sub: string; goodFor: string }[] = [
  { value: "light", name: "Standard Clean", sub: "Proper vacuum, pre-spray & steam clean", goodFor: "Carpet in good nick — vacuumed often, lightly used, no pet or smell worries. Every room gets a free commercial vacuum and a pre-spray, then a full steam clean (hot water extraction), right through to the backing." },
  { value: "medium", name: "Deep Clean", sub: "Everything in Standard, plus a scrub-in and a second pass", goodFor: "Family-lived carpet — kids, pets or worn tracks through the busy spots. After the free vacuum, we scrub the pre-spray deep into the pile and clean everything twice. It lifts what a standard clean leaves behind." },
  { value: "heavy", name: "Restoration Clean", sub: "The works — pre-treatment, stain work & repeated steam passes", goodFor: "Heavy soiling, pet accidents, smells, or carpet that’s been let go. Free vacuum, pre-treatment scrubbed deep into the pile, every marked spot treated by hand — ground-in dirt, sticky spots and gum included — then steam cleaned over and over until it comes up clean. Everything we can do, short of replacing the carpet." },
];

export function StepCarpet({
  condition, setCondition, dirtiness, setDirtiness, areaM2, rugsOnly = false,
  levelTotals = null,
}: {
  condition: ConditionAnswers;
  setCondition: (c: ConditionAnswers) => void;
  dirtiness: Dirtiness;
  setDirtiness: (d: Dirtiness) => void;
  areaM2: number;
  rugsOnly?: boolean;
  // Discounted all-in total per clean level, from the quote engine — when
  // provided, the cards show these so no pre-discount price appears anywhere.
  levelTotals?: Record<Dirtiness, number> | null;
}) {
  const [overridden, setOverridden] = useState(false);
  const recommended = useMemo(() => recommendDirtiness(condition), [condition]);
  const reasons = useMemo(() => recommendationReasons(condition), [condition]);

  // While the user hasn't picked a level themselves, the recommendation drives the price.
  useEffect(() => {
    if (!overridden && recommended) setDirtiness(recommended);
  }, [overridden, recommended, setDirtiness]);

  const set = (patch: Partial<ConditionAnswers>) => setCondition({ ...condition, ...patch });
  const pick = (v: Dirtiness) => { setDirtiness(v); setOverridden(true); };
  const effective = overridden ? dirtiness : recommended;

  const priceFor = (level: Dirtiness) =>
    areaM2 > 0
      ? Math.max(
          Math.round(carpetStandardForArea(areaM2) * RATES.carpet.multiplier[level]),
          RATES.minimumCharge,
        )
      : 0;

  // No carpet in the job — nothing to recommend, step is informational only.
  if (areaM2 === 0) {
    return (
      <div className="space-y-8">
        <StepHeading
          kicker="Step 3 · Carpet condition"
          title="No carpet in this one"
          sub={rugsOnly
            ? "This one's all rugs — they're priced by size on the items step, so there's nothing to answer here."
            : "You've only got lounges or mattresses on the job, so there's nothing to answer here."}
        />
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/70">
          {rugsOnly
            ? "Every rug gets the full works — washed, rinsed and dried — and comes back to you on the Monday. Continue to add-ons."
            : "Lounges and mattresses have their own soiling levels set on the items step. Continue to add-ons."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StepHeading kicker="Step 3 · Carpet condition" title="Tell us about the carpet" sub="Four quick questions. Your answers set the recommended clean and the price — and we confirm it with you on the day before we start." />

      <div>
        <p className="mb-2 font-bold text-charcoal">Do pets live in the home?</p>
        <PillGroup label="Pets" value={condition.pets} onChange={(v) => set({ pets: v as ConditionAnswers["pets"] })}
          options={[{ value: "none", label: "No pets" }, { value: "outside", label: "Yes — outdoors only" }, { value: "inside", label: "Yes — indoors as well" }]} />
      </div>

      <div>
        <p className="mb-2 font-bold text-charcoal">Is there any odour in the carpet?</p>
        <PillGroup label="Odour" value={condition.smell} onChange={(v) => set({ smell: v as ConditionAnswers["smell"] })}
          options={[{ value: "no", label: "None" }, { value: "up-close", label: "Mild — only up close" }, { value: "noticeable", label: "Noticeable on entry" }]} />
      </div>

      <div>
        <p className="mb-2 font-bold text-charcoal">How many visible stains or marks?</p>
        <PillGroup label="Stains" value={condition.stains} onChange={(v) => {
          const stains = v as ConditionAnswers["stains"];
          set({ stains, stainTypes: stains === "none" ? [] : condition.stainTypes });
        }} options={[{ value: "none", label: "None" }, { value: "under-5", label: "Less than 5" }, { value: "over-5", label: "More than 5" }, { value: "ten-plus", label: "Ten or more" }]} />
        {condition.stains && condition.stains !== "none" && (
          <div className="mt-3">
            <p className="mb-2 text-sm font-bold text-charcoal/70">What caused them? (tick any that apply)</p>
            <PillGroup label="Stain types" multi value={condition.stainTypes} onChange={(v) => {
              const t = v as ConditionAnswers["stainTypes"][number];
              set({ stainTypes: condition.stainTypes.includes(t) ? condition.stainTypes.filter((x) => x !== t) : [...condition.stainTypes, t] });
            }} options={[
              { value: "pet-urine", label: "Pet accidents" },
              { value: "food-drink", label: "Food & drink spills" },
              { value: "mud-traffic", label: "Mud & heavy traffic" },
              { value: "not-sure", label: "Not sure" },
            ]} />
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 font-bold text-charcoal">When was the carpet last thoroughly vacuumed?</p>
        <PillGroup label="Last vacuumed" value={condition.vacuumed} onChange={(v) => set({ vacuumed: v as ConditionAnswers["vacuumed"] })}
          options={[{ value: "week", label: "Within the week" }, { value: "month", label: "Within the month" }, { value: "longer", label: "Longer ago" }]} />
      </div>

      {/* Recommendation + level choice */}
      <div>
        <p className="mb-1 font-bold text-charcoal">Your clean level</p>
        {conditionComplete(condition) && recommended && (
          <p className="mb-3 border-[1.5px] border-forest bg-mintlight px-4 py-3 text-sm text-charcoal">
            <span className="font-bold">✓ Our recommendation:</span> from your answers
            {reasons.length > 0 && <> — {reasons.join("; ")}</>} — we'd book you the{" "}
            <strong>{LEVELS.find((l) => l.value === recommended)?.name}</strong>. We confirm the level
            with you on the day before we start — if it needs less, you pay less.
          </p>
        )}
        {!conditionComplete(condition) && (
          <p className="mb-3 text-sm text-charcoal/60">Answer the questions above and we'll recommend one.</p>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {LEVELS.map((l) => {
            const isRec = l.value === recommended;
            const active = l.value === effective;
            return (
              <button key={l.value} type="button" onClick={() => pick(l.value)}
                className={`relative border-[1.5px] p-5 text-left transition-colors ${active ? "border-forest bg-mintlight" : "border-charcoal/30 bg-background hover:border-charcoal"}`}>
                {isRec && (
                  <span className="absolute -top-3 left-4 bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                    We recommend this one
                  </span>
                )}
                <p className="mt-1 font-bold text-charcoal">{l.name}</p>
                <p className="text-xs font-semibold text-charcoal/60">{l.sub}</p>
                <p className="mt-2 text-sm text-charcoal/60">{l.goodFor}</p>
                {areaM2 > 0 && (
                  <p className="mt-3 font-display text-xl font-black text-forest">
                    {money(levelTotals ? levelTotals[l.value] : priceFor(l.value))}{" "}
                    <span className="text-xs font-semibold text-charcoal/50">
                      {levelTotals ? "all in with this clean" : "for your carpet"}
                    </span>
                  </p>
                )}
              </button>
            );
          })}
        </div>
        {overridden && effective !== recommended && recommended && (
          <button type="button" onClick={() => setOverridden(false)} className="mt-3 text-sm font-bold text-forest underline">
            Switch back to our recommendation
          </button>
        )}
      </div>
    </div>
  );
}
