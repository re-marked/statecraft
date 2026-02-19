// Remap synthetic game codes to real Eurostat NUTS2 codes
// Affects: Turkey, Serbia, N. Macedonia, Montenegro, Kosovo
import { readFileSync, writeFileSync } from 'fs';

// ── Turkey: 16 synthetic → 26 Eurostat NUTS2 ──
// Game had TR01-TR16 (16 provinces), Eurostat has 26. We'll replace with all 26.
const TR_EUROSTAT = [
  { id: 'TR10', name: 'Istanbul', pop: 15500, gdp: 45, terrain: 'urban' },
  { id: 'TR21', name: 'Tekirdağ', pop: 1750, gdp: 8, terrain: 'plains' },
  { id: 'TR22', name: 'Balıkesir', pop: 1600, gdp: 6, terrain: 'coastal' },
  { id: 'TR31', name: 'İzmir', pop: 4320, gdp: 18, terrain: 'coastal' },
  { id: 'TR32', name: 'Aydın', pop: 2900, gdp: 10, terrain: 'coastal' },
  { id: 'TR33', name: 'Manisa', pop: 3000, gdp: 10, terrain: 'plains' },
  { id: 'TR41', name: 'Bursa', pop: 3100, gdp: 14, terrain: 'plains' },
  { id: 'TR42', name: 'Kocaeli', pop: 3500, gdp: 16, terrain: 'coastal' },
  { id: 'TR51', name: 'Ankara', pop: 5640, gdp: 22, terrain: 'urban' },
  { id: 'TR52', name: 'Konya', pop: 2230, gdp: 8, terrain: 'plains' },
  { id: 'TR61', name: 'Antalya', pop: 2510, gdp: 12, terrain: 'coastal' },
  { id: 'TR62', name: 'Adana', pop: 2220, gdp: 10, terrain: 'plains' },
  { id: 'TR63', name: 'Hatay', pop: 3300, gdp: 8, terrain: 'plains' },
  { id: 'TR71', name: 'Kırıkkale', pop: 1500, gdp: 5, terrain: 'plains' },
  { id: 'TR72', name: 'Kayseri', pop: 1400, gdp: 6, terrain: 'mountains' },
  { id: 'TR81', name: 'Zonguldak', pop: 750, gdp: 4, terrain: 'mountains' },
  { id: 'TR82', name: 'Kastamonu', pop: 700, gdp: 3, terrain: 'mountains' },
  { id: 'TR83', name: 'Samsun', pop: 1340, gdp: 6, terrain: 'coastal' },
  { id: 'TR90', name: 'Trabzon', pop: 810, gdp: 4, terrain: 'mountains' },
  { id: 'TRA1', name: 'Erzurum', pop: 760, gdp: 3, terrain: 'mountains' },
  { id: 'TRA2', name: 'Ağrı', pop: 1100, gdp: 2, terrain: 'mountains' },
  { id: 'TRB1', name: 'Malatya', pop: 800, gdp: 3, terrain: 'mountains' },
  { id: 'TRB2', name: 'Van', pop: 1120, gdp: 3, terrain: 'mountains' },
  { id: 'TRC1', name: 'Gaziantep', pop: 2060, gdp: 8, terrain: 'plains' },
  { id: 'TRC2', name: 'Şanlıurfa', pop: 2030, gdp: 5, terrain: 'plains' },
  { id: 'TRC3', name: 'Mardin', pop: 1500, gdp: 3, terrain: 'plains' },
];

// ── Serbia: 3 synthetic → 4 Eurostat ──
const RS_REMAP = {
  'RS01': 'RS11', // Belgrade → Београдски регион
  'RS02': 'RS12', // Vojvodina → Регион Војводине
  'RS03': 'RS21', // Šumadija → Регион Шумадије
};
const RS_NEW = { id: 'RS22', name: 'Southern and Eastern Serbia', pop: 1500, gdp: 5, terrain: 'mountains' };

// ── Simple renames ──
const SIMPLE_RENAMES = {
  'ME01': 'ME00',
  'XK01': 'XK00',
};

// ── N. Macedonia: 2 → 1 (merge) ──
const MK_MERGED = { id: 'MK00', name: 'North Macedonia', pop: 1880, gdp: 5, terrain: 'mountains' };

// ── Update country-provinces.json ──
const cpPath = 'src/data/country-provinces.json';
const cp = JSON.parse(readFileSync(cpPath, 'utf-8'));

// Turkey - replace entirely
cp.turkey = TR_EUROSTAT.map(t => t.id);

