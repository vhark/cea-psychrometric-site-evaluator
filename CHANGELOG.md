# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions are model versions: the string the engine stamps into every result and export, so a number on a page can always be traced to the model that produced it. The `-screening` suffix is part of the version and part of the claim: this is an assumption-based screen, not a calibrated model. See [docs/EVALUATION.md](docs/EVALUATION.md) for the evidence ladder.

## Unreleased

### Changed

- Outdoor-air review now sits directly below **Run all scenarios**, with a checkbox, minimum/maximum airflow, combined fan specific power, evidence basis and **Edit outdoor air** shortcut for each scenario. The summary names outstanding reviews; edits clear only the affected scenario’s review, and invalid inputs still block execution.
- Guided tour, Learn run prompts and current workflow/reference documentation describe the review step. Corrected stale bundled-weather, model-version and weather-schema guidance while retaining historical study evidence.
- Added root and assembled `/app/` browser coverage for review, keyboard focus, scenario selection, invalid-input gates, save/reload, fixture execution, tour targets and narrow layouts.

## [0.4.0-screening] — 2026-09-22

### Added

- Declared water/ice/unknown moisture interpretation shared by imports, providers and calculations; independent published reference vectors and immutable legacy snapshot regressions.
- Separate weather opportunity, installed capability and simulated operation, plus pre-analysis data-quality counts and explicit missing-hour denominators.
- Dedicated weather Worker, IndexedDB v4 metadata/compact indexes, cancellable imports, recoverable storage denial and Blob exports. Provider requests have timeouts, finite retries and bounded date chunks.
- Standalone air-state learning workbench at `/lab/`: pressure-aware chart, SI/IP calculator, four predict/change/explain lessons, named reanalysis examples and historical imports.
- Isolated browser verification at root and assembled `/app/`; Pages deployment depends on passing Node and browser checks. Playwright is a development-only dependency.

### Changed

- Model outputs identify `0.4.0-screening` and `phase-aware-1`. Existing regional/Morris results remain labeled historical `0.3.0-screening`; old weather snapshots are preserved. Reprocessing creates a new child revision.
- Disabled pads and zero-airflow installations receive no capability credit. Hypothetical opportunities and actual equivalent runtime are shown separately.

## Weather foundation — 2026-09-22

### Added

- Weather schema 2 with provider/model/station identity, per-variable evidence and temporal semantics, separate forecast issuance/retrieval clocks, and SHA-256 snapshot IDs. Historical analysis rejects forecast/statistical evidence and future values. Result JSON/CSV/reports retain weather identity.
- Immutable IndexedDB weather revisions and provider-aware request lookup, with non-destructive migration from the legacy cache. Added contract, selection and storage regression tests plus a browser integration harness.
- The arithmetic behind every hour, shown with that hour's own numbers. `src/steps.js` recomputes ten steps from the raw weather row to the weather-side mode (validation, vapour pressures, humidity ratio, dew point and wet bulb and enthalpy and VPD, the local schedule, the moisture band, the pad state, the tests, the mode, outside air as a dehumidifier) plus how the coupled run scored the hour. The hourly inspector shows it under "Show the arithmetic for this hour"; the four per-hour Learn sections follow two real NASA POWER Tulsa hours (`data/weather/sample-hours.json`, with their source requests) through the same steps; `node scripts/worked-example.mjs` prints them. Nothing is stored: every number is recomputed by the functions the screen runs, and `test/steps.test.mjs` asserts the steps agree with the classifier.
- Purchased fuel combustion now counts in CO2 at a scenario factor, `fuelCo2KgPerKWh`, default 0.181 kg CO2 per kWh of fuel (natural gas at 53.06 kg CO2 per MMBtu, EPA GHG Emission Factors Hub). Older scenarios receive the default on migration.
- The weather status line and step 1 of the arithmetic show the source's elevation, because a gridded source reports pressure at its cell rather than the site. Denver's NASA POWER cell sits at 2,095 m against a 1,609 m city, which puts humidity ratio about 5% high there.
- Declared airflow assumptions now state that recovery effectiveness is extrapolated linearly outside the 75% and 100% rating points, and that pad and indirect streams use supply-side air density while plain ventilation uses outdoor density.

