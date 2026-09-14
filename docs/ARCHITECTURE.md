# CEA Psychrometric Site Evaluator: architecture

Date: 2026-09-11. Status: static coarse-screen implementation exists. This document also preserves design constraints for the next calibrated-model iteration. Runtime evidence and limits are in VERIFICATION.md; no public production deployment or site calibration is claimed.

## 1. Deployment decision

Use static HTML/CSS/JavaScript modules and a dedicated Web Worker for numerical analysis. No user accounts, database server, build service, or server-side calculation is required for the proposed reduced-order engine. Serve from any ordinary static HTTP(S) host. Opening `file://` is not the supported module/worker deployment path.

Use native browser forms, SVG/canvas charts with accessible table equivalents, and IndexedDB for reusable weather/run snapshots. Small preferences and template indexes can use local storage. Avoid a framework until interface complexity justifies one. Vendor/pin the MIT PsychroLib JavaScript source with license and provenance; do not recreate wet-bulb equations from scratch. Self-host runtime fonts/assets if offline operation is promised.

“Static application” does not mean “no external dependencies.” Live weather retrieval contacts public services. Saved raw-weather imports make analysis usable without those services. A paid shared API credential can never be secret in downloadable JavaScript.

## 2. Component boundaries

Implemented responsibility boundaries, with concrete file ownership in IMPLEMENTATION.md:

| Boundary | Responsibilities | Must not do |
|---|---|---|
| UI | Input forms, scenario differences, charts, hour inspector, progress/errors | Embed physics equations or hide model failures |
| Project schema | Units/ranges, target consistency, versions, portable serialization | Guess unknown units or silently rewrite unknown schemas |
| Location | ZIP string lookup, coordinates, IANA time zone, station selection | Treat ZIP centroid as measured facility location |
| Weather adapters | Acquire provider data, parse units/sentinels/intervals, raw provenance | Classify modes or silently fill gaps |
| Weather normalization | Unique UTC intervals, alignment, QC and data eligibility | Discard original timestamps or DST identity |
| Psychrometrics | Typed SI wrapper around pinned PsychroLib | Estimate crop loads or equipment capacity |
| Weather screen | Brief-compatible primary modes and secondary flags | Output simulated indoor conditions or economic optimality |
| Zone/load model | Envelope, solar, crops, light, infiltration and inventories | Assume infinite equipment capacity |
| Equipment models | Air/water/heat transformations, power and bounds | Decide whole-facility operation in isolation |
| Controller | Causal admissible actions and finite-capacity dispatch | Look ahead at future observations by default |
| Simulation worker | Integration, convergence, cancellation, residual accounting | Block main-thread input or repair invalid physics silently |
| Metrics/economics | Shared-denominator aggregation, episodes, DLI, costs, dominance | Infer yield or annualize arbitrary partial periods |
| Storage/export | Raw snapshots, inputs, outputs, hashes, reports | Persist secrets or claim a query URL alone is reproducible |

Data flow:

Location + date range -> weather adapters -> immutable raw snapshot -> normalized weather + quality -> scenario configuration -> weather screen OR coupled worker -> hourly results -> aggregation/comparison -> charts and portable exports.

## 3. Provider strategy

### Observed meteorology

IEM ASOS for the Tulsa reference case and user-selected station observations. Documentation: https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?help . TUL is the IEM identifier for KTUL in the inspected response. Record coordinates/elevation and source-report time. Fetch padded intervals for hourly selection, use explicit UTC, honor one-second per-IP throttling, and do not download again for every equipment change.

NOAA/NCEI Global Hourly/LCD provide independent station/QC checks. A second API serving the identical processed data is not an independent validation of the physical observation.

### Free general climate/solar path

NASA POWER is the leading keyless candidate for the freely hosted business-facing prototype, subject to its documented attribution and the coarse spatial resolution being acceptable for screening. Use explicit `community=RE` and `time-standard=UTC`; check response units rather than depending on the community name alone. A real cross-origin one-day request returned `ALLSKY_SFC_SW_DWN` in `Wh/m^2`, temperature C, RH %, pressure kPa. Convert interval energy to mean W/m2 using actual interval duration. An AG-community request observed during research used different radiation units, so hardcoding the conversion is unsafe.

POWER meteorology is approximately 0.5 x 0.625 degrees and solar 1 x 1 degree. This is a material climate/locality limitation, not a precision weather product. Use station meteorology plus separately sourced POWER solar for the observed-reference equipment case, with explicit mixed-source labeling.

### Optional higher-resolution archive

