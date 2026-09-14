/* Public weather adapters. No credentials, synthetic weather, or station/reanalysis substitution.
 * CSV import: time,tempC,dewPointC,rh,pressurePa,ghiWm2,windMs
 * time is ISO 8601 UTC ending Z, temperatures C, rh fraction [0,1], pressure Pa,
 * solar W/m2, wind m/s. Supply dewPointC or rh; blank cells are missing, never zero.
 * Canonical JSON uses schemaVersion 1 and UNITS below; raw/provenance are retained.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;
const POWER = 'https://power.larc.nasa.gov/api/temporal/hourly/point';
const IEM = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py';
const UNITS = Object.freeze({ time: 'UTC epoch milliseconds', tempC: 'C', dewPointC: 'C', rh: 'fraction', pressurePa: 'Pa', ghiWm2: 'W/m2', windMs: 'm/s' });
const PARAMETERS = { T2M: ['tempC', 'C', 1], RH2M: ['rh', '%', .01], PS: ['pressurePa', 'kPa', 1000], ALLSKY_SFC_SW_DWN: ['ghiWm2', 'Wh/m^2', 1], T2MDEW: ['dewPointC', 'C', 1], WS2M: ['windMs', 'm/s', 1] };
const GRID_NOTE = 'Requested coordinates are not a station. Source-native grids: MERRA-2 meteorology 0.5° latitude × 0.625° longitude; SYN1deg solar 1° × 1°. Returned point geometry is not a grid-cell-center assertion. Source elevation is not measured site elevation.';

function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Dates must use YYYY-MM-DD.');
  const stamp = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date: ' + value);
  return stamp;
}
function dateString(stamp) { return new Date(stamp).toISOString().slice(0, 10); }
function localMidnight(date, timezone) {
  const target = dateValue(date);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const wallTime = stamp => {
    const p = Object.fromEntries(formatter.formatToParts(stamp).map(part => [part.type, part.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  const candidates = new Set();
  for (const delta of [-2 * DAY, -DAY, 0, DAY, 2 * DAY]) {
    const sample = target + delta;
    const candidate = target - (wallTime(sample) - sample);
    if (wallTime(candidate) === target) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error('Local midnight does not exist for ' + date + ' in ' + timezone + '. Choose an unambiguous date boundary.');
  return Math.min(...candidates); // Earliest midnight if a zone repeats it.
}
function range(options) {
  const { startDate, endDate, timezone = 'America/Chicago' } = options;
  const start = localMidnight(startDate, timezone);
  const end = localMidnight(dateString(dateValue(endDate) + DAY), timezone);
  if (end <= start) throw new Error('End date must be on or after start date.');
  if (end - start > 30 * 366 * DAY) throw new Error('Request at most 30 years at a time.');
  return { start, end, timezone, startDate, endDate };
}
function coordinates(options) {
  const { latitude, longitude } = options;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw new Error('A valid numeric latitude and longitude are required.');
  return { latitude, longitude };
}
function emptyHour(time) { return { time, tempC: null, dewPointC: null, rh: null, pressurePa: null, ghiWm2: null, windMs: null, quality: [] }; }
function markMissing(hour) {
  const flags = new Set(hour.quality || []);
  for (const key of ['tempC', 'rh', 'pressurePa', 'ghiWm2']) {
    flags.delete('missing-' + key);
    if (hour[key] == null) flags.add('missing-' + key);
  }
  hour.quality = [...flags];
  return hour;
}
function completeGrid(records, start, end) {
  const hours = [];
  for (let time = Math.ceil(start / HOUR) * HOUR; time < end; time += HOUR) hours.push(markMissing(records.get(time) || emptyHour(time)));
  return hours;
}
function coverage(hours, bounds) {
  const weather = hours.filter(h => ['tempC', 'rh', 'pressurePa'].every(key => h[key] != null));
  const solar = hours.filter(h => h.ghiWm2 != null);
  return { expectedHours: hours.length, weatherHours: weather.length, solarHours: solar.length,
    startUTC: new Date(bounds.start).toISOString(), endExclusiveUTC: new Date(bounds.end).toISOString(),
    actualWeatherCutoffUTC: weather.length ? new Date(weather.at(-1).time).toISOString() : null,
    actualSolarCutoffUTC: solar.length ? new Date(solar.at(-1).time).toISOString() : null,
    incompleteTrailingHours: weather.length ? hours.filter(h => h.time > weather.at(-1).time).length : hours.length };
}
async function request(url, signal, json = true) {
  const response = await fetch(url, { signal });
  const text = await response.text();
  if (!response.ok) throw new Error('Weather source HTTP ' + response.status + ': ' + text.slice(0, 400));
  let payload = text;
  if (json) {
    try { payload = JSON.parse(text); } catch { throw new Error('Weather source did not return JSON: ' + text.slice(0, 200)); }
  }
  let sha256 = null;
  if (globalThis.crypto?.subtle) sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
  return { url, retrievedAt: new Date().toISOString(), sha256, payload, text: json ? text : undefined };
}
async function powerData(options, names = Object.keys(PARAMETERS)) {
  const bounds = range(options);
  const coords = coordinates(options);
  if (dateValue(bounds.startDate) < dateValue('2001-01-01')) throw new Error('NASA POWER hourly data begins in 2001.');
  const records = new Map(), raw = [], sourceUrls = [];
  let cursor = Math.max(dateValue('2001-01-01'), Math.floor(bounds.start / DAY) * DAY - DAY);
  const last = Math.min(Math.floor(bounds.end / DAY) * DAY, Math.floor(Date.now() / DAY) * DAY);
  const chunks = [];
  while (cursor <= last) {
    const year = new Date(cursor).getUTCFullYear();
    const stop = Math.min(last, Date.UTC(year, 11, 31));
    chunks.push([cursor, stop]);
    cursor = stop + DAY;
  }
  for (const [index, [first, lastDay]] of chunks.entries()) {
    options.signal?.throwIfAborted();
    options.onProgress?.(index / chunks.length, 'NASA POWER UTC source chunk ' + (index + 1) + '/' + chunks.length);
    const params = new URLSearchParams({ parameters: names.join(','), community: 'RE', latitude: String(coords.latitude), longitude: String(coords.longitude), start: dateString(first).replaceAll('-', ''), end: dateString(lastDay).replaceAll('-', ''), format: 'JSON', 'time-standard': 'UTC' });
    const item = await request(POWER + '?' + params, options.signal);
    const data = item.payload;
    if (!data.properties?.parameter || data.messages?.length) throw new Error('NASA POWER API: ' + JSON.stringify(data.messages || data));
    if (data.header?.time_standard !== 'UTC') throw new Error('NASA POWER returned a non-UTC time standard.');
    for (const name of names) {
      const [field, unit, factor] = PARAMETERS[name];
      if (data.parameters?.[name]?.units !== unit || !data.properties.parameter[name]) throw new Error('NASA POWER missing parameter or unexpected units: ' + name);
      for (const [key, value] of Object.entries(data.properties.parameter[name])) {
        if (!/^\d{10}$/.test(key)) throw new Error('Invalid NASA POWER hourly key: ' + key);
        const time = Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8), +key.slice(8, 10));
        if (time < bounds.start || time >= bounds.end) continue;
        if (!records.has(time)) records.set(time, emptyHour(time));
        if (value != null && value !== data.header.fill_value && !Number.isFinite(value)) throw new Error('Invalid NASA POWER numeric value for ' + name);
        records.get(time)[field] = value == null || value === data.header.fill_value ? null : value * factor;
      }
    }
    raw.push(item);
    sourceUrls.push(item.url);
  }
  const hours = completeGrid(records, bounds.start, bounds.end);
  options.onProgress?.(1, 'NASA POWER source received');
  return { schemaVersion: 1, source: 'NASA POWER', sourceKind: 'gridded reanalysis + satellite solar', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate,
    retrievedAt: new Date().toISOString(), sourceUrl: sourceUrls[0] || null, sourceUrls, units: { ...UNITS },
    interval: 'UTC hour start; hourly mean meteorology; Wh/m² over one hour divided by 1 hour = W/m². Only UTC hour starts inside local date bounds are included.',
    sourceVersions: raw.map(item => item.payload.header), coordinateNotes: GRID_NOTE,
    coverage: coverage(hours, bounds), raw, hours };
}

export async function fetchWeather(options) {
  if (options.provider === 'iem') return fetchObserved(options);
  if (options.provider && options.provider !== 'nasa') throw new Error('Unknown weather provider: ' + options.provider);
  return powerData(options);
}

function parseCSV(text) {
  const rows = [], row = [];
  let value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n' || c === undefined)) {
      row.push(value.replace(/\r$/, '').trim()); value = '';
      if (c !== ',') { if (row.some(cell => cell !== '')) rows.push([...row]); row.length = 0; }
    } else value += c;
  }
  if (quoted) throw new Error('Unclosed quoted CSV cell.');
  if (!rows.length) throw new Error('CSV contains no rows.');
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  return { headers, rows: rows.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error('CSV row ' + (index + 2) + ' has an inconsistent number of cells.');
    return Object.fromEntries(headers.map((key, i) => [key, cells[i]]));
  }) };
}
function finiteCell(value, name) {
  if (value == null || value === '' || value === 'M' || value === 'null') return null;
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) throw new Error('Invalid numeric ' + name + ': ' + value);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Invalid numeric ' + name + ': ' + value);
  return number;
}
function saturation(tempC) { return 610.94 * Math.exp(17.625 * tempC / (243.04 + tempC)); }
function normalizeHour(input) {
  let time = input.time;
  if (typeof time === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/.test(time)) throw new Error('Weather timestamps must be explicit UTC ISO 8601 ending Z.');
    dateValue(time.slice(0, 10));
    time = Date.parse(time);
  }
  if (!Number.isSafeInteger(time) || time % HOUR !== 0) throw new Error('Weather time must be a valid UTC hour start.');
  const hour = { ...input, time, quality: Array.isArray(input.quality) ? [...input.quality] : [] };
  const limits = { tempC: [-100, 70], dewPointC: [-110, 70], rh: [0, 1], pressurePa: [20000, 120000], ghiWm2: [0, 1600], windMs: [0, 150] };
  for (const [key, [min, max]] of Object.entries(limits)) {
    hour[key] = finiteCell(input[key], key);
    if (hour[key] != null && (hour[key] < min || hour[key] > max)) throw new Error('Out-of-range ' + key + ' at ' + new Date(time).toISOString() + '. Check units.');
  }
  if (hour.dewPointC != null && hour.tempC != null) {
    const derived = Math.min(1, saturation(hour.dewPointC) / saturation(hour.tempC));
    if (Number.isFinite(hour.rh)) {
      if (hour.dewPointC > hour.tempC + .5 || Math.abs(hour.rh - derived) > .15) hour.quality.push('auxiliary-dew-frost-point-disagrees-with-authoritative-rh');
    } else if (!Object.hasOwn(input, 'rh')) {
      if (hour.dewPointC > hour.tempC + .5) throw new Error('Dew point exceeds dry bulb at ' + new Date(time).toISOString());
      hour.rh = derived; hour.quality.push('rh-derived-from-dewpoint');
    }
  }
  return markMissing(hour);
}

export function normalizeWeather(input) {
  if (typeof input === 'string') {
    const text = input.trim();
    if (text.startsWith('{')) { try { input = JSON.parse(text); } catch { throw new Error('Invalid weather JSON.'); } }
    else {
      const csv = parseCSV(text);
      for (const required of ['time', 'tempC', 'pressurePa', 'ghiWm2']) if (!csv.headers.includes(required)) throw new Error('CSV requires column ' + required + '. Units: C, Pa, W/m2; time UTC ending Z.');
      if (!csv.headers.includes('rh') && !csv.headers.includes('dewPointC')) throw new Error('CSV requires rh (fraction) or dewPointC (C).');
      for (const header of csv.headers) if (!Object.hasOwn(UNITS, header)) throw new Error('Unknown CSV column: ' + header + '. Use the documented canonical unit names.');
      input = { schemaVersion: 1, source: 'Imported CSV', sourceKind: 'user-supplied, unverified', timezone: 'UTC', units: { ...UNITS }, raw: { format: 'csv', text }, hours: csv.rows };
    }
  }
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.hours) || !input.hours.length) throw new Error('Expected schemaVersion 1 weather snapshot with nonempty hours.');
  if (!input.units || input.units.time !== UNITS.time) throw new Error('Snapshot units.time must be "UTC epoch milliseconds".');
  for (const [field, unit] of Object.entries(UNITS)) {
    if (field !== 'time' && input.hours.some(hour => hour[field] != null && hour[field] !== '') && input.units[field] !== unit) throw new Error('Snapshot units.' + field + ' must be ' + unit + '.');
  }
  const records = new Map();
  for (const item of input.hours) {
    const hour = normalizeHour(item);
    if (records.has(hour.time)) throw new Error('Duplicate weather hour: ' + new Date(hour.time).toISOString());
    records.set(hour.time, hour);
  }
  const times = [...records.keys()].sort((a, b) => a - b);
  const timezone = input.timezone || 'UTC';
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  let bounds = { start: times[0], end: times.at(-1) + HOUR };
  if (input.startDate || input.endDate) {
    bounds = range({ ...input, timezone });
  } else if (bounds.end - bounds.start > 30 * 366 * DAY) {
    throw new Error('Weather hours span more than 30 years; the missing-hour grid would be unbounded. Split the import.');
  }
  for (const [field, key] of [['startUTC', 'start'], ['endExclusiveUTC', 'end']]) {
    if (input[field] == null) continue;
    if (typeof input[field] !== 'string' || !input[field].endsWith('Z')) throw new Error(field + ' must be an explicit UTC ISO timestamp.');
    const stamp = Date.parse(input[field]);
    if (!Number.isSafeInteger(stamp) || stamp % HOUR || stamp < bounds.start || stamp > bounds.end) throw new Error(field + ' lies outside the date range or is not a UTC hour boundary.');
    bounds[key] = stamp;
  }
  if (bounds.end <= bounds.start || times[0] < bounds.start || times.at(-1) >= bounds.end) {
    throw new Error('Weather hours lie outside the declared time range.');
  }
  const hours = completeGrid(records, bounds.start, bounds.end);
  return { ...input, timezone, source: input.source || 'Imported weather', sourceKind: input.sourceKind || 'user-supplied, unverified',
    startDate: input.startDate || dateString(bounds.start), endDate: input.endDate || dateString(bounds.end - 1),
    startUTC: new Date(bounds.start).toISOString(), endExclusiveUTC: new Date(bounds.end).toISOString(),
    units: { ...UNITS }, coverage: { ...input.coverage, ...coverage(hours, bounds) }, hours };
}

export async function loadExample() {
  const response = await fetch(new URL('../data/weather/tulsa-2025.json', import.meta.url));
  if (!response.ok) throw new Error('Packaged Tulsa weather unavailable: HTTP ' + response.status);
  return normalizeWeather(await response.json());
}

let bundledIndex;
/** Bundled multi-year index (data/weather/index.json). Resolves null when the deployment omits it. */
export async function loadBundledIndex() {
  bundledIndex ??= (async () => {
    const response = await fetch(new URL('../data/weather/index.json', import.meta.url));
    if (!response.ok) return null;
    const index = await response.json();
    if (index?.schemaVersion !== 1 || !Array.isArray(index.sites)) throw new Error('Bundled weather index has an unsupported schema.');
    return index;
  })().catch(error => { bundledIndex = undefined; throw error; });
  return bundledIndex;
}
export async function loadBundledYear(siteKey, year) {
  const index = await loadBundledIndex();
  const site = index?.sites.find(s => s.key === siteKey);
  const file = site?.files?.[String(year)];
  if (!file || !/^[\w.-]+\.json$/.test(file)) throw new Error('No bundled weather for ' + siteKey + ' ' + year + '.');
  const response = await fetch(new URL('../data/weather/' + file, import.meta.url));
  if (!response.ok) throw new Error('Bundled weather ' + file + ' unavailable: HTTP ' + response.status);
  return normalizeWeather(await response.json());
}