### Fixed

- Cached years now match provider, model, station, exact coordinates and time zone. NCEI automatic station selection is pinned across annual requests, and multi-year Visual Crossing retrieval receives the provider key.
- Visual Crossing preserves hourly source codes rather than inferring modeled data from absent stations. Hourly solar energy supplies mean irradiance; instantaneous radiation fallback is identified explicitly. Derived humidity/pressure metadata is retained.
- Manual coordinate/timezone edits now update scenario validation so restored weather can run at the entered site.
- Dateless weather imports infer calendar dates in the declared time zone, allowing repeat normalization and cache/export round trips. Superseded weather requests cannot overwrite a newer accepted snapshot after hashing.
- Open-Meteo reports shortwave radiation as the mean of the preceding hour, while NASA POWER stamps the hour it covers. The Open-Meteo adapter filed both at the stamp, so its solar arrived one hour late against the same hour's temperature. Radiation is now filed one hour earlier; instant fields are unchanged.
- A weather CSV was labelled UTC and that label became the site's zone on import. The import now takes the zone from the site controls and refuses to proceed without one.
- The NCEI request ended at UTC midnight of the last local day, so every year on a western-hemisphere clock lost its last four to ten hours as false station gaps. The request now runs one UTC day past the end date; the local grid still stops where it did.
- A weather snapshot without a declared time zone was read as UTC, and that label was then adopted as the site's zone on import. `normalizeWeather` now refuses it and says why; the CSV path still labels its UTC-stamped hours as UTC explicitly.
- The IEM adapter filled a missing altimeter reading with a standard-atmosphere pressure at station elevation. Missing stays missing: the hour is now flagged `station-pressure-unavailable-no-valid-altimeter` and left without a pressure.
- Coverage counted only hours with relative humidity, although an hour carried by dew point alone is valid weather. Both now count.
- The browser weather cache key includes the site time zone, so the same calendar year on two clocks no longer overwrites one slot.
- `heatPumpElectricKWh` reported only the zone heater's share of heat-pump electricity; recovery preheat and DOAS external heat drawn through the same heat pump were priced correctly but left out of this figure. All three are now in it.
- DOAS condenser heat not recovered as reheat is now booked to rejected heat, where DX and dehumidifier condenser heat already were.
- The one-at-a-time pad-effectiveness cases were fixed at 0.7 and 0.9 regardless of the scenario; they are now the scenario's value minus and plus 0.1, clamped to 0 to 1.
- A run in state price mode carried a cost basis naming the state proxy before the energy context had been applied; the basis now names the provisional scenario price until `applyEnergyContext` replaces it.
- The six fixture weeks carried coverage blocks copied from full years (8,760 h); they now state their own 168 h.
- README, WORKFLOW, the docs index and the Learn prompts described bundled year chips that load without a network call; no hourly weather ships, and the copy now says what the chips actually list.

- `range()` no longer defaults to `America/Chicago` when a caller omits the time zone. It converts local calendar dates into UTC instants, so an assumed zone corrupts the request itself rather than just mislabelling the result. This was the last place in the codebase that guessed a zone, and it is the same defect that first surfaced as a Boulder run reporting Tulsa time. A fetch without a valid IANA zone now fails and says why.
- A weather year cached under one time zone is no longer offered to a site on another. A calendar year is bounded by local days, so the same year on two clocks covers different UTC hours. `yearSources` matched cached years on coordinates alone, which left a returning user stuck: the run refused the mismatched year, and `retrieveYears` skips any year that function reports as available, so the one action that would have fixed it was blocked too. It now matches the time zone as well, so a mismatched year reads as missing and can simply be retrieved again. Changing the time zone also refreshes the year list, which it previously did not, and the guard that catches this at run time now names the control to use.


