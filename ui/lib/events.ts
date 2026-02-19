// ============================================================
// Statecraft War Room — Event Formatting
// ============================================================

import { type GameEvent, type NewsItem, countryName } from './types';

/** Format ISO timestamp to HH:MM */
export function fmtTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

/** Convert a game event to a news headline card (or null if not newsworthy) */
export function evToNewsItem(ev: GameEvent): NewsItem | null {
  const d = (ev.data ?? {}) as Record<string, unknown>;

  // --- Diplomatic messages (public only) ---
  if (ev.type === 'diplomatic_message' && d.private === false) {
    const icon = (d.from_flag as string) || '🌍';
    const from = (d.from_name as string) || (d.from_country as string) || '?';
    return {
      icon,
      headline: `${icon} ${from.toUpperCase()} — Official Statement`,
      body: `"${(d.content as string) || ''}"`,
      turn: ev.turn,
      ts: ev.createdAt,
      cls: 'diplomacy',
    };
  }

  // --- Resolutions ---
  if (ev.type === 'resolution') {
    const type = (d.type as string) || '';
    const countries = (d.countries as string[]) || [];
    const a = countries[0] || '';
    const b = countries[1] || '';
    const aName = countryName(a);
    const bName = countryName(b);
    const desc = (d.description as string) || '';

    if (type === 'combat') {
      const won = desc.includes('seizes');
      return {
        icon: won ? '⚔️' : '🛡️',
        headline: won
          ? `⚔️ WAR REPORT — ${aName} Forces Advance`
          : `🛡️ WAR REPORT — ${aName} Repelled at ${bName} Border`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'combat',
      };
    }
    if (type === 'naval_combat') {
      return {
        icon: '🚢',
        headline: '🚢 NAVAL DISPATCH — Maritime Engagement Reported',
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'combat',
      };
    }
    if (type === 'alliance_formed') {
      return {
        icon: '🤝',
        headline: `🤝 DIPLOMATIC ACCORD — ${aName} and ${bName} Sign Alliance`,
        body:
          desc ||
          `A formal alliance has been established between ${aName} and ${bName}.`,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'diplomacy',
      };
    }
    if (type === 'betrayal') {
      return {
        icon: '🗡️',
        headline: `🗡️ BREAKING — ${aName} Betrays ${bName}!`,
        body:
          desc ||
          `${aName} has launched a surprise attack on their former ally ${bName}.`,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'combat',
      };
    }
    if (type === 'spy_intel') {
      return {
        icon: '🕵️',
        headline: `🕵️ INTELLIGENCE — Espionage Activity Near ${bName}`,
        body: desc || 'Classified intelligence reports suggest covert operations.',
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'espionage',
      };
    }
    if (type === 'spy_sabotage') {
      return {
        icon: '💥',
        headline: `💥 INCIDENT — ${bName} Reports Infrastructure Attack`,
        body: desc || `Authorities in ${bName} are investigating suspected sabotage.`,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'espionage',
      };
    }
    if (type === 'spy_propaganda') {
      return {
        icon: '📡',
        headline: `📡 UNREST — Disinformation Campaign in ${bName}`,
        body:
          desc ||
          `Civil unrest is rising as foreign propaganda destabilises ${bName}.`,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'espionage',
      };
    }
    if (type === 'peace' || type === 'ceasefire') {
      return {
        icon: '🕊️',
        headline: `🕊️ PEACE — ${aName} and ${bName} End Hostilities`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'diplomacy',
      };
    }
    if (type === 'trade_success') {
      return {
        icon: '📦',
        headline: `📦 TRADE — ${aName}–${bName} Exchange Agreement`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'diplomacy',
      };
    }
    if (type === 'sanction') {
      return {
        icon: '📋',
        headline: `📋 SANCTIONS — ${aName} Imposes Sanctions on ${bName}`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'system',
      };
    }

    if (type === 'propaganda') {
      return {
        icon: '📣',
        headline: `📣 PROPAGANDA — Campaign Against ${bName}`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'espionage',
      };
    }
    if (type === 'embargo') {
      return {
        icon: '🚫',
        headline: `🚫 EMBARGO — ${aName} Blocks Trade with ${bName}`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'system',
      };
    }
    if (type === 'annexation') {
      return {
        icon: '🏴',
        headline: `🏴 ANNEXATION — ${aName} Annexes ${bName}`,
        body: desc || `${bName} has been fully absorbed into ${aName}.`,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'combat',
      };
    }
    if (type === 'ultimatum_sent' || type === 'ultimatum') {
      return {
        icon: '⚠️',
        headline: `⚠️ ULTIMATUM — ${aName} Issues Demands to ${bName}`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'diplomacy',
      };
    }
    if (type === 'pact_formed') {
      return {
        icon: '🤝',
        headline: `🤝 PACT — New Alliance Formed`,
        body: desc || 'A new multi-member pact has been established.',
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'diplomacy',
      };
    }
    if (type === 'world_event') {
      return {
        icon: '🌍',
        headline: `🌍 WORLD EVENT`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'system',
      };
    }

    // Generic resolution fallback
    if (desc) {
      return {
        icon: '📡',
        headline: `📡 ${type.toUpperCase().replace(/_/g, ' ')}`,
        body: desc,
        turn: ev.turn,
        ts: ev.createdAt,
        cls: 'system',
      };
    }
  }

  // --- Lifecycle events ---
  if (ev.type === 'game_start') {
    return {
      icon: '🌍',
      headline: '🌍 STATECRAFT — Game Commenced',
      body: 'Representatives of European powers have gathered. The age of diplomacy — and betrayal — begins.',
      turn: ev.turn,
      ts: ev.createdAt,
      cls: 'system',
    };
  }
  if (ev.type === 'game_end') {
    const winner = (d.winner as string) || 'Unknown';
    return {
      icon: '🏆',
      headline: `🏆 GAME OVER — ${winner.toUpperCase()} VICTORIOUS`,
      body:
        (d.description as string) ||
        `The game has concluded. ${winner} emerges as the dominant power.`,
      turn: ev.turn,
      ts: ev.createdAt,
      cls: 'system',
    };
  }
  if (ev.type === 'turn_start') {
    return {
      icon: '📰',
      headline: `📰 TURN ${(d.turn as number) || ev.turn} — New Diplomatic Cycle Begins`,
      body: 'Envoys dispatch. Chancelleries deliberate. The world holds its breath.',
      turn: ev.turn,
      ts: ev.createdAt,
      cls: 'system',
    };
  }

  return null;
}

