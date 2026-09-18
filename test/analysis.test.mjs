import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateYears,compareScenarios,compareSites,designHours,loadDecomposition,co2Window,summarizeHours,LATENT_KWH_PER_KG} from '../src/metrics.js';
import {designBasisHTML,reportHTML} from '../src/export.js';
import {attainmentComparisonText} from '../src/report.js';
import {wetBulb,dewPoint,humidityRatio} from '../src/physics.js';
import {weatherSummary} from '../src/metrics.js';
import {makeScenario} from '../src/config.js';
import {applyEnergyContext} from '../src/energy.js';

const scenario=(id,name,over={})=>({id,name,crop:'lettuce',facility:'greenhouse',latitude:40,longitude:-100,timezone:'UTC',areaM2:1000,heightM:4,dayTargetC:22,nightTargetC:18,tempToleranceC:2,vpdMin:.6,vpdMax:1.2,maxDewPointC:18,dliTarget:14,photoperiod:16,dayStart:6,minVentACH:.5,installedCost:50000,...over});
const summary=over=>({compliancePct:90,compliantHours:7800,cost:1000,electricKWh:5000,fuelKWh:100,eligibleHours:8700,runtime:{pad:{hours:400,days:60}},...over});
const result=(id,name,over={})=>({scenario:scenario(id,name),summary:summary(over),hours:[],warnings:[],weatherSummary:{modeCounts:{},padViability:{failureCauses:{moisture:0,temperature:0}},outdoorDrying:null},assumptions:{evidenceTier:'Assumption-based component screening',stepMinutes:1}});
const run=(label,rows)=>({label,snapshot:{startDate:`${label}-01-01`,endDate:`${label}-12-31`,source:'test'},results:rows.map(([id,over])=>result(id,id,over))});
// One hour row in the current controlled-air contract shape.
const hour=(i,over={})=>({time:Date.UTC(2025,0,1,i),valid:true,eligible:true,compliantFraction:1,tempDegreeHours:0,vpdKPaHours:0,condensateKg:0,padWaterL:0,weatherMode:'NEUTRAL_MIN_VENT',
  controls:{controlledACH:.5,controlledM3s:1000*4*.5/3600,totalOutdoorACH:.5,totalOutdoorM3s:1000*4*.5/3600,enrichmentFraction:1,doasConditionedFraction:0},loads:{solarKWh:0,lightKWh:0,envelopeKWh:0,infiltrationSensibleKWh:0,controlledOutdoorAirSensibleKWh:0,fanKWh:0,cropSensibleKWh:0,cropLatentKWh:0,latentKg:{crop:0,infiltration:0,controlledOutdoorAir:0,humidifier:0},sensibleKWh:0,shr:null},...over});

test('hour summary duration-weights actual controlled and total outdoor-air stages',()=>{
  const s=scenario('air','Actual air',{areaM2:100,heightM:3,outsideAirBasis:'projectInput',outsideAirReviewed:true,
    electricityPrice:.14,fuelPrice:.05,waterPrice:.003,maintenanceYear:500,discountRate:.06,lifeYears:15});
  const rows=[
    hour(0,{durationHours:.25,eligible:false,controls:{controlledACH:.5,controlledM3s:.5*300/3600,totalOutdoorACH:.7,totalOutdoorM3s:.7*300/3600}}),
    hour(1,{durationHours:.75,eligible:false,controls:{controlledACH:2,controlledM3s:2*300/3600,totalOutdoorACH:2.2,totalOutdoorM3s:2.2*300/3600}}),
    hour(2,{durationHours:1.5,eligible:false,controls:{controlledACH:4,controlledM3s:4*300/3600,totalOutdoorACH:4.2,totalOutdoorM3s:4.2*300/3600}}),
  ];
  const air=summarizeHours(rows,s).outdoorAir;
  assert.deepEqual(air.controlledACH,{min:.5,mean:3.05,max:4,stages:[{ach:.5,hours:.25},{ach:2,hours:.75},{ach:4,hours:1.5}]});
  assert.deepEqual(air.totalACH,{min:.7,mean:3.25,max:4.2});
  assert.equal(air.maximum.ach,4);
  assert.ok(Math.abs(air.maximum.m3s-1/3)<1e-12);
  assert.ok(Math.abs(air.maximum.cfm-(1/3)*2118.880003)<1e-9);
  assert.ok(Math.abs(air.maximum.m3sPerM2-1/300)<1e-12);
  assert.ok(Math.abs(air.maximum.cfmPerFt2-((1/3)*2118.880003/(100*10.7639104167)))<1e-12);
  assert.equal(air.maximum.heightM,3);
  assert.equal(air.basis,'projectInput');
  assert.equal(air.reviewed,true);
});

