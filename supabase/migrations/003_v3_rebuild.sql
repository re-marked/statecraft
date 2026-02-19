-- ============================================================
-- STATECRAFT v3 — Complete Schema Rebuild
-- Province-based NUTS2 system, pacts, unions, ultimatums,
-- capital-based annexation
-- ============================================================

-- Drop all v2 tables
DROP TABLE IF EXISTS game_results CASCADE;
DROP TABLE IF EXISTS world_news CASCADE;
DROP TABLE IF EXISTS un_votes CASCADE;
DROP TABLE IF EXISTS wars CASCADE;
DROP TABLE IF EXISTS alliances CASCADE;
DROP TABLE IF EXISTS diplomatic_messages CASCADE;
DROP TABLE IF EXISTS game_events CASCADE;
DROP TABLE IF EXISTS turn_submissions CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- ============================================================
-- Core Tables
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

-- Game sessions
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'active', 'ended')),
  turn INTEGER NOT NULL DEFAULT 0,
  turn_phase TEXT NOT NULL DEFAULT 'negotiation'
    CHECK (turn_phase IN ('negotiation', 'declaration', 'ultimatum_response', 'resolution')),
  max_turns INTEGER NOT NULL DEFAULT 20,
  min_players INTEGER NOT NULL DEFAULT 6,
  turn_deadline_seconds INTEGER NOT NULL DEFAULT 120,
  turn_deadline_at TIMESTAMPTZ,
  world_tension INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_id UUID REFERENCES players(id)
);

-- Per-game country state (one row per player per game)
CREATE TABLE countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,                    -- base country ID (e.g. "france")
  display_name TEXT NOT NULL,                  -- can be renamed
  flag_data JSONB,                             -- flag constructor JSON
  money INTEGER NOT NULL DEFAULT 100,          -- in M (millions)
  total_troops INTEGER NOT NULL DEFAULT 0,     -- in K, derived from province sums
  tech INTEGER NOT NULL DEFAULT 1,             -- 0-10
  stability INTEGER NOT NULL DEFAULT 7,        -- 0-10
  spy_tokens INTEGER NOT NULL DEFAULT 2,
  is_eliminated BOOLEAN NOT NULL DEFAULT false,
  annexed_by TEXT,                              -- country_id of conqueror
  capital_province_id TEXT NOT NULL,            -- nuts2_id of capital province
  union_id UUID,                               -- references unions(id)
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id),
  UNIQUE(game_id, country_id)
);

-- Province instances per game (NUTS2 regions)
CREATE TABLE provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  nuts2_id TEXT NOT NULL,                      -- NUTS2 code (e.g. "FR10")
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,                      -- country_id
  original_owner_id TEXT NOT NULL,             -- who started with it
  is_capital BOOLEAN NOT NULL DEFAULT false,   -- capturing this = annexation
  gdp_value INTEGER NOT NULL DEFAULT 10,       -- GDP in M
  terrain TEXT NOT NULL DEFAULT 'plains'
    CHECK (terrain IN ('plains', 'mountains', 'urban', 'coastal')),
  troops_stationed INTEGER NOT NULL DEFAULT 0, -- in K
  population INTEGER NOT NULL DEFAULT 100,     -- in thousands, for display
  UNIQUE(game_id, nuts2_id)
);

CREATE INDEX idx_provinces_game_owner ON provinces(game_id, owner_id);

-- Province adjacency graph (shared reference, not per-game)
CREATE TABLE province_adjacency (
  nuts2_id_a TEXT NOT NULL,
  nuts2_id_b TEXT NOT NULL,
  PRIMARY KEY (nuts2_id_a, nuts2_id_b)
);

-- ============================================================
-- Diplomacy Tables
-- ============================================================

-- Ultimatums — demands with response tracking
CREATE TABLE ultimatums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_country_id TEXT NOT NULL,
  to_country_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  demands JSONB NOT NULL,                      -- UltimatumDemand JSON
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ultimatums_game ON ultimatums(game_id, turn);

