import test from 'node:test';
import assert from 'node:assert/strict';
import {MORRIS_PARAMETERS,morrisDesign,elementaryEffects,rankByMuStar,rankingStability,applyPoint,fieldLimits} from '../src/sensitivity.js';
import {makeScenario,validateScenario,applyTechnology,FIELDS,MODEL_VERSION,SCENARIO_SCHEMA_VERSION} from '../src/config.js';
import {readFileSync} from 'node:fs';

const design=(over={})=>morrisDesign({trajectories:6,seed:'fixture',...over});

test('a seeded Morris design is reproducible and a different seed gives a different sample',()=>{
  const a=morrisDesign({trajectories:4,seed:7}),b=morrisDesign({trajectories:4,seed:7});
  assert.deepEqual(a.points,b.points);
  const c=morrisDesign({trajectories:4,seed:8});
  assert.equal(c.points.length,a.points.length);
  assert.notDeepEqual(c.points.map(p=>p.values),a.points.map(p=>p.values),'a different seed must move the sample');
  assert.equal(a.points.length,4*(MORRIS_PARAMETERS.length+1),'k+1 points per trajectory');
  assert.equal(a.points.filter(p=>p.step===0).length,4);
});

test('every sampled value stays inside its screened range and inside the editable field limits once applied',()=>{
  const d=design();
  const scenarios=[makeScenario('greenhouse'),makeScenario('indoor'),applyTechnology(makeScenario('greenhouse'),'desiccant')]
    .map(s=>({...s,timezone:'UTC',outsideAirReviewed:true}));
  const byKey=new Map(MORRIS_PARAMETERS.map(p=>[p.key,p]));
  const limits=new Map();for(const g of FIELDS)for(const f of g.fields)limits.set(f.key,f);
  for(const point of d.points){
    assert.equal(Object.keys(point.values).length,MORRIS_PARAMETERS.length);
    for(const [key,value] of Object.entries(point.values)){
      const p=byKey.get(key);
      assert.ok(value>=p.low-1e-12&&value<=p.high+1e-12,`${key}=${value} escaped ${p.low}..${p.high}`);
    }
    for(const base of scenarios){
      const s=applyPoint(base,point);
      assert.deepEqual(validateScenario({...s}),[],`screened scenario must stay valid: ${JSON.stringify(point.values)}`);
      for(const [key,field] of limits)if(byKey.has(key))
        assert.ok(s[key]>=field.min&&s[key]<=field.max,`${key}=${s[key]} outside field limits ${field.min}..${field.max}`);
      assert.ok(s.solarHeatFraction>=0&&s.solarHeatFraction<=1);
    }
  }
});

test('factors scale the scenario, absolutes replace it, and clamping to the field limit is real',()=>{
  const base={...makeScenario('greenhouse'),timezone:'UTC',uValue:4,padEffectiveness:.8,lai:3,transpirationLDayM2:2,thermalMassKJm2K:1500};
  const point={id:'p',trajectory:0,step:1,changedKey:'uValue',
    values:{uValue:1.4,padEffectiveness:.7,lai:1.3,thermalMassKJm2K:2},unit:{}};
  const s=applyPoint(base,point);
  assert.ok(Math.abs(s.uValue-5.6)<1e-12,'factor multiplies the scenario value');
  assert.equal(s.padEffectiveness,.7,'absolute replaces the scenario value');
  assert.ok(Math.abs(s.lai-3.9)<1e-12);
  assert.ok(Math.abs(s.transpirationLDayM2-2.6)<1e-12,'the transpiration schedule follows the same crop factor');
  assert.equal(s.thermalMassKJm2K,fieldLimits('thermalMassKJm2K').max,'1500 x 2 is clamped to the field maximum');
  assert.equal(base.uValue,4,'applyPoint must not mutate the scenario');
  assert.equal(base.thermalMassKJm2K,1500);
  const indoor={...makeScenario('indoor'),timezone:'UTC'};
  assert.equal(applyPoint(indoor,{values:{solarTransmission:1.15}}).solarTransmission,0,'an opaque room has no solar gain to scale');
});