/** Classify an event for log styling */
export function eventClass(
  ev: GameEvent
): 'combat' | 'diplomacy' | 'espionage' | 'system' {
  const d = (ev.data ?? {}) as Record<string, unknown>;
  const type = (d.type as string) || '';

  if (ev.type === 'resolution') {
    if (
      ['combat', 'naval_combat', 'betrayal', 'coup', 'annexation', 'mobilize'].includes(type)
    )
      return 'combat';
    if (
      ['alliance_formed', 'pact_formed', 'trade_success', 'peace', 'ceasefire', 'ultimatum', 'ultimatum_sent', 'leave_alliance', 'foreign_aid'].includes(type)
    )
      return 'diplomacy';
    if (['spy_intel', 'spy_sabotage', 'spy_propaganda', 'propaganda', 'coup_attempt', 'coup_attempt_failed'].includes(type))
      return 'espionage';
  }
  if (ev.type === 'diplomatic_message') {
    return d.private !== false ? 'espionage' : 'diplomacy';
  }
  return 'system';
}

/** Format a log event into emoji + text */
export function eventToLog(ev: GameEvent): { emoji: string; text: string } {
  const d = (ev.data ?? {}) as Record<string, unknown>;

  if (ev.type === 'diplomatic_message') {
    const isPrivate = d.private !== false;
    const emoji = isPrivate ? '🔒' : '📢';
    const toLabel =
      d.to_country === 'broadcast'
        ? 'ALL'
        : `${(d.to_flag as string) || ''} ${(d.to_name as string) || (d.to_country as string) || '?'}`;
    const text = `${(d.from_flag as string) || ''} ${(d.from_name as string) || (d.from_country as string) || '?'} → ${toLabel}: ${(d.content as string) || ''}`;
    return { emoji, text };
  }
  if (ev.type === 'resolution') {
    return {
      emoji: (d.emoji as string) || '⚡',
      text: (d.description as string) || JSON.stringify(d).slice(0, 80),
    };
  }
  if (ev.type === 'game_start') return { emoji: '🎮', text: 'Game started!' };
  if (ev.type === 'game_end')
    return {
      emoji: '🏆',
      text: `Game ended! ${d.winner ? 'Winner: ' + d.winner : ''}`,
    };
  if (ev.type === 'turn_start')
    return { emoji: '🔄', text: `Turn ${(d.turn as number) || '?'} begins` };
  if (ev.type === 'phase_change')
    return {
      emoji: '⏱',
      text: `Phase: ${(d.phase as string) || (d.turn_phase as string) || '?'}`,
    };
  if (ev.type === 'declarations_revealed')
    return { emoji: '📜', text: 'Declarations revealed!' };
  if (ev.type === 'player_joined')
    return {
      emoji: '👤',
      text: `${(d.country_id as string) || 'Player'} joined`,
    };

  return { emoji: '📡', text: `${ev.type}` };
}
