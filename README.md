# CEA Psychrometric Site Evaluator

Screen a controlled-environment agriculture site against real historical weather: how many hours the climate gives you for free, what constraint binds, and which class of equipment closes the gap at what running cost.

[![tests](https://github.com/vhark/cea-psychrometric-site-evaluator/actions/workflows/test.yml/badge.svg)](https://github.com/vhark/cea-psychrometric-site-evaluator/actions/workflows/test.yml)
[![model](https://img.shields.io/badge/model-0.4.0--screening-5E9643)](docs/VERIFICATION.md)
[![runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-none-5E9643)](#quick-start)
[![licence](https://img.shields.io/badge/licence-MIT-5E9643)](LICENSE)
[![demo](https://img.shields.io/badge/demo-GitHub%20Pages-5E9643)](https://vhark.github.io/cea-psychrometric-site-evaluator/)


A Grownetics open-source tool. Static HTML and JavaScript, no build step, no backend, no account. Everything computes in your browser. Interactive tools use Instrument mode; exported documents use Archive mode by default regardless of operating-system theme.

> **Evidence tier: assumption-based screening.** This is a coarse planning screen. It is not a calibrated greenhouse digital twin, not equipment sizing, not a manufacturer comparison, and not a guarantee of indoor conditions. See [Evidence tiers](#evidence-tiers) and [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md).

For a single air-state question, start with **[the learning lab](lab/)**: dry bulb, RH or dew/frost point, pressure, and four short process lessons. No weather account or facility configuration is required.

## What it answers

Three questions about a specific site, crop band and equipment class, before capital is committed:

1. **What does the climate give for free?** Hours the outside air alone can cool, dry or humidify the zone, with the pad-effective and free-cooling windows counted separately.
2. **What is the binding constraint?** Temperature margin or moisture ceiling, hour by hour and month by month, with the sensible and latent split behind it.
3. **What closes the gap, and at what running cost?** Six equipment strategies compared on joint-band attainment, energy, water and operating cost over ten weather years, with a computed ranking-stability verdict.

## Live demo

| Surface | URL |
|---|---|
| Explainer site | https://vhark.github.io/cea-psychrometric-site-evaluator/ |
| The tool itself | https://vhark.github.io/cea-psychrometric-site-evaluator/app/ |
| Air-state learning lab | https://vhark.github.io/cea-psychrometric-site-evaluator/app/lab/ |

The Pages workflow publishes the explainer from `site/` at the root and packages this static calculator at `/app/` on pushes to `main`. Calculations and saved scenarios remain in your browser; triggered public weather requests transmit selected location/dates, and hosted assets/fonts generate ordinary network requests (see [SECURITY.md](SECURITY.md)). The release gallery uses `site/assets/screenshots/`; `docs/screenshots/` contains historical captures and is not the current UI reference.

## Quick start

Requirements: Python 3 (any static server works) and a current browser with ES modules, Web Workers and IndexedDB. Node 20 or newer is needed only for tests and the reproduction scripts. Serving the app needs no package installation. Browser verification uses the development-only Playwright package.

```sh
git clone https://github.com/vhark/cea-psychrometric-site-evaluator.git
cd cea-psychrometric-site-evaluator
python3 -m http.server 8150 --bind 127.0.0.1
```

Then open **http://127.0.0.1:8150/** and:

1. Enter the site **ZIP** and select **Locate**, then retrieve weather for the period you want to screen. Nothing loads until you ask for it, and no site is assumed. Year chips appear under **Weather years** for every calendar year already retrieved for these coordinates and time zone, in this session or from the browser cache. No hourly weather ships in the repository; each year is fetched once and cached locally.
2. Import [docs/example-scenarios.json](docs/example-scenarios.json) for the six-strategy comparison.
3. Under **Run all scenarios**, review each scenario’s displayed minimum and maximum outdoor-air rates, fan power and evidence basis, then check its box. **Edit outdoor air** opens that scenario’s inputs. Resolve any other input errors, press **Run all scenarios**, then read attainment, misses, loads, runtime and cost.
4. Open **Show the arithmetic for this hour** in the hourly inspector to see every step from the raw weather row to the mode, with that hour's own numbers substituted. `node scripts/worked-example.mjs` prints the same steps for two real Tulsa hours, or for any hour of a saved snapshot.

Do not open `index.html` through `file://`: module fetches and workers require HTTP.

Full workflow, including ZIP selection, live weather retrieval, CSV import and exports, is in [docs/WORKFLOW.md](docs/WORKFLOW.md).

## What is modeled, and what is not

| Modeled | Not modeled |
|---|---|
| Coupled single-zone sensible and moisture balance with finite equipment capacity, analytic linear exchange and physical equilibrium condensation | Spatial gradients, multi-zone or 3-D air movement, canopy-to-air temperature difference |
| Staged deadband controller on a one-minute dispatch step (ideal per-substep optimizer retained as a labeled upper bound) | Real control hardware behaviour, commissioning, sensor placement, failure resilience |
| Stanghellini transpiration from leaf area, absorbed radiation and zone VPD (fixed L/m²/day schedule kept as a fallback) | Crop physiology, growth stages, yield, CO2 feedback on stomata |
| Condensing dehumidification, coupled DX, recovered reheat, balanced HRV/ERV with explicit frost strategy, DOAS enthalpy/COP conditioning on one controlled outdoor-air stream | Manufacturer performance maps, pressure-network natural ventilation, internal recirculation and canopy air velocity |
| Generic desiccant with finite removal, regeneration energy, purchased electric and fuel split, explicit sorption heat; hybrid indirect evaporation with a separate wet secondary stream | Any named product (no Blue Frontier or AGronomic IQ map is claimed), desiccant storage scheduling, water quality and bleed |
| Evaporative pad as an approximately isoenthalpic process at a stated saturation effectiveness | Face-velocity-dependent effectiveness, fouling, uneven wetting |
| Historical solar driving optical DLI separately from thermal gain, footprint photons shared over stacked canopy, causal supplemental lighting, declared movable screens | Detailed glazing optics, incidence-angle models, real natural-vent pressure flow |
| Historical state and sector average electricity prices applied to the resulting dispatch | Utility tariffs, demand charges, riders, time-of-use optimization, hourly marginal emissions |

Constant-property and ideal-modulation assumptions are exported with every result, so a reader can see which of the above applied to a given number.

## Evidence tiers

| Tier | What it takes | Status here |
|---|---|---|
| 1. Weather feasibility | Traceable outside state, vetted psychrometrics, target bands | Met |
| 2. Assumption-based equipment screen | Coupled model, conservation and numerical checks, declared assumptions | **Current tier** |
| 3. Benchmarked simulation | Matched run against an independent model and published measured data | Not met (roadmap M5) |
| 4. Site-calibrated analysis | Held-out facility sensor, energy and condensate data, documented calibration | Not met (roadmap M6) |

The full ladder, with the output each tier permits and the implication each tier prohibits, is in [docs/EVALUATION.md](docs/EVALUATION.md).

## Key results from the bundled example

The retained historical study evidence is model `0.3.0-screening` (current application: `0.4.0-screening`), scenario schema 2. The actual browser run used Tulsa 2025, 8,760 valid hours and 8,759 eligible hours after one warm-up hour. Its full-run totals include warm-up; matched comparison costs cover only the common eligible set. These populations must not be mixed.

| Current result | Value | Source |
|---|---|---|
| Joint temperature-and-moisture target attainment, pad baseline versus DX plus dehumidifier | 27.135% versus 73.066%, an increase of 45.931 percentage points (pp) of eligible hours | [Browser run](docs/browser-run-metrics.json) |
| Baseline model-estimated annual operating cost, all 8,760 valid hours | $22,064.29 | [Browser run](docs/browser-run-metrics.json) |
| Baseline model-estimated operating cost on 8,759 common eligible hours | $22,060.97, not the full-year total | [Browser run](docs/browser-run-metrics.json) |
| Regional evidence | 360 full-year simulations, zero numerical-failure hours | [REGIONS.md](docs/REGIONS.md) |
| Morris aggregate joint-attainment mu* per full screened range | LAI/transpiration 9.098627 pp; maximum controlled outdoor-air capacity 2.164460 pp | [SENSITIVITY.md](docs/SENSITIVITY.md) |
| Morris evidence | 1,872 simulations, 104 design points, zero numerical-failure hours | [Morris artifact](docs/morris-screening.json) |

Operating costs include purchased electricity, purchased heating fuel and modeled water at manual $0.12/kWh electricity, $0.045/kWh fuel and $0.002/L water. They exclude installed capital, maintenance, labor, financing, taxes, demand/fixed charges, time-of-use effects and other unmodeled tariff components. They are not quotes or guaranteed savings. Estimated or user-entered installed capital is reported separately.

**Withdrawn:** the old $39,517 DOAS result and every operating-cost reduction derived from it omitted sensible conditioning energy. No general recommendation to close a hybrid greenhouse follows from the earlier comparisons. A 6 ACH case is a capacity experiment, not a recommended rate; 15 ACH is constrained semi-closed operation, not a conventional open-greenhouse benchmark.

See [COMPONENT-PARAMETERS.md](docs/COMPONENT-PARAMETERS.md) for construction-specific infiltration and controlled-air guidance, [WORKFLOW.md](docs/WORKFLOW.md) for explicit airflow review and migration, and [VERIFICATION.md](docs/VERIFICATION.md) for executed checks. No site calibration, independent model benchmark or product-performance validation is claimed.

## Example scenarios

Load a weather record, then **Import JSON / CSV** and pick a set from [docs/examples/](docs/examples/README.md). Each set is a comparison that answers one design question: coupled reheat against decoupled latent removal, an opaque indoor rack farm, a near-saturated mushroom room, a moisture-bound propagation nursery, and a semi-closed hybrid with a tall crop. The canonical six-strategy comparison stays in [docs/example-scenarios.json](docs/example-scenarios.json).

## Learn tab


The interface has two views. **Analyze** is the calculator. **Learn** is a ten-part curriculum that teaches the
psychrometrics behind the screening in the order the tool applies it: reading the outdoor state, what attainment
is a percentage of, what the climate gives free, the sensible/latent split, outside air as a dehumidifier, the
capacity frontier, screens as a schedule, why one year is an anecdote, what actually moves the answer, and a
closing section that reports what ten weather years recommend in each bundled region. Each part carries the
relationship it teaches and a button that switches to Analyze and highlights the panel where you would read it,
so the concept and its evidence are never separated. The four per-hour sections also follow two real NASA POWER hours,
a January afternoon and a July afternoon at Tulsa, through the arithmetic step by step, recomputed at load time from
[data/weather/sample-hours.json](data/weather/sample-hours.json) by `src/steps.js`. Modules are linkable: `#learn/uncertainty`,
`#learn/regional-findings`.

The closing section is generated, not written. [docs/regional-study.json](docs/regional-study.json) is produced by
`node scripts/regional-study.mjs` (360 full-year simulations: 6 sites x 10 years x 6 strategies) and
[docs/REGIONS.md](docs/REGIONS.md) states the recommendation rule, including when the evidence does not resolve a
region and what measurement would. Three of the six regions currently return no recommendation, by rule: Phoenix, Denver and Seattle.

## Documentation

| Document | Purpose |
|---|---|
| [docs/README.md](docs/README.md) | Index of every document with reading order |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Every domain term the interface uses, with unit and how it is computed here |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Step-by-step use of the tool, import formats, exports and their limits |
| [docs/PRD.md](docs/PRD.md) | Current requirements and explicitly historical approved v0.2 scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deployment decision, module boundaries, data contracts, controller design |
| [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) | Cross-module interface contract and file ownership |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Evidence ladder, acceptance gates and the checks each tier requires |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Checks actually executed, with measured values and dates |
| [docs/AUDIT.md](docs/AUDIT.md) | Dated independent-review findings/dispositions and current supersession pointers |
| [docs/SENSITIVITY.md](docs/SENSITIVITY.md) | Morris screening: which assumptions move the answer, and whether the ranking survives |
| [docs/REGIONS.md](docs/REGIONS.md) | The ten-year regional study: method, recommendation rule, and the verdict for each reference climate |
| [docs/CLASSES.md](docs/CLASSES.md) | Facility topology vocabulary, physical limits and withdrawal of unsupported older class rankings |
| [docs/COMPONENT-PARAMETERS.md](docs/COMPONENT-PARAMETERS.md) | Current airflow, recovery, DOAS, screen and heat-pump assumptions and evidence limits |
| [docs/CLIMATES.md](docs/CLIMATES.md) | Six reference climates and the 60 weather years behind the retained studies; provenance and retrieval procedure |
| [docs/EVIDENCE-HOT-HUMID.md](docs/EVIDENCE-HOT-HUMID.md) | What measured research proves for hot-humid CEA, graded by evidence tier, with the gaps named |
| [docs/ENERGY-DATA.md](docs/ENERGY-DATA.md) | ZIP, utility, price and grid catalogs: coverage, vintages and limits |
| [docs/RESEARCH.md](docs/RESEARCH.md) | Landscape review and source register behind the build decision |
| [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md) | Roadmap M1 to M6 to a calibrated twin, with the claim each milestone earns |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to run, the no-dependency rule, evidence discipline, test philosophy |
| [SECURITY.md](SECURITY.md) | What leaves the browser, and how to report an issue |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Data sources and vintages

| Dataset | Vintage | What it is, and is not |
|---|---|---|
| NASA POWER hourly meteorology and solar | Retained studies cover six sites, 2016 to 2025; the hourly archive is not shipped. New retrievals retain their own dates and provenance | A gridded reconstruction with UTC source timestamps and original payloads retained. RE hourly solar Wh/m² becomes interval-mean W/m² over one hour. Canonical RH is authoritative; inconsistent auxiliary dew and frost points are flagged, never used to overwrite RH. Not station truth. |
| Iowa Environmental Mesonet station observations | Archived study period 2026-01-01 to 2026-09-11 | Routine observations nearest the UTC hour within 30 minutes, original timestamps kept, estimated station pressure flagged. Missing observations never receive NASA meteorology. Solar is independently sourced and can be unavailable. |
| GeoNames ZIP inventory | Retrieved 2026-09-11 | 42,185 records, 39,146 with dated candidate utilities, 27,037 with several candidates, 3,039 with none mapped, 479 mapping-only records without invented coordinates. Not a certified current USPS inventory, and a ZIP does not identify street service. |
| OpenEI utility to ZIP mapping | Mapping year 2021 | Candidate providers only. Not a service-territory determination. |
| EIA state and sector electricity prices | 30,729 monthly observations, generally 2010 through June 2026 (Puerto Rico starts later) | Average price proxies. Not utility tariffs, and no demand charges, riders or time-of-use structure. |
| EPA eGRID generation mix and CO2 | 2023 | Annual subregion generation mix and total-output CO2, preserving multiple ZIP subregions. Other years receive no emissions estimate rather than a silently reused 2023 factor. Regional generation is not utility procurement and not marginal emissions. |
| PsychroLib | 2.5.0, pinned commit | Vendored MIT psychrometric library. |

Original URLs, licences, SHA-256 manifests and coverage counts are in [docs/ENERGY-DATA.md](docs/ENERGY-DATA.md), [docs/RESEARCH.md](docs/RESEARCH.md) and [NOTICE](NOTICE). Where a historical price is missing, the tool reports an unknown total plus a labeled known subtotal; it never falls back to today's price.

## Reproducing the datasets and the screening

```sh
python3 scripts/fetch-weather.py        # NASA POWER snapshots with original payloads
python3 scripts/build-energy.py         # ZIP, utility, price and grid catalogs
node scripts/fetch-observed.mjs         # IEM station observations plus independent solar
node scripts/reference-study.mjs        # the observed weather-only Tulsa study
node scripts/morris-screening.mjs       # Morris elementary-effects screening
node scripts/regional-study.mjs         # 360 full-year six-site/six-strategy runs
```

`build-energy.py` uses openpyxl for source workbooks: install it in a virtual environment if unavailable. Cached raw files are checked against their local acquisition hashes. Missing files or `--refresh` download current upstream bytes and record new hashes, so mutable sources need not reproduce the archived snapshot. Source updates can legitimately change data and cutoff dates.

The committed Morris run is 1,872 simulations over 104 design points (8 trajectories, 12 parameters, three years, 120 sampled local days per year), seed 1. Its costs are sampled-period totals, not annual cost. Same seed and inputs reproduce numerical results; timestamps and elapsed time are provenance, not numerical outputs. Faster variant:

```sh
node scripts/morris-screening.mjs --years 2016,2025 --trajectories 4 --days 60 --out /tmp/quick.json
```

The observed study in [reference-study/](reference-study/) keeps the weather-only classification separate from the coupled screen: raw and derived hourly CSV, mode, month and day-night summaries, calendar exposures, episodes, percentiles, 16 sensitivity cases, a NOAA daily-extrema cross-check, manifest, Markdown report and HTML charts. Its archived 2026 period contains 6,087 hourly slots, 6,064 observed valid hours and 23 missing, ending 2026-09-11 21:00 UTC exclusive. No complete-year claim is made.

## Testing

```sh
npm test                      # node --test test/*.test.mjs
npm ci                        # development-only browser runner
npx playwright install chromium
npm run test:browser           # isolated root and assembled /app/ workflows
node --test test/model.test.mjs
```

The tests defend observable physical and data boundaries: conservation, finite control authority, one-stream airflow treatment, migration and review gates, incomplete treatment performance, frost and heating limits, screen effects, temporal billing and missing data. Current executed evidence and the scope of the final integration run are recorded in [VERIFICATION.md](docs/VERIFICATION.md), not a fixed badge count.

They are **not empirical greenhouse validation**. A passing suite says the code does what the model says, not that the model matches a real greenhouse.

## Roadmap

| Milestone | Goal | Status |
|---|---|---|
| M0 | v0.2 site-evaluator sprint: multi-year, multi-site, load split, enrichment window, precision sweeps, design-basis brief | Done, 2026-09-13 |
| M1 | Causal staged controller and scoped cadence checks | Implemented; historical case-specific evidence in [VERIFICATION.md](docs/VERIFICATION.md) |
| M2 | State-coupled crop load (Stanghellini transpiration) | Done |
| M3 | Quantified structural sensitivity (Morris) | Implemented; current-model regeneration 2026-09-15 in [SENSITIVITY.md](docs/SENSITIVITY.md) |
| M4 | Equipment maps where they matter | Open |
| M5 | Matched independent-model and measured-data benchmark (evidence tier 3) | Open |
| M6 | Site-calibrated analysis with held-out validation (evidence tier 4) | Open |

Each milestone states the claim it earns, and nothing beyond it, in [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md).

## Repository scope

This public repository holds the tool, its public data catalogs and its documentation. Two things are deliberately not here, both listed in `.gitignore`:

- `private/`: material belonging to a client engagement, including an audit of a client's own separate internal calculator. It stays with that engagement.
- `data/energy/raw/`: original public-data archives/workbooks regenerated by `scripts/build-energy.py`. Existing local downloads are checksum-checked; a refresh records new mutable upstream bytes and provenance rather than promising identical historic hashes. Derived runtime catalogs and their dated manifests are committed.

The tool ships with no default site: a new scenario has no ZIP, no coordinates and no time zone, and says so until you locate it. The retained studies cover six climate archetypes (Phoenix, Miami, Denver, Seattle, Fairbanks and Tulsa) over ten NASA POWER weather years each. Their hourly archive is not shipped. Retrieve weather for any site, or import a saved snapshot; retrieved years can be reused from the browser cache. No site is privileged, and every crop, envelope, equipment and price input is an editable, labeled assumption.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Three rules carry most of the weight: no runtime dependencies and no build step, every number carries its basis, and a test earns its place only by defending a real physical or data boundary.

## Licence

Application code is MIT, see [LICENSE](LICENSE). Third-party software and dataset terms, including the vendored PsychroLib 2.5.0 and every public data source, are listed in [NOTICE](NOTICE). Brand names and marks are not licensed as trademarks.
