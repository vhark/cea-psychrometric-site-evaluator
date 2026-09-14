# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Versions are model versions: the string the engine stamps into every result and export, so a number on a page can always be traced to the model that produced it. The `-screening` suffix is part of the version and part of the claim: this is an assumption-based screen, not a calibrated model. See [docs/EVALUATION.md](docs/EVALUATION.md) for the evidence ladder.

## [Unreleased]

### Added

- **Learn tab.** The interface has two views. Analyze is the calculator; Learn is a ten-part curriculum that teaches the psychrometrics in the order the tool applies it, each part stating the relationship it teaches and offering a button that switches to Analyze and highlights the panel where that quantity is read. Modules are linkable (`#learn/uncertainty`). `src/learn.js`, plus an exported `spotlight()` in `src/tour.js` so both views share one highlight implementation.
- **Ten-year, six-climate regional study.** `scripts/regional-study.mjs` runs 360 full-year simulations (6 sites x 10 years x 6 strategies) and commits `docs/regional-study.json`; `docs/REGIONS.md` states the method and the recommendation rule. The Learn tab renders the verdicts. The rule refuses to separate strategies whose median costs sit inside the 16 percent band the Morris screening showed can reorder, so three of the six regions currently return no recommendation and name the measurement that would resolve them.
- **Four more bundled climates.** Phoenix, Miami, Denver and Seattle at 2016 to 2025 complete coverage each, beside Tulsa's ten years, so the tool demonstrates cross-climate reasoning offline.
- **A subarctic site, Fairbanks AK**, at 2016 to 2025 complete coverage, so the ladder has a climate where the limit is photons rather than heat: an outside daily light integral of 0.4 mol/m2 in December against 42.0 in June, and 1,112 hours a year below -20 C.
- **`docs/CLASSES.md`**: the classes of environmental control from pad-and-vent to an insulated opaque box, the physical condition that exhausts each class, what each achieved in all six bundled climates, and the measured answer to whether a winter greenhouse is worth building at 64.8 degrees north.
- **Movable shade screens and thermal curtains**, scheduled hour by hour and reported as runtime rows with what each one cost: light given up for the shade screen, delivered heat saved for the curtain, both measured against the same run with the screen open. A shut curtain restricts the outside-air path, so its moisture penalty is visible rather than hidden.
- **Air-source heat-pump heating** with a temperature-dependent COP, a cold-hour capacity derate and a hard cutoff that reports unmet heat instead of silently falling back to fuel.
- **Envelope ladder** of glazing and infiltration presets, and `docs/COMPONENT-PARAMETERS.md`: 23 sources behind every movable-shade, screen, envelope and heat-pump number, separating what is measured from what is plausible mechanism. Unsourced inputs ship as nulls that block the run with a named error rather than as plausible-looking defaults.
- `scripts/check-vintages.mjs` and `src/vintages.js`: per-dataset staleness budgets with rationale, an offline age report that exits non-zero past budget, and a CI step that reports without failing.
- `docs/examples/`: an importable scenario library, one set per design question, each exercised by `test/examples.test.mjs` on a real weather year.

### Changed

- All content is generic. Crop presets state their own arithmetic as planning assumptions, and no customer name, site label or engagement material appears anywhere in the repository. Tulsa remains the bundled worked example because ten complete public weather years there let the tool run offline.
- Aluminized shade screens get no automatic near-infrared bonus. The cited measurement shows the tested silver and black nets transmitting near-neutrally across 300 to 1100 nm, so PAR and shortwave multipliers ship equal until product spectra are supplied.
- Cultivation systems state a default canopy area derived from the floor area, with the stacking factor written out and every value editable. A scenario carrying a retired system name fails validation with a message naming it rather than a generic unknown-value error.

### Fixed

- **The lighting controller under-delivered the daily light target by construction.** It spread the outstanding deficit over the remaining lit window plus half a control step, so every step asked for slightly too little and a fixture with ample capacity finished every single day fractionally short: an indoor farm meeting 13.993 of 14 mol was reported as light-deficient on 365 of 365 days. The window is no longer padded, delivery now lands on target exactly and is step-invariant, and a genuinely undersized fixture still reports its shortfall. Regenerating the regional study left every verdict and strategy order unchanged, with no strategy moving more than 0.05 attainment points or 50 dollars.
- The header overflowed horizontally at 390 px once the tour button was added; the bar now wraps and the tour control takes its own row on narrow screens.
- `simulateScenario` never back-filled 0.2 keys, so a schemaVersion 1 scenario reaching the engine without a prior `validateScenario` call threw out of PsychroLib. Back-fill now happens at the physics entry point, on a copy.
- The load decomposition chart plotted only positive terms, hiding every loss; January's envelope loss was invisible. Losses now draw below the axis.
- Multi-site comparison was broken for most ZIPs: the public ZIP catalog carries no time-zone column. An explicit site time-zone field with a state-derived proposal, a split-zone warning and IANA validation replaced the silent failure.
- The exported report's fixed print footer overlapped body text in paged output; it is a static end block now.

### Added

- `docs/GLOSSARY.md`: every domain term the interface uses, with unit, location in the tool and how it is computed here.
- `docs/WORKFLOW.md`: the step-by-step working procedure, import schemas and what each export does and does not contain, moved out of the README.
- `docs/README.md`: documentation index with reading order.
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` and GitHub issue and pull request templates.

### Changed

- README restructured for a first-time reader: badges, screenshot, the three questions the tool answers, a two-minute quick start, a modeled versus not-modeled contrast table, the evidence tier stated plainly, and a key-results table where every figure links to the file that measured it.
- Documentation pass across `docs/`: each document now opens with a purpose line, a dated status line and a "read this if" line.
- `docs/VERIFICATION.md` carries a current-state table at the top; the 0.1.0 control-cadence precision limit is explicitly marked superseded by the staged controller rather than left to read as current.

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

[Unreleased]: https://github.com/vhark/cea-psychrometric-site-evaluator/compare/v0.2.0...HEAD
[0.2.0-screening]: https://github.com/vhark/cea-psychrometric-site-evaluator/releases/tag/v0.2.0
[0.1.0-screening]: https://github.com/vhark/cea-psychrometric-site-evaluator/releases/tag/v0.1.0
