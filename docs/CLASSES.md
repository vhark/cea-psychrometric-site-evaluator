# Classes of environmental control and their limits

Purpose: explain what each topology can do, without converting a screening comparison into equipment sizing or a general facility recommendation.

Status: model `0.3.0-screening`, scenario schema 2, 2026-09-15. Current numerical findings are limited to [browser-run-metrics.json](browser-run-metrics.json), [regional-study.json](regional-study.json) and [morris-screening.json](morris-screening.json). The old nine-configuration ideal-controller class ladder and its derived cost/attainment recommendations are withdrawn as current evidence. They have not been substituted with invented regenerated results.

## The classes

A class describes installed topology, not guaranteed attainable states. Every capacity, operating limit, target and control policy still matters.

| Class | Added capability | Limiting conditions |
|---|---|---|
| C0: pad and controlled outside air, no heat | Sensible cooling toward outdoor wet bulb and moisture exchange when the supply is useful | Cold weather, insufficient wet-bulb depression, or supply moisture above the active ceiling |
| C1: C0 plus heating | Finite heating for envelope and incoming-air loads | Moisture removal still depends on outdoor humidity and available heat; heating alone does not remove water |
| C2: C1 plus condensing dehumidification | A recirculating moisture sink | Entering-air condition, finite removal and electrical/latent heat returned to the zone |
| C3: C2 plus movable curtain/shade | Scheduled reduction of envelope loss or incoming light/solar gain | Lost crop photons, available supplemental light, restricted moisture exchange and declared screen performance |
| C4: constrained semi-closed hybrid | Supplemental light, DX and moisture control with reduced outdoor-air capacity | Envelope and optical loads, finite sensible/latent capacity, target band and controller |
| C5: insulated opaque room | No direct crop daylight, electric lighting and separately declared controlled air | Lighting energy/heat, internal crop moisture, equipment capacity and outdoor-air design; opacity does not prohibit an economizer |
| C5b: opaque room with coupled HVAC/reheat | Condensation through a cooling coil, with recovered reheat | Coil sensible/latent split, finite reheat and entering conditions |
| C6: uninsulated opaque room | Same equipment topology as C5, different shell | Larger envelope losses/gains can dominate; a material label alone does not establish airtightness |

HRV/ERV and DOAS are treatment options on the controlled-air path, not separate facility classes or new outdoor-air streams. See [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030) for sources and ratings.

## What current evidence actually establishes

The actual Tulsa 2025 browser comparison uses six canonical greenhouse strategies, the staged controller, 8,760 valid hours and 8,759 eligible hours. It does not compare this full class ladder. Joint temperature-and-moisture target attainment is 27.135% for pad/vent, 41.638% with condensing dehumidification, 73.066% for DX plus dehumidifier, 55.297% for integrated HVAC/reheat, 51.875% for desiccant/evaporative cooling and 52.619% for the generic liquid-desiccant hybrid. The baseline-to-DX difference is **45.931 percentage points (pp), from 27.135% to 73.066%** of eligible hours, not a relative percent gain.

The ten-year regional study evaluates those same six greenhouse strategies in six climates, 360 simulations with zero numerical-failure hours. Under retained 5 pp capability and 16% operating-cost decision rules, Tulsa and Miami select DX/dehumidifier, Fairbanks selects desiccant/evaporative cooling, and Phoenix, Denver and Seattle remain unresolved. These are conditional screening verdicts, not facility-type recommendations. Complete endpoints, cost basis and rules are in [REGIONS.md](REGIONS.md).

The regenerated Morris study uses 1,872 simulations with zero numerical-failure hours. Aggregate joint-attainment mu* is 9.098627 pp per full screened range for LAI/transpiration and 2.164460 pp for maximum controlled-air capacity. Those elementary effects do not calibrate the regional thresholds and do not validate a class ladder.

## Closing up and opening up: correct outside-air interpretation

The insulated example's **0.4 ACH infiltration** is uncontrolled leakage. Its **0.3 to 2 ACH controlled-air range** is a separate declared capacity. The old wording “2 ACH shell leakage” was wrong. A closed or opaque facility can have a designed outside-air economizer, recovery and DOAS; internal recirculation is not that outside-air stream and is not simulated here.

The **6 ACH** economizer is a modeled capacity case, **not a recommended rate**. The **15 ACH** hybrid is a constrained semi-closed configuration, **not a conventional open-greenhouse benchmark**. Mushroom room air is a project-specific minimum/maximum based on species, stage, substrate loading, CO2 target and equipment, with circulation left outside the model. No universal mushroom rate follows from these examples.