// Serbia - remap + add RS22
cp.serbia = cp.serbia.map(id => RS_REMAP[id] || id);
cp.serbia.push(RS_NEW.id);

// N. Macedonia - merge to 1
cp.north_macedonia = [MK_MERGED.id];

// Montenegro, Kosovo - rename
cp.montenegro = cp.montenegro.map(id => SIMPLE_RENAMES[id] || id);
cp.kosovo = cp.kosovo.map(id => SIMPLE_RENAMES[id] || id);

writeFileSync(cpPath, JSON.stringify(cp, null, 2) + '\n');
console.log('Updated country-provinces.json');

// ── Update province-data.json ──
const pdPath = 'src/data/province-data.json';
const pd = JSON.parse(readFileSync(pdPath, 'utf-8'));

// Remove old Turkish provinces
for (let i = 1; i <= 16; i++) {
  const key = 'TR' + String(i).padStart(2, '0');
  delete pd[key];
}

// Add new Turkish provinces
for (const t of TR_EUROSTAT) {
  pd[t.id] = { name: t.name, population: t.pop, gdp_value: t.gdp, terrain: t.terrain };
}

// Serbia remap + add
for (const [oldId, newId] of Object.entries(RS_REMAP)) {
  if (pd[oldId]) {
    pd[newId] = pd[oldId];
    delete pd[oldId];
  }
}
pd[RS_NEW.id] = { name: RS_NEW.name, population: RS_NEW.pop, gdp_value: RS_NEW.gdp, terrain: RS_NEW.terrain };

// N. Macedonia merge
delete pd['MK01'];
delete pd['MK02'];
pd[MK_MERGED.id] = { name: MK_MERGED.name, population: MK_MERGED.pop, gdp_value: MK_MERGED.gdp, terrain: MK_MERGED.terrain };

// Simple renames
for (const [oldId, newId] of Object.entries(SIMPLE_RENAMES)) {
  if (pd[oldId]) {
    pd[newId] = pd[oldId];
    delete pd[oldId];
  }
}

writeFileSync(pdPath, JSON.stringify(pd, null, 2) + '\n');
console.log('Updated province-data.json');

// ── Update province-adjacency.json ──
const adjPath = 'src/data/province-adjacency.json';
const adj = JSON.parse(readFileSync(adjPath, 'utf-8'));

// Build rename map for all codes
const allRenames = { ...RS_REMAP, ...SIMPLE_RENAMES, 'MK01': 'MK00', 'MK02': 'MK00' };

// Remove old Turkish adjacencies
const newAdj = adj.filter(([a, b]) => {
  // Remove edges with old TR codes (TR01-TR16 excluding TR10 which is now Istanbul)
  const oldTR = id => /^TR(0[1-9]|1[0-6])$/.test(id) && id !== 'TR10';
  return !(oldTR(a) || oldTR(b));
});

// Remap remaining codes
for (const edge of newAdj) {
  if (allRenames[edge[0]]) edge[0] = allRenames[edge[0]];
  if (allRenames[edge[1]]) edge[1] = allRenames[edge[1]];
}

// Remove duplicate edges and self-loops
const edgeSet = new Set();
const dedupedAdj = [];
for (const [a, b] of newAdj) {
  if (a === b) continue;
  const key = [a, b].sort().join('-');
  if (edgeSet.has(key)) continue;
  edgeSet.add(key);
  dedupedAdj.push([a, b]);
}

// Add Turkish adjacency graph (Eurostat NUTS2 codes)
const trAdj = [
  ['TR10', 'TR21'], ['TR10', 'TR42'],
  ['TR21', 'TR22'], ['TR21', 'TR42'],
  ['TR22', 'TR31'], ['TR22', 'TR33'], ['TR22', 'TR41'],
  ['TR31', 'TR32'], ['TR31', 'TR33'],
  ['TR32', 'TR33'], ['TR32', 'TR61'],
  ['TR33', 'TR41'], ['TR33', 'TR52'],
  ['TR41', 'TR42'], ['TR41', 'TR51'],
  ['TR42', 'TR81'], ['TR42', 'TR51'],
  ['TR51', 'TR52'], ['TR51', 'TR71'], ['TR51', 'TR81'],
  ['TR52', 'TR61'], ['TR52', 'TR71'],
  ['TR61', 'TR62'],
  ['TR62', 'TR63'], ['TR62', 'TR71'], ['TR62', 'TR72'],
  ['TR63', 'TRC1'], ['TR63', 'TRB1'],
  ['TR71', 'TR72'], ['TR71', 'TR81'], ['TR71', 'TR82'],
  ['TR72', 'TR83'], ['TR72', 'TRA1'], ['TR72', 'TRB1'],
  ['TR81', 'TR82'],
  ['TR82', 'TR83'],
  ['TR83', 'TR90'],
  ['TR90', 'TRA1'], ['TR90', 'TRB1'],
  ['TRA1', 'TRA2'], ['TRA1', 'TRB1'],
  ['TRA2', 'TRB2'],
  ['TRB1', 'TRB2'], ['TRB1', 'TRC1'], ['TRB1', 'TRC2'],
  ['TRB2', 'TRC2'],
  ['TRC1', 'TRC2'], ['TRC1', 'TRC3'],
  ['TRC2', 'TRC3'],
  // International borders
  ['TR10', 'EL51'], // Istanbul - E. Macedonia & Thrace (Greece)
  ['TR21', 'BG41'], // Tekirdağ - Sofia (Bulgaria)
];
dedupedAdj.push(...trAdj);

