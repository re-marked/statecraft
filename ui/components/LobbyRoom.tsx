'use client';

import { useEffect, useRef, useState } from 'react';
import type { Game, Country } from '@/lib/types';

interface LobbyRoomProps {
  game: Game | null;
  countries: Country[];
}

export default function LobbyRoom({ game, countries }: LobbyRoomProps) {
  const playerCount = game?.player_count ?? countries.length;
  const minPlayers  = game?.min_players  ?? 2;
  const ghostCount  = Math.max(0, minPlayers - playerCount);

  // ── Stagger delay tracking ──────────────────────────────────────────────────
  // Mutating a ref during render is fine — it's additive and idempotent.
  const entryOrderRef = useRef<Map<string, number>>(new Map());
  const nextOrderRef  = useRef(0);
  countries.forEach(c => {
    if (!entryOrderRef.current.has(c.country_id)) {
      entryOrderRef.current.set(c.country_id, nextOrderRef.current++);
    }
  });

  // ── All-commanders-ready flash ──────────────────────────────────────────────
  const [allReady, setAllReady]   = useState(false);
  const wasReadyRef               = useRef(false);

  useEffect(() => {
    const isReady = minPlayers > 0 && playerCount >= minPlayers;
    if (isReady && !wasReadyRef.current) {
      wasReadyRef.current = true;
      setAllReady(true);
      const t = setTimeout(() => setAllReady(false), 3200);
      return () => clearTimeout(t);
    }
    if (!isReady) wasReadyRef.current = false;
  }, [playerCount, minPlayers]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0c1219',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        position: 'relative',
        padding: '2rem 2rem 3rem',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes lobbySlideIn {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes lobbyGoldFlash {
          0%   { border-color: #c9a227; box-shadow: 0 0 18px rgba(201,162,39,.55); }
          65%  { border-color: #c9a227; box-shadow: 0 0 6px  rgba(201,162,39,.2);  }
          100% { border-color: #3a4150; box-shadow: none; }
        }
        @keyframes lobbyGhostPulse {
          0%, 100% { opacity: .32; }
          50%       { opacity: .62; }
        }
        @keyframes lobbyCursorBlink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes lobbyScanLine {
          0%   { top: -2px; opacity: 0; }
          4%   { opacity: .75; }
          96%  { opacity: .75; }
          100% { top: 100%;  opacity: 0; }
        }
        @keyframes lobbyAllReadyPop {
          0%   { opacity: 0; transform: scale(.88);  }
          12%  { opacity: 1; transform: scale(1.04); }
          22%  { transform: scale(1);  }
          80%  { opacity: 1; transform: scale(1);    }
          100% { opacity: 0; transform: scale(.96);  }
        }
        .lobby-card-enter {
          animation:
            lobbySlideIn   .45s ease both,
            lobbyGoldFlash 1.9s ease both;
        }
        .lobby-ghost {
          animation: lobbyGhostPulse 2.3s ease-in-out infinite;
        }
      `}</style>

      {/* ── Horizontal scan line ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(201,162,39,.4), transparent)',
          animation: 'lobbyScanLine 5s linear infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* ── All Commanders Ready overlay ──────────────────────────────────── */}
      {allReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            pointerEvents: 'none',
            background: 'rgba(12,18,25,.78)',
            animation: 'lobbyAllReadyPop 3.2s ease forwards',
          }}
        >
          <div
            style={{
              background: '#161b22',
              border: '2px solid #c9a227',
              borderRadius: '5px',
              color: '#c9a227',
              fontFamily: 'var(--font-aldrich), sans-serif',
              fontSize: 'clamp(1.1rem, 3vw, 2rem)',
              fontWeight: 700,
              letterSpacing: '6px',
              padding: '1.5rem 3rem',
              textAlign: 'center',
              boxShadow: '0 0 55px rgba(201,162,39,.38)',
              textShadow: '0 0 22px rgba(201,162,39,.65)',
            }}
          >
            ALL COMMANDERS READY
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '1.75rem',
          zIndex: 2,
          paddingTop: '.5rem',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-aldrich), sans-serif',
            fontSize: 'clamp(1rem, 2.4vw, 1.6rem)',
            color: '#c9a227',
            letterSpacing: '6px',
            textTransform: 'uppercase',
            margin: '0 0 .75rem',
            fontWeight: 700,
          }}
        >
          WAITING FOR COMMANDERS
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-aldrich), sans-serif',
            fontSize: '1rem',
            color: '#e6edf3',
            letterSpacing: '3px',
            margin: 0,
            textTransform: 'uppercase',
          }}
        >
          {playerCount}&nbsp;/&nbsp;{minPlayers}&nbsp;NATIONS JOINED
        </p>

        {/* Progress pip row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '1rem',
          }}
        >
          {Array.from({ length: minPlayers }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                border: '1px solid #3a4150',
                background: i < playerCount ? '#c9a227' : 'transparent',
                boxShadow:
                  i < playerCount
                    ? '0 0 6px rgba(201,162,39,.55)'
                    : 'none',
                transition: 'background .4s ease, box-shadow .4s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Country card grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
          width: '100%',
          maxWidth: '960px',
          zIndex: 2,
        }}
      >
        {/* Filled slots */}
        {countries.map(country => {
          const order = entryOrderRef.current.get(country.country_id) ?? 0;
          const delay = `${order * 150}ms`;
          return (
            <div
              key={country.country_id}
              className="lobby-card-enter"
              style={{
                animationDelay: delay,
                background: '#161b22',
                border: '1px solid #3a4150',
                borderRadius: '6px',
                padding: '1.25rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '.5rem',
                minHeight: '148px',
                justifyContent: 'center',
              }}
            >
              {/* Flag */}
              <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                {country.flag || '🏳️'}
              </div>

              {/* Country name */}
              <div
                style={{
                  fontFamily: 'var(--font-aldrich), sans-serif',
                  color: '#c9a227',
                  fontSize: '.82rem',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                {country.name}
              </div>

              {/* Stats row: MIL • TER • GDP */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.35rem',
                  fontSize: '.68rem',
                  letterSpacing: '.5px',
                }}
              >
                <span style={{ color: '#8b949e' }}>MIL</span>
                <span style={{ color: '#e6edf3', fontWeight: 600 }}>
                  {country.military}
                </span>
                <span style={{ color: '#3a4150' }}>•</span>
                <span style={{ color: '#8b949e' }}>TER</span>
                <span style={{ color: '#e6edf3', fontWeight: 600 }}>
                  {country.territory}
                </span>
                <span style={{ color: '#3a4150' }}>•</span>
                <span style={{ color: '#8b949e' }}>GDP</span>
                <span style={{ color: '#e6edf3', fontWeight: 600 }}>
                  {country.gdp}
                </span>
              </div>

              {/* Agent / country_id label */}
              <div
                style={{
                  fontSize: '.67rem',
                  color: '#8b949e',
                  letterSpacing: '1px',
                  textAlign: 'center',
                }}
              >
                {country.country_id}
              </div>
            </div>
          );
        })}

        {/* Ghost / awaiting slots */}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <div
            key={`ghost-${i}`}
            className="lobby-ghost"
            style={{
              background: '#0c1219',
              border: '1px dashed #2a3140',
              borderRadius: '6px',
              padding: '1.25rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '148px',
              gap: '.5rem',
            }}
          >
            <div style={{ fontSize: '2rem', opacity: .14, color: '#8b949e' }}>
              ◌
            </div>
            <div
              style={{
                fontFamily: 'var(--font-aldrich), sans-serif',
                color: '#3a4150',
                fontSize: '.72rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              AWAITING COMMANDER
            </div>
            <span
              style={{
                color: '#3a4150',
                fontSize: '1rem',
                animation: 'lobbyCursorBlink 1s step-end infinite',
              }}
            >
              _
            </span>
          </div>
        ))}
      </div>

      {/* ── Footer hint ───────────────────────────────────────────────────── */}
      <p
        style={{
          marginTop: '2.5rem',
          color: '#8b949e',
          fontSize: '.7rem',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        Game starts automatically when minimum players join
      </p>
    </div>
  );
}
