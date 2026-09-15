// Movable shade screens, thermal/energy curtains and air-source heat-pump heating.
//
// Evidence contract: docs/COMPONENT-PARAMETERS.md. Every shipped number here carries its source string.
// Anything that document marks UNSOURCED ships as `null`: the input exists, the component cannot act until
// the user supplies it, and the run says so. Nothing in this file is a product performance map.
//
// The load-bearing optical finding: Gilbert, Bertling and Savage [S1] measured near-neutral transmission
// across 300 to 1100 nm for their silver Aluminet and black net samples. A silver screen therefore gets no
// automatic near-infrared bonus here. PAR and total-shortwave multipliers are separate inputs that default
// to the same value (the declared shade fraction's complement) and may differ only when the user supplies
// product-specific spectral or paired PAR/pyranometer data.

const finite = v => typeof v === 'number' && Number.isFinite(v);
const fraction = (v, hi = 1) => finite(v) && v >= 0 && v <= hi;

// ---- shipped defaults -------------------------------------------------------------------------

// shadeFraction 0.5 is the Ecologic Technologies KSC-50 catalogue grade [S5], a nominal vendor grade, not a
// measured transmission. The two optical multipliers stay null: grade-specific PAR and total-shortwave
// transmissions are UNSOURCED, so a null resolves to the grade complement and is labeled a grade proxy.
// Deployment thresholds stay null: UMass [S8] tells growers to select them and prescribes no transferable
// numbers, so a shade screen with no declared trigger never closes and fails validation when installed.
export const SHADE_SCREEN_DEFAULT = Object.freeze({
  installed: false, shadeFraction: .5, parTransmission: null, solarTransmission: null,
  deployAboveWm2: null, deployAboveC: null, maxDeployDliDeficit: null
});

// uValueFactor stays null: the published evidence spans whole-system heating-cost savings of 30 to 50 percent
// [S8], vendor rating-method complements of 0.53 and 0.43 [S9, S10] and a measured net-longwave loss ratio of
// 0.54 to 0.57 for aluminized screens [S3]. Those have different denominators and must not be averaged into a
// default U multiplier, so the user declares one. closedExchangeACH is the effective outside-air exchange while
// the curtain is shut; screenGapExchangeACH_hInv is UNSOURCED, so null means no restriction is modeled at all.
export const THERMAL_SCREEN_DEFAULT = Object.freeze({
  installed: false, uValueFactor: null, parTransmission: null, solarTransmission: null,
  deployAboveC: null, nightDeploy: true, closedExchangeACH: null
});

// Insect screens restrict the outside-air path, which in a humid house removes its cheapest moisture sink.
// `ventilationFactor` multiplies the achievable maximum outside-air exchange. It is measured RELATIVE TO A
// 40-MESH SCREENED HOUSE, not to an unscreened one: Harmanto, Tantau and Salokhe measured three screened
// houses side by side in the Thai rainy season and there was no unscreened control, so the cost of adding a
// first screen to an open house is UNSOURCED and this model cannot supply it. A run that declares 1.0 is
// therefore claiming a 40-mesh house, not an unrestricted one.
export const INSECT_SCREEN_DEFAULT = Object.freeze({installed: false, grade: null, ventilationFactor: null});

// Measured ventilation rates, floor-normalized, from the same rainy-season campaign: 0.0719, 0.0461 and
// 0.0361 m3 m-2 s-1 with standard errors 0.0025, 0.0019 and 0.0022 [S24]. The factors below are those rates
// divided by the 40-mesh rate. Aperture, porosity and the authors' discharge coefficients are carried so a
// user can check that a product resembles the screen that was measured rather than matching a nominal mesh.
export const INSECT_SCREEN_GRADES = Object.freeze({
  mesh40: Object.freeze({label: 'Nominal 40 mesh (40 x 38, 0.44 x 0.39 mm, porosity 0.41)', ventilationFactor: 1,
    measuredM3M2S: .0719, standardError: .0025, dischargeCoefficient: .31}),
  mesh52: Object.freeze({label: 'Nominal 52 mesh (52 x 22, 0.80 x 0.25 mm, porosity 0.38)', ventilationFactor: .641,
    measuredM3M2S: .0461, standardError: .0019, dischargeCoefficient: .28}),
  mesh78: Object.freeze({label: 'Nominal 78 mesh (78 x 52, 0.29 x 0.18 mm, porosity 0.30)', ventilationFactor: .502,
    measuredM3M2S: .0361, standardError: .0022, dischargeCoefficient: .21})
});

