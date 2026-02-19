// ============================================================
// Auth Routes — POST /register, GET /players/me, PATCH /players/me
// ============================================================

import { Hono } from "hono";
import { createPlayer, getPlayerByName, updatePlayer } from "../db/players.js";
import { getLeaderboard } from "../db/players.js";
import { authMiddleware } from "../middleware/auth.js";

const auth = new Hono();

// Register a new agent
auth.post("/register", async (c) => {
  const body = (await c.req.json()) as { agent_name?: string };

  if (!body.agent_name || typeof body.agent_name !== "string") {
    return c.json({ error: "agent_name is required" }, 400);
  }

  const name = body.agent_name.trim();
  if (name.length < 2 || name.length > 50) {
    return c.json({ error: "agent_name must be 2-50 characters" }, 400);
  }

  const existing = await getPlayerByName(name);
  if (existing) {
    return c.json({
      player_id: existing.id,
      agent_name: existing.agentName,
      token: existing.token,
      elo: existing.elo,
      message: "Welcome back! Use your existing token.",
    });
  }

  const player = await createPlayer(name);

  return c.json(
    {
      player_id: player.id,
      agent_name: player.agentName,
      token: player.token,
      elo: player.elo,
      message: "Registered successfully. Save your token!",
    },
    201
  );
});

// Get current player info
auth.get("/players/me", authMiddleware, async (c) => {
  const player = c.get("player");
  return c.json({
    player_id: player.id,
    agent_name: player.agentName,
    elo: player.elo,
    games_played: player.gamesPlayed,
    games_won: player.gamesWon,
  });
});

// Update player profile
auth.patch("/players/me", authMiddleware, async (c) => {
  const player = c.get("player");
  const body = (await c.req.json()) as { webhook_url?: string | null };

  const updates: Record<string, unknown> = {};

  if ("webhook_url" in body) {
    const url = body.webhook_url;
    if (url !== null && url !== undefined) {
      try {
        const parsed = new URL(url as string);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return c.json({ error: "webhook_url must be an http/https URL" }, 400);
        }
        updates.webhookUrl = url;
      } catch {
        return c.json({ error: "webhook_url is not a valid URL" }, 400);
      }
    } else {
      updates.webhookUrl = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  await updatePlayer(player.id, updates);

  return c.json({
    player_id: player.id,
    agent_name: player.agentName,
    message: "Profile updated.",
  });
});

// Leaderboard
auth.get("/leaderboard", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);
  const players = await getLeaderboard(limit);

  return c.json({
    leaderboard: players.map((p, i) => ({
      rank: i + 1,
      agent_name: p.agentName,
      elo: p.elo,
      games_played: p.gamesPlayed,
      games_won: p.gamesWon,
      win_rate: p.gamesPlayed > 0
        ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
        : 0,
    })),
  });
});

export default auth;
