'use client';

import type { Alliance, Country } from '@/lib/types';
import { GAME_TO_NAME, GAME_TO_FLAG, codeToEmoji } from '@/lib/types';

interface AlliancesTabProps {
  alliances: Alliance[];
  countries: Country[];
  onSelectCountry: (id: string) => void;
}

// Same palette used in WorldMap
const ALLIANCE_COLORS = [
  '#00ff88', '#ff6b35', '#a855f7', '#00d4ff',
  '#ff3366', '#ffdd00', '#00ff44', '#ff8800',
];

interface AllianceGroup {
  name: string;
  abbreviation: string | null;
  color: string;
  members: string[];
  pairs: Alliance[];
}

function buildGroups(alliances: Alliance[]): AllianceGroup[] {
  const active = alliances.filter(a => a.is_active !== false);
  if (!active.length) return [];

  // Union-Find
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

  for (const a of active) union(a.countries[0], a.countries[1]);

  // Group by root
  const rootMap = new Map<string, { members: Set<string>; pairs: Alliance[]; name: string | null; abbr: string | null }>();
  for (const a of active) {
    const root = find(a.countries[0]);
    if (!rootMap.has(root)) rootMap.set(root, { members: new Set(), pairs: [], name: null, abbr: null });
    const g = rootMap.get(root)!;
    g.members.add(a.countries[0]);
    g.members.add(a.countries[1]);
    g.pairs.push(a);
    if (a.name && !g.name) g.name = a.name;
    if (a.abbreviation && !g.abbr) g.abbr = a.abbreviation;
  }

  const groups: AllianceGroup[] = [];
  let ci = 0;
  for (const [, g] of rootMap) {
    groups.push({
      name: g.name ?? `Alliance ${groups.length + 1}`,
      abbreviation: g.abbr,
      color: ALLIANCE_COLORS[ci++ % ALLIANCE_COLORS.length],
      members: Array.from(g.members).sort(),
      pairs: g.pairs,
    });
  }
  return groups;
}

export default function AlliancesTab({ alliances, countries, onSelectCountry }: AlliancesTabProps) {
  const groups = buildGroups(alliances);
  const countryMap = new Map(countries.map(c => [c.country_id || c.id, c]));

  if (!groups.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          No active alliances
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div key={gi} className="rounded-md border border-border bg-bg overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 border-b border-border"
            style={{ borderLeftWidth: 3, borderLeftColor: g.color }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: g.color }}
            />
            <span className="text-xs uppercase tracking-wider font-bold" style={{ color: g.color }}>
              {g.name}
            </span>
            {g.abbreviation && (
              <span className="text-[10px] uppercase tracking-wider text-dim">
                ({g.abbreviation})
              </span>
            )}
            <span className="ml-auto text-[10px] text-dim">
              {g.members.length} members
            </span>
          </div>

          {/* Members */}
          <div className="flex flex-col">
            {g.members.map(id => {
              const c = countryMap.get(id);
              const flag = GAME_TO_FLAG[id] ?? '';
              const name = GAME_TO_NAME[id] ?? id;
              const isEliminated = c?.is_eliminated ?? false;

              return (
                <div
                  key={id}
                  onClick={() => onSelectCountry(id)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[11px] cursor-pointer hover:bg-panel transition-colors"
                >
                  <span className="text-sm">{codeToEmoji(flag)}</span>
                  <span className={`flex-1 uppercase tracking-wider ${isEliminated ? 'line-through text-dim' : ''}`}>
                    {name}
                  </span>
                  {c && (
                    <>
                      <span className="text-dim text-[10px]">{c.territory ?? 0}T</span>
                      <span className="text-dim text-[10px]">{c.military ?? 0}M</span>
                      <span className="text-dim text-[10px]">{c.gdp ?? 0}G</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
