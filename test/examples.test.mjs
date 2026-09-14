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
const weekOf = (site, year) => {
  const snapshot = JSON.parse(readFileSync(`data/weather/${site}-${year}.json`, 'utf8'));
  const hours = snapshot.hours.slice(0, 24 * 7);
  return {...snapshot, raw: undefined, startDate: `${year}-01-01`, endDate: `${year}-01-07`,
    startUTC: new Date(hours[0].time).toISOString(),
    endExclusiveUTC: new Date(hours.at(-1).time + 3600000).toISOString(), hours};
};
const week = weekOf('tulsa', 2025);
const bundled = JSON.parse(readFileSync('data/weather/index.json', 'utf8')).sites;

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

// The point of climate-archetypes.json is that one unchanged facility meets every bundled climate. A site
// added to the bundle without a scenario, or a scenario that quietly differs in the house it describes,
// destroys the comparison without breaking anything the tests above would notice.
test('the climate set carries one unchanged facility at every bundled site', () => {
  const set = load('climate-archetypes.json');
  assert.equal(set.scenarios.length, bundled.length,
    `climate-archetypes.json has ${set.scenarios.length} scenarios for ${bundled.length} bundled sites`);
  const byLocation = new Map(set.scenarios.map(s => [`${s.latitude},${s.longitude}`, s]));
  for (const site of bundled) {
    const scenario = byLocation.get(`${site.latitude},${site.longitude}`);
    assert.ok(scenario, `climate-archetypes.json has no scenario at ${site.key}`);
    assert.equal(scenario.timezone, site.timezone, `${site.key} scenario carries the wrong time zone`);
    assert.equal(scenario.zip, site.zip, `${site.key} scenario carries the wrong ZIP`);
  }
  const siteFields = new Set(['id', 'name', 'latitude', 'longitude', 'timezone', 'zip']);
  const [reference, ...rest] = set.scenarios;
  for (const scenario of rest) {
    for (const key of new Set([...Object.keys(reference), ...Object.keys(scenario)])) {
      if (siteFields.has(key)) continue;
      assert.deepEqual(scenario[key], reference[key],
        `${scenario.name} differs from ${reference.name} in "${key}"; only the site may change`);
    }
  }
});

// Each climate scenario is only ever meaningful against its own site record, and the Tulsa week above never
// reaches the states that a subarctic or a hot-humid record does.
test('every climate-archetype scenario simulates its own site record', () => {
  const set = load('climate-archetypes.json');
  const byLocation = new Map(set.scenarios.map(s => [`${s.latitude},${s.longitude}`, s]));
  for (const site of bundled) {
    const scenario = byLocation.get(`${site.latitude},${site.longitude}`);
    const record = weekOf(site.key, 2025);
    const summary = simulateScenario(scenario, record).summary;
    assert.equal(summary.numericalFailureHours, 0, `${site.key} produced numerical failures`);
    assert.equal(summary.validHours, record.hours.length, `${site.key} lost hours`);
    assert.ok(summary.maxEnergyResidualW < 1, `${site.key} energy residual ${summary.maxEnergyResidualW} W`);
    assert.ok(summary.maxMoistureResidualKgS < 1e-6, `${site.key} moisture residual ${summary.maxMoistureResidualKgS} kg/s`);
    assert.ok(Number.isFinite(summary.compliancePct), `${site.key} produced no attainment figure`);
  }
});
