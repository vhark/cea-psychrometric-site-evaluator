# CEA Psychrometric Site Evaluator

A Grownetics tool. Free, open-source CEA historical-climate and component-investment screening. Compare greenhouse, hybrid and indoor configurations, greenhouse benches, walls and racks, and finite-capacity ventilation/pads, heating, DX, dehumidification, integrated reheat and generic desiccant/hybrid strategies.

First client: One Season Farmers (Tulsa, OK). The bundled Tulsa 2025 example, ZIP 74103 default and the crop presets marked "Client assumption (OSF …)" are that engagement's inputs; the model, data catalogs and interface are client-independent.

**This is a coarse planning screen, not a calibrated greenhouse digital twin, equipment-sizing certificate, manufacturer comparison or guarantee of indoor conditions.** The next iteration is specified in [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md).

**v0.2 (model `0.2.0-screening`)** turns the single-year demonstration into a site evaluator: ten bundled Tulsa weather years with median/worst/spread/trend per strategy and a ranking-stability verdict, multi-site comparison by ZIP, sensible-versus-latent load decomposition with space SHR, a CO2 enrichment window, cost-of-precision sweeps, and a printable design-basis brief for the engineer of record. The default controller is now a staged deadband model that converges with dispatch cadence (0.38 pp attainment and 0.31% electricity between 1 and 0.5 minute steps, replacing the previous 4.1 pp / 23.5% caveat); the old per-minute optimizer remains selectable as a labeled upper bound. Crop moisture defaults to Stanghellini transpiration driven by LAI, absorbed radiation and zone VPD, with the fixed L/m²/day schedule kept as a fallback.


## Run locally

Requirements: Python 3 for static serving; a current browser with ES modules, Web Workers and IndexedDB. Node 20+ is needed only for tests and the reference-study scripts. No npm package installation or backend is required.

```sh
python3 -m http.server 8150 --bind 127.0.0.1
```

Open **http://127.0.0.1:8150/**. Do not open index.html through `file://`: module fetches and workers require HTTP. The interface follows the Grownetics brand system (brand.grownetics.com): Carbon canvas, Brand Green accent, DM Sans / Inter / IBM Plex Mono. Exported reports use the brand's Archive (parchment) register.

To self-host, copy this folder to a static host that serves JavaScript/JSON with correct MIME types. Preserve relative paths and serve over HTTPS (or localhost). External Google Fonts are optional presentation assets; system fallbacks remain usable. No shared API key is embedded. Raw datasets and reports can be omitted from a lightweight deployment only if the runtime `data/us-zips.json`, `data/energy/*.json`, `data/weather/tulsa-2025.json`, `src/`, `vendor/`, styles and index are retained; preserve source/license attribution.

## Workflow

1. For a new site, enter a five-character ZIP, verify the centroid and IANA time zone, and review utility candidates. ZIPs do not identify exact street service. The bundled example selects Tulsa explicitly.
2. Choose dates and retrieve NASA POWER weather, select station observations plus independent solar, or import a saved snapshot/CSV. Alternatively load the genuine Tulsa 2025 example.
3. Choose facility, cultivation system and crop. Edit floor/canopy geometry, envelope, moisture, light/DLI, target bands, capacities, efficiencies and costs. Defaults are labeled assumptions. Inputs remain SI, with live °F/ft/ft² equivalents on corresponding fields.
4. Add strategies or sensitivity scenarios. Comparisons share the selected site and electricity customer sector; price mode can be manual or historical per scenario.
5. Run. Inspect joint-band attainment, misses, weather-side modes, equipment runtime (hours and days each component ran, plus pad viability from the weather screen), energy/water, daily light, hourly controls and common-eligible-hour comparisons. The first hour of every continuous weather segment is warm-up, excluded from comparative compliance.
6. Save local scenarios and export portable scenario/run JSON, hourly CSV and the light-themed report. A report alone does not contain the full reproducibility bundle: keep the run JSON as well. Imported run outputs are recomputed rather than trusted.

