'use client';

import { useEffect, useState, useCallback } from 'react';
import { feature, mesh } from 'topojson-client';
import type { Country, War, Alliance } from '@/lib/types';
import { GAME_TO_NAME } from '@/lib/types';

// ---- ISO numeric → game country_id ----
const ISO_TO_GAME: Record<string, string> = {
  '250': 'france', '276': 'germany', '826': 'uk', '643': 'russia', '380': 'italy',
  '724': 'spain', '792': 'turkey', '616': 'poland', '804': 'ukraine', '528': 'netherlands',
  '752': 'sweden', '300': 'greece', '642': 'romania', '203': 'czechia', '620': 'portugal',
  '56': 'belgium', '348': 'hungary', '40': 'austria', '756': 'switzerland', '208': 'denmark',
  '246': 'finland', '578': 'norway', '372': 'ireland', '688': 'serbia', '191': 'croatia',
  '100': 'bulgaria', '703': 'slovakia', '440': 'lithuania', '428': 'latvia', '233': 'estonia',
  '705': 'slovenia', '8': 'albania', '807': 'north_macedonia', '70': 'bosnia', '498': 'moldova',
  '112': 'belarus', '352': 'iceland', '442': 'luxembourg', '470': 'malta', '196': 'cyprus',
  '499': 'montenegro', '-99': 'kosovo', '20': 'andorra', '438': 'liechtenstein',
};

const NAME_TO_GAME: Record<string, string> = {
  Kosovo: 'kosovo', Czechia: 'czechia', 'Czech Republic': 'czechia',
  'North Macedonia': 'north_macedonia', Macedonia: 'north_macedonia',
  'Bosnia and Herzegovina': 'bosnia', 'Bosnia and Herz.': 'bosnia',
};

// ---- Projection ----
const MAP_W = 960, MAP_H = 680;
const LON_MIN = -25, LON_MAX = 50, LAT_MIN = 34, LAT_MAX = 72;
const Y_MIN = Math.log(Math.tan(Math.PI / 4 + (LAT_MIN * Math.PI) / 360));
const Y_MAX = Math.log(Math.tan(Math.PI / 4 + (LAT_MAX * Math.PI) / 360));

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const mercN = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y = ((Y_MAX - mercN) / (Y_MAX - Y_MIN)) * MAP_H;
  return [x, y];
}

const F_LON_MIN = LON_MIN - 15, F_LON_MAX = LON_MAX + 20;
const F_LAT_MIN = LAT_MIN - 10, F_LAT_MAX = LAT_MAX + 10;

function clamp(lon: number, lat: number): [number, number] {
  return [
    Math.max(F_LON_MIN, Math.min(F_LON_MAX, lon)),
    Math.max(F_LAT_MIN, Math.min(F_LAT_MAX, lat)),
  ];
}

function inBounds(lon: number, lat: number) {
  return lon >= F_LON_MIN && lon <= F_LON_MAX && lat >= F_LAT_MIN && lat <= F_LAT_MAX;
}

