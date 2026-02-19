// Merge all map data into a single TopoJSON file
// Sources:
//   1. Eurostat 2024 NUTS2 TopoJSON (EU/EFTA + candidates)
//   2. Eurostat 2021 NUTS2 GeoJSON (UK regions)
//   3. GADM admin-1 GeoJSON (Russia, Ukraine, Belarus, Moldova, Andorra)

import { readFileSync, writeFileSync } from 'fs';
import * as topojsonServer from 'topojson-server';
import * as topojsonClient from 'topojson-client';
// topojson-simplify removed - causes arc ref errors with mixed sources

// ── 1. Load Eurostat 2024 TopoJSON and extract features ──
const eurostat2024 = JSON.parse(readFileSync('ui/public/data/nuts2-europe.json', 'utf-8'));
const objKey = Object.keys(eurostat2024.objects)[0];
const eurostat2024Geoms = eurostat2024.objects[objKey].geometries;

// Convert to GeoJSON features
const eurostat2024FC = topojsonClient.feature(eurostat2024, eurostat2024.objects[objKey]);
const features = [...eurostat2024FC.features];
console.log(`Eurostat 2024: ${features.length} features`);

// ── 2. Load Eurostat 2021 GeoJSON and extract UK ──
const eurostat2021 = JSON.parse(readFileSync('scripts/gadm/eurostat_2021_nuts2.json', 'utf-8'));
const ukFeatures2021 = eurostat2021.features.filter(f => (f.properties.NUTS_ID || '').startsWith('UK'));
console.log(`Eurostat 2021 UK: ${ukFeatures2021.length} features`);

// Game UK codes that map directly to Eurostat 2021
const GAME_UK_DIRECT = [
  'UKC1', 'UKD3', 'UKD6', 'UKD7', 'UKE1', 'UKE4',
  'UKF1', 'UKF2', 'UKG1', 'UKG3', 'UKH1', 'UKJ1',
  'UKJ3', 'UKK1', 'UKK2', 'UKL1', 'UKL2', 'UKM5', 'UKN0'
];

// Add direct UK features
for (const code of GAME_UK_DIRECT) {
  const f = ukFeatures2021.find(f => f.properties.NUTS_ID === code);
  if (f) {
    features.push({
      type: 'Feature',
      properties: { NUTS_ID: code, NUTS_NAME: f.properties.NUTS_NAME || f.properties.NAME_LATN || code },
      geometry: f.geometry
    });
  } else {
    console.warn(`  WARNING: UK code ${code} not found in Eurostat 2021`);
  }
}

// UKI1 (Inner London) = merge UKI3 + UKI4
// UKI2 (Outer London) = merge UKI5 + UKI6 + UKI7
const londonMerges = [
  { code: 'UKI1', name: 'Inner London', sources: ['UKI3', 'UKI4'] },
  { code: 'UKI2', name: 'Outer London', sources: ['UKI5', 'UKI6', 'UKI7'] },
];

for (const merge of londonMerges) {
  const sourceFeatures = merge.sources
    .map(code => ukFeatures2021.find(f => f.properties.NUTS_ID === code))
    .filter(Boolean);

  if (sourceFeatures.length === 0) {
    console.warn(`  WARNING: No features found for ${merge.code} merge`);
    continue;
  }

  // Create temp topology to dissolve
  const tempFC = { type: 'FeatureCollection', features: sourceFeatures };
  const tempTopo = topojsonServer.topology({ regions: tempFC });
  const merged = topojsonClient.merge(tempTopo, tempTopo.objects.regions.geometries);

  features.push({
    type: 'Feature',
    properties: { NUTS_ID: merge.code, NUTS_NAME: merge.name },
    geometry: merged
  });
  console.log(`  Merged ${merge.sources.join('+')} → ${merge.code}`);
}

// Also add remaining UK features not in game (for map completeness)
const usedUKCodes = new Set([...GAME_UK_DIRECT, 'UKI3', 'UKI4', 'UKI5', 'UKI6', 'UKI7']);
for (const f of ukFeatures2021) {
  const code = f.properties.NUTS_ID;
  if (!usedUKCodes.has(code)) {
    features.push({
      type: 'Feature',
      properties: { NUTS_ID: code, NUTS_NAME: f.properties.NUTS_NAME || f.properties.NAME_LATN || code },
      geometry: f.geometry
    });
  }
}
console.log(`Total after UK: ${features.length} features`);

// ── 3. GADM countries ──

function loadGADM(file) {
  return JSON.parse(readFileSync(`scripts/gadm/${file}`, 'utf-8'));
}

