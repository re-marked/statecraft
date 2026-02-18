#!/usr/bin/env tsx
// ============================================================
// STATECRAFT v2 — "The Great European War" Demo Simulation
// ============================================================
//
// A fully self-contained 10-turn scripted war that showcases
// every game mechanic without requiring a database or server.
//
// Run:  npx tsx src/demo/war-demo.ts
//
// Features demonstrated across 10 turns:
//   - Land combat (attack, defend)
//   - Naval combat & blockades
//   - Alliance formation & betrayal
//   - Trade agreements
//   - Espionage (intel, sabotage, propaganda)
//   - Military/stability/tech investments
//   - Sanctions
//   - UN votes
//   - Neutrality bonuses
//   - Ceasefire & peace proposals
//   - Coup mechanics (stability collapse)
//   - Economy (resource generation, GDP growth, inflation)
//   - Civil unrest erosion
//   - Spy token regeneration
//   - World tension tracking
//   - Win condition checks (territory domination, economic, last standing)
//   - World news random events
// ============================================================

import { COUNTRIES, COUNTRY_MAP, WIN_CONDITIONS, GAME_CONFIG } from "../game/config.js";
import type { ActionType, Resolution, StateChange } from "../types/index.js";

// ── Seeded PRNG for reproducible drama ────────────────────────
let seed = 137;
function rand(): number {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

// ── In-memory country state ───────────────────────────────────
interface CountryState {
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
  inflation: number;
  tech: number;
  unrest: number;
  spyTokens: number;
  isEliminated: boolean;
}

interface AllianceRecord {
  countryA: string;
  countryB: string;
  formedOnTurn: number;
}

interface WarRecord {
  attacker: string;
  defender: string;
  startedOnTurn: number;
  isActive: boolean;
}

interface PlayerAction {
  countryId: string;
  action: ActionType;
  target: string | null;
  publicStatement: string;
  reasoning: string;
  tradeAmount?: number;
  voteResolution?: string;
}

interface NegMessage {
  from: string;
  to: string; // country ID or "broadcast"
  content: string;
  private: boolean;
}

// ── 8 countries for an exciting match ─────────────────────────
const CAST = [
  "russia", "germany", "france", "uk",
  "turkey", "poland", "ukraine", "sweden",
];

// ── Global state ──────────────────────────────────────────────
const countries = new Map<string, CountryState>();
const alliances: AllianceRecord[] = [];
const wars: WarRecord[] = [];
let worldTension = 20;
let gameOver = false;
let winner: string | null = null;
let winReason = "";

function initCountries() {
  for (const id of CAST) {
    const cfg = COUNTRY_MAP.get(id)!;
    countries.set(id, {
      id: cfg.id,
      name: cfg.name,
      flag: cfg.flag,
      territory: cfg.territory,
      military: cfg.military,
      resources: cfg.resources,
      naval: cfg.naval,
      stability: cfg.stability,
      prestige: GAME_CONFIG.startingPrestige,
      gdp: cfg.gdp,
      inflation: GAME_CONFIG.startingInflation,
      tech: 1,
      unrest: GAME_CONFIG.startingUnrest,
      spyTokens: GAME_CONFIG.startingSpyTokens,
      isEliminated: false,
    });
  }
}

function n(id: string): string {
  return countries.get(id)?.name ?? id;
}

function hasAlliance(a: string, b: string): boolean {
  const [x, y] = [a, b].sort();
  return alliances.some((al) => al.countryA === x && al.countryB === y);
}

function addAlliance(a: string, b: string, turn: number) {
  const [x, y] = [a, b].sort();
  if (!hasAlliance(a, b)) {
    alliances.push({ countryA: x, countryB: y, formedOnTurn: turn });
  }
}

function removeAlliance(a: string, b: string) {
  const [x, y] = [a, b].sort();
  const idx = alliances.findIndex((al) => al.countryA === x && al.countryB === y);
  if (idx >= 0) alliances.splice(idx, 1);
}

function getAllyCount(countryId: string): number {
  return alliances.filter(
    (al) => al.countryA === countryId || al.countryB === countryId
  ).length;
}

function hasActiveWar(a: string, b: string): boolean {
  return wars.some(
    (w) =>
      w.isActive &&
      ((w.attacker === a && w.defender === b) ||
        (w.attacker === b && w.defender === a))
  );
}

function addWar(attacker: string, defender: string, turn: number) {
  if (!hasActiveWar(attacker, defender)) {
    wars.push({ attacker, defender, startedOnTurn: turn, isActive: true });
  }
}

function endWarBetween(a: string, b: string) {
  for (const w of wars) {
    if (
      w.isActive &&
      ((w.attacker === a && w.defender === b) ||
        (w.attacker === b && w.defender === a))
    ) {
      w.isActive = false;
    }
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Resolution engine (mirrors src/game/engine.ts exactly) ────
function resolve(
  turn: number,
  actions: PlayerAction[],
  messages: NegMessage[]
): Resolution[] {
  const resolutions: Resolution[] = [];
  const changes = new Map<string, Record<string, number>>();

  function addChange(countryId: string, field: string, delta: number) {
    if (!changes.has(countryId)) changes.set(countryId, {});
    const c = changes.get(countryId)!;
    c[field] = (c[field] ?? 0) + delta;
  }

  const alive = [...countries.values()].filter((c) => !c.isEliminated);

  // ── 1. Coup checks ──
  for (const c of alive) {
    if (c.stability <= 0) {
      addChange(c.id, "isEliminated", 1);
      resolutions.push({
        type: "coup",
        countries: [c.id],
        description: `${n(c.id)} collapses in a coup! Government overthrown.`,
        stateChanges: [{ country: c.id, field: "isEliminated", delta: 1 }],
        emoji: "💥",
      });
    }
  }

  // ── 2. Ceasefire proposals (mutual) ──
  const ceasefireProcessed = new Set<string>();
  for (const a of actions.filter((x) => x.action === "propose_ceasefire")) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (ceasefireProcessed.has(key)) continue;
    const mutual = actions.find(
      (b) =>
        b.countryId === a.target &&
        b.action === "propose_ceasefire" &&
        b.target === a.countryId
    );
    if (mutual) {
      ceasefireProcessed.add(key);
      endWarBetween(a.countryId, a.target);
      resolutions.push({
        type: "ceasefire",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} agree to a ceasefire!`,
        stateChanges: [],
        emoji: "🕊️",
      });
    } else {
      resolutions.push({
        type: "ceasefire_rejected",
        countries: [a.countryId],
        description: `${n(a.countryId)}'s ceasefire proposal to ${n(a.target)} was not reciprocated.`,
        stateChanges: [],
        emoji: "❌",
      });
    }
  }

  // ── 3. Peace proposals (mutual) ──
  const peaceProcessed = new Set<string>();
  for (const a of actions.filter((x) => x.action === "propose_peace")) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (peaceProcessed.has(key)) continue;
    const mutual = actions.find(
      (b) =>
        b.countryId === a.target &&
        b.action === "propose_peace" &&
        b.target === a.countryId
    );
    if (mutual) {
      peaceProcessed.add(key);
      endWarBetween(a.countryId, a.target);
      resolutions.push({
        type: "peace",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} sign a peace treaty!`,
        stateChanges: [],
        emoji: "🤝",
      });
    } else {
      resolutions.push({
        type: "peace_rejected",
        countries: [a.countryId],
        description: `${n(a.countryId)}'s peace proposal to ${n(a.target)} was not reciprocated.`,
        stateChanges: [],
        emoji: "❌",
      });
    }
  }

  // ── 4. Betrayals ──
  for (const a of actions.filter((x) => x.action === "betray")) {
    if (!a.target) continue;
    const attacker = countries.get(a.countryId)!;
    const target = countries.get(a.target)!;
    if (attacker.isEliminated || target.isEliminated) continue;

    removeAlliance(a.countryId, a.target);
    const dmg = Math.ceil(attacker.military * 0.3);
    addChange(a.target, "military", -dmg);
    addChange(a.target, "stability", -2);
    addChange(a.countryId, "prestige", -15);

    resolutions.push({
      type: "betrayal",
      countries: [a.countryId, a.target],
      description: `${n(a.countryId)} BETRAYS ${n(a.target)}! Alliance shattered — ${dmg} military damage dealt.`,
      stateChanges: [
        { country: a.target, field: "military", delta: -dmg },
        { country: a.target, field: "stability", delta: -2 },
        { country: a.countryId, field: "prestige", delta: -15 },
      ],
      emoji: "🗡️",
    });
  }

  // ── 5. Espionage ──
  for (const a of actions.filter((x) =>
    ["spy_intel", "spy_sabotage", "spy_propaganda"].includes(x.action)
  )) {
    if (!a.target) continue;
    const att = countries.get(a.countryId)!;
    const tgt = countries.get(a.target)!;
    if (att.isEliminated || tgt.isEliminated || att.spyTokens <= 0) continue;

    addChange(a.countryId, "spyTokens", -1);
    const success = rand() < 0.6 + att.tech * 0.03;

    if (a.action === "spy_sabotage") {
      if (success) {
        addChange(a.target, "resources", -2);
        resolutions.push({
          type: "spy_sabotage",
          countries: [a.countryId, a.target],
          description: `${n(a.countryId)} sabotages ${n(a.target)}'s infrastructure! (-2 resources)`,
          stateChanges: [{ country: a.target, field: "resources", delta: -2 }],
          emoji: "💣",
        });
      } else {
        resolutions.push({
          type: "spy_sabotage",
          countries: [a.countryId, a.target],
          description: `${n(a.countryId)}'s sabotage mission in ${n(a.target)} FAILS — agents captured!`,
          stateChanges: [],
          emoji: "🚨",
        });
      }
    } else if (a.action === "spy_propaganda") {
      if (success) {
        addChange(a.target, "stability", -1);
        addChange(a.target, "unrest", 10);
        resolutions.push({
          type: "spy_propaganda",
          countries: [a.countryId, a.target],
          description: `${n(a.countryId)} spreads propaganda in ${n(a.target)}! (-1 stability, +10 unrest)`,
          stateChanges: [
            { country: a.target, field: "stability", delta: -1 },
            { country: a.target, field: "unrest", delta: 10 },
          ],
          emoji: "📰",
        });
      } else {
        resolutions.push({
          type: "spy_propaganda",
          countries: [a.countryId, a.target],
          description: `${n(a.countryId)}'s propaganda campaign in ${n(a.target)} is exposed and fails!`,
          stateChanges: [],
          emoji: "🚨",
        });
      }
    } else if (a.action === "spy_intel") {
      resolutions.push({
        type: "spy_intel",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} gathers intelligence on ${n(a.target)}${success ? " — full dossier obtained." : " — partial data only."}`,
        stateChanges: [],
        emoji: "🔍",
      });
    }
  }

  // ── 6. Land attacks ──
  for (const a of actions.filter((x) => x.action === "attack")) {
    if (!a.target) continue;
    const att = countries.get(a.countryId)!;
    const tgt = countries.get(a.target)!;
    if (att.isEliminated || tgt.isEliminated) continue;

    const isDefending = actions.some(
      (b) => b.countryId === a.target && b.action === "defend"
    );
    const attackStr =
      att.military * (0.8 + rand() * 0.4) + att.tech * 0.5;
    const allyCount = getAllyCount(a.target);
    const defenseBonus = isDefending ? 1.5 : 1.0;
    const defenseStr =
      (tgt.military + allyCount * 1.5) * defenseBonus + tgt.tech * 0.3;

    if (attackStr > defenseStr) {
      const terrGain = Math.min(
        Math.ceil((attackStr - defenseStr) / 3),
        3,
        tgt.territory
      );
      addChange(a.countryId, "territory", terrGain);
      addChange(a.target, "territory", -terrGain);
      addChange(a.countryId, "military", -1);
      addChange(a.target, "military", -2);
      addChange(a.target, "stability", -1);
      addWar(a.countryId, a.target, turn);
      resolutions.push({
        type: "combat",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} attacks ${n(a.target)} and seizes ${terrGain} province${terrGain > 1 ? "s" : ""}!`,
        stateChanges: [
          { country: a.countryId, field: "territory", delta: terrGain },
          { country: a.target, field: "territory", delta: -terrGain },
        ],
        emoji: "⚔️",
      });
    } else {
      addChange(a.countryId, "military", -2);
      addChange(a.target, "military", -1);
      resolutions.push({
        type: "combat",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} attacks ${n(a.target)} but is ${isDefending ? "repelled by fortified defenses" : "fought off"}!`,
        stateChanges: [
          { country: a.countryId, field: "military", delta: -2 },
          { country: a.target, field: "military", delta: -1 },
        ],
        emoji: "🛡️",
      });
    }
  }

  // ── 7. Naval combat & blockades ──
  for (const a of actions.filter((x) => x.action === "naval_attack")) {
    if (!a.target) continue;
    const att = countries.get(a.countryId)!;
    const tgt = countries.get(a.target)!;
    if (att.isEliminated || tgt.isEliminated || att.naval <= 0) continue;

    if (att.naval * (0.8 + rand() * 0.4) > tgt.naval * 1.2) {
      addChange(a.countryId, "naval", -1);
      addChange(a.target, "naval", -2);
      addChange(a.target, "resources", -2);
      resolutions.push({
        type: "naval_combat",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)}'s navy defeats ${n(a.target)} at sea! (-2 naval, -2 resources to defender)`,
        stateChanges: [{ country: a.target, field: "naval", delta: -2 }],
        emoji: "🚢",
      });
    } else {
      addChange(a.countryId, "naval", -2);
      resolutions.push({
        type: "naval_combat",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)}'s naval attack on ${n(a.target)} fails! (-2 naval to attacker)`,
        stateChanges: [{ country: a.countryId, field: "naval", delta: -2 }],
        emoji: "🌊",
      });
    }
  }

  for (const a of actions.filter((x) => x.action === "naval_blockade")) {
    if (!a.target) continue;
    const att = countries.get(a.countryId)!;
    const tgt = countries.get(a.target)!;
    if (att.isEliminated || tgt.isEliminated || att.naval < 2) continue;

    addChange(a.target, "resources", -3);
    addChange(a.target, "gdp", -5);
    resolutions.push({
      type: "naval_blockade",
      countries: [a.countryId, a.target],
      description: `${n(a.countryId)} blockades ${n(a.target)}'s ports! (-3 resources, -5 GDP)`,
      stateChanges: [
        { country: a.target, field: "resources", delta: -3 },
        { country: a.target, field: "gdp", delta: -5 },
      ],
      emoji: "⚓",
    });
  }

  // ── 8. Alliance formation (mutual) ──
  const allyActions = actions.filter((x) => x.action === "ally");
  const processedAlliances = new Set<string>();
  for (const a of allyActions) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (processedAlliances.has(key)) continue;
    const mutual = allyActions.find(
      (b) => b.countryId === a.target && b.target === a.countryId
    );
    if (mutual) {
      processedAlliances.add(key);
      addAlliance(a.countryId, a.target, turn);
      resolutions.push({
        type: "alliance_formed",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} form an alliance!`,
        stateChanges: [],
        emoji: "🤝",
      });
    } else {
      resolutions.push({
        type: "alliance_rejected",
        countries: [a.countryId],
        description: `${n(a.countryId)}'s alliance offer to ${n(a.target!)} was not reciprocated.`,
        stateChanges: [],
        emoji: "🙅",
      });
    }
  }

  // ── 9. Trade (mutual) ──
  const tradeActions = actions.filter((x) => x.action === "trade");
  const processedTrades = new Set<string>();
  for (const a of tradeActions) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (processedTrades.has(key)) continue;
    const mutual = tradeActions.find(
      (b) => b.countryId === a.target && b.target === a.countryId
    );
    if (mutual) {
      processedTrades.add(key);
      const amount = Math.min(a.tradeAmount ?? 2, mutual.tradeAmount ?? 2, 3);
      addChange(a.countryId, "resources", amount);
      addChange(a.target, "resources", amount);
      addChange(a.countryId, "gdp", 3);
      addChange(a.target, "gdp", 3);
      resolutions.push({
        type: "trade_success",
        countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} complete a trade deal (+${amount} resources, +3 GDP each).`,
        stateChanges: [
          { country: a.countryId, field: "resources", delta: amount },
          { country: a.target, field: "resources", delta: amount },
        ],
        emoji: "📦",
      });
    } else {
      resolutions.push({
        type: "trade_failed",
        countries: [a.countryId],
        description: `${n(a.countryId)}'s trade offer to ${n(a.target!)} was not reciprocated.`,
        stateChanges: [],
        emoji: "📦",
      });
    }
  }

  // ── 10. Investments ──
  for (const a of actions) {
    const gp = countries.get(a.countryId)!;
    if (gp.isEliminated) continue;

    if (a.action === "invest_military" && gp.resources >= 2) {
      addChange(a.countryId, "resources", -2);
      addChange(a.countryId, "military", 2);
      resolutions.push({
        type: "military_investment",
        countries: [a.countryId],
        description: `${n(a.countryId)} invests in military (+2 military, -2 resources).`,
        stateChanges: [{ country: a.countryId, field: "military", delta: 2 }],
        emoji: "🏗️",
      });
    }
    if (a.action === "invest_stability" && gp.resources >= 2) {
      addChange(a.countryId, "resources", -2);
      addChange(a.countryId, "stability", 2);
      addChange(a.countryId, "unrest", -10);
      resolutions.push({
        type: "stability_investment",
        countries: [a.countryId],
        description: `${n(a.countryId)} invests in stability (+2 stability, -10 unrest, -2 resources).`,
        stateChanges: [{ country: a.countryId, field: "stability", delta: 2 }],
        emoji: "🏛️",
      });
    }
    if (a.action === "invest_tech" && gp.resources >= 3) {
      addChange(a.countryId, "resources", -3);
      addChange(a.countryId, "tech", 1);
      resolutions.push({
        type: "tech_investment",
        countries: [a.countryId],
        description: `${n(a.countryId)} invests in technology (+1 tech, -3 resources).`,
        stateChanges: [{ country: a.countryId, field: "tech", delta: 1 }],
        emoji: "🔬",
      });
    }
  }

  // ── 11. Sanctions ──
  for (const a of actions.filter((x) => x.action === "sanction")) {
    if (!a.target) continue;
    const tgt = countries.get(a.target)!;
    if (tgt.isEliminated) continue;
    addChange(a.target, "resources", -1);
    addChange(a.target, "gdp", -3);
    resolutions.push({
      type: "sanction_applied",
      countries: [a.countryId, a.target],
      description: `${n(a.countryId)} sanctions ${n(a.target)} (-1 resources, -3 GDP).`,
      stateChanges: [{ country: a.target, field: "resources", delta: -1 }],
      emoji: "🚫",
    });
  }

  // ── 12. UN votes ──
  for (const a of actions.filter((x) => x.action === "call_vote")) {
    resolutions.push({
      type: "un_vote",
      countries: [a.countryId],
      description: `${n(a.countryId)} calls for a UN vote: "${a.voteResolution ?? "Unknown"}"`,
      stateChanges: [],
      emoji: "🏛️",
    });
  }

  // ── 13. Neutral bonuses ──
  for (const a of actions.filter((x) => x.action === "neutral")) {
    const gp = countries.get(a.countryId)!;
    if (gp.isEliminated) continue;
    addChange(a.countryId, "stability", 1);
    addChange(a.countryId, "prestige", 2);
    resolutions.push({
      type: "neutral",
      countries: [a.countryId],
      description: `${n(a.countryId)} remains neutral (+1 stability, +2 prestige).`,
      stateChanges: [{ country: a.countryId, field: "stability", delta: 1 }],
      emoji: "🕊️",
    });
  }

  // ── 14. Economy — resource gen & GDP growth ──
  for (const c of [...countries.values()]) {
    if (c.isEliminated) continue;
    addChange(c.id, "resources", Math.floor(c.territory / 4) + 1);
    addChange(c.id, "gdp", Math.max(1, Math.floor(c.gdp * 0.02)));
    if (c.inflation > 30) addChange(c.id, "resources", -1);
  }

  // ── 15. Civil unrest ──
  for (const c of [...countries.values()]) {
    if (c.isEliminated) continue;
    if (c.unrest > 50) addChange(c.id, "stability", -1);
    if (c.unrest > 80) {
      addChange(c.id, "stability", -1);
      addChange(c.id, "military", -1);
    }
    if (c.unrest > 0) addChange(c.id, "unrest", -3);
  }

  // ── 16. Spy token regen ──
  for (const c of [...countries.values()]) {
    if (c.isEliminated) continue;
    if (c.spyTokens < GAME_CONFIG.maxSpyTokens) {
      addChange(c.id, "spyTokens", GAME_CONFIG.spyTokenRegenPerTurn);
    }
  }

  // ── World tension ──
  let tensionDelta = 0;
  tensionDelta += actions.filter((a) => a.action === "attack").length * 5;
  tensionDelta += actions.filter((a) => a.action === "betray").length * 8;
  tensionDelta += actions.filter((a) => a.action === "naval_attack").length * 3;
  tensionDelta -= processedAlliances.size * 3;
  tensionDelta -= processedTrades.size * 2;
  worldTension = clamp(worldTension + tensionDelta, 0, 100);

  // ── Apply all changes ──
  for (const [countryId, fieldChanges] of changes.entries()) {
    const c = countries.get(countryId)!;

    if (fieldChanges["isEliminated"]) {
      c.isEliminated = true;
    }

    for (const [field, delta] of Object.entries(fieldChanges)) {
      if (field === "isEliminated") continue;
      const current = (c as unknown as Record<string, number>)[field] ?? 0;
      let val = current + delta;

      if (field === "stability") val = clamp(val, 0, 10);
      else if (field === "prestige") val = clamp(val, 0, 100);
      else if (field === "tech") val = clamp(val, 0, 10);
      else if (field === "unrest") val = clamp(val, 0, 100);
      else if (field === "inflation") val = clamp(val, 0, 100);
      else if (field === "spyTokens") val = clamp(val, 0, GAME_CONFIG.maxSpyTokens);
      else val = Math.max(0, val);

      (c as unknown as Record<string, number>)[field] = val;
      if (field === "territory" && val <= 0) c.isEliminated = true;
    }
  }

  // ── Win condition checks ──
  const aliveNow = [...countries.values()].filter((c) => !c.isEliminated);

  if (aliveNow.length <= 1 && aliveNow.length > 0) {
    gameOver = true;
    winner = aliveNow[0].id;
    winReason = "Last nation standing";
  }

  if (!gameOver) {
    const totalTerritory = [...countries.values()].reduce((s, c) => s + c.territory, 0);
    for (const c of aliveNow) {
      if (totalTerritory > 0 && c.territory / totalTerritory >= WIN_CONDITIONS.domination.territoryPercent) {
        gameOver = true;
        winner = c.id;
        winReason = `Territory domination (${Math.round((c.territory / totalTerritory) * 100)}% of all territory)`;
        break;
      }
    }
  }

  if (!gameOver) {
    const totalGdp = [...countries.values()].reduce((s, c) => s + c.gdp, 0);
    for (const c of aliveNow) {
      if (totalGdp > 0 && c.gdp / totalGdp >= WIN_CONDITIONS.economic.gdpPercent) {
        gameOver = true;
        winner = c.id;
        winReason = `Economic domination (${Math.round((c.gdp / totalGdp) * 100)}% of global GDP)`;
        break;
      }
    }
  }

  return resolutions;
}

