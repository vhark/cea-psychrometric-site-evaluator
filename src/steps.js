import {equilibriumTemperature} from './moisture.js';
/* The arithmetic behind one weather hour, written out step by step with the hour's own numbers.
   Every value here is recomputed from the same functions the screen uses (src/physics.js), never
   copied from a result, so what a reader checks by hand is exactly what the classifier decided on.
   Used by the hourly inspector, the Learn tab's worked examples and scripts/worked-example.mjs. */
import {saturationPressure, humidityRatio, saturationHumidityRatio, vaporPressure, enthalpy, wetBulb, dewPoint, airVPD,
  dryAirDensity, padState, weatherState, localClock, schedule, moistureBounds, classifyWeather, outdoorDryingHour,
  CP_DRY_AIR} from './physics.js';

const n = (value, digits = 2) => Number.isFinite(value) ? Number(value).toFixed(digits) : 'not available';
const yes = ok => ok ? 'yes' : 'no';

/** Ordered steps from a raw weather hour to the weather-side mode. Returns [] for an hour the screen rejects. */
export function weatherSteps(hour, scenario, source = {}) {
  const steps = [];
  const add = (title, formula, working, result, fn) => steps.push({n: steps.length + 1, title, formula, working, result, fn: `${fn} in src/physics.js`});
  const rhPct = Number.isFinite(hour?.rh) ? hour.rh * 100 : null;
  add('Read the hour and check it is usable',
    'valid if -80 <= T <= 65 C, 30 <= P <= 110 kPa, 0 <= RH <= 100%',
    `T = ${n(hour?.tempC)} C, RH = ${n(rhPct, 1)}%, P = ${n(hour?.pressurePa, 0)} Pa, solar = ${n(hour?.ghiWm2, 0)} W/m2, ` +
    `dew point as reported = ${n(hour?.dewPointC)} C, stamped ${hour?.time ? new Date(hour.time).toISOString() : 'no time'}` +
    (Number.isFinite(source?.sourceElevationM) ? `; source elevation ${n(source.sourceElevationM, 0)} m, so P is the pressure there, not necessarily at the site` : ''),
    weatherState(hour) ? 'usable' : 'rejected: the hour stays missing, nothing is filled in', 'weatherState');
  const outside = weatherState(hour);
  if (!outside) return steps;
  const {tempC: T, rh, pressurePa: P, w} = outside;
  const ps = saturationPressure(T), pv = outside.vaporPressurePa;
  add('Saturation and actual vapour pressure',
    'p_v follows the declared humidity reference; w and all later steps use that same vapor pressure',
    `stable-phase p_sat(${n(T)} C) = ${n(ps, 1)} Pa; interpretation ${JSON.stringify(outside.moistureBasis)}; ${outside.warnings.join(' ')}; p_v = ${n(pv, 1)} Pa`,
    `${n(pv, 1)} Pa of the ${n(P, 0)} Pa total is water vapour`, 'saturationPressure');
  add('Humidity ratio, the mass of water per kg of dry air',
    'w = 0.621945 * p_v / (P - p_v)',
    `w = 0.621945 * ${n(pv, 1)} / (${n(P, 0)} - ${n(pv, 1)})`,
    `${n(w, 5)} kg/kg, or ${n(w * 1000, 2)} g of water per kg of dry air`, 'humidityRatio');
  const twb = wetBulb(T, w, P), tdp = equilibriumTemperature(pv), h = enthalpy(T, w), vpd = airVPD(T, w, P);
  const equilibriumLabel = tdp < .01 ? 'frost point (ice equilibrium)' : 'dew point (water equilibrium)';
  add('Equilibrium temperature, wet bulb, enthalpy and VPD from T, w and P',
    'stable-phase equilibrium: T where p_sat(T) = p_v; wet bulb: PsychroLib iteration; h = 1006 T + w (2501000 + 1860 T); VPD = (p_sat(T) - p_v) / 1000',
    `${equilibriumLabel} ${n(tdp)} C; reported dew/frost point ${n(hour.dewPointC)} C uses its own declared reference; ` +
    `wet bulb ${n(twb)} C; h = 1006 * ${n(T)} + ${n(w, 5)} * (2501000 + 1860 * ${n(T)}) = ${n(h / 1000, 2)} kJ/kg; ` +
    `VPD = (${n(ps, 1)} - ${n(pv, 1)}) / 1000`,
    `${equilibriumLabel} ${n(tdp)} C, wet bulb ${n(twb)} C, enthalpy ${n(h / 1000, 2)} kJ/kg, air VPD ${n(vpd, 3)} kPa`, 'wetBulb, dewPoint, enthalpy, airVPD');
  const clock = localClock(hour.time, scenario.timezone), sch = schedule(hour.time, scenario);
  add('Which local hour this is, and what the crop wants then',
    'local clock in the site zone; day if (hour - dayStart) mod 24 < photoperiod; target = day or night target; band = target +/- tolerance',
    `${clock.date} ${n(clock.hour, 0)}:00 ${scenario.timezone}; (${n(clock.hour, 0)} - ${scenario.dayStart} + 24) mod 24 = ` +
    `${n((clock.hour - scenario.dayStart + 24) % 24, 0)} < ${scenario.photoperiod}? ${yes(sch.isDay)}`,
    `${sch.isDay ? 'day' : 'night'}: target ${n(sch.targetC, 1)} C, band ${n(sch.minTempC, 1)} to ${n(sch.maxTempC, 1)} C`, 'localClock, schedule');
  const cls = classifyWeather(hour, scenario);
  const pst = saturationPressure(sch.targetC), lowPV = Math.max(0, pst - scenario.vpdMax * 1000);
  const highPV = Math.min(pst, pst - scenario.vpdMin * 1000, saturationPressure(cls.maxDewPointC));
  const bounds = moistureBounds(sch.targetC, P, {...scenario, maxDewPointC: cls.maxDewPointC});
  add('The moisture band at the target temperature',
    'p_low = p_sat(target) - vpdMax * 1000; p_high = min(p_sat(target) - vpdMin * 1000, p_sat(maxDewPoint)); w = 0.621945 p / (P - p)',
    `p_sat(${n(sch.targetC, 1)} C) = ${n(pst, 1)} Pa; p_low = ${n(pst, 1)} - ${n(scenario.vpdMax * 1000, 0)} = ${n(lowPV, 1)} Pa; ` +
    `p_high = min(${n(pst - scenario.vpdMin * 1000, 1)}, p_sat(${n(cls.maxDewPointC, 1)} C) = ${n(saturationPressure(cls.maxDewPointC), 1)}) = ${n(highPV, 1)} Pa`,
    `w must sit between ${n(bounds.minW, 5)} and ${n(bounds.maxW, 5)} kg/kg (ceiling dew point ${n(dewPoint(sch.targetC, bounds.maxW, P))} C)`, 'moistureBounds');
  const pad = padState(T, w, P, scenario.padEffectiveness);
  add('What an evaporative pad would deliver',
    'T_pad = T - effectiveness * (T - T_wetbulb); w_pad from constant enthalpy, capped at saturation',
    `T_pad = ${n(T)} - ${n(scenario.padEffectiveness)} * (${n(T)} - ${n(twb)}) = ${n(T)} - ${n(scenario.padEffectiveness)} * ${n(T - twb)}`,
    `${n(pad.tempC)} C at ${n(pad.rh * 100, 1)}% RH, w ${n(pad.w, 5)} kg/kg, dew point ${n(pad.dewPointC)} C; ` +
    `enthalpy change ${n(Math.abs(pad.enthalpyResidualJkg) < .05 ? 0 : pad.enthalpyResidualJkg, 1)} J/kg (zero means the step conserved energy)`, 'padState');
  const margin = scenario.padMarginC ?? 2.8, ventMargin = scenario.ventMarginC ?? 1, dryingMargin = scenario.dryingMarginKgKg ?? .0005;
  const padMaxW = Number.isFinite(scenario.maxPadDewPointC) ? saturationHumidityRatio(scenario.maxPadDewPointC, P) : bounds.maxW;
  add('The tests the mode is decided on',
    'drying: w_ceiling - w >= dryingMargin; cooling: T <= target - ventMargin; hot: T >= ceiling; pad ok: T_pad <= ceiling - padMargin and w_pad <= pad ceiling',
    `drying margin ${n(bounds.maxW, 5)} - ${n(w, 5)} = ${n(cls.dryingMarginKgKg, 5)} >= ${n(dryingMargin, 4)}? ${yes(cls.dryingMarginKgKg >= dryingMargin)}; ` +
    `cooling ${n(T)} <= ${n(sch.targetC, 1)} - ${n(ventMargin, 1)}? ${yes(T <= sch.targetC - ventMargin)}; ` +
    `hot ${n(T)} >= ${n(cls.maxTempC, 1)}? ${yes(T >= cls.maxTempC)}; heating ${n(T)} < ${n(cls.heatingThresholdC, 1)}? ${yes(T < cls.heatingThresholdC)}; ` +
    `pad ${n(pad.tempC)} <= ${n(cls.maxTempC - margin, 1)}? ${yes(pad.tempC <= cls.maxTempC - margin)} and ${n(pad.w, 5)} <= ${n(padMaxW, 5)}? ${yes(pad.w <= padMaxW)}; ` +
    `outdoor enthalpy ${n(cls.enthalpyJkg / 1000, 2)} vs ceiling-state enthalpy ${n(cls.targetEnthalpyJkg / 1000, 2)} kJ/kg`,
    `flags: ${cls.flags.length ? cls.flags.join(', ') : 'none'}`, 'classifyWeather');
  add('The weather-side mode', 'first matching branch: heating, then hot (pad tests), then cool-and-dry, cool-and-humid, humidify, else neutral',
    cls.reason, cls.mode, 'classifyWeather');
  const drying = outdoorDryingHour(hour, scenario, cls);
  const m3s = scenario.areaM2 * scenario.heightM * scenario.maxVentACH / 3600, rho = dryAirDensity(T, w, P);
  add('Outside air as a dehumidifier at full ventilation',
    'flow = area * height * maxACH / 3600 * rho; removal = flow * (w_ceiling - w) * 3600; heat = flow * 1006 * (target - T) when T is below the heating threshold',
    drying ? `flow = ${n(scenario.areaM2, 0)} * ${n(scenario.heightM, 1)} * ${n(scenario.maxVentACH, 1)} / 3600 = ${n(m3s, 3)} m3/s * ${n(rho, 3)} kg/m3 = ${n(m3s * rho, 3)} kg/s; ` +
      `removal = ${n(m3s * rho, 3)} * ${n(cls.dryingMarginKgKg, 5)} * 3600; fan = ${n(scenario.fanWPerM3s, 0)} W per m3/s * ${n(m3s, 3)}` +
      (T < cls.heatingThresholdC ? `; heat = ${n(m3s * rho, 3)} * ${CP_DRY_AIR} * (${n(cls.targetC, 1)} - ${n(T)})` : '; no tempering needed')
      : `outside air is not drier than the ceiling by ${n(dryingMargin, 4)} kg/kg, so there is nothing to remove`,
    drying ? `${n(drying.potentialKgH, 2)} kg/h removable for ${n(drying.energyKWh, 3)} kWh, ${n(drying.cost, 4)} USD, bucket ${drying.bucket}` : 'not an outdoor drying hour', 'outdoorDryingHour');
  return steps;
}

/** How one simulated hour scores against the joint band, from the fields the engine keeps on the result hour. */
export function attainmentSteps(resultHour) {
  if (!resultHour) return [];
  const f = resultHour.compliantFraction;
  const share = Number.isFinite(f) ? f : null;
  return [{n: 1, title: 'This hour’s share of the joint band',
    formula: 'compliantFraction = substeps inside temperature, VPD and dew-point bounds / substeps sampled; an hour counts that fraction, not 0 or 1',
    working: `zone ${n(resultHour.tempC)} C, RH ${n(Number.isFinite(resultHour.rh) ? resultHour.rh * 100 : null, 1)}%, VPD ${n(resultHour.vpd, 3)} kPa; ` +
      `temperature outside band: ${n(resultHour.tempDegreeHours, 3)} degree-hours; VPD outside band: ${n(resultHour.vpdKPaHours, 3)} kPa-hours`,
    result: resultHour.warmup ? 'warm-up hour, excluded from attainment' : !resultHour.valid ? 'missing hour, excluded' : share === null ? 'not scored' : `${n(share * 100, 1)}% of the hour in band, so it adds ${n(share, 3)} h to compliantHours`,
    fn: 'the coupled run in src/simulate.js, scored by summarizeHours in src/metrics.js'}];
}
