// ============================================================
// Admin Routes — Start/end/advance games, kick players
// ============================================================

import { Hono } from "hono";
import { createGame, getGameById, updateGame } from "../db/games.js";
import { getCountries, updateCountry } from "../db/countries.js";
import { getProvinces } from "../db/provinces.js";
import { bulkInsertAdjacency } from "../db/provinces.js";
import { adminMiddleware } from "../middleware/admin.js";
import { startGame, forceAdvanceTurn } from "../game/scheduler.js";
import adjacencyData from "../data/province-adjacency.json" with { type: "json" };

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

// Seed province adjacency data (run once)
admin.post("/seed-adjacency", async (c) => {
  const edges = (adjacencyData as [string, string][]).map(([a, b]) => ({
    nuts2_id_a: a,
    nuts2_id_b: b,
  }));

  await bulkInsertAdjacency(edges);

  return c.json({ message: "Adjacency seeded", edges: edges.length });
});

// Force-start a game
admin.post("/games/:id/start", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);
  if (game.phase !== "lobby") {
    return c.json({ error: "Game is not in lobby phase" }, 400);
  }

  const countries = await getCountries(gameId);
  if (countries.length < 1) {
    return c.json({ error: "Need at least 1 player to start" }, 400);
  }

  await startGame(gameId);
  return c.json({ message: "Game started", player_count: countries.length });
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
admin.post("/games/:id/kick/:countryId", async (c) => {
  const gameId = c.req.param("id");
  const countryId = c.req.param("countryId");

  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const countries = await getCountries(gameId);
  const country = countries.find((cc) => cc.countryId === countryId);
  if (!country) return c.json({ error: "Country not in game" }, 404);

  await updateCountry(country.id, { isEliminated: true });
  return c.json({ message: `${country.displayName} eliminated (kicked)` });
});

// Get game status summary
admin.get("/games/:id/status", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const countries = await getCountries(gameId);
  const provinces = await getProvinces(gameId);
  const alive = countries.filter((cc) => !cc.isEliminated);

  return c.json({
    game_id: game.id,
    phase: game.phase,
    turn: game.turn,
    turn_phase: game.turnPhase,
    total_countries: countries.length,
    alive_countries: alive.length,
    total_provinces: provinces.length,
    deadline: game.turnDeadlineAt,
  });
});

export default admin;
