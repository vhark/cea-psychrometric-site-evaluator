#!/usr/bin/env node
/* Prints the arithmetic behind weather hours, step by step, with the hour's own numbers.
   node scripts/worked-example.mjs                          the two real sample hours in data/weather/sample-hours.json
   node scripts/worked-example.mjs snapshot.json 0 12 4000  hours 0, 12 and 4000 of any schema 1 weather snapshot
   The scenario is DEFAULT_SCENARIO on the snapshot's time zone. Every number is recomputed by src/steps.js from
   src/physics.js, so what prints here is what the screen decided on, not a copy of a stored result. */
import fs from 'node:fs';
import {weatherSteps} from '../src/steps.js';
import {DEFAULT_SCENARIO} from '../src/config.js';

const [path = new URL('../data/weather/sample-hours.json', import.meta.url), ...indices] = process.argv.slice(2);
const file = JSON.parse(fs.readFileSync(path, 'utf8'));
const timezone = file.site?.timezone || file.timezone;
if (!timezone) throw new Error('The file carries no time zone, so local days cannot be placed. Nothing is assumed.');
const scenario = {...DEFAULT_SCENARIO, timezone};
const samples = file.site ? file.hours.map(s => ({label: `${s.label} (${s.timeUTC}, ${s.sourceUrl})`, hour: s.hour}))
  : (indices.length ? indices.map(Number) : [0]).map(i => ({label: `hour index ${i}`, hour: file.hours[i]}));
console.log(`Scenario: ${scenario.dayTargetC} C day / ${scenario.nightTargetC} C night, VPD ${scenario.vpdMin} to ${scenario.vpdMax} kPa, dew point <= ${scenario.maxDewPointC} C, pad effectiveness ${scenario.padEffectiveness}, ${timezone}\n`);
for (const {label, hour} of samples) {
  console.log(`## ${label}`);
  for (const step of weatherSteps(hour, scenario, file.site || file)) console.log(`${step.n}. ${step.title}\n   ${step.formula}\n   with this hour: ${step.working}\n   = ${step.result}\n   (${step.fn})`);
  console.log();
}
