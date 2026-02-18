// ============================================================
// STATECRAFT v2 — Core TypeScript Types
// ============================================================

// ---- Country & Game State ----

export interface Country {
  id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  resources: number;
  naval: number;
  stability: number;    // 0-10
  prestige: number;     // 0-100
  gdp: number;
  inflation: number;    // 0-100 percentage
  tech: number;         // 0-10
  unrest: number;       // 0-100
  spyTokens: number;    // regenerate each turn
  allies: string[];
  enemies: string[];
  sanctions: string[];  // country IDs sanctioning this one
  isEliminated: boolean;
  playerId: string | null;
}

export interface Alliance {
  id: string;
  countries: [string, string]; // country IDs
  formedOnTurn: number;
  strength: number;
  gameId: string;
  name: string | null;          // e.g. "Eastern Bloc"
  abbreviation: string | null;  // e.g. "EB" (max 5 chars)
}

export interface War {
  id: string;
  attacker: string;
  defender: string;
  startedOnTurn: number;
  gameId: string;
}

export interface Sanction {
  from: string;
  target: string;
  startedOnTurn: number;
}

export interface DiplomaticMessage {
  id: string;
  gameId: string;
  from: string;       // player ID
  fromCountry: string; // country ID
  to: string;         // player ID or "broadcast"
  toCountry: string;  // country ID or "broadcast"
  content: string;
  private: boolean;
  turn: number;
  phase: TurnPhase;
  createdAt: string;
}

export type GamePhase = "lobby" | "active" | "ended";
export type TurnPhase = "negotiation" | "declaration" | "resolution";

export interface Game {
  id: string;
  phase: GamePhase;
  turn: number;
  turnPhase: TurnPhase;
  maxTurns: number;
  minPlayers: number;
  turnDeadlineSeconds: number;
  turnDeadlineAt: string | null;
  worldTension: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
}

// ---- Player ----

export interface Player {
  id: string;
  agentName: string;
  token: string;
  elo: number;
  gamesPlayed: number;
  gamesWon: number;
  webhookUrl: string | null;
  createdAt: string;
}

export interface GamePlayer {
  id: string;
  gameId: string;
  playerId: string;
  countryId: string;
  territory: number;
  military: number;
  resources: number;
  naval: number;
  stability: number;
  prestige: number;
  gdp: number;
  inflation: number;
  tech: number;
  unrest: number;
  spyTokens: number;
  isEliminated: boolean;
  annexedBy: string | null;
  joinedAt: string;
}

// ---- Actions ----

export type ActionType =
  | "attack"
  | "defend"
  | "ally"
  | "trade"
  | "betray"
  | "invest_military"
  | "invest_stability"
  | "invest_tech"
  | "neutral"
  | "sanction"
  | "call_vote"
  | "spy_intel"
  | "spy_sabotage"
  | "spy_propaganda"
  | "naval_attack"
  | "naval_blockade"
  | "propose_ceasefire"
  | "propose_peace"
  // New political actions
  | "propaganda"
  | "embargo"
  | "coup_attempt"
  | "arms_deal"
  | "foreign_aid"
  | "mobilize"
  | "leave_alliance";

export const ALL_ACTIONS: ActionType[] = [
  "attack", "defend", "ally", "trade", "betray",
  "invest_military", "invest_stability", "invest_tech",
  "neutral", "sanction", "call_vote",
  "spy_intel", "spy_sabotage", "spy_propaganda",
  "naval_attack", "naval_blockade",
  "propose_ceasefire", "propose_peace",
  "propaganda", "embargo", "coup_attempt",
  "arms_deal", "foreign_aid", "mobilize", "leave_alliance",
];

// ---- Turn Submission ----

export interface TurnSubmission {
  id: string;
  gameId: string;
  playerId: string;
  turn: number;
  phase: TurnPhase;
  action: ActionType | null;       // null during negotiation
  target: string | null;           // country ID
  messages: NegotiationMessage[];  // used during negotiation phase
  reasoning: string | null;
  publicStatement: string | null;
  tradeAmount: number | null;
  voteResolution: string | null;
  createdAt: string;
}