**The former $39,517 DOAS result and every operating-cost reduction derived from it are explicitly withdrawn.** The old conditioner assigned sensible supply tempering without charging its full energy. Its apparent advantage cannot support a replacement number, a payback claim or a recommendation. The old hybrid-close-up reductions and class rankings are also not current-model findings. There is no general recommendation that a hybrid with lamps should close up.

Cold/dry outdoor air can remove moisture, but fans and downstream heating are purchased energy. Warm/humid air can add moisture. Compare the actual useful supply state and delivered mass flow, not “free drying” or maximum ACH alone.

### Economizer sizing remains resolution-limited

The staged controller commands a discrete ladder, approximately 0.30, 10.23, 20.15, 30.08 and 40.00 ACH for the default 0.3 to 40 range, with dwell times and path limits. The ideal dispatcher is also a discrete, cadence-sensitive upper-bound experiment. Changing a maximum changes the available command set, so a capacity sweep is not continuous economizer optimization. A 20 ACH case is not evidence that oversizing necessarily hurts, and neither controller certifies a design rate. Use project engineering, wind/stack or fan-system analysis and actual equipment performance for sizing.

## How recovery and DOAS change the question

One controlled stream passes through optional recovery or bypass, then optional DOAS, then the zone. Balanced HRV transfers sensible heat only; ERV also needs latent ratings. Ratings at 75% and 100% nominal flow support operation from 50% to 130%, with low-flow bypass and excess-flow mixing. Economizer and pad operation bypass the core. Frost behavior must be qualified or supplied explicitly; no generic frost-free temperature is assumed.

DOAS cooling/condensation uses moist-air enthalpy reduction divided by declared COP. Recovered condenser heat is limited by the supplied reheat fraction. Shared heating capacity goes first to recovery preheat, then DOAS external heat, then zone heat. Targets are not achieved supply states when capacity is exhausted; unmet conditioning and preheat are reported. Fans are charged on actual controlled flow. Recovery transfer is not purchased energy or guaranteed cash savings.

## Light, dehumidifier heat and screens

A clear roof admits crop light and solar heat together. Whether replacement lamps plus cooling are preferable depends on optical coefficients, timing, crop DLI, installed capacity, weather and prices, not a universal sunlight-versus-LED verdict. A shade screen has no special near-infrared benefit unless product spectra support it.

`dehuHeatFraction` is a static topology input: the fraction of condensate latent heat plus compressor electrical heat returned to the zone. The remainder is separately rejected. It does not simulate modulating hot-gas reheat. `reheatFraction` applies to the DX condenser circuit, not the standalone dehumidifier. Cold and hot hours can value returned heat differently; the prior single-point dollar comparisons are not current evidence.

A thermal curtain reduces declared envelope losses while potentially restricting outside-air moisture exchange. An insect screen derates effective controlled-air maximum using the declared factor. Measured Thai mesh ratios are relative to a 40-mesh screened house, not an unscreened reference, and do not establish every greenhouse's wind-dependent airflow.

## Financial and evidence scope

Any operating-cost comparison must state its simulated period/population and include purchased electricity, heating fuel and represented water at its actual numeric manual or historical state-sector proxy prices. The canonical current runs use $0.12/kWh electricity, $0.045/kWh fuel and $0.002/L water. Excluded are installed capital, maintenance, labor, financing, taxes, demand/fixed charges, time-of-use effects and other unmodeled tariff components. Estimated or user-entered installed capital is separate. Modeled cost, difference or reduction is not a quote or guaranteed savings.

Full-year valid-hour cost includes warm-up; common-eligible comparison cost does not. A pp difference always names joint temperature-and-moisture attainment and both endpoints. No yield, saleable production, CO2 performance, manufacturer ranking, independent model benchmark or site calibration is claimed.

## Reproducing a comparison

Import a schema-2 set from [examples/](examples/README.md), verify its project inputs and review state, and load matching weather, site coordinates, ZIP and IANA time zone. Run and retain actual JSON plus printable Field documents. Report capacity, controller/cadence, target band, population, source and cost basis with each result. For the canonical current evidence use the browser procedure in [VERIFICATION.md](VERIFICATION.md), `node scripts/regional-study.mjs` and `node scripts/morris-screening.mjs`. Do not read historical design records as current numerical evidence.
