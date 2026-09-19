# Documentation index

Purpose: name every document in this folder, say who it is for, and give a reading order that does not waste your time.

Status: current for model `0.3.0-screening`, scenario schema 2, 2026-09-15.

Read this if: you opened `docs/` and want to know which file answers your question.

## Start here

| If you want to | Read |
|---|---|
| Use the tool | [WORKFLOW.md](WORKFLOW.md) |
| Know what a number on the screen means | [GLOSSARY.md](GLOSSARY.md) |
| Start from a worked comparison | [examples/](examples/README.md) |
| Know how far to trust a result | [EVALUATION.md](EVALUATION.md), then [VERIFICATION.md](VERIFICATION.md) |
| Know which assumption to measure first | [SENSITIVITY.md](SENSITIVITY.md) |
| Learn the psychrometrics the tool applies | the **Learn** tab in the interface, then [REGIONS.md](REGIONS.md) |
| Understand facility topologies and why older class rankings were withdrawn | [CLASSES.md](CLASSES.md) |
| Know what published research actually proves for a humid site | [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md) |
| Know whether a screen, curtain, insect mesh or heat-pump number is measured or assumed | [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) |
| Change the code | [ARCHITECTURE.md](ARCHITECTURE.md), then [IMPLEMENTATION.md](IMPLEMENTATION.md), then [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| Know which weather years ship, or add a site of your own | [CLIMATES.md](CLIMATES.md) |
| [WEATHER-SOURCES.md](WEATHER-SOURCES.md) | Why the tool offers the four weather sources it offers, and why it rejects the others |
| Know where the data came from | [ENERGY-DATA.md](ENERGY-DATA.md) and [RESEARCH.md](RESEARCH.md) |
| Know what happens next | [DIGITAL-TWIN.md](DIGITAL-TWIN.md) |

## Every document

| Document | Purpose | Reader |
|---|---|---|
| [WORKFLOW.md](WORKFLOW.md) | Step-by-step procedure, import schemas, exports and their limits | Anyone running the tool, or reading its output |
| [examples/](examples/README.md) | Reviewed schema-2 comparison inputs, their design questions and current evidence limits | Anyone starting a real comparison |
| [GLOSSARY.md](GLOSSARY.md) | Every domain term with unit, location in the interface, and how it is computed here | Anyone reading a result, report or brief |
| [PRD.md](PRD.md) | Current product requirements plus explicitly historical approved v0.2 scope | Product owner, implementer |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Deployment decision, module boundaries, canonical data contracts, controller design | Implementer, reviewer |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Cross-module interface contract, worker message protocol, file ownership | Implementer |
| [EVALUATION.md](EVALUATION.md) | Evidence ladder and the acceptance gates each tier requires | Reviewer, anyone judging the claims |
| [VERIFICATION.md](VERIFICATION.md) | Checks actually executed, with measured values, commands and dates | Reviewer, auditor |
| [AUDIT.md](AUDIT.md) | Dated independent-review findings and dispositions, with current supersession pointers | Reviewer, maintainer |
| [SENSITIVITY.md](SENSITIVITY.md) | Morris screening: which assumptions move the answer, and whether the ranking survives them | Engineer choosing what to measure, reviewer |
| [CLIMATES.md](CLIMATES.md) | The six reference climates: the 60 complete calendar years the committed studies ran on (the hourly archive is no longer shipped), the provenance of every retrieval, and what a reference year must not be read as | Anyone choosing a site or a year, quoting a climate figure, or adding a site |
| [REGIONS.md](REGIONS.md) | The ten-year, six-climate study: method, recommendation rule, per-region verdict and what each unresolved region needs measured | Anyone choosing equipment for a climate, reviewer |
| [CLASSES.md](CLASSES.md) | Control classes, physical limits and withdrawal of unsupported older facility rankings | Anyone comparing facility topologies |
| [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md) | Graded literature review of what measurement actually establishes for hot-humid CEA, the named gaps, and which of this tool's numbers the evidence can and cannot carry | Anyone acting on a humid-climate result, reviewer, anyone quoting a technology claim |
| [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) | Airflow/recovery/DOAS evidence, screens, envelope and heat-pump parameters with applicability boundaries | Anyone setting a component input |
| [ENERGY-DATA.md](ENERGY-DATA.md) | ZIP, utility, price and grid catalogs: coverage counts, vintages, join limits, rebuild procedure | Data maintainer, anyone quoting a price or an emissions factor |
| [RESEARCH.md](RESEARCH.md) | Landscape review, literature anchors and public source register behind the build decision | Reviewer, anyone asking why this exists |
| [DIGITAL-TWIN.md](DIGITAL-TWIN.md) | Roadmap M1 to M6, with the claim each milestone earns and the gate it must pass | Product owner, reviewer |
| [Airflow implementation plan](superpowers/plans/2026-09-15-ach-airflow-recovery-cost-labels.md) | Historical approved task sequence, not the current completion checklist or API | Maintainer reviewing design history |
| [Airflow design specification](superpowers/specs/2026-09-15-ach-airflow-recovery-cost-labels-design.md) | Historical design intent, with current implementation and evidence pointers | Maintainer reviewing the cutover |

## Committed evidence artifacts

These are data, not prose. They are the primary record behind the numbers in the documents above.

| File | What it holds |
|---|---|
| [morris-screening.json](morris-screening.json) | The full committed Morris run: design, per-point results, effects and stability |
| [regional-study.json](regional-study.json) | The full regional study: 360 full-year simulations, per-year rows, weather-side medians, design conditions and the verdict the Learn tab renders |
| [browser-run-metrics.json](browser-run-metrics.json) | Measured metrics and export hashes from the full-year six-strategy browser run |
| [seasonal-step-check.json](seasonal-step-check.json) | Historical seasonal cadence comparison for its recorded model/cases, not blanket convergence proof for current treatment topologies |
| [step-sensitivity.json](step-sensitivity.json), [step-refinement.json](step-refinement.json) | Earlier cadence experiments, retained as development history, not as accuracy claims |
| [example-scenarios.json](example-scenarios.json) | The six portable strategy configurations of the canonical published run, sited at Tulsa because that is where its figures were computed |
| [example-comparison.html](example-comparison.html) | The exported comparison report from the verified browser run |
| [example-design-basis.html](example-design-basis.html) | The exported design-basis brief from the same inputs |
| [research-evidence/](research-evidence/) | Raw access probes and a small observation fetch from the research phase |

## Conventions used across these documents

- The product is the **CEA Psychrometric Site Evaluator**. Not "the calculator", not "the load tool".
- **Control window** means only one thing: the count of hours inside the joint target band. It never refers to a controller setting or a dispatch interval.
- Every figure carries its basis. A number without a source, a date or a stated assumption is a defect, not a style choice.
- Dates are ISO. Units are SI in inputs, with US equivalents displayed where the interface offers them.
- Documents state what is **not** claimed as explicitly as what is.
- Grownetics interactive tools use Instrument mode; reports and handoffs default to Archive mode independent of OS theme.
- Scenario and run-bundle schema is 2. Weather snapshots and the regional artifact envelope remain schema 1; regional scenarios are schema 2. Morris envelope is 2.
- Every operating-cost number names its population, period, inclusions, numeric price basis and exclusions. Capital is separate; no result is a quote or guaranteed savings.
- Differences in joint temperature-and-moisture target attainment use percentage points (pp) and both endpoints. Morris effects instead use pp per full screened range, not fictitious paired endpoints.
- Historical audit, research and design records retain their dates and model versions; they do not supersede regenerated current artifacts.
