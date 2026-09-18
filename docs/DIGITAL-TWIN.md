# Next iteration: a calibrated greenhouse digital twin

Purpose: define the ordered route from the current assumption-based screen to a calibrated twin, and state exactly which claim each milestone earns.

Status: roadmap, reconciled to model `0.3.0-screening` on 2026-09-15. M0, M1 and M2 shipped in v0.2; M3 was regenerated for v0.3 (see [SENSITIVITY.md](SENSITIVITY.md)). M4 to M6 remain open. The 2026-09-14 bounded search did not identify a suitable measured hot-humid benchmark; that is an evidence-acquisition gap, not proof that no dataset exists. Nothing here certifies an unmet gate.

Read this if: you are planning the next iteration, or you want to know what would have to be true before this tool could be called a digital twin.

The user explicitly separates this from the current coarse component screen. The current browser tool makes conditional comparisons under declared assumptions. It does not become a digital twin by adding more decimal places or equipment brands.

## Ordered milestones (2026-09-12 audit)

The sections below this one describe the destination. This section is the route. The 2026-09-12 audit found the original roadmap made one unordered leap from "coarse screen" to "calibrated twin" with no intermediate claims; the two cheapest accuracy wins (a converged controller, a state-coupled crop load) were bundled into the largest work items and would never have been scheduled first. The order below puts them first because they decide whether any later benchmark compares physics or compares controller artifacts.

**M0 (v0.2, 2026-09-13): site-evaluator sprint.** Before M1-M6, PRD §10 adds evidence breadth over physics depth: multi-year climate risk, multi-site comparison, sensible/latent decomposition, CO₂ enrichment window, cost-of-precision sweeps, a design-basis brief, and the two cheap accuracy items M1 (staged controller) and M2 (Stanghellini transpiration) executed inside the same sprint. Claim after M0: "assumption-based screen with numerically converged control, physically coupled latent load, and results reported as a distribution over ten weather years." Landed since the sprint, on the same tier and recorded in [PRD.md](PRD.md) §11: a sixth bundled site and ten complete years at each of six sites (60 site-years), the control-class ladder in [CLASSES.md](CLASSES.md), a Learn view, the graded evidence review in [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md), and the insect-screen ventilation derate. They add breadth, teaching and honesty rather than fidelity, so the M0 claim is unchanged by them.

Current qualification: the cadence measurements above belong to v0.2 and do not certify every v0.3 topology. The earlier class ladder is withdrawn as current numerical evidence. M1/M2 describe shipped mechanisms; the full proposed milestone acceptance checks below, including an independent canopy-model comparison, must not be inferred from those implementation statuses. Current executed checks are in [VERIFICATION.md](VERIFICATION.md).

| # | Goal | Deliverable | Acceptance | Effort | Depends on |
|---|---|---|---|---|---|
| M1 | Converged controller | Deadband/staged causal controller as default (per-device hysteresis, minimum on/off, ordered stages). Keep the current enumerating dispatcher as a labeled "ideal modulation upper bound". | Full-year six-strategy run at 1 / 0.5 / 0.25 min meets EVALUATION §4 gates: energy < 1%, attainment < 0.5 pp, T max < 0.2 K; ranking of the six unchanged. | S | none |
| M2 | State-coupled crop load | Stanghellini (1987) Penman-Monteith transpiration from canopy net radiation (solar + fixture W already computed), zone VPD, LAI and a radiation/VPD/T stomatal resistance. Keep L/m²/day as a sensitivity fallback only. | Daily transpiration within 10% of GreenLight's canopy submodel on identical forcing; conservation residuals unchanged; latent load visibly responds to dehumidification action. | S/M | none (parallel with M1) |
| M3 (done 2026-09-14, see [SENSITIVITY.md](SENSITIVITY.md)) | Quantified structural sensitivity | Morris screening over ~12 parameters (U, infiltration, transpiration, pad effectiveness, SHR, COP, solar heat fraction, shade, capacities) × six strategies, plus two more NASA POWER weather years. Report non-dominated-set stability. | Published parameter ranking; every comparison labeled "ranking stable / unstable under screened ranges". | M | M1, M2 |
| M4 | Equipment maps where they matter | EnergyPlus-format DX capacity/EIR biquadratic curves; pad saturation effectiveness vs face velocity; wind/stack natural ventilation from POWER wind; out-of-domain flags. | Runs report map source or "assumed constant"; never extrapolate silently; delta vs constant-COP baseline documented. | M | M3 (do what M3 ranks highest first) |
| M5 (open; suitable measured humid-climate data not identified) | Benchmarked simulation (EVALUATION tier 3) | Reproduce the Katzin 2020 Bleiswijk case in GreenLight; then GreenLight vs CEA Psychrometric Site Evaluator on Tulsa 2025 with matched envelope/crop/setpoints; reconcile against Katzin 2021 warm-climate runs. | Proposed gates: hourly T RMSE ≤ 1.5 K, humidity ratio ≤ 1 g/kg, monthly energy within 15% on matched cases; day/night and extreme-hour breakdown published. | L | M2, M4 |
| M6 | Site-calibrated (EVALUATION tier 4) | Instrumented campaign (protocol below) at a partner greenhouse or a first production zone; identifiable-parameter fit; held-out report. | Held-out hourly T bias ≤ 0.5 K, RMSE ≤ 1.0 K; dew-point RMSE ≤ 1.0 K; HVAC energy CV(RMSE) ≤ 30% hourly / 15% daily, NMBE ≤ 10% / 5% (ASHRAE Guideline 14 style). | L | M5, facility access |

