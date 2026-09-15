# Glossary

Purpose: define every domain term the interface, the exports and these documents use, with its unit, where it appears and exactly how this tool computes it.

Status: current for model `0.3.0-screening`, scenario schema 2, 2026-09-15.

Read this if: you are reading a result, a report or a design-basis brief and want to know precisely what a number means here, rather than what the term means in general practice.

A note on precedence: where a general industry definition and the computation below differ, the computation below is what the numbers mean. Terms are listed in reading order, from the target band outward to the evidence label.

---

## Joint target band

**What it is.** The set of indoor states that count as acceptable: air temperature within tolerance of the scheduled day or night target, vapour pressure deficit between the minimum and maximum, and dew point at or below the ceiling. "Joint" means all of them at once, not each in turn.

**Unit.** Defined by its parts: °C, kPa, °C.

**Where it appears.** The target-band inputs, the headline "Joint target attainment" metric, the hour inspector, the misses chart, every comparison row and the design-basis brief.

**How it is computed here.** `moistureBounds` in `src/physics.js` intersects the humidity-ratio limits implied by VPD with the dew-point ceiling. The upper moisture bound uses the **minimum** VPD (the moist edge); the lower bound uses the maximum VPD (the dry edge). `src/simulate.js` counts substep time only when temperature, VPD and dew point all pass. The controller's violation score normalizes temperature and moisture misses by their declared bands; it is not a separate agronomic outcome.

Throughout these documents, "control window" means only this: the count of hours inside the joint band. It never means a controller setting, a dispatch interval or a time-of-day schedule.

### Pad usefulness, vent usefulness, and pad-only hours

Unit: hours per record, plus a share of valid hours. Where: the weather-only screen table, and the study's
per-region `weather` block as `padCoolingHoursMedian`, `padHumidifyingHoursMedian`,
`padDeeperThanVentHoursMedian`, `ventCoolingHoursMedian`, `ventDryingHoursMedian`, `bothUsefulHoursMedian`
and `neitherUsefulHoursMedian`. How computed here: an evaporative pad and an open vent are different tools, so
each hour is scored for both independently rather than receiving one mutually exclusive label.

- **Pad could cool usefully**: pad leaving air clears the ceiling by the pad margin and stays under the
  moisture limit, in an hour where outside air is above the target.
- **Pad could usefully humidify**: outside air is drier than the band's moisture floor and the pad does not
  overshoot the ceiling, so the water the pad adds is the point rather than a side effect.
- **Pad only, vent cannot hold the ceiling**: outside air is above the ceiling, so ventilation alone cannot
  hold the band, while pad leaving air still can. These are `padDeeperThanVentHours`, not the
  mutually exclusive `PAD_EFFECTIVE` primary-mode count; their thresholds can give slightly different totals.
- **Vent could cool usefully**: outside air is below the target by the ventilation margin without importing
  moisture past the ceiling. **Vent could dry usefully**: outside air sits below the zone moisture ceiling by
  the drying margin.
- **Both useful** is an overlap and not a sum. Measured across all six bundled sites there is no hour where the
  pad is useful and the vent is not, so a pad is a way to push vent air colder than the weather allows rather
  than an alternative to a vent.

All of these are weather-side capability at the declared band. None of them knows the zone's actual state,
whether cooling was wanted in that hour, or what the controller dispatched.

## Attainment

**What it is.** The share of comparable hours in which the zone held the joint target band.

**Unit.** Percent, and percentage points (pp) when two attainments are differenced.

**Where it appears.** The headline metric, the across-years table (median, worst, best, spread, trend), the comparison table, the frontier and the design-basis brief.

**How it is computed here.** `summarizeHours` in `src/metrics.js` accumulates `compliantFraction` over eligible hours and divides by the eligible-hour count: `compliancePct = 100 * compliantHours / eligibleHours`. `compliantFraction` is itself the share of the hour's sampled control substeps that were inside the band, so an hour that fails for ten minutes contributes a partial hour, not a zero. Invalid, missing and warm-up hours are excluded from both numerator and denominator rather than counted as failures.

## Eligible hour

**What it is.** An hour that is allowed to count in a comparison.

**Unit.** Hours (a count).

