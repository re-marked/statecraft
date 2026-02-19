// ============================================================
// STATECRAFT v3 — Hono HTTP Server Bootstrap
// Province-based NUTS2 system. 44 European Countries.
// ============================================================

import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { readFileSync } from "fs";
import { join } from "path";
import { WebSocketServer, WebSocket } from "ws";

import authRoutes from "./routes/auth.js";
import gameRoutes from "./routes/game.js";
import turnRoutes from "./routes/turn.js";
import adminRoutes from "./routes/admin.js";
import spectatorRoutes from "./routes/spectator.js";
import mapRoutes from "./routes/map.js";
import { addClient, removeClient } from "./ws/broadcaster.js";
import { startAutoLobby } from "./game/scheduler.js";

const app = new Hono();

// CORS — allow agents from anywhere
app.use("/*", cors());

// Gzip compression — 50-70% smaller responses
app.use("/*", compress());

// Health check
app.get("/", (c) =>
  c.json({
    name: "Statecraft v3",
    version: "3.0.0",
    description: "Province-based (NUTS2) agent-driven strategy game. 44 European countries. ~300 provinces. Unlimited betrayal.",
    docs: "/skill.md",
    api: "/api/v1",
  })
);

// Serve SKILL.md for agent discovery
app.get("/skill.md", (c) => {
  try {
    const skillPath = join(process.cwd(), "public", "skill.md");
    const content = readFileSync(skillPath, "utf-8");
    return c.text(content);
  } catch {
    return c.text("# SKILL.md not found", 404);
  }
});

// Mount API routes
const api = new Hono();
api.route("/", authRoutes);
api.route("/", gameRoutes);
api.route("/", turnRoutes);
api.route("/admin", adminRoutes);
api.route("/", spectatorRoutes);
api.route("/", mapRoutes);

app.route("/api/v1", api);

// Start server
const PORT = parseInt(process.env.PORT ?? "3000");

console.log(`
  ____  _        _            __           __
 / ___|| |_ __ _| |_ ___  ___|  _ __ __ _|  |_
 \\___ \\| __/ _\` | __/ _ \\/ __| | '__/ _\` |    |
  ___) | || (_| | ||  __/\\__ \\ | | | (_| |    |
 |____/ \\__\\__,_|\\__\\___||___/ |_|  \\__,_|\\__|

  v3.0 — Province-Based NUTS2 System
  44 European Countries. ~300 Provinces. Unlimited Betrayal.
`);

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`  Server running on http://localhost:${info.port}`);
  console.log(`  API:      http://localhost:${info.port}/api/v1`);
  console.log(`  SKILL.md: http://localhost:${info.port}/skill.md`);
  console.log("");

  // Auto-create lobby on boot + poll every 60s
  startAutoLobby();
});

// WebSocket server — piggyback on the HTTP server
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, request) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const gameId = url.searchParams.get("gameId");

  const client = { send: (data: string) => ws.send(data) };
  addClient(gameId, client);

  ws.send(JSON.stringify({ type: "connected", gameId }));

  ws.on("close", () => {
    removeClient(gameId, client);
  });

  ws.on("error", () => {
    removeClient(gameId, client);
  });
});

export default app;
