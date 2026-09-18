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
const OPEN_METEO = 'https://archive-api.open-meteo.com/v1/archive';
const NCEI_DATA = 'https://www.ncei.noaa.gov/access/services/data/v1';
const NCEI_SEARCH = 'https://www.ncei.noaa.gov/access/services/search/v1/data';
const VISUAL_CROSSING = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline';
const OPEN_METEO_ELEVATION = 'https://api.open-meteo.com/v1/elevation';
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
  const { startDate, endDate, timezone } = options;
  // No default. A silently assumed zone is what put a Boulder run on a Tulsa clock: local-day
  // bounds are computed from this, so guessing it here would corrupt the request itself.
  try { if (typeof timezone !== 'string' || !timezone.trim()) throw new Error(); new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch { throw new Error('A valid IANA time zone is required to fetch weather, because calendar dates are local days. Locate the ZIP or enter the zone directly.'); }
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
/** Great-circle separation in km, or null when either point lacks coordinates. */
export function separationKm(a, b) {
  if (!Number.isFinite(a?.latitude) || !Number.isFinite(a?.longitude) || !Number.isFinite(b?.latitude) || !Number.isFinite(b?.longitude)) return null;
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
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
/* A recorded url travels into raw[], which is exported and cached, so a provider key in a query
   string would end up in every file a user shares. The key is stripped from what is recorded while
   the real url is still what gets fetched. Anything passed as a secret is removed, so adding a keyed
   provider cannot leak one by omission. */
export function redactSecrets(url, secrets = []) {
  let safe = String(url);
  for (const secret of secrets) {
    if (typeof secret !== 'string' || secret.length < 4) continue;
    safe = safe.split(secret).join('REDACTED').split(encodeURIComponent(secret)).join('REDACTED');
  }
  return safe;
}
async function request(url, signal, json = true, secrets = []) {
  const response = await fetch(url, { signal });
  const text = await response.text();
  const recorded = redactSecrets(url, secrets);
  if (!response.ok) throw new Error('Weather source HTTP ' + response.status + ': ' + redactSecrets(text.slice(0, 400), secrets));
  let payload = text;
  if (json) {
    try { payload = JSON.parse(text); } catch { throw new Error('Weather source did not return JSON: ' + redactSecrets(text.slice(0, 200), secrets)); }
  }
  let sha256 = null;
  if (globalThis.crypto?.subtle) sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
  return { url: recorded, retrievedAt: new Date().toISOString(), sha256, payload, text: json ? text : undefined };
}
async function powerData(options, names = Object.keys(PARAMETERS)) {
  const bounds = range(options);
  const coords = coordinates(options);
  if (dateValue(bounds.startDate) < dateValue('2001-01-01')) throw new Error('NASA POWER hourly data begins in 2001.');
  const records = new Map(), raw = [], sourceUrls = [];
  let sourceElevationM = null;
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
    const reported = data.geometry?.coordinates?.[2];
    if (Number.isFinite(reported)) sourceElevationM = reported;
    raw.push(item);
    sourceUrls.push(item.url);
  }
  const hours = completeGrid(records, bounds.start, bounds.end);
  options.onProgress?.(1, 'NASA POWER source received');
  return { schemaVersion: 1, source: 'NASA POWER', sourceKind: 'gridded reanalysis + satellite solar', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate,
    retrievedAt: new Date().toISOString(), sourceUrl: sourceUrls[0] || null, sourceUrls, units: { ...UNITS },
    interval: 'UTC hour start; hourly mean meteorology; Wh/m² over one hour divided by 1 hour = W/m². Only UTC hour starts inside local date bounds are included.',
    sourceVersions: raw.map(item => item.payload.header), coordinateNotes: GRID_NOTE, sourceElevationM,
    coverage: coverage(hours, bounds), raw, hours };
}


/* Open-Meteo ERA5 archive. Two models are requested by name rather than letting the service blend
   them, because a value whose model is unknown cannot be reported honestly. ERA5-Land carries
   temperature and humidity on a 0.1 degree grid; pressure, solar and wind exist only in ERA5 at
   0.25 degrees. Each hour records which model supplied each field. */
const OPEN_METEO_FIELDS = {
  temperature_2m: ['tempC', 1, 0],
  relative_humidity_2m: ['rh', .01, 0],
  dew_point_2m: ['dewPointC', 1, 0],
  surface_pressure: ['pressurePa', 100, 0],
  shortwave_radiation: ['ghiWm2', 1, 0],
  wind_speed_10m: ['windMs', 1 / 3.6, 0],
};
const OPEN_METEO_NOTE = 'Requested coordinates are not a station. Source-native grids: ERA5-Land 0.1 degrees '
  + '(about 9 km) for temperature, humidity and dew point; ERA5 0.25 degrees (about 31 km) for surface '
  + 'pressure, shortwave radiation and wind. Wind is at 10 m here, against 2 m from NASA POWER, so the two '
  + 'are not interchangeable. Returned elevation is the model cell, not measured site elevation.';

export async function fetchOpenMeteo(options) {
  const bounds = range(options), coords = coordinates(options);
  const first = dateString(Math.floor(bounds.start / DAY) * DAY - DAY);
  const last = dateString(Math.floor((bounds.end - 1) / DAY) * DAY + DAY);
  const names = Object.keys(OPEN_METEO_FIELDS);
  const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude),
    start_date: first, end_date: last, hourly: names.join(','), models: 'era5_land,era5', timezone: 'UTC' });
  options.onProgress?.(0, 'Fetching Open-Meteo ERA5 archive');
  // Open-Meteo needs no key on the free tier. The secret is threaded through anyway so that a paid
  // key, or the next keyed provider, is redacted from the recorded url by construction.
  const item = await request(OPEN_METEO + '?' + params, options.signal, true, [options.apiKey].filter(Boolean));
  const data = item.payload;
  if (data.error) throw new Error('Open-Meteo API: ' + (data.reason || 'request rejected'));
  const hourly = data.hourly;
  if (!hourly?.time) throw new Error('Open-Meteo returned no hourly block.');
  for (const name of names) for (const model of ['era5_land', 'era5']) {
    const unit = data.hourly_units?.[`${name}_${model}`];
    if (unit === undefined) throw new Error(`Open-Meteo did not return ${name} for model ${model}.`);
  }
  // Units are asserted rather than assumed: a silent unit change would rescale every hour.
  const expected = { temperature_2m: '\u00b0C', relative_humidity_2m: '%', dew_point_2m: '\u00b0C',
    surface_pressure: 'hPa', shortwave_radiation: 'W/m\u00b2', wind_speed_10m: 'km/h' };
  for (const [name, unit] of Object.entries(expected)) for (const model of ['era5_land', 'era5']) {
    const got = data.hourly_units[`${name}_${model}`];
    if (got !== unit) throw new Error(`Open-Meteo unexpected unit for ${name} (${model}): ${got}, expected ${unit}.`);
  }

  const records = new Map();
  for (const [index, stamp] of hourly.time.entries()) {
    const time = Date.parse(stamp.length === 16 ? stamp + ':00Z' : stamp + 'Z');
    if (!Number.isFinite(time) || time < bounds.start || time >= bounds.end) continue;
    const hour = emptyHour(time);
    for (const [name, [field, factor]] of Object.entries(OPEN_METEO_FIELDS)) {
      const land = hourly[`${name}_era5_land`]?.[index];
      const wide = hourly[`${name}_era5`]?.[index];
      const value = land ?? wide;
      if (value == null) continue;
      if (!Number.isFinite(value)) throw new Error('Open-Meteo returned a non-numeric ' + name);
      hour[field] = value * factor;
      hour.quality.push(`${field}-from-${land == null ? 'era5-0.25deg' : 'era5-land-0.1deg'}`);
    }
    records.set(time, hour);
  }
  const hours = completeGrid(records, bounds.start, bounds.end);
  for (const hour of hours) markMissing(hour);
  options.onProgress?.(1, 'Open-Meteo archive received');
  return { schemaVersion: 1, source: 'Open-Meteo ERA5 archive', sourceKind: 'gridded reanalysis', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate,
    retrievedAt: new Date().toISOString(), sourceUrl: item.url, sourceUrls: [item.url], units: { ...UNITS },
    interval: 'UTC hour start. ERA5 and ERA5-Land hourly reanalysis. Wind measured at 10 m, not 2 m.',
    sourceVersions: [{ model: 'era5_land + era5', generationTimeMs: data.generationtime_ms, utcOffsetSeconds: data.utc_offset_seconds }],
    coordinateNotes: OPEN_METEO_NOTE, sourceElevationM: Number.isFinite(data.elevation) ? data.elevation : null,
    licence: 'CC BY 4.0, Open-Meteo. Free tier is non-commercial use only.',
    attribution: 'Weather data by Open-Meteo.com, CC BY 4.0. ERA5 and ERA5-Land produced by ECMWF / Copernicus Climate Change Service.',
    coverage: coverage(hours, bounds), raw: [item], hours };
}


