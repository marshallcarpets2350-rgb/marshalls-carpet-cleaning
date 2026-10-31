import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// Gallery photos live in the database (host filesystems are ephemeral).
app.get("/gallery/:file", async (c) => {
  const { getGalleryImage } = await import("./gallery");
  const img = await getGalleryImage(c.req.param("file"));
  if (!img) return c.notFound();
  c.header("Cache-Control", "public, max-age=86400");
  return c.body(new Uint8Array(img.buf), 200, { "Content-Type": img.contentType });
});

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  const { schedulePriceWatch } = await import("./priceWatch");
  const { scheduleFollowUps } = await import("./followUps");
  const { scheduleLifecycle } = await import("./lifecycle");
  serveStaticFiles(app);
  schedulePriceWatch();
  scheduleFollowUps();
  scheduleLifecycle();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
