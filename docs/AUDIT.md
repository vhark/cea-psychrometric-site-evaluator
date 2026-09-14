# Audit: 2026-09-12

Four independent read-only reviews (model, data, interface, roadmap) plus a metric gap the client raised. Findings are cited to file:line at audit time; line numbers drift after fixes. Regression tests: 26 passing after fixes (22 before).

## Fixed in this audit

| Id | Severity | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| M2 | Critical | `src/simulate.js` `condense()` | A hot candidate at low weather pressure (saturation pressure ≥ total pressure) made `saturationHumidityRatio` throw, aborting the entire scenario batch instead of recording an excluded numerical-failure hour. | Guard `saturationPressure ≥ pressurePa` in `condense()` and its bisection; candidate rejected through the normal null path. | `an unsaturable overheated candidate is excluded, not fatal` |
| M1 | Major | `src/simulate.js` unmet accumulation | `unmetMoistureKg` summed the outstanding inventory deficit every substep (×60 at 1 min, ×120 at 0.5 min); `unmetSensibleKWh` likewise summed one-step recovery energy. Both exported in CSV. | Redefined as steady capacity shortfall: the extra W / kg·s⁻¹ needed to hold the violated bound under the step's forcing, integrated over time. Cadence-invariant to first order. | `unmet loads are steady capacity shortfalls, not re-counted every substep` (1 min vs 0.5 min within 5%; measured 37.278 vs 37.278 kWh, 130.364 vs 130.365 kg) |
| D1 | Critical | `src/weather.js` `normalizeWeather` | CSV imports never supplied date metadata, so the 30-year `range()` guard was skipped; two rows at 1970 and 9999 would allocate every intervening hour synchronously. | Apply the same 30-year bound to inferred bounds. | `inferred CSV bounds cannot expand into an unbounded missing-hour grid` |
| U1 | Critical | `src/app.js` `importFile` | Import did not bump `weatherEpoch` or abort the in-flight retrieval; a slow fetch completing after an import replaced the imported snapshot, dates, coordinates and scenario location. | Import is now the latest weather request: increments the epoch, aborts the controller, and re-checks the epoch after parsing. | Browser: verified import during retrieval leaves imported snapshot in place. |
| U2 | Major | `src/app.js`, `src/export.js` | Portable run JSON parsed twice (`JSON.parse` then `parseImport(text)`), doubling main-thread stall and memory on 100+ MB files; untrusted `results` retained. | `parseImport` accepts the parsed object; results no longer returned. | existing import tests |
| U3 | Major | `src/export.js` report | Scenario and energy provenance were in closed `<details>`; print CSS did not open them, so printed reports omitted every assumption. | `<details open>`. | Browser: report renders provenance expanded. |
| D2 | Major | `src/weather.js` `request()` | Live NASA responses were hashed as text but only the parsed object was retained, so the recorded SHA-256 could not be verified against the stored payload. | Raw items retain the exact response `text` alongside `payload`. | n/a (provenance) |
| D3 | Major | `scripts/reference-study.mjs` heatmap | Repeated autumn-DST local hour drew two rectangles at the same position; the second silently hid the first. | Repeated local hours draw as n half-width cells with fold index in the tooltip. | Regenerated report |
| D4 | Major | `scripts/reference-study.mjs` NOAA | Missing `data/reference` was silently caught; study wrote an empty cross-check and a clean manifest. | Manifest gets `noaaCrossCheck: {status, records, sha256}`; Markdown report states UNAVAILABLE with the reason; console warning. | Regenerated manifest shows `present`, 251 records, hash. |
| D5 | Major | `scripts/fetch-observed.mjs` | No timeout on IEM/NASA or NOAA fetches. | `AbortSignal.timeout` 600 s / 180 s. | syntax-checked |
| G1 | Gap (client) | UI + report | Pad viability and runtime were computable from the data but never stated. | New `runtime` summary (hours with use, equivalent full-load hours, days with use) for pad, indirect evap, DX, dehu, desiccant, heating, humidifier, light; `padViability` from the weather screen (effective / marginal / ineffective hours, days ≥1/4/8 h, limit causes). Shown as an "Equipment runtime" table (equipment view) and "Pad viability from weather alone" table (weather view), and as rows in the exported report. | `pad runtime is counted only when installed and only where pad leaving air helps` |