// Add Serbian adjacency (with new codes)
const rsAdj = [
  ['RS11', 'RS12'], ['RS11', 'RS21'], ['RS11', 'RS22'],
  ['RS12', 'RS21'],
  ['RS21', 'RS22'],
  // International: RS22 borders MK, XK, AL, BG
  ['RS22', 'MK00'], ['RS22', 'XK00'], ['RS22', 'BG31'],
  ['RS22', 'AL01'],
];
// Remove old RS international edges already in the dedupedAdj, then add new ones
const oldRSedges = dedupedAdj.filter(([a, b]) =>
  (/^RS/.test(a) && !/^RS/.test(b)) || (/^RS/.test(b) && !/^RS/.test(a))
);
// Remap existing international RS edges
for (const rsEdge of rsAdj) {
  const key = rsEdge.sort().join('-');
  if (!edgeSet.has(key)) {
    edgeSet.add(key);
    dedupedAdj.push(rsEdge);
  }
}

writeFileSync(adjPath, JSON.stringify(dedupedAdj, null, 2) + '\n');
console.log('Updated province-adjacency.json');

// ── Update country-starters.json ──
const csPath = 'src/data/country-starters.json';
const cs = JSON.parse(readFileSync(csPath, 'utf-8'));

// Turkey capital: TR01 (Ankara) → TR51
if (cs.turkey && cs.turkey.capital_province_id === 'TR01') {
  cs.turkey.capital_province_id = 'TR51';
}

// Serbia: RS01 → RS11
if (cs.serbia && cs.serbia.capital_province_id === 'RS01') {
  cs.serbia.capital_province_id = 'RS11';
}

// N. Macedonia
if (cs.north_macedonia) {
  cs.north_macedonia.capital_province_id = 'MK00';
}

// Montenegro
if (cs.montenegro && cs.montenegro.capital_province_id === 'ME01') {
  cs.montenegro.capital_province_id = 'ME00';
}

// Kosovo
if (cs.kosovo && cs.kosovo.capital_province_id === 'XK01') {
  cs.kosovo.capital_province_id = 'XK00';
}

writeFileSync(csPath, JSON.stringify(cs, null, 2) + '\n');
console.log('Updated country-starters.json');

// ── Verify alignment ──
const newCp = JSON.parse(readFileSync(cpPath, 'utf-8'));
const newPd = JSON.parse(readFileSync(pdPath, 'utf-8'));
let total = 0;
let pdMissing = [];
for (const [country, provs] of Object.entries(newCp)) {
  total += provs.length;
  for (const id of provs) {
    if (!newPd[id]) pdMissing.push(`${id} (${country})`);
  }
}
console.log(`\nTotal provinces: ${total}`);
if (pdMissing.length > 0) {
  console.log('Missing from province-data:');
  for (const m of pdMissing) console.log('  ' + m);
}

// Check TopoJSON coverage
const topo = JSON.parse(readFileSync('ui/public/data/nuts2-europe.json', 'utf-8'));
const topoObjKey = Object.keys(topo.objects)[0];
const topoIds = new Set(topo.objects[topoObjKey].geometries.map(g => g.properties.NUTS_ID));
let topoMissing = [];
for (const [country, provs] of Object.entries(newCp)) {
  for (const id of provs) {
    if (!topoIds.has(id)) topoMissing.push(`${id} (${country})`);
  }
}
console.log(`TopoJSON coverage: ${total - topoMissing.length}/${total}`);
if (topoMissing.length > 0) {
  console.log('Missing from TopoJSON:');
  for (const m of topoMissing) console.log('  ' + m);
}
