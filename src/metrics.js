import {classifyWeather, localClock, schedule, outdoorDryingHour, weatherState, wetBulb, dewPoint, LATENT_HEAT} from './physics.js';

// Aggregates outdoorDryingHour over the record: hours, days, removal potential and energy/cost per kg of
// water against the scenario's condensing dehumidifier. Result rows carry the per-hour value from the
// simulation; raw weather rows are evaluated here.
function outdoorDrying(hours, scenario) {
  const buckets = () => ({hours: 0, potentialKg: 0, energyKWh: 0, cost: 0, days: new Map()});
  const out = {coolDry: buckets(), coldDry: buckets(), hotDry: buckets()};
  const dehuKWhPerKg = scenario.dehuLPerKWh > 0 ? 1 / scenario.dehuLPerKWh : null;
  const dehuCostPerKg = dehuKWhPerKg === null ? null : dehuKWhPerKg * scenario.electricityPrice;
  let cheaperThanDehuHours = 0, lowerEnergyThanDehuHours = 0;
  for (const h of hours) {
    const d = h.outdoorDrying !== undefined ? h.outdoorDrying : outdoorDryingHour(h, scenario);
    if (!d) continue;
    const b = out[d.bucket];
    b.hours++; b.potentialKg += d.potentialKgH; b.energyKWh += d.energyKWh; b.cost += d.cost;
    const date = localClock(h.time, scenario.timezone).date; b.days.set(date, (b.days.get(date) || 0) + 1);
    if (dehuKWhPerKg !== null && d.energyKWh / d.potentialKgH < dehuKWhPerKg) lowerEnergyThanDehuHours++;
    if (dehuCostPerKg !== null && d.cost / d.potentialKgH < dehuCostPerKg) cheaperThanDehuHours++;
  }
  for (const b of Object.values(out)) {
    const counts = [...b.days.values()];
    b.days = {atLeast1: counts.length, atLeast4: counts.filter(n => n >= 4).length};
    b.meanPotentialKgH = b.hours ? b.potentialKg / b.hours : null;
    b.kWhPerKg = b.potentialKg ? b.energyKWh / b.potentialKg : null;
    b.costPerKg = b.potentialKg ? b.cost / b.potentialKg : null;
  }
  return {...out, maxVentACH: scenario.maxVentACH, dehuKWhPerKg, dehuCostPerKg, cheaperThanDehuHours, lowerEnergyThanDehuHours,
    basis: 'Maximum ventilation rate, fan power and heating of ventilation air to the target at scenario prices; sensible import in hot-dry hours is not costed here.'};
}

const ENERGY_FIELDS = ['electricKWh','fuelKWh','waterL','condensateKg','lightKWh','heatingKWh','coolingKWh','dehuKWh','dehuHeatKWh','regenerationKWh','regenerationElectricKWh','regenerationFuelKWh','desiccantRemovedKg','desiccantHeatKWh','desiccantExportedHeatKWh','reheatKWh','rejectedHeatKWh','surfaceCondensateKg','cropWaterL','padWaterL','humidifierWaterL','unmetSensibleKWh','unmetMoistureKg','doasKWh','doasRemovedKg'];
const eligible = h => h.valid && h.eligible !== false && !h.warmup;
// Runtime: hours with any use, duty-weighted equivalent full-load hours, and distinct local days with any use.
const RUNTIME_COMPONENTS=[['pad','padFraction'],['indirect','indirectFraction'],['dx','dxDuty'],['dehu','dehuDuty'],['desiccant','desiccantDuty'],['heating','heaterDuty'],['humidifier','humidifierFraction'],['light','lightFraction'],['doas','doasDuty']];
export function hourCost(hour,scenario) {
  if (Object.hasOwn(hour,'cost')) return Number.isFinite(hour.cost)?hour.cost:null;
  return (hour.electricKWh||0)*scenario.electricityPrice+(hour.fuelKWh||0)*scenario.fuelPrice+(hour.waterL||0)*scenario.waterPrice;
}
function quantile(sorted,p) {
  if (!sorted.length) return 0;
  const at=(sorted.length-1)*p,lo=Math.floor(at);
  return sorted[lo]+(sorted[Math.ceil(at)]-sorted[lo])*(at-lo);
}
function episodeSummary(lengths) {
  const sorted=lengths.slice().sort((a,b)=>a-b);
  return {count:sorted.length,medianHours:quantile(sorted,.5),p90Hours:quantile(sorted,.9),maximumHours:sorted.at(-1)||0};
}