/* NOAA NCEI Integrated Surface Database, the authoritative archive the IEM feed is derived from.
   Every value arrives with its own quality-control flag, which IEM's CSV flattens away, and the
   record reaches back further. ISD codes each field as scaled integers with a missing sentinel, so
   the parser below decodes rather than trusts: a value whose QC flag rejects it stays missing
   instead of being carried into the run. Solar is not observed at these stations and comes from
   NASA POWER at the requested coordinates, the same split the IEM provider uses. */
const ISD_MISSING = new Set(['9999', '99999', '+9999', '-9999', '999', '99']);
/* ISD quality codes. 2 and 3 are the archive saying the value failed its own checks. */
const ISD_REJECTED = new Set(['2', '3', '6', '7']);
function isdField(raw, index, scale, { qcIndex }) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split(',');
  const value = parts[index];
  if (value === undefined || ISD_MISSING.has(value.replace(/^\+/, '').replace(/^0+(?=\d)/, '')) || ISD_MISSING.has(value)) return null;
  if (qcIndex != null && ISD_REJECTED.has(parts[qcIndex])) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number / scale : null;
}

async function nceiStation(options, bounds) {
  const explicit = (options.station || '').trim();
  if (/^\d{11}$/.test(explicit)) return { id: explicit, latitude: null, longitude: null, name: null };
  const { latitude, longitude } = coordinates(options);
  const pad = 0.75;
  const params = new URLSearchParams({ dataset: 'global-hourly',
    bbox: [latitude + pad, longitude - pad, latitude - pad, longitude + pad].join(','),
    startDate: bounds.startDate + 'T00:00:00', endDate: bounds.endDate + 'T23:59:59', limit: '50' });
  const item = await request(NCEI_SEARCH + '?' + params, options.signal);
  const results = item.payload?.results || [];
  if (!results.length) throw new Error(`No NCEI station reported within ${pad} degrees of these coordinates for ${bounds.startDate} to ${bounds.endDate}. Choose the IEM provider and name a station, or widen the period.`);
  let best = null;
  for (const result of results) {
    const point = result.location?.coordinates;
    const id = result.stations?.[0]?.id || String(result.name || '').replace('.csv', '');
    if (!Array.isArray(point) || !/^\d{11}$/.test(id)) continue;
    const km = separationKm({ latitude, longitude }, { latitude: point[1], longitude: point[0] });
    if (km != null && (!best || km < best.km)) best = { id, latitude: point[1], longitude: point[0], km, name: result.name || null };
  }
  if (!best) throw new Error('NCEI returned stations without usable identifiers or coordinates.');
  return best;
}

