'use client';

import { useEffect, useState, useCallback, useMemo, memo, useRef } from 'react';
import type { Country, Province, War, Pact, MapLayer } from '@/lib/types';
import { GAME_TO_NAME } from '@/lib/types';
import { getProvinceCountryMap, getProvinceTerrainMap } from '@/lib/provinceDefaults';

// ---- Color palette (HOI4-style, WWII-themed) ----
const COUNTRY_COLORS: Record<string, string> = {
  // Axis powers
  germany:          '#4a5c35', // Wehrmacht feldgrau
  italy:            '#7a6030', // Italian khaki
  romania:          '#6b4a2a', // Romanian brown
  hungary:          '#5c4a1e', // Hungarian gold-brown
  bulgaria:         '#4a5040', // Bulgarian olive
  finland:          '#3a6060', // Finnish teal-grey
  croatia:          '#5c3a3a', // Croatian dark red-brown
  slovakia:         '#3a503a', // Slovak green
  // Allied powers
  uk:               '#2a4a6b', // British navy
  russia:           '#6b2020', // Soviet red
  iceland:          '#1e3a5c', // Allied slate blue
  // Neutrals
  sweden:           '#7a6020', // Swedish gold
  switzerland:      '#5c1e1e', // Swiss red
  spain:            '#6b3020', // Spanish terracotta
  portugal:         '#3a5c2a', // Portuguese green
  turkey:           '#5c4020', // Turkish ochre
  ireland:          '#2a5c2a', // Irish green
  andorra:          '#3a3a5c',
  liechtenstein:    '#3a2a5c',
  // Below: normally annexed in demo; colors only matter in non-WWII scenarios
  france:           '#2e5339',
  poland:           '#4a5c24',
  ukraine:          '#345c24',
  netherlands:      '#1e4a70',
  greece:           '#1e7050',
  czechia:          '#401e70',
  belgium:          '#5c4020',
  austria:          '#405c1e',
  denmark:          '#1e6040',
  norway:           '#606020',
  serbia:           '#504020',
  belarus:          '#1e5040',
  estonia:          '#501e30',
  latvia:           '#1e3050',
  lithuania:        '#505020',
  slovenia:         '#301e50',
  albania:          '#405020',
  north_macedonia:  '#1e4050',
  bosnia:           '#504020',
  moldova:          '#401e50',
  luxembourg:       '#404020',
  malta:            '#1e4040',
  cyprus:           '#401e1e',
  montenegro:       '#1e1e40',
  kosovo:           '#303020',
};

function getCountryColor(countryId: string): string {
  return COUNTRY_COLORS[countryId] ?? '#2d333b';
}

function brighten(hex: string, factor = 0.5): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

// Terrain color palette
const TERRAIN_COLORS: Record<string, string> = {
  plains:    '#6b8c42',   // muted green
  coastal:   '#3b7ea1',   // steel blue
  mountains: '#7a6652',   // brownish grey
  urban:     '#c8a84b',   // amber/gold
};
function terrainColor(terrain: string): string {
  return TERRAIN_COLORS[terrain] ?? '#4a5060';
}

// GDP heatmap color (green = high, red = low)
function gdpColor(gdp: number): string {
  const min = 5, max = 80;
  const t = Math.max(0, Math.min(1, (gdp - min) / (max - min)));
  const r = Math.round(220 * (1 - t));
  const g = Math.round(180 * t);
  const b = 40;
  return `rgb(${r},${g},${b})`;
}

// ---- Pre-computed province shapes (from build script) ----
interface ProvinceShape {
  nuts2Id: string;
  pathD: string;
  centroid: { x: number; y: number } | null;
}

interface MapData {
  provinceShapes: ProvinceShape[];
}

let cachedMapData: MapData | null = null;

async function loadMapData(): Promise<MapData> {
  if (cachedMapData) return cachedMapData;

  const res = await fetch('/data/map-paths.json');
  const shapes: { id: string; d: string; c: { x: number; y: number } | null }[] = await res.json();

  cachedMapData = {
    provinceShapes: shapes.map((s) => ({
      nuts2Id: s.id,
      pathD: s.d,
      centroid: s.c,
    })),
  };
  return cachedMapData;
}