### Added

- Visual Crossing as a fifth weather source, and the first needing a key, which finally exercises the key field end to end. It is the only source here returning all six values in one request over about fifty years. Two things make it usable honestly. Its `pressure` is sea-level pressure, which their own documentation defines as removing the altitude reduction, and at 1,655 m that runs about 22 percent above real station pressure; since humidity ratio follows pressure, passing it through would corrupt every moisture figure, so the adapter reduces it using site elevation from Open-Meteo's keyless elevation service and flags each hour as derived. And the service blends observations with model output with no per-hour flag saying which, so the adapter records the contributing stations it does publish and marks an hour naming none as modelled. Both facts are in the source's "Costs you" list rather than buried.
- NOAA NCEI's Integrated Surface Database as a fourth weather source, keyless and public domain. It is the archive the IEM feed here is derived from, and unlike that feed it keeps the per-value quality flag: a temperature whose own ISD flag rejects it stays missing rather than entering the run. Leave the station box empty and the nearest station reporting in your period is found from your coordinates, then named with its distance and elevation. For ZIP 80301 that is Boulder Municipal Airport, 2 km away at 1,612 m, against 1,589 m for the ERA5 cell and 1,801 m for the NASA POWER cell. Solar still comes from NASA POWER, the same split the IEM source uses.
- Open-Meteo's ERA5 archive as a selectable weather source, and a source picker that states what each one is worth. Temperature, humidity and dew point arrive on ERA5-Land's 0.1 degree grid, about 9 km, against NASA POWER's 0.5 by 0.625 degrees; pressure, solar and wind come from ERA5 at 0.25 degrees. The adapter requests both models by name rather than letting the service blend them, so every hour records which model supplied each field. A whole year is one 411 KB request taking about two seconds, against three chunked requests for NASA POWER, and the archive reaches back to 1940 where POWER starts in 2001. At Boulder the ERA5 cell reports 1,589 m against POWER's 1,801 m for a city at about 1,655 m, which matters because station pressure follows elevation and humidity ratio follows pressure.
- A weather source comparison panel built from `src/providers.js`, listing each source's grid, coverage, cadence, licence, limits, and at least two honest entries under both "Good for" and "Costs you". A test refuses a source that states no costs, because a source with no stated cost is a sales pitch. Adding a source is now a data change, and another test fails if the picker and the adapters ever name different sets.
- An API key field that appears only for a source that needs one. A key stays in this browser under a per-provider storage key, is sent only to that provider, and is stripped from every recorded URL by `redactSecrets` before it can reach an export or the weather cache. None of the three sources shipped today needs a key, so that path is built and guarded but not yet exercised by a real provider.

### Fixed

- A ZIP now proposes its own time zone instead of its state's. Fourteen states span two zones, so the state-level guess put 1,303 US ZIPs on the wrong clock: El Paso read Central, Pensacola read Eastern, Knoxville read Central, and Tuba City read Phoenix rather than keeping the daylight saving the Navajo Nation observes inside an Arizona that does not. `data/us-zip-timezones.json` is a 13 KB run-length table built by `scripts/build-zip-timezones.mjs` from the GeoNames gazetteer, the same publisher and CC BY 4.0 licence as the postal inventory already shipped. Scored against tz-database boundaries it puts 99.50% of ZIPs on the right clock, against 96.82% before, removing 1,098 wrong proposals. The remaining 205 sit on state and county lines. A ZIP the table does not carry still falls back to the state guess and says which one it used. Both remain proposals the user confirms.
- The station observation provider was broken. `requestIem`, the queue that paces IEM requests, sat between the bundled-archive loaders and `fetchObserved`, and removing those loaders took it with them. Selecting "Station observations" threw `ReferenceError: requestIem is not defined`. No test covered `fetchObserved`, so nothing caught it and it reached the deployed site. Restored, and `test/data.test.mjs` now drives the whole station path against stubbed responses; deleting the helper again fails that test.
- Observation snapshots now report the elevation gap between the chosen station and the gridded cell your coordinates fall in, not only the horizontal distance. Station pressure follows elevation and humidity ratio follows pressure, so an elevation gap biases every moisture figure while a purely horizontal one may not. NASA POWER returns the cell elevation in its GeoJSON geometry and this was being discarded; it is now carried on every snapshot as `sourceElevationM`. Retrieving Boulder against Tulsa International reports 921 km and 1,595 m.