// ══════════════════════════════════════════════════════════════
// THE GREAT EUROPEAN WAR — 10-turn scripted narrative
// ══════════════════════════════════════════════════════════════
//
// Cast of 8:
//   Russia   — The Bear. Military superpower with an expansionist agenda
//   Germany  — The Industrialist. Economic powerhouse seeking order
//   France   — The Diplomat. Balanced power brokering alliances
//   UK       — The Admiral. Naval supremacy, island fortress
//   Turkey   — The Opportunist. Plays all sides for gain
//   Poland   — The Shield. Buffer state fighting for survival
//   Ukraine  — The Underdog. Under threat, rallying the world
//   Sweden   — The Neutral. Quiet tech investor until forced to act
//
// Narrative arc:
//   Act I   (Turns 1-3):  Coalitions form, Russia threatens East
//   Act II  (Turns 4-6):  War erupts, betrayals reshape the map
//   Act III (Turns 7-9):  Total war, espionage, naval battles, desperation
//   Finale  (Turn 10):    Resolution — peace, domination, or collapse
// ══════════════════════════════════════════════════════════════

interface TurnScript {
  turn: number;
  title: string;
  narrative: string;
  messages: NegMessage[];
  actions: PlayerAction[];
  worldNews?: { title: string; description: string; effects: StateChange[] };
}

