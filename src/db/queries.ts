// ============================================================
// STATECRAFT v2 — Database Query Functions
// ============================================================

import { getSupabase } from "./client.js";
import type {
  Player,
  Game,
  GamePlayer,
  TurnSubmission,
  GameEvent,
  NegotiationMessage,
  ActionType,
  TurnPhase,
} from "../types/index.js";
import { GAME_CONFIG } from "../game/config.js";

const db = () => getSupabase();

// ---- Helpers ----

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ---- Players ----

export async function createPlayer(agentName: string): Promise<Player> {
  const { data, error } = await db()
    .from("players")
    .insert({ agent_name: agentName })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Player;
}

export async function getPlayerByToken(token: string): Promise<Player | null> {
  const { data, error } = await db()
    .from("players")
    .select()
    .eq("token", token)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Player) : null;
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const { data, error } = await db()
    .from("players")
    .select()
    .eq("id", id)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Player) : null;
}

export async function getPlayerByName(agentName: string): Promise<Player | null> {
  const { data, error } = await db()
    .from("players")
    .select()
    .eq("agent_name", agentName)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Player) : null;
}

export async function updatePlayer(
  playerId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await db()
    .from("players")
    .update(camelToSnake(updates))
    .eq("id", playerId);
  if (error) throw error;
}

export async function updatePlayerStats(
  playerId: string,
  updates: { elo?: number; gamesPlayed?: number; gamesWon?: number }
): Promise<void> {
  await updatePlayer(playerId, updates as Record<string, unknown>);
}

// Returns webhook URLs for all non-eliminated players in a game
// NOTE: webhook_url column not yet in DB — agents use cron polling instead
export async function getWebhookUrls(_gameId: string): Promise<
  { playerId: string; countryId: string; webhookUrl: string }[]
> {
  return [];
}

// ---- Games ----

