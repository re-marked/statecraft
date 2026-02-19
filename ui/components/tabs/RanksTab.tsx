'use client';

import type { Country } from '@/lib/types';
import { GAME_TO_FLAG, codeToEmoji } from '@/lib/types';

interface RanksTabProps {
  countries: Country[];
  onSelectCountry: (id: string) => void;
}

interface ScoredCountry extends Country {
  score: number;
}

export default function RanksTab({ countries, onSelectCountry }: RanksTabProps) {
  if (!countries.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          No countries in game
        </p>
      </div>
    );
  }

  const scored: ScoredCountry[] = countries.map((c) => ({
    ...c,
    score: (c.province_count || 0) * 10 + (c.total_troops || 0) * 2 + (c.total_gdp || 0),
  }));

  scored.sort((a, b) => {
    if (a.is_eliminated && !b.is_eliminated) return 1;
    if (!a.is_eliminated && b.is_eliminated) return -1;
    return b.score - a.score;
  });

  const maxScore = Math.max(
    1,
    ...scored.filter((c) => !c.is_eliminated).map((c) => c.score)
  );

  return (
    <div className="p-4 flex flex-col gap-1">
      {scored.map((c, i) => {
        const pct = Math.round((c.score / maxScore) * 100);
        const barColor = c.is_eliminated
          ? 'var(--dim)'
          : `hsl(${120 - (i / scored.length) * 120}, 50%, 35%)`;
        const flagCode = GAME_TO_FLAG[c.country_id] || '';

        return (
          <div
            key={c.country_id}
            onClick={() => onSelectCountry(c.country_id)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-md border border-border bg-bg text-[11px] cursor-pointer hover:border-gold/30 transition-colors"
          >
            <span className="w-5 text-center text-gold font-bold">{i + 1}</span>
            <span className="text-sm">{codeToEmoji(flagCode)}</span>
            <span
              className={`flex-1 uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap ${
                c.is_eliminated ? 'line-through text-dim' : ''
              }`}
            >
              {c.display_name}
            </span>
            <span className="w-9 text-right text-dim text-[10px]" title="Provinces">
              {c.province_count}P
            </span>
            <span className="w-9 text-right text-dim text-[10px]" title="Troops">
              {c.total_troops}K
            </span>
            <div className="w-[50px] h-1.5 bg-bg rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-[width] duration-600 ease-out"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
