# CEA Psychrometric Site Evaluator: executed verification

Purpose: distinguish current executed evidence from historical development checks and unverified claims.

Status: model `0.4.0-screening`, scenario and weather schema 2, updated 2026-09-22. Dated records retain their original model and scope. No independent model benchmark, measured-site calibration or manufacturer validation is claimed.

## Scenario review beside Run all scenarios — 2026-09-22

- `npm test`: **245 passed**, zero failures, skips or cancellations.
- `BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser`: passed at root and assembled `/_site/app`. This uses installed Chrome because the default Playwright browser binary is not installed in this environment.
- `scripts/review-browser-checks.mjs` exercises per-scenario review, displayed airflow, independent review reset, invalid-flow gating, keyboard focus, Edit outdoor air selection/focus, save/reload, completed review in exported JSON, rejection of scenario export after review is revoked, and a completed two-hour synthetic fixture run. It checks the new tour target and all existing target IDs, plus placement and overflow at 1280 px and 390 px. Existing storage, worker lifecycle, workbench, import, request-race, station-pinning and storage-denial browser checks also pass.
- Desktop and phone screenshots inspected; checkbox labels, values and edit actions fit their review panel. Source syntax and `git diff --check` pass. Independent read-only code review found no blocking issue.
- This is UI regression evidence. The synthetic fixture establishes interaction and worker completion, not scientific accuracy; no historical study was regenerated for this placement change.

## Historical state, 2026-09-15

| Check | Executed evidence and scope |
|---|---|
| Release identity | Model `0.3.0-screening`, scenario/run schema 2; weather schema 1 |
| Browser run | Actual Chromium loaded Tulsa 2025, imported canonical schema-2 scenarios, ran six strategies and downloaded JSON, hourly CSV, printable report and design-basis brief. [browser-run-metrics.json](browser-run-metrics.json) retains metrics, hashes and visual checks |
| Browser numerical coverage | All six strategies: 8,760 valid hours, 8,759 eligible hours, one warm-up, zero missing or numerical-failure hours |
| Focused model/data/export checks in browser artifact | 121 passed, zero failed, command and date retained in artifact; this is not the whole suite |
| Screen-fixture cutover | `node --test test/screens.test.mjs`: 12 passed, zero failed after schema-2 review and one-stream moisture closure correction. Heat-pump fixtures explicitly review zero controlled air/fan power; conservation bounds are unchanged |
| Focused post-cleanup contracts | `node --test test/data.test.mjs test/examples.test.mjs test/sensitivity.test.mjs test/regional.test.mjs`: 36 passed, zero failed, including real-weather example runs and current artifact schema/cost contracts |
| Source syntax | Ten successful `node --check` commands at `686d876`: `src/airflow.js`, `src/config.js`, `src/simulate.js`, `src/metrics.js`, `src/export.js`, `src/report.js`, `src/app.js`, `scripts/regional-study.mjs`, `scripts/morris-screening.mjs`, `scripts/reference-study.mjs` |
| Full integration suite | Integrating parent executed `npm test` at source commit `686d876`: **157 tests, 157 pass, zero failures or skips**, 10.47 s. This supersedes the earlier 154/157 run and its three repaired screen-fixture failures |
| Saved-schema migration smoke | Actual Chromium seeded localStorage with a valid schema-1 `greenhouseGlass` scenario plus unsupported schema 999. Reload retained/migrated the valid entry, skipped the unsupported entry with a warning, and saved the editable scenario as schema 2. Original localStorage was restored afterward |
| Conditioned-air browser smoke | HRV nominal 4 m³/s, auxiliary 50 W and sensible heating 75%/100% ratings 0.8/0.7 plus cooling ratings 0.75/0.65; DOAS 1 m³/s, dew point 10 °C, supply 18 °C, COP 3, reheat fraction 0.5. Inputs survived worker submission/result unchanged. Qualified no-frost minimum −10 °C blocked colder weather; switching to declared preheat threshold −5 °C completed the full Tulsa 2025 run with zero numerical-failure hours. These are smoke-test inputs, not product ratings or recommended settings |
| Regional regeneration | `node scripts/regional-study.mjs`: 360 full-year simulations, zero numerical-failure hours; artifact envelope 1 with scenario schema 2, compatible with Learn; 220 s recorded |
| Morris regeneration | `node scripts/morris-screening.mjs`: 1,872 simulations, 104 design points, zero numerical-failure hours; envelope 2, scenario schema 2; 418.7 s recorded |
| Current Morris influence | Aggregate joint-attainment mu* LAI/transpiration 9.098627 pp per full screened range; maximum controlled-air capacity 2.164460 pp. Not a probability bound or threshold calibration |
| Regional decision rules | Retained 5 pp joint-attainment tier and 16% operating-cost band; three unresolved regions, Phoenix/Denver/Seattle. Rules are methodological, not newly calibrated by Morris |

