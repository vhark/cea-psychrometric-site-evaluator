/* Guided tour. Data-driven steps over real element ids, spotlight plus dimmed backdrop, resumable.
   Copy discipline: every figure quoted here comes from the repository's own evidence (docs/VERIFICATION.md,
   docs/SENSITIVITY.md, docs/morris-screening.json and the bundled Tulsa example). No claim beyond them. */

export const TOUR_VERSION = 1;
export const TOUR_KEY = 'cea-psychrometric-site-evaluator.tour.v1';

/** Ordered steps. `target` is an element id in index.html; `absent` explains a step skipped because its
    target is present but not on screen. Add a panel by appending one entry. */
export const TOUR_STEPS = [
  {id: 'intro', target: 'title', title: 'A screen, not a certificate',
    body: 'This tool replays historical weather against coarse component models and reports how many hours a control strategy holds your target band, and what running it costs. It is assumption-based screening, not a calibrated digital twin, not equipment sizing and not a manufacturer comparison. Every number on screen carries its basis, and the sources section at the bottom states what the model does not know.',
    why: 'The decision this supports is which strategies deserve engineering, not which unit to buy.'},
  {id: 'zip', target: 'zip', title: 'Name the site',
    body: 'A five-character US ZIP resolves to a catalog centroid, a proposed time zone and candidate utilities. Locate fills latitude, longitude and time zone, all of which you can override under "Coordinates, time zone & station". A centroid is not your street address, so verify it before treating the weather as site-specific.',
    why: 'Every scenario in a comparison shares this site, so changing it changes every result.'},
  {id: 'period', target: 'start-date', title: 'Set the period',
    body: 'Start and end dates are inclusive local days and define the record every scenario is scored against. A partial period stays partial: hours and costs cover those days only and are never scaled up into a claimed annual figure. Read attainment together with the valid-hours metric, which reports how much of the expected record actually arrived.'},
  {id: 'provider', target: 'weather-provider', title: 'Choose the evidence source',
    body: 'NASA POWER is a gridded hourly reconstruction with complete coverage. Station observations pair measured temperature and humidity from the IEM station you name with separately sourced solar, which can be unavailable for some hours. Missing intervals stay visible as gaps, and no synthetic weather is substituted when retrieval fails.',
    why: 'Gridded and observed records disagree, and that difference belongs in the record rather than in a silent average.'},
  {id: 'retrieve', target: 'fetch-weather', title: 'Retrieve the record',
    body: 'Retrieve weather fetches the selected source for the chosen period and caches it in this browser. "Load Tulsa 2025 example" loads a bundled genuine 8,760-hour NASA POWER year for ZIP 74103, the fastest way to see a complete run. The badge beside the panel heading reports whether weather is loaded and what it covers.'},
  {id: 'years', target: 'year-chips', title: 'Run more than one year',
    body: 'Each chip is a calendar year available for these coordinates, from the bundled catalog, the browser cache or a retrieval. Ten Tulsa years, 2016 through 2025, ship with the tool, each complete at 8,760 or 8,784 hours. Every selected scenario runs against every selected year, which is what fills the across-years panel.',
    why: 'In the bundled six-strategy example the baseline attained a median 28.9%, with the worst year (2025) at 27.1% of eligible hours for joint temperature-and-moisture target attainment. Best-to-worst spreads require both endpoints, not median minus worst. One year is an anecdote.'},
  {id: 'retrieve-years', target: 'retrieve-years', title: 'Add years from the source',
    body: 'Set how many of the most recent complete calendar years to pull from the selected source, then retrieve. Years are fetched one at a time and cached locally, so a second run over the same years is immediate. A failed retrieval leaves that year absent rather than substituting a neighbouring year.'},
  {id: 'sites', target: 'sites-row', title: 'Compare climates',
    body: 'Add further ZIPs to run the same facility, crop and years at other centroids. The public ZIP catalog carries no time zone, so the proposed zone must be verified: several states span two zones and Arizona does not observe daylight saving. Extra sites are costed at manual scenario prices, not their local historical proxies, so read their cost column as a common assumption rather than a local tariff.',
    why: 'Tulsa gave 244 pad-effective and 401 free-cooling hours where Phoenix gave 2,334 and 2,636 on the same screen. Climate, not equipment, sets that ceiling.'},
  {id: 'energy', target: 'energy-panel', title: 'Local energy context',
    body: 'This panel holds the shared customer sector, the working scenario\u2019s electricity costing mode, candidate providers for the ZIP, and historical price and generation-mix context. Manual scenario price uses your own assumption; the historical state and sector proxy recosts the same dispatch against published monthly averages. Proxies are not tariffs, utility candidates are dated mappings rather than a service guarantee, and price gaps produce an unknown total plus a labelled known subtotal.'},
  {id: 'scenario-select', target: 'scenario-select', title: 'The working scenario',
    body: 'This select chooses which scenario the form below edits, and Duplicate, Remove and Save act on that one. Save keeps scenarios in this browser only, so export a copy if the result matters. The badge counts how many scenarios the next run will execute.'},
  {id: 'scenario-name', target: 'scenario-name', title: 'Name it for the comparison',
    body: 'The name labels this scenario in every chart, table and export, so make it describe the assumption being tested. Names are the only thing tying an exported run back to the decision it informed.'},
  {id: 'facility', target: 'facility', title: 'Facility type',
    body: 'Facility loads a complete template of envelope, glazing, infiltration and light assumptions, from indoor rooms to greenhouse structures. Changing it replaces those values, so set it before hand-editing fields below. Nothing here is a product specification: it is a labelled starting assumption you are expected to edit.'},
  {id: 'system', target: 'system', title: 'Cultivation system',
    body: 'The cultivation system sets floor and canopy geometry, including stacked tiers. Available footprint photons are shared over stacked canopy rather than multiplied by tier area, so adding tiers does not create light. Check the canopy-area field below to see what the template assumed.'},
  {id: 'crop', target: 'crop', title: 'Crop program',
    body: 'The crop program sets target temperature and VPD bands, the dew-point guardrail, the light target and crop moisture assumptions. The line under the select names the source of those values, including where a figure is a client assumption rather than a published one. Attainment is judged against these bands, so a wider band raises attainment without changing the building.',
    why: 'Morris screening ranked crop leaf area and transpiration first on all three metrics, at 9.10 percentage points (pp) of mean absolute effect on joint temperature-and-moisture target attainment against 5.89 for envelope U and 3.43 for shade fraction.'},
  {id: 'control-mode', target: 'control-mode', title: 'Control model',
    body: 'The staged deadband controller is the default and converges with dispatch cadence: over a full Tulsa year, one-minute against half-minute steps moved joint temperature-and-moisture target attainment by 0.004, 0.383 and 0.091 percentage points and electricity by at most 0.31%. The older ideal per-minute modulation remains selectable as a labelled upper bound and does not converge, at 1.5 percentage points (pp) and 1.95%. Read the ideal mode as a best case, never as a design figure.'},
  {id: 'transpiration-model', target: 'transpiration-model', title: 'Crop moisture model',
    body: 'Stanghellini transpiration drives crop moisture from leaf area, absorbed radiation and zone VPD, so the latent load responds to weather and light. The fixed schedule applies a constant litres per square metre per day instead, useful when you want to test a single number you already trust. Whichever is active is recorded in the run manifest and in every export.'},
  {id: 'technology', target: 'technology', title: 'Technology assumption',
    body: 'Technology replaces equipment capacities, efficiencies and installed-cost assumptions: ventilation and pads, heating, DX, condensing dehumidification, generic desiccant and hybrid indirect evaporation. Desiccant and hybrid entries are generic editable screens, not manufacturer performance maps, and installed costs are illustrative rather than quotations. Every value stays editable in the field groups below.'},
  {id: 'toggles', target: 'equipment-toggles', title: 'Pad and integrated reheat',
    body: 'Evaporative pad adds a finite-effectiveness pad stage to the strategy. Integrated reheat couples recovered heat back into the space instead of rejecting it, which shows up as reheat energy in the outside-air panel. Enabling the pad does not make it useful: the weather screen decides that.',
    why: 'In the Tulsa pad-and-vent baseline the pad ran 2,772 hours on 296 days, yet the weather-side screen found pad leaving air genuinely viable in only 244 hours on 65 days.'},
  {id: 'core-fields', target: 'core-fields', title: 'Core geometry and targets',
    body: 'Floor area, canopy area and the day and night temperature targets are the four inputs that move almost everything downstream. Inputs stay SI, with live imperial equivalents shown beside the field. Set these before reading any cost, because capacity, energy and water all scale from them.'},
  {id: 'advanced-fields', target: 'advanced-fields', title: 'The rest of the assumptions',
    body: 'These grouped fields hold envelope and glazing, infiltration and ventilation, moisture, light and DLI, target bands, equipment capacities, efficiencies and costs. Every default is a labelled assumption, and the values you change travel with the run so a reviewer can see exactly what was assumed. Nothing is calibrated to your site until you calibrate it here.'},
  {id: 'add-strategy', target: 'add-upgrade-row', title: 'Add a strategy to compare',
    body: 'Pick a technology and add it as a further scenario. New strategies copy the first scenario\u2019s non-equipment assumptions, so the comparison isolates the equipment change. The first scenario remains the named baseline. Differences in joint temperature-and-moisture target attainment use percentage points (pp) with both eligible-hour endpoints, never relative percent. Modeled operating-cost reduction is shown only for a lower-cost named alternative, never as guaranteed savings.'},
  {id: 'sensitivity', target: 'sensitivity-controls', title: 'Vary one assumption at a time',
    body: 'This generates sibling scenarios that change a single assumption across a stated range, for example pad effectiveness at 70, 80, 85 and 90%, or envelope U at plus and minus 20%. The spread you get back is a sensitivity range, not a statistical confidence interval. Use it to find out whether a ranking survives the assumption you are least sure about.',
    why: 'Across the screened ranges the cost ranking was not stable: three distinct orders appeared, the most common in 61.5% of 104 points, though the three cheapest positions held in all 104.'},
  {id: 'files', target: 'file-actions', title: 'Portable in, portable out',
    body: 'Export scenario writes the current inputs as JSON. Import accepts scenario JSON, a full run JSON or a weather CSV in the documented schema, parsed in a background worker so the interface stays responsive. An imported run\u2019s outputs are recomputed rather than trusted; the six-strategy example lives in docs/example-scenarios.json.'},
  {id: 'runbar', target: 'runbar', title: 'Run the comparison',
    body: 'Run all scenarios executes every scenario against every selected year and site in background workers, with progress and a cancel control. Nothing is calculated until you run, and editing an input afterwards marks the results stale instead of quietly updating them. Cancel keeps the previous results rather than presenting a partial run as complete.'},
  {id: 'evidence-note', target: 'evidence-note', title: 'The standing caveat',
    body: 'This note sits beside the results for a reason: the component models are coarse and the run is a screen. It is not a calibrated greenhouse digital twin and not a guarantee of indoor conditions. The disclosure under the metrics carries the per-run warnings, including missing hours, unpriced hours and any numerical failures.'},
  {id: 'headline-metrics', target: 'headline-metrics', title: 'The four numbers',
    body: 'Joint target attainment is the share of eligible hours inside the temperature, VPD and dew-point bands together, shown as equivalent compliant hours over eligible hours. Modeled operating cost includes purchased electricity, heating fuel and modeled water for the named period, with actual applied rates and exclusions in the cost basis, with a known subtotal when prices are missing. Longest target miss counts consecutive eligible intervals, and valid source and model hours reports how much of the record supported the answer. The first hour of every continuous weather segment is warm-up and excluded from comparative compliance.',
    why: 'High attainment on a thin record is not a result. Check valid hours before quoting the other three.'},
  {id: 'tiers', target: 'tier-tabs', title: 'Two evidence tiers',
    body: 'Equipment estimate shows the coupled model with finite capacities, energy and cost. Weather only drops every equipment assumption and classifies the outdoor record alone, which is the strongest evidence in the tool. The explanation line under the tabs restates what the selected tier can and cannot support.',
    why: 'When a reviewer challenges an equipment assumption, the weather-only tier is the part of the answer that does not depend on it.'},
  {id: 'modes', target: 'monthly-chart', title: 'Operating modes by month',
    body: 'Each month\u2019s bar splits elapsed hours by the mode the zone was in, so you can see which season actually drives the equipment. In weather-only mode the same bars classify outdoor air instead. The table view below adds the share of classified hours, the days with at least four hours in a mode and the longest continuous episode.',
    absent: 'the mode chart appears after you run scenarios'},
  {id: 'runtime', target: 'runtime-table', title: 'What each component ran',
    body: 'For every component this lists hours with any use, duty-weighted equivalent full-load hours, local days used and the share of valid hours, under the controller named in the help line. Equivalent full-load hours, not hours used, is the figure to compare against a capacity assumption. In weather-only mode the same table becomes the pad viability screen, splitting cooling-demand hours into pad-effective, marginal and ineffective with the limit that bound.',
    why: 'In the Tulsa baseline the moisture ceiling bound in 3,851 hours against 2,952 for the temperature margin, which points at dehumidification rather than more cooling.',
    absent: 'runtime is computed from a run, so run scenarios first'},
  {id: 'drying', target: 'drying-table', title: 'When outside air is the dehumidifier',
    body: 'This counts hours when outside air is drier than the zone\u2019s moisture ceiling, so ventilation removes water, split into cool and dry, cold and dry, and hot and dry. Each row gives hours, days with at least one and at least four hours, mean removal potential at the scenario\u2019s maximum ventilation rate, and energy and cost per kilogram of water against a condensing-dehumidifier reference. Hot and dry hours import sensible heat that is not costed here, so read them alongside a separate cooling plan.',
    why: 'In the Tulsa example outside air beat a 2.5 L/kWh dehumidifier on cost per kilogram in 4,970 hours and on energy per kilogram in 1,752 hours.',
    absent: 'the outside-air screen appears after you run scenarios'},
  {id: 'loads', target: 'loads-panel', title: 'Sensible against latent',
    body: 'Monthly sensible gains from solar, light, envelope, infiltration, ventilation, fans and the crop are plotted against the crop\u2019s evaporative load, expressed as latent heat below the axis. The sensible-heat ratio, in the table and in the hourly distribution line, indicates whether coupled cooling with reheat or decoupled moisture removal suits the load. These are model balance terms, not measurements.',
    absent: 'the load decomposition needs an equipment run, and is hidden in the weather-only view'},
  {id: 'co2', target: 'co2-panel', title: 'The enrichment window',
    body: 'This counts hours when ventilation stays at the minimum outside-air rate with no pad or indirect stage running, which is when CO\u2082 enrichment is physically possible. Equivalent hours are duty-weighted, so a half-open hour counts as half, and the weather-side row counts hours whose outdoor classification alone would allow a closed house. The value of enrichment depends on crop response, which this tool does not model.',
    absent: 'the enrichment window is computed from a run'},
  {id: 'calendar', target: 'timeline-chart', title: 'Where the gaps occur',
    body: 'The calendar plots day against hour for the selected month, with a shape as well as a colour in every cell so it survives printing and colour-vision differences. Hours are labelled in UTC, which keeps repeated local daylight-saving hours distinct. Select a cell to load that hour into the inspector below.',
    absent: 'the calendar appears after you run scenarios'},
  {id: 'calendar-table', target: 'timeline-table', title: 'The same month as a table',
    body: 'Day by hour as text, for reading exact values and copying them into a report. Opening this disclosure is often faster than hunting across the grid when you are checking one specific date. Missing hours appear as gaps here too, never as favourable conditions.',
    absent: 'the table view lives inside the calendar panel, which appears after a run'},
  {id: 'inspector', target: 'inspector-panel', title: 'Follow a single hour',
    body: 'The slider walks the record hour by hour and shows the weather input, the resulting zone state, which components ran and the cost accrued in that interval. This is where a suspicious monthly total becomes one specific hour you can argue with. Arrow buttons and the keyboard step one hour at a time, and the announcement line reports the settled hour for screen readers.',
    absent: 'the hourly inspector needs a run to inspect'},
  {id: 'years-panel', target: 'years-panel', title: 'Median year, worst year, spread',
    body: 'With two or more weather years this reports median, worst and best attainment and cost per scenario, the spread between them, and a least-squares trend once five or more calendar years exist. The ranking line states in plain words whether the cost ranking held across those years. Ten years of gridded weather is climate evidence, not a forecast of next season.',
    why: 'In the five-year example the cost ranking was not stable, producing two distinct orders. A single year would have hidden that.',
    absent: 'across-years needs a run covering two or more weather years'},
  {id: 'sites-panel', target: 'sites-panel', title: 'Which climate gives the most for free',
    body: 'Per site this reports median free-cooling hours, pad-effective hours, the binding constraint, the cheapest non-dominated strategy by median operating cost, and worst-year attainment. Additional sites are gridded weather at ZIP centroids priced at manual scenario prices, so treat their cost column as a common assumption rather than a local quote. Use this to rank climates, not to select a building.',
    absent: 'across-sites needs a run with at least one added comparison site'},
  {id: 'comparison', target: 'comparison-table', title: 'More control, at what cost',
    body: 'Capex, annual ownership at your stated discount, life and maintenance assumptions, and selected-period operating cost are kept separate and never summed. Added joint hours and added cost are measured against the first scenario over the hours both scenarios could be scored on, and cost per added hour follows from those two. The frontier column marks which strategies are operating-dominated, capital excluded.',
    why: 'Close rankings here are exploratory. Two strategies within a few percent are a tie until a calibrated model or a real quote separates them.',
    absent: 'the investment screen appears after a run, and is hidden in the weather-only view'},
  {id: 'exports', target: 'export-panel', title: 'Keep the evidence with the result',
    body: 'Run JSON carries inputs, provenance and outputs and is the reproducibility bundle. Hourly CSV is the raw per-hour record, and the printable report is the light-themed narrative. The design-basis brief summarises peak hours, air and water requirements and the strategy verdict for the engineer of record; a report on its own is not the full bundle, so keep the run JSON with it.',
    absent: 'exports become available once there is a run to export'},
  {id: 'sources', target: 'sources', title: 'Know what this screen cannot tell you',
    body: 'The sources section states the standing limits: weather is evidence, equipment is an assumption, and the desiccant and hybrid entries are technology references rather than brand rankings. There is no independent model benchmark, no site calibration and no equipment performance maps behind these numbers. The 91 regression tests defend physical and data boundaries, which is not the same thing as empirical greenhouse validation.',
    why: 'Quoting a figure from this tool without its basis is the one failure mode the whole interface is built to prevent.'}
];

