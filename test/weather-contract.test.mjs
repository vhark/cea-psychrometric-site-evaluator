import test from 'node:test';
import assert from 'node:assert/strict';
import * as weather from '../src/weather.js';
import {simulateScenario} from '../src/simulate.js';
import {makeScenario} from '../src/config.js';

const HOUR=3600000, time=Date.UTC(2025,0,1);
const units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const legacy=(extra={})=>({schemaVersion:1,source:'NASA POWER',sourceKind:'gridded reanalysis + satellite solar',
 latitude:40,longitude:-105,timezone:'UTC',units,retrievedAt:'2025-01-03T00:00:00Z',
 hours:[{time,tempC:20,rh:.6,pressurePa:84000,ghiWm2:100,windMs:2,quality:['original-fixture']}],...extra});

test('legacy weather migrates without changing values or inventing observation provenance',()=>{
 const input=legacy(), output=weather.normalizeWeather(input);
 assert.equal(output.schemaVersion,2);
 assert.equal(input.schemaVersion,1);
 assert.equal(output.provider.id,'nasa');
 assert.equal(output.dataKind,'reanalysis');
 assert.equal(output.hours[0].tempC,20);
 assert.equal(output.hours[0].intervalStart,time);
 assert.equal(output.hours[0].intervalEnd,time+HOUR);
 assert.ok(output.hours[0].quality.includes('original-fixture'));
 const unknown=weather.normalizeWeather(legacy({source:'My CSV',sourceKind:'user-supplied, unverified'}));
 assert.equal(unknown.dataKind,'unknown');
 assert.equal(unknown.variables.tempC.evidence,'unknown');
 assert.equal(unknown.variables.ghiWm2.aggregation,'unknown');
});

test('schema two round trips retain variable timing and forecast clocks separately',()=>{
 const input=legacy({schemaVersion:2,provider:{id:'visualcrossing',product:'timeline',model:null,stationId:null},
 dataKind:'forecast',forecast:{issuedAt:'2024-12-31T18:00:00Z',runId:'model-run-1'},
 variables:{ghiWm2:{unit:'W/m2',aggregation:'mean',sourceTiming:'interval-start',evidence:'forecast',source:'Visual Crossing',derivation:'solarenergy MJ/m2 * 1e6 / interval seconds'}},
 hours:[{...legacy().hours[0],dataKind:'forecast',source:'fcst',intervalStart:time,intervalEnd:time+HOUR}]});
 const normalized=weather.normalizeWeather(input);
 assert.equal(normalized.forecast.issuedAt,input.forecast.issuedAt);
 assert.notEqual(normalized.forecast.issuedAt,normalized.retrievedAt);
 assert.equal(normalized.variables.ghiWm2.aggregation,'mean');
 assert.deepEqual(weather.normalizeWeather(JSON.parse(JSON.stringify(normalized))),normalized);
});

test('invalid interval and provenance declarations fail instead of becoming hourly observations',()=>{
 const base=legacy({schemaVersion:2});
 assert.throws(()=>weather.normalizeWeather({...base,dataKind:'definitely-real'}),/data kind/i);
 assert.throws(()=>weather.normalizeWeather({...base,hours:[{...base.hours[0],intervalEnd:time+HOUR/2}]}),/interval/i);
 assert.throws(()=>weather.normalizeWeather({...base,forecast:{issuedAt:'yesterday'}}),/issuedAt/i);
 assert.throws(()=>weather.normalizeWeather({...base,variables:{ghiWm2:{unit:'kW/m2',aggregation:'mean'}}}),/unit/i);
});

test('raw forecast source cannot be hidden under an observation label',()=>{
 const value=weather.normalizeWeather(legacy({schemaVersion:2,dataKind:'observation',
 hours:[{...legacy().hours[0],source:'fcst',dataKind:'observation'}]}));
 assert.equal(value.hours[0].dataKind,'forecast');
 assert.equal(value.dataKind,'forecast');
});

test('the simulation refuses past forecasts and unlabelled future data as historical weather',()=>{
 const scenario={...makeScenario('greenhouseDouble'),latitude:40,longitude:-105,timezone:'UTC',outsideAirReviewed:true};
 for(const kind of ['forecast','historical-forecast','statistical']){
  assert.throws(()=>simulateScenario(scenario,legacy({dataKind:kind})),/historical|forecast/i);
 }
 assert.throws(()=>simulateScenario(scenario,legacy({hours:[{...legacy().hours[0],time:Date.UTC(2099,0,1)}]})),/future|historical/i);
});

