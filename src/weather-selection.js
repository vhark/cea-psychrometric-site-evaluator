import {providerIdentity, assertHistoricalWeather} from './weather-contract.js';

const SOURCES={nasa:'NASA POWER',openmeteo:'Open-Meteo',iem:'IEM',ncei:'NOAA NCEI',visualcrossing:'Visual Crossing'};
export const calendarYear = snapshot => {
  const year=String(snapshot?.startDate || '').slice(0,4);
  return /^\d{4}$/.test(year) && snapshot.startDate===`${year}-01-01` && snapshot.endDate===`${year}-12-31` ? year : null;
};
export function weatherRequest(site,period,{provider='nasa',station='',apiKey='',signal,onProgress,latest=true}={}) {
  return {latitude:site.latitude,longitude:site.longitude,timezone:site.timezone,
    startDate:period.startDate,endDate:period.endDate,provider,station,apiKey,signal,onProgress,latest};
}
export function pinResolvedStation(options,snapshot) {
  if(options.provider!=='ncei') return options;
  const station=snapshot.provider?.stationId;
  if(!station || options.station && options.station.trim().toUpperCase()!==station) throw new Error('Returned NCEI station does not match the requested station.');
  return {...options,station};
}
function matches(entry,request,{loaded=false}={}) {
  if(entry.migrationError || entry.historicalEligible===false) return false;
  if(entry.latitude!==request.latitude || entry.longitude!==request.longitude || entry.timezone!==request.timezone) return false;
  try {
    assertHistoricalWeather(Array.isArray(entry.hours) ? entry : {...entry, hours: []});
    const identity=providerIdentity(entry);
    // An explicitly loaded unverified import remains usable, without making it
    // an automatic replacement for a provider request in the cache.
    if(loaded && identity.id==='import') return true;
    const wanted=typeof request.provider==='object' ? request.provider : providerIdentity({source:SOURCES[request.provider || 'nasa'],station:request.station?.trim().toUpperCase() || null});
    return ['id','product','model','stationId'].every(key=>(identity[key]??null)===(wanted[key]??null));
  } catch {return false;}
}
function newestFirst(entries) {
  return [...entries].sort((a,b)=>String(b.retrievedAt||'').localeCompare(String(a.retrievedAt||'')) || String(a.key).localeCompare(String(b.key)));
}
export function selectCachedWeather(cached,request) {
  return newestFirst(cached).find(entry=>matches(entry,request) && entry.startDate===request.startDate && entry.endDate===request.endDate) || null;
}
export function selectWeatherYears(cached,loaded,request) {
  const sources=new Map();
  for(const entry of newestFirst(cached)) {
    const year=calendarYear(entry);
    if(year && !sources.has(year) && matches(entry,request)) sources.set(year,{kind:'cached',key:entry.key,source:entry.source});
  }
  const year=calendarYear(loaded);
  if(year && matches(loaded,request,{loaded:true})) sources.set(year,{kind:'loaded',key:loaded.id,source:loaded.source});
  return new Map([...sources].sort());
}