const $ = id => document.getElementById(id);
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const defaults = () => ({step: 0, completed: false, dismissedAt: null, version: TOUR_VERSION});

/* Persistence. A blocked or corrupt localStorage degrades to an in-memory record: the tour still runs,
   it just forgets between reloads. `hadEntry` is false for a missing, corrupt or older-version entry,
   which is what makes the invitation reappear after the step list changes. */
let saved = null, hadEntry = false, persists = true;
function read() {
  if (saved) return saved;
  let raw = null;
  try {raw = localStorage.getItem(TOUR_KEY);} catch (error) {persists = false;}
  if (raw) try {
    const value = JSON.parse(raw);
    if (value && typeof value === 'object' && value.version === TOUR_VERSION) {
      saved = {step: Number.isInteger(value.step) && value.step > 0 ? value.step : 0, completed: Boolean(value.completed),
        dismissedAt: typeof value.dismissedAt === 'string' ? value.dismissedAt : null, version: TOUR_VERSION};
      hadEntry = true;
    }
  } catch (error) {/* corrupt entry: treat this browser as having never seen the tour */}
  if (!saved) saved = defaults();
  return saved;
}
function write(patch) {
  saved = {...read(), ...patch, version: TOUR_VERSION};
  hadEntry = true;
  if (persists) try {localStorage.setItem(TOUR_KEY, JSON.stringify(saved));} catch (error) {persists = false;}
  return saved;
}