Open-Meteo offers convenient ERA5/ERA5-Land/IFS access and documented CORS. Prefer explicit ERA5 for consistent historical comparisons, not an unrecorded changing best-match blend. Open-Meteo's free hosted API excludes commercial/promotional use, which can include a free branded tool. Do not enable that free endpoint for a commercial deployment by default. Options: properly licensed service via an operator-owned backend, a user-controlled compatible endpoint, a separately self-hosted Open-Meteo server, or imported authorized snapshots. Server AGPL, API service terms and CC-BY data are distinct obligations.

NSRDB actual-year solar is a higher-resolution US comparison/import option. Its point-download API requires a developer key/email, while public bulk data have separate access paths. Do not embed an operator key in the app. Confirm product interval convention before joining it with station records.

EPW import is useful but must distinguish actual-year weather from TMY. A TMY is not the user's chosen historical year and cannot answer actual event recurrence as if observed.

### Location portability

Bundle a dated US GeoNames postal-code index with attribution for a small, keyless ZIP lookup; preserve leading zeros and display approximate coordinates. Time zone lookup must be explicit: station metadata, a licensed coordinate-to-time-zone dataset/library, or user selection. Never infer civil timezone solely from longitude. Coordinate entry and station selection remain available when a ZIP is absent or ambiguous.

## 4. Canonical data contracts

### WeatherSnapshot

- `schemaVersion`, `snapshotId`, provider/product/model/version, source kind (`observation`, `reanalysis`, `satellite-derived`, `typical-year`, or mixed by variable).
- Requested and returned coordinates/elevation, station metadata, requested/actual range, IANA reporting timezone.
- Raw payloads or files, retrieval time, sanitized request URLs, SHA-256, source/license/attribution.
- Per-variable source units, normalized units, interval convention and transformation history.
- Meteorology and solar retain separate provenance and coverage.

### WeatherInterval

- UTC start/end seconds, original source timestamp(s), duration, local display date/time/UTC offset.
- SI Tdry C, Tdew C where observed, RH fraction, pressure Pa, wind m/s, GHI mean W/m2 and optional DNI/DHI.
- Value-level quality flags: original, aggregated, missing, suspect, inferred, imputed, cross-source.
- Meteorology-valid, solar-valid and jointly-valid flags.

### FacilityScenario

- Identity/name, schema/model versions and creation/update times.
- Building kind, floor/envelope/canopy areas, volume, layers, U values, solar/PAR transmission, shade/screen and infiltration assumptions.
- Crop/calendar/photoperiod/temperature/VPD/dew-point/DLI schedules, occupancy and transpiration method/parameters.
- Installed equipment descriptors, quantities, power/capacity maps, operating limits, source and confidence of each parameter.
- Control policy, outdoor-air constraints, heat-rejection destination and reheat permissions.
- Tariff, installed prices, component lives, maintenance and discount rate.
- Display units are separate from canonical numeric values. Do not serialize display strings as model numbers.

### HourResult

- Interval and scenario/snapshot/model IDs.
- Weather-mode primary code, secondary flags, reason and active thresholds.
- In equipment mode: simulated state statistics, duration in target, actuator runtimes/actions, heat/moisture fluxes, electrical/fuel/water use, condensate, DLI contribution, capacity shortfalls and failure causes.
- Per-hour min/max and compliance duration if integration is subhourly; hourly means cannot prove the whole hour was in band.
- Conservation residuals, convergence state, warm-up/initialization flags and validity. Missing data is never a successful control mode.

### AnalysisRun

Inputs + immutable weather snapshot hashes + code/dependency versions + solver settings + result arrays + eligibility rules + summaries + warnings. An identical input set and pinned solver produces reproducible results to declared numerical tolerances.

## 5. Model and controller implementation design

### Weather screen

Translate the supplied classification into a deterministic decision table, preserving codes and extending explanatory flags where its illustrative predicates overlap. Retain target humidity ratio, pad process state, thermal margin, enthalpy and moisture deltas so a user can audit each decision. No economic ranking in this mode.

### Coupled zone

Integrate a single-zone air/moisture/thermal-mass model with substeps inside hourly forcing intervals. Use an energy-conserving state formulation and explicit inventory boundaries. Thermal mass is an input assumption, not air heat capacity alone masquerading as a greenhouse dynamic response. Initial conditions and warm-up are visible. Linear or held forcing is declared; shortwave energy is preserved. The step size is chosen by convergence checks in EVALUATION, not by assuming one-hour Euler integration is stable.

Compute crop transpiration from an identified reduced-order radiation/VPD/LAI relation or a user-defined measured moisture schedule. Retain uncertainty and energy bounds; a coefficient borrowed from a tomato greenhouse is not automatically valid for multi-tier greens. Include substrate/open-water evaporation separately when enabled.

