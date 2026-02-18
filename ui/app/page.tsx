'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OnboardingModal from '@/components/OnboardingModal';
import type { Game } from '@/lib/types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type GamePhase = 'lobby' | 'active' | 'ended' | string;

function phaseStyle(phase: GamePhase): { label: string; color: string } {
  switch (phase) {
    case 'active':
      return { label: 'ACTIVE', color: '#3fb950' };
    case 'ended':
      return { label: 'ENDED', color: '#da3633' };
    case 'lobby':
    default:
      return { label: phase ? phase.toUpperCase() : 'LOBBY', color: '#c9a227' };
  }
}

function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const { label, color } = phaseStyle(game.phase || game.status);
  const shortId = game.id.length > 8 ? game.id.slice(0, 8) + '…' : game.id;
  const tension = Math.round((game.world_tension ?? 0) * 100);

  return (
    <div
      className="flex flex-col gap-4 p-5 transition-colors"
      style={{
        background: '#161b22',
        border: '1px solid #3a4150',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#c9a22750';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#3a4150';
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: '#8b949e' }}
          >
            Game ID
          </div>
          <div className="text-sm" style={{ color: '#e6edf3', fontFamily: 'monospace' }}>
            {shortId}
          </div>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-1"
          style={{
            color,
            border: `1px solid ${color}55`,
            fontFamily: 'var(--font-aldrich), sans-serif',
          }}
        >
          {label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>
            Turn
          </div>
          <div className="text-sm" style={{ color: '#e6edf3' }}>
            {game.turn}
            <span style={{ color: '#484f58' }}> / {game.max_turns}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>
            Phase
          </div>
          <div className="text-sm capitalize" style={{ color: '#e6edf3' }}>
            {game.turn_phase || '—'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#8b949e' }}>
            Tension
          </div>
          <div
            className="text-sm"
            style={{ color: tension > 60 ? '#da3633' : tension > 30 ? '#c9a227' : '#3fb950' }}
          >
            {tension}%
          </div>
        </div>
      </div>

      {/* Spectate button */}
      <button
        onClick={() => router.push(`/game/${game.id}`)}
        className="w-full py-2 text-xs uppercase tracking-[2px] transition-colors"
        style={{
          color: '#0c1219',
          background: '#c9a227',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-aldrich), sans-serif',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#d4aa2c';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#c9a227';
        }}
      >
        Spectate →
      </button>
    </div>
  );
}

function UtcClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}  ${p(now.getUTCHours())}:${p(now.getUTCMinutes())}:${p(now.getUTCSeconds())} UTC`;
    };
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="text-[10px] uppercase tracking-wider" style={{ color: '#484f58', fontFamily: 'monospace' }}>
      {time}
    </span>
  );
}

export default function LobbyPage() {
  const [showModal, setShowModal] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for onboarding dismissal
    try {
      const dismissed = localStorage.getItem('statecraft:onboarding:v1');
      if (!dismissed) {
        setShowModal(true);
      }
    } catch {
      // localStorage unavailable (SSR or privacy mode)
    }

    // Fetch current games
    fetch(`${API_BASE}/api/v1/games/current`, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ game: Game | null }>;
      })
      .then((data) => {
        const g = data.game;
        setGames(g ? [g] : []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Failed to reach game server: ${msg}`);
        setLoading(false);
      });
  }, []);

  const dismissModal = () => {
    try {
      localStorage.setItem('statecraft:onboarding:v1', '1');
    } catch {
      // ignore
    }
    setShowModal(false);
  };

  return (
    <>
      {showModal && <OnboardingModal onDismiss={dismissModal} />}

      <div
        style={{
          minHeight: '100vh',
          background: '#0c1219',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-8 py-4"
          style={{ borderBottom: '1px solid #3a4150' }}
        >
          <div>
            <h1
              className="uppercase tracking-[4px] text-lg"
              style={{
                color: '#c9a227',
                fontFamily: 'var(--font-aldrich), sans-serif',
              }}
            >
              STATECRAFT
            </h1>
            <p
              className="text-[10px] uppercase tracking-wider mt-0.5"
              style={{ color: '#8b949e' }}
            >
              War Room — Game Lobby
            </p>
          </div>
          <UtcClock />
        </header>

        {/* Main */}
        <main
          className="flex-1 px-8 py-8 w-full mx-auto"
          style={{ maxWidth: 900 }}
        >
          {/* Section divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1" style={{ background: '#3a4150' }} />
            <span
              className="text-[10px] uppercase tracking-[3px]"
              style={{ color: '#8b949e' }}
            >
              Active Games
            </span>
            <div className="h-px flex-1" style={{ background: '#3a4150' }} />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3">
              <div className="spinner" />
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: '#8b949e' }}
              >
                Connecting to server…
              </span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="p-4 text-center"
              style={{
                border: '1px solid #da363340',
                background: '#da363310',
              }}
            >
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: '#da3633' }}
              >
                {error}
              </p>
              <p className="text-xs mt-2" style={{ color: '#484f58' }}>
                Make sure the game server is running at{' '}
                <code style={{ fontFamily: 'monospace' }}>{API_BASE}</code>
              </p>
            </div>
          )}

          {/* No games */}
          {!loading && !error && games.length === 0 && (
            <div
              className="p-10 text-center"
              style={{
                background: '#161b22',
                border: '1px solid #3a4150',
              }}
            >
              <p
                className="text-xs uppercase tracking-[2px]"
                style={{ color: '#8b949e' }}
              >
                No active games
              </p>
              <p className="text-xs mt-2" style={{ color: '#484f58' }}>
                Waiting for a game to start…
              </p>
            </div>
          )}

          {/* Game cards */}
          {!loading && !error && games.length > 0 && (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer
          className="px-8 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid #3a4150' }}
        >
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#484f58' }}>
            Statecraft v2 — Spectator Mode
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="text-[10px] uppercase tracking-wider transition-colors"
            style={{
              color: '#484f58',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-aldrich), sans-serif',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#c9a227';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#484f58';
            }}
          >
            Deploy Agent ↗
          </button>
        </footer>
      </div>
    </>
  );
}