/** Steps whose target element exists in this document, tagged with their canonical index. */
export function validateSteps() {
  return TOUR_STEPS.map((step, at) => ({...step, at})).filter(step => $(step.target));
}
function hiddenReason(step, element) {
  const blocked = element.hidden ? element : element.closest('[hidden]');
  if (blocked) return step.absent || `“${blocked.id || blocked.tagName.toLowerCase()}” is hidden right now`;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return step.absent || 'it is not displayed in the current view';
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return step.absent || 'it has no size in the current view';
  return null;
}
function openAncestors(element) {
  for (let node = element; node; node = node.parentElement) if (node.tagName === 'DETAILS' && !node.open) node.open = true;
}
/** First step at or after `from` in the travel direction whose target is on screen, plus what was skipped. */
function resolve(steps, from, direction) {
  const skipped = [];
  for (let i = from; i >= 0 && i < steps.length; i += direction) {
    const step = steps[i], element = $(step.target);
    if (!element) {skipped.push(`${step.title}: not present in this interface`); continue;}
    openAncestors(element);
    const reason = hiddenReason(step, element);
    if (!reason) return {index: i, skipped};
    skipped.push(`${step.title}: ${reason}`);
  }
  return {index: -1, skipped};
}

const tour = {active: false, steps: [], index: 0, trigger: null, guard: null, spot: null, card: null, keys: null, follow: null};

