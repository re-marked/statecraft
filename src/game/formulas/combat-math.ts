// ============================================================
// STATECRAFT v3 — Pure Combat Calculations
// Province-based frontline combat with capital annexation
// ============================================================

import { GAME_CONFIG } from "../config.js";
import type { TerrainType } from "../../types/index.js";

export interface CombatInput {
  attackerTroops: number;      // troops allocated to this attack
  attackerTech: number;
  defenderTroops: number;      // troops stationed in the target province
  defenderTech: number;
  terrain: TerrainType;
  isDefending: boolean;        // defender chose "defend" action
}

export interface CombatResult {
  attackerWins: boolean;
  attackerLosses: number;      // troops lost (in K)
  defenderLosses: number;      // troops lost (in K)
  attackerStrength: number;
  defenderStrength: number;
}

/**
 * Calculate combat outcome for a single province battle.
 *
 * attacker_strength = troops_allocated * (0.8 + rand*0.4) * (1 + tech*0.05)
 * defender_strength = troops_in_province * terrain_bonus * defense_bonus * (1 + tech*0.05)
 */
export function calculateCombat(input: CombatInput): CombatResult {
  const { attackerTroops, attackerTech, defenderTroops, defenderTech, terrain, isDefending } = input;

  const variance = 0.8 + Math.random() * GAME_CONFIG.combatVariance;
  const attackerTechMult = 1 + attackerTech * GAME_CONFIG.techCombatBonus;
  const defenderTechMult = 1 + defenderTech * GAME_CONFIG.techCombatBonus;

  const terrainBonus = GAME_CONFIG.terrainBonuses[terrain] ?? 1.0;
  const defenseBonus = isDefending ? GAME_CONFIG.defenderBonus : 1.0;

  const attackerStrength = attackerTroops * variance * attackerTechMult;
  const defenderStrength = defenderTroops * terrainBonus * defenseBonus * defenderTechMult;

  const attackerWins = attackerStrength > defenderStrength;

  // Losses scale with the strength ratio — closer fights = more losses
  const totalStrength = attackerStrength + defenderStrength;
  const ratio = Math.min(attackerStrength, defenderStrength) / Math.max(totalStrength, 1);

  let attackerLosses: number;
  let defenderLosses: number;

  if (attackerWins) {
    // Winner loses fewer troops, loser loses more
    attackerLosses = Math.max(1, Math.floor(attackerTroops * ratio * 0.3));
    defenderLosses = Math.max(1, Math.floor(defenderTroops * 0.6));
  } else {
    attackerLosses = Math.max(1, Math.floor(attackerTroops * 0.5));
    defenderLosses = Math.max(1, Math.floor(defenderTroops * ratio * 0.2));
  }

  // Cap losses at actual troops committed
  attackerLosses = Math.min(attackerLosses, attackerTroops);
  defenderLosses = Math.min(defenderLosses, defenderTroops);

  return {
    attackerWins,
    attackerLosses,
    defenderLosses,
    attackerStrength,
    defenderStrength,
  };
}

/**
 * Check if an attacker can attack a specific province.
 * The attacker must own at least one province adjacent to the target.
 * This enforces the frontline/blitzkrieg mechanic.
 */
export function canAttackProvince(
  targetNuts2Id: string,
  attackerOwnedProvinces: Set<string>,
  adjacencyMap: Map<string, string[]>
): boolean {
  const neighbors = adjacencyMap.get(targetNuts2Id) ?? [];
  return neighbors.some((n) => attackerOwnedProvinces.has(n));
}

/**
 * Check if capturing a province triggers annexation.
 * Annexation occurs when the capital province of a country is captured.
 */
export function checkAnnexation(
  capturedNuts2Id: string,
  defenderCapitalId: string
): boolean {
  return capturedNuts2Id === defenderCapitalId;
}