export const INSECT_SCREEN_EVIDENCE = Object.freeze({
  measured: 'Ventilation factors are measured ratios from one instrumented rainy-season experiment at the Asian Institute of Technology, Pathum Thani, Thailand: three 10 x 20 m houses, 300 tomato plants each, fans off, ventilation inferred from an irrigation-minus-drainage water balance cross-checked against an energy balance [S24]. One house per treatment at one site, so this is a measured direction and magnitude, not a validated universal mesh penalty.',
  referenceIsScreened: 'The reference is the 40-mesh house, NOT an unscreened house. The same campaign measured no unscreened control, so the ventilation cost of the first screen is UNSOURCED. Declaring ventilationFactor 1.0 claims a house like the measured 40-mesh one.',
  notACH: 'The source reports floor-normalized volumetric flow, not air changes per hour, so the ratio is transferred and the absolute rates are not.',
  coupledEffects: 'The same measurement recorded finer mesh raising mean air temperature from 30.8 to 31.9 C and indoor-minus-outdoor absolute humidity from 1.05 to 2.21 g m-3. Only the ventilation restriction is modeled here; the temperature and moisture consequences follow from the run rather than being imposed.',
  optics: 'Mesh also changes light transmission [S24]. No optical effect is applied: screen-specific PAR transmission is UNSOURCED. Use the shade-screen fields for a declared optical loss.'
});

export const SCREEN_DEFAULTS = Object.freeze({shadeScreen: SHADE_SCREEN_DEFAULT, thermalScreen: THERMAL_SCREEN_DEFAULT,
  insectScreen: INSECT_SCREEN_DEFAULT});

// Heating source. Fuel keeps the existing combustion branch; 'heatpump' replaces it with electricity at an
// interpolated COP. No generic curve is shipped: COP by outdoor temperature, low-ambient derate, defrost
// penalty and compressor cutoff are all UNSOURCED [S23, section 4.2], so all five are required inputs.
export const HEAT_PUMP_DEFAULTS = Object.freeze({
  heatSource: 'fuel', heatPumpCopAt8C: null, heatPumpCopAtMinus8C: null, heatPumpCopAtMinus15C: null,
  heatPumpCutoffC: null, heatPumpCapacityDerate: null
});

// NEEP ccASHP v4.0 requires steady-state reporting at 47, 17 and 5 F, which are these Celsius values [S21, S4].
// The field names are rounded to whole degrees; interpolation uses the exact conversions here, so a user
// copies a NEEP or manufacturer table row by row without converting anything.
export const HEAT_PUMP_RATING_C = Object.freeze([8.33, -8.33, -15]);
export const HEAT_PUMP_RATING_FIELDS = Object.freeze(['heatPumpCopAt8C', 'heatPumpCopAtMinus8C', 'heatPumpCopAtMinus15C']);
export const HEAT_PUMP_RATING_LABELS = Object.freeze(['8.33 C (47 F)', '-8.33 C (17 F)', '-15 C (5 F)']);

