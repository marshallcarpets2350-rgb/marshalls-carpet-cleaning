// Dot-river page art — rivers of dots meandering down the blank gutters on
// wide screens, inspired by Aboriginal dot painting (river / waterhole motifs).
// Palette is the site's own blues + white: deep water in the channel, light
// foam at the edges. Pure canvas, drawn once — no images, no animation loop,
// no network weight. Never interactive; hides itself when the gutters vanish.
// DotCreek is the same idea lying across the page as a section divider, so
// phones (which have no gutters) still get the art.
import { useEffect, useRef } from "react";

const INK = "#171E27"; // blue-black
const ROYAL = "#1E5FB8";
const ACTION = "#1A6FD1";
const MID = "#5FA8E8";
const LIGHT = "#C5E3F8";
const WHITE = "#FFFFFF";

interface Dot {
  x: number;
  y: number;
  r: number;
  c: string;
}

/** mulberry32 — fixed seeds, so every visitor sees the same river. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rough bell curve centred on 0 — small jitter so bands look hand-painted. */
function gauss(rnd: () => number): number {
  return (rnd() + rnd() + rnd() + rnd() - 2) / 1.4;
}

/** Banded river palette: black core → royal → blue → mid → light → white edge.
 *  ~12% of dots slip one band over so the borders read painted, not printed. */
const BANDS = [INK, ROYAL, ACTION, MID, LIGHT, WHITE];
function bandColor(depth: number, rnd: () => number): string {
  // depth 0 = centre of the channel, 1 = outer edge
  let band = Math.min(BANDS.length - 1, Math.floor(depth * BANDS.length));
  const slip = rnd();
  if (slip < 0.06 && band > 0) band -= 1;
  else if (slip < 0.12 && band < BANDS.length - 1) band += 1;
  return BANDS[band];
}

function riverDots(w: number, h: number, seed: number): Dot[] {
  const rnd = rng(seed);
  const out: Dot[] = [];
  const f1 = 0.0022 + rnd() * 0.001,
    f2 = 0.006 + rnd() * 0.0025,
    f3 = 0.013 + rnd() * 0.004,
    p1 = rnd() * 6.28,
    p2 = rnd() * 6.28,
    p3 = rnd() * 6.28,
    p4 = rnd() * 6.28;
  // Channel widens and narrows like pools and runs on a real creek.
  const halfW = (y: number) => w * 0.15 * (0.72 + 0.28 * Math.sin(y * 0.0009 + p4)) + 10;
  // Raw spine, then rescaled to fill the gutter edge-to-edge — big lazy bends
  // with a finer wiggle on top, never clipped by the canvas edge.
  const raw = (y: number) =>
    Math.sin(y * f1 + p1) + 0.55 * Math.sin(y * f2 + p2) + 0.22 * Math.sin(y * f3 + p3);
  let lo = Infinity,
    hi = -Infinity;
  for (let y = 0; y <= h; y += 40) {
    const v = raw(y);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const maxHalf = w * 0.15 + 10;
  const span = (w - 2 * maxHalf - 8) / 2;
  const spine = (y: number) => w / 2 + ((raw(y) - (lo + hi) / 2) / ((hi - lo) / 2)) * span;
  const n = Math.floor(h * 0.8);
  for (let i = 0; i < n; i++) {
    const y = rnd() * h;
    const hw = halfW(y);
    // near-even fill across the channel so the colour bands read clearly
    const off = Math.sign(rnd() - 0.5) * Math.pow(rnd(), 0.8) * hw + gauss(rnd) * 2;
    const depth = Math.min(1, Math.abs(off) / hw);
    const big = rnd();
    out.push({
      x: spine(y) + off,
      y,
      r: big < 0.9 ? 1.5 + rnd() * 2.4 : 3.9 + rnd() * 3,
      c: bandColor(depth, rnd),
    });
  }
  // Waterholes — concentric rings of dots where the river pools.
  const holes = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < holes; k++) {
    const hy = (0.18 + 0.64 * rnd()) * h,
      hx = spine(hy);
    const base = Math.min(halfW(hy) * 1.15, 26);
    out.push({ x: hx, y: hy, r: 5.5 + rnd() * 2.5, c: INK });
    for (let ring = 1; ring <= 3; ring++) {
      const rr = (base * ring) / 1.4,
        cnt = 8 + ring * 6;
      for (let d = 0; d < cnt; d++) {
        const a = (d / cnt) * 6.283 + rnd() * 0.25;
        out.push({
          x: hx + Math.cos(a) * rr,
          y: hy + Math.sin(a) * rr * 0.86,
          r: 1.8 + rnd() * 1.6,
          c: BANDS[ring],
        });
      }
    }
  }
  return out;
}

function creekDots(w: number, h: number, seed: number): Dot[] {
  const rnd = rng(seed);
  const out: Dot[] = [];
  const p1 = rnd() * 6.28,
    p2 = rnd() * 6.28,
    p3 = rnd() * 6.28;
  const spine = (x: number) =>
    h / 2 +
    h * 0.26 * Math.sin(x * 0.006 + p1) +
    h * 0.12 * Math.sin(x * 0.016 + p2) +
    h * 0.05 * Math.sin(x * 0.033 + p3);
  const n = Math.floor(w * 1.7);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w;
    const hw = h * 0.30;
    const off = Math.sign(rnd() - 0.5) * Math.pow(rnd(), 0.8) * hw + gauss(rnd) * 1.5;
    const depth = Math.min(1, Math.abs(off) / hw);
    const big = rnd();
    out.push({
      x,
      y: spine(x) + off,
      r: big < 0.9 ? 1.4 + rnd() * 2.2 : 3.6 + rnd() * 3,
      c: bandColor(depth, rnd),
    });
  }
  return out;
}

function paint(canvas: HTMLCanvasElement, dots: Dot[], w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  for (const d of dots) {
    ctx.fillStyle = d.c;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, 6.283);
    ctx.fill();
  }
}

/** One gutter river. Draws only when the side margin is wide enough. */
function Gutter({ side, seed }: { side: "left" | "right"; seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const margin = (window.innerWidth - 1152) / 2; // content max-w-6xl
      const w = Math.min(margin - 20, 190);
      if (w < 110) {
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "block";
      canvas.style.width = `${w}px`;
      canvas.style.height = `${window.innerHeight}px`;
      paint(canvas, riverDots(w, window.innerHeight, seed), w, window.innerHeight);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [seed]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-y-0 hidden xl:block"
      style={side === "left" ? { left: 10 } : { right: 10 }}
    />
  );
}

export default function FlowArt() {
  return (
    <>
      <Gutter side="left" seed={2350} />
      <Gutter side="right" seed={2351} />
    </>
  );
}

/** Horizontal dot creek — a section divider so small screens get the art too. */
export function DotCreek({ seed = 4711 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const w = canvas.parentElement?.clientWidth ?? window.innerWidth;
      const h = 100;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      paint(canvas, creekDots(w, h, seed), w, h);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [seed]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none block w-full" />;
}
