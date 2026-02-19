// ============================================================
// STATECRAFT v3 — Espionage System
// Spy intel/sabotage/propaganda/coup
// ============================================================

import type { Country, Resolution, SubmittedAction } from "../../types/index.js";

interface SpyAction {
  countryId: string;
  displayName: string;
  tech: number;
  spyTokens: number;
  action: SubmittedAction;
}

export function processEspionage(
  actions: SpyAction[],
  countryMap: Map<string, Country>
): Resolution[] {
  const resolutions: Resolution[] = [];

  for (const spy of actions) {
    if (!spy.action.target) continue;
    const target = countryMap.get(spy.action.target);
    if (!target || spy.spyTokens <= 0) continue;

    const successRate = 0.5 + spy.tech * 0.05;
    const success = Math.random() < successRate;
    const targetName = target.displayName;

    switch (spy.action.action) {
      case "spy_intel": {
        resolutions.push({
          type: "spy_intel",
          countries: [spy.countryId, spy.action.target],
          description: `${spy.displayName} gathers intelligence on ${targetName}.`,
          stateChanges: [{ country: spy.countryId, field: "spyTokens", delta: -1 }],
        });
        break;
      }

      case "spy_sabotage": {
        if (success) {
          resolutions.push({
            type: "spy_sabotage",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName} sabotages ${targetName}'s infrastructure! -20M.`,
            stateChanges: [
              { country: spy.countryId, field: "spyTokens", delta: -1 },
              { country: spy.action.target, field: "money", delta: -20 },
            ],
          });
        } else {
          resolutions.push({
            type: "spy_sabotage",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName}'s sabotage operation in ${targetName} fails!`,
            stateChanges: [{ country: spy.countryId, field: "spyTokens", delta: -1 }],
          });
        }
        break;
      }

      case "spy_propaganda": {
        if (success) {
          resolutions.push({
            type: "spy_propaganda",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName} spreads propaganda in ${targetName}! -1 stability.`,
            stateChanges: [
              { country: spy.countryId, field: "spyTokens", delta: -1 },
              { country: spy.action.target, field: "stability", delta: -1 },
            ],
          });
        } else {
          resolutions.push({
            type: "spy_propaganda",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName}'s propaganda campaign in ${targetName} fails!`,
            stateChanges: [{ country: spy.countryId, field: "spyTokens", delta: -1 }],
          });
        }
        break;
      }

      case "coup_attempt": {
        if (spy.spyTokens < 2) break;
        const coupSuccess = Math.random() < (0.3 + spy.tech * 0.05);
        if (coupSuccess) {
          resolutions.push({
            type: "coup_attempt",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName}'s coup in ${targetName} SUCCEEDS! Government overthrown!`,
            stateChanges: [
              { country: spy.countryId, field: "spyTokens", delta: -2 },
              { country: spy.action.target, field: "stability", delta: -5 },
            ],
          });
        } else {
          resolutions.push({
            type: "coup_failed",
            countries: [spy.countryId, spy.action.target],
            description: `${spy.displayName}'s coup attempt in ${targetName} FAILS! Agents captured.`,
            stateChanges: [
              { country: spy.countryId, field: "spyTokens", delta: -2 },
              { country: spy.action.target, field: "stability", delta: 1 },
            ],
          });
        }
        break;
      }
    }
  }

  return resolutions;
}
