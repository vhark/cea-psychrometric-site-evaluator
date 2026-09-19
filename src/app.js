import {CROPS, FACILITIES, SYSTEMS, TECHNOLOGIES, FIELDS, DEFAULT_SCENARIO, OPAQUE_FACILITIES, AIRFLOW_BASIS, AIRFLOW_EVIDENCE, LIGHT_FIXTURES, FT2_PER_M2, fixtureWm2, makeScenario, applyTechnology, migrateScenario, validateScenario, airflowEvidenceWarnings, MODEL_VERSION} from './config.js';
import {airflowConversions, heatRecoveryErrors, backfillHeatRecovery} from './airflow.js';
import {fetchWeather, normalizeWeather} from './weather.js';
import {loadEnergyCatalog, lookupZip, getEnergyContext, proposeTimezone} from './energy.js';
import {loadScenarios, saveScenarios, loadWeather, saveWeather, listWeather, loadCachedWeather, weatherKey} from './storage.js';
import {downloadRun, downloadScenario} from './export.js';
import {compareScenarios, aggregateYears, compareSites, loadDecomposition, co2Window} from './metrics.js';
import {modeLabel, modeEntries, attainmentClass, attainmentText, renderMonthly, renderTimeline, renderTimelineTable, renderScatter, renderDLI, renderLoads, renderYears} from './charts.js';
import {costBasisText, capitalBasisText, conditioningRows, airflowRows, attainmentComparisonText, comparisonPopulationText} from './report.js';
import {initTour} from './tour.js';
import {initLearn, stepsNode} from './learn.js';
import {weatherSteps, attainmentSteps} from './steps.js';
import {TERMS, infoBubble, decorateTerms} from './terms.js';
import {PROVIDERS, PROVIDER_ORDER, needsApiKey} from './providers.js';

const $ = id => document.getElementById(id);
const state = {scenarios: [], selected: null, snapshot: null, results: [], resultSnapshot: null, resultId: null, revision: 0, resultRevision: -1, pool: null, runId: null, runController: null, catalog: null, zipInfo: null, energyContext: null, energyEpoch: 0, weatherEpoch: 0, weatherController: null, parseWorker: null, weatherOnly: false, hour: 0,
  weatherBusy: false, cached: [], yearSources: new Map(), years: new Set(), sites: [], runs: [], primaryRun: 0, siteRuns: [], aggregate: null, siteComparison: null};
const coreKeys = new Set(['areaM2', 'canopyM2', 'dayTargetC', 'nightTargetC']);
const modelKeys = new Set(['controlMode', 'transpirationModel']);
const fieldByKey = new Map(FIELDS.flatMap(g => g.fields).map(f => [f.key, f]));
const airflowKeys = new Set(['infiltrationACH', 'minVentACH', 'maxVentACH', 'fanWPerM3s']);
const doasKeys = new Set(['doasM3s', 'doasSupplyDewPointC', 'doasSupplyTempC', 'doasCoolingCOP', 'doasReheatRecoveryFraction']);
const recoveryFields = [
  {key:'nominalM3s', label:'Nominal recovery flow', unit:'m³/s', min:0, group:'capacity'},
  {key:'auxiliaryW', label:'Recovery auxiliary power', unit:'W', min:0, group:'capacity'},
  ...['sensible', 'latent'].flatMap(kind => ['Heating', 'Cooling'].flatMap(mode => [75, 100].map(point => ({
    key:`${kind}${mode}${point}`, label:`${kind === 'sensible' ? 'Sensible' : 'Latent'} ${mode.toLowerCase()} at ${point}%`, unit:'fraction', min:0, max:1, group:kind
  })))),
  {key:'minimumOutdoorOperatingC', label:'Minimum outdoor operating temperature', unit:'°C', frost:'none'},
  {key:'frostThresholdC', label:'Frost threshold', unit:'°C', frost:'active'},
  {key:'initialDefrostFraction', label:'Initial defrost fraction', unit:'fraction', min:0, max:1, frost:'exhaustOnly'},
  {key:'defrostRatePerK', label:'Defrost increase per degree', unit:'1/K', min:0, frost:'exhaustOnly'}
];
const UNIT_CONVERSIONS={'°C':[1.8,32,'°F'],'± °C':[1.8,0,'± °F'],'m²':[10.7639104,0,'ft²'],'m':[3.2808399,0,'ft']};
const MAX_SITES = 5;
const uid = () => crypto.randomUUID();
const finite = value => typeof value === 'number' && Number.isFinite(value);
const format = (value, digits = 0) => finite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'Not available';
const currencyFormats=[new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2})];
const money = (value, cents = false) => finite(value) ? currencyFormats[cents?1:0].format(value) : 'Unpriced';
const units = (value, unit, digits = 1) => finite(value) ? `${format(value, digits)} ${unit}` : 'Not available';
const percent = (value, digits = 1) => finite(value) ? `${format(value, digits)}%` : 'Not available';
const describe = value => typeof value === 'string' ? value : value == null ? 'Not available' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const near = (a, b) => finite(a) && finite(b) && Math.abs(a - b) <= .001;
const calendarYear = snapshot => {const year = String(snapshot?.startDate || '').slice(0, 4); return snapshot?.startDate === `${year}-01-01` && snapshot?.endDate === `${year}-12-31` ? year : null;};
const current = () => state.scenarios.find(s => s.id === state.selected) || state.scenarios[0];
const result = () => state.results.find(r => r.scenario.id === state.resultId) || state.results[0];
const node = (tag, text, className) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n;};
function message(text, kind = '') {const box = $('app-message'); box.textContent = text; box.className = `notice ${kind}`; box.hidden = !text;}
function on(id, event, action) {$(id).addEventListener(event, async e => {try {await action(e);} catch (error) {message(error.message || String(error), 'error');}});}
function options(select, entries, selected) {select.replaceChildren(...entries.map(([value, label]) => {const option = node('option', label); option.value = value; return option;})); if (selected !== undefined) select.value = selected;}
function table(container, headings, rows) {
  const t = node('table'), head = node('thead'), hr = node('tr'), body = node('tbody');
  headings.forEach(label => {const th = node('th', label); th.scope = 'col'; hr.append(th);}); head.append(hr);
  rows.forEach(row => {const tr = node('tr'); row.forEach((value, i) => tr.append(node('td', describe(value), i === 0 ? 'row-name' : ''))); body.append(tr);});
  t.append(head, body); container.replaceChildren(t);
}
function safeSource(container, label, url) {
  const text = describe(label);
  try {const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(); const a = node('a', text); a.href = parsed.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; container.append(a);}
  catch {container.append(document.createTextNode(text));}
}
function markChanged() {state.revision++; $('stale-notice').hidden = !state.results.length || state.resultRevision === state.revision; $('save-status').textContent = 'Unsaved input changes. Save or export this scenario before closing.'; renderComponentStatus();}
function persist(notify = false) {
  try {saveScenarios(state.scenarios); $('save-status').textContent = 'Scenarios saved in this browser. Export a portable copy for safekeeping.'; if (notify) message('Scenarios saved locally.', 'success');}
  catch (error) {$('save-status').textContent = error.message; message('Browser storage is unavailable or full. Your current inputs still work; export them to preserve your work.', 'warning');}
}
function renderUnitReadout(field,value) {
  const output=$(`unit-${field.key}`);if(!output)return;
  const [factor,offset,label]=UNIT_CONVERSIONS[field.unit];
  output.textContent=finite(value)?`${format(value*factor+offset,1)} ${label} · enter SI above`:'';
}
/* Fields that share another field's definition rather than falling back to their bare unit. */
const FIELD_ALIASES = {nightTargetC:'dayTargetC', vpdMax:'vpdMin', coolingMaxOutdoorC:'coolingMinOutdoorC',
  canopyM2:'areaM2', desiccantKgH:'dehuKgH', humidifierKgH:'dehuKgH', doasCoolingCOP:'coolingCOP',
  doasReheatRecoveryFraction:'reheatFraction', desiccantHeatFraction:'dehuHeatFraction',
  darkTranspirationFraction:'transpirationLDayM2', maintenanceYear:'installedCost', shadeFraction:'parTransmission'};
/* When an input has no definition of its own, its unit usually does. */
const UNIT_TERMS = {'°C':'celsius','± °C':'celsius','fraction':'fraction','ACH':'ach','kW':'kilowatt','W/W':'coolingCOP','$/kWh':'kwh','mol/m²/day':'dliTarget','µmol/J':'efficacy','kPa':'vpdMin','W/m²K':'uValue','kJ/m²K':'thermalMassKJm2K','m³/s':'doasM3s','W/(m³/s)':'fanWPerM3s','L/kWh':'dehuLPerKWh'};
function fieldControl(field) {
  const label = node('label'), title = node('span', field.label, 'field-label'), unit = node('span', field.unit, 'unit');
  // A definition is attached wherever one exists for this input, by field key or by its unit. The
  // button goes beside the name, before the unit, because .field-label puts the unit on its own line.
  const termKey = TERMS[field.key] ? field.key : FIELD_ALIASES[field.key] || UNIT_TERMS[field.unit];
  if (termKey) {const parts = infoBubble(termKey, field.label); if (parts) {title.append(parts.button); document.body.append(parts.bubble);}}
  title.append(unit);
  const input = node('input'); Object.assign(input, {id: `field-${field.key}`, name: field.key, type: 'number', step: 'any', required: true});
  if (field.min !== undefined) input.min = String(field.min);
  if (field.max !== undefined) input.max = String(field.max);
  input.dataset.suggestedStep = field.step; label.append(title, input);
  if(['°C','± °C','m²','m'].includes(field.unit)){const equivalent=node('small','','unit-conversion');equivalent.id=`unit-${field.key}`;label.append(equivalent);}
  return label;
}
/* Fixture preset select and the W/ft² density companion. Neither is schema: the select derives from the
   scenario's lightWm2 and efficacy, and the density input just converts into the SI field. */
