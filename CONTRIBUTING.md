# Contributing

Thanks for looking. This project has unusual rules, and they are the point: the value of a screening tool is that its numbers can be traced and its limits are stated. Please read this before opening a pull request.

## Run it

```sh
git clone https://github.com/vhark/cea-psychrometric-site-evaluator.git
cd cea-psychrometric-site-evaluator
python3 -m http.server 8150 --bind 127.0.0.1   # then open http://127.0.0.1:8150/
npm test                                    # node --test test/*.test.mjs
```

There is nothing to install. Node 20 or newer runs the tests and the reproduction scripts. Python 3 serves the folder and rebuilds the energy catalogs (`build-energy.py` needs `openpyxl`, and only for a rebuild). Do not open `index.html` over `file://`: ES modules and Web Workers need HTTP.

Verify changes the way the project does: run the tests you affected, then exercise the real interface in a browser. A passing suite is not evidence that a model change is right.

## The rules

### 1. No dependencies, no build step

The application is HTML, CSS and native ES modules, served statically. No bundler, no transpiler, no framework, no package installed at runtime, no CDN script.

The only vendored runtime code is PsychroLib 2.5.0, pinned in `vendor/` with its licence, because psychrometric relations should not be retyped from memory. Adding a second vendored library needs a stated reason that survives the question "what breaks without it".

Why this holds: the tool must be openable from a static host, a USB stick or a corporate laptop with no toolchain, and a result produced in 2026 should still recompute in 2031 without resolving a dependency tree.

### 2. Evidence discipline

Every number in the interface, in an export or in a document carries its basis. Specifically:

- **Never invent data.** No synthetic weather when a fetch fails, no nearest-provider guess when a ZIP has no mapped utility, no reuse of a 2023 emissions factor for a 2019 run. Missing stays missing and stays visible.
- **Label assumptions as assumptions.** Every crop and equipment default carries a `source` string that states where the number came from and what it is not ("Planning assumption: …", "Illustrative …", "User-defined …").
- **Do not upgrade a claim without upgrading the evidence.** The evidence tier is asserted at the lowest level the evidence supports (see [docs/EVALUATION.md](docs/EVALUATION.md)). Raising it requires the benchmark and calibration work in [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md), not a rewording.
- **State what is not claimed.** Every document does this. Keep doing it in yours.
- **Cite the file.** A figure quoted in a document names where it was measured: `docs/VERIFICATION.md`, `docs/morris-screening.json`, `docs/browser-run-metrics.json`, `docs/AUDIT.md`.

A pull request that adds an unlabeled number is not a style problem, it is a correctness problem.

### 3. Test philosophy

The suite exists to catch physics and data errors, not to report coverage. A test earns its place only if a plausible bug would fail it.

**Write a test for:** conservation identities, capacity limits that must bind, sign conventions, unit conversions across a boundary, time handling (UTC, DST, fractional offsets, local-day rollover), missing and malformed data, schema rejection, cadence invariance, and any defect that reached a release.

**Do not write a test for:** a field being copied from one object to another, a default having the value it was just given, a function not throwing, a label's wording, or a mock echoing its input. Prove wiring with a throwaway script and delete it.

Derive the expectation independently of the code under test. The six conservation tests compare against closed-form solutions (the analytic exponential for free-running thermal mass, for example), which is why they are worth their runtime.

If you find an existing test that pins wording or an implementation detail, deleting it is a valid contribution.

### 4. Copy rules

No em dashes: use commas, colons, periods or parentheses. Numbers in the interface are tabular mono. The product is the "CEA Psychrometric Site Evaluator". "Control window" means only the count of hours inside the joint target band, never a controller setting. Terms are defined once, in [docs/GLOSSARY.md](docs/GLOSSARY.md).

### 5. Brand

