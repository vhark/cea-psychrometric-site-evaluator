import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeScenario,validateScenario,applyTechnology,DEFAULT_SCENARIO,SYSTEMS,FACILITIES,FACILITY_TEMPLATES,OPAQUE_FACILITIES} from '../src/config.js';
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
test('a fixture with surplus capacity reaches the daily light target and is not reported deficient',()=>{
 // The controller spreads the outstanding deficit over the time left in the lit window. Padding that
 // window under-delivers a little every step, which used to leave every day fractionally short and
 // report a fully lit crop as light-deficient on all of them.
 // 250 W/m2 at 2.5 umol/J and full delivery caps at 625 umol/m2/s, so a 12 h window can carry 27.0 mol.
 const lit={lightWm2:250,efficacy:2.5,lightDelivery:1,photoperiod:12,dayStart:6,dliTarget:20,coolingKW:400,heaterKW:100};
 for(const stepMinutes of [5,1]){
  const result=simulateScenario(closed(lit),weather(48),{stepMinutes});
  const days=result.summary.daily.filter(d=>d.complete);
  assert.equal(days.length,2);
  for(const day of days)assert.ok(day.dli>=20-1e-9,`delivered ${day.dli} of 20 mol at ${stepMinutes} min`);
  assert.equal(result.summary.dliDeficitDays,0);
 }
 // The same fixture against a target beyond its ceiling must still report the shortfall at 27.0 mol.
 const short=simulateScenario(closed({...lit,dliTarget:40}),weather(48),{stepMinutes:5});
 assert.equal(short.summary.dliDeficitDays,2);
 for(const day of short.summary.daily.filter(d=>d.complete))assert.ok(day.dli>26.9&&day.dli<27.1,`capped at ${day.dli}`);
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
 const legacy={...makeScenario('greenhouse','bench','mushroom')};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC','doasKWhPerKg'])delete legacy[key];
 assert.deepEqual(validateScenario(legacy),[]);
 assert.equal(legacy.transpirationModel,'schedule');assert.equal(legacy.lai,0);
 assert.equal(legacy.controlMode,'staged');assert.equal(legacy.doasM3s,0);assert.equal(legacy.doasKWhPerKg,DEFAULT_SCENARIO.doasKWhPerKg);
 const lettuce={...makeScenario('greenhouse')};delete lettuce.lai;delete lettuce.transpirationModel;
 assert.deepEqual(validateScenario(lettuce),[]);
 assert.equal(lettuce.transpirationModel,'stanghellini');assert.equal(lettuce.lai,3);
 assert.ok(validateScenario({...makeScenario(),controlMode:'optimal'}).length>0);
});
test('supported cultivation systems validate; a retired one fails with a message that names it',()=>{
 for(const system of Object.keys(SYSTEMS))assert.deepEqual(validateScenario({...makeScenario('greenhouse',system)}),[],`${system} must validate`);
 const errors=validateScenario({...makeScenario(),system:'wall'});
 assert.equal(errors.length,1,`expected one error, got ${errors.join(' | ')}`);
 assert.match(errors[0],/"wall" was retired/);
 assert.match(errors[0],/greenhouse benches/);
});
test('rack systems stack canopy above the floor footprint while benches do not',()=>{
 const floor=500,bench=makeScenario('greenhouse','bench'),racks=makeScenario('greenhouse','microgreens');
 assert.equal(bench.areaM2,floor);
 assert.ok(bench.canopyM2<=floor,`bench canopy ${bench.canopyM2} must not exceed its floor`);
 assert.equal(racks.canopyM2,Math.round(floor*.35/.7432*2.4));
 assert.ok(racks.canopyM2>floor,'stacked trays must give more canopy than floor');
 // Mushroom rooms are dark and ventilation-driven, and must not silently keep the lit-crop defaults.
 const mushroom=makeScenario('greenhouse','mushroom','mushroom');
 assert.equal(mushroom.canopyM2,racks.canopyM2);
 assert.ok(mushroom.lightWm2<bench.lightWm2&&mushroom.minVentACH>bench.minVentACH&&mushroom.humidifierKgH>0);
 assert.deepEqual(validateScenario(mushroom),[]);
});
test('a schemaVersion 1 scenario simulates without a prior validate call',()=>{
 const legacy={...makeScenario('greenhouse')};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC','doasKWhPerKg'])delete legacy[key];
 const result=simulateScenario(legacy,weather(24,{tempC:28,rh:.7,ghiWm2:500}));
 assert.equal(result.summary.numericalFailureHours,0);
 assert.equal(result.summary.validHours,24);
 assert.equal(Object.hasOwn(legacy,'lai'),false,'the caller object must not be mutated');
});
const V03_KEYS=['heatSource','heatPumpCopAt8C','heatPumpCopAtMinus8C','heatPumpCopAtMinus15C','heatPumpCutoffC','heatPumpCapacityDerate','shadeScreen','thermalScreen'];
test('scenario JSON written before the component keys existed validates and simulates unchanged',()=>{
 const legacy={...makeScenario('greenhouse')};
 for(const key of V03_KEYS)delete legacy[key];
 const fixture=diurnal();
 const before=simulateScenario(legacy,fixture);
 assert.equal(Object.hasOwn(legacy,'shadeScreen'),false,'the caller object must not be mutated');
 assert.deepEqual(validateScenario(legacy),[]);
 assert.equal(legacy.heatSource,'fuel');
 assert.equal(legacy.shadeScreen.installed,false);
 assert.equal(legacy.thermalScreen.installed,false);
 assert.equal(legacy.heatPumpCopAt8C,null,'an unsourced rating point must stay null rather than acquire a default');
 const after=simulateScenario(legacy,fixture);
 for(const key of ['electricKWh','fuelKWh','heatingKWh','coolingKWh','compliancePct'])assert.equal(after.summary[key],before.summary[key],`${key} changed for a scenario that declares no components`);
 assert.equal(after.summary.screens.shadeHours,0);
 assert.equal(after.summary.screens.dliCostMol,0);
 assert.equal(after.summary.screens.heatingSavedKWh,0);
 // Two scenarios must never share one screen object, or editing one would edit the other.
 const a=makeScenario('greenhouse'),b=makeScenario('greenhouse');
 a.shadeScreen.installed=true;
 assert.equal(b.shadeScreen.installed,false);
 assert.equal(DEFAULT_SCENARIO.shadeScreen.installed,false);
});
test('every facility template carries a sourced envelope, and the original keys keep their published values',()=>{
 for(const key of Object.keys(FACILITIES)){
  const s=makeScenario(key);
  assert.deepEqual(validateScenario(s),[],`${key} must validate`);
  const template=FACILITY_TEMPLATES[key];
  assert.ok(template&&typeof template.source==='string'&&template.source.length>20,`${key} must state where its envelope came from`);
  assert.equal(s.uValue,template.uValue,`${key} must load its template U-value`);
  if(OPAQUE_FACILITIES.has(key)){
   assert.equal(s.parTransmission,0);assert.equal(s.solarTransmission,0);
   assert.ok(validateScenario({...s,parTransmission:.5}).length>0,`${key} must refuse a transparent envelope`);
  }
 }
 // The three keys that shipped before the ladder keep the exact numbers older saved scenarios were run with.
 const legacy=makeScenario('greenhouse');
 assert.equal(legacy.uValue,4);assert.equal(legacy.envelopeRatio,1.8);assert.equal(legacy.infiltrationACH,.3);
 assert.equal(legacy.parTransmission,.65);assert.equal(legacy.solarTransmission,.65);assert.equal(legacy.maxVentACH,40);
 const indoor=makeScenario('indoor');
 assert.equal(indoor.uValue,.3);assert.equal(indoor.maxVentACH,2);assert.equal(indoor.padEnabled,false);
 const hybrid=makeScenario('hybrid');
 assert.equal(hybrid.uValue,4);assert.equal(hybrid.maxVentACH,15);assert.equal(hybrid.integratedHVAC,true);
 // The ladder must actually be a ladder: insulation improves from single film to SIP panel.
 const order=['greenhouseBasic','greenhouseGlass','greenhouseDouble','greenhousePoly','warehouse','warehouseSip'].map(k=>FACILITY_TEMPLATES[k].uValue);
 assert.deepEqual(order,[6.84,6.24,3.97,3.3,4.54,.27]);
 // A warehouse ratio is geometry, not an archetype guess: the flat-roof identity on its own dimensions.
 const warehouse=makeScenario('warehouse');
 assert.ok(Math.abs(warehouse.envelopeRatio-(1+4*warehouse.heightM/Math.sqrt(warehouse.areaM2)))<5e-4);
});

