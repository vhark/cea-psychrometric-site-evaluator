#!/usr/bin/env node
// Ten-year regional study: the six canonical example strategies run against every bundled weather year at
// every bundled site, then reduced to one verdict per region. Every number written here is computed from the
// committed snapshots by the same coupled model the interface runs; nothing is quoted from a climate summary
// and nothing is interpolated between sites.
//
//   node scripts/regional-study.mjs [--sites tulsa,phoenix,...] [--years 2016,...,2025]
//                                   [--concurrency N] [--out docs/regional-study.json] [--json]
//
// Deterministic: no sampling, no PRNG, no wall-clock input to any number. Worker threads only buy wall
// time; every (site, year) task is independent and results are re-ordered by site and year before any
// statistic is computed, so the thread count cannot change an output value.
//
// The two decision rules this script applies, both stated in the output and in docs/REGIONS.md:
//
//  * Capability tier: the existing 5 pp band around the region's best median joint-target attainment.
//  * Indistinguishable cost band: the existing 16 percent relative operating-cost margin.
// These are retained screening decision rules, not newly measured uncertainty bounds. Regeneration
// updates the evidence without recalibrating the methodology or treating historical Morris numbers
// as results of the current model.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {availableParallelism} from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {MODEL_VERSION,SCENARIO_SCHEMA_VERSION,validateScenario} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {aggregateYears,strategyFrontier,bindingConstraint,FREE_COOLING_MODES} from '../src/metrics.js';
import {weatherState,wetBulb,dewPoint,localClock} from '../src/physics.js';
import {costBasisText} from '../src/report.js';

