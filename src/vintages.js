/**
 * Staleness budgets for the bundled data snapshots (audit item 6). Nothing in this repository
 * refreshes automatically: every dataset below is a committed snapshot whose age is read from its
 * own committed manifest, never from a file timestamp, a clock, or a publication month written in
 * prose. A dataset whose manifest carries no machine-readable date is reported `unknown`, which is
 * its own status and never counts as `current`. Budgets are per dataset and follow each
 * publisher's release cadence: a monthly price series goes stale long before an annual grid vintage.
 *
 * DOM-free, IO-free and offline. Callers pass already-parsed manifests keyed by repository-relative
 * path (an object or a Map); `scripts/check-vintages.mjs` does the reading and printing.
 * All arithmetic is UTC, matching the ISO timestamps the manifests record.
 */

const TOKEN = /([^.[\]]+)(?:\[([^\]=~]+)([=~])([^\]]*)\])?/g;
const MONTH = /^(\d{4})-(\d{2})$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const YEAR = /^(\d{4})$/;
const DAY_MS = 86400000;

/** One entry per bundled dataset. `field` is a path into `manifest`; `*` maps over members and
 *  `[key=value]` / `[key~substring]` selects array members, so nothing is hardcoded here but paths. */
export const DATASETS = [
  {
    id: 'eia861m-prices',
    label: 'EIA-861M monthly prices',
    use: 'Hourly electricity cost: state-sector USD/kWh per local calendar month.',
    manifest: 'data/energy/coverage.json',
    field: 'pricesByState.*.*.lastPeriod',
    vintageMeans: 'last observed price month in the catalog, not the workbook download date',
    agingAfterMonths: 5,
    staleAfterMonths: 9,
    rationale: 'EIA publishes each month roughly two months in arrears: the retained workbook was last modified 2026-08-26 and ends at 2026-06, so three months of lag is the normal state and not a defect. By five months at least two published releases are missing; by nine the newest priced month predates a full cooling season, which is where a quoted cost figure starts to mislead.',
    refreshCommand: 'python scripts/build-energy.py --refresh',
    note: 'Unpriced hours already fail closed (null cost, explicit coverage fields), so an old series understates or overstates cost rather than silently inventing one.',
    remote: {manifest: 'data/energy/manifest.json', urlField: 'sources.eia861m.url', lastModifiedField: 'acquisition[file=sales_revenue.xlsx].lastModified'},
  },
  {
    id: 'oedi-utility-mapping',
    label: 'OpenEI ZIP utility mapping',
    use: 'Candidate electric providers for a ZIP (never verified premise service).',
    manifest: 'data/energy/manifest.json',
    field: 'sources.oedi2021.vintage',
    vintageMeans: 'mapping year of the source association tables',
    agingAfterMonths: 30,
    staleAfterMonths: 48,
    rationale: 'A ZIP-to-utility association snapshot for calendar 2021, published 2022-11. Ownership changes, municipal formations and territory transfers accumulate slowly, so a mapping two to three years past its year is still defensible under the existing "possible provider" caveat. Past four years the candidate list is stale enough that naming a provider from it is a claim the data cannot support.',
    refreshCommand: 'scripts/build-energy.py: new mapping year, then --refresh',
    note: 'Not refreshable by re-running the build: URLS and SOURCES in scripts/build-energy.py pin the 2021 filenames, so a newer published mapping year needs an explicit URL and schema update before --refresh.',
    remote: {manifest: 'data/energy/manifest.json', urlField: 'acquisition[file~zipcodes_2021.csv].url', lastModifiedField: 'acquisition[file~zipcodes_2021.csv].lastModified'},
  },
  {
    id: 'egrid-grid-mix',
    label: 'eGRID generation mix and CO2',
    use: 'Annual regional resource mix and CO2 total-output rate for hourly emissions.',
    manifest: 'data/energy/manifest.json',
    field: 'sources.egrid2023.vintage',
    vintageMeans: 'eGRID data year, not its 2025 publication or 2026 retrieval year',
    agingAfterMonths: 24,
    staleAfterMonths: 36,
    rationale: 'eGRID is annual and lands about 18 months after its data year (eGRID2023 was published 2025-06). One missing data year is therefore expected at all times. At 24 months a newer eGRID should exist; at 36 two newer data years exist and the factor lags the grid it describes through a period of fast generation-mix change.',
    refreshCommand: 'scripts/build-energy.py: new eGRID year, then --refresh',
    note: 'Hourly CO2 is already suppressed outside the record year, so an old eGRID narrows emissions coverage instead of misdating it. URLS and SOURCES pin the 2023 workbook; a new year needs an explicit URL and sheet-name update.',
    remote: {manifest: 'data/energy/manifest.json', urlField: 'acquisition[file~egrid].url', lastModifiedField: 'acquisition[file~egrid].lastModified'},
  },
  {
    id: 'epa-zip-subregions',
    label: 'EPA Power Profiler ZIP subregions',
    use: 'Candidate eGRID subregions for a ZIP (all alternatives retained).',
    manifest: 'data/energy/manifest.json',
    field: 'sources.epaZip2023.published',
    vintageMeans: 'publication month of the ZIP-to-subregion association tool',
    agingAfterMonths: 24,
    staleAfterMonths: 36,
    rationale: 'Subregion boundaries move only when EPA redraws them, so this tracks the eGRID cadence: aging once a newer eGRID cycle exists, stale once two do.',
    refreshCommand: 'scripts/build-energy.py: new ZIP tool version, then --refresh',
    note: 'The manifest records only prose ("eGRID2023_rev1 associations, published 2025-06"); there is no machine-readable date field, so the age is reported unknown rather than parsed out of a sentence. Add "published": "2025-06" to the epaZip2023 entry in SOURCES in scripts/build-energy.py to make this checkable.',
    remote: {manifest: 'data/energy/manifest.json', urlField: 'acquisition[file~power_profiler].url', lastModifiedField: 'acquisition[file~power_profiler].lastModified'},
  },
  {
    id: 'geonames-zip-inventory',
    label: 'GeoNames ZIP inventory',
    use: 'ZIP lookup, approximate coordinates and the join key for every energy catalog.',
    manifest: 'data/energy/manifest.json',
    field: 'acquisition[file~geonames-].retrievedAt',
    vintageMeans: 'retrieval date of the country archives; GeoNames publishes no data year',
    agingAfterMonths: 12,
    staleAfterMonths: 18,
    rationale: 'GeoNames rewrites its country files continuously, so this is a retrieval snapshot rather than a data year. New and retired ZIPs accumulate slowly and a missing ZIP fails closed (lookup returns null) instead of producing a wrong number, so a year is tolerable. Beyond 18 months recently activated ZIPs are absent often enough that the tool looks broken to a user in a new development.',
    refreshCommand: 'python scripts/build-energy.py --refresh',
    note: 'This snapshot is not a USPS-authoritative active-ZIP list at any age.',
    remote: {manifest: 'data/energy/manifest.json', urlField: 'acquisition[file~geonames-].url', lastModifiedField: 'acquisition[file~geonames-].lastModified'},
  },
  {
    id: 'tulsa-weather-years',
    label: 'Bundled Tulsa NASA POWER years',
    use: 'Offline example runs and the multi-year stability check.',
    manifest: 'data/weather/index.json',
    field: 'sites.*.years.*',
    vintageMeans: 'newest bundled calendar year of hourly weather',
    agingAfterMonths: 15,
    staleAfterMonths: 24,
    rationale: 'POWER hourly data lag real time by two to three months, so a completed calendar year becomes fetchable around March. Fifteen months after a bundled year ends a newer complete year exists and is not bundled; at 24 months the examples are missing two, and "recent climate" stops being true.',
    refreshCommand: 'python3 scripts/fetch-weather.py <year>',
    note: 'Also add the new year to sites[].years and sites[].files in data/weather/index.json, which is what the application discovers. index.json records no source URL, so --check-remote cannot probe upstream for this dataset; the per-year files carry their own POWER query.',
    remote: null,
  },
  {
    id: 'noaa-reference-daily',
    label: 'NOAA Tulsa daily cross-check',
    use: 'Independent daily extrema cross-check in the reference study.',
    manifest: 'data/reference/noaa-provenance.json',
    field: 'lastDate',
    vintageMeans: 'last observation day in the retained daily series',
    agingAfterMonths: 6,
    staleAfterMonths: 12,
    rationale: 'This is an observation series fetched year-to-date alongside the station snapshot it checks. Six months on, the cross-check covers a shrinking fraction of the observed record; past twelve it no longer overlaps the current year at all and the study reports a cross-check of a year nobody is running.',
    refreshCommand: 'node scripts/fetch-observed.mjs',
    note: 'The same command rewrites data/weather/ktul-2026.json, the observed station snapshot this series cross-checks.',
    remote: {manifest: 'data/reference/noaa-provenance.json', urlField: 'sourceUrl', lastModifiedField: null},
  },
];

