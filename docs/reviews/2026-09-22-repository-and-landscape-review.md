# Repository and landscape review

Date: 2026-09-22. Reviewed commit: `54d33bfcaa0842e6869f6efed3a4618fd2f09556`.

Remote freshness verified on 2026-09-22 with `git ls-remote --symref origin HEAD` and `git fetch origin`. The remote default branch is `main`; local `HEAD` and fetched `origin/main` both resolve to the reviewed commit above. Ahead/behind counts are 0/0 and their tracked-file diff is empty. The only local additions are this review and the proposed design document. No merge or source update was needed.

This is a fresh review supporting the [proposed standalone version and delivery plan](../superpowers/specs/2026-09-22-psychrometric-explorer-design.md). It does not change the existing model's evidence tier or certify its older studies.

## What is actually in this folder

The workspace contains one application repository, `calc v1.0/`, with package version 0.3.0 and model `0.3.0-screening`. There is no separate Grownetics telemetry export or original customer requirements attachment in the top-level folder. The requirements available here are principally `docs/PRD.md`, the architecture/evaluation documents, the reference study, and the current user request.

The application is static HTML/CSS/native JavaScript, with a pinned PsychroLib 2.5.0, browser workers, IndexedDB weather storage, local scenario storage, and Node's built-in test runner. The existing contribution rules deliberately avoid runtime dependencies and a build step. These are useful constraints for a standalone tool and later academy integration.

Inspected the requirements, architecture, implementation contracts, evaluation and verification records, research and digital-twin roadmap, weather-source documentation, contribution rules, CI/deployment workflows, and the principal calculation/data/UI paths. Focused code inspection covered `physics.js`, `weather.js`, `simulate.js`, `config.js`, `storage.js`, `worker.js`, and relevant portions of metrics, screens, charts, exports, worked steps, and tests. This was a targeted technical review, not a line-by-line audit of every asset or historical report.

Important inventory correction: `data/weather/` currently contains only `index.json` and `sample-hours.json`. Six one-week climate fixtures exist under `test/fixtures/`. Regional and Morris study results are committed, but their complete hourly source archives are not. Some older documentation still describes sixty weather years as bundled. The study scripts explicitly require reacquisition before regeneration. Re-fetching revised provider data does not guarantee reproduction of the original inputs.

## Verification performed in this review

| Check | Actual outcome | Limit |
|---|---|---|
| `npm test`, Node v25.5.0 | 179 passed; zero failed, skipped, or cancelled; about 6.14 seconds | Regression evidence, not measured greenhouse validation. CI uses Node 20; that version was not separately run here. |
| Local browser, static server on port 8151 | Existing six scenarios completed against an already cached NASA POWER record, Jan 1–7, 2025; rendered comparison and inspector sections | 168 weather hours; comparison used 167 eligible hours. This was a restored browser workspace, not a clean-storage onboarding test. |
| Academy browser review | Opened overview and interactive labs; inspected the coupled-greenhouse lab and both visual treatments | No academy source-code/integration audit performed. |
| Focused Node probes | Reproduced cache collision, input-path disagreement, pad-label inconsistency, and forecast identity loss | Synthetic boundary/mock-response probes, explicitly not real provider or facility measurements. |
| Git worktree before review | Clean | No application source was modified by this review. |

Did not rerun the 360 annual regional simulations or 1,872 sensitivity simulations, retrieve paid Visual Crossing data, benchmark GreenLight, inspect raw WUR dataset files, or run a browser/device matrix. Existing study artifacts remain historical evidence.

## What is worth preserving

- PsychroLib and its license/pinned identity, rather than new equations typed from memory.
- Explicit distinction between outdoor weather opportunity and modeled indoor performance.
- Finite equipment capacities and heat/moisture accounting, including dehumidifier heat, reheat, regeneration, recovery and DOAS.
- Analytic linear exchange, explicit numerical failures, and meaningful conservation tests.
- UTC timestamps, local calendars, missing-data accounting, raw weather provenance, schema migration, and matched comparison populations.
- Background calculation/import, cancellation and stale-result handling.
- The hour inspector and `steps.js`: an unusually valuable starting point for teaching with the user's actual numbers.
- Sensitivity and multi-year comparison mechanisms, with their uncertainty interpretation retained.

These are reusable assets, not evidence that every path is already correct. Passing conservation tests verifies the implemented accounting boundary; it does not validate the omitted greenhouse processes.

## Findings to resolve before reuse

### R1. Weather cache identity omits provider and product