// The only heat-pump performance numbers the evidence document establishes are eligibility floors, not a unit.
// A scenario built from this example still has to declare its own 47 F and 17 F COPs and its own cutoff.
export const HEAT_PUMP_ELIGIBILITY_EXAMPLE = Object.freeze({
  heatPumpCopAt8C: null, heatPumpCopAtMinus8C: null, heatPumpCopAtMinus15C: 1.75, heatPumpCapacityDerate: .7, heatPumpCutoffC: null,
  source: 'Eligibility bounds, not measured performance: NEEP ccASHP v4.0 requires maximum-capacity COP at -15 C of at least 1.75 [S21] and ENERGY STAR requires COP at least 1.75 there plus heating capacity at least 70 percent of the 8.33 C nominal [S22]. The 8.33 C and -8.33 C COPs and the compressor cutoff are UNSOURCED and must come from a matched-unit rating table.'
});

export const SCREEN_EVIDENCE = Object.freeze({
  neutralSpectrum: 'Gilbert, Bertling and Savage measured near-neutral transmission across 300 to 1100 nm for their silver Aluminet and black net samples [S1], so no silver-screen NIR bonus is modeled. PAR and total-shortwave multipliers are separate inputs that default to the same value.',
  gradeProxy: 'Nominal grade proxy: the optical multiplier is the declared shade fraction complement from a vendor catalogue grade [S5, S7], not a measured PAR or total-shortwave transmission. Grade-specific transmissions are UNSOURCED.',
  thresholds: 'Deployment thresholds are operator inputs. Universal outdoor-temperature, irradiance and time-before-sunset thresholds are UNSOURCED [S8].',
  uMultiplier: 'The closed-curtain envelope multiplier is a declared input. Published evidence spans whole-system heating savings of 30 to 50 percent [S8], vendor rating-method complements of 0.53 and 0.43 [S9, S10] and a measured net-longwave loss ratio of 0.54 to 0.57 for aluminized screens [S3]; those denominators differ and were not averaged into a default.',
  noGapDeclared: 'Optimistic moisture case: this closed thermal screen declares no effective outside-air exchange, so the run applies no restriction to the outside-air path while it is shut. A real closed curtain restricts crop-to-roof exchange and raises zone moisture; screenGapExchangeACH_hInv is UNSOURCED [S3, S8], and Svensson\'s 1 to 5 percent gap positions [S12] are opening positions, not an air-change rate.',
  gapDeclared: 'The closed curtain caps total outside-air exchange at the declared value, allocating effective infiltration first and the remaining capacity to controlled outdoor air. This is a user-declared coefficient, not a measured screen permeability. Recovery and DOAS treat that same capped controlled stream; neither adds an unrestricted airflow path.',
  opticalWhenShut: 'This thermal curtain declares no optical transmission, so a daytime closed hour passes light unchanged. Clear curtains are not optically invisible: LUXOUS 1147 FR is rated 11 to 15 percent shade and TEMPA 5557 D 55 to 59 percent by two named methods [S9, S10]. Supply the transmissions if the curtain closes in daylight.'
});

export const HEAT_PUMP_EVIDENCE = Object.freeze({
  userTable: 'Heat-pump COP is interpolated piecewise-linearly between the three user-supplied rating points at 8.33, -8.33 and -15 C, the NEEP ccASHP v4.0 reporting temperatures [S21, S4]. No generic curve is shipped: a defensible generic COP-versus-outdoor-temperature curve is UNSOURCED [S23].',
  excludesDefrost: 'Excludes-defrost upper bound: NEEP performance tables exclude defrost-cycling electricity and drain-pan-heater power [S21], and no universal defrost penalty was sourced, so none is applied.',
  copInterpolation: 'COP is interpolated directly because the scenario carries COP rating points. Section 4.3 prefers interpolating capacity and electrical input separately and deriving COP; with a single capacity derate these differ, and the difference is unquantified here.',
  aboveTable: 'Above 8.33 C the 8.33 C COP is held rather than extrapolated.',
  belowTable: 'Between -15 C and the declared compressor cutoff the -15 C COP is held: performance there is unknown without more rating points.',
  lockout: 'Below the declared compressor cutoff the heat pump delivers 0 kW by the lockout definition. No backup source is dispatched and no resistance heat is enabled, so the shortfall appears as unmet sensible load.',
  derate: 'Delivered capacity scales linearly from the full rating at 8.33 C to the declared derate at -15 C, held flat outside that interval. Capacity derate is capacityAtColdTemp / referenceCapacity from the same product and mode; it is not inferred from COP.'
});

