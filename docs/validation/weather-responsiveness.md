# Weather preparation and storage measurements

Measured 2026-09-22 with headless Google Chrome 153.0.8010.53 on macOS 26.6.2, Apple M2 Max, 64 GiB RAM. A fresh isolated browser context served the app at `http://localhost:8153` for each run. No credentials or live weather services were used.

The synthetic fixtures contain constant weather values explicitly marked synthetic. The one-year fixture covers leap year 2000; the ten-year fixture covers 2000–2009. Fixture construction runs in a disposable Worker. The 100 MB case adds exactly 100,000,000 ASCII bytes to the raw provider evidence of the one-year fixture. Fixtures are generated at runtime and are not shipped as sample weather.

| Fixture | JSON bytes | Hours | Main-thread baseline import | Worker import | Baseline largest main task | Worker largest main task |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 year | 747,062 | 8,784 | 72 ms | 82 ms | 54 ms | <50 ms |
| 10 years | 7,525,404 | 87,672 | 650 ms | 797 ms | 487 ms | 80 ms |
| 100 MB raw | 100,747,062 | 8,784 | 465 ms | 528 ms | 368 ms | <50 ms |

| Fixture | Baseline load | Worker compact load | Baseline two metadata lists | Worker two metadata lists |
| --- | ---: | ---: | ---: | ---: |
| 1 year | 8 ms | 19 ms | 25 ms | 1 ms |
| 10 years | 79 ms | 218 ms | 236 ms | 5 ms |
| 100 MB raw | 48 ms | 18 ms | 328 ms | 1 ms |

The baseline recreates the former main-thread file-read, normalization, hashing, full-snapshot load and raw-record metadata-listing path. It uses the current validation and v4 persistence code to isolate thread/transfer/index effects; it is not a checkout of the old application. Elapsed import includes hashing and the completed IndexedDB transaction. The Worker can take more elapsed time while keeping controls available. The main-task measurement spans import, load and two lists. Chrome's Long Tasks API reports tasks of at least 50 ms; zero entries are shown as **<50 ms**, not as zero work. These are recorded local measurements, not a guarantee for all hardware or arbitrary payload layouts.

The Worker path met the 100 ms task budget on this machine, including the 100 MB fixture. It transfers File/Blob handles into the worker, returns hourly records with raw omitted, and returns exports as Blobs. A compact transport marker prevents these projections being resealed as full immutable snapshots. A normal load reads the compact store; only explicit export reads the original raw snapshot.

## Storage behavior

IndexedDB v4 retains all previous stores and adds `weatherIndex` and `weatherCompact`. The upgrade backfills these once. A single transaction writes the original immutable revision, compact view, metadata, provider request pointer and latest pointer. A browser integration test injects an index constraint failure and verifies rollback of every record and pointer. Another test cancels after hashing and verifies that no stale revision or pointer is committed.

The first metadata list migrates legacy stores and persists a completion marker. Repeated lists read only the compact metadata index and that marker; a browser test instruments the actual IndexedDB transactions and asserts zero reads from original or legacy stores. Invalid legacy records remain visible with their migration error.

Legacy stores do not publish notifications when an older application overwrites an existing key. Ordinary lists therefore deliberately do not audit them. Call `listWeather({refreshLegacy:true})` or `weatherClient.list({refreshLegacy:true})` to re-read and hash legacy values. The browser test changes a same-key legacy value, verifies that ordinary listing remains memoized, and verifies that an explicit audit discovers the new revision without replacing current request/latest pointers. Old revisions and legacy values are retained.

Files above 128 MiB are rejected before reading/JSON parsing with an explicit message to split the date range. Direct repository storage failures reject and preserve committed data. The Worker retains the verified original in memory when persistence is unavailable, returns a `cacheWarning`, and supports load/list/exact JSON export for that session. This fallback is not durable: export before reload. Invalid input still rejects before any fallback is possible. Cancellation is an AbortSignal routed by request ID; a queued cancel is processed before a write starts, and active write transactions listen for abort. Results from cancelled requests are discarded by the client.

## Reproduce

Serve the repository on the dedicated isolated port and use a fresh browser context for each URL:

```sh
python3 -m http.server 8153 --bind 127.0.0.1
```

- `/test/browser/weather-storage.html?autorun`: migration, metadata-only reads, legacy audit, compact identity, cancellation, atomic rollback and export checks.
- `/test/browser/weather-lifecycle.html?autorun`: actual module Worker import/load/list/export/run roundtrip, malformed input, supported-size error, cancellation and protocol recovery.
- `/test/browser/weather-lifecycle.html?autorun&benchmark`: the same checks plus Worker fixture measurements and the 100 ms budget assertion.
- `/test/browser/weather-lifecycle.html?autorun&benchmark=baseline`: the same generated fixtures through the main-thread baseline, with timing output but no Worker-budget assertion.

Each page sets `document.body.dataset.result` to `pass` or `fail`; machine-readable measurements are available at `window.weatherBenchmark`. The harnesses refuse to write outside the dedicated origin or into an existing database. No test deletes a pre-existing database automatically. The storage page's explicit reset button deletes only its named test database on the test origin.


## Final integration recheck

After adding worker-side pre-analysis quality counts, the same machine/browser and generated fixtures passed again: one-year import 87 ms / compact load 30 ms / two metadata lists 1 ms; ten-year 818 / 275 / 4 ms; 100 MB 558 / 26 / 1 ms. Largest main-thread tasks were respectively <50, 78 and <50 ms. This is the final integrated Worker path, with the quality summary included. The automated release runner additionally uses fresh loopback contexts and an injected isolated-test marker, so it can choose an ephemeral port safely while retaining the empty-origin guard.
