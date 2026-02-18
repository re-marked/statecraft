'use client';

import type { GameEvent } from '@/lib/types';
import { evToNewsItem, fmtTime } from '@/lib/events';

interface NewsTabProps {
  events: GameEvent[];
}

const CLS_HEADLINE: Record<string, string> = {
  combat: 'text-red',
  diplomacy: 'text-green',
  espionage: 'text-blue',
  system: 'text-gold',
};

const CLS_BODY_BORDER: Record<string, string> = {
  combat: 'border-l-red',
  diplomacy: 'border-l-green',
  espionage: 'border-l-blue',
  system: 'border-l-border',
};

export default function NewsTab({ events }: NewsTabProps) {
  const items = events
    .map((ev) => evToNewsItem(ev))
    .filter(Boolean)
    .slice(0, 60);

  if (!items.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          No news yet
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2.5">
      {items.map((item, i) => {
        if (!item) return null;
        return (
          <div key={i} className="bg-bg border border-border rounded-md px-4 py-3.5 leading-relaxed">
            {/* Meta: turn + timestamp */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-dimmer text-[10px] tracking-wider uppercase font-medium">
                T{item.turn}
              </span>
              {item.ts && (
                <span className="text-dimmer text-[10px] opacity-60">
                  {fmtTime(item.ts)}
                </span>
              )}
            </div>

            {/* Headline */}
            <div
              className={`text-[13px] font-semibold mb-2 leading-snug ${CLS_HEADLINE[item.cls] ?? 'text-text'}`}
            >
              {item.headline}
            </div>

            {/* Body */}
            {item.body && (
              <div
                className={`text-xs text-dim italic pl-3 border-l-2 leading-relaxed ${CLS_BODY_BORDER[item.cls] ?? 'border-l-border'}`}
              >
                {item.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