// ---- normalization and back-fill -------------------------------------------------------------

// Clone the declared screen onto the shipped defaults. Unknown keys are dropped, so a scenario that carries
// only {installed:true, shadeFraction:.6} still gets every field, and no caller shares a default object.
export function backfillScreen(raw, defaults) {
  const out = {...defaults};
  if (raw && typeof raw === 'object') for (const key of Object.keys(defaults)) if (Object.hasOwn(raw, key)) out[key] = raw[key];
  return out;
}
export const backfillShadeScreen = raw => backfillScreen(raw, SHADE_SCREEN_DEFAULT);
export const backfillThermalScreen = raw => backfillScreen(raw, THERMAL_SCREEN_DEFAULT);

// Resolved run-time form: the two optical multipliers become numbers, everything else stays as declared.
// A null multiplier resolves to the declared shade fraction complement, equally for PAR and shortwave.
export function resolveShadeScreen(raw) {
  const s = backfillShadeScreen(raw);
  const complement = fraction(s.shadeFraction) ? 1 - s.shadeFraction : 1;
  const par = fraction(s.parTransmission) ? s.parTransmission : complement;
  const solar = fraction(s.solarTransmission) ? s.solarTransmission : complement;
  return {
    installed: s.installed === true, shadeFraction: s.shadeFraction,
    parMultiplier: par, solarMultiplier: solar,
    declaredPar: fraction(s.parTransmission) ? s.parTransmission : null,
    declaredSolar: fraction(s.solarTransmission) ? s.solarTransmission : null,
    deployAboveWm2: finite(s.deployAboveWm2) ? s.deployAboveWm2 : null,
    deployAboveC: finite(s.deployAboveC) ? s.deployAboveC : null,
    maxDeployDliDeficit: finite(s.maxDeployDliDeficit) ? s.maxDeployDliDeficit : null,
    opticalBasis: fraction(s.parTransmission) || fraction(s.solarTransmission) ? 'declared product data' : 'nominal grade complement'
  };
}
export function resolveThermalScreen(raw) {
  const s = backfillThermalScreen(raw);
  return {
    installed: s.installed === true,
    uValueFactor: fraction(s.uValueFactor) ? s.uValueFactor : 1,
    declaredUValueFactor: fraction(s.uValueFactor) ? s.uValueFactor : null,
    parMultiplier: fraction(s.parTransmission) ? s.parTransmission : 1,
    solarMultiplier: fraction(s.solarTransmission) ? s.solarTransmission : 1,
    declaredOptics: fraction(s.parTransmission) || fraction(s.solarTransmission),
    deployAboveC: finite(s.deployAboveC) ? s.deployAboveC : null,
    nightDeploy: s.nightDeploy !== false,
    closedExchangeACH: finite(s.closedExchangeACH) && s.closedExchangeACH >= 0 ? s.closedExchangeACH : null
  };
}
export const backfillInsectScreen = raw => backfillScreen(raw, INSECT_SCREEN_DEFAULT);

// A catalogued grade supplies the measured factor. An explicit ventilationFactor overrides it, so a user with
// a real product test is never forced onto one of three Thai screens. Neither present resolves to factor null,
// which validation rejects rather than letting an installed screen quietly cost nothing.
export function resolveInsectScreen(raw) {
  const s = backfillInsectScreen(raw);
  const grade = typeof s.grade === 'string' && Object.hasOwn(INSECT_SCREEN_GRADES, s.grade) ? INSECT_SCREEN_GRADES[s.grade] : null;
  const declared = finite(s.ventilationFactor) && s.ventilationFactor > 0 && s.ventilationFactor <= 1 ? s.ventilationFactor : null;
  const factor = declared ?? grade?.ventilationFactor ?? null;
  return {
    installed: s.installed === true,
    grade: grade ? s.grade : null, gradeLabel: grade ? grade.label : null,
    ventilationFactor: s.installed === true ? factor : 1,
    declaredFactor: declared, basis: declared ? 'declared product measurement' : grade ? 'measured Thai rainy-season ratio against a 40-mesh house' : null
  };
}

