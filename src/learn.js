/* Learn view: a plain-language one-pager first, then the technical curriculum, then the regional study.

   The view opens on PRIMER, an explainer written for a reader with no heating-and-cooling background:
   what the tool does, the buying mistake it exists to prevent, the two weather-side tools it scores
   separately, the band-against-budget trade, the ladder of equipment classes, which class suits which
   climate, and what none of it can promise. MODULES, the ten technical sections, sit below it inside a
   collapsed "Go deeper" disclosure, with every key and every #learn/<key> route unchanged.

   Copy discipline, enforced by review rather than by code: every figure quoted in PRIMER and MODULES is
   already published in this repository (docs/CLASSES.md, docs/CLIMATES.md, docs/VERIFICATION.md,
   docs/AUDIT.md, docs/SENSITIVITY.md, docs/GLOSSARY.md, docs/examples/README.md) and carries its source
   on screen. Every figure that describes a climate, including every count of pad hours and vent hours,
   is read from docs/regional-study.json at runtime through a `study` slot, so this page cannot drift
   from the study and cannot be more specific than the study is. Nothing here is computed by this
   module, and nothing is invented: an absent study renders as an absent study.

   The one exception is the worked hours. data/weather/sample-hours.json holds two real NASA POWER hours with
   their source requests, and src/steps.js recomputes every step from them with the functions the screen itself
   runs, so the worked arithmetic cannot drift from the engine either. An absent file renders as an absent file.

   The spotlight is the guided tour's, imported rather than duplicated. */

import {costBasisText, capitalBasisText} from './report.js';
import {spotlight} from './tour.js';
import {weatherSteps} from './steps.js';
import {DEFAULT_SCENARIO} from './config.js';

export const LEARN_VERSION = 1;
export const VIEW_KEY = 'cea-psychrometric-site-evaluator.view.v1';
export const STUDY_URL = 'docs/regional-study.json';
export const STUDY_COMMAND = 'node scripts/regional-study.mjs';
export const STUDY_SCHEMA = 1;
export const WORKED_HOURS_URL = 'data/weather/sample-hours.json';

const $ = id => document.getElementById(id);
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const num = (value, digits = 0) => finite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'Not available';
const pct = (value, digits = 1) => finite(value) ? `${num(value, digits)}%` : 'Not available';
const points = (value, digits = 1) => finite(value) ? `${num(value, digits)} pp` : 'Not available';
const hours = value => finite(value) ? `${num(value)} h` : 'Not available';
const kwh = value => finite(value) ? `${num(value)} kWh` : 'Not available';
const degrees = (value, digits = 1) => finite(value) ? `${num(value, digits)} °C` : 'Not available';
const usdFormat = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0});
const usd = value => finite(value) ? usdFormat.format(value) : 'Unpriced';
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined && content !== null) element.textContent = content;
  if (className) element.className = className;
  return element;
}

/* ---------- The one-pager, in plain language ---------- */

/** The ladder of equipment classes, summarised from docs/CLASSES.md. One line on what a class can do,
    one line on what defeats it, and the class code so a reader can find the full row in that document. */
/** Ordered arithmetic steps from src/steps.js as a list: title, formula, the hour's own numbers, the result, the function. */
export function stepsNode(steps) {
  const list = node('ol', undefined, 'steps');
  for (const step of steps) {
    const item = document.createElement('li');
    item.append(node('p', `${step.n}. ${step.title}`, 'step-title'), node('p', step.formula, 'step-formula'),
      node('p', step.working, 'step-working'), node('p', step.result, 'step-result'), node('p', `computed by ${step.fn}`, 'step-fn'));
    list.append(item);
  }
  return list;
}

const LADDER = [
  {
    code: 'C0, without the pad',
    name: 'Fans and vents only',
    can: 'Push warm air out and pull outside air in. It is the cheapest thing you can do, and on a mild day it is all you need.',
    defeat: 'Any hour when the outside air is already as warm, or as wet, as the air you wanted inside. Then opening up makes the problem worse.'
  },
  {
    code: 'C0',
    name: 'Add a wet wall',
    can: 'Cool the incoming air below the outside temperature, as far as evaporating water into it can take you.',
    defeat: 'Humid air, which has no room left to soak up more water. Also the first cold night, because there is no heater in this package at all.'
  },
  {
    code: 'C1',
    name: 'Add heating',
    can: 'Hold a temperature band all year, at every one of the six climates in the study.',
    defeat: 'Water. Nothing in this package takes moisture out except swapping air with outside, so a humid site still sits above its humidity limit for thousands of hours.'
  },
  {
    code: 'C2',
    name: 'Add a dehumidifier',
    can: 'Hold temperature and humidity at the same time. This is the biggest single jump in the whole ladder: in Miami it moved hours inside the band from about 18 in 100 to about 93 in 100, and it lowered modeled operating cost against the named C1 baseline at all six sites, under that study’s assumptions (docs/CLASSES.md).',
    defeat: 'Its own limit on how dry it can get the air, and the bill for reheating the air it just dried.'
  },
  {
    code: 'C3',
    name: 'Add curtains and shade screens you schedule',
    can: 'Keep heat in at night and sun out at midday with no new machine. It is the cheapest step in the ladder and one that reduced modeled fuel consumption against the C2 baseline (docs/CLASSES.md).',
    defeat: 'Light. A closed curtain and a drawn screen both block light the crop wanted, and neither one adds any back.'
  },
  {
    code: 'C4',
    name: 'A hybrid house: grow lights, real cooling, fewer open vents',
    can: 'Hold the band and also hit the daily amount of light the crop needs, which nothing lower in the ladder can do.',
    defeat: 'The building itself. Heat still pours through the glass in both directions, so you keep paying to remove a load the roof keeps letting in.'
  },
  {
    code: 'C5',
    name: 'A sealed insulated room, all light electric',
    can: 'Near total control with a small heater, because very little leaks. It wins where sunlight through a roof causes more cooling work than the free light is worth.',
    defeat: 'Its own moisture. No sun means no free drying, and a sealed shell cannot breathe in dry outside air the way a greenhouse can.'
  }
];

/** Which class suits which climate, in plain words. Characterisations and figures from docs/CLASSES.md
    and docs/CLIMATES.md; what the ten-year study actually picked is rendered from the study file itself,
    in the `verdicts` slot below, so no recommendation is asserted here that the study does not carry. */
const CLIMATE_LINES = [
  {
    place: 'Hot and dry',
    site: 'Phoenix, AZ',
    says: 'The wet wall earns its keep, for thousands of hours a year. This is the one site in the set that can reasonably stop at pads plus heating, because it spends only about half as many hours limited by moisture as by temperature (docs/CLASSES.md).'
  },
  {
    place: 'Hot and humid',
    site: 'Miami, FL',
    says: 'Forget the wet wall. Here a dehumidifier is not an upgrade, it is the difference between a controlled house and a shed with a thermostat (docs/CLASSES.md). Glass is the other problem: the hybrid greenhouse needed 370 kW of cooling where the sealed room needed 109 kW.'
  },
  {
    place: 'Cold and dry, and high up',
    site: 'Denver, CO',
    says: 'Heating is almost the whole job, and moisture barely registers. Summer air is dry, so the wet wall has plenty to work with. Thin mountain air also changes the arithmetic of humidity, which is why this site is in the set (docs/CLIMATES.md).'
  },
  {
    place: 'Mild and cloudy',
    site: 'Seattle, WA',
    says: 'Neither heavy heating nor heavy cooling, and free cooling or a pad looks plausible for most of the summer (docs/CLIMATES.md). The shortage is light: 134 days a year finish under the amount of daily light the crop asked for (docs/CLASSES.md).'
  },
  {
    place: 'Far north',
    site: 'Fairbanks, AK',
    says: 'The cold is not the hard part. A heated greenhouse there holds the temperature and humidity band almost perfectly. What it cannot hold is daylight: the sky gives 0.4 units of daily light in December against 41.2 in June, a factor of 106, and 189 days a year finish short of the crop target (docs/CLASSES.md). The answer in that document is an insulated box under electric light, with a way to pull in dry outside air.'
  },
  {
    place: 'Hot summer, freezing winter',
    site: 'Tulsa, OK',
    says: 'Both problems inside one year, so both have to be paid for: heat in winter, moisture in summer. One site cannot stand in for the others: screen the ZIP you are actually building at.'
  }
];

/** The explainer a first-time visitor reads, as data rather than as hand-built DOM, exactly as MODULES
    below is data. Block kinds: `p` a paragraph, `note` a smaller caution, `list` firm bullets, `ladder`
    the class ladder, `climates` the climate lines, `study` a slot filled from docs/regional-study.json
    at runtime, `actions` buttons, `links` a source line. */
