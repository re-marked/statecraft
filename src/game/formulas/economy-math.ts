// ============================================================
// STATECRAFT v3 — Pure Economic Formulas
// Money (M) based economy with income/maintenance
// ============================================================

import { GAME_CONFIG } from "../config.js";

/**
 * Calculate income for a country (only if claim_income action was submitted).
 *
 * base = sum(province.gdp_value for owned provinces)
 * income = base * (1 + tech*0.05) * sanctions_penalty * embargo_penalty
 */
export function calculateIncome(
  totalGdp: number,
  tech: number,
  sanctionCount: number,
  embargoCount: number
): number {
  const techMultiplier = 1 + tech * 0.05;
  const sanctionPenalty = Math.max(0.3, 1 - sanctionCount * 0.1); // each sanction -10%, min 30%
  const embargoPenalty = Math.max(0.2, 1 - embargoCount * 0.15);  // each embargo -15%, min 20%

  return Math.floor(totalGdp * techMultiplier * sanctionPenalty * embargoPenalty);
}

/**
 * Calculate maintenance costs (automatic each turn).
 *
 * troop_cost = total_troops * 2M per K
 * tech_cost = tech_level * 10M
 */
export function calculateMaintenance(totalTroops: number, techLevel: number): number {
  const troopCost = totalTroops * GAME_CONFIG.troopMaintenancePer1K;
  const techCost = techLevel * GAME_CONFIG.techMaintenancePerLevel;
  return troopCost + techCost;
}

/**
 * Calculate troop recruiting cost.
 * 10M per 1K troops, cheaper with higher tech.
 */
export function calculateRecruitCost(troops: number, tech: number): number {
  const discount = 1 - tech * GAME_CONFIG.techRecruitDiscount;
  return Math.floor(troops * GAME_CONFIG.recruitCostPer1K * Math.max(0.5, discount));
}

/**
 * Calculate how many troops desert when the country can't pay maintenance.
 * Lose 10% of troops per turn when broke.
 */
export function calculateDesertions(totalTroops: number, money: number, maintenanceCost: number): number {
  if (money >= maintenanceCost) return 0;
  return Math.max(1, Math.floor(totalTroops * 0.1));
}

/**
 * Calculate GDP delta for a province based on events.
 * Provinces in war zones lose GDP, peaceful provinces grow slightly.
 */
export function calculateGdpGrowth(gdp: number, isWarZone: boolean, stability: number): number {
  if (isWarZone) {
    return -Math.max(1, Math.floor(gdp * 0.1)); // lose 10% GDP in war zones
  }
  if (stability >= 7) {
    return Math.max(1, Math.floor(gdp * 0.02)); // grow 2% if stable
  }
  return 0;
}

/**
 * Calculate trade value for mutual trades.
 * Both parties gain money proportional to the smaller amount offered.
 */
export function calculateTradeValue(amount1: number, amount2: number): number {
  return Math.min(amount1, amount2);
}