// ---- deployment -------------------------------------------------------------------------------

// Causal controller decision on the measured hour. The screen closes above the declared irradiance and/or
// above the declared outdoor dry bulb, and refuses to close while the crop is further behind its daily light
// target than maxDeployDliDeficit. The deficit comes from the accumulated-DLI state the model already carries
// forward through the local day; no future weather and no end-of-day hindsight enter the decision.
export function shadeDeployed(shade, irradianceWm2, outdoorTempC, dliDeficitMol) {
  if (!shade.installed) return false;
  if (shade.maxDeployDliDeficit !== null && dliDeficitMol > shade.maxDeployDliDeficit) return false;
  return (shade.deployAboveWm2 !== null && irradianceWm2 > shade.deployAboveWm2) ||
    (shade.deployAboveC !== null && outdoorTempC > shade.deployAboveC);
}

// Night and cold-hour curtain. For this screen the same deployAboveC threshold reads as a ceiling: the curtain
// closes below it. With nightDeploy set it closes only in dark hours; without a temperature threshold it closes
// every dark hour. A curtain with neither trigger never closes, which validation rejects at install time.
export function thermalDeployed(thermal, outdoorTempC, isDay) {
  if (!thermal.installed) return false;
  if (thermal.nightDeploy && isDay) return false;
  if (thermal.deployAboveC !== null) return outdoorTempC < thermal.deployAboveC;
  return thermal.nightDeploy;
}

// ---- heat pump ---------------------------------------------------------------------------------

// Piecewise-linear COP between the three declared rating points. Held flat above 8.33 C, held flat between
// -15 C and the declared cutoff, and null below the cutoff, where the compressor contributes nothing.
export function heatPumpCOP(s, outdoorTempC) {
  const cops = HEAT_PUMP_RATING_FIELDS.map(key => s?.[key]);
  if (!cops.every(c => finite(c) && c > 0)) return null;
  if (finite(s.heatPumpCutoffC) && outdoorTempC < s.heatPumpCutoffC) return null;
  const t = HEAT_PUMP_RATING_C;
  if (outdoorTempC >= t[0]) return cops[0];
  if (outdoorTempC <= t[2]) return cops[2];
  const i = outdoorTempC >= t[1] ? 0 : 1;
  return cops[i] + (outdoorTempC - t[i]) / (t[i + 1] - t[i]) * (cops[i + 1] - cops[i]);
}

// Delivered-capacity fraction of the 8.33 C rating. Linear to the declared derate at -15 C, flat outside it.
export function heatPumpCapacityFraction(s, outdoorTempC) {
  if (finite(s?.heatPumpCutoffC) && outdoorTempC < s.heatPumpCutoffC) return 0;
  const derate = s?.heatPumpCapacityDerate;
  if (!(finite(derate) && derate > 0 && derate <= 1)) return null;
  const [hi, , lo] = HEAT_PUMP_RATING_C;
  if (outdoorTempC >= hi) return 1;
  if (outdoorTempC <= lo) return derate;
  return 1 + (1 - derate) * (outdoorTempC - hi) / (hi - lo);
}

