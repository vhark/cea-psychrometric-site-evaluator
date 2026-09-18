import {localClock} from './physics.js';
import {costBasisForHours} from './metrics.js';

let catalogPromise;
let loadedCatalog;
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** No API keys: all artifacts are served beside this static application. */
export async function loadEnergyCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const paths = ['../data/us-zips.json', '../data/energy/utilities.json', '../data/energy/prices.json', '../data/energy/grid.json', '../data/energy/coverage.json', '../data/energy/manifest.json', '../data/us-zip-timezones.json'];
      const [inventory, utilities, prices, grid, coverage, manifest, timezones] = await Promise.all(paths.map(async path => {
        const response = await fetch(new URL(path, import.meta.url));
        if (!response.ok) throw new Error(`Energy catalog unavailable: ${path} (${response.status}).`);
        return response.json();
      }));
      if (inventory.schemaVersion !== 1 || prices.schemaVersion !== 1 || manifest.schemaVersion !== 1) throw new Error('Unsupported energy catalog schema.');
      loadedCatalog = {inventory, utilities, prices, grid, coverage, manifest, timezones, sources:manifest.sources, zipIndex:new Map(inventory.rows.map(row => [row[0], row]))};
      return loadedCatalog;
    })().catch(error => { catalogPromise = undefined; throw error; });
  }
  return catalogPromise;
}

/** ZIP is a five-character identifier, not a number or street-service assertion. */
export function lookupZip(zip, catalog = loadedCatalog) {
  if (!catalog) throw new Error('Load the energy catalog before looking up a ZIP.');
  const code = String(zip ?? '').trim();
  if (!/^\d{5}$/.test(code)) return null;
  const row = catalog.zipIndex.get(code);
  if (!row) return null;
  const [postalCode, city, state, latitude, longitude, coordinateAccuracy, inventoryStatus, utilityIndexes, gridRegions] = row;
  const utilities = utilityIndexes.map(index => ({...catalog.utilities[index]}));
  const sectors = catalog.coverage.pricesByState[state] || {};
  const availableRegions = gridRegions.filter(region => catalog.grid.subregions[region]);
  return {
    zip:postalCode, city, state, latitude, longitude, coordinateAccuracy, inventoryStatus,
    inventorySource:inventoryStatus === 'geonames' ? 'geonames' : 'mapping-source-only',
    utilities, mappingStatus:utilities.length > 1 ? 'multiple-candidates-2021' : utilities.length ? 'candidate-2021' : 'unknown',
    priceAvailability:{status:Object.keys(sectors).length ? 'state-sector-proxy' : 'unavailable', geography:state, sectors, utilityTariff:'not-ingested'},
    gridAvailability:{status:availableRegions.length > 1 ? 'multiple-subregion-candidates' : availableRegions.length ? 'subregion-candidate' : catalog.grid.states[state] ? 'state-generation-only' : 'unavailable', year:2023, regions:[...gridRegions], stateAvailable:Boolean(catalog.grid.states[state]), source:'epaZip2023'},
  };
}

/* The public postal catalog has no time zone column, so one comes from data/us-zip-timezones.json,
   a ZIP-level table built from the GeoNames gazetteer by scripts/build-zip-timezones.mjs. Scored
   against tz-database boundaries it puts 99.5% of ZIPs on the right clock, against 96.8% for the
   state-level guess this replaced. The state table remains as a fallback for a ZIP the table does
   not carry. Both are proposals the user confirms; neither is applied silently. */
const STATE_TIMEZONES = {
  AL:'America/Chicago',AK:'America/Anchorage',AZ:'America/Phoenix',AR:'America/Chicago',CA:'America/Los_Angeles',
  CO:'America/Denver',CT:'America/New_York',DE:'America/New_York',DC:'America/New_York',FL:'America/New_York',
  GA:'America/New_York',HI:'Pacific/Honolulu',ID:'America/Boise',IL:'America/Chicago',IN:'America/Indiana/Indianapolis',
  IA:'America/Chicago',KS:'America/Chicago',KY:'America/New_York',LA:'America/Chicago',ME:'America/New_York',
  MD:'America/New_York',MA:'America/New_York',MI:'America/Detroit',MN:'America/Chicago',MS:'America/Chicago',
  MO:'America/Chicago',MT:'America/Denver',NE:'America/Chicago',NV:'America/Los_Angeles',NH:'America/New_York',
  NJ:'America/New_York',NM:'America/Denver',NY:'America/New_York',NC:'America/New_York',ND:'America/Chicago',
  OH:'America/New_York',OK:'America/Chicago',OR:'America/Los_Angeles',PA:'America/New_York',RI:'America/New_York',
  SC:'America/New_York',SD:'America/Chicago',TN:'America/Chicago',TX:'America/Chicago',UT:'America/Denver',
  VT:'America/New_York',VA:'America/New_York',WA:'America/Los_Angeles',WV:'America/New_York',WI:'America/Chicago',
  WY:'America/Denver',PR:'America/Puerto_Rico',VI:'America/St_Thomas',GU:'Pacific/Guam',AS:'Pacific/Pago_Pago'};
