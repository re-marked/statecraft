// ============================================================
// Turn Scheduler — Deadline timers + turn advancement
// ============================================================

import {
  getGameById,
  getGamePlayers,
  getTurnSubmissions,
  submitTurn,
  updateGame,
  insertGameEvent,
  getAlliances,
  getWars,
  getGameEvents,
  getInboundMessages,
  getWebhookUrls,
} from "../db/queries.js";
import { resolve } from "./engine.js";
import { broadcast } from "../ws/broadcaster.js";
import { GAME_CONFIG, COUNTRY_MAP } from "./config.js";

// ---- In-memory locks (prevent double-advance on concurrent submissions) ----
const advanceLocks = new Map<string, boolean>();

// ---- SSE subscribers: gameId -> Set of event handlers ----
const sseSubscribers = new Map<string, Set<(event: object) => void>>();

export function subscribeToGameEvents(
  gameId: string,
  handler: (event: object) => void
): () => void {
  if (!sseSubscribers.has(gameId)) {
    sseSubscribers.set(gameId, new Set());
  }
  sseSubscribers.get(gameId)!.add(handler);

  return () => {
    const handlers = sseSubscribers.get(gameId);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) sseSubscribers.delete(gameId);
    }
  };
}

function notifySSE(gameId: string, event: object) {
  const handlers = sseSubscribers.get(gameId);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(event);
    } catch {
      handlers.delete(handler);
    }
  }
}