// One hour's heating source: delivered capacity in W and the COP that turns delivered heat into electricity.
// `cop` null means the fuel branch (heaterEfficiency applies) or a locked-out compressor with zero capacity.
export function heatSourceState(s, outdoorTempC) {
  const heaterW = finite(s?.heaterKW) ? Math.max(0, s.heaterKW) * 1000 : 0;
  if (s?.heatSource !== 'heatpump') return {mode: 'fuel', cop: null, capacityW: heaterW, capacityFraction: 1};
  const cop = heatPumpCOP(s, outdoorTempC), share = heatPumpCapacityFraction(s, outdoorTempC);
  if (cop === null || share === null || share <= 0) return {mode: 'lockout', cop: null, capacityW: 0, capacityFraction: 0};
  return {mode: 'heatpump', cop, capacityW: heaterW * share, capacityFraction: share};
}
export const heatPumpConfigured = s => s?.heatSource === 'heatpump' &&
  HEAT_PUMP_RATING_FIELDS.every(key => finite(s[key]) && s[key] > 0) &&
  finite(s.heatPumpCutoffC) && finite(s.heatPumpCapacityDerate);

// ---- validation ---------------------------------------------------------------------------------

function screenErrorsFor(raw, defaults, label, rules) {
  const errors = [], s = backfillScreen(raw, defaults);
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) return [`${label} must be an object.`];
  if (typeof s.installed !== 'boolean') errors.push(`${label}: installed must be true or false.`);
  for (const [key, hi] of rules.fractions) if (s[key] !== null && !fraction(s[key], hi)) errors.push(`${label}: ${key} must be a fraction from 0 to ${hi}, or null when unknown.`);
  for (const key of rules.numbers) if (s[key] !== null && !finite(s[key])) errors.push(`${label}: ${key} must be a number, or null when unknown.`);
  for (const key of rules.booleans) if (typeof s[key] !== 'boolean') errors.push(`${label}: ${key} must be true or false.`);
  if (s.installed === true) errors.push(...rules.installed(s, label));
  return errors;
}