Known limits of this order: M5's GreenLight comparison cannot validate equipment (GreenLight itself uses a specified COP/capacity), which is why M4 precedes it; the only published dataset named so far (Katzin 2020, Dutch winter) exercises heating/condensation/transpiration but not pad, DX or dehumidification paths, so M5 needs the Tulsa model-to-model run, not just the Bleiswijk reproduction.

### Evidence-acquisition gap: no suitable benchmark identified in the 2026-09-14 search

The bounded [evidence review](EVIDENCE-HOT-HUMID.md#7-named-gaps-and-the-measurement-that-would-close-each) did not identify an independent hot-humid greenhouse dataset covering the required latent/energy boundary, or a published hot-humid latent validation in the greenhouse models it reviewed. This is a dated search finding, not an exhaustive absence claim. GreenLight's cited validation is Dutch (temperature RMSE 1.74 to 2.04 °C, RH RMSE 5.52 to 8.50 pp); the inspected Vanthoor lineage covers temperate, Mediterranean and semi-arid sites. The released Bleiswijk trial has five-minute observations over 112 winter days but no facility electricity series; the Korean paprika campaign has ten-minute/hourly observations over 278 days but simulation-only heating. Their boundaries do not establish hot-humid HVAC accuracy.

This leaves three practical requirements:

1. **M5's measured hot-humid gate is not met by the available evidence.** The Bleiswijk reproduction and matched Tulsa/Miami model-to-model comparisons are reachable work, but agreement between models is verification, not measured accuracy. Continue dataset discovery, seek author access or commission a suitable campaign.
2. **If M6 provides the first suitable measured evidence, report that explicitly.** Require independent mass/energy closure before fitting, identifiable parameters and a held-out evaluation. Do not describe calibration as confirmation of an earlier hot-humid benchmark that was never completed.
3. **A campaign that could close the gap is defined:** two strategies against a shared crop band in an instrumented hot-humid facility, separated compressor/pump/fan/reheat/heat-rejection metering, collected condensate, a closed crop water balance and reported out-of-band hours. Until suitable evidence is obtained, humid-climate results remain conditional screening estimates with unvalidated magnitudes. See historical audit item 7 in [AUDIT.md](AUDIT.md).

### Claim ladder

- After M1: "assumption-based screen with measured cadence behavior on the tested cases." The historical staged-controller checks replace the old ideal-controller caveat only for their exercised scope, not every new topology.
- After M2: "screen with physically coupled crop moisture load." Still no accuracy claim.
- After M3: "screen with quantified structural sensitivity; each ranking carries a stability label." First point at which "close rankings are exploratory" becomes a computed statement instead of a disclaimer.
- After M4: "equipment-map-based screen for products with supplied maps; constant-performance badge otherwise." Brand comparisons remain prohibited without maps.
- After M5: tier 3, documented benchmark errors for the covered conditions only. A model-to-model humid-climate comparison alone cannot earn this tier; suitable measured latent/energy data still need to be identified or collected.
- After M6: tier 4, site-calibrated with uncertainty, for the instrumented facility only. Equipment selection still requires engineering review.

### References

- Katzin, Marcelis, van Mourik (2021). Applied Energy 281, 116019. https://doi.org/10.1016/j.apenergy.2020.116019 (multi-climate GreenLight runs).
- Katzin, van Mourik, Kempkes, van Henten (2020). Biosystems Engineering 194, 61-81. https://doi.org/10.1016/j.biosystemseng.2020.03.010; dataset https://doi.org/10.4121/78968e1b-eaea-4f37-89f9-2b98ba3ed865.v2
- Stanghellini (1987). Transpiration of greenhouse crops. PhD thesis, Wageningen. https://doi.org/10.18174/202121
- van Beveren, Bontsema, van Straten, van Henten (2015). Applied Energy 159, 509-519. https://doi.org/10.1016/j.apenergy.2015.09.012 (grower-defined bounds as operating regime).
- Katzin, van Henten, van Mourik (2022). Agricultural Systems 198, 103388. https://doi.org/10.1016/j.agsy.2022.103388 (process-based greenhouse model genealogy and control representation).

## Scientific foundation

Start with [GreenLight](https://github.com/davkat1/GreenLight), currently Python, with a BSD-3-Clause-Clear license, and its published Vanthoor/Katzin greenhouse/crop formulations. Its models include more than LED lighting: radiation, canopy transpiration, heat/moisture stores, screens, ventilation, mechanical cooling, condensation, pads and related controls. Audit the pinned model/license and reproduce published benchmark cases before extending it.

Compare with [EnergyPlus](https://energyplus.net/) for equipment/plant performance and heat-recovery boundaries. It is not automatically a calibrated greenhouse crop model. Modelica Greenhouses and other cited models in RESEARCH.md offer independent equation references. USDA Virtual Grower remains a useful legacy heating-cost comparison, not the source of a complete moisture/HVAC twin. No one source should silently supply an incompatible energy boundary.

## Model contract retained from the prototype

- Immutable weather snapshots: source type, timestamps, pressure/solar conventions, original payload and missingness.
- Separate floor/canopy/envelope geometry and separate optical/thermal coefficients.
- Crop, envelope, control policy and equipment data are independently replaceable.
- Explicit equipment performance evidence: assumed constant, published map, measured map, calibrated model.
- A run records schema, engine/library/data versions and every parameter.
- Existing weather-only operating windows stay reproducible when the dynamic engine is replaced.
- No synthetic padding of missing observations; numerical failure and physical failure are different states.

## Required physical extensions

1. Multi-store heat/moisture dynamics: air, cover, crop, substrate, structural/thermal mass and screens. Natural ventilation must depend on wind, buoyancy, opening geometry and pressure rather than a fixed ACH schedule.
2. Crop response: LAI and development stage, stomatal resistance, radiation/VPD/CO₂ response, water availability and nighttime evaporation. Account for evaporation energy, condensation and biomass storage consistently.
3. Solar optics: direct/diffuse radiation, orientation/roof geometry, spectral PAR/NIR, screen state, tier interception and separate canopy zones.
4. Equipment maps: entering DB/WB, outdoor conditions, airflow, part load, cycling, frost/defrost, sensible heat ratio, regeneration temperature/humidity and auxiliaries. Specify indoor/outdoor heat destinations. Blue Frontier or AGronomic IQ presets require actual product data, not marketing family-level claims.
5. Controls: causal weather forecasts, sensor placement/noise, actuator limits/delays, minimum ventilation and CO₂ constraints, and supervisory sequencing. Perfect hindsight remains a separate upper-bound experiment.
6. Spatial limits: validate a well-mixed room assumption before claiming canopy precision. Add zones only when measurements justify them; do not claim CFD from a multi-zone lumped model.

## Measurement and calibration protocol

Collect time-synchronized, calibrated outdoor DB/RH/solar/wind, indoor temperature/dew point at representative locations, crop/LAI/occupancy, irrigation/drainage/condensate, vent/screen/pad state, fan/pump power, HVAC power and supply/return conditions, fuel and regeneration heat. Record missingness, sensor uncertainty, maintenance and operating changes.

Instrumentation for M6: 1-minute logging; indoor T/RH at two canopy-height points plus one outdoor; per-circuit HVAC and lighting power submeters; condensate tipping bucket; irrigation and drain flow; vent/pad/DX/dehu state; at least 90 days spanning two seasons including the hottest and coldest weeks. Record missingness, sensor uncertainty, maintenance and operating changes.

Holdout: the last 30% of the campaign by time plus both extreme weeks. Fit identifiable physical parameters within defensible bounds rather than absorbing all error into arbitrary multipliers. Separate parameter uncertainty (Morris/Sobol over fitted bounds) from meteorological uncertainty (multiple weather years) and equipment-curve extrapolation (out-of-domain flags).

Acceptance metrics are pre-registered in the M6 row above. Publish residuals by day/night, weather and control mode. Require mass/energy closure before optimizing fit. Report uncertainty on control hours and costs; do not present a single simulated optimum as guaranteed.

## Runtime decision gate

First reproduce the pinned reference model in its supported Python environment. Then measure solve time, memory, native dependencies, browser packaging feasibility and reproducibility. Choose a small versioned server or optional local worker if necessary. A Pyodide port is a feasibility test, not a promised deployment architecture. Preserve the current static application and imported-snapshot operation regardless.

## Exit criterion

Call the result a calibrated facility digital twin only after independent held-out measurements support its declared use case. Equipment selection still requires engineering review, manufacturer selection software and safety margins. Public datasets and numerical regression tests alone cannot provide that evidence.
