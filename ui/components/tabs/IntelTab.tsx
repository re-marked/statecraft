'use client';

import type { Country, Province, Pact, War } from '@/lib/types';
import { countryFlag, countryName } from '@/lib/types';

interface IntelTabProps {
  selectedCountry: string | null;
  countries: Country[];
  provinces: Province[];
  pacts: Pact[];
  wars: War[];
}

function StatBox({
  label,
  value,
  cls = 'neutral',
}: {
  label: string;
  value: string | number;
  cls?: 'positive' | 'negative' | 'neutral';
}) {
  const colorMap = {
    positive: 'text-green',
    negative: 'text-red',
    neutral: 'text-text',
  };
  return (
    <div className="bg-bg border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-dim mb-1 font-[family-name:var(--font-aldrich)]">
        {label}
      </div>
      <div className={`text-lg font-bold leading-none ${colorMap[cls]}`}>{value ?? '-'}</div>
    </div>
  );
}

export default function IntelTab({
  selectedCountry,
  countries,
  provinces,
  pacts,
  wars,
}: IntelTabProps) {
  if (!selectedCountry) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          Click a country on the map
          <br />
          or in Ranks to view intel
        </p>
      </div>
    );
  }

  const cMap = new Map<string, Country>();
  for (const c of countries) cMap.set(c.country_id, c);
  const cd = cMap.get(selectedCountry);
  const name = cd?.display_name ?? countryName(selectedCountry);
  const flag = countryFlag(selectedCountry);

  if (!cd) {
    return (
      <div className="p-5">
        <div className="text-sm uppercase tracking-[2px] text-gold mb-3 flex items-center gap-2 font-[family-name:var(--font-aldrich)]">
          <span className="text-2xl">{flag}</span>
          {name}
        </div>
        <p className="text-dim text-xs mt-4">
          This country is not in the current game.
        </p>
      </div>
    );
  }

  // Country's provinces
  const ownedProvinces = provinces.filter((p) => p.owner_id === selectedCountry);
  const totalGdp = ownedProvinces.reduce((sum, p) => sum + p.gdp_value, 0);

  // Find pacts and enemies
  const countryPacts = pacts.filter((p) => p.members.includes(selectedCountry));
  const pactAllies = new Set<string>();
  for (const p of countryPacts) {
    for (const m of p.members) {
      if (m !== selectedCountry) pactAllies.add(m);
    }
  }

  const enemies: string[] = [];
  for (const w of wars) {
    if (w.attacker === selectedCountry) enemies.push(w.defender);
    if (w.defender === selectedCountry) enemies.push(w.attacker);
  }

  const stabilityClass =
    (cd.stability ?? 5) <= 3 ? 'negative'
      : (cd.stability ?? 5) >= 7 ? 'positive'
        : 'neutral';

  return (
    <div className="p-5">
      {/* Header */}
      <div className="text-sm uppercase tracking-[2px] text-gold mb-4 flex items-center gap-2.5 font-[family-name:var(--font-aldrich)]">
        <span className="text-2xl">{flag}</span>
        {name}
        {cd.is_eliminated ? (
          cd.annexed_by ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1030] border border-[#6040a0] text-[#a080d0]">
              ANNEXED BY {countryName(cd.annexed_by).toUpperCase()}
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1a2e] border border-[#3a3a60] text-[#6060a0]">
              COLLAPSED
            </span>
          )
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0d2818] border border-green text-green">
            ACTIVE
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <StatBox label="Provinces" value={cd.province_count} />
        <StatBox label="Total Troops" value={`${cd.total_troops}K`} />
        <StatBox label="Money" value={`${cd.money}M`} />
        <StatBox label="Total GDP" value={`${totalGdp}M`} />
        <StatBox label="Tech" value={`${cd.tech}/10`} />
        <StatBox label="Stability" value={`${cd.stability}/10`} cls={stabilityClass} />
      </div>

      {/* Provinces list */}
      {ownedProvinces.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            Provinces ({ownedProvinces.length})
          </h3>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {ownedProvinces.map((p) => (
              <div key={p.nuts2_id} className="flex items-center gap-2 text-[10px] py-0.5">
                <span className="text-dim w-10">{p.nuts2_id}</span>
                <span className="flex-1 text-text">{p.name}</span>
                <span className="text-dim">{p.troops_stationed}K</span>
                <span className="text-dim">{p.gdp_value}M</span>
                <span className="text-dim">{p.terrain}</span>
                {p.is_capital && <span className="text-yellow-400 text-[9px]">CAP</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pacts */}
      {countryPacts.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            Pacts
          </h3>
          <div className="flex flex-wrap gap-1">
            {countryPacts.map((p) => (
              <span
                key={p.id}
                className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[#0d2818] border border-green text-green"
              >
                {p.abbreviation || p.name} ({p.members.length})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Enemies */}
      {enemies.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            At War With
          </h3>
          <div className="flex flex-wrap gap-1">
            {enemies.map((e) => (
              <span
                key={e}
                className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[#3d1518] border border-red text-red"
              >
                {countryName(e)}
              </span>
            ))}
          </div>
        </div>
      )}

      {!countryPacts.length && !enemies.length && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            Diplomacy
          </h3>
          <p className="text-dim text-[11px]">No active pacts or wars</p>
        </div>
      )}
    </div>
  );
}