export async function createGame(overrides?: Partial<Game>): Promise<Game> {
  const { data, error } = await db()
    .from("games")
    .insert({
      max_turns: overrides?.maxTurns ?? GAME_CONFIG.maxTurns,
      min_players: overrides?.minPlayers ?? GAME_CONFIG.minPlayers,
      turn_deadline_seconds:
        overrides?.turnDeadlineSeconds ?? GAME_CONFIG.turnDeadlineSeconds,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Game;
}

export async function getActiveGame(): Promise<Game | null> {
  const { data, error } = await db()
    .from("games")
    .select()
    .in("phase", ["lobby", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Game) : null;
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const { data, error } = await db()
    .from("games")
    .select()
    .eq("id", gameId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Game) : null;
}

export async function updateGame(
  gameId: string,
  updates: Record<string, unknown>
): Promise<Game> {
  const { data, error } = await db()
    .from("games")
    .update(camelToSnake(updates))
    .eq("id", gameId)
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Game;
}

// ---- Game Players ----

export async function joinGame(
  gameId: string,
  playerId: string,
  countryId: string,
  stats: {
    territory: number;
    military: number;
    resources: number;
    naval: number;
    gdp: number;
    stability: number;
  }
): Promise<GamePlayer> {
  const { data, error } = await db()
    .from("game_players")
    .insert({
      game_id: gameId,
      player_id: playerId,
      country_id: countryId,
      territory: stats.territory,
      military: stats.military,
      resources: stats.resources,
      naval: stats.naval,
      gdp: stats.gdp,
      stability: stats.stability,
      prestige: GAME_CONFIG.startingPrestige,
      inflation: GAME_CONFIG.startingInflation,
      unrest: GAME_CONFIG.startingUnrest,
      spy_tokens: GAME_CONFIG.startingSpyTokens,
      tech: 1,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as GamePlayer;
}

export async function getGamePlayers(gameId: string): Promise<GamePlayer[]> {
  const { data, error } = await db()
    .from("game_players")
    .select()
    .eq("game_id", gameId);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as GamePlayer);
}

export async function getGamePlayer(
  gameId: string,
  playerId: string
): Promise<GamePlayer | null> {
  const { data, error } = await db()
    .from("game_players")
    .select()
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as GamePlayer) : null;
}

export async function getGamePlayerByCountry(
  gameId: string,
  countryId: string
): Promise<GamePlayer | null> {
  const { data, error } = await db()
    .from("game_players")
    .select()
    .eq("game_id", gameId)
    .eq("country_id", countryId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as GamePlayer) : null;
}

export async function updateGamePlayer(
  gamePlayerId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await db()
    .from("game_players")
    .update(camelToSnake(updates))
    .eq("id", gamePlayerId);
  if (error) throw error;
}

export async function bulkUpdateGamePlayers(
  updates: { id: string; changes: Record<string, unknown> }[]
): Promise<void> {
  for (const u of updates) {
    await updateGamePlayer(u.id, u.changes);
  }
}

// ---- Turn Submissions ----

export async function submitTurn(submission: {
  gameId: string;
  playerId: string;
  turn: number;
  phase: TurnPhase;
  action?: ActionType | null;
  target?: string | null;
  messages?: NegotiationMessage[];
  reasoning?: string | null;
  publicStatement?: string | null;
  tradeAmount?: number | null;
  voteResolution?: string | null;
  allianceName?: string | null;
  allianceAbbreviation?: string | null;
}): Promise<TurnSubmission> {
  const row: Record<string, unknown> = {
    game_id: submission.gameId,
    player_id: submission.playerId,
    turn: submission.turn,
    phase: submission.phase,
    action: submission.action ?? null,
    target: submission.target ?? null,
    messages: JSON.stringify(submission.messages ?? []),
    reasoning: submission.reasoning ?? null,
    public_statement: submission.publicStatement ?? null,
    trade_amount: submission.tradeAmount ?? null,
    vote_resolution: submission.voteResolution ?? null,
  };
  if (submission.allianceName) row.alliance_name = submission.allianceName;
  if (submission.allianceAbbreviation) row.alliance_abbreviation = submission.allianceAbbreviation.slice(0, 5);
  const { data, error } = await db()
    .from("turn_submissions")
    .upsert(row, { onConflict: "game_id,player_id,turn,phase" })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as TurnSubmission;
}

export async function getTurnSubmissions(
  gameId: string,
  turn: number,
  phase: TurnPhase
): Promise<TurnSubmission[]> {
  const { data, error } = await db()
    .from("turn_submissions")
    .select()
    .eq("game_id", gameId)
    .eq("turn", turn)
    .eq("phase", phase);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as TurnSubmission);
}

export async function getLastDeclaration(
  gameId: string,
  playerId: string,
  beforeTurn: number
): Promise<TurnSubmission | null> {
  const { data, error } = await db()
    .from("turn_submissions")
    .select()
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .eq("phase", "declaration")
    .lt("turn", beforeTurn)
    .order("turn", { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as TurnSubmission) : null;
}

export async function getPlayerSubmission(
  gameId: string,
  playerId: string,
  turn: number,
  phase: TurnPhase
): Promise<TurnSubmission | null> {
  const { data, error } = await db()
    .from("turn_submissions")
    .select()
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .eq("turn", turn)
    .eq("phase", phase)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as TurnSubmission) : null;
}

// ---- Diplomatic Messages ----

export async function saveDiplomaticMessage(msg: {
  gameId: string;
  fromPlayerId: string;
  fromCountryId: string;
  toPlayerId: string | null;
  toCountryId: string;
  content: string;
  isPrivate: boolean;
  turn: number;
  phase: TurnPhase;
}): Promise<void> {
  const { error } = await db().from("diplomatic_messages").insert({
    game_id: msg.gameId,
    from_player_id: msg.fromPlayerId,
    from_country_id: msg.fromCountryId,
    to_player_id: msg.toPlayerId,
    to_country_id: msg.toCountryId,
    content: msg.content,
    is_private: msg.isPrivate,
    turn: msg.turn,
    phase: msg.phase,
  });
  if (error) throw error;
}

// All diplomatic messages for a game — for spectator/human view
export async function getAllDiplomaticMessages(
  gameId: string,
  limit = 200
): Promise<{
  fromCountryId: string;
  toCountryId: string;
  content: string;
  isPrivate: boolean;
  turn: number;
  createdAt: string | null;
}[]> {
  const { data, error } = await db()
    .from("diplomatic_messages")
    .select("from_country_id, to_country_id, content, is_private, turn, created_at")
    .eq("game_id", gameId)
    .order("turn", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    fromCountryId: d.from_country_id,
    toCountryId: d.to_country_id,
    content: d.content,
    isPrivate: d.is_private,
    turn: d.turn,
    createdAt: d.created_at ?? null,
  }));
}

export async function getInboundMessages(
  gameId: string,
  playerId: string,
  countryId: string,
  turn: number
): Promise<
  {
    fromCountryId: string;
    content: string;
    isPrivate: boolean;
  }[]
> {
  const { data, error } = await db()
    .from("diplomatic_messages")
    .select()
    .eq("game_id", gameId)
    .eq("turn", turn)
    .or(`to_player_id.eq.${playerId},to_country_id.eq.broadcast`);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    fromCountryId: d.from_country_id,
    content: d.content,
    isPrivate: d.is_private,
  }));
}

// ---- Alliances ----

export async function getAlliances(
  gameId: string,
  activeOnly = true
): Promise<{ countryA: string; countryB: string; formedOnTurn: number; strength: number; name: string | null; abbreviation: string | null }[]> {
  let query = db().from("alliances").select().eq("game_id", gameId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => ({
    countryA: d.country_a,
    countryB: d.country_b,
    formedOnTurn: d.formed_on_turn,
    strength: d.strength,
    name: d.name ?? null,
    abbreviation: d.abbreviation ?? null,
  }));
}