export const PRIMER = [
  {
    id: 'primer-what',
    eyebrow: 'In three sentences',
    title: 'What this tool does',
    blocks: [
      {p: 'This tool replays real weather. It takes the hour by hour record of what the sky actually did at your location over the past ten years, and it walks through it one hour at a time.'},
      {p: 'At every hour it asks one question: what could each kind of greenhouse or indoor farm equipment have done in this weather? Would a fan have been enough? Would you have needed a cooling machine, or a machine that pulls water out of the air?'},
      {p: 'The point is to tell you what to buy before you buy it. This is screening, which means narrowing the field down to the few options worth paying an engineer to check.'}
    ]
  },
  {
    id: 'primer-problem',
    eyebrow: 'The reason it exists',
    title: 'The mistake this is here to prevent',
    blocks: [
      {p: 'Equipment that works beautifully in one climate can be close to useless in another. A brochure will not tell you that, because the brochure is the same in every state.'},
      {p: 'The clearest case is a wet wall, also called an evaporative pad. It is a wet mat of stiff cardboard or plastic across one end of the greenhouse. Fans pull outside air through the wet mat, water evaporates off it, and evaporating water takes heat out of the air. You get cooler air, and you pay for it in water and in humidity.'},
      {p: 'Here is the catch. Air can only hold so much water at a given temperature. If the air outside is already close to full, almost nothing evaporates off the mat, so almost nothing gets cooled. A wet wall does not fight humidity. It feeds it.'},
      {p: 'So in a hot dry place a wet wall buys real cooling that nothing cheaper can buy. In a hot humid place it barely cools at all, and it adds water to a house that already has too much of it.'},
      {study: 'padVent'},
      {p: 'Same machine, same ten years, two American cities. The row that matters is the last one: the hours when the outside air was too hot to help you, and the wall could still hand you air cool enough to hold your band. One of these cities has thousands of those hours a year. The other has almost none. That gap is the climate, not the product, and it is the thing the brochure leaves out.'}
    ]
  },
  {
    id: 'primer-two-tools',
    eyebrow: 'Two tools, two questions',
    title: 'A wet wall and an open window are not the same thing',
    blocks: [
      {p: 'Using the weather to hold your climate is really two separate offers, and they should not be judged as one.'},
      {p: 'Opening the vents helps when the outside air is already better than the air inside: cooler, or drier, or both. In those hours a fan is the cheapest machine on the property.'},
      {p: 'A wet wall works on that same outside air, and it does one extra thing. It hands you air colder than the weather is, because evaporating water into dry air chills it. How much colder depends entirely on how dry the air already is.'},
      {p: 'Measuring the two separately across all six sites turned up something sharper than the usual advice. There was no hour anywhere in the record where the wall was useful and opening up was not. Wherever the wall worked, a vent worked too.'},
      {p: 'So a wet wall is not an alternative to a vent. It is a way to push vent air colder than the weather allows. The only hours it genuinely buys you are the hours when the outside air is too hot for a vent on its own to hold your band, and it can still be pushed cold enough to hold it. Everywhere else it is doing a job a fan was already doing.'},
      {p: 'The wall also has a second job that has nothing to do with cooling. When the outside air is drier than the crop can stand, the water the wall puts into the air is the point rather than a side effect. At a desert site that is a large part of the wall\u2019s working year, and the study counts those hours separately too.'},
      {p: 'So the tool scores the two tools apart: hours only the wall helps, hours only opening up helps, hours both help, and hours neither one is any use. Rolling them into a single number hides every one of those cases.'},
      {study: 'toolSplit'}
    ]
  },
  {
    id: 'primer-tradeoff',
    eyebrow: 'The trade',
    title: 'The choice you actually have to make',
    blocks: [
      {p: 'Plants live in a range, not at a point. Lettuce does not need exactly 22 degrees. It needs to be somewhere inside a band, most of the time.'},
      {p: 'How wide you draw that band is your decision, and it is the expensive one. The narrower the band you insist on holding, the more equipment you have to buy, and the more it costs to run every hour of the year. Tight bands are bought, not wished for.'},
      {p: 'Widening what you are willing to live with is a real way to save money, and a legitimate one. A wider band means fewer machines, a smaller bill, and some hours where the crop is warmer or damper than ideal. Only you know which of those your crop and your buyer will accept.'},
      {p: 'That trade is the whole reason this tool exists. It cannot make the choice for you. It can tell you what each choice would have cost in weather that really happened.'},
      {note: 'One thing to watch when you compare numbers. The share of hours inside the band is only comparable between two machines judged on the same band. Widen the band and every machine looks better, without a single screw being turned.'}
    ]
  },
  {
    id: 'primer-ladder',
    eyebrow: 'The equipment',
    title: 'Seven steps, from cheap and limited to expensive and capable',
    blocks: [
      {p: 'Equipment arrives in packages, not as loose parts, so the study groups it into classes. Each step up can hold conditions the step below cannot, and each step costs more to buy and usually more to run.'},
      {study: 'installed'},
      {ladder: LADDER},
      {note: 'One option the study rejects outright: the same sealed room with no insulation. In all six climates it pays the insulated room\u2019s electricity bill and a greenhouse\u2019s heating bill at the same time (docs/CLASSES.md). It is also the most commonly available building, which is why it is worth saying out loud.'},
      {links: [{href: 'docs/CLASSES.md', label: 'docs/CLASSES.md \u2197', note: 'Every class in full, what each one achieved at all six sites, and the rule that promotes you to the next step:'}]}
    ]
  },
  {
    id: 'primer-climates',
    eyebrow: 'Matching the two',
    title: 'Which class suits which climate',
    blocks: [
      {p: 'The study runs the same six equipment packages at six real sites, ten years of weather each. In plain terms, this is what the climates ask for.'},
      {climates: CLIMATE_LINES},
      {p: 'And this is what the study itself picked, read from the study file as this page loaded:'},
      {study: 'verdicts'},
      {p: 'Where the study does not pick a winner, that is the answer, not a missing feature. Two packages within a few percent of each other on running cost are a tie at this level of evidence. The way to break a tie is to measure your own crop and your own building, not to run the model again.'}
    ]
  },
  {
    id: 'primer-limits',
    eyebrow: 'Honesty',
    title: 'What this is not',
    blocks: [
      {list: [
        'Not a forecast. Past weather is a sample of what a place does, not a promise about what next year does.',
        'Not a prediction about your building. Every run stands on assumptions about the crop, the walls and the machines. Change one assumption and the answer moves.',
        'Not equipment sizing. Nothing here tells you which model to order or how many kilowatts to install.',
        'Not a substitute for a mechanical engineer. It is for narrowing the field before you hire one, so their time goes on the question that matters.',
        'Not a yield claim, not a price quote, and not a comparison between manufacturers.'
      ]},
      {note: 'The evidence tier here is assumption-based screening on historical weather. Ten observed years are ten years that happened, not a sample drawn from a settled distribution: the gap between the best and the worst of them is a range that occurred, not a confidence interval and not a design year.'}
    ]
  },
  {
    id: 'primer-next',
    eyebrow: 'Next',
    title: 'Where to go from here',
    blocks: [
      {p: 'Run your own location. The Analyze view does exactly what this page describes, on the weather for the place you care about, and it shows its working at every step.'},
      {actions: [
        {label: 'Open the Analyze view', go: 'analyze'},
        {label: 'Read how each number is computed', go: 'deeper'}
      ]},
      {links: [
        {href: 'docs/CLASSES.md', label: 'docs/CLASSES.md \u2197', note: 'The equipment classes, measured at six sites:'},
        {href: 'docs/REGIONS.md', label: 'docs/REGIONS.md \u2197', note: 'The ten-year, six-region study region by region, with the reasoning and the limits:'}
      ]}
    ]
  }
];

/* ---------- One-pager rendering ---------- */

/** Figures that describe a climate are never written into PRIMER. A `study` block renders an empty host
    here, and the host is filled when docs/regional-study.json arrives, or filled with a plain sentence
    saying why it is empty when it does not. */
const primerSlots = [];

/* The exact field names the engine writes per region, each with its predecessor as a fallback, because
   the study file is regenerated independently of this page. A row appears only when the study carries a
   field for it, so nothing is ever invented and nothing is ever stale. `brief` rows also appear in the
   all-sites table. The "only the wall" row is last, because the copy above points at the last row. */
const DEEPER_KEYS = ['padDeeperThanVentHoursMedian', 'padEffectiveHoursMedian'];
const HOUR_ROWS = [
  {keys: ['padUsefulHoursMedian'], label: 'Hours a wet wall would have helped in some way', brief: true},
  {keys: ['padCoolingHoursMedian'], label: 'Of those, hours it helped by cooling'},
  {keys: ['padHumidifyingHoursMedian'], label: 'Of those, hours it helped by adding water to air too dry for the crop'},
  {keys: ['ventUsefulHoursMedian'], label: 'Hours opening up would have helped in some way', brief: true},
  {keys: ['ventCoolingHoursMedian'], label: 'Of those, hours the outside air was cooler than the band'},
  {keys: ['ventDryingHoursMedian'], label: 'Of those, hours the outside air was drier than the ceiling'},
  {keys: ['bothUsefulHoursMedian', 'padAndVentHoursMedian'], label: 'Hours both tools would have helped', brief: true},
  {keys: ['neitherUsefulHoursMedian'], label: 'Hours neither tool was any use', brief: true},
  {keys: ['freeCoolingHoursMedian'], label: 'Hours the weather alone could hold the whole band, with nothing but fans'},
  {keys: DEEPER_KEYS, label: 'Hours only the wall could hold the band, because the outside air was too hot for a vent to help', brief: true}
];

function pickField(weather, keys) {
  for (const key of keys) if (finite(weather?.[key])) return {key, value: weather[key]};
  return null;
}

const regionName = region => text(region?.label) || text(region?.key) || 'Unnamed site';
const regionClimate = region => text(region?.climate) || 'climate not stated';
const liveRows = (regions, rows = HOUR_ROWS) => rows.filter(row => regions.some(region => pickField(region.weather, row.keys)));
const briefRows = regions => liveRows(regions, HOUR_ROWS.filter(row => row.brief));

function fieldsRead(regions, rows) {
  const keys = [];
  for (const row of rows) for (const region of regions) {
    const found = pickField(region.weather, row.keys);
    if (found && !keys.includes(found.key)) keys.push(found.key);
  }
  return keys;
}

