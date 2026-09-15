#!/usr/bin/env node
// Morris elementary-effects screening over the bundled Tulsa weather years and the six example strategies
// (roadmap M3). Runs the real coupled simulation at every design point; nothing here is estimated from a
// surrogate. Screening ranks influence and labels ranking stability; it produces no probability
// distribution and no confidence interval.
//
//   node scripts/morris-screening.mjs [--years 2023,2024,2025] [--trajectories 8] [--days 120]
//                                     [--seed 1] [--concurrency N] [--out docs/morris-screening.json]
//
// Reproducible: identical seed and inputs give byte-identical output apart from generatedAt and
// runtimeSeconds. Work is split over worker threads only for wall time; each point is evaluated
// independently and results are re-ordered by the design, so concurrency cannot change the numbers.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {availableParallelism} from 'node:os';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {MODEL_VERSION,SCENARIO_SCHEMA_VERSION,validateScenario} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';
import {aggregateYears,strategyFrontier} from '../src/metrics.js';
import {MORRIS_PARAMETERS,morrisDesign,elementaryEffects,rankByMuStar,rankingStability,applyPoint} from '../src/sensitivity.js';

const METRICS=['compliancePct','cost','electricKWh'];
const UNITS={compliancePct:'% of eligible hours meeting the joint temperature-and-moisture target',cost:'USD over the sampled days',electricKWh:'kWh over the sampled days'};
const EFFECT_UNITS={compliancePct:'pp per full screened parameter range',cost:'USD per full screened parameter range',electricKWh:'kWh per full screened parameter range'};
const here=path=>new URL(path,import.meta.url);
const round=(value,places=6)=>Number.isFinite(value)?Number(value.toFixed(places)):null;

function loadScenarios(){
 const scenarios=JSON.parse(readFileSync(here('../docs/example-scenarios.json'),'utf8')).scenarios;
 for(const s of scenarios){
  const errors=validateScenario(s);
  if(errors.length)throw new Error(`Example scenario ${s.name} is invalid: ${errors.join(' ')}`);
 }
 return scenarios;
}
function loadYear(year){
 const index=JSON.parse(readFileSync(here('../data/weather/index.json'),'utf8'));
 const site=index.sites.find(s=>s.key==='tulsa');
 const file=site?.files?.[String(year)];
 if(!file)throw new Error(`No bundled Tulsa weather for ${year}. Available: ${site?.years?.join(', ')}`);
 return JSON.parse(readFileSync(here(`../data/weather/${file}`),'utf8'));
}
/**
 * Keep `days` evenly spaced whole local days. Partial edge days (the record is UTC-bounded) and days
 * missing hours are dropped first; every kept day is complete, so daily light and day/night accounting
 * stay meaningful. Each kept day is a separate continuous segment, so the simulator spends its first hour
 * as warm-up and excludes it from compliance. That is a fixed cost applied identically at every design
 * point, which is what a screening comparison needs. Totals are for the sampled days, not a year.
 */
function subsampleDays(snapshot,days){
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:snapshot.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
 const byDay=new Map();
 for(const hour of snapshot.hours){
  const key=format.format(new Date(hour.time));
  if(!byDay.has(key))byDay.set(key,[]);
  byDay.get(key).push(hour);
 }
 const all=[...byDay.keys()].sort();
 // 23 and 25 hour days are the daylight-saving transitions and are still whole local days.
 const whole=all.filter((key,i)=>i>0&&i<all.length-1&&byDay.get(key).length>=23);
 const wanted=Math.min(days,whole.length);
 const picked=new Set();
 for(let i=0;i<wanted;i++)picked.add(whole[wanted===1?0:Math.round(i*(whole.length-1)/(wanted-1))]);
 const keys=[...picked].sort();
 const hours=keys.flatMap(key=>byDay.get(key)).sort((a,b)=>a.time-b.time);
 return {snapshot:{...snapshot,hours},days:keys.length,firstDay:keys[0],lastDay:keys[keys.length-1],availableDays:whole.length};
}