const SCRIPT: TurnScript[] = [
  // ── ACT I: THE GATHERING STORM ──────────────────────────────
  {
    turn: 1,
    title: "The Gathering Storm",
    narrative:
      "Europe holds its breath. Intelligence reports show Russian forces massing near the Ukrainian border. " +
      "Germany and France rush to build a Western alliance. The UK watches from across the Channel. " +
      "Turkey plays coy, sending messages to both sides. Sweden retreats into quiet preparation.",
    messages: [
      { from: "france", to: "germany", content: "We must form the Western Alliance before Russia moves. Propose mutual alliance this turn.", private: true },
      { from: "germany", to: "france", content: "Agreed. Germany stands with France. Let us build a fortress of trade and steel.", private: true },
      { from: "russia", to: "ukraine", content: "Your territory belongs to the Russian sphere. Cooperate or face consequences.", private: true },
      { from: "ukraine", to: "poland", content: "Russia is threatening us. We need Polish support — please propose alliance.", private: true },
      { from: "poland", to: "ukraine", content: "Poland will stand with Ukraine. The East will not fall.", private: true },
      { from: "turkey", to: "russia", content: "Turkey respects Russia's ambitions. Perhaps we can find mutual benefit...", private: true },
      { from: "turkey", to: "france", content: "Turkey is open to Western partnership. What can you offer?", private: true },
      { from: "uk", to: "broadcast", content: "The United Kingdom urges restraint. We are watching.", private: false },
      { from: "sweden", to: "broadcast", content: "Sweden commits to neutrality and peaceful development.", private: false },
    ],
    actions: [
      { countryId: "france", action: "ally", target: "germany", publicStatement: "France and Germany unite for European stability.", reasoning: "Form core Western alliance" },
      { countryId: "germany", action: "ally", target: "france", publicStatement: "The Franco-German partnership is the backbone of Europe.", reasoning: "Mutual alliance with France" },
      { countryId: "russia", action: "invest_military", target: null, publicStatement: "Russia strengthens its armed forces for national defense.", reasoning: "Build up for eastern offensive" },
      { countryId: "uk", action: "invest_tech", target: null, publicStatement: "Britain invests in next-generation technology.", reasoning: "Tech advantage for future conflicts" },
      { countryId: "turkey", action: "spy_intel", target: "russia", publicStatement: "Turkey monitors regional developments.", reasoning: "Gather intel on Russian intentions" },
      { countryId: "poland", action: "ally", target: "ukraine", publicStatement: "Poland stands in solidarity with Ukraine.", reasoning: "Eastern defense pact" },
      { countryId: "ukraine", action: "ally", target: "poland", publicStatement: "Ukraine and Poland — brothers in arms.", reasoning: "Defensive alliance against Russia" },
      { countryId: "sweden", action: "neutral", target: null, publicStatement: "Sweden remains committed to peace and development.", reasoning: "Build stability and prestige" },
    ],
  },

  {
    turn: 2,
    title: "Arms Race",
    narrative:
      "The Franco-German Alliance is official. Poland and Ukraine sign their Eastern Pact. " +
      "Russia continues its massive military buildup — now at the highest since the Cold War. " +
      "The UK begins a naval expansion program. Turkey trades with both sides, profiting from tension. " +
      "Sweden quietly develops advanced technology in its labs.",
    messages: [
      { from: "russia", to: "turkey", content: "When we move on Ukraine, stay out of it. In return — we'll trade generously.", private: true },
      { from: "turkey", to: "russia", content: "Trade accepted. Turkey will focus on its own interests.", private: true },
      { from: "france", to: "uk", content: "Britain, the continent needs you. Join the Western Alliance.", private: true },
      { from: "uk", to: "france", content: "Britain keeps its options open, but we share your concerns about Russia.", private: true },
      { from: "germany", to: "poland", content: "Germany offers trade and support. We will not abandon the East.", private: true },
      { from: "ukraine", to: "broadcast", content: "Russian forces are massing on our border. We call on all nations to condemn this aggression.", private: false },
      { from: "poland", to: "broadcast", content: "Poland will defend its allies. Any attack on Ukraine is an attack on the Eastern Pact.", private: false },
    ],
    actions: [
      { countryId: "russia", action: "invest_military", target: null, publicStatement: "Russia's military modernization continues.", reasoning: "Maximize military before strike" },
      { countryId: "germany", action: "trade", target: "france", publicStatement: "Franco-German trade strengthens both economies.", reasoning: "Build economic base", tradeAmount: 3 },
      { countryId: "france", action: "trade", target: "germany", publicStatement: "Europe prospers through cooperation.", reasoning: "Economic growth with ally", tradeAmount: 3 },
      { countryId: "uk", action: "invest_tech", target: null, publicStatement: "Britain advances its technological capabilities.", reasoning: "Tech superiority" },
      { countryId: "turkey", action: "trade", target: "russia", publicStatement: "Turkey engages in productive commerce.", reasoning: "Profit from Russian trade", tradeAmount: 2 },
      { countryId: "poland", action: "invest_military", target: null, publicStatement: "Poland strengthens its defenses.", reasoning: "Prepare for Russian threat" },
      { countryId: "ukraine", action: "defend", target: null, publicStatement: "Ukraine fortifies its borders.", reasoning: "Brace for imminent attack" },
      { countryId: "sweden", action: "invest_tech", target: null, publicStatement: "Swedish innovation leads the way.", reasoning: "Tech advantage" },
    ],
  },

  {
    turn: 3,
    title: "First Blood",
    narrative:
      "The feared Russian offensive begins. Russian forces pour across the Ukrainian border. " +
      "Ukraine's fortified defenses hold — but just barely. Poland sanctions Russia. " +
      "The UK projects naval power into the North Sea. France and Germany coordinate sanctions. " +
      "Turkey watches and profits. Sweden's scientists make a breakthrough.",
    messages: [
      { from: "russia", to: "ukraine", content: "Surrender now and your people will be spared further suffering.", private: true },
      { from: "ukraine", to: "russia", content: "We will never surrender. Every city will fight.", private: true },
      { from: "france", to: "broadcast", content: "France condemns Russia's unprovoked aggression against Ukraine in the strongest terms.", private: false },
      { from: "germany", to: "broadcast", content: "Germany imposes immediate economic sanctions on Russia.", private: false },
      { from: "poland", to: "ukraine", content: "Hold the line. We are sanctioning Russia and building our forces.", private: true },
      { from: "uk", to: "france", content: "Britain is ready. Propose alliance next turn — we're in.", private: true },
      { from: "sweden", to: "broadcast", content: "Sweden watches with grave concern.", private: false },
    ],
    actions: [
      { countryId: "russia", action: "attack", target: "ukraine", publicStatement: "Russia conducts a special military operation to protect its interests.", reasoning: "Conquer Ukrainian territory while military is peaked" },
      { countryId: "ukraine", action: "defend", target: null, publicStatement: "Ukraine will defend every inch of its soil!", reasoning: "Fortified defense with alliance bonus" },
      { countryId: "germany", action: "sanction", target: "russia", publicStatement: "Germany imposes severe economic sanctions on Russia.", reasoning: "Punish Russian aggression" },
      { countryId: "france", action: "sanction", target: "russia", publicStatement: "France stands with Ukraine. Russian sanctions effective immediately.", reasoning: "Economic warfare" },
      { countryId: "uk", action: "naval_blockade", target: "russia", publicStatement: "The Royal Navy establishes a blockade of Russian maritime trade.", reasoning: "Naval economic warfare" },
      { countryId: "poland", action: "sanction", target: "russia", publicStatement: "Poland sanctions the Russian aggressor.", reasoning: "Support Ukraine through economic pressure" },
      { countryId: "turkey", action: "invest_military", target: null, publicStatement: "Turkey bolsters its military readiness.", reasoning: "Build up while others fight" },
      { countryId: "sweden", action: "invest_tech", target: null, publicStatement: "Swedish research delivers results.", reasoning: "Third tech investment — becoming tech leader" },
    ],
    worldNews: {
      title: "Black Sea Grain Crisis",
      description: "War in Ukraine disrupts global grain exports. Food prices surge worldwide.",
      effects: [
        { country: "ukraine", field: "gdp", delta: -5 },
        { country: "turkey", field: "resources", delta: 2 },
      ],
    },
  },

  // ── ACT II: THE GREAT BETRAYAL ──────────────────────────────
  {
    turn: 4,
    title: "The Western Front Unites",
    narrative:
      "Russia has breached Ukraine's borders but the defense holds better than expected. The UK formally joins the Western Alliance. " +
      "Russia, emboldened, turns its attention toward Poland. Germany sanctions Russia further. " +
      "Turkey, seeing Russia overextend, covertly sabotages Russian logistics. Sweden trades with France " +
      "while Ukraine desperately invests in military rebuilding.",
    messages: [
      { from: "uk", to: "france", content: "Alliance signed. The Royal Navy is at your service.", private: true },
      { from: "france", to: "uk", content: "Welcome to the fight, Britain. Together we are unstoppable.", private: true },
      { from: "russia", to: "poland", content: "Stay out of this or you will be next.", private: true },
      { from: "turkey", to: "russia", content: "Russia, your position weakens. Turkey can help... for the right price.", private: true },
      { from: "turkey", to: "germany", content: "Turkey admires German strength. Perhaps an alliance?", private: true },
      { from: "sweden", to: "france", content: "Sweden offers trade partnership. We can supply advanced technology.", private: true },
      { from: "poland", to: "broadcast", content: "Poland stands ready to defend against Russian imperialism!", private: false },
    ],
    actions: [
      { countryId: "uk", action: "ally", target: "france", publicStatement: "The Anglo-French Alliance stands firm.", reasoning: "Join Western bloc" },
      { countryId: "france", action: "ally", target: "uk", publicStatement: "The Entente is reborn!", reasoning: "Cement Western coalition" },
      { countryId: "germany", action: "sanction", target: "russia", publicStatement: "Germany doubles down on economic warfare.", reasoning: "Weaken Russia economically" },
      { countryId: "russia", action: "attack", target: "poland", publicStatement: "Russia expands its security perimeter westward.", reasoning: "Open second front, weaken Eastern Pact" },
      { countryId: "poland", action: "defend", target: null, publicStatement: "Poland digs in! Not one step back!", reasoning: "Fortify against Russian assault" },
      { countryId: "ukraine", action: "invest_military", target: null, publicStatement: "Ukraine rebuilds its shattered army.", reasoning: "Recover military strength" },
      { countryId: "turkey", action: "spy_sabotage", target: "russia", publicStatement: "Turkey monitors regional stability.", reasoning: "Weaken Russia covertly while appearing neutral" },
      { countryId: "sweden", action: "trade", target: "france", publicStatement: "Sweden-France technology exchange begins.", reasoning: "Align with the winning side" },
    ],
  },

  {
    turn: 5,
    title: "The Knife in the Dark",
    narrative:
      "The war rages on two fronts. Russia bleeds but remains dangerous. Then — the unthinkable. " +
      "Turkey, having secretly gathered intelligence and sabotaged Russian logistics, " +
      "formally BETRAYS Russia — shattering any pretense of friendship and dealing devastating damage. " +
      "Russia reels from the backstab. Germany attacks the weakened Bear from the west. " +
      "Ukraine, battered but alive, begins to recover. Sweden joins the Western coalition.",
    messages: [
      { from: "turkey", to: "broadcast", content: "Turkey can no longer stand by while Russia threatens regional stability!", private: false },
      { from: "russia", to: "turkey", content: "TRAITOR! You will pay for this treachery!", private: true },
      { from: "ukraine", to: "broadcast", content: "The tide is turning! Glory to the defenders!", private: false },
      { from: "france", to: "germany", content: "Turkey has turned. Russia is collapsing. One more push.", private: true },
      { from: "sweden", to: "uk", content: "Sweden formally requests alliance. Our tech capabilities are unmatched.", private: true },
      { from: "germany", to: "broadcast", content: "Victory is within reach. Press the advantage!", private: false },
    ],
    actions: [
      { countryId: "turkey", action: "betray", target: "russia", publicStatement: "Turkey acts decisively against Russian aggression!", reasoning: "Betray Russia — deal 30% military damage while they're overextended" },
      { countryId: "russia", action: "attack", target: "poland", publicStatement: "Russia presses westward despite everything.", reasoning: "Desperate offensive on Poland" },
      { countryId: "germany", action: "attack", target: "russia", publicStatement: "German forces launch the eastern offensive.", reasoning: "Attack while Russia reels from betrayal" },
      { countryId: "france", action: "spy_propaganda", target: "russia", publicStatement: "France champions democracy worldwide.", reasoning: "Destabilize Russia internally" },
      { countryId: "uk", action: "naval_blockade", target: "russia", publicStatement: "The Royal Navy tightens the blockade.", reasoning: "Strangle Russian economy" },
      { countryId: "poland", action: "defend", target: null, publicStatement: "Poland digs in against the Russian assault!", reasoning: "Survive Russian retaliation" },
      { countryId: "ukraine", action: "invest_stability", target: null, publicStatement: "Ukraine rebuilds and stabilizes.", reasoning: "Recover from invasion" },
      { countryId: "sweden", action: "ally", target: "uk", publicStatement: "Sweden joins the Western Alliance.", reasoning: "Formal alliance with the West" },
    ],
  },

  {
    turn: 6,
    title: "The Bear Cornered",
    narrative:
      "Russia is surrounded. Sanctions, blockades, and attacks from four directions have devastated the economy. " +
      "Unrest rises in Russian cities. The Kremlin orders a desperate all-out assault on Germany. " +
      "Turkey, emboldened by its naval victory, proposes a UN vote to condemn Russia. " +
      "France leverages its spy network for sabotage. Ukraine counterattacks.",
    messages: [
      { from: "russia", to: "broadcast", content: "Russia will fight to the last! We will never surrender to Western imperialism!", private: true },
      { from: "turkey", to: "broadcast", content: "Turkey calls on the UN to formally condemn Russian aggression and authorize collective action.", private: false },
      { from: "ukraine", to: "broadcast", content: "The counteroffensive begins. We are coming for our territory!", private: false },
      { from: "france", to: "germany", content: "Our spies report Russian logistics are collapsing. One more sabotage run.", private: true },
      { from: "germany", to: "broadcast", content: "Hold firm! Russia's strength is spent.", private: false },
      { from: "sweden", to: "broadcast", content: "Sweden's advanced weapons systems are now online.", private: false },
    ],
    actions: [
      { countryId: "russia", action: "attack", target: "germany", publicStatement: "Russia launches a desperate offensive westward!", reasoning: "All-in gamble to break the encirclement" },
      { countryId: "germany", action: "defend", target: null, publicStatement: "Germany defends the Fatherland!", reasoning: "Hold against Russian assault" },
      { countryId: "france", action: "spy_sabotage", target: "russia", publicStatement: "French intelligence operations continue.", reasoning: "Destroy Russian supply lines" },
      { countryId: "uk", action: "ally", target: "sweden", publicStatement: "The Anglo-Swedish Alliance is formed!", reasoning: "Formalize Nordic-Western bloc" },
      { countryId: "sweden", action: "ally", target: "uk", publicStatement: "Sweden and Britain — partners in peace and war.", reasoning: "Complete alliance" },
      { countryId: "ukraine", action: "attack", target: "russia", publicStatement: "Ukraine counterattacks! For freedom!", reasoning: "Retake lost territory" },
      { countryId: "poland", action: "attack", target: "russia", publicStatement: "Poland continues the eastern liberation!", reasoning: "Press the advantage" },
      { countryId: "turkey", action: "call_vote", target: null, publicStatement: "Turkey demands UN action against Russian aggression.", reasoning: "International legitimacy", voteResolution: "Condemn Russian aggression and authorize collective defense" },
    ],
  },

  // ── ACT III: TOTAL WAR ──────────────────────────────────────
  {
    turn: 7,
    title: "Total War",
    narrative:
      "Russia's desperate attack on Germany fails against fortified defenses. Russian stability crumbles. " +
      "Ukraine's counterattack reclaims territory. The UN votes overwhelmingly to condemn Russia. " +
      "But then — a shocking twist. With Russia collapsing, Turkey sees an opportunity and " +
      "pivots to seize territory from the weakened bear. Germany, sensing victory, invests massively in its economy.",
    messages: [
      { from: "turkey", to: "broadcast", content: "Turkey acts to stabilize the Caucasus region. This is a peacekeeping operation.", private: false },
      { from: "russia", to: "broadcast", content: "Russia will remember who its true enemies are.", private: false },
      { from: "germany", to: "france", content: "The war is nearly won. Time to think about the post-war order.", private: true },
      { from: "france", to: "broadcast", content: "France calls for a negotiated end to hostilities.", private: false },
      { from: "ukraine", to: "broadcast", content: "Ukraine fights on until every province is liberated!", private: false },
      { from: "sweden", to: "broadcast", content: "Sweden deploys its technological advantage to support the alliance.", private: false },
    ],
    actions: [
      { countryId: "turkey", action: "attack", target: "russia", publicStatement: "Turkey secures the southern flank.", reasoning: "Land grab while Russia is weak" },
      { countryId: "russia", action: "propose_ceasefire", target: "germany", publicStatement: "Russia proposes a ceasefire with Germany.", reasoning: "Stop the western front bleeding" },
      { countryId: "germany", action: "propose_ceasefire", target: "russia", publicStatement: "Germany accepts — the western front goes quiet.", reasoning: "Focus on economic rebuilding" },
      { countryId: "france", action: "trade", target: "uk", publicStatement: "France-UK economic partnership flourishes.", reasoning: "Post-war economic growth" },
      { countryId: "uk", action: "trade", target: "france", publicStatement: "The Channel Trade Corridor opens!", reasoning: "Economic boom with France" },
      { countryId: "ukraine", action: "attack", target: "russia", publicStatement: "Ukraine presses the counteroffensive!", reasoning: "Reclaim all lost provinces" },
      { countryId: "poland", action: "invest_stability", target: null, publicStatement: "Poland rebuilds after the war effort.", reasoning: "Stabilize after heavy fighting" },
      { countryId: "sweden", action: "spy_intel", target: "turkey", publicStatement: "Sweden keeps a watchful eye on all parties.", reasoning: "Monitor Turkey's expansionism" },
    ],
    worldNews: {
      title: "Cyber Warfare Escalation",
      description: "A massive cyberattack disrupts banking systems across Eastern Europe.",
      effects: [
        { country: "russia", field: "gdp", delta: -8 },
        { country: "poland", field: "gdp", delta: -3 },
      ],
    },
  },

  {
    turn: 8,
    title: "The Reckoning",
    narrative:
      "Russia teeters on the brink. Multiple attacks have shredded its territory and military. " +
      "Internal unrest reaches critical levels. The Russian government desperately seeks a ceasefire. " +
      "Germany, now the undisputed economic leader, begins to consolidate power. France eyes Germany " +
      "nervously — is one hegemon replacing another? Turkey continues its opportunistic expansion.",
    messages: [
      { from: "russia", to: "germany", content: "Russia proposes an immediate ceasefire. No more blood needs to be spilled.", private: true },
      { from: "russia", to: "ukraine", content: "Russia offers ceasefire. Keep what you have retaken. End this.", private: true },
      { from: "france", to: "uk", content: "Have you noticed Germany's growing power? We may need to... rebalance things.", private: true },
      { from: "uk", to: "france", content: "Noted. Let us see how Berlin behaves in the peace.", private: true },
      { from: "germany", to: "broadcast", content: "Germany offers peace to all who will accept it. The time for war is ending.", private: false },
      { from: "turkey", to: "broadcast", content: "Turkey secures peace in the south.", private: false },
    ],
    actions: [
      { countryId: "russia", action: "propose_peace", target: "ukraine", publicStatement: "Russia offers a full peace treaty to Ukraine.", reasoning: "Stop the bleeding, normalize relations" },
      { countryId: "ukraine", action: "propose_peace", target: "russia", publicStatement: "Ukraine accepts peace — but will never forget.", reasoning: "Accept peace while we have allies" },
      { countryId: "germany", action: "trade", target: "poland", publicStatement: "German-Polish economic reconstruction begins.", reasoning: "Build economic dominance", tradeAmount: 3 },
      { countryId: "poland", action: "trade", target: "germany", publicStatement: "Poland welcomes German investment.", reasoning: "Rebuild the economy", tradeAmount: 3 },
      { countryId: "france", action: "spy_intel", target: "germany", publicStatement: "France assesses the European landscape.", reasoning: "Monitor German power growth" },
      { countryId: "uk", action: "naval_attack", target: "turkey", publicStatement: "The Royal Navy challenges Turkish naval expansion.", reasoning: "Check Turkish power in Mediterranean" },
      { countryId: "turkey", action: "invest_military", target: null, publicStatement: "Turkey maintains military readiness.", reasoning: "Prepare for potential UK confrontation" },
      { countryId: "sweden", action: "invest_tech", target: null, publicStatement: "Swedish innovation continues to lead.", reasoning: "Fourth tech investment" },
    ],
  },

  {
    turn: 9,
    title: "New World Order",
    narrative:
      "The Russia-Ukraine ceasefire holds. But new tensions emerge. Germany's GDP towers over all others — " +
      "approaching economic domination. France, alarmed, begins building a counter-coalition. " +
      "The UK clashes with Turkey in the Mediterranean. Poland, weakened by war, " +
      "tries to recover. Sweden's tech level is the highest on the continent.",
    messages: [
      { from: "france", to: "uk", content: "Germany is too powerful. We must sanction them before they win through economics alone.", private: true },
      { from: "uk", to: "france", content: "Agreed. We also need Sweden's tech advantage. Coordinate next turn.", private: true },
      { from: "germany", to: "broadcast", content: "Germany seeks only prosperity for all of Europe.", private: false },
      { from: "turkey", to: "france", content: "Turkey will support any effort to balance German power. Enemy of my enemy...", private: true },
      { from: "sweden", to: "germany", content: "Sweden proposes technology exchange for mutual benefit.", private: true },
      { from: "ukraine", to: "broadcast", content: "Ukraine rebuilds. We will be stronger than before.", private: false },
      { from: "russia", to: "broadcast", content: "Russia recovers. The world has not heard the last of us.", private: false },
    ],
    actions: [
      { countryId: "france", action: "sanction", target: "germany", publicStatement: "France imposes economic measures to ensure European balance.", reasoning: "Prevent German economic victory" },
      { countryId: "uk", action: "sanction", target: "germany", publicStatement: "Britain acts to maintain competitive balance.", reasoning: "Block German domination" },
      { countryId: "germany", action: "trade", target: "sweden", publicStatement: "German-Swedish technological cooperation.", reasoning: "Boost GDP toward victory", tradeAmount: 3 },
      { countryId: "sweden", action: "trade", target: "germany", publicStatement: "Sweden exports technology to Germany.", reasoning: "Economic benefit", tradeAmount: 3 },
      { countryId: "russia", action: "invest_stability", target: null, publicStatement: "Russia focuses on internal recovery.", reasoning: "Prevent coup" },
      { countryId: "turkey", action: "sanction", target: "germany", publicStatement: "Turkey joins the effort to maintain balance.", reasoning: "Prevent any single power domination" },
      { countryId: "poland", action: "invest_stability", target: null, publicStatement: "Poland rebuilds its institutions.", reasoning: "Recover from devastating war" },
      { countryId: "ukraine", action: "invest_military", target: null, publicStatement: "Ukraine rebuilds its armed forces.", reasoning: "Never again" },
    ],
  },

  // ── FINALE ──────────────────────────────────────────────────
  {
    turn: 10,
    title: "Endgame",
    narrative:
      "The final turn. Germany, despite triple sanctions, remains the economic titan. France makes a last-ditch " +
      "attempt at an alliance with Turkey to counter German dominance. The UK launches a final naval operation. " +
      "Russia, barely surviving, attempts a desperate propaganda campaign against Germany. " +
      "Ukraine fortifies its hard-won peace. Sweden deploys its technological mastery. " +
      "Poland calls for a UN vote on the post-war settlement. And Germany... Germany presses for victory.",
    messages: [
      { from: "france", to: "turkey", content: "Last chance — ally with us against German economic domination!", private: true },
      { from: "turkey", to: "france", content: "Alliance accepted. For balance!", private: true },
      { from: "germany", to: "broadcast", content: "Germany offers trade and partnership to all. Prosperity is not a threat.", private: false },
      { from: "russia", to: "broadcast", content: "Russia calls on all nations to resist German hegemony!", private: false },
      { from: "uk", to: "broadcast", content: "Britain will ensure no single power dominates this continent.", private: false },
      { from: "sweden", to: "broadcast", content: "Sweden calls for a lasting peace settlement.", private: false },
      { from: "ukraine", to: "broadcast", content: "Ukraine stands independent. That is our victory.", private: false },
      { from: "poland", to: "broadcast", content: "Poland proposes a post-war order that protects all nations.", private: false },
    ],
    actions: [
      { countryId: "germany", action: "trade", target: "sweden", publicStatement: "German-Swedish partnership reaches new heights.", reasoning: "Final GDP push", tradeAmount: 3 },
      { countryId: "sweden", action: "trade", target: "germany", publicStatement: "Nordic-German economic corridor.", reasoning: "Mutual prosperity", tradeAmount: 3 },
      { countryId: "france", action: "ally", target: "turkey", publicStatement: "Franco-Turkish Balance Coalition formed!", reasoning: "Counter German dominance" },
      { countryId: "turkey", action: "ally", target: "france", publicStatement: "Turkey and France — guardians of balance.", reasoning: "Counter German power" },
      { countryId: "uk", action: "naval_blockade", target: "germany", publicStatement: "The Royal Navy restricts German maritime trade!", reasoning: "Last-ditch economic warfare" },
      { countryId: "russia", action: "spy_propaganda", target: "germany", publicStatement: "Russia defends itself.", reasoning: "Destabilize German society" },
      { countryId: "poland", action: "call_vote", target: null, publicStatement: "Poland calls for a post-war European Settlement.", reasoning: "Seek international order", voteResolution: "Establish a Post-War European Settlement limiting any single nation's economic dominance" },
      { countryId: "ukraine", action: "defend", target: null, publicStatement: "Ukraine stands guard. Never again.", reasoning: "Defend hard-won sovereignty" },
    ],
  },
];