test('mixed substeps retain selected stages instead of promoting the hourly average to a stage or design maximum',()=>{
  const s=scenario('mixed','Mixed controls',{areaM2:100,heightM:3,maintenanceYear:500,discountRate:.06,lifeYears:15});
  const mixed=hour(0,{eligible:false,controls:{
    controlledACH:3.5,controlledM3s:3.5*300/3600,controlledACHMin:.5,controlledACHMax:4.5,
    controlledACHStages:[{ach:.5,hours:.25},{ach:4.5,hours:.75}],
    totalOutdoorACH:3.7,totalOutdoorM3s:3.7*300/3600,totalOutdoorACHMin:.7,totalOutdoorACHMax:4.7,
  }});
  const air=summarizeHours([mixed],s).outdoorAir;
  assert.deepEqual(air.controlledACH.stages,[{ach:.5,hours:.25},{ach:4.5,hours:.75}]);
  assert.equal(air.controlledACH.stages.some(stage=>stage.ach===3.5),false);
  assert.equal(air.controlledACH.min,.5);
  assert.equal(air.controlledACH.max,4.5);
  assert.equal(air.totalACH.min,.7);
  assert.equal(air.totalACH.max,4.7);
  const design=designHours([{time:mixed.time,tempC:31,rh:.4,pressurePa:101325,ghiWm2:0}],[mixed],s);
  assert.equal(design.controlledOutdoorAirRequirement.ach,4.5);
  assert.ok(Math.abs(design.controlledOutdoorAirRequirement.m3s-.375)<1e-12);
  assert.equal(design.controlledOutdoorAirRequirement.atHour,mixed.time);
});

test('cost basis distinguishes complete local calendar years from partial periods',()=>{
  const s=scenario('cost','Cost basis',{timezone:'America/Chicago',electricityPrice:.14,fuelPrice:.05,waterPrice:.003,
    priceMode:'manual',sector:'commercial',maintenanceYear:500,discountRate:.06,lifeYears:15});
  const localYear=(year)=>{
    const start=Date.UTC(year,0,1,6),end=Date.UTC(year+1,0,1,6);
    return Array.from({length:(end-start)/3600000},(_,i)=>({time:start+i*3600000,valid:true,eligible:false,electricKWh:0,fuelKWh:0,waterL:0}));
  };
  for(const year of [2024,2025]){
    const basis=summarizeHours(localYear(year),s).costBasis;
    assert.equal(basis.scope,'annual');
    assert.deepEqual(basis.period,{startDate:`${year}-01-01`,endDate:`${year}-12-31`});
  }
  const invalid=localYear(2025);invalid[100]={...invalid[100],valid:false};
  assert.equal(summarizeHours(invalid,s).costBasis.scope,'period');
  const gapped=localYear(2025);gapped.splice(100,1);
  assert.equal(summarizeHours(gapped,s).costBasis.scope,'period');
  const partial=summarizeHours(localYear(2025).slice(24,72),s).costBasis;
  assert.equal(partial.scope,'period');
  assert.deepEqual(partial.period,{startDate:'2025-01-02',endDate:'2025-01-03'});
  assert.deepEqual(partial.included,['purchased electricity','purchased heating fuel','water represented by the scenario']);
  assert.deepEqual(partial.priceBasis,{
    electricity:{source:'manual scenario input',usdPerKWh:.14},
    fuel:{source:'scenario input',usdPerKWh:.05},
    water:{source:'scenario input',usdPerL:.003},
  });
  assert.deepEqual(partial.excluded,['installed capital','maintenance','labor','financing','taxes','demand charges','fixed charges','time-of-use effects','other unmodeled tariff components']);
  assert.equal(partial.isQuote,false);
  assert.equal(partial.isGuaranteedSavings,false);
});

