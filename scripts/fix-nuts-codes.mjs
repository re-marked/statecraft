// Fix province codes to match 2024 NUTS2 classification
import { readFileSync, writeFileSync } from 'fs';

const RENAMES = {
  'NL33': 'NL36',  // Zuid-Holland
  'NL31': 'NL35',  // Utrecht
  'PT17': 'PT1A',  // Lisboa
  'PT16': 'PT19',  // Centro
  'PT18': 'PT1C',  // Alentejo
};

const REMOVES = new Set(['NO01', 'LV01', 'EE01']);

function rename(id) {
  return RENAMES[id] || id;
}

// 1. Fix country-provinces.json
const cpPath = 'src/data/country-provinces.json';
const cp = JSON.parse(readFileSync(cpPath, 'utf-8'));
for (const [country, provs] of Object.entries(cp)) {
  cp[country] = provs.filter(id => !REMOVES.has(id)).map(rename);
}
writeFileSync(cpPath, JSON.stringify(cp, null, 2) + '\n');
console.log('Fixed country-provinces.json');

// 2. Fix province-data.json
const pdPath = 'src/data/province-data.json';
const pd = JSON.parse(readFileSync(pdPath, 'utf-8'));
const newPd = {};
for (const [id, data] of Object.entries(pd)) {
  if (REMOVES.has(id)) {
    console.log('  Removed province-data:', id);
    continue;
  }
  const newId = rename(id);
  if (newId !== id) console.log('  Renamed province-data:', id, '->', newId);
  newPd[newId] = data;
}
writeFileSync(pdPath, JSON.stringify(newPd, null, 2) + '\n');
console.log('Fixed province-data.json');

// 3. Fix province-adjacency.json
const adjPath = 'src/data/province-adjacency.json';
const adj = JSON.parse(readFileSync(adjPath, 'utf-8'));
const newAdj = [];
for (const [a, b] of adj) {
  if (REMOVES.has(a) || REMOVES.has(b)) {
    console.log('  Removed adjacency:', a, '-', b);
    continue;
  }
  newAdj.push([rename(a), rename(b)]);
}
writeFileSync(adjPath, JSON.stringify(newAdj, null, 2) + '\n');
console.log('Fixed province-adjacency.json');

// 4. Fix country-starters.json
const csPath = 'src/data/country-starters.json';
const cs = JSON.parse(readFileSync(csPath, 'utf-8'));
for (const [country, data] of Object.entries(cs)) {
  if (data.capital_province_id) {
    const newCap = rename(data.capital_province_id);
    if (newCap !== data.capital_province_id) {
      console.log('  Renamed capital:', data.capital_province_id, '->', newCap);
      cs[country].capital_province_id = newCap;
    }
  }
}
writeFileSync(csPath, JSON.stringify(cs, null, 2) + '\n');
console.log('Fixed country-starters.json');

// Verify counts
const newCp = JSON.parse(readFileSync(cpPath, 'utf-8'));
let total = 0;
for (const provs of Object.values(newCp)) total += provs.length;
console.log('\nTotal provinces after fix:', total);
