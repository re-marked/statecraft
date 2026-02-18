'use client';

import type { Country } from '@/lib/types';
import { GAME_TO_FLAG, GAME_TO_NAME, codeToEmoji } from '@/lib/types';

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

  const scored: ScoredCountry[] = countries.map((c) => {
    const id = c.country_id || c.id;
    return {
      ...c,
      id,
      score: (c.territory || 0) * 3 + (c.military || 0) * 2 + (c.gdp || 0),
    };
  });

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
        const flagCode = c.flag || GAME_TO_FLAG[c.id] || '';
        const name = GAME_TO_NAME[c.id] || c.name || c.id;

        return (
          <div
            key={c.id}
            onClick={() => onSelectCountry(c.id)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-md border border-border bg-bg text-[11px] cursor-pointer hover:border-gold/30 transition-colors"
          >
            {/* Rank */}
            <span className="w-5 text-center text-gold font-bold">{i + 1}</span>

            {/* Flag */}
            <span className="text-sm">{codeToEmoji(flagCode)}</span>

            {/* Name */}
            <span
              className={`flex-1 uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap ${
                c.is_eliminated ? 'line-through text-dim' : ''
              }`}
            >
              {name}
            </span>

            {/* Stats */}
            <span className="w-9 text-right text-dim text-[10px]" title="Territory">
              {c.territory || 0}T
            </span>
            <span className="w-9 text-right text-dim text-[10px]" title="Military">
              {c.military || 0}M
            </span>

            {/* Score bar */}
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
