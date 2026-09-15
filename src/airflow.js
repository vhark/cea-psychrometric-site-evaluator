import {
  CP_DRY_AIR,
  LATENT_HEAT,
  clamp,
  dryAirDensity,
  enthalpy,
  relativeHumidity,
  saturatedStateAtEnthalpy,
  saturationHumidityRatio,
} from './physics.js';

const CFM_PER_M3S = 2118.880003;
const FT2_PER_M2 = 10.7639104;
const WATER_VAPOR_CP = 1860;
const WATER_VAPOR_REFERENCE_ENTHALPY = 2501000;
const SENSIBLE_FIELDS = [
  'sensibleHeating75',
  'sensibleHeating100',
  'sensibleCooling75',
  'sensibleCooling100',
];
const LATENT_FIELDS = [
  'latentHeating75',
  'latentHeating100',
  'latentCooling75',
  'latentCooling100',
];

export const HEAT_RECOVERY_DEFAULT = Object.freeze({
  type:'none',
  nominalM3s:null,
  auxiliaryW:null,
  sensibleHeating75:null,
  sensibleHeating100:null,
  sensibleCooling75:null,
  sensibleCooling100:null,
  latentHeating75:null,
  latentHeating100:null,
  latentCooling75:null,
  latentCooling100:null,
  economizerBypass:true,
  frostControl:'none',
  minimumOutdoorOperatingC:null,
  frostThresholdC:null,
  initialDefrostFraction:null,
  defrostRatePerK:null,
});

export function backfillHeatRecovery(value) {
  return {...HEAT_RECOVERY_DEFAULT, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {})};
}

export function heatRecoveryErrors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Heat recovery must be an object.'];
  const recovery = backfillHeatRecovery(value);
  if (!['none', 'hrv', 'erv'].includes(recovery.type)) return ['heatRecovery.type must be none, hrv, or erv.'];
  if (recovery.type === 'none') return [];
  const errors = [];
  if (!Number.isFinite(recovery.nominalM3s) || recovery.nominalM3s <= 0) errors.push('nominalM3s must be greater than 0 m3/s.');
  if (!Number.isFinite(recovery.auxiliaryW) || recovery.auxiliaryW < 0) errors.push('auxiliaryW must be at least 0 W.');
  for (const field of SENSIBLE_FIELDS) {
    if (!Number.isFinite(recovery[field]) || recovery[field] < 0 || recovery[field] > 1) {
      errors.push(`${field} must be a fraction from 0 to 1.`);
    }
  }
  if (recovery.type === 'erv') {
    for (const field of LATENT_FIELDS) {
      if (!Number.isFinite(recovery[field]) || recovery[field] < 0 || recovery[field] > 1) {
        errors.push(`${field} must be a fraction from 0 to 1.`);
      }
    }
  }
  if (recovery.economizerBypass !== true) errors.push('economizerBypass must be true.');
  if (!['none', 'exhaustOnly', 'preheat'].includes(recovery.frostControl)) {
    errors.push('frostControl must be none, exhaustOnly, or preheat.');
  } else if (recovery.frostControl === 'none') {
    if (!Number.isFinite(recovery.minimumOutdoorOperatingC)) {
      errors.push('minimumOutdoorOperatingC is required when frostControl is none.');
    }
  } else {
    if (!Number.isFinite(recovery.frostThresholdC)) errors.push('frostThresholdC is required for frost control.');
    if (recovery.frostControl === 'exhaustOnly') {
      if (!Number.isFinite(recovery.initialDefrostFraction) || recovery.initialDefrostFraction < 0 || recovery.initialDefrostFraction > 1) {
        errors.push('initialDefrostFraction must be a fraction from 0 to 1.');
      }
      if (!Number.isFinite(recovery.defrostRatePerK) || recovery.defrostRatePerK < 0) {
        errors.push('defrostRatePerK must be at least 0 per K.');
      }
    }
  }
  return errors;
}

function finite(name, value) {
  if (!Number.isFinite(value)) throw Error(`${name} must be finite.`);
  return value;
}

function nonnegative(name, value) {
  finite(name, value);
  if (value < 0) throw Error(`${name} must be at least 0.`);
  return value;
}

function positive(name, value) {
  finite(name, value);
  if (value <= 0) throw Error(`${name} must be greater than 0.`);
  return value;
}