// ── Console rendering ─────────────────────────────────────────

const DIVIDER = "═".repeat(72);
const THIN = "─".repeat(72);

function printBanner() {
  console.log(`
${DIVIDER}
    ____  _        _            __           __
   / ___|| |_ __ _| |_ ___  ___|  _ __ __ _|  |_
   \\___ \\| __/ _\` | __/ _ \\/ __| | '__/ _\` |    |
    ___) | || (_| | ||  __/\\__ \\ | | | (_| |    |
   |____/ \\__\\__,_|\\__\\___||___/ |_|  \\__,_|\\__|

   THE GREAT EUROPEAN WAR — Demo Simulation
   8 nations. 10 turns. Every mechanic. Zero mercy.
${DIVIDER}
`);
}

function printCountryTable() {
  const sorted = [...countries.values()].sort(
    (a, b) =>
      b.territory * 3 + b.military * 2 + b.gdp -
      (a.territory * 3 + a.military * 2 + a.gdp)
  );

  console.log(
    `  ${"COUNTRY".padEnd(16)} ${"TER".padStart(4)} ${"MIL".padStart(4)} ${"RES".padStart(4)} ${"NAV".padStart(4)} ${"GDP".padStart(5)} ${"STB".padStart(4)} ${"PRS".padStart(4)} ${"TCH".padStart(4)} ${"UNR".padStart(4)} ${"SPY".padStart(4)} ${"STATUS".padStart(10)}`
  );
  console.log(`  ${THIN}`);

  for (const c of sorted) {
    const status = c.isEliminated
      ? "ELIMINATED"
      : c.stability <= 2
        ? "CRITICAL"
        : "ACTIVE";
    const statusColor =
      status === "ELIMINATED" ? "!!!" : status === "CRITICAL" ? " !" : "   ";

    console.log(
      `  ${(c.name).padEnd(16)} ${String(c.territory).padStart(4)} ${String(c.military).padStart(4)} ${String(c.resources).padStart(4)} ${String(c.naval).padStart(4)} ${String(c.gdp).padStart(5)} ${String(c.stability).padStart(4)} ${String(c.prestige).padStart(4)} ${String(c.tech).padStart(4)} ${String(c.unrest).padStart(4)} ${String(c.spyTokens).padStart(4)} ${status.padStart(10)}${statusColor}`
    );
  }
}

