// Seasonal site dressing — driven by the shared calendar in
// contracts/rates.ts (seasonFor / seasonalPromoFor / seasonWindowFor).
// The falling gutter art is hand-drawn SVG (brand palette, drop shadows,
// gentle sway) — it pops instead of reading as clip-art. The homepage snow
// falls once on arrival on desktop, then settles (the gutters carry on); on
// phones — no gutters — it keeps falling, art and Santa mixed in.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { christmasOn, seasonFor, seasonWindowFor } from "@contracts/rates";
import mascotHead from "@/assets/mascot-head.webp";

const CSS = `
@keyframes mcc-bulb {
  0%, 100% { opacity: 1; filter: brightness(1.3); }
  50% { opacity: 0.45; filter: brightness(0.8); }
}
@keyframes mcc-mask {
  0%, 14%   { left: 84%; top: 9%;  transform: translate(-50%,-50%) rotate(-14deg) scale(.7); }
  22%       { left: 68%; top: 34%; transform: translate(-50%,-50%) rotate(165deg)  scale(.92); }
  28%, 54%  { left: 52%; top: 60%; transform: translate(-50%,-50%) rotate(360deg)  scale(1); }
  60%       { left: 68%; top: 32%; transform: translate(-50%,-50%) rotate(525deg)  scale(.9); }
  68%, 100% { left: 84%; top: 9%;  transform: translate(-50%,-50%) rotate(706deg)  scale(.7); }
}
@keyframes mcc-fall {
  0% { transform: translate3d(0, -10vh, 0); opacity: 0; }
  7% { opacity: var(--peak, 0.95); }
  92% { opacity: var(--peak, 0.95); }
  100% { transform: translate3d(var(--sway, 14px), 107vh, 0); opacity: 0; }
}
@keyframes mcc-sway {
  from { transform: rotate(-10deg); }
  to { transform: rotate(12deg); }
}
@keyframes mcc-snow {
  0% { transform: translate3d(0, -6vh, 0); opacity: 0; }
  8% { opacity: var(--fo, 1); }
  88% { opacity: var(--fo, 1); }
  100% { transform: translate3d(var(--drift, 4vw), 106vh, 0); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mcc-bulb, .mcc-flake, .mcc-mask, .mcc-sway { animation: none !important; }
  .mcc-fall-item { display: none !important; }
}
`;

export function SeasonalStyles() {
  return <style>{CSS}</style>;
}

// ---------------------------------------------------------------------------
// Hand-drawn seasonal shapes (48×48 unless noted) — drawn, not emoji, so
// they render identically everywhere and stay on-palette.
// ---------------------------------------------------------------------------