function hourTable(columns, rows, regions) {
  const wrap = node('div', undefined, 'table-wrap');
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const first = node('th', 'In a middle year of the ten');
  first.scope = 'col';
  headRow.append(first);
  for (const region of columns) {
    const th = node('th', `${regionName(region)} (${regionClimate(region)})`);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.append(node('td', row.label, 'row-name'));
    for (const region of columns) {
      const found = pickField(region.weather, row.keys);
      tr.append(node('td', found ? hours(found.value) : 'Not in the study', 'mono'));
    }
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  const keys = fieldsRead(regions, rows);
  wrap.append(node('p', `Read from ${STUDY_URL} when this page loaded${keys.length ? `: ${keys.join(', ')}` : ''}. A middle year of the ten is the median: half the years are higher, half lower.`, 'source-line'));
  return wrap;
}

/** The headline pair, ranked on the hours the wall is genuinely necessary rather than merely also
    working, which is the measurement that separates a dry climate from a humid one. Phoenix against
    Miami when the study carries both, because that pair is the point; otherwise the widest pair the
    study actually has, so the page is never wrong about its own example. */
function padVentSlot(study, regions) {
  const wrap = document.createElement('div');
  const rated = regions.map(region => ({region, deeper: pickField(region.weather, DEEPER_KEYS)})).filter(entry => entry.deeper);
  if (rated.length < 2) {
    wrap.append(node('p', `${STUDY_URL} carries no wet-wall hour counts, so no site pair is quoted here. The physical point above stands on its own: a wet wall needs dry air.`, 'help'));
    return wrap;
  }
  const byKey = key => rated.find(entry => entry.region.key === key);
  const sorted = [...rated].sort((a, b) => b.deeper.value - a.deeper.value);
  const dry = byKey('phoenix') || sorted[0];
  const humid = byKey('miami') || sorted[sorted.length - 1];
  const columns = [dry.region, humid.region];
  wrap.append(hourTable(columns, liveRows(columns), regions));
  // The ratio is taken from the rounded hours on screen, so a reader who divides the two rows gets the
  // same answer this sentence gives.
  const dryHours = Math.round(dry.deeper.value), humidHours = Math.round(humid.deeper.value);
  const ratio = humidHours > 0 ? Math.round(dryHours / humidHours) : null;
  if (ratio && ratio > 1) {
    wrap.append(node('p', `That is about ${num(ratio)} times as many hours at ${regionName(dry.region)} as at ${regionName(humid.region)}, for the same crop and the same band.`, 'learn-say'));
  }
  const moist = pickField(dry.region.weather, ['padHumidifyingHoursMedian']);
  const cool = pickField(dry.region.weather, ['padCoolingHoursMedian']);
  if (moist && cool) {
    const more = moist.value > cool.value;
    wrap.append(node('p', `Notice the other thing the dry site shows. At ${regionName(dry.region)} the wall is useful for adding water in ${hours(moist.value)} of a median year and for cooling in ${hours(cool.value)}, so it spends ${more ? 'more' : 'less'} of its working year putting moisture into air that was too dry for the crop than it spends taking heat out.`, 'learn-say'));
  }
  return wrap;
}

/** Every bundled site, on whichever of the summary counts the study reports. The per-site table carries
    the headline rows only; the two-site table above carries the full breakdown. */
function toolSplitSlot(study, regions) {
  const wrap = document.createElement('div');
  const rows = briefRows(regions);
  if (!rows.length) {
    wrap.append(node('p', `${STUDY_URL} carries none of these hour counts, so nothing is tabulated here.`, 'help'));
    return wrap;
  }
  const table = node('div', undefined, 'table-wrap');
  const element = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Site', 'Climate', ...rows.map(row => row.label)]) {
    const th = node('th', label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const region of regions) {
    const tr = document.createElement('tr');
    tr.append(node('td', regionName(region), 'row-name'), node('td', regionClimate(region)));
    for (const row of rows) {
      const found = pickField(region.weather, row.keys);
      tr.append(node('td', found ? hours(found.value) : 'Not in the study', 'mono'));
    }
    body.append(tr);
  }
  element.append(head, body);
  table.append(element);
  wrap.append(table);
  const subset = subsetNote(regions);
  if (subset) wrap.append(subset);
  const keys = fieldsRead(regions, rows);
  wrap.append(node('p', `Read from ${STUDY_URL}${keys.length ? `: ${keys.join(', ')}` : ''}. Where a column says it is not in the study, the study does not measure it yet and this page will not guess it.`, 'source-line'));
  return wrap;
}

/** The subset result, checked against the file rather than asserted: the hours a wall helps are the same
    hours a vent helps at every site, which is why the wall is a way of pushing vent air colder and not
    an alternative to a vent. Printed only while the two columns really do match. */
function subsetNote(regions) {
  const pairs = regions.map(region => ({
    pad: pickField(region.weather, ['padUsefulHoursMedian']),
    both: pickField(region.weather, ['bothUsefulHoursMedian', 'padAndVentHoursMedian'])
  })).filter(pair => pair.pad && pair.both);
  if (pairs.length < regions.length || !pairs.length) return null;
  if (!pairs.every(pair => Math.round(pair.pad.value) === Math.round(pair.both.value))) return null;
  return node('p', 'Compare the wet-wall column with the column for both tools. At every site they are the same number. There is no hour in the whole record where the wall would have helped and opening a vent would not, which is the measured version of the point above.', 'learn-say');
}

/** The cost spread of the packages, from the study\u2019s own declared installed costs. */
function installedSlot(study) {
  const wrap = document.createElement('div');
  const priced = (Array.isArray(study?.method?.scenarios) ? study.method.scenarios : [])
    .filter(entry => entry && finite(entry.installedCostUsd))
    .sort((a, b) => a.installedCostUsd - b.installedCostUsd);
  if (priced.length < 2) {
    wrap.append(node('p', `${STUDY_URL} declares no installed costs, so no price range is quoted here.`, 'help'));
    return wrap;
  }
  const low = priced[0], high = priced[priced.length - 1];
  const ratio = low.installedCostUsd > 0 ? Math.round(high.installedCostUsd / low.installedCostUsd) : null;
  wrap.append(node('p', `The study packages span ${text(low.label) || low.id}: ${capitalBasisText({installedCost:low.installedCostUsd,installedCostBasis:low.installedCostBasis})} To ${text(high.label) || high.id}: ${capitalBasisText({installedCost:high.installedCostUsd,installedCostBasis:high.installedCostBasis})}${ratio ? ` The larger capital input is about ${ratio} times the smaller.` : ''}`, 'learn-say'));
  wrap.append(node('p', `Read from ${STUDY_URL} when this page loaded.`, 'source-line'));
  return wrap;
}

/** What the study picked per region, and how many regions it declined to decide. Both are read from the
    file: this page never asserts a recommendation the study does not carry. */
function verdictsSlot(study, regions) {
  const wrap = document.createElement('div');
  const named = id => {
    for (const region of regions) {
      const match = (region.strategies || []).find(row => row?.id === id);
      if (match) return text(match.label) || text(id) || 'an unnamed package';
    }
    const scenario = (study?.method?.scenarios || []).find(entry => entry?.id === id);
    return text(scenario?.label) || text(id) || 'an unnamed package';
  };
  const undecided = regions.filter(region => region.verdict && region.verdict.recommended == null);
  wrap.append(node('p', `In ${num(undecided.length)} of the ${num(regions.length)} bundled regions the evidence does not pick a winner. That is an honest result, not a missing feature: those packages are too close together for this evidence to separate.`, 'learn-say'));
  const list = document.createElement('dl');
  list.className = 'learn-pairs';
  for (const region of regions) {
    const verdict = region.verdict;
    const cell = document.createElement('div');
    let line;
    if (!verdict) line = 'The study file carries no verdict for this region, so none is shown.';
    else if (verdict.recommended != null) line = `The study picks ${named(verdict.recommended)}.`;
    else {
      const candidates = (verdict.candidates || []).map(named);
      const gap = finite(verdict.marginPct) ? ` They differ by ${pct(verdict.marginPct)} in running cost, which is inside the band where this evidence cannot tell them apart.` : '';
      line = candidates.length
        ? `No winner. ${candidates.join(' and ')} are left unseparated.${gap}`
        : `No winner. The study leaves this region undecided.${gap}`;
    }
    cell.append(node('dt', `${regionName(region)} (${regionClimate(region)})`), node('dd', line));
    list.append(cell);
  }
  wrap.append(list);
  wrap.append(node('p', `Read from ${STUDY_URL} when this page loaded. The reasoning behind each line, and the caveats it carries, are in the regional section under Go deeper and in docs/REGIONS.md.`, 'source-line'));
  return wrap;
}

const SLOTS = {
  padVent: {build: padVentSlot, loading: 'Reading the wet-wall hour counts from the study\u2026'},
  toolSplit: {build: toolSplitSlot, loading: 'Reading the hour counts for both tools from the study\u2026'},
  installed: {build: installedSlot, loading: 'Reading the declared installed costs from the study\u2026'},
  verdicts: {build: verdictsSlot, loading: 'Reading the regional verdicts from the study\u2026'}
};

function slotHost(kind) {
  const host = node('div', undefined, 'learn-figures');
  host.dataset.learnSlot = kind;
  host.append(node('p', SLOTS[kind]?.loading || `Reading ${STUDY_URL}\u2026`, 'help'));
  primerSlots.push({kind, host});
  return host;
}

/** Fills every slot from one study object. A slot that throws says so rather than showing half a table. */
function fillPrimerStudy(study, regions) {
  for (const slot of primerSlots) {
    const build = SLOTS[slot.kind]?.build;
    if (!build) continue;
    try {
      slot.host.replaceChildren(build(study, regions));
    } catch (error) {
      slot.host.replaceChildren(node('p', `This figure could not be read from ${STUDY_URL}: ${error.message}. Nothing is shown in its place.`, 'help'));
    }
  }
}

/** Empties every slot with the reason, so a missing study is visible as a missing study here too. */
function clearPrimerStudy(reason) {
  for (const slot of primerSlots) {
    slot.host.replaceChildren(node('p', `No figures are shown here because the study was not read. ${reason}`, 'help'));
  }
}

function ladderList(rungs) {
  const list = document.createElement('ol');
  list.className = 'learn-ladder';
  rungs.forEach((rung, index) => {
    const item = document.createElement('li');
    const head = node('p', undefined, 'learn-rung-head');
    head.append(node('span', String(index + 1).padStart(2, '0'), 'learn-num mono'),
      node('span', rung.name, 'learn-rung-name'),
      node('span', rung.code, 'summary-meta'));
    item.append(head, node('p', rung.can, 'learn-rung-can'), node('p', `What defeats it: ${rung.defeat}`, 'learn-rung-defeat'));
    list.append(item);
  });
  return list;
}

function pairsList(lines) {
  const list = document.createElement('dl');
  list.className = 'learn-pairs';
  for (const line of lines) {
    const cell = document.createElement('div');
    cell.append(node('dt', `${line.place} (${line.site})`), node('dd', line.says));
    list.append(cell);
  }
  return list;
}

function bulletList(items) {
  const list = document.createElement('ul');
  list.className = 'learn-points';
  for (const item of items) list.append(node('li', item));
  return list;
}

function actionRow(actions) {
  const row = node('div', undefined, 'learn-actions');
  for (const action of actions) {
    const button = node('button', action.label);
    button.type = 'button';
    button.dataset.learnGo = action.go;
    button.addEventListener('click', () => {
      if (action.go === 'analyze') showView('analyze', {hash: true, restore: false});
      else openDeeper({scroll: true});
    });
    row.append(button);
  }
  return row;
}

function linkLine(links) {
  const wrap = document.createElement('div');
  for (const entry of links) {
    const line = node('p', undefined, 'source-line');
    const anchor = node('a', entry.label);
    anchor.href = entry.href;
    line.append(document.createTextNode(`${entry.note} `), anchor);
    wrap.append(line);
  }
  return wrap;
}

function primerBlock(block) {
  if (block.p) return node('p', block.p, 'learn-say');
  if (block.note) return node('p', block.note, 'help');
  if (block.list) return bulletList(block.list);
  if (block.ladder) return ladderList(block.ladder);
  if (block.climates) return pairsList(block.climates);
  if (block.study) return slotHost(block.study);
  if (block.actions) return actionRow(block.actions);
  if (block.links) return linkLine(block.links);
  return null;
}

function primerSection(section) {
  const element = node('section', undefined, 'learn-part');
  element.id = section.id;
  const heading = node('div', undefined, 'learn-part-head');
  heading.append(node('p', section.eyebrow, 'eyebrow'), node('h3', section.title));
  element.append(heading);
  for (const block of section.blocks) {
    const built = primerBlock(block);
    if (built) element.append(built);
  }
  return element;
}

function primerNode() {
  const wrap = node('div', undefined, 'learn-primer');
  for (const section of PRIMER) wrap.append(primerSection(section));
  return wrap;
}

/* ---------- The "Go deeper" disclosure ---------- */

const DEEPER_ID = 'learn-deeper';
const DEEPER_TITLE = 'Go deeper: how each number is computed';
const DEEPER_META = 'Ten technical sections. The concept, the arithmetic, a figure measured in this repository, and the caveat that travels with it.';
let deeper = null;
const workedHosts = [];

/** Opens the technical area, and optionally scrolls to it. A module route opens this first, because a
    <details> inside a closed <details> has no box on screen to scroll to. */
function openDeeper({scroll = false} = {}) {
  if (!deeper) return false;
  deeper.open = true;
  if (scroll) deeper.scrollIntoView({block: 'start', behavior: still() ? 'auto' : 'smooth'});
  return true;
}

/** index.html belongs to another owner, so the three lines of static copy in it that announced a ten
    module curriculum are rewritten here, at init, to announce the page this view now opens on. Text
    only: no element is added, removed or restyled. */
const INTRO_COPY = [
  ['#learn-view .learn-intro .subtitle', 'One page, in plain words: what this tool does, what it stops you buying by mistake, and what it cannot promise. The technical sections are underneath, for whoever wants them.'],
  ['#learn-view .intro-note', 'Plain words first. Then the detail, if you want it. Always what it cannot prove.'],
  ['#learn-curriculum-title', 'Start here'],
  ['#learn-view .learn-shell > .help', 'Read straight down. Nothing on this page needs a background in heating and cooling. Figures that describe a climate are read from docs/regional-study.json when the page loads, and figures quoted from a document name that document beside them.']
];

function patchIntro() {
  let patched = 0;
  for (const [selector, copy] of INTRO_COPY) {
    const element = document.querySelector(selector);
    if (!element) continue;
    element.textContent = copy;
    patched += 1;
  }
  return patched;
}

/** The curriculum. Nine modules, in teaching order. Each one states the concept in plain language, then
    the arithmetic or physical relationship explicitly, then a worked number already published here, then
    the caveat that belongs with the concept rather than in a footnote. `show` names the panel in the
    Analyze view where the concept is visible; `needsRun` marks a panel that a run has to create first. */
export const MODULES = [
  {
    key: 'outdoor-state',
    steps: [1, 4],
    title: 'Reading the outdoor state',
    meta: 'Dry bulb, dew point, wet bulb, humidity ratio, VPD',
    lede: [
      'Five numbers describe the air outside, and they are not independent. Dry-bulb temperature is what a thermometer reads. Dew point and humidity ratio are two ways of saying how much water the air actually carries. Wet bulb is the lowest temperature reachable by evaporating water into that air, so it is the floor under every evaporative process. Vapour pressure deficit is the drying power the air has at its own temperature, which is what the crop responds to.',
      'Relative humidity is the one to design away from. It is a ratio against saturation at the current temperature, so it moves when you heat or cool the air without one gram of water entering or leaving. 70% relative humidity at 5 °C and 70% at 30 °C are different problems, because the warm hour carries several times the water. This tool takes the weather record\u2019s relative humidity as the authoritative input, because that is what the source publishes, and converts it at once into dew point, humidity ratio and wet bulb at the hour\u2019s own station pressure.'
    ],
    formula: 'VPD_kPa = p_sat(T_dryBulbC) - p_vapour(humidityRatio, pressurePa)',
    formulaNote: 'airVPD in src/physics.js: saturation vapour pressure at air temperature minus the actual vapour pressure implied by the humidity ratio and the total pressure, on the pinned PsychroLib 2.5.0 formulations. Canopy temperature is assumed equal to air temperature, so this is air VPD, not leaf-to-air VPD. Wet bulb is evaluated at the hour\u2019s actual station pressure, never at a sea-level assumption.',
    worked: [
      {label: 'Mean summer afternoon dew point, Phoenix against Miami', value: '6.4 °C against 24.8 °C, a gap of 18.4 K', source: 'docs/CLIMATES.md'},
      {label: 'Mean summer wet bulb at Miami, against peak summer wet bulb at Phoenix', value: '26.1 °C against 24.8 °C', source: 'docs/CLIMATES.md'},
      {label: 'Station pressure at Denver, 2,094.96 m source elevation', value: '76.4 to 80.4 kPa, 75 to 79% of the 101.325 kPa sea-level standard', source: 'docs/CLIMATES.md'}
    ],
    caveat: 'Miami\u2019s average summer wet bulb sits above Phoenix\u2019s hottest-hour wet bulb, so the evaporative-cooling question is settled by the outdoor state before any equipment is chosen. Denver shows why pressure is not a constant: assume sea level there and humidity ratio, enthalpy, wet bulb and fan mass flow are all wrong at once.',
    show: {target: 'inspector-panel', label: 'Show me the hourly inspector', needsRun: true, first: 'In the Analyze view: retrieve a weather year, or select one already cached under Weather years, then confirm each scenario’s outdoor-air review below Run all scenarios and run the comparison. The inspector walks the record hour by hour and reports the outdoor state behind every number.'}
  },
  {
    key: 'target-band',
    steps: [5, 6],
    title: 'The joint band, and what attainment is a percentage of',
    meta: 'Eligible hours, warm-up, partial hours',
    lede: [
      'The target is three bounds held at once: air temperature within tolerance of the scheduled day or night target, VPD between a minimum and a maximum, and dew point at or below a ceiling. Joint means simultaneously, not each in turn. Inside the model the three collapse into a temperature window and a humidity-ratio window whose upper bound is the lower of the VPD maximum and saturation at the dew-point ceiling, so the tighter of those two is what actually binds.',
      'Attainment is not a share of the calendar. The denominator is eligible hours: hours whose outdoor state parsed, passed range checks and produced a finite result, and which are not the warm-up hour that starts every continuous weather segment. Missing and failed hours are excluded from numerator and denominator alike rather than counted as failures, which is why attainment is read next to the valid-hours metric and never on its own.'
    ],
    formula: 'compliancePct = 100 * compliantHours / eligibleHours,   eligible = valid && eligible !== false && !warmup',
    formulaNote: 'summarizeHours in src/metrics.js. compliantHours accumulates compliantFraction, the share of an hour\u2019s sampled control substeps inside the band, so an hour that fails for ten minutes contributes a partial hour and not a zero. Cross-scenario comparisons intersect the eligible sets of every compared scenario, so two strategies are always scored over identical hours.',
    worked: [
      {label: 'Pad-and-vent baseline across ten Tulsa years', value: 'joint temperature-and-moisture target attainment: median 28.038% of eligible hours; observed worst 22.589% and best 30.315%, a 7.726 percentage-point (pp) difference', source: 'docs/regional-study.json'},
    ],
    caveat: 'A wider band raises attainment without changing the building. That makes attainment comparable between strategies on one band and not comparable between two different bands. Warm-up hours keep their energy and water in the individual totals, because that energy really was spent, but they carry no compliance at all.',
    show: {target: 'headline-metrics', label: 'Show me the four headline numbers', needsRun: true, first: 'In the Analyze view: retrieve a weather year, or select one already cached under Weather years, then confirm each scenario’s outdoor-air review below Run all scenarios and run the comparison. Attainment is shown as equivalent compliant hours over eligible hours, with valid hours beside it.'}
  },
  {
    key: 'free-cooling',
    steps: [7, 9],
    title: 'What the climate gives free',
    meta: 'Free cooling, wet-bulb depression, pad viability',
    lede: [
      'Before choosing equipment, count the hours the outside air could do the job alone. A free-cooling hour is not simply a cool hour: the weather-side screen requires outside air below the target by the ventilation margin, a drying margin against the moisture ceiling, and outdoor enthalpy below the target enthalpy, all at the same time.',
      'An evaporative pad extends that window only as far as the wet-bulb depression allows, because a pad cannot cool below the wet bulb, and it pays for the sensible cooling it delivers with the moisture it adds. Where the air is already near saturation there is no depression to trade, and a better pad buys nothing.'
    ],
    formula: 'padTempC = tempC - effectiveness * (tempC - wetBulbC),   depression = tempC - wetBulbC',
    formulaNote: 'padState in src/physics.js, an approximately isoenthalpic process clamped at saturation. The weather screen calls an hour PAD_EFFECTIVE only when pad leaving air clears both the temperature margin and the moisture ceiling; clearing the ceiling but not the margin is PAD_MARGINAL, and neither is PAD_INEFFECTIVE_DEHU_NEEDED, with the failing limit recorded. FREE_COOLING_MODES in src/metrics.js is PASSIVE_VENT_COOL_DRY plus PAD_EFFECTIVE.',
    worked: [
      {label: 'Median weather-side free-cooling hours, 2016 to 2025', value: 'Tulsa 342 h against Phoenix 2,577.5 h, not simulated indoor attainment', source: 'docs/regional-study.json'},
      {label: 'Median pad-effective hours over those same ten weather years', value: 'Tulsa 205 h against Phoenix 2,274 h; actual runtime is a separate coupled-model output', source: 'docs/regional-study.json'}
    ],
    caveat: 'Free cooling is an outside-air capability count, not a claim that fans or tempering are free. A small pad opportunity count can mean humid supply, little cooling demand or prolonged cold weather; inspect the active constraint rather than assigning one cause to every climate.',
    show: {target: 'runtime-table', label: 'Show me the pad-viability screen', needsRun: true, fallbacks: ['tier-tabs'], first: 'In the Analyze view: confirm each scenario’s outdoor-air review below Run all scenarios, run the comparison, then switch the evidence tier to Weather only. The runtime table becomes the pad-viability screen, splitting cooling-demand hours into effective, marginal and ineffective with the limit that bound.'}
  },
  {
    key: 'sensible-latent',
    title: 'Sensible against latent, and the cost of coupling them',
    meta: 'Sensible-heat ratio, overcooling, reheat',
    lede: [
      'Two loads arrive together. Sensible load is heat: solar through the glazing, fixture power, envelope conduction, infiltration, ventilation and fans. Latent load is water: crop transpiration plus whatever moisture the air you admit brings with it. Equipment does not get to choose which of the two it meets.',
      'A cooling coil removes water by cooling air below its dew point, which can require reheat to meet a sensible supply target. A DOAS separates outdoor-air conditioning from zone sensible cooling, but still buys cooling and any unrecovered heat. It is not automatically dry or neutral: actual supply conditions depend on inlet air and finite heating capacity.',
    ],
    formula: 'SHR = sensibleGainKWh / (sensibleGainKWh + LATENT_KWH_PER_KG * cropLatentKg)',
    formulaNote: 'Space sensible-heat ratio in src/metrics.js, where the latent conversion is the latent heat of vaporization in kWh/kg. A low SHR is the physical argument for decoupled moisture control over coupled cooling with reheat. Hours with no positive gain produce no SHR rather than a zero. The DX input named coolingSHR is a different quantity, the coil\u2019s own split, screened 0.65 to 0.85.',
    worked: [
      {label: 'DOAS comparison withdrawn', value: 'Earlier decoupling results omitted sensible supply-conditioning energy. Configure reviewed treatment flow, dew point, temperature, COP and reheat recovery, then compare a new run; no earlier DOAS savings claim remains valid.', source: 'docs/examples/README.md'},
    ],
    caveat: 'The decoupling verdict is a price ratio, not a property of the equipment. Moving purchased energy between electricity and fuel can improve modeled operating cost at one price ratio and worsen it at another; any attainment difference needs both eligible-hour endpoints, and the electricity-to-fuel ratio is an editable input here, not a measured quantity.',
    show: {target: 'loads-panel', label: 'Show me the sensible and latent decomposition', needsRun: true, fallbacks: ['tier-tabs'], first: 'In the Analyze view: confirm each scenario’s outdoor-air review below Run all scenarios, run the comparison and stay on the Equipment estimate tier. The load decomposition is a model balance, so it is hidden in the Weather only view.'}
  },
  {
    key: 'outside-air',
    steps: [10, 10],
    title: 'Outside air as a dehumidifier',
    meta: 'Removal potential, cost per kilogram, the hidden heat',
    lede: [
      'When outside air carries less water than the zone\u2019s moisture ceiling allows, ventilation removes water, and the cheapest dehumidifier on the site is a fan. The tool counts those hours and prices them: the drying margin times the air mass the scenario can actually move gives a removal potential in kg/h, then fan power plus any heating needed to temper the incoming air gives energy per kilogram and cost per kilogram, against a condensing-dehumidifier reference.',
      'The count is split into cool and dry, cold and dry, and hot and dry, because those three are not the same offer. Cold and dry air is free water removal that arrives with a heating bill; hot and dry air is free water removal that arrives with a cooling bill.'
    ],
    formula: 'removalKgPerH = massFlowKgPerH * (w_ceiling - w_outdoor),   costPerKg = (fanKWh + temperingKWh) * price / removalKg',
    formulaNote: 'outdoorDryingHour in src/physics.js, evaluated at the scenario\u2019s maximum ventilation rate. It is a weather-side screen, not a dispatch decision: the coupled controller still decides what runs in the hour.',
    worked: [
      {label: 'Outside-air drying is conditional', value: 'The earlier Tulsa per-kilogram advantage count is historical. Read actual fan, conditioning and finite heating inputs before comparing a current run; low outdoor humidity alone does not establish an operating-cost reduction.', source: 'docs/COMPONENT-PARAMETERS.md'}
    ],
    caveat: 'The hot-and-dry hours import sensible heat that this table does not cost, so they are cheap only in the moisture account: read them against a separate cooling plan, or ventilation becomes the reason the temperature bound fails. A removal potential is also what the installed fans could move, not what the controller chose to do, so it is an upper bound on the opportunity and not a saving already banked.',
    show: {target: 'drying-table', label: 'Show me the outside-air screen', needsRun: true, first: 'In the Analyze view: retrieve a weather year, or select one already cached under Weather years, then confirm each scenario’s outdoor-air review below Run all scenarios and run the comparison. The outside-air table gives hours, days, mean removal potential and energy and cost per kilogram.'}
  },
  {
    key: 'equipment-frontier',
    title: 'Equipment classes, finite capacity and the frontier',
    meta: 'Dominance, operating cost, unmet load',
    lede: [
      'Every strategy here is a class with finite capacity, not a product. When an hour needs more than the class can deliver, the shortfall is recorded as unmet load rather than quietly met, which is why a high attainment figure is a statement about installed capacity at least as much as about control.',
      'Strategies are then compared on two axes only: operating cost over the period, and hours inside the band. A strategy is dominated when another is at least as cheap and holds the band at least as often, with at least one strict inequality. The frontier is what nothing dominates. Capital recovery and maintenance are shown separately and never enter that test, because they answer a different question.'
    ],
    formula: 'dominated(a) if there exists b with cost_b <= cost_a and compliantHours_b >= compliantHours_a, at least one strict',
    formulaNote: 'compareScenarios in src/metrics.js, scored on the common eligible hour set; strategyFrontier applies the same rule to median cost and median attainment across weather years. A scenario with missing prices or numerical-failure hours is not comparable and is excluded rather than assumed.',
    worked: [
      {label: 'Cheapest non-dominated strategy', value: 'the pad baseline, in 100% of the 104 points', source: 'docs/SENSITIVITY.md'},
      {label: 'Current canonical Tulsa 2025 comparison', value: 'DX plus dehumidifier reaches 73.066% joint attainment against the pad baseline at 27.135%, a 45.931 pp increase on the same 8,759 eligible hours. This is not an opaque-room or full-library ranking.', source: 'docs/browser-run-metrics.json'}
    ],
    caveat: 'Cheapest on the frontier is a position on the operating-cost axis, not a recommendation. Capacity and target attainment still matter. Close modeled rankings require project measurements, capital, maintenance and redundancy review; the retained regional decision bands are methodological choices, not calibrated ties.',
    show: {target: 'comparison-table', label: 'Show me the investment screen and the frontier', needsRun: true, fallbacks: ['tier-tabs'], first: 'In the Analyze view: add a second strategy, run, and stay on the Equipment estimate tier. The frontier column marks which strategies are operating-dominated, capital excluded.'}
  },
  {
    key: 'screens',
    title: 'Screens and curtains are a schedule, not a capacity',
    meta: 'Shade, thermal curtain, the humidity penalty',
    lede: [
      'A shade screen and a thermal curtain are bought once and then decided hourly, so the design question is never whether to own one, it is which hours to close it. A shade screen multiplies incoming shortwave and PAR by the same factor unless you supply product spectra, so every joule of solar heat it keeps out is crop light it also takes away. That is why the screen in the shipped example is light-guarded: it refuses to close while the crop is still short of its daily light target.',
      'A thermal curtain multiplies the envelope loss coefficient while it is shut, which is pure benefit for heating, with one catch. A shut curtain also restricts the outside-air path that was carrying crop moisture away, and the crop keeps transpiring behind it.'
    ],
    formula: 'curtain shut: U_effective = U * curtainFactor, and the outside-air path falls to the declared closed-gap air exchange (per hour)',
    formulaNote: 'Both screens are scheduled inputs in the grouped assumption fields, so their effect appears as an hour count rather than a rating. The heat-pump alternative in the same example replaces fuel with electricity at a temperature-dependent COP, so it trades one bill for another plus a cold-hour capacity derate.',
    worked: [
      {label: 'Screen comparison evidence status', value: 'Earlier annual screen savings and attainment values are withdrawn as current-model findings. Import the reviewed schema-2 screen set, run matching weather and inspect lost light, delivered heat and joint attainment together.', source: 'docs/examples/README.md'},
      {label: 'Focused physical checks', value: 'The screen and heat-pump checks preserve finite capacity, energy and moisture closure on the one-stream airflow contract; they are not product-performance validation.', source: 'docs/VERIFICATION.md'}
    ],
    caveat: 'Restricting the outside-air path while the crop transpires can trap moisture even when a curtain reduces envelope heat loss. Review moisture as well as temperature and light. Closed-gap exchange is a project input, not a sourced generic value: leaving it null produces an optimistic-moisture warning.',
    show: {target: 'advanced-fields', label: 'Show me the envelope and screen assumptions', needsRun: false, first: null}
  },
  {
    key: 'interannual',
    title: 'One year is an anecdote',
    meta: 'Median, worst year, ranking stability',
    lede: [
      'A single weather year gives one draw of the thing you are designing against. Run several, report the median, the worst year and the spread, and then ask the harder question: does the cost order of the strategies survive the change of year? The across-years rule applied here is the strict one, a single identical order in every year, because a ranking that reshuffles between two ordinary years cannot carry a purchase decision.',
      'The worst observed year is not a design year either. It is the worst of the years you happened to run, and running more years can only make it worse.'
    ],
    formula: 'spreadPts = bestYearPct - worstYearPct,   rankingStable = one identical operating-cost order in every year',
    formulaNote: 'aggregateYears in src/metrics.js. A least-squares trend is reported only once five or more calendar years exist. The tolerant variant of the same rule, used for the Morris design points, calls a ranking stable when the most common order holds in at least 90% of points. Read a stable ranking narrowly: it says the cost order repeated across those weather years, not that the choice survives the assumptions behind it, which is the separate question § 09 asks. A ranking can be reproducible in every year and the decision still unresolved.',
    worked: [
      {label: 'Baseline across ten Tulsa years', value: 'joint temperature-and-moisture target attainment: median 28.038%, worst 22.589%, best 30.315%; observed best-minus-worst difference 7.726 pp', source: 'docs/regional-study.json'},
      {label: 'Operating-cost order across those years', value: 'not stable under the regional 90% rule: two orders, most common in eight of ten years', source: 'docs/regional-study.json'},
      {label: 'Tulsa hours above 30 °C in 2023, 2024, 2025', value: '982, then 1,117, then 634: a 483-hour swing between two neighbouring years at one site', source: 'docs/CLIMATES.md'}
    ],
    caveat: 'The study’s ten years are ten particular weather years, not a stationary probability distribution. Their observed spread is not a forecast, confidence interval or design year. A climatological normal is 30 years, not this ten-year screening record.',
    show: {target: 'years-panel', label: 'Show me the across-years panel', needsRun: true, first: 'In the Analyze view: retrieve two or more years, select them under Weather years, then confirm each scenario’s outdoor-air review below Run all scenarios and run the comparison. Years come from your retrievals or browser cache; no hourly weather archive ships with the tool.'}
  },
  {
    key: 'uncertainty',
    title: 'What actually moves the answer',
    meta: 'Morris screening, mu*, ranking stability',
    lede: [
      'Morris elementary effects answers exactly one question: which assumptions are worth measuring next. It walks one parameter at a time across a grid over the twelve screened parameters, recording the change each single move causes, which makes parameters in different physical units directly comparable because every effect is expressed per full screened range.',
      'The result reorders the work. If the most influential assumption is the crop rather than the machine, then measuring leaf area buys more accuracy than any equipment refinement, and the equipment map can wait.'
    ],
    formula: 'EE = ( y(step j) - y(step j-1) ) / delta,   delta = p / (2 * (p - 1)) = 2/3 in unit-cube space',
    formulaNote: 'mu* is the mean absolute effect, which is the influence ranking; mu is the mean signed effect, which gives the direction; sigma is the spread, where a sigma comparable to mu* flags interaction or non-linearity rather than sampling noise. Eight trajectories over twelve parameters gives n = 8 usable step pairs per parameter and metric, and a pair with a missing metric is dropped rather than zero-filled.',
    worked: [
      {label: 'Aggregate attainment influence, mu* per full screened range', value: 'crop leaf area and transpiration 9.098627 pp; envelope U-value 5.891623 pp; shade fraction 3.426230 pp; maximum controlled outdoor-air capacity 2.164460 pp', source: 'docs/morris-screening.json'},
      {label: 'Screening population', value: '1,872 simulations across 104 design points, zero numerical-failure hours. These are elementary effects, not paired scenario endpoint differences or uncertainty bounds.', source: 'docs/morris-screening.json'},
    ],
    caveat: 'Screening is not uncertainty quantification. There is no distribution here, no confidence interval and no probability that one strategy beats another: the ranges are engineering spans with stated reasons, and the design is space-filling rather than a Monte Carlo draw. The most influential parameter, crop transpiration, is a client assumption rather than a measurement. Only twelve continuous parameters are screened, so structural choices such as the single-zone assumption are not bounded by any of these effects, and the largest remaining errors are probably structural.',
    show: {target: 'sensitivity-controls', label: 'Show me the one-at-a-time sensitivity controls', needsRun: false, first: null}
  }
];

export const REGION_MODULE = {
  key: 'regional-findings',
  title: 'What ten years of regional data recommend',
  meta: 'Computed per region from docs/regional-study.json'
};

/* ---------- Curriculum rendering ---------- */

const moduleId = key => `learn-module-${key}`;
let regionsBody = null, studyState = {status: 'idle'};

function workedTable(worked) {
  const wrap = node('div', undefined, 'table-wrap');
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const [label, scope] of [['Measured here', 'col'], ['Value', 'col'], ['Source', 'col']]) {
    const th = node('th', label);
    th.scope = scope;
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const row of worked) {
    const tr = document.createElement('tr');
    tr.append(node('td', row.label, 'row-name'), node('td', row.value), node('td', row.source, 'learn-source-cell'));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function showButton(mod) {
  const wrap = node('div', undefined, 'learn-show');
  const button = node('button', mod.show.needsRun ? `${mod.show.label} (after a run)` : mod.show.label);
  button.type = 'button';
  button.dataset.learnShow = mod.key;
  button.addEventListener('click', () => revealInTool(mod));
  wrap.append(button);
  if (mod.show.first) wrap.append(node('p', mod.show.first, 'learn-first'));
  return wrap;
}

function moduleNode(mod, index) {
  const details = document.createElement('details');
  details.id = moduleId(mod.key);
  details.className = 'learn-module';
  details.dataset.learnKey = mod.key;
  const summary = document.createElement('summary');
  summary.append(node('span', `§ ${String(index + 1).padStart(2, '0')}`, 'learn-num mono'),
    node('span', mod.title, 'learn-module-title'),
    node('span', mod.meta, 'summary-meta'));
  details.append(summary);
  const body = node('div', undefined, 'learn-body');
  for (const paragraph of mod.lede) body.append(node('p', paragraph, 'learn-lede'));
  const relation = node('div', undefined, 'learn-relation');
  relation.append(node('p', 'The relationship', 'eyebrow'), node('p', mod.formula, 'learn-formula mono'), node('p', mod.formulaNote, 'help'));
  body.append(relation);
  body.append(node('p', 'Measured in this repository', 'eyebrow'), workedTable(mod.worked));
  if (mod.steps) {
    const host = node('div', undefined, 'learn-worked-hours');
    host.append(node('p', 'Worked on two real hours', 'eyebrow'), node('p', `Loading ${WORKED_HOURS_URL}…`, 'help'));
    workedHosts.push({host, steps: mod.steps});
    body.append(host);
  }
  const caveat = node('div', undefined, 'learn-caveat');
  caveat.append(node('p', 'The caveat that travels with it', 'eyebrow'), node('p', mod.caveat));
  body.append(caveat);
  body.append(showButton(mod));
  details.append(body);
  details.addEventListener('toggle', () => {
    if (view !== 'learn') return;
    writeHash(details.open ? `learn/${mod.key}` : 'learn');
  });
  return details;
}

/** Switches to Analyze and spotlights the panel this module is about. A panel that a run has not created
    yet, or that the weather-only tier hides, is skipped in favour of the first visible fallback, so the
    highlight always lands on something real and on the control that produces the missing panel. */
function revealInTool(mod) {
  const candidates = [mod.show.target, ...(mod.show.fallbacks || []), 'runbar', 'title'];
  showView('analyze', {hash: true, restore: false});
  const target = candidates.map(id => $(id)).find(element => element && !element.hidden && !element.closest('[hidden]'));
  if (!target) return;
  const fire = () => spotlight(target);
  if (still()) requestAnimationFrame(fire);
  else requestAnimationFrame(() => requestAnimationFrame(fire));
}

/* ---------- Regional findings ---------- */

function emptyStudy(reason) {
  const box = node('div', undefined, 'learn-empty');
  box.append(node('p', 'No regional study is loaded.', 'learn-empty-title'));
  box.append(node('p', reason, 'help'));
  const how = node('p', undefined, 'source-line');
  how.append(document.createTextNode('Expected at '), node('code', STUDY_URL), document.createTextNode('. Regenerate it with '), node('code', STUDY_COMMAND), document.createTextNode(', which reads the bundled ten years at all five sites and writes that file. Nothing is shown here until it exists: this section never substitutes an example for a computed result.'));
  box.append(how);
  return box;
}

function methodBlock(method, study) {
  const wrap = node('div', undefined, 'learn-method');
  wrap.append(node('p', 'How the study was computed', 'eyebrow'));
  const list = document.createElement('dl');
  list.className = 'inspection-grid';
  const rows = [
    ['Weather years', finite(method?.years) ? num(method.years) : Array.isArray(method?.years) ? method.years.join(', ') : text(method?.years) || 'Not available'],
    ['Sites', Array.isArray(method?.sites) ? method.sites.join(', ') : text(method?.sites) || 'Not available'],
    ['Scenarios', Array.isArray(method?.scenarios) ? method.scenarios.map(entry => typeof entry === 'string' ? entry : `${text(entry?.label) || text(entry?.id) || 'unnamed'}${finite(entry?.installedCostUsd) ? ` (${capitalBasisText({installedCost:entry.installedCostUsd,installedCostBasis:entry.installedCostBasis})})` : ''}`).join(', ') : finite(method?.scenarios) ? num(method.scenarios) : text(method?.scenarios) || 'Not available'],
    ['Controller', text(method?.controller) || 'Not available'],
    ['Crop moisture model', text(method?.transpirationModel) || 'Not available'],
    ['Dispatch step', finite(method?.stepMinutes) ? `${num(method.stepMinutes, 2)} min` : 'Not available'],
    ['Simulations run', finite(method?.simulations) ? num(method.simulations) : 'Not stated'],
    ['Runtime', finite(method?.runtimeSeconds) ? `${num(method.runtimeSeconds, 1)} s` : 'Not stated'],
    ['Model version', text(study?.modelVersion) || 'Not available'],
    ['Generated', text(study?.generatedAt) || 'Not available']
  ];
  for (const [label, value] of rows) {
    const cell = document.createElement('div');
    cell.append(node('dt', label), node('dd', value));
    list.append(cell);
  }
  wrap.append(list);
  const notes = (method?.notes || []).filter(entry => text(entry));
  if (notes.length) {
    const ul = document.createElement('ul');
    ul.className = 'learn-notes';
    for (const entry of notes) ul.append(node('li', entry));
    wrap.append(ul);
  }
  wrap.append(node('p', 'These are ten observed years, not a sample from a stationary distribution. The spread between the best and worst of them is an observed range, never a forecast and never a confidence interval.', 'help'));
  wrap.append(node('p', 'Every region is costed at the same declared prices the example scenarios carry, not at its own local tariff, so a cost difference between two regions here is a difference in dispatch and not in the price of energy.', 'help'));
  const more = node('p', undefined, 'source-line');
  const link = node('a', 'docs/REGIONS.md ↗');
  link.href = 'docs/REGIONS.md';
  more.append(document.createTextNode('Per-region reasoning, the full method and what ten observed years can and cannot support: '), link);
  wrap.append(more);
  return wrap;
}

function weatherTable(weather) {
  const rows = [
    ['Pad-effective hours', hours(weather?.padEffectiveHoursMedian)],
    ['Free-cooling hours', hours(weather?.freeCoolingHoursMedian)],
    ['Heating hours', hours(weather?.heatingHoursMedian)],
    ['Moisture-limited hours', hours(weather?.moistureLimitedHoursMedian)],
    ['Temperature-limited hours', hours(weather?.temperatureLimitedHoursMedian)],
    ['Design dry bulb', degrees(weather?.designDryBulbC)],
    ['Coincident wet bulb', degrees(weather?.coincidentWetBulbC)],
    ['Design wet bulb', degrees(weather?.designWetBulbC)],
    ['Design dew point', degrees(weather?.designDewPointC)],
    ['Mean summer wet bulb', degrees(weather?.meanSummerWetBulbC)]
  ];
  const wrap = node('div', undefined, 'table-wrap');
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['Weather-side median over the study years', 'Value']) {
    const th = node('th', label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const [label, value] of rows) {
    const tr = document.createElement('tr');
    tr.append(node('td', label, 'row-name'), node('td', value));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function strategyTable(strategies, yearCount, basis) {
  const wrap = node('div', undefined, 'table-wrap');
  if (!Array.isArray(strategies) || !strategies.length) {
    wrap.append(node('p', 'This region carries no strategy rows in the study file, so nothing is ranked here.', 'help'));
    return wrap;
  }
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  const span = finite(yearCount) && yearCount > 0 ? `${num(yearCount)} observed years` : 'the observed years';
  for (const label of ['Rank', 'Strategy', 'Attainment, median', 'Worst year', 'Best year', `Attainment spread over ${span}`, 'Operating cost, median', `Cost spread over ${span}`, 'Electricity', 'Fuel', 'Operating-cost frontier']) {
    const th = node('th', label);
    th.scope = 'col';
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement('tbody');
  for (const row of [...strategies].sort((a, b) => (finite(a.rank) ? a.rank : 99) - (finite(b.rank) ? b.rank : 99))) {
    const tr = document.createElement('tr');
    const frontier = row.dominated === true ? 'Operating-dominated' : row.frontier === true ? 'Operating-cost frontier' : 'Not stated';
    tr.append(node('td', finite(row.rank) ? num(row.rank) : 'Not ranked'),
      node('td', text(row.label) || text(row.id) || 'Unnamed', 'row-name'),
      node('td', pct(row.attainmentMedianPct)),
      node('td', `${pct(row.attainmentWorstPct)}${text(row.attainmentWorstYear) ? ` (${row.attainmentWorstYear})` : ''}`),
      node('td', `${pct(row.attainmentBestPct)}${text(row.attainmentBestYear) ? ` (${row.attainmentBestYear})` : ''}`),
      node('td', points(row.attainmentSpreadPts)),
      node('td', row.costBasis || basis ? `${usd(row.costMedianUsd)} modeled operating cost, median year. ${costBasisText(row.costBasis || basis)}` : 'Cost basis not supplied by this study; dollar comparison withheld'),
      node('td', (row.costBasis || basis) && finite(row.costSpreadUsd) ? `${usd(row.costSpreadUsd)} modeled operating-cost spread over the study years` : 'Cost basis unavailable'),
      node('td', kwh(row.electricMedianKWh)),
      node('td', kwh(row.fuelMedianKWh)),
      node('td', frontier));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  wrap.append(node('p', `Spread is best minus worst over ${span}: observed weather-year endpoints, not a probability interval or confidence bound. A strategy marked operating-dominated can still sit in the capability tier. The 5 pp joint-attainment tier and 16% operating-cost band are retained methodological decision rules, not thresholds calibrated by the current Morris run. Dominance does not rule a tier member out.`, 'help'));
  return wrap;
}

const CONSTRAINT_WORDS = {moisture: 'the moisture ceiling', temperature: 'the temperature margin', heating: 'heating demand'};

function verdictBlock(verdict, strategies) {
  const wrap = node('div', undefined, 'learn-verdict');
  if (!verdict) {
    wrap.append(node('p', 'No verdict', 'eyebrow'), node('p', 'The study file carries no verdict for this region, so none is shown.'));
    return wrap;
  }
  const nameOf = id => {
    const match = (strategies || []).find(row => row.id === id);
    return text(match?.label) || text(id) || 'an unnamed strategy';
  };
  const unresolved = verdict.recommended == null;
  wrap.append(node('p', unresolved ? 'Not resolved by this evidence' : 'Recommended by this evidence', 'eyebrow'));
  if (unresolved) {
    const candidates = (verdict.candidates || []).map(nameOf);
    wrap.append(node('p', candidates.length
      ? `This region has no recommendation. The study leaves ${candidates.join(' and ')} unseparated.`
      : 'This region has no recommendation.', 'learn-verdict-head'));
  } else {
    wrap.append(node('p', nameOf(verdict.recommended), 'learn-verdict-head'));
  }
  const basis = text(verdict.recommendedBasis);
  wrap.append(node('p', basis || 'The study states no basis for this line, so it should not be quoted.', 'learn-verdict-basis'));
  const facts = [];
  // marginPct is a difference in median operating cost, expressed as a percent, not percentage points (pp) of joint temperature-and-moisture target attainment.
  if (unresolved) {
    if (verdict.runnerUp != null) facts.push(['Second candidate', nameOf(verdict.runnerUp)]);
    facts.push(['Operating-cost gap between the candidates', verdict.marginPct == null ? 'Not stated by the study' : pct(verdict.marginPct)]);
  } else {
    facts.push(['Runner-up', verdict.runnerUp == null ? 'None: only one strategy reached the capability tier' : nameOf(verdict.runnerUp)]);
    facts.push(['Operating-cost gap to the runner-up', verdict.marginPct == null ? 'Not applicable: only one strategy reached the capability tier' : pct(verdict.marginPct)]);
  }
  if (finite(verdict.indistinguishableThresholdPct)) facts.push(['Indistinguishable band', `${pct(verdict.indistinguishableThresholdPct, 0)} of median operating cost`]);
  if (finite(verdict.bestAttainmentPct)) facts.push(['Best attainment in the region', pct(verdict.bestAttainmentPct)]);
  if (Array.isArray(verdict.capabilityTier) && verdict.capabilityTier.length) facts.push(['Capability tier', verdict.capabilityTier.map(nameOf).join(', ')]);
  if (finite(verdict.capabilityTierPts)) facts.push(['Capability tier width', `strategies within ${points(verdict.capabilityTierPts)} of the region's best median joint temperature-and-moisture target attainment; a retained methodological rule, not current-model calibration or an uncertainty interval`]);
  // `stable` is about the six-strategy cost order across weather years only. It says nothing about the
  // verdict surviving the assumptions: Phoenix is reproducible in 10 of 10 years and still unresolved.
  facts.push(['Cost order across the study years', verdict.stable === true ? 'Meets the regional rule: the most common operating-cost order holds in at least 90% of years. This is reproducibility, not robustness to assumptions.' : verdict.stable === false ? 'Does not meet the regional 90% reproducibility rule.' : 'Not stated']);
  const stability = text(verdict.stabilityBasis);
  if (stability) facts.push(['Stability basis', stability]);
  // The raw hour count is heating-dominated at any temperate site on a cool band, so it is never shown
  // alone: the cooling-side constraint and the study's own basis sentence travel with it.
  const constraint = text(verdict.bindingConstraint);
  const coolingSide = text(verdict.coolingSideConstraint);
  facts.push(['Binding constraint, raw hour count', constraint ? (CONSTRAINT_WORDS[constraint] || constraint) : 'Unknown: the study reports none for this region']);
  facts.push(['Cooling-side constraint', coolingSide ? (CONSTRAINT_WORDS[coolingSide] || coolingSide) : 'Unknown: the study reports none for this region']);
  const constraintHours = verdict.bindingConstraintHours;
  if (constraintHours && typeof constraintHours === 'object') {
    facts.push(['Constraint hours, mean per year', `moisture ${hours(constraintHours.moisture)}, temperature ${hours(constraintHours.temperature)}, heating ${hours(constraintHours.heating)}`]);
  }
  const list = document.createElement('dl');
  list.className = 'inspection-grid';
  for (const [label, value] of facts) {
    const cell = document.createElement('div');
    cell.append(node('dt', label), node('dd', value));
    list.append(cell);
  }
  wrap.append(list);
  const constraintBasis = text(verdict.bindingConstraintBasis);
  if (constraintBasis) wrap.append(node('p', constraintBasis, 'learn-verdict-basis'));
  else if (constraint) wrap.append(node('p', 'The study states no basis for that hour count, so read it with the cooling-side constraint above rather than as a statement that this is a heating climate.', 'help'));
  const caveats = (verdict.caveats || []).filter(entry => text(entry));
  if (caveats.length) {
    wrap.append(node('p', 'Caveats carried by this verdict', 'eyebrow'));
    const ul = document.createElement('ul');
    ul.className = 'learn-notes';
    for (const entry of caveats) ul.append(node('li', entry));
    wrap.append(ul);
  }
  return wrap;
}

function regionNode(region) {
  const section = node('section', undefined, 'learn-region');
  const heading = node('div', undefined, 'chart-heading');
  const left = document.createElement('div');
  const label = text(region.label) || text(region.key) || 'Unnamed region';
  const climate = text(region.climate);
  left.append(node('p', climate ? `${climate}` : 'Climate not stated', 'eyebrow'), node('h4', label));
  heading.append(left);
  const years = Array.isArray(region.years) ? region.years : [];
  heading.append(node('span', `${text(region.zip) ? `ZIP ${region.zip} · ` : ''}${years.length ? `${years.length} years: ${years[0]} to ${years[years.length - 1]}` : 'Years not stated'}`, 'chart-unit'));
  section.append(heading, weatherTable(region.weather), strategyTable(region.strategies, years.length, region.costBasis), verdictBlock(region.verdict, region.strategies));
  return section;
}

const describeVersion = value => value == null ? 'nothing' : String(value);

/** A failure reason belongs in both places at once: the regional section and every figure slot in the
    one-pager read the same file, so neither of them shows a number when that file is not there. */
function failStudy(reason) {
  clearPrimerStudy(reason);
  return emptyStudy(reason);
}

function renderStudy(study) {
  if (!regionsBody) return;
  if (study.schemaVersion !== STUDY_SCHEMA) {
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} was read, but it declares schemaVersion ${describeVersion(study.schemaVersion)} and this view reads schemaVersion ${STUDY_SCHEMA}. Nothing is rendered from an unrecognised shape.`));
    return;
  }
  const regions = Array.isArray(study.regions) ? study.regions.filter(region => region && typeof region === 'object') : [];
  if (!regions.length) {
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} was read and parsed, but it carries no regions.`));
    return;
  }
  const fragment = document.createDocumentFragment();
  fragment.append(methodBlock(study.method, study));
  for (const region of regions) fragment.append(regionNode(region));
  regionsBody.replaceChildren(fragment);
  fillPrimerStudy(study, regions);
}

/* The same two real hours are followed through every module that has a per-hour step, so the January hour a
   reader meets in § 01 is still recognisable in § 05. Nothing is cached here: the file is the record. */
async function loadWorkedHours() {
  if (!workedHosts.length) return;
  const fail = reason => {for (const {host} of workedHosts) host.replaceChildren(node('p', 'Worked on two real hours', 'eyebrow'), node('p', `${WORKED_HOURS_URL} ${reason} Nothing is substituted for it.`, 'help'));};
  let file;
  try {
    const response = await fetch(WORKED_HOURS_URL, {cache: 'no-store'});
    if (!response.ok) return fail(`returned ${response.status} ${response.statusText}, so no worked hour is shown.`);
    file = await response.json();
  } catch (error) {return fail(`could not be read: ${error.message}.`);}
  if (file?.schemaVersion !== 1 || !Array.isArray(file.hours) || !file.site?.timezone) return fail('is not a schema 1 sample-hours file.');
  const scenario = {...DEFAULT_SCENARIO, timezone: file.site.timezone, latitude: file.site.latitude, longitude: file.site.longitude};
  for (const {host, steps: [from, to]} of workedHosts) {
    host.replaceChildren(node('p', 'Worked on two real hours', 'eyebrow'));
    host.append(node('p', `${file.site.label}, ${file.source}, with the default scenario: ${scenario.dayTargetC} °C by day and ${scenario.nightTargetC} °C at night, air VPD ${scenario.vpdMin} to ${scenario.vpdMax} kPa, dew point at most ${scenario.maxDewPointC} °C, pad effectiveness ${scenario.padEffectiveness}. Steps ${from} to ${to} of the same ten for each hour. The hourly inspector shows all ten for any hour of your own run.`, 'help'));
    for (const sample of file.hours) {
      const raw = Object.entries(sample.raw || {}).map(([k, v]) => `${k} ${v} ${file.units?.[k] || ''}`.trim()).join(', ');
      const head = node('p', undefined, 'source-line');
      head.append(document.createTextNode(`${sample.label}: ${sample.timeUTC}. As received: ${raw}. `));
      const link = node('a', 'Source request'); link.href = sample.sourceUrl; link.rel = 'noopener'; link.target = '_blank';
      head.append(link, document.createTextNode(`, retrieved ${sample.retrievedAt}.`));
      host.append(head, stepsNode(weatherSteps(sample.hour, scenario, file.site).slice(from - 1, to)));
    }
  }
}

async function loadStudy() {
  if (!regionsBody) return studyState;
  regionsBody.replaceChildren(node('p', `Loading ${STUDY_URL}…`, 'help'));
  let response;
  try {
    response = await fetch(STUDY_URL, {cache: 'no-store'});
  } catch (error) {
    studyState = {status: 'error', reason: error.message};
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} could not be requested: ${error.message}. Serve this folder over HTTP rather than opening the file directly.`));
    return studyState;
  }
  if (!response.ok) {
    studyState = {status: 'missing', reason: `${response.status} ${response.statusText}`};
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} returned ${response.status} ${response.statusText}, so the study has not been generated in this copy of the repository.`));
    return studyState;
  }
  let study;
  try {
    study = JSON.parse(await response.text());
  } catch (error) {
    studyState = {status: 'invalid', reason: error.message};
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} was found but could not be parsed as JSON: ${error.message}.`));
    return studyState;
  }
  if (!study || typeof study !== 'object') {
    studyState = {status: 'invalid', reason: 'not an object'};
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} parsed, but it is not a JSON object, so it carries no study.`));
    return studyState;
  }
  try {
    renderStudy(study);
    studyState = {status: 'loaded', regions: Array.isArray(study.regions) ? study.regions.length : 0};
  } catch (error) {
    studyState = {status: 'invalid', reason: error.message};
    regionsBody.replaceChildren(failStudy(`${STUDY_URL} parsed, but a region in it could not be rendered: ${error.message}. Nothing partial is shown.`));
  }
  return studyState;
}

