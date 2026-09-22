# Example scenario library

Purpose: nine importable comparisons with explicit inputs and design questions, not prequalified equipment recommendations.

Status: 2026-09-15, model `0.3.0-screening`, scenario/bundle schema 2. Scenarios have been migrated with explicit airflow basis and review. Review in an example means reviewed for this screening exercise, not verified at a real project. The canonical browser, regional and Morris outputs are current evidence; earlier single-set annual findings below have been withdrawn rather than presented as regenerated results.

## How to use

Load matching weather, then **Import JSON / CSV** and select a set. Export anything you need to keep first because import replaces workspace scenarios. An imported result claim is never trusted; run again.

Each set is sited at the reference climate that makes its own design question sharpest, chosen by which climate actually separates the compared strategies rather than by convention, and no set is the default one. A mushroom room, for instance, reaches its near-saturated band only in a hot-humid record; in the other five it reads zero for every strategy and demonstrates nothing. Re-home any of them to your own ZIP before reading a number as yours: check site coordinates, ZIP and IANA time zone as well as the weather, because equipment sized for one climate is not sized for another.

| Set | Sited at |
|---|---|
| decoupling-study.json | Denver, CO · cold-dry at altitude |
| indoor-microgreen-racks.json | Miami, FL · hot-humid |
| mushroom-room.json | Miami, FL · hot-humid |
| propagation-nursery.json | Seattle, WA · cool-marine |
| hybrid-tomato.json | Seattle, WA · cool-marine |
| crop-bands.json | Phoenix, AZ · hot-dry |
| screens-and-heat-source.json | Phoenix, AZ · hot-dry |
| closed-and-hybrid-air.json | Fairbanks, AK · subarctic |
| climate-archetypes.json | all six bundled sites |
| ../example-scenarios.json | Tulsa, OK · the site the published canonical run was computed at |

