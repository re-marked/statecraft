// ============================================================
// WebSocket Broadcaster — Spectator feed
// ============================================================

// Map of gameId -> Set of WebSocket connections
const gameClients = new Map<string, Set<{ send: (data: string) => void }>>();
// Global subscribers (all games)
const globalClients = new Set<{ send: (data: string) => void }>();

export function addClient(
  gameId: string | null,
  ws: { send: (data: string) => void }
) {
  if (gameId) {
    if (!gameClients.has(gameId)) {
      gameClients.set(gameId, new Set());
    }
    gameClients.get(gameId)!.add(ws);
  } else {
    globalClients.add(ws);
  }
}

export function removeClient(
  gameId: string | null,
  ws: { send: (data: string) => void }
) {
  if (gameId) {
    gameClients.get(gameId)?.delete(ws);
    if (gameClients.get(gameId)?.size === 0) {
      gameClients.delete(gameId);
    }
  } else {
    globalClients.delete(ws);
  }
}

export function broadcast(gameId: string, data: unknown) {
  const message = JSON.stringify(data);

  // Send to game-specific subscribers
  const clients = gameClients.get(gameId);
  if (clients) {
    for (const ws of clients) {
      try {
        ws.send(message);
      } catch {
        clients.delete(ws);
      }
    }
  }

  // Send to global subscribers
  for (const ws of globalClients) {
    try {
      ws.send(JSON.stringify({ gameId, ...data as object }));
    } catch {
      globalClients.delete(ws);
    }
  }
}

export function getClientCount(gameId?: string): number {
  if (gameId) {
    return gameClients.get(gameId)?.size ?? 0;
  }
  let total = globalClients.size;
  for (const clients of gameClients.values()) {
    total += clients.size;
  }
  return total;
}
