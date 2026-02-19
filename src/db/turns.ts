// ============================================================
// STATECRAFT v3 — Turn Submission Database Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { TurnSubmission, TurnPhase } from "../types/index.js";

const db = () => getSupabase();

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export async function submitTurn(submission: {
  gameId: string;
  playerId: string;
  turn: number;
  phase: TurnPhase;
  actions?: unknown[];
  messages?: unknown[];
  ultimatumResponses?: unknown[];
  reasoning?: string | null;
  publicStatement?: string | null;
}): Promise<TurnSubmission> {
  const row = {
    game_id: submission.gameId,
    player_id: submission.playerId,
    turn: submission.turn,
    phase: submission.phase,
    actions: JSON.stringify(submission.actions ?? []),
    messages: JSON.stringify(submission.messages ?? []),
    ultimatum_responses: JSON.stringify(submission.ultimatumResponses ?? []),
    reasoning: submission.reasoning ?? null,
    public_statement: submission.publicStatement ?? null,
  };

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