Edits mark old results stale. Cancel terminates the worker. Retrieval failures do not generate substitute weather. A partially observed period remains partial; no multiplication of summer cost into a claimed annual result.
For a reproducible six-strategy example, load Tulsa 2025, import [docs/example-scenarios.json](docs/example-scenarios.json), then run all scenarios. The [actual exported example report](docs/example-comparison.html) preserves the assumptions and caveats. Large comparisons produce large JSON files; imports are limited to 512 MB and may require splitting scenarios or periods.


## What is modeled

- Coupled single-zone sensible/moisture balance with finite equipment and one-minute internal control steps, analytic linear exchange and physical equilibrium condensation. Hourly weather is not transformed into measured minute-level weather.
- Crop evaporation removes sensible energy; all lighting input is counted once. Condensing dehumidifiers return latent plus compressor heat. DX sensible/latent capacity and integrated recovered/rejected heat remain coupled.
- Generic desiccants have finite removal, regeneration energy, purchased electric/fuel split and explicit sorption heat. Hybrid indirect evaporation has a separate secondary wet stream. No Blue Frontier or AGronomic IQ performance map is claimed.
- Historical solar drives optical DLI separately from thermal solar gain. Available footprint photons are shared over stacked canopy, not multiplied by tier area. Supplemental light uses current solar and accumulated photons, not hindsight.
- The controller prioritizes sampled joint temperature/VPD/dew-point-band violations, then estimated instantaneous operating cost under manual price assumptions. It is not a global economic optimizer. Regional historical prices recost the resulting dispatch; they do not optimize time-of-use operation.

Unmodeled detail includes spatial canopy gradients, crop physiology/stages, real natural-vent pressure flow, detailed glazing/screens, equipment cycling/defrost/manufacturer curves, desiccant storage scheduling, water-quality/bleed and failure-resilience engineering. Constant-property and ideal-modulation assumptions are exported with each result.

## Public data and coverage

- **NASA POWER:** genuine 8,760-hour Tulsa 2025 snapshot, UTC source timestamps, source-native meteorology/solar provenance and original payloads. RE hourly solar Wh/m² becomes interval-mean W/m² over one hour. Canonical RH is authoritative; auxiliary dew/frost-point inconsistencies are flagged rather than overwriting RH.
- **IEM:** routine station observations nearest UTC hour within 30 minutes, original timestamps retained. Estimated station pressure is flagged. Missing observations never receive NASA meteorology; solar is independently sourced and can be unavailable.
- **ZIPs:** 42,185 source records, 39,146 with dated candidate utilities, 27,037 with multiple candidates and 3,039 without mapped candidates. Includes 479 mapping-only records without invented coordinates. Not a certified current USPS inventory.
- **Electricity:** 30,729 state/sector monthly observations, generally 2010 through June 2026, with Puerto Rico starting later. Proxies are not utility tariffs. Utility associations are dated 2021. Full tariff schedules, demand charges, riders and time-of-use optimization are not implemented.
- **Grid:** annual eGRID2023 generation mix and total-output CO₂, preserving multiple ZIP subregions. Ambiguous subregions use explicitly labeled state-generation context. Other years have no emissions estimate, not a silently reused 2023 factor. Regional generation is not utility procurement or marginal emissions.

See [docs/ENERGY-DATA.md](docs/ENERGY-DATA.md), data manifests and [docs/RESEARCH.md](docs/RESEARCH.md) for original URLs, attribution and coverage. Historical price gaps produce an unknown total cost plus a labeled known subtotal; they never revert to today's price. Fuel/water use explicit scenario assumptions.

## Reproduce datasets and the supplied Tulsa study

```sh
python3 scripts/fetch-weather.py
python3 scripts/build-energy.py
node scripts/fetch-observed.mjs
node scripts/reference-study.mjs
```

The Python energy ingestion uses openpyxl for the source workbooks; install with `python3 -m pip install openpyxl` in a virtual environment if unavailable. Downloaded source files and SHA-256 manifests are retained. Source updates can legitimately change data and cutoff dates.

The observed study in [reference-study/](reference-study/) preserves the supplied brief separately from the coupled greenhouse screen: raw and derived hourly CSV, mode/month/day-night summaries, calendar exposures, episodes, percentiles, 16 sensitivity cases, NOAA daily-extrema cross-check, manifest, Markdown report and HTML charts. Its archived 2026 period contains 6,087 hourly slots, 6,064 observed valid hours and 23 missing, ending at 2026-09-11 21:00 UTC exclusive. Independently returned solar stops earlier and is not needed for weather-only classification. No complete-year claim is made.

