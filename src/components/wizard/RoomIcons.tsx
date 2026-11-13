// Drawn room icons for the quote wizard's room counter (Ben 14 Nov 2026:
// "little image things for our rooms like BFYB but better"). One SVG per
// ROOMS key in StepJob.tsx — brand blues with a charcoal outline, sitting on
// a sharp cream chip. Bigger variants differ visibly (double bed = two
// pillows, large robe = shelves, larger lounge = chaise, hallways get more
// runner stripes as they get longer).
import type { ReactNode } from "react";

const S = "#171E27"; // charcoal outline
const DEEP = "#1E5FB8";
const MID = "#1A6FD1";
const LIGHT = "#5FA8E8";
const PALE = "#C5E3F8";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-9 w-9"
      fill="none"
      stroke={S}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  // Standard bedroom — single bed, one pillow
  bed: (
    <Svg>
      <rect x="7.5" y="13" width="3.5" height="19" fill={DEEP} stroke="none" />
      <rect x="13" y="17.5" width="9" height="6" rx="2" fill={PALE} />
      <path d="M10 24h30v6H10z" fill={LIGHT} />
      <path d="M10 30h30v5H10z" fill={MID} />
      <path d="M13 35v4M37 35v4" />
    </Svg>
  ),
  // Main bedroom — double bed, two pillows
  bedLarge: (
    <Svg>
      <rect x="6.5" y="12" width="3.5" height="20" fill={DEEP} stroke="none" />
      <rect x="12" y="17" width="9.5" height="6" rx="2" fill={PALE} />
      <rect x="23" y="17" width="9.5" height="6" rx="2" fill={PALE} />
      <path d="M9 24h33v6H9z" fill={LIGHT} />
      <path d="M9 30h33v5H9z" fill={MID} />
      <path d="M12 35v4M39 35v4" />
    </Svg>
  ),
  // Lounge room — two-cushion sofa
  living: (
    <Svg>
      <path d="M11 16h26a2 2 0 0 1 2 2v10H9V18a2 2 0 0 1 2-2z" fill={LIGHT} />
      <rect x="12" y="20" width="11" height="7" rx="1.5" fill={PALE} />
      <rect x="25" y="20" width="11" height="7" rx="1.5" fill={PALE} />
      <path d="M9 28h30v6H9z" fill={MID} />
      <rect x="5.5" y="17" width="4" height="17" rx="1.5" fill={DEEP} />
      <rect x="38.5" y="17" width="4" height="17" rx="1.5" fill={DEEP} />
      <path d="M12 34v4M36 34v4" />
    </Svg>
  ),
  // Large lounge — corner sectional with a chaise
  livingLg: (
    <Svg>
      <rect x="9" y="15" width="24" height="11" rx="2" fill={LIGHT} />
      <rect x="12" y="19" width="9" height="6" rx="1.5" fill={PALE} />
      <rect x="22.5" y="19" width="9" height="6" rx="1.5" fill={PALE} />
      <path d="M9 26h24v6H9z" fill={MID} />
      <rect x="5.5" y="16" width="4" height="16" rx="1.5" fill={DEEP} />
      <rect x="31" y="22" width="10" height="8" rx="1.5" fill={PALE} />
      <path d="M31 30h10v6H31z" fill={MID} />
      <path d="M12 32v4M28 32v4M36 36v3" />
    </Svg>
  ),
  // Dining room — table, two chairs, pendant light
  dining: (
    <Svg>
      <path d="M24 5v5" />
      <path d="M19.5 13a4.5 3 0 0 1 9 0z" fill={LIGHT} />
      <path d="M7 17v9h5M12 26v6" strokeWidth={2.5} stroke={DEEP} />
      <path d="M41 17v9h-5M36 26v6" strokeWidth={2.5} stroke={DEEP} />
      <rect x="11" y="22" width="26" height="3.5" fill={MID} />
      <path d="M15 25.5v10M33 25.5v10" />
    </Svg>
  ),
  // Walk-in robe — open wardrobe, rail with hangers
  wir: (
    <Svg>
      <rect x="13" y="7" width="22" height="34" fill={PALE} />
      <path d="M16 14h16" strokeWidth={2.5} stroke={DEEP} />
      <path d="M19 13.5v2M19 15.5l-4 4.5h8z" fill={LIGHT} />
      <path d="M27 13.5v2M27 15.5l-4 4.5h8z" fill={MID} />
      <path d="M16 33h16" />
      <rect x="18" y="28" width="5" height="4" fill={LIGHT} stroke="none" />
      <rect x="24" y="28" width="6" height="4" fill={MID} stroke="none" />
    </Svg>
  ),
  // Large walk-in robe — wardrobe with rail + shelf stack
  wirLarge: (
    <Svg>
      <rect x="7" y="7" width="34" height="34" fill={PALE} />
      <path d="M27 7v34" />
      <path d="M10.5 14h13" strokeWidth={2.5} stroke={DEEP} />
      <path d="M14.5 13.5v2M14.5 15.5l-3.5 4h7z" fill={LIGHT} />
      <path d="M20.5 13.5v2M20.5 15.5l-3.5 4h7z" fill={MID} />
      <path d="M29 16h10M29 24h10M29 32h10" />
      <rect x="30.5" y="12.5" width="7" height="3.5" fill={LIGHT} stroke="none" />
      <rect x="30.5" y="20.5" width="7" height="3.5" fill={MID} stroke="none" />
      <rect x="30.5" y="28.5" width="7" height="3.5" fill={LIGHT} stroke="none" />
    </Svg>
  ),
  // Staircase — one flight with handrail
  stairs: (
    <Svg>
      <path d="M9 37V31h7v-6h7v-6h7v-6h9v24z" fill={PALE} />
      <path d="M12 27L38 10" strokeWidth={2.5} stroke={MID} />
      <path d="M16 24.5v6.5M24 19.5v5.5" stroke={DEEP} />
    </Svg>
  ),
};

// Hallways — top-down corridor with a runner; the longer the run, the more
// stripes on the runner (1 = short run … 4 = full length).
function hall(stripes: number[]) {
  return (
    <Svg>
      <rect x="17" y="7" width="14" height="34" fill={PALE} stroke="none" />
      <path d="M17 7v34M31 7v34" strokeWidth={3} stroke={DEEP} />
      <rect x="20.5" y="11" width="7" height="28" fill={LIGHT} strokeWidth={1.5} />
      {stripes.map((y) => (
        <path key={y} d={`M21.5 ${y}h5`} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}
ICONS.hall = hall([25]);
ICONS.hall2 = hall([19, 31]);
ICONS.hall3 = hall([16.5, 25, 34]);
ICONS.hall4 = hall([14.5, 21, 27.5, 34]);

export function RoomIcon({ room }: { room: string }) {
  return ICONS[room] ?? ICONS.bed;
}