export async function fetchNcei(options) {
  const bounds = range(options), coords = coordinates(options);
  const cutoff = Date.now();
  options.onProgress?.(0, 'Finding the nearest NCEI station');
  const station = await nceiStation(options, bounds);
  const params = new URLSearchParams({ dataset: 'global-hourly', stations: station.id,
    startDate: bounds.startDate, endDate: bounds.endDate,
    dataTypes: 'TMP,DEW,WND,MA1,SLP', includeStationName: 'true', includeStationLocation: '1', format: 'json' });
  options.onProgress?.(.1, `Fetching NCEI observations for station ${station.id}`);
  const item = await request(NCEI_DATA + '?' + params, options.signal);
  const rows = item.payload;
  if (!Array.isArray(rows)) throw new Error('NCEI returned an unexpected response shape.');
  if (!rows.length) throw new Error(`NCEI station ${station.id} has no records for ${bounds.startDate} to ${bounds.endDate}.`);
  const meta = rows[0];
  const metaNumber = value => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  if (meta.NAME) station.name = meta.NAME;
  station.elevationM = metaNumber(meta.ELEVATION);
  const metaLat = metaNumber(meta.LATITUDE), metaLon = metaNumber(meta.LONGITUDE);
  if (metaLat != null && metaLon != null) {
    station.latitude = metaLat; station.longitude = metaLon;
    station.km = separationKm(coords, { latitude: metaLat, longitude: metaLon });
  }

  // METAR reports are the hourly series. Synoptic and daily summaries are a different cadence and
  // would double-count the hour if mixed in.
  const selected = new Map();
  let actualObservationCutoff = null;
  for (const row of rows) {
    if ((row.REPORT_TYPE || '').trim() !== 'FM-15') continue;
    const observedTime = Date.parse(row.DATE + 'Z');
    if (!Number.isFinite(observedTime) || observedTime > cutoff) continue;
    actualObservationCutoff = Math.max(actualObservationCutoff ?? observedTime, observedTime);
    const time = Math.floor((observedTime + HOUR / 2) / HOUR) * HOUR;
    if (time < bounds.start || time >= bounds.end) continue;
    const distance = Math.abs(time - observedTime);
    if (distance > HOUR / 2) continue;
    const old = selected.get(time);
    if (old && (old.distance < distance || (old.distance === distance && old.observedTime <= observedTime))) continue;
    selected.set(time, { row, observedTime, distance });
  }

  const records = new Map();
  for (const [time, { row, observedTime }] of selected) {
    const hour = emptyHour(time);
    hour.observedTime = observedTime;
    hour.tempC = isdField(row.TMP, 0, 10, { qcIndex: 1 });
    hour.dewPointC = isdField(row.DEW, 0, 10, { qcIndex: 1 });
    hour.windMs = isdField(row.WND, 3, 10, { qcIndex: 4 });
    const stationHpa = isdField(row.MA1, 2, 10, { qcIndex: 3 });
    const altimeterHpa = isdField(row.MA1, 0, 10, { qcIndex: 1 });
    if (stationHpa != null) { hour.pressurePa = stationHpa * 100; hour.quality.push('station-pressure-observed'); }
    else if (altimeterHpa != null && Number.isFinite(station.elevationM)) {
      hour.pressurePa = Math.pow(Math.pow(altimeterHpa, .190284) - .00008418496 * station.elevationM, 1 / .190284) * 100;
      hour.quality.push('station-pressure-estimated-from-altimeter-and-elevation');
    } else hour.quality.push('station-pressure-unavailable');
    if (hour.rh == null && hour.tempC != null && hour.dewPointC != null && hour.dewPointC <= hour.tempC) {
      hour.rh = saturation(hour.dewPointC) / saturation(hour.tempC);
      hour.quality.push('rh-derived-from-observed-dewpoint');
    }
    hour.quality.push('isd-quality-flags-checked');
    records.set(time, hour);
  }

  let solar = null;
  const warnings = ['NCEI Integrated Surface Database records carry per-value quality flags, and a value its own flag rejects is kept missing rather than used.',
    'Station weather and requested-coordinate gridded solar are independent evidence. No modelled temperature fills a missing observation.'];
  try { solar = await powerData(options, ['ALLSKY_SFC_SW_DWN']); }
  catch (error) { if (options.signal?.aborted) throw error; warnings.push('NASA POWER solar unavailable, so this snapshot is weather-only. ' + error.message); }
  const solarByTime = new Map((solar?.hours || []).map(hour => [hour.time, hour.ghiWm2]));
  const hours = completeGrid(records, bounds.start, bounds.end);
  for (const hour of hours) {
    hour.ghiWm2 = solarByTime.get(hour.time) ?? null;
    hour.quality.push('solar-source-nasa-power');
    if (hour.observedTime == null) hour.quality.push('missing-ncei-observation');
    markMissing(hour);
  }
  if (station.km != null) {
    warnings.push(`Station ${station.id}${station.name ? ` (${station.name})` : ''} is ${station.km.toFixed(0)} km from the requested coordinates. Observations are station weather, not site weather.`);
    if (station.km > 100) warnings.push(`That separation exceeds 100 km. Name a nearer station, or use a gridded source for this site.`);
  }
  if (Number.isFinite(station.elevationM) && Number.isFinite(solar?.sourceElevationM)) {
    const drop = station.elevationM - solar.sourceElevationM;
    if (Math.abs(drop) >= 150) warnings.push(`Station ${station.id} sits ${Math.abs(drop).toFixed(0)} m ${drop > 0 ? 'above' : 'below'} the ${solar.sourceElevationM.toFixed(0)} m elevation the gridded solar source reports here. Station pressure follows elevation and humidity ratio follows pressure.`);
  }
  options.onProgress?.(1, 'NCEI observations and independently labeled solar received');
  return { schemaVersion: 1, source: 'NOAA NCEI Integrated Surface Database + NASA POWER solar',
    sourceKind: 'station observations + gridded satellite solar', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate, station: station.id,
    stationMetadata: [{ station: station.id, latitude: station.latitude, longitude: station.longitude, name: station.name, elevationM: station.elevationM ?? null }],
    sourceElevationM: solar?.sourceElevationM ?? null,
    retrievedAt: new Date().toISOString(), sourceUrl: item.url, sourceUrls: [item.url, ...(solar?.sourceUrls || [])],
    units: { ...UNITS }, interval: 'UTC hour start. ISD FM-15 routine reports matched to the nearest UTC hour, at most 30 minutes away; NASA solar hourly mean.',
    observationSelection: 'Nearest timestamp wins; an exact tie takes the earlier observation. Only FM-15 routine reports are used, so synoptic and daily summary rows cannot double-count an hour.',
    licence: 'US Government work, public domain.',
    attribution: 'Observations from the NOAA National Centers for Environmental Information Integrated Surface Database.',
    requestedCutoffUTC: new Date(bounds.end).toISOString(),
    actualObservationCutoffUTC: actualObservationCutoff == null ? null : new Date(actualObservationCutoff).toISOString(),
    solarSource: { source: 'NASA POWER', fields: ['ghiWm2'], coordinateNotes: GRID_NOTE, sourceVersions: solar?.sourceVersions || [], sourceUrls: solar?.sourceUrls || [] },
    coverage: coverage(hours, bounds), warnings, raw: [item, ...(solar?.raw || [])], hours };
}


