# CEA Psychrometric Site Evaluator: executed verification

Purpose: record the checks that were actually executed, with the commands, the measured values and the date, so no claim in this repository rests on an unexecuted intention.

Status: current for model `0.2.0-screening`, last updated 2026-09-14. Sections are dated and cumulative: the 0.1.0 sections are kept as the historical record, and the material precision limit they state was superseded by the staged controller in v0.2. This records executed checks, not completion of every future gate in [EVALUATION.md](EVALUATION.md).

Read this if: you are deciding how far to trust a number, auditing the evidence behind a claim, or repeating a check.

## Current state, 2026-09-14

| Check | Result |
|---|---|
| Regression suite (`npm test`) | **87 passed, 0 failed**: 30 model, 10 screens, 9 data, 9 analysis, 7 regional, 7 sensitivity, 6 conservation, 5 vintages, 3 examples |
| Model version | `0.2.0-screening`, staged deadband controller default, one-minute dispatch step |
| Controller cadence convergence, Tulsa 2025 full year, 1 min vs 0.5 min | 0.004 / 0.383 / 0.091 pp attainment, 0.31% electricity at most (staged); the retained ideal optimizer does not converge: 1.5 pp, 1.95% |
| Conservation identities | Close between 1e-16 and 5e-13 relative across six independently derived closed-form checks |
| Bundled weather | Six NASA POWER sites (Tulsa, Phoenix, Miami, Denver, Seattle, Fairbanks), 2016 to 2025 each, complete coverage (8,760 or 8,784 h per site-year, 87,672 per site) |
| Regional study | 360 full-year simulations (6 sites x 10 years x 6 strategies), 281.7 s on 8 threads. Three of six regions return no recommendation by rule; see [REGIONS.md](REGIONS.md) |
| Lighting delivery | A fixture with surplus capacity lands on the daily target exactly (14.000 of 14 mol) and is step-invariant at 5 and 1 minute; an undersized fixture still reports its shortfall. Regenerating the study after this fix left every verdict and strategy order unchanged, no strategy moving more than 0.05 pp or 50 dollars |
| Control-class ladder | Nine configurations x six climates, 2025, ideal controller, per-site sizing; see [CLASSES.md](CLASSES.md). Under the staged controller a Miami pad house fell from 9.6% to 0.0% attainment as cooling grew from 100 to 406 kW, while the ideal controller rose from 10.1% to 18.7% and saturated |
| Multi-year example, six strategies over five years | Baseline median attainment 28.9%, worst year 2025 at 27.1%, spread 2.7 pts; cost ranking **not stable** (2 distinct orders over 5 years) |
| Multi-site example | Tulsa vs Phoenix: 244 vs 2,334 pad-effective hours, 401 vs 2,636 free-cooling hours |
| Tulsa pad, runtime vs weather-side viability | Pad ran 2,772 h on 296 days; the weather screen clears both pad limits in only 244 h on 65 days; moisture ceiling binds 3,851 h against 2,952 h for the temperature margin |
| Outside air as the dehumidifier, Tulsa, against a 2.5 L/kWh unit | Outside air is cheaper per kg in 4,970 h and lower energy per kg in 1,752 h |
| Morris screening | 1,872 simulations, 104 design points, 8 trajectories, 12 parameters, 3 years x 120 days, seed 1, 290 s, reproducible. mu\* leader on all three metrics is leaf area and transpiration (9.10 pp attainment), then envelope U (5.89), then shade fraction (3.43). Ranking unstable: 3 orders, most common 61.5%; the three cheapest positions identical in 104/104 points; instability confined to DX, hybrid-desiccant and integrated, whose median costs sit within 16% |

Still not claimed, at this or any earlier date: no independent greenhouse-model benchmark, no site calibration, no equipment performance maps.

## 0.1.0-screening record (2026-09-11)

Release model at the time: `0.1.0-screening`.

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

[The compact metrics and export hashes](browser-run-metrics.json) preserve the exact measured values. [The example report](example-comparison.html) was regenerated from the unchanged browser-run JSON with the final exporter after a font-loading correction; its numeric results are unchanged and its separate hash is recorded. [The six portable configurations](example-scenarios.json) can be imported after loading the Tulsa 2025 example.

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

Model `0.2.0-screening`. Built in three parallel slices (engine, analysis, interface) against the PRD §10 contract; the engine agent timed out after writing its tests, so Main completed integration. `npm test` **43 passed, 0 failed** (24 model, 10 data, 9 analysis) at the end of the sprint. The six conservation identities (audit item 2) and the seven Morris screening tests (M3) took the suite to its current **56**.

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