let iemQueue = Promise.resolve();
let lastIemRequest = 0;
async function requestIem(url, signal) {
  const previous = iemQueue;
  let release;
  iemQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const delay = Math.max(0, 1200 - (Date.now() - lastIemRequest));
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    signal?.throwIfAborted();
    lastIemRequest = Date.now();
    return await request(url, signal, false);
  } finally { release(); }
}

export async function fetchObserved(options) {
  const bounds = range(options), coords = coordinates(options);
  const station = (options.station || 'TUL').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(station)) throw new Error('IEM station must be a 3 or 4 character identifier.');
  const cutoff = Date.now();
  const queryEnd = Math.min(bounds.end + HOUR / 2, cutoff);
  if (bounds.start - HOUR / 2 >= queryEnd) throw new Error('Observation range is entirely in the future.');
  const params = new URLSearchParams({ station, data: 'tmpf,dwpf,relh,sknt,alti', sts: new Date(bounds.start - HOUR / 2).toISOString(), ets: new Date(queryEnd).toISOString(), tz: 'UTC', format: 'onlycomma', latlon: 'yes', elev: 'yes', missing: 'M', report_type: '3' });
  options.onProgress?.(0, 'Fetching IEM routine observations for ' + station);
  const observations = await requestIem(IEM + '?' + params, options.signal);
  const csv = parseCSV(observations.payload);
  for (const key of ['station', 'valid', 'tmpf', 'dwpf', 'relh', 'elevation', 'alti']) if (!csv.headers.includes(key)) throw new Error('IEM returned an unexpected CSV response. Missing ' + key);
  const selected = new Map(), stationMetadata = new Map();
  let actualObservationCutoff = null;
  for (const row of csv.rows) {
    if (row.station !== station) throw new Error('IEM returned an unexpected station: ' + row.station);
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(row.valid)) throw new Error('Invalid IEM UTC observation timestamp.');
    const observedTime = Date.parse(row.valid.replace(' ', 'T') + 'Z');
    if (!Number.isFinite(observedTime) || observedTime > cutoff) continue;
    actualObservationCutoff = Math.max(actualObservationCutoff ?? observedTime, observedTime);
    const time = Math.floor((observedTime + HOUR / 2) / HOUR) * HOUR;
    if (time < bounds.start || time >= bounds.end || time > cutoff) continue;
    const distance = Math.abs(time - observedTime);
    if (distance > HOUR / 2) continue;
    const old = selected.get(time);
    const signature = JSON.stringify(row);
    if (old && (old.distance < distance || (old.distance === distance && (old.observedTime < observedTime || (old.observedTime === observedTime && old.signature <= signature))))) continue;
    selected.set(time, { row, observedTime, distance, signature });
  }
  const records = new Map();
  for (const [time, { row, observedTime, distance }] of selected) {
    const hour = emptyHour(time);
    hour.observedTime = observedTime;
    hour.observedTimestampUTC = new Date(observedTime).toISOString();
    hour.observationOffsetMinutes = (observedTime - time) / 60000;
    hour.quality = ['iem-routine-report', 'instantaneous-observation-not-hourly-mean'];
    if (distance) hour.quality.push('nearest-hour-within-30-minutes');
    const tempF = finiteCell(row.tmpf, 'IEM tmpf'), dewF = finiteCell(row.dwpf, 'IEM dwpf');
    hour.tempC = tempF == null ? null : (tempF - 32) / 1.8;
    hour.dewPointC = dewF == null ? null : (dewF - 32) / 1.8;
    const relh = finiteCell(row.relh, 'IEM relh'), knots = finiteCell(row.sknt, 'IEM sknt');
    hour.rh = relh == null ? null : relh / 100;
    hour.windMs = knots == null ? null : knots * .5144444444444445;
    const elevationM = finiteCell(row.elevation, 'IEM elevation');
    const altimeter = finiteCell(row.alti, 'IEM alti');
    if (elevationM != null && elevationM >= -500 && elevationM <= 9000) {
      if (altimeter != null && altimeter >= 20 && altimeter <= 35) {
        // Invert the standard altimeter equation, not sea-level pressure as station pressure.
        const pressureHpa = Math.pow(Math.pow(altimeter * 33.8638866667, .190284) - .00008418496 * elevationM, 1 / .190284);
        hour.pressurePa = pressureHpa * 100;
        hour.quality.push('station-pressure-estimated-from-altimeter-and-elevation');
      } else {
        hour.pressurePa = 101325 * Math.pow(1 - 2.25577e-5 * elevationM, 5.25588);
        hour.quality.push('station-pressure-standard-atmosphere-elevation-fallback');
      }
    } else hour.quality.push('station-pressure-unavailable-no-valid-elevation');
    stationMetadata.set(station, { station, latitude: finiteCell(row.lat, 'IEM latitude'), longitude: finiteCell(row.lon, 'IEM longitude'), elevationM });
    // Preserve the raw report; invalid reported values become explicit missing values, not reanalysis.
    for (const [key, min, max] of [['tempC', -100, 70], ['dewPointC', -110, 70], ['rh', 0, 1], ['pressurePa', 20000, 120000], ['windMs', 0, 150]]) {
      if (hour[key] != null && (!Number.isFinite(hour[key]) || hour[key] < min || hour[key] > max)) { hour[key] = null; hour.quality.push('invalid-reported-' + key); }
    }
    if (hour.rh == null && hour.tempC != null && hour.dewPointC != null && hour.dewPointC <= hour.tempC) {
      hour.rh = saturation(hour.dewPointC) / saturation(hour.tempC);
      hour.quality.push('rh-derived-from-observed-dewpoint');
    }
    records.set(time, hour);
  }
  let solar = null;
  const warnings = ['IEM METAR archive has limited quality control. Instantaneous routine observations are matched to nearest UTC hour, not hourly mean weather.', 'Station weather and requested-coordinate gridded solar are independent evidence. No NASA temperature fills missing IEM observations.', 'Station pressure is estimated from altimeter and station elevation; missing altimeter uses a flagged standard-atmosphere elevation fallback.'];
  try { solar = await powerData(options, ['ALLSKY_SFC_SW_DWN']); }
  catch (error) { if (options.signal?.aborted) throw error; warnings.push('NASA POWER solar unavailable; weather-only screening remains possible. ' + error.message); }
  const solarByTime = new Map((solar?.hours || []).map(hour => [hour.time, hour.ghiWm2]));
  const hours = completeGrid(records, bounds.start, bounds.end);
  for (const hour of hours) {
    hour.ghiWm2 = solarByTime.get(hour.time) ?? null;
    hour.quality.push('solar-source-nasa-power');
    if (hour.observedTime == null) hour.quality.push('missing-iem-observation');
    if (hour.time + HOUR > cutoff) hour.quality.push('incomplete-trailing-hour');
    markMissing(hour);
  }
  const sourceUrls = [observations.url, ...(solar?.sourceUrls || [])];
  options.onProgress?.(1, 'Observed weather and independently labeled solar received');
  return { schemaVersion: 1, source: 'IEM observations + NASA POWER solar', sourceKind: 'station observations + gridded satellite solar', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate, station,
    stationMetadata: [...stationMetadata.values()], retrievedAt: new Date().toISOString(), sourceUrl: observations.url, sourceUrls,
    units: { ...UNITS }, interval: 'UTC hour start. IEM instantaneous routine report nearest hour, at most 30 minutes; NASA solar hourly mean.',
    observationSelection: 'Nearest timestamp; ties choose earlier original timestamp, then lexicographic full CSV row. Exactly half-hour reports map to later hour.',
    requestedCutoffUTC: new Date(queryEnd).toISOString(), actualObservationCutoffUTC: actualObservationCutoff == null ? null : new Date(actualObservationCutoff).toISOString(),
    solarSource: { source: 'NASA POWER', fields: ['ghiWm2'], coordinateNotes: GRID_NOTE, sourceVersions: solar?.sourceVersions || [], sourceUrls: solar?.sourceUrls || [] },
    coverage: coverage(hours, bounds), warnings, raw: { observations, solar: solar?.raw || [] }, hours };
}