/* Visual Crossing timeline. The one source here that returns all six values in a single call, and
   the one that needs the most care reading.
 *
 * Two facts govern this adapter. Its `pressure` is sea level, not station: at 1,655 m that is about
 * 22 percent high, and humidity ratio follows pressure, so passing it through would corrupt every
 * moisture figure in the run. It is reduced to station pressure using the site elevation, which is
 * fetched from Open-Meteo's keyless elevation service, and every hour says so.
 *
 * Second, the service blends station observations with model output into a gap-free series and
 * publishes no per-hour flag saying which a value is. The nearest thing it gives is the list of
 * stations that contributed to each hour, so that list is recorded, and an hour that names no
 * station is marked as carrying no observation behind it. That is weaker than the fill flags a
 * source like NSRDB publishes, and the interface says so rather than implying otherwise. */
async function siteElevation(options, coords) {
  const params = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude) });
  const item = await request(OPEN_METEO_ELEVATION + '?' + params, options.signal);
  const value = item.payload?.elevation?.[0];
  if (!Number.isFinite(value)) throw new Error('Could not establish the site elevation needed to convert sea-level pressure to station pressure.');
  return { elevationM: value, url: item.url, item };
}
/* Inverse of the standard altimeter reduction, the same relation the station adapters use. */
function stationPressureFromSeaLevel(seaLevelHpa, elevationM) {
  if (!Number.isFinite(seaLevelHpa) || !Number.isFinite(elevationM)) return null;
  const value = Math.pow(Math.pow(seaLevelHpa, .190284) - .00008418496 * elevationM, 1 / .190284);
  return Number.isFinite(value) && value > 0 ? value * 100 : null;
}

