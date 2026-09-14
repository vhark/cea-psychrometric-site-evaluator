import test from 'node:test';
import assert from 'node:assert/strict';
import {makeScenario,validateScenario} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {heatPumpCOP,heatPumpCapacityFraction,HEAT_PUMP_RATING_C} from '../src/screens.js';

// Two clear hot summer days: strong midday solar and a warm night, so a shade screen has work to do and the
// cooling it saves is measurable against the fixture lighting it costs.
const sunny=(hours=48)=>({schemaVersion:1,source:'Synthetic clear-sky fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-02',
 hours:Array.from({length:hours},(_,i)=>{const h=i%24,sun=Math.max(0,Math.sin(Math.PI*(h-6)/12));
  return {time:Date.UTC(2025,6,1,i),tempC:28+6*Math.sin(Math.PI*(h-9)/12),rh:.55-.2*sun,pressurePa:98500,ghiWm2:Math.round(900*sun)};})});
// Two cold overcast days with no solar at all, so the thermal curtain is the only thing that changes.
const cold=(hours=48,tempC=-5)=>({schemaVersion:1,source:'Synthetic cold fixture',sourceKind:'test',latitude:36.15,longitude:-95.99,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-02',
 hours:Array.from({length:hours},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC,rh:.7,pressurePa:98500,ghiWm2:0}))});

const house=(over={})=>({...makeScenario('greenhouseDouble'),timezone:'UTC',name:'Screen fixture',coolingKW:150,coolingCOP:3,dehuKgH:30,
 dliTarget:20,lightWm2:150,heaterKW:200,...over});
// Sealed unlit box: no fans, no lights, no pad, so purchased electricity is the heating branch alone.
const box=(over={})=>({...makeScenario('indoor'),timezone:'UTC',name:'Heat source fixture',areaM2:100,canopyM2:100,heightM:4,
 dayTargetC:22,nightTargetC:22,tempToleranceC:2,vpdMin:.5,vpdMax:1.5,maxDewPointC:19,uValue:1,envelopeRatio:2,infiltrationACH:0,
 minVentACH:0,maxVentACH:0,lightWm2:0,dliTarget:0,transpirationModel:'schedule',transpirationLDayM2:0,cropSensibleWm2:0,
 coolingKW:0,dehuKgH:0,humidifierKgH:0,heaterKW:60,...over});
const shadeScreen=(over={})=>({installed:true,shadeFraction:.5,parTransmission:null,solarTransmission:null,deployAboveWm2:250,deployAboveC:null,maxDeployDliDeficit:null,...over});
const thermalScreen=(over={})=>({installed:true,uValueFactor:.5,parTransmission:null,solarTransmission:null,deployAboveC:null,nightDeploy:true,closedExchangeACH:null,...over});
const heatPump=(over={})=>({heatSource:'heatpump',heatPumpCopAt8C:3.5,heatPumpCopAtMinus8C:2.4,heatPumpCopAtMinus15C:1.8,heatPumpCutoffC:-20,heatPumpCapacityDerate:.7,...over});
const pairs=(a,b)=>a.hours.map((h,i)=>[h,b.hours[i]]).filter(([x,y])=>x.valid&&y.valid);
const daily=summary=>new Map(summary.daily.map(d=>[d.date,d]));

test('a deployed shade screen cuts sensible solar gain and crop photons in the same hour, and never adds daily light',()=>{
 const fixture=sunny();
 const open=simulateScenario(house(),fixture);
 const shaded=simulateScenario(house({shadeScreen:shadeScreen()}),fixture);
 assert.equal(shaded.summary.numericalFailureHours,0);
 let deployedHours=0;
 for(const [a,b] of pairs(open,shaded)){
  if(b.controls.shadeFraction<=0){assert.equal(b.loads.solarKWh,a.loads.solarKWh,'an open screen must not touch solar gain');continue;}
  deployedHours++;
  assert.ok(b.loads.solarKWh<a.loads.solarKWh,`hour ${b.time}: shaded solar gain ${b.loads.solarKWh} must be below ${a.loads.solarKWh}`);
  assert.ok(b.solarDLI<a.solarDLI,`hour ${b.time}: shaded photons ${b.solarDLI} must be below ${a.solarDLI}`);
 }
 assert.ok(deployedHours>=8,`the fixture must actually deploy the screen, got ${deployedHours} h`);
 const before=daily(open.summary);
 for(const day of shaded.summary.daily)assert.ok(day.dli<=before.get(day.date).dli+1e-9,`day ${day.date}: shading cannot create light (${day.dli} vs ${before.get(day.date).dli})`);
 // The real trade: less solar heat to remove, fewer crop photons to buy back as fixture electricity.
 assert.ok(shaded.summary.coolingKWh<open.summary.coolingKWh,'shading must reduce delivered cooling');
 assert.ok(shaded.summary.lightKWh>open.summary.lightKWh,'shading must push supplemental lighting up');
 assert.ok(shaded.summary.screens.dliCostMol>0,'the light given up must be reported');
 assert.equal(shaded.summary.screens.shadeHours,shaded.summary.runtime.shadeScreen.hours);
});