function civilSegments(time,timezone) {
  const end=time+3600000,date=localClock(time,timezone).date;
  if(localClock(end-1,timezone).date===date)return [{date,start:time,end,hours:1}];
  let lo=time,hi=end;
  while(hi-lo>1){const mid=Math.floor((lo+hi)/2);if(localClock(mid,timezone).date===date)lo=mid;else hi=mid;}
  return [{date,start:time,end:hi,hours:(hi-time)/3600000},{date:localClock(hi,timezone).date,start:hi,end,hours:(end-hi)/3600000}];
}

export function summarizeHours(hours,scenario) {
  const out={expectedHours:hours.length,validHours:0,missingHours:0,eligibleHours:0,warmupHours:0,numericalFailureHours:0,
    compliantHours:0,compliancePct:null,cost:0,knownCost:0,priceMissingHours:0,longestFailureHours:0,peakCoolingKW:0,peakElectricKW:0,dliDeficitDays:0,
    incompleteDays:0,modeCounts:{},monthly:[],daily:[],dayNight:{day:{hours:0,compliantHours:0},night:{hours:0,compliantHours:0}},
    maxEnergyResidualW:0,maxMoistureResidualKgS:0,tempDegreeHours:0,vpdKPaHours:0,installedCost:scenario.installedCost,
    annualMaintenance:scenario.maintenanceYear,costBasis:'Observed period energy and water only. Capital and annual maintenance are separate; no partial-year annualization.'};
  const capitalFactor=scenario.discountRate===0?1/scenario.lifeYears:scenario.discountRate/(1-Math.pow(1+scenario.discountRate,-scenario.lifeYears));
  out.annualizedCapitalCost=scenario.installedCost*capitalFactor;
  out.annualOwnershipCost=out.annualizedCapitalCost+scenario.maintenanceYear;
  for(const key of ENERGY_FIELDS)out[key]=0;
  out.runtime=Object.fromEntries(RUNTIME_COMPONENTS.map(([key])=>[key,{hours:0,equivalentHours:0,days:0}]));
  const runtimeDays=Object.fromEntries(RUNTIME_COMPONENTS.map(([key])=>[key,new Set()]));
  const months=new Map(),days=new Map(),episodes=[];
  let episode=0,previous=null;
  for(const h of hours) {
    const c=localClock(h.time,scenario.timezone);
    if(!months.has(c.month))months.set(c.month,{month:c.month,hours:0,validHours:0,eligibleHours:0,compliantHours:0,electricKWh:0,fuelKWh:0,cost:0,knownCost:0,priceMissingHours:0});
    const m=months.get(c.month);
    m.hours++;
    for(const part of h.dayContributions||civilSegments(h.time,scenario.timezone)){
      if(!days.has(part.date))days.set(part.date,{date:part.date,hours:0,validHours:0,eligibleHours:0,compliantHours:0,failureHours:0,
        solarDLI:0,lightDLI:0,dli:0,totalDLI:0,complete:false,deficit:null,firstTime:part.start,lastTime:part.start,contiguous:true});
      const d=days.get(part.date);
      if(part.start!==d.lastTime)d.contiguous=false;
      d.lastTime=part.end;d.hours+=part.hours;
      if(h.valid){d.validHours+=part.hours;d.solarDLI+=part.solarDLI??((h.solarDLI||0)*part.hours);d.lightDLI+=part.lightDLI??((h.lightDLI||0)*part.hours);}
      if(eligible(h)){const compliant=part.compliantHours??((h.compliantFraction||0)*part.hours);d.eligibleHours+=part.hours;d.compliantHours+=compliant;d.failureHours+=part.hours-compliant;}
    }
    if(h.valid&&h.controls)for(const [key,field] of RUNTIME_COMPONENTS){const duty=h.controls[field]||0;if(duty>1e-9){out.runtime[key].hours++;out.runtime[key].equivalentHours+=duty;runtimeDays[key].add(c.date);}}
    if(h.valid) {
      out.validHours++;m.validHours++;
      for(const key of ENERGY_FIELDS)out[key]+=Number.isFinite(h[key])?h[key]:0;
      const cost=hourCost(h,scenario);
      if(cost===null){out.priceMissingHours++;m.priceMissingHours++;}
      else {out.knownCost+=cost;m.knownCost+=cost;}
      m.electricKWh+=h.electricKWh||0;m.fuelKWh+=h.fuelKWh||0;
      out.peakCoolingKW=Math.max(out.peakCoolingKW,h.peakCoolingKW||h.coolingKWh||0);
      out.peakElectricKW=Math.max(out.peakElectricKW,h.peakElectricKW||h.electricKWh||0);
      out.maxEnergyResidualW=Math.max(out.maxEnergyResidualW,Math.abs(h.energyResidualW||0));
      out.maxMoistureResidualKgS=Math.max(out.maxMoistureResidualKgS,Math.abs(h.moistureResidualKgS||0));
    } else {out.missingHours++;if(h.numericalFailure)out.numericalFailureHours++;}
    if(h.warmup)out.warmupHours++;
    if(eligible(h)) {
      out.eligibleHours++;m.eligibleHours++;
      const compliant=h.compliantFraction||0;
      out.compliantHours+=compliant;m.compliantHours+=compliant;
      const dn=out.dayNight[(h.isDay??schedule(h.time,scenario).isDay)?'day':'night'];dn.hours++;dn.compliantHours+=compliant;
      out.modeCounts[h.mode]=(out.modeCounts[h.mode]||0)+1;
      out.tempDegreeHours+=h.tempDegreeHours||0;out.vpdKPaHours+=h.vpdKPaHours||0;
    }
    // Episodes are consecutive hourly bins containing any substep excursion.
    const fails=eligible(h)&&(h.compliantFraction??0)<1-1e-9;
    if(previous!==null&&h.time-previous!==3600000&&episode){episodes.push(episode);episode=0;}
    if(fails)episode++;else if(episode){episodes.push(episode);episode=0;}
    previous=h.time;
  }
  if(episode)episodes.push(episode);
  out.failureEpisodes=episodeSummary(episodes);out.longestFailureHours=out.failureEpisodes.maximumHours;
  out.compliancePct=out.eligibleHours?100*out.compliantHours/out.eligibleHours:null;
  out.monthly=[...months.values()];out.daily=[...days.values()];
  out.cost=out.priceMissingHours?null:out.knownCost;
  out.costCoverage=out.validHours?(out.validHours-out.priceMissingHours)/out.validHours:0;
  for(const m of out.monthly)m.cost=m.priceMissingHours?null:m.knownCost;
  for(const d of out.daily) {
    d.dli=d.totalDLI=d.solarDLI+d.lightDLI;
    const first=localClock(d.firstTime,scenario.timezone),end=localClock(d.lastTime,scenario.timezone);
    d.complete=d.contiguous&&Math.abs(d.validHours-d.hours)<1e-8&&first.hour===0&&end.hour===0&&end.date!==d.date;
    if(d.complete){d.deficit=Math.max(0,scenario.dliTarget-d.dli);if(d.deficit>1e-6)out.dliDeficitDays++;}
    else out.incompleteDays++;
  }
  out.failureExposureDays={atLeast1:out.daily.filter(d=>d.failureHours>=1-1e-9).length,
    atLeast4:out.daily.filter(d=>d.failureHours>=4-1e-9).length,atLeast8:out.daily.filter(d=>d.failureHours>=8-1e-9).length};
  for(const d of Object.values(out.dayNight))d.compliancePct=d.hours?100*d.compliantHours/d.hours:null;
  for(const [key] of RUNTIME_COMPONENTS)out.runtime[key].days=runtimeDays[key].size;
  return out;
}

