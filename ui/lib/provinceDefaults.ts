// Build default Province[] from static game data files
// Used by demo mode and as fallback when live province data isn't loaded yet
//
// NOTE: These JSON files are copies of src/data/*.json
// Run `node scripts/sync-ui-data.mjs` to resync after changing the source files.

import type { Province } from './types';
import countryProvinces from './data/country-provinces.json';
import provinceData from './data/province-data.json';
import countryStarters from './data/country-starters.json';

const pd = provinceData as Record<string, { name: string; gdp: number; population: number; terrain: string }>;
const cs = countryStarters as Record<string, { capitalProvinceId?: string; capital_province_id?: string; troops?: number }>;
const cp = countryProvinces as Record<string, string[]>;

// Reverse lookup: nuts2_id → country_id
const provinceToCountry = new Map<string, string>();
for (const [country, provIds] of Object.entries(cp)) {
  for (const id of provIds) {
    provinceToCountry.set(id, country);
  }
}

// Capital set
const capitals = new Set<string>();
for (const [, starter] of Object.entries(cs)) {
  const cap = starter.capitalProvinceId ?? starter.capital_province_id;
  if (cap) capitals.add(cap);
}

export function getDefaultProvinces(): Province[] {
  const provinces: Province[] = [];

  for (const [countryId, provIds] of Object.entries(cp)) {
    const starter = cs[countryId as keyof typeof cs];
    const troopsPerProvince = starter?.troops
      ? Math.round(starter.troops / provIds.length)
      : 5;

    for (const id of provIds) {
      const data = pd[id];
      if (!data) continue;

      provinces.push({
        nuts2_id: id,
        name: data.name,
        owner_id: countryId,
        gdp_value: data.gdp,
        terrain: data.terrain,
        troops_stationed: troopsPerProvince,
        is_capital: capitals.has(id),
        original_owner_id: countryId,
        population: data.population,
      });
    }
  }

  return provinces;
}

export function getProvinceCountryMap(): Map<string, string> {
  return new Map(provinceToCountry);
}

// Static terrain lookup: nuts2_id → terrain string
const terrainByProvince = new Map<string, string>();
for (const [id, data] of Object.entries(pd)) {
  terrainByProvince.set(id, data.terrain);
}

export function getProvinceTerrainMap(): Map<string, string> {
  return new Map(terrainByProvince);
}
