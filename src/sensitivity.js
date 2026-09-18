// Morris elementary-effects screening (roadmap M3). Screening ranks which assumptions move the answer;
// it is not an uncertainty quantification. No probability distributions, no confidence intervals, no
// posterior over outcomes: only an ordering of influence plus an interaction/non-linearity indicator (sigma).
// Pure module: no DOM, no fetch, no timers. Deterministic for a given seed.
import {FIELDS} from './config.js';

// Field limits are the hard editable range of the interface; a screened sample may never leave them.
// solarHeatFraction is validated in validateScenario rather than declared in FIELDS.
const LIMITS=(()=>{const m={solarHeatFraction:{min:0,max:1}};
 for(const group of FIELDS)for(const field of group.fields)m[field.key]={min:field.min,max:field.max};
 return m;})();
export function fieldLimits(key){return LIMITS[key]?{...LIMITS[key]}:null;}
export function clampToField(key,value){
 const limit=LIMITS[key];
 if(!Number.isFinite(value))return value;
 return limit?Math.min(limit.max,Math.max(limit.min,value)):value;
}

// Twelve screened parameters. 'factor' multiplies the scenario's own value (so a 500 m² pad house and an
// indoor room are perturbed proportionally); 'absolute' replaces it (the quantity has a physical range that
// does not scale with the design). Ranges are defensible engineering spans, not fitted distributions.
export const MORRIS_PARAMETERS=[
 {key:'uValue',label:'Envelope U-value',unit:'W/m²K',low:.7,high:1.4,kind:'factor',
  rationale:'Nominal glazing U-values are quoted for clean, still, new assemblies. Aged, dirty, wind-exposed envelopes with unaccounted thermal bridges run higher; a tight double layer runs lower. Roughly 3 to 6 W/m²K around the 4 W/m²K default.'},
 {key:'infiltrationACH',label:'Air leakage',unit:'ACH',low:.5,high:2,kind:'factor',
  rationale:'Screening span of 0.5 to 2 times the scenario infiltration input, not a published universal range. UGA construction-specific guidance is contextual; measured site leakage should replace the generic assumption.'},
 {key:'lai',label:'Crop transpiration scale (LAI and the L/m²/day fallback)',unit:'×',low:.7,high:1.3,kind:'factor',alsoScales:['transpirationLDayM2'],
  rationale:'Leaf area index moves through the crop cycle, between cultivars and with plant density; Stanghellini transpiration scales with it. The declared L/m²/day schedule is scaled by the same factor so scheduled scenarios respond identically.'},
 {key:'padEffectiveness',label:'Pad saturation effectiveness',unit:'fraction',low:.70,high:.90,kind:'absolute',
  rationale:'Cellulose pad manufacturer data: about 0.70 for 100 mm media at high face velocity to about 0.90 for 200 mm media at low face velocity. Fouling and uneven wetting sit at the low end.'},
 {key:'coolingSHR',label:'DX sensible heat ratio',unit:'fraction',low:.65,high:.85,kind:'absolute',
  rationale:'Coil sensible heat ratio at CEA entering conditions depends on coil rows, airflow and entering wet bulb. 0.65 to 0.85 covers ordinary equipment without an equipment map (roadmap M4).'},
 {key:'coolingCOP',label:'Cooling COP',unit:'W/W',low:.8,high:1.25,kind:'factor',
  rationale:'A single constant COP stands in for condensing temperature, part-load degradation and fan power. Seasonal performance around a nominal 3 commonly lands within minus 20 to plus 25 percent.'},
 {key:'solarTransmission',label:'Thermal solar transmission',unit:'fraction',low:.85,high:1.15,kind:'factor',
  rationale:'Glazing transmission falls with age, dust and condensation and varies with structure shading and incidence angle; a nominal value is a clean-new figure.'},
 {key:'shadeFraction',label:'Shade fraction',unit:'fraction',low:.1,high:.4,kind:'absolute',
  rationale:'Operational shading ranges from light screening to heavy summer whitewash or a deployed screen. It is a management decision, not a fixed property, so it is screened as an absolute range.'},
 {key:'solarHeatFraction',label:'Absorbed share of transmitted solar',unit:'fraction',low:.8,high:1.0,kind:'absolute',
  rationale:'Not all transmitted shortwave becomes zone sensible heat in the same hour: part is reflected back out, part is absorbed by floor and structure and released later or conducted away. 0.8 to 1.0 brackets the single-zone assumption.'},
 {key:'dehuLPerKWh',label:'Dehumidifier efficiency',unit:'L/kWh',low:.8,high:1.25,kind:'factor',
  rationale:'Rated L/kWh is measured at a test point (typically warm and humid). Field performance at CEA dew points and part load differs, and integral fan and control power is often excluded from the rating.'},
 {key:'maxVentACH',label:'Installed maximum ventilation',unit:'ACH',low:.6,high:1.4,kind:'factor',
  rationale:'Fan tables are free-delivery ratings; achievable airflow depends on pad and louver pressure drop, wind and inlet area. Natural vent capacity depends on wind and stack, which this screen does not resolve (roadmap M4).'},
 {key:'thermalMassKJm2K',label:'Effective thermal mass',unit:'kJ/m²K',low:.5,high:2,kind:'factor',
  rationale:'The capacitance actually coupled to zone air on hourly timescales (floor surface layer, benches, growing medium, structure) is never measured for a screen; half to twice a nominal 100 kJ/m²K is the honest span.'}
];