- Locate now proposes the IANA time zone for the primary ZIP. The public ZIP catalog has no time zone column, so `locate()` left the field at its Tulsa default and a Boulder, Colorado run was reported, charted and exported in `America/Chicago`: local days, local hours, photoperiod and every daily metric were built on the wrong civil clock. The state proposal and split-zone flag that comparison sites already used moved to `energy.js` beside `lookupZip`, and both paths now share it. A proposal is not a record: the zone stays editable and the location line names the state it came from, with an explicit warning for states that span two zones or skip daylight saving.
- IEM observation snapshots now state the great-circle separation between the chosen station and the requested coordinates, and warn above 100 km. The station identifier is deliberately not moved with the ZIP, but nothing reported the consequence, so a Boulder ZIP retrieved with the default TUL station returned Tulsa observations 923 km away with no visible signal.

### Added

- Eight definitions that were written but wired to nothing are now reachable, and 15 fields that fell back to a bare unit definition have their own. "DOAS supply dew point" explained Celsius; it now explains dew point. Definitions total 44, of which 21 name the `docs/GLOSSARY.md` section carrying the exact computation, and a test fails if one of those headings is renamed. Nothing in `src/terms.js` can now be unreachable without failing the suite.

- Info bubbles on 61 inputs and result metrics. Every field label and headline number carries a definition one click away: what the thing is, what its unit means in ordinary terms, and what to do with it. The definitions live in `src/terms.js` and attach at two choke points, `fieldControl` for scenario inputs and `metric` for results, so a new field gets one by declaring a term key rather than by editing markup. A label can also opt in from static HTML with `data-term`. Built on the native popover API, so dismissal, the Escape key and the top layer are the browser's job and not ours. `docs/GLOSSARY.md` remains the precise reference with the function that computes each term; the bubbles are the doorway to it.

### Changed

- On-screen copy rewritten for a reader who has never read a psychrometric chart. The help text under every panel, the weather and location status messages and the result metric names now say what they mean in ordinary words. "Classified weather" is "Hours the weather could be read", "Valid source/model hours" is "Usable hours of weather", and "Dry-bulb versus dew point" explains what it is plotting. No metric definition changed, only what it is called and how it is explained.

### Removed

- The committed hourly weather archive: 180 raw NASA POWER responses, 60 site-year snapshots and the observed station snapshot, about 126 MB. The tool retrieves weather per ZIP at run time, so an archive of six particular sites was only ever the offline demo path. What the archive was used to compute is kept in full: `docs/CLIMATES.md`, `docs/REGIONS.md`, `docs/regional-study.json`, `docs/morris-screening.json` and the reference study all stand. `data/weather/index.json` is now a climate reference registry rather than a file manifest, `scripts/regional-study.mjs` and `scripts/morris-screening.mjs` refuse to run with the exact fetch command needed to restore their inputs, and `test/fixtures/` holds one committed week per site, 144 KB, so every shipped example is still exercised against a real record. The tracked payload drops from 225 MB to 19 MB.
- The bundled-weather code path with it: `loadBundledIndex`, `loadBundledYear` and the `bundled` weather-year source. Weather years now come from what you retrieve, which this browser caches.
- The reference study's hour-by-hour working, `ktul_2026_psychrometric_operating_hours.csv`, 5.5 MB that nothing read except the generator that wrote it. Its findings all stay: both reports, the mode summary, the monthly percentiles, the episodes, the daily exposure, the sensitivity cases and the NOAA cross-check. Rebuilding it takes `node scripts/fetch-observed.mjs` then `node scripts/reference-study.mjs`, which the study README now spells out. The ZIP and energy catalogs stay committed because the browser loads them from this origin at page load and no keyless public API can serve them at run time.

