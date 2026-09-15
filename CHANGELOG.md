# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions are model versions: the string the engine stamps into every result and export, so a number on a page can always be traced to the model that produced it. The `-screening` suffix is part of the version and part of the claim: this is an assumption-based screen, not a calibrated model. See [docs/EVALUATION.md](docs/EVALUATION.md) for the evidence ladder.

## [0.3.0-screening] - 2026-09-15

### Changed

- Scenario and run-bundle schema 2 with `migrateScenario`, explicit outside-air basis/review, inert recovery migration and saved-result invalidation. Legacy airflow values are preserved for review rather than silently resized. Active legacy DOAS imports require new performance inputs; `doasKWhPerKg` is removed. Weather snapshots remain schema 1.
- Uncontrolled infiltration, controlled outside-air capacity, actual commanded/delivered flow and internal recirculation are distinguished. Internal circulation and wind/stack natural ventilation remain unmodeled. ACH conversions include floor area and mean height, m³/s, m³/s per m², cfm and cfm/ft².
- Controlled air is one stream: optional HRV/ERV recovery or bypass, optional DOAS conditioning, then zone entry. No treatment adds ventilation a second time. Current hourly/load contracts use controlled-outdoor-air fields, not parallel ventilation/DOAS aliases.
- Outside-air context carries literature-range, adjacent-proxy, project-input or screening-assumption status. Construction-specific UGA/Shamshiri guidance is not a universal validation limit. The one-room 0.18 ACH proxy is correctly attributed to Shao. Mushroom minimum/maximum start incomplete and require project input/review, not a universal 6 to 15 ACH preset.
- Operating-cost labels now retain simulated period/population, purchased electricity/heating fuel/water, applied numeric prices and exclusions. Capital is separately estimated or user-entered. Modeled differences/reductions are not quotes or guaranteed savings. Joint-attainment differences use percentage points (pp) with both endpoints, not generic points or relative percent change.
- One Season Farmers visual identity: Instrument for interactive tools, Field by default for reports regardless of OS theme. Shared presentation helpers render cost, airflow and conditioning evidence consistently.

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
- Final whole-suite and browser integration status is recorded in `docs/VERIFICATION.md` by the integrating parent. This documentation entry does not claim a whole-suite green run before that evidence exists.

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
