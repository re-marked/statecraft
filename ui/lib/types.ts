// ============================================================
// Statecraft v3 War Room — TypeScript Types
// Province-based NUTS2 system
// ============================================================

export interface Game {
  id: string;
  turn: number;
  max_turns: number;
  turn_phase: string;
  phase: string;
  world_tension: number;
  turn_deadline_at?: string | null;
  player_count?: number;
  min_players?: number;
  status?: string;
  winner?: string;
}

export interface Country {
  country_id: string;
  display_name: string;
  flag_data: FlagData | null;
  money: number;
  total_troops: number;
  tech: number;
  stability: number;
  province_count: number;
  total_gdp: number;
  is_eliminated: boolean;
  annexed_by?: string | null;
  capital_province_id?: string;
  union_id?: string | null;
}

export interface Province {
  nuts2_id: string;
  name: string;
  owner_id: string;
  gdp_value: number;
  terrain: string;
  troops_stationed: number;
  is_capital: boolean;
  original_owner_id?: string;
  population?: number;
}

export interface FlagData {
  background: string;
  pattern: string;
  stripeColors: string[];
  symbolType: string;
  symbolColor: string;
  symbolPosition: string;
}

export interface Pact {
  id: string;
  name: string;
  abbreviation: string;
  color?: string;
  members: string[];
  founded_on_turn?: number;
}

export interface War {
  attacker: string;
  defender: string;
  started_on_turn?: number;
}

export interface GameUnion {
  id: string;
  name: string;
  abbreviation?: string;
  members: string[];
  leader?: string | null;
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
  to_country: string;
  to_name: string;
  content: string;
  private: boolean;
  created_at?: string;
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

export type TabId = 'intel' | 'ranks' | 'pacts' | 'news' | 'logs';

export interface GameState {
  game: Game | null;
  countries: Country[];
  provinces: Province[];
  pacts: Pact[];
  wars: War[];
  unions: GameUnion[];
  events: GameEvent[];
  selectedCountry: string | null;
  selectedProvince: string | null;
  wsStatus: WsStatus;
  loading: boolean;
  mapLayer: MapLayer;
}

export type MapLayer = 'political' | 'economic' | 'alliance' | 'terrain';

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