const SHAPES: Record<string, (c1: string, c2: string, label?: string) => ReactNode> = {
  tree: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path d="M24 2.5 33.5 15h-19z" fill="#166534" />
      <path d="M24 9 37.5 26h-27z" fill={c1} />
      <path d="M24 16.5 41 37H7z" fill={c1} opacity="0.88" />
      <rect x="21" y="37" width="6" height="6.5" rx="1" fill="#7C4A21" />
      <path d="M24 .8l1.7 3.4 3.7.5-2.7 2.6.7 3.7L24 9.4l-3.4 1.6.7-3.7-2.7-2.6 3.7-.5z" fill="#F59E0B" />
      <circle cx="17" cy="29" r="2" fill={c2} />
      <circle cx="31" cy="25" r="2" fill="#F8FAFC" />
      <circle cx="24" cy="33" r="2" fill={c2} opacity="0.9" />
      <circle cx="28" cy="30.5" r="1.5" fill="#F59E0B" />
    </svg>
  ),
  bauble: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path d="M24 6c-2.5 0-4 1.8-4 4" stroke="#B45309" strokeWidth="1.8" fill="none" />
      <rect x="19.5" y="9.5" width="9" height="5" rx="1.5" fill="#B45309" />
      <circle cx="24" cy="28" r="14" fill={c1} />
      <path d="M11.5 31q12.5 6.5 25 0" stroke={c2} strokeWidth="2.6" fill="none" opacity="0.95" />
      <ellipse cx="18.5" cy="22.5" rx="4.8" ry="3.4" fill="#fff" opacity="0.5" transform="rotate(-24 18.5 22.5)" />
    </svg>
  ),
  snowflake: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" strokeLinecap="round">
      <g stroke="#FFFFFF" strokeWidth="5.4" opacity="0.7">
        <path d="M24 5v38M8.5 14.5l31 19M8.5 33.5l31-19" />
      </g>
      <g stroke={c1} strokeWidth="2.6">
        <path d="M24 5v38M8.5 14.5l31 19M8.5 33.5l31-19" />
        <path d="M19.5 10.5 24 7l4.5 3.5M19.5 37.5 24 41l4.5-3.5" />
      </g>
      <g fill={c1} stroke="none">
        <circle cx="24" cy="24" r="2.6" />
        <circle cx="24" cy="5" r="1.8" /><circle cx="24" cy="43" r="1.8" />
        <circle cx="8.5" cy="14.5" r="1.8" /><circle cx="39.5" cy="33.5" r="1.8" />
        <circle cx="8.5" cy="33.5" r="1.8" /><circle cx="39.5" cy="14.5" r="1.8" />
      </g>
    </svg>
  ),
  present: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <ellipse cx="16.5" cy="9" rx="5.2" ry="3.6" fill={c2} transform="rotate(-26 16.5 9)" />
      <ellipse cx="31.5" cy="9" rx="5.2" ry="3.6" fill={c2} transform="rotate(26 31.5 9)" />
      <circle cx="24" cy="10" r="2.4" fill={c2} />
      <rect x="8" y="19" width="32" height="23" rx="2" fill={c1} />
      <rect x="6" y="12.5" width="36" height="8" rx="2" fill={c1} stroke="#00000022" />
      <rect x="21.5" y="12.5" width="5" height="29.5" fill={c2} />
    </svg>
  ),
  star: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path
        d="M24 5 28.5 17.8 42.1 18.1 31.3 26.4 35.2 39.4 24 31.7 12.8 39.4 16.7 26.4 5.9 18.1 19.5 17.8z"
        fill={c1}
        stroke="#B45309"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
    </svg>
  ),
  tag: (c1, _c2, label) => (
    <svg viewBox="0 0 64 40" className="h-full w-full">
      <path d="M14 6h34l10 14-10 14H14a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill={c1} />
      <circle cx="16" cy="20" r="3" fill="#FDF6EC" />
      <path d="M16 20C12 14 8 12 3 12" stroke="#8B5E34" strokeWidth="1.8" fill="none" />
      <text x="37" y="24.5" textAnchor="middle" fontFamily="inherit" fontSize="10.5" fontWeight="800" fill="#fff">
        {label ?? "SALE"}
      </text>
    </svg>
  ),
  burst: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full" stroke={c1} strokeWidth="2.4" strokeLinecap="round" fill="none">
      <path d="M24 6v8M24 34v8M6 24h8M34 24h8M11.3 11.3l5.6 5.6M31.1 31.1l5.6 5.6M36.7 11.3l-5.6 5.6M16.9 31.1l-5.6 5.6" />
      <circle cx="24" cy="24" r="3.2" fill={c1} stroke="none" />
    </svg>
  ),
  sun: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <g stroke={c1} strokeWidth="2.6" strokeLinecap="round">
        <path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M38.1 9.9l-4.2 4.2M14.1 33.9l-4.2 4.2" />
      </g>
      <circle cx="24" cy="24" r="10" fill={c1} />
      <circle cx="24" cy="24" r="6" fill={c2} opacity="0.6" />
    </svg>
  ),
  droplet: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path d="M24 5C24 5 11 21 11 30a13 13 0 0 0 26 0C37 21 24 5 24 5z" fill={c1} />
      <ellipse cx="19" cy="29" rx="3.4" ry="5" fill="#fff" opacity="0.5" transform="rotate(-18 19 29)" />
    </svg>
  ),
  egg: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path d="M24 5c7.5 0 13 10.5 13 19.5S31.5 43 24 43s-13-7-13-18.5S16.5 5 24 5z" fill={c1} />
      <path d="M12.5 21.5l4-3.6 4 3.6 4-3.6 4 3.6 4-3.6 3.5 3.2" stroke={c2} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <circle cx="18" cy="31" r="1.6" fill="#fff" opacity="0.85" />
      <circle cx="24" cy="33" r="1.6" fill="#fff" opacity="0.85" />
      <circle cx="30" cy="31" r="1.6" fill="#fff" opacity="0.85" />
    </svg>
  ),
  bunny: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <ellipse cx="17.5" cy="11" rx="3.6" ry="8.5" fill={c1} stroke="#CBD5E1" />
      <ellipse cx="30.5" cy="11" rx="3.6" ry="8.5" fill={c1} stroke="#CBD5E1" />
      <ellipse cx="17.5" cy="12" rx="1.5" ry="5.4" fill="#F9A8D4" />
      <ellipse cx="30.5" cy="12" rx="1.5" ry="5.4" fill="#F9A8D4" />
      <circle cx="24" cy="29" r="12.5" fill={c1} stroke="#CBD5E1" />
      <circle cx="19.5" cy="27" r="1.7" fill="#1F2937" />
      <circle cx="28.5" cy="27" r="1.7" fill="#1F2937" />
      <ellipse cx="24" cy="30.4" rx="1.6" ry="1.2" fill="#F472B6" />
      <path d="M24 31.5v1.5M24 33q-2 2-4 1M24 33q2 2 4 1" stroke="#1F2937" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  ),
  daisy: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <g fill={c1}>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <ellipse key={a} cx="24" cy="13.5" rx="4.6" ry="8.5" transform={`rotate(${a} 24 24)`} />
        ))}
      </g>
      <circle cx="24" cy="24" r="5" fill={c2} />
    </svg>
  ),
  leaf: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <path d="M24 4C33 12 39 21 37.5 32 31 39.5 19 40 12.5 33 10.5 21.5 16 11 24 4z" fill={c1} />
      <path d="M24 8C22 18 20 27 15.5 35" stroke={c2} strokeWidth="1.6" fill="none" opacity="0.7" />
      <path d="M15.5 35 11 41" stroke="#7C4A21" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  ),
  mitten: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <ellipse cx="35.5" cy="24" rx="4.5" ry="6.5" fill={c1} transform="rotate(24 35.5 24)" />
      <rect x="14" y="6" width="20" height="32" rx="10" fill={c1} />
      <rect x="13" y="31" width="22" height="7" rx="3" fill={c2} />
    </svg>
  ),
  butterfly: (c1, c2) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <ellipse cx="17" cy="19" rx="7.5" ry="10" fill={c1} transform="rotate(-22 17 19)" />
      <ellipse cx="31" cy="19" rx="7.5" ry="10" fill={c2} transform="rotate(22 31 19)" />
      <ellipse cx="18.5" cy="33" rx="5" ry="6.5" fill={c1} opacity="0.85" transform="rotate(18 18.5 33)" />
      <ellipse cx="29.5" cy="33" rx="5" ry="6.5" fill={c2} opacity="0.85" transform="rotate(-18 29.5 33)" />
      <path d="M23 11q-3-5-6-6M25 11q3-5 6-6" stroke="#374151" strokeWidth="1.4" fill="none" />
      <rect x="22.7" y="11" width="2.6" height="26" rx="1.3" fill="#374151" />
    </svg>
  ),
  iceblock: (c1) => (
    <svg viewBox="0 0 48 48" className="h-full w-full">
      <rect x="21" y="30" width="6" height="12" rx="3" fill="#D6A15C" />
      <rect x="15" y="4" width="18" height="27" rx="9" fill={c1} />
      <ellipse cx="20" cy="12" rx="3" ry="6" fill="#fff" opacity="0.4" transform="rotate(-8 20 12)" />
    </svg>
  ),
};

