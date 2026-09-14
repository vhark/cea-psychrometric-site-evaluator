import psychrolib from '../vendor/psychrolib.js';

export const CP_DRY_AIR = 1006;
export const LATENT_HEAT = 2450000; // Constant J/kg for the coarse zone energy convention.
export const saturationPressure = tempC => psychrolib.GetSatVapPres(tempC);
export const vaporPressure = (w, pressurePa) => pressurePa * w / (0.621945 + w);
export function humidityRatio(tempC, rh, pressurePa = 101325) {
  if (!Number.isFinite(rh) || rh < 0 || rh > 1) throw Error('RH must be a fraction in [0, 1].');
  const pv = rh * saturationPressure(tempC);
  if (pv >= pressurePa) throw Error('Vapor pressure exceeds total pressure.');
  return 0.621945 * pv / (pressurePa - pv);
}
export const saturationHumidityRatio = (t, p) => humidityRatio(t, 1, p);
export const relativeHumidity = (t, w, p) => vaporPressure(w, p) / saturationPressure(t);
export const enthalpy = (t, w) => psychrolib.GetMoistAirEnthalpy(t, w);
export const wetBulb = (t, w, p) => psychrolib.GetTWetBulbFromHumRatio(t, w, p);
export const dewPoint = (t, w, p) => w <= 0 ? -100 : psychrolib.GetTDewPointFromHumRatio(t, w, p);
export const airVPD = (t, w, p) => (saturationPressure(t) - vaporPressure(w, p)) / 1000;
export const dryAirDensity = (t, w, p) => p / (287.042 * (t + 273.15) * (1 + 1.607858 * w));
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function padState(tempC, w, pressurePa, effectiveness = 0.8) {
  const wetBulbC = wetBulb(tempC, w, pressurePa);
  const padTempC = tempC - clamp(effectiveness, 0, 1) * (tempC - wetBulbC);
  // Approximately isoenthalpic, neglecting liquid-water enthalpy. Saturation bounds
  // the process, not the zone's RH: any upstream impossible state is rejected.
  const padW = Math.min(saturationHumidityRatio(padTempC, pressurePa), Math.max(w,
    (enthalpy(tempC, w) - 1006 * padTempC) / (2501000 + 1860 * padTempC)));
  return {tempC:padTempC, w:padW, rh:relativeHumidity(padTempC,padW,pressurePa),
    dewPointC:dewPoint(padTempC,padW,pressurePa),wetBulbC,enthalpyResidualJkg:enthalpy(padTempC,padW)-enthalpy(tempC,w)};
}

export function weatherState(hour, requireSolar = false) {
  if (!hour || !Number.isFinite(hour.time) || !Number.isFinite(hour.tempC) || hour.tempC < -80 || hour.tempC > 65 ||
      !Number.isFinite(hour.pressurePa) || hour.pressurePa < 30000 || hour.pressurePa > 110000 ||
      (requireSolar && (!Number.isFinite(hour.ghiWm2) || hour.ghiWm2 < 0 || hour.ghiWm2 > 1600))) return null;
  let rh = hour.rh;
  if (!Number.isFinite(rh) && Number.isFinite(hour.dewPointC)) {
    if (hour.dewPointC > hour.tempC || hour.dewPointC < -100) return null;
    rh = saturationPressure(hour.dewPointC) / saturationPressure(hour.tempC);
  }
  if (!Number.isFinite(rh) || rh < 0 || rh > 1) return null;
  try {
    const w = humidityRatio(hour.tempC,rh,hour.pressurePa);
    return {tempC:hour.tempC,w,rh,pressurePa:hour.pressurePa};
  } catch { return null; }
}

