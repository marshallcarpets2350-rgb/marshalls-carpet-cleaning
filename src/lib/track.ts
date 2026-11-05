/** Push a conversion/analytics event into Google Tag Manager's dataLayer,
 *  and mirror it straight to GA4 via gtag (the Google tag is installed
 *  directly, so events flow without any GTM-side configuration).
 *  No-ops quietly when neither has loaded (ad-blockers, offline dev). */

// GA4's recommended name for a lead — shows up nicely in reports and is
// one click to mark as a key event for Google Ads import.
const GA4_NAME: Record<string, string> = { lead_submitted: "generate_lead" };

export function track(event: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...params });
  if (typeof w.gtag !== "function") return;
  const p: Record<string, unknown> = { ...params };
  if (typeof p.total === "number") p.value = p.total;
  if (event === "purchase" && p.reference) p.transaction_id = p.reference;
  w.gtag("event", GA4_NAME[event] ?? event, p);
}
