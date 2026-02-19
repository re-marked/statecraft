// ============================================================
// STATECRAFT v3 — Trade Ledger Database Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { Trade, GameResult } from "../types/index.js";

const db = () => getSupabase();

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// ---- Trades ----

export async function recordTrade(params: {
  gameId: string;
  turn: number;
  fromCountryId: string;
  toCountryId: string;
  fromAmount: number;
  toAmount: number;
}): Promise<Trade> {
  const { data, error } = await db()
    .from("trades")
    .insert({
      game_id: params.gameId,
      turn: params.turn,
      from_country_id: params.fromCountryId,
      to_country_id: params.toCountryId,
      from_amount: params.fromAmount,
      to_amount: params.toAmount,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Trade;
}

export async function getGameTrades(gameId: string): Promise<Trade[]> {
  const { data, error } = await db()
    .from("trades")
    .select()
    .eq("game_id", gameId)
    .order("turn", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Trade);
}

// ---- Game Results ----

export async function insertGameResult(result: {
  gameId: string;
  playerId: string;
  countryId: string;
  placement: number;
  eloChange: number;
  finalProvinces: number;
  finalTroops: number;
  finalMoney: number;
  finalGdp: number;
}): Promise<void> {
  const { error } = await db().from("game_results").insert({
    game_id: result.gameId,
    player_id: result.playerId,
    country_id: result.countryId,
    placement: result.placement,
    elo_change: result.eloChange,
    final_provinces: result.finalProvinces,
    final_troops: result.finalTroops,
    final_money: result.finalMoney,
    final_gdp: result.finalGdp,
  });
  if (error) throw error;
}

export async function getGameResults(gameId: string): Promise<GameResult[]> {
  const { data, error } = await db()
    .from("game_results")
    .select()
    .eq("game_id", gameId)
    .order("placement", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as GameResult);
}