// ---- Memoised province fill layer ----
// Lives OUTSIDE WorldMap so React.memo identity is stable.
// Only re-renders when fills or selection actually change — NOT on hover/tooltip.
interface FillLayerProps {
  provinceShapes: ProvinceShape[];
  fillMap: Map<string, string>;
  ownerMap: Map<string, string>;
  selectedProvince: string | null;
  selectedCountry: string | null;
  onGroupClick: (e: React.MouseEvent<SVGGElement>) => void;
  onGroupDblClick: (e: React.MouseEvent<SVGGElement>) => void;
  onGroupMouseOver: (e: React.MouseEvent<SVGGElement>) => void;
  onGroupMouseLeave: () => void;
}

const ProvinceFillLayer = memo(function ProvinceFillLayer({
  provinceShapes, fillMap, ownerMap,
  selectedProvince, selectedCountry,
  onGroupClick, onGroupDblClick, onGroupMouseOver, onGroupMouseLeave,
}: FillLayerProps) {
  return (
    <g
      onClick={onGroupClick}
      onDoubleClick={onGroupDblClick}
      onMouseOver={onGroupMouseOver}
      onMouseLeave={onGroupMouseLeave}
    >
      {provinceShapes.map((shape) => {
        const fill = fillMap.get(shape.nuts2Id) ?? '#2d333b';
        const isSelected = selectedProvince === shape.nuts2Id;
        const isCountrySelected = !selectedProvince && !!selectedCountry &&
          ownerMap.get(shape.nuts2Id) === selectedCountry;
        return (
          <path
            key={shape.nuts2Id}
            d={shape.pathD}
            data-id={shape.nuts2Id}
            className={`prov${isSelected || isCountrySelected ? ' selected' : ''}`}
            style={{ fill }}
          />
        );
      })}
    </g>
  );
});

// ---- Props ----
interface WorldMapProps {
  countries: Country[];
  provinces: Province[];
  selectedCountry: string | null;
  selectedProvince: string | null;
  onSelectCountry: (id: string) => void;
  onSelectProvince: (id: string) => void;
  wars: War[];
  pacts: Pact[];
  mapLayer: MapLayer;
}