interface ArtSpec {
  s: string;
  c1: string;
  c2?: string;
}

/** What falls down the gutters for each season (id from contracts/rates.ts). */
const SEASON_ART: Record<string, ArtSpec[]> = {
  christmas: [
    { s: "tree", c1: "#15803D", c2: "#DC2626" },
    { s: "bauble", c1: "#DC2626", c2: "#F59E0B" },
    { s: "snowflake", c1: "#5FA8E8" },
    { s: "present", c1: "#DC2626", c2: "#F8FAFC" },
    { s: "star", c1: "#F59E0B" },
    { s: "bauble", c1: "#15803D", c2: "#F8FAFC" },
    { s: "present", c1: "#1A6FD1", c2: "#F59E0B" },
  ],
  boxingday: [
    { s: "tag", c1: "#B91C1C" },
    { s: "burst", c1: "#F59E0B" },
    { s: "present", c1: "#1A6FD1", c2: "#F8FAFC" },
    { s: "tag", c1: "#15803D" },
    { s: "star", c1: "#F59E0B" },
  ],
  newyear: [
    { s: "burst", c1: "#F59E0B" },
    { s: "star", c1: "#F59E0B" },
    { s: "burst", c1: "#5FA8E8" },
    { s: "present", c1: "#7C3AED", c2: "#F59E0B" },
    { s: "star", c1: "#FDE68A" },
  ],
  summer: [
    { s: "sun", c1: "#F59E0B", c2: "#FDE68A" },
    { s: "droplet", c1: "#1A6FD1" },
    { s: "iceblock", c1: "#F472B6" },
    { s: "sun", c1: "#F97316", c2: "#FDE68A" },
    { s: "droplet", c1: "#38BDF8" },
  ],
  easter: [
    { s: "egg", c1: "#A78BFA", c2: "#FDE68A" },
    { s: "bunny", c1: "#F8FAFC" },
    { s: "daisy", c1: "#F9A8D4", c2: "#F59E0B" },
    { s: "egg", c1: "#6EE7B7", c2: "#F9A8D4" },
  ],
  autumn: [
    { s: "leaf", c1: "#EA8A2F", c2: "#B45309" },
    { s: "leaf", c1: "#DC2626", c2: "#7F1D1D" },
    { s: "leaf", c1: "#B45309", c2: "#7C4A21" },
  ],
  winter: [
    { s: "snowflake", c1: "#5FA8E8" },
    { s: "snowflake", c1: "#93C5FD" },
    { s: "mitten", c1: "#DC2626", c2: "#F8FAFC" },
    { s: "snowflake", c1: "#3B82F6" },
  ],
  latewinter: [
    { s: "snowflake", c1: "#93C5FD" },
    { s: "droplet", c1: "#64748B" },
    { s: "mitten", c1: "#1A6FD1", c2: "#F8FAFC" },
  ],
  spring: [
    { s: "daisy", c1: "#F9A8D4", c2: "#F59E0B" },
    { s: "butterfly", c1: "#5FA8E8", c2: "#A78BFA" },
    { s: "daisy", c1: "#FDE68A", c2: "#F97316" },
    { s: "daisy", c1: "#86EFAC", c2: "#F59E0B" },
  ],
  latespring: [
    { s: "daisy", c1: "#F9A8D4", c2: "#F59E0B" },
    { s: "sun", c1: "#F59E0B", c2: "#FDE68A" },
    { s: "butterfly", c1: "#F472B6", c2: "#5FA8E8" },
  ],
};

