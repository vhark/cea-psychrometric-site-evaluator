# Security and privacy

Purpose: state exactly what this tool does with your data, what leaves your browser, and how to report a problem.

Status: current for model `0.2.0-screening`, 2026-09-14.

## The short version

There is no server. There are no accounts, no logins, no API keys and no telemetry. Every calculation runs in your browser, in a Web Worker, on data you supplied or fetched. Nothing you type is transmitted anywhere by this application.

## What stays local

| Thing | Where it lives |
|---|---|
| Facility, crop, equipment and cost inputs | Your browser tab, and `localStorage` if you save a scenario |
| Weather snapshots you fetched or imported | IndexedDB in your browser |
| Simulation results | Memory, until you export them |
| Exports (scenario JSON, run JSON, hourly CSV, report HTML, design-basis brief) | Files your browser downloads to your machine |

Clearing site data removes all of it. If storage is denied or full, the application says so and keeps working in memory rather than silently losing your work.

## What leaves the browser

Only requests you trigger, only to public services, and only for weather and presentation:

| Destination | When | What is sent |
|---|---|---|
| `power.larc.nasa.gov` (NASA POWER) | You press retrieve with the NASA provider selected | Latitude, longitude and the date range. No facility, crop, equipment or cost input. |
| `mesonet.agron.iastate.edu` (Iowa Environmental Mesonet) | You press retrieve with the station provider selected | Station id and the date range, plus a separate NASA solar request. |
| `fonts.googleapis.com` and `fonts.gstatic.com` | Page load, and when an exported report is opened | A normal font request. Fonts are a presentation asset; the interface and the reports remain usable with system fallbacks if the request is blocked. |

Coordinates for a ZIP come from the committed local catalog, so a ZIP lookup is not a network request and does not reach a geocoding service. If you import weather instead of fetching it, the application makes no data request at all. Blocking outbound HTTP while serving the folder locally was tested: retrieval fails with an explicit error and no substitute weather is generated.

The acquisition scripts under `scripts/` do contact public data publishers (NASA POWER, IEM, NOAA, EIA, EPA, OpenEI, GeoNames) when you run them. They are developer tools, not part of the application, and they retain the original bytes plus a SHA-256 manifest of what they downloaded.

## Hosting it yourself

The published copy is a static site on GitHub Pages, which sees ordinary web-server request logs for the files it serves, the same as any web page. Self-hosting removes even that: copy the folder to any static host, keep the paths relative, and serve over HTTPS or localhost. No backend, no database and no credential is required, and none is embedded. A shared API key could never be kept secret in downloadable JavaScript, which is one reason this tool uses only keyless public endpoints.

## Handling of untrusted input

Imports are hostile input and are treated as such. Files parse in a Web Worker, so a large or malformed file cannot freeze the interface. Unsupported schema versions are rejected outright, including a valid inner scenario inside an unsupported outer bundle. Imported result claims are discarded and recomputed rather than trusted. User strings render as text, never as HTML, and CSV exports neutralize spreadsheet formula prefixes. A corrupt import leaves your existing scenarios and results intact.

This is defensive coding verified by regression tests and manual checks (see [docs/VERIFICATION.md](docs/VERIFICATION.md)). It is not a penetration test, and no formal security audit has been performed.

## Reporting a problem

- **Vulnerabilities:** use GitHub's private vulnerability reporting on this repository (Security tab, "Report a vulnerability"). If that is unavailable to you, open an issue that says only that you have found a security problem and asks for a contact, with no details.
- **Everything else,** including a wrong number, a missing caveat or an overstated claim: open a normal issue. An overstated claim is treated as a defect here, not as marketing.

Please do not include confidential site data, client documents or personal information in any report. A scenario JSON with the sensitive values replaced is usually enough to reproduce a problem.

There is no paid bounty. Expect an acknowledgement, a fix or a stated reason, and credit in [CHANGELOG.md](CHANGELOG.md) if you want it.