export function tourLabel() {
  const state = read(), list = validateSteps(), total = list.length;
  if (state.completed) return {text: 'Restart tour', label: `Restart the guided tour, ${total} steps`};
  if (state.step > 0) {
    const at = list.findIndex(step => step.at >= state.step), n = at < 0 ? total : at + 1;
    return {text: `Resume tour (step ${n} of ${total})`, label: `Resume the guided tour at step ${n} of ${total}`};
  }
  return {text: 'Take the tour', label: `Start the guided tour, ${total} steps`};
}
function refreshButton() {
  const button = $('tour-button');
  if (!button) return;
  const {text, label} = tourLabel();
  button.textContent = text;
  button.setAttribute('aria-label', label);
}

function build() {
  const guard = document.createElement('div');
  guard.className = 'tour-guard';
  guard.setAttribute('aria-hidden', 'true');
  guard.addEventListener('mousedown', event => event.preventDefault());
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  spot.setAttribute('aria-hidden', 'true');
  const card = document.createElement('div');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'tour-card-title');
  card.setAttribute('aria-describedby', 'tour-card-body');
  card.innerHTML = `<p class="tour-meta"><span class="eyebrow">Guided tour</span><span id="tour-counter" class="mono"></span></p>
<h3 id="tour-card-title"></h3>
<p id="tour-card-body"></p>
<p id="tour-card-why" class="tour-why" hidden></p>
<p id="tour-card-skipped" class="tour-skipped" role="status" hidden></p>
<div class="tour-actions"><button type="button" id="tour-back" class="quiet">Back</button><button type="button" id="tour-next" class="primary">Next</button><button type="button" id="tour-skip" class="quiet">Skip tour</button></div>`;
  document.body.append(guard, spot, card);
  Object.assign(tour, {guard, spot, card});
  $('tour-next').addEventListener('click', () => move(1));
  $('tour-back').addEventListener('click', () => move(-1));
  $('tour-skip').addEventListener('click', () => dismiss());
  card.addEventListener('keydown', trapTab);
}
function trapTab(event) {
  if (event.key !== 'Tab') return;
  const focusable = [...tour.card.querySelectorAll('button:not([disabled])')];
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1], active = document.activeElement;
  if (event.shiftKey && (active === first || !tour.card.contains(active))) {event.preventDefault(); last.focus();}
  else if (!event.shiftKey && active === last) {event.preventDefault(); first.focus();}
}
function onKey(event) {
  if (!tour.active) return;
  if (event.key === 'Escape') {event.preventDefault(); dismiss(); return;}
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {event.preventDefault(); move(1); return;}
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {event.preventDefault(); move(-1);}
}

