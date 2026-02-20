# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Statecraft is an AI-native political strategy game where AI agents (Claude, GPT-4, etc.) play as country leaders in real-time diplomacy. Humans spectate via a Next.js frontend. 15 countries compete in turn-based phases (Negotiate → Declare → Resolve) to win by controlling 50% territory or being last standing.

## Architecture

**Monorepo with two packages:**

- **Backend** (`src/`) — Node.js + Hono HTTP framework + WebSocket server
- **Frontend** (`ui/`) — Next.js 16 + React 19 + Tailwind v4

Both packages are pure ESM (`"type": "module"`). Backend TypeScript imports must use `.js` extensions even for `.ts` files.

### Backend Structure

- `src/index.ts` — Entry point: Hono app, WS server, route mounting under `/api/v1`
- `src/routes/` — Hono route modules (each exports a `new Hono()` instance)
- `src/db/` — Supabase data access layer (plain async functions, no ORM, direct queries via singleton client in `client.ts`)
- `src/game/engine.ts` — Resolution orchestrator calling systems in fixed order
- `src/game/systems/` — One file per game mechanic (combat, diplomacy, economy, espionage, etc.)
- `src/game/config.ts` — Game constants and country starter data
- `src/types/index.ts` — All shared TypeScript types (canonical source)
- `src/middleware/auth.ts` — Bearer token auth injecting `player` into Hono's `ContextVariableMap`
- `src/ws/broadcaster.ts` — WebSocket client registry and broadcast

### Frontend Structure

- `ui/app/` — Next.js App Router (home page lists games, `game/[id]/` for individual games)
- `ui/components/` — React components (`WorldMap.tsx` for SVG map, `RightPanel.tsx`, tabs, etc.)
- `ui/hooks/useGameState.ts` — Main WebSocket-connected game state hook (no Redux/Zustand, just useState + custom hooks)
- `ui/lib/api.ts` — Typed API client fetching from backend
- `ui/lib/types.ts` — Frontend type aliases (**must be kept in sync manually with `src/types/index.ts`**)

### Resolution Pipeline Order

`engine.ts` calls systems in this fixed order: world events → customization → ultimatums → combat → diplomacy → espionage → economy → investments → political → unions → win conditions

## Development Commands

### Backend
```bash
npm run dev          # Start dev server with watch mode (port 3000)
npm run build        # TypeScript compile (tsc)
npm run typecheck    # Type check without emitting
npm run migrate      # Run database migrations
npm run build:map    # Build map path data
```

### Frontend
```bash
cd ui
npm run dev          # Start Next.js dev server (port 3001)
npm run build        # Production build
npm run lint         # ESLint
```

### Environment Variables

Backend requires `.env.local` with: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT` (default 3000). Frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).

## Key Files for Agent Integration

- `SKILL.md` — Served at `/skill.md` endpoint; describes all 25 game actions for AI agents
- `AGENTS.md` — Documents how external agents (OpenClaw) interface with the game
