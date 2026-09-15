# CEA Psychrometric Site Evaluator Implementation Plan

Purpose: hold the cross-module interface contract and the file-ownership map, so parallel work on `src/` composes instead of colliding.

Status: current for model `0.3.0-screening`, reviewed 2026-09-15. Current scenario schema is 2. Historical completed work below is development history, not evidence that every future evaluation gate has passed.

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
- Presentation implementer: `src/report.js`, `src/learn.js`, `src/tour.js`. Reports default to One Season Farmers Field; tools use Instrument. Report metrics come from `metrics.js`; shared presentation helpers exported by `report.js` supply cost/airflow/conditioning labels from the result rather than recomputing physics. Learn renders the schema-1 regional envelope with schema-2 scenarios; Morris artifact envelope is 2. The 5 pp/16% regional rules are methodological, not calibrated uncertainty.
- Data-vintage owner: `src/vintages.js`, `scripts/check-vintages.mjs`, `test/vintages.test.mjs`. Staleness budgets are assessed from committed manifests only, never from a file timestamp, a clock, or a publication month written in prose, and a manifest with no machine-readable date reports `unknown` rather than `current`. The module is DOM-free and IO-free; the script does the reading, printing and the only optional network check.

## Cross-module contract

`config.js`: exports `DEFAULT_SCENARIO`, `CROPS`, `SYSTEMS`, `FACILITIES`, `FIELDS`, `makeScenario(facility='greenhouse',system='bench',crop='lettuce')`, `validateScenario(s)` returning string[]; `FIELDS` groups describe editable numeric fields `{key,label,unit,min,max,step}`.

Scenario is a portable JSON object with `schemaVersion:2`, identity, facility/system/crop, floor/canopy/height geometry, envelope/optics, crop/light schedules, finite equipment and price inputs. `config.js` owns `DEFAULT_SCENARIO`, `FIELDS`, `migrateScenario`, validation and explicit review gates; use the current exported scenario for a complete field inventory instead of a second stale flat list. Retired cultivation identifiers are rejected, not aliased.

Airflow contract: `infiltrationACH` is uncontrolled exchange; `minVentACH` and `maxVentACH` bound controlled outdoor air; `fanWPerM3s` covers combined supply/exhaust fans and declared pressure drops. `outsideAirBasis` and `outsideAirReviewed` carry provenance and acknowledgment. DOAS fields are `doasM3s`, `doasSupplyDewPointC`, `doasSupplyTempC`, `doasCoolingCOP`, `doasReheatRecoveryFraction`. `doasM3s` is treatment capacity on that same stream, never additional ventilation.

`migrateScenario` copies inputs. Schema-1 migration preserves airflow values, supplies inert `heatRecovery.type:'none'`, assigns template evidence/review state, discards obsolete `doasKWhPerKg` and nulls legacy DOAS supply performance so active treatment must be completed and reviewed. Mushroom controlled air is project input, finite and ordered with a positive maximum before a run. Unknown future schema fails. Imports discard saved results.

`airflow.js` owns geometry conversions, recovery ratings/frost, moist-air mixing and DOAS enthalpy/COP conditioning. `simulate.js` owns dispatch and finite shared heater allocation: preheat, DOAS external heat, then zone heating. Core transfer is not purchased energy. Internal recirculation is outside the model. `heatRecovery` follows the nested component pattern, with null performance until supplied. Detailed fields and the 50% to 130% operating domain are in [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030).