export default function WorldMap({
  countries,
  provinces,
  selectedCountry,
  selectedProvince,
  onSelectCountry,
  onSelectProvince,
  wars,
  pacts,
  mapLayer,
}: WorldMapProps) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  // Tooltip position never goes through React state — updated directly on the DOM element
  // so mouse movement causes zero re-renders.
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastHoverId = useRef<string | null>(null);
  const hoverRafId = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    loadMapData()
      .then((data) => { if (mounted) setMapData(data); })
      .catch(() => { if (mounted) setLoadError(true); });
    return () => { mounted = false; };
  }, []);

  // Build lookup maps
  const provinceMap = useMemo(() => {
    const map = new Map<string, Province>();
    for (const p of provinces) map.set(p.nuts2_id, p);
    return map;
  }, [provinces]);

  const countryMap = useMemo(() => {
    const map = new Map<string, Country>();
    for (const c of countries) map.set(c.country_id, c);
    return map;
  }, [countries]);

  // Build pact membership for alliance layer
  const countryToPact = useMemo(() => {
    const map = new Map<string, { color: string; abbreviation: string }>();
    for (const p of pacts) {
      const color = p.color ?? '#00ff88';
      for (const m of p.members) {
        map.set(m, { color, abbreviation: p.abbreviation });
      }
    }
    return map;
  }, [pacts]);

  // Compute country centroids from owned provinces
  const countryCentroids = useMemo(() => {
    if (!mapData) return new Map<string, { x: number; y: number }>();
    const centroids = new Map<string, { x: number; y: number }>();
    const countryPoints = new Map<string, { sx: number; sy: number; n: number }>();

    for (const shape of mapData.provinceShapes) {
      const prov = provinceMap.get(shape.nuts2Id);
      if (!prov || !shape.centroid) continue;
      const owner = prov.owner_id;
      if (!countryPoints.has(owner)) countryPoints.set(owner, { sx: 0, sy: 0, n: 0 });
      const pts = countryPoints.get(owner)!;
      pts.sx += shape.centroid.x;
      pts.sy += shape.centroid.y;
      pts.n++;
    }

    for (const [id, pts] of countryPoints) {
      centroids.set(id, { x: pts.sx / pts.n, y: pts.sy / pts.n });
    }
    return centroids;
  }, [mapData, provinceMap]);

  // Static fallback: nuts2_id → country_id from game data files
  const staticCountryMap = useMemo(() => getProvinceCountryMap(), []);
  // Static terrain: always available regardless of game state
  const staticTerrainMap = useMemo(() => getProvinceTerrainMap(), []);

  // Event delegation handlers — single function shared by all paths
  const handleGroupClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const id = (e.target as SVGElement).dataset.id;
    if (!id) return;
    const prov = provinceMap.get(id);
    const ownerId = prov?.owner_id ?? staticCountryMap.get(id);
    onSelectProvince(id);
    if (ownerId) onSelectCountry(ownerId);
  }, [provinceMap, staticCountryMap, onSelectProvince, onSelectCountry]);

  const handleGroupDblClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const id = (e.target as SVGElement).dataset.id;
    if (!id) return;
    e.stopPropagation();
    const prov = provinceMap.get(id);
    const ownerId = prov?.owner_id ?? staticCountryMap.get(id);
    onSelectProvince('');
    if (ownerId) onSelectCountry(ownerId);
  }, [provinceMap, staticCountryMap, onSelectProvince, onSelectCountry]);

  const handleGroupMouseOver = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const id = (e.target as SVGElement).dataset.id;
    if (!id || id === lastHoverId.current) return; // same province — skip re-render
    lastHoverId.current = id;
    cancelAnimationFrame(hoverRafId.current);
    hoverRafId.current = requestAnimationFrame(() => setHoveredProvince(id));
  }, []);

  const handleGroupMouseLeave = useCallback(() => {
    lastHoverId.current = null;
    cancelAnimationFrame(hoverRafId.current);
    setHoveredProvince(null);
  }, []);

  // Get province fill color based on map layer
  const getProvinceFill = useCallback((prov: Province | undefined, nuts2Id: string): string => {
    switch (mapLayer) {
      case 'terrain': {
        // Use live terrain if available, fall back to static data — always has a value
        const terrain = prov?.terrain ?? staticTerrainMap.get(nuts2Id) ?? 'plains';
        return terrainColor(terrain);
      }
      case 'alliance': {
        if (!prov || !countryMap.has(prov.owner_id)) return '#2d333b';
        const pactInfo = countryToPact.get(prov.owner_id);
        return pactInfo ? pactInfo.color + '88' : getCountryColor(prov.owner_id);
      }
      case 'economic':
        if (!prov || !countryMap.has(prov.owner_id)) return '#2d333b';
        return gdpColor(prov.gdp_value);
      case 'political':
      default: {
        if (!prov || !countryMap.has(prov.owner_id)) return '#2d333b';
        const country = countryMap.get(prov.owner_id)!;
        if (country.is_eliminated && country.annexed_by) {
          return getCountryColor(country.annexed_by);
        }
        return getCountryColor(prov.owner_id);
      }
    }
  }, [mapLayer, countryMap, countryToPact, staticTerrainMap]);

  // Pre-compute all fills — only changes when layer/game data changes, not on hover
  const fillMap = useMemo(() => {
    if (!mapData) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const shape of mapData.provinceShapes) {
      const prov = provinceMap.get(shape.nuts2Id);
      map.set(shape.nuts2Id, getProvinceFill(prov, shape.nuts2Id));
    }
    return map;
  }, [mapData, provinceMap, getProvinceFill]);

  // Province → owner lookup for selection highlighting (no dependency on fills)
  const ownerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, prov] of provinceMap) map.set(id, prov.owner_id);
    return map;
  }, [provinceMap]);

  // Get hovered province data for tooltip
  const hoveredData = hoveredProvince ? provinceMap.get(hoveredProvince) : null;
  const hoveredOwner = hoveredData ? countryMap.get(hoveredData.owner_id) : null;

  if (!mapData && !loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-navy">
        <div className="spinner" />
        <p className="text-gold text-xs uppercase tracking-[2px]">Loading NUTS2 map data...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 bg-navy">
        <p className="text-red-400 text-xs uppercase tracking-[2px]">NUTS2 map load failed</p>
        <p className="text-gray-500 text-xs">Place nuts2-europe.json in public/data/</p>
      </div>
    );
  }

  const { provinceShapes } = mapData!;

  return (
    <>
      <style>{`
        .prov { cursor: pointer; transition: filter .12s ease; stroke: #1a1e26; stroke-width: 0.25; }
        .country-border { fill: none; stroke: #5a6680; stroke-width: 1.4; pointer-events: none; stroke-linejoin: round; stroke-linecap: round; }
        .prov:hover { filter: brightness(1.4); }
        .prov.selected { filter: brightness(1.25); }
        .prov-border-thick { fill: none; stroke: #3a4150; stroke-width: 1.2; pointer-events: none; stroke-linejoin: round; }
        .prov-border-thin { fill: none; stroke: #2a3040; stroke-width: 0.3; pointer-events: none; }
        .prov-capital { fill: none; stroke: #f0c030; stroke-width: 1.5; pointer-events: none; }
        .prov-hover { fill: none; stroke: #c9a227; stroke-width: 1; pointer-events: none; }
        .prov-select { fill: none; stroke: #f0c030; stroke-width: 0.8; pointer-events: none; animation: pulse-gold 1.8s ease-in-out infinite; }
        .country-label { fill: #e6edf3; text-anchor: middle; pointer-events: none; text-transform: uppercase; font-family: var(--font-aldrich,'Aldrich'),sans-serif; paint-order: stroke; stroke: #0c1219; stroke-linejoin: round; font-size: 7px; letter-spacing: 1px; stroke-width: 2.5px; }
        .warline { stroke: #e8412e; stroke-width: 2.4; stroke-dasharray: 5 3; opacity: .85; pointer-events: none; animation: march-dashes 0.6s linear infinite; }
        .war-label { font-size: 5.5px; fill: #e8412e; font-family: var(--font-aldrich,'Aldrich'),sans-serif; text-anchor: middle; pointer-events: none; letter-spacing: 2px; text-transform: uppercase; paint-order: stroke; stroke: #0c1219; stroke-width: 2.5px; stroke-linejoin: round; font-weight: 700; }
        @keyframes march-dashes { to { stroke-dashoffset: -16; } }
        @keyframes pulse-gold { 0%, 100% { stroke-width: 0.8px; opacity: 0.85; } 50% { stroke-width: 1.4px; opacity: 1; } }
      `}</style>

      {/* Terrain legend */}
      {mapLayer === 'terrain' && (
        <div className="absolute bottom-4 left-3 z-10 bg-gray-900/90 border border-gray-700 rounded px-3 py-2 pointer-events-none">
          <div className="text-[9px] uppercase tracking-widest text-dim mb-1.5 font-bold">Terrain</div>
          <div className="flex flex-col gap-1">
            {([
              ['plains',    '#6b8c42', 'Plains'],
              ['coastal',   '#3b7ea1', 'Coastal'],
              ['mountains', '#7a6652', 'Mountains'],
              ['urban',     '#c8a84b', 'Urban'],
            ] as const).map(([, color, label]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-text">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Province tooltip — position updated via DOM ref, no React re-render on mouse move */}
      <div
        ref={tooltipRef}
        className="absolute z-50 bg-gray-900/95 border border-gray-700 rounded px-3 py-2 pointer-events-none text-xs"
        style={{ display: 'none', left: 0, top: 0 }}
      >
        {hoveredData && (
          <>
            <div className="font-bold text-gold">{hoveredData.name}</div>
            <div className="text-gray-400 text-[10px]">{hoveredData.nuts2_id}</div>
            <div className="mt-1 space-y-0.5">
              <div>Owner: <span className="text-white">{hoveredOwner?.display_name ?? hoveredData.owner_id}</span></div>
              <div>Troops: <span className="text-white">{hoveredData.troops_stationed}K</span></div>
              <div>GDP: <span className="text-white">{hoveredData.gdp_value}M</span></div>
              <div>Terrain: <span className="text-white">{hoveredData.terrain}</span></div>
              {hoveredData.is_capital && <div className="text-yellow-400 font-bold">CAPITAL</div>}
            </div>
          </>
        )}
      </div>

      <svg
        viewBox="-20 -10 1000 700"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', cursor: 'default' }}
        onMouseMove={(e) => {
          const t = tooltipRef.current;
          if (!t) return;
          const rect = e.currentTarget.getBoundingClientRect();
          t.style.left = `${e.clientX - rect.left + 14}px`;
          t.style.top  = `${e.clientY - rect.top  - 12}px`;
          t.style.display = lastHoverId.current ? 'block' : 'none';
        }}
        onMouseLeave={() => {
          if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        }}
      >
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
            <stop offset="55%" stopColor="transparent" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.55} />
          </radialGradient>
        </defs>

        {/* Sea background */}
        <rect x="-50" y="-50" width="1100" height="800" fill="#0d1117" />

        {/* Province fills — memoised, won't re-render on hover/tooltip changes */}
        <ProvinceFillLayer
          provinceShapes={provinceShapes}
          fillMap={fillMap}
          ownerMap={ownerMap}
          selectedProvince={selectedProvince}
          selectedCountry={selectedCountry}
          onGroupClick={handleGroupClick}
          onGroupDblClick={handleGroupDblClick}
          onGroupMouseOver={handleGroupMouseOver}
          onGroupMouseLeave={handleGroupMouseLeave}
        />

        {/* Country borders removed — no longer computed client-side */}

        {/* Capital markers */}
        <g>
          {provinceShapes.map((shape) => {
            const prov = provinceMap.get(shape.nuts2Id);
            if (!prov?.is_capital || !shape.centroid) return null;
            return (
              <circle
                key={`cap-${shape.nuts2Id}`}
                cx={shape.centroid.x}
                cy={shape.centroid.y}
                r={3}
                fill="#f0c030"
                stroke="#0c1219"
                strokeWidth={1}
                pointerEvents="none"
              />
            );
          })}
        </g>

        {/* Hover highlight */}
        {hoveredProvince && (() => {
          const shape = provinceShapes.find((s) => s.nuts2Id === hoveredProvince);
          if (!shape) return null;
          return <path d={shape.pathD} className="prov-hover" />;
        })()}

        {/* Selection highlight */}
        {selectedProvince ? (() => {
          const shape = provinceShapes.find((s) => s.nuts2Id === selectedProvince);
          if (!shape) return null;
          return <path d={shape.pathD} className="prov-select" />;
        })() : selectedCountry ? (
          <g>
            {provinceShapes.filter((s) => provinceMap.get(s.nuts2Id)?.owner_id === selectedCountry).map((s) => (
              <path key={`sel-${s.nuts2Id}`} d={s.pathD} className="prov-select" />
            ))}
          </g>
        ) : null}

        {/* War lines */}
        <g>
          {wars.map((w, i) => {
            const atkPos = countryCentroids.get(w.attacker);
            const defPos = countryCentroids.get(w.defender);
            if (!atkPos || !defPos) return null;
            const mx = (atkPos.x + defPos.x) / 2;
            const my = (atkPos.y + defPos.y) / 2;
            return (
              <g key={`war-${i}`}>
                <line
                  x1={atkPos.x} y1={atkPos.y} x2={defPos.x} y2={defPos.y}
                  className="warline"
                />
                <text x={mx} y={my - 4} className="war-label">AT WAR</text>
              </g>
            );
          })}
        </g>

        {/* Country labels at centroids */}
        <g>
          {Array.from(countryCentroids.entries()).map(([countryId, pos]) => {
            const country = countryMap.get(countryId);
            if (!country || country.is_eliminated) return null;
            const name = GAME_TO_NAME[countryId] ?? country.display_name;
            return (
              <text
                key={`label-${countryId}`}
                x={pos.x}
                y={pos.y + 4}
                className="country-label"
              >
                {name.toUpperCase()}
              </text>
            );
          })}
        </g>

        {/* Vignette */}
        <rect x="-50" y="-50" width="1100" height="800"
          fill="url(#vignette)" pointerEvents="none" />
      </svg>
    </>
  );
}
