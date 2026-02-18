'use client';
// ============================================================
// Statecraft War Room — Real-time Game State Hook
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchConfig,
  fetchCurrentGame,
  fetchFeed,
  fetchMessages,
  getWsUrl,
} from '@/lib/api';
import type { Alliance, Country, Game, GameEvent, War, WsStatus } from '@/lib/types';

export interface UseGameStateReturn {
  game: Game | null;
  countries: Country[];
  alliances: Alliance[];
  wars: War[];
  events: GameEvent[];
  wsStatus: WsStatus;
  loading: boolean;
  selectedCountry: string | null;
  selectCountry: (id: string | null) => void;
}

export function useGameState(): UseGameStateReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [wars, setWars] = useState<War[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected');
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabaseRef = useRef<unknown>(null);
  const channelRef = useRef<unknown>(null);
  const gameIdRef = useRef<string | null>(null);

  // ---- Fetch full game state ----
  const fetchState = useCallback(async () => {
    try {
      const data = await fetchCurrentGame();
      if (!data.game) {
        setGame(null);
        setCountries([]);
        setAlliances([]);
        setWars([]);
        setLoading(false);
        return;
      }

      const g = data.game as Game;
      setGame(g);
      setCountries((data.countries ?? []) as unknown as Country[]);
      setAlliances((data.alliances ?? []) as unknown as Alliance[]);
      setWars((data.wars ?? []) as unknown as War[]);
      gameIdRef.current = g.id;

      // Fetch events + messages in parallel
      const [feedRes, msgRes] = await Promise.allSettled([
        fetchFeed(g.id),
        fetchMessages(g.id),
      ]);

      const feedEvents =
        feedRes.status === 'fulfilled'
          ? (feedRes.value.events as unknown as GameEvent[]) ?? []
          : [];
      const messages =
        msgRes.status === 'fulfilled'
          ? (msgRes.value.messages as Array<Record<string, unknown>>) ?? []
          : [];

      // Merge messages into events (dedup by turn+content)
      const existing = new Set(
        feedEvents
          .filter((e) => e.type === 'diplomatic_message')
          .map((e) => `${e.turn}:${(e.data as Record<string, unknown>)?.content}`)
      );

      const merged = [...feedEvents];
      for (const m of messages) {
        const key = `${m.turn}:${m.content}`;
        if (!existing.has(key)) {
          merged.push({
            type: 'diplomatic_message',
            turn: m.turn as number,
            createdAt: (m.createdAt as string) ?? undefined,
            data: m,
          });
          existing.add(key);
        }
      }

      // Sort newest first
      merged.sort((a, b) => (b.turn ?? 0) - (a.turn ?? 0));
      setEvents(merged);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch game state:', e);
      setLoading(false);
    }
  }, []);

  // ---- WebSocket ----
  const connectWs = useCallback(() => {
    if (!gameIdRef.current) return;
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    )
      return;

    setWsStatus('connecting');
    try {
      const ws = new WebSocket(getWsUrl(gameIdRef.current));
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as {
            type: string;
            data?: Record<string, unknown>;
            turn?: number;
            private?: boolean;
            [key: string]: unknown;
          };
          handleWsMessage(msg);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setWsStatus('disconnected');
        scheduleReconnect();
      };

      ws.onerror = () => {
        setWsStatus('disconnected');
      };
    } catch {
      setWsStatus('disconnected');
      scheduleReconnect();
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connectWs();
    }, 3000);
  }, [connectWs]);

  const handleWsMessage = useCallback(
    (msg: { type: string; data?: Record<string, unknown>; [key: string]: unknown }) => {
      if (msg.type === 'connected') return;

      if (msg.type === 'resolution' && msg.data?.resolutions) {
        const resolutions = msg.data.resolutions as Array<Record<string, unknown>>;
        setEvents((prev) => {
          const newEvents = resolutions.map((r) => ({
            type: 'resolution' as const,
            turn: (msg.data?.turn as number) ?? 0,
            data: r,
          }));
          return [...newEvents, ...prev];
        });
      }

      if (
        ['turn_start', 'phase_change', 'game_start', 'game_end', 'declarations_revealed'].includes(
          msg.type
        )
      ) {
        setEvents((prev) => [
          {
            type: msg.type,
            turn: (msg.data?.turn as number) ?? 0,
            data: msg.data ?? {},
          },
          ...prev,
        ]);
      }

      if (msg.type === 'diplomatic_message') {
        const ev: GameEvent = {
          type: 'diplomatic_message',
          turn: (msg.turn as number) ?? 0,
          createdAt: new Date().toISOString(),
          data: msg as unknown as Record<string, unknown>,
        };
        setEvents((prev) => [ev, ...prev]);
        return;
      }

      // For most messages, re-fetch full state
      fetchState();
    },
    [fetchState]
  );

  // ---- Supabase Realtime (optional) ----
  const initSupabase = useCallback(async () => {
    try {
      const cfg = await fetchConfig();
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

      // Dynamic import to avoid SSR issues
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        realtime: { params: { eventsPerSecond: 100 } },
      });
      supabaseRef.current = client;
    } catch (e) {
      console.warn('[Supabase] Init failed:', e);
    }
  }, []);

  const subscribeSupabase = useCallback(
    (gameId: string) => {
      const client = supabaseRef.current as {
        channel: (name: string, opts?: Record<string, unknown>) => {
          on: (
            type: string,
            filter: Record<string, unknown>,
            cb: (msg: { payload: Record<string, unknown> }) => void
          ) => unknown;
          subscribe: (cb: (status: string) => void) => unknown;
        };
        removeChannel: (ch: unknown) => void;
      } | null;
      if (!client) return;

      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = client.channel(`game:${gameId}`, {
        config: { broadcast: { self: false } },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel as any)
        .on(
          'broadcast',
          { event: 'diplomatic_message' },
          ({ payload }: { payload: Record<string, unknown> }) => {
            const ev: GameEvent = {
              type: 'diplomatic_message',
              turn: (payload.turn as number) ?? 0,
              createdAt: (payload.createdAt as string) ?? new Date().toISOString(),
              data: payload,
            };
            setEvents((prev) => {
              const key = `${ev.turn}:${payload.content}`;
              const exists = prev.some(
                (e) =>
                  e.type === 'diplomatic_message' &&
                  `${e.turn}:${(e.data as Record<string, unknown>)?.content}` === key
              );
              if (exists) return prev;
              return [ev, ...prev];
            });
          }
        )
        .on(
          'broadcast',
          { event: 'game_event' },
          ({ payload }: { payload: Record<string, unknown> }) => {
            const ev: GameEvent = {
              type: (payload.event_type as string) || 'system',
              turn: (payload.turn as number) ?? 0,
              data: payload,
            };
            setEvents((prev) => [ev, ...prev]);
            fetchState();
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setWsStatus('connected');
            // Close legacy WS if Supabase is working
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setWsStatus('disconnected');
            connectWs();
          }
        });

      channelRef.current = channel;
    },
    [connectWs, fetchState]
  );

  // ---- Init ----
  useEffect(() => {
    let mounted = true;

    async function init() {
      await fetchState();
      if (!mounted) return;

      await initSupabase();
      if (!mounted) return;

      // Subscribe if we have a game
      if (gameIdRef.current) {
        if (supabaseRef.current) {
          subscribeSupabase(gameIdRef.current);
        } else {
          connectWs();
        }
      }

      // Fallback polling every 10s
      pollTimer.current = setInterval(() => {
        if (mounted) fetchState();
      }, 10000);
    }

    init();

    return () => {
      mounted = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pollTimer.current) clearInterval(pollTimer.current);
      const client = supabaseRef.current as {
        removeChannel: (ch: unknown) => void;
      } | null;
      if (client && channelRef.current) {
        client.removeChannel(channelRef.current);
      }
    };
  }, [fetchState, initSupabase, subscribeSupabase, connectWs]);

  return {
    game,
    countries,
    alliances,
    wars,
    events,
    wsStatus,
    loading,
    selectedCountry,
    selectCountry: setSelectedCountry,
  };
}
