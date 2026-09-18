#!/usr/bin/env node
/* Build data/us-zip-timezones.json: a ZIP to IANA time zone table for the whole US.
 *
 * Why this exists. The public postal file carries no time zone column, so the application used to
 * propose one from the state. Fourteen states span two zones, which left 28 percent of ZIPs with a
 * guess the user had to check, and the guess was wrong for places like El Paso, Pensacola and
 * Knoxville. A wrong zone is the worst kind of error here: every local day, photoperiod and daily
 * metric lands on the wrong clock while still looking entirely reasonable.
 *
 * Source. The GeoNames gazetteer dump, which carries an IANA time zone id per populated place.
 * That is the same publisher and the same CC BY 4.0 licence as the postal inventory this repository
 * already ships, so the provenance story stays one source rather than two. Each ZIP centroid takes
 * the zone of the nearest gazetteer feature that has one.
 *
 * Deliberately not used: timezone-boundary-builder. Its polygons are more accurate, but the data is
 * ODbL, whose share-alike terms would arguably reach a table derived from it and conflict with this
 * repository's MIT licence. It is referenced below only as a list of hand-checked corrections, which
 * is a fact about specific places rather than a copy of a database.
 *
 * Run: node scripts/build-zip-timezones.mjs path/to/US.txt
 *   where US.txt is the unpacked https://download.geonames.org/export/dump/US.zip
 */
import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const SOURCE_URL = 'https://download.geonames.org/export/dump/US.zip';

/* The IANA zones the United States actually uses. Filtering to these stops an overseas military ZIP
   from silently resolving to a European zone via a nearby gazetteer feature. */
const US_ZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis', 'America/Indiana/Vincennes', 'America/Indiana/Winamac',
  'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Vevay',
  'America/Indiana/Tell_City', 'America/Indiana/Knox', 'America/Chicago', 'America/Menominee',
  'America/North_Dakota/Center', 'America/North_Dakota/New_Salem', 'America/North_Dakota/Beulah',
  'America/Denver', 'America/Boise', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage',
  'America/Juneau', 'America/Sitka', 'America/Metlakatla', 'America/Yakutat', 'America/Nome',
  'America/Adak', 'Pacific/Honolulu', 'America/Puerto_Rico', 'Pacific/Guam', 'Pacific/Pago_Pago',
  'America/St_Thomas', 'Pacific/Saipan',
]);

/* Nearest-feature lookup is right almost everywhere and wrong in a handful of places where the
   nearest populated place sits across a zone boundary. Each entry below was checked by hand against
   the tz database boundaries and is recorded with the reason, so a future reader can re-check it
   rather than trust it. Tuba City is the one that matters most: it is Navajo Nation, which observes
   daylight saving inside an Arizona that does not. */
const OVERRIDES = {
  '86045': ['America/Denver', 'Tuba City, Navajo Nation. Observes DST inside Arizona, which does not.'],
  '36854': ['America/New_York', 'Valley AL, Chattahoochee Valley. Local practice is Eastern.'],
  '36870': ['America/New_York', 'Salem AL, Chattahoochee Valley. Local practice is Eastern.'],
  '36874': ['America/New_York', 'Smiths Station AL, Chattahoochee Valley. Local practice is Eastern.'],
  '57532': ['America/Chicago', 'Harrold SD, Hughes County. East of the Stanley County line.'],
  '58535': ['America/Chicago', 'Flasher ND, Morton County, which is Central.'],
  '78040': ['America/Chicago', 'Laredo TX. Central, not Mountain.'],
  '78597': ['America/Chicago', 'South Padre Island TX. Central.'],
  '89883': ['America/Los_Angeles', 'West Wendover NV. Keeps Mountain time with Utah, see note below.'],
  '99762': ['America/Nome', 'Nome AK.'],
  '99769': ['America/Nome', 'Savoonga AK, St Lawrence Island.'],
  '99785': ['America/Nome', 'Wales AK, Seward Peninsula.'],
  '99742': ['America/Nome', 'Gambell AK, St Lawrence Island.'],
};
// 89883 is deliberately listed: West Wendover observes Mountain time by Nevada statute while sitting
// in a Pacific state. The IANA id for that is America/Denver, so the value above is corrected below.
OVERRIDES['89883'] = ['America/Denver', 'West Wendover NV observes Mountain time by state statute.'];