export function compareScenarios(results) {
  if(!results.length)return [];
  let common=new Set(results[0].hours.filter(eligible).map(h=>h.time));
  for(const r of results.slice(1)){const times=new Set(r.hours.filter(eligible).map(h=>h.time));common=new Set([...common].filter(t=>times.has(t)));}
  const rows=results.map(r=>{
    let cost=0,compliantHours=0,electricKWh=0,fuelKWh=0,priceMissingHours=0;
    for(const h of r.hours)if(common.has(h.time)){const price=hourCost(h,r.scenario);if(price===null)priceMissingHours++;else cost+=price;
      compliantHours+=h.compliantFraction||0;electricKWh+=h.electricKWh||0;fuelKWh+=h.fuelKWh||0;}
    return {id:r.scenario.id,name:r.scenario.name,cost:common.size&&!priceMissingHours?cost:null,knownCost:cost,priceMissingHours,compliance:common.size?100*compliantHours/common.size:null,
      compliancePct:common.size?100*compliantHours/common.size:null,compliantHours,matchedHours:common.size,electricKWh,fuelKWh,
      installedCost:r.scenario.installedCost,numericalFailureHours:r.summary?.numericalFailureHours||0,
      comparable:common.size>0&&!priceMissingHours&&!(r.summary?.numericalFailureHours),costBasis:'Common eligible historical intervals, energy and water only; capex separate.'};
  });
  const base=rows[0];
  for(const row of rows){row.addedHours=row.compliantHours-base.compliantHours;row.addedCost=row.cost===null||base.cost===null?null:row.cost-base.cost;
    row.addedCapex=row.installedCost-base.installedCost;
    row.costPerAddedHour=row.comparable&&base.comparable&&row.addedHours>1e-9?row.addedCost/row.addedHours:null;
    row.dominated=row.comparable&&rows.some(other=>other!==row&&other.comparable&&other.cost<=row.cost&&other.compliantHours>=row.compliantHours&&
      (other.cost<row.cost-1e-9||other.compliantHours>row.compliantHours+1e-9));}
  return rows;
}