/* ---------- The two-view switch ---------- */

const PANELS = {analyze: {tab: 'analyze-tab', panel: 'analyze-view'}, learn: {tab: 'learn-tab', panel: 'learn-view'}};
let view = 'analyze', persists = true, stored = null;
const scrollAt = {analyze: 0, learn: 0};

function readView() {
  if (stored !== null) return stored;
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    stored = parsed && PANELS[parsed.view] ? parsed.view : 'analyze';
  } catch {
    persists = false;
    stored = 'analyze';
  }
  return stored;
}
function writeView(name) {
  stored = name;
  if (!persists) return;
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify({view: name, version: LEARN_VERSION}));
  } catch {
    persists = false;
  }
}
function writeHash(fragment) {
  const next = `${location.pathname}${location.search}${fragment ? `#${fragment}` : ''}`;
  if (next === `${location.pathname}${location.search}${location.hash}`) return;
  history.replaceState(history.state, '', next);
}

/** Shows one of the two views. Hiding the Analyze view runs no code inside it: nothing re-renders, no run
    is interrupted, and every chart, table and selection is still there when it comes back. */
export function showView(name, {focus = false, remember = true, restore = true, hash = false} = {}) {
  if (!PANELS[name]) return view;
  if (view === name) {
    if (hash) writeHash(name === 'learn' ? 'learn' : '');
    return view;
  }
  scrollAt[view] = window.scrollY;
  view = name;
  for (const [key, ids] of Object.entries(PANELS)) {
    const active = key === name, tab = $(ids.tab), panel = $(ids.panel);
    if (panel) panel.hidden = !active;
    if (!tab) continue;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  if (remember) writeView(name);
  if (hash) writeHash(name === 'learn' ? 'learn' : '');
  const skip = $('skip-link');
  if (skip) {
    skip.setAttribute('href', name === 'learn' ? '#learn-curriculum-title' : '#workspace');
    skip.textContent = name === 'learn' ? 'Skip to the explainer' : 'Skip to analysis';
  }
  if (restore) window.scrollTo({top: scrollAt[name] || 0, behavior: 'auto'});
  if (focus) $(PANELS[name].panel)?.focus();
  return view;
}

/** Opens a module by key, in the Learn view, and returns false for an unknown key. Every module lives
    inside the collapsed "Go deeper" disclosure, so that is opened first and the module is scrolled to
    on the frame after it has a box. */
export function openModule(key, {scroll = true} = {}) {
  const details = $(moduleId(key));
  if (!details) return false;
  openDeeper();
  details.open = true;
  if (scroll) details.scrollIntoView({block: 'start', behavior: still() ? 'auto' : 'smooth'});
  return true;
}

/** `#learn`, `#learn/<module-key>` and `#analyze` are routes; every other fragment is an ordinary anchor
    in the Analyze view and is left to the browser. */
export function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (raw === 'analyze') return {view: 'analyze', module: null};
  if (raw === 'learn') return {view: 'learn', module: null};
  const match = /^learn\/(.+)$/.exec(raw);
  if (match) return {view: 'learn', module: decodeURIComponent(match[1])};
  return null;
}