**Where it appears.** "Matched hours" in comparisons, the eligible-hour counts in the summary, and the cost basis line on every comparison export.

**How it is computed here.** `const eligible = h => h.valid && h.eligible !== false && !h.warmup` in `src/metrics.js`. An hour is valid when the outdoor state parsed, passed range checks and the simulation produced a finite result; a numerical-failure hour stays invalid and visible rather than being dropped silently. Cross-scenario comparisons then intersect the eligible sets of all compared scenarios, so two strategies are always scored over identical hours. This is why a comparison total can differ slightly from a single scenario's own total.

## Warm-up hour

**What it is.** The first hour of every continuous weather segment, during which the zone state is still relaxing from its initial condition.

**Unit.** Hours (a count); one per segment.

**Where it appears.** The hour inspector (flagged), the summary (`warmupHours`), and the exported assumptions (`warmupHoursPerSegment: 1`).

**How it is computed here.** `src/simulate.js` marks a row `warmup` when no prior zone state exists, which happens at the start of the run and after every gap in the weather. Warm-up hours keep their energy and water in the individual result totals, because that energy really was spent, but they carry `compliantFraction: null` and are excluded from attainment and from comparative compliance. Each sampled day in the Morris screening is a separate segment, so every design point pays the same warm-up cost, which is what makes the effects comparable.

## VPD (vapour pressure deficit)

**What it is.** How far the air sits below saturation at its own temperature: the crop-relevant measure of drying power.

**Unit.** kPa.

**Where it appears.** The VPD minimum and maximum inputs, the hour inspector, the misses chart, the cost-of-precision sweeps.

**How it is computed here.** `airVPD` in `src/physics.js` takes saturation vapour pressure at the air temperature minus the actual vapour pressure derived from the humidity ratio and total pressure, using the pinned PsychroLib 2.5.0 formulations. Canopy temperature is assumed equal to air temperature, so this is air VPD, not leaf-to-air VPD. That simplification is declared in the exported assumptions.

## Dew-point ceiling

**What it is.** A user-declared upper bound on absolute moisture, expressed as dew point. It can be chosen as a condensation or crop-risk guardrail, but the model does not establish a universal disease-safe threshold.

**Unit.** °C.

**Where it appears.** The `maxDewPointC` input (day and night variants), the moisture-limited miss category, the weather-side pad screen, the binding-constraint verdict.

**How it is computed here.** The ceiling is converted to a saturation humidity ratio at the hour's actual pressure; the upper moisture bound is the lower of that value and the bound implied by minimum VPD. Moisture and temperature can bind in different hours. Current per-region weather-side counts, explicitly distinguished from indoor attainment, are in [REGIONS.md](REGIONS.md).

## DLI (daily light integral)

**What it is.** Photosynthetic photons delivered to the canopy over one local day.

**Unit.** mol/m²/day.

**Where it appears.** The DLI target input, the daily light chart, the DLI-deficit day count, the lighting energy line.

**How it is computed here.** Solar photons come from the snapshot's GHI, including gridded satellite solar, using the declared screening conversion 2.02 µmol/J after PAR transmission and shade. They are shared over stacked canopy by footprint, not multiplied by tier area. Supplemental lighting is causal: current sunlight and accumulated local-day photons determine the outstanding demand, divided by the remaining lit time and floored at one step. Finite fixture capacity can leave a real deficit. `src/metrics.js` counts a deficit day only for a complete local day when `max(0, dliTarget - dli)` exceeds 1e-6 mol/m²/day. Fractional UTC offsets and DST retain actual elapsed time.

## SHR (sensible heat ratio)

**What it is.** Positive sensible gains divided by those gains plus crop latent load and positive outdoor-air moisture import in this model. A low SHR motivates checking moisture-removal capacity and reheat, but does not prove that a DOAS can remove the zone load: DOAS conditions the controlled outdoor-air stream, not a separate zone-recirculation stream.

**Unit.** Dimensionless, 0 to 1.

**Where it appears.** The loads view (monthly SHR and an SHR histogram), the hour inspector, the design-basis brief. Also a DX equipment input (`coolingSHR`), which is a different thing: the coil's own split.