export function weatherSummary(hours,scenario) {
  const out={expectedHours:hours.length,validHours:0,missingHours:0,modeCounts:{},monthly:[],dayNight:{day:{hours:0,modeCounts:{}},night:{hours:0,modeCounts:{}}},
    modeExposureDays:{},episodes:{},padFailureCauses:{temperature:0,moisture:0},extremes:{minTempC:null,maxTempC:null,maxWetBulbC:null}};
  const months=new Map(),days=new Map(),episodeLists=new Map();let previous=null,lastMode=null,run=0;
  const close=()=>{if(run){if(!episodeLists.has(lastMode))episodeLists.set(lastMode,[]);episodeLists.get(lastMode).push(run);}run=0;lastMode=null;};
  for(const h of hours){
    const classification=h.weatherMode?{...h,valid:h.weatherMode!=='MISSING_DATA',mode:h.weatherMode,flags:h.weatherFlags||[]}:classifyWeather(h,scenario);
    const c=localClock(h.time,scenario.timezone);
    if(previous!==null&&h.time-previous!==3600000)close();previous=h.time;
    if(!classification.valid){out.missingHours++;close();continue;}
    out.validHours++;const mode=classification.mode;
    out.modeCounts[mode]=(out.modeCounts[mode]||0)+1;
    if(!months.has(c.month))months.set(c.month,{month:c.month,hours:0,modeCounts:{}});
    const m=months.get(c.month);m.hours++;m.modeCounts[mode]=(m.modeCounts[mode]||0)+1;
    const dn=out.dayNight[(classification.isDay??schedule(h.time,scenario).isDay)?'day':'night'];dn.hours++;dn.modeCounts[mode]=(dn.modeCounts[mode]||0)+1;
    if(!days.has(c.date))days.set(c.date,{});const day=days.get(c.date);day[mode]=(day[mode]||0)+1;
    if(lastMode!==mode){close();lastMode=mode;}run++;
    if(classification.flags.includes('PAD_TEMPERATURE_LIMIT'))out.padFailureCauses.temperature++;
    if(classification.flags.includes('PAD_MOISTURE_LIMIT'))out.padFailureCauses.moisture++;
    const t=h.outdoorTempC??h.tempC,wb=classification.wetBulbC;
    if(Number.isFinite(t)){out.extremes.minTempC=out.extremes.minTempC===null?t:Math.min(out.extremes.minTempC,t);out.extremes.maxTempC=out.extremes.maxTempC===null?t:Math.max(out.extremes.maxTempC,t);}
    if(Number.isFinite(wb))out.extremes.maxWetBulbC=out.extremes.maxWetBulbC===null?wb:Math.max(out.extremes.maxWetBulbC,wb);
  }
  close();out.monthly=[...months.values()];
  for(const mode of Object.keys(out.modeCounts)){
    const counts=[...days.values()].map(d=>d[mode]||0);
    out.modeExposureDays[mode]={atLeast1:counts.filter(n=>n>=1).length,atLeast4:counts.filter(n=>n>=4).length,atLeast8:counts.filter(n=>n>=8).length};
    out.episodes[mode]=episodeSummary(episodeLists.get(mode)||[]);
  }
  const exposure=mode=>out.modeExposureDays[mode]||{atLeast1:0,atLeast4:0,atLeast8:0};
  out.padViability={effectiveHours:out.modeCounts.PAD_EFFECTIVE||0,marginalHours:out.modeCounts.PAD_MARGINAL||0,ineffectiveHours:out.modeCounts.PAD_INEFFECTIVE_DEHU_NEEDED||0,
    effectiveDays:exposure('PAD_EFFECTIVE'),marginalDays:exposure('PAD_MARGINAL'),ineffectiveDays:exposure('PAD_INEFFECTIVE_DEHU_NEEDED'),
    coolingDemandHours:(out.modeCounts.PAD_EFFECTIVE||0)+(out.modeCounts.PAD_MARGINAL||0)+(out.modeCounts.PAD_INEFFECTIVE_DEHU_NEEDED||0),failureCauses:out.padFailureCauses};
  out.outdoorDrying=outdoorDrying(hours,scenario);
  return out;
}