function fixturePresetControl() {
  const label = node('label'), title = node('span', 'Lighting fixture preset', 'field-label');
  const select = node('select'); Object.assign(select, {id: 'light-fixture', name: 'lightFixturePreset'});
  options(select, Object.entries(LIGHT_FIXTURES).map(([key, fixture]) => [key, fixture.label]));
  const source = node('p', '', 'help assumption'); source.id = 'light-fixture-source';
  label.append(title, select);
  const wrap = node('div'); wrap.append(label, source);
  return wrap;
}
function lightDensityControl() {
  const label = node('label'), title = node('span', 'Installed fixture power', 'field-label'), unit = node('span', 'W/ft² canopy', 'unit'); title.append(unit);
  const input = node('input'); Object.assign(input, {id: 'field-lightWft2', name: 'lightWft2', type: 'number', step: 'any', min: '0', max: String(Math.round(1000 / FT2_PER_M2 * 10) / 10), required: true});
  input.dataset.suggestedStep = '.5'; label.append(title, input);
  return label;
}
function derivedLightFixture(s) {
  for (const [key, fixture] of Object.entries(LIGHT_FIXTURES)) {
    const wm2 = fixtureWm2(key);
    if (wm2 !== null && finite(s.lightWm2) && Math.abs(s.lightWm2 - wm2) < .05 && near(s.efficacy, fixture.efficacy)) return key;
  }
  return 'custom';
}
function syncFixtureSelect(s) {
  const key = derivedLightFixture(s);
  $('light-fixture').value = key;
  $('light-fixture-source').textContent = LIGHT_FIXTURES[key].source || 'Declared fixture power and efficacy. The W/ft² field converts into the SI value beside it; storage and exports stay W/m².';
}
function syncLightFields(s) {
  syncFixtureSelect(s);
  $('field-lightWft2').value = finite(s.lightWm2) ? String(Math.round(s.lightWm2 / FT2_PER_M2 * 10) / 10) : '';
}
function buildFields() {
  for (const group of FIELDS) {
    const details = node('details'), summary = node('summary', group.label === 'Airflow & evaporative cooling' ? 'Evaporative cooling & humidification' : group.label), grid = node('div', undefined, 'two-grid'); details.append(summary, grid);
    if (group.label === 'Crop targets & lighting') grid.append(fixturePresetControl());
    for (const field of group.fields) {
      const target = coreKeys.has(field.key) ? $('core-fields') : airflowKeys.has(field.key) ? $('airflow-fields') : doasKeys.has(field.key) ? $('doas-fields') : grid;
      const label = field.key === 'fanWPerM3s' ? 'Combined supply / exhaust fan specific power' : field.key === 'doasM3s' ? 'Maximum DOAS treatment capacity' : field.label;
      target.append(fieldControl({...field, label}));
      if (field.key === 'lightWm2') target.append(lightDensityControl());
    }
    if (grid.childElementCount) $('advanced-fields').append(details);
  }
  for (const field of recoveryFields) {
    const control = fieldControl({...field, key:`heatRecovery.${field.key}`});
    $(`recovery-${field.group || 'frost'}-fields`).append(control);
  }
  options($('outside-air-basis'), Object.entries(AIRFLOW_BASIS));
  $('run-all').setAttribute('aria-describedby', 'configuration-status');
  for (const [id, source] of [['facility', FACILITIES], ['system', SYSTEMS], ['technology', TECHNOLOGIES], ['upgrade-select', TECHNOLOGIES]]) options($(id), Object.entries(source));
  options($('crop'), Object.entries(CROPS).map(([key, crop]) => [key, crop.label])); $('upgrade-select').value = 'integrated';
}
function scenarioErrors(s) {
  const errors = validateScenario(s);
  if (!s.outsideAirReviewed && !errors.some(error => /review/i.test(error))) errors.push('Review the controlled outdoor-air capacities and fan specific power before running this scenario.');
  return errors;
}
function showErrors(id, errors) {
  const box = $(id); box.replaceChildren(); box.hidden = !errors.length;
  if (errors.length) {const list = node('ul'); for (const error of errors) list.append(node('li', error)); box.append(list);}
}
function renderComponentStatus() {
  const s = current(); if (!s) return;
  const errors = scenarioErrors(s);
  showErrors('airflow-errors', errors.filter(error => /outdoor.air|infiltration|fan specific power/i.test(error) && !error.startsWith('DOAS treatment')));
  showErrors('recovery-errors', heatRecoveryErrors(s.heatRecovery).map(error => {
    for (const field of recoveryFields) if (error.startsWith(field.key)) return `${field.label}${error.slice(field.key.length)}`;
    return error;
  }));
  for (const key of doasKeys) $(`field-${key}`).required = key === 'doasM3s' || s.technology === 'doas' || s.doasM3s > 0;
  showErrors('doas-errors', errors.filter(error => error.startsWith('DOAS')));
  const status = $('configuration-status'); status.replaceChildren();
  let incomplete = false;
  for (const scenario of state.scenarios) {
    const scenarioIssues = scenario === s ? errors : scenarioErrors(scenario);
    if (!scenarioIssues.length) continue;
    if (!incomplete) status.append(node('p', 'Run blocked. Resolve these scenario inputs before running.', 'help'));
    incomplete = true;
    const box = node('div', undefined, 'component-callout component-errors'), list = node('ul');
    box.append(node('strong', scenario.name || 'Unnamed scenario'), list);
    for (const error of scenarioIssues) list.append(node('li', error));
    status.append(box);
  }
  status.hidden = !incomplete;
  $('run-all').disabled = !state.snapshot || state.weatherBusy || !!state.pool || !!state.runId || incomplete;
}
function renderAirflow() {
  const s = current();
  $('outside-air-basis').value = s.outsideAirBasis;
  $('outside-air-reviewed').checked = s.outsideAirReviewed === true;
  $('airflow-basis-readout').textContent = `${AIRFLOW_BASIS[s.outsideAirBasis] || 'Unknown basis'}. ${s.outsideAirReviewed ? 'Reviewed inputs.' : 'Review required.'} Changing minimum, maximum or fan power clears review.`;
  $('mushroom-airflow-note').hidden = s.system !== 'mushroom';
  const readouts = $('airflow-conversions'); readouts.replaceChildren();
  readouts.append(node('p', `Flow conversion at ${units(s.heightM, 'm', 2)} mean height and ${units(s.areaM2, 'm²', 1)} floor area.`, 'help'));
  for (const key of ['infiltrationACH', 'minVentACH', 'maxVentACH']) {
    const row = node('div'); row.append(node('strong', fieldByKey.get(key).label));
    let text = 'Enter a finite nonnegative ACH value and positive floor area and mean height.';
    if (finite(s[key]) && s[key] >= 0 && finite(s.heightM) && s.heightM > 0 && finite(s.areaM2) && s.areaM2 > 0) {
      const flow = airflowConversions(s, s[key]);
      text = `${format(flow.m3s, 4)} m³/s · ${format(flow.m3sPerM2, 6)} m³/s per m² · ${format(flow.cfm, 1)} cfm · ${format(flow.cfmPerFt2, 4)} cfm/ft²`;
    }
    row.append(node('p', text, 'mono')); readouts.append(row);
  }
  const literature = $('airflow-literature'); literature.replaceChildren();
  const card = (title, text, source) => {
    const box = node('div', undefined, 'component-callout'); box.append(node('strong', title), node('p', text));
    if (source?.sourceUrl) safeSource(box, source.source, source.sourceUrl);
    literature.append(box);
  };
  const evidence = AIRFLOW_EVIDENCE;
  card('Uncontrolled infiltration', `Original units, ACH: new glass or fiberglass ${evidence.infiltration.constructionACH.glass.join(' to ')}; new double-layer polyethylene ${evidence.infiltration.constructionACH.doublePolyethylene.join(' to ')}. These are construction-specific ranges.`, evidence.infiltration);
  for (const [material, range] of Object.entries(evidence.controlled.floorNormalizedM3sPerM2)) {
    const conversion = finite(s.heightM) && s.heightM > 0 ? `${range.map(flow => format(flow * 3600 / s.heightM, 2)).join(' to ')} ACH at ${format(s.heightM, 2)} m mean height.` : 'Enter positive mean height to convert to ACH.';
    card(`${material === 'glass' ? 'Glass' : 'Polyethylene'} controlled air`, `Original units: ${range.join(' to ')} m³/s per m² of floor. ${conversion}`, evidence.controlled);
  }
  card('Warm-weather operating context', 'UGA 60 ACH warm-weather guidance and Shamshiri 60 to 90 ACH fan-and-pad guidance are operating context, not universal validation limits.', evidence.controlled);
  card('Closed-room adjacent proxy', `${evidence.closedRoom.measuredACH} ACH, original measured units. ${evidence.closedRoom.applicability}`, evidence.closedRoom);
  card('Applicability limits', evidence.unsupported.applicability);
  if (s.system === 'mushroom') card('Mushroom project basis', evidence.mushroom.applicability, evidence.mushroom);
  for (const warning of airflowEvidenceWarnings(s)) card('Outside the source context', warning);
}
function renderRecovery() {
  const recovery = backfillHeatRecovery(current().heatRecovery), active = recovery.type !== 'none';
  $('recovery-type').value = recovery.type; $('recovery-frost').value = recovery.frostControl;
  $('recovery-active').hidden = !active;
  $('recovery-latent-fields').hidden = recovery.type !== 'erv';
  $('recovery-latent-note').hidden = recovery.type !== 'hrv';
  $('recovery-frost').disabled = !active;
  for (const field of recoveryFields) {
    const key = `heatRecovery.${field.key}`, input = $(`field-${key}`);
    const visible = active && (field.group !== 'latent' || recovery.type === 'erv') && (!field.frost || field.frost === recovery.frostControl || field.frost === 'active' && recovery.frostControl !== 'none');
    input.closest('label').hidden = !visible; input.disabled = !visible; input.required = visible;
    input.value = finite(recovery[field.key]) ? recovery[field.key] : '';
    renderUnitReadout({...field, key}, recovery[field.key]);
  }
}
function focusDoas() {
  if (current().technology === 'doas') {$('doas-panel').focus(); $('doas-panel').scrollIntoView({block:'center'});}
}
function renderScenarioList() {
  options($('scenario-select'), state.scenarios.map((s, i) => [s.id, `${i === 0 ? 'Baseline · ' : ''}${s.name}`]), state.selected);
  $('scenario-count').textContent = `${state.scenarios.length} scenario${state.scenarios.length === 1 ? '' : 's'}`;
  $('remove-scenario').disabled = state.scenarios.length <= 1;
}
function renderScenario() {
  const s = current(); if (!s) return; state.selected = s.id; renderScenarioList();
  for (const field of fieldByKey.values()) {$(`field-${field.key}`).value = finite(s[field.key]) ? s[field.key] : '';renderUnitReadout(field,s[field.key]);}
  syncLightFields(s);
  for (const id of ['facility', 'system', 'crop', 'technology']) $(id).value = s[id];
  // Scenarios saved before v0.2 carry no model choice; validateScenario back-fills the same defaults at run time.
  $('control-mode').value = s.controlMode ?? DEFAULT_SCENARIO.controlMode ?? 'staged';
  $('transpiration-model').value = s.transpirationModel ?? CROPS[s.crop]?.transpirationModel ?? DEFAULT_SCENARIO.transpirationModel ?? 'stanghellini';
  $('scenario-name').value = s.name; $('pad-enabled').checked = s.padEnabled; $('integrated-hvac').checked = s.integratedHVAC;
  $('crop-source').textContent = `Assumed crop defaults: ${CROPS[s.crop]?.source || 'User-defined program. Review targets, lighting and evaporation explicitly.'}`;
  $('price-mode').value = s.priceMode === 'manual' ? 'manual' : 'state';
  renderAirflow(); renderRecovery(); renderComponentStatus();
}
function updateScenario(event) {
  const input = event.target, s = current(); if (!s || !input.name) return;
  if (input.name.startsWith('heatRecovery.')) {
    const key = input.name.slice('heatRecovery.'.length), recovery = {...backfillHeatRecovery(s.heatRecovery)};
    recovery[key] = input.tagName === 'SELECT' ? input.value : input.value === '' ? null : Number(input.value);
    if (key === 'type') {
      recovery.economizerBypass = true;
      for (const field of recoveryFields.filter(field => field.group === 'latent')) recovery[field.key] = recovery.type === 'hrv' ? 0 : null;
    }
    s.heatRecovery = recovery;
    if (input.tagName === 'SELECT') renderRecovery();
    else {const field = recoveryFields.find(field => field.key === key); if (field) renderUnitReadout({...field, key:input.name}, recovery[key]);}
  }
  else if (fieldByKey.has(input.name)) {
    s[input.name] = input.value === '' ? null : Number(input.value); renderUnitReadout(fieldByKey.get(input.name),s[input.name]);
    if (input.name === 'installedCost') s.installedCostBasis = 'userEntered';
    if (['minVentACH', 'maxVentACH'].includes(input.name)) {s.outsideAirBasis = 'projectInput'; s.outsideAirReviewed = false;}
    if (input.name === 'fanWPerM3s') s.outsideAirReviewed = false;
    if (['lightWm2', 'efficacy'].includes(input.name)) syncLightFields(s);
  }
  else if (input.name === 'lightWft2') {
    s.lightWm2 = input.value === '' ? null : Math.round(Number(input.value) * FT2_PER_M2 * 10) / 10;
    $('field-lightWm2').value = finite(s.lightWm2) ? String(s.lightWm2) : '';
    syncFixtureSelect(s);
  }
  else if (input.name === 'outsideAirBasis') {s.outsideAirBasis = input.value; s.outsideAirReviewed = false;}
  else if (input.type === 'checkbox') s[input.name] = input.checked;
  else if (modelKeys.has(input.name)) s[input.name] = input.value;
  else if (input.name === 'name') {s.name = input.value; renderScenarioList();}
  else return;
  if (airflowKeys.has(input.name) || ['areaM2', 'heightM', 'outsideAirBasis', 'outsideAirReviewed'].includes(input.name)) renderAirflow();
  markChanged();
}
function templateChanged(kind) {
  const old = current(), next = makeScenario($('facility').value, $('system').value, $('crop').value);
  Object.assign(next, {id: old.id, latitude: old.latitude, longitude: old.longitude, timezone: old.timezone, zip: old.zip, priceMode: old.priceMode, sector: old.sector});
  state.scenarios[state.scenarios.indexOf(old)] = next; markChanged(); renderScenario();
  message(`${kind} template loaded. Geometry, crop and equipment assumptions were reset for this scenario; other scenarios are unchanged.`);
}
function addScenario(s) {
  if (state.scenarios.length >= 20) throw new Error('This workspace supports up to 20 scenarios. Export or remove a scenario before adding another.');
  s.id = uid(); state.scenarios.push(s); state.selected = s.id; markChanged(); renderScenario(); persist();
}
const signed = (value, digits = 1) => `${value < 0 ? '−' : '+'}${format(Math.abs(value), digits)}`;
const relative = factor => `${factor < 1 ? '−' : '+'}${Math.round(Math.abs(factor - 1) * 100)}%`;
const round = value => Math.round(value * 1000) / 1000;
const fieldLabel = key => fieldByKey.get(key)?.label || key;
/** One-assumption sensitivity sets. Each entry: [name suffix, patch of scenario keys]. */
const SENSITIVITY = {
  pad: () => [.7, .8, .85, .9].map(v => [`${fieldLabel('padEffectiveness')} ${Math.round(v * 100)}%`, {padEffectiveness: v, padEnabled: true}]),
  crop: s => (s.transpirationModel ?? CROPS[s.crop]?.transpirationModel ?? DEFAULT_SCENARIO.transpirationModel) === 'schedule' ? [.75, 1.25].map(f => [`${fieldLabel('transpirationLDayM2')} ${relative(f)}`, {transpirationLDayM2: s.transpirationLDayM2 * f}]) : [.75, 1.25].map(f => [`${fieldLabel('lai')} ${relative(f)}`, {lai: round(s.lai * f)}]),
  solar: s => [.8, 1.2].map(f => [`${fieldLabel('solarTransmission')} ${relative(f)}`, {solarTransmission: s.solarTransmission * f}]),
  envelope: s => [.8, 1.2].map(f => [`${fieldLabel('uValue')} ${relative(f)}`, {uValue: s.uValue * f}]),
  price: s => [.75, 1.25].map(f => [`${fieldLabel('electricityPrice')} ${relative(f)}`, {electricityPrice: s.electricityPrice * f, priceMode: 'manual'}]),
  temperature: () => [1, 2, 3].map(t => [`${fieldLabel('tempToleranceC')} ±${t} °C`, {tempToleranceC: t}]),
  vpd: s => [-.2, .2].map(d => [`VPD band ${signed(d)} kPa`, {vpdMin: round(s.vpdMin + d), vpdMax: round(s.vpdMax + d)}]),
  dewPoint: s => [-2, 2].map(d => [`${fieldLabel('maxDewPointC')} ${signed(d, 0)} °C`, {maxDewPointC: round(s.maxDewPointC + d)}]),
  photoperiod: () => [0, 6, 12, 18].map(h => [`${fieldLabel('dayStart')} ${h} h`, {dayStart: h}]),
};
function sensitivity() {
  const s = current(), choice = $('sensitivity-select').value, cases = SENSITIVITY[choice](s);
  if (state.scenarios.length + cases.length > 20) throw new Error('Remove scenarios first. The sensitivity set would exceed 20 scenarios.');
  if (choice === 'solar' && OPAQUE_FACILITIES.has(s.facility)) throw new Error(`The ${FACILITIES[s.facility]} template is opaque, so it has no direct solar transmission to vary. Choose an envelope or crop sensitivity instead.`);
  const variants = cases.map(([suffix, patch]) => {
    for (const [key, value] of Object.entries(patch)) {const field = fieldByKey.get(key); if (field && (value < field.min || value > field.max)) throw new Error(`${field.label} sensitivity (${format(value, 2)} ${field.unit}) is outside the allowed range of ${field.min} to ${field.max}. Change the starting assumption first.`);}
    return {...s, ...patch, id: uid(), name: `${s.name.slice(0, 75)} · ${suffix}`};
  });
  state.scenarios.push(...variants); markChanged(); renderScenarioList(); persist(); message(`Added ${variants.length} one-assumption sensitivity scenarios. Run all to compare their target hours and period costs.${choice === 'price' ? ' These variants use a manual electricity price.' : ''}`, 'success');
}

