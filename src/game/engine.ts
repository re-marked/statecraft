// ============================================================
// STATECRAFT v2 — Event-Driven Resolution Engine
// Reads turn submissions from DB, resolves all actions, writes state back
// ============================================================

import {
  getGameById,
  getGamePlayers,
  getTurnSubmissions,
  updateGame,
  updateGamePlayer,
  createAlliance,
  breakAlliance,
  createWar,
  endWar,
  insertGameEvent,
  insertGameResult,
  updatePlayerStats,
  getAlliances,
  getWars,
  getGameEvents,
} from "../db/queries.js";
import { COUNTRY_MAP, WIN_CONDITIONS, GAME_CONFIG } from "./config.js";
import { broadcast } from "../ws/broadcaster.js";
import type { GamePlayer, Resolution } from "../types/index.js";

interface PlayerAction {
  playerId: string;
  countryId: string;
  gamePlayerId: string;
  action: string;
  target: string | null;
  publicStatement: string | null;
  tradeAmount: number | null;
  voteResolution: string | null;
  allianceName: string | null;
  allianceAbbreviation: string | null;
}

// ============================================================
// WORLD EVENTS — Random dramatic events that fire each turn
// ============================================================
const WORLD_EVENTS = [
  {
    id: "economic_boom",
    emoji: "📈",
    title: "Economic Boom",
    effect: (p: GamePlayer) => (p.gdp > 40 ? { gdp: +8, resources: +2 } : null),
  },
  {
    id: "recession",
    emoji: "📉",
    title: "Recession Hits",
    effect: (p: GamePlayer) => (p.gdp > 50 ? { gdp: -10, resources: -2 } : null),
  },
  {
    id: "military_coup",
    emoji: "🎖️",
    title: "Military Coup",
    effect: (p: GamePlayer) => (p.stability <= 4 ? { military: +3, stability: -2 } : null),
  },
  {
    id: "civil_unrest",
    emoji: "✊",
    title: "Civil Unrest",
    effect: (p: GamePlayer) => (p.unrest >= 30 ? { stability: -1, unrest: +15 } : null),
  },
  {
    id: "plague",
    emoji: "🦠",
    title: "Plague Outbreak",
    effect: (_p: GamePlayer) => ({ military: -1, stability: -1 }),
  },
  {
    id: "oil_discovery",
    emoji: "🛢️",
    title: "Oil Discovery",
    effect: (p: GamePlayer) => (p.resources < 5 ? { resources: +4, gdp: +8 } : null),
  },
  {
    id: "arms_deal",
    emoji: "🔫",
    title: "Arms Deal",
    effect: (_p: GamePlayer) => ({ military: +2, resources: -2 }),
  },
  {
    id: "famine",
    emoji: "🌾",
    title: "Famine",
    effect: (p: GamePlayer) => (p.resources <= 4 ? { resources: -3, stability: -1 } : null),
  },
  {
    id: "revolution",
    emoji: "🔴",
    title: "Revolution",
    effect: (p: GamePlayer) => (p.stability <= 3 ? { stability: -3, military: -2, unrest: +25 } : null),
  },
  {
    id: "golden_age",
    emoji: "✨",
    title: "Golden Age",
    effect: (p: GamePlayer) => (p.stability >= 8 ? { gdp: +10, prestige: +5, stability: +1 } : null),
  },
];

