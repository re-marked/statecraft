import { readFileSync } from 'fs';

const cp = JSON.parse(readFileSync('src/data/country-provinces.json', 'utf-8'));
const topo = JSON.parse(readFileSync('ui/public/data/nuts2-europe.json', 'utf-8'));

const nonEU = new Set(['russia','turkey','ukraine','serbia','belarus','albania','bosnia','north_macedonia','moldova','montenegro','kosovo','andorra','uk']);

const objKey = Object.keys(topo.objects)[0];
const geoms = topo.objects[objKey].geometries;
const topoIds = new Set(geoms.map(g => g.properties?.NUTS_ID || g.id || ''));

console.log('TopoJSON has', topoIds.size, 'unique NUTS_IDs');
console.log('');

const euMissing = [];
for (const [country, provs] of Object.entries(cp)) {
  if (nonEU.has(country)) continue;
  for (const id of provs) {
    if (!topoIds.has(id)) euMissing.push({ country, id });
  }
}

console.log('EU/EFTA provinces missing from Eurostat TopoJSON:');
for (const m of euMissing) {
  console.log('  ' + m.id + ' (' + m.country + ')');
}
console.log('Total:', euMissing.length);