/** Slim strip under the header, site-wide: the live promo (with its end
 *  date — urgency converts) when one's running, the season's own line
 *  otherwise, nothing in quiet months. */
export function SeasonBanner() {
  const win = seasonWindowFor();
  const season = win?.season;
  const promo = season?.promo ?? null;
  const endLabel = win?.end.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  const text = promo
    ? `🏷️ ${promo.label} — ${promo.percent}% off every clean until ${endLabel}, comes off your quote automatically.`
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
              className="mcc-bulb relative top-[3px] inline-block h-[10px] w-[10px] rounded-full"
              style={
                {
                  backgroundColor: color,
                  boxShadow: `0 0 8px 2px ${color}`,
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

/** One emoji per season — the little character that perches on the mascot's
 *  cap, rolls down onto his face like a mask (the Marshall's character
 *  "becomes" Santa at Christmas), then rolls back off. Owner call 13 Nov
 *  2026: Santa came OFF the main logo and onto the mascot beside it. */
const SEASON_MASK: Record<string, string> = {
  christmas: "🎅",
  boxingday: "🎁",
  newyear: "🎆",
  summer: "😎",
  easter: "🐰",
  autumn: "🍂",
  winter: "❄️",
  latewinter: "🌧️",
  spring: "🌸",
  latespring: "🌻",
};

/** The mascot head beside the header logo — year-round, with the season's
 *  emoji mask rolling on and off his face (12s loop). The mask positions are
 *  % of the mascot image so they hold at every breakpoint; reduced-motion
 *  leaves it parked on the cap. */
export function HeaderMascot() {
  const mask = SEASON_MASK[seasonFor()?.id ?? ""] ?? null;
  return (
    <span aria-hidden="true" className="relative ml-1 inline-block shrink-0 select-none md:ml-2">
      <img src={mascotHead} alt="" className="h-11 w-auto md:h-24 lg:h-20 xl:h-24" />
      {mask && (
        <span
          className="mcc-mask pointer-events-none absolute text-xl leading-none md:text-5xl lg:text-4xl xl:text-5xl"
          style={{
            left: "84%",
            top: "9%",
            transform: "translate(-50%,-50%) rotate(-14deg) scale(.7)",
            animation: "mcc-mask 12s ease-in-out infinite",
          }}
        >
          {mask}
        </span>
      )}
    </span>
  );
}

/** Snow on the homepage — on desktop one gentle pass over the entry, then it
 *  fades out and the gutters carry the season (Ben's call 8 Nov). Phones have
 *  no gutters, so there it snows the whole visit: endless flakes with the
 *  season's drawn art and Santa mixed in (Ben's call, 13 Nov 2026). */
export function Snowfall({ count = 16 }: { count?: number }) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const [endless, setEndless] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setEndless(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (endless) return;
    const t1 = setTimeout(() => setFading(true), 15000);
    const t2 = setTimeout(() => setGone(true), 16500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [endless]);
  if (!christmasOn() || gone) return null;
  const flakes = Array.from({ length: endless ? count + 4 : count });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      style={{ transition: "opacity 1.5s ease", opacity: fading ? 0 : 1 }}
    >
      {flakes.map((_, i) => {
        const size = 14 + ((i * 7) % 13);
        const left = (i * 137) % 100;
        const dur = 8 + ((i * 3) % 7) + (endless ? 5 : 0);
        const delay = -((i * 1.7) % 7) - (endless ? (i * 2.3) % 9 : 0);
        const drift = ((i % 2 === 0 ? 1 : -1) * (3 + (i % 5))).toFixed(0);
        const opacity = 0.65 + ((i * 13) % 30) / 100 - (endless ? 0.12 : 0);
        // Phones: mix in the season's drawn art (same pieces as the desktop
        // gutters) and one Santa drifting down with the lot.
        let node: ReactNode = SHAPES.snowflake(i % 3 === 0 ? "#93C5FD" : "#5FA8E8", "");
        let itemSize = size;
        if (endless && i === 2) {
          node = <span style={{ fontSize: size + 10, lineHeight: 1 }}>🎅</span>;
          itemSize = size + 10;
        } else if (endless && i % 5 === 4) {
          const art = SEASON_ART.christmas[Math.floor(i / 5) % SEASON_ART.christmas.length];
          node = SHAPES[art.s]?.(art.c1, art.c2 ?? "") ?? node;
          itemSize = size + 8;
        }
        return (
          <span
            key={i}
            className="mcc-flake absolute"
            style={
              {
                left: `${left}vw`,
                top: "-6vh",
                width: `${itemSize}px`,
                height: `${itemSize}px`,
                opacity,
                animation: `mcc-snow ${dur}s linear ${delay}s ${endless ? "infinite" : "1"} both`,
                "--drift": `${drift}vw`,
                "--fo": opacity,
                filter: "drop-shadow(0 1px 2px rgb(30 95 184 / 0.25))",
              } as CSSProperties
            }
          >
            {node}
          </span>
        );
      })}
    </div>
  );
}

/** Season's footer sign-off (Christmas, Boxing Day, New Year, Easter). */
export function SeasonalFooterLine() {
  const footer = seasonWindowFor()?.season.footer;
  if (!footer) return null;
  return <p className="text-sm text-background/80">{footer}</p>;
}

/** One gutter of falling seasonal art — drawn items drop one at a time on a
 *  slow, endless rotation, swaying as they go. While a promo runs, every
 *  fourth item is a red sale tag carrying the discount. Wide screens only;
 *  nothing at all for reduced-motion users. */
export function GutterFall({ side }: { side: "left" | "right" }) {
  const season = seasonWindowFor()?.season;
  if (!season) return null;
  const promo = season.promo;
  const art = SEASON_ART[season.id] ?? SEASON_ART.summer;
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
        const spec = art[i % art.length];
        const left = 10 + ((i * 37) % 64);
        const dur = 17 + (i % 4) * 3;
        const delay = -(i * (dur / COUNT)) - (side === "right" ? dur / (COUNT * 2) : 0);
        const size = 30 + ((i * 13) % 15);
        const swayDur = 2.1 + (i % 3) * 0.55;
        const peak = 0.8 + ((i * 17) % 20) / 100;
        return (
          <span
            key={i}
            className="mcc-fall-item absolute"
            style={
              {
                left: `${left}%`,
                top: 0,
                animation: `mcc-fall ${dur}s linear ${delay}s infinite`,
                "--sway": `${(i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 9)}px`,
                "--peak": isTag ? 1 : peak,
              } as CSSProperties
            }
          >
            <span
              className="mcc-sway block"
              style={{
                width: isTag ? `${size * 1.7}px` : `${size}px`,
                height: `${size}px`,
                animation: `mcc-sway ${swayDur}s ease-in-out ${-(i % 5) * 0.4}s infinite alternate`,
                filter: "drop-shadow(0 3px 4px rgb(23 30 39 / 0.28))",
              }}
            >
              {isTag && promo
                ? SHAPES.tag("#B91C1C", "", `${promo.percent}% OFF`)
                : SHAPES[spec.s](spec.c1, spec.c2 ?? "#F8FAFC")}
            </span>
          </span>
        );
      })}
    </div>
  );
}
