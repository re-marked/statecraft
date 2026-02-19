import { readFileSync } from 'fs';

const topo = JSON.parse(readFileSync('ui/public/data/nuts2-europe.json', 'utf-8'));
const objKey = Object.keys(topo.objects)[0];
const geoms = topo.objects[objKey].geometries;

// Find all NL, PT, NO, LV, EE codes in the TopoJSON
const prefixes = ['NL', 'PT', 'NO', 'LV', 'EE', 'IS'];
for (const prefix of prefixes) {
  const matches = geoms
    .filter(g => (g.properties?.NUTS_ID || '').startsWith(prefix))
    .map(g => g.properties?.NUTS_ID + ' - ' + (g.properties?.NUTS_NAME || g.properties?.NAME_LATN || ''));
  console.log(prefix + ':');
  for (const m of matches) console.log('  ' + m);
  console.log('');
}