Opaque indoor surfaces may gain solar heat through an envelope model; direct crop daylight remains zero. Greenhouse optics need different effective coefficients for heat and PAR. Full cover-angle optics, CFD, multi-zone stratification and detailed plant growth are not claimed by the reduced-order model.

### Equipment dispatch

At each substep, construct only physically admissible strategies: minimum ventilation/heating, outside-air cooling/drying, pad cooling, closed-loop DX, standalone dehu, integrated dehu/reheat, and permitted combinations. Respect topology; a scenario without equipment cannot dispatch it.

Find feasible actuator levels subject to sensible/moisture coupling, installed capacity, minimum outdoor air and operating envelopes. Prefer target-feasible actions according to a declared policy. For a cost-aware policy, minimize modeled instantaneous purchased cost among feasible actions, including ventilation's downstream heating/cooling penalty. This is a causal local dispatch policy, not a proof of annual global optimality. If infeasible, report the limiting constraints and use a declared priority (temperature safety, moisture band, then cost), not an unexplained blended score.

A DX/dehu/reheat loop must converge as a coupled calculation. Adding latent removal can change sensible demand and runtime, which changes latent capability again. Use bounded iteration/convergence reporting or a simultaneous solution, never a one-pass subtraction that grants full capacity twice. Performance maps are interpolated within their documented domain; assumed curves and out-of-domain operation remain visible.

Reject supersaturated states or explicitly model condensation with matching latent release; do not clip RH at 100% and lose water/energy. No negative energy use or impossible airflow mixing fractions.

### Upgrades

Compare explicit scenario clones. Compute the marginal effect of one upgrade first, then combinations to expose interactions. Rank non-dominated scenarios using joint control and cost; do not add individual upgrade gains as if they were independent. Equipment-price uncertainty and unverified performance maps suppress definitive ROI claims.

## 6. UI and state behavior

- Configuration edits create a new draft; displayed results retain their original scenario hash and become visibly stale.
- Worker messages contain a monotonically increasing run ID; only the active run may publish results. Cancel terminates or interrupts outstanding work, not just the progress indicator.
- Data requests have timeouts/abort support and honest error messages. Respect provider throttles. Failed requests do not silently choose a different weather model.
- Saving handles denied/quota-full storage and offers JSON export. Imports are validated before entering storage or worker state.
- Names and imported strings render as text, not executable HTML. CSV exports escape delimiters and spreadsheet-formula prefixes in user strings.
- Charts are derived views of the same result arrays as tables and exports; no separate approximate chart calculations.
- Brand tokens are Grownetics (see PRD §5 Brand): app in Carbon register, exported documents in Archive register. Chart colors resolve through CSS custom properties (`--chart-1..8`, `--ok/--warn/--bad`) so palette changes never touch chart code.

## 7. Open-source and reproducibility

Proposed application license: MIT, with separate third-party notices. Do not apply this license to weather, benchmark data, logos or manufacturer literature owned by others.

- PsychroLib: MIT, preserve notice and pin version/commit.
- GreenLight: BSD-3-Clause-Clear, if code is reused rather than only referenced, preserve notices and assess model-specific files too.
- GreenLight measured benchmark dataset: CC BY-SA 4.0, keep its attribution/license distinct.
- Open-Meteo server: AGPLv3; using an HTTP API is distinct from copying/modifying server code. Service terms remain independently applicable.
- GeoNames: retain the downloaded dataset's attribution/license metadata.
- Vendor curves: verify redistribution rights; user-entered private equipment data stays local unless explicitly exported.

Reproducible export bundle contains config JSON, raw weather and metadata, normalized weather, hourly result CSV, aggregate CSV and report. Include the actual cutoff and missing hours. Keep provider keys out of URLs/logs/exports.

## 8. Research evidence already exercised

`research-evidence/ktul-2026-09-01-raw.csv` and `manifest.json`: a 24-report routine-observation fetch, not a full-year study.

`research-evidence/browser-access-probe.json`: real JavaScript `fetch` calls from https://example.org returned HTTP 200 with response type `cors` for IEM and NASA POWER. NASA returned 24 values per requested variable and `Wh/m^2` solar under community RE. This confirms those small cross-origin requests at the check time, not continuous availability, all-origin support, full-year scalability or scientific validity.

The static coarse-screen application and the full available 2026-to-date observed Tulsa reference study are now implemented. See VERIFICATION.md for executed checks and control-cadence sensitivity. No independent greenhouse-model benchmark, measured-site calibration or public production deployment is claimed.