/* Weather source picker. The comparison is rendered from providers.js rather than written into the
   markup, so adding a source is a data change. A key a user pastes stays in this browser: it is kept
   under a per-provider storage key, sent only to that provider's own adapter, and never written into
   an export, a saved scenario or a message. */
const providerKeyStore = id => `weather-api-key:${id}`;
function apiKeyFor(id) {
  if (!needsApiKey(id)) return null;
  try { return localStorage.getItem(providerKeyStore(id)) || null; } catch { return null; }
}
function buildProviders() {
  const select = $('weather-provider');
  options(select, PROVIDER_ORDER.filter(id => PROVIDERS[id]).map(id => [id, PROVIDERS[id].label]));
  select.value = PROVIDER_ORDER[0];
  renderProvider();
}
function renderProvider() {
  const id = $('weather-provider').value, provider = PROVIDERS[id];
  const body = $('provider-detail-body'); body.replaceChildren();
  if (!provider) return;
  body.append(node('p', provider.summary, 'help'));
  const facts = node('dl', undefined, 'provider-facts');
  for (const [label, value] of [['Grid', provider.grid], ['Covers', provider.coverage], ['Cadence', provider.cadence],
                                ['Licence', provider.licence], ['Limits', provider.limits]]) {
    if (!value) continue;
    const row = node('div'); row.append(node('dt', label), node('dd', value)); facts.append(row);
  }
  body.append(facts);
  for (const [heading, items, className] of [['Good for', provider.pros, 'provider-pros'], ['Costs you', provider.cons, 'provider-cons']]) {
    const section = node('div', undefined, className);
    section.append(node('h4', heading));
    const list = node('ul');
    for (const item of items || []) list.append(node('li', item));
    section.append(list); body.append(section);
  }
  if (provider.attribution) body.append(node('p', `Attribution required in anything you publish: ${provider.attribution}`, 'source-line'));
  if (provider.termsUrl) {const p = node('p', '', 'source-line'); safeSource(p, 'Provider terms', provider.termsUrl); body.append(p);}

  const keyRow = $('provider-key-row'), field = $('provider-key');
  keyRow.hidden = !needsApiKey(id);
  if (!keyRow.hidden) {
    field.value = apiKeyFor(id) || '';
    field.placeholder = provider.apiKey.placeholder || 'paste your own key';
    $('provider-key-note').textContent = `${provider.apiKey.help} The key stays in this browser, is sent only to ${provider.label}, and never appears in an export or a saved scenario.`;
  }
  // The station field only means anything for a station source.
  const stationRow = $('station')?.closest('label');
  if (stationRow) stationRow.hidden = !['iem', 'ncei'].includes(id);
  const stationNote = $('station-note');
  if (stationNote) stationNote.textContent = id === 'ncei'
    ? 'Leave this empty and the nearest reporting station to your coordinates is found for you, then named with its distance and elevation. Enter an eleven digit NCEI station identifier to pin a specific one.'
    : 'A station is a real instrument at a fixed place, usually an airport, so it does not follow the ZIP when you change it. Set it yourself for the site you are screening. Once weather arrives the tool tells you how far that station sits from your coordinates, so you can judge whether it speaks for your site. Sunlight comes from a separate satellite source either way, never from the station.';
}
function saveProviderKey() {
  const id = $('weather-provider').value;
  if (!needsApiKey(id)) return;
  const value = $('provider-key').value.trim();
  try { value ? localStorage.setItem(providerKeyStore(id), value) : localStorage.removeItem(providerKeyStore(id)); }
  catch { message('This browser refused to store the key, so it will be forgotten when the page reloads.', 'warning'); }
}
function locationValues() {
  const latitude = Number($('latitude').value), longitude = Number($('longitude').value), timezone = $('timezone').value.trim();
  if (!$('latitude').value || !$('longitude').value || !finite(latitude) || Math.abs(latitude) > 90 || !finite(longitude) || Math.abs(longitude) > 180) throw new Error('Enter a latitude and longitude in degrees, or enter a ZIP and select Locate to fill them in.');
  try {new Intl.DateTimeFormat('en', {timeZone: timezone});} catch {throw new Error('Enter a valid IANA time zone name, such as America/Denver. This sets the local clock every daily figure is built on.');}
  return {latitude, longitude, timezone, zip: $('zip').value.trim()};
}
function copyLocationToScenarios(location) {for (const s of state.scenarios) Object.assign(s, location);}
function reflectLocation(location) {for (const id of ['latitude', 'longitude', 'timezone', 'zip']) if (location[id] != null) $(id).value = location[id];}
function weatherBusy(busy, text = '') {
  $('fetch-weather').disabled = busy; $('retrieve-years').disabled = busy; $('weather-status').className = 'status-line'; $('weather-status').textContent = text;
  state.weatherBusy = busy; renderComponentStatus();
}
/* Weather years: every calendar-year snapshot available for a coordinate pair, by source. Loaded > cached. */
/* A calendar year is bounded by local days, so a year stored on one clock covers a different set of
   UTC hours than the same year on another. Offering a year cached under a different time zone would
   both fail the run and, because retrieveYears skips any year listed here, stop the user re-fetching
   the one that would work. Matching the zone as well as the coordinates is what keeps that door open. */