export async function createAlliance(
  gameId: string,
  countryA: string,
  countryB: string,
  turn: number,
  name?: string | null,
  abbreviation?: string | null,
): Promise<void> {
  const [a, b] = [countryA, countryB].sort();
  const row: Record<string, unknown> = {
    game_id: gameId,
    country_a: a,
    country_b: b,
    formed_on_turn: turn,
    strength: 5,
    is_active: true,
  };
  if (name) row.name = name;
  if (abbreviation) row.abbreviation = abbreviation.slice(0, 5);
  const { error } = await db()
    .from("alliances")
    .upsert(row, { onConflict: "game_id,country_a,country_b" });
  if (error) throw error;
}

export async function breakAlliance(
  gameId: string,
  countryA: string,
  countryB: string
): Promise<void> {
  const [a, b] = [countryA, countryB].sort();
  const { error } = await db()
    .from("alliances")
    .update({ is_active: false })
    .eq("game_id", gameId)
    .eq("country_a", a)
    .eq("country_b", b);
  if (error) throw error;
}

// ---- Wars ----

export async function getWars(
  gameId: string,
  activeOnly = true
): Promise<{ attacker: string; defender: string; startedOnTurn: number }[]> {
  let query = db().from("wars").select().eq("game_id", gameId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => ({
    attacker: d.attacker,
    defender: d.defender,
    startedOnTurn: d.started_on_turn,
  }));
}

export async function createWar(
  gameId: string,
  attacker: string,
  defender: string,
  turn: number
): Promise<void> {
  const { error } = await db().from("wars").insert({
    game_id: gameId,
    attacker,
    defender,
    started_on_turn: turn,
  });
  if (error) throw error;
}

export async function endWar(
  gameId: string,
  attacker: string,
  defender: string,
  turn: number
): Promise<void> {
  const { error } = await db()
    .from("wars")
    .update({ is_active: false, ended_on_turn: turn })
    .eq("game_id", gameId)
    .eq("attacker", attacker)
    .eq("defender", defender)
    .eq("is_active", true);
  if (error) throw error;
}

// ---- Game Events ----

export async function insertGameEvent(event: {
  gameId: string;
  type: string;
  turn: number;
  phase: string;
  data: unknown;
}): Promise<void> {
  const { error } = await db().from("game_events").insert({
    game_id: event.gameId,
    type: event.type,
    turn: event.turn,
    phase: event.phase,
    data: event.data,
  });
  if (error) throw error;
}

export async function getGameEvents(
  gameId: string,
  opts?: { turn?: number; limit?: number }
): Promise<GameEvent[]> {
  let query = db()
    .from("game_events")
    .select()
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (opts?.turn !== undefined) query = query.eq("turn", opts.turn);
  if (opts?.limit) query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as GameEvent);
}

// ---- Game Results ----

export async function insertGameResult(result: {
  gameId: string;
  playerId: string;
  countryId: string;
  placement: number;
  eloChange: number;
  finalTerritory: number;
  finalMilitary: number;
  finalGdp: number;
}): Promise<void> {
  const { error } = await db().from("game_results").insert({
    game_id: result.gameId,
    player_id: result.playerId,
    country_id: result.countryId,
    placement: result.placement,
    elo_change: result.eloChange,
    final_territory: result.finalTerritory,
    final_military: result.finalMilitary,
    final_gdp: result.finalGdp,
  });
  if (error) throw error;
}

// ---- Leaderboard ----

export async function getLeaderboard(
  limit = 50
): Promise<Player[]> {
  const { data, error } = await db()
    .from("players")
    .select()
    .order("elo", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Player);
}

// ---- UN Votes ----

export async function createUNVote(vote: {
  gameId: string;
  proposedBy: string;
  resolution: string;
  turn: number;
}): Promise<void> {
  const { error } = await db().from("un_votes").insert({
    game_id: vote.gameId,
    proposed_by: vote.proposedBy,
    resolution: vote.resolution,
    turn: vote.turn,
  });
  if (error) throw error;
}

export async function getUNVotes(gameId: string, turn: number) {
  const { data, error } = await db()
    .from("un_votes")
    .select()
    .eq("game_id", gameId)
    .eq("turn", turn);
  if (error) throw error;
  return data ?? [];
}

// ---- World News ----

export async function insertWorldNews(news: {
  gameId: string;
  turn: number;
  title: string;
  description: string;
  effects: unknown;
}): Promise<void> {
  const { error } = await db().from("world_news").insert({
    game_id: news.gameId,
    turn: news.turn,
    title: news.title,
    description: news.description,
    effects: news.effects,
  });
  if (error) throw error;
}