const EPS=1e-9;
// 32-bit FNV-1a over the seed's string form, so both numeric and named seeds are usable and stable.
function hashSeed(seed){
 const text=String(seed??'');let h=2166136261>>>0;
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
 return h>>>0;
}
// mulberry32: small, fast, fully deterministic. Screening needs reproducibility, not cryptographic quality.
function mulberry32(state){
 let a=state>>>0;
 return function(){
  a=(a+0x6D2B79F5)>>>0;
  let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}
function shuffled(items,random){
 const out=items.slice();
 for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
function sampleValue(parameter,unit){
 const value=parameter.low+unit*(parameter.high-parameter.low);
 // Factors are multipliers; they meet the field limit only after they are applied to a scenario.
 return parameter.kind==='absolute'?clampToField(parameter.key,value):value;
}

/**
 * Standard Morris trajectory design. Each trajectory starts at a random point of the level grid and then
 * moves one parameter at a time by the fixed step delta = p / (2(p-1)) in unit space. With an even number
 * of levels exactly one direction of that step stays inside [0,1], so the walk never needs rejection.
 * Points per trajectory: k+1. Total model evaluations: trajectories x (k+1).
 */
export function morrisDesign({parameters=MORRIS_PARAMETERS,trajectories=8,levels=4,seed=1}={}){
 if(!Array.isArray(parameters)||!parameters.length)throw new Error('Morris screening needs at least one parameter.');
 if(!Number.isInteger(trajectories)||trajectories<1)throw new Error('Morris trajectories must be a positive integer.');
 if(!Number.isInteger(levels)||levels<2||levels%2!==0)throw new Error('Morris levels must be an even integer of at least two so the one-at-a-time step stays on the grid.');
 for(const p of parameters){
  if(!p||typeof p.key!=='string'||!p.key)throw new Error('Every screened parameter needs a key.');
  if(!Number.isFinite(p.low)||!Number.isFinite(p.high)||!(p.high>p.low))throw new Error(`Parameter ${p.key} needs a finite low < high range.`);
  if(p.kind!=='absolute'&&p.kind!=='factor')throw new Error(`Parameter ${p.key} needs kind 'absolute' or 'factor'.`);
 }
 const keys=parameters.map(p=>p.key);
 if(new Set(keys).size!==keys.length)throw new Error('Screened parameter keys must be unique.');
 const delta=levels/(2*(levels-1)),random=mulberry32(hashSeed(seed)),points=[];
 const emit=(trajectory,step,changedKey,unit)=>{
  const values={};for(const p of parameters)values[p.key]=sampleValue(p,unit[p.key]);
  points.push({id:`t${trajectory}s${step}`,trajectory,step,changedKey,values,unit:{...unit}});
 };
 for(let t=0;t<trajectories;t++){
  let unit={};
  for(const key of keys)unit[key]=Math.floor(random()*levels)/(levels-1);
  const order=shuffled(keys,random);
  emit(t,0,null,unit);
  for(let step=1;step<=order.length;step++){
   const key=order[step-1],current=unit[key];
   const move=current+delta<=1+EPS?delta:-delta;
   unit={...unit,[key]:current+move};
   emit(t,step,key,unit);
  }
 }
 return {points,parameters,levels,trajectories,seed,delta,
  basis:'Morris one-at-a-time trajectories in unit parameter space; elementary effects are per unit-range step (delta), so parameters with different physical units are comparable.'};
}

/**
 * Elementary effects from observed metrics. observations: [{id, metrics:{name:number}}].
 * Effect of the parameter changed at step j = (y_j - y_{j-1}) / (unit step), i.e. the metric change the
 * parameter would produce over its whole screened range. Pairs where either metric is missing or
 * non-finite are skipped and reported through n.
 * Returns {parameterKey: {metric: {mu, muStar, sigma, n}}}; mu* is the mean absolute effect and sigma the
 * sample standard deviation of the effects (a large sigma means interaction or non-linearity, not noise).
 */
export function elementaryEffects(design,observations){
 const metricsById=new Map();
 for(const o of observations||[])if(o&&o.id!=null&&o.metrics&&typeof o.metrics==='object')metricsById.set(String(o.id),o.metrics);
 const byTrajectory=new Map();
 for(const point of design?.points||[]){
  if(!byTrajectory.has(point.trajectory))byTrajectory.set(point.trajectory,new Map());
  byTrajectory.get(point.trajectory).set(point.step,point);
 }
 const collected=new Map();// key -> metric -> effects[]
 for(const steps of byTrajectory.values())for(const point of steps.values()){
  if(!point.changedKey||point.step<1)continue;
  const base=steps.get(point.step-1);if(!base)continue;
  const du=point.unit?.[point.changedKey]-base.unit?.[point.changedKey];
  if(!Number.isFinite(du)||Math.abs(du)<EPS)continue;
  const after=metricsById.get(String(point.id)),before=metricsById.get(String(base.id));
  if(!after||!before)continue;
  for(const metric of Object.keys(after)){
   const a=after[metric],b=before[metric];
   if(!Number.isFinite(a)||!Number.isFinite(b))continue;
   if(!collected.has(point.changedKey))collected.set(point.changedKey,new Map());
   const perMetric=collected.get(point.changedKey);
   if(!perMetric.has(metric))perMetric.set(metric,[]);
   perMetric.get(metric).push((a-b)/du);
  }
 }
 const effects={};
 for(const parameter of design?.parameters||[]){
  const perMetric=collected.get(parameter.key),out={};
  if(perMetric)for(const [metric,list] of perMetric){
   const n=list.length,mu=list.reduce((s,v)=>s+v,0)/n,muStar=list.reduce((s,v)=>s+Math.abs(v),0)/n;
   const variance=n>1?list.reduce((s,v)=>s+(v-mu)**2,0)/(n-1):0;
   out[metric]={mu,muStar,sigma:Math.sqrt(variance),n};
  }
  effects[parameter.key]=out;
 }
 return effects;
}

/** Parameters ordered by descending mu* for one metric. Parameters without an observed effect are dropped. */
export function rankByMuStar(effects,metric){
 return Object.entries(effects||{})
  .filter(([,byMetric])=>byMetric&&byMetric[metric])
  .map(([key,byMetric])=>({key,...byMetric[metric]}))
  .sort((a,b)=>b.muStar-a.muStar||a.key.localeCompare(b.key));
}

/**
 * Ranking stability across screened points. runsByPoint: [{id, ranking:[scenarioId,...]}].
 * stable only when a single order holds in at least 90% of the points that produced a ranking.
 */
export function rankingStability(runsByPoint){
 const counts=new Map();let total=0;
 for(const entry of runsByPoint||[]){
  const ranking=entry?.ranking;
  if(!Array.isArray(ranking)||!ranking.length)continue;
  const key=ranking.join('|');
  counts.set(key,(counts.get(key)||0)+1);
  total++;
 }
 if(!total)return {distinctOrders:0,mostCommon:null,share:null,stable:false,points:0,
  note:'No point produced a ranking; stability is unknown, not stable.'};
 let bestKey=null,bestCount=0;
 for(const [key,count] of counts)if(count>bestCount||(count===bestCount&&bestKey!==null&&key<bestKey)){bestKey=key;bestCount=count;}
 const share=bestCount/total,stable=share>=.9;
 return {distinctOrders:counts.size,mostCommon:bestKey.split('|'),share,stable,points:total,
  note:stable
   ?`One strategy order holds in ${bestCount} of ${total} screened points (${(share*100).toFixed(1)}%); ranking stable under the screened ranges.`
   :`${counts.size} distinct strategy orders over ${total} screened points; the most common holds ${(share*100).toFixed(1)}%, below the 90% threshold. Ranking unstable under the screened ranges.`};
}

/**
 * Apply one design point to a scenario. Pure: returns a new object, never mutates the input.
 * Factors multiply the scenario's own value (a zero stays zero: an opaque indoor room has no solar to scale);
 * absolutes replace it. Every result is clamped to the field limits, so a screened point is always a
 * scenario the interface would accept.
 */
export function applyPoint(scenario,point,parameters=MORRIS_PARAMETERS){
 const out={...scenario},byKey=new Map(parameters.map(p=>[p.key,p]));
 for(const [key,value] of Object.entries(point?.values||{})){
  const parameter=byKey.get(key);
  if(!parameter||!Number.isFinite(value))continue;
  if(parameter.kind==='absolute'){out[key]=clampToField(key,value);continue;}
  for(const target of [key,...(parameter.alsoScales||[])]){
   const base=out[target];
   if(Number.isFinite(base))out[target]=clampToField(target,base*value);
  }
 }
 // A screened ventilation factor must not invert the installed airflow range; the scenario would be invalid.
 if(Number.isFinite(out.maxVentACH)&&Number.isFinite(out.minVentACH)&&out.maxVentACH<out.minVentACH)out.maxVentACH=out.minVentACH;
 return out;
}