**Confirmed, high priority.** `src/storage.js:23` keys by rounded coordinates, timezone and dates only. Two sources for the same period generate the same key; `saveWeather` uses `put`, so one replaces the other. `src/app.js:401` also reduces available snapshots to one entry per year, and `retrieveYears` skips years already listed regardless of the selected provider.

Reproduction: calling `weatherKey` with identical location/dates and `source: 'NASA POWER'` versus `source: 'Visual Crossing Timeline'` returned identical keys.

Impact: selecting another source can reuse the previously cached year, defeating a provider comparison. Future forecasts would also need distinct issuance identities.

Plan: immutable content-addressed snapshots, with a separate request index containing provider, product/model, station, location, timezone, range and data kind. Keep multiple snapshots and make source selection explicit. Legacy entries keep their recorded provenance and are not silently relabeled.

### R2. Multi-year Visual Crossing acquisition omits the key

**Confirmed by call-path inspection, high priority.** `retrieveYears()` at `src/app.js:468` calls `fetchWeather` without `apiKey`. The single-period path at line 521 passes `apiKeyFor(...)`. `fetchVisualCrossing` rejects a missing key before making requests.

Impact: the multi-year action cannot retrieve an uncached Visual Crossing year through this path even when a key is saved. No paid call was needed to establish the missing argument.

Plan: one request-construction boundary for single-period and multi-year acquisition, with a regression exercising both callers using a stub provider. Account record limits, chunking and rate limits also need explicit handling.

### R3. Forecast identity is discarded

**Confirmed with a mocked response, high priority for data integrity and future scope.** `src/weather.js:427` requests selected elements without `source`. Its parser retains station lists but discards forecast classification. A mock 2027 hour with `source: 'fcst'` was accepted and became a generic blended weather hour, with no issue time or forecast identifier. The worker asks for historical weather in its message but does not enforce historical-only data.

Visual Crossing documents `obs`, `fcst`, `histfcst`, `stats`, and mixed records. Those are coarse data-kind identifiers, not complete per-variable gap-fill lineage. A station list alone cannot establish that all values were directly measured. [Timeline API documentation](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/).

Plan: retain data kind, source flags, valid interval, retrieval time, and forecast issuance where available; unknown remains unknown. The historical analysis rejects forecasts/statistical outlooks. Do not infer provider issue time from local download time.

### R4. Subfreezing dew-point conversion depends on the input path

**Confirmed numerical inconsistency.** `src/weather.js:522` uses a separate Magnus relation during normalization; `src/physics.js:67` uses PsychroLib saturation pressure. For dry bulb −10 °C, dew-point field −20 °C, and 101325 Pa:

| Path | RH fraction | Humidity ratio, kg/kg dry air |
|---|---:|---:|
| Dew-point-only CSV normalized first | 0.4386181453 | 0.0007005222 |
| Same numeric fields passed directly to `weatherState` | 0.3973037335 | 0.0006344712 |

The moisture difference is about 10.4%. This demonstrates inconsistent phase/conversion semantics, not proof that one interpretation matches every provider's subzero dew/frost convention.

Plan: centralize conversion with an explicit water/ice convention; retain the authoritative variable and the provider's definition. Test import/direct/export round trips at subfreezing conditions. Do not fix the inconsistency by indiscriminately reinterpreting meteorological dew point as frost point.

### R5. Weather opportunity and installed capability can contradict in the same record

**Confirmed educational ambiguity, not a demonstrated equipment-dispatch error.** At 35 °C, 15% RH, 101325 Pa, with the default crop program and `padEnabled: false`, `classifyWeather` returned `PAD_EFFECTIVE`, `PAD_NOT_INSTALLED`, and `utility.pad.useful: false` together.

The evaluation document allows hypothetical pad feasibility if required capability is separately displayed. The result shape makes it easy for a chart or learner to mistake that for an available operating mode.

Plan: separate hypothetical process opportunity from installed-system capability and actual simulated operation. A hypothetical pad result must explicitly say a pad would be required. Never count it as installed pad availability.

### R6. Initialization and physical simplifications remain material

**Confirmed design limitations, not newly measured errors.** `simulate.js:576` initializes each continuous segment at the target and midpoint moisture, then excludes exactly one hour. A high thermal-mass facility can retain initialization effects beyond an hour. No fresh initialization-sensitivity study was run here.

The model uses a well-mixed air volume, frozen dry-air inventory within each segment, a reduced constant-property energy inventory, air temperature as canopy temperature, simplified screen effects, assumed equipment performance, and equilibrium condensation without surface temperatures. Its present state cannot establish actual curtain condensation, spatial crop climate, natural-vent opening-to-flow response, or site controller accuracy.

Plan: assess initialization sensitivity, declare supported domains by model/topology, and retain experimental labels for conditional trajectories. Numerical stability and measured prediction accuracy are separate gates.

