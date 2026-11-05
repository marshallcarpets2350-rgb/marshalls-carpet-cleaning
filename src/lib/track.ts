/** Push a conversion/analytics event into Google Tag Manager's dataLayer.
 *  No-ops quietly when GTM hasn't loaded (ad-blockers, offline dev). */
export function track(event: string, params: Record<string, unknown> = {}) {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...params });
}