let routedModule = null;

function applyRoute(route, {focus = false} = {}) {
  if (!route) return false;
  showView(route.view, {focus, hash: false});
  if (route.view === 'learn' && route.module) {
    routedModule = route.module;
    openModule(route.module);
  }
  return true;
}

/** The regional study lands after a route has been applied and adds a long section above the module the
    reader asked for, which leaves the routed module off screen. So the scroll is taken once more when
    the study has rendered, and only if the module is not already in view. */
function settleRoutedScroll() {
  const key = routedModule;
  routedModule = null;
  if (!key) return false;
  const details = $(moduleId(key));
  if (!details) return false;
  const box = details.getBoundingClientRect();
  if (box.top >= -40 && box.top <= window.innerHeight * 0.5) return false;
  details.scrollIntoView({block: 'start', behavior: 'auto'});
  return true;
}

function onTabKey(event) {
  const order = ['analyze-tab', 'learn-tab'];
  const at = order.indexOf(event.currentTarget.id);
  if (at < 0) return;
  let next = null;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = order[(at + 1) % order.length];
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = order[(at + order.length - 1) % order.length];
  else if (event.key === 'Home') next = order[0];
  else if (event.key === 'End') next = order[order.length - 1];
  if (!next) return;
  event.preventDefault();
  showView(next === 'learn-tab' ? 'learn' : 'analyze', {hash: true});
  $(next)?.focus();
}