function projectPt(lon: number, lat: number) {
  const [cl, ca] = clamp(lon, lat);
  const [x, y] = project(cl, ca);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

function isRingInEurope(ring: number[][]): boolean {
  let count = 0;
  for (const [lon, lat] of ring) {
    if (lon >= LON_MIN - 10 && lon <= LON_MAX + 15 && lat >= LAT_MIN - 5 && lat <= LAT_MAX + 5) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

function buildSegments(coords: number[][], minPts: number): string[][] {
  const segments: string[][] = [];
  let current: string[] = [];
  let prevLon: number | null = null;
  for (const [lon, lat] of coords) {
    if (prevLon !== null && Math.abs(lon - prevLon) > 40) {
      if (current.length >= minPts) segments.push(current);
      current = [];
    }
    prevLon = lon;
    current.push(projectPt(lon, lat));
  }
  if (current.length >= minPts) segments.push(current);
  return segments;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function meshToSvgPath(geometry: any): string {
  const parts: string[] = [];
  const lines: number[][][] = geometry.type === 'MultiLineString' ? geometry.coordinates :
    geometry.type === 'LineString' ? [geometry.coordinates] : [];
  for (const line of lines) {
    if (!line.some(([lon, lat]) => inBounds(lon, lat))) continue;
    for (const seg of buildSegments(line, 2)) parts.push('M' + seg.join('L'));
  }
  return parts.join('');
}

interface GeoGeometry {
  type: string;
  coordinates: number[][][][];
}

function geoToSvgPath(geometry: GeoGeometry): string {
  const rings: string[] = [];
  function addRing(coords: number[][]) {
    if (coords.length < 3) return;
    if (!isRingInEurope(coords)) return;
    for (const seg of buildSegments(coords, 3)) rings.push('M' + seg.join('L') + 'Z');
  }
  if (geometry.type === 'Polygon') {
    (geometry.coordinates as unknown as number[][][]).forEach((ring) => addRing(ring));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly) => poly.forEach((ring) => addRing(ring)));
  }
  return rings.join('');
}

function computeCentroid(geometry: GeoGeometry): { x: number; y: number } | null {
  let sx = 0, sy = 0, n = 0;
  function add(coords: number[][]) {
    for (const [lon, lat] of coords) {
      if (lon < LON_MIN - 5 || lon > LON_MAX + 5 || lat < LAT_MIN - 2 || lat > LAT_MAX + 2) continue;
      const [x, y] = project(lon, lat);
      sx += x; sy += y; n++;
    }
  }
  if (geometry.type === 'Polygon') {
    add((geometry.coordinates as unknown as number[][][])[0]);
  } else if (geometry.type === 'MultiPolygon') {
    let best: number[][] | null = null, bestLen = 0;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      const inB = ring.filter(([lon, lat]) =>
        lon >= LON_MIN - 5 && lon <= LON_MAX + 5 && lat >= LAT_MIN - 2 && lat <= LAT_MAX + 2
      );
      if (inB.length > bestLen) { best = ring; bestLen = inB.length; }
    }
    if (best) add(best);
  }
  return n > 0 ? { x: sx / n, y: sy / n } : null;
}

function computeBBox(geometry: GeoGeometry): { w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function check(coords: number[][]) {
    for (const [lon, lat] of coords) {
      if (lon < LON_MIN - 5 || lon > LON_MAX + 5 || lat < LAT_MIN - 2 || lat > LAT_MAX + 2) continue;
      const [x, y] = project(lon, lat);
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
  if (geometry.type === 'Polygon') check((geometry.coordinates as unknown as number[][][])[0]);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach((p) => check(p[0]));
  return { w: maxX - minX, h: maxY - minY };
}

// ---- Color palette (HOI4-style muted tones) ----
const COUNTRY_COLORS = [
  '#2e5339', '#2b4a6b', '#6b3232', '#5c5028', '#3d2b6b', '#1e5c5c', '#6b2850', '#4a5c24',
  '#345c24', '#1e4a70', '#704020', '#501e30', '#1e7050', '#401e70', '#701e40', '#1e7070',
  '#5c4020', '#1e3060', '#405c1e', '#601e1e', '#1e6040', '#301e60', '#606020', '#1e1e60',
  '#504020', '#1e5050', '#501e50', '#305050', '#505020', '#1e3050', '#501e30', '#301e50',
  '#405020', '#1e4050', '#504020', '#401e50', '#1e5040', '#501e40', '#404020', '#1e4040',
  '#401e1e', '#1e1e40', '#303020', '#1e3030',
];

/** Brighten a hex color for inner glow stroke */
function brighten(hex: string, factor = 0.5): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

/** Darken a hex color for annexed territory (HOI4-style occupied color) */
function darken(hex: string, factor = 0.72): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

const CENTROID_OVERRIDES: Record<string, [number, number]> = {
  france: project(2.5, 46.5),
  russia: project(40, 58),
  norway: project(10, 64),
  denmark: project(9.5, 56),
  uk: project(-2, 54),
  greece: project(22, 39),
  italy: project(12, 42.5),
  spain: project(-3.5, 40),
  turkey: project(35, 39),
  iceland: project(-19, 65),
  portugal: project(-8, 39.5),
  sweden: project(16, 63),
  finland: project(26, 64),
  croatia: project(16, 45),
  cyprus: project(33, 35.1),
  belgium: project(4.5, 50.5),
  austria: project(14, 47.5),
  switzerland: project(8, 46.8),
};

// Country size tiers for label sizing
const MAJOR_POWERS = new Set([
  'france', 'germany', 'uk', 'russia', 'italy', 'spain', 'turkey', 'poland', 'ukraine',
]);
const MEDIUM_POWERS = new Set([
  'sweden', 'finland', 'norway', 'romania', 'greece', 'netherlands', 'belgium', 'austria',
  'hungary', 'czechia', 'portugal', 'ireland', 'belarus', 'denmark', 'serbia', 'bulgaria',
]);

// ---- Parsed map data (cached) ----
interface ParsedCountryShape {
  gameId: string;
  pathD: string;
  isMicro: boolean;
  cx?: number;
  cy?: number;
}

interface MapData {
  shapes: ParsedCountryShape[];
  borderPath: string;
  centroids: Record<string, { x: number; y: number }>;
}

let cachedMapData: MapData | null = null;

async function loadMapData(): Promise<MapData> {
  if (cachedMapData) return cachedMapData;

  const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const world: any = await res.json();

  const countries = feature(world, world.objects.countries) as any;
  const shapes: ParsedCountryShape[] = [];
  const centroids: Record<string, { x: number; y: number }> = {};

  for (const feat of countries.features) {
    const rawId = String(feat.id);
    // TopoJSON stores ISO numeric codes as zero-padded strings ("056", "040", "008")
    // but also as plain numbers (56, 40, 8). Try both.
    const isoId = rawId;
    const isoIdStripped = String(parseInt(rawId, 10));
    const name: string = feat.properties?.name || '';
    const gameId = ISO_TO_GAME[isoId] || ISO_TO_GAME[isoIdStripped] || NAME_TO_GAME[name] || null;
    if (!gameId) continue;

    const pathD = geoToSvgPath(feat.geometry);
    if (!pathD) continue;

    const centroid = computeCentroid(feat.geometry);
    if (!centroid) continue;
    centroids[gameId] = centroid;

    const bbox = computeBBox(feat.geometry);
    const isMicro = bbox.w < 8 && bbox.h < 8;

    shapes.push({
      gameId,
      pathD,
      isMicro,
      cx: centroid.x,
      cy: centroid.y,
    });
  }

  // Apply centroid overrides
  for (const [id, [x, y]] of Object.entries(CENTROID_OVERRIDES)) {
    if (centroids[id]) centroids[id] = { x, y };
  }

  // Border mesh
  const meshGeom = mesh(world, world.objects.countries) as any;
  const borderPath = meshToSvgPath(meshGeom);

  cachedMapData = { shapes, borderPath, centroids };
  return cachedMapData;
}

// ---- Helpers for line label rotation ----
function lineAngleDeg(x1: number, y1: number, x2: number, y2: number): number {
  const rad = Math.atan2(y2 - y1, x2 - x1);
  let deg = (rad * 180) / Math.PI;
  // Keep text readable: flip if upside-down
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

// ---- Alliance group colors (distinct, visible on dark bg) ----
const ALLIANCE_COLORS = [
  '#00ff88', '#ff6b35', '#a855f7', '#00d4ff',
  '#ff3366', '#ffdd00', '#00ff44', '#ff8800',
];

// ---- Union-Find for alliance grouping ----
function buildAllianceGroups(alliances: Alliance[]): { countryToGroup: Map<string, number>; groupToColor: Map<number, string> } {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  }

  function union(a: string, b: string) {
    const pa = find(a), pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  }

  for (const a of alliances) {
    if (a.is_active !== false) union(a.countries[0], a.countries[1]);
  }

  const countryToGroup = new Map<string, number>();
  const rootToGroup = new Map<string, number>();
  const groupToColor = new Map<number, string>();
  let nextGroup = 0;

  for (const a of alliances) {
    if (a.is_active === false) continue;
    for (const c of a.countries) {
      const root = find(c);
      if (!rootToGroup.has(root)) {
        const gid = nextGroup++;
        rootToGroup.set(root, gid);
        groupToColor.set(gid, ALLIANCE_COLORS[gid % ALLIANCE_COLORS.length]);
      }
      countryToGroup.set(c, rootToGroup.get(root)!);
    }
  }

  return { countryToGroup, groupToColor };
}

// ---- Props ----
interface WorldMapProps {
  countries: Country[];
  selectedCountry: string | null;
  onSelectCountry: (id: string) => void;
  wars: War[];
  alliances: Alliance[];
}

export default function WorldMap({
  countries,
  selectedCountry,
  onSelectCountry,
  wars,
  alliances,
}: WorldMapProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  // Load map on mount
  useEffect(() => {
    let mounted = true;
    loadMapData()
      .then((data) => { if (mounted) setMapData(data); })
      .catch(() => { if (mounted) setLoadError(true); });
    return () => { mounted = false; };
  }, []);

  // Build lookup maps
  const countryMap = new Map<string, Country>();
  for (const c of countries) countryMap.set(c.country_id || c.id, c);

  // Assign colors (only non-eliminated countries get a fresh color slot)
  const colorMap: Record<string, string> = {};
  let ci = 0;
  for (const c of countries) {
    const id = c.country_id || c.id;
    if (!c.is_eliminated) colorMap[id] = COUNTRY_COLORS[ci++ % COUNTRY_COLORS.length];
  }

  // Build war set
  const warSet = new Set<string>();
  for (const w of wars) {
    if (w.is_active !== false) { warSet.add(w.attacker); warSet.add(w.defender); }
  }

  // Build alliance groups for dashed border outlines
  const { countryToGroup, groupToColor } = buildAllianceGroups(alliances);

  const handleCountryClick = useCallback((gameId: string) => {
    onSelectCountry(gameId);
  }, [onSelectCountry]);

  // ---- War gradient data ----
  interface GradInfo {
    id: string;
    targetId: string;
    x1: number; y1: number; x2: number; y2: number;
    color: string; momentum: number;
  }

  const warGradients: GradInfo[] = [];

  if (mapData) {
    for (const w of wars) {
      if (w.is_active === false) continue;
      const atkId = w.attacker, defId = w.defender;
      const atkC = countryMap.get(atkId), defC = countryMap.get(defId);
      if (!atkC || !defC) continue;
      const atkPos = mapData.centroids[atkId], defPos = mapData.centroids[defId];
      if (!atkPos || !defPos) continue;

      const atkColor = colorMap[atkId] || '#6b3232';
      const defColor = colorMap[defId] || '#2b4a6b';
      const atkTerr = atkC.territory || 0;
      const defTerr = defC.territory || 0;
      const totalTerr = atkTerr + defTerr;
      const momentum = totalTerr > 0 ? 0.3 + (atkTerr / totalTerr) * 0.4 : 0.5;

      warGradients.push({
        id: `wg-${atkId}-${defId}`,
        targetId: defId,
        x1: atkPos.x, y1: atkPos.y, x2: defPos.x, y2: defPos.y,
        color: atkColor, momentum,
      });
      warGradients.push({
        id: `wg-${defId}-${atkId}`,
        targetId: atkId,
        x1: defPos.x, y1: defPos.y, x2: atkPos.x, y2: atkPos.y,
        color: defColor, momentum: 1 - momentum,
      });
    }
  }

  if (!mapData && !loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-navy">
        <div className="spinner" />
        <p className="text-gold text-xs uppercase tracking-[2px]">Loading map data...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-navy">
        <p className="text-red-400 text-xs uppercase tracking-[2px]">Map load failed</p>
      </div>
    );
  }

  const { shapes, borderPath, centroids } = mapData!;

  return (
    <>
      <style>{`
        .wm-country { fill: #2d333b; cursor: pointer; transition: filter .15s ease; }
        .wm-country:hover { filter: brightness(1.35); }
        .wm-country.annexed { opacity: .85; }
        .wm-country.chaos { fill: #1a1a2e !important; opacity: .4; }
        .wm-country.selected { filter: brightness(1.2); }
        .wm-border { fill: none; stroke: #3a4150; stroke-width: .5; pointer-events: none; stroke-linejoin: round; stroke-linecap: round; }
        .wm-inner-glow { fill: none; pointer-events: none; stroke-linejoin: round; opacity: .35; }
        .wm-label { fill: #7a838c; text-anchor: middle; pointer-events: none; text-transform: uppercase; font-family: var(--font-aldrich,'Aldrich'),sans-serif; paint-order: stroke; stroke: #0c1219; stroke-linejoin: round; }
        .wm-label.major { font-size: 10px; fill: #e6edf3; font-weight: 700; letter-spacing: 1.5px; stroke-width: 3px; }
        .wm-label.medium { font-size: 6.5px; fill: #a0a8b0; letter-spacing: .8px; stroke-width: 2.5px; }
        .wm-label.minor { font-size: 5px; fill: #6a737d; letter-spacing: .4px; stroke-width: 2px; }
        .wm-alliance-border { fill: none; stroke-width: 1.6; stroke-dasharray: 5 3; opacity: .7; pointer-events: none; stroke-linejoin: round; }
        .wm-alliance { stroke: #3fb950; stroke-width: 1.5; stroke-dasharray: 6 3; opacity: .65; pointer-events: none; }
        .wm-warline { stroke: #e8412e; stroke-width: 2.4; stroke-dasharray: 5 3; opacity: .85; pointer-events: none; animation: march-dashes 0.6s linear infinite; }
        .wm-war-overlay { pointer-events: none; opacity: .35; }
        .wm-hover-hl { fill: none; stroke: #c9a227; stroke-width: 1; pointer-events: none; stroke-linejoin: round; }
        .wm-select-hl { fill: none; stroke: #f0c030; stroke-width: 1.8; pointer-events: none; stroke-linejoin: round; animation: pulse-gold 1.8s ease-in-out infinite; }
        .wm-line-label { font-size: 5.5px; font-family: var(--font-aldrich,'Aldrich'),sans-serif; text-anchor: middle; pointer-events: none; letter-spacing: 1.5px; text-transform: uppercase; paint-order: stroke; stroke-width: 2.5px; stroke-linejoin: round; }
        .wm-line-label.alliance { fill: #3fb950; stroke: #0c1219; }
        .wm-line-label.war { fill: #e8412e; stroke: #0c1219; font-weight: 700; letter-spacing: 2px; }
        @keyframes march-dashes { to { stroke-dashoffset: -16; } }
        @keyframes pulse-gold { 0%, 100% { stroke-width: 1.8px; opacity: 0.9; } 50% { stroke-width: 2.5px; opacity: 1; } }
      `}</style>

      <svg
        viewBox="-20 -10 1000 700"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', cursor: 'default' }}
      >
        <defs>
          <clipPath id="europe-clip">
            <rect x="-20" y="-10" width="1000" height="700" />
          </clipPath>

          {/* Vignette — darkens edges for HOI4 atmosphere */}
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
            <stop offset="55%" stopColor="transparent" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
          </radialGradient>

          {/* War gradient definitions */}
          {warGradients.map((g) => (
            <linearGradient
              key={g.id}
              id={g.id}
              gradientUnits="userSpaceOnUse"
              x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
            >
              <stop offset="0%" stopColor={g.color} stopOpacity={0} />
              <stop offset={`${g.momentum * 100}%`} stopColor={g.color} stopOpacity={1} />
              <stop offset="100%" stopColor={g.color} stopOpacity={0.3} />
            </linearGradient>
          ))}
        </defs>

        {/* Sea background */}
        <rect x="-50" y="-50" width="1100" height="800" fill="#0c1219" />

        {/* Countries layer */}
        <g clipPath="url(#europe-clip)">
          {shapes.map((s) => {
            const cd = countryMap.get(s.gameId);
            const isEliminated = cd?.is_eliminated ?? false;
            const controller = cd?.annexed_by && cd.annexed_by !== 'chaos' ? cd.annexed_by : null;
            const isAnnexed = !!controller && isEliminated;
            const isChaos = isEliminated && !controller;
            const isClaimed = !!cd && !isEliminated;
            const isSelected = selectedCountry === s.gameId;

            // Color: annexed = darkened conqueror color, chaos = dark navy, active = normal color
            const fill = isAnnexed
              ? darken(colorMap[controller!] ?? '#2d333b')
              : isChaos
                ? '#1a1a2e'
                : isClaimed
                  ? colorMap[s.gameId] ?? '#2d333b'
                  : '#2d333b';

            let cls = 'wm-country';
            if (isAnnexed) cls += ' annexed';
            if (isChaos) cls += ' chaos';
            if (isSelected) cls += ' selected';

            const commonProps = {
              className: cls,
              style: { fill },
              onClick: () => handleCountryClick(s.gameId),
              onMouseEnter: () => setHoveredCountry(s.gameId),
              onMouseLeave: () => setHoveredCountry(null),
            };

            return s.isMicro ? (
              <circle
                key={s.gameId}
                cx={s.cx}
                cy={s.cy}
                r={5}
                {...commonProps}
              />
            ) : (
              <path
                key={s.gameId}
                d={s.pathD}
                {...commonProps}
              />
            );
          })}
        </g>

        {/* Inner glow layer — HOI4-style bright edge on claimed + annexed countries */}
        <g clipPath="url(#europe-clip)">
          {shapes.map((s) => {
            const cd = countryMap.get(s.gameId);
            if (!cd) return null;
            const controller = cd.annexed_by && cd.annexed_by !== 'chaos' ? cd.annexed_by : null;
            const baseColor = controller ? colorMap[controller] : (cd.is_eliminated ? null : colorMap[s.gameId]);
            if (!baseColor) return null;
            const glowColor = brighten(baseColor, controller ? 0.3 : 0.55);

            return s.isMicro ? (
              <circle
                key={`ig-${s.gameId}`}
                cx={s.cx}
                cy={s.cy}
                r={5}
                className="wm-inner-glow"
                style={{ stroke: glowColor, strokeWidth: 2 }}
              />
            ) : (
              <path
                key={`ig-${s.gameId}`}
                d={s.pathD}
                className="wm-inner-glow"
                style={{ stroke: glowColor, strokeWidth: 1.8 }}
              />
            );
          })}
        </g>

        {/* Alliance dashed border outlines — unique color per alliance group */}
        <g clipPath="url(#europe-clip)">
          {shapes.map((s) => {
            const groupId = countryToGroup.get(s.gameId);
            if (groupId === undefined) return null;
            const color = groupToColor.get(groupId) ?? '#00ff88';

            return s.isMicro ? (
              <circle
                key={`ab-${s.gameId}`}
                cx={s.cx}
                cy={s.cy}
                r={6}
                className="wm-alliance-border"
                style={{ stroke: color }}
              />
            ) : (
              <path
                key={`ab-${s.gameId}`}
                d={s.pathD}
                className="wm-alliance-border"
                style={{ stroke: color }}
              />
            );
          })}
        </g>

        {/* War gradient overlays */}
        <g clipPath="url(#europe-clip)">
          {warGradients.map((g) => {
            const targetShape = shapes.find((s) => s.gameId === g.targetId);
            if (!targetShape) return null;

            return targetShape.isMicro ? (
              <circle
                key={`ov-${g.id}`}
                cx={targetShape.cx}
                cy={targetShape.cy}
                r={5}
                className="wm-war-overlay"
                style={{ fill: `url(#${g.id})`, stroke: 'none' }}
              />
            ) : (
              <path
                key={`ov-${g.id}`}
                d={targetShape.pathD}
                className="wm-war-overlay"
                style={{ fill: `url(#${g.id})`, stroke: 'none' }}
              />
            );
          })}
        </g>

        {/* Border mesh */}
        <g clipPath="url(#europe-clip)">
          {borderPath && <path d={borderPath} className="wm-border" />}
        </g>

        {/* Annexation borders — paint over shared borders with empire color, HOI4-style */}
        <g clipPath="url(#europe-clip)">
          {shapes.map((s) => {
            const cd = countryMap.get(s.gameId);
            if (!cd?.annexed_by || cd.annexed_by === 'chaos') return null;
            const controllerColor = colorMap[cd.annexed_by];
            if (!controllerColor) return null;
            return s.isMicro ? (
              <circle
                key={`annex-border-${s.gameId}`}
                cx={s.cx} cy={s.cy} r={6}
                fill="none" stroke={controllerColor} strokeWidth={1.2}
                pointerEvents="none" opacity={0.7}
              />
            ) : (
              <path
                key={`annex-border-${s.gameId}`}
                d={s.pathD}
                fill="none" stroke={controllerColor} strokeWidth={1.2}
                pointerEvents="none" opacity={0.7}
              />
            );
          })}
        </g>

        {/* Hover / select highlight layer */}
        <g clipPath="url(#europe-clip)">
          {hoveredCountry && hoveredCountry !== selectedCountry && (() => {
            const s = shapes.find((sh) => sh.gameId === hoveredCountry);
            if (!s) return null;
            return s.isMicro ? (
              <circle
                cx={s.cx} cy={s.cy} r={5}
                className="wm-hover-hl"
                pointerEvents="none"
              />
            ) : (
              <path d={s.pathD} className="wm-hover-hl" pointerEvents="none" />
            );
          })()}
          {selectedCountry && (() => {
            const s = shapes.find((sh) => sh.gameId === selectedCountry);
            if (!s) return null;
            return s.isMicro ? (
              <circle
                cx={s.cx} cy={s.cy} r={5}
                className="wm-select-hl"
                pointerEvents="none"
              />
            ) : (
              <path d={s.pathD} className="wm-select-hl" pointerEvents="none" />
            );
          })()}
        </g>

        {/* Relations layer — lines + rotated text labels */}
        <g>
          {alliances.map((a) => {
            if (!a.is_active && a.is_active !== undefined) return null;
            const p1 = centroids[a.countries[0]], p2 = centroids[a.countries[1]];
            if (!p1 || !p2) return null;
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const angle = lineAngleDeg(p1.x, p1.y, p2.x, p2.y);
            const groupId = countryToGroup.get(a.countries[0]);
            const lineColor = groupId !== undefined ? (groupToColor.get(groupId) ?? '#3fb950') : '#3fb950';
            const label = a.abbreviation || a.name || 'ALLIANCE';
            return (
              <g key={a.id}>
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  className="wm-alliance"
                  style={{ stroke: lineColor }}
                />
                <text
                  x={mx} y={my - 3}
                  className="wm-line-label alliance"
                  style={{ fill: lineColor }}
                  transform={`rotate(${angle.toFixed(1)},${mx.toFixed(1)},${(my - 3).toFixed(1)})`}
                >
                  {label.toUpperCase()}
                </text>
              </g>
            );
          })}
          {wars.map((w) => {
            if (w.is_active === false) return null;
            const p1 = centroids[w.attacker], p2 = centroids[w.defender];
            if (!p1 || !p2) return null;
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const angle = lineAngleDeg(p1.x, p1.y, p2.x, p2.y);
            return (
              <g key={w.id}>
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  className="wm-warline"
                />
                <text
                  x={mx} y={my - 3}
                  className="wm-line-label war"
                  transform={`rotate(${angle.toFixed(1)},${mx.toFixed(1)},${(my - 3).toFixed(1)})`}
                >
                  AT WAR
                </text>
              </g>
            );
          })}
        </g>

        {/* Labels layer — skip annexed territories (HOI4: empire speaks for itself) */}
        <g>
          {mapData && Object.entries(centroids).map(([gid, pos]) => {
            const cd = countryMap.get(gid);
            // Don't show label for annexed territories
            if (cd?.is_eliminated && cd.annexed_by && cd.annexed_by !== 'chaos') return null;
            const isMajor = MAJOR_POWERS.has(gid);
            const isMedium = MEDIUM_POWERS.has(gid);
            const name = GAME_TO_NAME[gid] ?? gid;
            const tier = isMajor ? 'major' : isMedium ? 'medium' : 'minor';
            const yOff = isMajor ? 6 : isMedium ? 4 : 3;
            return (
              <text
                key={gid}
                x={pos.x}
                y={pos.y + yOff}
                className={`wm-label ${tier}`}
              >
                {name.toUpperCase()}
              </text>
            );
          })}
        </g>

        {/* Vignette overlay — atmospheric edge darkening */}
        <rect x="-50" y="-50" width="1100" height="800"
          fill="url(#vignette)" pointerEvents="none" />

      </svg>
    </>
  );
}
