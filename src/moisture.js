import psychrolib from '../vendor/psychrolib.js';

export const MOISTURE_VERSION = 'phase-aware-1';
const REFERENCES = new Set(['water', 'ice', 'unknown']);
/** Pa over a declared phase. ASHRAE/PsychroLib in its stable-phase domain;
 * Murphy & Koop (2005), equation 10, for supercooled liquid water. No enhancement factor. */
export function saturationVaporPressure(tempC, reference) {
  if (!Number.isFinite(tempC) || tempC < -100 || tempC > 200) throw new Error('Temperature is outside the saturation-pressure domain.');
  if (reference === 'ice') {
    if (tempC > .01) throw new Error('Ice reference is outside its supported domain above the triple point.');
    return psychrolib.GetSatVapPres(tempC);
  }
  if (reference !== 'water') throw new Error('Declare water or ice as the saturation reference.');
  if (tempC >= .01) return psychrolib.GetSatVapPres(tempC);
  const t = tempC + 273.15;
  return Math.exp(54.842763 - 6763.22 / t - 4.210 * Math.log(t) + .000367 * t
    + Math.tanh(.0415 * (t - 218.8)) * (53.878 - 1331.22 / t - 9.44523 * Math.log(t) + .014025 * t));
}

export function resolveMoisture({tempC, pressurePa, rh, dewPointC, authoritative = 'rh', rhReference = 'unknown', dewPointReference = 'unknown'} = {}) {
  const basis = {authoritative, rhReference, dewPointReference, conversionVersion: MOISTURE_VERSION};
  const warnings = [];
  const fail = reason => ({valid:false, vaporPressurePa:null, humidityRatio:null, basis, warnings:[...warnings, reason]});
  if (!Number.isFinite(tempC) || tempC < -100 || tempC > 200 || !Number.isFinite(pressurePa) || pressurePa <= 0) return fail('Finite dry bulb and positive station pressure are required.');
  if (!REFERENCES.has(rhReference) || !REFERENCES.has(dewPointReference)) return fail('Unknown humidity reference declaration.');
  if (!['rh','dewPointC'].includes(authoritative)) return fail('Declare RH or dew point as authoritative.');
  const phase = (reference, temperature) => {
    if (reference !== 'unknown') return reference;
    if (temperature < .01) throw new Error('Subfreezing humidity reference is unknown; declare water or ice before deriving moisture.');
    return 'water';
  };
  try {
    let pv;
    if (authoritative === 'rh') {
      if (!Number.isFinite(rh) || rh < 0 || rh > 1) return fail('Authoritative RH is missing or outside [0, 1].');
      pv = rh === 0 ? 0 : rh * saturationVaporPressure(tempC, phase(rhReference,tempC));
      if (Number.isFinite(dewPointC)) {
        try {
          const auxiliary = saturationVaporPressure(dewPointC,phase(dewPointReference,dewPointC));
          if (dewPointC > tempC + .5 || Math.abs(auxiliary-pv) > .15*saturationVaporPressure(tempC,phase(rhReference,tempC))) warnings.push('Auxiliary dew/frost point disagrees with authoritative RH; RH retained.');
        } catch { warnings.push('Auxiliary dew/frost-point convention is unresolved; authoritative RH retained.'); }
      }
    } else {
      if (!Number.isFinite(dewPointC) || dewPointC > tempC) return fail('Authoritative dew/frost point is missing or exceeds dry bulb.');
      pv = saturationVaporPressure(dewPointC,phase(dewPointReference,dewPointC));
    }
    if (!Number.isFinite(pv) || pv < 0 || pv >= pressurePa) return fail('Vapor pressure must be below station pressure.');
    return {valid:true,vaporPressurePa:pv,humidityRatio:.621945*pv/(pressurePa-pv),basis,warnings};
  } catch (error) {return fail(error.message);}
}

/** Old unannotated inputs retain the former solver convention, explicitly marked
 * as a legacy assumption. New adapters/imports must attach their own declaration. */
export function hourMoisture(hour) {
  const declared = hour.moisture;
  const authority = declared?.authoritative ?? (Number.isFinite(hour.rh) ? 'rh' : 'dewPointC');
  const basis = declared || {authoritative:authority,
    rhReference:hour.tempC < .01 ? 'ice' : 'water',
    dewPointReference:hour.dewPointC < .01 ? 'ice' : 'water'};
  const result = resolveMoisture({...hour,...basis});
  if (!declared) result.warnings.push('Legacy input: the historical PsychroLib phase convention is assumed, not confirmed provider provenance.');
  return result;
}

/** Canonical display RH; supersaturation or an unsupported auxiliary phase stays unavailable. */
export function displayRH(tempC, vaporPressurePa, reference) {
  try {
    const phase = reference === 'unknown' && tempC >= .01 ? 'water' : reference;
    const rh = vaporPressurePa / saturationVaporPressure(tempC,phase);
    return Number.isFinite(rh) && rh >= 0 && rh <= 1 ? rh : null;
  } catch { return null; }
}
/** Stable-phase saturation inverse without the wet-bulb library's dry-bulb clamp. */
export function equilibriumTemperature(vaporPressurePa) {
 if(!Number.isFinite(vaporPressurePa)||vaporPressurePa<=0)return null;
 const ps=t=>saturationVaporPressure(t,t<.01?'ice':'water');
 if(vaporPressurePa<ps(-100)||vaporPressurePa>ps(200))return null;
 let low=-100,high=200;
 for(let i=0;i<64;i++){const mid=(low+high)/2;if(ps(mid)>vaporPressurePa)high=mid;else low=mid;}
 return (low+high)/2;
}
