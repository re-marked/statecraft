// ============================================================
// STATECRAFT v3 — Ultimatum Resolution System
// Accepted demands execute, rejected → war declared
// ============================================================

import type { Ultimatum, Country, Resolution, UltimatumResponseEntry } from "../../types/index.js";

interface UltimatumContext {
  ultimatum: Ultimatum;
  response: UltimatumResponseEntry | null; // null = no response (expired)
  fromCountry: Country;
  toCountry: Country;
}

export function processUltimatums(
  contexts: UltimatumContext[]
): {
  resolutions: Resolution[];
  warsToCreate: { attacker: string; defender: string }[];
  provincesToTransfer: { nuts2Id: string; toCountryId: string }[];
  moneyTransfers: { from: string; to: string; amount: number }[];
} {
  const resolutions: Resolution[] = [];
  const warsToCreate: { attacker: string; defender: string }[] = [];
  const provincesToTransfer: { nuts2Id: string; toCountryId: string }[] = [];
  const moneyTransfers: { from: string; to: string; amount: number }[] = [];

  for (const ctx of contexts) {
    const { ultimatum, response, fromCountry, toCountry } = ctx;

    if (!response || response.response === "reject") {
      // Rejected or expired → war declared
      resolutions.push({
        type: "ultimatum_rejected",
        countries: [ultimatum.fromCountryId, ultimatum.toCountryId],
        description: `${toCountry.displayName} ${!response ? "ignored" : "rejected"} ${fromCountry.displayName}'s ultimatum! War is declared!`,
        stateChanges: [],
      });

      warsToCreate.push({
        attacker: ultimatum.fromCountryId,
        defender: ultimatum.toCountryId,
      });

      resolutions.push({
        type: "war_declared",
        countries: [ultimatum.fromCountryId, ultimatum.toCountryId],
        description: `${fromCountry.displayName} declares war on ${toCountry.displayName}!`,
        stateChanges: [],
      });
    } else {
      // Accepted — execute demands
      const demands = ultimatum.demands;

      if (demands.type === "cede_province" && demands.provinceIds) {
        for (const pid of demands.provinceIds) {
          provincesToTransfer.push({
            nuts2Id: pid,
            toCountryId: ultimatum.fromCountryId,
          });
        }
        resolutions.push({
          type: "ultimatum_accepted",
          countries: [ultimatum.fromCountryId, ultimatum.toCountryId],
          provinces: demands.provinceIds,
          description: `${toCountry.displayName} cedes ${demands.provinceIds.length} province(s) to ${fromCountry.displayName} under duress!`,
          stateChanges: [],
        });
      } else if (demands.type === "pay_money" && demands.amount) {
        moneyTransfers.push({
          from: ultimatum.toCountryId,
          to: ultimatum.fromCountryId,
          amount: demands.amount,
        });
        resolutions.push({
          type: "ultimatum_accepted",
          countries: [ultimatum.fromCountryId, ultimatum.toCountryId],
          description: `${toCountry.displayName} pays ${demands.amount}M to ${fromCountry.displayName} under duress!`,
          stateChanges: [
            { country: ultimatum.toCountryId, field: "money", delta: -demands.amount },
            { country: ultimatum.fromCountryId, field: "money", delta: demands.amount },
          ],
        });
      } else {
        resolutions.push({
          type: "ultimatum_accepted",
          countries: [ultimatum.fromCountryId, ultimatum.toCountryId],
          description: `${toCountry.displayName} accepts ${fromCountry.displayName}'s ultimatum demands.`,
          stateChanges: [],
        });
      }
    }
  }

  return { resolutions, warsToCreate, provincesToTransfer, moneyTransfers };
}
