# CEA Psychrometric Site Evaluator Implementation Plan

Purpose: hold the cross-module interface contract and the file-ownership map, so parallel work on `src/` composes instead of colliding.

Status: current for model `0.2.0-screening`, reviewed 2026-09-14. The ordered work list at the end is complete for v0.1; the v0.2 scope it does not cover is specified in [PRD.md](PRD.md) §10.

Read this if: you are changing a module signature, adding a worker message, or dividing work between several implementers.

> For agentic workers: use subagent-driven-development. Concurrent file ownership is explicit below. Skip validation while sibling edits are in flight; Main integrates and runs scientific and browser checks once the implementation is assembled.

**Goal:** Deliver a usable static CEA historical-climate comparison tool with portable facility scenarios, audited crop/light assumptions, national ZIP/utility data availability, energy pricing and grid-source context.

**Architecture:** Native JavaScript modules, a Web Worker, pinned PsychroLib, immutable hourly weather snapshots and dated public energy catalogs. A weather-only classifier stays distinct from the coupled finite-capacity zone simulation. No shared secret keys or account requirement.

**Tech Stack:** HTML/CSS, JavaScript ES modules, browser Worker/IndexedDB/localStorage, Python ingestion (openpyxl for source workbooks), Node scientific checks.

## Approved scope extension

Scope approved 2026-09-11: a coupled hourly screen plus US ZIP, utility, pricing and grid context. Geometry, light equations and labeled crop assumptions were reused from an earlier internal load calculator; its empirical total-facility electricity multipliers were deliberately not imported, because this model calculates HVAC electricity explicitly and multiplying on top would double count.

National catalog means enumerate the public ZIP inventory with explicit mapping/price/grid coverage per entry. A ZIP can have several providers or none mapped. Unknown service territories remain unknown, not nearest-provider assertions. Historical state/sector average prices are proxies, never utility tariffs. Regional generation mix is not supplier-specific clean electricity or hourly marginal emissions. Every dataset is dated and attributed. USPS-authoritative completeness cannot be claimed from GeoNames or ZCTA sources.

The user's latest scope distinction is binding: coarse component efficacy and investment screening now, a measured-data-calibrated greenhouse digital twin next. Generic desiccant moisture removal includes finite capacity, explicit regeneration energy, electricity/heat split and heat released indoors. A liquid-desiccant hybrid option is an assumed topology, not a Blue Frontier product map. Detailed academic model integration and calibration are planned in `DIGITAL-TWIN.md`.

## Files and ownership

- Main: `src/config.js` (defaults, crop/facility schemas, validation), `src/worker.js`, `src/storage.js`, `src/export.js`, `test/model.test.mjs`, `test/examples.test.mjs`, `README.md`, `scripts/reference-study.mjs`, `scripts/regional-study.mjs` with their committed outputs (`docs/regional-study.json`) and the contract test over them (`test/regional.test.mjs`), integration and runtime verification.
- Climate implementer: `src/physics.js`, `src/simulate.js`, `src/metrics.js`, `vendor/psychrolib.js`, `vendor/PSYCHROLIB-LICENSE.txt`. Pure calculation only.
- UI implementer: `index.html`, `styles.css`, `src/app.js`, `src/charts.js`. No edits to calculation/data modules.
- Energy implementer: `src/energy.js`, `scripts/build-energy.py`, `data/energy/*`, `data/us-zips.json`, `docs/ENERGY-DATA.md`. Own the reproducible national data ingestion and coverage report, not weather files.
- Weather implementer: `src/weather.js`, `scripts/fetch-weather.py`, `scripts/fetch-observed.mjs`, `data/weather/*` real snapshots with original payload/provenance, not synthetic demo weather.
- Added in v0.2, same boundaries: `src/sensitivity.js` and `scripts/morris-screening.mjs` belong with the climate implementer (pure calculation, importable without a DOM); `test/conservation.test.mjs`, `test/analysis.test.mjs`, `test/data.test.mjs` and `test/sensitivity.test.mjs` sit beside the module they defend.
- Component-evidence implementer: `src/screens.js`, `docs/COMPONENT-PARAMETERS.md`, `test/screens.test.mjs`. Owns the movable-shade, thermal-curtain, insect-screen and air-source heat-pump defaults, their catalogued grades and their resolvers. DOM-free and importable. A parameter the evidence document marks UNSOURCED ships as `null`, the component cannot act until a user supplies it, and the run says so. Must not decide dispatch: the resolvers return numbers and deployment predicates, `src/simulate.js` decides what happens with them.
- Presentation implementer, same boundary as the UI implementer: `src/report.js`, `src/learn.js`, `src/tour.js`. `report.js` formats one run into the standalone Archive-register document and may compute no metric of its own; it calls `src/metrics.js` for every figure it prints. `learn.js` and `tour.js` quote only figures already committed elsewhere in the repository (docs and `docs/regional-study.json` at run time) and compute nothing. The spotlight implementation lives in `tour.js` and is exported; `learn.js` imports it rather than writing a second one. None of the three may edit a calculation or data module.
- Data-vintage owner: `src/vintages.js`, `scripts/check-vintages.mjs`, `test/vintages.test.mjs`. Staleness budgets are assessed from committed manifests only, never from a file timestamp, a clock, or a publication month written in prose, and a manifest with no machine-readable date reports `unknown` rather than `current`. The module is DOM-free and IO-free; the script does the reading, printing and the only optional network check.

