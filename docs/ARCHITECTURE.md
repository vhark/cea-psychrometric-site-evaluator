# CEA Psychrometric Site Evaluator: architecture

Purpose: record the deployment decision, module boundaries, data-contract design and controller design. Exact shipped schema/API details are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

Status: current for model `0.4.0-screening`, scenario schema 2, reviewed 2026-09-22. Runtime evidence and limits are in [VERIFICATION.md](VERIFICATION.md). No site calibration is claimed; future design constraints below are not manufacturer performance.

Read this if: you are implementing or reviewing code in `src/`, or deciding where a new capability belongs.

## 1. Deployment decision

The shipped application uses static HTML/CSS/JavaScript modules and a dedicated Web Worker for numerical analysis. No user accounts, database server, build service or server-side calculation is required. Serve from an ordinary static HTTP(S) host. Opening `file://` is not supported for module/worker deployment.

Native browser forms and SVG charts have table equivalents. IndexedDB stores weather snapshots; localStorage stores saved scenarios and small preferences. Results remain in memory until exported, not an automatically persisted run database. PsychroLib JavaScript is vendored and pinned with its license and provenance. Google Fonts are optional external presentation requests; self-host them before promising a fully offline presentation.

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

### The eighteen modules, as shipped

Every file in `src/` and the boundary it holds. Concrete per-person ownership is in [IMPLEMENTATION.md](IMPLEMENTATION.md); this table is what each module is allowed to know.

| Module | What it owns | Must not do |
|---|---|---|
| `config.js` | Defaults, crop/facility/system catalogs, editable field descriptors, scenario back-fill and `validateScenario` | Simulate anything, or accept a component that resolves to no usable parameter |
| `physics.js` | Typed SI psychrometrics over pinned PsychroLib, pad state, canopy absorption, Stanghellini transpiration, the outside-air drying screen | Hold state across hours, or decide equipment operation |
| `screens.js` | Movable shade, thermal curtain, insect screen and heat-pump parameters, their catalogued grades, resolvers and deployment predicates | Ship an unsourced number as a default, or dispatch equipment |
| `airflow.js` | Geometry conversions, recovery/frost ratings, moist-air mixing and DOAS enthalpy/COP transformations on one controlled stream | Invent product ratings, recover leakage or dispatch a second ventilation path |
| `simulate.js` | Coupled zone state, substep dispatch, causal lighting, per-hour results and summaries through shared metrics; manual-price dispatch objective | Render UI, use future weather or treat historical recosting as re-optimized dispatch |
| `metrics.js` | Summaries, monthly and daily reductions, load decomposition, design hours, multi-year aggregation, comparison and dominance | Recompute physics, or annualize a partial period |
| `sensitivity.js` | Morris design, elementary effects, mu\*, and the ranking-stability rule | Touch the DOM, or claim a distribution |
| `weather.js` | Provider adapters, normalization, continuity checks, the bundled site index and year loader | Classify modes or fill a gap |
| `energy.js` | ZIP lookup, utility, price and grid context, and period-matched costing | Guess a provider, a tariff or a missing price |
| `vintages.js` | Per-dataset staleness budgets assessed from committed manifests | Read a clock, a file timestamp or the network |
| `storage.js` | IndexedDB weather snapshots and localStorage scenarios | Persist a secret, or silently drop a quota failure |
| `worker.js` | The off-thread simulate and parse protocol, progress, cancellation and run identity | Render, or repair invalid physics |
| `app.js` | The Analyze view: inputs, run lifecycle, panel rendering, weather and energy selection | Embed an equation, or hide a model failure |
| `charts.js` | SVG charts and their accessible table equivalents, from the same arrays the tables use | Compute a separate approximate series |
| `report.js` | Standalone printable Grownetics Archive document generated from one run | Compute a metric of its own |
| `export.js` | JSON, CSV and report downloads, scenario export and `parseImport` | Export a claim a run did not produce |
| `tour.js` | The guided tour steps, the spotlight and the dimmed backdrop | Quote a figure not already committed in this repository |
| `learn.js` | The Learn view: the curriculum, the regional findings section, the two-view switch and the hash routes | Compute a number, or substitute an example for an absent study |

### Where a new capability belongs

- A new physical process or actuator: `physics.js` for the stateless relation, `simulate.js` for the dispatch that uses it.
- A new number derived from a completed run: `metrics.js`, then the view. Never in `charts.js`, `report.js` or `export.js`, so a chart, a page and a CSV cannot disagree.
- A new component with published parameters: `screens.js` for the values and the resolver, `config.js` for back-fill and validation, `docs/COMPONENT-PARAMETERS.md` for the evidence, and the one place in `simulate.js` where the resolved value enters the physics.
- A new bundled dataset: the snapshot plus its manifest, and a staleness budget in `vintages.js`.
- A new long computation: through `worker.js` as a new message type with its own progress and cancellation, never on the UI thread.
- A new taught section: an entry in `MODULES` in `learn.js`, quoting a figure that is already committed with its source.

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

## 4. Data-contract design and implemented boundaries

