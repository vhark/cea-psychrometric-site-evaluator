import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWeather} from '../src/weather.js';
import {applyEnergyContext} from '../src/energy.js';
import {makeScenario,migrateScenario,SCENARIO_SCHEMA_VERSION,validateScenario} from '../src/config.js';
import {downloadRun,downloadScenario,parseImport} from '../src/export.js';
const units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const sample=time=>({time,tempC:20,rh:.6,pressurePa:101325,ghiWm2:0});
const snapshot=(hours,extra={})=>({schemaVersion:1,source:'Boundary fixture',timezone:'UTC',units,hours,...extra});
test('new scenarios and every portable JSON export use schema version 2',async()=>{
 assert.equal(SCENARIO_SCHEMA_VERSION,2);
 const scenario=makeScenario();
 assert.equal(scenario.schemaVersion,2);
 const downloads=[];
 const priorDocument=globalThis.document,priorCreate=URL.createObjectURL,priorRevoke=URL.revokeObjectURL,priorTimeout=globalThis.setTimeout;
 globalThis.document={createElement:()=>({click(){}})};
 URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};
 URL.revokeObjectURL=()=>{};globalThis.setTimeout=callback=>{callback();return 0;};
 try{
  downloadScenario(scenario);
  downloadRun([{scenario,hours:[],summary:{},warnings:[]}],snapshot([]));
  const payloads=await Promise.all(downloads.map(blob=>blob.text().then(JSON.parse)));
  assert.deepEqual(payloads.map(data=>data.schemaVersion),[2,2]);
  assert.ok(payloads.every(data=>data.scenarios.every(item=>item.schemaVersion===2)));
 }finally{
  globalThis.document=priorDocument;URL.createObjectURL=priorCreate;URL.revokeObjectURL=priorRevoke;globalThis.setTimeout=priorTimeout;
 }
});
test('portable import rejects future bundle and nested scenario versions',()=>{
 const scenarios=[makeScenario()];
 assert.throws(()=>parseImport(JSON.stringify({schemaVersion:3,scenarios})),/Unsupported.*schema/);
 assert.throws(()=>parseImport({schemaVersion:2,scenarios:[{...scenarios[0],schemaVersion:3}]}),/Unsupported.*schema/);
 assert.throws(()=>migrateScenario({...scenarios[0],schemaVersion:3}),/Unsupported.*schema/);
});
test('portable import migrates version 1 scenarios and discards imported result claims',()=>{
 const current=makeScenario('greenhouseDouble');
 const legacy={...current,schemaVersion:1,infiltrationACH:.62,minVentACH:.41,maxVentACH:31,doasM3s:0,doasKWhPerKg:.5};
 delete legacy.heatRecovery;delete legacy.outsideAirBasis;delete legacy.outsideAirReviewed;
 const imported=parseImport({schemaVersion:1,scenarios:[legacy],snapshot:{schemaVersion:1,hours:[]},results:[{scenario:legacy,summary:{cost:0}}]});
 assert.equal(imported.scenarios[0].schemaVersion,2);
 assert.equal(imported.scenarios[0].heatRecovery.type,'none');
 assert.deepEqual(
  [imported.scenarios[0].infiltrationACH,imported.scenarios[0].minVentACH,imported.scenarios[0].maxVentACH],
  [.62,.41,31],
 );
 assert.equal(Object.hasOwn(imported.scenarios[0],'doasKWhPerKg'),false);
 assert.equal(Object.hasOwn(imported,'results'),false);
 assert.deepEqual(imported.snapshot,{schemaVersion:1,hours:[]});
 assert.equal(legacy.schemaVersion,1,'migration must not mutate imported input');
 const currentBundle=parseImport({schemaVersion:2,scenarios:[current]});
 assert.equal(currentBundle.scenarios[0].schemaVersion,2);
 assert.throws(()=>parseImport({schemaVersion:1,results:[{scenario:legacy}]}),/Import needs/);
 const unreviewed={...current,outsideAirBasis:'projectInput'};delete unreviewed.outsideAirReviewed;
 const migratedUnreviewed=migrateScenario(unreviewed);
 assert.equal(migratedUnreviewed.outsideAirReviewed,false);
 assert.match(validateScenario(migratedUnreviewed).join(' '),/review/i);
});
test('version 1 DOAS airflow becomes unreviewed candidate treatment capacity',()=>{
 const legacy={...makeScenario('greenhouseDouble'),schemaVersion:1,technology:'doas',doasM3s:1.25,
  doasSupplyDewPointC:8,doasSupplyTempC:21,doasKWhPerKg:.5};
 const migrated=migrateScenario(legacy);
 assert.equal(migrated.schemaVersion,2);
 assert.equal(migrated.doasM3s,1.25);
 assert.equal(migrated.doasSupplyDewPointC,null);
 assert.equal(migrated.doasSupplyTempC,null);
 assert.equal(migrated.doasCoolingCOP,null);
 assert.equal(migrated.doasReheatRecoveryFraction,null);
 assert.equal(migrated.outsideAirReviewed,false);
 assert.ok(validateScenario(migrated).length>0,'legacy DOAS must stay blocked until reviewed and completed');
 assert.equal(Object.hasOwn(migrated,'doasKWhPerKg'),false);
 assert.equal(legacy.doasKWhPerKg,.5,'migration must not mutate the version 1 object');
 const zero=migrateScenario({...legacy,doasM3s:0,outsideAirReviewed:true});
 assert.equal(zero.doasM3s,0);
 assert.equal(zero.doasSupplyDewPointC,null);
 assert.equal(zero.doasSupplyTempC,null);
 assert.equal(zero.outsideAirReviewed,false);
 const omittedInput={...legacy,outsideAirReviewed:true};delete omittedInput.doasM3s;
 const omitted=migrateScenario(omittedInput);
 assert.equal(omitted.doasM3s,0);
 assert.equal(omitted.doasSupplyDewPointC,null);
 assert.equal(omitted.doasSupplyTempC,null);
 assert.equal(omitted.outsideAirReviewed,false);
 const generic=migrateScenario({...makeScenario('greenhouse'),schemaVersion:1,outsideAirBasis:'literatureRange',outsideAirReviewed:true});
 assert.equal(generic.outsideAirBasis,'screeningAssumption');
 assert.equal(generic.outsideAirReviewed,false);
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
