// ============================================================
// STATECRAFT v3 — Logger
// Writes game events to Supabase + console
// ============================================================

import { insertGameEvent } from "../db/events.js";
import type { GameEvent } from "../types/index.js";

export async function logEvent(event: GameEvent): Promise<void> {
  try {
    await insertGameEvent({
      gameId: event.gameId,
      type: event.type,
      turn: event.turn,
      phase: event.phase,
      data: event.data,
    });
  } catch (err) {
    console.error("[Logger] Failed to write event to DB:", err);
  }

  const data = event.data as Record<string, unknown>;
  const desc = data?.description ?? data?.message ?? event.type;
  console.log(`[Turn ${event.turn}/${event.phase}] ${event.type}: ${desc}`);
}
