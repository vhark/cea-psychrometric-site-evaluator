import test from 'node:test';
import assert from 'node:assert/strict';
import {WeatherClient} from '../src/weather-client.js';

// Execute the real DOM-free worker handler with a message bridge. No IndexedDB in
// Node deliberately models unavailable storage; provider fetch is fixture-backed.
const scope=new EventTarget();globalThis.self=scope;
class Bridge extends EventTarget {
 postMessage(data){queueMicrotask(()=>scope.dispatchEvent(new MessageEvent('message',{data})));}
 terminate(){}
}
const bridge=new Bridge();scope.postMessage=data=>bridge.dispatchEvent(new MessageEvent('message',{data}));
await import('../src/weather-worker.js');
const client=new WeatherClient({worker:bridge});
const fixture={schemaVersion:1,source:'Synthetic worker test',sourceKind:'synthetic',timezone:'UTC',latitude:40,longitude:-105,
 startDate:'2025-01-01',endDate:'2025-01-01',units:{time:'UTC epoch milliseconds',tempC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2'},
 raw:{evidence:'original provider payload'},hours:[{time:Date.UTC(2025,0,1),tempC:20,rh:.5,pressurePa:84000,ghiWm2:0}]};
let current;

test('storage denial retains verified original in worker memory for load, listing and raw export',async()=>{
 current=await client.import(new Blob([JSON.stringify(fixture)]));
 assert.match(current.cacheWarning,/storage|reload/i);
 assert.equal(current.transport.rawOmitted,true);
 assert.equal((await client.load()).id,current.id);
 assert.equal((await client.load(current.id)).id,current.id);
 assert.ok((await client.list()).some(row=>row.key===current.id));
 const raw=JSON.parse(await (await client.export(current.id)).text());
 assert.equal(raw.id,current.id);
 assert.deepEqual(raw.raw,fixture.raw);
 assert.equal(raw.cacheWarning,undefined);
});

test('parseFile auto-detects weather JSON and CSV without portable scenarios',async()=>{
 assert.equal(typeof client.parseFile,'function','Client exposes worker-side file auto detection');
 const json=await client.parseFile(new Blob([JSON.stringify(fixture)]),{timezone:'UTC'});
 assert.deepEqual(json.scenarios,[]);
 assert.equal(json.snapshot.id,current.id);
 const csv=await client.parseFile(new Blob(['time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,20,0.5,84000,0']),{timezone:'UTC'});
 assert.deepEqual(csv.scenarios,[]);
 assert.equal(csv.snapshot.hours[0].rh,.5);
 assert.equal(csv.snapshot.timezone,'UTC');
});

test('background provider retrieval with latest:false preserves the active dataset in memory',async()=>{
 const before=await client.load(),prior=globalThis.fetch;
 const fields={temperature_2m:['°C',20],relative_humidity_2m:['%',50],dew_point_2m:['°C',10],surface_pressure:['hPa',840],shortwave_radiation:['W/m²',0],wind_speed_10m:['km/h',7.2]};
 const payload={hourly:{time:['2025-01-02T00:00']},hourly_units:{}};
 for(const [field,[unit,value]] of Object.entries(fields))for(const model of ['era5_land','era5']){
  payload.hourly_units[`${field}_${model}`]=unit;payload.hourly[`${field}_${model}`]=[value];
 }
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)});
 try{
  const fetched=await client.fetch({provider:'openmeteo',latitude:40,longitude:-105,timezone:'UTC',startDate:'2025-01-02',endDate:'2025-01-02',latest:false});
  assert.notEqual(fetched.id,before.id);
  assert.equal((await client.load()).id,before.id);
  assert.equal((await client.load(fetched.id)).id,fetched.id);
 }finally{globalThis.fetch=prior;}
});

test.after(()=>{client.close();delete globalThis.self;});
test('historical-only import rejects forecasts before changing the active pointer',async()=>{
 const before=await client.load();
 await assert.rejects(client.parseFile(new Blob([JSON.stringify({...fixture,dataKind:'forecast',hours:fixture.hours.map(h=>({...h,dataKind:'forecast'}))})]),{historicalOnly:true}),/historical|forecast/i);
 assert.equal((await client.load()).id,before.id);
});
