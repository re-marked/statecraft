// ============================================================
// Build Script: Pre-compute SVG paths + centroids from TopoJSON
// Converts 2.4MB TopoJSON → ~200KB JSON for thin client rendering
// Run: node scripts/build-map-paths.mjs
// ============================================================

import { readFileSync, writeFileSync } from 'fs';
import { feature } from 'topojson-client';

// ---- Projection (matches WorldMap.tsx exactly) ----
const MAP_W = 960, MAP_H = 680;
const LON_MIN = -25, LON_MAX = 50, LAT_MIN = 34, LAT_MAX = 72;
const Y_MIN = Math.log(Math.tan(Math.PI / 4 + (LAT_MIN * Math.PI) / 360));
const Y_MAX = Math.log(Math.tan(Math.PI / 4 + (LAT_MAX * Math.PI) / 360));

function project(lon, lat) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W;
  const mercN = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y = ((Y_MAX - mercN) / (Y_MAX - Y_MIN)) * MAP_H;
  return [x, y];
}

function clamp(lon, lat) {
  return [
    Math.max(LON_MIN - 15, Math.min(LON_MAX + 20, lon)),
    Math.max(LAT_MIN - 10, Math.min(LAT_MAX + 10, lat)),
  ];
}

function projectPt(lon, lat) {
  const [cl, ca] = clamp(lon, lat);
  const [x, y] = project(cl, ca);
  return `${Math.round(x)},${Math.round(y)}`;
}

function isInEurope(ring) {
  let count = 0;
  for (const [lon, lat] of ring) {
    if (lon >= LON_MIN - 10 && lon <= LON_MAX + 15 && lat >= LAT_MIN - 5 && lat <= LAT_MAX + 5) {
      count++;
      if (count >= 3) return true;
    }
  }
  return false;
}

// Douglas-Peucker line simplification (reduces point count ~60%)
function simplifyRing(coords, tolerance) {
  if (coords.length <= 4) return coords;
  let maxDist = 0, maxIdx = 0;
  const [sx, sy] = coords[0], [ex, ey] = coords[coords.length - 1];
  const dx = ex - sx, dy = ey - sy;
  const lenSq = dx * dx + dy * dy;
  for (let i = 1; i < coords.length - 1; i++) {
    const [px, py] = coords[i];
    let dist;
    if (lenSq === 0) {
      dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
    } else {
      const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lenSq));
      dist = Math.sqrt((px - sx - t * dx) ** 2 + (py - sy - t * dy) ** 2);
    }
    if (dist > maxDist) { maxDist = dist; maxIdx = i; }
  }
  if (maxDist > tolerance) {
    const left = simplifyRing(coords.slice(0, maxIdx + 1), tolerance);
    const right = simplifyRing(coords.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [coords[0], coords[coords.length - 1]];
}

function geoToSvgPath(geometry) {
  const rings = [];
  function addRing(coords) {
    if (coords.length < 3 || !isInEurope(coords)) return;
    // Simplify with ~0.02 degree tolerance (sub-pixel at our projection scale)
    const simplified = simplifyRing(coords, 0.02);
    if (simplified.length < 3) return;
    const pts = simplified.map(([lon, lat]) => projectPt(lon, lat));
    rings.push('M' + pts.join('L') + 'Z');
  }
  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => addRing(ring));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly) => poly.forEach((ring) => addRing(ring)));
  }
  return rings.join('');
}

function computeCentroid(geometry) {
  let sx = 0, sy = 0, n = 0;
  function add(coords) {
    for (const [lon, lat] of coords) {
      if (lon < LON_MIN - 5 || lon > LON_MAX + 5) continue;
      if (lat < LAT_MIN - 2 || lat > LAT_MAX + 2) continue;
      const [x, y] = project(lon, lat);
      sx += x; sy += y; n++;
    }
  }
  if (geometry.type === 'Polygon') {
    add(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    let best = null, bestLen = 0;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      const inB = ring.filter(([lon, lat]) =>
        lon >= LON_MIN - 5 && lon <= LON_MAX + 5 && lat >= LAT_MIN - 2 && lat <= LAT_MAX + 2
      );
      if (inB.length > bestLen) { best = ring; bestLen = inB.length; }
    }
    if (best) add(best);
  }
  return n > 0 ? { x: Math.round(sx / n), y: Math.round(sy / n) } : null;
}

// ---- Main ----
const inputPath = 'ui/public/data/nuts2-europe.json';
const outputPath = 'ui/public/data/map-paths.json';

console.log(`Reading ${inputPath}...`);
const topo = JSON.parse(readFileSync(inputPath, 'utf-8'));
const objectKey = Object.keys(topo.objects)[0];
const geojson = feature(topo, topo.objects[objectKey]);

const shapes = [];
for (const feat of geojson.features) {
  const nuts2Id = feat.properties?.NUTS_ID ?? feat.properties?.id ?? feat.id ?? '';
  if (!nuts2Id) continue;

  const pathD = geoToSvgPath(feat.geometry);
  if (!pathD) continue;

  const centroid = computeCentroid(feat.geometry);
  shapes.push({ id: nuts2Id, d: pathD, c: centroid });
}

const output = JSON.stringify(shapes);
writeFileSync(outputPath, output);

const inputSize = readFileSync(inputPath).length;
const outputSize = output.length;
console.log(`\nDone!`);
console.log(`  Input:  ${(inputSize / 1024).toFixed(0)}KB (${inputPath})`);
console.log(`  Output: ${(outputSize / 1024).toFixed(0)}KB (${outputPath})`);
console.log(`  Shapes: ${shapes.length} provinces`);
console.log(`  Reduction: ${((1 - outputSize / inputSize) * 100).toFixed(0)}%`);
