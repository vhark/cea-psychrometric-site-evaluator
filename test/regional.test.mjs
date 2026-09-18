// Tests over the committed docs/regional-study.json. These are contract tests on the study artifact the
// Learn tab reads at runtime: shape, coverage, internal consistency of the reductions, and the strictness of
// the recommendation rule. They do not re-run the 360 simulations; scripts/regional-study.mjs does that.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODEL_VERSION,SCENARIO_SCHEMA_VERSION} from '../src/config.js';

const study=JSON.parse(readFileSync(new URL('../docs/regional-study.json',import.meta.url),'utf8'));
const scenarios=JSON.parse(readFileSync(new URL('../docs/example-scenarios.json',import.meta.url),'utf8')).scenarios;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const WEATHER_KEYS=['padEffectiveHoursMedian','freeCoolingHoursMedian','heatingHoursMedian','moistureLimitedHoursMedian',
  'temperatureLimitedHoursMedian','designDryBulbC','coincidentWetBulbC','designDewPointC','meanSummerWetBulbC'];
const STRATEGY_KEYS=['id','label','attainmentMedianPct','attainmentWorstPct','attainmentBestPct','attainmentSpreadPts',
  'costMedianUsd','costSpreadUsd','electricMedianKWh','fuelMedianKWh','rank'];
const VERDICT_KEYS=['recommended','recommendedBasis','runnerUp','marginPct','stable','stabilityBasis','bindingConstraint','caveats'];

test('the committed study carries the contract shape the Learn tab codes against',()=>{
  assert.equal(study.schemaVersion,1);
  assert.equal(study.scenarioSchemaVersion,SCENARIO_SCHEMA_VERSION);
  assert.equal(study.modelVersion,MODEL_VERSION,'a study from an older model version must be regenerated');
  assert.ok(!Number.isNaN(Date.parse(study.generatedAt)));
  const m=study.method;
  assert.deepEqual(m.years,[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025]);
  assert.deepEqual(m.sites,['tulsa','phoenix','miami','denver','seattle','fairbanks']);
  assert.deepEqual(m.scenarios.map(s=>s.id),scenarios.map(s=>s.technology),'the study must run the canonical six strategies');
  assert.equal(m.stepMinutes,1);
  assert.equal(m.transpirationModel,'stanghellini');
  assert.equal(m.simulations,6*10*6,'six sites, ten years, six strategies');
  assert.ok(Array.isArray(m.notes));
  assert.equal(study.regions.length,6);
  for(const region of study.regions){
    for(const key of ['key','label','zip','climate'])assert.equal(typeof region[key],'string',`${key} on ${region.key}`);
    for(const key of WEATHER_KEYS)assert.ok(key in region.weather,`${region.key} weather is missing ${key}`);
    assert.equal(region.strategies.length,6);
    for(const strategy of region.strategies)
      for(const key of STRATEGY_KEYS)assert.ok(key in strategy,`${region.key} ${strategy.id} is missing ${key}`);
    for(const key of VERDICT_KEYS)assert.ok(key in region.verdict,`${region.key} verdict is missing ${key}`);
    assert.ok(Array.isArray(region.verdict.caveats));
  }
});

