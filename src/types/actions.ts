// ============================================================
// STATECRAFT v3 — Action Types & Validation
// ============================================================

export type ActionType =
  // Combat
  | "attack"
  | "defend"
  | "propose_ceasefire"
  | "propose_peace"
  // Ultimatums
  | "send_ultimatum"
  // Pacts
  | "create_pact"
  | "invite_to_pact"
  | "kick_from_pact"
  | "leave_pact"
  // Unions
  | "propose_union"
  | "betray"
  // Economy
  | "claim_income"
  | "trade"
  | "invest_military"
  | "invest_tech"
  | "invest_stability"
  // Diplomacy/Political
  | "sanction"
  | "embargo"
  | "arms_deal"
  | "foreign_aid"
  | "mobilize"
  | "propaganda"
  // Espionage
  | "spy_intel"
  | "spy_sabotage"
  | "spy_propaganda"
  | "coup_attempt"
  // Customization
  | "change_name"
  | "change_flag"
  // Passive
  | "neutral";

export const ALL_ACTIONS: ActionType[] = [
  "attack", "defend", "propose_ceasefire", "propose_peace",
  "send_ultimatum",
  "create_pact", "invite_to_pact", "kick_from_pact", "leave_pact",
  "propose_union", "betray",
  "claim_income", "trade", "invest_military", "invest_tech", "invest_stability",
  "sanction", "embargo", "arms_deal", "foreign_aid", "mobilize", "propaganda",
  "spy_intel", "spy_sabotage", "spy_propaganda", "coup_attempt",
  "change_name", "change_flag",
  "neutral",
];

// Actions that require a target country
export const TARGET_REQUIRED: ActionType[] = [
  "attack", "send_ultimatum",
  "invite_to_pact", "kick_from_pact",
  "propose_union", "betray",
  "trade", "sanction", "embargo", "arms_deal", "foreign_aid",
  "spy_intel", "spy_sabotage", "spy_propaganda", "coup_attempt",
  "propose_ceasefire", "propose_peace",
  "propaganda",
];

// Actions that cost spy tokens
export const SPY_ACTIONS: ActionType[] = [
  "spy_intel", "spy_sabotage", "spy_propaganda",
];

// Max actions per turn
export const MAX_ACTIONS_PER_TURN = 5;

export function isValidAction(action: string): action is ActionType {
  return ALL_ACTIONS.includes(action as ActionType);
}