export function shadeScreenErrors(raw) {
  return screenErrorsFor(raw, SHADE_SCREEN_DEFAULT, 'Shade screen', {
    fractions: [['shadeFraction', 1], ['parTransmission', 1], ['solarTransmission', 1]],
    numbers: ['deployAboveWm2', 'deployAboveC', 'maxDeployDliDeficit'], booleans: ['installed'],
    installed: s => {
      const errors = [];
      if (!fraction(s.shadeFraction)) errors.push('Shade screen: declare the nominal shade fraction of the installed cloth.');
      if (!finite(s.deployAboveWm2) && !finite(s.deployAboveC)) errors.push('Shade screen: declare an irradiance threshold in W/m2 and/or an outdoor temperature threshold. Universal thresholds are unsourced, so the screen has no default trigger.');
      if (finite(s.deployAboveWm2) && s.deployAboveWm2 < 0) errors.push('Shade screen: the irradiance threshold cannot be negative.');
      if (finite(s.maxDeployDliDeficit) && s.maxDeployDliDeficit < 0) errors.push('Shade screen: the light-deficit guard cannot be negative.');
      return errors;
    }
  });
}
export function insectScreenErrors(raw) {
  return screenErrorsFor(raw, INSECT_SCREEN_DEFAULT, 'Insect screen', {
    fractions: [['ventilationFactor', 1]], numbers: [], booleans: ['installed'],
    installed: s => {
      const errors = [];
      const known = typeof s.grade === 'string' && Object.hasOwn(INSECT_SCREEN_GRADES, s.grade);
      if (s.grade !== null && typeof s.grade !== 'string') errors.push('Insect screen: grade must be a catalogued key or null.');
      else if (typeof s.grade === 'string' && !known) errors.push(`Insect screen: unknown grade "${s.grade}". Catalogued: ${Object.keys(INSECT_SCREEN_GRADES).join(', ')}, or declare a ventilationFactor.`);
      if (!known && !(finite(s.ventilationFactor) && s.ventilationFactor > 0)) {
        errors.push('Insect screen: declare a ventilationFactor above 0, or pick a catalogued grade. An installed screen that costs no ventilation is not a defensible default, and the factor is relative to a 40-mesh screened house rather than to an unscreened one.');
      }
      return errors;
    }
  });
}
export function thermalScreenErrors(raw) {
  return screenErrorsFor(raw, THERMAL_SCREEN_DEFAULT, 'Thermal screen', {
    fractions: [['uValueFactor', 1], ['parTransmission', 1], ['solarTransmission', 1]],
    numbers: ['deployAboveC', 'closedExchangeACH'], booleans: ['installed', 'nightDeploy'],
    installed: s => {
      const errors = [];
      if (!fraction(s.uValueFactor) || s.uValueFactor <= 0) errors.push('Thermal screen: declare the closed-curtain envelope loss multiplier. The published savings evidence has several different denominators and was not averaged into a default.');
      if (s.nightDeploy !== true && !finite(s.deployAboveC)) errors.push('Thermal screen: a curtain that does not deploy at night needs an outdoor temperature threshold, otherwise it never closes.');
      if (finite(s.closedExchangeACH) && s.closedExchangeACH < 0) errors.push('Thermal screen: the closed-state outside-air exchange cannot be negative.');
      return errors;
    }
  });
}
export function heatSourceErrors(s) {
  const errors = [];
  if (s.heatSource !== 'fuel' && s.heatSource !== 'heatpump') return ['Heat source must be fuel or heatpump.'];
  const optional = [...HEAT_PUMP_RATING_FIELDS, 'heatPumpCutoffC', 'heatPumpCapacityDerate'];
  for (const key of optional) if (s[key] !== null && !finite(s[key])) errors.push(`${key} must be a number, or null when no rating point is available.`);
  if (s.heatSource !== 'heatpump') return errors;
  HEAT_PUMP_RATING_FIELDS.forEach((key, i) => {
    if (!(finite(s[key]) && s[key] > 0)) errors.push(`Heat-pump heating needs a measured COP at ${HEAT_PUMP_RATING_LABELS[i]} (${key}). No generic curve ships: supply the matched unit's rating table.`);
  });
  if (!finite(s.heatPumpCutoffC)) errors.push('Heat-pump heating needs a declared compressor cutoff temperature. The lowest catalogued rating temperature is not a lockout temperature.');
  else if (s.heatPumpCutoffC < -40 || s.heatPumpCutoffC > 20) errors.push('Heat-pump compressor cutoff must be between -40 and 20 C.');
  if (!(finite(s.heatPumpCapacityDerate) && s.heatPumpCapacityDerate > 0 && s.heatPumpCapacityDerate <= 1))
    errors.push('Heat-pump heating needs a capacity derate at -15 C as a fraction of the 8.33 C rating, above 0 and at most 1.');
  return errors;
}

// ---- run-time declarations -------------------------------------------------------------------

// Warnings a run must carry when these components act, and the matching exported assumption block.
export function componentWarnings(s, shade, thermal, heatMode) {
  const out = [];
  if (shade.installed) {
    out.push(`Movable shade screen: ${SCREEN_EVIDENCE.neutralSpectrum} ${shade.opticalBasis === 'declared product data' ? 'This run uses declared product transmissions.' : SCREEN_EVIDENCE.gradeProxy} ${SCREEN_EVIDENCE.thresholds}`);
    out.push('Shade deployment cuts sensible solar gain and crop photons in the same hour, so supplemental lighting energy can rise while cooling energy falls. An internal screen can also impede buoyant exhaust to roof vents [S8]; that ventilation consequence is not modeled.');
    if (shade.maxDeployDliDeficit === null) out.push('No light-deficit guard is set on the shade screen: it may close while the crop is behind its daily light target, and the lost photons are then bought back as fixture electricity where lighting capacity allows.');
  }
  if (thermal.installed) {
    out.push(`Thermal curtain: ${SCREEN_EVIDENCE.uMultiplier}`);
    out.push(thermal.closedExchangeACH === null ? SCREEN_EVIDENCE.noGapDeclared : SCREEN_EVIDENCE.gapDeclared);
    if (!thermal.declaredOptics) out.push(SCREEN_EVIDENCE.opticalWhenShut);
  }
  if (s.heatSource === 'heatpump') {
    out.push(`Air-source heat-pump heating. ${HEAT_PUMP_EVIDENCE.userTable} ${HEAT_PUMP_EVIDENCE.copInterpolation} ${HEAT_PUMP_EVIDENCE.derate}`);
    out.push(`${HEAT_PUMP_EVIDENCE.excludesDefrost} ${HEAT_PUMP_EVIDENCE.lockout}`);
    if (heatMode === 'incomplete') out.push('Heat-pump rating points are incomplete, so the heat pump delivers nothing in every hour and all heating demand is reported as unmet. Supply the three COP points, the cutoff and the capacity derate.');
  }
  return out;
}