- No default site. `DEFAULT_SCENARIO` carried Tulsa's ZIP, coordinates and `America/Chicago`, the ZIP, coordinate, time-zone and station fields shipped filled in with them, and the bundled Tulsa 2025 year loaded automatically on first visit. A new scenario now has `zip`, `latitude`, `longitude` and `timezone` all null and reports both a missing site and a missing time zone until the user locates it; the form fields are empty; nothing loads until weather is retrieved. `loadExample()` and the auto-load path are deleted. Blank coordinates are treated as unlocated rather than as 0,0, so an unlocated site offers no weather years.
- The `TUL` fallback in the IEM adapter. A station is now required and named per site, because a carried-over default returns another location's observations under these coordinates.
- `--site` is required by `scripts/fetch-weather.py`; it no longer defaults to Tulsa.

### Changed

- Tulsa is no longer the worked example. It remains one of six bundled climate archetypes with its ten NASA POWER years, and every figure computed at Tulsa keeps saying so. The reference study (KTUL 2026), the canonical browser run, the Morris screen and the regional study are provenance, and renaming where a number came from would falsify it. What changed is the privilege: the default site, the auto-loaded year, the "worked example" climate label and the Tulsa-sited example library.
- The shipped example sets moved off Tulsa to the bundled climate that makes each one's design question sharpest, chosen by which climate actually separates the compared strategies: decoupling-study to Denver, indoor-microgreen-racks and mushroom-room to Miami, propagation-nursery and hybrid-tomato to Seattle, crop-bands and screens-and-heat-source to Phoenix. mushroom-room reads 0.0% for every strategy at five of the six sites and only demonstrates anything in a hot-humid record. `docs/example-scenarios.json` stays at Tulsa because the published canonical figures were computed there.
- `test/examples.test.mjs` runs each shipped example against its own site's bundled week instead of one shared Tulsa week, and fails an example sited where no bundled record exists. Test fixtures that silently inherited Tulsa's coordinates now state a neutral fixture site.
- Replaced the One Season Farmers visual identity with the Grownetics brand system (brand.grownetics.com) across the app, exported documents, the reference-study generator, the public site, favicon and social artwork. Interactive surfaces use Instrument mode (deep-soil ground, phosphor data, DM Sans display, Inter body, IBM Plex Mono data); documents and the landing page use Archive mode (parchment, charcoal ink, gold catalog labels). The locked monochrome Grownetics logomark replaces the four-season pinwheel everywhere, embedded from `src/brand.js` in generated documents. Reference-study and example documents are regenerated and every site screenshot recaptured. No model, schema, validation range or numerical result changed.

### Added

- High-light fixture presets under Crop targets & lighting: LED 650 W and HPS 1000 W, each over a declared 16 ft² (4 × 4 ft) footprint. Selecting a preset sets installed fixture power (40.6 or 62.5 W/ft²) and an editable screening photon efficacy; any other value reads as a custom preset. Installed fixture power also accepts direct W/ft² entry alongside the SI field, and the validated range now reaches 1000 W/m².

### Removed

- The "Load Tulsa 2025 example" button. The bundled Tulsa 2025 record already loads automatically on first visit and through the weather-year chips, so the button was a second path to the same state. Tour, Learn and README instructions now reference the automatic load and the year chips.

## [0.3.0-screening] - 2026-09-15

### Changed

