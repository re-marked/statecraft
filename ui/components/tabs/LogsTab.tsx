'use client';

import type { GameEvent } from '@/lib/types';
import { eventClass, eventToLog, fmtTime } from '@/lib/events';

interface LogsTabProps {
  events: GameEvent[];
}

const CLS_TEXT: Record<string, string> = {
  combat: 'text-red',
  diplomacy: 'text-green',
  espionage: 'text-blue',
  system: 'text-gold',
};

export default function LogsTab({ events }: LogsTabProps) {
  if (!events.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-dim text-sm text-center uppercase tracking-wider">
          No events yet
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      {events.slice(0, 100).map((ev, i) => {
        const cls = eventClass(ev);
        const { emoji, text } = eventToLog(ev);
        const ts = fmtTime(ev.createdAt);

        return (
          <div
            key={i}
            className="bg-bg border border-border rounded-md py-2.5 px-3 text-[11px] leading-snug"
          >
            {ev.turn ? (
              <span className="text-dimmer text-[9px] mr-1">T{ev.turn}</span>
            ) : null}
            {ts && (
              <span className="text-dimmer text-[9px] mr-1.5 opacity-65">
                {ts}
              </span>
            )}
            <span className="mr-1">{emoji}</span>
            <span className={CLS_TEXT[cls] ?? 'text-dim'}>{text}</span>
          </div>
        );
      })}
    </div>
  );
}