function yearSources(latitude, longitude, timezone) {
  const sources = new Map();
  const sameSite = entry => near(entry.latitude, latitude) && near(entry.longitude, longitude) && entry.timezone === timezone;
  for (const entry of state.cached) {const year = calendarYear(entry); if (year && sameSite(entry)) sources.set(year, {kind: 'cached', key: entry.key, source: entry.source});}
  const loaded = calendarYear(state.snapshot);
  if (loaded && state.snapshot && sameSite(state.snapshot)) sources.set(loaded, {kind: 'loaded', source: state.snapshot.source});
  return new Map([...sources].sort());
}
async function refreshYears() {
  try {state.cached = await listWeather();} catch {state.cached = [];}
  // Blank coordinates are not 0,0: an unlocated site has no weather years, it does not sit off Africa.
  const located = $('latitude').value !== '' && $('longitude').value !== '';
  state.yearSources = located ? yearSources(Number($('latitude').value), Number($('longitude').value), $('timezone').value.trim()) : new Map();
  for (const year of state.years) if (!state.yearSources.has(year)) state.years.delete(year);
  renderYearChips(); renderSiteChips();
}
function renderYearChips() {
  const box = $('year-chips'); box.replaceChildren();
  const years = [...state.yearSources.keys()];
  if (!years.length) box.append(node('p', 'No whole years of weather are saved for this location yet. Use Retrieve years below to download them, or import a snapshot you already have. Years you download stay in this browser, so they load instantly next time.', 'help'));
  for (const year of years) {
    const source = state.yearSources.get(year), chip = node('button', year, 'chip'); chip.type = 'button'; chip.setAttribute('aria-pressed', String(state.years.has(year)));
    chip.append(node('small', source.kind)); chip.title = `${describe(source.source)} · ${source.kind}`;
    chip.addEventListener('click', () => {if (state.years.has(year)) state.years.delete(year); else state.years.add(year); markChanged(); renderYearChips(); renderSiteChips();});
    box.append(chip);
  }
  $('years-note').textContent = state.years.size ? `${state.years.size} of ${years.length} saved year${years.length === 1 ? '' : 's'} selected. Every scenario is run against each one, so you can see how much the answer moves between weather years.` : state.snapshot ? `No year selected, so the run uses only the weather now loaded, ${state.snapshot.startDate} to ${state.snapshot.endDate}.` : 'Choose which calendar years to run. Every scenario is run against each one.';
}
function renderSiteChips() {
  const box = $('site-chips'); box.replaceChildren();
  if (!state.sites.length) box.append(node('p', 'No additional sites. The primary site above is always included.', 'help'));
  for (const site of state.sites) {
    const chip = node('span', undefined, 'chip'); chip.setAttribute('role', 'listitem');
    const sources = yearSources(site.latitude, site.longitude, site.timezone), local = [...state.years].filter(year => sources.has(year)).length;
    chip.append(document.createTextNode(`${site.city || 'Site'}${site.state ? `, ${site.state}` : ''} · ${site.zip}`), node('small', state.years.size ? `${local}/${state.years.size} years local` : 'same period as loaded snapshot'));
    const remove = node('button', '×'); remove.type = 'button'; remove.setAttribute('aria-label', `Remove site ${site.zip}`);
    remove.addEventListener('click', () => {state.sites = state.sites.filter(s => s !== site); markChanged(); renderSiteChips();});
    chip.append(remove); box.append(chip);
  }
}
// Proposal only; the user confirms it. Table and split-state rules live in energy.js beside lookupZip.
function proposeSiteTimezone() {
  const zip = $('site-zip').value.trim(); if (!/^\d{5}$/.test(zip) || !state.catalog) return;
  const proposal = proposeTimezone(lookupZip(zip, state.catalog), state.catalog);
  if (!proposal) return;
  const field = $('site-timezone');
  if (!field.dataset.edited) {
    field.value = proposal.timezone;
    field.dataset.proposedFor = zip;
    $('site-timezone-note').textContent = `${proposal.note} Verify before adding.`;
  }
}
async function addSite() {
  if (!state.catalog) throw new Error('The public ZIP catalog is unavailable, so additional sites cannot be resolved. Reload the page to retry the catalog.');
  const zip = $('site-zip').value.trim(); if (!/^\d{5}$/.test(zip)) throw new Error('Enter a five-digit US ZIP code for the additional site.');
  if (zip === $('zip').value.trim()) throw new Error('That ZIP is the primary site. Add a different ZIP to compare.');
  if (state.sites.some(site => site.zip === zip)) throw new Error(`ZIP ${zip} is already in the site list.`);
  if (state.sites.length >= MAX_SITES) throw new Error(`Up to ${MAX_SITES} additional sites can be compared at once. Remove one first.`);
  const info = lookupZip(zip, state.catalog);
  if (!info) throw new Error(`ZIP ${zip} is not present in the source catalog. This catalog is not a USPS service guarantee.`);
  if (!finite(info.latitude) || !finite(info.longitude)) throw new Error(`ZIP ${zip} has no coordinate record. Only ZIPs with catalog coordinates can be added as comparison sites; set it as the primary site with manual coordinates instead.`);
  const timezone = $('site-timezone').value.trim();
  if (!timezone) throw new Error(`Enter the IANA time zone for ZIP ${zip}. The bundled table has no entry for it, so nothing is proposed rather than guessed.`);
  try {new Intl.DateTimeFormat('en', {timeZone: timezone});} catch {throw new Error(`${timezone} is not a valid IANA time zone. Use a name such as America/Phoenix.`);}
  state.sites.push({zip, city: info.city || null, state: info.state || null, latitude: info.latitude, longitude: info.longitude, timezone});
  $('site-zip').value = ''; const field = $('site-timezone'); field.value = ''; delete field.dataset.edited; markChanged(); renderSiteChips();
  message(`${info.city || 'Site'}${info.state ? `, ${info.state}` : ''} (ZIP ${zip} centroid, ${timezone}) added. Its weather years are loaded from cache or NASA POWER at run time; costs use manual scenario prices.`, 'success');
}
async function retrieveYears() {
  const location = locationValues(), count = Math.max(1, Math.min(10, Math.round(Number($('retrieve-years-count').value) || 0)));
  const lastComplete = new Date().getUTCFullYear() - 1, wanted = Array.from({length: count}, (_, i) => String(lastComplete - i));
  await refreshYears();
  const missing = wanted.filter(year => !state.yearSources.has(year)).reverse();
  if (!missing.length) {for (const year of wanted) state.years.add(year); renderYearChips(); renderSiteChips(); markChanged(); message(`The ${count} most recent complete years are already available locally and are now selected.`, 'success'); return;}
  const epoch = ++state.weatherEpoch; state.weatherController?.abort(); state.weatherController = new AbortController();
  const provider = $('weather-provider').value, station = $('station').value.trim();
  weatherBusy(true, `Retrieving ${missing.length} calendar year${missing.length === 1 ? '' : 's'} from the selected source…`);
  let done = 0;
  try {
    for (const year of missing) {
      const snapshot = await fetchWeather({...location, startDate: `${year}-01-01`, endDate: `${year}-12-31`, provider, station, signal: state.weatherController.signal, onProgress: (value, text) => {if (epoch === state.weatherEpoch) $('weather-status').textContent = `Year ${year} (${done + 1}/${missing.length}) · ${finite(value) ? `${format(value * 100)}% · ` : ''}${text || 'Retrieving weather…'}`;}});
      if (epoch !== state.weatherEpoch) return;
      const normalized = normalizeWeather(snapshot);
      try {await saveWeather(normalized, {latest: false});} catch (error) {throw new Error(`Year ${year} was retrieved but could not be cached: ${error.message}`);}
      done++; state.years.add(year);
    }
    await refreshYears(); for (const year of wanted) if (state.yearSources.has(year)) state.years.add(year); renderYearChips(); renderSiteChips(); markChanged();
    $('weather-status').textContent = `${done} calendar year${done === 1 ? '' : 's'} retrieved and cached in this browser. The loaded snapshot is unchanged.`;
  } catch (error) {if (epoch === state.weatherEpoch) {await refreshYears(); $('weather-status').className = 'status-line error'; $('weather-status').textContent = `${error.message} ${done} of ${missing.length} years were cached before the failure. No synthetic replacement was used.`;}}
  finally {if (epoch === state.weatherEpoch) {const text = $('weather-status').textContent, error = $('weather-status').classList.contains('error'); weatherBusy(false, text); $('weather-status').classList.toggle('error', error);}}
}
// `normalized` is set only where the snapshot already came out of normalizeWeather (the import worker),
// so a 100+ MB import is not re-normalized on the UI thread.
async function acceptWeather(snapshot, {persistSnapshot = true, adoptLocation = true, normalized = false} = {}) {
  state.snapshot = normalized ? snapshot : normalizeWeather(snapshot);
  const location = {latitude: finite(snapshot.latitude) ? snapshot.latitude : Number($('latitude').value), longitude: finite(snapshot.longitude) ? snapshot.longitude : Number($('longitude').value), timezone: snapshot.timezone};
  if(adoptLocation){
    if(Math.abs(location.latitude-Number($('latitude').value))>.001||Math.abs(location.longitude-Number($('longitude').value))>.001){
      location.zip='';$('location-description').textContent='The weather you imported is for different coordinates, so the site has moved. Enter the matching ZIP if you want local energy prices. Nothing was guessed from the file.';
    }
    reflectLocation(location);copyLocationToScenarios(location);
  }
  $('start-date').value = snapshot.startDate; $('end-date').value = snapshot.endDate;
  const hours = state.snapshot.hours, met = hours.filter(h => finite(h.tempC) && finite(h.rh) && finite(h.pressurePa)).length, solar = hours.filter(h => finite(h.ghiWm2)).length;
  $('weather-badge').textContent = `${format(hours.length)} hourly intervals`; $('weather-badge').className = 'badge loaded';
  const detail = $('weather-detail'); detail.replaceChildren();
  safeSource(detail, `${describe(snapshot.source)} · ${describe(snapshot.sourceKind)}`, snapshot.sourceUrl);
  detail.append(document.createTextNode(` · ${snapshot.startDate} to ${snapshot.endDate} · ${snapshot.timezone}. Meteorology ${format(met)}/${format(hours.length)} h; solar ${format(solar)}/${format(hours.length)} h.${finite(snapshot.sourceElevationM) ? ` Source elevation ${format(snapshot.sourceElevationM, 0)} m: pressure, and so humidity ratio, are at the source's elevation, not necessarily the site's.` : ''} Retrieved ${snapshot.retrievedAt || 'date unavailable'}.`));
  if (snapshot.warnings?.length) detail.append(document.createTextNode(` ${snapshot.warnings.map(describe).join(' ')}`));
  markChanged(); persist(); renderComponentStatus();
  if (persistSnapshot) {try {await saveWeather(state.snapshot);} catch (error) {message(`Weather is loaded but could not be cached: ${error.message}`, 'warning');}}
  const year = calendarYear(state.snapshot); state.years = new Set(year ? [year] : []);
  await refreshYears();
  await refreshEnergy();
}
async function retrieveWeather(event) {
  event.preventDefault(); const location = locationValues(), startDate = $('start-date').value, endDate = $('end-date').value;
  if (!startDate || !endDate || startDate > endDate) throw new Error('Choose a valid inclusive date range, with start on or before end.');
  const epoch = ++state.weatherEpoch; state.weatherController?.abort(); state.weatherController = new AbortController();
  weatherBusy(true, 'Retrieving real source data. Public services may take a little while…');
  try {
    const snapshot = await fetchWeather({...location, startDate, endDate, provider: $('weather-provider').value, apiKey: apiKeyFor($('weather-provider').value), station: $('station').value.trim(), signal: state.weatherController.signal, onProgress: (value, text) => {if (epoch === state.weatherEpoch) $('weather-status').textContent = `${finite(value) ? `${format(value * 100)}% · ` : ''}${text || 'Retrieving weather…'}`;}});
    if (epoch !== state.weatherEpoch) return; await acceptWeather(snapshot); $('weather-status').textContent = 'Weather retrieved. Any hours the source did not have are kept as gaps rather than filled in with a guess.';
  } catch (error) {if (epoch === state.weatherEpoch) {$('weather-status').className = 'status-line error'; $('weather-status').textContent = `${error.message} Whatever weather you already had is untouched, and nothing was invented to replace what failed.`;}}
  finally {if (epoch === state.weatherEpoch) {const text = $('weather-status').textContent, error = $('weather-status').classList.contains('error'); weatherBusy(false, text); $('weather-status').classList.toggle('error', error);}}
}
async function locate() {
  if (!state.catalog) throw new Error('The public ZIP list could not be loaded, so Locate cannot run. You can still type coordinates in by hand. Reloading the page will try the list again.');
  const zip = $('zip').value.trim(); if (!/^\d{5}$/.test(zip)) throw new Error('Enter a five-digit US ZIP code. Leading zeroes matter, so keep them.');
  const info = lookupZip(zip, state.catalog); state.zipInfo = info;
  if (!info) {$('location-description').textContent = `ZIP ${zip} is not present in this catalog. Enter coordinates manually; no provider is inferred.`; await refreshEnergy(); throw new Error('That ZIP is not in the public list this tool uses. The list is not the official USPS one, so a valid ZIP can still be missing from it.');}
  if (!finite(info.latitude) || !finite(info.longitude)) {
    $('location-description').textContent = `ZIP ${zip} has provider mapping records but no coordinate record. Coordinates were not changed. Set the site coordinates and time zone explicitly.`;
    markChanged(); await refreshEnergy(); return;
  }
  reflectLocation(info); copyLocationToScenarios({zip, latitude: info.latitude, longitude: info.longitude});
  const proposal = proposeTimezone(info, state.catalog);
  if (proposal) {reflectLocation({timezone: proposal.timezone}); copyLocationToScenarios({timezone: proposal.timezone});}
  $('location-description').textContent = `${info.city || 'Location'}${info.state ? `, ${info.state}` : ''} · ZIP ${zip} centroid. ${proposal ? proposal.note : 'No time zone proposal for this record; set the IANA time zone manually.'} The observation station does not move with the ZIP; verify it. Retrieve weather for this location.`;
  markChanged(); await refreshYears(); await refreshEnergy();
}
function renderEnergy() {
  const context = state.energyContext, info = state.zipInfo;
  $('energy-summary').textContent = context ? `${info?.state || 'Unknown geography'} · ${context.prices?.length || 0} dated price records · ${context.grid?.year || 'no'} grid vintage` : 'No resolved energy context';
  const utilities = context?.utilities || info?.utilities || [];
  options($('utility'), utilities.length ? [['', 'Choose a provider candidate'], ...utilities.map(u => [u.id, `${u.name}${u.vintage ? ` (${u.vintage})` : ''}`])] : [['', 'No mapped provider candidate']]);
  $('energy-warnings').textContent = context ? [info?.mappingStatus, ...(context.warnings || [])].filter(Boolean).map(describe).join('\n') : 'No inferred provider, price or regional grid mix. Manual scenario prices remain available.';
  const prices = context?.prices || [];
  table($('price-history'), ['Period', 'USD / kWh', 'Geography / source'], prices.map(p => [p.period, finite(p.usdPerKWh) ? `$${format(p.usdPerKWh, 4)}` : 'Missing', `${describe(p.geography)} · ${describe(p.source)}`]));
  if (!prices.length) $('price-history').append(node('p', 'No dated public price records for this location and period. Manual assumptions are not historical tariffs.', 'help'));
  const mix = $('grid-mix'); mix.replaceChildren();
  if (context?.grid) {
    const grid = context.grid; mix.append(node('p', `${grid.region} · ${grid.year}. ${finite(grid.co2KgPerKWh) ? `${format(grid.co2KgPerKWh, 3)} kg CO₂/kWh, source-year regional factor.` : 'No applicable regional emissions factor.'}`, 'help'));
    for (const fuel of grid.mix || []) {const row = node('div', undefined, 'mix-row'), track = node('span', undefined, 'mix-track'), fill = node('span'); fill.style.width = `${Math.max(0, Math.min(100, Number(fuel.percent) || 0))}%`; track.append(fill); row.append(node('span', fuel.fuel), track, node('span', units(fuel.percent, '%', 1))); mix.append(row);}
    mix.append(node('p', `Source: ${describe(grid.source)}. Annual generation mix, not hourly marginal emissions or the selected supplier's purchases.`, 'source-line'));
  } else mix.append(node('p', 'No defensible regional generation mix is mapped. Unknown is not zero.', 'help'));
  const sourceBox = $('energy-sources'); sourceBox.replaceChildren();
  for (const [i, source] of (context?.sources || []).entries()) {if (i) sourceBox.append(document.createTextNode(' · ')); safeSource(sourceBox, typeof source === 'string' ? source : source.name || source.title || describe(source), source.url || source.sourceUrl);}
}
async function refreshEnergy() {
  const epoch = ++state.energyEpoch; state.energyContext = null;
  if (!state.catalog) {renderEnergy(); return;}
  try {
    const info = lookupZip($('zip').value.trim(), state.catalog); state.zipInfo = info;
    if (!info) {renderEnergy(); return;}
    const context = await getEnergyContext(info, {sector: $('sector').value, startDate: $('start-date').value, endDate: $('end-date').value}, state.catalog);
    if (epoch !== state.energyEpoch) return; state.energyContext = context; renderEnergy();
  } catch (error) {if (epoch === state.energyEpoch) {renderEnergy(); $('energy-warnings').textContent = `Energy context failed: ${error.message}. Manual price entry remains available.`;}}
}
async function initializeEnergy() {
  try {
    state.catalog = await loadEnergyCatalog();
    const coverage = state.catalog.coverage || {};
    $('catalog-coverage').textContent = finite(coverage.zipRecords) ? `Catalog coverage: ${format(coverage.zipRecords)} ZIP records; ${format(coverage.zipsWithUtilityCandidates)} with provider candidates; ${format(coverage.zipsWithMultipleUtilityCandidates)} with multiple candidates; ${format(coverage.zipsUnknownUtility)} without a known utility. ${format(coverage.zipsWithCoordinates)} have coordinates. Public-source inventory, not USPS-authoritative completeness.` : `Catalog coverage metadata: ${describe(coverage)}. Public-source inventory, not USPS-authoritative completeness.`;
    await refreshEnergy();
  } catch (error) {$('energy-summary').textContent = 'Public catalog unavailable'; $('energy-warnings').textContent = `${error.message}. Enter coordinates and manual prices to continue. No nearest-provider guess is used.`; $('catalog-coverage').textContent = 'Coverage unavailable because the catalog did not load.';}
}
/* Worker pool. One run id covers every job; a job error fails the whole batch and keeps the previous results. */
function stopPool() {
  for (const worker of state.pool?.workers || []) worker.terminate();
  state.pool = null; state.runId = null; state.runController?.abort(); state.runController = null;
  renderComponentStatus(); $('cancel-run').hidden = true; $('run-progress').hidden = true;
}
function startPool(jobs, {onProgress, onDone, onError}) {
  const size = Math.max(1, Math.min((navigator.hardwareConcurrency - 1) || 2, jobs.length, 8));
  const pool = {workers: [], queue: [...jobs], progress: new Map(jobs.map(job => [job.id, {value: 0, message: job.label}])), results: new Map(), pending: jobs.length};
  state.pool = pool;
  const fail = text => {if (state.pool !== pool) return; stopPool(); onError(text);};
  const report = () => {
    let sum = 0, slowest = null;
    for (const p of pool.progress.values()) {sum += p.value; if (p.value < 1 && (!slowest || p.value < slowest.value)) slowest = p;}
    onProgress(sum / jobs.length, slowest ? `${slowest.message}${jobs.length > 1 ? ` · ${jobs.length - pool.pending}/${jobs.length} jobs done` : ''}` : 'Collecting results…');
  };
  const next = worker => {
    const job = pool.queue.shift();
    if (!job) {worker.terminate(); pool.workers = pool.workers.filter(w => w !== worker); return;}
    worker.job = job;
    try {worker.postMessage({id: job.id, scenarios: job.scenarios, snapshot: job.snapshot, energyContext: job.energyContext, label: job.label});} catch (error) {fail(error.message);}
  };
  for (let i = 0; i < size; i++) {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'});
    worker.onmessage = event => {
      const data = event.data; if (state.pool !== pool || data.id !== worker.job?.id) return;
      const progress = pool.progress.get(data.id);
      if (data.type === 'progress') {progress.value = Math.max(0, Math.min(1, data.value)); progress.message = data.message || progress.message; report();}
      else if (data.type === 'error') fail(data.message);
      else if (data.type === 'result') {
        progress.value = 1; pool.results.set(data.id, data.results); pool.pending--; report();
        if (pool.pending) next(worker); else {const results = pool.results; stopPool(); onDone(results);}
      }
    };
    worker.onerror = event => {event.preventDefault(); fail(`${event.message || 'module could not load'}. Serve this folder over HTTP and check that all source modules are present.`);};
    worker.onmessageerror = () => fail('The worker result could not be decoded.');
    pool.workers.push(worker); next(worker);
  }
}
/** Snapshot for one site and period: the loaded snapshot, the browser cache, or (additional sites only) a NASA POWER retrieval that is then cached. */
async function resolveSnapshot(site, period, source, signal, onProgress) {
  if (source?.kind === 'loaded') return state.snapshot;
  if (source?.kind === 'cached') {const cached = await loadCachedWeather(source.key); if (cached) return normalizeWeather(cached);}
  const snapshot = normalizeWeather(await fetchWeather({latitude: site.latitude, longitude: site.longitude, timezone: site.timezone, startDate: period.startDate, endDate: period.endDate, provider: 'nasa', signal, onProgress}));
  try {await saveWeather(snapshot, {latest: false});} catch {/* the cache is an optimization; the retrieved period still runs */}
  return snapshot;
}
async function run() {
  if (!state.snapshot) throw new Error('Load or import actual weather before running.');
  const location = locationValues(), years = [...state.years].sort();
  try {state.cached = await listWeather();} catch {state.cached = [];}
  if (years.length) {state.yearSources = yearSources(location.latitude, location.longitude, location.timezone); for (const year of years) if (!state.yearSources.has(year)) throw new Error(`Weather year ${year} is not available for the current coordinates. Locate the site again or refresh the year list.`);}
  else if (Math.abs(location.latitude - state.snapshot.latitude) > .001 || Math.abs(location.longitude - state.snapshot.longitude) > .001 || location.timezone !== state.snapshot.timezone || $('start-date').value !== state.snapshot.startDate || $('end-date').value !== state.snapshot.endDate) throw new Error('Location or dates do not match the loaded snapshot. Retrieve weather again, or restore the snapshot location and dates. No old weather is silently reused for a new site.');
  copyLocationToScenarios({...location, sector: $('sector').value});
  const errors = state.scenarios.flatMap(s => scenarioErrors(s).map(error => `${s.name}: ${error}`));
  if (errors.length) throw new Error(errors.join('\n'));
  const historical = state.scenarios.some(s => s.priceMode !== 'manual');
  if (historical && !state.energyContext) throw new Error('Historical state price mode needs a loaded ZIP energy context. Select manual costing or resolve the ZIP first.');
  if (state.energyContext && (state.energyContext.zip !== location.zip || state.energyContext.sector !== $('sector').value)) throw new Error('Energy context does not match the shared ZIP and customer sector. Resolve the ZIP again before running.');
  stopPool(); message(''); persist();
  const runId = uid(), revision = state.revision, sector = $('sector').value, controller = new AbortController();
  state.runId = runId; state.runController = controller;
  renderComponentStatus(); $('cancel-run').hidden = false; $('run-progress').hidden = false; $('progress').value = 0; $('progress-label').textContent = 'Loading weather years…';
  const primary = {zip: location.zip || null, city: state.zipInfo?.city || null, state: state.zipInfo?.state || null, latitude: location.latitude, longitude: location.longitude, timezone: location.timezone};
  const sites = [{site: primary, scenarios: state.scenarios, priced: true}, ...state.sites.map(site => ({site, scenarios: state.scenarios.map(s => ({...s, latitude: site.latitude, longitude: site.longitude, timezone: site.timezone, zip: site.zip, priceMode: 'manual'})), priced: false}))];
  const jobs = [];
  try {
    for (const [siteIndex, entry] of sites.entries()) {
      const sources = yearSources(entry.site.latitude, entry.site.longitude, entry.site.timezone);
      const periods = years.length ? years.map(year => ({year, startDate: `${year}-01-01`, endDate: `${year}-12-31`})) : [{year: null, startDate: state.snapshot.startDate, endDate: state.snapshot.endDate}];
      for (const period of periods) {
        const progressLabel = `${entry.site.city || entry.site.zip || 'Site'} ${period.year || `${period.startDate} to ${period.endDate}`}`;
        $('progress-label').textContent = `Loading weather · ${progressLabel}`;
        const cachedKey = weatherKey({...entry.site, ...period}), cachedEntry = state.cached.find(c => c.key === cachedKey);
        const source = period.year ? sources.get(period.year) : !siteIndex ? {kind: 'loaded'} : cachedEntry ? {kind: 'cached', key: cachedEntry.key} : null;
        const snapshot = await resolveSnapshot(entry.site, period, source, controller.signal, (value, text) => {if (state.runId === runId) $('progress-label').textContent = `Retrieving ${progressLabel} · ${finite(value) ? `${format(value * 100)}% · ` : ''}${text || ''}`;});
        if (!siteIndex && snapshot.timezone !== location.timezone) throw new Error(`Weather year ${period.year} was stored for time zone ${snapshot.timezone}, but this site is on ${location.timezone}. A calendar year is bounded by local days, so the stored year covers different hours than this site needs. Select Retrieve years to download it for ${location.timezone}, which replaces the stored copy.`);
        if (state.runId !== runId) return;
        const energyContext = entry.priced && state.energyContext ? getEnergyContext(state.zipInfo, {sector, startDate: snapshot.startDate, endDate: snapshot.endDate}, state.catalog) : null;
        jobs.push({id: `${runId}:${jobs.length}`, siteIndex, label: period.year || `${snapshot.startDate} to ${snapshot.endDate}`, snapshot, scenarios: entry.scenarios, energyContext});
      }
    }
  } catch (error) {if (state.runId !== runId) return; stopPool(); throw new Error(`Weather for the run could not be assembled: ${error.message} Previous results have not been replaced.`);}
  if (state.runId !== runId) return;
  state.runController = null; $('progress-label').textContent = 'Calculating coarse equipment screens…';
  startPool(jobs, {
    onProgress: (value, text) => {$('progress').value = Math.max(0, Math.min(1, value)); $('progress-label').textContent = text || 'Calculating…';},
    onError: text => message(`Analysis failed: ${text}. Previous results have not been replaced.`, 'error'),
    onDone: resultsById => {
      try {
        state.siteRuns = sites.map(({site}, siteIndex) => ({site, runs: jobs.filter(job => job.siteIndex === siteIndex).map(job => ({label: job.label, snapshot: job.snapshot, results: resultsById.get(job.id)}))}));
        state.runs = state.siteRuns[0].runs; state.primaryRun = 0; state.resultRevision = revision;
        state.aggregate = state.runs.length > 1 ? aggregateYears(state.runs) : null;
        state.siteComparison = state.siteRuns.length > 1 ? compareSites(state.siteRuns) : null;
        selectPrimaryRun(0); state.resultId = state.results[0]?.scenario.id;
        renderResults(); message(`Calculation finished: ${jobs.length} weather-year job${jobs.length === 1 ? '' : 's'} across ${sites.length} site${sites.length === 1 ? '' : 's'}. Results are conditional screening estimates, not empirically validated performance.`, 'success');
      } catch (error) {message(`Could not display the calculation: ${error.message}`, 'error');}
    },
  });
}
function selectPrimaryRun(index) {
  const run = state.runs[index] || state.runs[0]; if (!run) return;
  state.primaryRun = state.runs.indexOf(run); state.results = run.results; state.resultSnapshot = run.snapshot; state.hour = 0;
}
function metric(label, value, detail, term) {
  const box = node('div', undefined, 'metric'), heading = node('p', label, 'metric-label');
  if (term) {const parts = infoBubble(term, label); if (parts) {heading.append(parts.button); document.body.append(parts.bubble);}}
  box.append(heading, node('p', value, 'metric-value'), node('p', detail, 'metric-detail')); return box;
}
function renderHeadlines(r) {
  const s = r.summary, weather = r.weatherSummary, target = $('headline-metrics'); target.replaceChildren();
  if (state.weatherOnly) {
    const entries = modeEntries(r.hours, true), valid = entries.reduce((sum, [, hours]) => sum + hours, 0), pad = entries.filter(([mode]) => mode === 'PAD_EFFECTIVE').reduce((sum, [, hours]) => sum + hours, 0);
    target.append(metric('Hours the weather could be read', units(valid, 'h', 0), `${format(r.hours.length - valid)} h missing or unreadable`, 'eligibleHour'), metric('Pad-effective window', units(pad, 'h', 0), 'Hours the weather allowed it, not hours the equipment ran', 'padEffectiveness'), metric('Hottest outdoor hour', units(weather?.extremes?.maxTempC, '°C', 1), 'Outside air only. This is not a prediction of the room', 'celsius'), metric('Weather coverage', r.hours.length ? `${format(valid / r.hours.length * 100, 1)}%` : 'Not available', `${format(valid)} of ${format(r.hours.length)} expected hours`));
  } else {
    target.append(metric('Joint temperature-and-moisture target attainment', finite(s.compliancePct) ? `${format(s.compliancePct, 1)}%` : 'Not available', `${format(s.compliantHours, 1)} equivalent h of ${format(s.eligibleHours ?? s.validHours)} countable h`, 'attainment'), metric(s.costBasis?.label || 'Modeled operating cost', money(s.cost), finite(s.cost) ? `${format(s.electricKWh)} kWh electric + ${format(s.fuelKWh)} kWh fuel` : `${money(s.knownCost)} known subtotal; ${format(s.priceMissingHours)} h unpriced`, 'operatingCost'), metric('Longest target miss', units(s.longestFailureHours, 'h', 0), 'The longest unbroken run of hours outside the band', 'jointTargetBand'), metric('Usable hours of weather', s.expectedHours ? `${format(s.validHours / s.expectedHours * 100, 1)}%` : 'Not available', `${format(s.missingHours)} missing, ${format(s.warmupHours)} warm-up, ${format(s.numericalFailureHours)} failed to solve`, 'eligibleHour'));
  }
  if (!state.weatherOnly) {
    target.append(node('p', costBasisText(s.costBasis), 'source-line result-basis'));
    target.append(node('p', airflowRows(r).map(([k,v]) => `${k}: ${v}`).join('. '), 'source-line result-basis'));
  }
}
function renderModeTable(r) {
  const entries = modeEntries(r.hours, state.weatherOnly), total = entries.reduce((n, [, h]) => n + h, 0), ws = r.weatherSummary;
  table($('mode-table'), state.weatherOnly ? ['Primary weather mode', 'Hours', '% classified', 'Days ≥4 h', 'Longest episode · h'] : ['Equipment mode', 'Hours', '% valid'], entries.map(([mode, hours]) => state.weatherOnly ? [modeLabel(mode), format(hours), units(total ? hours / total * 100 : null, '%', 1), format(ws?.modeExposureDays?.[mode]?.atLeast4), format(ws?.episodes?.[mode]?.maximumHours)] : [modeLabel(mode), format(hours), units(total ? hours / total * 100 : null, '%', 1)]));
}
function renderRuntime(r) {
  const s = r.summary, pv = r.weatherSummary?.padViability, rt = s.runtime || {}, hours = s.validHours || 0;
  const share = n => hours ? units(n / hours * 100, '% of valid h', 1) : 'Not available';
  const row = (label, key, note) => rt[key] ? [label, format(rt[key].hours), format(rt[key].equivalentHours, 1), format(rt[key].days), share(rt[key].hours), note] : null;
  if (state.weatherOnly) {
    const u = r.weatherSummary?.utility;
    $('runtime-title').textContent = 'What the weather makes useful: pad and vent, measured separately';
    $('runtime-help').textContent = 'A wet pad and an open vent are different tools, so they are scored independently and jointly rather than by one mutually exclusive label per hour. The row that decides whether a pad is worth buying is the pad-only one: hours outside air is above the ceiling, so ventilation cannot hold the band, while pad leaving air still can. Air-side capability, not equipment runtime or installed capacity.';
    const days = d => `${format(d?.atLeast1)} / ${format(d?.atLeast4)} / ${format(d?.atLeast8)}`;
    const pct = n => units(hours ? n / hours * 100 : null, '% of valid h', 1);
    table($('runtime-table'), ['Weather-side capability', 'Hours', 'Share of valid hours', 'Reading'], u ? [
      ['Pad could cool usefully', format(u.padCoolingHours), pct(u.padCoolingHours), 'Pad leaving air clears the ceiling by the margin and stays under the moisture limit'],
      ['Pad could usefully humidify', format(u.padHumidifyingHours), pct(u.padHumidifyingHours), 'Outside air is drier than the band floor, so the water the pad adds is the point'],
      ['Pad only: vent cannot hold the ceiling', format(u.padDeeperThanVentHours), pct(u.padDeeperThanVentHours), 'The hours a pad earns its capital rather than merely also working'],
      ['Vent could cool usefully', format(u.ventCoolingHours), pct(u.ventCoolingHours), 'Outside air below the target by the ventilation margin without importing moisture'],
      ['Vent could dry usefully', format(u.ventDryingHours), pct(u.ventDryingHours), 'Outside air below the zone moisture ceiling by the drying margin'],
      ['Both useful in the same hour', format(u.bothHours), pct(u.bothHours), 'Overlap, not a sum: these hours are counted in both tools above'],
      ['Neither useful', format(u.neitherHours), pct(u.neitherHours), 'Hours no outside-air path helps, so mechanical equipment is the only option'],
      ['Limit hit: temperature margin', format(pv?.failureCauses?.temperature), '', 'Hours pad leaving air stays too warm'],
      ['Limit hit: moisture ceiling', format(pv?.failureCauses?.moisture), '', 'Hours pad leaving air is too humid'],
      ['Legacy pad screen: effective / marginal / ineffective', `${format(pv?.effectiveHours)} / ${format(pv?.marginalHours)} / ${format(pv?.ineffectiveHours)}`, '', `Mutually exclusive primary-mode counts, retained for continuity. Effective days ≥1 / ≥4 / ≥8: ${days(pv?.effectiveDays)}`]] : []);
    return;
  }
  const controller = (s.controlModeUsed || r.scenario.controlMode) === 'ideal' ? 'assumed ideal per-minute modulation (upper bound)' : 'the staged deadband controller';
  $('runtime-title').textContent = 'Equipment runtime'; $('runtime-help').textContent = `Hours with any use, duty-weighted equivalent full-load hours, and local days with any use, under ${controller}. Pad rows also show the weather-only viability screen for the same record.`;
  table($('runtime-table'), ['Component', 'Hours used', 'Equivalent full-load h', 'Days used', 'Share', 'Note'], [
    row('Evaporative pad', 'pad', r.scenario.padEnabled ? `${format(s.padWaterL)} L water. Weather screen: the pad could cool usefully in ${format(r.weatherSummary?.utility?.padCoolingHours)} h and was the only path to the ceiling in ${format(r.weatherSummary?.utility?.padDeeperThanVentHours)} h, against ${format(r.weatherSummary?.utility?.ventCoolingHours)} h a vent alone could cool.` : 'Not installed in this scenario'),
    row('Indirect evaporative stage', 'indirect', 'Hybrid secondary wet stream'),
    row('DX cooling', 'dx', `Whole-run peak cooling, all modeled stages: ${format(s.peakCoolingKW, 1)} kW`),
    row('Condensing dehumidifier', 'dehu', `${format(s.dehuKWh)} kWh purchased electricity; ${format(s.dehuRejectedHeatKWh)} kWh heat rejected outside; ${format(s.dehuHeatKWh)} kWh heat returned to zone air. Total condensate from all stages is reported in the hourly inspector; DOAS condensate is separate below.`),
    row('Shade screen', 'shadeScreen', finite(s.screens?.dliCostMol) ? `${format(s.screens.dliCostMol)} mol/m² of crop light given up while deployed` : 'Deployed hours; light cost not attributed'),
    row('Thermal curtain', 'thermalScreen', finite(s.screens?.heatingSavedKWh) ? `${format(s.screens.heatingSavedKWh)} kWh of delivered heat saved against the same run with it open` : 'Deployed hours; heating saving not attributed'),
    row('Desiccant', 'desiccant', `${format(s.desiccantRemovedKg)} kg removed; ${format(s.regenerationKWh)} kWh regeneration`),
    row('DOAS conditioning', 'doas', conditioningRows(s).filter(([label]) => label.startsWith('DOAS')).map(([label, value]) => `${label}: ${value}`).join('; ')),
    row('Recovery core', 'recoveryActive', `${format(s.recoveryCoreM3)} m³ through core; ${format(s.recoverySensibleKWh)} kWh sensible and ${format(s.recoveryLatentKWh)} kWh latent transfer, not purchased energy or savings`),
    row('Recovery bypass', 'recoveryBypass', `${format(s.recoveryBypassM3)} m³ bypassed`),
    row('Frost / defrost', 'recoveryDefrost', `${format(s.recoveryDefrostHours, 2)} equivalent h`),
    row('Preheat', 'preheat', `${format(s.preheatDeliveredKWh)} kWh delivered; ${format(s.preheatElectricKWh)} kWh electricity; ${format(s.preheatFuelKWh)} kWh fuel; ${format(s.preheatInsufficientHours, 2)} h insufficient`),
    row('Heating', 'heating', `${format(s.heatingKWh)} kWh delivered heat`),
    row('Humidifier', 'humidifier', `${format(s.humidifierWaterL)} L water`),
    row('Supplemental light', 'light', `${format(s.lightKWh)} kWh; ${format(s.dliDeficitDays)} DLI deficit days`)].filter(Boolean));
}
function renderOutdoorDrying(r) {
  const d = r.weatherSummary?.outdoorDrying; if (!d) {table($('drying-table'), ['Outdoor-air dehumidification'], []); return;}
  const s = r.summary, dehuRef = finite(d.dehuKWhPerKg) ? `${format(d.dehuKWhPerKg, 2)} kWh/kg · $${format(d.dehuCostPerKg, 3)}/kg` : 'No dehumidifier efficiency set';
  const row = (label, b, note) => [label, format(b.hours), `${format(b.days.atLeast1)} / ${format(b.days.atLeast4)}`, units(b.meanPotentialKgH, 'kg/h', 1), finite(b.kWhPerKg) ? `${format(b.kWhPerKg, 2)} kWh/kg` : 'Not available', finite(b.costPerKg) ? `$${format(b.costPerKg, 3)}/kg` : 'Not available', note];
  const dryingBasis = {...s.costBasis, label:'Modeled outdoor-air drying operating cost per kg, not the full facility cost',
    included:['fan electricity', 'heating fuel for outdoor-air conditioning'],
    priceBasis:{electricity:{source:'manual scenario input, even when the coupled run uses historical prices',usdPerKWh:r.scenario.electricityPrice},
      fuel:{source:'scenario input',usdPerKWh:r.scenario.fuelPrice},water:{source:'excluded from this marginal drying screen',usdPerL:0}},
    excluded:[...(s.costBasis?.excluded || []),'water costs','hot-dry sensible cooling cost']};
  $('drying-help').textContent = `Hours when outside air is drier than the zone's moisture ceiling. Removal potential is at the installed maximum ${format(d.maxVentACH, 1)} controlled ACH, not actual dispatched airflow. Condensing-dehumidifier reference: ${dehuRef}, electricity only at the manual scenario rate. Outdoor-air drying has lower modeled cost per kg than that reference in ${format(d.cheaperThanDehuHours)} h and lower energy per kg in ${format(d.lowerEnergyThanDehuHours)} h. ${costBasisText(dryingBasis)} The coupled run determines actual dispatch.`;
  table($('drying-table'), ['Outside-air condition', 'Hours', 'Days ≥1 / ≥4 h', 'Mean removal potential', 'Energy per kg water', 'Modeled cost per kg water', 'Reading'], [
    row('Cool and dry (free latent economizer)', d.coolDry, 'No heating penalty; fan energy only'),
    row('Cold and dry (heat the ventilation air)', d.coldDry, 'Drying with a fuel penalty; compare cost per kg to the dehumidifier'),
    row('Hot and dry (latent relief, sensible import)', d.hotDry, 'Only useful with separate sensible cooling')]);
  if (!state.weatherOnly && finite(s.reheatKWh) && s.reheatKWh > 0) $('drying-help').textContent += ` Zone reheat after overcooling: ${format(s.reheatKWh)} kWh. DOAS cooling and reheat are separate conditioning quantities, not avoided-energy claims.`;
}
const LOAD_TERMS = [['solarKWh', 'Solar'], ['lightKWh', 'Light'], ['envelopeKWh', 'Envelope'], ['infiltrationSensibleKWh', 'Infiltration'], ['controlledOutdoorAirSensibleKWh', 'Controlled outdoor air'], ['fanKWh', 'Fans'], ['cropSensibleKWh', 'Crop sensible'], ['cropLatentKWh', 'Crop latent (evaporative cooling)']];
function renderLoadsPanel(r) {
  $('loads-panel').hidden = state.weatherOnly; if (state.weatherOnly) return;
  const d = loadDecomposition(r);
  $('loads-panel').querySelector('.result-basis')?.remove();
  $('loads-panel').append(node('p', [...airflowRows(r), ...conditioningRows(r.summary)].map(([k,v]) => `${k}: ${v}`).join('. '), 'source-line result-basis'));
  renderLoads($('loads-chart'), $('loads-legend'), d);
  const latent = l => finite(l?.crop) ? `${format(l.crop)} crop / ${format(l?.controlledOutdoorAir)} controlled outdoor air / ${format(l?.infiltration)} infiltration` : 'Not available';
  const rowOf = (label, m) => [label, ...LOAD_TERMS.map(([key]) => format(m[key])), latent(m.latentKg), finite(m.shr) ? format(m.shr, 2) : 'No gains'];
  table($('loads-table'), ['Month', ...LOAD_TERMS.map(([, label]) => `${label} · kWh`), 'Latent kg (crop / controlled outdoor air / infiltration)', 'Sensible-heat ratio'], [...(d.monthly || []).map(m => rowOf(m.month, m)), ...(d.total ? [rowOf('Period total', d.total)] : [])]);
  if (d.shrHistogram?.length) $('loads-table').append(node('p', `Hourly sensible-heat ratio distribution: ${d.shrHistogram.map(b => `${b.bin}: ${format(b.hours)} h`).join(' · ')}. Signed gains into zone air; latent shown as evaporation mass. Model balance terms under the stated assumptions.`, 'source-line'));
}
function renderCO2Panel(r) {
  const c = co2Window(r);
  $('co2-help').textContent = `Hours where ventilation stays at the minimum outside-air rate with no pad or indirect stage running, so CO₂ enrichment is physically possible. The weather-side row counts hours whose outdoor classification would allow a closed house regardless of equipment. ${describe(c.note)}`;
  table($('co2-table'), ['Window', 'Hours', 'Reading'], [
    ['Enrichment-compatible, equivalent hours', format(c.equivalentHours, 1), 'Duty-weighted fraction of each hour at minimum ventilation with pads off'],
    ['Hours with any enrichment window', format(c.hoursAny), `${format(c.days)} local days with any window`],
    ['Weather-side closed-house hours', format(c.weatherSideHours), 'Outdoor modes: neutral or heating at minimum vent, humidification likely or passive humidify opportunity'],
    ...(c.byMonth || []).map(m => [`${m.month}`, format(m.equivalentHours, 1), 'Equivalent enrichment-compatible hours in this month'])]);
}
function renderYearsPanel() {
  const a = state.aggregate, panel = $('years-panel'); panel.hidden = !a || state.weatherOnly; if (panel.hidden) return;
  renderYears($('years-chart'), a, state.resultId);
  const yearOf = entry => entry?.label ? `${entry.label}: ${percent(entry.compliancePct)} · ${money(entry.cost)}` : 'Not available';
  const trend = t => finite(t?.compliancePctPerYear) ? `${signed(t.compliancePctPerYear, 2)} pp/year` : 'Fewer than 5 numeric years';
  table($('years-table'), ['Scenario', 'Median attainment', 'Median operating cost', 'Worst year', 'Best year', 'Spread (attainment / cost)', 'Trend'], Object.values(a.byScenario || {}).map(row => [row.name, percent(row.median?.compliancePct), money(row.median?.cost), yearOf(row.worst), yearOf(row.best), `${finite(row.spread?.compliancePct) ? `${format(row.spread.compliancePct, 1)} pp` : 'Not available'} / ${money(row.spread?.cost)}`, trend(row.trend)]));
  const ranking = a.ranking || {};
  $('years-ranking').textContent = `Joint temperature-and-moisture target attainment, percentage points (pp) for differences, not relative percent. ${state.runs.flatMap(run => run.results.map(r => `${r.scenario.name}: ${costBasisText(r.summary.costBasis)}`)).join(' ')} Years: ${(a.years || []).join(', ')}. Cost ranking across years is ${ranking.stable ? 'stable' : 'not stable'}. ${describe(ranking.note)} Median and spread are over the selected years; they are not a forecast of the next year.`;
}
function renderSitesPanel() {
  const rows = state.siteComparison, panel = $('sites-panel'); panel.hidden = !rows; if (panel.hidden) return;
  const siteName = site => `${site?.city || 'Site'}${site?.state ? `, ${site.state}` : ''}${site?.zip ? ` · ${site.zip}` : ''}`;
  table($('sites-table'), ['Site', 'Free-cooling hours (median)', 'Pad-effective hours', 'Binding constraint', 'Best strategy', 'Median attainment', 'Median operating cost', 'Worst-year attainment', 'Pricing'], rows.map((row, i) => [siteName(row.site), format(row.freeCoolingHours), format(row.padEffectiveHours), describe(row.bindingConstraint), describe(row.bestStrategy?.name), percent(row.bestStrategy?.compliancePct), money(row.bestStrategy?.cost), percent(row.worstYearCompliancePct), i ? 'Manual scenario prices' : state.energyContext && state.scenarios.some(s => s.priceMode !== 'manual') ? 'Historical state/sector proxy' : 'Manual scenario prices']));
  for (const site of state.siteRuns) for (const run of site.runs) for (const r of run.results) $('sites-table').append(node('p', `${siteName(site.site)}, ${r.scenario.name}: ${costBasisText(r.summary.costBasis)}`, 'source-line'));
  $('sites-table').append(node('p', 'Free-cooling and pad-effective hours are weather-side classifications of outside air (median over the selected years). Best strategy is the cheapest scenario on the median-cost operating frontier. Additional sites are NASA POWER gridded weather at ZIP centroids and manual prices; they are not local tariffs or measured facility sites.', 'source-line'));
}
function renderCalendar() {
  const r = result(); if (!r) return;
  const selectedMonth = $('timeline-month').value;
  const indices = [];
  r.hours.forEach((h, index) => {if (new Date(h.time).toISOString().slice(0, 7) === selectedMonth) indices.push(index);});
  const month = indices.map(index => r.hours[index]);
  const select = index => {state.hour = indices[index]; renderInspector(); $('hour-detail').scrollIntoView({block: 'nearest', behavior: 'auto'});};
  renderTimeline($('timeline-chart'), month, select, state.weatherOnly, modeEntries(r.hours, true));
  renderTimelineTable($('timeline-table'), month, r.scenario.timezone, select, state.weatherOnly);
}
/* One polite announcement per settled hour. Dragging the slider or holding an arrow key would otherwise
   queue one message per intermediate hour, so only the hour still selected after 400 ms is announced. */
