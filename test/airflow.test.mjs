import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAT_RECOVERY_DEFAULT,
  backfillHeatRecovery,
  heatRecoveryErrors,
  airflowConversions,
  effectivenessAtFlow,
  recoverSupplyState,
  frostDefrostFraction,
  conditionDoasSupply,
} from '../src/airflow.js';
import {
  CP_DRY_AIR,
  LATENT_HEAT,
  dryAirDensity,
  enthalpy,
  humidityRatio,
  relativeHumidity,
  saturatedStateAtEnthalpy,
  saturationHumidityRatio,
} from '../src/physics.js';

const PRESSURE = 101325;
const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
};
const state = (tempC, rh) => ({tempC, w:humidityRatio(tempC, rh, PRESSURE), pressurePa:PRESSURE});
const recovery = (type = 'erv', overrides = {}) => backfillHeatRecovery({
  type,
  nominalM3s:1,
  auxiliaryW:45,
  sensibleHeating75:.68,
  sensibleHeating100:.72,
  sensibleCooling75:.64,
  sensibleCooling100:.69,
  latentHeating75:.48,
  latentHeating100:.52,
  latentCooling75:.44,
  latentCooling100:.49,
  minimumOutdoorOperatingC:-30,
  ...overrides,
});

test('heat recovery defaults backfill fresh objects and validate type-specific ratings', () => {
  const first = backfillHeatRecovery({type:'hrv'});
  const second = backfillHeatRecovery({type:'hrv'});
  assert.notEqual(first, second);
  assert.deepEqual(Object.keys(first), Object.keys(HEAT_RECOVERY_DEFAULT));
  first.type = 'none';
  assert.equal(second.type, 'hrv');
  assert.equal(HEAT_RECOVERY_DEFAULT.type, 'none');

  const hrvErrors = heatRecoveryErrors(recovery('hrv'));
  assert.deepEqual(hrvErrors, []);
  const ervErrors = heatRecoveryErrors(recovery('erv', {latentCooling100:null}));
  assert.ok(ervErrors.some(error => error.includes('latentCooling100')));
  assert.ok(heatRecoveryErrors(recovery('hrv', {sensibleHeating75:null})).some(error => error.includes('sensibleHeating75')));
});

test('ACH conversions use scenario volume and floor-normalized height', () => {
  const flow = airflowConversions({areaM2:500, heightM:4}, 40);
  assert.equal(flow.m3s, 40 * 500 * 4 / 3600);
  assert.equal(flow.m3sPerM2, 40 * 4 / 3600);
  assert.ok(Math.abs(flow.cfm - flow.m3s * 2118.880003) < 1e-9);
  assert.ok(Math.abs(flow.cfmPerFt2 - flow.m3sPerM2 * 2118.880003 / 10.7639104) < 1e-9);
  assert.throws(() => airflowConversions({areaM2:500, heightM:4}, -1), /ACH/);
  assert.throws(() => airflowConversions({areaM2:500, heightM:NaN}, 1), /height/);
});

test('effectiveness follows the 75 and 100 percent ratings only within supported flow', () => {
  assert.equal(effectivenessAtFlow(.6, .7, .75), .6);
  assert.equal(effectivenessAtFlow(.6, .7, 1), .7);
  close(effectivenessAtFlow(.6, .7, .5), .5);
  close(effectivenessAtFlow(.6, .7, 1.3), .82);
  assert.throws(() => effectivenessAtFlow(.6, .7, .49), /flow ratio/);
  assert.throws(() => effectivenessAtFlow(.6, .7, 1.31), /flow ratio/);
});

test('HRV transfers exactly zero latent energy', () => {
  const outside = state(0, .45);
  const exhaust = state(22, .55);
  const result = recoverSupplyState({
    outside,
    exhaust,
    volumeFlowM3s:.75,
    recovery:recovery('hrv'),
    bypass:false,
    availablePreheatW:0,
  });
  assert.equal(result.latentTransferW, 0);
  assert.equal(result.supply.w, outside.w);
  assert.ok(result.sensibleTransferW > 0);
  assert.equal(result.coreFlowM3s, .75);
  assert.equal(result.bypassFlowM3s, 0);
});

