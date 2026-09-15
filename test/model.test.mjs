import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AIRFLOW_BASIS,AIRFLOW_EVIDENCE,DEFAULT_SCENARIO,FACILITIES,FACILITY_TEMPLATES,OPAQUE_FACILITIES,SCENARIO_SCHEMA_VERSION,SYSTEMS,airflowEvidenceWarnings,applyTechnology,makeScenario,migrateScenario,validateScenario} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {compareScenarios} from '../src/metrics.js';
import {weatherState,padState,humidityRatio,enthalpy,stanghelliniTranspiration,saturationPressure,saturationHumidityRatio,dryAirDensity} from '../src/physics.js';
// Two synthetic days with diurnal temperature, humidity and solar forcing, a cool spring shape.
const diurnal=(hours=48,mean=18,amp=6)=>({schemaVersion:1,source:'Synthetic diurnal fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-04-01',endDate:'2025-04-02',
 hours:Array.from({length:hours},(_,i)=>{const h=i%24,sun=Math.max(0,Math.sin(Math.PI*(h-6)/14));
  return {time:Date.UTC(2025,3,1,i),tempC:mean+amp*Math.sin(Math.PI*(h-9)/12),rh:.8-.3*sun,pressurePa:98500,ghiWm2:Math.round(800*sun)};})});
const weather=(hours=24,changes={})=>({schemaVersion:1,source:'Synthetic boundary-test fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01',hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:22,rh:.6,pressurePa:101325,ghiWm2:0,...changes}))});
const closed=(overrides={})=>({...makeScenario('indoor'),outsideAirReviewed:true,timezone:'UTC',areaM2:100,canopyM2:100,heightM:4,dayTargetC:22,nightTargetC:22,tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,uValue:.05,infiltrationACH:0,minVentACH:0,maxVentACH:0,lightWm2:0,dliTarget:0,transpirationModel:'schedule',transpirationLDayM2:0,cropSensibleWm2:0,coolingKW:0,dehuKgH:0,heaterKW:0,humidifierKgH:0,...overrides});
const recovery=(type='hrv',overrides={})=>({
 type,nominalM3s:1,auxiliaryW:45,
 sensibleHeating75:.7,sensibleHeating100:.7,sensibleCooling75:.7,sensibleCooling100:.7,
 latentHeating75:.5,latentHeating100:.5,latentCooling75:.5,latentCooling100:.5,
 economizerBypass:true,frostControl:'none',minimumOutdoorOperatingC:-30,
 frostThresholdC:null,initialDefrostFraction:null,defrostRatePerK:null,...overrides});

