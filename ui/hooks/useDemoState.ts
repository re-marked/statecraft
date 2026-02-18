'use client';
// ============================================================
// Statecraft War Room — Demo Playback Engine
// Plays through DEMO_SCRIPT with predefined outcomes, no API needed
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Alliance, Country, Game, GameEvent, War, WsStatus } from '@/lib/types';
import type { UseGameStateReturn } from './useGameState';
import {
  DEMO_CAST,
  DEMO_CONFIG,
  DEMO_SCRIPT,
  type DemoAction,
  type DemoCountryInit,
  type DemoMessage,
  type DemoTurnScript,
} from '@/lib/demoScenario';
import { GAME_TO_FLAG, GAME_TO_NAME } from '@/lib/types';

// ── Internal mutable country state ──────────────────────────

interface MutableCountry {
  id: string;
  name: string;
  flag: string;
  territory: number;
  military: number;
  naval: number;
  resources: number;
  gdp: number;
  stability: number;
  prestige: number;
  tech: number;
  unrest: number;
  inflation: number;
  spyTokens: number;
  isEliminated: boolean;
}

function initCountry(c: DemoCountryInit): MutableCountry {
  return {
    id: c.id,
    name: c.name,
    flag: c.flag,
    territory: c.territory,
    military: c.military,
    naval: c.naval,
    resources: c.resources,
    gdp: c.gdp,
    stability: c.stability,
    prestige: DEMO_CONFIG.startingPrestige,
    tech: 0,
    unrest: DEMO_CONFIG.startingUnrest,
    inflation: DEMO_CONFIG.startingInflation,
    spyTokens: DEMO_CONFIG.startingSpyTokens,
    isEliminated: false,
  };
}

function toCountry(mc: MutableCountry): Country {
  return {
    id: mc.id,
    country_id: mc.id,
    name: mc.name,
    flag: mc.flag,
    territory: mc.territory,
    military: mc.military,
    naval: mc.naval,
    resources: mc.resources,
    gdp: mc.gdp,
    stability: mc.stability,
    prestige: mc.prestige,
    tech: mc.tech,
    unrest: mc.unrest,
    inflation: mc.inflation,
    is_eliminated: mc.isEliminated,
  };
}

// ── Resolution engine — deterministic outcomes ──────────────

interface ResolutionResult {
  events: GameEvent[];
  newAlliances: Alliance[];
  removedAlliances: string[]; // alliance IDs to remove
  newWars: War[];
  removedWars: string[]; // war IDs to remove
}