-- Named multi-member pacts (alliances)
CREATE TABLE pacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,                  -- max 5 chars
  color TEXT NOT NULL DEFAULT '#888888',
  founded_on_turn INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pact membership
CREATE TABLE pact_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pact_id UUID NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  joined_on_turn INTEGER NOT NULL,
  left_on_turn INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(pact_id, country_id, joined_on_turn)
);

-- Wars with initial troop snapshots
CREATE TABLE wars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attacker_country_id TEXT NOT NULL,
  defender_country_id TEXT NOT NULL,
  started_on_turn INTEGER NOT NULL,
  ended_on_turn INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  attacker_initial_troops INTEGER NOT NULL DEFAULT 0,
  defender_initial_troops INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_wars_game ON wars(game_id, is_active);

-- Political unions
CREATE TABLE unions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  founded_on_turn INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Union membership
CREATE TABLE union_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  union_id UUID NOT NULL REFERENCES unions(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  is_leader BOOLEAN NOT NULL DEFAULT false,
  joined_on_turn INTEGER NOT NULL,
  left_on_turn INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(union_id, country_id, joined_on_turn)
);

-- ============================================================
-- Action & Communication Tables
-- ============================================================

-- Enhanced turn submissions (multiple actions, ultimatum responses)
CREATE TABLE turn_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('negotiation', 'declaration', 'ultimatum_response')),
  actions JSONB NOT NULL DEFAULT '[]',         -- array of SubmittedAction
  messages JSONB NOT NULL DEFAULT '[]',        -- array of NegotiationMessage
  ultimatum_responses JSONB NOT NULL DEFAULT '[]', -- array of UltimatumResponseEntry
  reasoning TEXT,
  public_statement TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id, turn, phase)
);

-- Game event log
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

-- Diplomatic messages
CREATE TABLE diplomatic_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_player_id UUID NOT NULL REFERENCES players(id),
  from_country_id TEXT NOT NULL,
  to_player_id UUID REFERENCES players(id),
  to_country_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  turn INTEGER NOT NULL,
  phase TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diplo_messages_game ON diplomatic_messages(game_id, turn, phase);

-- Completed trade ledger
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn INTEGER NOT NULL,
  from_country_id TEXT NOT NULL,
  to_country_id TEXT NOT NULL,
  from_amount INTEGER NOT NULL,
  to_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Final standings + ELO changes
CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  placement INTEGER NOT NULL,
  elo_change INTEGER NOT NULL DEFAULT 0,
  final_provinces INTEGER NOT NULL DEFAULT 0,
  final_troops INTEGER NOT NULL DEFAULT 0,
  final_money INTEGER NOT NULL DEFAULT 0,
  final_gdp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE provinces ENABLE ROW LEVEL SECURITY;
ALTER TABLE province_adjacency ENABLE ROW LEVEL SECURITY;
ALTER TABLE ultimatums ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pact_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE union_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE turn_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE diplomatic_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Public read policies for spectator frontend
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read countries" ON countries FOR SELECT USING (true);
CREATE POLICY "Public read provinces" ON provinces FOR SELECT USING (true);
CREATE POLICY "Public read province_adjacency" ON province_adjacency FOR SELECT USING (true);
CREATE POLICY "Public read ultimatums" ON ultimatums FOR SELECT USING (true);
CREATE POLICY "Public read pacts" ON pacts FOR SELECT USING (true);
CREATE POLICY "Public read pact_members" ON pact_members FOR SELECT USING (true);
CREATE POLICY "Public read wars" ON wars FOR SELECT USING (true);
CREATE POLICY "Public read unions" ON unions FOR SELECT USING (true);
CREATE POLICY "Public read union_members" ON union_members FOR SELECT USING (true);
CREATE POLICY "Public read game_events" ON game_events FOR SELECT USING (true);
CREATE POLICY "Public read game_results" ON game_results FOR SELECT USING (true);