/** Builds the one-pager, nests the technical modules inside the collapsed "Go deeper" disclosure, binds
    the switch, applies the hash or the remembered view, and loads the study. Returns what it wired, for
    the caller to log or ignore. */
export function initLearn() {
  document.getElementById('learn-view').prepend(node('p', 'Historical study evidence: the regional and Morris figures below were calculated with model 0.3.0-screening. They have not been regenerated for the current phase-aware moisture conversion. Use them as historical examples, not current-model validation.', 'help'));
  const host = $('learn-modules');
  if (host) {
    const fragment = document.createDocumentFragment();
    fragment.append(node('p', 'Joint temperature-and-moisture target attainment means the share of eligible hours meeting temperature, VPD and dew-point bounds together. Differences are percentage points (pp), not relative percentages; compare the named baseline and alternative endpoints. Historical studies are separate from your current run. Their dollars require the study period, included electricity, fuel and water, applied prices and exclusions. Capital is separate estimated or user-entered installed cost. No result is a quote or guaranteed savings.', 'notice'));
    fragment.append(primerNode());
    deeper = document.createElement('details');
    deeper.id = DEEPER_ID;
    deeper.className = 'learn-deeper';
    const deepSummary = document.createElement('summary');
    deepSummary.append(node('span', 'DEEPER', 'learn-num mono'),
      node('span', DEEPER_TITLE, 'learn-module-title'),
      node('span', DEEPER_META, 'summary-meta'));
    deeper.append(deepSummary);
    const deepBody = node('div', undefined, 'learn-modules learn-deeper-body');
    MODULES.forEach((mod, index) => deepBody.append(moduleNode(mod, index)));
    const regions = document.createElement('details');
    regions.id = moduleId(REGION_MODULE.key);
    regions.className = 'learn-module learn-module-regions';
    regions.dataset.learnKey = REGION_MODULE.key;
    regions.open = true;
    const summary = document.createElement('summary');
    summary.append(node('span', `§ ${String(MODULES.length + 1).padStart(2, '0')}`, 'learn-num mono'),
      node('span', REGION_MODULE.title, 'learn-module-title'),
      node('span', REGION_MODULE.meta, 'summary-meta'));
    regions.append(summary);
    regionsBody = node('div', undefined, 'learn-body learn-regions-body');
    regions.append(regionsBody);
    regions.addEventListener('toggle', () => {
      if (view !== 'learn') return;
      writeHash(regions.open ? `learn/${REGION_MODULE.key}` : 'learn');
    });
    deepBody.append(regions);
    deeper.append(deepBody);
    fragment.append(deeper);
    host.replaceChildren(fragment);
  }
  const patched = patchIntro();
  for (const [name, ids] of Object.entries(PANELS)) {
    const tab = $(ids.tab);
    if (!tab) continue;
    tab.addEventListener('click', () => {showView(name, {hash: true, focus: false});});
    tab.addEventListener('keydown', onTabKey);
  }
  // The guided tour walks panels in the Analyze view, so a tour started from the Learn view switches first.
  $('tour-button')?.addEventListener('click', () => showView('analyze', {hash: true, restore: false}), true);
  window.addEventListener('hashchange', () => applyRoute(parseRoute(location.hash)));
  // A route wins; an ordinary anchor into the analysis wins over the remembered view; otherwise the
  // browser comes back to the view it left.
  const route = parseRoute(location.hash);
  if (route) applyRoute(route);
  else {
    const anchored = location.hash ? $(decodeURIComponent(location.hash.slice(1))) : null;
    const intoAnalysis = !!anchored?.closest('#analyze-view');
    if (!intoAnalysis && readView() === 'learn') showView('learn', {hash: false, restore: false});
  }
  const loading = loadStudy();
  loadWorkedHours();
  loading.then(settleRoutedScroll, () => {routedModule = null;});
  return {primer: PRIMER.length, patched, modules: MODULES.length, sections: MODULES.length + 1, view, persists, study: loading};
}
