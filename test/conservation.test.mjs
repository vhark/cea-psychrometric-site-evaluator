import test from 'node:test';
import assert from 'node:assert/strict';
import {makeScenario,applyTechnology} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {compareScenarios} from '../src/metrics.js';
import {CP_DRY_AIR as CP,LATENT_HEAT as L,dryAirDensity,humidityRatio,saturationPressure,vaporPressure,moistureBounds,padState} from '../src/physics.js';
// Quantitative conservation regressions (AUDIT item 2). Each expectation is built from the scenario
// inputs and the psychrometric primitives, never from the summary field under test. Fixtures are
// closed zones with every exchange and device zeroed except the single path being measured, so the
// analytic answer is exact and a wrong coefficient, density, mass flow or latent heat must fail.
const KWH=3600000;
const snapshot=(hours)=>({schemaVersion:1,source:'Synthetic conservation fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,
  timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01',hours});
const weather=(count=24,changes={},day=1)=>snapshot(Array.from({length:count},(_,i)=>
  ({time:Date.UTC(2025,0,day,i),tempC:22,rh:.6,pressurePa:101325,ghiWm2:0,...changes})));
const closed=(overrides={})=>({...makeScenario('indoor'),timezone:'UTC',areaM2:100,canopyM2:100,heightM:4,dayTargetC:22,nightTargetC:22,
  tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,uValue:.05,infiltrationACH:0,minVentACH:0,maxVentACH:0,lightWm2:0,dliTarget:0,
  transpirationModel:'schedule',transpirationLDayM2:0,cropSensibleWm2:0,coolingKW:0,dehuKgH:0,heaterKW:0,humidifierKgH:0,padEnabled:false,...overrides});
// The segment initializes at the current temperature target and the midpoint of the moisture band, so the
// frozen dry-air inventory and the reduced thermal capacitance are both known before the run starts.
function zoneInventory(s,pressurePa=101325,tempC=s.dayTargetC) {
  const b=moistureBounds(tempC,pressurePa,s),w=(b.minW+b.maxW)/2;
  const mass=dryAirDensity(tempC,w,pressurePa)*s.areaM2*s.heightM;
  return {tempC,w,minW:b.minW,maxW:b.maxW,mass,capacity:s.areaM2*s.thermalMassKJm2K*1000+mass*CP};
}
const runSeconds=(result,field)=>result.hours.reduce((sum,h)=>sum+(h.controls?.[field]||0)*3600,0);

test('pad water is the humidity-ratio rise across the pad carried by the ventilation dry-air mass flow',()=>{
 const s=closed({padEnabled:true,technology:'pad',minVentACH:0,maxVentACH:20,padEffectiveness:.8,padPumpW:0,uValue:1,envelopeRatio:1.8});
 const hot={tempC:38,rh:.1,pressurePa:101325};
 const result=simulateScenario(s,weather(12,hot));
 // Independent expectation: pad leaving state from padState, mass flow at the pad leaving density and the
 // evaporative airflow (pad operation runs the fans at maxVentACH), integrated over measured pad runtime.
 const outsideW=humidityRatio(hot.tempC,hot.rh,hot.pressurePa);
 const pad=padState(hot.tempC,outsideW,hot.pressurePa,s.padEffectiveness);
 const flowKgS=dryAirDensity(pad.tempC,pad.w,hot.pressurePa)*s.areaM2*s.heightM*s.maxVentACH/3600;
 const expectedL=flowKgS*(pad.w-outsideW)*runSeconds(result,'padFraction');
 assert.equal(result.summary.numericalFailureHours,0);
 assert.ok(result.summary.runtime.pad.hours>=10,`fixture must run the pad: ${result.summary.runtime.pad.hours} h`);
 assert.ok(expectedL>500,`fixture must move real water: ${expectedL} L`);
 assert.ok(Math.abs(result.summary.padWaterL-expectedL)<=.01*expectedL,
  `pad water ${result.summary.padWaterL} L vs mass-balance ${expectedL} L`);
 assert.equal(runSeconds(result,'indirectFraction'),0,'direct pad fixture must not use the indirect secondary stream');
});

test('indirect evaporative water matches the sensible heat its secondary stream rejects and never enters the zone',()=>{
 const s={...applyTechnology(closed({minVentACH:0,maxVentACH:20,uValue:1,envelopeRatio:1.8,padPumpW:0}),'hybridDesiccant'),
  timezone:'UTC',hybridEvapEffectiveness:.8,heaterKW:0,humidifierKgH:0,lightWm2:0,dliTarget:0,transpirationModel:'schedule',
  transpirationLDayM2:0,cropSensibleWm2:0,dayTargetC:22,nightTargetC:22,tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19};
 const hot={tempC:38,rh:.1,pressurePa:101325};
 const result=simulateScenario(s,weather(12,hot));
 const outsideW=humidityRatio(hot.tempC,hot.rh,hot.pressurePa);
 const supplyC=hot.tempC-s.hybridEvapEffectiveness*(hot.tempC-padState(hot.tempC,outsideW,hot.pressurePa).wetBulbC);
 // The dry primary stream leaves at supplyC carrying outdoor moisture; the water is the latent equivalent of
 // the sensible heat handed to the wet secondary stream, m*cp*dT = L*mWater.
 const flowKgS=dryAirDensity(supplyC,outsideW,hot.pressurePa)*s.areaM2*s.heightM*s.maxVentACH/3600;
 const expectedL=flowKgS*CP*(hot.tempC-supplyC)/L*runSeconds(result,'indirectFraction');
 assert.equal(result.summary.numericalFailureHours,0);
 assert.ok(result.summary.runtime.indirect.hours>=10,`fixture must run indirect evaporation: ${result.summary.runtime.indirect.hours} h`);
 assert.ok(expectedL>500,`fixture must move real water: ${expectedL} L`);
 assert.ok(Math.abs(result.summary.padWaterL-expectedL)<=1e-9*expectedL,
  `indirect water ${result.summary.padWaterL} L vs latent-equivalent ${expectedL} L`);
 assert.equal(runSeconds(result,'padFraction'),0,'hybrid indirect must not also bill direct pad water');
 // A secondary stream wets only itself: the zone equilibrates at the outdoor humidity ratio, not the pad state,
 // and no hourly ventilation moisture gain is booked while dry outdoor air is being supplied.
 const last=result.hours.at(-1);
 assert.ok(Math.abs(last.humidityRatio-outsideW)<=1e-9,`zone humidity ratio ${last.humidityRatio} left outdoor ${outsideW}`);
 for(const h of result.hours)if(h.controls?.indirectFraction>0)
  assert.ok(h.loads.latentKg.ventilation<=0,`hour ${h.time} gained ${h.loads.latentKg.ventilation} kg from the indirect supply`);
});

test('humidifier water enters the zone air and cools it by exactly its latent heat',()=>{
 // Sealed zone warmed by crop sensible heat only: the rising band pulls the humidifier on, and nothing
 // else adds or removes moisture, so the added mass and its latent cooling are both analytic.
 const s=closed({uValue:.05,envelopeRatio:.5,thermalMassKJm2K:100,cropSensibleWm2:10,maxDewPointC:24,humidifierKgH:5});
 const dry={...s,id:'dry',name:'No humidifier',humidifierKgH:0};
 const period=weather(12,{tempC:22,rh:.5});
 const wet=simulateScenario(s,period),arid=simulateScenario(dry,period);
 const {w:startW,mass,capacity}=zoneInventory(s);
 const kg=wet.summary.humidifierWaterL,ua=s.areaM2*s.envelopeRatio*s.uValue,seconds=12*3600;
 assert.equal(wet.summary.numericalFailureHours+arid.summary.numericalFailureHours,0);
 assert.ok(kg>1,`fixture must humidify: ${kg} kg`);
 assert.equal(wet.summary.surfaceCondensateKg,0,'condensation would return latent heat and void the identity');
 assert.ok(Math.abs(mass*(wet.hours.at(-1).humidityRatio-startW)-kg)<=1e-9*kg,
  `zone vapor inventory rose ${mass*(wet.hours.at(-1).humidityRatio-startW)} kg for ${kg} kg of humidifier water`);
 // Difference of the two runs: C dT/dt = -UA T - L h(t), so the depression is L*kg/C decayed by at most
 // one envelope time constant over the record. Both bounds are independent of the reported humidifier energy.
 const depression=arid.hours.at(-1).tempC-wet.hours.at(-1).tempC;
 const adiabatic=L*kg/capacity,floor=adiabatic*Math.exp(-ua*seconds/capacity);
 assert.ok(depression<=adiabatic+1e-9&&depression>=floor-1e-9,
  `latent cooling ${depression} K outside [${floor}, ${adiabatic}] K for ${kg} kg`);
});

test('free-running zone temperature follows the analytic envelope and infiltration exponential',()=>{
 // Every device off and constant outdoor forcing: the only exchange coefficients are UA and the
 // infiltration dry-air mass flow, so T(t) and w(t) are closed-form first-order approaches.
 const s=closed({infiltrationACH:1,uValue:.05,envelopeRatio:1.8,thermalMassKJm2K:100});
 const outdoor={tempC:5,rh:.4,pressurePa:101325};
 const result=simulateScenario(s,weather(8,outdoor));
 const {tempC:startC,w:startW,mass,capacity}=zoneInventory(s,outdoor.pressurePa);
 const outsideW=humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa);
 const leakKgS=dryAirDensity(outdoor.tempC,outsideW,outdoor.pressurePa)*s.areaM2*s.heightM*s.infiltrationACH/3600;
 const tau=capacity/(s.areaM2*s.envelopeRatio*s.uValue+CP*leakKgS),tauW=mass/leakKgS;
 assert.equal(result.summary.numericalFailureHours,0);
 assert.equal(result.summary.surfaceCondensateKg,0,'a condensing trajectory is not the pure exchange problem');
 assert.equal(result.summary.electricKWh+result.summary.fuelKWh,0,'no device may operate in the free-running fixture');
 for(const index of [0,1,3,5,7]){
  const seconds=(index+1)*3600,row=result.hours[index];
  const expectedC=outdoor.tempC+(startC-outdoor.tempC)*Math.exp(-seconds/tau);
  const expectedW=outsideW+(startW-outsideW)*Math.exp(-seconds/tauW);
  assert.ok(Math.abs(row.tempC-expectedC)<=.05,`hour ${index+1}: ${row.tempC} C vs analytic ${expectedC} C (tau ${tau/3600} h)`);
  assert.ok(Math.abs(row.humidityRatio-expectedW)<=1e-6*Math.max(expectedW,outsideW),
   `hour ${index+1}: ${row.humidityRatio} kg/kg vs analytic ${expectedW} kg/kg`);
 }
 assert.ok(startC-result.hours.at(-1).tempC>5,'fixture must actually drift, not sit on the initial state');
});

test('integrated DX splits the coil total into sensible and latent and closes the condenser heat balance',()=>{
 const s={...applyTechnology(closed({uValue:.5,envelopeRatio:1.8,infiltrationACH:.5,transpirationModel:'schedule',transpirationLDayM2:3}),'integrated'),
  timezone:'UTC',dayTargetC:22,nightTargetC:22,tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,lightWm2:0,dliTarget:0,
  cropSensibleWm2:0,humidifierKgH:0,heaterKW:0,minVentACH:0,maxVentACH:0,padEnabled:false,coolingKW:20,coolingSHR:.75,coolingCOP:3,
  reheatFraction:.5,integratedHVAC:true};
 assert.equal(s.dehuKgH,0);assert.equal(s.desiccantKgH,0);// so removed moisture is the coil's alone
 const result=simulateScenario(s,weather(12,{tempC:18,rh:.95}));
 assert.equal(result.summary.numericalFailureHours,0);
 const working=result.hours.filter(h=>h.valid&&h.coolingKWh>0&&h.reheatKWh>0);
 assert.ok(working.length>=6,`fixture must run coil and reheat together: ${working.length} hours`);
 for(const h of working){
  // Coil total = delivered sensible + latent of the water it condenses.
  const coilKWh=h.loads.dxSensibleKWh+L*h.loads.latentKg.removed/KWH;
  assert.ok(Math.abs(coilKWh-h.coolingKWh)<=1e-6*h.coolingKWh,`hour ${h.time}: coil ${h.coolingKWh} kWh vs parts ${coilKWh} kWh`);
  // Declared sensible capacity at the reported duty, so unused latent capacity is not made sensible.
  const sensibleKWh=s.coolingKW*s.coolingSHR*h.controls.dxDuty;
  assert.ok(Math.abs(h.loads.dxSensibleKWh-sensibleKWh)<=1e-6*sensibleKWh,
   `hour ${h.time}: sensible ${h.loads.dxSensibleKWh} kWh vs capacity times duty ${sensibleKWh} kWh`);
  // Condenser heat = evaporator heat + compressor work; every joule is recovered as reheat or rejected.
  const condenserKWh=h.coolingKWh*(1+1/s.coolingCOP);
  assert.ok(Math.abs(h.reheatKWh+h.rejectedHeatKWh-condenserKWh)<=1e-6*condenserKWh,
   `hour ${h.time}: reheat ${h.reheatKWh} + rejected ${h.rejectedHeatKWh} vs condenser ${condenserKWh} kWh`);
  assert.ok(h.reheatKWh<=s.reheatFraction*condenserKWh+1e-9,`hour ${h.time}: reheat exceeds the recoverable fraction`);
 }
});

test('disjoint records and failed runs yield null comparisons instead of a winner',()=>{
 const record=(day,changes)=>snapshot(Array.from({length:6},(_,i)=>({time:Date.UTC(2025,0,day,i),pressurePa:101325,ghiWm2:0,...changes})));
 const cold=simulateScenario({...closed({uValue:5,envelopeRatio:2,heaterKW:60}),id:'cold',name:'Cold record',electricityPrice:.05},record(1,{tempC:-5,rh:.6}));
 const hot=simulateScenario({...closed({uValue:5,envelopeRatio:2,coolingKW:60,dehuKgH:20}),id:'hot',name:'Hot record',electricityPrice:.5},record(3,{tempC:36,rh:.4}));
 assert.ok(cold.summary.cost>0&&hot.summary.cost>0,'both runs must have their own priced operation');
 assert.ok(cold.summary.compliantHours>hot.summary.compliantHours,'fixture must look like a winner on its own record');
 for(const row of compareScenarios([cold,hot])){
  assert.equal(row.matchedHours,0,`${row.id} claims ${row.matchedHours} shared intervals between separate records`);
  assert.equal(row.cost,null);assert.equal(row.compliancePct,null);assert.equal(row.addedCost,null);
  assert.equal(row.costPerAddedHour,null);assert.equal(row.comparable,false);assert.equal(row.dominated,false);
 }
 // Same equipment, same weather, same tariff structure: the failing run is on a cheaper tariff and a light
 // structure that cannot hold the final out-of-domain hour. Unguarded dominance would crown it.
 const base=closed({uValue:8,envelopeRatio:2,minVentACH:.3,maxVentACH:2,fanWPerM3s:180,lightWm2:500,dayStart:12,photoperiod:1,dliTarget:10});
 const inventory=zoneInventory(base);
 const steady=vaporPressure(inventory.w,101325)/saturationPressure(base.dayTargetC);
 const hours=Array.from({length:13},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:base.dayTargetC,rh:steady,pressurePa:101325,ghiWm2:0}));
 hours[12]={time:Date.UTC(2025,0,1,12),tempC:65,rh:.05,pressurePa:30000,ghiWm2:0};
 const failing=simulateScenario({...base,id:'light',name:'Light structure',thermalMassKJm2K:5,electricityPrice:.05},snapshot(hours));
 const sound=simulateScenario({...base,id:'massive',name:'Massive structure',thermalMassKJm2K:2000,electricityPrice:.2},snapshot(hours));
 assert.ok(failing.summary.numericalFailureHours>0,'fixture must produce a numerical/physical domain failure');
 assert.equal(sound.summary.numericalFailureHours,0,'the reference run must survive the same record');
 const [soundRow,failingRow]=compareScenarios([sound,failing]);
 assert.ok(failingRow.matchedHours>0,'the runs must still share eligible intervals');
 assert.ok(failingRow.cost<soundRow.cost&&failingRow.compliantHours>=soundRow.compliantHours,
  `fixture must make the failed run look superior: ${failingRow.cost} vs ${soundRow.cost}`);
 assert.equal(failingRow.numericalFailureHours,failing.summary.numericalFailureHours);
 assert.equal(failingRow.comparable,false,'a run with numerical failures is not economically comparable');
 assert.equal(failingRow.costPerAddedHour,null);
 assert.equal(failingRow.dominated,false);
 assert.equal(soundRow.comparable,true);
 assert.equal(soundRow.dominated,false,'a numerically failed run must not dominate a sound one');
});