/** Every manifest the assessment needs, including those only used by --check-remote. */
export const MANIFEST_PATHS = [...new Set(DATASETS.flatMap(d => [d.manifest, d.remote?.manifest].filter(Boolean)))];

/** Collect every value at `path`. `*` maps over members; `[key=v]` and `[key~substring]` filter array members. */
export function pluck(root, path) {
  let nodes = root === undefined || root === null ? [] : [root];
  for (const [, key, field, op, want] of String(path).matchAll(TOKEN)) {
    const next = [];
    for (const node of nodes) {
      if (node === null || typeof node !== 'object') continue;
      for (const value of key === '*' ? Object.values(node) : [node[key]]) {
        if (value === undefined) continue;
        if (!field) { next.push(value); continue; }
        if (value === null || typeof value !== 'object') continue;
        for (const item of Object.values(value)) {
          const got = item?.[field];
          if (typeof got === 'string' && (op === '=' ? got === want : got.includes(want))) next.push(item);
        }
      }
    }
    nodes = next;
  }
  return nodes;
}

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Normalize a manifest value to the end of the period it covers. Accepts a data year (2023 or
 * '2023'), a month ('2026-06'), or a date/ISO timestamp ('2026-09-11T21:11:17Z'). Anything else,
 * including prose containing a year, returns null: an unreadable vintage is unknown, never guessed.
 */