test('scenario comparison exposes reductions only for a cheaper named alternative',()=>{
  const comparisonResult=(id,name,cost,installedCost,installedCostBasis)=>({
    scenario:scenario(id,name,{electricityPrice:1,fuelPrice:0,waterPrice:0,installedCost,installedCostBasis}),
    hours:[hour(0,{electricKWh:cost,fuelKWh:0,waterL:0})],
    summary:{numericalFailureHours:0},
  });
  const rows=compareScenarios([
    comparisonResult('base','Named baseline',20,1000,'vendor budget'),
    comparisonResult('lower','Lower alternative',12,1400,'screening assumption'),
    comparisonResult('higher','Higher alternative',25,800,'historical allowance'),
  ]);
  assert.equal(rows[0].operatingCostReduction,undefined);
  assert.equal(rows[2].operatingCostReduction,undefined);
  const {label: differenceLabel, ...difference} = rows[1].operatingCostDifference;
  assert.deepEqual(difference,{
    amount:-8,
    baselineName:'Named baseline',
    alternativeName:'Lower alternative',
    basis:{isQuote:false,isGuaranteedSavings:false},
  });
  const {label: reductionLabel, ...reduction} = rows[1].operatingCostReduction;
  assert.deepEqual(reduction,{
    amount:8,
    baselineName:'Named baseline',
    alternativeName:'Lower alternative',
    basis:{isQuote:false,isGuaranteedSavings:false},
  });
  assert.equal(rows[1].installedCost,1400);
  assert.equal(rows[1].installedCostBasis,'screening assumption');
  assert.deepEqual(rows[1].costBasis.period,{startDate:'2025-01-01',endDate:'2025-01-01'});
  assert.deepEqual(rows[1].costBasis.included,['purchased electricity','purchased heating fuel','water represented by the scenario']);
  assert.deepEqual(rows[1].costBasis.excluded,['installed capital','maintenance','labor','financing','taxes','demand charges','fixed charges','time-of-use effects','other unmodeled tariff components']);
  assert.equal(rows[1].costBasis.isQuote,false);
  assert.equal(rows[1].costBasis.isGuaranteedSavings,false);
});

test('attainment comparison rejects numerical failures on either side but retains unpriced valid endpoints',()=>{
  const baseline={scenario:scenario('baseline','Baseline'),summary:{numericalFailureHours:0},
    hours:[hour(0,{compliantFraction:.234,cost:null})]};
  const alternative={scenario:scenario('alternative','Alternative'),summary:{numericalFailureHours:0},
    hours:[hour(0,{compliantFraction:.678,cost:null})]};
  const unpriced=compareScenarios([baseline,alternative]);
  assert.equal(unpriced[0].comparable,false);
  assert.equal(unpriced[1].comparable,false);
  const validText=attainmentComparisonText(...unpriced);
  for(const endpoint of ['23.4%','67.8%','44.4'])assert.ok(validText.includes(endpoint));
  for(const failedIndex of [0,1]){
    const inputs=[baseline,alternative].map((r,i)=>({...r,summary:{numericalFailureHours:i===failedIndex?1:0}}));
    const compared=compareScenarios(inputs);
    assert.ok(compared.every(row=>Number.isFinite(row.compliancePct)));
    const rejectedText=attainmentComparisonText(...compared);
    assert.doesNotMatch(rejectedText,/\d|%|\bpp\b/,'failed numerical coverage must not advertise attainment endpoints or a pp difference');
    assert.match(rejectedText,/numerical/i,'explain the eligibility failure instead of reporting a price problem');
  }
});