const SPLIT_ZONE_STATES = new Set(['AK','AZ','FL','ID','IN','KS','KY','MI','NE','ND','OR','SD','TN','TX']);

/** Binary search of the run-length table: a ZIP takes the zone of the last run starting at or before it. */
export function zipTimezone(zip, table) {
  if (!table?.runs?.length || !/^\d{5}$/.test(String(zip))) return null;
  const code = String(zip), runs = table.runs;
  let low = 0, high = runs.length / 2 - 1, found = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (runs[mid * 2] <= code) { found = table.zones[runs[mid * 2 + 1]]; low = mid + 1; }
    else high = mid - 1;
  }
  return found;
}

/** {timezone, source, borderline, note} for a ZIP record, or null when nothing can be proposed. */
export function proposeTimezone(info, catalog = loadedCatalog) {
  if (!info) return null;
  const exact = zipTimezone(info.zip, catalog?.timezones);
  if (exact) {
    const override = catalog?.timezones?.overrides?.[info.zip];
    return {timezone: exact, source: 'zip-table', borderline: false,
      note: override
        ? `${exact} for ZIP ${info.zip}. ${override.why} Confirm it before running.`
        : `${exact}, from the ZIP time zone table. Confirm it, especially near a state or county line.`};
  }
  const timezone = STATE_TIMEZONES[info.state];
  if (!timezone) return null;
  const split = SPLIT_ZONE_STATES.has(info.state);
  return {timezone, source: 'state-fallback', borderline: split, note: split
    ? `ZIP ${info.zip} is not in the time zone table, so this is a guess from ${info.state}, which spans more than one zone or does not observe daylight saving. Check it before running.`
    : `ZIP ${info.zip} is not in the time zone table, so ${timezone} is a guess from ${info.state}. Check it before running.`};
}