let announceTimer = null, announced = null, stepsOpen = false;
function announceHour(text) {
  if (text === announced) return;
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {announced = text; $('hour-announcement').textContent = text;}, 400);
}
function hourValueText(r, h) {
  const local = new Intl.DateTimeFormat('en-US', {timeZone: r.scenario.timezone, dateStyle: 'medium', timeStyle: 'short'}).format(h.time);
  const mode = modeLabel(state.weatherOnly ? h.weatherMode : h.mode);
  return `${local} ${r.scenario.timezone}. ${mode}. ${state.weatherOnly ? 'Weather-side classification only; no indoor band is evaluated in this view.' : `Joint band: ${attainmentText(attainmentClass(h))}.`}`;
}
function renderInspector() {
  const r = result(); if (!r?.hours.length) return;
  state.hour = Math.max(0, Math.min(r.hours.length - 1, state.hour)); const h = r.hours[state.hour];
  const w = state.resultSnapshot.hours.find(hour => hour.time === h.time) || {};
  $('hour-slider').max = r.hours.length - 1; $('hour-slider').value = state.hour; $('hour-prev').disabled = !state.hour; $('hour-next').disabled = state.hour === r.hours.length - 1;
  $('hour-position').textContent = `${format(state.hour + 1)} / ${format(r.hours.length)} h`;
  const valueText = hourValueText(r, h);
  $('hour-slider').setAttribute('aria-valuetext', `Hour ${format(state.hour + 1)} of ${format(r.hours.length)}. ${valueText}`);
  announceHour(`Hour ${format(state.hour + 1)} of ${format(r.hours.length)}. ${valueText}`);
  const box = $('hour-detail'); box.replaceChildren();
  const local = new Intl.DateTimeFormat('en-US', {timeZone: r.scenario.timezone, dateStyle: 'medium', timeStyle: 'long'}).format(h.time);
  box.append(node('p', `${local} · ${new Date(h.time).toISOString()}`, 'hour-date'));
  box.append(node('p', `${modeLabel(state.weatherOnly ? h.weatherMode : h.mode)}. ${state.weatherOnly ? h.weatherReason || '' : h.reason || ''}${h.warmup && !state.weatherOnly ? ' Warm-up hour, excluded from comparison.' : ''}`, 'hour-reason'));
  const grid = node('dl', undefined, 'inspection-grid');
  const rows = [['Outdoor dry bulb', units(w.tempC, '°C')], ['Outdoor dew point', units(w.dewPointC, '°C')], ['Outdoor relative humidity', units(finite(w.rh) ? w.rh * 100 : null, '%')], ['Station pressure', units(w.pressurePa, 'Pa', 0)], ['Solar irradiance', units(w.ghiWm2, 'W/m²', 0)], ['Wind speed', units(w.windMs, 'm/s')], ['Pad leaving dry bulb', units(h.padTempC, '°C')], ['Pad leaving dew point', units(h.padDewPointC, '°C')]];
  if (!state.weatherOnly) rows.push(['Estimated zone temperature', units(h.tempC, '°C')], ['Estimated zone RH', units(finite(h.rh) ? h.rh * 100 : null, '%')], ['Estimated air VPD', units(h.vpd, 'kPa', 2)], ['Joint-target fraction', units(finite(h.compliantFraction) ? h.compliantFraction * 100 : null, '%', 1)], ['Electricity', units(h.electricKWh, 'kWh', 2)], ['Purchased fuel', units(h.fuelKWh, 'kWh', 2)], ['Water', units(h.waterL, 'L', 1)], ['Condensate', units(h.condensateKg, 'kg', 2)], ['DX cooling delivered', units(h.coolingKWh, 'kWh', 2)], ['Dehu heat indoors', units(h.dehuHeatKWh, 'kWh', 2)], ['Regeneration energy', units(h.regenerationKWh, 'kWh', 2)], ['Desiccant removal', units(h.desiccantRemovedKg, 'kg', 2)], ['Unmet sensible load', units(h.unmetSensibleKWh, 'kWh', 2)], ['Unmet moisture', units(h.unmetMoistureKg, 'kg', 2)], ['Energy residual', units(h.energyResidualW, 'W', 1)], ['Moisture residual', units(h.moistureResidualKgS, 'kg/s', 6)],
    ['Sensible gains', units(h.loads?.sensibleKWh, 'kWh', 2)], ['Crop latent', units(h.loads?.latentKg?.crop, 'kg', 2)], ['Sensible-heat ratio', finite(h.loads?.shr) ? format(h.loads.shr, 2) : 'No gains'], ['Controlled outdoor air', units(h.controls?.controlledACH, 'ACH', 2)], ['Enrichment-compatible fraction', units(finite(h.controls?.enrichmentFraction) ? h.controls.enrichmentFraction * 100 : null, '%', 0)]);
  if (!state.weatherOnly) rows.push(['Installed controlled maximum', units(r.scenario.maxVentACH, 'ACH', 2)], ['Total outdoor air including infiltration', units(h.controls?.totalOutdoorACH, 'ACH', 2)], ['Controlled / total outdoor flow', `${units(h.controls?.controlledM3s, 'm³/s', 3)} / ${units(h.controls?.totalOutdoorM3s, 'm³/s', 3)}`], ['Actual controlled stages', h.controls?.controlledACHStages?.map(stage => `${format(stage.ach,2)} ACH: ${format(stage.hours,3)} h`).join('; ') || 'Not available'], ...conditioningRows(h));
  rows.forEach(([label, value]) => {const item = node('div'); item.append(node('dt', label), node('dd', value)); grid.append(item);}); box.append(grid);
  /* The arithmetic behind the numbers above, recomputed from the raw hour and the scenario by src/steps.js. It stays open
     or closed across hours so a reader can step through the record with the working visible. */
  const arithmetic = document.createElement('details'); arithmetic.className = 'hour-steps'; arithmetic.open = stepsOpen;
  arithmetic.addEventListener('toggle', () => {stepsOpen = arithmetic.open;});
  arithmetic.append(node('summary', 'Show the arithmetic for this hour'));
  arithmetic.append(node('p', 'Every line below is recomputed from this hour\u2019s weather record and your scenario by the same functions the run used, so any number can be checked by hand. The weather-side steps never see the zone state; the last step is what the coupled run scored.', 'help'));
  arithmetic.append(stepsNode(weatherSteps(w, r.scenario, state.resultSnapshot)));
  if (!state.weatherOnly) arithmetic.append(stepsNode(attainmentSteps(h)));
  box.append(arithmetic);
  const s = r.scenario;
  const moisture = (r.summary.transpirationModelUsed || s.transpirationModel) === 'schedule' ? `Assumed crop evaporation ${format(s.transpirationLDayM2, 2)} L/m²/day (fixed schedule).` : `Stanghellini transpiration at LAI ${format(s.lai, 1)}, canopy temperature taken as air temperature.`;
  box.append(node('p', `Targets you set: ${s.dayTargetC} °C by day and ${s.nightTargetC} °C at night, either within ${s.tempToleranceC} °C. Air VPD between ${s.vpdMin} and ${s.vpdMax} kPa. Dew point no higher than ${s.maxDewPointC} °C. ${moisture}`, 'source-line'));
  const originalTime = w.observedTimestampUTC || (finite(w.observedTime) ? new Date(w.observedTime).toISOString() : null);
  const quality = Array.isArray(w.quality) && w.quality.length ? w.quality.map(describe).join('; ') : 'No flags supplied for this hour';
  box.append(node('p', `Source quality: ${quality}${originalTime ? ` · Original observation: ${originalTime}` : ''}. Source: ${describe(state.resultSnapshot.source)}.`, 'source-line'));
  if (state.weatherOnly && h.weatherFlags?.length) box.append(node('p', `Weather-side flags: ${h.weatherFlags.map(describe).join('; ')}`, 'source-line'));
}
function renderComparison() {
  const rows = compareScenarios(state.results);
  table($('comparison-table'), ['Scenario', 'Estimated / user-entered capital', 'Estimated annual ownership · USD/y', 'Matched modeled operating cost · USD', 'Joint hours · h', 'Added joint hours · h', 'Matched modeled operating-cost difference · USD', 'Matched cost / added hour', 'Operating-cost frontier', 'Common eligible population'], rows.map((row, index) => {
    const r = state.results.find(r => r.scenario.id === row.id) || state.results[index];
    return [r.scenario.name, capitalBasisText(r.scenario), money(r.summary.annualOwnershipCost), money(row.cost), format(row.compliantHours, 1), finite(row.addedHours) ? `${row.addedHours > 0 ? '+' : ''}${format(row.addedHours, 1)}` : 'Not comparable', finite(row.addedCost) ? `${row.addedCost > 0 ? '+' : ''}${money(row.addedCost)}` : 'Unpriced', finite(row.costPerAddedHour)?money(row.costPerAddedHour,true):'Not applicable', row.comparable?(row.dominated?'Operating-dominated':'Operating frontier'):'Not comparable', r.summary.numericalFailureHours ? 'Numerical failures: review' : `${format(row.matchedHours)} matched h`];
  }));
  for (const row of rows) {
    const r = state.results.find(r => r.scenario.id === row.id);
    $('comparison-table').append(node('p', `${attainmentComparisonText(rows[0], row)} ${comparisonPopulationText(row, r)} Matched cost basis: ${costBasisText(row.costBasis)} ${row.operatingCostReduction ? `${row.operatingCostReduction.label}: ${money(row.operatingCostReduction.amount)} for ${row.name} versus ${rows[0].name}, over ${format(row.matchedHours)} common eligible hours only (warm-up excluded), not the full-run cost population.` : ''}`, 'source-line'));
    if (r) $('comparison-table').append(node('p', `${row.name}: ${[...airflowRows(r), ...conditioningRows(r.summary)].map(([k,v]) => `${k}: ${v}`).join('. ')}`, 'source-line'));
  }
  $('comparison-table').append(node('p', 'Annual ownership = capital recovery at the stated discount/life assumptions plus annual maintenance. It is not added to partial-period operating cost. The operating-cost frontier excludes capital. Climate attainment is temperature + VPD + dew-point guardrail, not light sufficiency. Different crop or geometry assumptions are not an equipment-only comparison.', 'source-line'));
}
function renderResults() {
  const r = result(); $('results').hidden = !r; $('empty-results').hidden = !!r; if (!r) return;
  state.resultId = r.scenario.id; options($('result-select'), state.results.map(r => [r.scenario.id, r.scenario.name]), state.resultId);
  $('primary-year-label').hidden = state.runs.length <= 1; options($('primary-year'), state.runs.map((run, i) => [String(i), run.label]), String(state.primaryRun));
  $('stale-notice').hidden = state.resultRevision === state.revision;
  $('equipment-tab').setAttribute('aria-pressed', String(!state.weatherOnly)); $('weather-tab').setAttribute('aria-pressed', String(state.weatherOnly));
  $('view-explanation').textContent = state.weatherOnly ? 'Outdoor-air and pad feasibility only. These modes do not establish indoor climate, installed capacity, operating cost or crop performance. Powered ventilation is not zero-energy cooling.' : 'Coarse finite-capacity component screen. Joint target hours combine temperature, air VPD and dew-point bounds; light is separate. Control-cadence sensitivity is material, so close cost rankings are exploratory, not equipment-selection decisions.';
  $('light-panel').hidden = state.weatherOnly;
  document.querySelector('.comparison').hidden = state.weatherOnly;
  renderHeadlines(r);
  const warnings = [...(r.warnings || [])];
  if (!state.weatherOnly) warnings.push(`Daily light: ${format(r.summary.dliDeficitDays)} deficit days; ${format(r.summary.incompleteDays)} incomplete days. ${costBasisText(r.summary.costBasis)}`);
  $('result-warnings').textContent = warnings.map(describe).join('\n'); $('result-warnings').hidden = !warnings.length;
  $('warning-disclosure').open=Boolean(r.summary.numericalFailureHours||r.summary.missingHours||r.summary.priceMissingHours);
  renderMonthly($('monthly-chart'), $('mode-legend'), r.hours, r.scenario.timezone, state.weatherOnly); renderModeTable(r); renderRuntime(r); renderOutdoorDrying(r);
  renderLoadsPanel(r); renderCO2Panel(r);
  const months = [...new Set(r.hours.map(h => new Date(h.time).toISOString().slice(0, 7)))], selectedMonth = $('timeline-month').value;
  options($('timeline-month'), months.map(month => [month, month]), months.includes(selectedMonth) ? selectedMonth : months[0]); renderCalendar();
  renderScatter($('scatter-chart'), state.resultSnapshot.hours, r.hours); if (!state.weatherOnly) renderDLI($('dli-chart'), r.summary.daily, r.scenario.dliTarget);
  renderInspector(); renderComparison(); renderYearsPanel(); renderSitesPanel();
  const run = state.runs[state.primaryRun];
  $('run-manifest').textContent = `Model ${r.modelVersion || MODEL_VERSION} · ${state.resultSnapshot.startDate} to ${state.resultSnapshot.endDate} · ${describe(state.resultSnapshot.source)} · ${r.scenario.timezone}${state.runs.length > 1 ? ` · primary year ${run?.label} of ${state.runs.length}` : ''}${state.siteRuns.length > 1 ? ` · ${state.siteRuns.length} sites` : ''}. Controller: ${(r.summary.controlModeUsed || r.scenario.controlMode) === 'ideal' ? 'ideal modulation upper bound' : 'staged deadband'}; crop moisture: ${(r.summary.transpirationModelUsed || r.scenario.transpirationModel) === 'schedule' ? 'fixed schedule' : 'Stanghellini'}. Every chart and export remains tied to this run's saved inputs${state.resultRevision !== state.revision ? ', not the edited form' : ''}.`;
}
function importProgress(visible, value = 0, text = '') {
  $('import-progress').hidden = !visible; $('import-button').disabled = visible;
  $('import-progress-bar').value = Math.max(0, Math.min(1, finite(value) ? value : 0));
  $('import-progress-label').textContent = text;
}
/* Parsing and weather normalization run in a worker: a 100+ MB run JSON never blocks the interface, and a
   file beyond the tab's memory kills the worker instead of the page. Only one parse runs at a time. */