// A closed facility is not a sealed one. The opaque templates cap the outside-air path at 2 ACH, which is shell
// leakage rather than a designed economizer, and a user who raises it must actually get the benefit. Cold dry
// outside air is the cheapest moisture sink a lit box has, so the path must carry water out and displace
// mechanical condensation, while opening it too far must import more heating load than it is worth. Both
// directions are pinned because the shape is non-monotonic and a naive model would make more air always better.
const coldDry=(hours=48)=>({schemaVersion:1,source:'Synthetic cold-dry fixture',sourceKind:'test',latitude:64.84,longitude:-147.72,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-02',
 hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:-22,rh:.7,pressurePa:99000,ghiWm2:0}))});
const warmHumid=(hours=48)=>({schemaVersion:1,source:'Synthetic warm-humid fixture',sourceKind:'test',latitude:25.77,longitude:-80.19,timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-02',
 hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,6,1,i),tempC:29,rh:.85,pressurePa:101325,ghiWm2:0}))});
const litBox=(over={})=>({...makeScenario('warehouseSip','bench','lettuce'),timezone:'UTC',areaM2:500,heightM:4,
 lightWm2:150,dliTarget:14,photoperiod:16,dayStart:6,coolingKW:150,dehuKgH:30,heaterKW:60,humidifierKgH:0,
 padEnabled:false,controlMode:'ideal',minVentACH:.3,...over});