Component objects are nested inside that flat scenario, back-filled and validated by `config.js` and owned by `screens.js`: `shadeScreen`, `thermalScreen`, `insectScreen`, plus the heat-source fields (`heatSource`, `heatPumpCopAt8C`, `heatPumpCopAtMinus8C`, `heatPumpCopAtMinus15C`, `heatPumpCutoffC`, `heatPumpCapacityDerate`). `insectScreen` is the three-module contract to copy when adding another component: `config.js` back-fills it through `backfillInsectScreen` into `DEFAULT_SCENARIO` and validates it through `insectScreenErrors`, which rejects an installed screen that resolves to no factor, so a mesh can never quietly cost nothing. `screens.js` owns the shape `{installed, grade, ventilationFactor}`, the catalogued grades (`mesh40` 1, `mesh52` 0.641, `mesh78` 0.502, measured ratios against a 40-mesh house) and `resolveInsectScreen`, which prefers a declared product factor over a catalogued grade and reports which basis it used. `src/simulate.js` applies the result once, at the physics entry point, by multiplying `maxVentACH` by the factor: the declared `minVentACH` is never derated, a derate that would fall below it clamps to it and sets `clampedToMinimum`, and the run emits a warning naming the factor, its basis, the resulting ACH and the fact that the reference is a screened house rather than an unscreened one. No optical or thermal effect of the mesh is modeled.

Weather snapshot: `{schemaVersion:1, source, sourceKind, latitude,longitude,timezone,startDate,endDate,retrievedAt,sourceUrl,units,raw?,hours:[{time:epochMilliseconds,tempC,dewPointC?,rh:0..1,pressurePa,ghiWm2,windMs?,quality?}]}`. Null fields remain null. Time is UTC interval start. Exports preserve provenance. Weather adapter normalizes units and checks hourly continuity without fabricating gaps.

`weather.js`: `fetchWeather({latitude,longitude,timezone,startDate,endDate,provider='nasa',station='TUL',signal,onProgress})`; `normalizeWeather(input)`; `loadExample()`; `fetchObserved(...)`. `fetchWeather` returns snapshot; provider='iem' returns observation+separately labeled NASA solar.

`simulate.js`: `simulateScenario(scenario,snapshot,{stepMinutes=1,onProgress}={})` -> `{scenario,hours,summary,warnings,modelVersion}`. Each result hour includes `time,tempC,rh,vpd,mode,reason,valid,compliantFraction,electricKWh,fuelKWh,waterL,condensateKg,lightKWh,solarDLI,lightDLI,heatingKWh,coolingKWh,dehuKWh,dehuHeatKWh,unmetSensibleKWh,unmetMoistureKg,energyResidualW,moistureResidualKgS}`. Weather-only classifications are stored in `weatherMode`, `padTempC`, `padDewPointC`, with flags as needed. Numerical/source failures remain invalid and separate from compliance. Step changes alter ideal control dispatch cadence as well as state sampling; they are not merely an ODE solver tolerance.

Current load closure uses `controlledOutdoorAirSensibleKWh` and `latentKg.controlledOutdoorAir`, not parallel ventilation/DOAS terms. Hourly controls expose `controlledOutdoorAirACH`; treatment and core/bypass flow are reported with energy, condensate and unmet conditioning. Combined fans use actual flow. A maximum capacity is not an hourly flow observation.

`metrics.js`: `summarizeHours(hours,scenario)`; `compareScenarios(results)`; `weatherSummary(hours,scenario)`; `sensitivity(scenario,snapshot)` or expose sensitivity via repeated simulate calls. Summary includes expectedHours,validHours,missingHours,compliantHours,compliancePct,electricKWh,fuelKWh,waterL,condensateKg,lightKWh,cost,longestFailureHours,peakCoolingKW,dliDeficitDays,monthly (month,hours,compliantHours,electricKWh,cost),modeCounts, daily. Additional fields allowed. Compare returns rows with id/name/cost/compliance/addedHours/addedCost/costPerAddedHour/dominated. Partial-period costing stays partial; capex displayed separately.

`costBasis` is a structured result contract: period/population, purchased electricity/fuel/water, numeric applied prices, exclusions and no-quote/no-guarantee fields. Full valid-hour annual totals include warm-up; matched comparisons intersect eligible hours and exclude it. `installedCostBasis` distinguishes estimated screening capital from user-entered capital. Attainment differences use pp and both joint-target endpoints, not percent change.

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
