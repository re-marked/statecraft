// ============================================================
// Map Routes — Province state for frontend rendering
// ============================================================

import { Hono } from "hono";
import { getActiveGame, getGameById } from "../db/games.js";
import { getCountries } from "../db/countries.js";
import { getProvinces } from "../db/provinces.js";

const map = new Hono();

// Get province state for the active game (frontend map rendering)
map.get("/map/state", async (c) => {
  const game = await getActiveGame();
  if (!game) return c.json({ error: "No active game" }, 404);

  const countries = await getCountries(game.id);
  const provinces = await getProvinces(game.id);

  // Build a lightweight province map for rendering
  const countryColors: Record<string, { display_name: string; flag_data: unknown }> = {};
  for (const cc of countries) {
    countryColors[cc.countryId] = {
      display_name: cc.displayName,
      flag_data: cc.flagData,
    };
  }

  return c.json({
    game_id: game.id,
    turn: game.turn,
    phase: game.turnPhase,
    countries: countryColors,
    provinces: provinces.map((p) => ({
      id: p.nuts2Id,
      owner: p.ownerId,
      troops: p.troopsStationed,
      gdp: p.gdpValue,
      terrain: p.terrain,
      capital: p.isCapital,
    })),
  });
});

// Get province state for a specific game
map.get("/map/state/:gameId", async (c) => {
  const gameId = c.req.param("gameId");
  const game = await getGameById(gameId);
  if (!game) return c.json({ error: "Game not found" }, 404);

  const countries = await getCountries(gameId);
  const provinces = await getProvinces(gameId);

  const countryColors: Record<string, { display_name: string; flag_data: unknown }> = {};
  for (const cc of countries) {
    countryColors[cc.countryId] = {
      display_name: cc.displayName,
      flag_data: cc.flagData,
    };
  }

  return c.json({
    game_id: gameId,
    turn: game.turn,
    phase: game.turnPhase,
    countries: countryColors,
    provinces: provinces.map((p) => ({
      id: p.nuts2Id,
      owner: p.ownerId,
      troops: p.troopsStationed,
      gdp: p.gdpValue,
      terrain: p.terrain,
      capital: p.isCapital,
    })),
  });
});

export default map;
