// ============================================================
// STATECRAFT v3 — Player Database Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { Player } from "../types/index.js";

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

export async function getLeaderboard(limit = 50): Promise<Player[]> {
  const { data, error } = await db()
    .from("players")
    .select()
    .order("elo", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Player);
}
