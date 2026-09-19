# Using the tool

Purpose: the step-by-step working procedure, from picking a site to exporting a result, including the import formats and what each export does and does not contain.

Status: current for model `0.3.0-screening`, scenario schema 2, 2026-09-15.

Read this if: you are running the evaluator, or you received an export from someone who did and need to know what it is worth.

## 1. Serve it

```sh
python3 -m http.server 8150 --bind 127.0.0.1
```

Open http://127.0.0.1:8150/. Module fetches and Web Workers do not work over `file://`. To self-host, copy the folder to any static host that serves JavaScript and JSON with correct MIME types, keep paths relative, and serve over HTTPS or localhost. No shared API key is embedded and none is needed.

A deployment must retain `data/us-zips.json`, `data/energy/*.json`, `data/weather/`, `src/`, `vendor/`, `styles.css` and `index.html`, with source and license attribution. Keep `docs/regional-study.json` for Learn's findings and the linked docs/examples/reports for the complete reader workflow; omitting them leaves those surfaces unavailable. Raw regeneration downloads are not runtime requirements. Google Fonts are optional presentation assets; system fallbacks remain usable. The repository's Pages workflow packages the public site at `/` and this calculator plus its documentation at `/app/`.

The interface opens on **Analyze**, the calculator these steps describe. The **Learn** tab beside it is a
ten-part curriculum on the psychrometrics behind the screening, each part pointing at the Analyze panel where
its quantity is read, closing with what ten weather years recommend per bundled climate (see
[REGIONS.md](REGIONS.md)). Reading it is optional; nothing in Analyze depends on it. The selected view persists
across reloads and is linkable: `#analyze`, `#learn`, `#learn/<module>`.

## 2. Choose a site

Enter a five-character ZIP, then verify the proposed centroid and IANA time zone and review the utility candidates. A ZIP does not identify an exact street service address. The public catalog has no time-zone column, so the zone comes from `data/us-zip-timezones.json`, a ZIP-level table built from the GeoNames gazetteer that puts 99.5 percent of ZIPs on the right clock. It is still a proposal you confirm, and a site near a state or county line is the one worth checking. A ZIP the table does not carry falls back to a state guess and says so.

There is no default site. A new scenario carries no ZIP, no coordinates and no time zone, and reports both as errors until you locate it.

## 3. Get weather

Four paths, none of which invents data:

| Path | What you get |
|---|---|
| NASA POWER retrieval | Gridded hourly meteorology and solar for the chosen dates, with the original payload and provenance retained |
| Station observations (IEM) | Routine observations matched to the nearest UTC hour within 30 minutes, plus independently sourced solar that may be unavailable |
| Import | A saved snapshot, an exported run bundle, or a CSV (schema below) |
| Reference climates | Six sites with ten NASA POWER years each (2016 to 2025), Tulsa, Phoenix, Miami, Denver, Seattle and Fairbanks, are registered in `data/weather/index.json` because the committed studies ran on them. Their hourly archive is not shipped: retrieve any site's years with `scripts/fetch-weather.py` or the Retrieve control, after which year chips appear whenever your coordinates and time zone match. No site is the default one |

Retrieval failures never generate substitute weather. A partially observed period stays partial, and no partial-period weather-dependent cost is annualized.

## 4. Describe the facility

Choose facility (greenhouse, hybrid or indoor), cultivation system (benches, microgreens, propagation or mushroom) and crop, then edit floor/canopy geometry, envelope, moisture, light/DLI, target bands, capacities, efficiencies and costs. Defaults are labeled assumptions, not measured facility inputs. Inputs are SI, with live °F, ft and ft² equivalents on corresponding fields; installed fixture power also accepts direct W/ft² entry and offers high-light LED 650 W and HPS 1000 W presets (each over a 16 ft² footprint, efficacy an editable screening assumption), with custom values shown as a custom preset.

Terms used on these fields are defined in [GLOSSARY.md](GLOSSARY.md). To start from a worked comparison instead of the defaults, import one of the sets in [examples/](examples/README.md).

### Review the outdoor-air path before running