export function getEnergyContext(zipInfo, {sector = 'commercial', startDate, endDate} = {}, catalog = loadedCatalog) {
  if (!catalog) throw new Error('Load the energy catalog before selecting energy context.');
  if (!['commercial', 'industrial', 'residential'].includes(sector)) throw new Error('Choose commercial, industrial or residential electricity prices.');
  const state = zipInfo?.state;
  const allPrices = catalog.prices.states[state]?.[sector] || [];
  // Weather interval boundaries are UTC, billing months are local. Retain one
  // adjacent month at each edge so a timezone rollover cannot remove a real rate.
  const neighborMonth = (date, offset) => {
    if (!date) return null;
    const [year, month] = date.slice(0, 7).split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
  };
  const firstMonth = neighborMonth(startDate, -1);
  const lastMonth = neighborMonth(endDate, 1);
  const prices = allPrices.filter(row => (!firstMonth || row[0] >= firstMonth) && (!lastMonth || row[0] <= lastMonth)).map(([period, usdPerKWh, status]) => ({period, usdPerKWh, status, source:'eia861m', geography:state, sector, basis:'state-sector-average-proxy'}));
  const gridCandidates = (zipInfo?.gridAvailability?.regions || []).map(region => catalog.grid.subregions[region]).filter(Boolean);
  // Never pick the first of several possible subregions. A state fallback is
  // explicitly production context, not an inferred electricity supplier mix.
  const chosen = gridCandidates.length === 1 ? gridCandidates[0] : catalog.grid.states[state];
  const grid = chosen ? {...chosen, selectionBasis:gridCandidates.length === 1 ? 'single-ZIP-subregion-candidate' : 'state-generation-proxy', mappingSource:gridCandidates.length === 1 ? 'epaZip2023' : null} : null;
  const warnings = [
    'Public ZIP coverage is not an authoritative active USPS inventory. Coordinates are approximate.',
    'Utility associations are possible providers from 2021, not verified street-level service or current tariffs.',
    'State-sector monthly average prices are screening proxies, not utility tariffs; no demand, fixed-charge or time-of-use bill is reconstructed.',
    'Tariff schedules are not ingested. URDB is an external research source with unverified location/date eligibility.',
  ];
  if (!zipInfo) warnings.push('ZIP not found: provider, state price and grid context are unavailable.');
  else if (zipInfo.inventoryStatus === 'mapping-only') warnings.push('ZIP appears only in an energy mapping source; its active postal validity and coordinates are unknown.');
  if (!zipInfo?.utilities?.length) warnings.push('No utility candidate is mapped for this ZIP. Unknown does not mean no electric service.');
  if (!prices.length) warnings.push('No state-sector prices cover the requested period. Missing hours remain unpriced unless a deliberate manual override is selected.');
  if (gridCandidates.length > 1) warnings.push(`ZIP spans ${gridCandidates.length} possible eGRID subregions. No first-match choice is made; displayed state generation is a separate, coarser proxy when available.`);
  if (grid) {
    warnings.push(`Grid mix is annual ${grid.year} ${grid.geography} generation, not utility procurement, hourly marginal emissions, or lifecycle carbon. CO2 is distinct from CO2e; no grid-loss adjustment is applied.`);
    if ((startDate && Number(startDate.slice(0, 4)) !== grid.year) || (endDate && Number(endDate.slice(0, 4)) !== grid.year)) warnings.push(`Emissions are unavailable outside ${grid.year}; the displayed grid snapshot is not silently applied to other calendar years.`);
  } else warnings.push('No regional generation mix or CO2 factor is available for this location.');
  return {
    zip:zipInfo?.zip ?? null, state:state ?? null, sector, startDate:startDate ?? null, endDate:endDate ?? null,
    utilities:zipInfo?.utilities || [], prices, grid, gridCandidates,
    coverage:{mappingStatus:zipInfo?.mappingStatus || 'unknown', priceAvailability:zipInfo?.priceAvailability || {status:'unavailable'}, gridAvailability:zipInfo?.gridAvailability || {status:'unavailable'}, requestedPricePeriods:prices.length, priceBasis:'state-sector-average-proxy', tariffStatus:'not-ingested', snapshotDate:catalog.manifest.snapshotDate},
    warnings, sources:Object.entries(catalog.sources).map(([id, source]) => ({id, ...source})),
  };
}

/** Replaces electric cost only, retaining the scenario's fuel and water inputs.
 * A missing price is null, never zero and never today's or nearest month's rate.
 * No mutation: the unpriced simulation and reusable context remain intact.
 */