// ---- v0.2 site-evaluator analysis: multi-year, multi-site, design hours, load decomposition, CO2 window ----
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const median=values=>{const s=values.filter(finite).sort((a,b)=>a-b);return s.length?quantile(s,.5):null;};
const pos=v=>finite(v)&&v>0?v:0;
const YEAR_METRICS=['compliancePct','compliantHours','cost','electricKWh','fuelKWh','padRuntimeHours','eligibleHours'];
export const FREE_COOLING_MODES=['PASSIVE_VENT_COOL_DRY','PAD_EFFECTIVE'];
export const CO2_WEATHER_MODES=['NEUTRAL_MIN_VENT','HEAT_MIN_VENT','ACTIVE_HUMIDIFICATION_LIKELY','PASSIVE_HUMIDIFY_OPPORTUNITY'];
export const SENSIBLE_GAIN_KEYS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','fanKWh','cropSensibleKWh'];
export const LOAD_KEYS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','ventilationSensibleKWh','fanKWh','cropSensibleKWh','cropLatentKWh','humidifierKWh','equipmentHeatKWh','dxSensibleKWh','condensationKWh','storedKWh'];
export const LATENT_KEYS=['crop','infiltration','ventilation','doas','humidifier','removed','condensed','stored'];
export const LATENT_KWH_PER_KG=LATENT_HEAT/3600000;
// Space loads the equipment must handle: positive gains only. Ventilation sensible is the control response, not a load;
// humidifier and DOAS moisture are equipment actions. Ventilation/infiltration moisture import counts when positive.
const sensibleGainKWh=l=>SENSIBLE_GAIN_KEYS.reduce((a,k)=>a+pos(l[k]),0);
const latentGainKg=l=>pos(l.latentKg?.crop)+pos(l.latentKg?.infiltration)+pos(l.latentKg?.ventilation);
const spaceSHR=(sensibleKWh,cropLatentKg)=>{const den=sensibleKWh+LATENT_KWH_PER_KG*cropLatentKg;return den>0?sensibleKWh/den:null;};

function yearRow(label,result){
  const s=result.summary||{},n=v=>finite(v)?v:null;
  return {label,compliancePct:n(s.compliancePct),compliantHours:n(s.compliantHours),cost:n(s.cost),electricKWh:n(s.electricKWh),fuelKWh:n(s.fuelKWh),
    padRuntimeHours:n(s.runtime?.pad?.hours),eligibleHours:n(s.eligibleHours),numericalFailureHours:s.numericalFailureHours||0};
}
function slope(points){
  const n=points.length;if(n<2)return null;
  const mx=points.reduce((a,[x])=>a+x,0)/n,my=points.reduce((a,[,y])=>a+y,0)/n;
  let sxx=0,sxy=0;for(const [x,y] of points){sxx+=(x-mx)**2;sxy+=(x-mx)*(y-my);}
  return sxx>0?sxy/sxx:null;
}
// runs: [{label, snapshot, results}] over weather years. Per scenario: per-year rows, median of each metric over years,
// worst/best year by joint attainment, spread (max minus min), least-squares trend only with 5 or more numeric-year labels.
export function aggregateYears(runs){
  const years=runs.map(r=>String(r.label)),byScenario={};
  for(const run of runs)for(const r of run.results||[]){
    const id=r.scenario.id;
    if(!byScenario[id])byScenario[id]={name:r.scenario.name,years:[]};
    byScenario[id].years.push(yearRow(String(run.label),r));
  }
  for(const entry of Object.values(byScenario)){
    const rows=entry.years,scored=rows.filter(r=>r.compliancePct!==null);
    entry.median=Object.fromEntries(YEAR_METRICS.map(k=>[k,median(rows.map(r=>r[k]))]));
    entry.worst=scored.length?scored.reduce((a,b)=>b.compliancePct<a.compliancePct?b:a):null;
    entry.best=scored.length?scored.reduce((a,b)=>b.compliancePct>a.compliancePct?b:a):null;
    const range=k=>{const v=rows.map(r=>r[k]).filter(finite);return v.length?Math.max(...v)-Math.min(...v):null;};
    entry.spread={compliancePct:range('compliancePct'),cost:range('cost')};
    const points=scored.filter(r=>/^\d{4}$/.test(r.label)).map(r=>[Number(r.label),r.compliancePct]);
    entry.trend={compliancePctPerYear:points.length>=5?slope(points):null,numericYears:points.length};
  }
  const byYear={};
  for(const run of runs){
    const rows=(run.results||[]).map(r=>({id:r.scenario.id,cost:finite(r.summary?.cost)?r.summary.cost:null}));
    rows.sort((a,b)=>(a.cost===null)-(b.cost===null)||(a.cost??0)-(b.cost??0));
    byYear[String(run.label)]=rows.map(r=>r.id);
  }
  const orders=new Set(Object.values(byYear).map(ids=>ids.join('|')));
  const stable=orders.size===1;
  const note=!years.length?'No years.':stable?`Operating-cost order of strategies is identical in all ${years.length} years.`:`Operating-cost order of strategies differs between years (${orders.size} distinct orders over ${years.length} years); the verdict is year-dependent.`;
  return {byScenario,ranking:{byYear,stable,note},years,basis:'Median over weather years of each metric; worst year is the lowest joint attainment; operating cost only, capital separate.'};
}

