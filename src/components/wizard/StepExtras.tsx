// Step 4 — add-ons. Pre-vacuum and pre-spray are included free in every
// carpet clean, and stain treatment is priced straight from the customer's
// stain answers (or bundled into the Restoration Clean) — so the only
// optional treatment left is the enzyme pre-spray for pet odour and urine.
import { RATES, money } from "@contracts/rates";
import { StepHeading } from "./ui";

function AddOnCard({
  title, price, priceNote, desc, selected, onToggle,
}: {
  title: string;
  price: number;
  priceNote?: string;
  desc: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={selected}
      className={`relative w-full border-[1.5px] p-5 text-left transition-colors ${selected ? "border-forest bg-mintlight" : "border-charcoal/30 bg-background hover:border-charcoal"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-charcoal">{title}</p>
          <p className="mt-1 text-sm text-charcoal/60">{desc}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="font-display text-xl font-black text-forest">{money(price)}</span>
          {priceNote && <span className="block text-xs font-semibold text-charcoal/60">{priceNote}</span>}
        </p>
      </div>
      <p className={`mt-3 inline-block px-3 py-1 text-sm font-bold ${selected ? "bg-forest text-background" : "border-[1.5px] border-forest text-forest"}`}>
        {selected ? "Added ✓" : `Add it — ${money(price)}`}
      </p>
    </button>
  );
}

export function StepExtras({
  stainPackage, setStainPackage,
  enzymePreSpray, setEnzymePreSpray,
  rugsOnly,
  fabricOnly,
}: {
  stainPackage: boolean;
  setStainPackage: (v: boolean) => void;
  enzymePreSpray: boolean;
  setEnzymePreSpray: (v: boolean) => void;
  rugsOnly: boolean;
  fabricOnly?: boolean; // lounge/mattress page — fabric treatments only
}) {
  if (rugsOnly) {
    return (
      <div className="space-y-8">
        <StepHeading
          kicker="Add-ons"
          title="Nothing else needed for rugs"
          sub="Rugs are washed, dried and groomed at our premises — the price on the items step covers the full service."
        />
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/70">
          Carpet, lounges or mattresses to do as well? Those have their own quote
          pages — each one is priced just as clearly.
        </p>
      </div>
    );
  }

  if (fabricOnly) {
    return (
      <div className="space-y-8">
        <StepHeading
          kicker="Add-ons"
          title="Any stains or odours to treat?"
          sub="Professional fabric treatments, applied before the main clean — only where the item genuinely needs it."
        />
        <div className="space-y-5">
          <AddOnCard
            title="Enzyme pre-spray"
            price={RATES.extras.enzymePreSpray}
            priceNote="once per job"
            desc="A professional enzyme treatment that works into the fabric and breaks down the source of pet odour and urine — not a fragrance that masks it. Applied before the main clean."
            selected={enzymePreSpray}
            onToggle={() => setEnzymePreSpray(!enzymePreSpray)}
          />
          <AddOnCard
            title="Stain treatment package"
            price={RATES.extras.stainPackage}
            priceNote="once per job"
            desc="Pre-spray and individual spot treatment across every marked area before the main clean — the best chance of lifting stubborn marks out of lounges and mattresses."
            selected={stainPackage}
            onToggle={() => setStainPackage(!stainPackage)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <StepHeading
        kicker="Step 4 · Add-ons"
        title="Included free — and one option"
        sub="A commercial pre-vacuum and a full pre-spray come with every carpet clean at no charge, and stain treatment is already priced from your stain answers (on a Restoration Clean it's part of the service). Nothing here is added without your tick."
      />

      <ul className="space-y-2 border-[1.5px] border-forest bg-mintlight px-5 py-4 text-sm text-charcoal">
        <li><strong>✓ Commercial pre-vacuum</strong> — every room, every clean. Free.</li>
        <li><strong>✓ Pre-spray</strong> — applied before the wash, every clean. Free.</li>
        <li><strong>✓ Stain treatment</strong> — priced from your stain answers, or included in the Restoration Clean.</li>
      </ul>

      <div className="space-y-5">
        <AddOnCard
          title="Enzyme pre-spray"
          price={RATES.extras.enzymePreSpray}
          priceNote="once per job"
          desc="A professional enzyme treatment that works into the backing and breaks down the source of pet odour and urine — not a fragrance that masks it. Worth it if pets live in the home or there's a smell that keeps coming back. Applied before the main clean."
          selected={enzymePreSpray}
          onToggle={() => setEnzymePreSpray(!enzymePreSpray)}
        />
      </div>
    </div>
  );
}