test('comparison and design-basis data retain numeric rates for common state-priced periods',()=>{
  const energyContext={sector:'commercial',prices:[
    {period:'2025-01',usdPerKWh:.1,source:'state proxy'},
    {period:'2025-02',usdPerKWh:.2,source:'state proxy'},
  ],warnings:[]};
  const times=[Date.UTC(2025,0,31,23),Date.UTC(2025,1,1,0)];
  const pricedResult=(id,name,multiplier)=>{
    const s=scenario(id,name,{latitude:40,longitude:-100,timezone:'UTC',priceMode:'state',sector:'commercial',electricityPrice:.9,fuelPrice:.05,waterPrice:.003,
      maintenanceYear:500,discountRate:.06,lifeYears:15,outsideAirBasis:'projectInput',outsideAirReviewed:true});
    const hours=times.map((time,index)=>hour(index,{time,electricKWh:(index+1)*multiplier,fuelKWh:0,waterL:0}));
    return applyEnergyContext({scenario:s,hours,summary:summarizeHours(hours,s),warnings:[],
      weatherSummary:{modeCounts:{},padViability:{failureCauses:{moisture:0,temperature:0}},outdoorDrying:null},
      assumptions:{evidenceTier:'test',stepMinutes:5}},energyContext);
  };
  const baseline=pricedResult('priced-base','Priced baseline',1),alternative=pricedResult('priced-alt','Priced alternative',.5);
  Object.assign(alternative.summary,{doasCondensateKg:101.23,doasCoolingDeliveredKWh:202.34,doasCoolingElectricKWh:303.45,
    doasRecoveredReheatKWh:404.56,doasExternalHeatKWh:505.67,doasUnmetConditioningKWh:606.78,recoveryCoreM3:707.89,
    recoveryBypassM3:808.91,preheatInsufficientHours:9.12});
  alternative.summary.costBasis.priceBasis.fuel.source='<script>untrusted price source</script>';
  const compared=compareScenarios([baseline,alternative])[1];
  assert.deepEqual(compared.costBasis.period,{startDate:'2025-01-31',endDate:'2025-02-01'});
  assert.deepEqual(compared.costBasis.priceBasis.electricity.rates,[
    {period:'2025-01',usdPerKWh:.1},
    {period:'2025-02',usdPerKWh:.2},
  ]);
  const snapshot={startDate:'2025-01-31',endDate:'2025-02-01',latitude:40,longitude:-100,timezone:'UTC',source:'test',sourceKind:'synthetic',
    latitude:36.15,longitude:-95.99,hours:times.map((time,index)=>({time,tempC:20+index,rh:.5,pressurePa:101325,ghiWm2:0}))};
  for (const render of [designBasisHTML,reportHTML]) {
    const html=render([baseline,alternative],snapshot);
    for(const value of ['2025-01','0.1 USD/kWh','2025-02','0.2 USD/kWh'])assert.ok(html.includes(value),`document omits ${value}`);
    for(const value of ['101.23 kg','202.34 kWh','303.45 kWh','404.56 kWh','505.67 kWh','606.78 kWh','707.89 m³','808.91 m³','9.12 h'])
      assert.ok(html.includes(value),`document omits a distinct conditioning quantity: ${value}`);
    assert.ok(html.includes('&lt;script&gt;untrusted price source&lt;/script&gt;'));
    assert.ok(!html.includes('<script>untrusted price source'));
    assert.ok(!html.includes('[object Object]'));
  }
});

test('cost documents expose both matched and full-run endpoints when warm-up costs differ',()=>{
  const make=(id,costs)=>{
    const r=result(id,id);
    r.scenario={...r.scenario,priceMode:'manual',electricityPrice:1,fuelPrice:0,waterPrice:0,maintenanceYear:0,discountRate:0,lifeYears:10};
    r.hours=costs.map((cost,i)=>hour(i,{cost,electricKWh:cost,fuelKWh:0,waterL:0,warmup:i===0,eligible:i!==0}));
    r.summary=summarizeHours(r.hours,r.scenario);
    return r;
  };
  const results=[make('Baseline',[100.01,20.02,30.03]),make('Alternative',[200.02,40.04,50.05])];
  const compared=compareScenarios(results);
  assert.equal(compared[0].matchedHours,2);
  assert.ok(Math.abs(compared[1].addedCost-40.04)<1e-9);
  assert.ok(Math.abs(results[1].summary.cost-results[0].summary.cost-140.05)<1e-9);
  const snapshot={startDate:'2025-01-01',endDate:'2025-01-01',latitude:40,longitude:-100,timezone:'UTC',source:'test',sourceKind:'synthetic',
    latitude:36.15,longitude:-95.99,hours:results[0].hours.map(h=>({time:h.time,tempC:20,rh:.5,pressurePa:101325,ghiWm2:0}))};
  for(const render of [reportHTML,designBasisHTML]){
    const html=render(results,snapshot);
    for(const amount of ['$50.05','$90.09','$150.06','$290.11'])
      assert.ok(html.includes(amount),`cost population endpoint omitted: ${amount}`);
  }
});

test('design weather-year metadata counts actual local years, including partial records',()=>{
  const s=scenario('local','Local',{timezone:'America/Chicago'});
  const weather=[{time:Date.UTC(2025,0,1,5),tempC:20,rh:.5,pressurePa:101325,ghiWm2:0},
    {time:Date.UTC(2025,0,1,6),tempC:21,rh:.5,pressurePa:101325,ghiWm2:0}];
  assert.deepEqual(designHours(weather,[],s).weatherYears,[2024,2025]);
  assert.deepEqual(designHours(weather.slice(1),[],s).weatherYears,[2025]);
  assert.deepEqual(designHours([],[],s).weatherYears,[]);
});

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

