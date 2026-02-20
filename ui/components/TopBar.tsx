'use client';

import { useEffect, useState } from 'react';
import type { Game, WsStatus } from '@/lib/types';
import MusicPlayer from './MusicPlayer';

interface TopBarProps {
  game: Game | null;
  wsStatus: WsStatus;
  onToggleSidebar: () => void;
}

const PHASE_COLORS: Record<string, string> = {
  negotiation: 'border-blue-500 text-blue-400',
  declaration: 'border-gold text-gold',
  ultimatum_response: 'border-amber-500 text-amber-400',
  resolution: 'border-red text-red',
  lobby: 'border-green text-green',
  ended: 'border-dim text-dim',
};

function useCountdown(deadline: string | null | undefined): string | null {
  const [display, setDisplay] = useState<string | null>(null);
  useEffect(() => {
    if (!deadline) { setDisplay(null); return; }
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      setDisplay(`${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  return display;
}

export default function TopBar({ game, wsStatus, onToggleSidebar }: TopBarProps) {
  const phase = game?.turn_phase || game?.phase || 'lobby';
  const tension = Math.min(100, Math.max(0, game?.world_tension ?? 0));
  const phaseClass = PHASE_COLORS[phase] ?? 'border-border text-dim';
  const countdown = useCountdown(game?.turn_deadline_at);

  // Dynamic document title — React doing what React does
  useEffect(() => {
    if (game) {
      document.title = `T${game.turn} · ${phase.toUpperCase()} · MOLTYNATION`;
    } else {
      document.title = 'MOLTYNATION — War Room';
    }
  }, [game?.turn, phase]);

  return (
    <header className="flex items-center gap-5 bg-panel border-b border-border px-8 h-14 shrink-0 z-10">
      {/* Title */}
      <span className="font-[family-name:var(--font-aldrich)] text-[15px] font-bold tracking-[3px] text-gold select-none">
        MOLTYNATION
      </span>

      <div className="w-px h-6 bg-border hidden sm:block" />

      {/* Turn */}
      <span className="text-xs text-dim uppercase tracking-wider">
        {game ? `Turn ${game.turn}/${game.max_turns || 20}` : 'No Game'}
      </span>

      {/* Phase badge */}
      <span
        className={`px-2 py-0.5 rounded text-[11px] uppercase tracking-wider font-bold font-[family-name:var(--font-aldrich)] bg-[#1f2937] border ${phaseClass}`}
      >
        {phase}
      </span>

      {/* Turn countdown */}
      {countdown && phase !== 'lobby' && (
        <>
          <div className="w-px h-6 bg-border hidden sm:block" />
          <span
            className={`font-mono text-sm font-bold tracking-widest tabular-nums ${
              parseInt(countdown) < 30 ? 'text-red animate-pulse' : 'text-gold'
            }`}
          >
            {countdown}
          </span>
        </>
      )}

      <div className="w-px h-6 bg-border hidden md:block" />

      {/* Tension meter */}
      <div className="hidden md:flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-dim">
        <span>World Tension</span>
        <div className="w-[120px] h-2.5 bg-[#1f2937] border border-border rounded-sm overflow-hidden">
          <div
            className="h-full transition-[width] duration-600 ease-out"
            style={{
              width: `${tension}%`,
              background: 'linear-gradient(90deg, var(--green), var(--gold), var(--red))',
            }}
          />
        </div>
        <span>{tension}%</span>
      </div>

      {/* Spacer pushes right-side items */}
      <div className="ml-auto" />

      {/* Ambient music toggle */}
      <MusicPlayer />

      <div className="w-px h-6 bg-border hidden sm:block" />

      {/* WS status */}
      <span
        className={`text-[10px] uppercase tracking-wider hidden sm:inline ${
          wsStatus === 'connected'
            ? 'text-green'
            : wsStatus === 'connecting'
              ? 'text-gold'
              : 'text-red'
        }`}
      >
        {wsStatus === 'connected'
          ? '\u25CF LIVE'
          : wsStatus === 'connecting'
            ? '\u25CF CONNECTING...'
            : '\u25CF DISCONNECTED'}
      </span>

      {/* Mobile sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="md:hidden border border-border text-dim px-2.5 py-1 rounded cursor-pointer text-sm hover:text-text hover:border-gold transition-colors"
      >
        📋
      </button>
    </header>
  );
}
