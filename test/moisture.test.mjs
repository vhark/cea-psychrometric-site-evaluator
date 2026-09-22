import test from 'node:test';
import assert from 'node:assert/strict';
import * as moisture from '../src/moisture.js';
import {normalizeWeather,sealWeatherSnapshot,reprocessWeather} from '../src/weather.js';
import {weatherState} from '../src/physics.js';
const time=Date.UTC(2025,0,1),units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const basis={authoritative:'dewPointC',rhReference:'water',dewPointReference:'water'};
const row={time,tempC:-10,dewPointC:-20,pressurePa:101325,ghiWm2:0};
const snapshot=()=>({schemaVersion:1,source:'test',timezone:'UTC',units,hours:[row]});
test('declared liquid-water dewpoint has identical CSV, JSON and direct state interpretation',()=>{
 const direct=weatherState({...row,moisture:basis});
 assert.ok(direct);
 const csv='time,tempC,dewPointC,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,-10,-20,101325,0';
 for(const input of [csv,{...snapshot(),moisture:basis}]){
  const normalized=normalizeWeather(input,{timezone:'UTC',moisture:basis});
  const state=weatherState(normalized.hours[0]);
  assert.ok(Math.abs(state.w-direct.w)<1e-10);
  assert.deepEqual(normalizeWeather(normalized),normalized);
 }
});
test('unresolved cold-water phase is explicit; dry air and warm unknown RH remain usable',()=>{
 assert.equal(moisture.resolveMoisture({...row,authoritative:'dewPointC',dewPointReference:'unknown'}).valid,false);
 assert.equal(moisture.resolveMoisture({tempC:-10,rh:.5,pressurePa:84000,authoritative:'rh',rhReference:'unknown'}).humidityRatio,null);
 assert.equal(moisture.resolveMoisture({tempC:20,rh:0,pressurePa:84000,authoritative:'rh',rhReference:'unknown'}).humidityRatio,0);
 assert.equal(moisture.resolveMoisture({tempC:20,rh:.5,pressurePa:84000,authoritative:'rh',rhReference:'unknown'}).valid,true);
});
test('authoritative RH survives auxiliary disagreement and invalid inputs remain invalid',()=>{
 const input={tempC:20,rh:.4,dewPointC:25,pressurePa:84000,authoritative:'rh',rhReference:'water',dewPointReference:'water'};
 const result=moisture.resolveMoisture(input);
 assert.equal(result.valid,true);assert.ok(result.warnings.length);
 assert.equal(result.vaporPressurePa,moisture.saturationVaporPressure(20,'water')*.4);
 for(const extra of [{rh:1.1},{pressurePa:0},{tempC:NaN},{rh:null},{rhReference:'liquid-ish'}]) assert.equal(moisture.resolveMoisture({...input,...extra}).valid,false);
 assert.equal(moisture.resolveMoisture({...input,authoritative:'dewPointC'}).valid,false);
});
test('reprocessing creates a child and does not rewrite legacy sealed evidence',async()=>{
 const old=await sealWeatherSnapshot(normalizeWeather({...snapshot(),hours:[{...row,rh:.4386181453}]}));
 const before=JSON.stringify(old);
 const child=await reprocessWeather(old,basis);
 assert.equal(JSON.stringify(old),before);
 assert.equal(child.parentSnapshotId,old.id);assert.notEqual(child.id,old.id);
 assert.equal(child.conversionVersion,moisture.MOISTURE_VERSION);
 assert.equal((await sealWeatherSnapshot(normalizeWeather(old))).id,old.id);
});
test('invalid moisture declarations cannot enter a sealed canonical record',()=>{
 for(const extra of [{authoritative:'guess'},{rhReference:'mixed'},{dewPointReference:42}]){
  assert.throws(()=>normalizeWeather({...snapshot(),moisture:{...basis,...extra}}),/moisture|reference|authoritative/i);
 }
});
test('published reference pressures and independent moisture vectors bound conversion error',async()=>{
 const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/psychrometric-reference.json',import.meta.url),'utf8'));
 for(const vector of fixture.saturation){
  const actual=moisture.saturationVaporPressure(vector.temperatureC,vector.phase);
  assert.ok(Math.abs(actual-vector.expectedPa)<=Math.max(vector.absoluteTolerancePa,vector.relativeTolerance*vector.expectedPa),vector.id);
 }
 for(const vector of fixture.humidityRatio){
  const result=moisture.resolveMoisture({tempC:vector.temperatureC,rh:vector.relativeHumidity,pressurePa:vector.pressurePa,authoritative:'rh',rhReference:vector.phase});
  assert.ok(result.valid,vector.id);
  assert.ok(Math.abs(result.humidityRatio-vector.expectedHumidityRatio)<=Math.max(vector.absoluteTolerance,vector.relativeTolerance*vector.expectedHumidityRatio),vector.id);
 }
});
test('schema two declared phase is used even when only snapshot-level metadata is supplied',()=>{
 const input={...snapshot(),schemaVersion:2,moisture:basis};
 const normalized=normalizeWeather(input);
 assert.ok(Math.abs(weatherState(normalized.hours[0]).w-weatherState({...row,moisture:basis}).w)<1e-10);
});
test('legacy null RH retains dewpoint fallback while explicit RH does not',()=>{
 assert.ok(weatherState({...row,rh:null}));
 assert.equal(weatherState({...row,rh:null,moisture:{...basis,authoritative:'rh'}}),null);
 assert.equal(moisture.resolveMoisture({tempC:2000,rh:0,pressurePa:101325}).valid,false);
});
test('auxiliary RH cannot invalidate authoritative dewpoint or break sealed round trips',async()=>{
 for(const values of [{tempC:-10,dewPointC:-10.5},{tempC:20,dewPointC:10}]){
  const s=normalizeWeather({...snapshot(),moisture:{...basis,rhReference:'ice'},hours:[{...row,...values}]});
  assert.equal(s.hours[0].rh,null);
  assert.ok(weatherState(s.hours[0]));
  assert.equal((await sealWeatherSnapshot(normalizeWeather(await sealWeatherSnapshot(s)))).id,(await sealWeatherSnapshot(s)).id);
 }
 const s=normalizeWeather({...snapshot(),moisture:basis});
 assert.equal(weatherState(s.hours[0]).rh,s.hours[0].rh);
});
test('stable equilibrium inverse is not clipped to dry bulb for ice supersaturation',()=>{
 const pv=moisture.saturationVaporPressure(-10,'water');
 const t=moisture.equilibriumTemperature(pv);
 assert.ok(t>-10);
 assert.ok(Math.abs(moisture.saturationVaporPressure(t,'ice')-pv)<1e-6);
});
