# Security and privacy

Purpose: state exactly what this tool does with your data, what leaves your browser, and how to report a problem.

Status: current for model `0.3.0-screening`, scenario/run schema 2 and weather schema 1, 2026-09-15.

## The short version

There is no application backend, account, login, API key or telemetry. Calculations run in your browser, in a Web Worker, on data you supplied or fetched. Facility, crop, equipment and cost inputs are not transmitted by the application. A weather retrieval does send the coordinates or station and date range you choose to the public provider, as listed below.

## What stays local

| Thing | Where it lives |
|---|---|
| Facility, crop, equipment and cost inputs | Your browser tab, and `localStorage` if you save a scenario |
| Weather snapshots you fetched or imported | IndexedDB in your browser |
| Simulation results | Memory, until you export them |
| Exports (scenario JSON, run JSON, hourly CSV, report HTML, design-basis brief) | Files your browser downloads to your machine |

Clearing site data removes saved browser state, not files already downloaded to your machine. If storage is denied or full, the application reports the problem and retains the current in-memory work; export it before closing the tab.

## What leaves the browser

Weather requests happen when you trigger retrieval; font requests happen automatically when a page using them opens:

| Destination | When | What is sent |
|---|---|---|
| `power.larc.nasa.gov` (NASA POWER) | You press retrieve with the NASA provider selected | Latitude, longitude and the date range. No facility, crop, equipment or cost input. |
| `mesonet.agron.iastate.edu` (Iowa Environmental Mesonet) | You press retrieve with the station provider selected | Station id and the date range, plus a separate NASA solar request. |
| `fonts.googleapis.com` and `fonts.gstatic.com` | Page load, and when an exported report is opened | A normal font request. Fonts are a presentation asset; the interface and the reports remain usable with system fallbacks if the request is blocked. |

Coordinates for a ZIP come from the committed catalog served with the application, so a ZIP lookup does not reach a geocoding service. Importing weather does not contact a weather provider; static assets, catalogs and optional fonts can still be requested. Blocking outbound HTTP while serving the folder locally was tested: retrieval fails with an explicit error and no substitute weather is generated.

The acquisition scripts under `scripts/` do contact public data publishers (NASA POWER, IEM, NOAA, EIA, EPA, OpenEI, GeoNames) when you run them. They are developer tools, not part of the application, and they retain the original bytes plus a SHA-256 manifest of what they downloaded.

## Hosting it yourself

The published copy is a static site on [GitHub Pages](https://vhark.github.io/cea-psychrometric-site-evaluator/), with the [tool at `/app/`](https://vhark.github.io/cea-psychrometric-site-evaluator/app/). The host sees ordinary requests for files it serves. Self-hosting moves that exposure to your chosen host; serving locally avoids a remote static host but does not disable optional fonts or weather retrieval. Keep paths relative and serve over HTTPS or localhost. No backend, database or credential is required or embedded. A shared API key cannot be kept secret in downloadable JavaScript.

## Handling of untrusted input

Imports are untrusted input. Files parse in a Web Worker to keep parsing off the interface thread, but sufficiently large files can still exhaust browser memory. Unsupported schema versions are rejected, including a valid inner scenario inside an unsupported outer bundle. Supported schema-1 scenarios migrate to schema 2; incomplete airflow or treatment inputs must be supplied and reviewed before a run. Imported results are discarded and recomputed. User strings are escaped or inserted as text, and CSV exports neutralize spreadsheet formula prefixes. A corrupt file import leaves the current scenarios and results intact. At saved-workspace startup, unsupported entries are skipped with a warning while supported entries are retained and migrated.

This is defensive coding verified by regression tests and manual checks (see [docs/VERIFICATION.md](docs/VERIFICATION.md)). It is not a penetration test, and no formal security audit has been performed.

## Reporting a problem

- **Vulnerabilities:** use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). If that is unavailable to you, open an issue that says only that you have found a security problem and asks for a contact, with no details.
- **Everything else,** including a wrong number, a missing caveat or an overstated claim: open a normal issue. An overstated claim is treated as a defect here, not as marketing.

Please do not include confidential site data, client documents or personal information in any report. A scenario JSON with the sensitive values replaced is usually enough to reproduce a problem.

There is no paid bounty. Expect an acknowledgement, a fix or a stated reason, and credit in [CHANGELOG.md](CHANGELOG.md) if you want it.