test('ERV supply transfer equals balanced exhaust-side loss', () => {
  const outside = state(2, .35);
  const exhaust = state(24, .65);
  const configured = recovery('erv');
  const volumeFlowM3s = 1;
  const result = recoverSupplyState({outside, exhaust, volumeFlowM3s, recovery:configured,
    bypass:false, availablePreheatW:0});
  const massFlowKgS = dryAirDensity(outside.tempC, outside.w, PRESSURE) * volumeFlowM3s;
  const sensibleEffectiveness = effectivenessAtFlow(configured.sensibleHeating75, configured.sensibleHeating100, 1);
  const latentEffectiveness = effectivenessAtFlow(configured.latentHeating75, configured.latentHeating100, 1);
  const exhaustSideLossW = massFlowKgS * (CP_DRY_AIR * sensibleEffectiveness * (exhaust.tempC - outside.tempC)
    + LATENT_HEAT * latentEffectiveness * (exhaust.w - outside.w));
  close(result.sensibleTransferW + result.latentTransferW, exhaustSideLossW, 1e-8);
});

test('unsupported low flow bypasses and high flow recovers only capped core flow once', () => {
  const outside = state(5, .4);
  const exhaust = state(25, .6);
  const configured = recovery('erv');
  const low = recoverSupplyState({outside, exhaust, volumeFlowM3s:.49, recovery:configured,
    bypass:false, availablePreheatW:0});
  assert.deepEqual(low.supply, {tempC:outside.tempC, w:outside.w});
  assert.equal(low.coreFlowM3s, 0);
  assert.equal(low.bypassFlowM3s, .49);
  assert.equal(low.sensibleTransferW + low.latentTransferW, 0);

  const high = recoverSupplyState({outside, exhaust, volumeFlowM3s:2, recovery:configured,
    bypass:false, availablePreheatW:0});
  const coreRatio = 1.3;
  const sensible = effectivenessAtFlow(configured.sensibleHeating75, configured.sensibleHeating100, coreRatio);
  const latent = effectivenessAtFlow(configured.latentHeating75, configured.latentHeating100, coreRatio);
  const recoveredCoreTempC = outside.tempC + sensible * (exhaust.tempC - outside.tempC);
  const recoveredCoreW = outside.w + latent * (exhaust.w - outside.w);
  assert.equal(high.coreFlowM3s, 1.3);
  close(high.bypassFlowM3s, .7);
  close(high.supply.tempC, (1.3 * recoveredCoreTempC + .7 * outside.tempC) / 2);
  close(high.supply.w, (1.3 * recoveredCoreW + .7 * outside.w) / 2);
});

test('exhaust-only frost bypasses the declared fraction without reducing supply flow', () => {
  const configured = recovery('hrv', {
    frostControl:'exhaustOnly',
    frostThresholdC:-5,
    initialDefrostFraction:.1,
    defrostRatePerK:.05,
  });
  assert.equal(frostDefrostFraction(configured, -10), .35);
  assert.equal(frostDefrostFraction(configured, 0), 0);
  assert.equal(frostDefrostFraction({...configured, frostControl:'preheat'}, -10), 0);
  const result = recoverSupplyState({outside:state(-10, .5), exhaust:state(22, .5), volumeFlowM3s:1,
    recovery:configured, bypass:false, availablePreheatW:0});
  close(result.coreFlowM3s, .65);
  close(result.bypassFlowM3s, .35);
  assert.equal(result.defrostFraction, .35);
  close(result.coreFlowM3s + result.bypassFlowM3s, 1);
});

test('preheat exposes delivered capacity and bypasses an unprotected core when insufficient', () => {
  const configured = recovery('hrv', {frostControl:'preheat', frostThresholdC:-5});
  const outside = state(-15, .4);
  const exhaust = state(22, .5);
  const limited = recoverSupplyState({outside, exhaust, volumeFlowM3s:1, recovery:configured,
    bypass:false, availablePreheatW:1000});
  assert.ok(limited.preheatDemandW > limited.preheatDeliveredW);
  assert.equal(limited.preheatDeliveredW, 1000);
  assert.equal(limited.preheatInsufficient, true);
  assert.equal(limited.coreFlowM3s, 0);
  assert.equal(limited.bypassFlowM3s, 1);
  assert.ok(limited.supply.tempC > outside.tempC);
});

test('supersaturated recovery resolves to saturation at unchanged moist-air enthalpy', () => {
  const outside = state(-20, .95);
  const exhaust = state(28, .95);
  const configured = recovery('erv', {
    sensibleHeating75:.2,
    sensibleHeating100:.2,
    latentHeating75:.95,
    latentHeating100:.95,
  });
  const rawTempC = outside.tempC + .2 * (exhaust.tempC - outside.tempC);
  const rawW = outside.w + .95 * (exhaust.w - outside.w);
  assert.ok(relativeHumidity(rawTempC, rawW, PRESSURE) > 1);
  const result = recoverSupplyState({outside, exhaust, volumeFlowM3s:1, recovery:configured,
    bypass:false, availablePreheatW:0});
  close(relativeHumidity(result.supply.tempC, result.supply.w, PRESSURE), 1, 1e-8);
  close(enthalpy(result.supply.tempC, result.supply.w), enthalpy(rawTempC, rawW), 1e-5);
});