Tulsa 2025 baseline (pad + vent), from the verified run: pad ran 2,772 h on 296 days (1,830 equivalent full-load hours, 217,429 L); the weather-only screen says the pad clears both limits in only 244 h on 65 days (30 days with ≥4 h) and is too warm or too humid for pad alone in 2,680 h on 171 days, the moisture ceiling being the binding limit (3,851 h) more often than the temperature margin (2,952 h). The controller still runs the pad in hours the screen calls ineffective because partial cooling beats none under the violation-first rule; that is the intended reading of the two tables side by side.

## Confirmed sound (no change)

- Analytic exchange step, crop latent cooling, dehumidifier latent + compressor return, DX sensible/latent split, recovered vs rejected condenser heat, desiccant purchased-energy split, stacked-canopy photon limit, W/kWh and ACH conversions, CRF, common-eligible-hour dominance excluding failed scenarios and capex. Manual-price dispatch followed by historical recosting is documented intent.
- NASA UTC/unit/sentinel handling, deterministic IEM nearest-hour matching with retained timestamps, estimated-pressure flags, ZIP leading zeros and multi-utility retention, local-calendar-month sector pricing with unknown totals, eGRID conversion and subregion ambiguity.
- No innerHTML with user strings; report strings escaped; CSV formula prefixes neutralized; worker run IDs and stale-revision attribution correct; IndexedDB failure surfaced without losing in-memory weather.

## Open items: status at 2026-09-14

| # | Item | Status |
|---|---|---|
| 1 | Controller cadence dependence is structural | **Closed** by the staged deadband controller (v0.2). Measured 1 min vs 0.5 min: 0.004 / 0.383 / 0.091 pp attainment, 0.31% electricity max. The old optimizer remains as a labeled upper bound and still fails to converge. |
| 2 | Missing physical regressions | **Closed.** `test/conservation.test.mjs` adds six quantitative identities: pad water balance, indirect-evap secondary stream, humidifier latent cooling, free-running thermal-mass and infiltration trajectory against the closed-form exponential, DX coil and condenser identities as equalities, and dominance behaviour for disjoint eligible-hour sets and failed runs. Every expectation is derived independently of the value it checks. No defect was found: all identities close to between 1e-16 and 5e-13 relative, so this was a coverage gap rather than a physics error. |
| 3 | Timeline heatmap is colour-only | **Closed.** Every cell now carries a shape as well as a colour (solid block, lower half block, open cell with slash, centre dot), the legend and canvas label describe the shape first, and a keyboard-reachable day-by-hour table renders from the same rows so chart and table cannot disagree. Batched into one Path2D per bucket: a full year draws in about 7 ms. |
| 4 | Hour inspector has no live announcement | **Closed.** `aria-valuetext` on the slider plus one debounced polite status line; calendar and table selection both drive the same path. |
| 5 | Import parses on the main thread | **Closed.** Imports post the File to a parse worker; the misleading 512 MB file-size limit is replaced by an honest statement that the ceiling is the memory the tab can allocate, with staged progress. All prior guarantees kept, and the epoch re-check now covers CSV and bare weather JSON as well as run bundles. |
| 6 | Data vintages | **Open.** EIA prices and the GeoNames ZIP snapshot refresh via `build-energy.py --refresh`; the 2021 utility mapping and eGRID2023 still need explicit URL and year updates; nothing refreshes automatically. |
| 7 | Benchmark gap | **Open.** Roadmap M4/M5. The only named public dataset cannot exercise pad, DX or dehumidification paths, so the benchmark needs a model-to-model run on the same forcing. |

Structural sensitivity (roadmap M3) is now quantified rather than asserted: see [SENSITIVITY.md](SENSITIVITY.md).

## Suggested improvements beyond defects

- Show the pad-viability numbers in the headline strip when the scenario has a pad (currently one weather-only metric plus the new table).
- Expose `runtime` in the comparison table as "pad h / DX h / dehu h" columns so strategies can be compared on utilization, not only cost.
- Add a per-month runtime breakdown (the monthly structure already exists in `summary.monthly`).
- Add two more NASA POWER years for Tulsa to the bundled examples so multi-year stability (roadmap M3) can be exercised without network access.