function validState(name, value, pressurePa = value?.pressurePa) {
  if (!value || typeof value !== 'object') throw Error(`${name} state is required.`);
  const tempC = finite(`${name} temperature`, value.tempC);
  if (tempC <= -273.15) throw Error(`${name} temperature must be above absolute zero.`);
  const w = nonnegative(`${name} humidity ratio`, value.w);
  positive(`${name} pressure`, pressurePa);
  if (relativeHumidity(tempC, w, pressurePa) > 1 + 1e-9) throw Error(`${name} state must not be supersaturated.`);
  return {tempC, w};
}

function temperatureAtEnthalpy(enthalpyJkg, w) {
  return (enthalpyJkg - WATER_VAPOR_REFERENCE_ENTHALPY * w) / (CP_DRY_AIR + WATER_VAPOR_CP * w);
}

function saturatedIfNeeded(candidate, pressurePa) {
  if (relativeHumidity(candidate.tempC, candidate.w, pressurePa) <= 1) return candidate;
  return saturatedStateAtEnthalpy(enthalpy(candidate.tempC, candidate.w), pressurePa);
}

function mixStates(core, coreMassFlowKgS, bypass, bypassMassFlowKgS, pressurePa) {
  const totalMassFlowKgS = coreMassFlowKgS + bypassMassFlowKgS;
  if (totalMassFlowKgS === 0) return {...bypass};
  const w = (core.w * coreMassFlowKgS + bypass.w * bypassMassFlowKgS) / totalMassFlowKgS;
  const enthalpyJkg = (enthalpy(core.tempC, core.w) * coreMassFlowKgS
    + enthalpy(bypass.tempC, bypass.w) * bypassMassFlowKgS) / totalMassFlowKgS;
  return saturatedIfNeeded({tempC:temperatureAtEnthalpy(enthalpyJkg, w), w}, pressurePa);
}

export function airflowConversions(scenario, ach) {
  if (!scenario || typeof scenario !== 'object') throw Error('Scenario is required for airflow conversion.');
  const areaM2 = positive('Scenario area', scenario.areaM2);
  const heightM = positive('Scenario height', scenario.heightM);
  nonnegative('ACH', ach);
  const m3s = ach * areaM2 * heightM / 3600;
  const m3sPerM2 = ach * heightM / 3600;
  return {
    m3s,
    m3sPerM2,
    cfm:m3s * CFM_PER_M3S,
    cfmPerFt2:m3sPerM2 * CFM_PER_M3S / FT2_PER_M2,
  };
}

export function effectivenessAtFlow(at75, at100, flowRatio) {
  finite('75 percent effectiveness', at75);
  finite('100 percent effectiveness', at100);
  if (at75 < 0 || at75 > 1 || at100 < 0 || at100 > 1) throw Error('Effectiveness ratings must be fractions from 0 to 1.');
  finite('Recovery flow ratio', flowRatio);
  if (flowRatio < .5 || flowRatio > 1.3) throw Error('Recovery flow ratio must be from 0.5 to 1.3.');
  return clamp(at75 + (at100 - at75) * (flowRatio - .75) / .25, 0, 1);
}

export function frostDefrostFraction(recovery, outdoorTempC) {
  finite('Outdoor temperature', outdoorTempC);
  if (!recovery || recovery.frostControl !== 'exhaustOnly') return 0;
  const threshold = finite('Frost threshold', recovery.frostThresholdC);
  if (outdoorTempC > threshold) return 0;
  const initial = nonnegative('Initial defrost fraction', recovery.initialDefrostFraction);
  const rate = nonnegative('Defrost rate', recovery.defrostRatePerK);
  return clamp(initial + rate * Math.max(0, threshold - outdoorTempC), 0, 1);
}

function inactiveRecovery(outside, volumeFlowM3s, extra = {}) {
  return {
    supply:{...outside},
    coreFlowM3s:0,
    bypassFlowM3s:volumeFlowM3s,
    sensibleTransferW:0,
    latentTransferW:0,
    auxiliaryW:0,
    preheatDemandW:0,
    preheatDeliveredW:0,
    defrostFraction:0,
    preheatInsufficient:false,
    ...extra,
  };
}