export function parseVintage(value) {
  const text = typeof value === 'number' ? (Number.isInteger(value) ? String(value) : '') : typeof value === 'string' ? value.trim() : '';
  let match = DAY.exec(text);
  if (match) {
    const [year, month, day] = [+match[1], +match[2], +match[3]];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
    return anchor('day', `${match[1]}-${match[2]}-${match[3]}`, year, month, day);
  }
  match = MONTH.exec(text);
  if (match) {
    const [year, month] = [+match[1], +match[2]];
    if (month < 1 || month > 12) return null;
    return anchor('month', text, year, month, daysInMonth(year, month));
  }
  match = YEAR.exec(text);
  if (match) {
    const year = +match[1];
    if (year < 1900 || year > 2199) return null;
    return anchor('year', text, year, 12, 31);
  }
  return null;
}

const anchor = (granularity, vintage, year, month, day) => ({granularity, vintage, year, month, day, endUTC: Date.UTC(year, month - 1, day)});

/**
 * Whole months and days of data age: how long ago the covered period ended. A partial month never
 * rounds up, so a series through 2026-06 is 2 months old on 2026-09-14 and 3 on 2026-09-30.
 */
export function vintageAge(parsed, now) {
  const clock = asDate(now);
  const [year, month, day] = [clock.getUTCFullYear(), clock.getUTCMonth() + 1, clock.getUTCDate()];
  const months = (year - parsed.year) * 12 + (month - parsed.month) - (day < parsed.day ? 1 : 0);
  return {ageMonths: months, ageDays: Math.floor((Date.UTC(year, month - 1, day) - parsed.endUTC) / DAY_MS)};
}