function dissolveGADM(gadmData, nameKey, mapping) {
  // mapping: { gameCode: [gadmName, ...], ... }
  const results = [];
  const allMapped = new Set();

  for (const [gameCode, gadmNames] of Object.entries(mapping)) {
    const matchFeatures = gadmData.features.filter(f => gadmNames.includes(f.properties[nameKey]));
    if (matchFeatures.length === 0) {
      console.warn(`  WARNING: No GADM features for ${gameCode}: ${gadmNames.join(', ')}`);
      continue;
    }

    for (const n of gadmNames) allMapped.add(n);

    if (matchFeatures.length === 1) {
      results.push({
        type: 'Feature',
        properties: { NUTS_ID: gameCode, NUTS_NAME: gadmNames[0] },
        geometry: matchFeatures[0].geometry
      });
    } else {
      // Dissolve multiple features
      const tempFC = { type: 'FeatureCollection', features: matchFeatures };
      const tempTopo = topojsonServer.topology({ regions: tempFC });
      const merged = topojsonClient.merge(tempTopo, tempTopo.objects.regions.geometries);
      results.push({
        type: 'Feature',
        properties: { NUTS_ID: gameCode, NUTS_NAME: gameCode },
        geometry: merged
      });
    }
  }

  // Add unmapped features with auto-generated codes (for map completeness)
  const countryPrefix = Object.keys(mapping)[0].substring(0, 2);
  let autoIdx = 50;
  for (const f of gadmData.features) {
    if (!allMapped.has(f.properties[nameKey])) {
      const code = `${countryPrefix}${String(autoIdx).padStart(2, '0')}`;
      autoIdx++;
      results.push({
        type: 'Feature',
        properties: { NUTS_ID: code, NUTS_NAME: f.properties[nameKey] || code },
        geometry: f.geometry
      });
    }
  }

  return results;
}

// ── Russia (83 GADM → 20 game provinces + extras) ──
const rusData = loadGADM('RUS_1.json');
const rusMapping = {
  'RU01': ['MoscowCity'],
  'RU02': ['CityofSt.Petersburg'],
  'RU03': ['Moskva', 'Vladimir', "Ryazan'", 'Tula', 'Kaluga', 'Smolensk', "Tver'", "Yaroslavl'", 'Kostroma', 'Ivanovo', 'Orel', 'Bryansk', 'Lipetsk', 'Tambov'],
  'RU04': ['Leningrad', 'Novgorod', 'Pskov', 'Vologda', 'Karelia'],
  'RU05': ['Krasnodar', 'Adygey', "Stavropol'", 'Karachay-Cherkess', 'Kabardin-Balkar', 'NorthOssetia', 'Ingush', 'Chechnya', 'Dagestan', 'Kalmyk'],
  'RU06': ['Nizhegorod', 'Chuvash', 'Mariy-El', 'Mordovia'],
  'RU07': ['Sverdlovsk', 'Kurgan', "Tyumen'", 'Khanty-Mansiy', 'Yamal-Nenets'],
  'RU08': ['Rostov', 'Voronezh', 'Belgorod', 'Kursk'],
  'RU09': ['Tatarstan', 'Udmurt'],
  'RU10': ['Chelyabinsk', 'Orenburg'],
  'RU11': ['Samara', "Ul'yanovsk", 'Penza', 'Saratov'],
  'RU12': ['Novosibirsk', 'Omsk', 'Tomsk', 'Kemerovo', 'Altay', 'Gorno-Altay', 'Khakass'],
  'RU13': ['Volgograd', "Astrakhan'"],
  'RU14': ['Kaliningrad'],
  'RU15': ['Murmansk', "Arkhangel'sk", 'Komi', 'Nenets'],
  'RU16': ['Bashkortostan'],
  'RU17': ["Perm'", 'Kirov'],
  'RU18': ['Krasnoyarsk', 'Tuva', 'Sakha', 'Magadan', 'Chukot'],
  'RU19': ['Irkutsk', 'Buryat', "Zabaykal'ye"],
  'RU20': ["Primor'ye", 'Khabarovsk', 'Amur', 'Sakhalin', 'Yevrey', 'Kamchatka'],
};

console.log('\nRussia:');
const rusFeatures = dissolveGADM(rusData, 'NAME_1', rusMapping);
features.push(...rusFeatures);
console.log(`  Added ${rusFeatures.length} features (${Object.keys(rusMapping).length} game provinces)`);

