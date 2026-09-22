/* Shared weather metadata. Numeric normalization remains in weather.js; this module
 * has no storage, network or DOM dependencies. Unknown evidence stays unknown. */
export const WEATHER_SCHEMA_VERSION = 2;
export const WEATHER_UNITS = Object.freeze({time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'});
const HOUR = 3600000;
const KINDS = new Set(['observation','reanalysis','forecast','historical-forecast','statistical','mixed','unknown','synthetic']);
const SOURCE_KINDS = {obs:'observation',fcst:'forecast',histfcst:'historical-forecast',stats:'statistical',statsfcst:'statistical',comb:'mixed'};
const FORECAST_KINDS = new Set(['forecast','historical-forecast','statistical']);
const AGGREGATIONS = new Set(['instantaneous','mean','accumulation','unknown']);
const EVIDENCE = new Set([...KINDS,'derived','satellite-derived','missing']);

function nullableText(value, field) {
  if (value == null) return null;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a nonempty string or null.`);
  return value;
}
function kind(value, fallback = 'unknown') {
  if (value == null) return fallback;
  if (!KINDS.has(value)) throw new Error(`Unknown weather data kind: ${value}.`);
  return value;
}
export function providerIdentity(snapshot) {
  const source = String(snapshot.source || '');
  const known = source.startsWith('NASA POWER') ? ['nasa','power-hourly','MERRA-2 + SYN1deg']
    : source.startsWith('Open-Meteo') ? ['openmeteo','archive','era5_land + era5']
    : source.startsWith('NOAA NCEI') ? ['ncei','isd','ISD']
    : source.startsWith('IEM') ? ['iem','asos','ASOS']
    : source.startsWith('Visual Crossing') ? ['visualcrossing','timeline',null]
    : ['import',source || 'Imported weather',null];
  const supplied = snapshot.provider;
  if (supplied != null && (typeof supplied !== 'object' || Array.isArray(supplied))) throw new Error('Weather provider must be an identity object.');
  const station = snapshot.station ?? snapshot.stationMetadata?.[0]?.id ?? snapshot.stationMetadata?.[0]?.station ?? null;
  return {
    id:nullableText(supplied?.id ?? known[0],'provider.id'),
    product:nullableText(supplied?.product ?? known[1],'provider.product'),
    model:nullableText(supplied && Object.hasOwn(supplied,'model') ? supplied.model : known[2],'provider.model'),
    stationId:nullableText(supplied && Object.hasOwn(supplied,'stationId') ? supplied.stationId : station,'provider.stationId')
  };
}
function legacyKind(snapshot, provider) {
  if (snapshot.sourceKind === 'test' || /synthetic/i.test(snapshot.sourceKind || '')) return 'synthetic';
  if (provider.id === 'nasa' || provider.id === 'openmeteo') return 'reanalysis';
  if (provider.id === 'iem' || provider.id === 'ncei') return 'mixed'; // station meteorology and separately sourced solar
  return 'unknown';
}
function forecastMetadata(input) {
  if (input != null && (typeof input !== 'object' || Array.isArray(input))) throw new Error('forecast must be an object.');
  const issuedAt = nullableText(input?.issuedAt,'forecast.issuedAt');
  if (issuedAt && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(issuedAt) || !Number.isFinite(Date.parse(issuedAt)) || new Date(issuedAt).toISOString().slice(0, 19) !== issuedAt.slice(0, 19))) {
    throw new Error('forecast.issuedAt must be a UTC ISO timestamp ending Z.');
  }
  return {issuedAt,runId:nullableText(input?.runId,'forecast.runId')};
}
function metadataMap(value, name) {
  if (value != null && (typeof value !== 'object' || Array.isArray(value))) throw new Error(`${name} must be a metadata object.`);
  for (const field of Object.keys(value || {})) if (field === 'time' || !Object.hasOwn(WEATHER_UNITS, field)) throw new Error(`Unknown ${name} field: ${field}.`);
}
function variableMetadata(value, field, defaults) {
  if (value != null && (typeof value !== 'object' || Array.isArray(value))) throw new Error(`Invalid metadata for ${field}.`);
  if (value?.unit != null && value.unit !== WEATHER_UNITS[field]) throw new Error(`Weather variable ${field} has an incompatible unit.`);
  const output = {...defaults,...value,unit:WEATHER_UNITS[field]};
  if (!AGGREGATIONS.has(output.aggregation)) throw new Error(`Invalid aggregation for ${field}.`);
  if (!EVIDENCE.has(output.evidence)) throw new Error(`Invalid evidence for ${field}.`);
  for (const property of ['sourceTiming','source','derivation']) nullableText(output[property],`${field}.${property}`);
  return output;
}

export function withWeatherContract(snapshot) {
  const validateMoisture = basis => {
    if (basis == null) return;
    if (typeof basis !== 'object' || Array.isArray(basis) || !['rh','dewPointC'].includes(basis.authoritative)) throw new Error('Invalid authoritative moisture declaration.');
    for (const field of ['rhReference','dewPointReference']) if (!['water','ice','unknown'].includes(basis[field])) throw new Error(`Invalid moisture reference: ${field}.`);
  };
  validateMoisture(snapshot.moisture);
  metadataMap(snapshot.variables, 'variables');
  if (snapshot.transformations != null && !Array.isArray(snapshot.transformations)) throw new Error('transformations must be an array.');
  const provider = providerIdentity(snapshot);
  const declaredKind = kind(snapshot.dataKind,legacyKind(snapshot,provider));
  const forecast = forecastMetadata(snapshot.forecast);
  const variables = {};
  for (const field of Object.keys(WEATHER_UNITS).filter(key => key !== 'time')) {
    variables[field] = variableMetadata(snapshot.variables?.[field],field,{
      aggregation:'unknown',sourceTiming:'unknown',evidence:'unknown',source:snapshot.source || null,derivation:null
    });
  }
  const hours = snapshot.hours.map(hour => {
    validateMoisture(hour.moisture);
    if (hour.intervalStart != null && hour.intervalStart !== hour.time || hour.intervalEnd != null && hour.intervalEnd !== hour.time + HOUR) {
      throw new Error('Weather interval must match its UTC hour start and one-hour duration.');
    }
    metadataMap(hour.variableQuality, 'variableQuality');
    const suppliedKind = kind(hour.dataKind,declaredKind);
    const sourceKind = SOURCE_KINDS[hour.source];
    const dataKind = sourceKind || suppliedKind;
    const variableQuality = {};
    for (const [field,value] of Object.entries(hour.variableQuality || {})) {
      if (!Object.hasOwn(variables,field)) throw new Error(`Unknown weather quality field: ${field}.`);
      variableQuality[field] = variableMetadata(value,field,variables[field]);
    }
    return {...hour,intervalStart:hour.time,intervalEnd:hour.time+HOUR,dataKind,
      ...(hour.forecast ? {forecast:forecastMetadata(hour.forecast)} : {}),variableQuality};
  });
  const present = hours.filter(hour => Object.keys(variables).some(field => Number.isFinite(hour[field])));
  const kinds = new Set(present.map(hour => hour.dataKind));
  const dataKind = kinds.size === 1 ? [...kinds][0] : kinds.size > 1 ? 'mixed' : declaredKind;
  const transformations = [...(snapshot.transformations || [])];
  if (snapshot.schemaVersion === 1) transformations.push({operation:'migrate-weather-schema',from:1,to:2});
  const {id:ignoredId,...rest} = snapshot;
  return {...rest,schemaVersion:WEATHER_SCHEMA_VERSION,provider,dataKind,forecast,variables,hours,transformations,
    timeBasis:{timestamp:'UTC interval start',intervalSeconds:3600,reportingTimezone:snapshot.timezone}};
}

function stableJSON(value) {
  return JSON.stringify(value,(_key,item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
}
export async function sealWeatherSnapshot(snapshot) {
  if (snapshot.transport?.rawOmitted) throw new Error('A compact weather view cannot be resealed. Load the complete snapshot from its repository.');
  if (snapshot.schemaVersion !== WEATHER_SCHEMA_VERSION) throw new Error('Normalize weather to schema 2 before sealing it.');
  if (!globalThis.crypto?.subtle) throw new Error('Weather identity requires Web Crypto. Use HTTPS or localhost.');
  const {id:ignoredId,...payload} = snapshot;
  const serialized = stableJSON(payload);
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
  const id = 'weather:sha256:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  return {...JSON.parse(serialized),id};
}

/** Enforced at the model boundary, including direct callers and imported snapshots.
 * Unknown past imports are permitted as unverified, never upgraded to observations. */
export function assertHistoricalWeather(snapshot, {now=Date.now()} = {}) {
  if (FORECAST_KINDS.has(snapshot.dataKind)) throw new Error('Historical analysis cannot use forecast or statistical outlook data.');
  for (const hour of snapshot.hours || []) {
    const sourceKind = SOURCE_KINDS[hour.source];
    if (FORECAST_KINDS.has(hour.dataKind) || FORECAST_KINDS.has(sourceKind) || hour.source === 'comb') {
      throw new Error('Historical analysis cannot use forecast or mixed observation/forecast records.');
    }
    for (const field of Object.keys(WEATHER_UNITS).filter(field => field !== 'time' && Number.isFinite(hour[field]))) {
      const evidence = hour.variableQuality?.[field]?.evidence ?? snapshot.variables?.[field]?.evidence;
      if (FORECAST_KINDS.has(evidence)) throw new Error('Historical analysis cannot use forecast or statistical variable evidence.');
    }
    const present = Object.keys(WEATHER_UNITS).some(field => field !== 'time' && Number.isFinite(hour[field]));
    if (present && hour.time > now) throw new Error('Historical analysis cannot use future weather values.');
  }
}
