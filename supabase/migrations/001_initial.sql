-- ============================================================
-- STATECRAFT v2 — Initial Database Schema
-- ============================================================

-- Players persist across games
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  elo INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per game session
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'active', 'ended')),
  turn INTEGER NOT NULL DEFAULT 0,
  turn_phase TEXT NOT NULL DEFAULT 'negotiation' CHECK (turn_phase IN ('negotiation', 'declaration', 'resolution')),
  max_turns INTEGER NOT NULL DEFAULT 20,
  min_players INTEGER NOT NULL DEFAULT 6,
  turn_deadline_seconds INTEGER NOT NULL DEFAULT 300,
  turn_deadline_at TIMESTAMPTZ,
  world_tension INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id UUID REFERENCES players(id)
);

-- Per-game country state (one row per player per game)
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  territory INTEGER NOT NULL,
  military INTEGER NOT NULL,
  resources INTEGER NOT NULL,
  naval INTEGER NOT NULL DEFAULT 0,
  stability INTEGER NOT NULL,
  prestige INTEGER NOT NULL DEFAULT 50,
  gdp INTEGER NOT NULL,
  inflation INTEGER NOT NULL DEFAULT 10,
  tech INTEGER NOT NULL DEFAULT 1,
  unrest INTEGER NOT NULL DEFAULT 10,
  spy_tokens INTEGER NOT NULL DEFAULT 2,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id),
  UNIQUE(game_id, country_id)
);

-- Turn submissions (negotiation messages or declaration actions)
CREATE TABLE turn_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('negotiation', 'declaration')),
  action TEXT,
  target TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  reasoning TEXT,
  public_statement TEXT,
  trade_amount INTEGER,
  vote_resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id, turn, phase)
);

-- Game events (broadcast log)
CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_events_game ON game_events(game_id, turn);

-- Diplomatic messages (for querying inbound messages)
CREATE TABLE diplomatic_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_player_id UUID NOT NULL REFERENCES players(id),
  from_country_id TEXT NOT NULL,
  to_player_id UUID REFERENCES players(id), -- null = broadcast
  to_country_id TEXT NOT NULL, -- "broadcast" for broadcast
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diplo_messages_game ON diplomatic_messages(game_id, turn, phase);

-- Alliances
CREATE TABLE alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  country_a TEXT NOT NULL,
  country_b TEXT NOT NULL,
  formed_on_turn INTEGER NOT NULL,
  strength INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(game_id, country_a, country_b)
);

-- Wars
CREATE TABLE wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attacker TEXT NOT NULL,
  defender TEXT NOT NULL,
  started_on_turn INTEGER NOT NULL,
  ended_on_turn INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- UN votes
CREATE TABLE un_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES players(id),
  resolution TEXT NOT NULL,
  turn INTEGER NOT NULL,
  votes JSONB NOT NULL DEFAULT '{}',
  passed BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- World news events that fired during a game
CREATE TABLE world_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  effects JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Final results per player per game
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  placement INTEGER NOT NULL,
  elo_change INTEGER NOT NULL DEFAULT 0,
  final_territory INTEGER NOT NULL,
  final_military INTEGER NOT NULL,
  final_gdp INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomatic_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE alliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE un_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. These public read policies are for
-- direct Supabase client access from spectator frontend (if used).
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read game_players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Public read game_events" ON game_events FOR SELECT USING (true);
CREATE POLICY "Public read alliances" ON alliances FOR SELECT USING (true);
CREATE POLICY "Public read wars" ON wars FOR SELECT USING (true);
CREATE POLICY "Public read world_news" ON world_news FOR SELECT USING (true);
CREATE POLICY "Public read game_results" ON game_results FOR SELECT USING (true);
CREATE POLICY "Public read un_votes" ON un_votes FOR SELECT USING (true);
CREATE POLICY "Public read leaderboard" ON players FOR SELECT USING (true);
