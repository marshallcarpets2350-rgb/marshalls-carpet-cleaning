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
          sub="Rugs are washed, dried and finished at our place — the price on the items step covers everything."
        />
        <p className="border-[1.5px] border-charcoal/30 bg-creamlight px-4 py-3 text-sm text-charcoal/70">
          Carpet, lounges or mattresses to do as well? They have their own quote
          pages — priced just as clearly.
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
          sub="Treatments we put on before the main clean — only where they're actually needed."
        />
        <div className="space-y-5">
          <AddOnCard
            title="Enzyme pre-spray"
            price={RATES.extras.enzymePreSpray}
            priceNote="once per job"
            desc="Pet smells sink deep into the fabric. This enzyme spray breaks down the source of the smell instead of covering it with perfume. Sprayed on before the main clean."
            selected={enzymePreSpray}
            onToggle={() => setEnzymePreSpray(!enzymePreSpray)}
          />
          <AddOnCard
            title="Stain treatment package"
            price={RATES.extras.stainPackage}
            priceNote="once per job"
            desc="We pre-spray and hand-treat every marked spot before the main clean — the best shot at getting stubborn marks out of lounges and mattresses."
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
        sub="Every carpet clean already includes a proper vacuum and a pre-spray — free. Stain treatment is priced from your stain answers, and it's part of a Restoration Clean. Nothing gets added unless you tick it."
      />

      <ul className="space-y-2 border-[1.5px] border-forest bg-mintlight px-5 py-4 text-sm text-charcoal">
        <li><strong>✓ A proper vacuum</strong> — every room, every clean. Free.</li>
        <li><strong>✓ Pre-spray before the wash</strong> — every clean. Free.</li>
        <li><strong>✓ Stain treatment</strong> — priced from your stain answers, or included free in a Restoration Clean.</li>
      </ul>

      <div className="space-y-5">
        <AddOnCard
          title="Enzyme pre-spray"
          price={RATES.extras.enzymePreSpray}
          priceNote="once per job"
          desc="Pet wee and smells live deep in the carpet backing — that's why they keep coming back. This enzyme spray breaks down the source instead of covering it with perfume. Worth it if you have pets, or a smell that won't quit. Sprayed on before the main clean."
          selected={enzymePreSpray}
          onToggle={() => setEnzymePreSpray(!enzymePreSpray)}
        />
      </div>
    </div>
  );
}