export async function fetchVisualCrossing(options) {
  const bounds = range(options), coords = coordinates(options);
  const key = (options.apiKey || '').trim();
  if (!key) throw new Error('Visual Crossing needs an API key. Create a free account, then paste your own key into the field beside the source picker. It stays in this browser.');
  options.onProgress?.(0, 'Establishing site elevation for the pressure conversion');
  const elevation = await siteElevation(options, coords);

  const elements = 'datetimeEpoch,temp,dew,humidity,pressure,solarradiation,windspeed,stations';
  const params = new URLSearchParams({ unitGroup: 'metric', include: 'hours', elements,
    contentType: 'json', key });
  const url = `${VISUAL_CROSSING}/${coords.latitude},${coords.longitude}/${bounds.startDate}/${bounds.endDate}?${params}`;
  options.onProgress?.(.2, 'Fetching Visual Crossing timeline');
  const item = await request(url, options.signal, true, [key]);
  const data = item.payload;
  if (!Array.isArray(data?.days)) throw new Error('Visual Crossing returned no days block.');

  const records = new Map();
  let modelled = 0, observed = 0;
  for (const day of data.days) {
    for (const entry of day.hours || []) {
      const time = Number(entry.datetimeEpoch) * 1000;
      if (!Number.isFinite(time) || time < bounds.start || time >= bounds.end) continue;
      const hour = emptyHour(time);
      const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : null);
      hour.tempC = number(entry.temp);
      hour.dewPointC = number(entry.dew);
      const humidity = number(entry.humidity);
      hour.rh = humidity == null ? null : humidity / 100;
      hour.ghiWm2 = number(entry.solarradiation);
      const windKmh = number(entry.windspeed);
      hour.windMs = windKmh == null ? null : windKmh / 3.6;
      hour.pressurePa = stationPressureFromSeaLevel(number(entry.pressure), elevation.elevationM);
      if (hour.pressurePa != null) hour.quality.push('station-pressure-reduced-from-sea-level-and-elevation');
      else hour.quality.push('station-pressure-unavailable');
      const stations = Array.isArray(entry.stations) ? entry.stations.filter(Boolean) : [];
      if (stations.length) { hour.stations = stations; hour.quality.push(`contributing-stations-${stations.length}`); observed++; }
      else { hour.quality.push('no-contributing-station-value-is-modelled'); modelled++; }
      records.set(time, hour);
    }
  }
  const hours = completeGrid(records, bounds.start, bounds.end);
  for (const hour of hours) markMissing(hour);

  const warnings = [
    'Visual Crossing blends station observations with model output into a gap-free series and publishes no per-hour flag saying which a value is. The stations that contributed to each hour are recorded where the service names them.',
    `Pressure arrives as sea-level pressure and is reduced to station pressure using ${elevation.elevationM.toFixed(0)} m site elevation from Open-Meteo. It is derived, not measured.`,
  ];
  if (modelled) warnings.push(`${modelled} of ${modelled + observed} hours name no contributing station, so those values came from a model rather than an instrument.`);
  options.onProgress?.(1, 'Visual Crossing timeline received');
  return { schemaVersion: 1, source: 'Visual Crossing Timeline', sourceKind: 'blended station observations and model output', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate,
    retrievedAt: new Date().toISOString(), sourceUrl: item.url, sourceUrls: [item.url, elevation.url],
    units: { ...UNITS },
    interval: 'UTC hour start, from the service\'s hourly timeline. Pressure is reduced from sea level using site elevation.',
    sourceVersions: [{ service: 'Visual Crossing Timeline', resolvedAddress: data.resolvedAddress ?? null, timezone: data.timezone ?? null }],
    coordinateNotes: 'Values are interpolated from nearby stations, weighted by distance, and filled with model output where no station reported. The service does not say per hour which of those a value is.',
    sourceElevationM: elevation.elevationM,
    licence: 'Visual Crossing terms. The free tier permits 1,000 records per query and a daily record allowance. Raw data may not be redistributed publicly.',
    attribution: 'Weather Data Provided by Visual Crossing.',
    coverage: coverage(hours, bounds), warnings, raw: [item, elevation.item], hours };
}