// Weather-side binding constraint from mode counts and pad failure causes, averaged over the given weather summaries.
export function bindingConstraint(weatherSummaries){
  const hours={moisture:0,temperature:0,heating:0};
  for(const ws of weatherSummaries){
    const m=ws.modeCounts||{},causes=ws.padViability?.failureCauses||ws.padFailureCauses||{};
    const total=(causes.moisture||0)+(causes.temperature||0),moistureShare=total?(causes.moisture||0)/total:.5,padFail=m.PAD_INEFFECTIVE_DEHU_NEEDED||0;
    hours.moisture+=padFail*moistureShare+(m.PASSIVE_VENT_COOL_HUMID||0)+(m.HEAT_VENT_HUMID||0);
    hours.temperature+=padFail*(1-moistureShare)+(m.PAD_MARGINAL||0);
    hours.heating+=(m.HEAT_MIN_VENT||0)+(m.HEAT_MAJOR_VENT_DRY||0);
  }
  const n=weatherSummaries.length||1;for(const k of Object.keys(hours))hours[k]/=n;
  const [binding]=Object.entries(hours).reduce((a,b)=>b[1]>a[1]?b:a,['none',0]);
  return {binding,hours,basis:'Weather-side screen at the target band: moisture = pad moisture-limited, cool-humid and heat-humid hours; temperature = pad temperature-limited and marginal hours; heating = heating hours without a moisture problem. Mean hours per year.'};
}
// Non-dominated strategies by median cost and median attainment; the verdict is the cheapest of them.
export function strategyFrontier(aggregate){
  const rows=Object.entries(aggregate.byScenario).map(([id,e])=>({id,name:e.name,compliancePct:e.median.compliancePct,cost:e.median.cost,worstYearCompliancePct:e.worst?.compliancePct??null}));
  const priced=rows.filter(r=>r.cost!==null&&r.compliancePct!==null);
  const frontier=priced.filter(r=>!priced.some(o=>o!==r&&o.cost<=r.cost&&o.compliancePct>=r.compliancePct&&(o.cost<r.cost-1e-9||o.compliancePct>r.compliancePct+1e-9))).sort((a,b)=>a.cost-b.cost);
  for(const r of rows)r.dominated=priced.includes(r)&&!frontier.includes(r);
  const best=frontier[0]||rows.filter(r=>r.compliancePct!==null).sort((a,b)=>b.compliancePct-a.compliancePct)[0]||null;
  return {rows,frontier,best:best?{id:best.id,name:best.name,compliancePct:best.compliancePct,cost:best.cost}:null};
}
// siteRuns: [{site:{zip,city,state,latitude,longitude,timezone}, runs}]. One row per site.
export function compareSites(siteRuns){
  return siteRuns.map(({site,runs})=>{
    const aggregate=aggregateYears(runs),weather=runs.map(run=>run.results?.[0]?.weatherSummary).filter(Boolean);
    const count=(ws,modes)=>modes.reduce((a,m)=>a+(ws.modeCounts?.[m]||0),0);
    const constraint=bindingConstraint(weather),frontier=strategyFrontier(aggregate),best=frontier.best;
    return {site,years:aggregate.years,freeCoolingHours:median(weather.map(ws=>count(ws,FREE_COOLING_MODES))),padEffectiveHours:median(weather.map(ws=>count(ws,['PAD_EFFECTIVE']))),
      bindingConstraint:constraint.binding,constraintHours:constraint.hours,bestStrategy:best,frontier:frontier.frontier,
      worstYearCompliancePct:best?aggregate.byScenario[best.id]?.worst?.compliancePct??null:null,rankingStable:aggregate.ranking.stable,aggregate,
      basis:'Free-cooling and pad hours are the weather-side screen at the first scenario\'s target band, median over years. Strategies rank by median operating cost over years; capital separate.'};
  });
}

