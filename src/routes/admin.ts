// ============================================================
// Admin Routes — Start/end/advance games, kick players
// ============================================================

import { Hono } from "hono";
import {
  createGame,
  getActiveGame,
  getGameById,
  getGamePlayers,
  updateGame,
  updateGamePlayer,
} from "../db/queries.js";
import { adminMiddleware } from "../middleware/admin.js";
import { startGame, forceAdvanceTurn } from "../game/scheduler.js";

const admin = new Hono();
admin.use("/*", adminMiddleware);

// Create a new game lobby
admin.post("/games", async (c) => {
  const body = (await c.req.json()) as {
    max_turns?: number;
    min_players?: number;
    turn_deadline_seconds?: number;
  };

  const game = await createGame({
    maxTurns: body.max_turns,
    minPlayers: body.min_players,
    turnDeadlineSeconds: body.turn_deadline_seconds,
  });

  return c.json({ message: "Game created", game_id: game.id }, 201);
});

// Force-start a game (skip min_players requirement)
admin.post("/games/:id/start", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);
  if (game.phase !== "lobby") {
    return c.json({ error: "Game is not in lobby phase" }, 400);
  }

  const players = await getGamePlayers(gameId);
  if (players.length < 1) {
    return c.json({ error: "Need at least 1 player to start" }, 400);
  }

  await startGame(gameId);
  return c.json({ message: "Game started", player_count: players.length });
});

// Force-advance the current turn phase
admin.post("/games/:id/advance", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);
  if (game.phase !== "active") {
    return c.json({ error: "Game is not active" }, 400);
  }

  await forceAdvanceTurn(gameId);
  const updated = await getGameById(gameId);
  return c.json({
    message: "Turn advanced",
    turn: updated?.turn,
    phase: updated?.turnPhase,
  });
});

// End a game early
admin.post("/games/:id/end", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);
  if (game.phase === "ended") {
    return c.json({ error: "Game already ended" }, 400);
  }

  await updateGame(gameId, {
    phase: "ended",
    endedAt: new Date().toISOString(),
  });

  return c.json({ message: "Game ended" });
});

// Kick a player from a game
admin.post("/games/:id/kick/:playerId", async (c) => {
  const gameId = c.req.param("id");
  const playerId = c.req.param("playerId");

  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const players = await getGamePlayers(gameId);
  const gp = players.find((p) => p.playerId === playerId);
  if (!gp) return c.json({ error: "Player not in game" }, 404);

  await updateGamePlayer(gp.id, { isEliminated: true });
  return c.json({ message: `Player kicked (${gp.countryId} eliminated)` });
});

export default admin;
