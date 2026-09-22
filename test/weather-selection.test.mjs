import test from 'node:test';
import assert from 'node:assert/strict';
import {selectWeatherYears, selectCachedWeather, weatherRequest} from '../src/weather-selection.js';
const site={latitude:40,longitude:-105,timezone:'UTC'};
const request={...site,provider:'nasa',startDate:'2025-01-01',endDate:'2025-12-31'};
const entry=(extra={})=>({...site,provider:{id:'nasa',product:'power-hourly',model:'MERRA-2 + SYN1deg',stationId:null},
 startDate:request.startDate,endDate:request.endDate,dataKind:'reanalysis',source:'NASA POWER',retrievedAt:'2026-01-01T00:00:00Z',key:'original',...extra});
test('year selection separates providers, models, stations, exact locations, clocks and forecasts',()=>{
 const bad=[{provider:{id:'openmeteo'}},{provider:{id:'nasa',model:'other'}},{timezone:'America/Denver'},
 {latitude:40.0001},{dataKind:'forecast'},{migrationError:'invalid'}].map(extra=>entry({...extra,key:'wrong'}));
 assert.equal(selectWeatherYears([entry(),...bad],null,request).get('2025').key,'original');
 const stations=[entry({provider:{id:'iem',product:'asos',model:'ASOS',stationId:'AAA'},key:'a'}),
 entry({provider:{id:'iem',product:'asos',model:'ASOS',stationId:'BBB'},key:'b'})];
 assert.equal(selectCachedWeather(stations,{...request,provider:'iem',station:'BBB'}).key,'b');
});
test('latest matching revision is deterministic and explicitly loaded revision remains pinned',()=>{
 const newer=entry({key:'newer',retrievedAt:'2026-02-01T00:00:00Z'}),old=entry();
 assert.equal(selectCachedWeather([newer,old],request).key,'newer');
 assert.equal(selectWeatherYears([newer],{...old,id:'original',hours:[]},request).get('2025').kind,'loaded');
 assert.equal(selectWeatherYears([newer],{...old,provider:{id:'iem'},hours:[]},request).get('2025').key,'newer');
});
test('shared acquisition options forward provider credentials for both year and range requests',()=>{
 for(const period of [{startDate:'2025-01-01',endDate:'2025-12-31'},{startDate:'2025-04-01',endDate:'2025-04-02'}]){
  const result=weatherRequest(site,period,{provider:'visualcrossing',station:'',apiKey:'test-only'});
  assert.equal(result.apiKey,'test-only');assert.equal(result.provider,'visualcrossing');assert.equal(result.startDate,period.startDate);
 }
});
test('selection accepts real cache metadata with an hour count instead of hour records',async()=>{
 const {weatherMetadata}=await import('../src/storage.js');
 const metadata=weatherMetadata({...entry(),hours:[{time:Date.UTC(2025,0,1),tempC:20}]},'cached-id');
 assert.equal(metadata.hours,1);
 assert.equal(selectCachedWeather([metadata],request)?.key,'cached-id');
 assert.equal(selectWeatherYears([metadata],null,request).get('2025')?.key,'cached-id');
});
test('automatic NCEI station selection pins subsequent annual requests',async()=>{
 const {pinResolvedStation}=await import('../src/weather-selection.js');
 const options={provider:'ncei',station:'',apiKey:''};
 const pinned=pinResolvedStation(options,{provider:{id:'ncei',stationId:'72469903065'}});
 assert.equal(pinned.station,'72469903065');
 assert.equal(weatherRequest(site,request,pinned).station,'72469903065');
 assert.equal(options.station,'');
 assert.throws(()=>pinResolvedStation(pinned,{provider:{id:'ncei',stationId:'other'}}),/station/i);
});
test('background acquisition intent survives request construction',()=>{
 assert.equal(weatherRequest({latitude:40,longitude:-105,timezone:'UTC'},{startDate:'2025-01-01',endDate:'2025-12-31'},{provider:'visualcrossing',latest:false}).latest,false);
});
