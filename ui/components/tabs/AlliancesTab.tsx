'use client';

import type { Pact, Country } from '@/lib/types';
import { GAME_TO_FLAG, codeToEmoji, countryName } from '@/lib/types';

interface PactsTabProps {
  pacts: Pact[];
  countries: Country[];
  onSelectCountry: (id: string) => void;
}

export default function AlliancesTab({ pacts, countries, onSelectCountry }: PactsTabProps) {
  const countryMap = new Map(countries.map(c => [c.country_id, c]));

  if (!pacts.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          No active pacts
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {pacts.map((pact) => (
        <div key={pact.id} className="rounded-md border border-border bg-bg overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 border-b border-border"
            style={{ borderLeftWidth: 3, borderLeftColor: pact.color ?? '#00ff88' }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: pact.color ?? '#00ff88' }}
            />
            <span className="text-xs uppercase tracking-wider font-bold" style={{ color: pact.color ?? '#00ff88' }}>
              {pact.name}
            </span>
            {pact.abbreviation && (
              <span className="text-[10px] uppercase tracking-wider text-dim">
                ({pact.abbreviation})
              </span>
            )}
            <span className="ml-auto text-[10px] text-dim">
              {pact.members.length} members
            </span>
          </div>

          {/* Members */}
          <div className="flex flex-col">
            {pact.members.map(id => {
              const c = countryMap.get(id);
              const flag = GAME_TO_FLAG[id] ?? '';
              const name = c?.display_name ?? countryName(id);
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
                      <span className="text-dim text-[10px]">{c.province_count}P</span>
                      <span className="text-dim text-[10px]">{c.total_troops}K</span>
                      <span className="text-dim text-[10px]">{c.total_gdp}G</span>
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
