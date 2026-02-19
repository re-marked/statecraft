// ============================================================
// STATECRAFT v3 — Game Event & Diplomatic Message Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { GameEvent, DiplomaticMessage, TurnPhase } from "../types/index.js";

const db = () => getSupabase();

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
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

export async function getInboundMessages(
  gameId: string,
  playerId: string,
  _countryId: string,
  turn: number
): Promise<{ fromCountryId: string; content: string; isPrivate: boolean }[]> {
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

export async function getAllDiplomaticMessages(
  gameId: string,
  limit = 200
): Promise<DiplomaticMessage[]> {
  const { data, error } = await db()
    .from("diplomatic_messages")
    .select()
    .eq("game_id", gameId)
    .order("turn", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as DiplomaticMessage);
}
