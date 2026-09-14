import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateYears,compareSites,designHours,loadDecomposition,co2Window,LATENT_KWH_PER_KG} from '../src/metrics.js';
import {designBasisHTML} from '../src/export.js';
import {wetBulb,dewPoint,humidityRatio} from '../src/physics.js';
import {weatherSummary} from '../src/metrics.js';
import {makeScenario} from '../src/config.js';

const scenario=(id,name,over={})=>({id,name,crop:'lettuce',facility:'greenhouse',timezone:'UTC',areaM2:1000,heightM:4,dayTargetC:22,nightTargetC:18,tempToleranceC:2,vpdMin:.6,vpdMax:1.2,maxDewPointC:18,dliTarget:14,photoperiod:16,dayStart:6,installedCost:50000,...over});
const summary=over=>({compliancePct:90,compliantHours:7800,cost:1000,electricKWh:5000,fuelKWh:100,eligibleHours:8700,runtime:{pad:{hours:400,days:60}},...over});
const result=(id,name,over={})=>({scenario:scenario(id,name),summary:summary(over),hours:[],warnings:[],weatherSummary:{modeCounts:{},padViability:{failureCauses:{moisture:0,temperature:0}},outdoorDrying:null},assumptions:{evidenceTier:'Assumption-based component screening',stepMinutes:1}});
const run=(label,rows)=>({label,snapshot:{startDate:`${label}-01-01`,endDate:`${label}-12-31`,source:'test'},results:rows.map(([id,over])=>result(id,id,over))});
// One hour row in the v0.2 contract shape.
const hour=(i,over={})=>({time:Date.UTC(2025,0,1,i),valid:true,eligible:true,compliantFraction:1,tempDegreeHours:0,vpdKPaHours:0,condensateKg:0,padWaterL:0,weatherMode:'NEUTRAL_MIN_VENT',
  controls:{ventACH:.5,enrichmentFraction:1,doasDuty:0},loads:{solarKWh:0,lightKWh:0,envelopeKWh:0,infiltrationSensibleKWh:0,ventilationSensibleKWh:0,fanKWh:0,cropSensibleKWh:0,cropLatentKWh:0,latentKg:{crop:0,infiltration:0,ventilation:0,doas:0,humidifier:0},sensibleKWh:0,shr:null},...over});

test('multi-year aggregate selects median, worst and best years and fits a trend only with 5 or more numeric years',()=>{
  const pct=[80,95,70,85,90];
  const runs=pct.map((p,i)=>run(String(2019+i),[['a',{compliancePct:p,cost:100+i}]]));
  const agg=aggregateYears(runs);
  const a=agg.byScenario.a;
  assert.equal(a.median.compliancePct,85);
  assert.equal(a.median.cost,102);
  assert.equal(a.worst.label,'2021');
  assert.equal(a.best.label,'2020');
  assert.equal(a.spread.compliancePct,25);
  assert.ok(Math.abs(a.trend.compliancePctPerYear-1)<1e-9,`least-squares slope of ${pct} should be +1 per year, got ${a.trend.compliancePctPerYear}`);
  const four=aggregateYears(runs.slice(0,4));
  assert.equal(four.byScenario.a.trend.compliancePctPerYear,null,'fewer than 5 years gives no trend');
  const named=aggregateYears(runs.map((r,i)=>({...r,label:`year ${i}`})));
  assert.equal(named.byScenario.a.trend.compliancePctPerYear,null,'non-numeric labels give no trend');
  assert.equal(named.byScenario.a.median.compliancePct,85,'medians still computed for non-numeric labels');
});

test('unpriced years are excluded from medians instead of counting as zero',()=>{
  const agg=aggregateYears([run('2019',[['a',{cost:null}]]),run('2020',[['a',{cost:200}]]),run('2021',[['a',{cost:400}]])]);
  assert.equal(agg.byScenario.a.median.cost,300);
});