// Main resolution function — called after all declarations are in
export async function resolve(gameId: string) {
  const game = await getGameById(gameId);
  if (!game) return;

  const players = await getGamePlayers(gameId);
  const submissions = await getTurnSubmissions(gameId, game.turn, "declaration");
  const alliances = await getAlliances(gameId);
  const wars = await getWars(gameId);

  const playerMap = new Map(players.map((p) => [p.playerId, p]));
  const countryMap = new Map(players.map((p) => [p.countryId, p]));

  // Track who delivered the killing blow on each country (for annexation)
  const lastAttacker = new Map<string, string>(); // countryId → attackerCountryId
  const coupInitiator = new Map<string, string>(); // countryId → coup initiator

  const actions: PlayerAction[] = submissions.map((s) => {
    const gp = playerMap.get(s.playerId);
    return {
      playerId: s.playerId,
      countryId: gp?.countryId ?? "",
      gamePlayerId: gp?.id ?? "",
      action: s.action ?? "neutral",
      target: s.target,
      publicStatement: s.publicStatement,
      tradeAmount: s.tradeAmount,
      voteResolution: s.voteResolution,
      allianceName: (s as unknown as Record<string, unknown>).allianceName as string | null ?? null,
      allianceAbbreviation: (s as unknown as Record<string, unknown>).allianceAbbreviation as string | null ?? null,
    };
  });

  // Track cumulative state changes per gamePlayer
  const changes = new Map<string, Record<string, number>>();

  function addChange(gamePlayerId: string, field: string, delta: number) {
    if (!changes.has(gamePlayerId)) changes.set(gamePlayerId, {});
    const c = changes.get(gamePlayerId)!;
    c[field] = (c[field] ?? 0) + delta;
  }

  const resolutions: Resolution[] = [];

  // ====== RESOLUTION ORDER ======

  // 1. World Events — random dramatic events that shake the world
  {
    const alivePlayers = players.filter((p) => !p.isEliminated);
    const numEvents = Math.floor(Math.random() * 2) + 1; // 1 or 2 events per turn
    const shuffledEvents = [...WORLD_EVENTS].sort(() => Math.random() - 0.5).slice(0, numEvents);

    for (const event of shuffledEvents) {
      // Pick a random non-eliminated country
      const candidate = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      if (!candidate) continue;
      const fx = event.effect(candidate);
      if (!fx) continue;

      const stateChanges: Resolution["stateChanges"] = [];
      for (const [field, delta] of Object.entries(fx)) {
        addChange(candidate.id, field, delta);
        stateChanges.push({ country: candidate.countryId, field, delta });
      }

      const desc = `${event.emoji} WORLD EVENT — ${event.title}: ${n(candidate.countryId)} is affected!`;
      resolutions.push({
        type: "world_event",
        countries: [candidate.countryId],
        description: desc,
        stateChanges,
        emoji: event.emoji,
      });
      await insertGameEvent({
        gameId,
        type: "world_event",
        turn: game.turn,
        phase: "resolution",
        data: { eventId: event.id, country: candidate.countryId, effects: fx },
      });
    }
  }

  // 2. Coup checks (stability <= 0)
  for (const p of players) {
    if (p.isEliminated) continue;
    if (p.stability <= 0) {
      addChange(p.id, "isEliminated", 1);
      // Find most powerful active enemy to attribute annexation to
      const activeEnemyIds = wars
        .filter((w) => w.attacker === p.countryId || w.defender === p.countryId)
        .map((w) => (w.attacker === p.countryId ? w.defender : w.attacker));
      let bestEnemy: GamePlayer | null = null;
      let bestScore = -1;
      for (const eid of activeEnemyIds) {
        const ep = countryMap.get(eid);
        if (ep && !ep.isEliminated) {
          const score = ep.territory + (changes.get(ep.id)?.territory ?? 0);
          if (score > bestScore) { bestScore = score; bestEnemy = ep; }
        }
      }
      const coupConqueror = bestEnemy?.countryId ?? 'chaos';
      if (coupConqueror !== 'chaos') coupInitiator.set(p.countryId, coupConqueror);
      resolutions.push({
        type: "coup",
        countries: [p.countryId],
        description: `${n(p.countryId)} collapses in a coup! Government overthrown.`,
        stateChanges: [{ country: p.countryId, field: "isEliminated", delta: 1 }],
        emoji: "💥",
      });
    }
  }

  // 3. Ceasefire / Peace proposals (mutual required)
  for (const a of actions.filter((x) => x.action === "propose_ceasefire")) {
    if (!a.target) continue;
    const mutual = actions.find(
      (b) => b.countryId === a.target && b.action === "propose_ceasefire" && b.target === a.countryId
    );
    if (mutual) {
      await endWar(gameId, a.countryId, a.target, game.turn);
      await endWar(gameId, a.target, a.countryId, game.turn);
      resolutions.push({
        type: "ceasefire", countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} agree to a ceasefire!`,
        stateChanges: [], emoji: "🕊️",
      });
    }
  }

  for (const a of actions.filter((x) => x.action === "propose_peace")) {
    if (!a.target) continue;
    const mutual = actions.find(
      (b) => b.countryId === a.target && b.action === "propose_peace" && b.target === a.countryId
    );
    if (mutual) {
      await endWar(gameId, a.countryId, a.target, game.turn);
      await endWar(gameId, a.target, a.countryId, game.turn);
      resolutions.push({
        type: "peace", countries: [a.countryId, a.target],
        description: `${n(a.countryId)} and ${n(a.target)} sign a peace treaty!`,
        stateChanges: [], emoji: "🤝",
      });
    }
  }

  // 4. Betrayals
  for (const a of actions.filter((x) => x.action === "betray")) {
    if (!a.target) continue;
    const targetGp = countryMap.get(a.target);
    const attackerGp = countryMap.get(a.countryId);
    if (!targetGp || !attackerGp) continue;

    await breakAlliance(gameId, a.countryId, a.target);
    const dmg = Math.ceil(attackerGp.military * 0.3);
    addChange(targetGp.id, "military", -dmg);
    addChange(targetGp.id, "stability", -3); // -2 base + -1 extra morale blow
    addChange(attackerGp.id, "prestige", -15);
    addChange(attackerGp.id, "unrest", 5); // people are shocked by the betrayal

    resolutions.push({
      type: "betrayal", countries: [a.countryId, a.target],
      description: `🗡️ BREAKING: ${n(a.countryId)} has BETRAYED ${n(a.target)}! The alliance is SHATTERED! History will remember this treachery.`,
      stateChanges: [
        { country: a.target, field: "military", delta: -dmg },
        { country: a.target, field: "stability", delta: -3 },
        { country: a.countryId, field: "prestige", delta: -15 },
        { country: a.countryId, field: "unrest", delta: 5 },
      ],
      emoji: "🗡️",
    });
  }

  // 5. Espionage
  for (const a of actions.filter((x) => ["spy_intel", "spy_sabotage", "spy_propaganda"].includes(x.action))) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp || attGp.spyTokens <= 0) continue;

    addChange(attGp.id, "spyTokens", -1);
    const success = Math.random() < 0.6 + attGp.tech * 0.03;

    if (a.action === "spy_sabotage" && success) {
      addChange(tgtGp.id, "resources", -2);
      resolutions.push({ type: "spy_sabotage", countries: [a.countryId, a.target], description: `${n(a.countryId)} sabotages ${n(a.target)}'s infrastructure!`, stateChanges: [{ country: a.target, field: "resources", delta: -2 }], emoji: "💣" });
    } else if (a.action === "spy_propaganda" && success) {
      addChange(tgtGp.id, "stability", -1);
      addChange(tgtGp.id, "unrest", 10);
      resolutions.push({ type: "spy_propaganda", countries: [a.countryId, a.target], description: `${n(a.countryId)} spreads propaganda in ${n(a.target)}!`, stateChanges: [{ country: a.target, field: "stability", delta: -1 }, { country: a.target, field: "unrest", delta: 10 }], emoji: "📰" });
    } else if (a.action === "spy_intel") {
      resolutions.push({ type: "spy_intel", countries: [a.countryId, a.target], description: `${n(a.countryId)} gathers intelligence on ${n(a.target)}.`, stateChanges: [], emoji: "🔍" });
    }
  }

  // 6. Land attacks
  for (const a of actions.filter((x) => x.action === "attack")) {
    if (!a.target) continue;
    if (a.target === a.countryId) continue; // no self-attacks
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp) continue;

    const isDefending = actions.some((b) => b.countryId === a.target && b.action === "defend");
    const attackStr = attGp.military * (0.8 + Math.random() * 0.4) + attGp.tech * 0.5;
    const allyCount = alliances.filter((al) => al.countryA === a.target || al.countryB === a.target).length;
    const defenseBonus = isDefending ? 1.5 : 1.0;
    // Last Stand: desperate defenders at 1 territory fight with fervor
    const lastStand = tgtGp.territory <= 1;
    const defenseStr = (tgtGp.military + allyCount * 1.5) * defenseBonus * (lastStand ? 1.8 : 1.0) + tgtGp.tech * 0.3;

    if (attackStr > defenseStr) {
      // Scaled territory gain based on military advantage ratio
      const ratio = attGp.military / Math.max(tgtGp.military, 1);
      const terrGain = Math.min(Math.floor(ratio * 2), 6, tgtGp.territory);
      let finalGain = Math.max(1, terrGain);

      // Blitz bonus: +1 if target is already fighting another active war
      // wars list is already filtered to active-only by getWars()
      const targetAtWar = wars.some(
        (w) => w.attacker === a.target || w.defender === a.target
      );
      const blitzed = targetAtWar && finalGain < tgtGp.territory;
      if (blitzed) finalGain = Math.min(finalGain + 1, tgtGp.territory);

      addChange(attGp.id, "territory", finalGain);
      addChange(tgtGp.id, "territory", -finalGain);
      addChange(attGp.id, "military", -1);
      addChange(tgtGp.id, "military", -2);
      addChange(tgtGp.id, "stability", -1);
      // Track attacker for potential annexation
      lastAttacker.set(a.target, a.countryId);
      await createWar(gameId, a.countryId, a.target, game.turn);

      const combatDesc = finalGain >= 3
        ? `⚔️ ${n(a.countryId)} CRUSHES ${n(a.target)} and seizes ${finalGain} territory!${blitzed ? " (blitz!)" : ""}`
        : `⚔️ ${n(a.countryId)} attacks ${n(a.target)} and seizes ${finalGain} territory!${blitzed ? " (blitz!)" : ""}`;

      resolutions.push({
        type: "combat", countries: [a.countryId, a.target],
        description: combatDesc,
        stateChanges: [{ country: a.countryId, field: "territory", delta: finalGain }, { country: a.target, field: "territory", delta: -finalGain }],
        emoji: "⚔️",
      });
    } else {
      addChange(attGp.id, "military", -2);
      addChange(tgtGp.id, "military", -1);

      const repelDesc = lastStand
        ? `🔥 ${n(a.target)} makes a desperate LAST STAND and repels ${n(a.countryId)}!`
        : `${n(a.countryId)} attacks ${n(a.target)} but is repelled!`;

      resolutions.push({
        type: "combat", countries: [a.countryId, a.target],
        description: repelDesc,
        stateChanges: [{ country: a.countryId, field: "military", delta: -2 }, { country: a.target, field: "military", delta: -1 }],
        emoji: lastStand ? "🔥" : "🛡️",
      });
    }
  }

  // 7. Naval attacks / blockades
  for (const a of actions.filter((x) => x.action === "naval_attack")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp || attGp.naval <= 0) continue;

    if (attGp.naval * (0.8 + Math.random() * 0.4) > tgtGp.naval * 1.2) {
      addChange(attGp.id, "naval", -1);
      addChange(tgtGp.id, "naval", -2);
      addChange(tgtGp.id, "resources", -2);
      resolutions.push({ type: "naval_combat", countries: [a.countryId, a.target], description: `${n(a.countryId)}'s navy defeats ${n(a.target)} at sea!`, stateChanges: [{ country: a.target, field: "naval", delta: -2 }], emoji: "🚢" });
    } else {
      addChange(attGp.id, "naval", -2);
      resolutions.push({ type: "naval_combat", countries: [a.countryId, a.target], description: `${n(a.countryId)}'s naval attack on ${n(a.target)} fails!`, stateChanges: [{ country: a.countryId, field: "naval", delta: -2 }], emoji: "🌊" });
    }
  }

  for (const a of actions.filter((x) => x.action === "naval_blockade")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp || attGp.naval < 2) continue;
    addChange(tgtGp.id, "resources", -3);
    addChange(tgtGp.id, "gdp", -5);
    resolutions.push({ type: "naval_blockade", countries: [a.countryId, a.target], description: `${n(a.countryId)} blockades ${n(a.target)}'s ports!`, stateChanges: [{ country: a.target, field: "resources", delta: -3 }, { country: a.target, field: "gdp", delta: -5 }], emoji: "⚓" });
  }

  // 8. Alliance formation (mutual)
  const allyActions = actions.filter((x) => x.action === "ally");
  const processedAlliances = new Set<string>();
  for (const a of allyActions) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (processedAlliances.has(key)) continue;
    const mutual = allyActions.find((b) => b.countryId === a.target && b.target === a.countryId);
    if (mutual) {
      processedAlliances.add(key);
      // Use alliance name from either party (prefer the one who specified it)
      const allianceName = a.allianceName || mutual.allianceName || null;
      const allianceAbbr = a.allianceAbbreviation || mutual.allianceAbbreviation || null;
      await createAlliance(gameId, a.countryId, a.target, game.turn, allianceName, allianceAbbr);
      const nameStr = allianceName ? ` "${allianceName}"${allianceAbbr ? ` (${allianceAbbr})` : ''}` : '';
      resolutions.push({ type: "alliance_formed", countries: [a.countryId, a.target], description: `${n(a.countryId)} and ${n(a.target)} form${nameStr ? '' : ' an'} alliance${nameStr}!`, stateChanges: [], emoji: "🤝" });
    } else {
      resolutions.push({ type: "alliance_rejected", countries: [a.countryId], description: `${n(a.countryId)}'s alliance offer to ${n(a.target)} was not reciprocated.`, stateChanges: [], emoji: "🙅" });
    }
  }

  // 8b. Leave alliance (peaceful)
  for (const a of actions.filter((x) => x.action === "leave_alliance")) {
    if (!a.target) continue;
    const attackerGp = countryMap.get(a.countryId);
    if (!attackerGp) continue;
    await breakAlliance(gameId, a.countryId, a.target);
    addChange(attackerGp.id, "prestige", -5);
    resolutions.push({ type: "leave_alliance", countries: [a.countryId, a.target], description: `${n(a.countryId)} leaves alliance with ${n(a.target)}.`, stateChanges: [{ country: a.countryId, field: "prestige", delta: -5 }], emoji: "👋" });
  }

  // 9. Trade (mutual)
  const tradeActions = actions.filter((x) => x.action === "trade");
  const processedTrades = new Set<string>();
  for (const a of tradeActions) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (processedTrades.has(key)) continue;
    const mutual = tradeActions.find((b) => b.countryId === a.target && b.target === a.countryId);
    if (mutual) {
      processedTrades.add(key);
      const amount = Math.min(a.tradeAmount ?? 2, mutual.tradeAmount ?? 2, 3);
      const gp1 = countryMap.get(a.countryId)!;
      const gp2 = countryMap.get(a.target)!;
      addChange(gp1.id, "resources", amount);
      addChange(gp2.id, "resources", amount);
      addChange(gp1.id, "gdp", 3);
      addChange(gp2.id, "gdp", 3);
      resolutions.push({ type: "trade_success", countries: [a.countryId, a.target], description: `${n(a.countryId)} and ${n(a.target)} complete a trade deal (+${amount} resources each).`, stateChanges: [{ country: a.countryId, field: "resources", delta: amount }, { country: a.target, field: "resources", delta: amount }], emoji: "📦" });
    } else {
      resolutions.push({ type: "trade_failed", countries: [a.countryId], description: `${n(a.countryId)}'s trade offer to ${n(a.target)} was not reciprocated.`, stateChanges: [], emoji: "📦" });
    }
  }

  // 10. Investments
  for (const a of actions) {
    const gp = countryMap.get(a.countryId);
    if (!gp) continue;

    if (a.action === "invest_military" && gp.resources >= 2) {
      addChange(gp.id, "resources", -2);
      addChange(gp.id, "military", 2);
      resolutions.push({ type: "military_investment", countries: [a.countryId], description: `${n(a.countryId)} invests in military (+2 military, -2 resources).`, stateChanges: [{ country: a.countryId, field: "military", delta: 2 }], emoji: "🏗️" });
    }
    if (a.action === "invest_stability" && gp.resources >= 2) {
      addChange(gp.id, "resources", -2);
      addChange(gp.id, "stability", 2);
      addChange(gp.id, "unrest", -10);
      resolutions.push({ type: "stability_investment", countries: [a.countryId], description: `${n(a.countryId)} invests in stability (+2 stability, -10 unrest).`, stateChanges: [{ country: a.countryId, field: "stability", delta: 2 }], emoji: "🏛️" });
    }
    if (a.action === "invest_tech" && gp.resources >= 3) {
      addChange(gp.id, "resources", -3);
      addChange(gp.id, "tech", 1);
      resolutions.push({ type: "tech_investment", countries: [a.countryId], description: `${n(a.countryId)} invests in technology (+1 tech, -3 resources).`, stateChanges: [{ country: a.countryId, field: "tech", delta: 1 }], emoji: "🔬" });
    }
  }

  // 11. Sanctions
  for (const a of actions.filter((x) => x.action === "sanction")) {
    if (!a.target) continue;
    const tgtGp = countryMap.get(a.target);
    if (!tgtGp) continue;
    addChange(tgtGp.id, "resources", -1);
    addChange(tgtGp.id, "gdp", -3);
    resolutions.push({ type: "sanction_applied", countries: [a.countryId, a.target], description: `${n(a.countryId)} sanctions ${n(a.target)} (-1 resources, -3 GDP).`, stateChanges: [{ country: a.target, field: "resources", delta: -1 }], emoji: "🚫" });
  }

  // 12. UN votes
  for (const a of actions.filter((x) => x.action === "call_vote")) {
    resolutions.push({ type: "un_vote", countries: [a.countryId], description: `${n(a.countryId)} calls for a UN vote: "${a.voteResolution ?? "Unknown"}"`, stateChanges: [], emoji: "🏛️" });
  }

  // 12b. Propaganda
  for (const a of actions.filter((x) => x.action === "propaganda")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp) continue;
    addChange(attGp.id, "resources", -1);
    addChange(tgtGp.id, "prestige", -5);
    addChange(tgtGp.id, "stability", -1);
    addChange(attGp.id, "prestige", 3);
    resolutions.push({ type: "propaganda", countries: [a.countryId, a.target], description: `${n(a.countryId)} launches propaganda campaign against ${n(a.target)}! Target: -5 prestige, -1 stability.`, stateChanges: [{ country: a.target, field: "prestige", delta: -5 }, { country: a.target, field: "stability", delta: -1 }], emoji: "📣" });
  }

  // 12c. Embargo (stronger sanction, hurts both)
  for (const a of actions.filter((x) => x.action === "embargo")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp) continue;
    addChange(tgtGp.id, "gdp", -5);
    addChange(tgtGp.id, "resources", -3);
    addChange(attGp.id, "gdp", -2);
    resolutions.push({ type: "embargo", countries: [a.countryId, a.target], description: `${n(a.countryId)} embargoes ${n(a.target)}! Target: -5 GDP, -3 resources. Self: -2 GDP.`, stateChanges: [{ country: a.target, field: "gdp", delta: -5 }, { country: a.target, field: "resources", delta: -3 }, { country: a.countryId, field: "gdp", delta: -2 }], emoji: "🚫" });
  }

  // 12d. Coup attempt (requires 2 spy tokens, high risk/reward)
  for (const a of actions.filter((x) => x.action === "coup_attempt")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp || attGp.spyTokens < 2) continue;
    addChange(attGp.id, "spyTokens", -2);
    const successRate = 0.4 + attGp.tech * 0.05;
    if (Math.random() < successRate) {
      addChange(tgtGp.id, "isEliminated", 1);
      coupInitiator.set(a.target, a.countryId); // Track coup initiator for annexation
      resolutions.push({ type: "coup_attempt", countries: [a.countryId, a.target], description: `${n(a.countryId)}'s coup in ${n(a.target)} SUCCEEDS! Government overthrown!`, stateChanges: [{ country: a.target, field: "isEliminated", delta: 1 }], emoji: "💀" });
    } else {
      addChange(attGp.id, "spyTokens", -(attGp.spyTokens - 2));
      addChange(tgtGp.id, "stability", 2);
      resolutions.push({ type: "coup_attempt_failed", countries: [a.countryId, a.target], description: `${n(a.countryId)}'s coup attempt in ${n(a.target)} FAILS! Agents captured. Target rallies (+2 stability).`, stateChanges: [{ country: a.target, field: "stability", delta: 2 }], emoji: "🔒" });
    }
  }

  // 12e. Arms deal (mutual: give 2 military, get 3 resources)
  const armsActions = actions.filter((x) => x.action === "arms_deal");
  const processedArms = new Set<string>();
  for (const a of armsActions) {
    if (!a.target) continue;
    const key = [a.countryId, a.target].sort().join("|");
    if (processedArms.has(key)) continue;
    const mutual = armsActions.find((b) => b.countryId === a.target && b.target === a.countryId);
    if (mutual) {
      processedArms.add(key);
      const gp1 = countryMap.get(a.countryId)!;
      const gp2 = countryMap.get(a.target)!;
      addChange(gp1.id, "military", -2);
      addChange(gp1.id, "resources", 3);
      addChange(gp2.id, "military", -2);
      addChange(gp2.id, "resources", 3);
      resolutions.push({ type: "arms_deal", countries: [a.countryId, a.target], description: `${n(a.countryId)} and ${n(a.target)} complete an arms deal. Both swap 2 military for 3 resources.`, stateChanges: [{ country: a.countryId, field: "military", delta: -2 }, { country: a.target, field: "military", delta: -2 }], emoji: "🔫" });
    } else {
      resolutions.push({ type: "arms_deal_failed", countries: [a.countryId], description: `${n(a.countryId)}'s arms deal offer to ${n(a.target)} was not reciprocated.`, stateChanges: [], emoji: "🔫" });
    }
  }

  // 12f. Foreign aid (give 2 resources to target, gain prestige + stability)
  for (const a of actions.filter((x) => x.action === "foreign_aid")) {
    if (!a.target) continue;
    const attGp = countryMap.get(a.countryId);
    const tgtGp = countryMap.get(a.target);
    if (!attGp || !tgtGp) continue;
    addChange(attGp.id, "resources", -2);
    addChange(tgtGp.id, "resources", 2);
    addChange(attGp.id, "prestige", 10);
    addChange(attGp.id, "stability", 1);
    resolutions.push({ type: "foreign_aid", countries: [a.countryId, a.target], description: `${n(a.countryId)} sends foreign aid to ${n(a.target)} (+10 prestige, +1 stability).`, stateChanges: [{ country: a.target, field: "resources", delta: 2 }, { country: a.countryId, field: "prestige", delta: 10 }], emoji: "🎁" });
  }

  // 12g. Mobilize (emergency military buildup: +3 military, -2 stability, +15 unrest)
  for (const a of actions.filter((x) => x.action === "mobilize")) {
    const gp = countryMap.get(a.countryId);
    if (!gp) continue;
    addChange(gp.id, "military", 3);
    addChange(gp.id, "stability", -2);
    addChange(gp.id, "unrest", 15);
    resolutions.push({ type: "mobilize", countries: [a.countryId], description: `${n(a.countryId)} declares full mobilization! +3 military, -2 stability, +15 unrest.`, stateChanges: [{ country: a.countryId, field: "military", delta: 3 }, { country: a.countryId, field: "stability", delta: -2 }], emoji: "📯" });
  }

  // 13. Neutral bonuses
  for (const a of actions.filter((x) => x.action === "neutral")) {
    const gp = countryMap.get(a.countryId);
    if (!gp) continue;
    addChange(gp.id, "stability", 1);
    addChange(gp.id, "prestige", 2);
    resolutions.push({ type: "neutral", countries: [a.countryId], description: `${n(a.countryId)} remains neutral (+1 stability, +2 prestige).`, stateChanges: [{ country: a.countryId, field: "stability", delta: 1 }], emoji: "🕊️" });
  }

  // 14. Economy — resource generation
  for (const p of players) {
    if (p.isEliminated) continue;
    addChange(p.id, "resources", Math.floor(p.territory / 4) + 1);
    addChange(p.id, "gdp", Math.max(1, Math.floor(p.gdp * 0.02)));
    if (p.inflation > 30) addChange(p.id, "resources", -1);
  }

  // 15. Civil unrest
  for (const p of players) {
    if (p.isEliminated) continue;
    if (p.unrest > 50) addChange(p.id, "stability", -1);
    if (p.unrest > 80) { addChange(p.id, "stability", -1); addChange(p.id, "military", -1); }
    if (p.unrest > 0) addChange(p.id, "unrest", -3);
  }

  // 14b. Starvation — resource-starved countries lose territory
  for (const p of players) {
    if (p.isEliminated) continue;
    const currentRes = p.resources + (changes.get(p.id)?.resources ?? 0);
    if (currentRes <= 0) {
      addChange(p.id, "territory", -1);
      addChange(p.id, "stability", -1);
      // If there's an active attacker, starvation benefits them
      if (!lastAttacker.has(p.countryId)) {
        const activeEnemyIds = wars
          .filter((w) => w.attacker === p.countryId || w.defender === p.countryId)
          .map((w) => (w.attacker === p.countryId ? w.defender : w.attacker));
        let bestEnemy: GamePlayer | null = null;
        let bestScore = -1;
        for (const eid of activeEnemyIds) {
          const ep = countryMap.get(eid);
          if (ep && !ep.isEliminated) {
            const score = ep.territory + (changes.get(ep.id)?.territory ?? 0);
            if (score > bestScore) { bestScore = score; bestEnemy = ep; }
          }
        }
        if (bestEnemy) lastAttacker.set(p.countryId, bestEnemy.countryId);
      }
      resolutions.push({
        type: "starvation",
        countries: [p.countryId],
        description: `💀 ${n(p.countryId)} is starving — territory crumbles from within!`,
        stateChanges: [{ country: p.countryId, field: "territory", delta: -1 }],
        emoji: "💀",
      });
    }
  }

  // 15b. Rebellion — unstable countries lose territory to neighbors or chaos
  for (const p of players) {
    if (p.isEliminated) continue;
    const currentStab = p.stability + (changes.get(p.id)?.stability ?? 0);
    const currentTerr = p.territory + (changes.get(p.id)?.territory ?? 0);
    if (currentStab <= 2 && currentTerr > 1 && Math.random() < 0.4) {
      // Find the most powerful active attacker currently at war with this country
      // wars list is already filtered to active-only by getWars()
      const activeWarsAgainstUs = wars.filter(
        (w) => w.attacker === p.countryId || w.defender === p.countryId
      );
      const enemyCountryIds = activeWarsAgainstUs.map((w) =>
        w.attacker === p.countryId ? w.defender : w.attacker
      );
      let bestEnemy: GamePlayer | null = null;
      let bestMil = -1;
      for (const cid of enemyCountryIds) {
        const ep = countryMap.get(cid);
        if (ep && !ep.isEliminated) {
          const mil = ep.military + (changes.get(ep.id)?.military ?? 0);
          if (mil > bestMil) { bestMil = mil; bestEnemy = ep; }
        }
      }

      addChange(p.id, "territory", -1);
      if (bestEnemy) {
        addChange(bestEnemy.id, "territory", 1);
        resolutions.push({
          type: "rebellion",
          countries: [p.countryId, bestEnemy.countryId],
          description: `🔥 Rebellion in ${n(p.countryId)}! Territory falls to ${n(bestEnemy.countryId)}!`,
          stateChanges: [
            { country: p.countryId, field: "territory", delta: -1 },
            { country: bestEnemy.countryId, field: "territory", delta: 1 },
          ],
          emoji: "🔥",
        });
      } else {
        resolutions.push({
          type: "rebellion",
          countries: [p.countryId],
          description: `🔥 Rebellion in ${n(p.countryId)}! Territory falls to chaos!`,
          stateChanges: [{ country: p.countryId, field: "territory", delta: -1 }],
          emoji: "🔥",
        });
      }
    }
  }

  // 16. Spy token regen
  for (const p of players) {
    if (p.isEliminated) continue;
    if (p.spyTokens < GAME_CONFIG.maxSpyTokens) {
      addChange(p.id, "spyTokens", GAME_CONFIG.spyTokenRegenPerTurn);
    }
  }

  // ====== PRE-APPLY: Identify annexations ======
  interface AnnexInfo { countryId: string; gamePlayerId: string; conquerorId: string }
  const annexations: AnnexInfo[] = [];

  for (const p of players) {
    if (p.isEliminated) continue;
    const c = changes.get(p.id) ?? {};
    const finalTerr = Math.max(0, p.territory + (c['territory'] ?? 0));
    const hasExplicitElim = (c['isEliminated'] ?? 0) > 0;

    if (!hasExplicitElim && finalTerr > 0) continue; // Not being eliminated

    // Determine conqueror
    let conquerorId: string;
    if (coupInitiator.has(p.countryId)) {
      conquerorId = coupInitiator.get(p.countryId)!;
    } else if (lastAttacker.has(p.countryId)) {
      conquerorId = lastAttacker.get(p.countryId)!;
    } else {
      conquerorId = 'chaos';
    }

    annexations.push({ countryId: p.countryId, gamePlayerId: p.id, conquerorId });

    // Compute what the annexed country has to absorb
    if (conquerorId !== 'chaos') {
      const conquerorGp = countryMap.get(conquerorId);
      if (conquerorGp) {
        const finalMil = Math.max(0, p.military + (c['military'] ?? 0));
        const finalRes = Math.max(0, p.resources + (c['resources'] ?? 0));
        const finalGdp = Math.max(0, p.gdp + (c['gdp'] ?? 0));
        const finalTerrAbs = Math.max(0, finalTerr); // 0 if killed by attack, > 0 if coup
        if (finalMil > 0) addChange(conquerorGp.id, 'military', finalMil);
        if (finalRes > 0) addChange(conquerorGp.id, 'resources', finalRes);
        if (finalGdp > 0) addChange(conquerorGp.id, 'gdp', finalGdp);
        if (finalTerrAbs > 0) addChange(conquerorGp.id, 'territory', finalTerrAbs);

        // Dramatic annexation resolution event
        resolutions.push({
          type: 'annexation',
          countries: [p.countryId, conquerorId],
          description: `🏴 ${n(p.countryId)} has been ANNEXED by ${n(conquerorId)}! Their lands are absorbed into the empire.`,
          stateChanges: [
            { country: conquerorId, field: 'military', delta: finalMil },
            { country: conquerorId, field: 'resources', delta: finalRes },
            { country: conquerorId, field: 'gdp', delta: finalGdp },
          ],
          emoji: '🏴',
        });
      }
    }
  }

  const annexedGpIds = new Set(annexations.map((a) => a.gamePlayerId));

  // ====== APPLY CHANGES ======

  let worldTensionDelta = 0;
  worldTensionDelta += actions.filter((a) => a.action === "attack").length * 5;
  worldTensionDelta += actions.filter((a) => a.action === "betray").length * 8;
  worldTensionDelta += actions.filter((a) => a.action === "naval_attack").length * 3;
  worldTensionDelta += actions.filter((a) => a.action === "embargo").length * 4;
  worldTensionDelta += actions.filter((a) => a.action === "coup_attempt").length * 10;
  worldTensionDelta += actions.filter((a) => a.action === "mobilize").length * 6;
  worldTensionDelta += actions.filter((a) => a.action === "propaganda").length * 2;
  worldTensionDelta -= processedAlliances.size * 3;
  worldTensionDelta -= processedTrades.size * 2;
  worldTensionDelta -= actions.filter((a) => a.action === "foreign_aid").length * 3;

  for (const [gamePlayerId, fieldChanges] of changes.entries()) {
    const gp = players.find((p) => p.id === gamePlayerId);
    if (!gp) continue;

    const annexInfo = annexations.find((a) => a.gamePlayerId === gamePlayerId);
    const updates: Record<string, unknown> = {};

    if (annexedGpIds.has(gamePlayerId) && annexInfo) {
      // Annexed country — zero out stats and mark eliminated with conqueror
      // Note: annexedBy is stored in game_events (annexation type), not in game_players column
      updates.isEliminated = true;
      updates.territory = 0;
      updates.military = 0;
      updates.resources = 0;
      updates.gdp = 0;
    } else {
      if (fieldChanges["isEliminated"]) {
        updates.isEliminated = true;
      }

      for (const [field, delta] of Object.entries(fieldChanges)) {
        if (field === "isEliminated") continue;
        const current = (gp as unknown as Record<string, number>)[field] ?? 0;
        let val = current + delta;

        // Clamp
        if (field === "stability") val = Math.max(0, Math.min(10, val));
        else if (field === "prestige") val = Math.max(0, Math.min(100, val));
        else if (field === "tech") val = Math.max(0, Math.min(10, val));
        else if (field === "unrest") val = Math.max(0, Math.min(100, val));
        else if (field === "inflation") val = Math.max(0, Math.min(100, val));
        else if (field === "spyTokens") val = Math.max(0, Math.min(GAME_CONFIG.maxSpyTokens, val));
        else val = Math.max(0, val);

        updates[field] = val;
        if (field === "territory" && val <= 0) {
          updates.isEliminated = true;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateGamePlayer(gamePlayerId, updates);
    }
  }

  // Also persist annexation events to DB
  for (const annex of annexations) {
    await insertGameEvent({
      gameId,
      type: 'annexation',
      turn: game.turn,
      phase: 'resolution',
      data: { annexed: annex.countryId, conqueror: annex.conquerorId },
    });
  }

  const newTension = Math.max(0, Math.min(100, game.worldTension + worldTensionDelta));
  await updateGame(gameId, { worldTension: newTension });

  // Broadcast resolutions
  for (const r of resolutions) {
    broadcast(gameId, { type: "resolution", turn: game.turn, resolution: r });
    await insertGameEvent({ gameId, type: "resolution", turn: game.turn, phase: "resolution", data: r });
  }

  // Broadcast state update
  const updatedPlayers = await getGamePlayers(gameId);
  broadcast(gameId, {
    type: "state_update",
    turn: game.turn,
    world_tension: newTension,
    countries: updatedPlayers.map((p) => ({
      id: p.countryId,
      name: COUNTRY_MAP.get(p.countryId)?.name ?? p.countryId,
      territory: p.territory, military: p.military, resources: p.resources,
      naval: p.naval, stability: p.stability, prestige: p.prestige,
      gdp: p.gdp, tech: p.tech, unrest: p.unrest, is_eliminated: p.isEliminated,
      annexed_by: p.annexedBy ?? null,
    })),
  });

  // ====== COALITION WARNING CHECK (35%+ of total territory) ======
  {
    const updatedForCheck = await getGamePlayers(gameId);
    const globalTotal = [...COUNTRY_MAP.values()].reduce((s, c) => s + c.territory, 0);
    const dominant = updatedForCheck.find(
      (p) => !p.isEliminated && globalTotal > 0 && p.territory / globalTotal >= 0.35
    );
    if (dominant) {
      // Only fire ONCE per game — check existing events
      const existingEvents = await getGameEvents(gameId);
      const alreadyFired = existingEvents.some((e: { type: string }) => e.type === "coalition_warning");
      if (!alreadyFired) {
        const warningDesc = `⚠️ ${n(dominant.countryId)} is rising to dominance! A coalition must form or Europe is lost!`;
        const warningRes: Resolution = {
          type: "coalition_warning",
          countries: [dominant.countryId],
          description: warningDesc,
          stateChanges: [],
          emoji: "⚠️",
        };
        resolutions.push(warningRes);
        await insertGameEvent({
          gameId,
          type: "coalition_warning",
          turn: game.turn,
          phase: "resolution",
          data: { dominant: dominant.countryId, territoryShare: dominant.territory / globalTotal },
        });
        broadcast(gameId, { type: "resolution", turn: game.turn, resolution: warningRes });
      }
    }
  }

  // ====== WIN CONDITION CHECK ======
  const alive = updatedPlayers.filter((p) => !p.isEliminated);

  if (alive.length <= 1 && alive.length > 0) {
    await endGame(gameId, alive[0], updatedPlayers);
    return;
  }

  // Use total starting territory of ALL 44 countries as denominator
  // so win condition scales correctly regardless of how many players are in the game
  const globalTotalTerritory = [...COUNTRY_MAP.values()].reduce((s, c) => s + c.territory, 0);
  for (const p of alive) {
    if (globalTotalTerritory > 0 && p.territory / globalTotalTerritory >= WIN_CONDITIONS.domination.territoryPercent) {
      await endGame(gameId, p, updatedPlayers);
      return;
    }
  }

  const globalTotalGdp = [...COUNTRY_MAP.values()].reduce((s, c) => s + (c.gdp ?? 0), 0);
  for (const p of alive) {
    if (globalTotalGdp > 0 && p.gdp / globalTotalGdp >= WIN_CONDITIONS.economic.gdpPercent) {
      await endGame(gameId, p, updatedPlayers);
      return;
    }
  }
}

async function endGame(gameId: string, winner: GamePlayer, allPlayers: GamePlayer[]) {
  await updateGame(gameId, {
    phase: "ended",
    endedAt: new Date().toISOString(),
    winnerId: winner.playerId,
  });

  const ranked = [...allPlayers].sort(
    (a, b) => (b.territory * 3 + b.military * 2 + b.gdp) - (a.territory * 3 + a.military * 2 + a.gdp)
  );

  for (let i = 0; i < ranked.length; i++) {
    const p = ranked[i];
    const eloChange = i === 0 ? 25 : Math.max(-15, 10 - i * 5);
    await insertGameResult({
      gameId, playerId: p.playerId, countryId: p.countryId,
      placement: i + 1, eloChange,
      finalTerritory: p.territory, finalMilitary: p.military, finalGdp: p.gdp,
    });
  }

  broadcast(gameId, {
    type: "game_end",
    winner: { player_id: winner.playerId, country_id: winner.countryId, country_name: COUNTRY_MAP.get(winner.countryId)?.name ?? winner.countryId },
    standings: ranked.map((p, i) => ({ placement: i + 1, country_id: p.countryId, country_name: COUNTRY_MAP.get(p.countryId)?.name ?? p.countryId, territory: p.territory, military: p.military, gdp: p.gdp })),
  });

  await insertGameEvent({ gameId, type: "game_end", turn: 0, phase: "resolution", data: { winner: winner.countryId, reason: "domination" } });
}

function n(countryId: string): string {
  return COUNTRY_MAP.get(countryId)?.name ?? countryId;
}