Review the outside-air minimum/maximum and combined fan specific power. `infiltrationACH` is uncontrolled leakage; `minVentACH` and `maxVentACH` describe a separate controlled path. Optional recovery and DOAS treat that path in order, not as additional outside-air streams. Internal circulation and canopy velocity are not modeled. See [../WORKFLOW.md](../WORKFLOW.md#review-the-outdoor-air-path-before-running) and [../COMPONENT-PARAMETERS.md](../COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030).

| Set | Design question | Compared inputs |
|---|---|---|
| [decoupling-study.json](decoupling-study.json) | Coupled coil/reheat or separate outdoor-air conditioning and sensible cooling? | Integrated coil, DOAS, desiccant, liquid-desiccant hybrid |
| [indoor-microgreen-racks.json](indoor-microgreen-racks.json) | How do lighting and crop moisture constrain an opaque rack facility? | DX/dehumidifier, DOAS, integrated HVAC |
| [mushroom-room.json](mushroom-room.json) | Can declared generic equipment hold a near-saturated fruiting band? | DX/dehumidifier and integrated HVAC, with explicit project-specific air inputs |
| [propagation-nursery.json](propagation-nursery.json) | Does the evaporative stage help when moisture is binding? | Pad/vent, pad/dehumidifier, DOAS |
| [hybrid-tomato.json](hybrid-tomato.json) | What limits a high-LAI crop in a constrained semi-closed house? | Integrated HVAC, DOAS, pad/dehumidifier |
| [crop-bands.json](crop-bands.json) | How much does the crop program change the same equipment's result? | Lettuce, basil, propagation, illustrative tomato |
| [climate-archetypes.json](climate-archetypes.json) | Which weather-side constraint changes between sites? | One declared facility at Tulsa, Phoenix, Miami, Denver, Seattle and Fairbanks |
| [screens-and-heat-source.json](screens-and-heat-source.json) | What are the light/moisture consequences of screen schedules and heat source? | No screens, shade, curtain, both, both plus heat pump |
| [closed-and-hybrid-air.json](closed-and-hybrid-air.json) | How do controlled-air capacity and screen schedules change a declared topology? | Opaque controlled-air caps 2/6/20 ACH, DOAS on the 6 ACH stream, constrained semi-closed hybrid with screen variants |

The current canonical six-strategy input remains [../example-scenarios.json](../example-scenarios.json).

## The sets and their interpretation

### decoupling-study.json: conditioning still needs energy

The decision is whether to couple zone sensible/latent control or condition outdoor air separately. A DOAS can cool and condense below dew point and then reheat; it does not remove water without cooling by definition. Its moist-air enthalpy reduction / COP, recoverable condenser reheat and remaining purchased heat all count. The targets are not guaranteed actual supply states when heating is insufficient.

The former 56.2% versus 55.3% DOAS comparison and its electricity/fuel advantage are withdrawn. The current canonical browser does not contain this DOAS case, so no replacement annual performance figure is claimed here. Price ratios, entering conditions, equipment capacities and treatment fraction can reverse a comparison. Retain all of them with a new result.

### indoor-microgreen-racks.json: opacity is not isolation

Opaque rooms receive no direct crop daylight; fixture energy is purchased and contributes heat. Crop moisture and envelope/outdoor-air exchange still respond to conditions. The 2 ACH controlled maximum is a screening capacity, not leakage, and does not establish a real air-distribution design. The old highest-attainment and highest-electricity claims across the library are withdrawn as current-model evidence. Change capacity, crop loading or electricity price and the conclusion can change.

### mushroom-room.json: project input, not a species-independent default

This set explicitly supplies **6 ACH minimum and 15 ACH maximum as project-specific illustrative inputs**, with review acknowledged. They are not literature defaults or recommended rates. Selecting a new mushroom system in the tool instead leaves both values null and blocks the run until the project supplies finite, ordered values, a positive maximum and explicit review.

Species, stage, substrate loading, CO2 target, equipment and circulation determine the actual project requirement. The model has no CO2 or internal-circulation solver, and generic near-saturated removal performance is not validated. Old 35.9%/22.0% findings are withdrawn. Replace moisture/respiration, fresh-air and equipment assumptions before using a project result.

### propagation-nursery.json: diagnose the binding supply condition

A pad lowers dry bulb by adding water. If incoming moisture already exceeds the active ceiling, more evaporation cannot remove that moisture. If the weather is dry and cooling is useful, the same stage can help. The earlier DOAS 52.7% versus pad/vent 28.2% result is withdrawn because it predates corrected one-stream treatment and energy accounting. A new comparison must evaluate actual conditioned supply and finite heating, not merely the name of the strategy.

### hybrid-tomato.json: constrained semi-closed operation

The **15 ACH maximum** is a constrained semi-closed screening assumption, not representative conventional open-greenhouse capacity. High LAI and state-coupled transpiration alter the latent load; the tomato crop program is illustrative. The old 45.1% to 51.5% strategy range is withdrawn. No general benefit from closing a hybrid house follows from this set or from comparing it against an opaque facility.

### crop-bands.json: attainment is conditional on the band

Temperature/VPD/dew-point targets affect both dispatch and the definition of success. DLI affects purchased light, with crop LAI/transpiration changing latent load as well. Comparing different target bands does not hold service constant, so the former library table is not retained as current-model evidence. Use this set to ask which inputs drive a result, not to claim one crop is universally feasible or profitable. No yield/revenue model is present.

### climate-archetypes.json: match weather and local scheduling

The equipment is held fixed, but its useful air states and heat/moisture loads change with weather. The current ten-year [regional study](../REGIONS.md) has 360 simulations, zero numerical-failure hours and explicit weather-side opportunity metrics. It is stronger context than quoting the removed single-year library table, but remains a conditional greenhouse screen rather than a climate normal or probability distribution. A low pad count can mean humid supply, little cooling demand or long cold periods; inspect the cause.

### screens-and-heat-source.json: coupled light, heat and moisture

Shade reduces PAR and shortwave together unless product spectra state otherwise. The light guard avoids shading when the crop is too far behind target. A curtain changes envelope heat loss and, with declared closed-gap exchange, moisture ventilation. Heat-pump performance needs actual rating points, capacity derate and cutoff; the example ratings are hypothetical, not a matched-product map.

The former annual screen savings and attainment table is withdrawn as current evidence. The focused `test/screens.test.mjs` checks physical behavior, not those old totals: the schema-2 sealed heat-pump fixture explicitly reviews zero controlled air and fan power, and moisture closure now uses the one controlled-stream term without weakening conservation tolerances. A cooling-dominated and a heating-dominated site can value the same screen differently.

### closed-and-hybrid-air.json: capacity cases, not recommendations

The opaque case has **0.4 ACH modeled infiltration plus 0.3 to 2 ACH controlled outdoor air**. The 6 ACH maximum is a modeled economizer-capacity case, not a recommended rate. The 20 ACH sensitivity remains resolution-limited, not proof that larger ventilation is harmful. Discrete dispatch changes when maximum capacity changes; this is not continuous economizer optimization.

**The former $39,517 DOAS result and every operating-cost reduction derived from it are withdrawn.** Sensible tempering was not fully charged. The former hybrid-close-up savings are also not current evidence, and there is no general “hybrids should close” recommendation. The no-screen 15 ACH hybrid is constrained semi-closed, not an open-greenhouse reference. DOAS treats at most its declared capacity on the same controlled stream; it is not added on top as extra airflow.

Cold/dry air can remove moisture but fans and heating are not free. Hot/humid air can add latent load. Compare actual supply states, heating/COP/reheat limits and unmet conditioning, and carry capital separately before making a project choice.

## Current measured reference and cost scope

The actual Tulsa 2025 canonical browser run records 8,760 valid hours and 8,759 common eligible hours. Pad/vent joint temperature-and-moisture attainment is 27.135%; DX/dehumidifier is 73.066%, an increase of **45.931 percentage points (pp), from 27.135% to 73.066%**, not a relative percent change. It is not a DOAS or full-library study.

The baseline model-estimated annual operating cost is **$22,064.29 over all 8,760 valid hours**; the common-eligible population costs **$22,060.97 over 8,759 hours**. The latter excludes warm-up and must not be mislabeled as the full annual total. Costs include electricity at manual $0.12/kWh, heating fuel at $0.045/kWh and represented water at $0.002/L. They exclude installed capital, maintenance, labor, financing, taxes, demand/fixed charges, time-of-use effects and other unmodeled tariff components. Estimated or user-entered capital is separate. No cost, difference or reduction is a quote or guaranteed savings.

Sources: [../browser-run-metrics.json](../browser-run-metrics.json), [../regional-study.json](../regional-study.json), [../morris-screening.json](../morris-screening.json). Aggregate Morris LAI/transpiration mu* is 9.098627 pp per full screened range; this is not a paired endpoint difference, probability interval or calibrated 5 pp/16% decision rule.

Review each imported scenario’s values below **Run all scenarios**. The shipped examples carry their recorded review state; after editing minimum or maximum outdoor air, fan power or evidence basis, confirm the affected scenario again. **Edit outdoor air** selects its inputs. Missing or invalid inputs still block execution.

## Adding a set

Keep a comparison with at least two distinct scenarios and state which inputs change. Use bundle and scenario `schemaVersion:2`, a descriptive `note`, complete current fields, evidence basis and explicit review where required. Weather snapshots use schema 2, with legacy schema-1 migration. Do not introduce retired energy-per-kg DOAS fields or ambiguous ventilation aliases. Validate the observable contract with `node --test test/examples.test.mjs`, then exercise a real run before publishing numerical findings. A result needs its weather/site/time zone, target band, equipment/cadence, valid/eligible population and complete cost basis. Label unsourced assumptions, do not silently fill manufacturer performance, and report absent evidence as absent.
