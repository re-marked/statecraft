// Sync game data JSON files from src/data/ to ui/lib/data/
// Run this after any change to the data files
import { copyFileSync, mkdirSync } from 'fs';

const files = ['country-provinces.json', 'province-data.json', 'country-starters.json'];
mkdirSync('ui/lib/data', { recursive: true });

for (const f of files) {
  copyFileSync(`src/data/${f}`, `ui/lib/data/${f}`);
  console.log(`Synced ${f}`);
}