test('ranking stability flips when one year reorders strategies by operating cost',()=>{
  const stable=aggregateYears([run('2019',[['a',{cost:100}],['b',{cost:200}]]),run('2020',[['a',{cost:110}],['b',{cost:190}]])]);
  assert.equal(stable.ranking.stable,true);
  assert.deepEqual(stable.ranking.byYear['2019'],['a','b']);
  const flipped=aggregateYears([run('2019',[['a',{cost:100}],['b',{cost:200}]]),run('2020',[['a',{cost:210}],['b',{cost:190}]])]);
  assert.equal(flipped.ranking.stable,false);
  assert.deepEqual(flipped.ranking.byYear['2020'],['b','a']);
});

test('site comparison names the cheapest non-dominated strategy and its worst year',()=>{
  const rows=compareSites([{site:{zip:'74103',city:'Tulsa',state:'OK',latitude:36.15,longitude:-95.99,timezone:'America/Chicago'},runs:[
    run('2019',[['cheap',{cost:100,compliancePct:60}],['mid',{cost:150,compliancePct:55}],['best',{cost:300,compliancePct:95}]]),
    run('2020',[['cheap',{cost:120,compliancePct:50}],['mid',{cost:160,compliancePct:52}],['best',{cost:310,compliancePct:93}]])]}]);
  const row=rows[0];
  assert.equal(row.bestStrategy.id,'cheap');
  assert.equal(row.worstYearCompliancePct,50);
  assert.ok(!row.frontier.some(r=>r.id==='mid'),'a strategy costing more for less attainment is dominated');
  assert.ok(row.frontier.some(r=>r.id==='best'));
  assert.equal(row.bindingConstraint,'none');
});

test('design conditions report coincident states of the selected hour, not independent percentiles',()=>{
  // 1000 hours: the hottest hours are dry, the most humid hours are mild.
  const weather=Array.from({length:1000},(_,i)=>{
    const hot=i<20,humid=i>=20&&i<40;
    return {time:Date.UTC(2025,0,1)+i*3600000,tempC:hot?40-i*.1:humid?24:15+(i%10),rh:hot?.1:humid?.95:.5,pressurePa:101325,ghiWm2:0};
  });
  const d=designHours(weather,[],scenario('a','a'));
  assert.equal(d.dryBulb.hours,1000);
  const hotHours=weather.slice(0,20).map(h=>h.tempC);
  assert.ok(hotHours.includes(d.dryBulb.p99.tempC),'1 percent dry-bulb hour must be one of the 20 hottest hours');
  assert.ok(d.dryBulb.p99_6.tempC>=d.dryBulb.p99.tempC&&d.dryBulb.p99.tempC>=d.dryBulb.p98.tempC,'exceedance levels are monotone');
  const w=humidityRatio(d.dryBulb.p99.tempC,.1,101325);
  assert.ok(Math.abs(d.dryBulb.p99.dewPointC-dewPoint(d.dryBulb.p99.tempC,w,101325))<1e-6,'coincident dew point belongs to the hot dry hour');
  assert.ok(Math.abs(d.dryBulb.p99.wetBulbC-wetBulb(d.dryBulb.p99.tempC,w,101325))<1e-6,'coincident wet bulb belongs to the hot dry hour');
  assert.equal(d.dewPoint.p99.tempC,24,'1 percent dew-point hour is a mild humid hour, so its coincident dry bulb is 24 C');
  assert.ok(d.dewPoint.p99.dewPointC>d.dryBulb.p99.dewPointC,'independent percentile would have paired the hot hour with a high dew point');
});

