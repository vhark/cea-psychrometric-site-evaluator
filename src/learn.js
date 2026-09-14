/* Learn view: a taught curriculum over the tool's own evidence, plus the regional findings study.

   Copy discipline, enforced by review rather than by code: every figure quoted in MODULES below is
   already published in this repository (docs/VERIFICATION.md, docs/AUDIT.md, docs/SENSITIVITY.md,
   docs/CLIMATES.md, docs/GLOSSARY.md, docs/examples/README.md) and carries its source on screen.
   Every figure in the regional section comes from docs/regional-study.json at runtime. Nothing here
   is computed by this module, and nothing is invented: an absent study renders as an absent study.

   The spotlight is the guided tour's, imported rather than duplicated. */

import {spotlight} from './tour.js';

export const LEARN_VERSION = 1;
export const VIEW_KEY = 'cea-psychrometric-site-evaluator.view.v1';
export const STUDY_URL = 'docs/regional-study.json';
export const STUDY_COMMAND = 'node scripts/regional-study.mjs';
export const STUDY_SCHEMA = 1;

const $ = id => document.getElementById(id);
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const num = (value, digits = 0) => finite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'Not available';
const pct = (value, digits = 1) => finite(value) ? `${num(value, digits)}%` : 'Not available';
const points = (value, digits = 1) => finite(value) ? `${num(value, digits)} pts` : 'Not available';
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

/** The curriculum. Nine modules, in teaching order. Each one states the concept in plain language, then
    the arithmetic or physical relationship explicitly, then a worked number already published here, then
    the caveat that belongs with the concept rather than in a footnote. `show` names the panel in the
    Analyze view where the concept is visible; `needsRun` marks a panel that a run has to create first. */