// ── Ukraine (28 GADM → 8 game provinces + extras) ──
const ukrData = loadGADM('UKR_1.json');
const ukrMapping = {
  'UA01': ['KievCity', 'Kiev', 'Chernihiv', 'Zhytomyr', 'Cherkasy'],
  'UA02': ['Kharkiv', 'Sumy'],
  'UA03': ["Dnipropetrovs'k", 'Kirovohrad'],
  'UA04': ['Odessa', 'Mykolayiv', 'Kherson'],
  'UA05': ["L'viv", 'Volyn', 'Rivne', "Ternopil'", "Ivano-Frankivs'k", 'Zakarpattia', 'Chernivtsi'],
  'UA06': ['Zaporizhia', 'Crimea', "Sevastopol'"],
  'UA07': ["Donets'k", "Luhans'k"],
  'UA08': ['Poltava', 'Vinnytsya', "Khmel'nyts'kyy"],
};

console.log('\nUkraine:');
const ukrFeatures = dissolveGADM(ukrData, 'NAME_1', ukrMapping);
features.push(...ukrFeatures);
console.log(`  Added ${ukrFeatures.length} features (${Object.keys(ukrMapping).length} game provinces)`);

// ── Belarus (7 GADM → 3 game provinces) ──
const blrData = loadGADM('BLR_1.json');
// GADM has two "Minsk" entries (city + oblast) - handle by index
const blrMapping = {
  'BY01': ['Minsk', 'Grodno'],  // Central + NW (both Minsk entries get included)
  'BY02': ['Brest', 'Vitebsk'],  // West + North
  'BY03': ['Gomel', 'Mogilev'],  // South + East
};

console.log('\nBelarus:');
const blrFeatures = dissolveGADM(blrData, 'NAME_1', blrMapping);
features.push(...blrFeatures);
console.log(`  Added ${blrFeatures.length} features (${Object.keys(blrMapping).length} game provinces)`);

// ── Moldova (37 GADM → 2 game provinces) ──
const mdaData = loadGADM('MDA_1.json');
// MD01 = Chisinau metro area, MD02 = rest
const mdaCentral = ['Chişinău', 'AneniiNoi', 'Ialoveni', 'Străşeni', 'Criuleni', 'Orhei'];
const mdaRest = mdaData.features
  .map(f => f.properties.NAME_1)
  .filter(n => !mdaCentral.includes(n));
const mdaMapping = {
  'MD01': mdaCentral,
  'MD02': mdaRest,
};

console.log('\nMoldova:');
const mdaFeatures = dissolveGADM(mdaData, 'NAME_1', mdaMapping);
features.push(...mdaFeatures);
console.log(`  Added ${mdaFeatures.length} features (${Object.keys(mdaMapping).length} game provinces)`);

// ── Andorra (1 GADM → 1 game province) ──
const andData = loadGADM('AND_0.json');
for (const f of andData.features) {
  features.push({
    type: 'Feature',
    properties: { NUTS_ID: 'AD01', NUTS_NAME: 'Andorra' },
    geometry: f.geometry
  });
}
console.log('\nAndorra: Added 1 feature');

// ── 4. Build final TopoJSON ──
console.log(`\nTotal features: ${features.length}`);

const finalFC = { type: 'FeatureCollection', features };
const finalTopo = topojsonServer.topology({ provinces: finalFC }, 1e5);

// Verify
const finalGeoms = finalTopo.objects.provinces.geometries;
console.log(`Final TopoJSON: ${finalGeoms.length} geometries`);

// Count unique NUTS_IDs
const ids = new Set(finalGeoms.map(g => g.properties.NUTS_ID));
console.log(`Unique NUTS_IDs: ${ids.size}`);

// Check against game data
const cp = JSON.parse(readFileSync('src/data/country-provinces.json', 'utf-8'));
let gameTotal = 0;
let matched = 0;
for (const provs of Object.values(cp)) {
  for (const id of provs) {
    gameTotal++;
    if (ids.has(id)) matched++;
  }
}
console.log(`Game provinces matched: ${matched}/${gameTotal}`);

// Show unmatched
const unmatched = [];
for (const [country, provs] of Object.entries(cp)) {
  for (const id of provs) {
    if (!ids.has(id)) unmatched.push(`${id} (${country})`);
  }
}
if (unmatched.length > 0) {
  console.log('Unmatched game provinces:');
  for (const u of unmatched) console.log('  ' + u);
}

writeFileSync('ui/public/data/nuts2-europe.json', JSON.stringify(finalTopo));
console.log('\nWrote ui/public/data/nuts2-europe.json');
