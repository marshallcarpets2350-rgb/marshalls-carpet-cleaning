// Christmas 2026 site dressing — fairy lights under the header, a Santa hat
// on the logo, light snow on the homepage, and a festive footer line.
// SELF-REMOVING: everything renders nothing outside the season window, so
// there's no takedown job in January.
import type { CSSProperties } from "react";

// Season window (local time): switch on 7 Nov, off after Boxing Day.
const SEASON_START = new Date("2026-11-07T00:00:00");
const SEASON_END = new Date("2026-12-27T00:00:00"); // exclusive

export function christmasOn(): boolean {
  const now = new Date();
  return now >= SEASON_START && now < SEASON_END;
}

const CSS = `
@keyframes mcc-bulb {
  0%, 100% { opacity: 1; filter: brightness(1.25); }
  50% { opacity: 0.45; filter: brightness(0.8); }
}
@keyframes mcc-snow {
  0% { transform: translate3d(0, -6vh, 0); }
  100% { transform: translate3d(var(--drift, 4vw), 106vh, 0); }
}
@keyframes mcc-hat-wobble {
  0%, 100% { transform: rotate(-14deg); }
  50% { transform: rotate(-8deg); }
}
@media (prefers-reduced-motion: reduce) {
  .mcc-bulb, .mcc-flake, .mcc-hat { animation: none !important; }
}
`;

export function ChristmasStyles() {
  if (!christmasOn()) return null;
  return <style>{CSS}</style>;
}

const BULB_COLORS = ["#E11D48", "#16A34A", "#F59E0B", "#3B82F6", "#F8FAFC"];

/** A string of twinkling fairy lights — sits under the header, site-wide. */
export function FairyLights() {
  if (!christmasOn()) return null;
  const bulbs = Array.from({ length: 36 });
  return (
    <div
      aria-hidden="true"
      className="relative h-[14px] w-full overflow-hidden border-t border-charcoal/15 bg-background"
    >
      {/* the wire */}
      <div className="absolute left-0 right-0 top-[3px] h-px bg-charcoal/40" />
      <div className="flex justify-between px-2">
        {bulbs.map((_, i) => {
          const color = BULB_COLORS[i % BULB_COLORS.length];
          return (
            <span
              key={i}
              className="mcc-bulb relative top-[3px] inline-block h-[9px] w-[9px] rounded-full"
              style={
                {
                  backgroundColor: color,
                  boxShadow: `0 0 6px 1px ${color}`,
                  animation: `mcc-bulb ${1.6 + (i % 5) * 0.35}s ease-in-out ${(i % 7) * 0.22}s infinite`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/** A little Santa hat perched on the corner of the logo. */
export function SantaHat() {
  if (!christmasOn()) return null;
  return (
    <span
      aria-hidden="true"
      className="mcc-hat pointer-events-none absolute -top-1 left-2 text-3xl md:left-4 md:text-5xl"
      style={{ transform: "rotate(-14deg)", transformOrigin: "bottom left", animation: "mcc-hat-wobble 6s ease-in-out infinite" }}
    >
      🎅
    </span>
  );
}

/** Gentle snow drifting over the homepage — emoji flakes, no libraries. */
export function Snowfall({ count = 18 }: { count?: number }) {
  if (!christmasOn()) return null;
  const flakes = Array.from({ length: count });
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {flakes.map((_, i) => {
        const size = 12 + ((i * 7) % 14);
        const left = (i * 137) % 100;
        const dur = 9 + ((i * 3) % 8);
        const delay = -((i * 1.7) % 12);
        const drift = ((i % 2 === 0 ? 1 : -1) * (3 + (i % 5))).toFixed(0);
        return (
          <span
            key={i}
            className="mcc-flake absolute"
            style={
              {
                left: `${left}vw`,
                top: "-6vh",
                fontSize: `${size}px`,
                opacity: 0.55 + ((i * 13) % 40) / 100,
                animation: `mcc-snow ${dur}s linear ${delay}s infinite`,
                "--drift": `${drift}vw`,
              } as CSSProperties
            }
          >
            {i % 9 === 4 ? "❅" : "❄"}
          </span>
        );
      })}
    </div>
  );
}

/** Small festive touch for the footer. */
export function ChristmasFooterLine() {
  if (!christmasOn()) return null;
  return (
    <p className="text-sm text-background/80">
      🎄🦌 Merry Christmas from the Marshall's team — and thanks for backing a local business this year.
    </p>
  );
}