test('consecutive points of a trajectory differ in exactly one parameter, by the fixed unit step',()=>{
  const d=design();
  const byTrajectory=new Map();
  for(const p of d.points){if(!byTrajectory.has(p.trajectory))byTrajectory.set(p.trajectory,[]);byTrajectory.get(p.trajectory).push(p);}
  for(const points of byTrajectory.values()){
    const changed=new Set();
    for(let i=1;i<points.length;i++){
      const previous=points[i-1],point=points[i];
      const moved=Object.keys(point.unit).filter(k=>Math.abs(point.unit[k]-previous.unit[k])>1e-12);
      assert.deepEqual(moved,[point.changedKey],`step ${point.step} moved ${moved.join(',')}`);
      assert.ok(Math.abs(Math.abs(point.unit[point.changedKey]-previous.unit[point.changedKey])-d.delta)<1e-12,'steps are +/- delta');
      assert.ok(point.unit[point.changedKey]>=-1e-12&&point.unit[point.changedKey]<=1+1e-12,'the walk stays on the unit grid');
      changed.add(point.changedKey);
    }
    assert.equal(changed.size,MORRIS_PARAMETERS.length,'each trajectory moves every parameter exactly once');
  }
});

test('elementary effects recover a known linear response exactly',()=>{
  // y = 3a + 0.5b in the parameters' own units. A unit-space step of delta moves a by delta*(high-low),
  // so the effect per unit range is exactly 3*(high-low) for a and 0.5*(high-low) for b, with zero spread.
  const parameters=[
    {key:'a',label:'a',unit:'x',low:1,high:3,kind:'absolute'},
    {key:'b',label:'b',unit:'x',low:0,high:4,kind:'absolute'},
    {key:'c',label:'c',unit:'x',low:0,high:1,kind:'absolute'}];
  const d=morrisDesign({parameters,trajectories:5,seed:'linear'});
  const observations=d.points.map(p=>({id:p.id,metrics:{y:3*p.values.a+.5*p.values.b}}));
  const effects=elementaryEffects(d,observations);
  assert.equal(effects.a.y.n,5);
  assert.ok(Math.abs(effects.a.y.muStar-3*(3-1))<1e-9,`muStar_a should be 3 x range = 6, got ${effects.a.y.muStar}`);
  assert.ok(Math.abs(effects.b.y.muStar-.5*(4-0))<1e-9,`muStar_b should be 0.5 x range = 2, got ${effects.b.y.muStar}`);
  // Same statement in raw units: one step moves a by delta*(high-low) and y by 3 times that.
  const deltaA=d.delta*(3-1);
  assert.ok(Math.abs(effects.a.y.muStar*d.delta-3*deltaA)<1e-9);
  assert.ok(effects.a.y.muStar>effects.b.y.muStar,'the stronger coefficient over the wider range must rank first');
  for(const key of ['a','b']){
    assert.ok(Math.abs(effects[key].y.sigma)<1e-9,`a linear response has no spread of effects: ${effects[key].y.sigma}`);
    assert.ok(Math.abs(Math.abs(effects[key].y.mu)-effects[key].y.muStar)<1e-9,'monotone response: |mu| equals mu*');
  }
  assert.ok(Math.abs(effects.c.y.muStar)<1e-9,'a parameter the response ignores has no effect');
  assert.deepEqual(rankByMuStar(effects,'y').map(r=>r.key),['a','b','c']);
});

test('missing metrics are skipped rather than counted as zero',()=>{
  const parameters=[{key:'a',label:'a',unit:'x',low:0,high:1,kind:'absolute'},{key:'b',label:'b',unit:'x',low:0,high:1,kind:'absolute'}];
  const d=morrisDesign({parameters,trajectories:3,seed:2});
  const full=d.points.map(p=>({id:p.id,metrics:{y:2*p.values.a}}));
  // One numerically failed point removes the two pairs it sits between, in its trajectory only.
  const holed=full.map(o=>o.id==='t0s1'?{id:o.id,metrics:{y:null}}:o);
  const effects=elementaryEffects(d,holed),complete=elementaryEffects(d,full);
  assert.equal(complete.a.y.n,3);
  assert.equal(complete.b.y.n,3);
  assert.equal(effects.a.y.n+effects.b.y.n,4,'both pairs touching the failed point are dropped, the other two survive');
  assert.ok(Math.abs(effects.a.y.muStar-2)<1e-9,'the surviving pairs still recover the exact slope');
  assert.equal(elementaryEffects(d,[]).a.y,undefined,'no observations means no fabricated effect');
});

