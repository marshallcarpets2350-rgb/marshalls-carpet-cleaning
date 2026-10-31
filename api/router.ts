import { createRouter, publicQuery } from "./middleware";
import { publicRouter } from "./publicRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  public: publicRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
