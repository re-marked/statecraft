'use client';
// ============================================================
// Statecraft — Static Demo Snapshot  "Fortress Europa, 1944"
// Europe at peak Axis expansion. Germany controls most of the
// continent. Desperate Allied counter-offensive underway.
// ============================================================

import { useMemo, useState } from 'react';
import type { Country, Game, GameEvent, Pact, War, WsStatus, MapLayer } from '@/lib/types';
import type { UseGameStateReturn } from './useGameState';
import { getDefaultProvinces } from '@/lib/provinceDefaults';

// ── helpers ─────────────────────────────────────────────────

function c(
  id: string, name: string,
  troops: number, tech: number, stability: number,
  gdp: number, money: number,
  opts: { elim?: true; annexedBy?: string } = {}
): Country {
  return {
    country_id: id, display_name: name, flag_data: null,
    total_troops: troops, tech, stability,
    total_gdp: gdp, money,
    province_count: Math.max(0, Math.round(gdp / 12)),
    is_eliminated: opts.elim ?? false,
    annexed_by: opts.annexedBy ?? null,
  };
}

function ts(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

// ── Game header ──────────────────────────────────────────────

const DEMO_GAME: Game = {
  id: 'demo',
  turn: 8,
  max_turns: 12,
  turn_phase: 'resolution',
  phase: 'active',
  world_tension: 94,
  player_count: 12,
  status: 'active',
};

// ── Countries ────────────────────────────────────────────────
// Germany has annexed most of Europe. Several Axis satellites
// remain active. The Allies (UK + USSR) are on the counter-offensive.

const DEMO_COUNTRIES: Country[] = [
  // ── Active Axis powers ──
  c('germany',     'Germany',            24,  4, 5,  185, 1800), // Dominant — controls most of map
  c('italy',       'Italian Rep.',        8,  2, 4,   52,  280), // Northern puppet republic
  c('romania',     'Romania',             8,  1, 4,   22,  110),
  c('hungary',     'Hungary',             7,  2, 4,   18,   90),
  c('bulgaria',    'Bulgaria',            5,  1, 4,   14,   70),
  c('finland',     'Finland',             5,  2, 6,   16,  130), // Co-belligerent
  c('croatia',     'Croatia',             4,  1, 3,    9,   50), // NDH puppet
  c('slovakia',    'Slovakia',            3,  1, 3,    9,   50), // Axis puppet

  // ── Active Allied powers ──
  c('uk',          'United Kingdom',     16,  4, 7,  100,  960), // Atlantic & Africa
  c('russia',      'Soviet Union',       30,  2, 4,  130,  700), // Eastern Front defence

  // ── Neutrals ──
  c('sweden',      'Sweden',              4,  3, 8,   40,  380), // Neutral / German iron ore
  c('switzerland', 'Switzerland',         3,  4, 9,   32,  450), // Neutral banking
  c('spain',       'Spain',               5,  1, 5,   25,  160), // Sympathizer, non-belligerent
  c('portugal',    'Portugal',            2,  2, 7,   14,  120), // Neutral
  c('turkey',      'Turkey',              6,  2, 5,   22,  150), // Neutral
  c('ireland',     'Ireland',             1,  2, 7,   10,   80), // Neutral
  c('iceland',     'Iceland',             1,  3, 8,    7,   70), // Allied airbase

  // ── Micro-states (survived neutral) ──
  c('andorra',     'Andorra',             0,  1, 8,    1,   15), // Overlooked neutral
  c('liechtenstein','Liechtenstein',      0,  1, 9,    2,   20), // Overlooked neutral

  // ── Eliminated by Germany ──
  c('france',      'France',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('belgium',     'Belgium',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('netherlands', 'Netherlands',    0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('luxembourg',  'Luxembourg',     0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('denmark',     'Denmark',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('norway',      'Norway',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('poland',      'Poland',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('austria',     'Austria',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('czechia',     'Czechia',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('estonia',     'Estonia',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('latvia',      'Latvia',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('lithuania',   'Lithuania',      0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('belarus',     'Belarus',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('ukraine',     'Ukraine',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('slovenia',    'Slovenia',       0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('greece',      'Greece',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('serbia',      'Serbia',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('albania',     'Albania',        0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('montenegro',  'Montenegro',     0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),
  c('kosovo',      'Kosovo',         0,0,0, 0,0, { elim: true, annexedBy: 'germany' }),

  // ── Eliminated by Axis satellites ──
  c('moldova',     'Moldova',        0,0,0, 0,0, { elim: true, annexedBy: 'romania' }),
  c('north_macedonia','N. Macedonia',0,0,0, 0,0, { elim: true, annexedBy: 'bulgaria' }),
  c('bosnia',      'Bosnia',         0,0,0, 0,0, { elim: true, annexedBy: 'croatia' }),

  // ── British territories ──
  c('malta',       'Malta',          0,0,0, 0,0, { elim: true, annexedBy: 'uk' }),
  c('cyprus',      'Cyprus',         0,0,0, 0,0, { elim: true, annexedBy: 'uk' }),
];

// ── Alliances ────────────────────────────────────────────────

const DEMO_PACTS: Pact[] = [
  {
    id: 'axis', name: 'Axis Powers', abbreviation: 'AX', color: '#8b2020',
    members: ['germany', 'italy', 'romania', 'hungary', 'bulgaria', 'finland', 'croatia', 'slovakia'],
  },
  {
    id: 'allies', name: 'Allied Forces', abbreviation: 'AL', color: '#1a4a7a',
    members: ['uk', 'russia', 'iceland'],
  },
];

// ── Active wars ──────────────────────────────────────────────

const DEMO_WARS: War[] = [
  { attacker: 'germany', defender: 'russia',  started_on_turn: 2 }, // Operation Barbarossa / Eastern Front
  { attacker: 'uk',      defender: 'germany', started_on_turn: 1 }, // Battle of the Atlantic / Western Front
  { attacker: 'finland', defender: 'russia',  started_on_turn: 2 }, // Continuation War
];

// ── Event feed ───────────────────────────────────────────────

const DEMO_EVENTS: GameEvent[] = [
  // Turn 8
  {
    type: 'resolution', turn: 8, createdAt: ts(0),
    data: { type: 'combat', countries: ['germany', 'russia'], emoji: '⚔️',
      description: 'German Army Group Centre stalls 80km from Moscow. Soviet counter-attacks intensify in the north.' },
  },
  {
    type: 'resolution', turn: 8, createdAt: ts(0),
    data: { type: 'naval_combat', countries: ['uk', 'germany'], emoji: '⚓',
      description: 'Royal Navy sinks the Scharnhorst off Norway\'s North Cape. German naval supremacy in Atlantic challenged.' },
  },
  {
    type: 'resolution', turn: 8, createdAt: ts(0),
    data: { type: 'combat', countries: ['finland', 'russia'], emoji: '⚔️',
      description: 'Finnish forces hold the Karelian line. Brutal winter fighting. Neither side gains ground.' },
  },
  {
    type: 'resolution', turn: 8, createdAt: ts(0),
    data: { type: 'world_event', countries: ['germany'], emoji: '📉',
      description: 'Allied strategic bombing raids strike Hamburg and Cologne. German industrial output down 12%. War exhaustion rising.' },
  },
  // Turn 7
  {
    type: 'turn_start', turn: 7, createdAt: ts(1),
    data: { title: 'The Tide Turns', narrative: 'Soviet forces encircle German armies at Stalingrad. The myth of Wehrmacht invincibility cracks.' },
  },
  {
    type: 'resolution', turn: 7, createdAt: ts(1),
    data: { type: 'combat', countries: ['russia', 'germany'], emoji: '⚔️',
      description: 'Operation Uranus: Soviet armour smashes through Romanian flanks. German 6th Army encircled at Stalingrad.' },
  },
  {
    type: 'resolution', turn: 7, createdAt: ts(1),
    data: { type: 'combat', countries: ['uk', 'italy'], emoji: '⚔️',
      description: 'British 8th Army defeats Rommel at El Alamein. Axis forces in North Africa retreat 900km in two weeks.' },
  },
  {
    type: 'resolution', turn: 7, createdAt: ts(1),
    data: { type: 'sanction', countries: ['uk', 'germany'], emoji: '📋',
      description: 'Allied naval blockade tightens. Germany loses access to Atlantic shipping lanes. −14 GDP per turn.' },
  },
  // Turn 6
  {
    type: 'turn_start', turn: 6, createdAt: ts(2),
    data: { title: 'Fortress Europa', narrative: 'Germany fortifies its conquests. The occupied territories are bled for war material.' },
  },
  {
    type: 'resolution', turn: 6, createdAt: ts(2),
    data: { type: 'annexation', countries: ['germany', 'greece'], emoji: '🏴',
      description: 'Wehrmacht completes occupation of Greece. Athens garrison established. Resistance cells form in the mountains.' },
  },
  {
    type: 'resolution', turn: 6, createdAt: ts(2),
    data: { type: 'annexation', countries: ['germany', 'serbia'], emoji: '🏴',
      description: 'Serbia placed under Military Administration. Belgrade occupied. Partisan activity growing in Yugoslav hills.' },
  },
  {
    type: 'resolution', turn: 6, createdAt: ts(2),
    data: { type: 'world_event', countries: [], emoji: '⚡',
      description: 'Germany launches massive summer offensive: Operation Blue. Wehrmacht drives toward Stalingrad and the Caucasus oilfields.' },
  },
  // Turn 5
  {
    type: 'turn_start', turn: 5, createdAt: ts(3),
    data: { title: 'Barbarossa', narrative: 'Germany invades the Soviet Union. The largest military operation in history begins.' },
  },
  {
    type: 'resolution', turn: 5, createdAt: ts(3),
    data: { type: 'combat', countries: ['germany', 'russia'], emoji: '⚔️',
      description: 'Operation Barbarossa launched along a 2900km front. Three million Axis soldiers advance into Soviet territory.' },
  },
  {
    type: 'resolution', turn: 5, createdAt: ts(3),
    data: { type: 'annexation', countries: ['germany', 'ukraine'], emoji: '🏴',
      description: 'Wehrmacht seizes Kiev in 7 days. Reichskommissariat Ukraine established. Soviet forces in full retreat eastward.' },
  },
  {
    type: 'resolution', turn: 5, createdAt: ts(3),
    data: { type: 'annexation', countries: ['germany', 'belarus'], emoji: '🏴',
      description: 'Minsk falls in 6 days. Entire Byelorussian Front encircled. 300,000 prisoners taken.' },
  },
  {
    type: 'resolution', turn: 5, createdAt: ts(3),
    data: { type: 'combat', countries: ['finland', 'russia'], emoji: '⚔️',
      description: 'Finland re-enters the war alongside Germany. The Continuation War begins — "We take back what is ours."' },
  },
  // Turn 4
  {
    type: 'turn_start', turn: 4, createdAt: ts(4),
    data: { title: 'Blitzkrieg West', narrative: 'Germany overwhelms Western Europe in weeks. The impossible happens.' },
  },
  {
    type: 'resolution', turn: 4, createdAt: ts(4),
    data: { type: 'annexation', countries: ['germany', 'france'], emoji: '🏴',
      description: 'France falls in 46 days. German troops parade down the Champs-Élysées. The unthinkable has occurred.' },
  },
  {
    type: 'resolution', turn: 4, createdAt: ts(4),
    data: { type: 'annexation', countries: ['germany', 'belgium'], emoji: '🏴',
      description: 'Belgium capitulates in 18 days. British Expeditionary Force evacuated at Dunkirk — without its equipment.' },
  },
  {
    type: 'resolution', turn: 4, createdAt: ts(4),
    data: { type: 'annexation', countries: ['germany', 'netherlands'], emoji: '🏴',
      description: 'Netherlands surrenders after Rotterdam bombed. Dutch colonial empire continues fighting from exile.' },
  },
  {
    type: 'resolution', turn: 4, createdAt: ts(4),
    data: { type: 'annexation', countries: ['croatia', 'bosnia'], emoji: '🏴',
      description: 'Ustasha Croatia annexes Bosnia-Herzegovina. The Independent State of Croatia consolidates its territory.' },
  },
  {
    type: 'resolution', turn: 4, createdAt: ts(4),
    data: { type: 'annexation', countries: ['bulgaria', 'north_macedonia'], emoji: '🏴',
      description: 'Bulgaria occupies Macedonia. Sofia fulfils its long-standing territorial ambitions.' },
  },
  // Turn 3
  {
    type: 'turn_start', turn: 3, createdAt: ts(5),
    data: { title: 'Norway Falls', narrative: 'The Northern flank secured. Scandinavian iron ore now flows to German factories.' },
  },
  {
    type: 'resolution', turn: 3, createdAt: ts(5),
    data: { type: 'annexation', countries: ['germany', 'norway'], emoji: '🏴',
      description: 'Operation Weserübung conquers Norway in 62 days. Quisling installed as Minister-President.' },
  },
  {
    type: 'resolution', turn: 3, createdAt: ts(5),
    data: { type: 'annexation', countries: ['germany', 'denmark'], emoji: '🏴',
      description: 'Denmark occupied in 6 hours with minimal resistance. The Reich secures the Baltic approaches.' },
  },
  {
    type: 'resolution', turn: 3, createdAt: ts(5),
    data: { type: 'annexation', countries: ['germany', 'estonia'], emoji: '🏴',
      description: 'Baltic states incorporated into Reichskommissariat Ostland. Three nations vanish from the map.' },
  },
  {
    type: 'resolution', turn: 3, createdAt: ts(5),
    data: { type: 'annexation', countries: ['romania', 'moldova'], emoji: '🏴',
      description: 'Romania occupies Bessarabia and Transnistria. Romanian forces reach the Dnieper.' },
  },
  // Turns 1–2
  {
    type: 'turn_start', turn: 2, createdAt: ts(6),
    data: { title: 'Pacts of Steel', narrative: 'The alliances crystallise. Europe fractures into Axis and Allied camps.' },
  },
  {
    type: 'resolution', turn: 2, createdAt: ts(6),
    data: { type: 'alliance_formed', countries: ['germany', 'italy', 'romania', 'hungary', 'bulgaria', 'finland', 'croatia', 'slovakia'], emoji: '🤝',
      description: 'Tripartite Pact expanded. Eight nations join the Axis. "The New Order in Europe is established."' },
  },
  {
    type: 'resolution', turn: 2, createdAt: ts(6),
    data: { type: 'alliance_formed', countries: ['uk', 'russia', 'iceland'], emoji: '🤝',
      description: 'Allied Forces pact signed. "We shall fight on the beaches… we shall never surrender." — Churchill' },
  },
  {
    type: 'turn_start', turn: 1, createdAt: ts(7),
    data: { title: 'The War Begins', narrative: 'Germany invades Poland. The world holds its breath.' },
  },
  {
    type: 'resolution', turn: 1, createdAt: ts(7),
    data: { type: 'annexation', countries: ['germany', 'poland'], emoji: '🏴',
      description: 'Poland invaded from three sides. Warsaw falls in 27 days. "Poland has been destroyed — forever." — Hitler' },
  },
  {
    type: 'resolution', turn: 1, createdAt: ts(7),
    data: { type: 'annexation', countries: ['germany', 'austria'], emoji: '🏴',
      description: 'The Anschluss formalised: Austria absorbed into Greater Germany. 200,000 cheer in Vienna\'s Heldenplatz.' },
  },
  {
    type: 'resolution', turn: 1, createdAt: ts(7),
    data: { type: 'annexation', countries: ['germany', 'czechia'], emoji: '🏴',
      description: 'Protectorate of Bohemia and Moravia established. Czechoslovakia ceases to exist as a state.' },
  },
  {
    type: 'game_start', turn: 0, createdAt: ts(8),
    data: { description: 'Fortress Europa. Germany controls the continent. The Allies must break the Reich before time runs out.' },
  },
];

// ── Province remapping ────────────────────────────────────────
// Eliminated countries' provinces are remapped to the annexer so
// they render in the annexer's colour on the political map.

const ANNEXED: Record<string, string> = {
  // → germany
  france:       'germany',
  belgium:      'germany',
  netherlands:  'germany',
  luxembourg:   'germany',
  denmark:      'germany',
  norway:       'germany',
  poland:       'germany',
  austria:      'germany',
  czechia:      'germany',
  estonia:      'germany',
  latvia:       'germany',
  lithuania:    'germany',
  belarus:      'germany',
  ukraine:      'germany',
  slovenia:     'germany',
  greece:       'germany',
  serbia:       'germany',
  albania:      'germany',
  montenegro:   'germany',
  kosovo:       'germany',
  // → axis satellites
  moldova:      'romania',
  north_macedonia: 'bulgaria',
  bosnia:       'croatia',
  // → uk
  malta:        'uk',
  cyprus:       'uk',
};

function buildDemoProvinces() {
  const base = getDefaultProvinces();
  return base.map((p) => {
    const annexer = ANNEXED[p.owner_id];
    return annexer ? { ...p, owner_id: annexer } : p;
  });
}

// ── The hook ─────────────────────────────────────────────────

export function useStaticDemoState(): UseGameStateReturn {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<MapLayer>('political');
  const provinces = useMemo(() => buildDemoProvinces(), []);

  return {
    game: DEMO_GAME,
    countries: DEMO_COUNTRIES,
    provinces,
    pacts: DEMO_PACTS,
    wars: DEMO_WARS,
    unions: [],
    events: DEMO_EVENTS,
    wsStatus: 'connected' as WsStatus,
    loading: false,
    selectedCountry,
    selectCountry: setSelectedCountry,
    selectedProvince,
    selectProvince: setSelectedProvince,
    mapLayer,
    setMapLayer,
  };
}