// One design point: every strategy on every year, aggregated to the median over years, exactly as the
// interface aggregates a multi-year run.
function evaluatePoint(point,scenarios,years){
 const runs=years.map(({label,snapshot})=>({label,snapshot,
  results:scenarios.map(scenario=>simulateScenario(applyPoint(scenario,point),snapshot))}));
 const aggregate=aggregateYears(runs);
 const frontier=strategyFrontier(aggregate);
 const metrics={},entries=Object.entries(aggregate.byScenario);
 for(const metric of METRICS){
  const values=[];
  for(const [id,entry] of entries){
   const value=entry.median[metric];
   metrics[`${metric}@${scenarios.find(s=>s.id===id).technology}`]=round(value);
   if(Number.isFinite(value))values.push(value);
  }
  // Headline metric: the unweighted mean over strategies, i.e. the level of the whole screen's answer.
  metrics[metric]=values.length===entries.length?round(values.reduce((a,b)=>a+b,0)/values.length):null;
 }
 const ranking=entries
  .map(([id,entry])=>({id,technology:scenarios.find(s=>s.id===id).technology,cost:entry.median.cost}))
  .sort((a,b)=>(a.cost===null)-(b.cost===null)||(a.cost??0)-(b.cost??0)||a.technology.localeCompare(b.technology))
  .map(r=>r.technology);
 const best=frontier.best?scenarios.find(s=>s.id===frontier.best.id).technology:null;
 const failures=runs.reduce((sum,run)=>sum+run.results.reduce((s,r)=>s+(r.summary.numericalFailureHours||0),0),0);
 const validHours=runs.reduce((sum,run)=>sum+run.results.reduce((s,r)=>s+r.summary.validHours,0),0);
 const eligibleHours=runs.reduce((sum,run)=>sum+run.results.reduce((s,r)=>s+r.summary.eligibleHours,0),0);
 const costBases=scenarios.map((scenario,i)=>{
  const bases=runs.map(run=>run.results[i].summary.costBasis);
  const labels=runs.map(run=>Number(run.label));
  return {...bases[0],scope:'multiYear',
   label:`Model-estimated operating cost, median of sampled-day totals over weather years ${labels.join(', ')} (not annual cost)`,
   aggregation:{statistic:'median',years:labels},
   period:{startDate:bases[0].period.startDate,endDate:bases.at(-1).period.endDate},
   periods:bases.map((basis,j)=>({year:labels[j],...basis.period}))};
 });
 return {id:point.id,changedKey:point.changedKey,metrics,ranking,best,numericalFailureHours:failures,validHours,eligibleHours,costBases};
}

function buildInputs({years,days}){
 const scenarios=loadScenarios();
 const prepared=years.map(year=>{
  const sub=subsampleDays(loadYear(year),days);
  return {label:String(year),snapshot:sub.snapshot,days:sub.days,firstDay:sub.firstDay,lastDay:sub.lastDay,availableDays:sub.availableDays};
 });
 return {scenarios,years:prepared};
}

if(!isMainThread&&workerData?.morrisWorker){
 const {scenarios,years}=buildInputs(workerData);
 parentPort.postMessage({ready:true});
 parentPort.on('message',message=>{
  if(message.done)return void parentPort.close();
  parentPort.postMessage({result:evaluatePoint(message.point,scenarios,years)});
 });
}

function parseArgs(argv){
 const options={years:[2023,2024,2025],trajectories:8,days:120,seed:1,out:'docs/morris-screening.json',
  concurrency:Math.max(1,Math.min(8,availableParallelism()-1))};
 for(let i=0;i<argv.length;i++){
  const [flag,inline]=argv[i].split('=');
  const value=inline??argv[++i];
  if(value===undefined)throw new Error(`Missing value for ${flag}`);
  if(flag==='--years')options.years=value.split(',').map(y=>Number(y.trim()));
  else if(flag==='--trajectories')options.trajectories=Number(value);
  else if(flag==='--days')options.days=Number(value);
  else if(flag==='--seed')options.seed=/^-?\d+$/.test(value)?Number(value):value;
  else if(flag==='--concurrency')options.concurrency=Math.max(1,Number(value));
  else if(flag==='--out')options.out=value;
  else throw new Error(`Unknown option ${flag}`);
 }
 if(!options.years.length||options.years.some(y=>!Number.isInteger(y)))throw new Error('--years takes a comma-separated list of whole years.');
 if(!Number.isInteger(options.trajectories)||options.trajectories<1)throw new Error('--trajectories takes a positive integer.');
 if(!Number.isInteger(options.days)||options.days<2)throw new Error('--days takes an integer of at least two.');
 return options;
}

// Points are independent, so they are dealt to workers as they free up. Results are keyed by point id and
// re-ordered by the design before any statistic is computed.
async function runPoints(points,options,onDone){
 const results=new Map();
 if(options.concurrency<=1||points.length===1){
  const {scenarios,years}=buildInputs(options);
  for(const point of points){results.set(point.id,evaluatePoint(point,scenarios,years));onDone(results.size);}
  return results;
 }
 const queue=points.slice(),file=fileURLToPath(import.meta.url);
 const workers=Array.from({length:Math.min(options.concurrency,points.length)},()=>
  new Worker(file,{workerData:{morrisWorker:true,years:options.years,days:options.days}}));
 await new Promise((resolve,reject)=>{
  let live=workers.length;
  for(const worker of workers){
   const next=()=>{
    const point=queue.shift();
    if(point)worker.postMessage({point});
    else{worker.postMessage({done:true});worker.terminate();}
   };
   worker.on('message',message=>{
    if(message.result){results.set(message.result.id,message.result);onDone(results.size);}
    next();
   });
   worker.on('error',reject);
   worker.on('exit',()=>{if(--live===0)resolve();});
  }
 });
 if(results.size!==points.length)throw new Error(`Only ${results.size} of ${points.length} design points returned.`);
 return results;
}