test('snapshot identities survive serialization but change with values, provenance or issuance',async()=>{
 assert.equal(typeof weather.sealWeatherSnapshot,'function');
 const a=await weather.sealWeatherSnapshot(weather.normalizeWeather(legacy()));
 const b=await weather.sealWeatherSnapshot(weather.normalizeWeather(JSON.parse(JSON.stringify(a))));
 assert.match(a.id,/^weather:sha256:[a-f0-9]{64}$/);
 assert.equal(a.id,b.id);
 const modified=weather.normalizeWeather(legacy());modified.hours[0].tempC=21;
 assert.notEqual((await weather.sealWeatherSnapshot(modified)).id,a.id);
 const retrieved=weather.normalizeWeather(legacy({retrievedAt:'2025-01-04T00:00:00Z'}));
 assert.notEqual((await weather.sealWeatherSnapshot(retrieved)).id,a.id);
 const input=weather.normalizeWeather(legacy());await weather.sealWeatherSnapshot(input);
 assert.equal(input.id,undefined,'sealing must not mutate the editable source');
});

test('Visual Crossing preserves forecast source and does not infer modeling from absent stations',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,status:200,text:async()=>JSON.stringify(String(url).includes('elevation')?
  {elevation:[1600]}:{timezone:'UTC',days:[{hours:[{datetimeEpoch:time/1000,temp:20,humidity:60,pressure:1013,
   solarradiation:700,solarenergy:1.8,windspeed:3.6,source:'fcst',stations:[]}]}]})});
 try{
  const snap=await weather.fetchWeather({provider:'visualcrossing',latitude:40,longitude:-105,timezone:'UTC',
   startDate:'2025-01-01',endDate:'2025-01-01',apiKey:'fixture-not-a-secret'});
  assert.equal(snap.dataKind,'forecast');
  assert.equal(snap.hours[0].source,'fcst');
  assert.equal(snap.hours[0].dataKind,'forecast');
  assert.equal(snap.forecast.issuedAt,null);
  assert.equal(snap.hours[0].ghiWm2,500,'1.8 MJ over 3600 seconds is 500 W/m2');
  assert.equal(snap.variables.ghiWm2.aggregation,'mean');
  assert.match(snap.variables.pressurePa.derivation,/sea.level/i);
  assert.ok(!JSON.stringify(snap).includes('fixture-not-a-secret'));
 }finally{globalThis.fetch=prior;}
});

test('unknown Visual Crossing lineage stays unknown and radiation fallback stays instantaneous',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,status:200,text:async()=>JSON.stringify(String(url).includes('elevation')?
  {elevation:[0]}:{timezone:'UTC',days:[{hours:[{datetimeEpoch:time/1000,temp:20,humidity:60,pressure:1013,
   solarradiation:700,windspeed:3.6,stations:[]}]}]})});
 try{
  const snap=await weather.fetchWeather({provider:'visualcrossing',latitude:40,longitude:-105,timezone:'UTC',
   startDate:'2025-01-01',endDate:'2025-01-01',apiKey:'fixture-not-a-secret'});
  assert.equal(snap.hours[0].dataKind,'unknown');
  assert.equal(snap.hours[0].variableQuality.ghiWm2.aggregation,'instantaneous');
  assert.equal(snap.hours[0].quality.includes('no-contributing-station-value-is-modelled'),false);
 }finally{globalThis.fetch=prior;}
});

test('dateless imports retain local calendar bounds after normalization and resealing',async()=>{
 for(const timezone of ['America/Denver','Asia/Tokyo']) {
  const first=weather.normalizeWeather(legacy({timezone}));
  const next=weather.normalizeWeather(first);
  assert.deepEqual(next,first);
  assert.equal((await weather.sealWeatherSnapshot(next)).id,(await weather.sealWeatherSnapshot(first)).id);
 }
});
test('forecast variable evidence cannot bypass historical eligibility under observed labels',()=>{
 const scenario={...makeScenario('greenhouseDouble'),latitude:40,longitude:-105,timezone:'UTC',outsideAirReviewed:true};
 for(const evidence of ['forecast','historical-forecast','statistical']) {
  for(const changes of [{variables:{tempC:{evidence}}},{hours:[{...legacy().hours[0],variableQuality:{rh:{evidence}}}]}]) {
   assert.throws(()=>simulateScenario(scenario,legacy({dataKind:'observation',...changes})),/forecast|historical/i);
  }
 }
});
test('malformed metadata containers and invalid issuance dates are rejected',()=>{
 for(const extra of [{variables:[]},{variables:{typo:{}}},{transformations:{}},{forecast:{issuedAt:'2025-02-30T00:00:00Z'}},
  {hours:[{...legacy().hours[0],variableQuality:'forecast'}]}]){
  assert.throws(()=>weather.normalizeWeather(legacy(extra)));
 }
});