### Actual browser metrics and populations

Source: [browser-run-metrics.json](browser-run-metrics.json). Staged controller, one-minute dispatch, Stanghellini crop model, Tulsa calendar 2025. Attainment is joint temperature-and-moisture target attainment on the 8,759 eligible hours. Annual operating cost covers **all 8,760 valid hours**, including warm-up; matched cost covers **8,759 common eligible hours** and is not the full annual total.

Operating costs include purchased electricity, purchased heating fuel and water represented by the scenario, using manual $0.12/kWh electricity, $0.045/kWh fuel and $0.002/L water. Excluded: installed capital, maintenance, labor, financing, taxes, demand charges, fixed charges, time-of-use effects and other unmodeled tariff components. Estimated or user-entered installed capital is separate. No modeled cost, difference or reduction is an equipment quote or guaranteed savings.

| Strategy | Joint attainment % | Model-estimated annual operating cost USD, 8,760 h | Model-estimated matched-period operating cost USD, 8,759 h |
|---|---:|---:|---:|
| Pad + vent baseline | 27.135 | 22,064.29 | 22,060.97 |
| Pads + condensing dehumidifier | 41.638 | 28,493.30 | 28,489.98 |
| DX / mini-split + dehumidifier | 73.066 | 39,915.37 | 39,912.06 |
| Integrated HVAC + reheat | 55.297 | 47,201.10 | 47,196.78 |
| Desiccant + evaporative cooling | 51.875 | 33,827.30 | 33,823.78 |
| Liquid-desiccant hybrid (generic) | 52.619 | 47,332.88 | 47,328.69 |

Pad baseline to DX/dehumidifier increases joint attainment from 27.135% to 73.066%, **45.931 percentage points (pp)**. This is a difference of percentages, not a relative percent improvement. Other comparisons must likewise retain both endpoints and the same eligible population. A Morris mu* has no single pair of endpoints: it is an average normalized absolute elementary effect.

### Claims withdrawn and historical limits

The old **$39,517 DOAS result and all derived reductions are withdrawn**, because sensible conditioning energy was omitted. The old class ladder, DOAS library results, hybrid-close-up savings and related capacity recommendations are not current-model evidence. No new opaque/DOAS/class ranking is inferred from the canonical greenhouse artifacts. A 6 ACH case is modeled capacity, not a recommended rate; 15 ACH is constrained semi-closed operation, not conventional open-greenhouse capacity. The opaque 2 ACH maximum is controlled air, separate from infiltration. Mushroom airflow is project-specific and internal circulation is unmodeled.

Historical cadence checks below are explicitly old-model development evidence. Their convergence figures are not a new model-0.3.0 tolerance claim. Discrete staged and ideal airflow ladders remain resolution-limited; no continuous economizer optimum is claimed. Current conservation and air-treatment tests defend the one-stream balance, finite source priority, complete performance/review gates and reported unmet conditioning, not real-world calibration.

