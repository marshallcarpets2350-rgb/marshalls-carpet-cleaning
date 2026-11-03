// Decorative flowing line art running top-to-bottom in the page gutters —
// fills the blank margins on wide screens so long pages don't feel empty.
// Purely ornamental: fixed to the viewport edges, never interactive, hidden
// below xl where the gutters disappear.

/** Winding vertical path: two layered sines give an organic, hand-drawn flow. */
function flowPath(phase: number, amp: number, drift: number): string {
  const W = 72;
  const H = 1000;
  const step = 16;
  let d = "";
  for (let y = -step; y <= H + step; y += step) {
    const x =
      W / 2 +
      drift +
      amp * Math.sin(y / 150 + phase) +
      amp * 0.45 * Math.sin(y / 61 + phase * 1.7);
    d += d === "" ? `M ${x.toFixed(1)} ${y}` : ` L ${x.toFixed(1)} ${y}`;
  }
  return d;
}

/** Dots scattered along a stream, like bubbles in the flow. */
function flowDots(phase: number, amp: number, drift: number): { cx: number; cy: number; r: number }[] {
  const W = 72;
  const dots: { cx: number; cy: number; r: number }[] = [];
  for (let y = 60; y < 960; y += 130) {
    const x =
      W / 2 +
      drift +
      amp * Math.sin(y / 150 + phase) +
      amp * 0.45 * Math.sin(y / 61 + phase * 1.7);
    dots.push({ cx: x + 10 * Math.sin(y * 0.7), cy: y, r: 2.4 + ((y / 130) % 3) * 0.8 });
  }
  return dots;
}

function Stream({ side, phase }: { side: "left" | "right"; phase: number }) {
  const main = flowPath(phase, 20, 0);
  const echo = flowPath(phase + 1.3, 15, 6);
  const thread = flowPath(phase + 2.6, 23, -5);
  const dots = flowDots(phase, 20, 0);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 72 1000"
      preserveAspectRatio="none"
      className="pointer-events-none fixed inset-y-0 hidden h-dvh w-[72px] xl:block"
      style={side === "left" ? { left: 0 } : { right: 0 }}
    >
      <path
        d={main}
        fill="none"
        stroke="#1E66B8"
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.22}
      />
      <path
        d={echo}
        fill="none"
        stroke="#1A6FD1"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.16}
      />
      <path
        d={thread}
        fill="none"
        stroke="#1F2421"
        strokeWidth={1.5}
        strokeDasharray="1 14"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.14}
      />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#1A6FD1" opacity={0.18} />
      ))}
    </svg>
  );
}

export default function FlowArt() {
  return (
    <>
      <Stream side="left" phase={0} />
      <Stream side="right" phase={2.1} />
    </>
  );
}