export function recoverSupplyState({outside, exhaust, volumeFlowM3s, recovery, bypass = false, availablePreheatW = 0} = {}) {
  const pressurePa = positive('Outside pressure', outside?.pressurePa);
  const outsideState = validState('Outside', outside, pressurePa);
  const exhaustPressurePa = exhaust?.pressurePa ?? pressurePa;
  if (Math.abs(exhaustPressurePa - pressurePa) > 1e-6 * pressurePa) throw Error('Balanced recovery inlet pressures must match.');
  const exhaustState = validState('Exhaust', exhaust, exhaustPressurePa);
  nonnegative('Recovery volume flow', volumeFlowM3s);
  nonnegative('Available preheat', availablePreheatW);
  const configured = backfillHeatRecovery(recovery);
  if (volumeFlowM3s === 0 || bypass || configured.type === 'none') {
    return inactiveRecovery(outsideState, volumeFlowM3s);
  }
  const errors = heatRecoveryErrors(configured);
  if (errors.length) throw Error(errors.join(' '));
  if (configured.frostControl === 'none' && outsideState.tempC < configured.minimumOutdoorOperatingC) {
    return inactiveRecovery(outsideState, volumeFlowM3s, {recoveryUnavailable:true});
  }
  const attemptedCoreFlowM3s = Math.min(volumeFlowM3s, 1.3 * configured.nominalM3s);
  const flowRatio = attemptedCoreFlowM3s / configured.nominalM3s;
  if (flowRatio < .5) return inactiveRecovery(outsideState, volumeFlowM3s, {unsupportedFlow:true});
  const outsideDryAirDensityKgM3 = dryAirDensity(outsideState.tempC, outsideState.w, pressurePa);

  let coreInlet = outsideState;
  let preheatDemandW = 0;
  let preheatDeliveredW = 0;
  let preheatInsufficient = false;
  if (configured.frostControl === 'preheat' && outsideState.tempC < configured.frostThresholdC) {
    const massFlowKgS = outsideDryAirDensityKgM3 * attemptedCoreFlowM3s;
    preheatDemandW = massFlowKgS * (enthalpy(configured.frostThresholdC, outsideState.w)
      - enthalpy(outsideState.tempC, outsideState.w));
    preheatDeliveredW = Math.min(preheatDemandW, availablePreheatW);
    preheatInsufficient = preheatDeliveredW + 1e-9 < preheatDemandW;
    coreInlet = {
      tempC:temperatureAtEnthalpy(enthalpy(outsideState.tempC, outsideState.w) + preheatDeliveredW / massFlowKgS, outsideState.w),
      w:outsideState.w,
    };
    if (preheatInsufficient) {
      const supply = mixStates(coreInlet, outsideDryAirDensityKgM3 * attemptedCoreFlowM3s, outsideState,
        outsideDryAirDensityKgM3 * (volumeFlowM3s - attemptedCoreFlowM3s), pressurePa);
      return inactiveRecovery(supply, volumeFlowM3s, {
        preheatDemandW,
        preheatDeliveredW,
        preheatInsufficient:true,
      });
    }
  }

  const defrostFraction = frostDefrostFraction(configured, outsideState.tempC);
  const coreFlowM3s = attemptedCoreFlowM3s * (1 - defrostFraction);
  const bypassFlowM3s = volumeFlowM3s - coreFlowM3s;
  if (coreFlowM3s === 0) {
    return inactiveRecovery(outsideState, volumeFlowM3s, {
      preheatDemandW,
      preheatDeliveredW,
      defrostFraction,
      preheatInsufficient,
    });
  }
  const heatingMode = coreInlet.tempC <= exhaustState.tempC;
  const sensibleAt75 = configured[heatingMode ? 'sensibleHeating75' : 'sensibleCooling75'];
  const sensibleAt100 = configured[heatingMode ? 'sensibleHeating100' : 'sensibleCooling100'];
  const sensibleEffectiveness = effectivenessAtFlow(sensibleAt75, sensibleAt100, flowRatio);
  const latentEffectiveness = configured.type === 'erv'
    ? effectivenessAtFlow(configured[heatingMode ? 'latentHeating75' : 'latentCooling75'],
      configured[heatingMode ? 'latentHeating100' : 'latentCooling100'], flowRatio)
    : 0;
  const coreSupply = saturatedIfNeeded({
    tempC:coreInlet.tempC + sensibleEffectiveness * (exhaustState.tempC - coreInlet.tempC),
    w:coreInlet.w + latentEffectiveness * (exhaustState.w - coreInlet.w),
  }, pressurePa);
  const coreMassFlowKgS = outsideDryAirDensityKgM3 * coreFlowM3s;
  const sensibleTransferW = coreMassFlowKgS * CP_DRY_AIR * (coreSupply.tempC - coreInlet.tempC);
  const latentTransferW = configured.type === 'hrv' ? 0
    : coreMassFlowKgS * LATENT_HEAT * (coreSupply.w - coreInlet.w);
  const supply = mixStates(coreSupply, coreMassFlowKgS, outsideState,
    outsideDryAirDensityKgM3 * bypassFlowM3s, pressurePa);
  return {
    supply,
    coreFlowM3s,
    bypassFlowM3s,
    sensibleTransferW,
    latentTransferW,
    auxiliaryW:configured.auxiliaryW,
    preheatDemandW,
    preheatDeliveredW,
    defrostFraction,
    preheatInsufficient,
  };
}