`node scripts/reference-study.mjs` regenerated the observed reference study during this release: 6,087 expected hours, 6,064 valid, 23 missing, 251 NOAA daily records and 16 sensitivity cases. All eight CSVs were hash-compared: seven are unchanged; the hourly psychrometric CSV changes only secondary flags in 2,928 rows to reflect the current independent pad/vent opportunity classifier. Numeric fields, primary modes and row counts are unchanged. The report remains weather-side opportunity analysis, not indoor simulation. Actual Chromium inspection under emulated dark OS confirmed Field ground `#F7FAF6` and no horizontal overflow. See [../reference-study/manifest.json](../reference-study/manifest.json) for source provenance. Interactive tools use Instrument.

## Historical 0.1.0 and 0.2.0 development records (2026-09-11 to 2026-09-14)

The remaining sections preserve what was observed at those dates. Old figures, brand names, test counts, APIs and deployment statements describe those versions only. Refer to the current-state table above for model 0.3.0. Links to regenerated artifact paths now resolve to current outputs, not immutable copies of these historical runs.

## Result and evidence tier

The static application runs end to end with actual historical data, finite-capacity component calculations, national ZIP energy context, comparisons, sensitivities and portable exports. It is an **assumption-based coarse component screen**, not an independently benchmarked or calibrated greenhouse digital twin.

**Material precision limit (superseded 2026-09-13, retained for the record):** changing the ideal controller cadence from one minute to half a minute in the seasonal samples changed joint climate attainment by as much as 4.1 percentage points and electricity by 23.5%. These are observed sample differences, not universal error bounds or statistical confidence intervals. A tighter hot-period sample alone was not sufficient evidence of broad convergence. This limit was a property of the ideal per-substep optimizer, which is now a selectable labeled upper bound rather than the default; the staged deadband controller that replaced it converges, as measured in the v0.2 section below. Close cost rankings remain exploratory for the separate reason recorded in [SENSITIVITY.md](SENSITIVITY.md): the ranking is unstable under the screened parameter ranges.

Final seasonal evidence is in [seasonal-step-check.json](seasonal-step-check.json). Earlier tuning experiments are retained in step-sensitivity.json and step-refinement.json as historical development evidence, not final accuracy claims. Conservation residuals below do not remove this control-model uncertainty.

## Executed commands

From `calc v1.0/`:

```sh
npm test
node --check src/app.js
node --check scripts/fetch-observed.mjs
node scripts/reference-study.mjs
```

- Final regression run: **26 passed, 0 failed** (22 at the 09-11 release; four added in the 09-12 audit).
- Syntax checks succeeded.
- Reference-study regeneration succeeded with 6,087 expected hours, 6,064 valid observed hours, 23 missing hours, 251 NOAA daily records and 16 sensitivity cases.
- The new observation acquisition script was syntax-checked; its underlying real IEM/NASA adapters and the archived NOAA acquisition were exercised separately. A fresh full network acquisition was not substituted for the archived reference cutoff during final verification.
- Separately ran the client's unchanged load-calculator suite (a client artifact outside this repository) as source-audit evidence. A passing regression suite there is not evidence of thermal accuracy; the findings are recorded in the private engagement audit. No client source was changed.

Meaningful regression boundaries include finite cooling, crop evaporation and dehumidifier heat, desiccant regeneration, pad enthalpy, footprint-limited photons on stacked canopy, opaque indoor solar eligibility, dark-period moisture, gap resets, canonical RH vs auxiliary frost point, DST, fractional-offset local-day DLI, partial-day cutoff, manual/missing/calendar-month prices and unknown portable schema versions. Photon allocation, fractional-offset DLI, opaque-indoor eligibility and future bundle-version cases were observed failing before their corresponding fixes.

## Full-year browser calculation

