// ============================================================
// STATECRAFT v3 — Political System
// Propaganda, foreign aid, arms deals, mobilize, neutral
// ============================================================

import type { Country, Resolution, SubmittedAction } from "../../types/index.js";

interface PoliticalAction {
  countryId: string;
  displayName: string;
  money: number;
  tech: number;
  totalTroops: number;
  action: SubmittedAction;
}

export interface PoliticalResults {
  resolutions: Resolution[];
  moneyChanges: Map<string, number>;
  troopChanges: Map<string, number>;
  stabilityChanges: Map<string, number>;
}

export function processPoliticalActions(
  actions: PoliticalAction[],
  countryMap: Map<string, Country>
): PoliticalResults {
  const resolutions: Resolution[] = [];
  const moneyChanges = new Map<string, number>();
  const troopChanges = new Map<string, number>();
  const stabilityChanges = new Map<string, number>();

  function addMoney(cid: string, d: number) { moneyChanges.set(cid, (moneyChanges.get(cid) ?? 0) + d); }
  function addTroops(cid: string, d: number) { troopChanges.set(cid, (troopChanges.get(cid) ?? 0) + d); }
  function addStability(cid: string, d: number) { stabilityChanges.set(cid, (stabilityChanges.get(cid) ?? 0) + d); }

  // Mutual arms deals
  const armsActions = actions.filter((a) => a.action.action === "arms_deal");
  const processedArms = new Set<string>();

  for (const a of armsActions) {
    if (!a.action.target) continue;
    const key = [a.countryId, a.action.target].sort().join("|");
    if (processedArms.has(key)) continue;

    const mutual = armsActions.find(
      (b) => b.countryId === a.action.target && b.action.target === a.countryId
    );

    if (mutual) {
      processedArms.add(key);
      addTroops(a.countryId, 3);
      addTroops(a.action.target, 3);
      addMoney(a.countryId, -15);
      addMoney(a.action.target, -15);

      const targetName = countryMap.get(a.action.target)?.displayName ?? a.action.target;
      resolutions.push({
        type: "arms_deal",
        countries: [a.countryId, a.action.target],
        description: `${a.displayName} and ${targetName} complete an arms deal (+3K troops each, -15M each).`,
        stateChanges: [
          { country: a.countryId, field: "totalTroops", delta: 3 },
          { country: a.action.target, field: "totalTroops", delta: 3 },
        ],
      });
    }
  }

  for (const pol of actions) {
    switch (pol.action.action) {
      case "foreign_aid": {
        if (!pol.action.target) break;
        const amount = pol.action.amount ?? 20;
        addMoney(pol.countryId, -amount);
        addMoney(pol.action.target, amount);
        addStability(pol.countryId, 1);

        const targetName = countryMap.get(pol.action.target)?.displayName ?? pol.action.target;
        resolutions.push({
          type: "foreign_aid",
          countries: [pol.countryId, pol.action.target],
          description: `${pol.displayName} sends ${amount}M in foreign aid to ${targetName} (+1 stability).`,
          stateChanges: [
            { country: pol.countryId, field: "money", delta: -amount },
            { country: pol.action.target, field: "money", delta: amount },
            { country: pol.countryId, field: "stability", delta: 1 },
          ],
        });
        break;
      }

      case "mobilize": {
        addTroops(pol.countryId, 5);
        addStability(pol.countryId, -2);
        resolutions.push({
          type: "mobilize",
          countries: [pol.countryId],
          description: `${pol.displayName} declares full mobilization! +5K troops, -2 stability.`,
          stateChanges: [
            { country: pol.countryId, field: "totalTroops", delta: 5 },
            { country: pol.countryId, field: "stability", delta: -2 },
          ],
        });
        break;
      }

      case "propaganda": {
        if (!pol.action.target) break;
        addMoney(pol.countryId, -10);
        addStability(pol.action.target, -1);
        const targetName = countryMap.get(pol.action.target)?.displayName ?? pol.action.target;
        resolutions.push({
          type: "propaganda",
          countries: [pol.countryId, pol.action.target],
          description: `${pol.displayName} launches propaganda campaign against ${targetName}! -1 stability.`,
          stateChanges: [
            { country: pol.countryId, field: "money", delta: -10 },
            { country: pol.action.target, field: "stability", delta: -1 },
          ],
        });
        break;
      }

      case "neutral": {
        addStability(pol.countryId, 1);
        resolutions.push({
          type: "neutral",
          countries: [pol.countryId],
          description: `${pol.displayName} remains neutral (+1 stability).`,
          stateChanges: [{ country: pol.countryId, field: "stability", delta: 1 }],
        });
        break;
      }
    }
  }

  return { resolutions, moneyChanges, troopChanges, stabilityChanges };
}
