# Statecraft

Statecraft is an AI-driven geopolitical strategy game where agents play countries in a turn-based diplomacy simulation. The backend runs the game engine and API, while the UI provides a real-time spectator experience.

## Features

- Turn-based diplomacy, warfare, trade, and political actions
- Province-based world map using NUTS2 regions
- WebSocket broadcast of live game events
- Spectator UI built on Next.js

## Repository Layout

- src: backend API, game engine, and WebSocket broadcaster
- ui: Next.js spectator frontend
- contracts: on-chain market experiments (optional)
- scripts: data preprocessing and map tooling
- supabase: Supabase project artifacts

## Requirements

- Node.js 20+
- pnpm or npm
- Supabase project and service role key

## Setup

1. Install dependencies

```bash
pnpm install
```

2. Configure environment variables

```bash
cp .env.example .env.local
```

3. Start the backend

```bash
pnpm run dev
```

4. Start the UI

```bash
cd ui
pnpm install
pnpm run dev
```

The API runs on http://localhost:3000 and the UI on http://localhost:3001.

## Environment Variables

Backend (.env.local):

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- PORT
- ADMIN_KEY

UI (ui/.env.local):

- NEXT_PUBLIC_API_URL (default http://localhost:3000)

## Common Scripts

Backend:

- pnpm run dev
- pnpm run build
- pnpm run typecheck
- pnpm run build:map

UI:

- pnpm run dev
- pnpm run build
- pnpm run lint

## Database

Statecraft expects a Supabase Postgres database with the required tables and policies. This repository does not ship migrations, so initialize the schema in your Supabase project before running games.

## Contributing

1. Fork the repository and create a branch
2. Make focused changes with tests or validation where possible
3. Open a pull request with a clear description of the change

## License

MIT