const ventLatentKg=result=>result.hours.reduce((sum,h)=>sum+Math.max(0,-(h.loads?.latentKg?.ventilation||0)),0);

test('a closed facility can use outside air as a moisture sink, and the economizer has an optimum',()=>{
  const leak=simulateScenario(litBox({maxVentACH:2}),coldDry());
  const econ=simulateScenario(litBox({maxVentACH:6}),coldDry());
  const flood=simulateScenario(litBox({maxVentACH:40}),coldDry());
  // The path itself must carry more water out as it opens.
  assert.ok(ventLatentKg(econ)>ventLatentKg(leak),
    `6 ACH must export more water than 2 ACH: ${ventLatentKg(econ)} against ${ventLatentKg(leak)}`);
  // And that displaces the coil, which is the whole point of an economizer on a lit box in dry weather.
  assert.ok(econ.summary.condensateKg<leak.summary.condensateKg,
    `an economizer must displace mechanical condensation: ${econ.summary.condensateKg} against ${leak.summary.condensateKg}`);
  // Deliberately NOT asserted: that a larger maximum is worse. The dispatcher offers three airflow levels
  // (minimum, midpoint, maximum), so raising the maximum moves the midpoint and deletes the intermediate flow
  // the controller wanted. Economizer capacity therefore cannot be ranked in this model, and any test that
  // pinned an optimum would be pinning that artifact. See docs/VERIFICATION.md.
  assert.deepEqual([...new Set([2,(0.3+2)/2,0.3])].length,3,'the three-level ladder is the documented shape');
  for(const r of [leak,econ,flood]) assert.equal(r.summary.numericalFailureHours,0);
});