test('saturated enthalpy inversion is bounded and rejects invalid input', () => {
  const expected = {tempC:12, w:saturationHumidityRatio(12, PRESSURE)};
  const actual = saturatedStateAtEnthalpy(enthalpy(expected.tempC, expected.w), PRESSURE);
  close(actual.tempC, expected.tempC, 1e-7);
  close(actual.w, expected.w, 1e-10);
  assert.throws(() => saturatedStateAtEnthalpy(NaN, PRESSURE), /enthalpy/);
  assert.throws(() => saturatedStateAtEnthalpy(-1e12, PRESSURE), /domain/);
  assert.throws(() => saturatedStateAtEnthalpy(0, -1), /pressure/);
});

test('cold dry DOAS supply requires external heat to reach a warmer target', () => {
  const inlet = state(0, .35);
  const result = conditionDoasSupply({
    inlet,
    volumeFlowM3s:1,
    pressurePa:PRESSURE,
    supplyTempC:21,
    supplyDewPointC:10,
    coolingCOP:3,
    reheatRecoveryFraction:.5,
    availableHeatingW:50000,
  });
  assert.equal(result.condensateKgS, 0);
  assert.equal(result.coolingLoadW, 0);
  assert.equal(result.recoveredReheatW, 0);
  assert.ok(result.externalHeatW > 0);
  assert.equal(result.unmetConditioningW, 0);
  close(result.outlet.tempC, 21, 1e-9);
  assert.equal(result.outlet.w, inlet.w);
});

test('hot humid DOAS supply reports explicit condensation, cooling, and reheat', () => {
  const inlet = state(35, .7);
  const supplyDewPointC = 10;
  const supplyTempC = 20;
  const coolingCOP = 3;
  const reheatRecoveryFraction = .5;
  const result = conditionDoasSupply({inlet, volumeFlowM3s:1, pressurePa:PRESSURE,
    supplyTempC, supplyDewPointC, coolingCOP, reheatRecoveryFraction, availableHeatingW:0});
  const targetW = saturationHumidityRatio(supplyDewPointC, PRESSURE);
  const massFlowKgS = dryAirDensity(inlet.tempC, inlet.w, PRESSURE);
  const expectedCoolingW = massFlowKgS * (enthalpy(inlet.tempC, inlet.w) - enthalpy(supplyDewPointC, targetW));
  const expectedCondensateKgS = massFlowKgS * (inlet.w - targetW);
  const reheatDemandW = massFlowKgS * (enthalpy(supplyTempC, targetW) - enthalpy(supplyDewPointC, targetW));
  const expectedRecoveredW = Math.min(reheatDemandW,
    reheatRecoveryFraction * (expectedCoolingW + expectedCoolingW / coolingCOP));
  assert.ok(result.condensateKgS > 0);
  assert.ok(result.coolingLoadW > 0);
  assert.ok(result.reheatDemandW > 0);
  assert.ok(result.recoveredReheatW > 0);
  close(result.condensateKgS, expectedCondensateKgS, 1e-12);
  close(result.coolingLoadW, expectedCoolingW, 1e-8);
  close(result.coolingElectricW, expectedCoolingW / coolingCOP, 1e-8);
  close(result.recoveredReheatW, expectedRecoveredW, 1e-8);
  assert.equal(result.externalHeatW, 0);
  assert.equal(result.unmetConditioningW, 0);
  close(result.outlet.tempC, supplyTempC, 1e-9);
  close(result.outlet.w, targetW, 1e-12);
});

test('DOAS exposes unmet heat and rejects invalid physical inputs', () => {
  const inlet = state(0, .35);
  const result = conditionDoasSupply({inlet, volumeFlowM3s:1, pressurePa:PRESSURE,
    supplyTempC:21, supplyDewPointC:10, coolingCOP:3, reheatRecoveryFraction:0, availableHeatingW:1000});
  assert.equal(result.externalHeatW, 1000);
  assert.ok(result.unmetConditioningW > 0);
  assert.ok(result.outlet.tempC > inlet.tempC && result.outlet.tempC < 21);
  assert.throws(() => conditionDoasSupply({inlet, volumeFlowM3s:1, pressurePa:PRESSURE,
    supplyTempC:5, supplyDewPointC:10, coolingCOP:3, reheatRecoveryFraction:0, availableHeatingW:0}), /dew point/);
  assert.throws(() => conditionDoasSupply({inlet, volumeFlowM3s:1, pressurePa:PRESSURE,
    supplyTempC:21, supplyDewPointC:10, coolingCOP:0, reheatRecoveryFraction:0, availableHeatingW:0}), /COP/);
});