- Scenario and run-bundle schema 2 with `migrateScenario`, explicit outside-air basis/review, inert recovery migration and saved-result invalidation. Legacy airflow values are preserved for review rather than silently resized. Active legacy DOAS imports require new performance inputs; `doasKWhPerKg` is removed. Weather snapshots remain schema 1.
- Uncontrolled infiltration, controlled outside-air capacity, actual commanded/delivered flow and internal recirculation are distinguished. Internal circulation and wind/stack natural ventilation remain unmodeled. ACH conversions include floor area and mean height, m³/s, m³/s per m², cfm and cfm/ft².
- Controlled air is one stream: optional HRV/ERV recovery or bypass, optional DOAS conditioning, then zone entry. No treatment adds ventilation a second time. Current hourly/load contracts use controlled-outdoor-air fields, not parallel ventilation/DOAS aliases.
- Outside-air context carries literature-range, adjacent-proxy, project-input or screening-assumption status. Construction-specific UGA/Shamshiri guidance is not a universal validation limit. The one-room 0.18 ACH proxy is correctly attributed to Shao. Mushroom minimum/maximum start incomplete and require project input/review, not a universal 6 to 15 ACH preset.
- Operating-cost labels now retain simulated period/population, purchased electricity/heating fuel/water, applied numeric prices and exclusions. Capital is separately estimated or user-entered. Modeled differences/reductions are not quotes or guaranteed savings. Joint-attainment differences use percentage points (pp) with both endpoints, not generic points or relative percent change.
- One Season Farmers visual identity: Instrument for interactive tools, Field by default for reports regardless of OS theme. Shared presentation helpers render cost, airflow and conditioning evidence consistently.
- Reconciled maintained documentation and the public landing page with current model evidence. Historical audits, plans and numerical findings are explicitly dated or superseded. The Field-branded site uses genuine current screenshots and social assets; deployment no longer overwrites them with historical documentation screenshots.

### Added

- Balanced HRV/ERV rating inputs at 75% and 100% nominal airflow, active only in the supported 50% to 130% flow domain. Low flow bypasses; excess above 130% mixes as explicit bypass. HRV latent effectiveness is zero, ERV requires latent ratings, and no generic product performance is inferred.
- Explicit recovery frost strategies: qualified minimum operating temperature, exhaust-only bypass/defrost, or finite preheat. Economizer/pad bypass, core energy transfer, auxiliary power and unmet preheat remain visible.
- DOAS moist-air enthalpy/COP cooling, condensate, bounded recovered reheat, finite external heating and unmet conditioning. Shared heating priority is preheat, DOAS external heat, then zone heating. Actual controlled flow drives combined supply/exhaust fan input.
- Learn curriculum and six-site, ten-year study with explicit methodological 5 pp capability and 16% operating-cost bands. These retained rules are not calibrated uncertainty thresholds.
- Movable shade/thermal curtains, declared insect-screen ventilation factors, heat-pump rating/cutoff inputs and envelope evidence. Unsupported component performance remains incomplete rather than inventing ratings. Standalone dehumidifier heat-return fraction is a static declared topology, not a modulating controller.
- Schema-2 example library with explicit airflow review, source applicability and current evidence limits. Dataset vintage tooling remains separate from numerical model validity.

### Fixed and withdrawn

- **Withdrawn: the old $39,517 DOAS result and every derived operating-cost reduction.** The prior calculation omitted sensible supply-conditioning energy. Earlier library DOAS results, class/capacity rankings and hybrid-close-up savings are not current evidence. No general recommendation to close a hybrid remains.
- Corrected the opaque 2 ACH description: it is installed controlled-air capacity, separate from infiltration. A 6 ACH case is a modeled capacity experiment, not a recommended ventilation rate; 15 ACH describes constrained semi-closed operation, not a conventional open greenhouse. Discrete airflow ladders remain resolution-limited, not continuous economizer optimization.
- Screen tests now explicitly review the sealed heat-pump fixture's zero controlled flow/fan power and close moisture with the one-stream `controlledOutdoorAir` term. No physical assertion or tolerance was weakened; focused screen suite passes 12/12.
- Removed the unused `backfillScenario` wrapper after caller cutover. Corrected stale Learn/report/tour evidence text and the sensitivity infiltration rationale without changing physical equations or numerical results.
- Previously completed lighting delivery, import-worker, load-chart, time-zone, mobile-header and report-print fixes remain part of this release. Historical measured values in older entries below belong to those versions, not this release.

