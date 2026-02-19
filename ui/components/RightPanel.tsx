'use client';

import { useEffect, useRef, useState } from 'react';
import type { Country, Province, Pact, War, GameEvent, TabId } from '@/lib/types';
import IntelTab from './tabs/IntelTab';
import RanksTab from './tabs/RanksTab';
import AlliancesTab from './tabs/AlliancesTab';
import NewsTab from './tabs/NewsTab';
import LogsTab from './tabs/LogsTab';

interface RightPanelProps {
  countries: Country[];
  provinces: Province[];
  pacts: Pact[];
  wars: War[];
  events: GameEvent[];
  selectedCountry: string | null;
  onSelectCountry: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'intel', label: 'Intel' },
  { id: 'ranks', label: 'Ranks' },
  { id: 'pacts', label: 'Pacts' },
  { id: 'news', label: 'News' },
  { id: 'logs', label: 'Logs' },
];

export default function RightPanel({
  countries,
  provinces,
  pacts,
  wars,
  events,
  selectedCountry,
  onSelectCountry,
  open,
  onClose,
}: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ranks');
  const prevSelected = useRef(selectedCountry);

  useEffect(() => {
    if (selectedCountry && selectedCountry !== prevSelected.current) {
      setActiveTab('intel');
    }
    prevSelected.current = selectedCountry;
  }, [selectedCountry]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[49] bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          bg-panel border-l border-border flex flex-col overflow-hidden transition-transform duration-300
          md:relative md:translate-x-0 md:w-[420px] md:shrink-0
          max-md:fixed max-md:right-0 max-md:top-0 max-md:bottom-0 max-md:z-50
          max-md:w-full max-md:shadow-[-4px_0_24px_rgba(0,0,0,0.6)]
          ${open ? 'max-md:translate-x-0' : 'max-md:translate-x-full'}
        `}
      >
        <div className="flex border-b border-border shrink-0 items-center px-2 pt-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 py-3 md:py-3 max-md:py-4 text-center text-xs max-md:text-sm uppercase tracking-wider cursor-pointer
                border-b-2 transition-colors
                ${
                  activeTab === tab.id
                    ? 'text-gold border-b-gold'
                    : 'text-dim border-b-transparent hover:text-text'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="md:hidden ml-auto mr-1 text-dim text-xl cursor-pointer px-3 py-2 hover:text-text"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'intel' && (
            <IntelTab
              selectedCountry={selectedCountry}
              countries={countries}
              provinces={provinces}
              pacts={pacts}
              wars={wars}
            />
          )}
          {activeTab === 'ranks' && <RanksTab countries={countries} onSelectCountry={onSelectCountry} />}
          {activeTab === 'pacts' && <AlliancesTab pacts={pacts} countries={countries} onSelectCountry={onSelectCountry} />}
          {activeTab === 'news' && <NewsTab events={events} />}
          {activeTab === 'logs' && <LogsTab events={events} />}
        </div>
      </div>
    </>
  );
}
