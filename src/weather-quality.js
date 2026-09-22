import {weatherState} from './physics.js';
import {hourMoisture} from './moisture.js';
/** Counts describe separate populations, never impute measurements from finite derived values. */
export function weatherQuality(snapshot,{requiresSolar=true}={}){
 const out={expectedHours:snapshot.hours.length,rawMeteorologyHours:0,solarHours:0,derivedHours:0,derivedVariables:{},unsupportedStateHours:0,unresolvedMoistureHours:0,legacyMoistureHours:0,weatherEligibleHours:0,simulationEligibleHours:0};
 for(const h of snapshot.hours){
  if(Number.isFinite(h.tempC)&&Number.isFinite(h.pressurePa)&&(Number.isFinite(h.rh)||Number.isFinite(h.dewPointC)))out.rawMeteorologyHours++;
  if(Number.isFinite(h.ghiWm2))out.solarHours++;
  const derived=Object.entries({...snapshot.variables,...h.variableQuality}).filter(([,v])=>v.evidence==='derived'||v.derivation).map(([key])=>key);
  for(const flag of h.quality||[]){if(/rh-derived/.test(flag))derived.push('rh');if(/pressure.*reduced|pressure.*derived/.test(flag))derived.push('pressurePa');}
  for(const key of new Set(derived))out.derivedVariables[key]=(out.derivedVariables[key]||0)+1;
  if(derived.length)out.derivedHours++;
  if(!h.moisture&&(Number.isFinite(h.rh)||Number.isFinite(h.dewPointC)))out.legacyMoistureHours++;
  if(Number.isFinite(h.tempC)&&!hourMoisture(h).valid)out.unresolvedMoistureHours++;
  if(weatherState(h))out.weatherEligibleHours++;else out.unsupportedStateHours++;
  if(weatherState(h,requiresSolar))out.simulationEligibleHours++;
 }
 return out;
}