export const MODULES = [
  {
    key: 'outdoor-state',
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
    show: {target: 'inspector-panel', label: 'Show me the hourly inspector', needsRun: true, first: 'In the Analyze view: press Load Tulsa 2025 example, then Run all scenarios. The inspector walks the record hour by hour and reports the outdoor state behind every number.'}
  },
  {
    key: 'target-band',
    title: 'The joint band, and what attainment is a percentage of',
    meta: 'Eligible hours, warm-up, partial hours',
    lede: [
      'The target is three bounds held at once: air temperature within tolerance of the scheduled day or night target, VPD between a minimum and a maximum, and dew point at or below a ceiling. Joint means simultaneously, not each in turn. Inside the model the three collapse into a temperature window and a humidity-ratio window whose upper bound is the lower of the VPD maximum and saturation at the dew-point ceiling, so the tighter of those two is what actually binds.',
      'Attainment is not a share of the calendar. The denominator is eligible hours: hours whose outdoor state parsed, passed range checks and produced a finite result, and which are not the warm-up hour that starts every continuous weather segment. Missing and failed hours are excluded from numerator and denominator alike rather than counted as failures, which is why attainment is read next to the valid-hours metric and never on its own.'
    ],
    formula: 'compliancePct = 100 * compliantHours / eligibleHours,   eligible = valid && eligible !== false && !warmup',
    formulaNote: 'summarizeHours in src/metrics.js. compliantHours accumulates compliantFraction, the share of an hour\u2019s sampled control substeps inside the band, so an hour that fails for ten minutes contributes a partial hour and not a zero. Cross-scenario comparisons intersect the eligible sets of every compared scenario, so two strategies are always scored over identical hours.',
    worked: [
      {label: 'Pad-and-vent baseline across five Tulsa years, six strategies', value: 'median 28.9%, worst year 2025 at 27.1%, spread 2.7 pts', source: 'docs/VERIFICATION.md'},
      {label: 'One greenhouse, one equipment set, four crop programs swapped (crop-bands.json, Tulsa 2025)', value: 'attainment moved 5.7 pts, 21.4% to 27.1%, while operating cost moved by a factor of 2.0, $16,208 to $32,737, and DLI deficit days by a factor of 4.9, 69 to 341', source: 'docs/examples/README.md'}
    ],
    caveat: 'A wider band raises attainment without changing the building. That makes attainment comparable between strategies on one band and not comparable between two different bands. Warm-up hours keep their energy and water in the individual totals, because that energy really was spent, but they carry no compliance at all.',
    show: {target: 'headline-metrics', label: 'Show me the four headline numbers', needsRun: true, first: 'In the Analyze view: press Load Tulsa 2025 example, then Run all scenarios. Attainment is shown as equivalent compliant hours over eligible hours, with valid hours beside it.'}
  },
  {
    key: 'free-cooling',
    title: 'What the climate gives free',
    meta: 'Free cooling, wet-bulb depression, pad viability',
    lede: [
      'Before choosing equipment, count the hours the outside air could do the job alone. A free-cooling hour is not simply a cool hour: the weather-side screen requires outside air below the target by the ventilation margin, a drying margin against the moisture ceiling, and outdoor enthalpy below the target enthalpy, all at the same time.',
      'An evaporative pad extends that window only as far as the wet-bulb depression allows, because a pad cannot cool below the wet bulb, and it pays for the sensible cooling it delivers with the moisture it adds. Where the air is already near saturation there is no depression to trade, and a better pad buys nothing.'
    ],
    formula: 'padTempC = tempC - effectiveness * (tempC - wetBulbC),   depression = tempC - wetBulbC',
    formulaNote: 'padState in src/physics.js, an approximately isoenthalpic process clamped at saturation. The weather screen calls an hour PAD_EFFECTIVE only when pad leaving air clears both the temperature margin and the moisture ceiling; clearing the ceiling but not the margin is PAD_MARGINAL, and neither is PAD_INEFFECTIVE_DEHU_NEEDED, with the failing limit recorded. FREE_COOLING_MODES in src/metrics.js is PASSIVE_VENT_COOL_DRY plus PAD_EFFECTIVE.',
    worked: [
      {label: 'Free-cooling hours, Tulsa against Phoenix', value: '401 h against 2,636 h', source: 'docs/VERIFICATION.md'},
      {label: 'Pad-effective hours on the same screen', value: '244 h against 2,334 h', source: 'docs/VERIFICATION.md'},
      {label: 'The same greenhouse at five sites, 2025 record, pad-effective hours', value: 'Tulsa 244 h, Phoenix 2,334 h, Miami 33 h, Denver 1,065 h, Seattle 12 h', source: 'docs/examples/README.md'},
      {label: 'Tulsa pad runtime against weather-side viability', value: 'the pad ran 2,772 h on 296 days, 1,830 equivalent full-load hours; the weather screen clears both limits in 244 h on 65 days', source: 'docs/AUDIT.md, docs/GLOSSARY.md'}
    ],
    caveat: 'Free cooling is a capability count for the outside air, not a claim that fans are free: powered ventilation still consumes energy in the coupled run. And a low pad count never means the same thing twice. Miami\u2019s 33 hours and Seattle\u2019s 12 hours have opposite causes, no wet-bulb depression left against almost no cooling demand at all.',
    show: {target: 'runtime-table', label: 'Show me the pad-viability screen', needsRun: true, fallbacks: ['tier-tabs'], first: 'In the Analyze view: run scenarios, then switch the evidence tier to Weather only. The runtime table becomes the pad-viability screen, splitting cooling-demand hours into effective, marginal and ineffective with the limit that bound.'}
  },
  {
    key: 'sensible-latent',
    title: 'Sensible against latent, and the cost of coupling them',
    meta: 'Sensible-heat ratio, overcooling, reheat',
    lede: [
      'Two loads arrive together. Sensible load is heat: solar through the glazing, fixture power, envelope conduction, infiltration, ventilation and fans. Latent load is water: crop transpiration plus whatever moisture the air you admit brings with it. Equipment does not get to choose which of the two it meets.',
      'A cooling coil removes water only by driving air below its own dew point, so hitting a moisture target with a coil usually means overshooting the temperature target downward and then buying sensible heat back. That is the reheat penalty, and it is the whole argument for decoupling: take the water out somewhere the air is not first made cold, and leave a smaller sensible device to hold temperature.'
    ],
    formula: 'SHR = sensibleGainKWh / (sensibleGainKWh + LATENT_KWH_PER_KG * cropLatentKg)',
    formulaNote: 'Space sensible-heat ratio in src/metrics.js, where the latent conversion is the latent heat of vaporization in kWh/kg. A low SHR is the physical argument for decoupled moisture control over coupled cooling with reheat. Hours with no positive gain produce no SHR rather than a zero. The DX input named coolingSHR is a different quantity, the coil\u2019s own split, screened 0.65 to 0.85.',
    worked: [
      {label: 'Dry-neutral DOAS against a coupled coil with reheat (decoupling-study.json)', value: '56.2% against 55.3% attainment, on 211,807 against 246,930 kWh of purchased electricity, with fuel moving the other way, 417,992 against 367,321 kWh', source: 'docs/examples/README.md'},
      {label: 'Binding limit at Tulsa', value: 'the moisture ceiling binds 3,851 h against 2,952 h for the temperature margin', source: 'docs/AUDIT.md'},
      {label: 'Moisture-bound band with a moisture-adding stage (propagation-nursery.json)', value: 'decoupled latent removal reached 52.7% against 28.2% for pad and vent', source: 'docs/examples/README.md'}
    ],
    caveat: 'The decoupling verdict is a price ratio, not a property of the equipment. Roughly 0.9 pts of attainment bought by moving about 50,000 kWh from electricity to fuel is a bargain at some prices and a loss at others, and the electricity-to-fuel ratio is an editable input here, not a measured quantity.',
    show: {target: 'loads-panel', label: 'Show me the sensible and latent decomposition', needsRun: true, fallbacks: ['tier-tabs'], first: 'In the Analyze view: run scenarios and stay on the Equipment estimate tier. The load decomposition is a model balance, so it is hidden in the Weather only view.'}
  },
  {
    key: 'outside-air',
    title: 'Outside air as a dehumidifier',
    meta: 'Removal potential, cost per kilogram, the hidden heat',
    lede: [
      'When outside air carries less water than the zone\u2019s moisture ceiling allows, ventilation removes water, and the cheapest dehumidifier on the site is a fan. The tool counts those hours and prices them: the drying margin times the air mass the scenario can actually move gives a removal potential in kg/h, then fan power plus any heating needed to temper the incoming air gives energy per kilogram and cost per kilogram, against a condensing-dehumidifier reference.',
      'The count is split into cool and dry, cold and dry, and hot and dry, because those three are not the same offer. Cold and dry air is free water removal that arrives with a heating bill; hot and dry air is free water removal that arrives with a cooling bill.'
    ],
    formula: 'removalKgPerH = massFlowKgPerH * (w_ceiling - w_outdoor),   costPerKg = (fanKWh + temperingKWh) * price / removalKg',
    formulaNote: 'outdoorDryingHour in src/physics.js, evaluated at the scenario\u2019s maximum ventilation rate. It is a weather-side screen, not a dispatch decision: the coupled controller still decides what runs in the hour.',
    worked: [
      {label: 'Outside air against a 2.5 L/kWh dehumidifier at Tulsa', value: 'cheaper per kilogram of water in 4,970 h, and less energy per kilogram in 1,752 h', source: 'docs/AUDIT.md'}
    ],
    caveat: 'The hot-and-dry hours import sensible heat that this table does not cost, so they are cheap only in the moisture account: read them against a separate cooling plan, or ventilation becomes the reason the temperature bound fails. A removal potential is also what the installed fans could move, not what the controller chose to do, so it is an upper bound on the opportunity and not a saving already banked.',
    show: {target: 'drying-table', label: 'Show me the outside-air screen', needsRun: true, first: 'In the Analyze view: press Load Tulsa 2025 example, then Run all scenarios. The outside-air table gives hours, days, mean removal potential and energy and cost per kilogram.'}
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
      {label: 'Six classes at Tulsa, median over 104 screened design points (360 sampled days, so totals not annual figures)', value: 'pad $7,321 at 28.9%; pads with a condensing dehumidifier $9,205 at 45.5%; desiccant with evaporative cooling $10,232 at 53.6%; DX $13,006 at 66.4%; liquid-desiccant hybrid $13,732 at 56.2%; integrated reheat $15,058 at 55.1%', source: 'docs/SENSITIVITY.md'},
      {label: 'Cheapest non-dominated strategy', value: 'the pad baseline, in 100% of the 104 points', source: 'docs/SENSITIVITY.md'},
      {label: 'Highest attainment anywhere in the example library (indoor-microgreen-racks.json)', value: '93.0% for DX with a dehumidifier in an opaque rack farm, at 344,528 kWh, the most electricity-hungry set in the library', source: 'docs/examples/README.md'}
    ],
    caveat: 'Cheapest on the frontier is a position on the cost axis, not a recommendation: the pad baseline holds the band in a median 28.9% of eligible hours against 66.4% for DX. Two strategies within a few percent are a tie at screening resolution. And the 93.0% rack-farm figure is bought with installed capacity and purchased light, not with a better design.',
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
      {label: 'Baseline, no screens, fuel heat (screens-and-heat-source.json, Tulsa 2025, pad and vent, staged control)', value: '27.14% attainment, 61,098 kWh electricity, 303,246 kWh fuel', source: 'docs/examples/README.md'},
      {label: 'Light-guarded shade screen', value: '28.89% attainment for essentially no energy change, 970 screen hours, giving up 1,051 mol/m² of crop light', source: 'docs/examples/README.md'},
      {label: 'Thermal curtain, 0.1 per hour declared gap', value: '22.24% attainment, fuel down 22% to 236,672 kWh, which is 59,917 kWh of delivered heat saved, over 1,179 curtain hours', source: 'docs/examples/README.md'},
      {label: 'The same shade screen with the light guard removed', value: 'closes for 1,867 h and pushes lighting energy up by 17,817 kWh to replace the photons it blocked', source: 'docs/examples/README.md'}
    ],
    caveat: 'The curtain cut fuel by 22% and cost 4.9 pts of attainment in the same run, because restricting the outside-air path while the crop transpires traps moisture in the zone. Schedule a curtain by outdoor moisture, not by outdoor temperature alone. The 0.1 per hour closed-gap exchange is a user input and is recorded as UNSOURCED in docs/COMPONENT-PARAMETERS.md: leave it null and the run warns that the moisture case is optimistic.',
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
      {label: 'Baseline across five Tulsa years, six strategies', value: 'median 28.9%, worst year 2025 at 27.1%, spread 2.7 pts', source: 'docs/VERIFICATION.md'},
      {label: 'Cost ranking across those same years', value: 'not stable: 2 distinct orders over 5 years', source: 'docs/VERIFICATION.md'},
      {label: 'Tulsa hours above 30 °C in 2023, 2024, 2025', value: '982, then 1,117, then 634: a 483-hour swing between two neighbouring years at one site', source: 'docs/CLIMATES.md'}
    ],
    caveat: 'Ten bundled years are ten actual years, not a sample drawn from a stationary distribution. The spread between them is an observed range: it is not a forecast, not a confidence interval and not a design year. A climatological normal is 30 years, and the current standard period is 1991 to 2020, so the three-year sites here measure three particular years and carry no ten-year risk claim at all.',
    show: {target: 'years-panel', label: 'Show me the across-years panel', needsRun: true, first: 'In the Analyze view: select two or more weather years under Weather years, then run. Ten complete Tulsa years, 2016 through 2025, ship with the tool.'}
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
      {label: 'Top of the attainment ranking, mu* in percentage points', value: 'crop leaf area and transpiration 9.10, envelope U-value 5.89, shade fraction 3.43, DX coil SHR 2.34, solar transmission 2.26', source: 'docs/SENSITIVITY.md'},
      {label: 'Bottom of the same ranking', value: 'pad effectiveness 0.96, dehumidifier L/kWh 0.08, cooling COP 0.07', source: 'docs/SENSITIVITY.md'},
      {label: 'Cooling COP, the split that shows the method working', value: 'rank 12 of 12 on attainment at 0.07 pts, but rank 5 on operating cost at $646 and rank 3 on electricity at 5,838 kWh: COP changes what holding the band costs, not what the equipment can hold', source: 'docs/SENSITIVITY.md'},
      {label: 'Ranking stability under the screened ranges', value: 'unstable: 3 distinct orders over 104 design points, the most common holding 61.5%. The three cheapest positions are identical in 104 of 104 points, and all the instability sits inside DX, the liquid-desiccant hybrid and integrated reheat, whose medians span 16%: $13,006, $13,732, $15,058', source: 'docs/SENSITIVITY.md'}
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
    ['Scenarios', Array.isArray(method?.scenarios) ? method.scenarios.map(entry => typeof entry === 'string' ? entry : `${text(entry?.label) || text(entry?.id) || 'unnamed'}${finite(entry?.installedCostUsd) ? ` (${usd(entry.installedCostUsd)} installed)` : ''}`).join(', ') : finite(method?.scenarios) ? num(method.scenarios) : text(method?.scenarios) || 'Not available'],
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

