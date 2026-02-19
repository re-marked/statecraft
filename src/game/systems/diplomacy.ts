// ============================================================
// STATECRAFT v3 — Diplomacy System
// Pact create/invite/kick/leave, betrayal
// ============================================================

import type { SubmittedAction, Resolution, Country, Pact, PactMember } from "../../types/index.js";

interface DiplomacyAction {
  countryId: string;
  displayName: string;
  action: SubmittedAction;
}

interface DiplomacyContext {
  actions: DiplomacyAction[];
  countryMap: Map<string, Country>;
  pactMap: Map<string, { pact: Pact; members: PactMember[] }>;
  turn: number;
}

export interface DiplomacyResults {
  resolutions: Resolution[];
  pactsToCreate: { name: string; abbreviation: string; color: string; founderCountryId: string }[];
  pactInvites: { pactId: string; countryId: string }[];
  pactKicks: { pactId: string; countryId: string }[];
  pactLeaves: { pactId: string; countryId: string }[];
  betrayals: { betrayerCountryId: string; targetCountryId: string }[];
}

export function processDiplomacy(ctx: DiplomacyContext): DiplomacyResults {
  const resolutions: Resolution[] = [];
  const pactsToCreate: DiplomacyResults["pactsToCreate"] = [];
  const pactInvites: DiplomacyResults["pactInvites"] = [];
  const pactKicks: DiplomacyResults["pactKicks"] = [];
  const pactLeaves: DiplomacyResults["pactLeaves"] = [];
  const betrayals: DiplomacyResults["betrayals"] = [];

  for (const { countryId, displayName, action } of ctx.actions) {
    switch (action.action) {
      case "create_pact": {
        if (!action.pactName || !action.pactAbbreviation) break;
        pactsToCreate.push({
          name: action.pactName,
          abbreviation: action.pactAbbreviation,
          color: action.pactColor ?? "#888888",
          founderCountryId: countryId,
        });
        resolutions.push({
          type: "pact_formed",
          countries: [countryId],
          description: `${displayName} founds the "${action.pactName}" (${action.pactAbbreviation})!`,
          stateChanges: [],
        });
        break;
      }

      case "invite_to_pact": {
        if (!action.target) break;
        // Find pact the inviter belongs to (use first active pact)
        const inviterPact = [...ctx.pactMap.values()].find(
          ({ members }) => members.some((m) => m.countryId === countryId && m.isActive)
        );
        if (inviterPact) {
          pactInvites.push({ pactId: inviterPact.pact.id, countryId: action.target });
          const targetName = ctx.countryMap.get(action.target)?.displayName ?? action.target;
          resolutions.push({
            type: "pact_invite",
            countries: [countryId, action.target],
            description: `${displayName} invites ${targetName} to join "${inviterPact.pact.name}"!`,
            stateChanges: [],
          });
        }
        break;
      }

      case "kick_from_pact": {
        if (!action.target) break;
        const kickerPact = [...ctx.pactMap.values()].find(
          ({ members }) => members.some((m) => m.countryId === countryId && m.isActive)
        );
        if (kickerPact) {
          pactKicks.push({ pactId: kickerPact.pact.id, countryId: action.target });
          const targetName = ctx.countryMap.get(action.target)?.displayName ?? action.target;
          resolutions.push({
            type: "pact_kick",
            countries: [countryId, action.target],
            description: `${displayName} kicks ${targetName} from "${kickerPact.pact.name}"!`,
            stateChanges: [],
          });
        }
        break;
      }

      case "leave_pact": {
        const leaverPact = [...ctx.pactMap.values()].find(
          ({ members }) => members.some((m) => m.countryId === countryId && m.isActive)
        );
        if (leaverPact) {
          pactLeaves.push({ pactId: leaverPact.pact.id, countryId });
          resolutions.push({
            type: "pact_leave",
            countries: [countryId],
            description: `${displayName} leaves "${leaverPact.pact.name}"!`,
            stateChanges: [{ country: countryId, field: "stability", delta: -1 }],
          });
        }
        break;
      }

      case "betray": {
        if (!action.target) break;
        betrayals.push({ betrayerCountryId: countryId, targetCountryId: action.target });
        const targetName = ctx.countryMap.get(action.target)?.displayName ?? action.target;
        resolutions.push({
          type: "betrayal",
          countries: [countryId, action.target],
          description: `BREAKING: ${displayName} has BETRAYED ${targetName}! All pacts shattered!`,
          stateChanges: [
            { country: countryId, field: "stability", delta: -2 },
          ],
        });
        break;
      }
    }
  }

  return { resolutions, pactsToCreate, pactInvites, pactKicks, pactLeaves, betrayals };
}
