import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {weatherSteps, attainmentSteps} from '../src/steps.js';
import {classifyWeather, weatherState, padState, dewPoint, humidityRatio} from '../src/physics.js';
import {DEFAULT_SCENARIO} from '../src/config.js';

const file = JSON.parse(fs.readFileSync(new URL('../data/weather/sample-hours.json', import.meta.url), 'utf8'));
const scenario = {...DEFAULT_SCENARIO, timezone: file.site.timezone};

test('the sample hours are real NASA POWER rows with a source request, and each converts to a usable state', () => {
  assert.equal(file.schemaVersion, 1);
  assert.ok(file.hours.length >= 2);
  for (const sample of file.hours) {
    assert.match(sample.sourceUrl, /^https:\/\/power\.larc\.nasa\.gov\//);
    assert.ok(sample.retrievedAt);
    assert.equal(sample.hour.tempC, sample.raw.T2M, 'temperature is the row as received');
    assert.ok(Math.abs(sample.hour.rh * 100 - sample.raw.RH2M) < 1e-9, 'RH percent became a fraction');
    assert.equal(sample.hour.pressurePa, sample.raw.PS * 1000, 'kPa became Pa');
    assert.ok(weatherState(sample.hour));
  }
});

test('the worked steps agree with the classifier and with the physics they explain', () => {
  for (const sample of file.hours) {
    const steps = weatherSteps(sample.hour, scenario);
    assert.equal(steps.length, 10);
    assert.deepEqual(steps.map(s => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const cls = classifyWeather(sample.hour, scenario);
    assert.equal(steps[8].result, cls.mode, 'step 9 reports the mode the screen assigned');
    assert.equal(steps[7].result, `flags: ${cls.flags.join(', ')}`);
    const state = weatherState(sample.hour);
    const roundTrip = dewPoint(state.tempC, state.w, state.pressurePa);
    assert.ok(Math.abs(roundTrip - sample.hour.dewPointC) < 0.5, `dew point round trip ${roundTrip} vs record ${sample.hour.dewPointC}`);
    const pad = padState(state.tempC, state.w, state.pressurePa, scenario.padEffectiveness);
    assert.ok(Math.abs(pad.enthalpyResidualJkg) < 1, 'the pad step conserves enthalpy');
    assert.ok(steps[2].result.startsWith(state.w.toFixed(5)), 'step 3 prints the humidity ratio the classifier used');
    for (const step of steps) for (const field of ['title', 'formula', 'working', 'result', 'fn']) {
      assert.equal(typeof step[field], 'string');
      assert.ok(!/[—–]/.test(step[field]), `step ${step.n} ${field} contains an em or en dash`);
    }
  }
});

test('a rejected hour stops at step 1 and says nothing was filled in', () => {
  const steps = weatherSteps({time: 0, tempC: 90, rh: .5, pressurePa: 101325}, scenario);
  assert.equal(steps.length, 1);
  assert.match(steps[0].result, /rejected/);
  assert.equal(weatherSteps(undefined, scenario).length, 1);
});

test('the attainment step reads the engine fields and excludes warm-up and missing hours', () => {
  assert.match(attainmentSteps({valid: true, compliantFraction: .25, tempC: 22, rh: .6, vpd: 1, tempDegreeHours: 0, vpdKPaHours: .2})[0].result, /25\.0% of the hour/);
  assert.match(attainmentSteps({valid: true, warmup: true, compliantFraction: 1})[0].result, /warm-up/);
  assert.match(attainmentSteps({valid: false, compliantFraction: null})[0].result, /missing/);
  assert.deepEqual(attainmentSteps(null), []);
});
test('cold liquid dewpoint is not misrepresented as a frost-point discrepancy',()=>{
 const steps=weatherSteps({time:Date.UTC(2025,0,1),tempC:-10,dewPointC:-20,pressurePa:101325,moisture:{authoritative:'dewPointC',rhReference:'water',dewPointReference:'water'}},scenario);
 assert.match(steps[3].working,/frost point/);
 assert.doesNotMatch(steps[3].working,/consistency check/);
 assert.match(weatherSteps(file.hours[0].hour,scenario)[1].working,/Legacy input/);
});
