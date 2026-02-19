// ============================================================
// STATECRAFT v3 — Game Configuration
// Province-based NUTS2 system, 44 European countries
// ============================================================

import countryStarters from "../data/country-starters.json" with { type: "json" };

export const GAME_CONFIG = {
  maxTurns: 20,
  minPlayers: 6,
  turnDeadlineSeconds: 120,       // 2 minutes per phase
  graceDelaySeconds: 10,          // grace period after phase transition
  maxActionsPerTurn: 5,
  spyTokenRegenPerTurn: 1,
  maxSpyTokens: 5,
  autoWipeHours: 24,

  // Economy
  troopMaintenancePer1K: 2,       // 2M per 1K troops per turn
  techMaintenancePerLevel: 10,    // 10M per tech level per turn
  recruitCostPer1K: 10,           // 10M per 1K troops recruited
  investTechCost: 30,             // 30M to gain +1 tech
  investStabilityCost: 20,        // 20M to gain +1 stability
  techRecruitDiscount: 0.05,      // 5% discount per tech level

  // Combat
  terrainBonuses: {
    plains: 1.0,
    mountains: 1.5,
    urban: 1.3,
    coastal: 1.1,
  } as Record<string, number>,
  defenderBonus: 1.5,             // multiplier when "defend" action chosen
  combatVariance: 0.4,            // ±20% randomness (0.8 to 1.2)
  techCombatBonus: 0.05,          // 5% per tech level

  // Annexation — capital capture
  // You must capture provinces along a path to reach the capital.
  // Capturing the capital province annexes the entire country.

  // Win conditions
  winConditions: {
    domination: {
      provincePercent: 0.30,      // 30% of all provinces
    },
    economic: {
      gdpPercent: 0.35,           // 35% of total GDP
      turnsRequired: 3,           // hold for 3 consecutive turns
    },
  },
};

// ---- Country Starter Data ----

export interface CountryStarter {
  name: string;
  flag: string;
  money: number;
  troops: number;
  tech: number;
  stability: number;
  spyTokens: number;
  capitalProvinceId: string;
}

export const COUNTRY_STARTERS = countryStarters as Record<string, CountryStarter>;

export const COUNTRY_IDS = Object.keys(COUNTRY_STARTERS);

export function getCountryStarter(countryId: string): CountryStarter | undefined {
  return COUNTRY_STARTERS[countryId];
}

export function getCountryName(countryId: string): string {
  return COUNTRY_STARTERS[countryId]?.name ?? countryId;
}