const YEARS=[2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
const SITES=['tulsa','phoenix','miami','denver','seattle','fairbanks'];
// Cost margin below which two equally capable strategies are one answer at this evidence tier.
const INDISTINGUISHABLE_PCT=16;
// Attainment width of the capability tier, in percentage points of eligible hours.
const CAPABILITY_TIER_PTS=5;
// Design condition: the value exceeded in 0.4 percent of the pooled ten-year hours, the same fraction
// src/metrics.js designHours uses for a single record.
const DESIGN_FRACTION=0.004;
// Per year and per metric, the hours a worker keeps as design candidates. The pooled 0.4 percent index over
// ten years lands at most 351 hours deep, and an hour in the pooled top 351 is necessarily in its own year's
// top 351, so 600 per year is a strict superset of what the pooled exceedance can need.
const DESIGN_CANDIDATES=600;
// Share of years one cost order must hold in for the ranking to be called stable. Same 90 percent rule the
// Morris screening applies over design points.
const STABLE_SHARE=0.9;
const SUMMER_MONTHS=new Set(['06','07','08']);

const here=path=>new URL(path,import.meta.url);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const round=(value,places=3)=>finite(value)?Number(value.toFixed(places)):null;
const median=values=>{const s=values.filter(finite).sort((a,b)=>a-b);if(!s.length)return null;
  const i=(s.length-1)/2,lo=Math.floor(i);return s[lo]+(s[Math.ceil(i)]-s[lo])*(i-lo);};
const usd=v=>finite(v)?`$${Math.round(v).toLocaleString('en-US')}`:'n/a';
const pct=v=>finite(v)?`${v.toFixed(1)}%`:'n/a';

function loadScenarios(){
  const scenarios=JSON.parse(readFileSync(here('../docs/example-scenarios.json'),'utf8')).scenarios;
  for(const s of scenarios){
    const errors=validateScenario(s);
    if(errors.length)throw new Error(`Example scenario ${s.name} is invalid: ${errors.join(' ')}`);
  }
  return scenarios;
}
function loadIndex(){return JSON.parse(readFileSync(here('../data/weather/index.json'),'utf8'));}
function loadSite(key){
  const site=loadIndex().sites.find(s=>s.key===key);
  if(!site)throw new Error(`No bundled site ${key}.`);
  return site;
}
function loadYear(site,year){
  const file=site.files?.[String(year)];
  if(!file)throw new Error(`No bundled ${site.key} weather for ${year}. Available: ${site.years?.join(', ')}`);
  return JSON.parse(readFileSync(here(`../data/weather/${file}`),'utf8'));
}
// A bundled scenario carries Tulsa's location. The model reads the time zone (day/night schedule, local-day
// accounting) from the scenario, not from the snapshot, so running a Tulsa scenario against Phoenix weather
// without this re-homing would schedule the crop on Central time.
const rehome=(scenario,site)=>({...scenario,latitude:site.latitude,longitude:site.longitude,
  timezone:site.timezone,zip:site.zip});

// One (site, year) task: all six strategies on that year, plus the weather-side screen and the design
// candidates for that year. Returns only scalars and small arrays, so a worker hands back kilobytes.
function evaluateYear(site,year,scenarios){
  const snapshot=loadYear(site,year);
  const results=scenarios.map(scenario=>simulateScenario(rehome(scenario,site),snapshot));
  const strategies=results.map((r,i)=>({id:scenarios[i].technology,name:scenarios[i].name,scenarioId:scenarios[i].id,
    compliancePct:round(r.summary.compliancePct,6),compliantHours:r.summary.compliantHours,
    eligibleHours:r.summary.eligibleHours,validHours:r.summary.validHours,cost:round(r.summary.cost,6),costBasis:r.summary.costBasis,
    electricKWh:round(r.summary.electricKWh,6),fuelKWh:round(r.summary.fuelKWh,6),
    padRuntimeHours:r.summary.runtime?.pad?.hours??null,numericalFailureHours:r.summary.numericalFailureHours||0}));
  // All six strategies share one target band, so the weather-side screen is identical across them; take it
  // from the first and assert that, rather than assuming it.
  const first=results[0].weatherSummary;
  for(const r of results.slice(1)){
    const a=JSON.stringify(first.modeCounts),b=JSON.stringify(r.weatherSummary.modeCounts);
    if(a!==b)throw new Error(`Strategies disagree on the weather-side screen at ${site.key} ${year}; the study assumes one shared target band.`);
  }
  const states=[],counts={tempC:0,wetBulbC:0,dewPointC:0};
  let summerWetBulbSum=0,summerWetBulbHours=0;
  for(const hour of snapshot.hours){
    const state=weatherState(hour);
    if(!state)continue;
    const wb=wetBulb(state.tempC,state.w,state.pressurePa),dp=dewPoint(state.tempC,state.w,state.pressurePa);
    const row={time:hour.time,tempC:state.tempC,rh:state.rh,wetBulbC:finite(wb)?wb:null,dewPointC:finite(dp)?dp:null};
    for(const key of Object.keys(counts))if(finite(row[key]))counts[key]++;
    states.push(row);
    if(finite(wb)&&SUMMER_MONTHS.has(localClock(hour.time,site.timezone).month.slice(5,7))){
      summerWetBulbSum+=wb;summerWetBulbHours++;
    }
  }
  // Deterministic candidate sets: descending by the metric, ties broken by time.
  const candidates={};
  for(const key of Object.keys(counts))
    candidates[key]=states.filter(s=>finite(s[key])).sort((a,b)=>b[key]-a[key]||a.time-b.time).slice(0,DESIGN_CANDIDATES);
  return {site:site.key,year,strategies,
    // Only these weather fields cross the worker boundary, so anything the study reports must be listed here.
    weather:{modeCounts:first.modeCounts,padFailureCauses:first.padFailureCauses,utility:first.utility,
      validHours:first.validHours,expectedHours:first.expectedHours},
    design:{candidates,counts,summerWetBulbSum:round(summerWetBulbSum,6),summerWetBulbHours}};
}

if(!isMainThread&&workerData?.regionalWorker){
  const scenarios=loadScenarios(),sites=new Map();
  parentPort.postMessage({ready:true});
  parentPort.on('message',message=>{
    if(message.done)return void parentPort.close();
    const {site,year}=message.task;
    if(!sites.has(site))sites.set(site,loadSite(site));
    parentPort.postMessage({result:evaluateYear(sites.get(site),year,scenarios)});
  });
}

function parseArgs(argv){
  const options={sites:SITES,years:YEARS,out:'docs/regional-study.json',json:false,
    concurrency:Math.max(1,Math.min(8,availableParallelism()-1))};
  for(let i=0;i<argv.length;i++){
    const [flag,inline]=argv[i].split('=');
    const value=inline??argv[++i];
    if(flag==='--json'){options.json=true;if(inline===undefined)i--;continue;}
    if(flag==='--sites')options.sites=value.split(',').map(s=>s.trim()).filter(Boolean);
    else if(flag==='--years')options.years=value.split(',').map(y=>Number(y.trim()));
    else if(flag==='--out')options.out=value;
    else if(flag==='--concurrency')options.concurrency=Math.max(1,Number(value));
    else throw new Error(`Unknown argument ${flag}. See the header of this file.`);
  }
  for(const key of options.sites)if(!SITES.includes(key))throw new Error(`Unknown site ${key}. Bundled: ${SITES.join(', ')}`);
  for(const year of options.years)if(!Number.isInteger(year))throw new Error(`Bad year ${year}.`);
  return options;
}

// Tasks are independent, so they are dealt to workers as they free up and keyed by site and year. The caller
// re-orders before reducing anything.
async function runTasks(tasks,options,onDone){
  const results=new Map(),key=t=>`${t.site}|${t.year}`;
  if(options.concurrency<=1||tasks.length===1){
    const scenarios=loadScenarios(),sites=new Map();
    for(const task of tasks){
      if(!sites.has(task.site))sites.set(task.site,loadSite(task.site));
      results.set(key(task),evaluateYear(sites.get(task.site),task.year,scenarios));
      onDone(results.size);
    }
    return results;
  }
  const queue=tasks.slice(),file=fileURLToPath(import.meta.url);
  const workers=Array.from({length:Math.min(options.concurrency,tasks.length)},()=>
    new Worker(file,{workerData:{regionalWorker:true}}));
  await new Promise((resolve,reject)=>{
    let live=workers.length;
    for(const worker of workers){
      const next=()=>{
        const task=queue.shift();
        if(task)worker.postMessage({task});
        else{worker.postMessage({done:true});worker.terminate();}
      };
      worker.on('message',message=>{
        if(message.result){results.set(key(message.result),message.result);onDone(results.size);}
        next();
      });
      worker.on('error',reject);
      worker.on('exit',()=>{if(--live===0)resolve();});
    }
  });
  if(results.size!==tasks.length)throw new Error(`Only ${results.size} of ${tasks.length} site-years returned.`);
  return results;
}

// Pooled exceedance over the whole ten-year record, with the coincident state of that same hour. `total` is
// every hour with a finite value for this metric, so the index is a real fraction of the record and not of
// the candidate pool.
function pooledExceedance(candidates,total,key){
  const sorted=candidates.filter(c=>finite(c[key])).sort((a,b)=>b[key]-a[key]||a.time-b.time);
  if(!sorted.length||!total)return null;
  const index=Math.min(total-1,Math.floor(total*DESIGN_FRACTION));
  if(index>=sorted.length)
    throw new Error(`Design candidate pool for ${key} holds ${sorted.length} hours but the 0.4 percent index is ${index}. Raise DESIGN_CANDIDATES.`);
  const hour=sorted[index];
  return {tempC:round(hour.tempC),wetBulbC:round(hour.wetBulbC),dewPointC:round(hour.dewPointC),
    rh:round(hour.rh,4),time:hour.time,hours:total};
}

function regionWeather(yearRows){
  const count=(row,modes)=>modes.reduce((sum,mode)=>sum+(row.weather.modeCounts?.[mode]||0),0);
  const perYear=yearRows.map(row=>{
    const constraint=bindingConstraint([row.weather]);
    return {year:row.year,
      padEffectiveHours:count(row,['PAD_EFFECTIVE']),
      freeCoolingHours:count(row,FREE_COOLING_MODES),
      // Pad and outside-air usefulness are independent questions; the mutually exclusive primary mode can only
      // answer one of them per hour. padDeeperThanVent is the set that matters for buying a pad: outside air
      // above the ceiling, so a vent cannot hold the band, while pad leaving air still can.
      ...Object.fromEntries(Object.entries(row.weather.utility||{}).map(([k,v])=>[k,v])),
      heatingHours:round(constraint.hours.heating,3),
      moistureLimitedHours:round(constraint.hours.moisture,3),
      temperatureLimitedHours:round(constraint.hours.temperature,3)};
  });
  const pooled={tempC:[],wetBulbC:[],dewPointC:[]},totals={tempC:0,wetBulbC:0,dewPointC:0};
  let summerSum=0,summerHours=0;
  for(const row of yearRows){
    for(const key of Object.keys(pooled)){
      pooled[key].push(...row.design.candidates[key]);
      totals[key]+=row.design.counts[key];
    }
    summerSum+=row.design.summerWetBulbSum;summerHours+=row.design.summerWetBulbHours;
  }
  const dryBulb=pooledExceedance(pooled.tempC,totals.tempC,'tempC');
  const dewPointDesign=pooledExceedance(pooled.dewPointC,totals.dewPointC,'dewPointC');
  const wetBulbDesign=pooledExceedance(pooled.wetBulbC,totals.wetBulbC,'wetBulbC');
  return {weather:{
      padEffectiveHoursMedian:round(median(perYear.map(y=>y.padEffectiveHours))),
      freeCoolingHoursMedian:round(median(perYear.map(y=>y.freeCoolingHours))),
      padUsefulHoursMedian:round(median(perYear.map(y=>y.padUsefulHours))),
      padCoolingHoursMedian:round(median(perYear.map(y=>y.padCoolingHours))),
      padHumidifyingHoursMedian:round(median(perYear.map(y=>y.padHumidifyingHours))),
      padDeeperThanVentHoursMedian:round(median(perYear.map(y=>y.padDeeperThanVentHours))),
      ventUsefulHoursMedian:round(median(perYear.map(y=>y.ventUsefulHours))),
      ventCoolingHoursMedian:round(median(perYear.map(y=>y.ventCoolingHours))),
      ventDryingHoursMedian:round(median(perYear.map(y=>y.ventDryingHours))),
      bothUsefulHoursMedian:round(median(perYear.map(y=>y.bothHours))),
      neitherUsefulHoursMedian:round(median(perYear.map(y=>y.neitherHours))),
      heatingHoursMedian:round(median(perYear.map(y=>y.heatingHours))),
      moistureLimitedHoursMedian:round(median(perYear.map(y=>y.moistureLimitedHours))),
      temperatureLimitedHoursMedian:round(median(perYear.map(y=>y.temperatureLimitedHours))),
      designDryBulbC:dryBulb?dryBulb.tempC:null,
      coincidentWetBulbC:dryBulb?dryBulb.wetBulbC:null,
      designDewPointC:dewPointDesign?dewPointDesign.dewPointC:null,
      meanSummerWetBulbC:summerHours?round(summerSum/summerHours):null,
      designWetBulbC:wetBulbDesign?wetBulbDesign.wetBulbC:null,
      designHours:dryBulb?dryBulb.hours:null,
      perYear},
    bindingConstraint:bindingConstraint(yearRows.map(row=>row.weather))};
}

// Ranking. Non-dominated strategies first by ascending median cost, then the dominated ones by ascending
// median cost. A dominated strategy is one another strategy beats on both axes at once: it costs more and
// holds the band no better, so it ranks below every strategy that is on the frontier even when it is cheap.
// Ranks are dense, 1 to the number of strategies.
function rankStrategies(aggregate,frontier,order){
  const byId=new Map(frontier.rows.map(row=>[row.id,row]));
  const scored=order.map(s=>{
    const row=byId.get(s.scenarioId)||{};
    const entry=aggregate.byScenario[s.scenarioId];
    return {id:s.id,label:s.name,scenarioId:s.scenarioId,
      attainmentMedianPct:round(entry.median.compliancePct),
      attainmentWorstPct:round(entry.worst?.compliancePct??null),
      attainmentBestPct:round(entry.best?.compliancePct??null),
      attainmentSpreadPts:round(entry.spread.compliancePct),
      attainmentWorstYear:entry.worst?.label??null,attainmentBestYear:entry.best?.label??null,
      costMedianUsd:round(entry.median.cost),costSpreadUsd:round(entry.spread.cost),costBasis:s.costBasis,
      electricMedianKWh:round(entry.median.electricKWh),fuelMedianKWh:round(entry.median.fuelKWh),
      frontier:frontier.frontier.some(f=>f.id===s.scenarioId),dominated:Boolean(row.dominated),
      numericalFailureHours:s.numericalFailureHours};
  });
  const cheapest=(a,b)=>(a.costMedianUsd===null)-(b.costMedianUsd===null)||
    (a.costMedianUsd??0)-(b.costMedianUsd??0)||a.id.localeCompare(b.id);
  const ordered=[...scored.filter(s=>s.frontier).sort(cheapest),...scored.filter(s=>!s.frontier).sort(cheapest)];
  ordered.forEach((s,i)=>{s.rank=i+1;});
  return ordered;
}

// Per-year cost order of the strategies, and the share of years the most common order holds in.
function orderStability(aggregate){
  const orders=new Map();
  for(const ids of Object.values(aggregate.ranking.byYear)){
    const key=ids.join('|');
    orders.set(key,(orders.get(key)||0)+1);
  }
  const years=Object.keys(aggregate.ranking.byYear).length;
  const sorted=[...orders.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  return {distinctOrders:sorted.length,years,mostCommonCount:sorted[0]?.[1]??0,
    share:years?(sorted[0]?.[1]??0)/years:0};
}

function buildVerdict({region,strategies,aggregate,weather,yearRows}){
  const priced=strategies.filter(s=>finite(s.costMedianUsd)&&finite(s.attainmentMedianPct));
  const bestAttainment=priced.length?Math.max(...priced.map(s=>s.attainmentMedianPct)):null;
  const tier=priced.filter(s=>s.attainmentMedianPct>=bestAttainment-CAPABILITY_TIER_PTS)
    .sort((a,b)=>a.costMedianUsd-b.costMedianUsd||a.id.localeCompare(b.id));
  const stability=orderStability(aggregate);
  const [top,second]=tier;
  const caveats=[];
  const verdict={recommended:null,recommendedBasis:'',runnerUp:null,marginPct:null,resolved:false,
    candidates:[],capabilityTier:tier.map(s=>s.id),bestAttainmentPct:round(bestAttainment),
    indistinguishableThresholdPct:INDISTINGUISHABLE_PCT,capabilityTierPts:CAPABILITY_TIER_PTS,
    stable:stability.share>=STABLE_SHARE,stabilityBasis:'',
    bindingConstraint:null,bindingConstraintHours:null,coolingSideConstraint:null,bindingConstraintBasis:'',caveats};
  const constraint=weather.bindingConstraint;
  const totalConstraintHours=Object.values(constraint.hours).reduce((a,b)=>a+b,0);
  verdict.bindingConstraint=totalConstraintHours>0?constraint.binding:null;
  verdict.bindingConstraintHours=Object.fromEntries(Object.entries(constraint.hours).map(([k,v])=>[k,round(v)]));
  // Heating hours are counted against the band's own heating threshold (20 C by day, 16 C by night for this
  // 22/18 C lettuce band), so every temperate site accumulates thousands of them and "heating" wins the
  // count at many temperate sites. That is a true statement about hours and a misleading one about
  // climate, so the cooling-side constraint, moisture against temperature, is reported beside it: that is the
  // comparison that separates a hot-humid site from a hot-dry one.
  verdict.coolingSideConstraint=constraint.hours.moisture===constraint.hours.temperature?null
    :constraint.hours.moisture>constraint.hours.temperature?'moisture':'temperature';
  verdict.bindingConstraintBasis=`Mean hours per year from the weather-side screen at this band: ${Math.round(constraint.hours.heating)} h below the heating threshold (20 C by day, 16 C by night here), ${Math.round(constraint.hours.moisture)} h moisture-limited and ${Math.round(constraint.hours.temperature)} h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, ${verdict.coolingSideConstraint??'a tie'}, is what separates one warm climate from another.`;

  if(!top){
    verdict.recommendedBasis='No strategy produced both a median cost and a median attainment at this region, so no verdict is possible.';
    verdict.stabilityBasis='Not evaluated: no priced strategy.';
    caveats.push('The model returned no priced result for this region; treat the whole row as missing, not as a tie.');
    return verdict;
  }
  const margin=second?100*(second.costMedianUsd-top.costMedianUsd)/top.costMedianUsd:null;
  verdict.marginPct=round(margin,2);
  verdict.runnerUp=second?second.id:null;

  // The cheapest year-by-year member of the capability tier, which is the decision this verdict actually makes.
  const tierIds=new Set(tier.map(s=>s.scenarioId));
  const cheapestTierPerYear=Object.entries(aggregate.ranking.byYear)
    .map(([year,ids])=>[year,ids.find(id=>tierIds.has(id))??null]);
  const topYears=cheapestTierPerYear.filter(([,id])=>id===top.scenarioId).length;

  if(second&&margin<INDISTINGUISHABLE_PCT){
    verdict.resolved=false;
    verdict.candidates=[top.id,second.id];
    verdict.recommendedBasis=`Not resolved by this evidence: ${top.label} at ${usd(top.costMedianUsd)} and ${second.label} at ${usd(second.costMedianUsd)} modeled operating cost (median over weather years ${region.years.join(', ')}) differ by ${margin.toFixed(1)} percent relative to ${top.label}, inside the retained ${INDISTINGUISHABLE_PCT} percent screening band, while holding the joint temperature-and-moisture target in ${pct(top.attainmentMedianPct)} and ${pct(second.attainmentMedianPct)} of eligible hours; measuring canopy leaf area and transpiration and the as-built envelope U-value at the site, then comparing capital, maintenance and redundancy, is what would resolve it.`;
    caveats.push(`The ${INDISTINGUISHABLE_PCT} percent decision band is retained from the original screening methodology, not a confidence interval or a newly measured current-model reorder band: nothing here says which of ${top.label} and ${second.label} is cheaper at a real site.`);
  }else{
    verdict.resolved=true;
    verdict.recommended=top.id;
    verdict.candidates=[top.id];
    verdict.recommendedBasis=second
      ?`${top.label} holds the joint temperature-and-moisture target in a median ${pct(top.attainmentMedianPct)} of eligible hours (worst year ${pct(top.attainmentWorstPct)}, best year ${pct(top.attainmentBestPct)}, worst-to-best spread ${round(top.attainmentSpreadPts,1)} pp) at ${usd(top.costMedianUsd)} modeled operating cost (median over weather years ${region.years.join(', ')}). ${second.label} at ${pct(second.attainmentMedianPct)} attainment and ${usd(second.costMedianUsd)} costs ${margin.toFixed(1)} percent more relative to ${top.label}. ${top.label} is the cheapest strategy inside the capability tier in ${topYears} of the ${stability.years} years.`
      :`${top.label} is the only strategy within ${CAPABILITY_TIER_PTS} pp of the best median joint temperature-and-moisture target attainment in this region, holding the target in ${pct(top.attainmentMedianPct)} of eligible hours (worst year ${pct(top.attainmentWorstPct)}) at ${usd(top.costMedianUsd)} modeled operating cost (median over weather years ${region.years.join(', ')}); its ${pct(bestAttainment)} median attainment exceeds the next strategy's ${pct(Math.max(...priced.filter(s=>s!==top).map(s=>s.attainmentMedianPct)))} by ${round(bestAttainment-Math.max(...priced.filter(s=>s!==top).map(s=>s.attainmentMedianPct)),1)} pp.`;
  }
  verdict.stabilityBasis=`${stability.distinctOrders} distinct operating-cost orders of the six strategies over ${stability.years} weather years; the most common holds in ${stability.mostCommonCount} of ${stability.years} (${(stability.share*100).toFixed(0)} percent), against the pre-set rule that one order must hold in at least ${(STABLE_SHARE*100).toFixed(0)} percent of years. The cheapest member of the capability tier is ${top.label} in ${topYears} of ${stability.years} years.`;

  // Caveats every region carries, then the ones this region's numbers earn.
  caveats.push(`These are ${yearRows.length} observed years (${yearRows[0].year} to ${yearRows[yearRows.length-1].year}), ${yearRows.length} particular years, not a sample from a stationary distribution: the worst-to-best spread is what happened, not a forecast, a confidence interval or a design year.`);
  caveats.push(`All strategies use the same declared prices at this site. ${costBasisText(top.costBasis)} Installed capital is a separate screening assumption, not an equipment quote.`);
  if(!verdict.stable)caveats.push('The full six-strategy cost order is year-dependent at this region, so a ranking quoted from any single year is an anecdote.');
  const failures=strategies.reduce((sum,s)=>sum+(s.numericalFailureHours||0),0);
  if(failures)caveats.push(`${failures} hours failed numerically or physically across the run; a favourable economic ranking is prohibited until they are explained.`);
  const cheaperOutside=priced.filter(s=>!tierIds.has(s.scenarioId)&&s.costMedianUsd<top.costMedianUsd)
    .sort((a,b)=>a.costMedianUsd-b.costMedianUsd)[0];
  if(cheaperOutside)caveats.push(`${cheaperOutside.label} is cheaper again at ${usd(cheaperOutside.costMedianUsd)} but holds the joint temperature-and-moisture target in only ${pct(cheaperOutside.attainmentMedianPct)} of eligible hours, ${round(top.attainmentMedianPct-cheaperOutside.attainmentMedianPct,1)} pp below ${top.label} at ${pct(top.attainmentMedianPct)}; buying that saving is a decision about how much of the target you are willing to miss.`);
  if(finite(bestAttainment)&&bestAttainment<60)caveats.push(`No strategy here holds the joint band in more than ${pct(bestAttainment)} of eligible hours, so the band itself, the crop targets and the envelope are the first thing to revisit at this site, ahead of equipment class.`);
  if(region.key==='denver')caveats.push('Every psychrometric quantity uses the bundled station-pressure path at this source elevation; a sea-level assumption would change humidity ratio, enthalpy, wet bulb and fan mass flow.');
  return verdict;
}

function buildRegion(site,yearRows,scenarios){
  const runs=yearRows.map(row=>({label:String(row.year),
    results:row.strategies.map(s=>({scenario:{id:s.scenarioId,name:s.name},
      summary:{compliancePct:s.compliancePct,compliantHours:s.compliantHours,cost:s.cost,
        electricKWh:s.electricKWh,fuelKWh:s.fuelKWh,eligibleHours:s.eligibleHours,
        runtime:{pad:{hours:s.padRuntimeHours}},numericalFailureHours:s.numericalFailureHours}}))}));
  const aggregate=aggregateYears(runs);
  const frontier=strategyFrontier(aggregate);
  const strategies=rankStrategies(aggregate,frontier,scenarios.map(s=>({id:s.technology,name:s.name,scenarioId:s.id,
    costBasis:(()=>{
      const bases=yearRows.map(row=>row.strategies.find(x=>x.scenarioId===s.id).costBasis);
      const years=yearRows.map(row=>row.year);
      return {...bases[0],scope:'multiYear',
        label:`Model-estimated operating cost, median of full weather-record totals over years ${years.join(', ')} (not one annual result)`,
        aggregation:{statistic:'median',years},
        period:{startDate:bases[0].period.startDate,endDate:bases.at(-1).period.endDate},
        periods:bases.map((basis,i)=>({year:years[i],...basis.period}))};
    })(),
    numericalFailureHours:yearRows.reduce((sum,row)=>sum+(row.strategies.find(x=>x.scenarioId===s.id)?.numericalFailureHours||0),0)})));
  const weather=regionWeather(yearRows);
  const region={key:site.key,label:site.label,zip:site.zip,climate:site.climate,
    years:yearRows.map(row=>row.year),
    weather:weather.weather,
    strategies,
    perYear:yearRows.map(row=>({year:row.year,validHours:row.weather.validHours,expectedHours:row.weather.expectedHours,
      strategies:row.strategies.map(s=>({id:s.id,attainmentPct:round(s.compliancePct),costUsd:round(s.cost),
        electricKWh:round(s.electricKWh),fuelKWh:round(s.fuelKWh),costBasis:s.costBasis,
        validHours:s.validHours,eligibleHours:s.eligibleHours,numericalFailureHours:s.numericalFailureHours}))})),
    costOrderByYear:Object.fromEntries(Object.entries(aggregate.ranking.byYear).map(([year,ids])=>
      [year,ids.map(id=>scenarios.find(s=>s.id===id)?.technology??id)]))};
  region.verdict=buildVerdict({region,strategies,aggregate,weather,yearRows});
  return region;
}

function printSummary(output){
  const pad=(s,n)=>String(s).padEnd(n),padStart=(s,n)=>String(s).padStart(n);
  for(const region of output.regions){
    process.stdout.write(`\n${region.label} (${region.zip}, ${region.climate}) ${region.years[0]} to ${region.years[region.years.length-1]}\n`);
    const w=region.weather;
    process.stdout.write(`  weather medians: pad-effective ${Math.round(w.padEffectiveHoursMedian)} h, free cooling ${Math.round(w.freeCoolingHoursMedian)} h, heating ${Math.round(w.heatingHoursMedian)} h, moisture-limited ${Math.round(w.moistureLimitedHoursMedian)} h, temperature-limited ${Math.round(w.temperatureLimitedHoursMedian)} h\n`);
    process.stdout.write(`  design (0.4% of ${w.designHours.toLocaleString('en-US')} pooled hours): dry bulb ${w.designDryBulbC} C at coincident wet bulb ${w.coincidentWetBulbC} C, dew point ${w.designDewPointC} C, mean summer wet bulb ${w.meanSummerWetBulbC} C\n`);
    process.stdout.write(`  ${pad('rank strategy',40)}${padStart('attain med',11)}${padStart('worst',8)}${padStart('best',8)}${padStart('span pp',8)}${padStart('cost med',11)}${padStart('cost spread',12)}${padStart('elec kWh',10)}${padStart('fuel kWh',10)}\n`);
    for(const s of region.strategies)
      process.stdout.write(`  ${pad(`${s.rank}. ${s.label}${s.dominated?' (dominated)':''}`,40)}${padStart(pct(s.attainmentMedianPct),11)}${padStart(pct(s.attainmentWorstPct),8)}${padStart(pct(s.attainmentBestPct),8)}${padStart(round(s.attainmentSpreadPts,1),8)}${padStart(usd(s.costMedianUsd),11)}${padStart(usd(s.costSpreadUsd),12)}${padStart(Math.round(s.electricMedianKWh).toLocaleString('en-US'),10)}${padStart(Math.round(s.fuelMedianKWh).toLocaleString('en-US'),10)}\n`);
    const v=region.verdict;
    process.stdout.write(`  verdict: ${v.recommended?`recommended ${v.recommended}`:'NOT RESOLVED'}${v.runnerUp?`, runner-up ${v.runnerUp}, margin ${v.marginPct}%`:', no second strategy in the capability tier'}\n`);
    process.stdout.write(`  binding constraint: ${v.bindingConstraint} (moisture ${Math.round(v.bindingConstraintHours.moisture)} h, temperature ${Math.round(v.bindingConstraintHours.temperature)} h, heating ${Math.round(v.bindingConstraintHours.heating)} h per year); cooling-side: ${v.coolingSideConstraint}\n`);
    process.stdout.write(`  ranking ${v.stable?'stable':'unstable'}: ${v.stabilityBasis}\n`);
    process.stdout.write(`  basis: ${v.recommendedBasis}\n`);
    for(const caveat of v.caveats)process.stdout.write(`  caveat: ${caveat}\n`);
  }
  process.stdout.write('\nCross-region verdicts\n');
  process.stdout.write(`  ${pad('region',16)}${pad('binding',10)}${pad('cooling-side',14)}${pad('verdict',34)}${pad('runner-up',18)}${padStart('margin',9)}${padStart('stable',9)}\n`);
  for(const region of output.regions){
    const v=region.verdict;
    process.stdout.write(`  ${pad(region.label,16)}${pad(v.bindingConstraint??'n/a',10)}${pad(v.coolingSideConstraint??'n/a',14)}${pad(v.recommended??`unresolved: ${v.candidates.join(' vs ')}`,34)}${pad(v.runnerUp??'none in tier',18)}${padStart(finite(v.marginPct)?`${v.marginPct}%`:'n/a',9)}${padStart(v.stable?'yes':'no',9)}\n`);
  }
}

async function main(){
  const options=parseArgs(process.argv.slice(2));
  const started=Date.now();
  const scenarios=loadScenarios();
  const sites=options.sites.map(loadSite);
  for(const site of sites){
    const missing=options.years.filter(year=>!site.files?.[String(year)]);
    if(missing.length)throw new Error(`${site.label} has no bundled weather for ${missing.join(', ')}.`);
  }
  const tasks=sites.flatMap(site=>options.years.map(year=>({site:site.key,year})));
  const simulations=tasks.length*scenarios.length;
  process.stderr.write(`Regional study: ${sites.length} sites x ${options.years.length} years x ${scenarios.length} strategies = ${simulations} full-year simulations, ${options.concurrency} worker(s).\n`);
  let last=0;
  const results=await runTasks(tasks,options,done=>{
    if(done-last>=5||done===tasks.length){last=done;process.stderr.write(`  ${done}/${tasks.length} site-years\n`);}
  });
  const regions=sites.map(site=>buildRegion(site,
    options.years.map(year=>results.get(`${site.key}|${year}`)),scenarios));
  const runtimeSeconds=(Date.now()-started)/1000;
  const output={schemaVersion:1,scenarioSchemaVersion:SCENARIO_SCHEMA_VERSION,generatedAt:new Date().toISOString(),modelVersion:MODEL_VERSION,
    method:{years:options.years,sites:options.sites,scenarios:scenarios.map(s=>({id:s.technology,label:s.name,
        scenarioId:s.id,installedCostUsd:s.installedCost,installedCostBasis:s.installedCostBasis})),
      metricUnits:{attainmentMedianPct:'% of eligible hours meeting the joint temperature-and-moisture target',
        attainmentSpreadPts:'pp',capabilityTierPts:'pp',marginPct:'% relative to the cheaper capability-tier strategy'},
      controller:'Staged deadband controller, the interface default; the ideal per-substep optimizer is not used here.',
      transpirationModel:'stanghellini',stepMinutes:1,
      simulations,runtimeSeconds:round(runtimeSeconds,1),
      notes:[
        `Every number is computed from the committed NASA POWER snapshots in data/weather by src/simulate.js at model ${MODEL_VERSION}. Nothing is quoted from a published climate summary and nothing is interpolated between sites.`,
        'Each of the six strategies is the same 500 m2 greenhouse, crop band and target band as docs/example-scenarios.json, re-homed to the site coordinates, ZIP and IANA time zone so the day/night schedule and local-day accounting follow local time.',
        'Operating costs use the numeric applied electricity, fuel and water prices retained in each strategy costBasis from simulation results. All sites use the same scenario prices, not local tariffs. Capital, maintenance and other exclusions are stated in costBasis.',
        'Attainment is the joint-band compliant share of eligible hours: hours that are valid, not a segment warm-up hour and not excluded. Median, worst, best and spread are over the ten weather years, not over a distribution.',
        `Ranking: non-dominated strategies first by ascending median cost, then dominated ones by ascending median cost. Dominated means another strategy costs no more and holds the band no worse. Ranks are dense, 1 to ${scenarios.length}.`,
        `Capability tier: strategies within ${CAPABILITY_TIER_PTS} percentage points (pp) of the region's best median joint temperature-and-moisture target attainment. This decision rule is retained from the original screening methodology, not recalibrated or newly inferred from this regeneration.`,
        `Recommendation rule: the cheapest strategy in the capability tier, but only outside the retained ${INDISTINGUISHABLE_PCT} percent cost band. The margin is (next cost minus cheapest cost) / cheapest cost. Inside the band recommended is null, resolved is false and candidates names both. The threshold is not a current-model uncertainty estimate.`,
        `Ranking stability: stable is true when one per-year operating-cost order of the six strategies holds in at least ${(STABLE_SHARE*100).toFixed(0)} percent of the ten years, the same rule the Morris screening applies over design points.`,
        `Design conditions are the value exceeded in ${DESIGN_FRACTION*100} percent of the pooled ten-year hours, with the coincident state of that same hour, the same convention src/metrics.js designHours uses for a single year. Coincident values are not independent percentiles.`,
        'Binding constraint is the largest of three mean hour counts from the weather-side screen: moisture-limited, temperature-limited and below the band\'s heating threshold. The heating threshold for this 22/18 C band is 20 C by day and 16 C by night, so hours below it are plentiful at temperate sites. Read coolingSideConstraint, moisture against temperature, for the comparison that distinguishes one warm climate from another.',
        'Mean summer wet bulb is the arithmetic mean over local June, July and August hours at each hour\'s own station pressure, over all ten years.',
        'Ten observed years are ten particular years. A spread between the worst and best of them is not a confidence interval, not a probability distribution and not a design year, and this file supports no statement of the form "cost is X plus or minus Y".',
        'Maximum controlled outdoor-air ACH is installed capacity, not uncontrolled infiltration or actual continuous flow. The staged controller dispatches within that capacity; minimum controlled air and uncontrolled leakage remain separate inputs.',
        'Evidence tier: assumption-based screening (tier 2 of docs/EVALUATION.md). No independent model benchmark, no site calibration and no equipment performance maps stand behind any number here.']},
    regions};
  if(options.json)process.stdout.write(JSON.stringify(output,null,1)+'\n');
  else printSummary(output);
  writeFileSync(new URL(options.out,here('../')),JSON.stringify(output,null,1)+'\n');
  process.stderr.write(`\nWrote ${options.out}: ${simulations} simulations in ${runtimeSeconds.toFixed(1)} s.\n`);
}

if(isMainThread)await main();
