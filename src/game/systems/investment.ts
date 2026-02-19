// ============================================================
// STATECRAFT v3 — Investment System
// invest_military, invest_tech, invest_stability
// ============================================================

import type { Country, Resolution, SubmittedAction } from "../../types/index.js";
import { calculateRecruitCost } from "../formulas/economy-math.js";
import { GAME_CONFIG } from "../config.js";

interface InvestAction {
  countryId: string;
  displayName: string;
  money: number;
  tech: number;
  action: SubmittedAction;
}

export interface InvestmentResults {
  resolutions: Resolution[];
  moneyChanges: Map<string, number>;
  troopChanges: Map<string, number>;
  techChanges: Map<string, number>;
  stabilityChanges: Map<string, number>;
}

export function processInvestments(actions: InvestAction[]): InvestmentResults {
  const resolutions: Resolution[] = [];
  const moneyChanges = new Map<string, number>();
  const troopChanges = new Map<string, number>();
  const techChanges = new Map<string, number>();
  const stabilityChanges = new Map<string, number>();

  function addMoney(cid: string, d: number) { moneyChanges.set(cid, (moneyChanges.get(cid) ?? 0) + d); }
  function addTroops(cid: string, d: number) { troopChanges.set(cid, (troopChanges.get(cid) ?? 0) + d); }
  function addTech(cid: string, d: number) { techChanges.set(cid, (techChanges.get(cid) ?? 0) + d); }
  function addStability(cid: string, d: number) { stabilityChanges.set(cid, (stabilityChanges.get(cid) ?? 0) + d); }

  for (const inv of actions) {
    const currentMoney = inv.money + (moneyChanges.get(inv.countryId) ?? 0);

    switch (inv.action.action) {
      case "invest_military": {
        const troopsToRecruit = inv.action.troopAllocation ?? 5;
        const cost = calculateRecruitCost(troopsToRecruit, inv.tech);
        if (currentMoney >= cost) {
          addMoney(inv.countryId, -cost);
          addTroops(inv.countryId, troopsToRecruit);
          resolutions.push({
            type: "invest_military",
            countries: [inv.countryId],
            description: `${inv.displayName} recruits ${troopsToRecruit}K troops for ${cost}M.`,
            stateChanges: [
              { country: inv.countryId, field: "money", delta: -cost },
              { country: inv.countryId, field: "totalTroops", delta: troopsToRecruit },
            ],
          });
        }
        break;
      }

      case "invest_tech": {
        const cost = GAME_CONFIG.investTechCost;
        if (currentMoney >= cost && inv.tech < 10) {
          addMoney(inv.countryId, -cost);
          addTech(inv.countryId, 1);
          resolutions.push({
            type: "invest_tech",
            countries: [inv.countryId],
            description: `${inv.displayName} invests in technology (+1 tech, -${cost}M).`,
            stateChanges: [
              { country: inv.countryId, field: "money", delta: -cost },
              { country: inv.countryId, field: "tech", delta: 1 },
            ],
          });
        }
        break;
      }

      case "invest_stability": {
        const cost = GAME_CONFIG.investStabilityCost;
        if (currentMoney >= cost && inv.money > 0) {
          addMoney(inv.countryId, -cost);
          addStability(inv.countryId, 1);
          resolutions.push({
            type: "invest_stability",
            countries: [inv.countryId],
            description: `${inv.displayName} invests in stability (+1 stability, -${cost}M).`,
            stateChanges: [
              { country: inv.countryId, field: "money", delta: -cost },
              { country: inv.countryId, field: "stability", delta: 1 },
            ],
          });
        }
        break;
      }
    }
  }

  return { resolutions, moneyChanges, troopChanges, techChanges, stabilityChanges };
}
