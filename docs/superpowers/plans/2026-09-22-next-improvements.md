# Next improvements: accuracy, responsiveness and learning

> **For agentic workers:** Use `executing-plans` for the approved slice. Each slice is a separate change with its own failing regressions, implementation, verification and commit. This document authorizes no feature implementation by itself.

**Goal:** Make the standalone tool consistent across input paths, responsive with realistic datasets, and easier to learn from before adding forecast advice or control evaluation.

**Architecture:** Extend the existing native JavaScript modules and schema-2 snapshots. Keep one calculation core shared by analysis, explanations, charts and exports. Retain local storage and static hosting; introduce neither a hosted weather service nor a second greenhouse solver in this release.

**Tech stack:** Existing PsychroLib 2.5.0, native ES modules, Workers, IndexedDB, Node tests and browser integration harnesses.

**Status:** Proposed next-release plan, 2026-09-22. Weather foundation shipped to `main` in [`efeacd2`](https://github.com/vhark/cea-psychrometric-site-evaluator/commit/efeacd24fb5f89d1c2b499e46c6390a765c6afd4). No next-release application changes have been made. The [broader design](../specs/2026-09-22-psychrometric-explorer-design.md) remains the product direction; this plan narrows the immediate work and uses actual current filenames.

## Recommendation and alternatives

| Approach | Benefit | Tradeoff | Decision |
|---|---|---|---|
| Finish accuracy and usability gates, then the learning workbench | Teaching and analysis share results that are traceable and internally consistent | Less immediately visible than a redesigned chart | Recommended |
| Build the workbench first | Learners get a simpler entry point sooner | New explanations would inherit the confirmed moisture and capability ambiguities | Follow after the first two slices |
| Add forecast recommendations first | Makes use of Visual Crossing's forward-looking data | Adds freshness, forecast quality and advice validation before the historical foundation is complete | Keep as a subsequent release |

The first implementation slice should be **moisture-conversion consistency**. The difference below changes humidity ratio and therefore the interpretation of drying opportunities; it is more consequential than a visual redesign.

## Evidence from the shipped code

These were rechecked against `efeacd2`, rather than copied forward as assumed open issues:

| Finding | Current evidence | Planned response |
|---|---|---|
| Subzero input paths disagree | At dry bulb −10 °C, dew-point field −20 °C and 101325 Pa, direct `weatherState` returns RH 0.3973037335 and W 0.0006344712; CSV normalization followed by `weatherState` returns RH 0.4386181453 and W 0.0007005222 | Define the input convention explicitly, then share conversion code |
| Opportunity can read like installed capability | At 35 °C and 15% RH with the pad disabled, `classifyWeather` reports `PAD_EFFECTIVE` while `utility.pad.installed` and `useful` are false | Separate hypothetical opportunity, installed capability and simulated operation in the result and UI |
| Large snapshots still cause repeated work | `saveWeather` normalizes/hashes; `listWeather` loads full records and reprocesses legacy payloads; parsing uses a Worker but later preparation still runs on the UI thread | Move preparation and repository work behind a Worker interface; index compact metadata |
| Browser checks are not a CI gate | Nine actual browser checks passed locally; `.github/workflows/test.yml` executes only Node tests | Add a repeatable isolated browser gate with no paid-provider calls |
| Deployment is independent of the test job | Pages and tests are separate push workflows | Make deployment depend on passing verification |
| Initialization exclusion is fixed | `simulateScenario` initializes each segment at a target state and excludes one hour | Measure initialization sensitivity before strengthening performance claims |

The moisture probe demonstrates inconsistency, **not** proof that either path correctly interprets every provider's subzero dew-point convention. PsychroLib's saturation-pressure function switches phase at the water triple point; provider definitions must be reconciled with that behavior. [PsychroLib API documentation](https://psychrometrics.github.io/psychrolib/api_docs.html), [source implementation](https://psychrometrics.github.io/psychrolib/_modules/psychrolib.html). Visual Crossing's published field definition identifies `dew` as dew point but does not, by itself, resolve the subzero phase convention. [Provider field documentation](https://www.visualcrossing.com/resources/documentation/weather-data/weather-data-documentation/).

## Slice 1 — one moisture interpretation across every input path

**Files:** add `src/moisture.js`, `test/moisture.test.mjs`, `test/fixtures/psychrometric-reference.json` and `docs/validation/moisture-conventions.md`; modify `src/physics.js`, `src/weather.js`, `src/weather-contract.js`, `src/steps.js`, `src/config.js` and affected model/data tests.

- [ ] Reproduce the existing CSV/direct discrepancy as a failing regression. Cover identical inputs via CSV, schema-1 JSON, schema-2 JSON, provider adapters and direct calculation.
- [ ] Record definitions for each provider's RH and dew/frost point from primary documentation. Track RH reference phase separately from dew-point reference phase; one does not establish the other. Mark unresolved conventions as unknown instead of inferring them from temperature alone.
- [ ] Define the pure conversion boundary below and pin source-backed reference vectors. Include dry bulb −20/−10/0/0.01/20/40 °C, dry air, saturation, dew point above dry bulb, and pressures 70000/84000/101325 Pa. Reference expected values must come from cited external tables or a separately verified reference calculation, not the same function being tested.

```js
// Proposed API for src/moisture.js; no DOM, provider I/O or hidden defaults.
resolveMoisture({
  tempC, pressurePa, rh, dewPointC,
  authoritative: 'rh',             // or 'dewPointC'
  rhReference: 'water',            // water | ice | unknown
  dewPointReference: 'unknown',    // water | ice | unknown
});
// Returns {valid, vaporPressurePa, humidityRatio, basis, warnings}.
// Invalid or unresolved required interpretations have null derived values.
```

- [ ] Preserve an explicitly authoritative valid input when its auxiliary humidity value disagrees. Handle unknown cold-weather conventions with an explicit limitation; do not silently switch the interpretation or replace a supplied RH value.
- [ ] Route import, adapter derivations, direct state calculation and worked explanations through the shared module. Preserve current behavior for unaffected authoritative-RH cases. Remove duplicate conversion equations only after equivalent pathways have regression coverage.
- [ ] Preserve existing immutable snapshots. Any requested reprocessing produces a new snapshot with parent ID and conversion identity; never reinterpret an old cached snapshot in place. Record the conversion identity in new result assumptions and increment the model version if physical outputs change.
- [ ] Run `node --test test/moisture.test.mjs test/data.test.mjs test/model.test.mjs test/conservation.test.mjs`, then `npm test`. Publish an affected-case comparison showing what moved and why; mark dependent historical study outputs as belonging to their original version.

**Acceptance:** With the same declared physical convention, every input route gives W within `1e-10 kg/kg` and vapor pressure within `1e-4 Pa` of the shared result. These are computational consistency tolerances, not sensor-accuracy claims. Unknown conventions stay visible. Export/re-import preserves the original calculation basis and ID.

## Slice 2 — teach opportunity, capability and operation separately

**Files:** modify `src/physics.js`, `src/metrics.js`, `src/charts.js`, `src/steps.js`, `src/report.js`, `src/export.js`, `src/learn.js`; add `test/opportunity.test.mjs`; extend `test/steps.test.mjs` and `test/analysis.test.mjs`.

- [ ] Add regressions for pad-disabled hot/dry air, pad-installed hot/dry air, hot/humid limits, cold high-RH drying, conflicting temperature/moisture targets, exact thresholds and missing hours.
- [ ] Add explicit result facts for the three questions: “Would this process help in this weather?”, “Is the required system installed?”, and “Did the simulation operate it?”. Keep temporary legacy fields only as projections from those facts, never a second classifier.
- [ ] Make the pad-disabled case say “Evaporative cooling opportunity — pad required.” Installed pad availability stays zero; simulated runtime comes only from the simulation output.
- [ ] Build chart labels, arithmetic, summary totals and exports from the same facts. State denominators and distinguish whole weather hours from equivalent runtime accumulated across substeps. Missing intervals break consecutive episodes.
- [ ] Add a compact pre-analysis quality view: source/kind, interval basis, raw coverage, derived-variable counts, unsupported state counts and analysis-specific eligible hours. A finite value is not automatically model-valid or measured.
- [ ] Run `node --test test/opportunity.test.mjs test/steps.test.mjs test/analysis.test.mjs`, then `npm test`. Check the same disabled-pad case in the UI, table and report.

**Acceptance:** No chart or summary credits an unavailable pad with installed capability or runtime. Weather-only questions do not imply that a crop needs drying or that a strategy is cheapest. The inspector and exported totals agree exactly before display rounding.

## Slice 3 — responsive datasets and reliable release checks

**Files:** add `src/weather-worker.js` and `src/weather-client.js`; modify `src/worker.js`, `src/storage.js`, `src/app.js`, `src/weather.js`, `test/browser/weather-storage.mjs`, `.github/workflows/test.yml`, `.github/workflows/pages.yml`; add `test/browser/weather-lifecycle.html` and its module.

- [ ] Measure current import/save/list timings for 1 year, 10 years and a generated 100 MB fixture. Record browser/version, machine, payload size, elapsed time and UI long tasks. Generated fixtures stay explicitly synthetic and out of shipped sample weather.
- [ ] Move normalization, serialization, hashing and IndexedDB preparation into a dedicated module Worker. Keep a DOM-free repository and an explicit `requestId`/progress/cancel/result/error protocol; never accept an imported ID as verified just to avoid hashing.
- [ ] Add an atomic compact-metadata index so year selection does not deserialize every raw snapshot. Record completed legacy migration separately. Detect changed legacy content before reusing an alias; do not assume an old source record can never change.
- [ ] Keep snapshot insertion, metadata and request/latest pointer writes transactional. Preserve all old revisions and stores. Exercise quota denial, interrupted transactions, worker failure and cancellation while hashing or saving.
- [ ] Bound provider requests: timeout, cancellation, finite retries for retryable failures, `Retry-After` handling, and explicit chunk plans for provider record limits. Show the requested record count before keyed acquisition; no infinite retry or silent downgrade to another source.
- [ ] Extend the browser harness with delayed old/new responses, multi-year keyed retrieval using fixtures, automatic NCEI station pinning, source switching, no-cache startup, denial of storage, and JSON/CSV/report identity checks.
- [ ] Run those browser checks automatically in CI on an isolated origin. A test-only browser runner is acceptable; retain zero runtime dependencies. Make Pages deployment depend on the passing test/build gate. Test the assembled `/app/` subpath as well as local root serving.

**Acceptance:** Repeated metadata listing reads zero raw payloads after migration. Cancellation never replaces the current snapshot or results. On the recorded benchmark machine, the 100 MB fixture keeps controls responsive and introduces no main-thread task over 100 ms during preparation; if transfer/clone work exceeds that budget, return IDs and compact views instead of transferring the full raw payload. Unsupported size/quota failures give an explicit recoverable error. CI can reproduce the browser checks without credentials or live weather services, and failing tests prevent deployment.

## Slice 4 — the standalone learning workbench

**Files:** add `lab/index.html`, `lab/styles.css`, `src/workbench/app.js`, `src/workbench/psychrometric-chart.js`, `src/education/lessons.js` and `test/lessons.test.mjs`; reuse `src/physics.js`, `src/moisture.js`, `src/steps.js` and established theme assets.

- [ ] Build a single-state calculator requiring only dry bulb, one declared humidity input and pressure. Show pressure/elevation basis and SI/IP conversions; display rounding must not feed back into calculations.
- [ ] Plot dry bulb versus humidity ratio with saturation and RH curves at an explicit reference pressure. Selected historical hours use their actual pressure, with a visible distinction from the chart backdrop.
- [ ] Implement four predict/change/explain lessons: heating lowers RH without removing water; cold high-RH air can dry a warm greenhouse; evaporative cooling lowers temperature while adding moisture; condensing dehumidification removes moisture and releases heat.
- [ ] Reuse the calculation core for process endpoints, arithmetic, chart points and accessible tables. Add keyboard navigation, non-color state distinctions and a narrow-screen layout.
- [ ] Connect the existing named teaching examples and then historical imports. Do not require equipment pricing or a complete facility model to answer an air-state question.
- [ ] Run `node --test test/lessons.test.mjs test/steps.test.mjs`, then the full suite and browser workflow at `/lab/` and the deployed subpath.

**Acceptance:** A new user can complete each lesson without a weather account or facility configuration. The chart, numerical table and explanations agree. This slice becomes the first academy-linkable artifact; it does not replace the current app until the workflow is reviewed.

## Subsequent evidence work and extensions

| Order | Work | Required gate |
|---|---|---|
| 5 | Initialization and timestep study across greenhouse/indoor, low/high thermal mass, gaps and equipment limits | Compare 1/5/15-minute steps and perturbed initial states on identical evaluation windows; apply `docs/EVALUATION.md` tolerances. Report where a one-hour exclusion is insufficient instead of silently choosing a longer universal warm-up. |
| 6 | Greenhouse comparison workflow and curtain lessons | Clearly separate light/heat/moisture effects already modeled from surface condensation, which needs a surface-temperature model. Model-to-model benchmarks remain distinct from measured validation. |
| 7 | Simple forecast preparation guidance | Separate forecast screen; snapshot/issuance/freshness shown; deterministic explanatory rules with equipment prerequisites and missing-data behavior; retrospective evaluation against archived forecasts as issued. No setpoint or actuator commands. |
| 8 | Grownetics replay and control-performance evaluation | Obtain one representative export and a signal dictionary: zones, units, sample timestamps, setpoint effective times, curtain command versus measured position, sensor quality and equipment metadata. Validate time alignment before assessing tracking/overshoot/oscillation. |

For forecast guidance, start with statements such as “Outdoor air is expected to have limited drying potential during this window,” supported by humidity ratio, forecast timing, declared targets and stated uncertainty. Avoid “open the curtain to X%” or an optimal-control claim without a validated facility response model.

For Grownetics replay, keep sensor samples, setpoint events, equipment commands and actual positions in separate related schemas. Do not round events into the hourly weather grid or interpolate across control transitions. Start with descriptive tracking metrics; recommending a better strategy requires calibrated dynamics and a defensible counterfactual, not temporal correlation alone.

## Release and handoff

- [ ] Implement and review slices 1–3 as separate commits before expanding the workbench.
- [ ] Preserve the original snapshot and result/model versions in every regression artifact.
- [ ] Run focused tests once per meaningful change, the full suite at each slice boundary, and the affected browser workflow before merging.
- [ ] Update `CHANGELOG.md`, `docs/WEATHER-SCHEMA.md`, `docs/EVALUATION.md` and user-facing explanations with actual behavior and measured limits.
- [ ] Keep future guidance and control replay out of the current release. Use the contracts above to avoid an incompatible schema later.

No new input is needed to begin the first slice. Provider conventions that remain undocumented are explicit research outcomes, not permission to guess. A representative Grownetics export becomes necessary only when planning the replay implementation.