async function main(){
 const options=parseArgs(process.argv.slice(2));
 const started=Date.now();
 const design=morrisDesign({parameters:MORRIS_PARAMETERS,trajectories:options.trajectories,seed:options.seed});
 const coverage=buildInputs(options).years.map(y=>({year:y.label,days:y.days,firstDay:y.firstDay,lastDay:y.lastDay,availableDays:y.availableDays,hours:y.snapshot.hours.length}));
 const runs=design.points.length*coverage.length*6;
 process.stderr.write(`Morris screening: ${design.points.length} design points x ${coverage.length} years x 6 strategies = ${runs} simulations, ${coverage[0].days} sampled days each, ${options.concurrency} worker(s).\n`);
 let last=0;
 const results=await runPoints(design.points,options,done=>{
  if(done-last>=10||done===design.points.length){last=done;process.stderr.write(`  ${done}/${design.points.length} points\n`);}
 });
 const observations=design.points.map(p=>results.get(p.id));
 const effects=elementaryEffects(design,observations);
 const stability={...rankingStability(observations),
  bestStrategy:rankingStability(observations.map(o=>({id:o.id,ranking:o.best?[o.best]:[]})))};
 const runtimeSeconds=(Date.now()-started)/1000;
 const output={
  schemaVersion:2,
  design:{parameters:design.parameters.map(p=>p.key==='maxVentACH'?{...p,label:'Installed maximum controlled outdoor-air capacity',
    rationale:`${p.rationale} Controlled capacity is not uncontrolled leakage or actual continuous dispatched airflow.`}:p),
   levels:design.levels,trajectories:design.trajectories,seed:design.seed,delta:design.delta,
   basis:design.basis,points:design.points.map(p=>({id:p.id,trajectory:p.trajectory,step:p.step,changedKey:p.changedKey,
    values:Object.fromEntries(Object.entries(p.values).map(([k,v])=>[k,round(v)]))}))},
  observations:observations.map(({costBases,...observation})=>observation),
  effects:Object.fromEntries(Object.entries(effects).map(([key,byMetric])=>[key,
   Object.fromEntries(Object.entries(byMetric).map(([metric,e])=>[metric,{mu:round(e.mu),muStar:round(e.muStar),sigma:round(e.sigma),n:e.n}]))])),
  stability,
  provenance:{modelVersion:MODEL_VERSION,scenarioSchemaVersion:SCENARIO_SCHEMA_VERSION,site:'Tulsa, OK (74103), bundled NASA POWER years',years:options.years,days:options.days,
   trajectories:options.trajectories,levels:design.levels,seed:options.seed,strategies:loadScenarios().map(s=>s.technology),
   scenarios:loadScenarios().map((s,i)=>({id:s.technology,scenarioId:s.id,installedCostUsd:s.installedCost,
    installedCostBasis:s.installedCostBasis,costBasis:observations[0].costBases[i]})),
   simulations:runs,coverage,generatedAt:new Date().toISOString(),runtimeSeconds:round(runtimeSeconds,1),
   metricUnits:UNITS,effectUnits:EFFECT_UNITS,
   method:'Morris elementary effects. Each effect is the metric change per full screened range of one parameter, measured one parameter at a time along random trajectories. mu* ranks influence; sigma indicates interaction or non-linearity. This is a screening method: it produces no probability distribution and no confidence interval.',
   subsampling:`Each weather year is subsampled to ${options.days} evenly spaced whole local days; totals are for those days, not a calendar year, and each sampled day costs its first hour as controller warm-up.`,
   headlineMetric:'Unweighted mean over the six strategies of each metric\'s median over weather years; per-strategy values are suffixed @technology.'}};
 writeFileSync(new URL(options.out,here('../')),JSON.stringify(output,null,1)+'\n');
 for(const metric of METRICS){
  process.stdout.write(`\n${metric} (${EFFECT_UNITS[metric]}) ranked by mu*:\n`);
  for(const row of rankByMuStar(effects,metric))
   process.stdout.write(`  ${row.key.padEnd(20)} mu*=${row.muStar.toPrecision(4).padStart(11)}  mu=${row.mu.toPrecision(4).padStart(11)}  sigma=${row.sigma.toPrecision(4).padStart(11)}  n=${row.n}\n`);
 }
 process.stdout.write(`\nRanking stability: ${stability.note}\n`);
 process.stdout.write(`Cheapest non-dominated strategy: ${stability.bestStrategy.mostCommon?.join('|')} in ${(stability.bestStrategy.share*100).toFixed(1)}% of points (${stability.bestStrategy.distinctOrders} distinct winners).\n`);
 process.stdout.write(`Wrote ${options.out} in ${runtimeSeconds.toFixed(1)} s.\n`);
}

if(isMainThread)await main();
