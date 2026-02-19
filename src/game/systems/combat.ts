// ============================================================
// STATECRAFT v3 — Combat System
// Province-by-province battles with frontline adjacency check
// Capital capture → annexation
// ============================================================

import type { Province, Country, Resolution, SubmittedAction, TerrainType } from "../../types/index.js";
import { calculateCombat, canAttackProvince, checkAnnexation } from "../formulas/combat-math.js";

interface AttackAction {
  attackerCountryId: string;
  attackerDisplayName: string;
  attackerTech: number;
  targetProvinces: string[];
  troopAllocation: number;
  isDefending: boolean; // the defender chose "defend"
}

interface CombatContext {
  provinces: Map<string, Province>;           // nuts2Id → Province
  countryMap: Map<string, Country>;           // countryId → Country
  adjacencyMap: Map<string, string[]>;        // nuts2Id → adjacent nuts2Ids
  attackActions: AttackAction[];
  defendingCountries: Set<string>;            // countries that chose "defend"
}

export interface CombatResults {
  resolutions: Resolution[];
  provincesToFlip: { nuts2Id: string; newOwnerId: string; survivingTroops: number }[];
  troopLosses: Map<string, number>;           // countryId → total troops lost
  annexations: { annexedCountryId: string; conquerorCountryId: string }[];
}

export function processCombat(ctx: CombatContext): CombatResults {
  const resolutions: Resolution[] = [];
  const provincesToFlip: CombatResults["provincesToFlip"] = [];
  const troopLosses = new Map<string, number>();
  const annexations: CombatResults["annexations"] = [];

  // Track provinces already attacked this turn (first attacker wins ties)
  const attackedProvinces = new Set<string>();

  function addTroopLoss(countryId: string, loss: number) {
    troopLosses.set(countryId, (troopLosses.get(countryId) ?? 0) + loss);
  }

  for (const attack of ctx.attackActions) {
    const attackerOwned = new Set<string>();
    for (const [nuts2Id, prov] of ctx.provinces) {
      if (prov.ownerId === attack.attackerCountryId) {
        attackerOwned.add(nuts2Id);
      }
    }
    // Also include provinces already flipped this turn
    for (const flip of provincesToFlip) {
      if (flip.newOwnerId === attack.attackerCountryId) {
        attackerOwned.add(flip.nuts2Id);
      }
    }

    // Distribute allocated troops across target provinces
    const validTargets = attack.targetProvinces.filter((t) => {
      if (attackedProvinces.has(t)) return false;
      const prov = ctx.provinces.get(t);
      if (!prov || prov.ownerId === attack.attackerCountryId) return false;
      return canAttackProvince(t, attackerOwned, ctx.adjacencyMap);
    });

    if (validTargets.length === 0) continue;

    const troopsPerTarget = Math.floor(attack.troopAllocation / validTargets.length);
    if (troopsPerTarget <= 0) continue;

    for (const targetNuts2Id of validTargets) {
      attackedProvinces.add(targetNuts2Id);

      const province = ctx.provinces.get(targetNuts2Id)!;
      const defenderCountry = ctx.countryMap.get(province.ownerId);
      if (!defenderCountry) continue;

      const defenderName = defenderCountry.displayName;
      const isDefending = ctx.defendingCountries.has(province.ownerId);

      const result = calculateCombat({
        attackerTroops: troopsPerTarget,
        attackerTech: attack.attackerTech,
        defenderTroops: province.troopsStationed,
        defenderTech: defenderCountry.tech,
        terrain: province.terrain as TerrainType,
        isDefending,
      });

      addTroopLoss(attack.attackerCountryId, result.attackerLosses);
      addTroopLoss(province.ownerId, result.defenderLosses);

      if (result.attackerWins) {
        const survivingAttackers = troopsPerTarget - result.attackerLosses;

        provincesToFlip.push({
          nuts2Id: targetNuts2Id,
          newOwnerId: attack.attackerCountryId,
          survivingTroops: Math.max(1, survivingAttackers),
        });

        // Add to attacker's owned set for subsequent attacks
        attackerOwned.add(targetNuts2Id);

        resolutions.push({
          type: "province_captured",
          countries: [attack.attackerCountryId, province.ownerId],
          provinces: [targetNuts2Id],
          description: `${attack.attackerDisplayName} captures ${province.name} from ${defenderName}!`,
          stateChanges: [
            { country: attack.attackerCountryId, field: "totalTroops", delta: -result.attackerLosses },
            { country: province.ownerId, field: "totalTroops", delta: -result.defenderLosses },
          ],
        });

        // Check if this was the capital — triggers annexation
        if (checkAnnexation(targetNuts2Id, defenderCountry.capitalProvinceId)) {
          annexations.push({
            annexedCountryId: province.ownerId,
            conquerorCountryId: attack.attackerCountryId,
          });

          resolutions.push({
            type: "annexation",
            countries: [province.ownerId, attack.attackerCountryId],
            description: `${defenderName}'s capital has fallen! ${attack.attackerDisplayName} ANNEXES ${defenderName}! All territories are absorbed into the empire.`,
            stateChanges: [],
          });
        }
      } else {
        resolutions.push({
          type: "combat",
          countries: [attack.attackerCountryId, province.ownerId],
          provinces: [targetNuts2Id],
          description: `${attack.attackerDisplayName} attacks ${province.name} but ${defenderName} holds the line!`,
          stateChanges: [
            { country: attack.attackerCountryId, field: "totalTroops", delta: -result.attackerLosses },
            { country: province.ownerId, field: "totalTroops", delta: -result.defenderLosses },
          ],
        });
      }
    }
  }

  return { resolutions, provincesToFlip, troopLosses, annexations };
}
