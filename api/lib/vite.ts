import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

const SITE = "https://marshallscarpetcleaning.com.au";

/** Real content routes. The raw index.html carries a homepage canonical, so
 *  for these paths the server rewrites it to be self-referential before
 *  responding — otherwise non-rendering crawlers (and Google's first pass)
 *  see every page as a homepage duplicate and drop them from the index
 *  ("Alternative page with proper canonical tag" in Search Console, 9 Nov
 *  2026). Unknown/junk paths keep the homepage canonical, which safely
 *  consolidates them. Keep in sync with the Route list in src/App.tsx. */
const CANONICAL_PATHS = new Set([
  "/",
  "/quote",
  "/flood",
  "/rugs",
  "/lounge",
  "/services",
  "/work",
  "/reviews",
  "/areas",
  "/carpet-cleaning-uralla",
  "/carpet-cleaning-guyra",
  "/carpet-cleaning-walcha",
  "/end-of-lease-carpet-cleaning-armidale",
  "/pet-urine-carpet-cleaning-armidale",
  "/commercial-carpet-cleaning-armidale",
  "/faq",
  "/contact",
  "/terms",
  "/thanks",
]);

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    let content = fs.readFileSync(indexPath, "utf-8");
    const routePath = new URL(c.req.url).pathname.replace(/\/+$/, "") || "/";
    if (CANONICAL_PATHS.has(routePath)) {
      content = content.replace(
        /<link rel="canonical" href="[^"]*" ?\/>/,
        `<link rel="canonical" href="${SITE}${routePath}" />`,
      );
    }
    return c.html(content);
  });
}