A real browser loaded the bundled NASA POWER Tulsa 2025 snapshot and ran six strategies through the Web Worker: pad/vent, pad plus dehumidification, DX plus dehumidification, integrated HVAC/reheat, desiccant/evaporative, and generic liquid-desiccant hybrid.

- Each strategy: **8,760 valid hours**, no missing or numerical-failure hours.
- Each strategy: **8,759 eligible comparison hours**, one explicitly excluded initial warm-up hour.
- All six exported assumptions identify one-minute control steps and the pinned PsychroLib 2.5.0 commit.
- Largest reported hourly sensible-energy residual: approximately **9.13 × 10⁻⁹ W**.
- Largest reported moisture residual: approximately **3.87 × 10⁻¹⁶ kg/s**.
- Correct shared location: ZIP 74103, Tulsa coordinates, America/Chicago; Oklahoma public energy context. These example scenarios deliberately use manual electricity prices, not the available state-price series.

At the time, compact metrics, export hashes and the example report were retained from this browser run. Those paths have since been regenerated for model 0.3.0: [browser-run-metrics.json](browser-run-metrics.json), [example-comparison.html](example-comparison.html) and [example-scenarios.json](example-scenarios.json) now contain current evidence and must not be cited as the archived bytes of the 0.1.0 run.

Individual result totals cover valid hours including warm-up energy. Comparative costs use the common eligible set, so their dollar totals differ slightly. Annual capital recovery plus maintenance is displayed separately from historical-period operating cost. No partial-period weather-dependent cost is annualized.

## Browser and portability checks

Served the real folder with Python's static HTTP server on `127.0.0.1:8150`; no build server or application backend.

Executed in the actual interface:

- Leading-zero ZIP 00501, New York 10001, Tulsa 74103, Puerto Rico 00901, Hawaii 96813, Alaska 99501 and absent 00000. Provider ambiguity and unknown mappings remain visible. Time zone review is explicit rather than inferred from ZIP alone.
- Retrieved real 24-hour NASA weather and solar for New York, 2025-06-01. Ran greenhouse, hybrid and indoor scenarios, then added two crop-evaporation sensitivity cases through the UI and recomputed all eight.
- Selected historical state pricing on the New York baseline and retained manual choices on other scenarios.
- Switched weather-only/equipment views, inspected hourly state, edited after calculation to trigger the stale-results warning, saved/restored scenarios, changed Field/Instrument theme, and canceled a live worker without displaying a partial run as complete.
- Downloaded scenario JSON, full-run JSON, hourly CSV and standalone report. An earlier 163.6 MB run was successfully imported after correcting the import size mismatch. Final annual JSON was 113,692,669 bytes and re-parsed into six valid scenarios plus 8,760 weather hours. Final CSV contained **52,560 rows**, six scenarios times 8,760 hours. Full imports require recomputation, not trust in supplied results.
- Corrected a full-run import that could retain the previous ZIP. Verified Tulsa import restores ZIP 74103 and Oklahoma context from a New York workspace.
- Corrected cached-weather restoration that could silently move a saved scenario. Verified restored New York inputs plus cached Tulsa weather now produce a location-mismatch error instead of running.
- Corrupt import rejected without discarding the eight existing scenarios/results. Added a regression that rejects unsupported outer bundle versions even when nested scenarios are valid.
- Injected storage denial, blocked external HTTP requests while retaining the local static server, observed explicit save/fetch errors, imported a real 24-hour Tulsa slice and successfully calculated it. No synthetic fallback weather was generated.
- Keyboard Tab reached “Skip to analysis”; Enter navigated to the analysis workspace.
- Area and temperature inputs show live US equivalents while retaining explicit SI input units: 500 m² → 5,382 ft²; editing to 100 m² → 1,076.4 ft²; 22 °C → 71.6 °F.
- Desktop and 390-pixel mobile visual inspection. Fixed a comparison-grid overflow: final mobile document width equals 390 pixels, with the 1,112-pixel comparison table scrolling inside its 330-pixel container. Marginal cost uses cents rather than rounding a small savings to negative zero dollars.
- Opened both standalone reports in a browser. They render in Grownetics Archive mode: parchment ground `rgb(243, 240, 237)`, DM Sans headings, gold § catalog labels, with DM Sans, Inter and IBM Plex Mono confirmed loaded. The comparison report preserves manual price provenance and the cadence caveat. The observed-weather report contains five SVG charts and four tables.