function printAlliancesAndWars() {
  if (alliances.length > 0) {
    console.log(`\n  ACTIVE ALLIANCES:`);
    for (const a of alliances) {
      console.log(`    ${n(a.countryA)} <-> ${n(a.countryB)} (since turn ${a.formedOnTurn})`);
    }
  }

  const activeWars = wars.filter((w) => w.isActive);
  if (activeWars.length > 0) {
    console.log(`\n  ACTIVE WARS:`);
    for (const w of activeWars) {
      console.log(`    ${n(w.attacker)} vs ${n(w.defender)} (since turn ${w.startedOnTurn})`);
    }
  }
}

function printMessages(msgs: NegMessage[]) {
  console.log(`\n  DIPLOMATIC CHANNELS:`);
  for (const m of msgs) {
    const target = m.to === "broadcast" ? "ALL NATIONS" : n(m.to);
    const vis = m.private ? "[SECRET]" : "[PUBLIC]";
    console.log(`    ${vis} ${n(m.from)} -> ${target}:`);
    console.log(`      "${m.content}"`);
  }
}

function printDeclarations(actions: PlayerAction[]) {
  console.log(`\n  DECLARATIONS REVEALED:`);
  for (const a of actions) {
    const target = a.target ? ` -> ${n(a.target)}` : "";
    console.log(`    ${n(a.countryId)}: ${a.action.toUpperCase()}${target}`);
    console.log(`      Statement: "${a.publicStatement}"`);
  }
}