function asDate(now) {
  const clock = now instanceof Date ? now : new Date(now ?? Date.now());
  if (!Number.isFinite(clock.getTime())) throw new TypeError('A vintage assessment needs a valid Date, epoch or ISO clock.');
  return clock;
}

/** Unknown is its own status: an unreadable vintage is never treated as current. */
export const statusFor = (ageMonths, {agingAfterMonths, staleAfterMonths}) =>
  ageMonths === null ? 'unknown' : ageMonths >= staleAfterMonths ? 'stale' : ageMonths >= agingAfterMonths ? 'aging' : 'current';

/** Assess every bundled dataset against its own budget. `manifests`: object or Map of path -> parsed JSON. */
export function assessVintages(manifests, now) {
  const clock = asDate(now);
  const get = path => (manifests instanceof Map ? manifests.get(path) : manifests?.[path]);
  return DATASETS.map(dataset => {
    const manifest = get(dataset.manifest);
    const raw = manifest === undefined || manifest === null ? [] : pluck(manifest, dataset.field);
    const parsed = raw.map(parseVintage).filter(Boolean).sort((a, b) => b.endUTC - a.endUTC)[0] || null;
    const age = parsed ? vintageAge(parsed, clock) : {ageMonths: null, ageDays: null};
    const status = statusFor(age.ageMonths, dataset);
    const reasons = [];
    if (manifest === undefined || manifest === null) reasons.push(`${dataset.manifest} was not supplied or could not be read, so this vintage is unknown.`);
    else if (!raw.length) reasons.push(`${dataset.manifest} carries no ${dataset.field} value, so this vintage is unknown.`);
    else if (!parsed) reasons.push(`${dataset.manifest} records ${JSON.stringify(raw[0])} at ${dataset.field}, which is not a year, month or date.`);
    if (age.ageMonths !== null && age.ageMonths < 0) reasons.push('The recorded vintage is later than the clock; check the system date before trusting this row.');
    return {
      id: dataset.id, label: dataset.label, use: dataset.use, manifest: dataset.manifest, field: dataset.field,
      vintage: parsed?.vintage ?? null, granularity: parsed?.granularity ?? null, vintageMeans: dataset.vintageMeans,
      ageMonths: age.ageMonths, ageDays: age.ageDays, agingAfterMonths: dataset.agingAfterMonths, staleAfterMonths: dataset.staleAfterMonths,
      status, rationale: dataset.rationale, refreshCommand: dataset.refreshCommand,
      note: [...reasons, dataset.note].filter(Boolean).join(' '),
    };
  });
}

const SEVERITY = {current: 0, aging: 1, unknown: 2, stale: 3};

/**
 * Gate summary. Only `stale` sets a nonzero exit code; `unknown` is louder than `aging` because a
 * missing manifest date is a maintenance defect, but it is not evidence that the data went bad.
 */
export function summarizeVintages(assessments) {
  const counts = {current: 0, aging: 0, stale: 0, unknown: 0};
  for (const item of assessments) counts[item.status] += 1;
  const pick = status => assessments.filter(item => item.status === status).map(item => item.id);
  const worst = assessments.reduce((acc, item) => (SEVERITY[item.status] > SEVERITY[acc] ? item.status : acc), 'current');
  return {
    total: assessments.length, counts, worst, stale: pick('stale'), aging: pick('aging'), unknown: pick('unknown'),
    exitCode: counts.stale ? 1 : 0,
    headline: `${counts.current} current, ${counts.aging} aging, ${counts.stale} stale, ${counts.unknown} unknown`,
  };
}
