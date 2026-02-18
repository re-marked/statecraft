// ============================================================
// Admin Key Middleware
// ============================================================

import type { Context, Next } from "hono";

export async function adminMiddleware(c: Context, next: Next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return c.json({ error: "Admin access not configured" }, 503);
  }

  const provided = c.req.header("X-Admin-Key");
  if (provided !== adminKey) {
    return c.json({ error: "Invalid admin key" }, 403);
  }

  await next();
}