test('design peaks use the result hours with their outdoor state and the ventilation requirement scales with volume',()=>{
  const weather=Array.from({length:200},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:30,rh:.4,pressurePa:101325,ghiWm2:0}));
  const rows=Array.from({length:200},(_,i)=>hour(i,{controls:{ventACH:i===5?12:1,enrichmentFraction:0},condensateKg:i,padWaterL:2*i,tempDegreeHours:i===7?3:i===8?1:0,compliantFraction:i===7?.5:i===8?.9:1,
    loads:{...hour(i).loads,solarKWh:i===10?50:5,cropSensibleKWh:-2,latentKg:{...hour(i).loads.latentKg,crop:i===14?9:1,ventilation:-3}}}));
  const d=designHours(weather,rows,scenario('a','a',{areaM2:100,heightM:3}));
  assert.equal(d.peakSensibleHour.time,Date.UTC(2025,0,1,10));
  assert.equal(d.peakSensibleHour.sensibleKWh,50,'negative crop sensible does not offset the positive gains');
  assert.equal(d.peakLatentHour.time,Date.UTC(2025,0,1,14));
  assert.equal(d.peakLatentHour.latentKg,9,'drying ventilation is not a latent load');
  assert.equal(d.peakLatentHour.outdoor.tempC,30);
  assert.equal(d.ventilationAirRequirement.maxACH,12);
  assert.ok(Math.abs(d.ventilationAirRequirement.m3s-12*300/3600)<1e-12);
  assert.equal(d.condensatePeakKgH,199);assert.equal(d.padWaterPeakLH,398);
  assert.equal(d.jointFailure.worstHour.time,Date.UTC(2025,0,1,7));
  assert.equal(d.jointFailure.failingHours,2);
  assert.equal(d.jointFailure.p99Violation,null,'two failing hours in 200 are below the 1 percent exceedance level');
  rows[9].tempDegreeHours=.5;
  assert.equal(designHours(weather,rows,scenario('a','a')).jointFailure.p99Violation.time,Date.UTC(2025,0,1,9),'the third-worst hour is exceeded by 1 percent of 200 hours');
});

test('load decomposition keeps the sensible-heat ratio within [0,1] and null without gains',()=>{
  const rows=[
    hour(0,{loads:{...hour(0).loads,solarKWh:10,latentKg:{...hour(0).loads.latentKg,crop:2}}}),
    hour(1,{loads:{...hour(1).loads,envelopeKWh:-5,ventilationSensibleKWh:-8,latentKg:{...hour(1).loads.latentKg,crop:2}}}),
    hour(2,{loads:{...hour(2).loads,envelopeKWh:-5,latentKg:{...hour(2).loads.latentKg,ventilation:-1}}}),
    hour(3,{valid:false,loads:null})];
  const d=loadDecomposition({scenario:scenario('a','a'),hours:rows});
  assert.equal(d.hours,3);
  assert.equal(d.monthly.length,1);
  const m=d.monthly[0];
  assert.equal(m.envelopeKWh,-10,'signed terms are summed as signed');
  assert.ok(m.shr>0&&m.shr<1);
  assert.ok(Math.abs(m.shr-10/(10+4*LATENT_KWH_PER_KG))<1e-12);
  assert.equal(d.noGainHours,1,'an hour with only losses has no ratio');
  assert.equal(d.shrHistogram.reduce((a,b)=>a+b.hours,0),2);
  assert.equal(d.shrHistogram[0].hours,1,'crop latent only puts the hour in the lowest bin');
  const none=loadDecomposition({scenario:scenario('a','a'),hours:[hour(0)]});
  assert.equal(none.total.shr,null);
  assert.equal(none.monthly[0].shr,null);
});

test('CO2 window equivalent hours never exceed valid hours and ignore invalid rows',()=>{
  const rows=[hour(0,{controls:{ventACH:.5,enrichmentFraction:1}}),hour(1,{controls:{ventACH:2,enrichmentFraction:.25}}),hour(2,{controls:{ventACH:5,enrichmentFraction:0}}),hour(3,{valid:false,controls:{enrichmentFraction:1},weatherMode:'MISSING_DATA'}),hour(4,{controls:{enrichmentFraction:1.5}})];
  const w=co2Window({scenario:scenario('a','a'),hours:rows});
  assert.equal(w.validHours,4);
  assert.ok(w.equivalentHours<=w.validHours);
  assert.equal(w.equivalentHours,2.25,'fractions above one are clamped');
  assert.equal(w.hoursAny,3);
  assert.equal(w.days,1);
  assert.equal(w.weatherSideHours,4,'weather-side count is independent of the strategy and skips missing data');
});

test('design-basis brief escapes scenario text and reports missing load terms as unavailable',()=>{
  const snapshot={startDate:'2025-01-01',endDate:'2025-01-01',timezone:'UTC',source:'test',sourceKind:'synthetic',latitude:36.15,longitude:-95.99,hours:Array.from({length:24},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:20,rh:.5,pressurePa:101325,ghiWm2:0}))};
  const r=result('x','<script>alert(1)</script>',{});
  r.hours=Array.from({length:24},(_,i)=>({...hour(i),loads:undefined,controls:undefined}));
  const html=designBasisHTML([r],snapshot,{aggregate:null,sites:null});
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('No load terms'));
  assert.ok(!html.includes('\u2014'),'no em dashes in copy');
});