/* One adapter per provider id. providers.js describes the same ids for the interface, and a test
   asserts the two stay in step, so a provider can never be offered without something to call. */
const ADAPTERS = { nasa: powerData, iem: fetchObserved, openmeteo: fetchOpenMeteo, ncei: fetchNcei, visualcrossing: fetchVisualCrossing };
export const PROVIDER_IDS = Object.keys(ADAPTERS);
export async function fetchWeather(options) {
  const adapter = ADAPTERS[options.provider || 'nasa'];
  if (!adapter) throw new Error(`Unknown weather provider: ${options.provider}. Available: ${PROVIDER_IDS.join(', ')}.`);
  return adapter(options);
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

/* IEM asks for one request at a time with a pause between them, so requests are queued rather than
   fired in parallel. Deleted by accident when the bundled-archive loaders next to it were removed;
   test/data.test.mjs now drives fetchObserved end to end so that cannot happen silently again. */
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
  const station = (options.station || '').trim().toUpperCase();
  if (!station) throw new Error('Name the IEM observation station for this site. There is no default: a carried-over station returns another location\u2019s observations under these coordinates.');
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
  // The station is chosen explicitly and does not move with the ZIP, so state the separation
  // the request actually carries rather than let a stale default read as site weather.
  for (const meta of stationMetadata.values()) {
    const km = separationKm(coords, meta);
    if (km == null) { warnings.push(`IEM did not report coordinates for station ${meta.station}, so its separation from the requested point is unknown.`); continue; }
    warnings.push(`Station ${meta.station} is ${km.toFixed(0)} km from the requested coordinates. Observations are station weather, not site weather.`);
    if (km > 100) warnings.push(`That separation exceeds 100 km. Verify that ${meta.station} represents this site, or choose a nearer station.`);
    // Station pressure is derived from station elevation, and humidity ratio at a given dew point
    // scales with pressure, so an elevation gap biases every moisture figure rather than just
    // the temperature. It matters more than horizontal distance and was previously unreported.
    if (Number.isFinite(meta.elevationM) && Number.isFinite(solar?.sourceElevationM)) {
      const drop = meta.elevationM - solar.sourceElevationM;
      if (Math.abs(drop) >= 150) warnings.push(`Station ${meta.station} sits ${Math.abs(drop).toFixed(0)} m ${drop > 0 ? 'above' : 'below'} the ${solar.sourceElevationM.toFixed(0)} m elevation the gridded source reports for these coordinates. Station pressure follows elevation and humidity ratio follows pressure, so this shifts every moisture figure, not just temperature.`);
    }
  }
  const sourceUrls = [observations.url, ...(solar?.sourceUrls || [])];
  options.onProgress?.(1, 'Observed weather and independently labeled solar received');
  return { schemaVersion: 1, source: 'IEM observations + NASA POWER solar', sourceKind: 'station observations + gridded satellite solar', ...coords,
    timezone: bounds.timezone, startDate: bounds.startDate, endDate: bounds.endDate, station,
    stationMetadata: [...stationMetadata.values()], sourceElevationM: solar?.sourceElevationM ?? null, retrievedAt: new Date().toISOString(), sourceUrl: observations.url, sourceUrls,
    units: { ...UNITS }, interval: 'UTC hour start. IEM instantaneous routine report nearest hour, at most 30 minutes; NASA solar hourly mean.',
    observationSelection: 'Nearest timestamp; ties choose earlier original timestamp, then lexicographic full CSV row. Exactly half-hour reports map to later hour.',
    requestedCutoffUTC: new Date(queryEnd).toISOString(), actualObservationCutoffUTC: actualObservationCutoff == null ? null : new Date(actualObservationCutoff).toISOString(),
    solarSource: { source: 'NASA POWER', fields: ['ghiWm2'], coordinateNotes: GRID_NOTE, sourceVersions: solar?.sourceVersions || [], sourceUrls: solar?.sourceUrls || [] },
    coverage: coverage(hours, bounds), warnings, raw: { observations, solar: solar?.raw || [] }, hours };
}
