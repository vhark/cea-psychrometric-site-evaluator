import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {validateScenario, SYSTEMS, TECHNOLOGIES, CROPS, FACILITIES} from '../src/config.js';
import {simulateScenario} from '../src/simulate.js';

// Shipped example sets are the first thing a new user runs. A config change that invalidates one
// of them, or that makes it fail numerically, is a defect in the product and not in the example.
const setPath = name => `docs/examples/${name}`;
const sets = readdirSync('docs/examples').filter(name => name.endsWith('.json'));
const canonical = JSON.parse(readFileSync('docs/example-scenarios.json', 'utf8'));
const load = name => JSON.parse(readFileSync(setPath(name), 'utf8'));
// One representative week keeps the suite fast while still exercising a real record end to end.
const week = (() => {
  const snapshot = JSON.parse(readFileSync('data/weather/tulsa-2025.json', 'utf8'));
  const hours = snapshot.hours.slice(0, 24 * 7);
  return {...snapshot, raw: undefined, startDate: '2025-01-01', endDate: '2025-01-07',
    startUTC: new Date(hours[0].time).toISOString(),
    endExclusiveUTC: new Date(hours.at(-1).time + 3600000).toISOString(), hours};
})();

test('every shipped example set carries a note and valid scenarios', () => {
  assert.ok(sets.length >= 5, `expected the example library, found ${sets.length} sets`);
  for (const name of sets) {
    const set = load(name);
    assert.equal(set.schemaVersion, 1, `${name} must declare schemaVersion 1`);
    assert.ok(typeof set.note === 'string' && set.note.length > 40, `${name} must explain what it demonstrates`);
    assert.ok(Array.isArray(set.scenarios) && set.scenarios.length >= 2, `${name} must compare at least two scenarios`);
    for (const scenario of set.scenarios) {
      assert.deepEqual(validateScenario(scenario), [], `${name}: ${scenario.name}`);
      assert.ok(Object.hasOwn(FACILITIES, scenario.facility) && Object.hasOwn(SYSTEMS, scenario.system)
        && Object.hasOwn(CROPS, scenario.crop) && Object.hasOwn(TECHNOLOGIES, scenario.technology), `${name}: ${scenario.name} uses a retired option`);
    }
    const names = set.scenarios.map(s => s.name);
    assert.equal(new Set(names).size, names.length, `${name} has duplicate scenario names`);
  }
});

test('the example library exercises every shipped technology and cultivation system', () => {
  const all = [...canonical.scenarios, ...sets.flatMap(name => load(name).scenarios)];
  for (const technology of Object.keys(TECHNOLOGIES)) {
    assert.ok(all.some(s => s.technology === technology), `no shipped example uses technology "${technology}"`);
  }
  for (const system of Object.keys(SYSTEMS)) {
    assert.ok(all.some(s => s.system === system), `no shipped example uses cultivation system "${system}"`);
  }
});

test('every shipped example simulates a real week without numerical failure', () => {
  for (const name of sets) {
    for (const scenario of load(name).scenarios) {
      const result = simulateScenario(scenario, week);
      const summary = result.summary;
      assert.equal(summary.numericalFailureHours, 0, `${name}: ${scenario.name} produced numerical failures`);
      assert.equal(summary.validHours, week.hours.length, `${name}: ${scenario.name} lost hours`);
      assert.ok(summary.maxEnergyResidualW < 1, `${name}: ${scenario.name} energy residual ${summary.maxEnergyResidualW} W`);
      assert.ok(summary.maxMoistureResidualKgS < 1e-6, `${name}: ${scenario.name} moisture residual ${summary.maxMoistureResidualKgS} kg/s`);
      assert.ok(Number.isFinite(summary.compliancePct), `${name}: ${scenario.name} produced no attainment figure`);
    }
  }
});