The interface follows the Grownetics brand system, whose source of truth is [brand.grownetics.com](https://brand.grownetics.com). Interactive tools use Instrument mode (deep-soil ground, phosphor data, IBM Plex Mono); the public explainer and exported documents use Archive mode by default (parchment, DM Sans display, Inter body), regardless of OS theme. The logomark is locked monochrome artwork: black lockup on light grounds, white on dark; never recolor, alter, crop or recreate it. Use CSS custom properties and full-border tinted callouts, never colored side stripes, gradient text or glassmorphism. Grownetics copyright and third-party licence attribution remain intact.

Current release screenshots belong in `site/assets/screenshots/` and ship from that directory unchanged. `docs/screenshots/` is historical, not a source to copy over current site assets. Capture the actual app/report after a behavior or brand change rather than relabeling an old image.

## File ownership map

Keep changes inside one boundary where you can. Concurrent work is divided along these lines.

| Area | Files | Rule |
|---|---|---|
| Contracts and defaults | `src/config.js` | Scenario schema, crop, facility, system and technology catalogs, field limits, validation. Changing the schema is a cross-cutting change: see the contract in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). |
| Physics | `src/physics.js` | Psychrometric state, pad process, weather classification, outdoor drying screen. Pure functions, no DOM, no I/O. |
| Simulation | `src/simulate.js` | Coupled zone integration, controller, equipment dispatch, per-hour result rows. Pure calculation. |
| Air treatment | `src/airflow.js` | Geometry conversions, balanced HRV/ERV, frost/preheat and DOAS enthalpy/COP primitives. One controlled outdoor-air stream, no DOM or dispatch policy. |
| Analysis | `src/metrics.js` | Summaries, comparison and dominance, runtime, loads, enrichment, across-years and across-sites aggregation, design basis. Pure calculation. |
| Screening | `src/sensitivity.js` | Morris design, point application, elementary effects, ranking stability. Importable without a DOM. |
| Data adapters | `src/weather.js`, `src/energy.js` | Retrieval, normalization, provenance, coverage. Never fabricate a value to fill a gap. |
| Interface | `index.html`, `styles.css`, `src/app.js`, `src/charts.js` | No calculation. Charts are views of the same arrays the tables use, never a second approximate calculation. |
| Presentation | `src/report.js`, `src/learn.js`, `src/tour.js` | Shared cost/airflow/conditioning labels, printable Field reports, curriculum and guided navigation. No second physical model. |
| Plumbing | `src/worker.js`, `src/storage.js`, `src/export.js` | Worker protocol (simulate and parse paths), IndexedDB and local storage, portable exports and design-basis brief. |
| Components | `src/screens.js` | Screen and heat-pump evidence, validation and resolvers; dispatch stays in the simulation. |
| Scripts and vintages | `scripts/`, `src/vintages.js` | Acquisition retains source bytes and SHA-256 manifests; studies retain reproducible inputs/results; vintage assessment reads committed provenance. |
| Tests | `test/` | Physical and data boundaries: airflow, model, data, analysis, conservation, screens, examples, regional studies, sensitivity and vintages. |
| Documentation | `README.md`, `docs/` | Index and conventions in [docs/README.md](docs/README.md). |

## How to add a crop

1. Add an entry to `CROPS` in `src/config.js`. Required fields: `label`, `dayTargetC`, `nightTargetC`, `vpdMin`, `vpdMax`, `dliTarget`, `photoperiod`, `lai`, `transpirationLDayM2`, and `source`.
2. The `source` string is mandatory and must be honest about provenance. Compare the existing entries: a measured value says so, a planning figure says "Planning assumption: …" with the arithmetic behind it, and an illustrative value says it is illustrative and must be replaced.
3. Set `transpirationModel: 'schedule'` only if the Stanghellini path is inappropriate for that crop (the mushroom preset does this, because there is no meaningful leaf area to drive it).
4. Check the defaults survive `validateScenario`, then run the crop in the browser for a full year and look at the DLI, moisture and attainment rows before proposing it.

Do not add a crop whose numbers you cannot source. An unsourced preset is worse than no preset, because it will be believed.

## How to add a strategy

1. Add an id and display name to `TECHNOLOGIES` in `src/config.js`.
2. Add its equipment specification to the `specs` map in `applyTechnology`, which sets capacities and installed cost and then scales them by floor area. Any capacity you do not set is explicitly zeroed by the base object, which is what keeps a scenario from dispatching equipment it does not have.
3. If the strategy needs physics that does not exist yet, that belongs in `src/simulate.js`, with finite capacity, an explicit energy and moisture accounting, and heat released where it is really released. Equipment that removes moisture must pay for it in energy and must put its heat somewhere.
4. Name it generically. This tool compares classes of equipment, not products: it carries no manufacturer performance map, and a strategy named after a brand would imply one (see the roadmap M4 gate in [docs/DIGITAL-TWIN.md](docs/DIGITAL-TWIN.md)).
5. Add a conservation test if the strategy introduces a new energy or moisture path.

## How to add a data source

1. Acquisition goes in a script under `scripts/`, never a manual download step in a document. The script retains the original bytes, records a SHA-256 manifest with publisher, source URL, licence, evidence kind and retrieval timestamp, and can re-verify on `--refresh`.
2. The application loads a compact derived artifact, not the raw workbook. Keep the derived catalog committed and the raw input out of the repository if it is large (see `.gitignore`).
3. Document coverage honestly in [docs/ENERGY-DATA.md](docs/ENERGY-DATA.md) or [docs/RESEARCH.md](docs/RESEARCH.md): total records, records with and without a mapping, vintage of each field, and what the dataset cannot establish.
4. Add the licence and attribution to [NOTICE](NOTICE). Public-domain government data still gets attributed.
5. Add a data test for the failure mode that matters: a missing value staying missing, a leading-zero ZIP surviving, a date bound holding, a unit conversion being applied once.

## Pull requests

Use the template. In short: say what changed, how you verified it, and which claim the change does or does not support. Include the measured numbers, not an assertion that it works. If a change moves a published figure, update the document that quotes it and [CHANGELOG.md](CHANGELOG.md) in the same pull request.

Security issues go through [SECURITY.md](SECURITY.md).

## Licence

Contributions are accepted under the MIT licence of this repository (see [LICENSE](LICENSE)). Do not contribute code or data you cannot license that way, and do not add third-party material without its notice in [NOTICE](NOTICE).