function strategyTable(strategies, yearCount) {
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
      node('td', usd(row.costMedianUsd)),
      node('td', finite(row.costSpreadUsd) ? usd(row.costSpreadUsd) : 'Not available'),
      node('td', kwh(row.electricMedianKWh)),
      node('td', kwh(row.fuelMedianKWh)),
      node('td', frontier));
    body.append(tr);
  }
  table.append(head, body);
  wrap.append(table);
  wrap.append(node('p', `Spread is best minus worst over ${span}: the spread between the years that happened, not an interval, not a range of likely outcomes and not a confidence bound. A strategy marked operating-dominated can still sit in the capability tier, because inside that tier the attainment difference is below the resolution of this evidence: the Morris screening moves attainment by 9.10 percentage points over the leaf-area range alone (docs/SENSITIVITY.md). Dominance does not rule a tier member out.`, 'help'));
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
  // marginPct is a difference in median operating cost, expressed as a percent, not attainment points.
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
  if (finite(verdict.capabilityTierPts)) facts.push(['Capability tier width', `strategies within ${points(verdict.capabilityTierPts)} of the region's best median attainment, because the Morris screening moves attainment 9.10 pp over the leaf-area range alone and finer differences are not resolved at this evidence tier`]);
  // `stable` is about the six-strategy cost order across weather years only. It says nothing about the
  // verdict surviving the assumptions: Phoenix is reproducible in 10 of 10 years and still unresolved.
  facts.push(['Cost order across the study years', verdict.stable === true ? 'Reproducible across the observed years: one identical order in every year. This is reproducibility of the order, not robustness of the verdict to the assumptions.' : verdict.stable === false ? 'Not reproducible across the observed years: the order changes between years.' : 'Not stated']);
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
  section.append(heading, weatherTable(region.weather), strategyTable(region.strategies, years.length), verdictBlock(region.verdict, region.strategies));
  return section;
}