## Cross-module contract

`config.js`: exports `DEFAULT_SCENARIO`, `CROPS`, `SYSTEMS`, `FACILITIES`, `FIELDS`, `makeScenario(facility='greenhouse',system='bench',crop='lettuce')`, `validateScenario(s)` returning string[]; `FIELDS` groups describe editable numeric fields `{key,label,unit,min,max,step}`.

Scenario is a flat JSON object, schemaVersion=1, id/name, facility ('greenhouse','hybrid','indoor'), system ('bench','wall','microgreens','propagation','mushroom'), crop, areaM2 (floor), canopyM2, heightM, envelopeRatio, uValue, thermalMassKJm2K, infiltrationACH, solarTransmission, parTransmission, shadeFraction, solarHeatFraction, minVentACH, maxVentACH, fanWPerM3s, padEnabled, padEffectiveness, padPumpW, heaterKW, heaterEfficiency, coolingKW, coolingCOP, coolingSHR, coolingMinOutdoorC, coolingMaxOutdoorC, dehuKgH, dehuLPerKWh, integratedHVAC, reheatFraction, humidifierKgH, lightWm2, efficacy, lightDelivery, dayStart, photoperiod, dayTargetC, nightTargetC, tempToleranceC, vpdMin, vpdMax, maxDewPointC, dliTarget, transpirationLDayM2, darkTranspirationFraction, cropSensibleWm2, electricityPrice, fuelPrice, waterPrice, installedCost, maintenanceYear, lifeYears, discountRate, latitude, longitude, timezone, zip, priceMode ('manual','state'), sector ('commercial','industrial','residential'). Crop water inputs are explicitly assumed, not validated yield predictions.

The flat list also predates the v0.2 fields that sit beside it: `technology` (the strategy template a scenario matches), `controlMode` ('staged' or 'ideal'), `transpirationModel` ('stanghellini' or 'schedule') with `lai`, the desiccant group (`desiccantKgH`, `regenerationKWhPerKg`, `regenerationElectricFraction`, `desiccantHeatFraction`, `hybridEvapEffectiveness`) and the DOAS group (`doasM3s`, `doasSupplyDewPointC`, `doasSupplyTempC`, `doasKWhPerKg`). `backfillScenario` supplies each of them to an older saved scenario, taking `lai` and `transpirationModel` from the crop when the crop declares them.

Component objects are nested inside that flat scenario, back-filled and validated by `config.js` and owned by `screens.js`: `shadeScreen`, `thermalScreen`, `insectScreen`, plus the heat-source fields (`heatSource`, `heatPumpCopAt8C`, `heatPumpCopAtMinus8C`, `heatPumpCopAtMinus15C`, `heatPumpCutoffC`, `heatPumpCapacityDerate`). `insectScreen` is the three-module contract to copy when adding another component: `config.js` back-fills it through `backfillInsectScreen` into `DEFAULT_SCENARIO` and validates it through `insectScreenErrors`, which rejects an installed screen that resolves to no factor, so a mesh can never quietly cost nothing. `screens.js` owns the shape `{installed, grade, ventilationFactor}`, the catalogued grades (`mesh40` 1, `mesh52` 0.641, `mesh78` 0.502, measured ratios against a 40-mesh house) and `resolveInsectScreen`, which prefers a declared product factor over a catalogued grade and reports which basis it used. `src/simulate.js` applies the result once, at the physics entry point, by multiplying `maxVentACH` by the factor: the declared `minVentACH` is never derated, a derate that would fall below it clamps to it and sets `clampedToMinimum`, and the run emits a warning naming the factor, its basis, the resulting ACH and the fact that the reference is a screened house rather than an unscreened one. No optical or thermal effect of the mesh is modeled.

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
