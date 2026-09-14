import {localClock} from './physics.js';

let catalogPromise;
let loadedCatalog;
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** No API keys: all artifacts are served beside this static application. */
export async function loadEnergyCatalog() {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const paths = ['../data/us-zips.json', '../data/energy/utilities.json', '../data/energy/prices.json', '../data/energy/grid.json', '../data/energy/coverage.json', '../data/energy/manifest.json'];
      const [inventory, utilities, prices, grid, coverage, manifest] = await Promise.all(paths.map(async path => {
        const response = await fetch(new URL(path, import.meta.url));
        if (!response.ok) throw new Error(`Energy catalog unavailable: ${path} (${response.status}).`);
        return response.json();
      }));
      if (inventory.schemaVersion !== 1 || prices.schemaVersion !== 1 || manifest.schemaVersion !== 1) throw new Error('Unsupported energy catalog schema.');
      loadedCatalog = {inventory, utilities, prices, grid, coverage, manifest, sources:manifest.sources, zipIndex:new Map(inventory.rows.map(row => [row[0], row]))};
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
  const summary = {...result.summary, ...costFields(total),
    monthly:(result.summary.monthly || []).map(month => ({...month, ...costFields(months.get(month.month) || fresh())})),
    daily:(result.summary.daily || []).map(day => ({...day, ...costFields(days.get(day.date) || fresh())})),
    costBasis:manual ? 'Deliberate manual electricity override plus scenario fuel and water; observed valid-hour costs only. Capital and maintenance remain separate.' : 'Calendar-matched EIA state-sector monthly average proxy plus scenario fuel and water; observed valid-hour costs only. Capital and maintenance remain separate.',
    emissionsBasis:'Year-matched annual eGRID total-output CO2, kg CO2; regional generation proxy, not marginal or supplier procurement. No grid-loss adjustment.',
  };
  const warnings = [...new Set([...(result.warnings || []), ...(context?.warnings || [])])];
  if (total.priceMissingHours) warnings.push(`${total.priceMissingHours} valid hours have no matching electricity price. Total cost is unknown; knownCost is only the priced electricity plus fuel and water subtotal.`);
  if (total.gridMissingHours) warnings.push(`${total.gridMissingHours} valid hours lack a matching-year regional CO2 factor. Total CO2 is unknown; knownCo2Kg is a covered-hours subtotal.`);
  return {...result, hours, summary, warnings, energyContext:{...context, appliedPriceMode:manual ? 'manual' : 'state-sector-average-proxy', timezone:scenario.timezone, fuelPrice:scenario.fuelPrice, waterPrice:scenario.waterPrice}};
}
