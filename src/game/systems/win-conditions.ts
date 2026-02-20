// ============================================================
// STATECRAFT v3 — Win Condition Check
// Domination (30% provinces), Economic (35% GDP), Last standing
// ============================================================

import type { Country, Province, Resolution } from "../../types/index.js";
import { GAME_CONFIG } from "../config.js";

export interface WinCheckResult {
  winner: Country | null;
  reason: "domination" | "economic" | "last_standing" | "max_turns" | null;
  resolution: Resolution | null;
}

export function checkWinConditions(
  countries: Country[],
  allProvinces: Province[],
  turn: number,
  maxTurns: number,
  _economicLeaderTurns: Map<string, number> // countryId → consecutive turns leading GDP
): WinCheckResult {
  const alive = countries.filter((c) => !c.isEliminated);

  // Last standing
  if (alive.length <= 1 && alive.length > 0) {
    return {
      winner: alive[0],
      reason: "last_standing",
      resolution: {
        type: "win_condition",
        countries: [alive[0].countryId],
        description: `${alive[0].displayName} is the last country standing! Victory!`,
        stateChanges: [],
      },
    };
  }

  if (alive.length === 0) {
    return { winner: null, reason: null, resolution: null };
  }

  const totalMapProvinces = GAME_CONFIG.totalMapProvinces; // all 372 NUTS2 provinces, not just in-game

  for (const country of alive) {
    // Domination: 30% of all map provinces (not just in-game)
    const ownedProvinces = allProvinces.filter((p) => p.ownerId === country.countryId);
    if (totalMapProvinces > 0 && ownedProvinces.length / totalMapProvinces >= GAME_CONFIG.winConditions.domination.provincePercent) {
      return {
        winner: country,
        reason: "domination",
        resolution: {
          type: "win_condition",
          countries: [country.countryId],
          description: `${country.displayName} controls ${ownedProvinces.length}/${totalMapProvinces} provinces — DOMINATION VICTORY!`,
          stateChanges: [],
        },
      };
    }

    // Economic victory removed — only domination and last standing remain
  }

  // Max turns
  if (turn >= maxTurns) {
    // Winner is the country with the most provinces
    const ranked = [...alive].sort((a, b) => {
      const aProvinces = allProvinces.filter((p) => p.ownerId === a.countryId).length;
      const bProvinces = allProvinces.filter((p) => p.ownerId === b.countryId).length;
      if (bProvinces !== aProvinces) return bProvinces - aProvinces;
      return b.money - a.money;
    });

    return {
      winner: ranked[0],
      reason: "max_turns",
      resolution: {
        type: "win_condition",
        countries: [ranked[0].countryId],
        description: `Game over! ${ranked[0].displayName} wins by highest score after ${maxTurns} turns!`,
        stateChanges: [],
      },
    };
  }

  return { winner: null, reason: null, resolution: null };
}