This was functional and visual verification, not a comprehensive accessibility audit or penetration test. Some browser automation waits timed out despite completed UI actions; final state and downloaded artifacts were inspected directly. Automation serialization failures were reported to the tool harness, not suppressed in application code.

### 2026-09-12 rebrand

The interface was moved onto the Grownetics brand system (Carbon register for the tool, Archive register for documents). No calculation code changed. Verified after the change: `npm test` 22/22; the six-strategy example was re-imported from `example-scenarios.json`, re-run in the browser and re-exported, producing identical comparison figures (baseline $19,283 period cost, 2,937.9 joint hours, 8,759 matched hours); DM Sans, Inter and IBM Plex Mono confirmed loaded in app and reports; no prior-brand text remains in the rendered app; 390 px mobile document width equals viewport width. `example-comparison.html` was regenerated from that re-run, so its hash differs from the 09-11 record while its numbers do not.

### 2026-09-12 audit

Four independent reviews (model, data, interface, roadmap) are recorded in AUDIT.md with fixes. Executed after the fixes: `npm test` 26/26; `node --check` on all changed scripts; reference study regenerated (manifest now records `noaaCrossCheck: present, 251 records, sha256 d949ea43…`); the six-strategy example re-imported, re-run and re-exported in the browser with figures unchanged (baseline $19,283 / 2,937.9 h / 8,759 matched; no numerical-failure hours in any strategy). New equipment-runtime table verified in both views; the exported report now carries pad/equipment runtime rows and opens its provenance sections by default (12 open `<details>`). Import-during-retrieval guard verified: a 5-day NASA request started 100 ms before importing a 24-hour snapshot; the badge read "24 hourly intervals" immediately and 10 s later, with start date unchanged, and the retrieval status reported the cancellation. The cadence-invariance of the redefined unmet loads was measured at 1 min vs 0.5 min on an out-of-band fixture: 37.278 vs 37.278 kWh and 130.364 vs 130.365 kg.

### 2026-09-13 v0.2 site-evaluator sprint

Model `0.2.0-screening`. Built in three parallel slices (engine, analysis, interface) against the PRD §10 contract; the engine agent timed out after writing its tests, so Main completed integration. `npm test` **43 passed, 0 failed** (24 model, 10 data, 9 analysis) at the end of the sprint. The six conservation identities (audit item 2) and the seven Morris screening tests (M3) took the suite to **56 at that point**. The current suite is recorded in the dated current-state table above.

**M1 gate met.** The staged deadband controller replaced per-substep re-optimization as the default. Measured on the full Tulsa 2025 year, 1 minute versus 0.5 minute dispatch:

| Strategy | Attainment difference | Electricity difference | 1-min run time |
|---|---|---|---|
| Pad + vent baseline | 0.004 pp | 0.06% | 2.3 s |
| DX / mini-split + dehumidifier | 0.383 pp | 0.31% | 2.3 s |
| Desiccant + evaporative cooling | 0.091 pp | 0.02% | 2.3 s |

This clears the EVALUATION §4 gates (energy under 1%, attainment under 0.5 pp) and replaces the 4.1 pp / 23.5% caveat, which was a property of the ideal controller. The ideal controller remains selectable as a labeled upper bound and still fails to converge (1.507 pp on the baseline, 1.95% electricity on DX). Staged is also 1.7 to 8 times faster.