test('shade screens reject light and shortwave in equal proportion unless the user supplies product spectra',()=>{
 const fixture=sunny(24);
 const open=simulateScenario(house(),fixture);
 // Default: one declared shade fraction, two equal multipliers. No silver-screen near-infrared bonus exists
 // in the measured evidence, so the model must not grant one by construction.
 const neutral=simulateScenario(house({shadeScreen:shadeScreen()}),fixture);
 let checked=0;
 for(const [a,b] of pairs(open,neutral)){
  if(b.controls.shadeFraction<=0||a.solarDLI<=0)continue;
  checked++;
  assert.ok(Math.abs(b.solarDLI/a.solarDLI-b.loads.solarKWh/a.loads.solarKWh)<1e-12,
   `hour ${b.time}: PAR ratio ${b.solarDLI/a.solarDLI} must equal shortwave ratio ${b.loads.solarKWh/a.loads.solarKWh}`);
 }
 assert.ok(checked>=6);
 // Declared product data may separate them; nothing else may.
 const selective=simulateScenario(house({shadeScreen:shadeScreen({parTransmission:.6,solarTransmission:.35})}),fixture);
 const [ref,split]=pairs(open,selective).find(([,b])=>b.controls.shadeFraction>0&&b.solarDLI>0);
 assert.ok(Math.abs(split.solarDLI/ref.solarDLI-.6)<1e-9);
 assert.ok(Math.abs(split.loads.solarKWh/ref.loads.solarKWh-.35)<1e-9);
});

test('the light-deficit guard keeps the shade screen open while the crop is behind on light',()=>{
 const fixture=sunny();
 // A screen that closes in almost any sunshine, on a light target this climate and these fixtures cannot reach.
 const base=house({dliTarget:60,lightWm2:40,shadeScreen:shadeScreen({deployAboveWm2:100})});
 const ungated=simulateScenario(base,fixture);
 const guarded=simulateScenario({...base,shadeScreen:shadeScreen({deployAboveWm2:100,maxDeployDliDeficit:2})},fixture);
 assert.ok(ungated.summary.runtime.shadeScreen.hours>0);
 assert.equal(guarded.summary.runtime.shadeScreen.hours,0,'a crop short of light must never be shaded');
 for(const [a,b] of pairs(ungated,guarded))if(a.controls.shadeFraction>0)assert.ok(b.solarDLI>a.solarDLI,`hour ${b.time}: the guard must keep the photons`);
 assert.equal(guarded.summary.screens.dliCostMol,0,'a screen that never closes costs no light');
 // The guard is a threshold, not a switch: a crop close to its target may still be shaded.
 const easy=simulateScenario({...base,dliTarget:3,shadeScreen:shadeScreen({deployAboveWm2:100,maxDeployDliDeficit:2})},fixture);
 assert.ok(easy.summary.runtime.shadeScreen.hours>0,'once the deficit is inside the threshold the screen may close');
});

test('a closed thermal curtain reduces envelope loss and an open one leaves it untouched',()=>{
 const fixture=cold();
 const base=house({dliTarget:0,lightWm2:0,coolingKW:0,dehuKgH:0,heaterKW:400});
 const bare=simulateScenario(base,fixture);
 const curtain=simulateScenario({...base,thermalScreen:thermalScreen()},fixture);
 // Same curtain, but its only trigger is a temperature it never reaches: installed and never deployed.
 const idle=simulateScenario({...base,thermalScreen:thermalScreen({nightDeploy:false,deployAboveC:-40})},fixture);
 assert.equal(curtain.summary.numericalFailureHours,0);
 let closedHours=0;
 for(const [a,b] of pairs(bare,curtain)){
  if(b.controls.thermalScreenFraction<=0)continue;
  closedHours++;
  assert.ok(b.loads.envelopeKWh>a.loads.envelopeKWh,`hour ${b.time}: envelope loss ${b.loads.envelopeKWh} must be smaller than ${a.loads.envelopeKWh}`);
  assert.ok(a.loads.envelopeKWh<0,'the cold fixture must actually be losing heat');
 }
 assert.ok(closedHours>=8,`the fixture must deploy the curtain, got ${closedHours} h`);
 for(const [a,b] of pairs(bare,idle)){
  assert.equal(b.controls.thermalScreenFraction,0);
  assert.equal(b.loads.envelopeKWh,a.loads.envelopeKWh,'an open curtain cannot change the envelope');
 }
 assert.ok(curtain.summary.heatingKWh<bare.summary.heatingKWh);
 assert.ok(Math.abs(curtain.summary.screens.heatingSavedKWh-(bare.summary.heatingKWh-curtain.summary.heatingKWh))<1e-9,
  'the reported saving must be the difference against the same run with the curtain forced open');
 assert.equal(idle.summary.screens.heatingSavedKWh,0);
});

