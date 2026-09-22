import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchWeather,normalizeWeather,sealWeatherSnapshot} from '../src/weather.js';
import {weatherState} from '../src/physics.js';

const time=Date.UTC(2025,0,2);
const waterRH={authoritative:'rh',rhReference:'water',dewPointReference:'water'};
const cold={time,tempC:-10,rh:.5,dewPointC:-20,pressurePa:84000,ghiWm2:0,windMs:1};
const csv='time,tempC,rh,dewPointC,pressurePa,ghiWm2,windMs\n2025-01-02T00:00:00Z,-10,0.5,-20,84000,0,1';

function nasaPayload(){
 const values={T2M:[-10,'C'],RH2M:[50,'%'],PS:[84,'kPa'],ALLSKY_SFC_SW_DWN:[0,'Wh/m^2'],T2MDEW:[-20,'C'],WS2M:[1,'m/s']};
 return {header:{time_standard:'UTC',fill_value:-999},geometry:{coordinates:[-105,40,1500]},
  parameters:Object.fromEntries(Object.entries(values).map(([name,[,units]])=>[name,{units}])),
  properties:{parameter:Object.fromEntries(Object.entries(values).map(([name,[value]])=>[name,{'2025010200':value}]))}};
}

function openMeteoPayload(){
 const payload={latitude:40,longitude:-105,elevation:1500,utc_offset_seconds:0,generationtime_ms:1,
  hourly_units:{time:'iso8601'},hourly:{time:['2025-01-02T00:00','2025-01-02T01:00']}};
 const values={temperature_2m:[-10,'°C'],relative_humidity_2m:[50,'%'],dew_point_2m:[-20,'°C'],
  surface_pressure:[840,'hPa'],shortwave_radiation:[0,'W/m²'],wind_speed_10m:[3.6,'km/h']};
 for(const [name,[value,unit]] of Object.entries(values)){
  for(const model of ['era5_land','era5']){
   payload.hourly_units[`${name}_${model}`]=unit;
   const missingLand=model==='era5_land'&&['surface_pressure','shortwave_radiation','wind_speed_10m'].includes(name);
   payload.hourly[`${name}_${model}`]=[missingLand?null:value,missingLand?null:value];
  }
 }
 return payload;
}

for(const [provider,payload] of [['nasa',nasaPayload],['openmeteo',openMeteoPayload]]){
 test(`${provider} cold provider response matches declared-water CSV and direct RH interpretation`,async t=>{
  const calls=[];
  t.mock.method(globalThis,'fetch',async url=>{
   calls.push(String(url));
   return {ok:true,status:200,text:async()=>JSON.stringify(payload())};
  });
  const snapshot=await fetchWeather({provider,latitude:40,longitude:-105,timezone:'UTC',startDate:'2025-01-02',endDate:'2025-01-02'});
  assert.equal(calls.length,1);
  assert.match(calls[0],provider==='nasa'?/power\.larc\.nasa\.gov/:/archive-api\.open-meteo\.com/);
  const hour=snapshot.hours.find(h=>h.time===time);
  assert.equal(hour.moisture.authoritative,'rh');
  assert.equal(hour.moisture.rhReference,'water');
  assert.equal(hour.moisture.dewPointReference,provider==='nasa'?'unknown':'water');
  assert.deepEqual([hour.tempC,hour.rh,hour.dewPointC,hour.pressurePa],[-10,.5,-20,84000]);
  const states=[weatherState(hour),weatherState({...cold,moisture:waterRH}),
   weatherState(normalizeWeather(csv,{timezone:'UTC',moisture:waterRH}).hours[0])];
  for(const state of states){assert.ok(state);assert.ok(Math.abs(state.w-states[0].w)<1e-12);}
  assert.ok(states[0].w>weatherState(cold).w*1.09,'cold water RH must not silently take the legacy ice branch');
 });
}

const legacy=JSON.parse(readFileSync(new URL('./fixtures/legacy-moisture-snapshot.json',import.meta.url),'utf8'));
const legacyId='weather:sha256:56d9382e8ad0fea20343d56dec0f7f7672947fe2f378fc28cab54a05cdf1445a';
test('a genuinely pre-change sealed schema-2 snapshot retains its pinned ID and numeric evidence',async()=>{
 assert.match(legacy.generatedFromCommit,/^efeacd2[0-9a-f]{33}$/);
 assert.equal(legacy.snapshot.schemaVersion,2);
 assert.equal(legacy.snapshot.id,legacyId);
 assert.ok(legacy.snapshot.hours.every(h=>!Object.hasOwn(h,'moisture')),'fixture must predate explicit phase metadata');
 const before=JSON.stringify(legacy.snapshot);
 const normalized=normalizeWeather(legacy.snapshot);
 const resealed=await sealWeatherSnapshot(normalized);
 assert.equal(resealed.id,legacyId);
 assert.deepEqual(resealed,legacy.snapshot);
 assert.equal(JSON.stringify(legacy.snapshot),before);
 for(const [index,hour] of resealed.hours.entries()){
  const state=weatherState(hour);
  assert.ok(state);
  assert.ok(Math.abs(state.w-legacy.expectedLegacyCSVStates[index].w)<1e-15);
 }
});

test('historical cold CSV/direct discrepancy is preserved as evidence while new declarations agree',()=>{
 const water={authoritative:'dewPointC',rhReference:'water',dewPointReference:'water'};
 const ice={authoritative:'dewPointC',rhReference:'ice',dewPointReference:'ice'};
 const converted=normalizeWeather(legacy.inputCSV,{timezone:'UTC',moisture:water});
 const unknown=normalizeWeather(legacy.inputCSV,{timezone:'UTC'});
 for(const index of [0,1]){
  const raw=legacy.inputRows[index];
  const oldCSV=legacy.expectedLegacyCSVStates[index].w;
  const oldDirect=legacy.expectedLegacyDirectStates[index].w;
  assert.ok(Math.abs(oldCSV-oldDirect)>oldDirect*.09,'reference fixture must expose the original mixed-convention discrepancy');
  const currentDirect=weatherState({...raw,moisture:water});
  const currentCSV=weatherState(converted.hours[index]);
  const currentIce=weatherState({...raw,moisture:ice});
  assert.ok(currentDirect&&currentCSV&&currentIce);
  assert.ok(Math.abs(currentCSV.w-currentDirect.w)<1e-15);
  assert.ok(currentDirect.w>currentIce.w);
  assert.ok(Math.abs(currentIce.w-oldDirect)<1e-15);
  assert.equal(weatherState(unknown.hours[index]),null);
 }
});