test('invalid control ranges cannot silently become a viable scenario',()=>{
 assert.match(validateScenario(closed({minVentACH:10,maxVentACH:1})).join(' '),/Minimum controlled outdoor air exceeds/);
 assert.match(validateScenario(closed({vpdMin:2,vpdMax:1})).join(' '),/Minimum VPD must be below maximum VPD/);
});
test('scenario version 2 carries explicit airflow, cost, recovery, and DOAS completeness state',()=>{
 const s=makeScenario('greenhouseDouble');
 assert.equal(s.schemaVersion,SCENARIO_SCHEMA_VERSION);
 assert.equal(s.outsideAirBasis,'literatureRange');
 assert.equal(s.outsideAirReviewed,true);
 assert.equal(s.installedCostBasis,'screeningAssumption');
 assert.equal(s.heatRecovery.type,'none');
 assert.equal(s.doasM3s,0);
 assert.equal(s.doasSupplyDewPointC,null);
 assert.equal(s.doasSupplyTempC,null);
 assert.equal(s.doasCoolingCOP,null);
 assert.equal(s.doasReheatRecoveryFraction,null);
});
test('airflow evidence identifies source scope and height-dependent controlled-air context',()=>{
 assert.equal(Object.isFrozen(AIRFLOW_BASIS),true);
 assert.deepEqual(AIRFLOW_BASIS,{literatureRange:'Literature range',adjacentProxy:'Adjacent-evidence proxy',
  projectInput:'Project-specific input',screeningAssumption:'Screening assumption'});
 assert.equal(AIRFLOW_EVIDENCE.infiltration.basis,'literatureRange');
 assert.deepEqual(AIRFLOW_EVIDENCE.infiltration.constructionACH.glass,[.75,1]);
 assert.deepEqual(AIRFLOW_EVIDENCE.infiltration.constructionACH.doublePolyethylene,[.5,1]);
 assert.equal(AIRFLOW_EVIDENCE.infiltration.sourceUrl,'https://fieldreport.caes.uga.edu/publications/B792/greenhouses-heating-ventilation-and-cooling/');
 assert.equal(AIRFLOW_EVIDENCE.controlled.basis,'literatureRange');
 assert.equal(AIRFLOW_EVIDENCE.controlled.sourceUrl,'https://doi.org/10.25165/j.ijabe.20181101.3210');
 assert.equal(AIRFLOW_EVIDENCE.closedRoom.basis,'adjacentProxy');
 assert.equal(AIRFLOW_EVIDENCE.closedRoom.sourceUrl,'https://doi.org/10.23986/afsci.58936');
 assert.equal(AIRFLOW_EVIDENCE.mushroom.sourceUrl,'https://doi.org/10.25165/j.ijabe.20221501.6872');
 const s={...makeScenario('greenhouseGlass'),heightM:4,maxVentACH:20};
 assert.deepEqual(validateScenario(s),[],'literature context is advisory, not a validation limit');
 const warnings=airflowEvidenceWarnings(s);
 assert.equal(warnings.length,1);
 assert.match(warnings[0],/Shamshiri/i);
 assert.match(warnings[0],/0\.04 to 0\.05 m3\/s per m2/);
 assert.match(warnings[0],/4 m mean height/);
 assert.match(warnings[0],/36 to 45 ACH/);
 assert.match(warnings[0],/16 ACH below/);
 const infiltrationWarnings=airflowEvidenceWarnings({...makeScenario('greenhouseGlass'),infiltrationACH:.2,maxVentACH:40});
 assert.equal(infiltrationWarnings.length,1);
 assert.match(infiltrationWarnings[0],/UGA Extension Bulletin 792/);
 assert.match(infiltrationWarnings[0],/0\.75 to 1 ACH/);
 assert.match(infiltrationWarnings[0],/0\.55 ACH below/);
});
test('unsupported facility airflow assumptions require explicit review',()=>{
 for(const facility of ['greenhouse','greenhousePoly','hybrid','warehouse','warehouseSip','indoor']){
  const s=makeScenario(facility);
  assert.equal(s.outsideAirReviewed,false,facility);
  assert.equal(s.outsideAirBasis,'screeningAssumption',facility);
  assert.match(validateScenario(s).join(' '),/review/i,facility);
 }
});
test('mushroom controlled outdoor air stays empty until a project design is reviewed',()=>{
 const mushroom=makeScenario('greenhouseDouble','mushroom','mushroom');
 assert.equal(mushroom.minVentACH,null);
 assert.equal(mushroom.maxVentACH,null);
 assert.equal(mushroom.outsideAirBasis,'projectInput');
 assert.equal(mushroom.outsideAirReviewed,false);
 const missing=validateScenario(mushroom).join(' ');
 assert.match(missing,/Mushroom.*minimum controlled outdoor air/i);
 assert.match(missing,/Mushroom.*maximum controlled outdoor air/i);
 assert.deepEqual(validateScenario({...mushroom,minVentACH:2,maxVentACH:8,outsideAirReviewed:true}),[]);
 const legacy=migrateScenario({...mushroom,schemaVersion:1,minVentACH:6,maxVentACH:15,outsideAirBasis:'literatureRange',outsideAirReviewed:true});
 assert.equal(legacy.minVentACH,6);assert.equal(legacy.maxVentACH,15);
 assert.equal(legacy.outsideAirBasis,'projectInput');assert.equal(legacy.outsideAirReviewed,false);
 const missingReview={...mushroom,minVentACH:2,maxVentACH:8};delete missingReview.outsideAirBasis;delete missingReview.outsideAirReviewed;
 assert.equal(migrateScenario(missingReview).outsideAirBasis,'projectInput');
 assert.equal(migrateScenario(missingReview).outsideAirReviewed,false);
 assert.match(validateScenario(missingReview).join(' '),/review/i);
});
test('DOAS treatment capacity and performance must be complete and fit the controlled-air path',()=>{
 const base={...makeScenario('greenhouseDouble'),technology:'doas',outsideAirReviewed:true,maxVentACH:2,doasM3s:1.2,
  doasSupplyDewPointC:8,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5};
 const maximumM3s=base.maxVentACH*base.areaM2*base.heightM/3600;
 assert.ok(base.doasM3s>maximumM3s);
 assert.match(validateScenario(base).join(' '),/DOAS.*maximum controlled.*1\.11 m3\/s/i);
 assert.match(validateScenario({...base,doasM3s:.5,doasSupplyDewPointC:20,doasSupplyTempC:10}).join(' '),/dew point.*supply temperature/i);
 const legacyCandidate={...base,schemaVersion:1,doasM3s:.5};
 delete legacyCandidate.doasCoolingCOP;delete legacyCandidate.doasReheatRecoveryFraction;
 const incomplete=migrateScenario(legacyCandidate);
 assert.match(validateScenario(incomplete).join(' '),/review/i);
 assert.match(validateScenario(incomplete).join(' '),/cooling COP/i);
 assert.match(validateScenario(incomplete).join(' '),/reheat recovery/i);
 const preset=applyTechnology(makeScenario('greenhouseDouble'),'doas');
 assert.equal(preset.doasM3s,0);
 assert.equal(preset.doasSupplyDewPointC,null);
 assert.equal(preset.doasSupplyTempC,null);
 assert.equal(preset.doasCoolingCOP,null);
 assert.equal(preset.doasReheatRecoveryFraction,null);
 assert.equal(preset.outsideAirReviewed,false);
 assert.ok(validateScenario(preset).length>0);
 const missingReview={...base,doasM3s:.5};delete missingReview.outsideAirReviewed;
 assert.equal(migrateScenario(missingReview).outsideAirReviewed,false);
 assert.match(validateScenario(missingReview).join(' '),/review/i);
});
test('configured HRV and ERV require their type-specific rating data',()=>{
 const hrv=makeScenario('greenhouseDouble');
 hrv.heatRecovery={type:'hrv'};
 const hrvErrors=validateScenario(hrv);
 assert.ok(hrvErrors.some(error=>error.includes('sensibleHeating75')));
 assert.equal(hrvErrors.some(error=>error.includes('latentHeating75')),false);
 const erv=makeScenario('greenhouseDouble');
 erv.heatRecovery={type:'erv'};
 const ervErrors=validateScenario(erv);
 assert.ok(ervErrors.some(error=>error.includes('sensibleHeating75')));
 assert.ok(ervErrors.some(error=>error.includes('latentHeating75')));
 assert.match(validateScenario({...makeScenario('greenhouseDouble'),heatRecovery:'hrv'}).join(' '),/Heat recovery must be an object/);
});
test('configured recovery exposes active, bypass, frost, preheat, and airflow assumptions',()=>{
 const s=closed({controlMode:'staged',minVentACH:9,maxVentACH:9,heaterKW:0,heatRecovery:recovery('hrv')});
 const result=simulateScenario(s,weather(2,{tempC:-10,rh:.35}),{stepMinutes:5});
 assert.ok(result.summary.recoverySensibleKWh>0);
 assert.ok(result.summary.recoveryAuxKWh>0);
 assert.equal(result.summary.recoveryLatentKWh,0);
 assert.ok(result.summary.runtime.recoveryActive.hours>0);
 assert.equal(result.summary.runtime.recoveryBypass.hours,0);
 assert.equal(result.summary.runtime.recoveryDefrost.hours,0);
 assert.equal(result.summary.runtime.preheat.hours,0);
 assert.equal(result.assumptions.airflow.balancedRecoveryFlow,true);
 assert.deepEqual(result.assumptions.airflow.supportedRecoveryFlowFraction,{minimum:.5,maximum:1.3});
 assert.match(result.assumptions.airflow.ratingInputs,/manufacturer/i);
});
test('staged economizer and evaporative pad bypass recovery on the same controlled stream',()=>{
 const cool=closed({controlMode:'staged',minVentACH:.3,maxVentACH:9,cropSensibleWm2:100,thermalMassKJm2K:20,
  fanWPerM3s:0,heatRecovery:recovery('hrv')});
 const economizer=simulateScenario(cool,weather(24,{tempC:5,rh:.35}),{stepMinutes:5});
 const bypassRows=economizer.hours.filter(h=>h.controls?.controlledACH>cool.minVentACH+1e-9&&h.controls.recoveryBypassFraction>0);
 assert.ok(bypassRows.length>0,'fixture must call staged economizer bypass');
 for(const h of bypassRows){
  assert.equal(h.controls.recoveryCoreFraction,0);
  assert.equal(h.recoverySensibleKWh,0);
  assert.ok(h.recoveryBypassM3>0);
 }
 const padScenario=closed({controlMode:'staged',technology:'pad',padEnabled:true,minVentACH:.3,maxVentACH:20,
  padEffectiveness:.8,padPumpW:0,uValue:1,envelopeRatio:1.8,heatRecovery:recovery('erv')});
 const pad=simulateScenario(padScenario,weather(24,{tempC:38,rh:.1}),{stepMinutes:5});
 const padRows=pad.hours.filter(h=>h.controls?.padFraction>0);
 assert.ok(padRows.length>0,'fixture must operate the direct pad');
 for(const h of padRows){
  assert.equal(h.controls.recoveryCoreFraction,0);
  assert.ok(Math.abs(h.controls.recoveryBypassFraction-1)<1e-12);
  assert.equal(h.recoverySensibleKWh+h.recoveryLatentKWh,0);
 }
});
test('staged recovery bypass also weighs useful outdoor heating and humidification',()=>{
 const heatingWeather=weather(2,{tempC:-20,rh:.35});
 heatingWeather.hours[1]={...heatingWeather.hours[1],tempC:35,rh:.35};
 const heating=simulateScenario(closed({controlMode:'staged',minVentACH:9,maxVentACH:9,heaterKW:0,
  fanWPerM3s:0,thermalMassKJm2K:20,heatRecovery:recovery('hrv')}),heatingWeather,{stepMinutes:5});
 assert.ok(heating.hours[0].tempC<20,'first hour must leave the unheated fixture cold');
 assert.ok(heating.hours[1].controls.recoveryBypassFraction>0,
  'untreated warm outdoor air must compete with recovery when the zone needs heat');
 const humidWeather=weather(2,{tempC:22,rh:.05});
 humidWeather.hours[1]={...humidWeather.hours[1],rh:.7};
 const humidifying=simulateScenario(closed({controlMode:'staged',minVentACH:9,maxVentACH:9,heaterKW:0,
  fanWPerM3s:0,thermalMassKJm2K:20,heatRecovery:recovery('erv')}),humidWeather,{stepMinutes:5});
 assert.ok(humidifying.hours[1].controls.recoveryBypassFraction>0,
  'untreated moist outdoor air must compete with recovery when the zone needs moisture');
});
test('unsupported low recovery flow bypasses with a warning and high flow caps the core once',()=>{
 const low=closed({controlMode:'ideal',minVentACH:4.41,maxVentACH:4.41,heaterKW:0,heatRecovery:recovery('hrv')});
 const lowResult=simulateScenario(low,weather(1,{tempC:-10,rh:.35}),{stepMinutes:5});
 assert.equal(lowResult.hours[0].controls.recoveryCoreFraction,0);
 assert.equal(lowResult.hours[0].controls.recoveryBypassFraction,1);
 assert.equal(lowResult.summary.recoveryAuxKWh,0);
 assert.ok(lowResult.warnings.some(w=>/below.*50%|50%.*nominal/i.test(w)));
 const high=closed({controlMode:'ideal',minVentACH:18,maxVentACH:18,heaterKW:0,heatRecovery:recovery('hrv')});
 const highResult=simulateScenario(high,weather(1,{tempC:-10,rh:.35}),{stepMinutes:5});
 assert.ok(Math.abs(highResult.hours[0].controls.controlledM3s-2)<1e-12);
 assert.ok(Math.abs(highResult.hours[0].controls.recoveryCoreFraction-.65)<1e-12);
 assert.ok(Math.abs(highResult.hours[0].controls.recoveryBypassFraction-.35)<1e-12);
 assert.ok(Math.abs(highResult.hours[0].recoveryBypassM3-2520)<1e-8);
 assert.ok(Math.abs(highResult.hours[0].recoveryCoreM3-4680)<1e-8);
 assert.ok(Math.abs(highResult.summary.recoveryCoreM3-4680)<1e-8);
});
test('frost preheat consumes finite heating capacity first and charges its declared source',()=>{
 const base={controlMode:'staged',minVentACH:9,maxVentACH:9,heaterKW:20,thermalMassKJm2K:20,
  heatRecovery:recovery('hrv',{frostControl:'preheat',minimumOutdoorOperatingC:null,frostThresholdC:-5})};
 const outsideW=humidityRatio(-15,.35,101325);
 const expectedPreheatKWh=dryAirDensity(-15,outsideW,101325)*
  (enthalpy(-5,outsideW)-enthalpy(-15,outsideW))/1000;
 const fuel=simulateScenario(closed(base),weather(1,{tempC:-15,rh:.35}),{stepMinutes:5});
 assert.ok(Math.abs(fuel.summary.preheatDeliveredKWh-expectedPreheatKWh)<=1e-9*expectedPreheatKWh,
  `${fuel.summary.preheatDeliveredKWh} kWh delivered vs independent inlet enthalpy rise ${expectedPreheatKWh} kWh`);
 assert.equal(fuel.hours[0].controls.recoveryCoreFraction,1,'core may operate only after preheat reaches its threshold');
 assert.ok(fuel.summary.recoverySensibleKWh>0,'protected core must deliver observable recovery');
 assert.ok(fuel.summary.heatingKWh>0,'remaining capacity must reach the later zone heater');
 assert.ok(fuel.summary.preheatDeliveredKWh+fuel.summary.heatingKWh<=20+1e-9);
 assert.equal(fuel.summary.preheatElectricKWh,0);
 assert.ok(Math.abs(fuel.summary.preheatFuelKWh-fuel.summary.preheatDeliveredKWh/fuel.scenario.heaterEfficiency)<1e-9);
 const heatPump=simulateScenario(closed({...base,heatSource:'heatpump',heatPumpCopAt8C:2,heatPumpCopAtMinus8C:2,
  heatPumpCopAtMinus15C:2,heatPumpCutoffC:-25,heatPumpCapacityDerate:1}),weather(1,{tempC:-15,rh:.35}),{stepMinutes:5});
 assert.equal(heatPump.summary.preheatFuelKWh,0);
 assert.ok(Math.abs(heatPump.summary.preheatElectricKWh-heatPump.summary.preheatDeliveredKWh/2)<1e-9);
 assert.ok(heatPump.summary.preheatDeliveredKWh+heatPump.summary.heatingKWh<=20+1e-9);
 const boundary=simulateScenario(closed(base),weather(1,{tempC:-5,rh:.35}),{stepMinutes:5});
 assert.equal(boundary.summary.preheatDeliveredKWh,0,'air already at the threshold needs no preheat');
 assert.equal(boundary.hours[0].controls.recoveryCoreFraction,1);
 assert.ok(boundary.summary.recoverySensibleKWh>0);
});
test('insufficient preheat retains delivered heat, bypasses the core, and reports insufficiency',()=>{
 const s=closed({controlMode:'staged',minVentACH:9,maxVentACH:9,heaterKW:1,thermalMassKJm2K:20,
  heatRecovery:recovery('hrv',{frostControl:'preheat',minimumOutdoorOperatingC:null,frostThresholdC:-5})});
 const result=simulateScenario(s,weather(1,{tempC:-15,rh:.35}),{stepMinutes:5});
 assert.ok(Math.abs(result.summary.preheatDeliveredKWh-1)<1e-9);
 assert.equal(result.summary.heatingKWh,0,'preheat has first claim on the finite heater');
 assert.ok(Math.abs(result.hours[0].controls.recoveryCoreFraction)<1e-12);
 assert.ok(Math.abs(result.hours[0].controls.recoveryBypassFraction-1)<1e-12);
 assert.equal(result.summary.preheatInsufficientHours,1);
 assert.equal(result.summary.runtime.preheat.hours,1);
});
test("frostControl 'none' rejects weather below the manufacturer-qualified operating limit",()=>{
 const s=closed({minVentACH:9,maxVentACH:9,heatRecovery:recovery('hrv',{minimumOutdoorOperatingC:-5})});
 assert.throws(()=>simulateScenario(s,weather(2,{tempC:-10,rh:.35})),/minimum outdoor operating|below.*-5|frost control/i);
});
test('pressure changes reconcile a carried near-saturated zone before recovery inlet validation',()=>{
 const pressureStep=weather(2,{tempC:22,rh:.99,pressurePa:80000});
 pressureStep.hours[1]={...pressureStep.hours[1],pressurePa:101325};
 const base={controlMode:'staged',minVentACH:9,maxVentACH:9,fanWPerM3s:0,heaterKW:0,
  vpdMin:0,vpdMax:.05,maxDewPointC:35,thermalMassKJm2K:20};
 for(const heatRecovery of [recovery('none'),recovery('hrv')]){
  const result=simulateScenario(closed({...base,heatRecovery}),pressureStep,{stepMinutes:5});
  assert.equal(result.hours.length,2);
  assert.equal(result.summary.numericalFailureHours,0,heatRecovery.type);
  assert.ok(result.hours.every(h=>h.valid),heatRecovery.type);
 }
});
test('direct simulation migrates a clone and reports every incomplete airflow treatment requirement',()=>{
 const incomplete=makeScenario('greenhouseDouble','mushroom','mushroom');
 incomplete.technology='doas';
 const before=structuredClone(incomplete);
 assert.throws(()=>simulateScenario(incomplete,weather(1)),error=>{
  assert.match(error.message,/Scenario cannot be simulated:/);
  for(const requirement of ['Mushroom minimum controlled outdoor air','Mushroom maximum controlled outdoor air','review','DOAS treatment capacity','DOAS supply dew point','DOAS supply temperature','DOAS cooling COP','DOAS reheat recovery'])
   assert.match(error.message,new RegExp(requirement,'i'),`missing actionable requirement: ${requirement}`);
  return true;
 });
 assert.deepEqual(incomplete,before,'direct migration and validation must not mutate caller input');
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
 const base={...makeScenario('greenhouse'),outsideAirReviewed:true,timezone:'UTC',dayTargetC:24,nightTargetC:24,tempToleranceC:2,coolingKW:0,dehuKgH:0,heaterKW:0};
 const withPad=simulateScenario({...base,padEnabled:true},hot).summary,without=simulateScenario({...base,padEnabled:false},hot).summary;
 assert.equal(without.runtime.pad.hours,0);assert.equal(without.padWaterL,0);
 assert.ok(withPad.runtime.pad.hours>0&&withPad.padWaterL>0,'pad must run under hot dry outdoor air');
 assert.equal(withPad.runtime.pad.days,1);
 assert.ok(withPad.runtime.pad.equivalentHours<=withPad.runtime.pad.hours+1e-9);
 assert.ok(withPad.compliantHours>=without.compliantHours,'pad must not reduce attainment under hot dry air');
});
test('outdoor air is a dehumidifier only when drier than the zone ceiling, with a heating penalty when cold',()=>{
 const s={...makeScenario('greenhouse'),outsideAirReviewed:true,timezone:'UTC',dehuLPerKWh:2.5};
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
 const s=closed({lightWm2:500,photoperiod:24,dayStart:0,dliTarget:0,uValue:.05,thermalMassKJm2K:5});
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
 const s={...makeScenario(),outsideAirReviewed:true,timezone:'UTC',areaM2:100,canopyM2:400,parTransmission:1,shadeFraction:0,lightWm2:0,transpirationLDayM2:0};
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
 const scenarios=JSON.parse(readFileSync(new URL('../docs/example-scenarios.json',import.meta.url),'utf8')).scenarios.map(raw=>{
  const s=migrateScenario(raw);s.outsideAirReviewed=true;assert.deepEqual(validateScenario(s),[]);return {...s,timezone:'UTC'};
 });
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
 const s={...makeScenario('greenhouse'),outsideAirReviewed:true,timezone:'UTC',dehuKgH:0};
 const dry=simulateScenario({...s,transpirationModel:'stanghellini'},weather(24,{tempC:22,rh:.4})).summary.cropWaterL;
 const humid=simulateScenario({...s,transpirationModel:'stanghellini'},weather(24,{tempC:22,rh:.9})).summary.cropWaterL;
 assert.ok(dry>humid,`ventilated dry air must raise transpiration: ${dry} vs ${humid}`);
 const scheduled=[.4,.9].map(rh=>simulateScenario({...s,transpirationModel:'schedule'},weather(24,{tempC:22,rh})).summary.cropWaterL);
 assert.ok(Math.abs(scheduled[0]-scheduled[1])<1e-6);
});
test('conditioned DOAS acts on the selected controlled stream and closes its cooling and condensate balances',()=>{
 const s=closed({controlMode:'ideal',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  doasM3s:1,doasSupplyDewPointC:10,doasSupplyTempC:20,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  heaterKW:50,thermalMassKJm2K:20});
 const hour={tempC:35,rh:.7,pressurePa:101325};
 const result=simulateScenario(s,weather(4,hour),{stepMinutes:5});
 const inlet=weatherState({time:0,ghiWm2:0,...hour});
 const coilW=saturationHumidityRatio(s.doasSupplyDewPointC,hour.pressurePa);
 const massFlowKgS=dryAirDensity(inlet.tempC,inlet.w,hour.pressurePa)*s.doasM3s;
 const coolingW=massFlowKgS*(enthalpy(inlet.tempC,inlet.w)-enthalpy(s.doasSupplyDewPointC,coilW));
 const condensateKgS=massFlowKgS*(inlet.w-coilW);
 const reheatDemandW=massFlowKgS*(enthalpy(s.doasSupplyTempC,coilW)-enthalpy(s.doasSupplyDewPointC,coilW));
 const recoveredReheatW=Math.min(reheatDemandW,s.doasReheatRecoveryFraction*(coolingW+coolingW/s.doasCoolingCOP));
 let treatedSeconds=0;
 for(const h of result.hours.filter(h=>h.valid)){
  const seconds=h.controls.doasConditionedFraction*3600;
  treatedSeconds+=seconds;
  assert.ok(Math.abs(h.doasCondensateKg-condensateKgS*seconds)<=1e-8*Math.max(1,h.doasCondensateKg));
  assert.ok(Math.abs(h.doasCoolingDeliveredKWh-coolingW*seconds/3600000)<=1e-8*Math.max(1,h.doasCoolingDeliveredKWh));
  assert.ok(Math.abs(h.doasCoolingElectricKWh-h.doasCoolingDeliveredKWh/s.doasCoolingCOP)<=1e-10);
  assert.ok(h.doasRecoveredReheatKWh<=reheatDemandW*seconds/3600000+1e-9);
  assert.ok(h.doasRecoveredReheatKWh<=recoveredReheatW*seconds/3600000+1e-9);
  assert.ok(Math.abs(h.controls.controlledM3s-h.controls.controlledACH*s.areaM2*s.heightM/3600)<1e-12);
 }
 assert.ok(treatedSeconds>0,'humid outdoor air must operate the DOAS');
 assert.ok(result.summary.doasCondensateKg>0);
 assert.ok(result.summary.doasCoolingDeliveredKWh>0);
 assert.ok(Math.abs(result.summary.doasCoolingElectricKWh-result.summary.doasCoolingDeliveredKWh/s.doasCoolingCOP)<1e-9);
 assert.ok(result.summary.doasRecoveredReheatKWh>0);
 assert.equal(result.summary.doasExternalHeatKWh,0);
 assert.ok(Math.abs(result.summary.electricKWh-result.summary.doasCoolingElectricKWh)<1e-9,
  'isolated DOAS cooling electricity must enter purchased electricity exactly once');
 assert.equal(result.summary.fuelKWh,0);
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
  const moistureKg=lk.crop+lk.infiltration+lk.controlledOutdoorAir+lk.humidifier-lk.removed-lk.condensed-lk.stored;
  assert.ok(Math.abs(moistureKg)<=1e-6*Math.max(1,lk.crop),`hour ${h.time}: moisture closure ${moistureKg} kg`);
  assert.ok(Math.abs(l.cropLatentKWh+2.45e6*lk.crop/3.6e6)<1e-9,'crop latent heat is the crop water times latent heat');
  assert.ok(l.shr===null||(l.shr>=0&&l.shr<=1));
  removals+=l.dxSensibleKWh;
 }
 assert.ok(removals>0&&result.summary.dehuKWh>0&&result.summary.heatingKWh>0,'fixture must exercise DX, dehumidifier and heater paths');
});
test('older scenario JSON without later keys migrates with crop-specific inert defaults',()=>{
 const legacy={...makeScenario('greenhouseDouble','bench','mushroom'),schemaVersion:1};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC'])delete legacy[key];
 const migrated=migrateScenario(legacy);
 assert.deepEqual(validateScenario(migrated),[]);
 assert.equal(migrated.transpirationModel,'schedule');assert.equal(migrated.lai,0);
 assert.equal(migrated.controlMode,'staged');assert.equal(migrated.doasM3s,0);
 assert.equal(migrated.doasSupplyDewPointC,null);assert.equal(migrated.doasSupplyTempC,null);
 assert.equal(Object.hasOwn(legacy,'lai'),false,'migration must not mutate its input');
 const lettuce={...makeScenario('greenhouseDouble')};delete lettuce.lai;delete lettuce.transpirationModel;
 const migratedLettuce=migrateScenario(lettuce);
 assert.deepEqual(validateScenario(migratedLettuce),[]);
 assert.equal(migratedLettuce.transpirationModel,'stanghellini');assert.equal(migratedLettuce.lai,3);
 assert.ok(validateScenario({...makeScenario('greenhouseDouble'),controlMode:'optimal'}).length>0);
});
test('supported cultivation systems validate when required project airflow is complete; a retired one fails by name',()=>{
 for(const system of Object.keys(SYSTEMS)){
  const s=makeScenario('greenhouseDouble',system);
  if(system==='mushroom')Object.assign(s,{minVentACH:2,maxVentACH:8,outsideAirReviewed:true});
  assert.deepEqual(validateScenario(s),[],`${system} must validate`);
 }
 const errors=validateScenario({...makeScenario('greenhouseDouble'),system:'wall'});
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
 // Mushroom rooms are dark and ventilation-driven, but their project airflow cannot be guessed.
 const mushroom=makeScenario('greenhouseDouble','mushroom','mushroom');
 assert.equal(mushroom.canopyM2,racks.canopyM2);
 assert.ok(mushroom.lightWm2<bench.lightWm2&&mushroom.humidifierKgH>0);
 assert.equal(mushroom.minVentACH,null);assert.equal(mushroom.maxVentACH,null);
 assert.ok(validateScenario(mushroom).length>0);
});
test('a schemaVersion 1 non-DOAS scenario simulates without a prior validate call',()=>{
 const legacy={...makeScenario('greenhouseDouble'),schemaVersion:1};
 for(const key of ['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC'])delete legacy[key];
 const result=simulateScenario(legacy,weather(24,{tempC:28,rh:.7,ghiWm2:500}));
 assert.equal(result.summary.numericalFailureHours,0);
 assert.equal(result.summary.validHours,24);
 assert.equal(Object.hasOwn(legacy,'lai'),false,'the caller object must not be mutated');
});
const V03_KEYS=['heatSource','heatPumpCopAt8C','heatPumpCopAtMinus8C','heatPumpCopAtMinus15C','heatPumpCutoffC','heatPumpCapacityDerate','shadeScreen','thermalScreen'];
test('scenario JSON written before the component keys existed validates and simulates unchanged',()=>{
 const legacy={...makeScenario('greenhouseDouble')};
 for(const key of V03_KEYS)delete legacy[key];
 const fixture=diurnal();
 const before=simulateScenario(legacy,fixture);
 assert.equal(Object.hasOwn(legacy,'shadeScreen'),false,'the caller object must not be mutated');
 assert.deepEqual(validateScenario(legacy),[]);
 const migrated=migrateScenario(legacy);
 assert.equal(Object.hasOwn(legacy,'heatSource'),false,'migration must not mutate its input');
 assert.equal(migrated.heatSource,'fuel');
 assert.equal(migrated.shadeScreen.installed,false);
 assert.equal(migrated.thermalScreen.installed,false);
 assert.equal(migrated.heatPumpCopAt8C,null,'an unsourced rating point must stay null rather than acquire a default');
 const after=simulateScenario(legacy,fixture);
 for(const key of ['electricKWh','fuelKWh','heatingKWh','coolingKWh','compliancePct'])assert.equal(after.summary[key],before.summary[key],`${key} changed for a scenario that declares no components`);
 assert.equal(after.summary.screens.shadeHours,0);
 assert.equal(after.summary.screens.dliCostMol,0);
 assert.equal(after.summary.screens.heatingSavedKWh,0);
 // Two scenarios must never share one screen object, or editing one would edit the other.
 const a=makeScenario('greenhouseDouble'),b=makeScenario('greenhouseDouble');
 a.shadeScreen.installed=true;
 assert.equal(b.shadeScreen.installed,false);
 assert.equal(DEFAULT_SCENARIO.shadeScreen.installed,false);
});
test('every facility template carries a sourced envelope and explicit airflow review status',()=>{
 for(const key of Object.keys(FACILITIES)){
  const s=makeScenario(key);
  const candidate={...s,outsideAirReviewed:true};
  assert.deepEqual(validateScenario(candidate),[],`${key} must validate after explicit airflow review`);
  const template=FACILITY_TEMPLATES[key];
  assert.ok(template&&typeof template.source==='string'&&template.source.length>20,`${key} must state where its envelope came from`);
  assert.ok(Object.hasOwn(template,'outsideAirBasis'),`${key} must classify its controlled-air basis`);
  assert.equal(s.uValue,template.uValue,`${key} must load its template U-value`);
  if(OPAQUE_FACILITIES.has(key)){
   assert.equal(s.parTransmission,0);assert.equal(s.solarTransmission,0);
   assert.ok(validateScenario({...candidate,parTransmission:.5}).length>0,`${key} must refuse a transparent envelope`);
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

// A closed facility is not a sealed one. The opaque templates keep infiltration separate and cap the designed
// controlled outdoor-air path at 2 ACH. A user who raises that capacity must actually get the benefit. Cold dry
// outside air is the cheapest moisture sink a lit box has, so the path must carry water out and displace
// mechanical condensation, while opening it too far must import more heating load than it is worth. Both
// directions are pinned because the shape is non-monotonic and a naive model would make more air always better.
const coldDry=(hours=48)=>({schemaVersion:1,source:'Synthetic cold-dry fixture',sourceKind:'test',latitude:64.84,longitude:-147.72,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-02',
 hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:-22,rh:.7,pressurePa:99000,ghiWm2:0}))});
const litBox=(over={})=>({...makeScenario('warehouseSip','bench','lettuce'),outsideAirReviewed:true,timezone:'UTC',areaM2:500,heightM:4,
 lightWm2:150,dliTarget:14,photoperiod:16,dayStart:6,coolingKW:150,dehuKgH:30,heaterKW:60,humidifierKgH:0,
 padEnabled:false,controlMode:'ideal',minVentACH:.3,...over});
const controlledLatentKg=result=>result.hours.reduce((sum,h)=>sum+Math.max(0,-(h.loads?.latentKg?.controlledOutdoorAir||0)),0);

test('a closed facility can use outside air as a moisture sink as controlled capacity rises',()=>{
  const leak=simulateScenario(litBox({maxVentACH:2}),coldDry());
  const econ=simulateScenario(litBox({maxVentACH:6}),coldDry());
  const flood=simulateScenario(litBox({maxVentACH:40}),coldDry());
  assert.ok(controlledLatentKg(econ)>controlledLatentKg(leak),
    `6 ACH must export more water than 2 ACH: ${controlledLatentKg(econ)} against ${controlledLatentKg(leak)}`);
  assert.ok(econ.summary.condensateKg<leak.summary.condensateKg,
    `an economizer must displace mechanical condensation: ${econ.summary.condensateKg} against ${leak.summary.condensateKg}`);
  for(const r of [leak,econ,flood]) assert.equal(r.summary.numericalFailureHours,0);
});
test('ideal dispatcher can select every controlled outdoor-air stage',()=>{
 const cases=[
  {expected:.3,hour:0,tempC:-10,rh:.1,cropSensibleWm2:0,transpirationLDayM2:0},
  {expected:10.225,hour:0,tempC:18,rh:.9,cropSensibleWm2:50,transpirationLDayM2:10},
  {expected:20.15,hour:1,tempC:24,rh:.7,cropSensibleWm2:50,transpirationLDayM2:5},
  {expected:30.075,hour:0,tempC:20,rh:.9,cropSensibleWm2:0,transpirationLDayM2:5},
  {expected:40,hour:1,tempC:20,rh:.9,cropSensibleWm2:0,transpirationLDayM2:5},
 ];
 for(const c of cases){
  const s=closed({controlMode:'ideal',minVentACH:.3,maxVentACH:40,cropSensibleWm2:c.cropSensibleWm2,
   transpirationLDayM2:c.transpirationLDayM2,heaterKW:200,thermalMassKJm2K:2000});
  const result=simulateScenario(s,weather(2,{tempC:c.tempC,rh:c.rh}),{stepMinutes:5});
  assert.equal(result.controlModeUsed,'ideal');
  assert.ok(Math.abs(result.hours[c.hour].controls.controlledACH-c.expected)<1e-9,
   `${c.expected} ACH stage was not selected: ${result.hours[c.hour].controls.controlledACH}`);
 }
});
test('staged controller can sustain every controlled outdoor-air stage and rejects adverse air',()=>{
 const stages=[
  {expected:.3,hour:0,tempC:-10,rh:.1,cropSensibleWm2:0,transpirationLDayM2:0},
  {expected:10.225,hour:2,tempC:-10,rh:.1,cropSensibleWm2:0,transpirationLDayM2:.5},
  {expected:20.15,hour:11,tempC:0,rh:.1,cropSensibleWm2:0,transpirationLDayM2:.5},
  {expected:30.075,hour:10,tempC:5,rh:.1,cropSensibleWm2:10,transpirationLDayM2:0},
  {expected:40,hour:7,tempC:10,rh:.9,cropSensibleWm2:10,transpirationLDayM2:10},
 ];
 for(const c of stages){
  const s=closed({controlMode:'staged',minVentACH:.3,maxVentACH:40,cropSensibleWm2:c.cropSensibleWm2,
   transpirationLDayM2:c.transpirationLDayM2,coolingKW:20,dehuKgH:20,heaterKW:200,fanWPerM3s:0,
   thermalMassKJm2K:50});
  const result=simulateScenario(s,weather(24,{tempC:c.tempC,rh:c.rh}),{stepMinutes:5});
  assert.equal(result.controlModeUsed,'staged');
  assert.ok(Math.abs(result.hours[c.hour].controls.controlledACH-c.expected)<1e-9,
   `${c.expected} ACH stage was not sustained: ${result.hours[c.hour].controls.controlledACH}`);
 }
 const adverseScenario=closed({controlMode:'staged',minVentACH:.3,maxVentACH:40,cropSensibleWm2:80,
  transpirationLDayM2:1,coolingKW:20,dehuKgH:20,heaterKW:200,thermalMassKJm2K:50});
 const adverse=simulateScenario(adverseScenario,weather(24,{tempC:35,rh:.9}));
 for(const h of adverse.hours.filter(h=>h.valid))
  assert.ok(Math.abs(h.controls.controlledACH-adverseScenario.minVentACH)<1e-9,
   `adverse untreated air selected ${h.controls.controlledACH} ACH`);
});
test('DOAS capacity conditions one selected stream without increasing outdoor airflow',()=>{
 const s=closed({controlMode:'staged',infiltrationACH:.7,minVentACH:.3,maxVentACH:40,technology:'doas',
  doasM3s:2,doasSupplyDewPointC:8,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  cropSensibleWm2:80,transpirationLDayM2:1,heaterKW:200,thermalMassKJm2K:50});
 const result=simulateScenario(s,weather(12,{tempC:15,rh:.2}));
 const volume=s.areaM2*s.heightM;
 for(const h of result.hours.filter(h=>h.valid)){
  assert.ok(h.controls.controlledACH<=s.maxVentACH+1e-9);
  assert.ok(Math.abs(h.controls.controlledM3s-h.controls.controlledACH*volume/3600)<1e-12);
  assert.ok(Math.abs(h.controls.totalOutdoorACH-(s.infiltrationACH+h.controls.controlledACH))<1e-12);
  assert.ok(Math.abs(h.controls.totalOutdoorM3s-(s.infiltrationACH*volume/3600+h.controls.controlledM3s))<1e-12);
 }
});
test('DOAS eligibility follows curtain-capped actual controlled flow rather than the requested stage',()=>{
 const s=closed({controlMode:'ideal',infiltrationACH:.7,minVentACH:40,maxVentACH:40,technology:'doas',
  doasM3s:.2,doasSupplyDewPointC:8,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  cropSensibleWm2:0,transpirationLDayM2:10,heaterKW:200,thermalMassKJm2K:50});
 s.thermalScreen={...s.thermalScreen,installed:true,uValueFactor:.8,nightDeploy:true,closedExchangeACH:2};
 const result=simulateScenario(s,weather(12,{tempC:15,rh:.8}));
 assert.ok(result.hours.some(h=>h.controls.doasConditionedFraction>0),'capped flow within DOAS capacity must be conditioned');
 for(const h of result.hours.filter(h=>h.controls.thermalScreenFraction>0))
  assert.ok(h.controls.controlledACH<=1.3+1e-9,`curtain-capped controlled flow reached ${h.controls.controlledACH} ACH`);
});
test('screen-open references validate declared airflow before applying the insect derate once',()=>{
 const s=closed({controlMode:'ideal',minVentACH:.3,maxVentACH:40,technology:'doas',
  doasM3s:3,doasSupplyDewPointC:8,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  heaterKW:200});
 s.insectScreen={...s.insectScreen,installed:true,ventilationFactor:.5};
 s.thermalScreen={...s.thermalScreen,installed:true,uValueFactor:.8,nightDeploy:true};
 const result=simulateScenario(s,weather(2,{tempC:15,rh:.8}),{stepMinutes:5});
 assert.equal(result.scenario.maxVentACH,20,'the declared 40 ACH capacity must receive one 0.5 insect derate');
 assert.ok(Number.isFinite(result.summary.screens.heatingSavedKWh),
  'the automatic screen-open reference must complete from the declared scenario');
});


test('DOAS supply temperature and dew-point targets report finite cold-weather tempering rather than assigning the target for free',()=>{
  const box=closed({controlMode:'staged',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
    transpirationLDayM2:10,heaterKW:50,thermalMassKJm2K:20,
    doasM3s:1,doasSupplyDewPointC:10,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5});
  const result=simulateScenario(box,weather(12,{tempC:0,rh:.35}),{stepMinutes:5});
  const working=result.hours.filter(h=>h.valid&&h.controls.doasConditionedFraction>0);
  assert.ok(working.length>0,'fixture must call for conditioned controlled air');
  assert.ok(working.every(h=>h.doasCondensateKg===0),'air below the declared dew point must not condense');
  assert.ok(working.every(h=>h.doasCoolingDeliveredKWh===0&&h.doasCoolingElectricKWh===0));
  assert.ok(result.summary.doasExternalHeatKWh>0,'warming cold controlled air to 21 C requires delivered heat');
  assert.ok(result.summary.fuelKWh>=result.summary.doasExternalHeatKWh/result.scenario.heaterEfficiency-1e-9,
    'DOAS external heat must be booked to the configured fuel source');
  assert.ok(result.warnings.some(w=>/21 C.*10 C.*COP 3.*0\.5.*1(?:\.0)? m3\/s/i.test(w)));
  assert.ok(result.warnings.some(w=>/combined controlled-air fan/i.test(w)));
  assert.ok(result.warnings.some(w=>/exclud/i.test(w)));
  assert.deepEqual(result.assumptions.airflow.doas,{
    supplyTempC:21,supplyDewPointC:10,coolingCOP:3,reheatRecoveryFraction:.5,treatmentCapacityM3s:1,
    treatmentOrder:'Outdoor air, optional heat recovery, optional DOAS, zone.',
    fanBasis:'One combined controlled-air fan power basis; treatment does not add airflow.',
    exclusions:'No cycling, frost, duct, drain, or separate process-fan performance beyond declared inputs.',
  });
});

// Where a dehumidifier's heat lands is a topology choice, not a property of the machine, and it is the whole
// reason an integrated unit with hot-gas reheat exists. An in-room or ducted-and-returned unit puts the latent
// heat it removed plus its own electrical input back into the crop air, which the cooling plant must remove
// again. A remote-condenser or water-cooled unit rejects it outside, which makes the same machine a net
// cooling device. Both directions are pinned, along with the conservation of the split.
test('a dehumidifier releases its heat where the topology says, and the split conserves',()=>{
  const wet=(hours=48)=>({schemaVersion:1,source:'Synthetic warm-wet fixture',sourceKind:'test',latitude:25.77,longitude:-80.19,timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-02',
   hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,6,1,i),tempC:28,rh:.85,pressurePa:101325,ghiWm2:0}))});
  const room=over=>({...makeScenario('indoor','bench','lettuce'),outsideAirReviewed:true,timezone:'UTC',areaM2:200,heightM:4,
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
