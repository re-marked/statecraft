// ============================================================
// STATECRAFT v3 — Province Database Queries
// ============================================================

import { getSupabase } from "./client.js";
import type { Province, ProvinceAdjacency, TerrainType } from "../types/index.js";

const db = () => getSupabase();

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// ---- Province CRUD ----

export async function createProvince(params: {
  gameId: string;
  nuts2Id: string;
  name: string;
  ownerId: string;
  originalOwnerId: string;
  isCapital: boolean;
  gdpValue: number;
  terrain: TerrainType;
  troopsStationed: number;
  population: number;
}): Promise<Province> {
  const { data, error } = await db()
    .from("provinces")
    .insert({
      game_id: params.gameId,
      nuts2_id: params.nuts2Id,
      name: params.name,
      owner_id: params.ownerId,
      original_owner_id: params.originalOwnerId,
      is_capital: params.isCapital,
      gdp_value: params.gdpValue,
      terrain: params.terrain,
      troops_stationed: params.troopsStationed,
      population: params.population,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Province;
}

export async function bulkCreateProvinces(
  provinces: {
    game_id: string;
    nuts2_id: string;
    name: string;
    owner_id: string;
    original_owner_id: string;
    is_capital: boolean;
    gdp_value: number;
    terrain: string;
    troops_stationed: number;
    population: number;
  }[]
): Promise<void> {
  const { error } = await db().from("provinces").insert(provinces);
  if (error) throw error;
}

export async function getProvinces(gameId: string): Promise<Province[]> {
  const { data, error } = await db()
    .from("provinces")
    .select()
    .eq("game_id", gameId);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Province);
}

export async function getProvincesByOwner(
  gameId: string,
  ownerId: string
): Promise<Province[]> {
  const { data, error } = await db()
    .from("provinces")
    .select()
    .eq("game_id", gameId)
    .eq("owner_id", ownerId);
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Province);
}

export async function getProvinceByNuts2(
  gameId: string,
  nuts2Id: string
): Promise<Province | null> {
  const { data, error } = await db()
    .from("provinces")
    .select()
    .eq("game_id", gameId)
    .eq("nuts2_id", nuts2Id)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ? (snakeToCamel(data) as unknown as Province) : null;
}

export async function updateProvince(
  gameId: string,
  nuts2Id: string,
  updates: { owner_id?: string; troops_stationed?: number; gdp_value?: number }
): Promise<void> {
  const { error } = await db()
    .from("provinces")
    .update(updates)
    .eq("game_id", gameId)
    .eq("nuts2_id", nuts2Id);
  if (error) throw error;
}

export async function transferAllProvinces(
  gameId: string,
  fromCountryId: string,
  toCountryId: string
): Promise<void> {
  const { error } = await db()
    .from("provinces")
    .update({ owner_id: toCountryId })
    .eq("game_id", gameId)
    .eq("owner_id", fromCountryId);
  if (error) throw error;
}

// ---- Adjacency (cached in memory after first load) ----

let cachedAdjacency: ProvinceAdjacency[] | null = null;
let cachedAdjacencyMap: Map<string, string[]> | null = null;

export async function getAdjacency(): Promise<ProvinceAdjacency[]> {
  if (cachedAdjacency) return cachedAdjacency;
  const { data, error } = await db()
    .from("province_adjacency")
    .select();
  if (error) throw error;
  cachedAdjacency = (data ?? []).map((d) => ({
    nuts2IdA: d.nuts2_id_a,
    nuts2IdB: d.nuts2_id_b,
  }));
  return cachedAdjacency;
}

export async function getCachedAdjacencyMap(): Promise<Map<string, string[]>> {
  if (cachedAdjacencyMap) return cachedAdjacencyMap;
  const adj = await getAdjacency();
  cachedAdjacencyMap = buildAdjacencyMap(adj);
  return cachedAdjacencyMap;
}

export async function bulkInsertAdjacency(
  edges: { nuts2_id_a: string; nuts2_id_b: string }[]
): Promise<void> {
  // Insert in batches of 500
  for (let i = 0; i < edges.length; i += 500) {
    const batch = edges.slice(i, i + 500);
    const { error } = await db().from("province_adjacency").upsert(batch, {
      onConflict: "nuts2_id_a,nuts2_id_b",
    });
    if (error) throw error;
  }
  // Invalidate in-memory cache so next read picks up the new data
  cachedAdjacency = null;
  cachedAdjacencyMap = null;
}

/**
 * Build an in-memory adjacency map (bidirectional).
 */
export function buildAdjacencyMap(
  adjacencies: ProvinceAdjacency[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { nuts2IdA, nuts2IdB } of adjacencies) {
    if (!map.has(nuts2IdA)) map.set(nuts2IdA, []);
    if (!map.has(nuts2IdB)) map.set(nuts2IdB, []);
    map.get(nuts2IdA)!.push(nuts2IdB);
    map.get(nuts2IdB)!.push(nuts2IdA);
  }
  return map;
}
