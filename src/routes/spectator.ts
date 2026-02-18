// ============================================================
// Spectator Routes — GET /games/:id/feed, GET /games/:id/diplomacy
// ============================================================

import { Hono } from "hono";
import {
  getGameById,
  getGamePlayers,
  getGameEvents,
  getAlliances,
  getWars,
  getAllDiplomaticMessages,
} from "../db/queries.js";
import { COUNTRY_MAP } from "../game/config.js";

const spectator = new Hono();

// Full game event feed
spectator.get("/games/:id/feed", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const turn = c.req.query("turn")
    ? parseInt(c.req.query("turn")!)
    : undefined;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100"), 500);

  const events = await getGameEvents(gameId, { turn, limit });

  return c.json({ events });
});

// Diplomacy overview (alliances, wars, country states)
spectator.get("/games/:id/diplomacy", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const players = await getGamePlayers(gameId);
  const alliances = await getAlliances(gameId);
  const wars = await getWars(gameId);

  // Build annexation map from game_events (no DB column needed)
  const annexEvents = await getGameEvents(gameId, { type: 'annexation', limit: 200 });
  const annexedBy = new Map<string, string>();
  for (const ev of annexEvents) {
    const [annexed, conqueror] = ev.data?.countries ?? [];
    if (annexed && conqueror) annexedBy.set(annexed, conqueror);
  }

  return c.json({
    turn: game.turn,
    phase: game.turnPhase,
    world_tension: game.worldTension,
    countries: players.map((gp) => {
      const cfg = COUNTRY_MAP.get(gp.countryId);
      return {
        id: gp.countryId,
        name: cfg?.name ?? gp.countryId,
        flag: cfg?.flag ?? "??",
        territory: gp.territory,
        military: gp.military,
        resources: gp.resources,
        naval: gp.naval,
        stability: gp.stability,
        prestige: gp.prestige,
        gdp: gp.gdp,
        tech: gp.tech,
        unrest: gp.unrest,
        is_eliminated: gp.isEliminated,
        annexed_by: gp.annexedBy ?? null,
      };
    }),
    alliances: alliances.map((a) => ({
      countries: [a.countryA, a.countryB],
      strength: a.strength,
      formed_on_turn: a.formedOnTurn,
    })),
    wars: wars.map((w) => ({
      attacker: w.attacker,
      defender: w.defender,
      started_on_turn: w.startedOnTurn,
    })),
  });
});

// Public config for browser clients (safe to expose)
spectator.get("/config", async (c) => {
  return c.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

// All diplomatic messages — human spectator view (includes private)
spectator.get("/games/:id/messages", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") ?? "200"), 500);
  const messages = await getAllDiplomaticMessages(gameId, limit);

  // Attach country config for display
  const { COUNTRY_MAP } = await import("../game/config.js");
  return c.json({
    messages: messages.map((m) => {
      const fromCfg = COUNTRY_MAP.get(m.fromCountryId);
      const toCfg = m.toCountryId === "broadcast" ? null : COUNTRY_MAP.get(m.toCountryId);
      return {
        turn: m.turn,
        from_country: m.fromCountryId,
        from_name: fromCfg?.name ?? m.fromCountryId,
        from_flag: fromCfg?.flag ?? "??",
        to_country: m.toCountryId,
        to_name: m.toCountryId === "broadcast" ? "All" : (toCfg?.name ?? m.toCountryId),
        to_flag: m.toCountryId === "broadcast" ? "📢" : (toCfg?.flag ?? "??"),
        content: m.content,
        private: m.isPrivate,
        createdAt: m.createdAt,
      };
    }),
  });
});

export default spectator;
