/**
 * Build-time prerender entry — bundled by scripts/prerender.mjs and rendered
 * once per public route, so crawlers and link unfurlers get a full page of
 * real content instead of the empty SPA shell. Never imported by the client
 * bundle: main.tsx stays the only browser entry, and it still mounts with
 * createRoot and re-renders over the static markup (no hydration).
 */
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";
import { TRPCProvider } from "@/providers/trpc";
import App from "./App";

export function renderApp(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </StaticRouter>,
  );
}

export { takeServerPageMeta } from "./lib/usePageMeta";