**How it is computed here.** Space SHR in `src/metrics.js` is `sensibleGainKWh / (sensibleGainKWh + LATENT_KWH_PER_KG * cropLatentKg)`, where the latent conversion is the latent heat of vaporization expressed in kWh/kg. Sensible gains are the positive solar, light, envelope, infiltration, fan and crop terms; the latent term is crop transpiration plus positive infiltration and ventilation moisture import. Hours with no positive gain produce no SHR rather than a zero.

## Pad effectiveness

**What it is.** How close an evaporative pad brings leaving air to its wet-bulb temperature.

**Unit.** Dimensionless, 0 to 1 (screened 0.70 to 0.90).

**Where it appears.** The `padEffectiveness` input, the pad-viability table, the pad runtime row, the Morris parameter table.

**How it is computed here.** `padState` in `src/physics.js`: `padTempC = tempC - effectiveness * (tempC - wetBulbC)`, with leaving humidity from the approximately isoenthalpic process and a saturation bound. Effectiveness is constant here; face velocity, media depth, fouling and wetting uniformity remain roadmap M4. Current aggregate Morris effects and their screened ranges are in [SENSITIVITY.md](SENSITIVITY.md); they do not establish a universal importance ranking.

## Wet-bulb temperature

**What it is.** The adiabatic-saturation temperature approached by direct evaporative cooling under the stated psychrometric approximation. It is a direct-pad limit, not a universal floor for indirect or pre-dried multistage equipment.

**Unit.** °C.

**Where it appears.** The hour inspector, the pad screen, the design-basis brief (coincident wet bulb at the design dry-bulb hour).

**How it is computed here.** PsychroLib 2.5.0 from dry-bulb temperature, humidity ratio and station pressure, evaluated at the hour's actual pressure rather than a sea-level assumption.

## Free cooling

**What it is.** Hours in which outside air can do the cooling without mechanical refrigeration.

**Unit.** Hours in the supplied weather record, annual only when the record covers a complete year.

**Where it appears.** The weather-side mode counts, the across-sites comparison, the design-basis brief.

**How it is computed here.** `FREE_COOLING_MODES = ['PASSIVE_VENT_COOL_DRY', 'PAD_EFFECTIVE']` in `src/metrics.js`, counted from weather-side classification independently of equipment dispatch. The cool-dry mode checks temperature margin, drying margin and enthalpy. This is outside-air opportunity, not free fan energy or indoor attainment. Current ten-year median counts are in [REGIONS.md](REGIONS.md).

## Latent economizer

**What it is.** The label for the cool-and-dry weather mode, where outside air removes both heat and moisture, so ventilation substitutes for a dehumidifier.

**Unit.** Hours (a count), and kg/h of removal potential when quantified.

**Where it appears.** The weather-mode legend ("Cool and dry (free latent economizer)"), and the outside-air dehumidification screen.

**How it is computed here.** The mode is `PASSIVE_VENT_COOL_DRY`. `outdoorDryingHour` in `src/physics.js` calculates removal potential at the declared maximum controlled flow, then fan and incoming-air tempering energy per kg at scenario prices. Heating uses the declared fuel efficiency or outdoor-temperature heat-pump COP; a locked-out heat source cannot provide a cold-air drying opportunity. This weather-side calculation does not dispatch the zone or apply the full recovery/DOAS train and finite heating allocation. It must not be read as actual removal, annual savings or a sizing result.

## Dehumidifier heat returned to the zone

**What it is.** The fraction of a standalone condensing dehumidifier's condensate latent heat plus electrical input returned to the zone. A value of 1 covers an in-room unit or ducted warm discharge returned to the room; 0 declares remote heat rejection; an intermediate value declares a fixed split. This is a static topology, not demand-modulating hot-gas reheat. `reheatFraction` is separate and applies to the DX condenser circuit.

**Unit.** Dimensionless, 0 to 1. Default 1.

**Where it appears.** The `dehuHeatFraction` field in "Heating, cooling & dehumidification"; the rejected remainder is reported as `dehuRejectedHeatKWh`. [CLASSES.md](CLASSES.md) explains the topology and withdraws older numerical heat-return comparisons.