export function componentAssumptions(s, shade, thermal) {
  return {
    shadeScreen: shade.installed ? {
      shadeFraction: shade.shadeFraction, parTransmission: shade.parMultiplier, solarTransmission: shade.solarMultiplier,
      opticalBasis: shade.opticalBasis, spectralPolicy: SCREEN_EVIDENCE.neutralSpectrum,
      deployAboveWm2: shade.deployAboveWm2, deployAboveC: shade.deployAboveC, maxDeployDliDeficit: shade.maxDeployDliDeficit,
      thresholdBasis: SCREEN_EVIDENCE.thresholds
    } : null,
    thermalScreen: thermal.installed ? {
      uValueFactor: thermal.declaredUValueFactor, uValueBasis: SCREEN_EVIDENCE.uMultiplier,
      parTransmission: thermal.declaredOptics ? thermal.parMultiplier : null,
      solarTransmission: thermal.declaredOptics ? thermal.solarMultiplier : null,
      closedExchangeACH: thermal.closedExchangeACH,
      moistureBasis: thermal.closedExchangeACH === null ? SCREEN_EVIDENCE.noGapDeclared : SCREEN_EVIDENCE.gapDeclared,
      deployAboveC: thermal.deployAboveC, nightDeploy: thermal.nightDeploy, thresholdBasis: SCREEN_EVIDENCE.thresholds
    } : null,
    heatSource: s.heatSource === 'heatpump' ? {
      type: 'Air-source heat pump (electric)',
      ratingPointsC: [...HEAT_PUMP_RATING_C], ratingPointLabels: [...HEAT_PUMP_RATING_LABELS],
      ratingPointBasis: 'The three points are the NEEP ccASHP v4.0 reporting temperatures 47, 17 and 5 F, converted with NIST SP 811 [S21, S4]. The field names round them to 8, -8 and -15 C; interpolation uses 8.33, -8.33 and -15 C.',
      ratingPointFields: [...HEAT_PUMP_RATING_FIELDS],
      copAtRatingPoints: HEAT_PUMP_RATING_FIELDS.map(key => s[key]),
      cutoffC: s.heatPumpCutoffC, capacityDerateAtMinus15C: s.heatPumpCapacityDerate,
      provenance: HEAT_PUMP_EVIDENCE.userTable, interpolation: HEAT_PUMP_EVIDENCE.copInterpolation,
      aboveTable: HEAT_PUMP_EVIDENCE.aboveTable, belowTable: HEAT_PUMP_EVIDENCE.belowTable,
      defrost: HEAT_PUMP_EVIDENCE.excludesDefrost, lockout: HEAT_PUMP_EVIDENCE.lockout, capacityDerate: HEAT_PUMP_EVIDENCE.derate,
      eligibilityExample: HEAT_PUMP_ELIGIBILITY_EXAMPLE
    } : {type: 'Fuel-fired heater', efficiency: s.heaterEfficiency, basis: 'Declared combustion efficiency on delivered heat.'}
  };
}