function resolveTurn(
  turn: DemoTurnScript,
  countries: Map<string, MutableCountry>,
  alliances: Alliance[],
  wars: War[],
): ResolutionResult {
  const events: GameEvent[] = [];
  const newAlliances: Alliance[] = [];
  const removedAlliances: string[] = [];
  const newWars: War[] = [];
  const removedWars: string[] = [];
  const now = new Date().toISOString();

  // Build action map
  const actionMap = new Map<string, DemoAction>();
  for (const a of turn.actions) actionMap.set(a.countryId, a);

  // Helper
  const c = (id: string) => countries.get(id);
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // ── 1. Ceasefires & Peace ──
  for (const a of turn.actions) {
    if ((a.action === 'propose_ceasefire' || a.action === 'propose_peace') && a.target) {
      const other = actionMap.get(a.target);
      if (other && (other.action === 'propose_ceasefire' || other.action === 'propose_peace') && other.target === a.countryId) {
        // Mutual — remove war
        const warId = wars.find(
          w => (w.attacker === a.countryId && w.defender === a.target) ||
               (w.defender === a.countryId && w.attacker === a.target)
        )?.id;
        if (warId) removedWars.push(warId);

        events.push({
          type: 'resolution',
          turn: turn.turn,
          createdAt: now,
          data: {
            type: a.action === 'propose_peace' ? 'peace' : 'ceasefire',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId] ?? a.countryId} and ${GAME_TO_NAME[a.target] ?? a.target} agree to ${a.action === 'propose_peace' ? 'peace' : 'a ceasefire'}.`,
            emoji: '🕊️',
          },
        });
      }
    }
  }

  // ── 2. Betrayals ──
  for (const a of turn.actions) {
    if (a.action === 'betray' && a.target) {
      const betrayer = c(a.countryId);
      const victim = c(a.target);
      if (!betrayer || !victim) continue;

      // Remove alliance
      const allianceId = alliances.find(
        al => al.countries.includes(a.countryId) && al.countries.includes(a.target!)
      )?.id;
      if (allianceId) removedAlliances.push(allianceId);

      // Damage
      victim.military = clamp(victim.military - 2, 0, 99);
      victim.stability = clamp(victim.stability - 1, 0, 10);
      betrayer.prestige = clamp(betrayer.prestige - 15, 0, 100);

      // Create war
      newWars.push({
        id: `war-${a.countryId}-${a.target}-${turn.turn}`,
        attacker: a.countryId,
        defender: a.target,
        is_active: true,
      });

      events.push({
        type: 'resolution',
        turn: turn.turn,
        createdAt: now,
        data: {
          type: 'betrayal',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} BETRAYS ${GAME_TO_NAME[a.target]}! Alliance shattered. ${GAME_TO_NAME[a.target]} loses 2 military, 1 stability.`,
          emoji: '🗡️',
        },
      });
    }
  }

  // ── 3. Espionage ──
  for (const a of turn.actions) {
    if (a.action === 'spy_intel' && a.target) {
      const spy = c(a.countryId);
      if (spy && spy.spyTokens > 0) {
        spy.spyTokens--;
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'spy_intel',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]} gathers intelligence on ${GAME_TO_NAME[a.target]}.`,
            emoji: '🕵️',
          },
        });
      }
    }
    if (a.action === 'spy_sabotage' && a.target) {
      const spy = c(a.countryId);
      const target = c(a.target);
      if (spy && target && spy.spyTokens > 0) {
        spy.spyTokens--;
        // Predefined: sabotage succeeds
        target.resources = clamp(target.resources - 2, 0, 99);
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'spy_sabotage',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]} sabotages ${GAME_TO_NAME[a.target]}! Target loses 2 resources.`,
            emoji: '💥',
          },
        });
      }
    }
    if (a.action === 'spy_propaganda' && a.target) {
      const spy = c(a.countryId);
      const target = c(a.target);
      if (spy && target && spy.spyTokens > 0) {
        spy.spyTokens--;
        target.stability = clamp(target.stability - 1, 0, 10);
        target.unrest = clamp(target.unrest + 10, 0, 100);
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'spy_propaganda',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]} spreads propaganda in ${GAME_TO_NAME[a.target]}! Stability -1, unrest +10%.`,
            emoji: '📡',
          },
        });
      }
    }
  }

  // ── 4. Combat ──
  for (const a of turn.actions) {
    if (a.action === 'attack' && a.target) {
      const attacker = c(a.countryId);
      const defender = c(a.target);
      if (!attacker || !defender) continue;

      const defenderAction = actionMap.get(a.target);
      const isDefending = defenderAction?.action === 'defend';

      // Deterministic: attacker wins if military > defender's (with defend bonus)
      const attackStr = attacker.military + attacker.tech * 0.5;
      const defendStr = (defender.military * (isDefending ? 1.5 : 1)) + defender.tech * 0.3;

      // Create war if not exists
      const warExists = wars.some(
        w => (w.attacker === a.countryId && w.defender === a.target) ||
             (w.defender === a.countryId && w.attacker === a.target)
      ) || newWars.some(
        w => (w.attacker === a.countryId && w.defender === a.target) ||
             (w.defender === a.countryId && w.attacker === a.target)
      );
      if (!warExists) {
        newWars.push({
          id: `war-${a.countryId}-${a.target}-${turn.turn}`,
          attacker: a.countryId,
          defender: a.target,
          is_active: true,
        });
      }

      if (attackStr > defendStr) {
        // Attacker wins — seize territory
        const seized = Math.min(2, defender.territory);
        attacker.territory += seized;
        defender.territory -= seized;
        attacker.military = clamp(attacker.military - 1, 0, 99);
        defender.military = clamp(defender.military - 2, 0, 99);

        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'combat',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]} seizes ${seized} territory from ${GAME_TO_NAME[a.target]}! Both sides suffer casualties.`,
            emoji: '⚔️',
          },
        });
      } else {
        // Defender holds
        attacker.military = clamp(attacker.military - 2, 0, 99);
        defender.military = clamp(defender.military - 1, 0, 99);

        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'combat',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.target]} repels ${GAME_TO_NAME[a.countryId]}'s attack! Attacker suffers heavy losses.`,
            emoji: '🛡️',
          },
        });
      }
    }
  }

  // ── 5. Naval combat ──
  for (const a of turn.actions) {
    if (a.action === 'naval_attack' && a.target) {
      const attacker = c(a.countryId);
      const defender = c(a.target);
      if (!attacker || !defender) continue;

      if (attacker.naval > defender.naval) {
        defender.naval = clamp(defender.naval - 2, 0, 99);
        defender.resources = clamp(defender.resources - 2, 0, 99);
        attacker.naval = clamp(attacker.naval - 1, 0, 99);
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'naval_combat',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]}'s navy defeats ${GAME_TO_NAME[a.target]} at sea! Target loses 2 naval + 2 resources.`,
            emoji: '🚢',
          },
        });
      } else {
        attacker.naval = clamp(attacker.naval - 1, 0, 99);
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'naval_combat',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.target]} repels ${GAME_TO_NAME[a.countryId]}'s naval assault!`,
            emoji: '🚢',
          },
        });
      }
    }
    if (a.action === 'naval_blockade' && a.target) {
      const blocker = c(a.countryId);
      const target = c(a.target);
      if (!blocker || !target || blocker.naval < 2) continue;

      target.resources = clamp(target.resources - 3, 0, 99);
      target.gdp = clamp(target.gdp - 5, 0, 999);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'naval_combat',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} blockades ${GAME_TO_NAME[a.target]}! Target loses 3 resources + 5 GDP.`,
          emoji: '⚓',
        },
      });
    }
  }

  // ── 6. Alliances ──
  for (const a of turn.actions) {
    if (a.action === 'ally' && a.target) {
      const other = actionMap.get(a.target);
      if (other?.action === 'ally' && other.target === a.countryId) {
        // Mutual — form alliance (avoid duplicates)
        const exists = alliances.some(
          al => al.countries.includes(a.countryId) && al.countries.includes(a.target!)
        ) || newAlliances.some(
          al => al.countries.includes(a.countryId) && al.countries.includes(a.target!)
        );
        if (!exists) {
          const allianceName = a.allianceName || other.allianceName || null;
          const allianceAbbr = a.allianceAbbreviation || other.allianceAbbreviation || null;
          newAlliances.push({
            id: `alliance-${a.countryId}-${a.target}-${turn.turn}`,
            countries: [a.countryId, a.target],
            is_active: true,
            name: allianceName,
            abbreviation: allianceAbbr,
          });
          const nameStr = allianceName ? ` "${allianceName}"${allianceAbbr ? ` (${allianceAbbr})` : ''}` : '';
          events.push({
            type: 'resolution', turn: turn.turn, createdAt: now,
            data: {
              type: 'alliance_formed',
              countries: [a.countryId, a.target],
              description: `${GAME_TO_NAME[a.countryId]} and ${GAME_TO_NAME[a.target]} form${nameStr ? '' : ' an'} alliance${nameStr}!`,
              emoji: '🤝',
            },
          });
        }
      }
    }
  }

  // ── 6b. Leave alliance (peaceful) ──
  for (const a of turn.actions) {
    if (a.action === 'leave_alliance' && a.target) {
      const leaver = c(a.countryId);
      if (!leaver) continue;
      const allianceId = alliances.find(
        al => al.countries.includes(a.countryId) && al.countries.includes(a.target!)
      )?.id;
      if (allianceId) removedAlliances.push(allianceId);
      leaver.prestige = clamp(leaver.prestige - 5, 0, 100);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'leave_alliance',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} peacefully leaves alliance with ${GAME_TO_NAME[a.target]}. (-5 prestige)`,
          emoji: '👋',
        },
      });
    }
  }

  // ── 7. Trade ──
  for (const a of turn.actions) {
    if (a.action === 'trade' && a.target) {
      const other = actionMap.get(a.target);
      if (other?.action === 'trade' && other.target === a.countryId) {
        const trader = c(a.countryId);
        const partner = c(a.target);
        if (!trader || !partner) continue;

        const amount = a.tradeAmount ?? 2;
        trader.gdp += amount;
        partner.gdp += amount;
        trader.resources += 1;
        partner.resources += 1;

        // Only emit once per pair
        if (a.countryId < a.target) {
          events.push({
            type: 'resolution', turn: turn.turn, createdAt: now,
            data: {
              type: 'trade_success',
              countries: [a.countryId, a.target],
              description: `${GAME_TO_NAME[a.countryId]} and ${GAME_TO_NAME[a.target]} complete a trade deal. Both gain ${amount} GDP + 1 resource.`,
              emoji: '📦',
            },
          });
        }
      }
    }
  }

  // ── 8. Sanctions ──
  for (const a of turn.actions) {
    if (a.action === 'sanction' && a.target) {
      const target = c(a.target);
      if (!target) continue;
      target.gdp = clamp(target.gdp - 3, 0, 999);
      target.resources = clamp(target.resources - 1, 0, 99);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'sanction',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} imposes sanctions on ${GAME_TO_NAME[a.target]}. Target loses 3 GDP + 1 resource.`,
          emoji: '📋',
        },
      });
    }
  }

  // ── 8b. Propaganda ──
  for (const a of turn.actions) {
    if (a.action === 'propaganda' && a.target) {
      const attacker = c(a.countryId);
      const target = c(a.target);
      if (!attacker || !target) continue;
      attacker.resources = clamp(attacker.resources - 1, 0, 99);
      target.prestige = clamp(target.prestige - 5, 0, 100);
      target.stability = clamp(target.stability - 1, 0, 10);
      attacker.prestige = clamp(attacker.prestige + 3, 0, 100);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'propaganda',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} launches propaganda campaign against ${GAME_TO_NAME[a.target]}! Target: -5 prestige, -1 stability.`,
          emoji: '📣',
        },
      });
    }
  }

  // ── 8c. Embargo ──
  for (const a of turn.actions) {
    if (a.action === 'embargo' && a.target) {
      const attacker = c(a.countryId);
      const target = c(a.target);
      if (!attacker || !target) continue;
      target.gdp = clamp(target.gdp - 5, 0, 999);
      target.resources = clamp(target.resources - 3, 0, 99);
      attacker.gdp = clamp(attacker.gdp - 2, 0, 999);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'embargo',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} embargoes ${GAME_TO_NAME[a.target]}! Target: -5 GDP, -3 resources. Self: -2 GDP.`,
          emoji: '🚫',
        },
      });
    }
  }

  // ── 8d. Coup attempt ──
  for (const a of turn.actions) {
    if (a.action === 'coup_attempt' && a.target) {
      const attacker = c(a.countryId);
      const target = c(a.target);
      if (!attacker || !target || attacker.spyTokens < 2) continue;
      attacker.spyTokens -= 2;
      // Deterministic for demo: success if attacker tech > target stability
      const success = attacker.tech > target.stability;
      if (success) {
        target.isEliminated = true;
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'coup_attempt',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]}'s coup in ${GAME_TO_NAME[a.target]} SUCCEEDS! Government overthrown!`,
            emoji: '💀',
          },
        });
      } else {
        attacker.spyTokens = 0;
        target.stability = clamp(target.stability + 2, 0, 10);
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'coup_attempt_failed',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]}'s coup attempt in ${GAME_TO_NAME[a.target]} FAILS! Agents captured. Target rallies (+2 stability).`,
            emoji: '🔒',
          },
        });
      }
    }
  }

  // ── 8e. Arms deal (mutual) ──
  for (const a of turn.actions) {
    if (a.action === 'arms_deal' && a.target) {
      const other = actionMap.get(a.target);
      if (other?.action === 'arms_deal' && other.target === a.countryId && a.countryId < a.target) {
        const trader = c(a.countryId);
        const partner = c(a.target);
        if (!trader || !partner) continue;
        trader.military = clamp(trader.military - 2, 0, 99);
        trader.resources += 3;
        partner.military = clamp(partner.military - 2, 0, 99);
        partner.resources += 3;
        events.push({
          type: 'resolution', turn: turn.turn, createdAt: now,
          data: {
            type: 'arms_deal',
            countries: [a.countryId, a.target],
            description: `${GAME_TO_NAME[a.countryId]} and ${GAME_TO_NAME[a.target]} complete arms deal. Both swap 2 military for 3 resources.`,
            emoji: '🔫',
          },
        });
      }
    }
  }

  // ── 8f. Foreign aid ──
  for (const a of turn.actions) {
    if (a.action === 'foreign_aid' && a.target) {
      const giver = c(a.countryId);
      const receiver = c(a.target);
      if (!giver || !receiver) continue;
      giver.resources = clamp(giver.resources - 2, 0, 99);
      receiver.resources += 2;
      giver.prestige = clamp(giver.prestige + 10, 0, 100);
      giver.stability = clamp(giver.stability + 1, 0, 10);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'foreign_aid',
          countries: [a.countryId, a.target],
          description: `${GAME_TO_NAME[a.countryId]} sends foreign aid to ${GAME_TO_NAME[a.target]}! (+10 prestige, +1 stability for sender)`,
          emoji: '🎁',
        },
      });
    }
  }

  // ── 8g. Mobilize ──
  for (const a of turn.actions) {
    if (a.action === 'mobilize') {
      const country = c(a.countryId);
      if (!country) continue;
      country.military = clamp(country.military + 3, 0, 20);
      country.stability = clamp(country.stability - 2, 0, 10);
      country.unrest = clamp(country.unrest + 15, 0, 100);
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'mobilize',
          countries: [a.countryId],
          description: `${GAME_TO_NAME[a.countryId]} declares full mobilization! +3 military, -2 stability, +15 unrest.`,
          emoji: '📯',
        },
      });
    }
  }

  // ── 9. Investments ──
  for (const a of turn.actions) {
    const country = c(a.countryId);
    if (!country) continue;
    if (a.action === 'invest_military') {
      country.military = clamp(country.military + 1, 0, 20);
    }
    if (a.action === 'invest_stability') {
      country.stability = clamp(country.stability + 1, 0, 10);
      country.unrest = clamp(country.unrest - 5, 0, 100);
    }
    if (a.action === 'invest_tech') {
      country.tech = clamp(country.tech + 1, 0, 10);
    }
  }

  // ── 10. UN Votes ──
  for (const a of turn.actions) {
    if (a.action === 'call_vote' && a.voteResolution) {
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'vote_called',
          countries: [a.countryId],
          description: `${GAME_TO_NAME[a.countryId]} calls for a UN vote: "${a.voteResolution}"`,
          emoji: '🗳️',
        },
      });
    }
  }

  // ── 11. World News ──
  if (turn.worldNews) {
    const wn = turn.worldNews;
    for (const effect of wn.effects) {
      const target = c(effect.country);
      if (target) {
        (target as unknown as Record<string, number>)[effect.field] += effect.delta;
      }
    }
    events.push({
      type: 'resolution', turn: turn.turn, createdAt: now,
      data: {
        type: 'world_event',
        countries: wn.effects.map(e => e.country),
        description: `${wn.title}: ${wn.description}`,
        emoji: '🌍',
      },
    });
  }

  // ── 12. Regen spy tokens ──
  for (const [, country] of countries) {
    if (!country.isEliminated) {
      country.spyTokens = Math.min(DEMO_CONFIG.maxSpyTokens, country.spyTokens + DEMO_CONFIG.spyTokenRegenPerTurn);
    }
  }

  // ── 13. Coup check ──
  for (const [, country] of countries) {
    if (country.stability <= 0 && !country.isEliminated) {
      country.isEliminated = true;
      events.push({
        type: 'resolution', turn: turn.turn, createdAt: now,
        data: {
          type: 'coup',
          countries: [country.id],
          description: `${country.name} collapses! Government overthrown in a military coup.`,
          emoji: '💀',
        },
      });
    }
  }

  return { events, newAlliances, removedAlliances, newWars, removedWars };
}