test('regional dollars carry result-derived period, numeric prices and separate capital assumptions',()=>{
  for(const s of study.method.scenarios){
    const input=scenarios.find(x=>x.technology===s.id);
    assert.equal(s.installedCostBasis,input.installedCostBasis);
    assert.equal(s.installedCostUsd,input.installedCost);
  }
  assert.equal(study.method.metricUnits.attainmentSpreadPts,'pp');
  assert.equal(study.method.metricUnits.capabilityTierPts,'pp');
  for(const region of study.regions)for(const strategy of region.strategies){
    const basis=strategy.costBasis,input=scenarios.find(s=>s.technology===strategy.id);
    assert.ok(basis,`${region.key}/${strategy.id} cost basis missing`);
    assert.equal(basis.scope,'multiYear');
    assert.deepEqual(basis.aggregation,{statistic:'median',years:study.method.years});
    assert.equal(basis.isQuote,false);
    assert.ok(basis.included.includes('purchased electricity'));
    assert.ok(basis.excluded.includes('installed capital'));
    assert.equal(basis.isGuaranteedSavings,false);
    assert.equal(basis.priceBasis.electricity.usdPerKWh,input.electricityPrice);
    assert.equal(basis.priceBasis.fuel.usdPerKWh,input.fuelPrice);
    assert.equal(basis.priceBasis.water.usdPerL,input.waterPrice);
    const records=region.perYear.map(y=>y.strategies.find(s=>s.id===strategy.id));
    assert.deepEqual(basis.period,{startDate:records[0].costBasis.period.startDate,endDate:records.at(-1).costBasis.period.endDate});
    for(const [i,row] of records.entries()){
      assert.deepEqual(row.costBasis.priceBasis,basis.priceBasis);
      assert.equal(row.validHours,region.perYear[i].validHours);
      assert.equal(row.numericalFailureHours,0);
      assert.ok(row.eligibleHours>0&&row.eligibleHours<=row.validHours);
    }
  }
});

test('every region carries all ten bundled weather years and six strategies with real numbers',()=>{
  for(const region of study.regions){
    assert.deepEqual(region.years,study.method.years,`${region.key} must run every study year`);
    assert.equal(new Set(region.years).size,10,`${region.key} must have ten distinct years`);
    assert.equal(region.perYear.length,10);
    for(const year of region.perYear){
      assert.ok([8760,8784].includes(year.expectedHours),`${region.key} ${year.year} is not a whole calendar year`);
      assert.equal(year.validHours,year.expectedHours,`${region.key} ${year.year} has missing weather hours`);
      assert.equal(year.strategies.length,6);
    }
    assert.deepEqual(region.strategies.map(s=>s.id).sort(),scenarios.map(s=>s.technology).sort());
    for(const s of region.strategies)
      for(const key of ['attainmentMedianPct','attainmentWorstPct','attainmentBestPct','costMedianUsd','electricMedianKWh'])
        assert.ok(finite(s[key]),`${region.key} ${s.id} ${key} must be a number, not ${s[key]}`);
  }
});

// Every value in the artifact is rounded to three decimals, so a statistic recomputed from the rounded
// per-year values and the rounded statistic agree only to within a few halves of the last retained digit.
// A real aggregation error is orders of magnitude larger than this.
const ROUNDING=2e-3;
test('medians lie between the worst and the best year, and spreads match that range',()=>{
  for(const region of study.regions)for(const s of region.strategies){
    const where=`${region.key} ${s.id}`;
    assert.ok(s.attainmentWorstPct<=s.attainmentMedianPct+ROUNDING,`${where}: worst year above the median`);
    assert.ok(s.attainmentMedianPct<=s.attainmentBestPct+ROUNDING,`${where}: median above the best year`);
    assert.ok(Math.abs(s.attainmentSpreadPts-(s.attainmentBestPct-s.attainmentWorstPct))<ROUNDING,
      `${where}: spread must be best minus worst`);
    const perYear=region.perYear.map(y=>y.strategies.find(x=>x.id===s.id));
    const attainment=perYear.map(y=>y.attainmentPct).sort((a,b)=>a-b);
    assert.ok(Math.abs(attainment[0]-s.attainmentWorstPct)<ROUNDING,`${where}: worst year is not the lowest of the ten`);
    assert.ok(Math.abs(attainment[9]-s.attainmentBestPct)<ROUNDING,`${where}: best year is not the highest of the ten`);
    assert.ok(Math.abs((attainment[4]+attainment[5])/2-s.attainmentMedianPct)<ROUNDING,
      `${where}: the median must be the median of the ten per-year values`);
    const costs=perYear.map(y=>y.costUsd).sort((a,b)=>a-b);
    assert.ok(Math.abs((costs[4]+costs[5])/2-s.costMedianUsd)<ROUNDING,`${where}: cost median must be the median of the ten years`);
    assert.ok(Math.abs(costs[9]-costs[0]-s.costSpreadUsd)<ROUNDING,`${where}: cost spread must be max minus min`);
  }
});

