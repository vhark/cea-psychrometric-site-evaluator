# CEA Psychrometric Site Evaluator Implementation Plan

Purpose: hold the cross-module interface contract and the file-ownership map, so parallel work on `src/` composes instead of colliding.

Status: current for model `0.2.0-screening`, reviewed 2026-09-14. The ordered work list at the end is complete for v0.1; the v0.2 scope it does not cover is specified in [PRD.md](PRD.md) §10.

Read this if: you are changing a module signature, adding a worker message, or dividing work between several implementers.

> For agentic workers: use subagent-driven-development. Concurrent file ownership is explicit below. Skip validation while sibling edits are in flight; Main integrates and runs scientific and browser checks once the implementation is assembled.

**Goal:** Deliver a usable static CEA historical-climate comparison tool with portable facility scenarios, audited crop/light assumptions, national ZIP/utility data availability, energy pricing and grid-source context.

**Architecture:** Native JavaScript modules, a Web Worker, pinned PsychroLib, immutable hourly weather snapshots and dated public energy catalogs. A weather-only classifier stays distinct from the coupled finite-capacity zone simulation. No shared secret keys or account requirement.

**Tech Stack:** HTML/CSS, JavaScript ES modules, browser Worker/IndexedDB/localStorage, Python ingestion (openpyxl for source workbooks), Node scientific checks.

## Approved scope extension

User approved implementation on 2026-09-11 and requested audit/reuse of the client's (OSF) existing load calculator plus US ZIP/utility/pricing/grid context. The client calculator remains unchanged and outside this repository. Reuse geometry, light equations and labeled crop assumptions; do not import its empirical total-electricity multipliers into explicit HVAC energy accounting. Add greenhouse benches.

National catalog means enumerate the public ZIP inventory with explicit mapping/price/grid coverage per entry. A ZIP can have several providers or none mapped. Unknown service territories remain unknown, not nearest-provider assertions. Historical state/sector average prices are proxies, never utility tariffs. Regional generation mix is not supplier-specific clean electricity or hourly marginal emissions. Every dataset is dated and attributed. USPS-authoritative completeness cannot be claimed from GeoNames or ZCTA sources.

The user's latest scope distinction is binding: coarse component efficacy and investment screening now, a measured-data-calibrated greenhouse digital twin next. Generic desiccant moisture removal includes finite capacity, explicit regeneration energy, electricity/heat split and heat released indoors. A liquid-desiccant hybrid option is an assumed topology, not a Blue Frontier product map. Detailed academic model integration and calibration are planned in `DIGITAL-TWIN.md`.

## Files and ownership

- Main: `src/config.js` (defaults, crop/facility schemas, validation), `src/worker.js`, `src/storage.js`, `src/export.js`, `test/model.test.mjs`, `README.md`, reference-study outputs, integration and runtime verification.
- Climate implementer: `src/physics.js`, `src/simulate.js`, `src/metrics.js`, `vendor/psychrolib.js`, `vendor/PSYCHROLIB-LICENSE.txt`. Pure calculation only.
- UI implementer: `index.html`, `styles.css`, `src/app.js`, `src/charts.js`. No edits to calculation/data modules.
- Energy implementer: `src/energy.js`, `scripts/build-energy.py`, `data/energy/*`, `data/us-zips.json`, `docs/ENERGY-DATA.md`. Own the reproducible national data ingestion and coverage report, not weather files.
- Weather implementer: `src/weather.js`, `scripts/fetch-weather.py`, `data/weather/*` real snapshots with original payload/provenance, not synthetic demo weather.
- Added in v0.2, same boundaries: `src/sensitivity.js` and `scripts/morris-screening.mjs` belong with the climate implementer (pure calculation, importable without a DOM); `test/conservation.test.mjs`, `test/analysis.test.mjs`, `test/data.test.mjs` and `test/sensitivity.test.mjs` sit beside the module they defend.

## Cross-module contract

`config.js`: exports `DEFAULT_SCENARIO`, `CROPS`, `SYSTEMS`, `FACILITIES`, `FIELDS`, `makeScenario(facility='greenhouse',system='bench',crop='lettuce')`, `validateScenario(s)` returning string[]; `FIELDS` groups describe editable numeric fields `{key,label,unit,min,max,step}`.

Scenario is a flat JSON object, schemaVersion=1, id/name, facility ('greenhouse','hybrid','indoor'), system ('bench','wall','microgreens','propagation','mushroom'), crop, areaM2 (floor), canopyM2, heightM, envelopeRatio, uValue, thermalMassKJm2K, infiltrationACH, solarTransmission, parTransmission, shadeFraction, solarHeatFraction, minVentACH, maxVentACH, fanWPerM3s, padEnabled, padEffectiveness, padPumpW, heaterKW, heaterEfficiency, coolingKW, coolingCOP, coolingSHR, coolingMinOutdoorC, coolingMaxOutdoorC, dehuKgH, dehuLPerKWh, integratedHVAC, reheatFraction, humidifierKgH, lightWm2, efficacy, lightDelivery, dayStart, photoperiod, dayTargetC, nightTargetC, tempToleranceC, vpdMin, vpdMax, maxDewPointC, dliTarget, transpirationLDayM2, darkTranspirationFraction, cropSensibleWm2, electricityPrice, fuelPrice, waterPrice, installedCost, maintenanceYear, lifeYears, discountRate, latitude, longitude, timezone, zip, priceMode ('manual','state'), sector ('commercial','industrial','residential'). Crop water inputs are explicitly assumed, not validated yield predictions.

