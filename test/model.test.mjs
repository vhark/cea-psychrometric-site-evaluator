import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeScenario,validateScenario,applyTechnology,DEFAULT_SCENARIO} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {compareScenarios} from '../src/metrics.js';
import {weatherState,padState,humidityRatio,enthalpy,stanghelliniTranspiration,saturationPressure,saturationHumidityRatio,dryAirDensity} from '../src/physics.js';
// Two synthetic days with diurnal temperature, humidity and solar forcing, a cool spring shape.
const diurnal=(hours=48,mean=18,amp=6)=>({schemaVersion:1,source:'Synthetic diurnal fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-04-01',endDate:'2025-04-02',
 hours:Array.from({length:hours},(_,i)=>{const h=i%24,sun=Math.max(0,Math.sin(Math.PI*(h-6)/14));
  return {time:Date.UTC(2025,3,1,i),tempC:mean+amp*Math.sin(Math.PI*(h-9)/12),rh:.8-.3*sun,pressurePa:98500,ghiWm2:Math.round(800*sun)};})});
const weather=(hours=24,changes={})=>({schemaVersion:1,source:'Synthetic boundary-test fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01',hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:22,rh:.6,pressurePa:101325,ghiWm2:0,...changes}))});
const closed=(overrides={})=>({...makeScenario('indoor'),timezone:'UTC',areaM2:100,canopyM2:100,heightM:4,dayTargetC:22,nightTargetC:22,tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,uValue:.05,infiltrationACH:0,minVentACH:0,maxVentACH:0,lightWm2:0,dliTarget:0,transpirationModel:'schedule',transpirationLDayM2:0,cropSensibleWm2:0,coolingKW:0,dehuKgH:0,heaterKW:0,humidifierKgH:0,...overrides});
test('invalid control ranges cannot silently become a viable scenario',()=>{
 assert.ok(validateScenario(closed({minVentACH:10,maxVentACH:1})).length>0);
 assert.ok(validateScenario(closed({vpdMin:2,vpdMax:1})).length>0);
});
test('missing weather stays missing instead of producing compliant hours',()=>{
 const w=weather(6);w.hours[2].tempC=null;w.hours[3].rh=null;
 const result=simulateScenario(closed(),w);
 assert.equal(result.hours.filter(h=>!h.valid).length,2);
 assert.equal(result.summary.missingHours,2);
 assert.ok(result.summary.compliantHours<=result.summary.validHours);
});
test('opaque indoor crops receive no natural DLI even under high outside solar',()=>{
 const result=simulateScenario(closed(),weather(24,{ghiWm2:900}));
 assert.equal(result.hours.reduce((sum,h)=>sum+(h.solarDLI||0),0),0);
});
test('electrical lighting cannot exceed installed power times photoperiod',()=>{
 const s=closed({lightWm2:40,photoperiod:12,dayStart:6,dliTarget:60,coolingKW:100,heaterKW:100});
 const result=simulateScenario(s,weather());
 const energy=result.hours.reduce((sum,h)=>sum+(h.lightKWh||0),0);
 assert.ok(energy>40,`Expected useful fixture operation, got ${energy} kWh`);
 assert.ok(energy<=48.001,`Exceeded 4 kW × 12 hours: ${energy}`);
});
test('pad runtime is counted only when installed and only where pad leaving air helps',()=>{
 const hot=weather(24,{tempC:34,rh:.2,ghiWm2:600});
 const base={...makeScenario('greenhouse'),timezone:'UTC',dayTargetC:24,nightTargetC:24,tempToleranceC:2,coolingKW:0,dehuKgH:0,heaterKW:0};
 const withPad=simulateScenario({...base,padEnabled:true},hot).summary,without=simulateScenario({...base,padEnabled:false},hot).summary;
 assert.equal(without.runtime.pad.hours,0);assert.equal(without.padWaterL,0);
 assert.ok(withPad.runtime.pad.hours>0&&withPad.padWaterL>0,'pad must run under hot dry outdoor air');
 assert.equal(withPad.runtime.pad.days,1);
 assert.ok(withPad.runtime.pad.equivalentHours<=withPad.runtime.pad.hours+1e-9);
 assert.ok(withPad.compliantHours>=without.compliantHours,'pad must not reduce attainment under hot dry air');
});
test('outdoor air is a dehumidifier only when drier than the zone ceiling, with a heating penalty when cold',()=>{
 const s={...makeScenario('greenhouse'),timezone:'UTC',dehuLPerKWh:2.5};
 const cold=simulateScenario(s,weather(6,{tempC:2,rh:.5})).weatherSummary.outdoorDrying;
 const humid=simulateScenario(s,weather(6,{tempC:24,rh:.95})).weatherSummary.outdoorDrying;
 assert.equal(cold.coldDry.hours,6);assert.equal(cold.coolDry.hours+cold.hotDry.hours,0);
 assert.ok(cold.coldDry.kWhPerKg>1/2.5,'heating cold ventilation air must cost more per kg than a 2.5 L/kWh dehumidifier');
 assert.equal(humid.coolDry.hours+humid.coldDry.hours+humid.hotDry.hours,0,'saturated warm air cannot dry the zone');
});
test('unmet loads are steady capacity shortfalls, not re-counted every substep',()=>{
 const s=closed({uValue:5,infiltrationACH:2,transpirationLDayM2:10});
 const w=weather(6,{tempC:35,rh:.8});
 const a=simulateScenario(s,w,{stepMinutes:1}).summary,b=simulateScenario(s,w,{stepMinutes:.5}).summary;
 assert.ok(a.unmetSensibleKWh>0&&a.unmetMoistureKg>0,'fixture must be out of band');
 assert.ok(Math.abs(a.unmetSensibleKWh-b.unmetSensibleKWh)<.05*a.unmetSensibleKWh,`sensible ${a.unmetSensibleKWh} vs ${b.unmetSensibleKWh}`);
 assert.ok(Math.abs(a.unmetMoistureKg-b.unmetMoistureKg)<.05*a.unmetMoistureKg,`moisture ${a.unmetMoistureKg} vs ${b.unmetMoistureKg}`);
});
test('an unsaturable overheated candidate is excluded, not fatal to the scenario',()=>{
 const s=closed({lightWm2:2000,photoperiod:24,dayStart:0,dliTarget:0,uValue:0,thermalMassKJm2K:1});
 const w=weather(4,{pressurePa:30000,tempC:60,rh:.05});
 const result=simulateScenario(s,w);
 assert.equal(result.hours.length,4);
 assert.ok(result.hours.every(h=>h.valid||h.numericalFailure),'hours must resolve to valid or an excluded numerical failure');
});
test('condensing dehumidification returns heat while removing moisture',()=>{
 const s=closed({transpirationLDayM2:2,dehuKgH:50,dehuLPerKWh:2.5,heaterKW:100});
 const result=simulateScenario(s,weather());
 const removed=result.hours.reduce((sum,h)=>sum+(h.condensateKg||0),0);
 const compressor=result.hours.reduce((sum,h)=>sum+(h.dehuKWh||0),0);
 const returned=result.hours.reduce((sum,h)=>sum+(h.dehuHeatKWh||0),0);
 assert.ok(removed>0,'Moisture load must reach condensing operation');
 assert.ok(compressor>0,'Condensing removal requires electrical energy');
 assert.ok(returned>compressor,'Returned sensible heat includes condensation plus compressor input');
});
test('finite unheated envelope does not claim perfect cold-weather control',()=>{
 const result=simulateScenario(closed({uValue:5,thermalMassKJm2K:50}),weather(24,{tempC:-10,rh:.5}));
 assert.ok(result.summary.compliancePct<50,`Unheated cold zone cannot hold target: ${result.summary.compliancePct}`);
});
test('desiccant regeneration is paid energy rather than free moisture removal',()=>{
 const s=closed({technology:'desiccant',transpirationLDayM2:3,desiccantKgH:50,regenerationKWhPerKg:1.2,regenerationElectricFraction:1,desiccantHeatFraction:1,heaterKW:100});
 const result=simulateScenario(s,weather());
 const regen=result.hours.reduce((sum,h)=>sum+(h.regenerationKWh||0),0);
 assert.ok(regen>0,'Desiccant must report regeneration energy');
 assert.ok(result.summary.electricKWh>=regen-1e-5,'Electric regeneration belongs in purchased electricity');
});
test('identical scenarios have no invented incremental control benefit',()=>{
 const s=closed();const a=simulateScenario(s,weather());const b=simulateScenario({...s,id:'copy',name:'Copy'},weather());
 assert.equal(a.summary.compliantHours,b.summary.compliantHours);
 assert.equal(a.summary.cost,b.summary.cost);
 const comparison=compareScenarios([a,b]);
 assert.ok(Array.isArray(comparison));
 for(const row of comparison)assert.ok(row.costPerAddedHour==null||Number.isFinite(row.costPerAddedHour),'No divide-by-zero infinity in comparison');
});
test('component choices retain finite explicit assumed capacities',()=>{
 const s=makeScenario();const d=applyTechnology(s,'desiccant');const cheap=applyTechnology(d,'pad');
 assert.ok(d.desiccantKgH>0&&d.regenerationKWhPerKg>0);
 assert.equal(cheap.desiccantKgH,0);assert.equal(cheap.coolingKW,0);assert.equal(cheap.dehuKgH,0);
});
test('canonical RH is not overwritten by an auxiliary dew or frost point',()=>{
 const hour={time:0,tempC:-10,rh:.8,dewPointC:-20,pressurePa:101325,ghiWm2:0};
 assert.equal(weatherState(hour).rh,.8);
});
test('pad process respects wet bulb, moisture and enthalpy boundaries',()=>{
 const w=humidityRatio(35,.25,101325),p=padState(35,w,101325,.8);
 assert.ok(p.tempC>=p.wetBulbC&&p.tempC<=35);
 assert.ok(p.w>=w&&p.rh<=1);
 assert.ok(Math.abs(enthalpy(35,w)-enthalpy(p.tempC,p.w))<1);
});
test('stacked greenhouse crop light cannot create photons beyond roof input',()=>{
 const s={...makeScenario(),timezone:'UTC',areaM2:100,canopyM2:400,parTransmission:1,shadeFraction:0,lightWm2:0,transpirationLDayM2:0};
 const result=simulateScenario(s,weather(1,{ghiWm2:500}));
 const cropPhotons=result.hours[0].solarDLI*s.canopyM2;
 const incidentPhotons=500*2.02*3600/1e6*s.areaM2;
 assert.ok(cropPhotons<=incidentPhotons+1e-8,`${cropPhotons} > ${incidentPhotons}`);
});
test('opaque indoor simulation does not require unused solar forcing',()=>{
 const result=simulateScenario(closed(),weather(3,{ghiWm2:null}));
 assert.equal(result.summary.validHours,3);
});
test('complete local DLI days survive half-hour time zone offsets',()=>{
 const result=simulateScenario(closed({timezone:'Asia/Kolkata',dliTarget:10}),weather(72));
 assert.equal(result.summary.daily.filter(d=>d.complete).length,2);
 assert.equal(result.summary.dliDeficitDays,2);
});
test('staged controller results converge with control cadence on the Tulsa example strategies',()=>{
 const scenarios=JSON.parse(readFileSync(new URL('../docs/example-scenarios.json',import.meta.url),'utf8')).scenarios.map(s=>{assert.deepEqual(validateScenario(s),[]);return {...s,timezone:'UTC'};});
 const w=diurnal();
 let stagedMs=0,idealMs=0;
 for(const s of scenarios){
  let t=performance.now();const a=simulateScenario(s,w,{stepMinutes:1}).summary;stagedMs+=performance.now()-t;
  const b=simulateScenario(s,w,{stepMinutes:.5}).summary;
  t=performance.now();simulateScenario({...s,controlMode:'ideal'},w,{stepMinutes:1});idealMs+=performance.now()-t;
  assert.equal(a.numericalFailureHours,0);
  assert.ok(Math.abs(a.electricKWh-b.electricKWh)<=.01*a.electricKWh,`${s.name}: electricity ${a.electricKWh} vs ${b.electricKWh}`);
  assert.ok(Math.abs(a.compliancePct-b.compliancePct)<=.5,`${s.name}: attainment ${a.compliancePct} vs ${b.compliancePct}`);
 }
 assert.ok(stagedMs<idealMs,`staged ${stagedMs} ms should be faster than ideal ${idealMs} ms`);
});
test('Stanghellini transpiration rises with VPD and absorbed radiation and vanishes without leaf area',()=>{
 const p=101325,w=vpdPa=>{const pv=saturationPressure(22)-vpdPa;return 0.621945*pv/(p-pv);};
 let previous=0;
 for(let vpd=50;vpd<=1000;vpd+=50){const mv=stanghelliniTranspiration(22,w(vpd),p,100,3);assert.ok(mv>previous,`VPD ${vpd} Pa: ${mv} <= ${previous}`);previous=mv;}
 previous=0;
 for(let R=0;R<=300;R+=25){const mv=stanghelliniTranspiration(22,w(800),p,R,3);assert.ok(mv>=previous,`R ${R} W/m²: ${mv} < ${previous}`);previous=mv;}
 assert.equal(stanghelliniTranspiration(22,w(800),p,100,0),0);
 assert.ok(stanghelliniTranspiration(22,w(800),p,100,3)>stanghelliniTranspiration(22,w(800),p,100,1));
});
test('state-coupled crop moisture responds to zone humidity where a schedule cannot',()=>{
 const s={...makeScenario('greenhouse'),timezone:'UTC',dehuKgH:0};
 const dry=simulateScenario({...s,transpirationModel:'stanghellini'},weather(24,{tempC:22,rh:.4})).summary.cropWaterL;
 const humid=simulateScenario({...s,transpirationModel:'stanghellini'},weather(24,{tempC:22,rh:.9})).summary.cropWaterL;
 assert.ok(dry>humid,`ventilated dry air must raise transpiration: ${dry} vs ${humid}`);
 const scheduled=[.4,.9].map(rh=>simulateScenario({...s,transpirationModel:'schedule'},weather(24,{tempC:22,rh})).summary.cropWaterL);
 assert.ok(Math.abs(scheduled[0]-scheduled[1])<1e-6);
});
test('DOAS removes at most the outdoor-to-supply moisture difference carried by its airflow, and pays for it',()=>{
 const s={...applyTechnology(makeScenario('hybrid'),'doas'),timezone:'UTC'};
 const hour={tempC:26,rh:.85,pressurePa:101325};
 const result=simulateScenario(s,weather(12,hour));
 const outside=weatherState({time:0,ghiWm2:0,...hour});
 const supplyW=Math.min(outside.w,saturationHumidityRatio(s.doasSupplyDewPointC,hour.pressurePa));
 const maxKgH=(outside.w-supplyW)*dryAirDensity(s.doasSupplyTempC,supplyW,hour.pressurePa)*s.doasM3s*3600;
 assert.ok(result.summary.doasRemovedKg>0,'humid outdoor air must produce DOAS removal');
 for(const h of result.hours.filter(h=>h.valid)){
  assert.ok(h.doasRemovedKg<=maxKgH*h.controls.doasDuty+1e-9,`${h.doasRemovedKg} kg exceeds ${maxKgH*h.controls.doasDuty}`);
  assert.ok(h.doasKWh>=h.doasRemovedKg*s.doasKWhPerKg-1e-9);
  if(h.controls.doasDuty>0)assert.ok(h.controls.enrichmentFraction<1,'outdoor DOAS air is not CO2-enrichment compatible');
 }
 assert.ok(result.summary.electricKWh>=result.summary.doasKWh);
});
test('per-hour load decomposition closes the zone heat and moisture balances',()=>{
 const s=closed({lightWm2:60,photoperiod:12,dayStart:6,dliTarget:20,transpirationLDayM2:3,dehuKgH:20,heaterKW:30,coolingKW:20,uValue:1,infiltrationACH:.5});
 const result=simulateScenario(s,weather(24,{tempC:10,rh:.7,ghiWm2:0}));
 assert.equal(result.summary.numericalFailureHours,0);
 let removals=0;
 for(const h of result.hours){
  const l=h.loads;
  const closureKWh=l.sensibleKWh-l.dxSensibleKWh+l.condensationKWh-l.storedKWh;
  assert.ok(Math.abs(closureKWh)<=1e-3*Math.max(1,Math.abs(l.sensibleKWh)),`hour ${h.time}: sensible closure ${closureKWh} kWh`);
  const lk=l.latentKg;
  const moistureKg=lk.crop+lk.infiltration+lk.ventilation+lk.doas+lk.humidifier-lk.removed-lk.condensed-lk.stored;
  assert.ok(Math.abs(moistureKg)<=1e-6*Math.max(1,lk.crop),`hour ${h.time}: moisture closure ${moistureKg} kg`);
  assert.ok(Math.abs(l.cropLatentKWh+2.45e6*lk.crop/3.6e6)<1e-9,'crop latent heat is the crop water times latent heat');
  assert.ok(l.shr===null||(l.shr>=0&&l.shr<=1));
  removals+=l.dxSensibleKWh;
 }
 assert.ok(removals>0&&result.summary.dehuKWh>0&&result.summary.heatingKWh>0,'fixture must exercise DX, dehumidifier and heater paths');
});
test('older scenario JSON without v0.2 keys validates with crop-specific defaults',()=>{
 const legacy={...makeScenario('greenhouse','mushroom','mushroom')};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC','doasKWhPerKg'])delete legacy[key];
 assert.deepEqual(validateScenario(legacy),[]);
 assert.equal(legacy.transpirationModel,'schedule');assert.equal(legacy.lai,0);
 assert.equal(legacy.controlMode,'staged');assert.equal(legacy.doasM3s,0);assert.equal(legacy.doasKWhPerKg,DEFAULT_SCENARIO.doasKWhPerKg);
 const lettuce={...makeScenario('greenhouse')};delete lettuce.lai;delete lettuce.transpirationModel;
 assert.deepEqual(validateScenario(lettuce),[]);
 assert.equal(lettuce.transpirationModel,'stanghellini');assert.equal(lettuce.lai,3);
 assert.ok(validateScenario({...makeScenario(),controlMode:'optimal'}).length>0);
});
test('a schemaVersion 1 scenario simulates without a prior validate call',()=>{
 const legacy={...makeScenario('greenhouse')};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC','doasKWhPerKg'])delete legacy[key];
 const result=simulateScenario(legacy,weather(24,{tempC:28,rh:.7,ghiWm2:500}));
 assert.equal(result.summary.numericalFailureHours,0);
 assert.equal(result.summary.validHours,24);
 assert.equal(Object.hasOwn(legacy,'lai'),false,'the caller object must not be mutated');
});