**Executed browser evidence.** Ten bundled Tulsa years (2016-2025, complete coverage each, verified 8,760 or 8,784 hours) discovered from `data/weather/index.json`. Six strategies across five years ran through the worker pool as 5 year-jobs. Across-years table produced median, worst, best, spread and trend per strategy (baseline median 28.9%, worst 2025 at 27.1%, spread 2.7 pts) and correctly reported the cost ranking as **not stable** (2 distinct orders over 5 years). Two-site comparison (Tulsa 74103 and Phoenix 85001) produced 244 versus 2,334 pad-effective hours and 401 versus 2,636 free-cooling hours. Design-basis brief exported and rendered in Archive mode with six sections plus a per-scenario appendix; Tulsa 0.4% design dry bulb 36 C with coincident wet bulb 25.2 C.

**Defects found and fixed during integration.**

1. `simulateScenario` did not back-fill v0.2 keys, so any schemaVersion 1 scenario reaching the engine without a prior `validateScenario` call threw out of PsychroLib (`doasSupplyDewPointC` undefined). Found by running the bundled example scenarios directly. Fixed at the physics entry point with `backfillScenario` on a copy; regression added asserting the caller object is not mutated.
2. `renderLoads` stacked positive sensible terms only, so every loss was invisible: January envelope loss of 44 MWh did not appear at all, hiding the entire heating story. Losses now draw below the axis in the same category colours at 45% opacity, above the latent block.
3. Multi-site comparison was completely broken: `addSite` required `info.timezone`, but the public ZIP catalog has **no timezone column** (confirmed: columns are zip, city, state, latitude, longitude, coordinateAccuracy, inventoryStatus, utilityIndexes, gridRegions). Added an explicit site time-zone field with a state-derived proposal, a split-zone and no-daylight-saving warning for the 14 affected states, and IANA validation. Verified with Phoenix: proposed America/Phoenix with the Arizona caveat shown.

Not claimed: no benchmark against an independent greenhouse model, no site calibration, no equipment maps. The Stanghellini implementation assumes canopy temperature equals air temperature and no CO2 enrichment feedback, both declared in the run assumptions.

## Data and observed-weather study

The national ingestion retained source files and dated coverage: 42,185 ZIP records, 39,146 with candidate providers, 27,037 with multiple candidates and 3,039 without mapped utilities. There are 479 mapping-only records without invented coordinates. Prices contain 30,729 monthly state/sector records. eGRID data are explicitly vintage 2023; other weather years receive no invented emissions factor. These are public-source inventory counts, not authoritative street-service coverage.

The archived station study covers **2026-01-01 06:00 UTC to 2026-09-11 21:00 UTC exclusive**. Its solar coverage ends earlier and remains missing thereafter; solar is not required for the weather-side classification. The NOAA daily comparison is separate from instantaneous hourly station sampling and does not constitute calibration. Original IEM payload, NASA payloads, NOAA data and SHA-256 provenance remain available.

The reference-study HTML, CSVs and Markdown were regenerated from those archived inputs. Weather-side windows must not be interpreted as simulated indoor greenhouse operation. Source and taxonomy details remain in the reference-study report and README.

## Remaining limits and next iteration

Independent scientific and data reviews found concrete defects that were corrected: stacked-canopy photon creation, fractional-offset daily accounting, incompatible frost-point/RH rejection, and misleading manual-price provenance. Review and conservation checks still do not establish empirical accuracy.

Not claimed: measured-site calibration, an independent greenhouse-model benchmark, validated crop physiology/stages, detailed natural ventilation or equipment cycling, manufacturer-specific desiccant maps, exact utility tariffs/demand charges, hourly marginal emissions, automated site time-zone lookup, or public production deployment. Static imported-data calculations were verified without external services; first-load offline/PWA caching is not implemented.

The next iteration in DIGITAL-TWIN.md specifies academic-model benchmarking, equipment/controller fidelity, measured climate/energy/condensate data, identifiable calibration and held-out validation before making predictive precision claims.