### Regenerated evidence

- Actual browser export: Tulsa 2025, six strategies, 8,760 valid hours and 8,759 common eligible hours, zero numerical-failure hours. Full annual operating cost includes warm-up; matched-period comparison cost excludes it. Current values/hashes are in `docs/browser-run-metrics.json`.
- Regional study: 360 full-year simulations, zero numerical-failure hours. Artifact envelope 1 remains Learn-compatible; scenarios are schema 2. Morris: envelope 2, 1,872 simulations, 104 design points, zero numerical-failure hours. Aggregate joint-attainment mu* is LAI/transpiration 9.098627 pp and maximum controlled-air capacity 2.164460 pp per full screened range, not a confidence bound.
- Observed Tulsa reference documents regenerated with the actual generator, retaining weather-side opportunity scope and archived partial-year coverage, not indoor simulation.
- Final source integration at `686d876`: `npm test` passed 157/157 with zero failures or skips; ten `node --check` commands succeeded. Actual Chromium verified saved schema-1 migration, unsupported-entry isolation, schema-2 saving, retained HRV/DOAS inputs, frost blocking and a conditioned Tulsa 2025 run with zero numerical-failure hours. Exact scope is recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).
- Publication check: 157/157 tests passed after documentation/site reconciliation and the curtain evidence-text correction. Checked local paths and section anchors in 25 maintained Markdown documents. Actual Chromium verified the assembled site and `/app/` links, loaded gallery assets, and no page overflow at 390, 820 and 1440 pixels; the public site remains Field under an OS-dark preference.

## [0.2.0-screening] - 2026-09-13

Site-evaluator release: from a single-year Tulsa demonstration to a tool that evaluates a site.

### Added

- **Multi-year climate risk.** Ten bundled Tulsa NASA POWER years (2016 to 2025, complete coverage each), with median, worst, best, spread and trend per strategy, and a computed ranking-stability verdict instead of a prose disclaimer.
- **Multi-site comparison** by ZIP, with an explicit site time-zone field, a state-derived proposal, IANA validation and a split-zone or no-daylight-saving warning for the 14 affected states.
- **Sensible and latent load decomposition** with space sensible heat ratio, monthly rollup and an SHR histogram.
- **CO2 enrichment window**: hours per strategy in which ventilation stays at minimum and evaporative stages are off, plus the weather-side counterpart.
- **Outside-air dehumidification screen**: removal potential, cost per kg and energy per kg for ventilation against a condensing unit.
- **Equipment runtime and pad viability**: hours with use, equivalent full-load hours and days with use per component, beside the weather-only pad screen.
- **Cost-of-precision sweeps** over temperature tolerance, VPD band, dew-point cap and photoperiod start.
- **Design-basis brief**: a printable export for the engineer of record, with peak sensible and latent hours, coincident outdoor state and frequency, ventilation air requirement, condensate, pad water, free-cooling hours, binding constraint, strategy verdict and evidence tier.
- **Morris elementary-effects screening** (roadmap M3): `src/sensitivity.js`, `scripts/morris-screening.mjs` and the committed 1,872-simulation run behind [docs/SENSITIVITY.md](docs/SENSITIVITY.md).
- Six closed-form conservation identities as regression tests (audit item 2): pad water balance, indirect-evaporation secondary stream, humidifier latent cooling, free-running thermal-mass and infiltration trajectory against the analytic exponential, DX coil and condenser identities, and dominance behaviour for disjoint eligible sets and failed runs. All close between 1e-16 and 5e-13 relative.