`infiltrationACH` is uncontrolled envelope leakage. `minVentACH` and `maxVentACH` are the minimum command and maximum installed capacity of one controlled outdoor-air stream, not infiltration or internal circulation. Review the displayed ACH, m³/s, m³/s per m² floor and cfm/ft² conversions at the entered mean height. Internal recirculation and canopy air velocity are not modeled.

Select an evidence status: literature range, adjacent-evidence proxy, project-specific input or screening assumption. Editing controlled airflow marks it project input but does not acknowledge review. Explicitly review both capacities and `fanWPerM3s`, which covers combined supply/exhaust fans and declared pressure drops. Unsupported defaults, DOAS and recovery configurations require review. Literature warnings are construction/context comparisons, not universal design limits.

Mushroom systems start with null controlled-air minimum and maximum. Enter finite, ordered project-specific values with a positive maximum and acknowledge review, based on species, stage, substrate loading, CO2 target and equipment. There is no universal 6 to 15 ACH mushroom default or CO2 solver.

Optional HRV/ERV acts before optional DOAS on the same stream. Supply balanced-flow ratings at 75% and 100% nominal flow, auxiliary power and a complete frost strategy. HRV transfers sensible heat only; ERV also requires latent ratings. No generic product performance is filled in. DOAS needs treatment capacity, supply dew point and temperature, cooling COP and recoverable reheat fraction. Targets are not guaranteed supply states when the finite heating source is exhausted. See [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030).

Read actual commanded and delivered flow, the stage list, bypass/core flow, conditioning electricity and heat, condensate and unmet load in the results, not the maximum capacity as if it ran all year. The default 0.3 to 40 ACH staged example commands 0.30, 10.23, 20.15, 30.08 and 40.00 ACH before applicable path limitations.

