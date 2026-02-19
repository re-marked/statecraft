// ============================================================
// STATECRAFT v3 — World Events System
// Random dramatic events that fire each turn
// ============================================================

import type { Country, Province, Resolution } from "../../types/index.js";

interface WorldEvent {
  id: string;
  title: string;
  effect: (c: Country, provinces: Province[]) => Record<string, number> | null;
}

const WORLD_EVENTS: WorldEvent[] = [
  {
    id: "economic_boom",
    title: "Economic Boom",
    effect: (c) => (c.money > 100 ? { money: 30 } : null),
  },
  {
    id: "recession",
    title: "Recession Hits",
    effect: (c) => (c.money > 150 ? { money: -40 } : null),
  },
  {
    id: "military_coup",
    title: "Military Coup",
    effect: (c) => (c.stability <= 3 ? { stability: -2, totalTroops: -5 } : null),
  },
  {
    id: "civil_unrest",
    title: "Civil Unrest",
    effect: (c) => (c.stability <= 5 ? { stability: -1 } : null),
  },
  {
    id: "plague",
    title: "Plague Outbreak",
    effect: () => ({ money: -20, stability: -1 }),
  },
  {
    id: "resource_discovery",
    title: "Resource Discovery",
    effect: (c) => (c.money < 80 ? { money: 40 } : null),
  },
  {
    id: "famine",
    title: "Famine",
    effect: (c) => (c.money < 60 ? { money: -20, stability: -1 } : null),
  },
  {
    id: "golden_age",
    title: "Golden Age",
    effect: (c) => (c.stability >= 8 ? { money: 30, tech: 1 } : null),
  },
  {
    id: "diplomatic_crisis",
    title: "Diplomatic Crisis",
    effect: (c) => (c.stability <= 6 ? { stability: -1 } : null),
  },
  {
    id: "tech_breakthrough",
    title: "Technological Breakthrough",
    effect: (c) => (c.tech < 5 ? { tech: 1, money: 15 } : null),
  },
];

export function processWorldEvents(
  countries: Country[],
  provincesByCountry: Map<string, Province[]>
): Resolution[] {
  const resolutions: Resolution[] = [];
  const alive = countries.filter((c) => !c.isEliminated);
  if (alive.length === 0) return resolutions;

  const numEvents = Math.floor(Math.random() * 2) + 1;
  const shuffled = [...WORLD_EVENTS].sort(() => Math.random() - 0.5).slice(0, numEvents);

  for (const event of shuffled) {
    const candidate = alive[Math.floor(Math.random() * alive.length)];
    const provinces = provincesByCountry.get(candidate.countryId) ?? [];
    const fx = event.effect(candidate, provinces);
    if (!fx) continue;

    const stateChanges = Object.entries(fx).map(([field, delta]) => ({
      country: candidate.countryId,
      field,
      delta,
    }));

    resolutions.push({
      type: "world_event",
      countries: [candidate.countryId],
      description: `WORLD EVENT — ${event.title}: ${candidate.displayName} is affected!`,
      stateChanges,
    });
  }

  return resolutions;
}
