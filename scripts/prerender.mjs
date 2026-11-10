/**
 * Build-time prerender. Runs after `vite build`: renders every public route
 * with react-dom/server and bakes the result — body markup plus the page's
 * own title, description, canonical, og tags and JSON-LD — into static
 * HTML files under dist/public/<route>/index.html. Crawlers and link
 * unfurlers then see a full page instead of the empty SPA shell, while
 * visitors still get the same interactive app (main.tsx mounts with
 * createRoot and re-renders over the static markup).
 *
 * The per-route head values come from the same usePageMeta() calls that
 * update the document in the browser (see takeServerPageMeta in
 * src/lib/usePageMeta.ts), so there is exactly one source of truth for
 * titles and descriptions.
 *
 * Keep ROUTES in sync with src/App.tsx and CANONICAL_PATHS in
 * api/lib/vite.ts. Deliberately skipped: /thanks (post-booking conversion
 * page), /admin, /unsubscribe, and /furnishings (redirect).
 *
 * Any template drift (a head tag the script can no longer find) fails the
 * build loudly — never ship a silent shell.
 */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.env.PRERENDER_ROOT
  ? path.resolve(process.env.PRERENDER_ROOT)
  : path.resolve(import.meta.dirname, "..");
const distPublic = path.join(root, "dist", "public");

const ROUTES = [
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
  "/carpet-cleaning-cost-armidale",
  "/commercial-carpet-cleaning-armidale",
  "/faq",
  "/contact",
  "/terms",
];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function mustReplace(html, pattern, replacement, label, route) {
  if (!pattern.test(html)) {
    throw new Error(`prerender: could not find ${label} in the template while building ${route}`);
  }
  return html.replace(pattern, replacement);
}

// 1. Bundle the app for server-side rendering. Images referenced by the
//    markup become content-hashed files with absolute /assets/ URLs, copied
//    into dist/public/assets/ next to vite's own bundles below.
// Stage the server bundle on local disk, not next to dist/: deleting and
// recreating a directory across consecutive builds can race on some
// filesystems and silently eat the freshly written bundle.
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), "mcc-prerender-"));
await build({
  entryPoints: [path.join(root, "src", "entry-prerender.tsx")],
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outdir,
  loader: { ".png": "file", ".jpg": "file" },
  // react-dom/server.node is CJS under the hood — give the ESM bundle a
  // require shim, same as the api/boot.ts build does.
  banner: { js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);" },
  publicPath: "/assets",
  alias: {
    "@": path.join(root, "src"),
    "@contracts": path.join(root, "contracts"),
    "@db": path.join(root, "db"),
    db: path.join(root, "db"),
  },
  // Local testing only: lets a scratch install stand in for a broken
  // node_modules. Empty in the Docker build.
  nodePaths: process.env.PRERENDER_NODE_PATH ? [process.env.PRERENDER_NODE_PATH] : [],
  logLevel: "warning",
});
// esbuild's file loader drops the hashed images at the staging root while
// the markup references publicPath ("/assets/...") — ship them to match.
fs.mkdirSync(path.join(distPublic, "assets"), { recursive: true });
for (const f of fs.readdirSync(outdir)) {
  if (/\.(png|jpg)$/.test(f)) {
    fs.copyFileSync(path.join(outdir, f), path.join(distPublic, "assets", f));
  }
}

const { renderApp, takeServerPageMeta } = await import(
  path.join(outdir, "entry-prerender.js")
);

const template = fs.readFileSync(path.join(distPublic, "index.html"), "utf-8");

for (const route of ROUTES) {
  const body = renderApp(route);
  if (body.length < 500) {
    throw new Error(`prerender: ${route} rendered only ${body.length} chars — refusing to ship an empty page`);
  }
  const meta = takeServerPageMeta();
  let html = template;
  if (meta) {
    html = mustReplace(html, /<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`, "title", route);
    html = mustReplace(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeAttr(meta.description)}" />`, "description", route);
    html = mustReplace(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${meta.canonical}" />`, "canonical", route);
    html = mustReplace(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeAttr(meta.title)}" />`, "og:title", route);
    html = mustReplace(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeAttr(meta.description)}" />`, "og:description", route);
    html = mustReplace(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${meta.canonical}" />`, "og:url", route);
    if (meta.jsonLd) {
      const json = JSON.stringify(meta.jsonLd).replace(/<\//g, "<\\/");
      html = html.replace(
        "</head>",
        `    <script type="application/ld+json" data-page-schema="true">${json}</script>\n  </head>`,
      );
    }
  } else if (route !== "/") {
    // Every route except the homepage sets its own meta via usePageMeta.
    // If it didn't, the page would ship with the homepage title — fail.
    throw new Error(`prerender: ${route} produced no page meta — is usePageMeta still being called?`);
  }
  // The route files are regenerated from the template every run, but route
  // "/" IS the template (dist/public/index.html) — the markers keep the
  // replacement idempotent so re-running the script never strands markup.
  html = mustReplace(
    html,
    /<div id="root"><!--prerender-->[\s\S]*?<!--\/prerender--><\/div>|<div id="root"><\/div>/,
    `<div id="root"><!--prerender-->${body}<!--/prerender--></div>`,
    "root div",
    route,
  );

  const outFile =
    route === "/"
      ? path.join(distPublic, "index.html")
      : path.join(distPublic, route.slice(1), "index.html");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
  console.log(`prerendered ${route} — ${body.length} chars of body markup${meta ? "" : " (homepage head kept)"}`);
}

fs.rmSync(outdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
console.log(`prerender: ${ROUTES.length} routes written`);