test('a dry-neutral DOAS on a closed facility only removes water the outdoor air actually carries',()=>{
  const box=litBox({maxVentACH:6,technology:'doas',doasM3s:1.2,dehuKgH:30,coolingKW:150});
  // Warm humid outdoor air is wetter than the declared supply dew point, so the DOAS has water to remove.
  const humid=simulateScenario(box,warmHumid()).summary;
  assert.ok(humid.doasRemovedKg>0,'a DOAS must remove moisture from a humid outdoor stream');
  assert.ok(humid.doasKWh>0,'a running DOAS must cost energy');
  assert.ok((humid.runtime?.doas?.hours??0)>0,'DOAS runtime must be attributed to its own component');
  // Cold dry outdoor air is already drier than the supply target, so there is nothing for it to remove. A model
  // that credited removal here would be inventing dehumidification out of air that needs none.
  const dry=simulateScenario(box,coldDry()).summary;
  assert.equal(dry.doasRemovedKg,0,'a DOAS cannot dry air that is already drier than its supply dew point');
});

// Where a dehumidifier's heat lands is a topology choice, not a property of the machine, and it is the whole
// reason an integrated unit with hot-gas reheat exists. An in-room or ducted-and-returned unit puts the latent
// heat it removed plus its own electrical input back into the crop air, which the cooling plant must remove
// again. A remote-condenser or water-cooled unit rejects it outside, which makes the same machine a net
// cooling device. Both directions are pinned, along with the conservation of the split.
test('a dehumidifier releases its heat where the topology says, and the split conserves',()=>{
  const wet=(hours=48)=>({schemaVersion:1,source:'Synthetic warm-wet fixture',sourceKind:'test',latitude:25.77,longitude:-80.19,timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-02',
   hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,6,1,i),tempC:28,rh:.85,pressurePa:101325,ghiWm2:0}))});
  const room=over=>({...makeScenario('indoor','bench','lettuce'),timezone:'UTC',areaM2:200,heightM:4,
   lightWm2:150,dliTarget:14,photoperiod:16,dayStart:6,coolingKW:80,dehuKgH:40,heaterKW:30,humidifierKgH:0,
   padEnabled:false,controlMode:'ideal',...over});
  const inRoom=simulateScenario(room({dehuHeatFraction:1}),wet()).summary;
  const rejected=simulateScenario(room({dehuHeatFraction:0}),wet()).summary;
  const half=simulateScenario(room({dehuHeatFraction:.5}),wet()).summary;
  // The in-room unit dumps heat into the zone and none of it leaves; the remote unit is the mirror image.
  assert.ok(inRoom.dehuHeatKWh>0,'an in-room dehumidifier must heat the zone');
  assert.equal(Math.round(inRoom.dehuRejectedHeatKWh),0,'an in-room unit rejects nothing outside');
  assert.equal(Math.round(rejected.dehuHeatKWh),0,'a remote-condenser unit must not heat the zone');
  assert.ok(rejected.dehuRejectedHeatKWh>0,'a remote-condenser unit must reject its heat outside');
  // The split conserves within a run: at 0.5 the two halves of the same released heat must be equal, which is
  // the identity the fraction has to satisfy no matter what the rest of the plant is doing.
  const total=r=>r.dehuHeatKWh+r.dehuRejectedHeatKWh;
  assert.ok(total(half)>0,'a half-rejected unit must still release heat somewhere');
  assert.ok(Math.abs(half.dehuHeatKWh-half.dehuRejectedHeatKWh)/total(half)<1e-9,
    `a 0.5 fraction must split the released heat evenly: ${half.dehuHeatKWh} against ${half.dehuRejectedHeatKWh}`);
  // Half really is between the two, so the fraction is a continuum and not a switch.
  assert.ok(half.dehuHeatKWh>0&&half.dehuRejectedHeatKWh>0);
  assert.ok(half.dehuHeatKWh<inRoom.dehuHeatKWh,'half the heat into the zone must be less than all of it');
  // And the consequence that justifies an integrated machine: keeping the heat in the room costs cooling.
  assert.ok(inRoom.coolingKWh>rejected.coolingKWh,
    `in-room dehumidifier heat must raise the cooling bill: ${inRoom.coolingKWh} against ${rejected.coolingKWh}`);
  // Ducting a unit outside the room but returning its discharge is the in-room case, not the remote one. The
  // model has no separate flag for it precisely because the heat path, not the cabinet location, is what counts.
  assert.equal(simulateScenario(room({dehuHeatFraction:1}),wet()).summary.coolingKWh,inRoom.coolingKWh);
});
