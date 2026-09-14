# Documentation index

Purpose: name every document in this folder, say who it is for, and give a reading order that does not waste your time.

Status: current for model `0.2.0-screening`, 2026-09-14.

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
| Choose between pads, a dehumidifier, a curtain, lights or an opaque box | [CLASSES.md](CLASSES.md) |
| Know what published research actually proves for a humid site | [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md) |
| Change the code | [ARCHITECTURE.md](ARCHITECTURE.md), then [IMPLEMENTATION.md](IMPLEMENTATION.md), then [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| Know where the data came from | [ENERGY-DATA.md](ENERGY-DATA.md) and [RESEARCH.md](RESEARCH.md) |
| Know what happens next | [DIGITAL-TWIN.md](DIGITAL-TWIN.md) |

## Every document

| Document | Purpose | Reader |
|---|---|---|
| [WORKFLOW.md](WORKFLOW.md) | Step-by-step procedure, import schemas, exports and their limits | Anyone running the tool, or reading its output |
| [examples/](examples/README.md) | Importable comparison sets, one per design question, with what each showed on Tulsa 2025 | Anyone starting a real comparison |
| [GLOSSARY.md](GLOSSARY.md) | Every domain term with unit, location in the interface, and how it is computed here | Anyone reading a result, report or brief |
| [PRD.md](PRD.md) | Product requirements and approved scope, including the v0.2 site-evaluator contract in §10 | Product owner, implementer |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Deployment decision, module boundaries, canonical data contracts, controller design | Implementer, reviewer |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Cross-module interface contract, worker message protocol, file ownership | Implementer |
| [EVALUATION.md](EVALUATION.md) | Evidence ladder and the acceptance gates each tier requires | Reviewer, anyone judging the claims |
| [VERIFICATION.md](VERIFICATION.md) | Checks actually executed, with measured values, commands and dates | Reviewer, auditor |
| [AUDIT.md](AUDIT.md) | Independent review findings, the fix for each, and the status of every open item | Reviewer, maintainer |
| [SENSITIVITY.md](SENSITIVITY.md) | Morris screening: which assumptions move the answer, and whether the ranking survives them | Engineer choosing what to measure, reviewer |
| [REGIONS.md](REGIONS.md) | The ten-year, six-climate study: method, recommendation rule, per-region verdict and what each unresolved region needs measured | Anyone choosing equipment for a climate, reviewer |
| [CLASSES.md](CLASSES.md) | The classes of environmental control, what exhausts each one, and what each achieved in six climates including a subarctic site | Anyone choosing a facility type, or asking whether a greenhouse is worth building at a latitude |
| [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md) | Graded literature review of what measurement actually establishes for hot-humid CEA, the named gaps, and which of this tool's numbers the evidence can and cannot carry | Anyone acting on a humid-climate result, reviewer, anyone quoting a technology claim |
| [ENERGY-DATA.md](ENERGY-DATA.md) | ZIP, utility, price and grid catalogs: coverage counts, vintages, join limits, rebuild procedure | Data maintainer, anyone quoting a price or an emissions factor |
| [RESEARCH.md](RESEARCH.md) | Landscape review, literature anchors and public source register behind the build decision | Reviewer, anyone asking why this exists |
| [DIGITAL-TWIN.md](DIGITAL-TWIN.md) | Roadmap M1 to M6, with the claim each milestone earns and the gate it must pass | Product owner, reviewer |

## Committed evidence artifacts

These are data, not prose. They are the primary record behind the numbers in the documents above.

| File | What it holds |
|---|---|
| [morris-screening.json](morris-screening.json) | The full committed Morris run: design, per-point results, effects and stability |
| [regional-study.json](regional-study.json) | The full regional study: 360 full-year simulations, per-year rows, weather-side medians, design conditions and the verdict the Learn tab renders |
| [browser-run-metrics.json](browser-run-metrics.json) | Measured metrics and export hashes from the full-year six-strategy browser run |
| [seasonal-step-check.json](seasonal-step-check.json) | The seasonal cadence comparison behind the controller convergence evidence |
| [step-sensitivity.json](step-sensitivity.json), [step-refinement.json](step-refinement.json) | Earlier cadence experiments, retained as development history, not as accuracy claims |
| [example-scenarios.json](example-scenarios.json) | The six portable strategy configurations of the bundled example |
| [example-comparison.html](example-comparison.html) | The exported comparison report from the verified browser run |
| [example-design-basis.html](example-design-basis.html) | The exported design-basis brief from the same inputs |
| [research-evidence/](research-evidence/) | Raw access probes and a small observation fetch from the research phase |

## Conventions used across these documents

- The product is the **CEA Psychrometric Site Evaluator**. Not "the calculator", not "the load tool".
- **Control window** means only one thing: the count of hours inside the joint target band. It never refers to a controller setting or a dispatch interval.
- Every figure carries its basis. A number without a source, a date or a stated assumption is a defect, not a style choice.
- Dates are ISO. Units are SI in inputs, with US equivalents displayed where the interface offers them.
- Documents state what is **not** claimed as explicitly as what is.