**How it is computed here.** `src/simulate.js` forms `dehuHeatTotalW = L * dehuKgS + dehuW` and splits it into `dehuHeatW = dehuHeatTotalW * dehuHeatFraction` and rejected remainder. The parts sum to the released heat; only the returned part enters the zone sensible balance. The fraction is user-declared, with no inferred manufacturer map, and applies in every hour. Earlier scenarios missing this field receive the retained value 1 through `migrateScenario` in `src/config.js`.

## Enrichment window

**What it is.** A low-outdoor-air-exchange opportunity indicator for considering CO2 enrichment. It does not establish that enrichment is biologically beneficial or economically worthwhile.

**Unit.** Equivalent hours (duty-weighted), plus a count of hours with any window.

**Where it appears.** "Enrichment-compatible, equivalent hours", "Hours with any enrichment window", and the monthly enrichment row.

**How it is computed here.** `src/simulate.js` accumulates `enrichmentFraction` when actual controlled outdoor air is at or below the declared minimum and the selected air path is outside air rather than pad or indirect evaporation. Recovery or DOAS treatment does not add another stream. Summed fractions give equivalent hours. There is no CO2 mass balance, injection rate or crop response, so this is a low-exchange opportunity indicator, not a concentration or biological benefit.

## Equivalent full-load hours

**What it is.** Runtime expressed as the hours a component would have run at full output to do the same work. It separates "on a lot at low duty" from "on hard".

**Unit.** Hours.

**Where it appears.** The equipment runtime table (alongside hours with use and days with use) and the runtime rows of the exported report.

**How it is computed here.** `src/metrics.js` sums each component's per-hour duty or modulating fraction: `equivalentHours += duty`; `hours` increments when duty exceeds 1e-9; `days` counts distinct local dates with use. A component operating part-load can therefore have more hours with use than equivalent full-load hours. Runtime figures must retain their scenario and period.

## Pad viability (weather-side)

**What it is.** How often a pad could work on the weather alone, independent of what the controller actually did.

**Unit.** Hours and days (counts), split effective, marginal and ineffective.

**Where it appears.** The "Pad viability from weather alone" table in the weather view, and the pad rows of the exported report.

**How it is computed here.** Primary weather classifications count `PAD_EFFECTIVE`, `PAD_MARGINAL` and `PAD_INEFFECTIVE_DEHU_NEEDED` with temperature/moisture causes. Separate usefulness flags retain overlapping vent and pad opportunities. The coupled controller may use a pad even when the weather-side band cannot be met, because partial cooling can reduce a violation. Neither the primary-mode count nor the usefulness count is actual runtime.

## Insect screen and its ventilation factor

**What it is.** A mesh over the vents that keeps pests out and, by the same restriction, takes away part of the outside-air exchange the house depends on. In a humid climate that exchange is the cheapest moisture sink available, so the screen is a control decision and not only a pest decision. The ventilation factor is the share of a reference house's achievable maximum outside-air exchange that the screened house can still reach.

**Unit.** Dimensionless, 0 to 1. Catalogued grades: `mesh40` 1.000, `mesh52` 0.641, `mesh78` 0.502.

