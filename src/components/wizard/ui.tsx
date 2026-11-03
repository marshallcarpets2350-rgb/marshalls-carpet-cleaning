import type { ReactNode } from "react";
import { money } from "@contracts/rates";

/** +/− counter used for rooms, seats and mattresses. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex h-11 w-11 items-center justify-center border-[1.5px] border-charcoal text-xl font-bold disabled:opacity-30 hover:bg-cream disabled:hover:bg-transparent"
      >
        −
      </button>
      <span className="min-w-8 text-center font-display text-2xl font-black" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center border-[1.5px] border-charcoal text-xl font-bold disabled:opacity-30 hover:bg-mint disabled:hover:bg-transparent"
      >
        +
      </button>
    </div>
  );
}

/** Radio-style answer card, BFYB-flow style but in our design language. */
export function OptionCard({
  title,
  hint,
  price,
  selected,
  onClick,
  badge,
  children,
}: {
  title: string;
  hint?: string;
  price?: number;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={`border-[1.5px] transition-colors ${
        selected ? "border-forest bg-mintlight" : "border-charcoal/30 bg-background hover:border-charcoal"
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onClick}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <span
          className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-forest" : "border-charcoal/40"
          }`}
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-forest" />}
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2 font-bold text-charcoal">
            {title}
            {badge && (
              <span className="bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                {badge}
              </span>
            )}
          </span>
          {hint && <span className="mt-0.5 block text-sm text-charcoal/60">{hint}</span>}
        </span>
        {price !== undefined && (
          <span className="whitespace-nowrap font-display text-xl font-black text-forest">
            {money(price)}
          </span>
        )}
      </button>
      {selected && children && (
        <div className="border-t-[1.5px] border-forest/30 px-5 py-4 pl-14">{children}</div>
      )}
    </div>
  );
}

/** Pill-style multi/single select used for the condition questions. */
export function PillGroup({
  options,
  value,
  onChange,
  multi = false,
  label,
}: {
  options: { value: string; label: string }[];
  value: string | string[] | null;
  onChange: (v: string) => void;
  multi?: boolean;
  label: string;
}) {
  const isSelected = (v: string) =>
    multi ? Array.isArray(value) && value.includes(v) : value === v;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={isSelected(o.value)}
          onClick={() => onChange(o.value)}
          className={`border-[1.5px] px-4 py-2.5 font-semibold transition-colors ${
            isSelected(o.value)
              ? "border-forest bg-forest text-background"
              : "border-charcoal/30 bg-background text-charcoal hover:border-charcoal"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small italic step heading shared by every step. */
export function StepHeading({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div>
      <p className="text-base font-bold uppercase tracking-widest text-forest">{kicker}</p>
      <h2 className="mt-1 font-display text-4xl font-black text-charcoal md:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-2 max-w-xl leading-relaxed text-charcoal/70">{sub}</p>}
    </div>
  );
}

/** Field label + input pair matching the site's input-sharp style. */
export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold text-charcoal">
        {label}
      </label>
      {children}
    </div>
  );
}
