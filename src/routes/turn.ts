// ============================================================
// Turn Routes — POST /turns/respond, GET /turns/current
// ============================================================

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  getActiveGame,
  getGamePlayer,
  getGamePlayers,
  getInboundMessages,
  submitTurn,
  getPlayerSubmission,
  getTurnSubmissions,
  getLastDeclaration,
  saveDiplomaticMessage,
  getAlliances,
  getWars,
  getGameEvents,
} from "../db/queries.js";
import { COUNTRY_MAP } from "../game/config.js";
import { ALL_ACTIONS, type ActionType, type NegotiationMessage } from "../types/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { checkAndAdvanceTurn, subscribeToGameEvents } from "../game/scheduler.js";
import { broadcast } from "../ws/broadcaster.js";
import { getSupabase } from "../db/client.js";

const turn = new Hono();

// Get current turn state for the calling agent
turn.get("/turns/current", authMiddleware, async (c) => {
  const player = c.get("player");
  const game = await getActiveGame();
  if (!game || game.phase !== "active") {
    return c.json({ error: "No active game in progress" }, 400);
  }

  const gp = await getGamePlayer(game.id, player.id);
  if (!gp) {
    return c.json({ error: "You are not in this game" }, 400);
  }

  if (gp.isEliminated) {
    return c.json({ error: "You have been eliminated" }, 400);
  }

  const allPlayers = await getGamePlayers(game.id);
  const alliances = await getAlliances(game.id);
  const wars = await getWars(game.id);
  const messages = await getInboundMessages(
    game.id,
    player.id,
    gp.countryId,
    game.turn
  );
  const events = await getGameEvents(game.id, {
    turn: game.turn,
    limit: 50,
  });

  // Check if already submitted
  const existing = await getPlayerSubmission(
    game.id,
    player.id,
    game.turn,
    game.turnPhase
  );

  // Build allied/enemy lists from alliances and wars
  const allies = alliances
    .filter((a) => a.countryA === gp.countryId || a.countryB === gp.countryId)
    .map((a) => (a.countryA === gp.countryId ? a.countryB : a.countryA));

  const enemies = wars
    .filter((w) => w.attacker === gp.countryId || w.defender === gp.countryId)
    .map((w) => (w.attacker === gp.countryId ? w.defender : w.attacker));

  const sanctions = allPlayers
    .filter((p) => p.countryId !== gp.countryId)
    .map((p) => p.countryId); // TODO: track actual sanctions

  return c.json({
    game_id: game.id,
    turn: game.turn,
    total_turns: game.maxTurns,
    phase: game.turnPhase,
    deadline: game.turnDeadlineAt,
    world_tension: game.worldTension,
    already_submitted: !!existing,
    countries: allPlayers.map((p) => {
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
        annexed_by: p.annexedBy ?? null,
        player_id: p.playerId,
      };
    }),
    alliances: alliances.map((a) => ({
      countries: [a.countryA, a.countryB],
      strength: a.strength,
      name: a.name ?? null,
      abbreviation: a.abbreviation ?? null,
    })),
    wars: wars.map((w) => ({
      attacker: w.attacker,
      defender: w.defender,
    })),
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
      allies,
      enemies,
      active_sanctions: [],
    },
    inbound_messages: messages.map((m) => ({
      from_country: m.fromCountryId,
      content: m.content,
      private: m.isPrivate,
    })),
    recent_events: events.map((e) => {
      const data = e.data as { description?: string };
      return data?.description ?? e.type;
    }),
  });
});

