// ============================================================
// STATECRAFT v3 — Diplomacy Database Queries
// Ultimatums, Pacts, Unions, Wars
// ============================================================

import { getSupabase } from "./client.js";
import type {
  Ultimatum, Pact, PactMember, War, Union, UnionMember
} from "../types/index.js";

const db = () => getSupabase();

function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// ---- Ultimatums ----

export async function createUltimatum(params: {
  gameId: string;
  fromCountryId: string;
  toCountryId: string;
  turn: number;
  demands: unknown;
}): Promise<Ultimatum> {
  const { data, error } = await db()
    .from("ultimatums")
    .insert({
      game_id: params.gameId,
      from_country_id: params.fromCountryId,
      to_country_id: params.toCountryId,
      turn: params.turn,
      demands: params.demands,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as Ultimatum;
}

export async function getPendingUltimatums(
  gameId: string,
  toCountryId?: string
): Promise<Ultimatum[]> {
  let query = db()
    .from("ultimatums")
    .select()
    .eq("game_id", gameId)
    .eq("status", "pending");
  if (toCountryId) query = query.eq("to_country_id", toCountryId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Ultimatum);
}

export async function updateUltimatum(
  id: string,
  status: "accepted" | "rejected" | "expired"
): Promise<void> {
  const { error } = await db()
    .from("ultimatums")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---- Pacts ----

export async function createPact(params: {
  gameId: string;
  name: string;
  abbreviation: string;
  color: string;
  foundedOnTurn: number;
  founderCountryId: string;
}): Promise<Pact> {
  const { data, error } = await db()
    .from("pacts")
    .insert({
      game_id: params.gameId,
      name: params.name,
      abbreviation: params.abbreviation.slice(0, 5),
      color: params.color,
      founded_on_turn: params.foundedOnTurn,
    })
    .select()
    .single();
  if (error) throw error;

  // Add founder as first member
  await addPactMember(data.id, params.founderCountryId, params.foundedOnTurn);

  return snakeToCamel(data) as unknown as Pact;
}

export async function getPacts(gameId: string, activeOnly = true): Promise<Pact[]> {
  let query = db().from("pacts").select().eq("game_id", gameId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Pact);
}

export async function dissolvePact(pactId: string): Promise<void> {
  const { error } = await db()
    .from("pacts")
    .update({ is_active: false })
    .eq("id", pactId);
  if (error) throw error;
}

export async function addPactMember(
  pactId: string,
  countryId: string,
  turn: number
): Promise<void> {
  const { error } = await db()
    .from("pact_members")
    .insert({
      pact_id: pactId,
      country_id: countryId,
      joined_on_turn: turn,
    });
  if (error) throw error;
}

export async function removePactMember(
  pactId: string,
  countryId: string,
  turn: number
): Promise<void> {
  const { error } = await db()
    .from("pact_members")
    .update({ is_active: false, left_on_turn: turn })
    .eq("pact_id", pactId)
    .eq("country_id", countryId)
    .eq("is_active", true);
  if (error) throw error;
}

export async function getPactMembers(pactId: string, activeOnly = true): Promise<PactMember[]> {
  let query = db().from("pact_members").select().eq("pact_id", pactId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as PactMember);
}

export async function getCountryPacts(
  gameId: string,
  countryId: string
): Promise<{ pact: Pact; members: PactMember[] }[]> {
  const allPacts = await getPacts(gameId);
  const result: { pact: Pact; members: PactMember[] }[] = [];
  for (const pact of allPacts) {
    const members = await getPactMembers(pact.id);
    if (members.some((m) => m.countryId === countryId)) {
      result.push({ pact, members });
    }
  }
  return result;
}

// ---- Wars ----

export async function createWar(params: {
  gameId: string;
  attackerCountryId: string;
  defenderCountryId: string;
  startedOnTurn: number;
  attackerInitialTroops: number;
  defenderInitialTroops: number;
}): Promise<War> {
  const { data, error } = await db()
    .from("wars")
    .insert({
      game_id: params.gameId,
      attacker_country_id: params.attackerCountryId,
      defender_country_id: params.defenderCountryId,
      started_on_turn: params.startedOnTurn,
      attacker_initial_troops: params.attackerInitialTroops,
      defender_initial_troops: params.defenderInitialTroops,
    })
    .select()
    .single();
  if (error) throw error;
  return snakeToCamel(data) as unknown as War;
}

export async function getWars(gameId: string, activeOnly = true): Promise<War[]> {
  let query = db().from("wars").select().eq("game_id", gameId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as War);
}

export async function endWar(
  gameId: string,
  attackerId: string,
  defenderId: string,
  turn: number
): Promise<void> {
  const { error } = await db()
    .from("wars")
    .update({ is_active: false, ended_on_turn: turn })
    .eq("game_id", gameId)
    .eq("attacker_country_id", attackerId)
    .eq("defender_country_id", defenderId)
    .eq("is_active", true);
  if (error) throw error;
}

export async function getCountryWars(
  gameId: string,
  countryId: string,
  activeOnly = true
): Promise<War[]> {
  const wars = await getWars(gameId, activeOnly);
  return wars.filter(
    (w) => w.attackerCountryId === countryId || w.defenderCountryId === countryId
  );
}

// ---- Unions ----

export async function createUnion(params: {
  gameId: string;
  name: string;
  abbreviation: string;
  foundedOnTurn: number;
  leaderCountryId: string;
}): Promise<Union> {
  const { data, error } = await db()
    .from("unions")
    .insert({
      game_id: params.gameId,
      name: params.name,
      abbreviation: params.abbreviation,
      founded_on_turn: params.foundedOnTurn,
    })
    .select()
    .single();
  if (error) throw error;

  // Add leader as first member
  await addUnionMember(data.id, params.leaderCountryId, params.foundedOnTurn, true);

  return snakeToCamel(data) as unknown as Union;
}

export async function getUnions(gameId: string, activeOnly = true): Promise<Union[]> {
  let query = db().from("unions").select().eq("game_id", gameId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as Union);
}

export async function dissolveUnion(unionId: string): Promise<void> {
  const { error } = await db()
    .from("unions")
    .update({ is_active: false })
    .eq("id", unionId);
  if (error) throw error;
}

export async function addUnionMember(
  unionId: string,
  countryId: string,
  turn: number,
  isLeader = false
): Promise<void> {
  const { error } = await db()
    .from("union_members")
    .insert({
      union_id: unionId,
      country_id: countryId,
      is_leader: isLeader,
      joined_on_turn: turn,
    });
  if (error) throw error;
}

export async function getUnionMembers(unionId: string, activeOnly = true): Promise<UnionMember[]> {
  let query = db().from("union_members").select().eq("union_id", unionId);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => snakeToCamel(d) as unknown as UnionMember);
}