This inventory combines architectural requirements and future fidelity targets; it is not a literal exported JSON schema. `IMPLEMENTATION.md` and a current exported run define the shipped field names and envelope. Dynamic crop calendars, occupancy schedules, equipment performance maps and full tariffs below remain unimplemented design targets, not inputs currently solved by the engine.

### WeatherSnapshot

- `schemaVersion`, `snapshotId`, provider/product/model/version, source kind (`observation`, `reanalysis`, `satellite-derived`, `typical-year`, or mixed by variable).
- Requested and returned coordinates/elevation, station metadata, requested/actual range, IANA reporting timezone.
- Raw payloads or files, retrieval time, sanitized request URLs, SHA-256, source/license/attribution.
- Per-variable source units, normalized units, interval convention and transformation history.
- Meteorology and solar retain separate provenance and coverage.

### WeatherInterval

- UTC interval-start epoch **milliseconds**, original source timestamp(s), interval semantics and local display date/time/UTC offset. Seconds are not the canonical `time` unit.
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
- Current scenario schema is 2. `migrateScenario` preserves legacy airflow numbers, removes obsolete DOAS energy-per-water semantics, sets inert recovery and applies evidence/review gates. Weather snapshot schema is 2, with legacy schema-1 migration; [WEATHER-SCHEMA.md](WEATHER-SCHEMA.md) defines the current contract.
- Airflow source, review and installed capital basis travel with the scenario. `outsideAirBasis` has four values: `literatureRange`, `adjacentProxy`, `projectInput`, `screeningAssumption`; `outsideAirReviewed` records review of controlled flow and fan power per scenario. The interface presents each checkbox with its values and evidence basis directly below Run all scenarios; changing minimum, maximum, fan power or evidence basis clears that scenario’s review.
- `heatRecovery` is a nested component owned by `airflow.js`; DOAS uses `doasM3s`, `doasSupplyDewPointC`, `doasSupplyTempC`, `doasCoolingCOP`, `doasReheatRecoveryFraction`. No treatment creates another outdoor-air stream.

### HourResult

- Interval and scenario/snapshot/model IDs.
- Weather-mode primary code, secondary flags, reason and active thresholds.
- In equipment mode: simulated state statistics, duration in target, actuator runtimes/actions, heat/moisture fluxes, electrical/fuel/water use, condensate, DLI contribution, capacity shortfalls and failure causes.
- Per-hour min/max and compliance duration if integration is subhourly; hourly means cannot prove the whole hour was in band.
- Conservation residuals, convergence state, warm-up/initialization flags and validity. Missing data is never a successful control mode.
- `controls.controlledOutdoorAirACH` and the outdoor-air/treatment ledger replace ambiguous ventilation aliases. Sensible load uses `controlledOutdoorAirSensibleKWh`; moisture uses `latentKg.controlledOutdoorAir`. Recovery transfer, bypass, preheat, conditioning electricity, condensate and unmet conditioning are separately observable.

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

The `0.3.0-screening` default is a staged deadband controller with hysteresis, dwell times and one-minute dispatch. The 0.3 to 40 ACH example's commanded levels are 0.30, 10.23, 20.15, 30.08 and 40.00 ACH. Screens, treatment capacity and useful-supply checks constrain actual delivery. Maximum ACH is installed capacity, not continuous hourly flow. Ideal modulation remains a labeled, resolution-limited experiment, not continuous economizer optimization; historical cadence evidence is explicitly dated in [VERIFICATION.md](VERIFICATION.md).

A DX/dehu/reheat loop must converge as a coupled calculation. Adding latent removal can change sensible demand and runtime, which changes latent capability again. Use bounded iteration/convergence reporting or a simultaneous solution, never a one-pass subtraction that grants full capacity twice. Performance maps are interpolated within their documented domain; assumed curves and out-of-domain operation remain visible.

Reject supersaturated states or explicitly model condensation with matching latent release; do not clip RH at 100% and lose water/energy. No negative energy use or impossible airflow mixing fractions.

### Single-stream airflow and finite heat

Uncontrolled infiltration enters separately. The controlled stream passes through optional recovery or explicit bypass, then optional DOAS, then the zone, once. Internal recirculation, wind/stack pressure flow and canopy velocity remain unmodeled. Direct outside air must be useful for sensible cooling or moisture removal; cold-weather drying is constrained by available heating. Pad operation bypasses recovery.

Recovery assumes balanced supply/exhaust and requires declared sensible/latent ratings at 75% and 100% nominal flow. HRV latent effectiveness is zero; ERV requires latent ratings. Below 50% nominal the core bypasses with warning; above 130% only the supported flow passes the core and excess mixes as bypass. Economizer bypass is fixed model behavior. Frost modes require a manufacturer-qualified minimum temperature, exhaust-only bypass/defrost parameters, or preheat threshold. Unsupported cold operation is invalid; insufficient preheat is reported and the core bypasses. Supersaturation is resolved at conserved moist-air enthalpy, not by clipping RH.