function place(rect) {
  const margin = 14, vw = window.innerWidth, vh = window.innerHeight, card = tour.card;
  const width = card.offsetWidth, height = card.offsetHeight;
  const clamp = (value, max) => Math.max(margin, Math.min(value, max - margin));
  let top, left;
  if (vh - rect.bottom - margin >= height) top = rect.bottom + margin;
  else if (rect.top - margin >= height) top = rect.top - margin - height;
  else {
    top = clamp(rect.top, vh - height);
    if (vw - rect.right - margin >= width) left = rect.right + margin;
    else if (rect.left - margin >= width) left = rect.left - margin - width;
    else {top = Math.max(margin, (vh - height) / 2); left = Math.max(margin, (vw - width) / 2);}
    card.style.top = `${top}px`;
    card.style.left = `${clamp(left, vw - width)}px`;
    return;
  }
  card.style.top = `${top}px`;
  card.style.left = `${clamp(rect.left, vw - width)}px`;
}
function position() {
  if (!tour.active) return;
  const step = tour.steps[tour.index], element = step && $(step.target);
  if (!element) return;
  const rect = element.getBoundingClientRect(), pad = 6;
  const top = Math.max(0, rect.top - pad), left = Math.max(0, rect.left - pad);
  Object.assign(tour.spot.style, {top: `${top}px`, left: `${left}px`,
    width: `${Math.min(rect.width + pad * 2, window.innerWidth - left)}px`,
    height: `${Math.min(rect.height + pad * 2, window.innerHeight - top)}px`});
  place(rect);
}
/** Highlights one element without starting a tour, so other views can point at a panel and reuse
    the single `.tour-spot` implementation rather than duplicating the CSS. Returns false when the
    target is absent, and is a no-op while a tour owns the spotlight. `target` is an id or an Element. */