test('a closed curtain with a declared gap exchange holds moisture in the zone',()=>{
 const fixture=cold();
 // Transpiring crop, no dehumidifier: the only moisture sink is the outside-air path the curtain restricts.
 const base=house({dliTarget:0,lightWm2:0,coolingKW:0,dehuKgH:0,heaterKW:400,infiltrationACH:1,
  transpirationModel:'schedule',transpirationLDayM2:2,vpdMin:.1,vpdMax:2.5,maxDewPointC:30});
 const leaky=simulateScenario({...base,thermalScreen:thermalScreen()},fixture);
 const sealed=simulateScenario({...base,thermalScreen:thermalScreen({closedExchangeACH:.05})},fixture);
 const closedPairs=pairs(leaky,sealed).filter(([,b])=>b.controls.thermalScreenFraction>0);
 assert.ok(closedPairs.length>=8);
 for(const [a,b] of closedPairs)assert.ok(b.humidityRatio>a.humidityRatio,
  `hour ${b.time}: restricting the outside-air path must raise zone moisture (${b.humidityRatio} vs ${a.humidityRatio})`);
 assert.ok(leaky.warnings.some(w=>w.includes('Optimistic moisture case')),'a curtain with no declared gap must say so');
 assert.equal(sealed.warnings.some(w=>w.includes('Optimistic moisture case')),false);
});

test('heat-pump electricity is delivered heat divided by the interpolated COP',()=>{
 const outdoorTempC=-5,fixture=cold(24,outdoorTempC);
 const result=simulateScenario(box({...heatPump()}),fixture);
 assert.equal(result.summary.numericalFailureHours,0);
 const cop=heatPumpCOP(heatPump(),outdoorTempC);
 assert.ok(cop>2.4&&cop<3.5,`interpolated COP ${cop} must lie between the bracketing rating points`);
 assert.ok(result.summary.heatingKWh>0,'the fixture must call for heat');
 assert.equal(result.summary.fuelKWh,0,'a heat pump buys no fuel');
 for(const h of result.hours.filter(h=>h.valid&&h.heatingKWh>0))
  assert.ok(Math.abs(h.electricKWh-h.heatingKWh/cop)<1e-9*Math.max(1,h.electricKWh),
   `hour ${h.time}: ${h.electricKWh} kWh electricity against ${h.heatingKWh/cop} kWh expected`);
 assert.ok(Math.abs(result.summary.heatPumpElectricKWh-result.summary.heatingKWh/cop)<1e-9*result.summary.heatingKWh);
 // A COP of one is the degenerate case that catches an inverted or dropped division.
 const unity=simulateScenario(box(heatPump({heatPumpCopAt8C:1,heatPumpCopAtMinus8C:1,heatPumpCopAtMinus15C:1})),fixture);
 assert.ok(Math.abs(unity.summary.heatPumpElectricKWh-unity.summary.heatingKWh)<1e-9*unity.summary.heatingKWh,
  'at COP 1 the electricity must equal the delivered heat');
 assert.ok(Math.abs(unity.summary.electricKWh-unity.summary.heatingKWh)<1e-9*unity.summary.heatingKWh);
});

test('below its cutoff the heat pump delivers nothing and the shortfall is reported as unmet',()=>{
 const fixture=cold(24,-25);
 const locked=simulateScenario(box(heatPump()),fixture);
 assert.equal(locked.summary.numericalFailureHours,0);
 assert.equal(locked.summary.heatingKWh,0,'a locked-out compressor delivers no heat');
 assert.equal(locked.summary.heatPumpElectricKWh,0,'a locked-out compressor buys no electricity');
 assert.equal(locked.summary.fuelKWh,0,'lockout must not silently fall back to fuel');
 assert.ok(locked.summary.unmetSensibleKWh>0,'the heat that was not delivered must be reported');
 assert.ok(locked.summary.compliancePct<100);
 // One degree above the same cutoff the machine works, so the lockout is the cutoff and not the weather.
 const running=simulateScenario(box(heatPump({heatPumpCutoffC:-26})),fixture);
 assert.ok(running.summary.heatingKWh>0&&running.summary.heatPumpElectricKWh>0);
 assert.ok(running.summary.unmetSensibleKWh<locked.summary.unmetSensibleKWh);
});

