// ============================================================
// Statecraft War Room — TypeScript Types
// ============================================================

export interface Game {
  id: string;
  turn: number;
  max_turns: number;
  turn_phase: string;
  phase: string;
  world_tension: number;
  status: string;
  winner?: string;
  turn_deadline_at?: string | null;
  player_count?: number;
  min_players?: number;
}

export interface Country {
  id: string;
  country_id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  naval: number;
  resources: number;
  gdp: number;
  stability: number;
  prestige: number;
  tech: number;
  unrest: number;
  inflation: number;
  is_eliminated: boolean;
  annexed_by?: string | null;
}

export interface Alliance {
  id: string;
  countries: [string, string];
  is_active: boolean;
  name?: string | null;
  abbreviation?: string | null;
}

export interface War {
  id: string;
  attacker: string;
  defender: string;
  is_active: boolean;
}

export interface GameEvent {
  type: string;
  turn: number;
  createdAt?: string;
  data: Record<string, unknown>;
}

export interface DiplomaticMessage {
  turn: number;
  from_country: string;
  from_name: string;
  from_flag: string;
  to_country: string;
  to_name: string;
  to_flag: string;
  content: string;
  private: boolean;
  createdAt?: string;
}

export interface NewsItem {
  icon: string;
  headline: string;
  body: string;
  turn: number;
  ts?: string;
  cls: 'combat' | 'diplomacy' | 'espionage' | 'system';
}

export type WsStatus = 'connected' | 'disconnected' | 'connecting';

export type TabId = 'intel' | 'ranks' | 'alliances' | 'news' | 'logs';

export interface GameState {
  game: Game | null;
  countries: Country[];
  alliances: Alliance[];
  wars: War[];
  events: GameEvent[];
  selectedCountry: string | null;
  wsStatus: WsStatus;
  loading: boolean;
}

// Map from game country_id to display name
export const GAME_TO_NAME: Record<string, string> = {
  france: 'France', germany: 'Germany', uk: 'United Kingdom', russia: 'Russia',
  italy: 'Italy', spain: 'Spain', turkey: 'Turkey', poland: 'Poland',
  ukraine: 'Ukraine', netherlands: 'Netherlands', sweden: 'Sweden', greece: 'Greece',
  romania: 'Romania', czechia: 'Czechia', portugal: 'Portugal', belgium: 'Belgium',
  hungary: 'Hungary', austria: 'Austria', switzerland: 'Switzerland', denmark: 'Denmark',
  finland: 'Finland', norway: 'Norway', ireland: 'Ireland', serbia: 'Serbia',
  croatia: 'Croatia', bulgaria: 'Bulgaria', slovakia: 'Slovakia', lithuania: 'Lithuania',
  latvia: 'Latvia', estonia: 'Estonia', slovenia: 'Slovenia', albania: 'Albania',
  north_macedonia: 'N. Macedonia', bosnia: 'Bosnia', moldova: 'Moldova', belarus: 'Belarus',
  iceland: 'Iceland', luxembourg: 'Luxembourg', malta: 'Malta', cyprus: 'Cyprus',
  montenegro: 'Montenegro', kosovo: 'Kosovo', andorra: 'Andorra', liechtenstein: 'Liechten.',
};

// Map from game country_id to ISO 2-letter code (for flag emoji)
export const GAME_TO_FLAG: Record<string, string> = {
  france: 'FR', germany: 'DE', uk: 'GB', russia: 'RU', italy: 'IT', spain: 'ES',
  turkey: 'TR', poland: 'PL', ukraine: 'UA', netherlands: 'NL', sweden: 'SE',
  greece: 'GR', romania: 'RO', czechia: 'CZ', portugal: 'PT', belgium: 'BE',
  hungary: 'HU', austria: 'AT', switzerland: 'CH', denmark: 'DK', finland: 'FI',
  norway: 'NO', ireland: 'IE', serbia: 'RS', croatia: 'HR', bulgaria: 'BG',
  slovakia: 'SK', lithuania: 'LT', latvia: 'LV', estonia: 'EE', slovenia: 'SI',
  albania: 'AL', north_macedonia: 'MK', bosnia: 'BA', moldova: 'MD', belarus: 'BY',
  iceland: 'IS', luxembourg: 'LU', malta: 'MT', cyprus: 'CY', montenegro: 'ME',
  kosovo: 'XK', andorra: 'AD', liechtenstein: 'LI',
};

/** Convert 2-letter ISO code to flag emoji */
export function codeToEmoji(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Get display name for a country ID */
export function countryName(id: string): string {
  return GAME_TO_NAME[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Get flag emoji for a country ID */
export function countryFlag(id: string): string {
  return codeToEmoji(GAME_TO_FLAG[id] ?? '');
}