test('design peaks use result hours and size controlled outdoor air from the actual selected maximum',()=>{
  const weather=Array.from({length:200},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:i===5?31:30,rh:.4,pressurePa:101325,ghiWm2:0}));
  const rows=Array.from({length:200},(_,i)=>hour(i,{controls:{controlledACH:i===5?12:1,enrichmentFraction:0},condensateKg:i,padWaterL:2*i,tempDegreeHours:i===7?3:i===8?1:0,compliantFraction:i===7?.5:i===8?.9:1,
    loads:{...hour(i).loads,solarKWh:i===10?50:5,cropSensibleKWh:-2,latentKg:{...hour(i).loads.latentKg,crop:i===14?9:1,controlledOutdoorAir:-3}}}));
  const d=designHours(weather,rows,scenario('a','a',{areaM2:100,heightM:3,maxVentACH:40}));
  assert.equal(d.peakSensibleHour.time,Date.UTC(2025,0,1,10));
  assert.equal(d.peakSensibleHour.sensibleKWh,50,'negative crop sensible does not offset the positive gains');
  assert.equal(d.peakLatentHour.time,Date.UTC(2025,0,1,14));
  assert.equal(d.peakLatentHour.latentKg,9,'drying controlled outdoor air is not a latent load');
  assert.equal(d.peakLatentHour.outdoor.tempC,30);
  assert.equal(d.controlledOutdoorAirRequirement.ach,12);
  assert.ok(Math.abs(d.controlledOutdoorAirRequirement.m3s-1)<1e-12);
  assert.ok(Math.abs(d.controlledOutdoorAirRequirement.cfm-2118.880003)<1e-9);
  assert.ok(Math.abs(d.controlledOutdoorAirRequirement.m3sPerM2-.01)<1e-12);
  assert.ok(Math.abs(d.controlledOutdoorAirRequirement.cfmPerFt2-(2118.880003/(100*10.7639104167)))<1e-12);
  assert.equal(d.controlledOutdoorAirRequirement.heightM,3);
  assert.equal(d.controlledOutdoorAirRequirement.atHour,Date.UTC(2025,0,1,5));
  assert.equal(d.controlledOutdoorAirRequirement.outdoor.tempC,31);
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
    hour(1,{loads:{...hour(1).loads,envelopeKWh:-5,controlledOutdoorAirSensibleKWh:-8,latentKg:{...hour(1).loads.latentKg,crop:2}}}),
    hour(2,{loads:{...hour(2).loads,envelopeKWh:-5,latentKg:{...hour(2).loads.latentKg,controlledOutdoorAir:-1}}}),
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
  const rows=[hour(0,{controls:{controlledACH:.5,enrichmentFraction:1}}),hour(1,{controls:{controlledACH:2,enrichmentFraction:.25}}),hour(2,{controls:{controlledACH:5,enrichmentFraction:0}}),hour(3,{valid:false,controls:{enrichmentFraction:1},weatherMode:'MISSING_DATA'}),hour(4,{controls:{controlledACH:.5,enrichmentFraction:1.5}})];
  const w=co2Window({scenario:scenario('a','a'),hours:rows});
  assert.equal(w.validHours,4);
  assert.ok(w.equivalentHours<=w.validHours);
  assert.equal(w.equivalentHours,2.25,'fractions above one are clamped');
  assert.equal(w.hoursAny,3);
  assert.equal(w.days,1);
  assert.equal(w.weatherSideHours,4,'weather-side count is independent of the strategy and skips missing data');
});

test('generated documents escape scenario text without depending on complete load data',()=>{
  const snapshot={startDate:'2025-01-01',endDate:'2025-01-01',latitude:40,longitude:-100,timezone:'UTC',source:'test',sourceKind:'synthetic',latitude:36.15,longitude:-95.99,hours:Array.from({length:24},(_,i)=>({time:Date.UTC(2025,0,1,i),tempC:20,rh:.5,pressurePa:101325,ghiWm2:0}))};
  const r=result('x','<script>alert(1)</script>',{});
  r.hours=Array.from({length:24},(_,i)=>({...hour(i),loads:undefined,controls:undefined}));
  for (const render of [designBasisHTML,reportHTML]) {
    const html=render([r],snapshot,{aggregate:null,sites:null});
    assert.ok(!html.includes('<script>alert'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('[object Object]'));
  }
});

// Pad and vent usefulness must be independent measurements. The primary weather mode is mutually exclusive,
// so it can only answer one question per hour: a hot hour is classified as a pad mode and never asked whether
// an open vent would have done the job, and a mild hour is classified as a vent mode and never asked about the
// pad. These assertions pin the independence and the one relationship that decides whether a pad is worth
// buying: the pad only earns its capital in hours a vent cannot hold the ceiling at all.
const utilityHour=(i,tempC,rh)=>({time:Date.UTC(2025,6,1,i),tempC,rh,pressurePa:101325,ghiWm2:0});
const padScenario=over=>({...makeScenario('greenhouse','bench','lettuce'),latitude:40,longitude:-100,timezone:'UTC',padEnabled:true,
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