export function spotlight(target, {ms = 1800} = {}) {
  if (tour.active) return false;
  const element = typeof target === 'string' ? $(target) : target;
  if (!element) return false;
  openAncestors(element);
  const spot = document.createElement('div');
  spot.className = 'tour-spot';
  spot.setAttribute('aria-hidden', 'true');
  document.body.append(spot);
  const pad = 6;
  const put = () => {
    const rect = element.getBoundingClientRect();
    const top = Math.max(0, rect.top - pad), left = Math.max(0, rect.left - pad);
    Object.assign(spot.style, {top: `${top}px`, left: `${left}px`,
      width: `${Math.min(rect.width + pad * 2, window.innerWidth - left)}px`,
      height: `${Math.min(rect.height + pad * 2, window.innerHeight - top)}px`});
  };
  put();
  const rect = element.getBoundingClientRect();
  if (rect.top < 80 || rect.bottom > window.innerHeight - 80) element.scrollIntoView({block: 'center', inline: 'nearest', behavior: still() ? 'auto' : 'smooth'});
  const follow = setInterval(put, 60);
  window.addEventListener('scroll', put, {passive: true});
  window.addEventListener('resize', put);
  setTimeout(() => {
    clearInterval(follow);
    window.removeEventListener('scroll', put);
    window.removeEventListener('resize', put);
    spot.remove();
  }, ms);
  return true;
}
function show(index, skipped) {
  tour.index = index;
  const step = tour.steps[index], element = $(step.target);
  openAncestors(element);
  $('tour-counter').textContent = `${index + 1} of ${tour.steps.length}`;
  $('tour-card-title').textContent = step.title;
  $('tour-card-body').textContent = step.body;
  if (['headline-metrics', 'comparison', 'years-panel', 'energy'].includes(step.id)) {
    const basis = document.querySelector('#headline-metrics .result-basis');
    if (basis) $('tour-card-body').textContent += ` Saved result basis: ${basis.textContent}`;
  }
  const why = $('tour-card-why');
  why.textContent = step.why ? `Why it matters: ${step.why}` : '';
  why.hidden = !step.why;
  const note = $('tour-card-skipped');
  const shown = (skipped || []).slice(0, 3), rest = (skipped || []).length - shown.length;
  note.textContent = shown.length ? `Skipped ${skipped.length === 1 ? '1 step' : `${skipped.length} steps`} that are not on screen: ${shown.join('. ')}.${rest > 0 ? ` Plus ${rest} more for the same reason.` : ''}` : '';
  note.hidden = !note.textContent;
  $('tour-back').disabled = resolve(tour.steps, index - 1, -1).index < 0;
  const rect = element.getBoundingClientRect();
  if (rect.top < 80 || rect.bottom > window.innerHeight - 80) element.scrollIntoView({block: 'center', inline: 'nearest', behavior: still() ? 'auto' : 'smooth'});
  position();
  clearInterval(tour.follow);
  const until = Date.now() + 700;
  tour.follow = setInterval(() => {position(); if (Date.now() > until) {clearInterval(tour.follow); tour.follow = null;}}, 50);
  if (!tour.card.contains(document.activeElement)) $('tour-next').focus();
  write({step: step.at, completed: false, dismissedAt: null});
}
function move(direction) {
  const found = resolve(tour.steps, tour.index + direction, direction);
  if (found.index < 0) {
    if (direction > 0) finish();
    return;
  }
  show(found.index, found.skipped);
}

