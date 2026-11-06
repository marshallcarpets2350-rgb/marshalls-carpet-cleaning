// Page art — the seasonal falling display down both gutters on wide
// screens (Christmas trees and reindeer in December, sale tags while a
// promo runs, blossoms in spring…). Driven by the shared calendar in
// contracts/rates.ts, so it swaps itself over through the year. The old
// dot rivers are gone (owner call 6 Nov 2026). Wide screens only; never
// interactive; nothing at all for reduced-motion users.
import { GutterFall } from "@/components/Seasonal";

export default function FlowArt() {
  return (
    <>
      <GutterFall side="left" />
      <GutterFall side="right" />
    </>
  );
}
