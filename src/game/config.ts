// ============================================================
// STATECRAFT v2 — Game Configuration
// 44 European countries, agent-driven REST API
// ============================================================

export const GAME_CONFIG = {
  maxTurns: 20,
  minPlayers: 6,
  turnDeadlineSeconds: 120, // 2 minutes per phase
  graceDelaySeconds: 10,    // grace period after auto-advance to declaration
  startingPrestige: 50,
  startingInflation: 10,
  startingUnrest: 10,
  startingSpyTokens: 2,
  spyTokenRegenPerTurn: 1,
  maxSpyTokens: 5,
  autoWipeHours: 24,
};

export interface CountryConfig {
  id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  resources: number;
  naval: number;
  gdp: number;
  stability: number;
}

// All 44 European countries with balanced starting stats
// Stats scale: territory 1-14, military 1-10, resources 1-10, naval 0-8, gdp 10-80, stability 1-10
export const COUNTRIES: CountryConfig[] = [
  // Major powers
  { id: "france",         name: "France",             flag: "FR", territory: 8,  military: 7,  resources: 8, naval: 5, gdp: 70, stability: 8 },
  { id: "germany",        name: "Germany",            flag: "DE", territory: 9,  military: 8,  resources: 9, naval: 2, gdp: 80, stability: 9 },
  { id: "uk",             name: "United Kingdom",     flag: "GB", territory: 7,  military: 7,  resources: 7, naval: 8, gdp: 65, stability: 8 },
  { id: "russia",         name: "Russia",             flag: "RU", territory: 14, military: 10, resources: 6, naval: 4, gdp: 50, stability: 6 },
  { id: "italy",          name: "Italy",              flag: "IT", territory: 7,  military: 5,  resources: 7, naval: 5, gdp: 55, stability: 6 },
  { id: "spain",          name: "Spain",              flag: "ES", territory: 7,  military: 5,  resources: 7, naval: 4, gdp: 50, stability: 7 },
  { id: "turkey",         name: "Turkey",             flag: "TR", territory: 8,  military: 7,  resources: 6, naval: 4, gdp: 45, stability: 6 },

  // Medium powers
  { id: "poland",         name: "Poland",             flag: "PL", territory: 6,  military: 5,  resources: 6, naval: 1, gdp: 40, stability: 7 },
  { id: "ukraine",        name: "Ukraine",            flag: "UA", territory: 6,  military: 4,  resources: 7, naval: 1, gdp: 30, stability: 5 },
  { id: "netherlands",    name: "Netherlands",        flag: "NL", territory: 4,  military: 3,  resources: 8, naval: 4, gdp: 60, stability: 9 },
  { id: "sweden",         name: "Sweden",             flag: "SE", territory: 5,  military: 4,  resources: 6, naval: 3, gdp: 55, stability: 9 },
  { id: "greece",         name: "Greece",             flag: "GR", territory: 5,  military: 4,  resources: 5, naval: 4, gdp: 35, stability: 5 },
  { id: "romania",        name: "Romania",            flag: "RO", territory: 5,  military: 4,  resources: 5, naval: 1, gdp: 30, stability: 6 },
  { id: "czechia",        name: "Czechia",            flag: "CZ", territory: 4,  military: 3,  resources: 5, naval: 0, gdp: 38, stability: 8 },
  { id: "portugal",       name: "Portugal",           flag: "PT", territory: 4,  military: 3,  resources: 5, naval: 3, gdp: 35, stability: 7 },
  { id: "belgium",        name: "Belgium",            flag: "BE", territory: 3,  military: 3,  resources: 6, naval: 2, gdp: 45, stability: 7 },
  { id: "hungary",        name: "Hungary",            flag: "HU", territory: 4,  military: 3,  resources: 4, naval: 0, gdp: 28, stability: 6 },
  { id: "austria",        name: "Austria",            flag: "AT", territory: 4,  military: 3,  resources: 5, naval: 0, gdp: 42, stability: 9 },
  { id: "switzerland",    name: "Switzerland",        flag: "CH", territory: 3,  military: 3,  resources: 7, naval: 0, gdp: 55, stability: 10 },
  { id: "denmark",        name: "Denmark",            flag: "DK", territory: 3,  military: 3,  resources: 5, naval: 3, gdp: 48, stability: 9 },
  { id: "finland",        name: "Finland",            flag: "FI", territory: 5,  military: 4,  resources: 5, naval: 2, gdp: 42, stability: 9 },
  { id: "norway",         name: "Norway",             flag: "NO", territory: 5,  military: 4,  resources: 8, naval: 3, gdp: 55, stability: 9 },
  { id: "ireland",        name: "Ireland",            flag: "IE", territory: 3,  military: 2,  resources: 5, naval: 2, gdp: 50, stability: 9 },

  // Smaller powers
  { id: "serbia",         name: "Serbia",             flag: "RS", territory: 3,  military: 3,  resources: 3, naval: 0, gdp: 20, stability: 5 },
  { id: "croatia",        name: "Croatia",            flag: "HR", territory: 3,  military: 2,  resources: 3, naval: 2, gdp: 22, stability: 7 },
  { id: "bulgaria",       name: "Bulgaria",           flag: "BG", territory: 4,  military: 3,  resources: 3, naval: 1, gdp: 22, stability: 6 },
  { id: "slovakia",       name: "Slovakia",           flag: "SK", territory: 3,  military: 2,  resources: 3, naval: 0, gdp: 22, stability: 7 },
  { id: "lithuania",      name: "Lithuania",          flag: "LT", territory: 2,  military: 2,  resources: 3, naval: 1, gdp: 20, stability: 7 },
  { id: "latvia",         name: "Latvia",             flag: "LV", territory: 2,  military: 2,  resources: 3, naval: 1, gdp: 18, stability: 7 },
  { id: "estonia",        name: "Estonia",            flag: "EE", territory: 2,  military: 2,  resources: 3, naval: 1, gdp: 22, stability: 8 },
  { id: "slovenia",       name: "Slovenia",           flag: "SI", territory: 2,  military: 2,  resources: 3, naval: 1, gdp: 28, stability: 8 },
  { id: "albania",        name: "Albania",            flag: "AL", territory: 2,  military: 2,  resources: 2, naval: 1, gdp: 15, stability: 5 },
  { id: "north_macedonia",name: "North Macedonia",    flag: "MK", territory: 2,  military: 1,  resources: 2, naval: 0, gdp: 14, stability: 5 },
  { id: "bosnia",         name: "Bosnia & Herzegovina",flag: "BA", territory: 2,  military: 2,  resources: 2, naval: 1, gdp: 16, stability: 4 },
  { id: "moldova",        name: "Moldova",            flag: "MD", territory: 2,  military: 1,  resources: 2, naval: 0, gdp: 12, stability: 4 },
  { id: "belarus",        name: "Belarus",            flag: "BY", territory: 4,  military: 3,  resources: 3, naval: 0, gdp: 20, stability: 4 },
  { id: "iceland",        name: "Iceland",            flag: "IS", territory: 2,  military: 1,  resources: 4, naval: 2, gdp: 30, stability: 10 },
  { id: "luxembourg",     name: "Luxembourg",         flag: "LU", territory: 1,  military: 1,  resources: 5, naval: 0, gdp: 45, stability: 10 },
  { id: "malta",          name: "Malta",              flag: "MT", territory: 1,  military: 1,  resources: 3, naval: 1, gdp: 22, stability: 8 },
  { id: "cyprus",         name: "Cyprus",             flag: "CY", territory: 1,  military: 1,  resources: 3, naval: 1, gdp: 24, stability: 6 },
  { id: "montenegro",     name: "Montenegro",         flag: "ME", territory: 1,  military: 1,  resources: 2, naval: 1, gdp: 14, stability: 6 },
  { id: "kosovo",         name: "Kosovo",             flag: "XK", territory: 1,  military: 1,  resources: 2, naval: 0, gdp: 12, stability: 4 },
  { id: "andorra",        name: "Andorra",            flag: "AD", territory: 1,  military: 1,  resources: 2, naval: 0, gdp: 18, stability: 10 },
  { id: "liechtenstein",  name: "Liechtenstein",      flag: "LI", territory: 1,  military: 1,  resources: 3, naval: 0, gdp: 35, stability: 10 },
];

export const COUNTRY_MAP = new Map(COUNTRIES.map(c => [c.id, c]));

export const WIN_CONDITIONS = {
  domination: {
    territoryPercent: 0.30, // 30% of total territory (harder with 44 countries)
  },
  economic: {
    gdpPercent: 0.35,
    turnsRequired: 3,
  },
};