function outdoorState(weatherHour,row){
  const o=weatherHour?weatherState(weatherHour):null;
  if(o)return {tempC:o.tempC,rh:o.rh,dewPointC:dewPoint(o.tempC,o.w,o.pressurePa),wetBulbC:wetBulb(o.tempC,o.w,o.pressurePa),humidityRatio:o.w};
  if(row&&finite(row.outdoorTempC))return {tempC:row.outdoorTempC,rh:finite(row.outdoorRH)?row.outdoorRH:null,dewPointC:null,wetBulbC:finite(row.wetBulbC)?row.wetBulbC:null,humidityRatio:null};
  return null;
}
const EXCEEDANCE_LEVELS=[['p99_6',.004],['p99',.01],['p98',.02]];
// Value exceeded in the given fraction of hours, reported with the coincident state of that same hour.
function exceedance(states,key){
  const sorted=states.filter(s=>finite(s[key])).sort((a,b)=>b[key]-a[key]),out={hours:sorted.length};
  for(const [name,f] of EXCEEDANCE_LEVELS){
    const s=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*f))];
    out[name]=s?{tempC:s.tempC,wetBulbC:s.wetBulbC,dewPointC:s.dewPointC,rh:s.rh,time:s.time}:null;
  }
  return out;
}
// Design conditions from the weather record plus the strategy's peak hours with coincident outdoor state.
export function designHours(weatherHours,resultHours,scenario){
  const byTime=new Map();for(const h of weatherHours||[])if(finite(h?.time))byTime.set(h.time,h);
  const states=[];for(const [time,h] of byTime){const s=outdoorState(h);if(s)states.push({...s,time});}
  const outdoor=row=>outdoorState(byTime.get(row.time),row);
  const out={dryBulb:exceedance(states,'tempC'),dewPoint:exceedance(states,'dewPointC'),wetBulb:exceedance(states,'wetBulbC'),
    jointFailure:{worstHour:null,p99Violation:null,failingHours:0,eligibleHours:0},peakLatentHour:null,peakSensibleHour:null,
    ventilationAirRequirement:{maxACH:null,m3s:null,atHour:null,outdoor:null},condensatePeakKgH:null,padWaterPeakLH:null,
    basis:'Exceedance conditions: 0.4, 1 and 2 percent of valid weather hours exceed the stated value; coincident values belong to that same hour, not independent percentiles. Joint failure ranks eligible hours by temperature degree-hours plus VPD kPa-hours outside the band. Peak loads are single result hours under the assumed strategy; sensible = positive solar, light, envelope, infiltration, fan and crop gains; latent = crop transpiration plus positive infiltration and ventilation moisture import.'};
  const misses=[];
  for(const h of resultHours||[]){
    if(!eligible(h))continue;
    out.jointFailure.eligibleHours++;
    const score=(h.tempDegreeHours||0)+(h.vpdKPaHours||0);
    if(score>1e-12||(finite(h.compliantFraction)&&h.compliantFraction<1-1e-9))out.jointFailure.failingHours++;
    misses.push({time:h.time,score,tempDegreeHours:h.tempDegreeHours||0,vpdKPaHours:h.vpdKPaHours||0,compliantFraction:finite(h.compliantFraction)?h.compliantFraction:null,row:h});
  }
  misses.sort((a,b)=>b.score-a.score||(a.compliantFraction??1)-(b.compliantFraction??1));
  const pick=m=>m&&m.score>1e-12?{time:m.time,tempDegreeHours:m.tempDegreeHours,vpdKPaHours:m.vpdKPaHours,compliantFraction:m.compliantFraction,outdoor:outdoor(m.row)}:null;
  out.jointFailure.worstHour=pick(misses[0]);
  out.jointFailure.p99Violation=pick(misses[Math.min(misses.length-1,Math.floor(misses.length*.01))]);
  let latent=null,sensible=null,vent=null,cond=null,pad=null;
  for(const h of resultHours||[]){
    if(!h.valid)continue;
    const l=h.loads;
    if(l){
      const kg=latentGainKg(l),kwh=sensibleGainKWh(l);
      if(latent===null||kg>latent.latentKg)latent={time:h.time,latentKg:kg,latentKgBySource:{...(l.latentKg||{})},sensibleKWh:kwh,row:h};
      if(sensible===null||kwh>sensible.sensibleKWh)sensible={time:h.time,sensibleKWh:kwh,latentKg:kg,shr:spaceSHR(kwh,pos(l.latentKg?.crop)),row:h};
    }
    const ach=h.controls?.ventACH;
    if(finite(ach)&&(vent===null||ach>vent.maxACH))vent={maxACH:ach,atHour:h.time,row:h};
    if(finite(h.condensateKg))cond=cond===null?h.condensateKg:Math.max(cond,h.condensateKg);
    if(finite(h.padWaterL))pad=pad===null?h.padWaterL:Math.max(pad,h.padWaterL);
  }
  const strip=({row,...rest})=>({...rest,outdoor:outdoor(row)});
  if(latent)out.peakLatentHour=strip(latent);
  if(sensible)out.peakSensibleHour=strip(sensible);
  if(vent){const v=strip(vent);out.ventilationAirRequirement={maxACH:v.maxACH,m3s:finite(scenario?.areaM2)&&finite(scenario?.heightM)?v.maxACH*scenario.areaM2*scenario.heightM/3600:null,atHour:v.atHour,outdoor:v.outdoor};}
  out.condensatePeakKgH=cond;out.padWaterPeakLH=pad;
  return out;
}

