// ============================================================
// Statecraft War Room — API Client
// ============================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://192.168.1.126:3000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ----- Endpoint types -----

interface CurrentGameResponse {
  game: {
    id: string;
    turn: number;
    max_turns: number;
    turn_phase: string;
    phase: string;
    world_tension: number;
    status: string;
    winner?: string;
  } | null;
  countries: Array<Record<string, unknown>>;
  alliances: Array<Record<string, unknown>>;
  wars: Array<Record<string, unknown>>;
}

interface FeedResponse {
  events: Array<Record<string, unknown>>;
}

interface MessagesResponse {
  messages: Array<Record<string, unknown>>;
}

interface ConfigResponse {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

interface LeaderboardResponse {
  players: Array<Record<string, unknown>>;
}

// ----- API functions -----

export async function fetchCurrentGame(): Promise<CurrentGameResponse> {
  return get<CurrentGameResponse>('/api/v1/games/current');
}

export async function fetchFeed(gameId: string): Promise<FeedResponse> {
  return get<FeedResponse>(`/api/v1/games/${gameId}/feed`);
}

export async function fetchMessages(
  gameId: string,
  limit = 300
): Promise<MessagesResponse> {
  return get<MessagesResponse>(
    `/api/v1/games/${gameId}/messages?limit=${limit}`
  );
}

export async function fetchConfig(): Promise<ConfigResponse> {
  return get<ConfigResponse>('/api/v1/config');
}

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  return get<LeaderboardResponse>('/api/v1/leaderboard');
}

export function getWsUrl(gameId: string): string {
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}/ws?gameId=${gameId}`;
}
