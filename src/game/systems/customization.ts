// ============================================================
// STATECRAFT v3 — Customization System
// Name and flag changes (cosmetic)
// ============================================================

import type { SubmittedAction, Resolution } from "../../types/index.js";

export function processCustomization(
  actions: { countryId: string; displayName: string; action: SubmittedAction }[]
): Resolution[] {
  const resolutions: Resolution[] = [];

  for (const { countryId, displayName, action } of actions) {
    if (action.action === "change_name" && action.newName) {
      resolutions.push({
        type: "change_name",
        countries: [countryId],
        description: `${displayName} has renamed itself to "${action.newName}"!`,
        stateChanges: [],
      });
    }

    if (action.action === "change_flag" && action.flagData) {
      resolutions.push({
        type: "change_flag",
        countries: [countryId],
        description: `${displayName} has adopted a new flag!`,
        stateChanges: [],
      });
    }
  }

  return resolutions;
}