// ---- Webhook dispatcher (fire-and-forget, 5s timeout, no retry) ----
async function dispatchWebhooks(gameId: string) {
  let webhooks: { playerId: string; countryId: string; webhookUrl: string }[];
  try {
    webhooks = await getWebhookUrls(gameId);
  } catch (err) {
    console.warn(`[webhook] Failed to fetch webhook URLs for game ${gameId}:`, err);
    return;
  }

  if (webhooks.length === 0) return;

  // Fetch shared game state once
  let game, allPlayers, alliances, wars, events;
  try {
    [game, allPlayers, alliances, wars, events] = await Promise.all([
      getGameById(gameId),
      getGamePlayers(gameId),
      getAlliances(gameId),
      getWars(gameId),
      getGameEvents(gameId, { turn: undefined, limit: 50 }),
    ]);
  } catch (err) {
    console.warn(`[webhook] Failed to fetch game state for webhook dispatch:`, err);
    return;
  }

  if (!game) return;

  // Build per-player payloads and POST in parallel
  const posts = webhooks.map(async ({ playerId, countryId, webhookUrl }) => {
    const gp = allPlayers.find((p) => p.playerId === playerId);
    if (!gp) return;

    let messages: { fromCountryId: string; content: string; isPrivate: boolean }[] = [];
    try {
      messages = await getInboundMessages(gameId, playerId, countryId, game!.turn);
    } catch {
      // non-fatal — send without messages
    }

    const myAllies = alliances
      .filter((a) => a.countryA === countryId || a.countryB === countryId)
      .map((a) => (a.countryA === countryId ? a.countryB : a.countryA));

    const myEnemies = wars
      .filter((w) => w.attacker === countryId || w.defender === countryId)
      .map((w) => (w.attacker === countryId ? w.defender : w.attacker));

    const payload = {
      game_id: game!.id,
      turn: game!.turn,
      total_turns: game!.maxTurns,
      phase: game!.turnPhase,
      deadline: game!.turnDeadlineAt,
      world_tension: game!.worldTension,
      already_submitted: false,
      countries: allPlayers!.map((p) => {
        const cfg = COUNTRY_MAP.get(p.countryId);
        return {
          id: p.countryId,
          name: cfg?.name ?? p.countryId,
          flag: cfg?.flag ?? "??",
          territory: p.territory,
          military: p.military,
          resources: p.resources,
          naval: p.naval,
          stability: p.stability,
          prestige: p.prestige,
          gdp: p.gdp,
          tech: p.tech,
          is_eliminated: p.isEliminated,
          player_id: p.playerId,
        };
      }),
      alliances: alliances!.map((a) => ({
        countries: [a.countryA, a.countryB],
        strength: a.strength,
      })),
      wars: wars!.map((w) => ({ attacker: w.attacker, defender: w.defender })),
      my_state: {
        country_id: gp.countryId,
        country_name: COUNTRY_MAP.get(gp.countryId)?.name ?? gp.countryId,
        territory: gp.territory,
        military: gp.military,
        resources: gp.resources,
        naval: gp.naval,
        stability: gp.stability,
        prestige: gp.prestige,
        gdp: gp.gdp,
        inflation: gp.inflation,
        tech: gp.tech,
        unrest: gp.unrest,
        spy_tokens: gp.spyTokens,
        allies: myAllies,
        enemies: myEnemies,
        active_sanctions: [],
      },
      inbound_messages: messages.map((m) => ({
        from_country: m.fromCountryId,
        content: m.content,
        private: m.isPrivate,
      })),
      recent_events: (events ?? []).map((e) => {
        const data = e.data as { description?: string };
        return data?.description ?? e.type;
      }),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[webhook] POST to ${webhookUrl} failed (player ${playerId}): ${errMsg}`);
    } finally {
      clearTimeout(timeout);
    }
  });

  await Promise.allSettled(posts);
}

// ---- Active deadline timers per game ----
const deadlineTimers = new Map<string, NodeJS.Timeout>();

export function clearDeadline(gameId: string) {
  const timer = deadlineTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    deadlineTimers.delete(gameId);
  }
}

function setDeadline(gameId: string, seconds: number) {
  clearDeadline(gameId);
  const timer = setTimeout(() => forceAdvanceTurn(gameId), seconds * 1000);
  deadlineTimers.set(gameId, timer);
}

// ---- Start a game — transition from lobby to active ----
export async function startGame(gameId: string) {
  const game = await getGameById(gameId);
  if (!game || game.phase !== "lobby") return;

  const deadline = new Date(
    Date.now() + game.turnDeadlineSeconds * 1000
  ).toISOString();

  await updateGame(gameId, {
    phase: "active",
    turn: 1,
    turnPhase: "negotiation",
    turnDeadlineAt: deadline,
    startedAt: new Date().toISOString(),
  });

  await insertGameEvent({
    gameId,
    type: "game_start",
    turn: 1,
    phase: "negotiation",
    data: { message: "The game has begun!" },
  });

  const startEvent = { type: "game_start", turn: 1, phase: "negotiation", deadline };
  broadcast(gameId, startEvent);
  notifySSE(gameId, startEvent);

  setDeadline(gameId, game.turnDeadlineSeconds);

  // Fire webhooks after game starts (agents need to know the first turn)
  dispatchWebhooks(gameId).catch(() => {});
}

// ---- Check if all alive players submitted — if so, advance ----
export async function checkAndAdvanceTurn(gameId: string) {
  // Concurrent-submission safety: skip if already advancing
  if (advanceLocks.get(gameId)) return;

  const game = await getGameById(gameId);
  if (!game || game.phase !== "active") return;

  const players = await getGamePlayers(gameId);
  const alive = players.filter((p) => !p.isEliminated);
  const submissions = await getTurnSubmissions(gameId, game.turn, game.turnPhase);

  if (submissions.length >= alive.length) {
    advanceLocks.set(gameId, true);
    try {
      await advanceTurn(gameId);
    } finally {
      advanceLocks.delete(gameId);
    }
  }
}

// ---- Force advance (deadline expired or admin command) ----
export async function forceAdvanceTurn(gameId: string) {
  clearDeadline(gameId);

  // Prevent double-advance if checkAndAdvanceTurn is in flight
  if (advanceLocks.get(gameId)) return;
  advanceLocks.set(gameId, true);

  try {
    const game = await getGameById(gameId);
    if (!game || game.phase !== "active") return;

    // Auto-submit for agents that haven't responded
    const players = await getGamePlayers(gameId);
    const alive = players.filter((p) => !p.isEliminated);
    const submissions = await getTurnSubmissions(gameId, game.turn, game.turnPhase);
    const submitted = new Set(submissions.map((s) => s.playerId));

    for (const p of alive) {
      if (!submitted.has(p.playerId)) {
        if (game.turnPhase === "negotiation") {
          await submitTurn({
            gameId,
            playerId: p.playerId,
            turn: game.turn,
            phase: "negotiation",
            messages: [],
          });
        } else if (game.turnPhase === "declaration") {
          await submitTurn({
            gameId,
            playerId: p.playerId,
            turn: game.turn,
            phase: "declaration",
            action: "neutral",
            reasoning: "Auto-submitted (deadline expired)",
            publicStatement: "No comment.",
          });
        }
      }
    }

    await advanceTurn(gameId);
  } finally {
    advanceLocks.delete(gameId);
  }
}

// ---- Core turn advancement logic ----
async function advanceTurn(gameId: string) {
  clearDeadline(gameId);
  const game = await getGameById(gameId);
  if (!game || game.phase !== "active") return;

  if (game.turnPhase === "negotiation") {
    // Move to declaration phase — apply grace delay so polling agents
    // have time to see the phase change before the deadline starts.
    const graceMs = GAME_CONFIG.graceDelaySeconds * 1000;
    const deadline = new Date(
      Date.now() + graceMs + game.turnDeadlineSeconds * 1000
    ).toISOString();

    await updateGame(gameId, {
      turnPhase: "declaration",
      turnDeadlineAt: deadline,
    });

    const phaseEvent = {
      type: "phase_change",
      turn: game.turn,
      phase: "declaration",
      deadline,
    };

    await insertGameEvent({
      gameId,
      type: "phase_change",
      turn: game.turn,
      phase: "declaration",
      data: { message: "Declaration phase begins", deadline },
    });

    broadcast(gameId, phaseEvent);
    notifySSE(gameId, phaseEvent);

    // Deadline timer accounts for grace delay
    setDeadline(gameId, GAME_CONFIG.graceDelaySeconds + game.turnDeadlineSeconds);

    // Dispatch webhooks after grace delay so DB is fully consistent
    setTimeout(() => {
      dispatchWebhooks(gameId).catch(() => {});
    }, graceMs);

  } else if (game.turnPhase === "declaration") {
    // Move to resolution — process all actions
    await updateGame(gameId, {
      turnPhase: "resolution",
      turnDeadlineAt: null,
    });

    // Broadcast declarations
    const submissions = await getTurnSubmissions(gameId, game.turn, "declaration");
    const players = await getGamePlayers(gameId);
    const declarations = submissions.map((s) => {
      const gp = players.find((p) => p.playerId === s.playerId);
      return {
        country_id: gp?.countryId ?? "unknown",
        action: s.action,
        target: s.target,
        public_statement: s.publicStatement,
      };
    });

    const declEvent = {
      type: "declarations_revealed",
      turn: game.turn,
      declarations,
    };

    broadcast(gameId, declEvent);
    notifySSE(gameId, declEvent);

    await insertGameEvent({
      gameId,
      type: "declarations_revealed",
      turn: game.turn,
      phase: "resolution",
      data: { declarations },
    });

    // Run resolution engine
    await resolve(gameId);

    // Check win conditions / max turns
    const updated = await getGameById(gameId);
    if (updated && updated.phase === "active") {
      const nextTurn = game.turn + 1;

      if (nextTurn > game.maxTurns) {
        // Game over — max turns reached
        await updateGame(gameId, {
          phase: "ended",
          endedAt: new Date().toISOString(),
        });

        const endEvent = { type: "game_end", reason: "max_turns" };
        broadcast(gameId, endEvent);
        notifySSE(gameId, endEvent);

        await insertGameEvent({
          gameId,
          type: "game_end",
          turn: game.turn,
          phase: "resolution",
          data: { reason: "max_turns" },
        });
      } else {
        const deadline = new Date(
          Date.now() + game.turnDeadlineSeconds * 1000
        ).toISOString();

        await updateGame(gameId, {
          turn: nextTurn,
          turnPhase: "negotiation",
          turnDeadlineAt: deadline,
        });

        const turnStartEvent = {
          type: "turn_start",
          turn: nextTurn,
          phase: "negotiation",
          deadline,
        };

        broadcast(gameId, turnStartEvent);
        notifySSE(gameId, turnStartEvent);

        await insertGameEvent({
          gameId,
          type: "turn_start",
          turn: nextTurn,
          phase: "negotiation",
          data: { deadline },
        });

        setDeadline(gameId, game.turnDeadlineSeconds);

        // Dispatch webhooks for new negotiation turn
        dispatchWebhooks(gameId).catch(() => {});
      }
    }
  }
}

// ============================================================
// Auto-Lobby — ensure a game lobby always exists
// ============================================================

import { createGame, getActiveGame } from "../db/queries.js";

/**
 * Creates a new lobby if no active game exists.
 * Call once on server startup, then poll every 60s.
 */
export async function ensureLobbyExists(): Promise<void> {
  try {
    const existing = await getActiveGame();
    if (existing) {
      console.log(`[lobby] Active game exists: ${existing.id} (${existing.phase})`);
      return;
    }
    const game = await createGame({});
    console.log(`[lobby] No active game found — created new lobby: ${game.id}`);
  } catch (err) {
    console.error("[lobby] Failed to ensure lobby:", err);
  }
}

/**
 * Starts polling to auto-create a new lobby after a game ends.
 * Checks every 60 seconds.
 */
export function startAutoLobby(): void {
  // Run immediately on boot
  ensureLobbyExists();

  setInterval(() => {
    ensureLobbyExists();
  }, 60_000);
}