export interface NegotiationMessage {
  to: string;        // country ID or "broadcast"
  content: string;
  private: boolean;
}

// ---- Agent Turn Input (what agents GET) ----

export interface CountryStateView {
  id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  resources: number;
  naval: number;
  stability: number;
  prestige: number;
  gdp: number;
  tech: number;
  isEliminated: boolean;
  playerId: string | null;
}

export interface AgentTurnInput {
  gameId: string;
  turn: number;
  totalTurns: number;
  phase: TurnPhase;
  deadline: string;
  worldTension: number;
  countries: CountryStateView[];
  alliances: { countries: [string, string]; strength: number; name: string | null; abbreviation: string | null }[];
  wars: { attacker: string; defender: string }[];
  myState: {
    countryId: string;
    countryName: string;
    territory: number;
    military: number;
    resources: number;
    naval: number;
    stability: number;
    prestige: number;
    gdp: number;
    inflation: number;
    tech: number;
    unrest: number;
    spyTokens: number;
    allies: string[];
    enemies: string[];
    activeSanctions: string[];
  };
  inboundMessages: {
    from: string;
    fromCountry: string;
    content: string;
    private: boolean;
  }[];
  recentEvents: string[];
}

// ---- Agent Response (what agents POST) ----

export interface NegotiationResponse {
  messages: NegotiationMessage[];
}

export interface DeclarationResponse {
  action: ActionType;
  target?: string;
  tradeAmount?: number;
  voteResolution?: string;
  allianceName?: string;         // name for the alliance (when action=ally)
  allianceAbbreviation?: string; // abbreviation (max 5 chars)
  reasoning: string;
  publicStatement: string;
}

// ---- Resolution ----

export type ResolutionType =
  | "combat"
  | "naval_combat"
  | "naval_blockade"
  | "alliance_formed"
  | "alliance_rejected"
  | "betrayal"
  | "trade_success"
  | "trade_failed"
  | "military_investment"
  | "stability_investment"
  | "tech_investment"
  | "sanction_applied"
  | "neutral"
  | "spy_intel"
  | "spy_sabotage"
  | "spy_propaganda"
  | "ceasefire"
  | "peace"
  | "ceasefire_rejected"
  | "peace_rejected"
  | "un_vote"
  | "world_news"
  | "coup"
  | "economy"
  | "propaganda"
  | "embargo"
  | "coup_attempt"
  | "coup_attempt_failed"
  | "arms_deal"
  | "arms_deal_failed"
  | "foreign_aid"
  | "mobilize"
  | "leave_alliance"
  | "world_event"
  | "starvation"
  | "rebellion"
  | "coalition_warning"
  | "annexation";

export interface Resolution {
  type: ResolutionType;
  countries: string[];
  description: string;
  stateChanges: StateChange[];
  emoji: string;
}

export interface StateChange {
  country: string;
  field: string;
  delta: number;
}

// ---- Game Events ----

export type GameEventType =
  | "game_start"
  | "game_end"
  | "turn_start"
  | "phase_change"
  | "negotiation_message"
  | "declarations_revealed"
  | "resolution"
  | "state_update"
  | "world_news"
  | "coup"
  | "annexation"
  | "player_joined"
  | "player_kicked";

export interface GameEvent {
  id?: string;
  gameId: string;
  type: GameEventType;
  turn: number;
  phase: TurnPhase;
  data: unknown;
  createdAt?: string;
}

// ---- Leaderboard / Results ----

export interface GameResult {
  id: string;
  gameId: string;
  playerId: string;
  countryId: string;
  placement: number;
  eloChange: number;
  finalTerritory: number;
  finalMilitary: number;
  finalGdp: number;
  createdAt: string;
}

// ---- World News ----

export interface WorldNewsEvent {
  id: string;
  title: string;
  description: string;
  effects: StateChange[];
  targetType: "random" | "weakest" | "strongest" | "all";
}

// ---- UN Vote ----

export interface UNVote {
  id: string;
  gameId: string;
  proposedBy: string;
  resolution: string;
  turn: number;
  votes: Record<string, "yes" | "no" | "abstain">;
  passed: boolean | null;
}