// Monthly and total sensible/latent balance terms from row.loads, with the space sensible-heat ratio and its hourly histogram.
export function loadDecomposition(result){
  const tz=result.scenario?.timezone;
  const blankRow=month=>({month,hours:0,...Object.fromEntries(LOAD_KEYS.map(k=>[k,0])),latentKg:Object.fromEntries(LATENT_KEYS.map(k=>[k,0])),sensibleGainKWh:0,cropLatentKg:0,shr:null});
  const months=new Map(),total=blankRow('total');
  const shrHistogram=Array.from({length:10},(_,i)=>({bin:`${(i/10).toFixed(1)} to ${((i+1)/10).toFixed(1)}`,lower:i/10,upper:(i+1)/10,hours:0}));
  let hours=0,noGainHours=0;
  for(const h of result.hours||[]){
    if(!h.valid||!h.loads)continue;
    const l=h.loads,c=localClock(h.time,tz);
    if(!months.has(c.month))months.set(c.month,blankRow(c.month));
    const gain=sensibleGainKWh(l),cropKg=pos(l.latentKg?.crop);
    for(const row of [months.get(c.month),total]){
      row.hours++;row.sensibleGainKWh+=gain;row.cropLatentKg+=cropKg;
      for(const k of LOAD_KEYS)row[k]+=finite(l[k])?l[k]:0;
      for(const k of LATENT_KEYS)row.latentKg[k]+=finite(l.latentKg?.[k])?l.latentKg[k]:0;
    }
    const s=finite(l.shr)?Math.min(1,Math.max(0,l.shr)):spaceSHR(gain,cropKg);
    if(s===null)noGainHours++;else shrHistogram[Math.min(9,Math.floor(s*10))].hours++;
    hours++;
  }
  const finish=row=>{row.shr=spaceSHR(row.sensibleGainKWh,row.cropLatentKg);return row;};
  return {monthly:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(finish),total:finish(total),shrHistogram,hours,noGainHours,latentKWhPerKg:LATENT_KWH_PER_KG,
    basis:'Signed balance terms per local month, positive = gain into zone air. Sensible-heat ratio = positive sensible gains / (positive sensible gains + latent heat of crop transpiration); null in hours without gains. Latent kg listed by source; ventilation and infiltration are negative when outside air is drier than the zone.'};
}

// CO2 enrichment window: hours where the strategy holds minimum ventilation with evaporative stages off, plus the weather-side counterpart.
export function co2Window(result){
  const tz=result.scenario?.timezone,months=new Map(),days=new Set();
  let equivalentHours=0,hoursAny=0,validHours=0,weatherSideHours=0;
  for(const h of result.hours||[]){
    if(CO2_WEATHER_MODES.includes(h.weatherMode))weatherSideHours++;
    if(!h.valid)continue;
    validHours++;
    const f=h.controls?.enrichmentFraction;
    if(!finite(f)||f<=1e-9)continue;
    const fr=Math.min(1,f),c=localClock(h.time,tz);
    equivalentHours+=fr;hoursAny++;days.add(c.date);months.set(c.month,(months.get(c.month)||0)+fr);
  }
  return {equivalentHours,hoursAny,days:days.size,validHours,weatherSideHours,byMonth:[...months].sort((a,b)=>a[0].localeCompare(b[0])).map(([month,equivalentHours])=>({month,equivalentHours})),
    note:'Strategy window: substeps at minimum ventilation with pad and indirect evaporative stages off, so injected CO2 is not flushed; duty-weighted equivalent hours. Weather-side hours: outdoor states with no primary ventilation demand at the target band. Neither models CO2 mass balance, injection rate or crop uptake.'};
}