test('ranks are dense, ordered by cost inside the frontier and inside the dominated set, and the frontier comes first',()=>{
  for(const region of study.regions){
    const ranks=region.strategies.map(s=>s.rank);
    assert.deepEqual([...ranks].sort((a,b)=>a-b),[1,2,3,4,5,6],`${region.key} ranks must be dense 1..6`);
    assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b),`${region.key} strategies must be listed in rank order`);
    const frontier=region.strategies.filter(s=>s.frontier),dominated=region.strategies.filter(s=>!s.frontier);
    assert.ok(frontier.length>=1,`${region.key} must have at least one non-dominated strategy`);
    for(const f of frontier)for(const d of dominated)
      assert.ok(f.rank<d.rank,`${region.key}: frontier ${f.id} must rank above dominated ${d.id}`);
    for(const group of [frontier,dominated])
      for(let i=1;i<group.length;i++)
        assert.ok(group[i-1].costMedianUsd<=group[i].costMedianUsd,
          `${region.key}: ${group[i-1].id} ranks above ${group[i].id} but costs more`);
    // A frontier member must genuinely be non-dominated: nothing costs no more and attains no less.
    for(const f of frontier)for(const other of region.strategies){
      if(other===f)continue;
      const dominates=other.costMedianUsd<=f.costMedianUsd&&other.attainmentMedianPct>=f.attainmentMedianPct&&
        (other.costMedianUsd<f.costMedianUsd-1e-9||other.attainmentMedianPct>f.attainmentMedianPct+1e-9);
      assert.ok(!dominates,`${region.key}: ${f.id} is marked frontier but ${other.id} dominates it`);
    }
  }
});

test('a verdict inside the indistinguishable cost band is never labeled recommended',()=>{
  let unresolved=0;
  for(const region of study.regions){
    const v=region.verdict,where=`${region.key} verdict`;
    const threshold=v.indistinguishableThresholdPct;
    assert.equal(threshold,16,`${where}: retain the original 16 percent screening decision band`);
    if(finite(v.marginPct)&&v.marginPct<threshold){
      unresolved++;
      assert.equal(v.recommended,null,`${where}: margin ${v.marginPct}% is inside the ${threshold}% band and must not be recommended`);
      assert.equal(v.resolved,false,`${where}: an in-band verdict must be marked unresolved`);
      assert.equal(v.candidates.length,2,`${where}: an in-band verdict must name both candidates`);
    }else{
      assert.ok(v.recommended,`${where}: a resolved verdict must name a strategy`);
      assert.equal(v.resolved,true);
      assert.ok(region.strategies.some(s=>s.id===v.recommended),`${where}: ${v.recommended} is not a strategy of this region`);
      // Resolved either by a cost margin wider than the band, or by being alone in the capability tier.
      assert.ok(v.marginPct===null||v.marginPct>=threshold,`${where}: resolved on a margin inside the band`);
      if(v.marginPct===null)assert.deepEqual(v.capabilityTier,[v.recommended],
        `${where}: a null margin is only honest when one strategy is alone in the capability tier`);
    }
    if(v.recommended!==null||v.runnerUp!==null){
      const tier=v.capabilityTier.map(id=>region.strategies.find(s=>s.id===id));
      const best=Math.max(...region.strategies.map(s=>s.attainmentMedianPct));
      for(const s of tier)assert.ok(s.attainmentMedianPct>=best-v.capabilityTierPts-1e-9,
        `${where}: ${s.id} is in the capability tier but is more than ${v.capabilityTierPts} pp off the best median joint-target attainment`);
      for(const s of region.strategies)
        if(!v.capabilityTier.includes(s.id))assert.ok(s.attainmentMedianPct<best-v.capabilityTierPts+1e-9,
          `${where}: ${s.id} qualifies for the capability tier but is missing from it`);
      const cheapest=tier.reduce((a,b)=>b.costMedianUsd<a.costMedianUsd?b:a);
      const candidate=v.recommended??v.candidates[0];
      assert.equal(candidate,cheapest.id,`${where}: the candidate must be the cheapest member of the capability tier`);
    }
  }
  assert.ok(unresolved>0,'the committed study must exercise the unresolved branch; if no region is in the band, this test has stopped testing the rule');
});

