/**
 * Per-page SEO for the SPA: sets the document title, meta description,
 * canonical URL and the og: tags when a page mounts. The defaults in
 * index.html stay untouched for the homepage.
 */
import { useEffect } from "react";

const SITE = "https://marshallscarpetcleaning.com.au";

export interface PageMetaRecord {
  title: string;
  description: string;
  canonical: string;
  jsonLd?: object;
}

let lastServerRecord: PageMetaRecord | null = null;

/** Build-time prerendering (scripts/prerender.mjs) renders each route with
 *  renderToString, where effects never run — so during a server render the
 *  hook stashes the page's meta here and the prerenderer bakes it into the
 *  static HTML head. Client behaviour is unchanged: the effect below still
 *  does the work in the browser. */
export function takeServerPageMeta(): PageMetaRecord | null {
  const record = lastServerRecord;
  lastServerRecord = null;
  return record;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${attr === "name" ? key : key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function usePageMeta(title: string, description: string, path: string, jsonLd?: object) {
  if (typeof document === "undefined") {
    lastServerRecord = { title, description, canonical: `${SITE}${path}`, jsonLd };
  }
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", `${SITE}${path}`);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE}${path}`;

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.pageSchema = "true";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      script?.remove();
    };
  }, [title, description, path, jsonLd]);
}
