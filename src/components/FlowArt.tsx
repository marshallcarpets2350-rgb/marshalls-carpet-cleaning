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

/** Rough bell curve centred on 0 — dots cluster mid-channel. */
function gauss(rnd: () => number): number {
  return (rnd() + rnd() + rnd() + rnd() - 2) / 1.4;
}

function riverDots(w: number, h: number, seed: number): Dot[] {
  const rnd = rng(seed);
  const out: Dot[] = [];
  const p1 = rnd() * 6.28,
    p2 = rnd() * 6.28,
    p3 = rnd() * 6.28;
  const A1 = w * 0.2,
    A2 = w * 0.07,
    f1 = 0.0016 + rnd() * 0.0009,
    f2 = 0.005 + rnd() * 0.002;
  const spine = (y: number) => w / 2 + A1 * Math.sin(y * f1 + p1) + A2 * Math.sin(y * f2 + p2);
  const halfW = (y: number) => w * 0.2 * (0.7 + 0.35 * Math.sin(y * 0.0009 + p3)) + 14;
  const n = Math.floor(h * 0.55);
  for (let i = 0; i < n; i++) {
    const y = rnd() * h;
    const off = gauss(rnd) * halfW(y);
    const depth = Math.max(0, 1 - Math.abs(off) / (halfW(y) * 1.35));
    const j = rnd();
    let c: string;
    if (depth > 0.72) c = j < 0.5 ? INK : ROYAL;
    else if (depth > 0.45) c = j < 0.45 ? ROYAL : j < 0.8 ? ACTION : MID;
    else if (depth > 0.18) c = j < 0.4 ? ACTION : j < 0.75 ? MID : LIGHT;
    else c = j < 0.65 ? LIGHT : j < 0.85 ? MID : WHITE;
    if (rnd() < 0.035) c = WHITE; // foam sparkle
    const big = rnd();
    out.push({
      x: spine(y) + off,
      y,
      r: big < 0.86 ? 1.4 + rnd() * 2.6 : big < 0.97 ? 4 + rnd() * 3 : 7 + rnd() * 4,
      c,
    });
  }
  // Waterholes — concentric rings of dots where the river pools.
  const holes = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < holes; k++) {
    const hy = (0.18 + 0.64 * rnd()) * h,
      hx = spine(hy);
    const base = 16 + rnd() * 14;
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
          c: [ROYAL, ACTION, MID, LIGHT][ring % 4],
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
    p2 = rnd() * 6.28;
  const spine = (x: number) =>
    h / 2 + h * 0.22 * Math.sin(x * 0.004 + p1) + h * 0.1 * Math.sin(x * 0.011 + p2);
  const n = Math.floor(w * 1.5);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w,
      off = gauss(rnd) * h * 0.3;
    const depth = Math.max(0, 1 - Math.abs(off) / (h * 0.42));
    const j = rnd();
    const c =
      depth > 0.7
        ? j < 0.5
          ? INK
          : ROYAL
        : depth > 0.4
          ? j < 0.5
            ? ROYAL
            : j < 0.8
              ? ACTION
              : MID
          : depth > 0.15
            ? j < 0.5
              ? ACTION
              : j < 0.75
                ? MID
                : LIGHT
            : j < 0.7
              ? LIGHT
              : WHITE;
    const big = rnd();
    out.push({ x, y: spine(x) + off, r: big < 0.88 ? 1.3 + rnd() * 2.4 : 3.6 + rnd() * 3, c });
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