Screens are configured through an imported scenario rather than a form control, the same as the shade and
thermal screens: `shadeScreen`, `thermalScreen` and `insectScreen` are scenario fields, so a screened house
starts from an edited or imported scenario JSON. An installed insect screen multiplies the achievable maximum
outside-air exchange, which in a humid house restricts its cheapest moisture sink. The catalogued grades
`mesh40`, `mesh52` and `mesh78` carry the measured ventilation ratios 1.000, 0.641 and 0.502; an explicit
`ventilationFactor` overrides the grade for a user holding real product data. An installed screen with neither
a catalogued grade nor a declared factor **blocks the run**, because a screen that costs no ventilation is not
a defensible default. The factor is relative to a 40-mesh screened house and **not** to an unscreened one: the
source campaign had no unscreened control, so declaring 1.000 claims a house like the measured 40-mesh one
rather than an unrestricted one, and the ventilation cost of the first screen is unsourced. The declared
minimum ventilation is a requirement rather than a capability, so it is never derated; if the derate would
fall below it, the maximum clamps there and the run says so. No optical or thermal effect of the mesh is
modeled. Measurement, limits and sources are in
[COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#3a-insect-screens-the-ventilation-penalty).

## 5. Add strategies and sensitivity cases

Scenarios in one comparison share the selected site and the electricity customer sector. Price mode (manual or historical) is per scenario, so a scenario dispatched under manual prices can be recosted against the historical series without pretending the dispatch was optimized for it.

Cost-of-precision sweeps (temperature tolerance, VPD band, dew-point cap, photoperiod start) are added as sensitivity sets from the same panel.

## 6. Run and read

Press Run. Results include:

- Joint-band attainment and the misses behind it, by hour, day and month.
- Weather-side modes, including the pad-effective and free-cooling windows, computed independently of the equipment run.
- Equipment runtime: hours with use, equivalent full-load hours and days with use, per component, plus pad viability from the weather screen alone.
- Sensible and latent load decomposition with space SHR, energy, water, condensate and daily light.
- The CO2 enrichment window: hours the strategy holds minimum ventilation with evaporative stages off.
- Comparison across scenarios on the common eligible hour set, with dominance and the operating-cost frontier.
- Across-years and across-sites tables when several weather years or ZIPs are loaded, with the ranking-stability verdict.

The first hour of every continuous weather segment is a warm-up hour, excluded from comparative compliance. Editing an input marks existing results stale rather than silently mixing old and new. Cancel terminates the worker; a canceled run is never displayed as complete.

Operating cost includes purchased electricity, fuel and modeled water. Read the exported `costBasis` for the actual dates and numeric manual or historical state-sector electricity proxy and fuel/water inputs. Capital, maintenance, labor, financing, taxes, demand/fixed charges, time-of-use effects and other unmodeled tariff components are excluded. Installed capital is estimated or user-entered separately. Differences or reductions are model estimates, not quotes or guarantees. A pp comparison is joint target attainment B minus A with both endpoints, not a percent change.

The verified Tulsa 2025 run has 8,760 valid hours but 8,759 common eligible hours. Full-run annual costs include warm-up energy and water; matched comparison costs exclude that hour. Label matched costs as simulated-period costs and never silently substitute them for annual totals.


## 7. Export

| Export | Contains | Does not contain |
|---|---|---|
| Scenario JSON | One scenario's inputs and provenance | Weather, results |
| Run JSON | Scenarios, normalized weather, results, assumptions, provenance | Nothing needed to recompute; this is the reproducibility bundle |
| Hourly CSV | Every result hour for every scenario | Assumption text beyond the header block |
| Report HTML | A standalone printable Grownetics Archive document, with assumptions and provenance sections open by default | The full reproducibility bundle; keep the run JSON as well |
| Design-basis brief | Peak sensible and latent hours with coincident outdoor state and frequency, ventilation air requirement, condensate, pad water, free-cooling hours, binding constraint, strategy verdict, evidence tier | A stamped design, equipment selection, or safety margin |


Imported result claims are discarded and inputs must be rerun. The actual model-0.3.0 browser export was 207,706,978 bytes for six strategies and 8,760 hours; memory remains the practical limit, and parsing runs in a Web Worker. Export hashes and population proof are in [browser-run-metrics.json](browser-run-metrics.json).

## Weather CSV import schema

```csv
time,tempC,rh,pressurePa,ghiWm2
2025-01-01T00:00:00Z,20,0.6,101325,0
2025-01-01T01:00:00Z,19,0.65,101325,0
```

Those two rows illustrate the schema; they are not bundled observations. Units are °C, RH as a fraction, Pa and W/m². Optional columns: `dewPointC` and `windMs` (m/s). Supply RH or dew point. Timestamps must be explicit UTC ISO strings ending `Z`, which is also what disambiguates the autumn daylight-saving fold. Headers must match exactly. Blank values stay missing and are never interpolated.

JSON imports carry `schemaVersion`, explicit units, source and time-zone metadata and the hourly array. An exported run JSON is the easiest full template.

### Scenario schema 2 migration

`migrateScenario` returns a copy; imported outputs are not trusted. Version-1 airflow numbers are preserved, not silently resized, with template-specific evidence status and review gates. Recovery is initialized to `type: 'none'`. Old DOAS supply settings are reset to null, obsolete `doasKWhPerKg` is discarded, and `doasCoolingCOP` plus `doasReheatRecoveryFraction` must be supplied. Unsupported generic/hybrid/opaque defaults require explicit review; mushrooms need project-specific flow. Inert component defaults may be supplied without inventing performance. Unsupported future schema versions fail explicitly. Weather snapshots remain schema 1.

On startup, saved localStorage scenarios migrate individually: a valid legacy entry remains editable, while an unsupported entry is isolated with a warning rather than crashing initialization. Missing treatment inputs or review still block a run. File import is stricter: after migration all scenarios must validate before the file is adopted, so incomplete legacy active-DOAS or mushroom JSON must be completed/reviewed in the input file and reimported. Save/export writes current schema 2.

## Reproducible example

Enter ZIP 74103, select Locate, retrieve or select bundled Tulsa 2025, import [example-scenarios.json](example-scenarios.json), then run all six scenarios. That set stays sited at Tulsa because the published figures below were computed there; re-home it to your own ZIP before reading any number as yours. The [exported example report](example-comparison.html) preserves the assumptions and caveats that belonged to that run, and [example-design-basis.html](example-design-basis.html) is the design-basis brief from the same inputs.