test('weather-side medians are the medians of the ten years and the design conditions are physical',()=>{
  const median=values=>{const s=[...values].sort((a,b)=>a-b);return (s[4]+s[5])/2;};
  for(const region of study.regions){
    const w=region.weather;
    assert.equal(w.perYear.length,10);
    for(const [key,field] of [['padEffectiveHours','padEffectiveHoursMedian'],['freeCoolingHours','freeCoolingHoursMedian'],
      ['heatingHours','heatingHoursMedian'],['moistureLimitedHours','moistureLimitedHoursMedian'],
      ['temperatureLimitedHours','temperatureLimitedHoursMedian']]){
      const values=w.perYear.map(y=>y[key]);
      assert.ok(Math.abs(median(values)-w[field])<1e-3,`${region.key} ${field} is not the median of its ten years`);
      for(const value of values)assert.ok(value>=0&&value<=8784,`${region.key} ${key} out of range: ${value}`);
    }
    assert.ok(w.designDryBulbC>15&&w.designDryBulbC<55,`${region.key} design dry bulb ${w.designDryBulbC} C is not plausible`);
    assert.ok(w.coincidentWetBulbC<=w.designDryBulbC+1e-9,`${region.key}: coincident wet bulb above its own dry bulb`);
    assert.ok(w.designDewPointC<=w.designWetBulbC+1e-9,`${region.key}: design dew point above the design wet bulb`);
    assert.ok(w.meanSummerWetBulbC<w.designWetBulbC,`${region.key}: mean summer wet bulb must sit below the 0.4 percent wet bulb`);
    assert.equal(w.designHours,10*8760+3*24,'the design exceedance must pool all ten calendar years');
  }
  // The bundled climates must remain distinguishable: this is why six sites are bundled rather than one.
  const byKey=Object.fromEntries(study.regions.map(r=>[r.key,r]));
  assert.ok(byKey.miami.weather.meanSummerWetBulbC>byKey.phoenix.weather.meanSummerWetBulbC+5,
    'hot-humid Miami must sit well above hot-dry Phoenix on summer wet bulb');
  assert.ok(byKey.phoenix.weather.padEffectiveHoursMedian>byKey.miami.weather.padEffectiveHoursMedian*10,
    'the evaporative window must be an order of magnitude larger at Phoenix than at Miami');
  assert.ok(byKey.denver.weather.heatingHoursMedian>byKey.miami.weather.heatingHoursMedian,
    'Denver must need more heating hours than Miami');
});

test('the per-year cost order matches the stability verdict it is used to justify',()=>{
  for(const region of study.regions){
    const orders=Object.entries(region.costOrderByYear);
    assert.equal(orders.length,10,`${region.key} must record a cost order for each year`);
    for(const [year,order] of orders){
      assert.equal(order.length,6,`${region.key} ${year}`);
      assert.deepEqual([...order].sort(),region.strategies.map(s=>s.id).sort(),`${region.key} ${year} order must list every strategy`);
      const costs=order.map(id=>region.perYear.find(y=>String(y.year)===year).strategies.find(s=>s.id===id).costUsd);
      for(let i=1;i<costs.length;i++)
        assert.ok(costs[i-1]<=costs[i],`${region.key} ${year}: the recorded order is not ascending by that year's cost`);
    }
    const counts=new Map();
    for(const [,order] of orders){const key=order.join('|');counts.set(key,(counts.get(key)||0)+1);}
    const mostCommon=Math.max(...counts.values());
    assert.equal(region.verdict.stable,mostCommon>=9,
      `${region.key}: stable must be true exactly when one order holds in at least 9 of the 10 years (most common: ${mostCommon})`);
  }
});