### R7. Provider and research contracts need maintenance

**Observed gaps and investigation items.**

- The current chart is accurately labeled dry-bulb versus dew-point scatter (`charts.js:238`). It is not a full pressure-specific psychrometric chart.
- The request helper accepts cancellation but has no built-in finite timeout/retry policy. Large imports retain multiple representations in memory; a worker alone does not bound memory use.
- Visual Crossing sea-level pressure is converted with an inverse standard-altimeter relation. Treat this as a pressure estimate and quantify its sensitivity; sea-level pressure reduction and altimeter setting are different concepts. The provider defines `pressure` as sea-level pressure. [Weather data dictionary](https://www.visualcrossing.com/resources/documentation/weather-data/weather-data-documentation/).
- Solar interval semantics need a provider-specific check. The Timeline reference describes radiation as instantaneous, while the solar guide associates it with an hourly period and provides accumulated `solarenergy`. Prefer verified interval energy when available; do not assume W/m² implies an hourly mean. [Solar documentation](https://www.visualcrossing.com/resources/documentation/weather-data/how-to-obtain-solar-radiation-data/).
- The app defaults to the free Open-Meteo endpoint, while architecture notes had recommended a different public-deployment policy. The free service terms distinguish commercial use. Deployment must choose an eligible endpoint/account or another source explicitly. [Open-Meteo terms](https://open-meteo.com/en/terms).
- Long source/economic qualifications repeat throughout results. Keep the evidence accessible, but distinguish a short explanation from the full technical appendix.

## Landscape and research conclusions

| Source/tool | What it contributes | Proposed role |
|---|---|---|
| [PsychroLib](https://psychrometrics.github.io/psychrolib/api_docs.html) | Moist-air functions based largely on ASHRAE 2017, SI/IP support | Retain as the thermodynamic foundation; add independently sourced reference cases. It is not a greenhouse model. |
| [GreenLight](https://github.com/davkat1/GreenLight) | Current Python dynamic-model platform focused on greenhouses/crops; BSD-3-Clause-Clear | Pin a version for offline matched benchmarks and later dynamic modeling. Do not require it in the browser runtime initially. |
| [WUR Autonomous Greenhouse Challenge, second edition](https://research.wur.nl/en/datasets/autonomous-greenhouse-challenge-second-edition-2019/) | Publisher describes indoor/outdoor climate, requested/realized setpoints, actuator state, resource use and crop data | Strong candidate for testing future event replay and control-evaluation contracts. Dataset files/license/cadence still require inspection. Does not establish hot-humid DX/dehumidifier validation. |
| [Hortinergy documentation](https://www.hortinergy.com/support-documentation/) | Greenhouse climate, lighting and sensible/latent cooling analysis | Product/workflow comparison; no source-code reuse or independent accuracy claim inferred. |
| [USDA Virtual Grower](https://www.ars.usda.gov/midwest-area/wooster-oh/application-technology-research/horticulture/virtual-grower/virtual-grower-3-model/) | Greenhouse heating/design, lighting and crop scheduling decision support | Established educational/design reference, with a different scope and legacy desktop delivery. |
| [Visual Crossing historical forecasts](https://www.visualcrossing.com/resources/documentation/weather-api/historical-forecast-api/) | Forecasts as generated in the past, including run time and lead time; historical forecast add-on required | Enables honest future backtesting if access is available. Otherwise retain snapshots prospectively under the user's provider entitlement. |
| [UMass greenhouse humidity guidance](https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/reducing-humidity-in-greenhouse) | Practical humidity, condensation and heating/ventilation context | Support teaching why humidity management involves more than RH. No universal crop target or disease prediction inferred. |

The [academy](https://vhark.github.io/grownetics-academy/#/labs) demonstrates the right teaching structure: one question, one intervention, several coupled consequences, and expandable assumptions. Its example lab is explicitly illustrative. Reuse that instructional pattern, not an assumption that a teaching mixing fraction is a calibrated ventilation law.

The gap this tool can fill is transparent, inspectable psychrometric reasoning attached to real weather and declared systems. It need not compete with every detailed greenhouse simulator. Future intelligence should combine trustworthy data, explicit physical models, and validated comparisons; fluent explanations alone do not establish a better strategy.

## Review conclusion

Reuse the defensible core, repair the data boundaries, and create a new guided application surface beside the existing one. Keep the existing app available during comparison. Build forecast advisories and retrospective control evaluation as separate later capabilities, each earning its own evidence level. The [proposed design and delivery plan](../superpowers/specs/2026-09-22-psychrometric-explorer-design.md) sets the scope and release gates.