export function localClock(time, timezone = 'UTC') {
  const parts = formatter(timezone).formatToParts(time);
  const get = key => parts.find(p => p.type === key).value;
  return {date:`${get('year')}-${get('month')}-${get('day')}`,month:`${get('year')}-${get('month')}`,
    hour:Number(get('hour')) % 24 + Number(get('minute')) / 60};
}
const formatters = new Map();
function formatter(timezone) {
  if (!formatters.has(timezone)) formatters.set(timezone,new Intl.DateTimeFormat('en-CA',{
    timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  return formatters.get(timezone);
}
export function schedule(time, scenario) {
  const clock = localClock(time,scenario.timezone);
  const elapsed = (clock.hour - scenario.dayStart + 24) % 24;
  const isDay = elapsed < scenario.photoperiod;
  const targetC = isDay ? scenario.dayTargetC : scenario.nightTargetC;
  // A dark hour carries the declared fraction of a lit hour's moisture rate.
  const weightedHours = scenario.photoperiod + (24 - scenario.photoperiod) * scenario.darkTranspirationFraction;
  return {...clock,isDay,targetC,minTempC:targetC-scenario.tempToleranceC,maxTempC:targetC+scenario.tempToleranceC,
    remainingLitHours:isDay ? scenario.photoperiod-elapsed : 0,
    cropKgS:scenario.canopyM2*scenario.transpirationLDayM2*(isDay?1:scenario.darkTranspirationFraction)/(weightedHours*3600)};
}
export function moistureBounds(tempC, pressurePa, scenario) {
  const ps = saturationPressure(tempC);
  const lowPV = Math.max(0,ps - scenario.vpdMax*1000);
  const highPV = Math.min(ps,ps - scenario.vpdMin*1000,saturationPressure(scenario.maxDewPointC));
  const ratio = pv => 0.621945*pv/(pressurePa-pv);
  return {minW:ratio(lowPV),maxW:highPV<0?-1:ratio(highPV),feasible:highPV >= lowPV && highPV < pressurePa};
}
// Stanghellini (1987) canopy transpiration in the form of Vanthoor et al. (2011) §8.9, as implemented in
// GreenLight (Katzin et al. 2020, crop submodel mvCanAir): mv = 2 ρ cp LAI / (L γ (rB + rS)) (satVp(Tcan) - vpAir),
// rB = 275 s/m, rS = 82 rfR rfVP rfCO2 with rfR = (R + 4.3)/(R + 0.54), rfVP = min(5.8, 1 + c (satVp(Tcan) - vpAir)²),
// c = 4.3e-6 (day) / 5.2e-6 (night) blended by the smooth switch 1/(1 + exp(-(R - 5))), and rfCO2 = 1 with no enrichment
// state. R is shortwave absorbed by the canopy, W/m² canopy. Canopy temperature is taken equal to zone air temperature
// (declared simplification; no leaf energy balance). Returns kg water per second per m² canopy.
export function stanghelliniTranspiration(tempC, w, pressurePa, absorbedWm2, lai) {
  if (!(lai > 0)) return 0;
  const vpdPa = Math.max(0, saturationPressure(tempC) - vaporPressure(w, pressurePa));
  const R = Math.max(0, absorbedWm2);
  const rfR = (R + 4.3) / (R + 0.54);
  const day = 1 / (1 + Math.exp(-(R - 5)));
  const c = 5.2e-6 + (4.3e-6 - 5.2e-6) * day;
  const rfVP = Math.min(5.8, 1 + c * vpdPa * vpdPa);
  const rS = 82 * rfR * rfVP;
  return 2 * dryAirDensity(tempC, w, pressurePa) * CP_DRY_AIR * lai / (LATENT_HEAT * 65.8 * (275 + rS)) * vpdPa;
}
// Shortwave absorbed per m² canopy from incoming solar and fixture power per m² canopy, Beer-Lambert with k = 0.7.
export const canopyAbsorbedWm2 = (incidentWm2, lai) => incidentWm2 * (1 - Math.exp(-0.7 * Math.max(0, lai)));
export function classifyWeather(hour, scenario) {
  const outside = weatherState(hour);
  if (!outside) return {mode:'MISSING_DATA',weatherMode:'MISSING_DATA',valid:false,reason:'Missing or invalid outdoor thermodynamic state.',flags:[]};
  const target = schedule(hour.time,scenario);
  const maxTempC=(target.isDay?scenario.dayMaxTempC:scenario.nightMaxTempC)??target.maxTempC;
  const heatingThreshold=(target.isDay?scenario.dayHeatingThresholdC:scenario.nightHeatingThresholdC)??scenario.heatingThresholdC??target.minTempC;
  const maxDewPointC=(target.isDay?scenario.dayMaxDewPointC:scenario.nightMaxDewPointC)??scenario.maxDewPointC;
  const minRH=target.isDay?scenario.minRHDay:scenario.minRHNight;
  const bounds=Number.isFinite(minRH)?{minW:humidityRatio(target.targetC,minRH,hour.pressurePa),maxW:saturationHumidityRatio(maxDewPointC,hour.pressurePa)}:
    moistureBounds(target.targetC,hour.pressurePa,{...scenario,maxDewPointC});
  const pad = padState(outside.tempC,outside.w,hour.pressurePa,scenario.padEffectiveness);
  const padMaxW=Number.isFinite(scenario.maxPadDewPointC)?saturationHumidityRatio(scenario.maxPadDewPointC,hour.pressurePa):bounds.maxW;
  const margin = scenario.padMarginC ?? 2.8;
  const dryingMargin=bounds.maxW-outside.w;
  const drying = dryingMargin >= (scenario.dryingMarginKgKg??.0005);
  const strongDrying=dryingMargin >= (scenario.strongDryingMarginKgKg??.002);
  const dryEnough = outside.w < bounds.minW;
  const cooling = outside.tempC <= target.targetC - (scenario.ventMarginC ?? 1);
  const outsideEnthalpy=enthalpy(outside.tempC,outside.w),targetEnthalpy=enthalpy(target.targetC,bounds.maxW);
  const flags = [];
  if (!scenario.padEnabled) flags.push('PAD_NOT_INSTALLED');
  if (outside.w>bounds.maxW) flags.push('OUTDOOR_MOISTURE_IMPORT');
  if(drying)flags.push('OUTDOOR_DRYING_OPPORTUNITY');
  if(strongDrying)flags.push('STRONG_OUTDOOR_DRYING');
  if(dryEnough)flags.push('OUTDOOR_BELOW_MINIMUM_MOISTURE');
  if(outside.w>bounds.minW&&(outside.w<=bounds.maxW))flags.push('OUTDOOR_HUMIDIFY_OPPORTUNITY');
  if (outsideEnthalpy >= targetEnthalpy) flags.push('OUTDOOR_ENTHALPY_HIGH');
  if (pad.tempC > maxTempC-margin) flags.push('PAD_TEMPERATURE_LIMIT');
  if (pad.w > padMaxW) flags.push('PAD_MOISTURE_LIMIT');
  let mode, reason;
  if (outside.tempC < heatingThreshold) {
    if (strongDrying && scenario.purgeRequested) {mode='HEAT_MAJOR_VENT_DRY';reason='Cold outside air offers strong drying during an explicitly requested purge; heating is required.';}
    else if (!drying && (scenario.humidityControlRequired ?? true)) {mode='HEAT_VENT_HUMID';reason='Heating weather with insufficient outdoor moisture relief at the selected target.';}
    else {mode='HEAT_MIN_VENT';reason='Heating weather; minimum ventilation does not establish crop drying demand.';}
  } else if (outside.tempC >= (scenario.coolingTriggerC ?? maxTempC)) {
    if (pad.tempC <= maxTempC-margin && pad.w <= padMaxW) {mode='PAD_EFFECTIVE';reason='Pad leaving air clears the selected temperature margin and moisture ceiling.';}
    else if (pad.tempC <= maxTempC && pad.w <= padMaxW) {mode='PAD_MARGINAL';reason='Pad leaving air clears the target ceiling but not the cooling margin.';}
    else {mode='PAD_INEFFECTIVE_DEHU_NEEDED';reason='Pad leaving air fails temperature or moisture limits; this is a weather-side capability screen, not a dehumidifier load.';}
  } else if (cooling&&drying&&outsideEnthalpy<targetEnthalpy) {
    mode='PASSIVE_VENT_COOL_DRY';reason='Outside air can provide sensible cooling and moisture relief; powered fans still consume energy.';
  } else if(cooling&&outside.w>bounds.maxW) {
    mode='PASSIVE_VENT_COOL_HUMID';reason='Outside air offers temperature relief but imports excessive moisture; inspect the enthalpy conflict flag.';
  } else if (dryEnough&&scenario.humidificationRequired) {
    mode='ACTIVE_HUMIDIFICATION_LIKELY';reason='Outside air is drier than the selected minimum; water addition is required if this moisture target must be held.';
  } else if(scenario.humidificationRequired&&outside.w>=bounds.minW+(scenario.humidifyingMarginKgKg??.0003)&&outside.w<=bounds.maxW) {
    mode='PASSIVE_HUMIDIFY_OPPORTUNITY';reason='Outside air can add moisture relative to the selected lower bound without exceeding the upper bound.';
  } else {mode='NEUTRAL_MIN_VENT';reason='No primary weather-side heating, cooling or requested humidification opportunity.';}
  return {mode,weatherMode:mode,valid:true,reason,flags,isDay:target.isDay,humidityRatio:outside.w,
    targetC:target.targetC,maxTempC,heatingThresholdC:heatingThreshold,maxDewPointC,minHumidityRatio:bounds.minW,maxHumidityRatio:bounds.maxW,
    dryingMarginKgKg:dryingMargin,enthalpyJkg:outsideEnthalpy,targetEnthalpyJkg:targetEnthalpy,enthalpyDifferenceJkg:outsideEnthalpy-targetEnthalpy,
    wetBulbC:pad.wetBulbC,padTempC:pad.tempC,padDewPointC:pad.dewPointC,padHumidityRatio:pad.w,padRH:pad.rh};
}

// Outdoor air as the dehumidifier for one hour: removal potential at maximum ventilation and the fan plus
// ventilation-air heating energy per kg of water, at scenario prices. Weather-side screen, not a dispatch.
export function outdoorDryingHour(hour, scenario, classification = classifyWeather(hour, scenario)) {
  const outside = weatherState(hour);
  if (!outside || !classification.valid || classification.dryingMarginKgKg < (scenario.dryingMarginKgKg ?? .0005)) return null;
  const m3s = scenario.areaM2 * scenario.heightM * scenario.maxVentACH / 3600;
  const flow = m3s * dryAirDensity(outside.tempC, outside.w, outside.pressurePa);
  const potentialKgH = flow * classification.dryingMarginKgKg * 3600;
  const heatW = outside.tempC < classification.heatingThresholdC ? flow * CP_DRY_AIR * (classification.targetC - outside.tempC) : 0;
  const fanW = scenario.fanWPerM3s * m3s;
  const energyKWh = fanW / 1000 + heatW / 1000 / scenario.heaterEfficiency;
  const cost = fanW / 1000 * scenario.electricityPrice + heatW / 1000 / scenario.heaterEfficiency * scenario.fuelPrice;
  return {potentialKgH, energyKWh, cost, bucket: heatW > 0 ? 'coldDry' : outside.tempC > classification.maxTempC ? 'hotDry' : 'coolDry'};
}
