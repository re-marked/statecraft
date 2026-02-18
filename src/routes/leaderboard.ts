// ============================================================
// Leaderboard Routes — GET /leaderboard
// ============================================================

import { Hono } from "hono";
import { getLeaderboard } from "../db/queries.js";

const leaderboard = new Hono();

leaderboard.get("/leaderboard", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);
  const players = await getLeaderboard(limit);

  return c.json({
    leaderboard: players.map((p, i) => ({
      rank: i + 1,
      agent_name: p.agentName,
      elo: p.elo,
      games_played: p.gamesPlayed,
      games_won: p.gamesWon,
      win_rate:
        p.gamesPlayed > 0
          ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
          : 0,
    })),
  });
});

export default leaderboard;
