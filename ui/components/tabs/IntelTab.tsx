'use client';

import type { Alliance, Country, War } from '@/lib/types';
import { countryFlag, countryName } from '@/lib/types';

interface IntelTabProps {
  selectedCountry: string | null;
  countries: Country[];
  alliances: Alliance[];
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
  alliances,
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

  const cMap: Record<string, Country> = {};
  for (const c of countries) cMap[c.country_id || c.id] = c;
  const cd = cMap[selectedCountry];
  const name = countryName(selectedCountry);
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

  // Find allies and enemies
  const allies: string[] = [];
  const enemies: string[] = [];
  for (const a of alliances) {
    if (a.countries.includes(selectedCountry)) {
      allies.push(
        a.countries[0] === selectedCountry ? a.countries[1] : a.countries[0]
      );
    }
  }
  for (const w of wars) {
    if (w.attacker === selectedCountry) enemies.push(w.defender);
    if (w.defender === selectedCountry) enemies.push(w.attacker);
  }

  const stabilityClass =
    (cd.stability ?? 5) <= 3
      ? 'negative'
      : (cd.stability ?? 5) >= 7
        ? 'positive'
        : 'neutral';
  const unrestClass = (cd.unrest ?? 0) >= 50 ? 'negative' : 'neutral';
  const inflationClass = (cd.inflation ?? 0) >= 40 ? 'negative' : 'neutral';

  return (
    <div className="p-5">
      {/* Header */}
      <div className="text-sm uppercase tracking-[2px] text-gold mb-4 flex items-center gap-2.5 font-[family-name:var(--font-aldrich)]">
        <span className="text-2xl">{flag}</span>
        {name}
        {cd.is_eliminated ? (
          cd.annexed_by && cd.annexed_by !== 'chaos' ? (
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
        <StatBox label="Territory" value={cd.territory ?? '-'} />
        <StatBox label="Military" value={cd.military ?? '-'} />
        <StatBox label="GDP" value={cd.gdp ?? '-'} />
        <StatBox label="Resources" value={cd.resources ?? '-'} />
        <StatBox label="Naval" value={cd.naval ?? '-'} />
        <StatBox
          label="Stability"
          value={`${cd.stability ?? '-'}/10`}
          cls={stabilityClass}
        />
        <StatBox label="Prestige" value={cd.prestige ?? '-'} />
        <StatBox label="Tech" value={`${cd.tech ?? '-'}/10`} />
        <StatBox
          label="Unrest"
          value={`${cd.unrest ?? '-'}%`}
          cls={unrestClass}
        />
        <StatBox
          label="Inflation"
          value={`${cd.inflation ?? '-'}%`}
          cls={inflationClass}
        />
      </div>

      {/* Diplomacy */}
      {allies.length > 0 && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            Allies
          </h3>
          <div className="flex flex-wrap gap-1">
            {allies.map((a) => (
              <span
                key={a}
                className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-[#0d2818] border border-green text-green"
              >
                {countryName(a)}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {!allies.length && !enemies.length && (
        <div className="mb-3">
          <h3 className="text-[10px] uppercase tracking-wider text-dim mb-1.5 border-b border-border pb-1">
            Diplomacy
          </h3>
          <p className="text-dim text-[11px]">No active alliances or wars</p>
        </div>
      )}
    </div>
  );
}