Weather snapshot: `{schemaVersion:1, source, sourceKind, latitude,longitude,timezone,startDate,endDate,retrievedAt,sourceUrl,units,raw?,hours:[{time:epochMilliseconds,tempC,dewPointC?,rh:0..1,pressurePa,ghiWm2,windMs?,quality?}]}`. Null fields remain null. Time is UTC interval start. Exports preserve provenance. Weather adapter normalizes units and checks hourly continuity without fabricating gaps.

`weather.js`: `fetchWeather({latitude,longitude,timezone,startDate,endDate,provider='nasa',station='TUL',signal,onProgress})`; `normalizeWeather(input)`; `loadExample()`; `fetchObserved(...)`. `fetchWeather` returns snapshot; provider='iem' returns observation+separately labeled NASA solar.

`simulate.js`: `simulateScenario(scenario,snapshot,{stepMinutes=1,onProgress}={})` -> `{scenario,hours,summary,warnings,modelVersion}`. Each result hour includes `time,tempC,rh,vpd,mode,reason,valid,compliantFraction,electricKWh,fuelKWh,waterL,condensateKg,lightKWh,solarDLI,lightDLI,heatingKWh,coolingKWh,dehuKWh,dehuHeatKWh,unmetSensibleKWh,unmetMoistureKg,energyResidualW,moistureResidualKgS}`. Weather-only classifications are stored in `weatherMode`, `padTempC`, `padDewPointC`, with flags as needed. Numerical/source failures remain invalid and separate from compliance. Step changes alter ideal control dispatch cadence as well as state sampling; they are not merely an ODE solver tolerance.

`metrics.js`: `summarizeHours(hours,scenario)`; `compareScenarios(results)`; `weatherSummary(hours,scenario)`; `sensitivity(scenario,snapshot)` or expose sensitivity via repeated simulate calls. Summary includes expectedHours,validHours,missingHours,compliantHours,compliancePct,electricKWh,fuelKWh,waterL,condensateKg,lightKWh,cost,longestFailureHours,peakCoolingKW,dliDeficitDays,monthly (month,hours,compliantHours,electricKWh,cost),modeCounts, daily. Additional fields allowed. Compare returns rows with id/name/cost/compliance/addedHours/addedCost/costPerAddedHour/dominated. Partial-period costing stays partial; capex displayed separately.

`energy.js`: async `loadEnergyCatalog()`; `lookupZip(zip,catalog)` -> `{zip,city,state,latitude,longitude,utilities:[{id,name,source,vintage}],mappingStatus,priceAvailability,gridAvailability}` or null; `getEnergyContext(zipInfo,{sector='commercial',startDate,endDate}={},catalog)` -> `{utilities,prices:[{period,usdPerKWh,source,geography}],grid:{year,region,mix:[{fuel,percent}],co2KgPerKWh,source}|null,coverage,warnings,sources}`. Real data only, unknowns explicit. `applyEnergyContext(result,context)` -> result with period-matched price costs and optional regional emissions; no invented latest-price historical fallback. Exported price provenance survives.

`storage.js`: `loadScenarios()`, `saveScenarios(array)`, `saveWeather(snapshot)`, `loadWeather()`.

`export.js`: `downloadRun(results,snapshot,format)` with formats 'json','csv','report'; report is standalone printable Field-themed HTML; `downloadScenario(s)` and `parseImport(text)`.

Worker, simulate path: receives `{id,scenarios,snapshot,energyContext?,label?}` and posts `{id,type:'progress',value,message}` or `{id,type:'result',results}` or `{id,type:'error',message}`. UI ignores stale IDs and terminates canceled workers.

Worker, parse path: receives `{id,type:'parse',file}` where `file` is the `File` chosen for import, and posts `{id,type:'progress',value,message}` while reading and parsing, then `{id,type:'parsed',kind,scenarios,snapshot}` or `{id,type:'error',message}`. `kind` is `'run'` (portable run/scenario JSON through `parseImport`, imported result claims dropped), `'weather-json'` or `'weather-csv'`; `snapshot` is already through `normalizeWeather`, so the UI thread adopts it without re-normalizing. Parsing a 100+ MB import therefore never runs on the UI thread; a file beyond the tab's memory kills the worker, which the UI reports, instead of freezing the page. The UI re-checks its weather epoch after the parse, so an import still supersedes any in-flight retrieval.

## Ordered work and checks

- [x] Audit original source/readme and live version; record dimensional and empirical limitations without changing legacy code.
- [x] Research actual national bulk ZIP/utility/price/grid sources, including vintage, licensing, many-to-many joins and missing coverage.
- [x] Create config/portable contracts and data adapters; vendor vetted psychrometrics with attribution.
- [x] Implement conservative coupled finite-capacity heat/moisture model and causal light scheduling, preserving electrical/latent conservation.
- [x] Build dated national catalog and historical price/grid availability, integrate with location and actual period costing.
- [x] Build complete responsive UI with save/import/export, charts, hour inspector, scenario comparisons and visible evidence tiers.
- [x] Run numerical boundary checks for dehu heat, crop latent accounting, pad saturation, finite cooling, dark-period moisture, partial-year economics, gaps/DST and ZIP ambiguity.
- [x] Run original load calculator suite once as source audit evidence; it is not proof of empirical accuracy.
- [x] Exercise real browser ZIP/location selection, historical weather retrieval, scenarios, energy selection, save/reload, import/export, mobile layout and error states.
- [x] Complete independent scientific/data reviews and integration review, fix concrete findings, record verified limits, remove throwaway downloads and document local static serving. This was not a penetration test; see VERIFICATION.md.

All approved product and reference-study requirements remain tracked in PRD/EVALUATION. Any unavailable national provider/tariff coverage is explicitly reported, not replaced by invented data. No claim of state-of-the-art validation is made merely because the UI and simulation execute.