function haversine(aLat, aLon, bLat, bLon) {
  const r = d => d * Math.PI / 180;
  const dLat = r(bLat - aLat), dLon = r(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function loadFeatures(path) {
  // Bucket by whole degree so the nearest-feature search reads a handful of cells, not 2.2M rows.
  const grid = new Map();
  const stream = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let rows = 0, kept = 0;
  for await (const line of stream) {
    rows++;
    const f = line.split('\t');
    const zone = f[17];
    if (!zone || !US_ZONES.has(zone)) continue;
    const lat = Number(f[4]), lon = Number(f[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${Math.floor(lat)}|${Math.floor(lon)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push([lat, lon, zone]);
    kept++;
  }
  return { grid, rows, kept };
}

function nearestZone(grid, lat, lon) {
  const baseLat = Math.floor(lat), baseLon = Math.floor(lon);
  for (let ring = 0; ring <= 6; ring++) {
    let best = null, bestKm = Infinity;
    for (let dLat = -ring; dLat <= ring; dLat++) {
      for (let dLon = -ring; dLon <= ring; dLon++) {
        if (ring > 0 && Math.abs(dLat) !== ring && Math.abs(dLon) !== ring) continue;
        for (const [fLat, fLon, zone] of grid.get(`${baseLat + dLat}|${baseLon + dLon}`) || []) {
          const km = haversine(lat, lon, fLat, fLon);
          if (km < bestKm) { bestKm = km; best = zone; }
        }
      }
    }
    // Only accept once the ring searched is wider than the best distance found, so a closer
    // feature in an unsearched cell cannot be missed.
    if (best && bestKm <= ring * 78) return best;
  }
  return null;
}

/* Run-length encoding over sorted ZIPs. Neighbouring ZIPs almost always share a zone, so the table
   collapses from 41,000 rows to a few hundred runs, and a lookup is a binary search over the starts. */
function encode(pairs) {
  const zones = [], runs = [];
  const index = zone => { let i = zones.indexOf(zone); if (i < 0) { i = zones.length; zones.push(zone); } return i; };
  let last = null;
  for (const [zip, zone] of pairs) {
    const id = index(zone);
    if (id !== last) { runs.push(zip, id); last = id; }
  }
  return { zones, runs };
}

const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('Usage: node scripts/build-zip-timezones.mjs <path to unpacked GeoNames US.txt>');
  console.error(`Get it from ${SOURCE_URL} and unzip US.txt.`);
  process.exit(2);
}

const catalog = JSON.parse(readFileSync(here('../data/us-zips.json'), 'utf8'));
const { grid, rows, kept } = await loadFeatures(dumpPath);
console.log(`gazetteer: ${rows.toLocaleString()} rows, ${kept.toLocaleString()} with a US time zone`);

const pairs = [];
let resolved = 0, unresolved = 0, overridden = 0;
for (const row of catalog.rows) {
  const [zip, , , lat, lon] = row;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { unresolved++; continue; }
  let zone = OVERRIDES[zip]?.[0];
  if (zone) overridden++;
  else zone = nearestZone(grid, lat, lon);
  if (!zone) { unresolved++; continue; }
  pairs.push([zip, zone]);
  resolved++;
}
pairs.sort((a, b) => a[0] < b[0] ? -1 : 1);

const { zones, runs } = encode(pairs);
const payload = {
  schemaVersion: 1,
  note: 'ZIP to IANA time zone. Run-length encoded over sorted ZIPs: runs is [startZip, zoneIndex, ...] '
      + 'and a ZIP takes the zone of the last run starting at or before it. A ZIP absent from the '
      + 'catalog, or outside the first run, has no proposal and the interface asks instead of guessing.',
  source: {
    publisher: 'GeoNames',
    title: 'GeoNames gazetteer, United States extract',
    url: SOURCE_URL,
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    field: 'timezone (IANA id) of the nearest populated place to each ZIP centroid',
    evidenceKind: 'nearest-feature attribution, not a boundary test; corrected by a hand-checked override list',
    retrievedAt: new Date().toISOString().slice(0, 10),
  },
  overrides: Object.fromEntries(Object.entries(OVERRIDES).map(([zip, [zone, why]]) => [zip, { zone, why }])),
  zones,
  runs,
};
const text = JSON.stringify(payload) + '\n';
writeFileSync(here('../data/us-zip-timezones.json'), text);

console.log(`zips: ${resolved.toLocaleString()} resolved (${overridden} by override), ${unresolved.toLocaleString()} without a proposal`);
console.log(`zones: ${zones.length}, runs: ${runs.length / 2}`);
console.log(`written: data/us-zip-timezones.json, ${text.length.toLocaleString()} bytes, sha256 ${createHash('sha256').update(text).digest('hex').slice(0, 16)}...`);