test('heat-pump capacity and COP follow the declared rating table and are never extrapolated',()=>{
 const s=heatPump();
 const [hi,mid,lo]=HEAT_PUMP_RATING_C;
 assert.equal(heatPumpCOP(s,hi),3.5);assert.equal(heatPumpCOP(s,mid),2.4);assert.equal(heatPumpCOP(s,lo),1.8);
 assert.equal(heatPumpCOP(s,25),3.5,'above the table the top rating point is held, not extrapolated');
 assert.equal(heatPumpCOP(s,-18),1.8,'between the coldest point and the cutoff the coldest COP is held');
 assert.equal(heatPumpCOP(s,-21),null,'below the cutoff there is no COP at all');
 for(let t=-15;t<8;t+=.5)assert.ok(heatPumpCOP(s,t)<=heatPumpCOP(s,t+.5)+1e-12,'COP must not rise as it gets colder');
 assert.equal(heatPumpCapacityFraction(s,hi),1);
 assert.ok(Math.abs(heatPumpCapacityFraction(s,lo)-.7)<1e-12);
 assert.equal(heatPumpCapacityFraction(s,-21),0,'lockout removes the capacity, it does not derate it');
});

test('screens and a heat pump keep the zone balances closed',()=>{
 const fixture=cold(48,-8);
 const s=house({dliTarget:12,lightWm2:120,coolingKW:60,dehuKgH:20,heaterKW:300,transpirationModel:'schedule',transpirationLDayM2:2,
  shadeScreen:shadeScreen({deployAboveWm2:0,deployAboveC:-50}),thermalScreen:thermalScreen({closedExchangeACH:.1}),...heatPump()});
 const result=simulateScenario(s,fixture);
 assert.equal(result.summary.numericalFailureHours,0);
 assert.ok(result.summary.runtime.shadeScreen.hours>0&&result.summary.runtime.thermalScreen.hours>0,'both screens must actually deploy');
 for(const h of result.hours){
  const l=h.loads;
  const closureKWh=l.sensibleKWh-l.dxSensibleKWh+l.condensationKWh-l.storedKWh;
  assert.ok(Math.abs(closureKWh)<=1e-3*Math.max(1,Math.abs(l.sensibleKWh)),`hour ${h.time}: sensible closure ${closureKWh} kWh`);
  const lk=l.latentKg;
  const moistureKg=lk.crop+lk.infiltration+lk.ventilation+lk.doas+lk.humidifier-lk.removed-lk.condensed-lk.stored;
  assert.ok(Math.abs(moistureKg)<=1e-6*Math.max(1,lk.crop),`hour ${h.time}: moisture closure ${moistureKg} kg`);
 }
 assert.ok(result.summary.maxEnergyResidualW<=1);
});

test('unsourced component parameters have no shipped default and block the run instead',()=>{
 const noTrigger=validateScenario(house({shadeScreen:shadeScreen({deployAboveWm2:null,deployAboveC:null})}));
 assert.equal(noTrigger.length,1);
 assert.match(noTrigger[0],/irradiance threshold/);
 const noMultiplier=validateScenario(house({thermalScreen:thermalScreen({uValueFactor:null})}));
 assert.equal(noMultiplier.length,1);
 assert.match(noMultiplier[0],/closed-curtain envelope loss multiplier/);
 const noTable=validateScenario(house({heatSource:'heatpump'}));
 assert.equal(noTable.length,5,`expected one error per missing rating input, got ${noTable.join(' | ')}`);
 assert.ok(noTable.some(e=>/8.33 C \(47 F\)/.test(e))&&noTable.some(e=>/compressor cutoff/.test(e))&&noTable.some(e=>/capacity derate/.test(e)));
 // A complete table validates, and the provenance of every point survives into the export.
 const complete=house(heatPump());
 assert.deepEqual(validateScenario(complete),[]);
 const {heatSource}=simulateScenario(complete,cold(24)).assumptions;
 assert.deepEqual(heatSource.ratingPointsC,[8.33,-8.33,-15]);
 assert.deepEqual(heatSource.copAtRatingPoints,[3.5,2.4,1.8]);
 assert.match(heatSource.defrost,/defrost/);
});