function teardown() {
  clearInterval(tour.follow);
  tour.follow = null;
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('scroll', position, true);
  window.removeEventListener('resize', position);
  for (const node of [tour.guard, tour.spot, tour.card]) node?.remove();
  Object.assign(tour, {active: false, guard: null, spot: null, card: null});
  const trigger = tour.trigger;
  tour.trigger = null;
  refreshButton();
  (trigger && trigger.isConnected ? trigger : $('tour-button'))?.focus();
}
function dismiss() {
  if (!tour.active) return;
  const step = tour.steps[tour.index];
  write({step: step ? step.at : 0, completed: false, dismissedAt: new Date().toISOString()});
  teardown();
}
function finish() {
  write({step: 0, completed: true, dismissedAt: null});
  teardown();
}

/** Starts, or resumes from the persisted step. Returns false when no step target exists. */
export function startTour(trigger, {resume = true} = {}) {
  if (tour.active) return true;
  tour.steps = validateSteps();
  if (!tour.steps.length) return false;
  const state = read();
  const wanted = resume && !state.completed && state.step > 0 ? Math.max(0, tour.steps.findIndex(step => step.at >= state.step)) : 0;
  let found = resolve(tour.steps, wanted, 1);
  if (found.index < 0 && wanted > 0) found = resolve(tour.steps, 0, 1);
  if (found.index < 0) return false;
  tour.trigger = trigger || $('tour-button');
  tour.active = true;
  build();
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
  hideInvite();
  show(found.index, found.skipped);
  return true;
}