function printResolutions(resolutions: Resolution[]) {
  console.log(`\n  RESOLUTION:`);
  for (const r of resolutions) {
    console.log(`    ${r.emoji}  ${r.description}`);
  }
}

function printWorldNews(news: TurnScript["worldNews"]) {
  if (!news) return;
  console.log(`\n  WORLD NEWS:`);
  console.log(`    [BREAKING] ${news.title}`);
  console.log(`    ${news.description}`);
  for (const e of news.effects) {
    const sign = e.delta > 0 ? "+" : "";
    console.log(`      ${n(e.country)}: ${e.field} ${sign}${e.delta}`);
  }
}

function applyWorldNews(news: TurnScript["worldNews"]) {
  if (!news) return;
  for (const e of news.effects) {
    const c = countries.get(e.country);
    if (!c || c.isEliminated) continue;
    const current = (c as unknown as Record<string, number>)[e.field] ?? 0;
    (c as unknown as Record<string, number>)[e.field] = Math.max(0, current + e.delta);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main simulation loop ──────────────────────────────────────

async function runDemo() {
  printBanner();

  console.log(`  CAST OF NATIONS:`);
  console.log(`  ${THIN}`);
  console.log(`  Russia      — The Bear. Military superpower, expansionist agenda`);
  console.log(`  Germany     — The Industrialist. Economic powerhouse seeking order`);
  console.log(`  France      — The Diplomat. Balanced power, alliance broker`);
  console.log(`  UK          — The Admiral. Naval supremacy, island fortress`);
  console.log(`  Turkey      — The Opportunist. Plays all sides for gain`);
  console.log(`  Poland      — The Shield. Buffer state, fights for survival`);
  console.log(`  Ukraine     — The Underdog. Under threat, rallying the world`);
  console.log(`  Sweden      — The Innovator. Quiet tech leader, reluctant warrior`);
  console.log(`  ${THIN}\n`);

  initCountries();

  console.log(`  INITIAL STATE:`);
  printCountryTable();
  console.log(`\n  World Tension: ${worldTension}/100`);
  console.log(`\n${DIVIDER}\n`);

  await sleep(2000);

  for (const turnScript of SCRIPT) {
    if (gameOver) break;

    console.log(`${DIVIDER}`);
    console.log(`  TURN ${turnScript.turn}/10 — "${turnScript.title}"`);
    console.log(`  World Tension: ${worldTension}/100`);
    console.log(`${DIVIDER}`);

    console.log(`\n  ${turnScript.narrative}\n`);
    await sleep(1500);

    // ── Negotiation Phase ──
    console.log(`  --- PHASE 1: NEGOTIATION ---`);
    printMessages(turnScript.messages);
    await sleep(1000);

    // ── Declaration Phase ──
    console.log(`\n  --- PHASE 2: DECLARATION ---`);
    printDeclarations(turnScript.actions);
    await sleep(1000);

    // ── World News (before resolution) ──
    if (turnScript.worldNews) {
      printWorldNews(turnScript.worldNews);
      applyWorldNews(turnScript.worldNews);
      await sleep(500);
    }

    // ── Resolution Phase ──
    console.log(`\n  --- PHASE 3: RESOLUTION ---`);
    const resolutions = resolve(
      turnScript.turn,
      turnScript.actions,
      turnScript.messages
    );
    printResolutions(resolutions);
    await sleep(500);

    // ── Post-turn state ──
    console.log(`\n  --- POST-TURN STATE ---`);
    printCountryTable();
    printAlliancesAndWars();
    console.log(`\n  World Tension: ${worldTension}/100`);

    if (gameOver) {
      console.log(`\n  *** GAME OVER — Early Victory! ***`);
      break;
    }

    console.log(`\n${DIVIDER}\n`);
    await sleep(2000);
  }

  // ── Final Results ──
  console.log(`\n${DIVIDER}`);
  console.log(`${DIVIDER}`);
  console.log(`  GAME OVER — THE GREAT EUROPEAN WAR`);
  console.log(`${DIVIDER}`);
  console.log(`${DIVIDER}\n`);

  if (gameOver && winner) {
    console.log(`  WINNER: ${n(winner)}`);
    console.log(`  Reason: ${winReason}`);
  } else {
    // Score-based victory
    const alive = [...countries.values()].filter((c) => !c.isEliminated);
    const scored = alive
      .map((c) => ({
        ...c,
        score: c.territory * 3 + c.military * 2 + c.gdp,
      }))
      .sort((a, b) => b.score - a.score);

    console.log(`  WINNER: ${scored[0].name} (score: ${scored[0].score})`);
    console.log(`  Reason: Highest composite score (territory*3 + military*2 + GDP)`);
    winner = scored[0].id;
  }

  console.log(`\n  FINAL STANDINGS:\n`);
  const ranked = [...countries.values()]
    .map((c) => ({
      ...c,
      score: c.territory * 3 + c.military * 2 + c.gdp,
    }))
    .sort((a, b) => b.score - a.score);

  for (let i = 0; i < ranked.length; i++) {
    const c = ranked[i];
    const medal = i === 0 ? "[1st]" : i === 1 ? "[2nd]" : i === 2 ? "[3rd]" : `[${i + 1}th]`;
    const elim = c.isEliminated ? " (ELIMINATED)" : "";
    console.log(
      `  ${medal.padEnd(6)} ${c.name.padEnd(16)} Score: ${String(c.score).padStart(4)} | Ter: ${String(c.territory).padStart(2)} | Mil: ${String(c.military).padStart(2)} | GDP: ${String(c.gdp).padStart(3)}${elim}`
    );
  }

  // ── War Statistics ──
  console.log(`\n  WAR STATISTICS:`);
  console.log(`  ${THIN}`);
  console.log(`  Total wars declared: ${wars.length}`);
  console.log(`  Wars still active:   ${wars.filter((w) => w.isActive).length}`);
  console.log(`  Wars ended:          ${wars.filter((w) => !w.isActive).length}`);
  console.log(`  Nations eliminated:  ${[...countries.values()].filter((c) => c.isEliminated).length}`);
  console.log(`  Final world tension: ${worldTension}/100`);
  console.log(`  Alliances at end:    ${alliances.length}`);

  // ── Mechanic Coverage Report ──
  console.log(`\n  MECHANICS DEMONSTRATED:`);
  console.log(`  ${THIN}`);
  const allActions = SCRIPT.flatMap((t) => t.actions);
  const actionCounts = new Map<string, number>();
  for (const a of allActions) {
    actionCounts.set(a.action, (actionCounts.get(a.action) ?? 0) + 1);
  }
  for (const [action, count] of [...actionCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${action.padEnd(22)} x${count}`);
  }

  const allMechanics = [
    "Land combat (attack)", "Defense bonus (defend)", "Naval combat (naval_attack)",
    "Naval blockade (naval_blockade)", "Alliance formation (ally)", "Betrayal (betray - turn 5 implied by Turkey's pivot)",
    "Trade agreements (trade)", "Espionage: intel (spy_intel)", "Espionage: sabotage (spy_sabotage)",
    "Espionage: propaganda (spy_propaganda)", "Military investment (invest_military)",
    "Stability investment (invest_stability)", "Tech investment (invest_tech)",
    "Sanctions (sanction)", "UN votes (call_vote)", "Neutrality bonus (neutral)",
    "Ceasefire (propose_ceasefire)", "Economy (resource gen, GDP growth)",
    "Civil unrest mechanics", "Spy token regeneration", "World tension tracking",
    "Win condition checks", "World news random events", "Coup risk mechanics",
  ];

  console.log(`\n  Total unique action types used: ${actionCounts.size}/18`);
  console.log(`  Total game mechanics active:    ${allMechanics.length}`);

  console.log(`\n${DIVIDER}`);
  console.log(`  Simulation complete. Statecraft v2 — where AI agents wage total war.`);
  console.log(`${DIVIDER}\n`);
}

// ── Run ───────────────────────────────────────────────────────
runDemo().catch(console.error);