const describeVersion = value => value == null ? 'nothing' : String(value);

function renderStudy(study) {
  if (!regionsBody) return;
  if (study.schemaVersion !== STUDY_SCHEMA) {
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} was read, but it declares schemaVersion ${describeVersion(study.schemaVersion)} and this view reads schemaVersion ${STUDY_SCHEMA}. Nothing is rendered from an unrecognised shape.`));
    return;
  }
  const regions = Array.isArray(study.regions) ? study.regions.filter(region => region && typeof region === 'object') : [];
  if (!regions.length) {
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} was read and parsed, but it carries no regions.`));
    return;
  }
  const fragment = document.createDocumentFragment();
  fragment.append(methodBlock(study.method, study));
  for (const region of regions) fragment.append(regionNode(region));
  regionsBody.replaceChildren(fragment);
}

async function loadStudy() {
  if (!regionsBody) return studyState;
  regionsBody.replaceChildren(node('p', `Loading ${STUDY_URL}…`, 'help'));
  let response;
  try {
    response = await fetch(STUDY_URL, {cache: 'no-store'});
  } catch (error) {
    studyState = {status: 'error', reason: error.message};
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} could not be requested: ${error.message}. Serve this folder over HTTP rather than opening the file directly.`));
    return studyState;
  }
  if (!response.ok) {
    studyState = {status: 'missing', reason: `${response.status} ${response.statusText}`};
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} returned ${response.status} ${response.statusText}, so the study has not been generated in this copy of the repository.`));
    return studyState;
  }
  let study;
  try {
    study = JSON.parse(await response.text());
  } catch (error) {
    studyState = {status: 'invalid', reason: error.message};
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} was found but could not be parsed as JSON: ${error.message}.`));
    return studyState;
  }
  if (!study || typeof study !== 'object') {
    studyState = {status: 'invalid', reason: 'not an object'};
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} parsed, but it is not a JSON object, so it carries no study.`));
    return studyState;
  }
  try {
    renderStudy(study);
    studyState = {status: 'loaded', regions: Array.isArray(study.regions) ? study.regions.length : 0};
  } catch (error) {
    studyState = {status: 'invalid', reason: error.message};
    regionsBody.replaceChildren(emptyStudy(`${STUDY_URL} parsed, but a region in it could not be rendered: ${error.message}. Nothing partial is shown.`));
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
    skip.textContent = name === 'learn' ? 'Skip to the curriculum' : 'Skip to analysis';
  }
  if (restore) window.scrollTo({top: scrollAt[name] || 0, behavior: 'auto'});
  if (focus) $(PANELS[name].panel)?.focus();
  return view;
}

/** Opens a module by key, in the Learn view, and returns false for an unknown key. */
export function openModule(key, {scroll = true} = {}) {
  const details = $(moduleId(key));
  if (!details) return false;
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

function applyRoute(route, {focus = false} = {}) {
  if (!route) return false;
  showView(route.view, {focus, hash: false});
  if (route.view === 'learn' && route.module) openModule(route.module);
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

/** Builds the curriculum, binds the switch, applies the hash or the remembered view, and loads the study.
    Returns what it wired, for the caller to log or ignore. */
export function initLearn() {
  const host = $('learn-modules');
  if (host) {
    const fragment = document.createDocumentFragment();
    MODULES.forEach((mod, index) => fragment.append(moduleNode(mod, index)));
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
    fragment.append(regions);
    host.replaceChildren(fragment);
  }
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
  return {modules: MODULES.length, sections: MODULES.length + 1, view, persists, study: loading};
}
