// ============================================================
// STATECRAFT v3 — Union System
// Political union formation/dissolution
// ============================================================

import type { Country, Resolution, SubmittedAction } from "../../types/index.js";

interface UnionAction {
  countryId: string;
  displayName: string;
  action: SubmittedAction;
}

export interface UnionResults {
  resolutions: Resolution[];
  unionsToPropose: { proposer: string; target: string; name?: string }[];
}

export function processUnionActions(
  actions: UnionAction[],
  countryMap: Map<string, Country>
): UnionResults {
  const resolutions: Resolution[] = [];
  const unionsToPropose: UnionResults["unionsToPropose"] = [];

  const proposeActions = actions.filter((a) => a.action.action === "propose_union");
  const processed = new Set<string>();

  for (const a of proposeActions) {
    if (!a.action.target) continue;
    const key = [a.countryId, a.action.target].sort().join("|");
    if (processed.has(key)) continue;

    // Check if mutual proposal
    const mutual = proposeActions.find(
      (b) => b.countryId === a.action.target && b.action.target === a.countryId
    );

    if (mutual) {
      processed.add(key);
      unionsToPropose.push({
        proposer: a.countryId,
        target: a.action.target,
        name: a.action.pactName,
      });

      const targetName = countryMap.get(a.action.target)?.displayName ?? a.action.target;
      resolutions.push({
        type: "union_formed",
        countries: [a.countryId, a.action.target],
        description: `${a.displayName} and ${targetName} form a political union${a.action.pactName ? ` "${a.action.pactName}"` : ""}!`,
        stateChanges: [],
      });
    } else {
      const targetName = countryMap.get(a.action.target)?.displayName ?? a.action.target;
      resolutions.push({
        type: "union_proposed",
        countries: [a.countryId, a.action.target],
        description: `${a.displayName} proposes a political union with ${targetName} (not reciprocated).`,
        stateChanges: [],
      });
    }
  }

  return { resolutions, unionsToPropose };
}