### Changed

- **Default controller is now a staged deadband model** (per-device hysteresis, minimum on and off times, ordered stages). Measured on the full Tulsa 2025 year, 1 minute against 0.5 minute dispatch: 0.004, 0.383 and 0.091 pp attainment and at most 0.31% electricity, which clears the EVALUATION §4 gates and closes roadmap M1. The previous per-substep optimizer remains selectable as a labeled "ideal modulation upper bound"; it still does not converge (1.5 pp attainment, 1.95% electricity) and is 1.7 to 8 times slower.
- **Crop moisture defaults to Stanghellini transpiration** driven by leaf area, absorbed radiation and zone VPD (roadmap M2). The fixed L/m²/day schedule is retained as a fallback. Canopy temperature equals air temperature and there is no CO2 feedback, both declared in the run assumptions.
- Imports parse in a Web Worker with staged progress. The misleading fixed 512 MB file-size limit is replaced by an honest statement that the ceiling is the memory the tab can allocate, with the weather-epoch re-check now covering CSV and bare weather JSON as well as run bundles.
- Timeline heatmap cells carry a shape as well as a colour, with a keyboard-reachable day-by-hour table rendered from the same rows. A full year draws in about 7 ms.
- Hour inspector announces politely (`aria-valuetext` plus one debounced status line) from both calendar and table selection.

### Fixed

- `simulateScenario` did not back-fill v0.2 keys, so a schemaVersion 1 scenario reaching the engine without a prior `validateScenario` call threw out of PsychroLib. Back-filled at the physics entry point on a copy, with a regression asserting the caller's object is not mutated.
- `renderLoads` stacked positive sensible terms only, so every loss was invisible and a 44 MWh January envelope loss did not appear at all. Losses now draw below the axis.
- Multi-site comparison could never resolve a time zone, because the public ZIP catalog has no time-zone column. Fixed by the explicit site time-zone field described above.

## [0.1.0-screening] - 2026-09-11

Initial static implementation.

### Added

- Six equipment strategies: pad and vent, pad plus dehumidification, DX plus dehumidification, integrated HVAC with reheat, desiccant with evaporative cooling, and a generic liquid-desiccant hybrid.
- Coupled single-zone sensible and moisture model with finite equipment capacity, one-minute internal control steps, analytic linear exchange and physical equilibrium condensation.
- Editable facility, crop and light assumptions, every default labeled with its source.
- Historical weather: NASA POWER retrieval with original payloads retained, IEM station observations with independently sourced solar, CSV and JSON import, and the bundled genuine Tulsa 2025 year.
- National public ZIP, utility, electricity price and grid catalogs with explicit coverage, vintages and unknowns.
- Scenario comparison and sensitivity cases on a common eligible hour set, with dominance and capital shown separately from operating cost.
- Portable exports: scenario JSON, full run JSON, hourly CSV and a standalone printable report.
- The separate observed Tulsa weather-only reference study and the next-iteration calibrated-twin plan.

### Fixed

Verification before release corrected: stacked-canopy photon allocation (stacking could create photons), local-day and DST accounting on fractional UTC offsets, frost-point against canonical RH handling, opaque-indoor solar eligibility, imported and cached site association, portable schema-version rejection, manual-price provenance labelling, and a mobile comparison-grid overflow.

### Notes

No public production deployment was claimed at this release, and no measured-site validation was performed.

[0.3.0-screening]: https://github.com/vhark/cea-psychrometric-site-evaluator/compare/v0.2.0...HEAD
[0.2.0-screening]: https://github.com/vhark/cea-psychrometric-site-evaluator/releases/tag/v0.2.0
[0.1.0-screening]: https://github.com/vhark/cea-psychrometric-site-evaluator/releases/tag/v0.1.0