// ── Timing constants ────────────────────────────────────────

const PHASE_DURATION_MS = {
  negotiation: 18_000,   // 18s — messages drip in
  declaration: 8_000,    // 8s — show declarations
  resolution: 12_000,    // 12s — show results
  pause: 2_000,          // 2s gap between turns
} as const;
// Total per turn: ~40s → 10 turns = ~6.5 minutes (+ game start/end)

// ── The Hook ────────────────────────────────────────────────

export function useDemoState(): UseGameStateReturn {
  const [game, setGame] = useState<Game | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [wars, setWars] = useState<War[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Mutable refs for the simulation state
  const mutableCountries = useRef<Map<string, MutableCountry>>(new Map());
  const mutableAlliances = useRef<Alliance[]>([]);
  const mutableWars = useRef<War[]>([]);
  const turnIndex = useRef(0);
  const phaseTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);

  const pushEvent = useCallback((ev: GameEvent) => {
    if (!mounted.current) return;
    setEvents(prev => [ev, ...prev]);
  }, []);

  const pushEvents = useCallback((evs: GameEvent[]) => {
    if (!mounted.current) return;
    setEvents(prev => [...evs, ...prev]);
  }, []);

  const syncCountries = useCallback(() => {
    if (!mounted.current) return;
    setCountries(Array.from(mutableCountries.current.values()).map(toCountry));
  }, []);

  const syncRelations = useCallback(() => {
    if (!mounted.current) return;
    setAlliances([...mutableAlliances.current]);
    setWars([...mutableWars.current]);
  }, []);

  const updateGame = useCallback((patch: Partial<Game>) => {
    if (!mounted.current) return;
    setGame(prev => prev ? { ...prev, ...patch } : null);
  }, []);

  // ── Schedule a turn playback ──
  const playTurn = useCallback((idx: number) => {
    if (!mounted.current || idx >= DEMO_SCRIPT.length) {
      // Game over
      const topCountry = Array.from(mutableCountries.current.values())
        .filter(c => !c.isEliminated)
        .sort((a, b) => b.gdp - a.gdp)[0];

      updateGame({
        phase: 'ended',
        turn_phase: 'ended',
        status: 'ended',
        winner: topCountry?.name ?? 'Unknown',
      });

      pushEvent({
        type: 'game_end',
        turn: DEMO_SCRIPT.length,
        createdAt: new Date().toISOString(),
        data: {
          winner: topCountry?.name ?? 'Unknown',
          description: `${topCountry?.name ?? 'Unknown'} wins through economic dominance with ${topCountry?.gdp ?? 0} GDP!`,
        },
      });
      return;
    }

    const script = DEMO_SCRIPT[idx];
    const baseDelay = 0;
    let delay = baseDelay;

    // ── Phase 1: Negotiation ──
    phaseTimers.current.push(setTimeout(() => {
      if (!mounted.current) return;

      updateGame({
        turn: script.turn,
        turn_phase: 'negotiation',
        world_tension: Math.min(100, 20 + script.turn * 8),
      });

      pushEvent({
        type: 'turn_start',
        turn: script.turn,
        createdAt: new Date().toISOString(),
        data: { turn: script.turn, title: script.title, narrative: script.narrative },
      });

      // Drip messages one by one
      script.messages.forEach((msg: DemoMessage, i: number) => {
        phaseTimers.current.push(setTimeout(() => {
          if (!mounted.current) return;
          const fromName = GAME_TO_NAME[msg.from] ?? msg.from;
          const fromFlag = GAME_TO_FLAG[msg.from] ?? '';
          const toName = msg.to === 'broadcast' ? 'ALL' : (GAME_TO_NAME[msg.to] ?? msg.to);
          const toFlag = msg.to === 'broadcast' ? '' : (GAME_TO_FLAG[msg.to] ?? '');

          pushEvent({
            type: 'diplomatic_message',
            turn: script.turn,
            createdAt: new Date().toISOString(),
            data: {
              from_country: msg.from,
              from_name: fromName,
              from_flag: fromFlag,
              to_country: msg.to,
              to_name: toName,
              to_flag: toFlag,
              content: msg.content,
              private: msg.private,
            },
          });
        }, (i + 1) * (PHASE_DURATION_MS.negotiation / (script.messages.length + 1))));
      });
    }, delay));

    delay += PHASE_DURATION_MS.negotiation;

    // ── Phase 2: Declaration ──
    phaseTimers.current.push(setTimeout(() => {
      if (!mounted.current) return;

      updateGame({ turn_phase: 'declaration' });

      pushEvent({
        type: 'phase_change',
        turn: script.turn,
        createdAt: new Date().toISOString(),
        data: { phase: 'declaration', turn: script.turn },
      });

      // Show declarations after a brief pause
      phaseTimers.current.push(setTimeout(() => {
        if (!mounted.current) return;
        pushEvent({
          type: 'declarations_revealed',
          turn: script.turn,
          createdAt: new Date().toISOString(),
          data: {
            declarations: script.actions.map(a => ({
              country: a.countryId,
              name: GAME_TO_NAME[a.countryId] ?? a.countryId,
              action: a.action,
              target: a.target,
              statement: a.publicStatement,
            })),
          },
        });
      }, 2000));
    }, delay));

    delay += PHASE_DURATION_MS.declaration;

    // ── Phase 3: Resolution ──
    phaseTimers.current.push(setTimeout(() => {
      if (!mounted.current) return;

      updateGame({ turn_phase: 'resolution' });

      pushEvent({
        type: 'phase_change',
        turn: script.turn,
        createdAt: new Date().toISOString(),
        data: { phase: 'resolution', turn: script.turn },
      });

      // Run the resolution engine
      const result = resolveTurn(
        script,
        mutableCountries.current,
        mutableAlliances.current,
        mutableWars.current,
      );

      // Apply alliance changes
      mutableAlliances.current = mutableAlliances.current.filter(
        a => !result.removedAlliances.includes(a.id)
      );
      mutableAlliances.current.push(...result.newAlliances);

      // Apply war changes
      mutableWars.current = mutableWars.current.filter(
        w => !result.removedWars.includes(w.id)
      );
      mutableWars.current.push(...result.newWars);

      // Drip resolution events
      result.events.forEach((ev, i) => {
        phaseTimers.current.push(setTimeout(() => {
          if (!mounted.current) return;
          pushEvent(ev);
          syncCountries();
          syncRelations();
        }, (i + 1) * (PHASE_DURATION_MS.resolution / (result.events.length + 2))));
      });

      // Final sync after all events
      phaseTimers.current.push(setTimeout(() => {
        if (!mounted.current) return;
        syncCountries();
        syncRelations();
      }, PHASE_DURATION_MS.resolution - 500));
    }, delay));

    delay += PHASE_DURATION_MS.resolution;

    // ── Schedule next turn ──
    phaseTimers.current.push(setTimeout(() => {
      if (!mounted.current) return;
      turnIndex.current = idx + 1;
      playTurn(idx + 1);
    }, delay + PHASE_DURATION_MS.pause));

  }, [updateGame, pushEvent, syncCountries, syncRelations]);

  // ── Init & cleanup ──
  useEffect(() => {
    mounted.current = true;

    // Init countries
    const cMap = new Map<string, MutableCountry>();
    for (const init of DEMO_CAST) {
      cMap.set(init.id, initCountry(init));
    }
    mutableCountries.current = cMap;
    mutableAlliances.current = [];
    mutableWars.current = [];

    // Set initial state
    setCountries(Array.from(cMap.values()).map(toCountry));
    setGame({
      id: 'demo-game',
      turn: 0,
      max_turns: 10,
      turn_phase: 'negotiation',
      phase: 'active',
      world_tension: 15,
      status: 'active',
    });
    setLoading(false);

    // Start with game_start event
    pushEvent({
      type: 'game_start',
      turn: 0,
      createdAt: new Date().toISOString(),
      data: {},
    });

    // Begin playback after 2s
    const startTimer = setTimeout(() => {
      if (mounted.current) playTurn(0);
    }, 2000);

    return () => {
      mounted.current = false;
      clearTimeout(startTimer);
      for (const t of phaseTimers.current) clearTimeout(t);
      phaseTimers.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    game,
    countries,
    alliances,
    wars,
    events,
    wsStatus: 'connected' as WsStatus,
    loading,
    selectedCountry,
    selectCountry: setSelectedCountry,
  };
}
