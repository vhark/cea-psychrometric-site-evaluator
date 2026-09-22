# Weather snapshot contract implementation plan

> **For agentic workers:** Use subagent-driven-development for isolated storage work and review; execute the coupled normalization/provider/UI integration together. Preserve the existing application and its numerical model.

**Goal:** Give every provider a validated, versioned weather contract and immutable local storage, with historical/forecast separation and reproducible exports.

**Architecture:** Keep existing canonical numeric fields and public entry points. Add `src/weather-contract.js` for provenance, interval semantics, identity and historical eligibility; normalize schema 1 into schema 2 without inventing provenance. Store content-addressed revisions in a new IndexedDB store, retaining legacy stores as read-only migration sources.

**Tech Stack:** Native JavaScript modules, Web Crypto SHA-256, IndexedDB, Web Workers, Node built-in tests. No new runtime dependencies or hosted database.

## Authorized scope and exclusions

The user approved the weather-schema/store recommendation. This implements that slice, including the provider/key/cache defects. It does not implement the new learning UI, forecast advisories, Grownetics telemetry or a new greenhouse engine. Existing numerical inputs with authoritative RH remain unchanged. Unknown historical provenance stays visible; forecasting data cannot enter historical results.

## Tasks

- [x] Contract and regression tests: add `test/weather-contract.test.mjs`; exercise schema-1 migration, invalid intervals/kinds, variable temporal semantics, mixed/forecast records, future historical rejection, immutable hash identity and schema-2 round trips. Run `node --test test/weather-contract.test.mjs` red before implementation.
- [x] Implement `src/weather-contract.js`; wire `normalizeWeather` and `fetchWeather` to produce schema 2 and content identity; validate all supplied metadata. Preserve raw payloads, existing source timestamps and quality flags. Forecast issuance is separate from retrieval time and remains null unless supplied.
- [x] Storage: change `src/storage.js` to IndexedDB version 3 with `weatherSnapshots` (key = SHA-256 identity), `weatherRequests` (provider-aware request key = latest snapshot ID), and `weatherMeta` (latest loaded ID). Legacy version-2 stores remain intact. Read/migrate old records without deleting data. Add `test/weather-storage.test.mjs` identity/selection regressions and verify actual IndexedDB migration in a browser.
- [x] Acquisition: Visual Crossing requests and preserves its `source` field, requests accumulated solar energy and records exact temporal conversions, distinguishes absent station information from evidence of modeled values, and retains pressure estimation provenance. Historical requests reject forecast/statistical records. Unspecified legacy source kind remains unknown. Both single-range and multi-year requests pass keys through one request builder.
- [x] UI integration: extract reusable source/year selection into `src/weather-selection.js`, tested against competing providers, stations, timezones and revisions. Select only matching cached years; keep exact snapshot IDs with loaded/running results. Add a compact dataset identity/kind/time-basis summary.
- [x] Simulation and exports: assert historical eligibility in direct simulation as well as UI/worker paths. Bind outputs to their input snapshot IDs; retain full source metadata in JSON and expose identity/kind in CSV/reports. Imports migrate and reseal rather than trusting imported IDs.
- [x] Verify and document: run focused tests, then `npm test`, syntax checks and `git diff --check`. Exercise actual browser storage migration, cross-provider coexistence, revision retention, restore, historical refusal, run and export. Update `docs/WEATHER-SOURCES.md`, `docs/IMPLEMENTATION.md`, `CHANGELOG.md` with exact scope and limitations.

## Contract decisions

- Canonical numeric units stay Celsius, RH fraction, pressure Pa, solar interval-mean W/m² where known, wind m/s, UTC epoch milliseconds.
- Each hour has explicit interval start/end; hourly resolution remains the current model boundary. Snapshot variables state aggregation and source timing; unknown aggregation is not relabeled as measured mean.
- Provider identity contains provider ID, product, model and station ID. Historical source type and forecast metadata are distinct fields.
- `sealWeatherSnapshot` hashes a deterministic serialization of the normalized snapshot, excluding only its own ID. The hash includes recorded retrieval/provenance and raw evidence. Same snapshot reseals to the same ID; a changed value, issuance or retrieval record produces a new ID.
- A mutable request index chooses the most recently saved revision; immutable snapshot records use insert-only semantics. Previous revisions remain loadable by ID and travel in run exports.
- Source classification and future timestamps are both checked for historical eligibility. Legacy unknown records can be inspected/analyzed when in the past, with unknown provenance retained.
- No provider key belongs in normalized metadata, cache keys, hashes, run messages or exports. Keys are passed only to the acquisition layer and existing browser key storage.

## Completion evidence

Record actual test counts, browser checks and unresolved limitations here after execution. Do not claim a live paid-provider call or physical-model validation from mocked provider contract tests.


Completed 2026-09-22 on `feature/weather-snapshot-contract`, based on remote-synchronized `54d33bfcaa0842e6869f6efed3a4618fd2f09556`.

- Baseline: 179 Node tests passed. Final full suite: 202 passed, zero failed/skipped; focused contract/selection/storage suite: 23 passed. New behavior was exercised with failing tests before implementation; review regressions were reproduced before fixes.
- Syntax checks and `git diff --check` passed. Independent code review found no remaining blockers after the fixes.
- Chrome on isolated `http://localhost:8153`: all 9 integration checks passed (actual IndexedDB v2 migration, untouched legacy stores, concurrent latest-pointer protection, provider coexistence, retained revisions, superseded-save rejection, non-UTC roundtrip, mixed-forecast exclusion, simulation plus actual JSON export/re-import).
- Main UI: restored test snapshot, showed identity/kind, accepted manual site inputs, and completed a Worker run: 0 missing hours, 1 warm-up hour, 0 solver failures. Synthetic fixtures were confined to the test origin. A pre-existing server at port 8152 belonged to another checkout and was left untouched.
- Review fixes: local-date inference, forecast evidence on individual variables, derived station RH metadata, migration race, cache metadata hour-count selection, automatic NCEI station pinning, and stale asynchronous weather acceptance. Browser verification also exposed and fixed manual coordinate/timezone synchronization with scenario validation.
- Limitations: no live keyed Visual Crossing request, no new greenhouse model calibration, no forecast advisory/control feature, and no hosted persistence. Large legacy caches are rehashed on listing; large snapshot sealing/storage validation can still pause the main thread. These are documented in `docs/WEATHER-SCHEMA.md`.