export function applyEnergyContext(result, context) {
  const scenario = result.scenario;
  const manual = scenario.priceMode === 'manual';
  const byPeriod = new Map((context?.prices || []).filter(price => finite(price.usdPerKWh) && price.usdPerKWh >= 0).map(price => [price.period, price]));
  const fresh = () => ({validHours:0, pricedHours:0, priceMissingHours:0, knownCost:0, electricityCost:0, fuelCost:0, waterCost:0, pricedElectricKWh:0, unpricedElectricKWh:0, gridCoveredHours:0, gridMissingHours:0, knownCo2Kg:0});
  const total = fresh(), months = new Map(), days = new Map();
  function accumulate(target, hour) {
    if (!hour.valid) return;
    target.validHours++;
    target.knownCost += hour.knownCost;
    target.fuelCost += hour.fuelCost;
    target.waterCost += hour.waterCost;
    if (hour.priceMissing) {
      target.priceMissingHours++;
      target.unpricedElectricKWh += hour.electricKWh;
    } else {
      target.pricedHours++;
      target.electricityCost += hour.electricityCost;
      target.pricedElectricKWh += hour.electricKWh;
    }
    if (hour.co2Kg === null) target.gridMissingHours++;
    else { target.gridCoveredHours++; target.knownCo2Kg += hour.co2Kg; }
  }
  const hours = result.hours.map(original => {
    const clock = localClock(original.time, scenario.timezone);
    const price = manual ? (finite(scenario.electricityPrice) && scenario.electricityPrice >= 0 ? {period:'manual', usdPerKWh:scenario.electricityPrice, source:'manual-scenario-override'} : null) : byPeriod.get(clock.month) || byPeriod.get(clock.month.slice(0, 4)) || null;
    const validEnergy = original.valid && finite(original.electricKWh) && finite(original.fuelKWh) && finite(original.waterL);
    const rate = price?.usdPerKWh ?? null;
    const fuelCost = validEnergy ? original.fuelKWh * scenario.fuelPrice : null;
    const waterCost = validEnergy ? original.waterL * scenario.waterPrice : null;
    const electricityCost = validEnergy && rate !== null ? original.electricKWh * rate : null;
    const knownCost = validEnergy ? (electricityCost ?? 0) + fuelCost + waterCost : null;
    const factor = context?.grid?.year === Number(clock.month.slice(0, 4)) && finite(context.grid.co2KgPerKWh) ? context.grid.co2KgPerKWh : null;
    const hour = {...original, billingPeriod:clock.month, pricePeriod:price?.period ?? null, priceSource:price?.source ?? null,
      electricityPriceUsdPerKWh:rate, priceMissing:!price, electricityCost, fuelCost, waterCost,
      cost:validEnergy && price ? knownCost : null, knownCost,
      co2Kg:validEnergy && factor !== null ? original.electricKWh * factor : null,
      gridYear:factor !== null ? context.grid.year : null};
    // Valid simulation hours must have physical energy quantities. Treat a
    // malformed result as unknown, rather than quietly pricing NaN as zero.
    if (original.valid && !validEnergy) throw new Error('Cannot price a valid simulation hour with missing energy quantities.');
    if (!months.has(clock.month)) months.set(clock.month, fresh());
    if (!days.has(clock.date)) days.set(clock.date, fresh());
    accumulate(total, hour); accumulate(months.get(clock.month), hour); accumulate(days.get(clock.date), hour);
    return hour;
  });
  function costFields(value) {
    return {...value,
      cost:value.validHours && !value.priceMissingHours ? value.knownCost : null,
      co2Kg:value.validHours && !value.gridMissingHours ? value.knownCo2Kg : null,
      costCoverage:{status:!value.validHours ? 'unknown' : value.priceMissingHours ? value.pricedHours ? 'partial' : 'unknown' : 'complete', pricedHours:value.pricedHours, missingPriceHours:value.priceMissingHours, validHours:value.validHours},
      effectiveElectricityPrice:value.pricedElectricKWh > 0 ? value.electricityCost / value.pricedElectricKWh : null,
    };
  }
  const priorCostBasis=result.summary?.costBasis;
  const baseCostBasis=priorCostBasis&&typeof priorCostBasis==='object'&&!Array.isArray(priorCostBasis)?
    priorCostBasis:costBasisForHours(hours,scenario);
  const appliedElectricityRates=new Map();
  for(const hour of hours)if(hour.valid&&finite(hour.electricityPriceUsdPerKWh)&&hour.pricePeriod)
    appliedElectricityRates.set(hour.pricePeriod,{period:hour.pricePeriod,usdPerKWh:hour.electricityPriceUsdPerKWh});
  const electricityPriceBasis=manual?
    {source:'manual scenario input',usdPerKWh:finite(scenario.electricityPrice)?scenario.electricityPrice:null}:
    {source:'calendar-matched state-sector average proxy',sector:context?.sector??scenario.sector??null,
      rates:[...appliedElectricityRates.values()].sort((a,b)=>a.period.localeCompare(b.period))};
  const summary = {...result.summary, ...costFields(total),
    monthly:(result.summary.monthly || []).map(month => ({...month, ...costFields(months.get(month.month) || fresh())})),
    daily:(result.summary.daily || []).map(day => ({...day, ...costFields(days.get(day.date) || fresh())})),
    costBasis:{...baseCostBasis,priceBasis:{...baseCostBasis.priceBasis,electricity:electricityPriceBasis}},
    emissionsBasis:'Year-matched annual eGRID total-output CO2, kg CO2; regional generation proxy, not marginal or supplier procurement. No grid-loss adjustment.',
  };
  const warnings = [...new Set([...(result.warnings || []), ...(context?.warnings || [])])];
  if (total.priceMissingHours) warnings.push(`${total.priceMissingHours} valid hours have no matching electricity price. Total cost is unknown; knownCost is only the priced electricity plus fuel and water subtotal.`);
  if (total.gridMissingHours) warnings.push(`${total.gridMissingHours} valid hours lack a matching-year regional CO2 factor. Total CO2 is unknown; knownCo2Kg is a covered-hours subtotal.`);
  return {...result, hours, summary, warnings, energyContext:{...context, appliedPriceMode:manual ? 'manual' : 'state-sector-average-proxy', timezone:scenario.timezone, fuelPrice:scenario.fuelPrice, waterPrice:scenario.waterPrice}};
}