function parseInWorker(file, onProgress) {
  state.parseWorker?.terminate();
  const worker = new Worker(new URL('./worker.js', import.meta.url), {type: 'module'}), id = uid();
  state.parseWorker = worker;
  return new Promise((resolve, reject) => {
    const settle = (finish, value) => {worker.terminate(); if (state.parseWorker === worker) state.parseWorker = null; finish(value);};
    worker.onmessage = event => {
      const data = event.data; if (data.id !== id) return;
      if (data.type === 'progress') onProgress(data.value, data.message);
      else if (data.type === 'error') settle(reject, new Error(data.message));
      else if (data.type === 'parsed') settle(resolve, data);
    };
    worker.onerror = event => {event.preventDefault(); settle(reject, new Error(`The import worker stopped: ${event.message || 'the file needed more memory than this browser tab could allocate'}. Nothing was replaced. Split the comparison or the weather period and import again.`));};
    worker.onmessageerror = () => settle(reject, new Error('The parsed import could not be transferred out of the worker. Nothing was replaced.'));
    try {worker.postMessage({id, type: 'parse', file, timezone: $('timezone').value.trim()});} catch (error) {settle(reject, error);}
  });
}
async function importFile(event) {
  const file = event.target.files[0]; if (!file) return;
  // An import is the latest weather request: retire any in-flight retrieval so it cannot land afterwards.
  const superseded = $('fetch-weather').disabled; const epoch = ++state.weatherEpoch; state.weatherController?.abort();
  weatherBusy(false, superseded ? 'Pending retrieval canceled; the imported weather is current.' : $('weather-status').textContent);
  const size = finite(file.size) ? `${format(file.size / 1048576, 1)} MB` : 'the file';
  try {
    importProgress(true, .02, `Handing ${size} to a background worker…`);
    const parsed = await parseInWorker(file, (value, text) => importProgress(true, value, text || `Parsing ${size}…`));
    if (epoch !== state.weatherEpoch) return;
    importProgress(true, 1, 'Applying the import…');
    if (parsed.kind !== 'run') {
      await acceptWeather(parsed.snapshot, {normalized: true});
      message(parsed.kind === 'weather-csv' ? 'Weather CSV imported. Units and hourly continuity were checked; source values remain user-supplied.' : 'Weather snapshot imported and normalized.', 'success');
      return;
    }
    stopPool(); state.scenarios = parsed.scenarios; state.selected = parsed.scenarios[0].id; $('sector').value = current().sector; markChanged(); renderScenario();reflectLocation(current());
    if (parsed.snapshot) await acceptWeather(parsed.snapshot, {normalized: true}); else {await refreshYears(); await refreshEnergy();}
    persist();
    message(`Imported ${parsed.scenarios.length} validated scenario${parsed.scenarios.length === 1 ? '' : 's'}${parsed.snapshot ? ' and its weather snapshot' : ''}. All will run at the shared site and customer sector shown above. Re-run to calculate local results; imported result claims are not displayed without recomputation.`, 'success');
  } finally {event.target.value = ''; importProgress(false);}
}
function bindEvents() {
  on('lookup-zip', 'click', locate); on('weather-form', 'submit', retrieveWeather);
  buildProviders(); on('weather-provider', 'change', renderProvider); on('provider-key', 'change', saveProviderKey); on('provider-key', 'blur', saveProviderKey);
  for (const id of ['zip', 'latitude', 'longitude', 'timezone', 'start-date', 'end-date', 'weather-provider', 'station']) on(id, 'change', () => {markChanged(); if (['latitude', 'longitude', 'timezone'].includes(id)) return refreshYears(); if (['zip', 'start-date', 'end-date'].includes(id)) return refreshEnergy();});
  on('retrieve-years', 'click', retrieveYears); on('add-site', 'click', addSite); on('site-zip', 'keydown', event => {if (event.key === 'Enter') {event.preventDefault(); return addSite();}});
  on('site-zip', 'input', proposeSiteTimezone); on('site-timezone', 'input', () => {$('site-timezone').dataset.edited = '1';});
  on('scenario-form', 'input', updateScenario); on('scenario-form', 'submit', event => event.preventDefault());
  on('scenario-select', 'change', () => {state.selected = $('scenario-select').value; renderScenario(); return refreshEnergy();});
  on('facility', 'change', () => templateChanged('Facility')); on('system', 'change', () => templateChanged('Cultivation'));
  on('crop', 'change', () => {const s = current(), crop = $('crop').value, defaults = CROPS[crop]; for (const [key, value] of Object.entries(defaults)) if (key in s && key !== 'name') s[key] = value; s.crop = crop; markChanged(); renderScenario();});
  on('light-fixture', 'change', () => {const s = current(), wm2 = fixtureWm2($('light-fixture').value); if (wm2 === null) return; s.lightWm2 = Math.round(wm2 * 10) / 10; s.efficacy = LIGHT_FIXTURES[$('light-fixture').value].efficacy; markChanged(); renderScenario();});
  on('technology', 'change', () => {const s = current(), next = applyTechnology(s, $('technology').value); if (next.technology === 'doas') next.doasM3s = null; state.scenarios[state.scenarios.indexOf(s)] = next; markChanged(); renderScenario(); focusDoas();});
  on('save-scenario', 'click', () => {const errors = state.scenarios.flatMap(s => scenarioErrors(s).map(e => `${s.name}: ${e}`)); if (errors.length) throw new Error(errors.join('\n')); persist(true);});
  on('duplicate-scenario', 'click', () => {const s = current(); addScenario({...s, name: `${s.name.slice(0, 110)} copy`});});
  on('remove-scenario', 'click', () => {if (state.scenarios.length <= 1) return; if (!confirm(`Remove “${current().name}” from this workspace? Export first if you need a copy.`)) return; state.scenarios = state.scenarios.filter(s => s.id !== state.selected); state.selected = state.scenarios[0].id; markChanged(); renderScenario(); persist();});
  on('add-upgrade', 'click', () => {const next = applyTechnology(state.scenarios[0], $('upgrade-select').value); if (next.technology === 'doas') next.doasM3s = null; addScenario(next); focusDoas();}); on('add-sensitivity', 'click', sensitivity);
  on('price-mode', 'change', () => {current().priceMode = $('price-mode').value; markChanged(); return refreshEnergy();});
  on('sector', 'change', () => {for (const s of state.scenarios) s.sector = $('sector').value; markChanged(); return refreshEnergy();});
  on('utility', 'change', () => {const selected = $('utility').selectedOptions[0]?.textContent; message($('utility').value ? `${selected}: candidate selected for review only. Confirm service with the provider. Costing remains the selected manual assumption or historical state/sector proxy.` : 'No provider candidate selected. No utility tariff is inferred.');});
  on('run-all', 'click', run); on('cancel-run', 'click', () => {stopPool(); message('Calculation canceled. Prior results, if any, are retained; no partial run is presented as complete.');});
  on('result-select', 'change', () => {state.resultId = $('result-select').value; state.hour = 0; renderResults();});
  on('primary-year', 'change', () => {const id = state.resultId; selectPrimaryRun(Number($('primary-year').value)); state.resultId = id; renderResults();});
  on('equipment-tab', 'click', () => {state.weatherOnly = false; renderResults();}); on('weather-tab', 'click', () => {state.weatherOnly = true; renderResults();});
  on('timeline-month', 'change', renderCalendar); on('hour-slider', 'input', () => {state.hour = Number($('hour-slider').value); renderInspector();});
  on('hour-prev', 'click', () => {state.hour--; renderInspector();}); on('hour-next', 'click', () => {state.hour++; renderInspector();});
  on('export-scenario', 'click', () => {const errors = scenarioErrors(current()); if (errors.length) throw new Error(errors.join('\n')); downloadScenario(current());});
  for (const type of ['json', 'csv']) on(`export-${type}`, 'click', () => downloadRun(state.results, state.resultSnapshot, type));
  // The results document carries the multi-year and multi-site sections when those runs exist.
  on('export-report', 'click', () => downloadRun(state.results, state.resultSnapshot, 'report', {aggregate: state.aggregate, sites: state.siteComparison, siteRuns: state.siteRuns}));
  on('export-design-basis', 'click', () => downloadRun(state.results, state.resultSnapshot, 'design-basis', {aggregate: state.aggregate, sites: state.siteComparison, siteRuns: state.siteRuns}));
  on('import-button', 'click', () => $('import-file').click()); on('import-file', 'change', importFile);
  initTour();
  initLearn();
}
async function initialize() {
  buildFields(); bindEvents();
  try {const saved = loadScenarios(); state.scenarios = saved.filter(s => !validateScenario(s).length).slice(0, 20).map(migrateScenario); if (state.scenarios.length !== saved.length) message('Some saved scenarios failed the current schema validation and were not loaded. Your original storage remains unchanged until you save.', 'warning');}
  catch (error) {message(`Local scenarios could not be loaded: ${error.message}. A fresh baseline is available.`, 'warning');}
  if (!state.scenarios.length) state.scenarios = [makeScenario()]; state.selected = state.scenarios[0].id; $('sector').value = current().sector; renderScenario(); reflectLocation(current());
  decorateTerms();
  const energyPromise = initializeEnergy();
  let cached = null; try {cached = await loadWeather();} catch (error) {message(`Weather cache unavailable: ${error.message}. Source retrieval and imports still work.`, 'warning');}
  if (cached) {try {await acceptWeather(cached, {persistSnapshot: false,adoptLocation:false}); $('weather-status').textContent = 'Weather you loaded earlier has been restored. Your scenario site was left alone, so if the two do not match, retrieve weather for this site before running.';} catch (error) {$('weather-status').textContent = `Saved weather was rejected: ${error.message} Enter a ZIP, then retrieve weather for your site.`;}}
  else $('weather-status').textContent = 'No weather loaded yet. Enter your ZIP, select Locate, then retrieve weather for the period you want to look at. A full year is the useful screen and takes about a minute to fetch. A single week arrives in seconds if you would rather see the tool work first.';
  await energyPromise;
}
initialize().catch(error => message(`Initialization failed: ${error.message}. Reload from a static HTTP server and verify that all application modules and data files are present.`, 'error'));
