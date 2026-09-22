# Weather schema 2

The application owns one provider-independent weather contract. Providers translate into it; the solver and exports consume it. No hosted weather database is required for this standalone version.

## Record shape

| Field | Meaning |
|---|---|
| `schemaVersion` | `2`; schema-1 input is migrated without changing existing numeric values |
| `id` | `weather:sha256:<hex>` assigned after normalization |
| `provider` | `{id, product, model, stationId}`; unknown details remain null |
| `source`, `sourceKind`, `sourceUrls`, `raw` | Human-readable and original acquisition evidence |
| `latitude`, `longitude`, `timezone`, `startDate`, `endDate` | Requested site and inclusive local calendar dates; exact coordinates are preserved |
| `startUTC`, `endExclusiveUTC`, `timeBasis` | UTC coverage and hourly interval convention; imported partial ranges can be narrower than their calendar dates |
| `retrievedAt` | Recorded acquisition time, not forecast issuance |
| `forecast` | `{issuedAt, runId}`, each nullable; never inferred from retrieval time |
| `dataKind` | `observation`, `reanalysis`, `forecast`, `historical-forecast`, `statistical`, `mixed`, `unknown`, or `synthetic` |
| `variables` | Metadata for `tempC`, `dewPointC`, `rh`, `pressurePa`, `ghiWm2`, `windMs` |
| `transformations` | Recorded schema migration steps; variable derivations live in variable metadata |
| `hours` | UTC rows with numeric values/nulls, quality flags and provenance |

Variable metadata contains `unit`, `aggregation` (`instantaneous`, `mean`, `accumulation`, `unknown`), `sourceTiming`, `evidence`, `source` and nullable `derivation`. Evidence allows the data kinds above plus `derived`, `satellite-derived` and `missing`. A row's `variableQuality` overrides snapshot-level metadata for that variable. Legacy unknown aggregation stays unknown.

Every row has `time === intervalStart` in UTC epoch milliseconds and `intervalEnd === time + 3600000`. An interval states where the hourly model places the record; it does **not** make an instantaneous observation an hourly average. Original station observation timestamps and offsets remain available. Provider source codes remain on rows; known forecast codes override a conflicting observation label.

The current solver uses hourly values as its forcing inputs, including instantaneous or unknown-aggregation legacy data. Recording these distinctions improves traceability; it does not create missing sub-hourly measurements or quantify uncertainty. Derived RH still uses the existing adapter formula; this change does not calibrate the greenhouse model.

## Identity and persistence

`normalizeWeather` validates, migrates and removes an incoming ID. `sealWeatherSnapshot` hashes deterministic JSON with recursively sorted object keys, excluding only the top-level ID. The hash covers normalized values, raw evidence, provenance and retrieval metadata. It returns a detached copy; callers must treat it as immutable. Re-sealing identical content yields the same ID. A new retrieval or revised value produces a new ID even if the request was identical.

IndexedDB version 3 keeps three new stores:

- `weatherSnapshots`: insert-only records keyed by snapshot ID.
- `weatherRequests`: mutable request-to-ID pointers, including provider/product/model/station, exact coordinates, timezone/date range, data kind and forecast issuance/run identity.
- `weatherMeta`: latest loaded snapshot pointer.

Old `weather` and `snapshots` stores are never rewritten or removed. Lazy migration normalizes and seals their records. Invalid legacy records remain visible in metadata with `migrationError`; they are not silently selected. Newer request/latest pointers take precedence over migration. A request pointer means most recently saved revision; the picker orders matching revisions by recorded retrieval time and pins an explicitly loaded revision.

Browser storage is local to the origin and subject to quota/eviction. Export JSON to preserve a run elsewhere. Keeping raw payloads and all revisions costs space, and listing legacy caches currently repeats their normalization/hash work. Import parsing and initial normalization use a Worker, but snapshot sealing and storage validation can still pause the UI for very large payloads. No backend retention or cross-device synchronization is implemented.

## Historical eligibility and extensions

Historical analysis checks dataset/row classifications, provider source codes, effective evidence on present variables and future valid timestamps. Forecast/statistical evidence and combined observation/forecast rows are refused, even after their valid time has passed. Unknown past imports remain usable as unverified data. Missing future rows alone do not become invented forecasts.

Results carry `weatherSnapshotId`; JSON embeds the complete snapshot. CSV includes snapshot ID and dataset kind. Reports include the metadata, while JSON is still needed for complete reproducibility.

Future forecast advisories can reuse these adapters and snapshots, but must use a separate analysis path. Grownetics sensor samples, setpoint changes, actuator commands and measured actuator positions need separate schemas with their own timestamps and quality. This change implements neither control recommendations nor automated greenhouse control.

## Verification

Run `npm test`. For real IndexedDB upgrade/transaction/export checks, serve this checkout on the dedicated test origin specified in `test/browser/weather-storage.html` and click **Run tests**. The harness refuses an existing database; do not run it on the origin holding your working data. Its explicit reset control is only for the test database it created.
