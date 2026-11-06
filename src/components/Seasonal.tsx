// Seasonal site dressing — driven by the shared calendar in
// contracts/rates.ts (seasonFor / seasonalPromoFor). One place for the
// header strip, the footer line, the Christmas lights & snow, and the
// falling gutter art. Everything renders nothing when there's nothing to
// say, so the site dresses and undresses itself all year.
import type { CSSProperties } from "react";
import { Link } from "react-router";
import { christmasOn, seasonFor, seasonalPromoFor } from "@contracts/rates";

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
@keyframes mcc-fall {
  0% { transform: translate3d(0, -9vh, 0) rotate(var(--rot0, -12deg)); opacity: 0; }
  7% { opacity: var(--peak, 0.9); }
  92% { opacity: var(--peak, 0.9); }
  100% { transform: translate3d(var(--sway, 14px), 106vh, 0) rotate(var(--rot1, 16deg)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mcc-bulb, .mcc-flake, .mcc-hat { animation: none !important; }
  .mcc-fall-item { display: none !important; }
}
`;

export function SeasonalStyles() {
  return <style>{CSS}</style>;
}

/** Slim strip under the header, site-wide: the live promo when one's
 *  running, the Christmas booking push in December, nothing otherwise. */
export function SeasonBanner() {
  const promo = seasonalPromoFor();
  const season = seasonFor();
  const text = promo
    ? `🏷️ ${promo.label} — ${promo.percent}% off every clean, comes off your quote automatically.`
    : season?.banner;
  if (!text) return null;
  return (
    <Link
      to="/quote"
      className="block border-b-[1.5px] border-charcoal bg-[#1A6FD1] px-4 py-2 text-center text-sm font-bold text-white no-underline transition-colors hover:bg-[#1E5FB8]"
    >
      {text} <span className="underline underline-offset-2">Book your clean</span>
    </Link>
  );
}

const BULB_COLORS = ["#E11D48", "#16A34A", "#F59E0B", "#3B82F6", "#F8FAFC"];

/** A string of twinkling fairy lights — sits under the header, Christmas only. */
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

/** A little Santa hat perched on the corner of the logo, Christmas only. */
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

/** Gentle snow drifting over the homepage, Christmas only. */
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

/** Season's footer sign-off (Christmas, New Year, Easter). */
export function SeasonalFooterLine() {
  const footer = seasonFor()?.footer;
  if (!footer) return null;
  return <p className="text-sm text-background/80">{footer}</p>;
}

/** One gutter of falling seasonal art — items drop one at a time on a slow,
 *  endless rotation. When a promo's running, every fourth item is a little
 *  red sale tag carrying the discount. Wide screens only (the gutters have
 *  to exist); reduced-motion users get none of it. */
export function GutterFall({ side }: { side: "left" | "right" }) {
  const season = seasonFor();
  if (!season) return null;
  const promo = season.promo;
  const art = season.art;
  const COUNT = 7;
  const items = Array.from({ length: COUNT });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 z-20 hidden overflow-hidden min-[1420px]:block"
      style={
        side === "left"
          ? { left: 8, width: "min(190px, calc((100vw - 1152px) / 2 - 24px))" }
          : { right: 8, width: "min(190px, calc((100vw - 1152px) / 2 - 24px))" }
      }
    >
      {items.map((_, i) => {
        const isTag = promo !== null && i % 4 === 2;
        const left = 12 + ((i * 37) % 68);
        const dur = 17 + (i % 4) * 3;
        const delay = -(i * (dur / COUNT)) - (side === "right" ? dur / (COUNT * 2) : 0);
        const size = 22 + ((i * 13) % 12);
        const sway = (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 9);
        const rot0 = (i % 2 === 0 ? -1 : 1) * (6 + (i % 3) * 5);
        return (
          <span
            key={i}
            className="mcc-fall-item absolute"
            style={
              {
                left: `${left}%`,
                top: 0,
                animation: `mcc-fall ${dur}s linear ${delay}s infinite`,
                "--sway": `${sway}px`,
                "--rot0": `${rot0}deg`,
                "--rot1": `${-rot0}deg`,
                "--peak": isTag ? 1 : 0.85,
              } as CSSProperties
            }
          >
            {isTag && promo ? (
              <span className="inline-block -rotate-12 whitespace-nowrap rounded-[4px] border border-white/50 bg-[#B91C1C] px-2 py-0.5 text-[11px] font-black tracking-wide text-white shadow-md">
                {promo.percent}% OFF
              </span>
            ) : (
              <span style={{ fontSize: `${size}px` }}>{art[i % art.length]}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
