// ============================================================
// STATECRAFT v3 — Game Database Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { Game } from "../types/index.js";
import { GAME_CONFIG } from "../game/config.js";

const db = () => getSupabase();

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