// Pad and vent usefulness must be independent measurements. The primary weather mode is mutually exclusive,
// so it can only answer one question per hour: a hot hour is classified as a pad mode and never asked whether
// an open vent would have done the job, and a mild hour is classified as a vent mode and never asked about the
// pad. These assertions pin the independence and the one relationship that decides whether a pad is worth
// buying: the pad only earns its capital in hours a vent cannot hold the ceiling at all.
const utilityHour=(i,tempC,rh)=>({time:Date.UTC(2025,6,1,i),tempC,rh,pressurePa:101325,ghiWm2:0});
const padScenario=over=>({...makeScenario('greenhouse','bench','lettuce'),timezone:'UTC',padEnabled:true,
  dayTargetC:24,nightTargetC:24,tempToleranceC:3,vpdMin:.4,vpdMax:1.4,maxDewPointC:20,padEffectiveness:.8,...over});

test('pad and vent usefulness are measured independently, and both can be true in the same hour',()=>{
  // 34 C at 20% RH: far above the ceiling so a vent cannot hold it, but dry enough that the pad can.
  const hot=weatherSummary([utilityHour(12,34,.2)],padScenario()).utility;
  assert.equal(hot.padCoolingHours,1,'a hot dry hour must credit the pad with useful cooling');
  assert.equal(hot.padDeeperThanVentHours,1,'outside air above the ceiling means only the pad can reach the band');
  assert.equal(hot.ventCoolingHours,0,'34 C outside cannot cool a 24 C zone');
  // 18 C at 40% RH: the vent both cools and dries, and the pad is not needed for either.
  const mild=weatherSummary([utilityHour(12,18,.4)],padScenario()).utility;
  assert.equal(mild.ventCoolingHours,1,'cool dry outside air must be credited as useful ventilation');
  assert.equal(mild.ventDryingHours,1);
  assert.equal(mild.padDeeperThanVentHours,0,'a vent that holds the ceiling leaves the pad nothing exclusive');
  // Independence in the other direction: the hot hour is a pad mode, yet the vent's drying capability is still
  // reported. The mutually exclusive mode alone would have hidden it.
  assert.equal(hot.ventDryingHours,1,'a pad hour must still report whether outside air could dry the zone');
  assert.equal(hot.bothHours,1,'pad-useful and vent-useful can be true in the same hour');
});

test('the pad only earns its capital where a vent cannot hold the ceiling, and that is a climate property',()=>{
  const hours=[];
  // A dry day that climbs past the ceiling, then a cool night: a vent covers part of it, the pad covers the rest.
  for(let i=0;i<12;i++)hours.push(utilityHour(i,16+2*i,.25));
  for(let i=12;i<24;i++)hours.push(utilityHour(i,18,.5));
  const dry=weatherSummary(hours,padScenario()).utility;
  // Every pad-exclusive hour must also be an hour the pad can cool at all: the deeper set is a strict subset.
  assert.ok(dry.padDeeperThanVentHours<=dry.padCoolingHours,
    `pad-exclusive ${dry.padDeeperThanVentHours} must not exceed pad-cooling ${dry.padCoolingHours}`);
  assert.ok(dry.padDeeperThanVentHours>0,'a day that climbs above the ceiling must give the pad exclusive hours');
  // The same hours in saturated air: the pad can no longer reach the band, so its exclusive contribution goes.
  const humid=weatherSummary(hours.map(h=>({...h,rh:.92})),padScenario()).utility;
  assert.equal(humid.padDeeperThanVentHours,0,'near-saturated air leaves the pad no exclusive hours');
  assert.ok(humid.ventDryingHours<dry.ventDryingHours,'humid air also removes the vent drying opportunity');
  // A pad that is not installed is never credited, while the vent assessment is unaffected by it.
  const off=weatherSummary(hours,padScenario({padEnabled:false})).utility;
  assert.equal(off.padUsefulHours,0);
  assert.equal(off.padDeeperThanVentHours,0);
  assert.equal(off.ventCoolingHours,dry.ventCoolingHours,'removing the pad must not change the vent answer');
});