## Weather CSV import

```csv
time,tempC,rh,pressurePa,ghiWm2
2025-01-01T00:00:00Z,20,0.6,101325,0
2025-01-01T01:00:00Z,19,0.65,101325,0
```

These two lines illustrate the schema, not bundled weather observations. Values use °C, RH fraction, Pa and W/m². Optional columns: dewPointC and windMs (m/s). Supply RH or dew point, explicit UTC ISO timestamps ending `Z`, and exact documented headers. Blank values remain missing. JSON includes schemaVersion, explicit units, source/time-zone metadata and hourly data; exported run JSON is the easiest full template. UTC hours disambiguate daylight-saving folds.

## Checks and limitations

```sh
npm test
```

Tests defend actual physical/data boundaries: no photon creation, finite controls, dehu/regeneration energy, cadence-invariant unmet loads, unsaturable-candidate exclusion, pad runtime, missingness, DST, fractional-offset DLI days, bounded import ranges, temporal billing and manual/historical pricing. They are **not empirical greenhouse validation**. A prior client-owned load calculator was audited before this tool reused any of its geometry and lighting assumptions; that audit is held with the engagement and is not part of this repository.

[docs/EVALUATION.md](docs/EVALUATION.md) is the broader scientific evaluation plan, not a claim that measured-site validation has already occurred. Release evidence and remaining precision limits are recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

[docs/SENSITIVITY.md](docs/SENSITIVITY.md) reports the Morris elementary-effects screening (roadmap M3): which assumptions actually move the answer, and whether the strategy ranking survives them. Headline: crop leaf area and transpiration dominate every metric, and the cost ranking is **not stable** across the screened ranges, though the three cheapest positions hold in every one of the 104 screened points.

[docs/AUDIT.md](docs/AUDIT.md) records the 2026-09-12 independent reviews: what was fixed, what was confirmed sound, and the prioritized open items. The accuracy roadmap with ordered milestones and the claim each earns is in [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md).

## Release notes: 0.2.0-screening

Site-evaluator release. Ten bundled Tulsa weather years with median, worst, spread and trend per strategy plus a computed ranking-stability verdict; multi-site comparison by ZIP; sensible versus latent load decomposition with space sensible-heat ratio; CO2 enrichment window; outside-air dehumidification screen; equipment runtime and pad viability; cost-of-precision sweeps; and a printable design-basis brief. The default controller became a staged deadband model that converges with dispatch cadence, and crop moisture became Stanghellini transpiration driven by leaf area, absorbed radiation and zone VPD. Morris elementary-effects screening (roadmap M3) now quantifies which assumptions move the answer. Integration fixed an engine crash on pre-0.2 scenario JSON, a load chart that hid every loss, and a multi-site path that could never resolve a time zone. Accessibility: the calendar carries shape cues and a text table, the hour inspector announces politely, and imports parse in a worker.

## Release notes: 0.1.0-screening

Initial static implementation: six equipment strategies, editable facility/crop/light assumptions, historical weather, national public ZIP energy context, sensitivity comparisons and portable outputs. Verification corrected stacked-canopy photon allocation, local-day/DST accounting, frost-point/RH handling, opaque-indoor solar eligibility, imported/cached site association, portable schema rejection, manual-price provenance and mobile overflow. The separate observed Tulsa study and the next-iteration calibrated-twin plan are included. No public production deployment is claimed.

## License

New application code: MIT, see LICENSE. PsychroLib 2.5.0: upstream MIT, pinned commit and license in vendor/. Public data retain their respective attribution/terms. Brand names and marks are not licensed as trademarks.

## Repository scope

This public repository holds the tool, its public data catalogs and its documentation. Two things are deliberately not here, both listed in `.gitignore`:

- `private/`: material belonging to a client engagement, including an audit of a client's own separate internal calculator. It stays with that engagement.
- `data/energy/raw/`: 36 MB of public-domain government workbooks and CSVs that `scripts/build-energy.py --refresh` re-downloads and verifies against the SHA-256 values already recorded in the committed manifests. The derived catalogs the application actually loads are committed.