test('ranking stability needs one order in at least 90% of screened points',()=>{
  const same=Array.from({length:20},(_,i)=>({id:`p${i}`,ranking:['pad','dx','dehu']}));
  const stable=rankingStability(same);
  assert.equal(stable.stable,true);
  assert.equal(stable.distinctOrders,1);
  assert.equal(stable.share,1);
  assert.deepEqual(stable.mostCommon,['pad','dx','dehu']);
  // One reordering in twenty is 95% and still stable; three in twenty is 85% and is not.
  const one=same.map((e,i)=>i===0?{...e,ranking:['dx','pad','dehu']}:e);
  assert.equal(rankingStability(one).stable,true);
  const three=same.map((e,i)=>i<3?{...e,ranking:['dx','pad','dehu']}:e);
  const unstable=rankingStability(three);
  assert.equal(unstable.stable,false);
  assert.equal(unstable.distinctOrders,2);
  assert.ok(Math.abs(unstable.share-.85)<1e-12);
  assert.deepEqual(unstable.mostCommon,['pad','dx','dehu']);
  const none=rankingStability([{id:'p',ranking:[]}]);
  assert.equal(none.stable,false,'no ranking is unknown, not stable');
  assert.equal(none.mostCommon,null);
});

test('committed Morris evidence uses the current model, unchanged design and complete numerical coverage',()=>{
  const study=JSON.parse(readFileSync(new URL('../docs/morris-screening.json',import.meta.url),'utf8'));
  assert.equal(study.schemaVersion,2);
  assert.equal(study.provenance.modelVersion,MODEL_VERSION);
  assert.equal(study.provenance.scenarioSchemaVersion,SCENARIO_SCHEMA_VERSION);
  assert.deepEqual(study.provenance.years,[2023,2024,2025]);
  assert.equal(study.provenance.simulations,1872);
  assert.equal(study.provenance.days,120);
  const expected=morrisDesign({trajectories:8,levels:4,seed:1});
  assert.deepEqual(study.design.points,expected.points.map(p=>({id:p.id,trajectory:p.trajectory,step:p.step,
    changedKey:p.changedKey,values:Object.fromEntries(Object.entries(p.values).map(([k,v])=>[k,Number(v.toFixed(6))]))})));
  assert.equal(study.observations.length,expected.points.length);
  assert.equal(study.provenance.effectUnits.compliancePct,'pp per full screened parameter range');
  const totalHours=study.provenance.coverage.reduce((sum,y)=>sum+y.hours,0)*6;
  for(const row of study.observations){
    assert.equal(row.numericalFailureHours,0);
    assert.equal(row.validHours,totalHours);
    assert.ok(row.eligibleHours>0&&row.eligibleHours<row.validHours);
    assert.ok(Object.values(row.metrics).every(Number.isFinite));
  }
  const effects=elementaryEffects(expected,study.observations);
  for(const [key,byMetric] of Object.entries(effects))for(const [metric,e] of Object.entries(byMetric)){
    const actual=study.effects[key][metric];
    assert.equal(actual.n,8);
    for(const value of ['mu','muStar','sigma'])assert.ok(Math.abs(actual[value]-e[value])<1e-6);
  }
});

test('Morris period costs retain applied prices and year-specific sampled coverage',()=>{
  const study=JSON.parse(readFileSync(new URL('../docs/morris-screening.json',import.meta.url),'utf8'));
  const scenarios=JSON.parse(readFileSync(new URL('../docs/example-scenarios.json',import.meta.url),'utf8')).scenarios;
  assert.equal(study.provenance.scenarios.length,scenarios.length);
  for(const s of study.provenance.scenarios){
    const input=scenarios.find(x=>x.technology===s.id),basis=s.costBasis;
    assert.equal(s.installedCostBasis,input.installedCostBasis);
    assert.equal(basis.scope,'multiYear');
    assert.deepEqual(basis.aggregation,{statistic:'median',years:study.provenance.years});
    assert.equal(basis.priceBasis.electricity.usdPerKWh,input.electricityPrice);
    assert.equal(basis.priceBasis.fuel.usdPerKWh,input.fuelPrice);
    assert.equal(basis.priceBasis.water.usdPerL,input.waterPrice);
    assert.equal(basis.isQuote,false);
    assert.equal(basis.isGuaranteedSavings,false);
    assert.ok(basis.included.includes('purchased electricity'));
    assert.ok(basis.excluded.includes('installed capital'));
    assert.deepEqual(basis.periods.map(p=>p.year),study.provenance.years);
    for(const [i,p] of basis.periods.entries()){
      assert.equal(p.startDate,study.provenance.coverage[i].firstDay);
      assert.equal(p.endDate,study.provenance.coverage[i].lastDay);
    }
  }
});