function hideInvite() {$('tour-invite')?.remove();}
function invite() {
  if ($('tour-invite')) return;
  const box = document.createElement('aside');
  box.id = 'tour-invite';
  box.className = 'tour-invite';
  box.setAttribute('aria-label', 'Guided tour invitation');
  box.innerHTML = `<p><strong>First time here?</strong> A guided tour explains every panel, what each number means and what it does not prove. Leave it whenever you like; it resumes where you stopped.</p>
<div class="tour-actions"><button type="button" id="tour-invite-start" class="primary">Take the tour</button><button type="button" id="tour-invite-dismiss" class="quiet">Not now</button></div>`;
  document.body.append(box);
  $('tour-invite-start').addEventListener('click', () => {hideInvite(); startTour($('tour-button'), {resume: false});});
  $('tour-invite-dismiss').addEventListener('click', () => {write({dismissedAt: new Date().toISOString()}); hideInvite(); refreshButton(); $('tour-button')?.focus();});
}

/** Binds the header control and, for a browser that has never seen the tour, the quiet invitation. */
export function initTour() {
  const button = $('tour-button');
  if (button) button.addEventListener('click', event => {
    const state = read();
    startTour(event.currentTarget, {resume: !state.completed});
  });
  refreshButton();
  read();
  if (!hadEntry) invite();
  return {steps: TOUR_STEPS.length, present: validateSteps().length, key: TOUR_KEY, persists};
}
