// ============================================================
// Bearer Token Auth Middleware
// ============================================================

import type { Context, Next } from "hono";
import { getPlayerByToken } from "../db/queries.js";
import type { Player } from "../types/index.js";

// Extend Hono's context variables
declare module "hono" {
  interface ContextVariableMap {
    player: Player;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = header.slice(7);
  const player = await getPlayerByToken(token);
  if (!player) {
    return c.json({ error: "Invalid token" }, 401);
  }

  c.set("player", player);
  await next();
}
