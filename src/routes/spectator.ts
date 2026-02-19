// ============================================================
// Spectator Routes — Public feeds, province data, diplomacy overview
// ============================================================

import { Hono } from "hono";
import { getGameById } from "../db/games.js";
import { getCountries } from "../db/countries.js";
import { getProvinces } from "../db/provinces.js";
import { getPacts, getPactMembers, getWars, getUnions, getUnionMembers } from "../db/diplomacy.js";
import { getGameEvents, getAllDiplomaticMessages } from "../db/events.js";
import { getCountryName } from "../game/config.js";

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

// Diplomacy overview (countries, pacts, wars, unions, provinces)
spectator.get("/games/:id/diplomacy", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const countries = await getCountries(gameId);
  const provinces = await getProvinces(gameId);
  const pacts = await getPacts(gameId);
  const wars = await getWars(gameId);
  const unions = await getUnions(gameId);

  const pactData = await Promise.all(
    pacts.map(async (p) => {
      const members = await getPactMembers(p.id);
      return {
        id: p.id,
        name: p.name,
        abbreviation: p.abbreviation,
        color: p.color,
        members: members.map((m) => m.countryId),
        founded_on_turn: p.foundedOnTurn,
      };
    })
  );

  const unionData = await Promise.all(
    unions.map(async (u) => {
      const members = await getUnionMembers(u.id);
      const leader = members.find((m) => m.isLeader);
      return {
        id: u.id,
        name: u.name,
        abbreviation: u.abbreviation,
        members: members.map((m) => m.countryId),
        leader: leader?.countryId ?? null,
      };
    })
  );

  return c.json({
    turn: game.turn,
    phase: game.turnPhase,
    world_tension: game.worldTension,
    countries: countries.map((cc) => {
      const owned = provinces.filter((p) => p.ownerId === cc.countryId);
      return {
        country_id: cc.countryId,
        display_name: cc.displayName,
        flag_data: cc.flagData,
        money: cc.money,
        total_troops: cc.totalTroops,
        tech: cc.tech,
        stability: cc.stability,
        province_count: owned.length,
        total_gdp: owned.reduce((sum, p) => sum + p.gdpValue, 0),
        is_eliminated: cc.isEliminated,
        annexed_by: cc.annexedBy ?? null,
        union_id: cc.unionId ?? null,
      };
    }),
    pacts: pactData,
    wars: wars.map((w) => ({
      attacker: w.attackerCountryId,
      defender: w.defenderCountryId,
      started_on_turn: w.startedOnTurn,
    })),
    unions: unionData,
  });
});

// Province state for a game
spectator.get("/games/:id/provinces", async (c) => {
  const gameId = c.req.param("id");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const provinces = await getProvinces(gameId);
  return c.json({
    provinces: provinces.map((p) => ({
      nuts2_id: p.nuts2Id,
      name: p.name,
      owner_id: p.ownerId,
      original_owner_id: p.originalOwnerId,
      gdp_value: p.gdpValue,
      terrain: p.terrain,
      troops_stationed: p.troopsStationed,
      is_capital: p.isCapital,
      population: p.population,
    })),
  });
});

// Public config for browser clients
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

  return c.json({
    messages: messages.map((m) => ({
      turn: m.turn,
      from_country: m.fromCountryId,
      from_name: getCountryName(m.fromCountryId),
      to_country: m.toCountryId,
      to_name: m.toCountryId === "broadcast" ? "All" : getCountryName(m.toCountryId),
      content: m.content,
      private: m.isPrivate,
      created_at: m.createdAt,
    })),
  });
});

export default spectator;
