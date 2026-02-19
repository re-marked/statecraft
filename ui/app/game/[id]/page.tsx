'use client';

import { Suspense, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useGameState } from '@/hooks/useGameState';
import { useStaticDemoState } from '@/hooks/useStaticDemoState';
import type { UseGameStateReturn } from '@/hooks/useGameState';
import TopBar from '@/components/TopBar';
import RightPanel from '@/components/RightPanel';
import WorldMap from '@/components/WorldMap';
import LobbyRoom from '@/components/LobbyRoom';
import type { MapLayer } from '@/lib/types';

const MAP_LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'political', label: 'Political' },
  { id: 'economic', label: 'Economic' },
  { id: 'alliance', label: 'Alliance' },
  { id: 'terrain', label: 'Terrain' },
];

function WarRoomShell({ state }: { state: UseGameStateReturn }) {
  const {
    game,
    countries,
    provinces,
    pacts,
    wars,
    events,
    wsStatus,
    loading,
    selectedCountry,
    selectCountry,
    selectedProvince,
    selectProvince,
    mapLayer,
    setMapLayer,
  } = state;

  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-navy flex-col gap-2">
          <div className="spinner" />
          <p className="text-gold text-xs uppercase tracking-[2px]">
            Loading game data…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        game={game}
        wsStatus={wsStatus}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative overflow-hidden bg-navy">
          {!game ? (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/85 z-5 flex-col gap-3">
              <h2 className="text-base uppercase tracking-[3px] text-gold font-[family-name:var(--font-aldrich)]">
                Waiting for game…
              </h2>
              <p className="text-dim text-xs uppercase tracking-wider">
                No active game found. Retrying…
              </p>
              <div className="spinner mt-2" />
            </div>
          ) : game.phase === 'lobby' ? (
            <LobbyRoom game={game} countries={countries} />
          ) : (
            <>
              <WorldMap
                countries={countries}
                provinces={provinces}
                selectedCountry={selectedCountry}
                selectedProvince={selectedProvince}
                onSelectCountry={selectCountry}
                onSelectProvince={selectProvince}
                wars={wars}
                pacts={pacts}
                mapLayer={mapLayer}
              />

              {/* Map layer switcher */}
              <div className="absolute top-3 left-3 z-10 flex gap-1">
                {MAP_LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setMapLayer(layer.id)}
                    className={`
                      px-2.5 py-1 rounded text-[10px] uppercase tracking-wider font-bold cursor-pointer
                      border transition-colors
                      ${
                        mapLayer === layer.id
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'bg-panel/80 border-border text-dim hover:text-text hover:border-gold/30'
                      }
                    `}
                  >
                    {layer.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <RightPanel
          countries={countries}
          provinces={provinces}
          pacts={pacts}
          wars={wars}
          events={events}
          selectedCountry={selectedCountry}
          onSelectCountry={selectCountry}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  );
}

function LiveWarRoom() {
  const state = useGameState();
  return <WarRoomShell state={state} />;
}

function DemoWarRoom() {
  const state = useStaticDemoState();
  return <WarRoomShell state={state} />;
}

function WarRoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const demo = searchParams.get('demo') === 'true';

  // params.id is the game ID from the URL — available for future use
  const _gameId = params.id as string;
  void _gameId;

  return demo ? <DemoWarRoom /> : <LiveWarRoom />;
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-navy flex-col gap-2">
            <div className="spinner" />
            <p className="text-gold text-xs uppercase tracking-[2px]">Loading…</p>
          </div>
        </div>
      }
    >
      <WarRoomContent />
    </Suspense>
  );
}