// Submit a turn response (negotiation messages or declaration action)
turn.post("/turns/respond", authMiddleware, async (c) => {
  const player = c.get("player");
  const game = await getActiveGame();
  if (!game || game.phase !== "active") {
    return c.json({ error: "No active game in progress" }, 400);
  }

  if (game.turnPhase === "resolution") {
    return c.json({ error: "Resolution phase — no input accepted" }, 400);
  }

  const gp = await getGamePlayer(game.id, player.id);
  if (!gp) {
    return c.json({ error: "You are not in this game" }, 400);
  }
  if (gp.isEliminated) {
    return c.json({ error: "You have been eliminated" }, 400);
  }

  // Check if already submitted this phase
  const existing = await getPlayerSubmission(
    game.id,
    player.id,
    game.turn,
    game.turnPhase
  );
  if (existing) {
    return c.json({ error: "Already submitted for this phase" }, 400);
  }

  const body = await c.req.json();

  if (game.turnPhase === "negotiation") {
    // Expect { messages: [...] }
    const messages: NegotiationMessage[] = Array.isArray(body.messages)
      ? body.messages.slice(0, 5) // max 5 messages per turn
      : [];

    await submitTurn({
      gameId: game.id,
      playerId: player.id,
      turn: game.turn,
      phase: "negotiation",
      messages,
    });

    // Save diplomatic messages to DB for querying
    const allPlayers = await getGamePlayers(game.id);
    for (const msg of messages) {
      const targetPlayer = allPlayers.find((p) => p.countryId === msg.to);
      await saveDiplomaticMessage({
        gameId: game.id,
        fromPlayerId: player.id,
        fromCountryId: gp.countryId,
        toPlayerId: msg.to === "broadcast" ? null : (targetPlayer?.playerId ?? null),
        toCountryId: msg.to,
        content: msg.content,
        isPrivate: msg.private ?? true,
        turn: game.turn,
        phase: "negotiation",
      });

      // Broadcast to spectators via Supabase Realtime (humans see everything, including private)
      const fromCfg = COUNTRY_MAP.get(gp.countryId);
      const toCfg = msg.to === "broadcast" ? null : COUNTRY_MAP.get(msg.to);
      const payload = {
        type: "diplomatic_message",
        turn: game.turn,
        from_country: gp.countryId,
        from_name: fromCfg?.name ?? gp.countryId,
        from_flag: fromCfg?.flag ?? "??",
        to_country: msg.to,
        to_name: msg.to === "broadcast" ? "All" : (toCfg?.name ?? msg.to),
        to_flag: msg.to === "broadcast" ? "📢" : (toCfg?.flag ?? "??"),
        content: msg.content,
        private: msg.private ?? true,
      };
      // Supabase Realtime broadcast (for War Room spectators)
      getSupabase().channel(`game:${game.id}`).send({
        type: "broadcast",
        event: "diplomatic_message",
        payload,
      }).catch(() => {}); // fire-and-forget, don't block turn submission
      // Also keep legacy WS broadcast for backward compat
      broadcast(game.id, payload);
    }

    // Check if all players submitted — advance turn if so
    await checkAndAdvanceTurn(game.id);

    return c.json({ message: "Negotiation submitted", messages_sent: messages.length });
  }

  if (game.turnPhase === "declaration") {
    // Expect { action, target?, reasoning, public_statement, ... }
    const action = body.action as ActionType;
    if (!action || !ALL_ACTIONS.includes(action)) {
      return c.json({
        error: `Invalid action. Must be one of: ${ALL_ACTIONS.join(", ")}`,
      }, 400);
    }

    // No double-neutral rule: cannot declare neutral two turns in a row
    if (action === "neutral") {
      const lastDecl = await getLastDeclaration(game.id, player.id, game.turn);
      if (lastDecl?.action === "neutral") {
        return c.json({
          error: "Cannot declare neutral two turns in a row. Pick an action — invest, ally, attack, sanction, spy, anything. Neutral is not a strategy.",
        }, 400);
      }
    }

    await submitTurn({
      gameId: game.id,
      playerId: player.id,
      turn: game.turn,
      phase: "declaration",
      action,
      target: body.target ?? null,
      reasoning: body.reasoning ?? "",
      publicStatement: body.public_statement ?? "",
      tradeAmount: body.trade_amount ?? null,
      voteResolution: body.vote_resolution ?? null,
      allianceName: body.alliance_name ?? null,
      allianceAbbreviation: body.alliance_abbreviation ?? null,
    });

    // Check if all players submitted — advance turn if so
    await checkAndAdvanceTurn(game.id);

    return c.json({ message: "Declaration submitted", action });
  }

  return c.json({ error: "Unknown phase" }, 400);
});

// SSE endpoint — stream phase-change events in real-time
// GET /turns/wait  (Bearer token required)
turn.get("/turns/wait", authMiddleware, async (c) => {
  const player = c.get("player");
  const game = await getActiveGame();

  if (!game || game.phase !== "active") {
    return c.json({ error: "No active game in progress" }, 400);
  }

  const gp = await getGamePlayer(game.id, player.id);
  if (!gp) {
    return c.json({ error: "You are not in this game" }, 400);
  }

  return streamSSE(c, async (stream) => {
    // Simple async queue: single pending resolver + overflow buffer
    let resolveNext: ((evt: object | null) => void) | null = null;
    const queue: Array<object | null> = [];

    const push = (evt: object | null) => {
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r(evt);
      } else {
        queue.push(evt);
      }
    };

    const next = (): Promise<object | null> => {
      if (queue.length > 0) return Promise.resolve(queue.shift()!);
      return new Promise((resolve) => {
        resolveNext = resolve;
      });
    };

    const unsubscribe = subscribeToGameEvents(game.id, push);

    // Send initial state so agent knows where it stands
    await stream.writeSSE({
      data: JSON.stringify({
        type: "connected",
        game_id: game.id,
        turn: game.turn,
        phase: game.turnPhase,
        deadline: game.turnDeadlineAt,
      }),
    });

    const HEARTBEAT_MS = 15_000;

    try {
      while (!stream.closed) {
        const result = await Promise.race([
          next(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), HEARTBEAT_MS)),
        ]);

        if (stream.closed) break;

        if (result === null) {
          // Heartbeat — keep connection alive
          await stream.write(": heartbeat\n\n");
        } else {
          await stream.writeSSE({ data: JSON.stringify(result) });
          // Close gracefully when game ends
          if ((result as { type?: string }).type === "game_end") break;
        }
      }
    } catch {
      // Client disconnected or write error — exit cleanly
    } finally {
      unsubscribe();
      // Resolve any pending next() so it doesn't leak
      push(null);
    }
  });
});

export default turn;
