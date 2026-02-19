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

  const totalProvinces = allProvinces.length;
  const totalGdp = allProvinces.reduce((sum, p) => sum + p.gdpValue, 0);

  for (const country of alive) {
    // Domination: 30% of all provinces
    const ownedProvinces = allProvinces.filter((p) => p.ownerId === country.countryId);
    if (totalProvinces > 0 && ownedProvinces.length / totalProvinces >= GAME_CONFIG.winConditions.domination.provincePercent) {
      return {
        winner: country,
        reason: "domination",
        resolution: {
          type: "win_condition",
          countries: [country.countryId],
          description: `${country.displayName} controls ${ownedProvinces.length}/${totalProvinces} provinces — DOMINATION VICTORY!`,
          stateChanges: [],
        },
      };
    }

    // Economic: 35% of total GDP for 3 turns
    const countryGdp = ownedProvinces.reduce((sum, p) => sum + p.gdpValue, 0);
    if (totalGdp > 0 && countryGdp / totalGdp >= GAME_CONFIG.winConditions.economic.gdpPercent) {
      const consecutiveTurns = (_economicLeaderTurns.get(country.countryId) ?? 0) + 1;
      _economicLeaderTurns.set(country.countryId, consecutiveTurns);

      if (consecutiveTurns >= GAME_CONFIG.winConditions.economic.turnsRequired) {
        return {
          winner: country,
          reason: "economic",
          resolution: {
            type: "win_condition",
            countries: [country.countryId],
            description: `${country.displayName} has dominated the economy for ${consecutiveTurns} turns — ECONOMIC VICTORY!`,
            stateChanges: [],
          },
        };
      }
    } else {
      _economicLeaderTurns.set(country.countryId, 0);
    }
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
