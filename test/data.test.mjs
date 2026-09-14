import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeather} from '../src/weather.js';
import {applyEnergyContext} from '../src/energy.js';
import {makeScenario} from '../src/config.js';
import {parseImport} from '../src/export.js';
const units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const sample=time=>({time,tempC:20,rh:.6,pressurePa:101325,ghiWm2:0});
const snapshot=(hours,extra={})=>({schemaVersion:1,source:'Boundary fixture',timezone:'UTC',units,hours,...extra});
test('portable import rejects a future bundle even when nested scenarios are valid',()=>{
 const scenarios=[makeScenario()];
 assert.throws(()=>parseImport(JSON.stringify({schemaVersion:2,scenarios})),/Unsupported.*schema/);
});
test('inferred CSV bounds cannot expand into an unbounded missing-hour grid',()=>{
 const csv='time,tempC,rh,pressurePa,ghiWm2\n1970-01-01T00:00:00Z,20,.6,101325,0\n9999-01-01T00:00:00Z,20,.6,101325,0';
 assert.throws(()=>normalizeWeather(csv),/30 years/);
});
test('civil spring and fall date ranges preserve 23 and 25 UTC hours',()=>{
 for(const[date,first,count]of [['2025-03-09',Date.UTC(2025,2,9,6),23],['2025-11-02',Date.UTC(2025,10,2,5),25]]){
 const s=normalizeWeather(snapshot(Array.from({length:count},(_,i)=>sample(first+i*3600000)),{timezone:'America/Chicago',startDate:date,endDate:date}));
 assert.equal(s.hours.length,count);assert.equal(new Set(s.hours.map(h=>h.time)).size,count);
 }
});
test('gap and blank import cells remain missing, duplicate timestamps reject',()=>{
 const t=Date.UTC(2025,0,1),s=normalizeWeather(snapshot([sample(t),sample(t+7200000)]));
 assert.equal(s.hours.length,3);assert.equal(s.hours[1].tempC,null);
 assert.throws(()=>normalizeWeather(snapshot([sample(t),sample(t)])));
 const csv='time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,,.6,101325,0';
 assert.equal(normalizeWeather(csv).hours[0].tempC,null);
});
test('authoritative source RH survives an auxiliary frost-point disagreement',()=>{
 const h={...sample(0),tempC:-30,dewPointC:-30,rh:.75};
 const result=normalizeWeather(snapshot([h]));
 assert.equal(result.hours[0].rh,.75);
 assert.equal(result.hours[0].dewPointC,-30);
});
test('partial-day snapshots do not grow unobserved trailing hours on import',()=>{
 const start=Date.UTC(2025,0,1),end=start+3*3600000;
 const s=normalizeWeather(snapshot([sample(start),sample(end-3600000)],{startDate:'2025-01-01',endDate:'2025-01-01',startUTC:new Date(start).toISOString(),endExclusiveUTC:new Date(end).toISOString()}));
 assert.equal(s.hours.length,3);assert.equal(normalizeWeather(s).hours.length,3);
});
const result=(priceMode='state')=>({scenario:{...makeScenario(),priceMode,electricityPrice:.9,fuelPrice:.1,waterPrice:.01,timezone:'America/Chicago'},hours:[{time:Date.UTC(2025,1,1,5),valid:true,electricKWh:10,fuelKWh:2,waterL:3},{time:Date.UTC(2025,1,1,6),valid:true,electricKWh:10,fuelKWh:2,waterL:3}],summary:{monthly:[],daily:[]},warnings:[]});
const context={prices:[{period:'2025-01',usdPerKWh:.1},{period:'2025-02',usdPerKWh:.2}],grid:{year:2023,co2KgPerKWh:.4},warnings:[]};
test('billing months follow local calendar, not UTC month',()=>{
 const r=applyEnergyContext(result(),context);
 assert.equal(r.hours[0].pricePeriod,'2025-01');assert.equal(r.hours[1].pricePeriod,'2025-02');
 assert.ok(Math.abs(r.summary.cost-3.46)<1e-10);
 assert.equal(r.summary.co2Kg,null);
 assert.equal(applyEnergyContext(r,context).summary.cost,r.summary.cost);
});
test('missing historical prices remain unknown rather than using manual fallback',()=>{
 const r=applyEnergyContext(result(),{...context,prices:context.prices.slice(0,1)});
 assert.equal(r.summary.cost,null);assert.equal(r.summary.priceMissingHours,1);
 assert.equal(r.hours[1].electricityPriceUsdPerKWh,null);
 assert.ok(Math.abs(r.summary.knownCost-1.46)<1e-10);
});
test('manual price overrides catalog rates without losing provenance',()=>{
 const r=applyEnergyContext(result('manual'),context);
 assert.ok(Math.abs(r.summary.cost-18.46)<1e-10);
 assert.equal(r.energyContext.appliedPriceMode,'manual');
 assert.equal(r.hours[0].pricePeriod,'manual');
});