export function conditionDoasSupply({
  inlet,
  volumeFlowM3s,
  pressurePa,
  supplyTempC,
  supplyDewPointC,
  coolingCOP,
  reheatRecoveryFraction,
  availableHeatingW,
} = {}) {
  positive('DOAS pressure', pressurePa);
  const inletState = validState('DOAS inlet', inlet, pressurePa);
  nonnegative('DOAS volume flow', volumeFlowM3s);
  finite('DOAS supply temperature', supplyTempC);
  finite('DOAS supply dew point', supplyDewPointC);
  if (supplyDewPointC > supplyTempC) throw Error('DOAS supply dew point cannot exceed supply temperature.');
  positive('DOAS cooling COP', coolingCOP);
  finite('DOAS reheat recovery fraction', reheatRecoveryFraction);
  if (reheatRecoveryFraction < 0 || reheatRecoveryFraction > 1) throw Error('DOAS reheat recovery fraction must be from 0 to 1.');
  nonnegative('Available DOAS heating', availableHeatingW);
  const zero = {
    outlet:{...inletState},
    coilLeaving:{...inletState},
    condensateKgS:0,
    coolingLoadW:0,
    coolingElectricW:0,
    heatingDemandW:0,
    reheatDemandW:0,
    recoveredReheatW:0,
    externalHeatW:0,
    unmetConditioningW:0,
  };
  if (volumeFlowM3s === 0) return zero;

  const massFlowKgS = dryAirDensity(inletState.tempC, inletState.w, pressurePa) * volumeFlowM3s;
  const targetW = saturationHumidityRatio(supplyDewPointC, pressurePa);
  let coilLeaving = {...inletState};
  let condensateKgS = 0;
  if (inletState.w > targetW) {
    coilLeaving = {tempC:supplyDewPointC, w:targetW};
    condensateKgS = massFlowKgS * (inletState.w - targetW);
  } else if (inletState.tempC > supplyTempC) {
    coilLeaving = {tempC:supplyTempC, w:inletState.w};
  }
  const coolingLoadW = Math.max(0,
    massFlowKgS * (enthalpy(inletState.tempC, inletState.w) - enthalpy(coilLeaving.tempC, coilLeaving.w)));
  const coolingElectricW = coolingLoadW / coolingCOP;
  const targetTempC = Math.max(coilLeaving.tempC, supplyTempC);
  const heatingDemandW = massFlowKgS * Math.max(0,
    enthalpy(targetTempC, coilLeaving.w) - enthalpy(coilLeaving.tempC, coilLeaving.w));
  const reheatDemandW = coolingLoadW > 0 ? heatingDemandW : 0;
  const recoveredReheatW = Math.min(heatingDemandW,
    reheatRecoveryFraction * (coolingLoadW + coolingElectricW));
  const remainingHeatW = heatingDemandW - recoveredReheatW;
  const externalHeatW = Math.min(remainingHeatW, availableHeatingW);
  const unmetConditioningW = remainingHeatW - externalHeatW;
  const deliveredHeatW = recoveredReheatW + externalHeatW;
  const outlet = {
    tempC:temperatureAtEnthalpy(enthalpy(coilLeaving.tempC, coilLeaving.w) + deliveredHeatW / massFlowKgS,
      coilLeaving.w),
    w:coilLeaving.w,
  };
  return {
    outlet,
    coilLeaving,
    condensateKgS,
    coolingLoadW,
    coolingElectricW,
    heatingDemandW,
    reheatDemandW,
    recoveredReheatW,
    externalHeatW,
    unmetConditioningW,
  };
}
