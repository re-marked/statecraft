// ============================================================
// Game Routes — GET /games/current, POST /games/:id/join, GET /games/:id/countries
// ============================================================

import { Hono } from "hono";
import {
  getActiveGame,
  getGameById,
  getGamePlayers,
  getGamePlayer,
  joinGame,
  getAlliances,
  getWars,
} from "../db/queries.js";
import { COUNTRIES, COUNTRY_MAP } from "../game/config.js";
import { authMiddleware } from "../middleware/auth.js";

const game = new Hono();

// Get current active game
game.get("/games/current", async (c) => {
  const active = await getActiveGame();
  if (!active) {
    return c.json({ error: "No active game", game: null });
  }

  const players = await getGamePlayers(active.id);
  const alliances = await getAlliances(active.id);
  const wars = await getWars(active.id);

  return c.json({
    game: {
      id: active.id,
      phase: active.phase,
      turn: active.turn,
      turn_phase: active.turnPhase,
      max_turns: active.maxTurns,
      world_tension: active.worldTension,
      turn_deadline_at: active.turnDeadlineAt,
      player_count: players.length,
      min_players: active.minPlayers,
      created_at: active.createdAt,
      started_at: active.startedAt,
    },
    countries: players.map((gp) => {
      const cfg = COUNTRY_MAP.get(gp.countryId);
      return {
        country_id: gp.countryId,
        name: cfg?.name ?? gp.countryId,
        flag: cfg?.flag ?? "??",
        player_id: gp.playerId,
        territory: gp.territory,
        military: gp.military,
        resources: gp.resources,
        naval: gp.naval,
        stability: gp.stability,
        prestige: gp.prestige,
        gdp: gp.gdp,
        tech: gp.tech,
        is_eliminated: gp.isEliminated,
        annexed_by: gp.annexedBy ?? null,
      };
    }),
    alliances: alliances.map((a) => ({
      countries: [a.countryA, a.countryB],
      strength: a.strength,
    })),
    wars: wars.map((w) => ({
      attacker: w.attacker,
      defender: w.defender,
    })),
  });
});

// Get available countries for a game
game.get("/games/:id/countries", async (c) => {
  const gameId = c.req.param("id");
  const g = await getGameById(gameId);
  if (!g) return c.json({ error: "Game not found" }, 404);

  const players = await getGamePlayers(gameId);
  const taken = new Set(players.map((p) => p.countryId));

  return c.json({
    countries: COUNTRIES.map((country) => ({
      id: country.id,
      name: country.name,
      flag: country.flag,
      territory: country.territory,
      military: country.military,
      resources: country.resources,
      naval: country.naval,
      gdp: country.gdp,
      stability: country.stability,
      taken: taken.has(country.id),
    })),
  });
});

// Join a game with a country
game.post("/games/:id/join", authMiddleware, async (c) => {
  const player = c.get("player");
  const gameId = c.req.param("id");
  const body = (await c.req.json()) as { country_id?: string };

  if (!body.country_id) {
    return c.json({ error: "country_id is required" }, 400);
  }

  const g = await getGameById(gameId);
  if (!g) return c.json({ error: "Game not found" }, 404);
  if (g.phase !== "lobby") {
    return c.json({ error: "Game is not in lobby phase" }, 400);
  }

  const country = COUNTRY_MAP.get(body.country_id);
  if (!country) {
    return c.json({ error: "Invalid country_id" }, 400);
  }

  // Check if player already in this game
  const existing = await getGamePlayer(gameId, player.id);
  if (existing) {
    return c.json({
      error: "You are already in this game",
      country_id: existing.countryId,
    }, 400);
  }

  // Check if country is taken
  const players = await getGamePlayers(gameId);
  const taken = players.find((p) => p.countryId === body.country_id);
  if (taken) {
    return c.json({ error: "Country already taken" }, 400);
  }

  const gp = await joinGame(gameId, player.id, country.id, {
    territory: country.territory,
    military: country.military,
    resources: country.resources,
    naval: country.naval,
    gdp: country.gdp,
    stability: country.stability,
  });

  return c.json({
    message: `Joined as ${country.name}`,
    country_id: gp.countryId,
    game_id: gameId,
  });
});

export default game;