DOAS cooling is entering-to-leaving moist-air enthalpy reduction divided by declared COP. Cooling to the supply dew point can condense water; recovered condenser heat meets reheat only up to the declared fraction, and unmet sensible heating remains explicit. No humidification is invented. Shared finite heater priority is recovery preheat, DOAS external heat, then zone heat. The configured fuel efficiency or heat-pump COP prices actual delivered heat, and fans are charged on actual controlled flow. Recovery energy transfer is not purchased energy or cash savings.

Sources, conversions and applicability are maintained in [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030). A numerical capacity sweep changes available discrete stages, so it cannot establish an optimal economizer size.

### Upgrades

Compare explicit scenario clones. Compute the marginal effect of one upgrade first, then combinations to expose interactions. Rank non-dominated scenarios using joint control and cost; do not add individual upgrade gains as if they were independent. Equipment-price uncertainty and unverified performance maps suppress definitive ROI claims.

## 6. UI and state behavior

- Configuration edits create a new draft; displayed results retain their original scenario hash and become visibly stale.
- Worker messages contain a monotonically increasing run ID; only the active run may publish results. Cancel terminates or interrupts outstanding work, not just the progress indicator.
- Data requests have timeouts/abort support and honest error messages. Respect provider throttles. Failed requests do not silently choose a different weather model.
- Saving handles denied/quota-full storage and offers JSON export. Imports are validated before entering storage or worker state.
- Names and imported strings render as text, not executable HTML. CSV exports escape delimiters and spreadsheet-formula prefixes in user strings.
- Charts are derived views of the same result arrays as tables and exports; no separate approximate chart calculations.
- The page holds Analyze and Learn in one document. Switching hides rather than unmounts a panel and does not cancel a run in flight. Hidden status is not a guarantee that asynchronous handlers stop executing. `learn.js` owns the switch, remembers the last view in localStorage and keeps per-view scroll positions.
- `#learn` and `#learn/<module-key>` are routes into the Learn view and `#analyze` is the route back; every other fragment stays an ordinary in-page anchor, so an existing deep link still works. Opening a curriculum section rewrites the hash with `replaceState`, which keeps the back button meaningful.
- The Learn view's regional section reads `docs/regional-study.json` at run time and renders only what that file contains. An absent or unreadable study renders as an absent study, naming the file and the command that regenerates it, and never falls back to an example.
- The highlight a Learn section uses to point at a panel is the guided tour's `spotlight()`, exported from `tour.js` and imported by `learn.js`. There is one highlight implementation, and it is a no-op while a tour owns the screen. If the panel a section refers to does not exist yet, the highlight lands on the first visible fallback, which is the control that would produce it.
- Brand tokens are Grownetics (brand.grownetics.com): interactive tools use Instrument mode, exported documents default to Archive mode regardless of OS theme, with dark mode opt-in only. DM Sans is display, Inter is body/UI and IBM Plex Mono is data; the monochrome logomark ships embedded from `src/brand.js` in generated documents and from `assets/` in served pages. Full-border tinted callouts replace side-stripe accents. Chart colors resolve through CSS variables.

## 7. Open-source and reproducibility

The application is MIT-licensed under [LICENSE](../LICENSE), with separate third-party notices. That license does not cover weather, benchmark data, logos or manufacturer literature owned by others.

- PsychroLib: MIT, preserve notice and pin version/commit.

Operating-cost and pp wording comes from shared presentation helpers exported by `report.js`. A cost carries period/population, purchased electricity/fuel/water, applied manual or dated historical prices, exclusions and no-quote/no-guarantee status. Capital stays estimated or user-entered separately. Attainment differences name both joint-target endpoints; Morris influence instead names pp per full screened range.
- GreenLight: BSD-3-Clause-Clear, if code is reused rather than only referenced, preserve notices and assess model-specific files too.
- GreenLight measured benchmark dataset: CC BY-SA 4.0, keep its attribution/license distinct.
- Open-Meteo server: AGPLv3; using an HTTP API is distinct from copying/modifying server code. Service terms remain independently applicable.
- GeoNames: retain the downloaded dataset's attribution/license metadata.
- Vendor curves: verify redistribution rights; user-entered private equipment data stays local unless explicitly exported.

Reproducible export bundle contains config JSON, raw weather and metadata, normalized weather, hourly result CSV, aggregate CSV and report. Include the actual cutoff and missing hours. Keep provider keys out of URLs/logs/exports.

## 8. Research evidence already exercised

`research-evidence/ktul-2026-09-01-raw.csv` and `manifest.json`: a 24-report routine-observation fetch, not a full-year study.

`research-evidence/browser-access-probe.json`: real JavaScript `fetch` calls from https://example.org returned HTTP 200 with response type `cors` for IEM and NASA POWER. NASA returned 24 values per requested variable and `Wh/m^2` solar under community RE. This confirms those small cross-origin requests at the check time, not continuous availability, all-origin support, full-year scalability or scientific validity.

The static coarse-screen application and the archived available-2026-to-date Tulsa reference study are implemented. The Pages workflow publishes `site/` at the public root and the calculator at `/app/` when `main` is pushed; [README.md](../README.md) gives those URLs and [VERIFICATION.md](VERIFICATION.md) records executed checks. Publication does not establish independent model benchmarking or measured-site calibration.
