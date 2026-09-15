import test from 'node:test';
import assert from 'node:assert/strict';
import {makeScenario,applyTechnology} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {compareScenarios} from '../src/metrics.js';
import {CP_DRY_AIR as CP,LATENT_HEAT as L,dryAirDensity,enthalpy,humidityRatio,saturationPressure,vaporPressure,moistureBounds,padState,saturationHumidityRatio} from '../src/physics.js';
// Quantitative conservation regressions (AUDIT item 2). Each expectation is built from the scenario
// inputs and the psychrometric primitives, never from the summary field under test. Fixtures are
// closed zones with every exchange and device zeroed except the single path being measured, so the
// analytic answer is exact and a wrong coefficient, density, mass flow or latent heat must fail.
const KWH=3600000;
const snapshot=(hours)=>({schemaVersion:1,source:'Synthetic conservation fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,
  timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01',hours});
const weather=(count=24,changes={},day=1)=>snapshot(Array.from({length:count},(_,i)=>
  ({time:Date.UTC(2025,0,day,i),tempC:22,rh:.6,pressurePa:101325,ghiWm2:0,...changes})));
const closed=(overrides={})=>({...makeScenario('indoor'),outsideAirReviewed:true,timezone:'UTC',areaM2:100,canopyM2:100,heightM:4,dayTargetC:22,nightTargetC:22,
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
const recovery=(type='hrv',overrides={})=>({
  type,nominalM3s:1,auxiliaryW:45,
  sensibleHeating75:.7,sensibleHeating100:.7,sensibleCooling75:.7,sensibleCooling100:.7,
  latentHeating75:.5,latentHeating100:.5,latentCooling75:.5,latentCooling100:.5,
  economizerBypass:true,frostControl:'none',minimumOutdoorOperatingC:-30,
  frostThresholdC:null,initialDefrostFraction:null,defrostRatePerK:null,...overrides});
function expectedRecoveryHour(s,outdoor,sensibleEffectiveness,latentEffectiveness=0,coreFraction=1) {
  const initial=zoneInventory(s,outdoor.pressurePa),dt=300,flowM3s=s.minVentACH*s.areaM2*s.heightM/3600;
  const flowKgS=dryAirDensity(outdoor.tempC,humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa),outdoor.pressurePa)*flowM3s;
  const outsideW=humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa);
  const ua=s.areaM2*s.envelopeRatio*s.uValue,conductance=ua+CP*flowKgS;
  const heatDecay=Math.exp(-conductance*dt/initial.capacity),massDecay=Math.exp(-flowKgS*dt/initial.mass);
  let tempC=initial.tempC,w=initial.w,sensibleKWh=0,latentKWh=0;
  for(let step=0;step<12;step++){
    const coreKgS=flowKgS*coreFraction;
    const recoveredTempC=outdoor.tempC+sensibleEffectiveness*(tempC-outdoor.tempC);
    const recoveredW=outsideW+latentEffectiveness*(w-outsideW);
    const supplyTempC=outdoor.tempC+coreFraction*(recoveredTempC-outdoor.tempC);
    const supplyW=outsideW+coreFraction*(recoveredW-outsideW);
    sensibleKWh+=coreKgS*CP*(recoveredTempC-outdoor.tempC)*dt/KWH;
    latentKWh+=coreKgS*L*(recoveredW-outsideW)*dt/KWH;
    tempC=tempC*heatDecay+(ua*outdoor.tempC+CP*flowKgS*supplyTempC)*(1-heatDecay)/conductance;
    w=w*massDecay+supplyW*(1-massDecay);
  }
  return {sensibleKWh,latentKWh};
}

test('closed-zone HRV supply sensible gain equals balanced exhaust loss and latent transfer is zero',()=>{
 const outdoor={tempC:-10,rh:.35,pressurePa:101325};
 const s=closed({controlMode:'ideal',minVentACH:9,maxVentACH:9,fanWPerM3s:0,thermalMassKJm2K:20,heatRecovery:recovery('hrv')});
 const result=simulateScenario(s,weather(1,outdoor),{stepMinutes:5});
 const expected=expectedRecoveryHour(s,outdoor,.7);
 const row=result.hours[0];
 assert.equal(row.controls.recoveryCoreFraction,1,'the closed-zone fixture must use the full balanced core flow');
 assert.ok(Math.abs(row.recoverySensibleKWh-expected.sensibleKWh)<=1e-9*Math.max(1,expected.sensibleKWh),
  `supply gained ${row.recoverySensibleKWh} kWh while the independently calculated exhaust loss was ${expected.sensibleKWh} kWh`);
 assert.equal(row.recoveryLatentKWh,0,'an HRV cannot transfer latent energy');
 assert.equal(result.summary.recoveryLatentKWh,0);
});

test('closed-zone ERV sensible plus latent transfer equals its balanced exhaust-side loss',()=>{
 const outdoor={tempC:-8,rh:.25,pressurePa:101325};
 const s=closed({controlMode:'ideal',minVentACH:9,maxVentACH:9,fanWPerM3s:0,thermalMassKJm2K:20,heatRecovery:recovery('erv')});
 const result=simulateScenario(s,weather(1,outdoor),{stepMinutes:5});
 const expected=expectedRecoveryHour(s,outdoor,.7,.5);
 const row=result.hours[0];
 assert.equal(row.controls.recoveryCoreFraction,1);
 assert.ok(Math.abs(row.recoverySensibleKWh-expected.sensibleKWh)<=1e-9*Math.max(1,expected.sensibleKWh));
 assert.ok(Math.abs(row.recoveryLatentKWh-expected.latentKWh)<=1e-9*Math.max(1,expected.latentKWh));
 assert.ok(Math.abs(row.recoverySensibleKWh+row.recoveryLatentKWh-expected.sensibleKWh-expected.latentKWh)<=1e-9*Math.max(1,expected.sensibleKWh+expected.latentKWh),
  'ERV supply transfer must close against the independently calculated balanced exhaust loss');
});

test('exhaust-only frost reduces recovered flow exactly while preserving the controlled supply stream',()=>{
 const outdoor={tempC:-10,rh:.35,pressurePa:101325};
 const configured=recovery('hrv',{frostControl:'exhaustOnly',frostThresholdC:-5,initialDefrostFraction:.1,defrostRatePerK:.05,minimumOutdoorOperatingC:null});
 const s=closed({controlMode:'ideal',minVentACH:9,maxVentACH:9,fanWPerM3s:0,thermalMassKJm2K:20,heatRecovery:configured});
 const result=simulateScenario(s,weather(1,outdoor),{stepMinutes:5});
 const row=result.hours[0],expected=expectedRecoveryHour(s,outdoor,.7,0,.65);
 assert.ok(Math.abs(row.controls.controlledM3s-1)<1e-12,'defrost must not reduce controlled supply volume');
 assert.ok(Math.abs(row.controls.recoveryCoreFraction-.65)<1e-12);
 assert.ok(Math.abs(row.controls.recoveryBypassFraction-.35)<1e-12);
 assert.ok(Math.abs(row.recoveryCoreM3-2340)<1e-8);
 assert.ok(Math.abs(result.summary.recoveryCoreM3-2340)<1e-8);
 assert.ok(Math.abs(row.recoverySensibleKWh-expected.sensibleKWh)<=1e-9*Math.max(1,expected.sensibleKWh),
  `frost recovery ${row.recoverySensibleKWh} kWh did not equal 0.65 of each independently calculated full-core transfer`);
 assert.ok(Math.abs(row.recoveryDefrostHours-.35)<1e-12);
});

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
  assert.ok(h.loads.latentKg.controlledOutdoorAir<=0,`hour ${h.time} gained ${h.loads.latentKg.controlledOutdoorAir} kg from the indirect supply`);
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
test('zero controlled-air capacity stays off while independent infiltration changes heat and moisture',()=>{
 const base=closed({minVentACH:0,maxVentACH:0,uValue:.05,envelopeRatio:1.8,thermalMassKJm2K:100});
 const outdoor={tempC:5,rh:.4,pressurePa:101325};
 const sealed=simulateScenario(base,weather(4,outdoor));
 const leaky=simulateScenario({...base,infiltrationACH:1},weather(4,outdoor));
 for(const h of leaky.hours.filter(h=>h.valid)){
  assert.equal(h.controls.controlledACH,0);
  assert.equal(h.controls.controlledM3s,0);
  assert.ok(Math.abs(h.controls.totalOutdoorACH-1)<1e-12);
  assert.ok(Math.abs(h.controls.totalOutdoorM3s-base.areaM2*base.heightM/3600)<1e-12);
 }
 assert.ok(leaky.hours.at(-1).tempC<sealed.hours.at(-1).tempC-1,'infiltration must cool the zone without controlled air');
 assert.ok(leaky.hours.at(-1).humidityRatio<sealed.hours.at(-1).humidityRatio-1e-4,
  'infiltration must change zone moisture without controlled air');
});
test('free-running exchange uses infiltration plus exactly one controlled dry-air stream',()=>{
 const s=closed({infiltrationACH:1,minVentACH:2,maxVentACH:2,fanWPerM3s:0,uValue:.05,envelopeRatio:1.8,thermalMassKJm2K:100});
 const outdoor={tempC:5,rh:.4,pressurePa:101325};
 const result=simulateScenario(s,weather(8,outdoor));
 const {tempC:startC,w:startW,mass,capacity}=zoneInventory(s,outdoor.pressurePa);
 const outsideW=humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa);
 const totalACH=s.infiltrationACH+s.minVentACH;
 const totalKgS=dryAirDensity(outdoor.tempC,outsideW,outdoor.pressurePa)*s.areaM2*s.heightM*totalACH/3600;
 const tau=capacity/(s.areaM2*s.envelopeRatio*s.uValue+CP*totalKgS),tauW=mass/totalKgS;
 for(const [index,row] of result.hours.entries()){
  const seconds=(index+1)*3600;
  const expectedC=outdoor.tempC+(startC-outdoor.tempC)*Math.exp(-seconds/tau);
  const expectedW=outsideW+(startW-outsideW)*Math.exp(-seconds/tauW);
  assert.ok(Math.abs(row.tempC-expectedC)<=.05,`hour ${index+1}: ${row.tempC} C vs one-stream analytic ${expectedC} C`);
  assert.ok(Math.abs(row.humidityRatio-expectedW)<=1e-6*Math.max(expectedW,outsideW),
   `hour ${index+1}: ${row.humidityRatio} kg/kg vs one-stream analytic ${expectedW} kg/kg`);
  assert.ok(Math.abs(row.controls.controlledACH-2)<1e-12);
  assert.ok(Math.abs(row.controls.totalOutdoorACH-3)<1e-12);
 }
 assert.equal(result.summary.recoveryCoreM3,0);
 assert.equal(result.summary.recoveryBypassM3,0);
 for(const row of result.hours){
  assert.equal(row.recoveryCoreM3,0);
  assert.equal(row.recoveryBypassM3,0);
 }
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
test('recovery preheat, DOAS tempering, and zone heat share one finite configured heating source',()=>{
 const outdoor={tempC:0,rh:.35,pressurePa:101325};
 const base={controlMode:'staged',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  transpirationLDayM2:10,heaterKW:8,thermalMassKJm2K:20,
  doasM3s:1,doasSupplyDewPointC:10,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:0,
  heatRecovery:recovery('hrv',{auxiliaryW:0,frostControl:'preheat',minimumOutdoorOperatingC:null,frostThresholdC:5})};
 const fixtures=[
  {name:'fuel',scenario:closed(base),purchase:'fuelKWh',divisor:closed(base).heaterEfficiency},
  {name:'heat pump',scenario:closed({...base,heatSource:'heatpump',heatPumpCopAt8C:2,heatPumpCopAtMinus8C:2,
    heatPumpCopAtMinus15C:2,heatPumpCutoffC:-25,heatPumpCapacityDerate:1}),purchase:'electricKWh',divisor:2},
 ];
 for(const fixture of fixtures){
  const result=simulateScenario(fixture.scenario,weather(6,outdoor),{stepMinutes:5});
  const delivered=result.summary.preheatDeliveredKWh+result.summary.doasExternalHeatKWh+result.summary.heatingKWh;
  const maximum=fixture.scenario.heaterKW*result.summary.validHours;
  const outsideW=humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa);
  const preheatDemandW=dryAirDensity(outdoor.tempC,outsideW,outdoor.pressurePa)*
    (enthalpy(5,outsideW)-enthalpy(outdoor.tempC,outsideW));
  assert.ok(Math.abs(result.summary.preheatDeliveredKWh-preheatDemandW*result.summary.recoveryCoreM3/KWH)
    <=1e-8*Math.max(1,result.summary.preheatDeliveredKWh),`${fixture.name} did not satisfy recovery preheat first`);
  assert.ok(result.summary.doasExternalHeatKWh>0,`${fixture.name} did not allocate remaining heat to DOAS`);
  assert.ok(result.summary.doasUnmetConditioningKWh>0,`${fixture.name} hid the conditioning shortfall`);
  assert.ok(delivered<=maximum+1e-9,`${fixture.name} delivered ${delivered} kWh above ${maximum} kWh installed capacity`);
  for(const row of result.hours.filter(h=>h.valid))
    assert.ok(row.preheatDeliveredKWh+row.doasExternalHeatKWh+row.heatingKWh<=fixture.scenario.heaterKW+1e-9,
      `${fixture.name} exceeded installed heat in hour ${row.time}`);
  assert.ok(Math.abs(result.summary[fixture.purchase]-delivered/fixture.divisor)<=1e-8*Math.max(1,delivered),
    `${fixture.name} booked ${result.summary[fixture.purchase]} kWh for ${delivered} kWh delivered`);
  assert.equal(result.summary[fixture.purchase==='fuelKWh'?'electricKWh':'fuelKWh'],0);
 }
});

test('a capacity-limited DOAS rejects adverse untreated excess and conditions one smaller controlled stream',()=>{
 const s=closed({controlMode:'ideal',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  heaterKW:50,thermalMassKJm2K:20,doasM3s:.4,doasSupplyDewPointC:10,doasSupplyTempC:20,
  doasCoolingCOP:3,doasReheatRecoveryFraction:.5});
 const outdoor={tempC:35,rh:.7,pressurePa:101325};
 const result=simulateScenario(s,weather(4,outdoor),{stepMinutes:5});
 const inletW=humidityRatio(outdoor.tempC,outdoor.rh,outdoor.pressurePa);
 const targetW=saturationHumidityRatio(s.doasSupplyDewPointC,outdoor.pressurePa);
 const maximumCondensateKgS=dryAirDensity(outdoor.tempC,inletW,outdoor.pressurePa)*s.doasM3s*(inletW-targetW);
 let conditionedSeconds=0;
 for(const row of result.hours.filter(h=>h.valid)){
  conditionedSeconds+=row.controls.doasConditionedFraction*3600;
  assert.ok(Math.abs(row.controls.controlledM3s-s.doasM3s)<1e-12,
    `adverse excess raised controlled flow to ${row.controls.controlledM3s} m3/s`);
  assert.ok(Math.abs(row.controls.totalOutdoorM3s-s.doasM3s)<1e-12,
    'capacity-only treatment must remain one controlled mass stream');
  assert.ok(row.doasCondensateKg<=maximumCondensateKgS*row.controls.doasConditionedFraction*3600+1e-9);
 }
 assert.ok(conditionedSeconds>0,'the fixture must select the capacity-limited conditioned candidate');
 assert.ok(Math.abs(result.summary.doasCondensateKg-maximumCondensateKgS*conditionedSeconds)
  <=1e-8*Math.max(1,result.summary.doasCondensateKg));
});

test('a capacity-limited DOAS admits untreated excess only when that bypass helps the zone',()=>{
 const s=closed({controlMode:'staged',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  cropSensibleWm2:100,transpirationLDayM2:10,heaterKW:50,thermalMassKJm2K:20,
  doasM3s:.4,doasSupplyDewPointC:10,doasSupplyTempC:20,doasCoolingCOP:3,doasReheatRecoveryFraction:.5});
 const result=simulateScenario(s,weather(12,{tempC:18,rh:.3,pressurePa:101325}),{stepMinutes:5});
 const usefulBypass=result.hours.filter(h=>h.valid&&h.controls.doasConditionedFraction>0&&h.controls.controlledM3s>s.doasM3s+1e-9);
 assert.ok(usefulBypass.length>0,'cool, dry excess air must remain available as a useful untreated bypass');
 for(const row of usefulBypass)
  assert.ok(Math.abs(row.controls.totalOutdoorM3s-row.controls.controlledM3s)<1e-12,
    'admitted excess must stay within the selected controlled stream');
});

test('useful post-recovery expansion excess remains an explicit full-flow candidate',()=>{
 const s=closed({controlMode:'staged',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  cropSensibleWm2:100,transpirationLDayM2:10,lightWm2:500,dliTarget:30,photoperiod:24,dayStart:0,
  heaterKW:50,thermalMassKJm2K:20,
  doasM3s:1,doasSupplyDewPointC:10,doasSupplyTempC:26,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  heatRecovery:recovery('hrv',{auxiliaryW:0})});
 const result=simulateScenario(s,weather(18,{tempC:20,rh:.3,pressurePa:101325}),{stepMinutes:5});
 const working=result.hours.filter(h=>h.valid&&h.controls.doasConditionedFraction===1&&h.controls.recoveryCoreFraction>0);
 assert.ok(working.length>0,'fixture must condition a recovery-warmed full outdoor stream');
 assert.ok(working.some(row=>Math.abs(row.controls.controlledM3s-s.doasM3s)<1e-12),
  'outdoor-reference flow equal to capacity must still offer useful post-recovery excess');
 for(const row of working){
  assert.ok(row.controls.doasTreatmentM3s<=s.doasM3s+1e-12);
  assert.ok(Math.abs(row.controls.totalOutdoorM3s-row.controls.controlledM3s)<1e-12,
    'the useful excess must remain inside the one selected outdoor-air stream');
 }
});

test('capacity-only DOAS flow after recovery contains no hidden untreated expansion bypass',()=>{
 const s=closed({controlMode:'staged',technology:'doas',minVentACH:9,maxVentACH:9,fanWPerM3s:0,
  transpirationLDayM2:10,heaterKW:100,thermalMassKJm2K:20,
  doasM3s:1,doasSupplyDewPointC:10,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  heatRecovery:recovery('hrv',{auxiliaryW:0})});
 const result=simulateScenario(s,weather(12,{tempC:0,rh:.35,pressurePa:101325}),{stepMinutes:5});
 const working=result.hours.filter(h=>h.valid&&h.controls.doasConditionedFraction>0&&h.controls.recoveryCoreFraction>0);
 assert.ok(working.length>0,'fixture must condition recovery-warmed air');
 for(const row of working){
  assert.ok(row.controls.controlledM3s<s.doasM3s-1e-6,
    `post-recovery expansion left hidden excess at ${row.controls.controlledM3s} m3/s outdoor-reference flow`);
  assert.ok(Math.abs(row.controls.totalOutdoorM3s-row.controls.controlledM3s)<1e-12);
 }
});

test('DOAS inlet capacity remains feasible at the recovery support cutoff',()=>{
 const s=closed({controlMode:'staged',technology:'doas',minVentACH:4.5,maxVentACH:4.5,fanWPerM3s:0,
  transpirationLDayM2:10,heaterKW:100,thermalMassKJm2K:20,
  doasM3s:.5,doasSupplyDewPointC:10,doasSupplyTempC:21,doasCoolingCOP:3,doasReheatRecoveryFraction:.5,
  heatRecovery:recovery('hrv',{auxiliaryW:0})});
 const result=simulateScenario(s,weather(12,{tempC:0,rh:.35,pressurePa:101325}),{stepMinutes:5});
 const working=result.hours.filter(h=>h.valid&&h.controls.doasConditionedFraction>0);
 assert.ok(working.length>0,'fixture must request conditioning at the 50% recovery support cutoff');
 for(const row of working){
  assert.ok(Number.isFinite(row.controls.doasTreatmentM3s),'actual DOAS inlet treatment flow must remain visible');
  assert.ok(row.controls.doasTreatmentM3s<=s.doasM3s*row.controls.doasConditionedFraction+1e-12,
    `post-recovery treatment ${row.controls.doasTreatmentM3s} m3/s exceeded installed capacity`);
  assert.ok(Math.abs(row.controls.controlledM3s-s.doasM3s)<1e-12,
    'unsupported recovery must bypass instead of discarding requested feasible treatment flow');
  assert.ok(Math.abs(row.controls.totalOutdoorM3s-row.controls.controlledM3s)<1e-12,
    'capacity-only cutoff handling must not create a hidden second outdoor-air stream');
 }
});

test('DOAS demand never clamps staged pad or indirect secondary-air candidates',()=>{
 const base={controlMode:'staged',dayTargetC:26,nightTargetC:26,tempToleranceC:1,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,
  minVentACH:.3,maxVentACH:9,fanWPerM3s:0,cropSensibleWm2:100,transpirationLDayM2:15,heaterKW:100,
  thermalMassKJm2K:20,padEnabled:true,uValue:5,doasM3s:.01,doasSupplyDewPointC:0,doasSupplyTempC:26,
  doasCoolingCOP:3,doasReheatRecoveryFraction:.5};
 const cases=[
  {name:'pad',scenario:closed({...base,technology:'doas',padEffectiveness:.4}),field:'padFraction',rh:.02},
  {name:'indirect',scenario:closed({...base,technology:'hybridDesiccant',desiccantKgH:50,padEffectiveness:.8}),field:'indirectFraction',rh:.4},
 ];
 for(const fixture of cases){
  const result=simulateScenario(fixture.scenario,weather(12,{tempC:35,rh:fixture.rh,pressurePa:101325}),{stepMinutes:5});
  const working=result.hours.filter(h=>h.valid&&h.controls[fixture.field]>0);
  const requestedM3s=fixture.scenario.areaM2*fixture.scenario.heightM*fixture.scenario.maxVentACH/3600;
  assert.ok(working.length>0,`${fixture.name} fixture must operate`);
  for(const row of working)
    assert.ok(row.controls.controlledM3s+1e-12>=requestedM3s*row.controls[fixture.field],
      `${fixture.name} substeps contributed less than their requested ${requestedM3s} m3/s secondary-air flow`);
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