**Where it appears.** The imported or edited scenario object `insectScreen: {installed, grade, ventilationFactor}`, run warnings, exported report and design-basis assumptions. Component evidence and limits are in [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#3a-insect-screens-the-ventilation-penalty).

**How it is computed here.** `resolveInsectScreen` in `src/screens.js` resolves the factor, preferring a user-declared product measurement over a catalogued grade and reporting which of the two it used. `src/simulate.js` applies it once, at the physics entry point, by multiplying `maxVentACH` by the factor. The declared `minVentACH` is never derated: if the derate would fall below it the maximum clamps to the minimum, the run records `clampedToMinimum` and says so, because a screened house that cannot deliver the ventilation the scenario requires is a finding rather than a rounding. An installed screen that resolves to no factor is a validation error, so a mesh can never quietly cost nothing.

The measured basis is one instrumented rainy-season campaign at the Asian Institute of Technology, Pathum Thani: three 10 x 20 m houses, 300 tomato plants each, fans off, ventilation inferred from a water balance cross-checked against an energy balance, giving 0.0719, 0.0461 and 0.0361 m³ m⁻² s⁻¹ [S24]. The factors above are those rates as ratios. **The reference is the 40-mesh house, not an unscreened one**: the campaign had no unscreened control, so the ventilation cost of adding a first screen to an open house is unsourced and this model cannot supply it, and declaring a factor of 1.0 claims a house like the measured 40-mesh one rather than an unrestricted one. One house per treatment at one site is a measured direction and magnitude, not a validated universal mesh penalty. Only the ventilation restriction is modeled: the same campaign's measured temperature and humidity rises follow from the run rather than being imposed, and no optical effect of the mesh is applied at all (see [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) §3A).

## Dominance and the operating-cost frontier

**What it is.** A strategy is dominated when another strategy is at least as cheap and holds the band at least as often, and strictly better on one of the two. The frontier is the set of strategies that nothing dominates.

**Unit.** A label, over dollars of operating cost and compliant hours (or median attainment for the multi-year frontier).

**Where it appears.** The "Operating-cost frontier" and "Operating-dominated" labels in the comparison table, and the site verdict.

**How it is computed here.** `compareScenarios` compares cost and compliant hours on the common eligible set; `strategyFrontier` compares median cost and median attainment across years. A row is dominated only if another is no worse on either axis and strictly better on at least one. Missing-price or numerically failed scenarios cannot receive a favorable comparable ranking. Capital and maintenance remain separate. The cheapest frontier member is not necessarily an acceptable design: the regional recommendation rule also imposes an explicit capability tier and cost band (see [REGIONS.md](REGIONS.md)).

## Control class

**What it is.** A step on the ladder of environmental control, defined by the set of indoor states its equipment can reach rather than by its brand or its cost: from C0, fans and a wet pad with no heat, up to C6, an opaque uninsulated box with full mechanical authority. Each class is exhausted by a specific physical condition, which is what promotes a site to the next one.

**Unit.** A label: C0, C1, C2, C3, C4, C5, C5b, C6.

**Where it appears.** The topology vocabulary in [CLASSES.md](CLASSES.md), not a computed equipment-selection output.

**How it is computed here.** A class is constructed as a scenario, not derived from climate alone. The old nine-configuration ideal-controller class comparison is withdrawn as current-model evidence. The current canonical studies compare six greenhouse strategies, not the full facility ladder; they cannot establish an opaque/DOAS/class ranking.

## Elementary effect and mu\*

**What it is.** The Morris screening measures. An elementary effect is the change a single parameter causes when moved one step, with everything else held; mu\* is the mean of the absolute effects, which is the influence ranking.

**Unit.** The metric's own unit per full screened range: percentage points for attainment, dollars for operating cost, kWh for electricity.

**Where it appears.** [SENSITIVITY.md](SENSITIVITY.md), [morris-screening.json](morris-screening.json), and the ranking-stability label carried by multi-year comparisons.

**How it is computed here.** `EE = (y(step j) - y(step j-1)) / delta` with `delta = 2/3` in unit-cube space, so effects across different physical units are directly comparable. Alongside mu\* the screening reports mu (the mean signed effect, giving direction) and sigma (the spread, where a sigma comparable to mu\* flags interaction or non-linearity rather than sampling noise). Eight trajectories over twelve parameters gives n = 8 usable step pairs per parameter and metric; a pair with a missing metric is dropped, never zero-filled. Morris is a screening method: it produces no distribution, no confidence interval and no probability that one strategy beats another.

## Ranking stability

**What it is.** Whether the cost order of the strategies survives the thing being varied, either the weather year or the screened parameter ranges.

**Unit.** A label (stable or unstable), plus the count of distinct orders and the share held by the most common one.

**Where it appears.** The across-years verdict and the sensitivity verdict.

**How it is computed here.** Across-years aggregation in `metrics.js` uses one identical operating-cost order in every year. Morris screening and the regional study use a pre-set 90% most-common-order rule. The regenerated Morris artifact has three orders and 61.5% for the most common; the ten-year Tulsa regional study has two orders and 80%, so both fail their 90% rule. Other regional verdicts differ. Ranking reproducibility is not robustness to unmeasured assumptions.

## Evidence tier

**What it is.** The declared strength of the evidence behind a number, from a weather feasibility count up to a site-calibrated prediction.

**Unit.** One of four named tiers.

**Where it appears.** The interface footer, the header of every exported report and design-basis brief (`Evidence tier: Assumption-based component screening`), and [EVALUATION.md](EVALUATION.md), which defines what each tier permits and prohibits.

**How it is computed here.** It is not computed, it is asserted, and it is asserted at the lowest level the evidence supports. `src/simulate.js` writes `evidenceTier: 'Assumption-based component screening'` into the assumptions of every run, and `src/export.js` prints it at the top of every document, so a printed page cannot be separated from its tier. Raising the tier requires the benchmark work in roadmap M5 and the calibration work in M6, not a code change (see [DIGITAL-TWIN.md](DIGITAL-TWIN.md)).

## Evidence grade (A to E)

**What it is.** The strength of a single published claim cited from the outside literature. It is not the same thing as the evidence tier above: the tier describes what this tool's own output may be used for, the grade describes how well somebody else's study was done.

**Unit.** One letter per claim. **A**: peer-reviewed, measured in a real hot-humid facility, with a control or baseline and reported uncertainty. **B**: peer-reviewed and measured, but a short campaign, a single facility, laboratory scale, or warm-humid rather than hot-humid. **C**: peer-reviewed simulation or validated model, including a measured system compared against a modeled baseline. **D**: not peer-reviewed, so technical reports, theses, extension bulletins and conference abstracts. **E**: vendor marketing with no disclosed method.

**Where it appears.** [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md), beside every claim it cites, with a plain-words provenance note; where a paper's capability claim and its efficiency claim deserve different letters, both are given.

**How it is computed here.** It is assigned by review against the definitions above, not computed, and it is never raised because a claim is widely repeated. The review's headline result is the absence it found: **no Grade A evidence in any of the six domains searched**, so the most consequential question in hot-humid CEA, the cheapest way to remove moisture when the outdoor dew point sits above the zone ceiling for thousands of hours, has no measured answer in the literature reviewed. The 52 cited DOIs were machine-checked and all 52 resolve (49 through Crossref, 3 through DataCite), which verifies that the sources exist, not that they are right.

## Learn view

**What it is.** The second of the two views in this single page: a taught curriculum over the tool's own evidence, in reading order, each section giving the concept, the arithmetic behind it, a figure measured in this repository and the caveat that travels with it.

**Unit.** Ten sections: nine curriculum modules plus the regional-findings section.

**Where it appears.** The **Learn** tab in the header, beside **Analyze**. `#learn` opens the view, `#learn/<module-key>` opens one section directly, and `#analyze` returns; every other fragment stays an ordinary in-page anchor.

**How it is computed here.** Nothing on the page is computed by it. `src/learn.js` holds each section's text and a table of figures that are already published elsewhere in this repository, each row naming the file it came from, and the regional section is read from [regional-study.json](regional-study.json) at run time: an absent or unreadable study renders as an absent study, naming the file and the command that regenerates it, rather than falling back to an example. The "show me" button on a section switches to Analyze and highlights the panel it is about, using the guided tour's own spotlight rather than a second implementation; if that panel does not exist yet, the highlight lands on the control that would produce it.

---

## Terms used about the model

| Term | Meaning here |
|---|---|
| Weather-side screen | A classification of outside air against the target band, with no equipment and no zone simulation. Fast, and never to be read as indoor conditions. |
| Coupled run | The full single-zone sensible and moisture simulation with finite equipment, which is what produces attainment, energy and cost. |
| Staged controller | Default causal deadbands, ordered stages and minimum on/off times at one-minute dispatch. Historical cadence results cover the cases dated in VERIFICATION.md, not every current topology. |
| Ideal modulation upper bound | A selectable, labeled discrete enumeration experiment with historical cadence sensitivity. Not a continuous optimum or prediction of installed-system performance. |
| Unmet load | The steady capacity shortfall in an hour: the extra W or kg/s that would have been needed to hold a violated bound under that hour's forcing, integrated over time. Cadence-invariant to first order, and not a sum of re-counted inventory deficits. |
| Common eligible set | The intersection of eligible hours across all compared scenarios. Comparison dollars and hours use it, so they differ slightly from single-scenario totals. |
| Capital recovery | Annualized capital plus maintenance, shown separately from historical-period operating cost, and never added into the dominance test. |
| Assumption label | Every default input carries a source string saying where the number came from and what it is not: a planning assumption with its arithmetic, an illustrative placeholder, or a user-defined value. |

## Outdoor air and ACH

**Infiltration** is uncontrolled envelope exchange (`infiltrationACH`). **Controlled outdoor air** is one commanded supply/exhaust stream, bounded by `minVentACH` and installed `maxVentACH`, with actual `controls.controlledOutdoorAirACH` and path limitations reported. The opaque template's 2 ACH maximum is controlled capacity, not leakage; the discussed insulated case separately has 0.4 ACH infiltration.

**ACH** is volume changes per hour. For floor area A, mean height H and volume V = A × H: m³/s = ACH × V / 3600; m³/s per m² floor = ACH × H / 3600; cfm = m³/s × 2118.880003; cfm/ft² = (m³/s per m²) × 2118.880003 / 10.7639104. None of these conversions establishes a feasible natural-vent pressure flow.

**Internal circulation** moves air within the enclosure. Its ACH, canopy air velocity and distribution uniformity are not modeled and are never added to outdoor-air exchange.

**Airflow evidence status** is literature range, adjacent-evidence proxy, project-specific input or screening assumption. Literature context is not a universal validation limit; explicit review acknowledges controlled capacities and combined fan-power input, not scientific validation. Mushroom room minimum/maximum are project inputs, not generic species-independent defaults.

## HRV, ERV and DOAS

**HRV** transfers sensible heat between balanced supply and exhaust, with zero latent effectiveness. **ERV** also transfers moisture. Declared heating/cooling effectiveness at 75% and 100% nominal flow defines the model; core operation is supported only from 50% through 130%. Low flow bypasses; excess above 130% bypasses and mixes once. Economizer and pad paths bypass recovery. Recovery transfer is not purchased energy or an operating-cost reduction.

**Frost control** is a qualified minimum operating temperature, exhaust-only bypass/defrost fraction, or finite preheat. Insufficient preheat bypasses the core and is reported; operation below a qualified no-frost minimum is invalid.

**DOAS** conditions at most `doasM3s` of the existing controlled stream after recovery/bypass. Cooling and condensation are charged from moist-air enthalpy reduction / `doasCoolingCOP`; recovered condenser heat is limited by `doasReheatRecoveryFraction`. Remaining heat uses the finite source after preheat, before zone heat. Target temperature and dew point are not guaranteed achieved states; unmet conditioning is visible and no supply humidification is invented.

Current one-stream moisture closure is crop + infiltration + controlledOutdoorAir + humidifier − removed − condensed − stored. Condensate made upstream is not subtracted twice as a zone sink. Detailed evidence and rating fields are in [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030).

## Operating cost, capital and percentage points

**Model-estimated operating cost** is purchased electricity, purchased heating fuel and represented water for the named simulated population/period. Its `costBasis` gives numeric manual or dated historical state-sector proxy prices and exclusions: installed capital, maintenance, labor, financing, taxes, demand/fixed charges, time-of-use effects and other unmodeled tariff components. Complete-year valid-hour totals may be called annual; sampled-day or matched eligible-hour totals are not silently annualized. A named difference or reduction is not a quote or guaranteed savings.

**Installed capital** is separately estimated (`screeningAssumption`) or user-entered, never part of operating dominance. Annualized ownership also includes stated maintenance and financing assumptions and is a separate quantity.

**Percentage points (pp)** subtract two joint temperature-and-moisture target-attainment percentages on the same eligible population. The actual Tulsa 2025 browser result rises from 27.135% pad baseline to 73.066% DX plus dehumidifier, a 45.931 pp increase, not a 45.931% relative increase. Morris mu* instead averages absolute elementary effects per full screened range, so it has no single pair of scenario endpoints and is not an uncertainty bound.

**Schema 2** describes scenarios/run bundles; weather snapshots and the regional study envelope remain 1. Regional scenarios and the Morris envelope are 2. Legacy DOAS energy-per-kg inputs are migration-only recognition, not active parameters. See [WORKFLOW.md](WORKFLOW.md#scenario-schema-2-migration).
