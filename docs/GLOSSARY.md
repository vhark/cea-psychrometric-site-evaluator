# Glossary

Purpose: define every domain term the interface, the exports and these documents use, with its unit, where it appears and exactly how this tool computes it.

Status: current for model `0.2.0-screening`, 2026-09-14.

Read this if: you are reading a result, a report or a design-basis brief and want to know precisely what a number means here, rather than what the term means in general practice.

A note on precedence: where a general industry definition and the computation below differ, the computation below is what the numbers mean. Terms are listed in reading order, from the target band outward to the evidence label.

---

## Joint target band

**What it is.** The set of indoor states that count as acceptable: air temperature within tolerance of the scheduled day or night target, vapour pressure deficit between the minimum and maximum, and dew point at or below the ceiling. "Joint" means all of them at once, not each in turn.

**Unit.** Defined by its parts: °C, kPa, °C.

**Where it appears.** The target-band inputs, the headline "Joint target attainment" metric, the hour inspector, the misses chart, every comparison row and the design-basis brief.

**How it is computed here.** `src/simulate.js` converts the band into a temperature window around the scheduled target and a humidity-ratio window whose upper bound is the lower of the VPD maximum and the saturation state at the dew-point ceiling. A sampled substep is compliant when its state sits inside every bound at once. The violation used for control ordering is the temperature miss divided by the temperature tolerance plus the moisture miss divided by the VPD band width, so a scenario with a tight band is not automatically ranked as worse behaved than one with a loose band.

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
  hold the band, while pad leaving air still can. **This is the only set of hours a pad is necessary rather
  than merely also working**, and it reproduces the older mutually exclusive pad-effective count exactly.
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

**What it is.** A hard upper bound on absolute moisture, expressed as the dew point above which condensation and disease risk are unacceptable.

**Unit.** °C.

**Where it appears.** The `maxDewPointC` input (day and night variants), the moisture-limited miss category, the weather-side pad screen, the binding-constraint verdict.

**How it is computed here.** The ceiling is converted to a saturation humidity ratio at the hour's actual barometric pressure, and the zone's upper moisture bound is the lower of that value and the bound implied by the minimum VPD. Because it is an absolute-moisture bound, it binds independently of temperature, which is why a moisture ceiling and a temperature margin can fail in different hours. At Tulsa the moisture ceiling binds in 3,851 h against 2,952 h for the temperature margin (see [AUDIT.md](AUDIT.md)).

## DLI (daily light integral)

**What it is.** Photosynthetic photons delivered to the canopy over one local day.

**Unit.** mol/m²/day.

**Where it appears.** The DLI target input, the daily light chart, the DLI-deficit day count, the lighting energy line.

**How it is computed here.** Solar photons come from measured GHI at 2.02 µmol/J, after PAR transmission and shade fraction, and are shared across stacked canopy by footprint rather than multiplied by tier area, so stacking cannot create photons. Supplemental light is scheduled causally: the controller sees current sunlight and the photons already accumulated in the local day, never future weather. Each step asks for the outstanding deficit spread over the lit time actually left in the civil day, floored at one step, so the final step requests exactly what is missing and a fixture with the capacity to meet the target lands on it rather than finishing fractionally short. A deficit day is therefore a real shortfall of photons, not an artefact of the request window: `src/metrics.js` counts one only on a complete local day, when `max(0, dliTarget - dli)` exceeds 1e-6 mol/m²/day. Days are accumulated on the local calendar, including fractional UTC offsets and daylight-saving transitions, so a DST day keeps its actual elapsed hours.

## SHR (sensible heat ratio)

**What it is.** The share of the zone's total load that is sensible rather than latent. A low SHR is the physical argument for decoupled moisture control (DOAS, desiccant) over reheat.

**Unit.** Dimensionless, 0 to 1.

**Where it appears.** The loads view (monthly SHR and an SHR histogram), the hour inspector, the design-basis brief. Also a DX equipment input (`coolingSHR`), which is a different thing: the coil's own split.

**How it is computed here.** Space SHR in `src/metrics.js` is `sensibleGainKWh / (sensibleGainKWh + LATENT_KWH_PER_KG * cropLatentKg)`, where the latent conversion is the latent heat of vaporization expressed in kWh/kg. Sensible gains are the positive solar, light, envelope, infiltration, fan and crop terms; the latent term is crop transpiration plus positive infiltration and ventilation moisture import. Hours with no positive gain produce no SHR rather than a zero.

## Pad effectiveness

**What it is.** How close an evaporative pad brings leaving air to its wet-bulb temperature.

**Unit.** Dimensionless, 0 to 1 (screened 0.70 to 0.90).

**Where it appears.** The `padEffectiveness` input, the pad-viability table, the pad runtime row, the Morris parameter table.

**How it is computed here.** `padState` in `src/physics.js`: `padTempC = tempC - effectiveness * (tempC - wetBulbC)`, with leaving moisture set by the approximately isoenthalpic process and clamped at saturation. Effectiveness is a constant here; the real dependence on face velocity, media depth, fouling and wetting uniformity is roadmap M4. Morris ranks this parameter last or near last on every metric at Tulsa, because a moisture-limited climate is not fixed by a better pad.

## Wet-bulb temperature

**What it is.** The lowest temperature reachable by evaporating water into the air adiabatically. It is the floor on any evaporative process.

**Unit.** °C.

**Where it appears.** The hour inspector, the pad screen, the design-basis brief (coincident wet bulb at the design dry-bulb hour).

**How it is computed here.** PsychroLib 2.5.0 from dry-bulb temperature, humidity ratio and station pressure, evaluated at the hour's actual pressure rather than a sea-level assumption.

## Free cooling

**What it is.** Hours in which outside air can do the cooling without mechanical refrigeration.

**Unit.** Hours per year (a count).

**Where it appears.** The weather-side mode counts, the across-sites comparison, the design-basis brief.

**How it is computed here.** `FREE_COOLING_MODES = ['PASSIVE_VENT_COOL_DRY', 'PAD_EFFECTIVE']` in `src/metrics.js`, counted from the weather-side classification, which runs independently of any equipment dispatch. Passive vent cool-dry requires outside air below the target by the ventilation margin, a drying margin against the moisture ceiling, and outdoor enthalpy below the target enthalpy at once. This is a capability count for the outside air, not a statement that fans are free: powered ventilation still consumes energy in the coupled run. Tulsa gives 401 h against Phoenix 2,636 h.

## Latent economizer

**What it is.** The label for the cool-and-dry weather mode, where outside air removes both heat and moisture, so ventilation substitutes for a dehumidifier.

**Unit.** Hours (a count), and kg/h of removal potential when quantified.

**Where it appears.** The weather-mode legend ("Cool and dry (free latent economizer)"), and the outside-air dehumidification screen.

**How it is computed here.** The mode itself is `PASSIVE_VENT_COOL_DRY`. The screen behind it, `outdoorDryingHour` in `src/physics.js`, takes the drying margin against the zone's moisture ceiling at maximum ventilation airflow and converts it into a removal potential in kg/h, then charges the fan power plus any heating needed to temper the incoming air, giving cost per kg and energy per kg at scenario prices. Compared against a 2.5 L/kWh dehumidifier at Tulsa, outside air wins on cost per kg in 4,970 h and on energy per kg in 1,752 h (see [AUDIT.md](AUDIT.md)). It is a weather-side screen, not a dispatch decision.

## Dehumidifier heat returned to the zone

**What it is.** The share of a condensing dehumidifier's released heat that reaches the crop air. A machine that condenses water releases the latent heat of the water it removed plus its own electrical input, and where that heat lands is a question about the installation rather than about the machine's drying ability. A fraction of 1.0 covers both an in-room unit and a ducted unit whose warm discharge returns to the room; 0 is a remote condenser or water-side rejection; anything in between is a machine deliberately returning part of its heat, which is what integrated hot-gas reheat does. It is distinct from `reheatFraction`, which recovers heat from the DX circuit: a temperature-controlled dehumidifier with integrated hot-gas reheat is declared through this field, not through that one.

**Unit.** Dimensionless, 0 to 1. Default 1.

**Where it appears.** The `dehuHeatFraction` slider labelled "Dehu heat returned to the zone" in the "Heating, cooling & dehumidification" field group, in steps of 0.1; the rejected remainder as the run total `dehuRejectedHeatKWh`, the released heat that did not reach the zone, in kWh; and the measured consequences across climates in [CLASSES.md](CLASSES.md).

**How it is computed here.** `src/simulate.js` forms the released heat as `dehuHeatTotalW = L * dehuKgS + dehuW`, the latent heat of the condensed water plus the unit's electrical input, then splits it: `dehuHeatW = dehuHeatTotalW * dehuHeatFraction` enters the zone's sensible balance, while `dehuRejectedW = dehuHeatTotalW - dehuHeatW` joins the run's `rejectedW` and accumulates as `dehuRejectedHeatKWh`, so the two parts always sum to the released heat and the rejected share stays visible rather than vanishing. The fraction is a declared topology input and not a sourced parameter: no manufacturer performance map backs any particular value, the user declares where the machine sends its heat (see [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md)). It is also static rather than modulating, applying in every hour instead of being chosen from each hour's heating demand, so a machine that varies its own heat return is bracketed by two runs rather than simulated in one. A scenario saved before this field existed loads with 1 through `backfillScenario` in `src/config.js`.

## Enrichment window

**What it is.** Hours in which CO2 enrichment is physically worth attempting, because the zone is not being flushed with outside air.

**Unit.** Equivalent hours (duty-weighted), plus a count of hours with any window.

**Where it appears.** "Enrichment-compatible, equivalent hours", "Hours with any enrichment window", and the monthly enrichment row.

**How it is computed here.** `src/simulate.js` accumulates `enrichmentFraction` as the share of control substeps in which ventilation sits at the scenario minimum, the pad and indirect stages are off and the DOAS duty is zero. Summing that fraction gives equivalent hours; counting hours with any nonzero fraction gives the second number. No CO2 mass balance, injection rate or crop response is modelled, and the Stanghellini transpiration does not respond to CO2 concentration. This counts opportunity, not benefit.

## Equivalent full-load hours

**What it is.** Runtime expressed as the hours a component would have run at full output to do the same work. It separates "on a lot at low duty" from "on hard".

**Unit.** Hours.

**Where it appears.** The equipment runtime table (alongside hours with use and days with use) and the runtime rows of the exported report.

**How it is computed here.** `src/metrics.js` sums each component's per-hour duty or modulating fraction over the run: `equivalentHours += duty`, while `hours` increments whenever duty exceeds 1e-9 and `days` counts distinct local dates with any use. The Tulsa baseline pad shows the contrast directly: 2,772 h with use on 296 days, but 1,830 equivalent full-load hours.

## Pad viability (weather-side)

**What it is.** How often a pad could work on the weather alone, independent of what the controller actually did.

**Unit.** Hours and days (counts), split effective, marginal and ineffective.

**Where it appears.** The "Pad viability from weather alone" table in the weather view, and the pad rows of the exported report.

**How it is computed here.** From the weather classification only: `PAD_EFFECTIVE` when pad leaving air clears both the temperature margin and the moisture ceiling, `PAD_MARGINAL` when it clears the ceiling but not the margin, `PAD_INEFFECTIVE_DEHU_NEEDED` otherwise, with the failing limit recorded. The coupled controller still runs the pad in hours the screen calls ineffective, because partial cooling beats none under the violation-first rule. Reading the two tables side by side is intended: 2,772 h of pad runtime against 244 h of weather-side viability is the honest picture of a moisture-limited climate.

## Insect screen and its ventilation factor

**What it is.** A mesh over the vents that keeps pests out and, by the same restriction, takes away part of the outside-air exchange the house depends on. In a humid climate that exchange is the cheapest moisture sink available, so the screen is a control decision and not only a pest decision. The ventilation factor is the share of a reference house's achievable maximum outside-air exchange that the screened house can still reach.

**Unit.** Dimensionless, 0 to 1. Catalogued grades: `mesh40` 1.000, `mesh52` 0.641, `mesh78` 0.502.

**Where it appears.** The `insectScreen` object of a scenario (`{installed, grade, ventilationFactor}`), which arrives with an imported or hand-edited scenario rather than from a control in the interface; the run warnings in the results panel, which name the factor, its basis and the resulting ACH; the warnings list of the exported report and the reproducible-assumptions appendix of the design-basis brief; and "Does an insect screen cost you, or help?" in [CLASSES.md](CLASSES.md).

**How it is computed here.** `resolveInsectScreen` in `src/screens.js` resolves the factor, preferring a user-declared product measurement over a catalogued grade and reporting which of the two it used. `src/simulate.js` applies it once, at the physics entry point, by multiplying `maxVentACH` by the factor. The declared `minVentACH` is never derated: if the derate would fall below it the maximum clamps to the minimum, the run records `clampedToMinimum` and says so, because a screened house that cannot deliver the ventilation the scenario requires is a finding rather than a rounding. An installed screen that resolves to no factor is a validation error, so a mesh can never quietly cost nothing.

The measured basis is one instrumented rainy-season campaign at the Asian Institute of Technology, Pathum Thani: three 10 x 20 m houses, 300 tomato plants each, fans off, ventilation inferred from a water balance cross-checked against an energy balance, giving 0.0719, 0.0461 and 0.0361 m³ m⁻² s⁻¹ [S24]. The factors above are those rates as ratios. **The reference is the 40-mesh house, not an unscreened one**: the campaign had no unscreened control, so the ventilation cost of adding a first screen to an open house is unsourced and this model cannot supply it, and declaring a factor of 1.0 claims a house like the measured 40-mesh one rather than an unrestricted one. One house per treatment at one site is a measured direction and magnitude, not a validated universal mesh penalty. Only the ventilation restriction is modeled: the same campaign's measured temperature and humidity rises follow from the run rather than being imposed, and no optical effect of the mesh is applied at all (see [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) §3A).

## Dominance and the operating-cost frontier

**What it is.** A strategy is dominated when another strategy is at least as cheap and holds the band at least as often, and strictly better on one of the two. The frontier is the set of strategies that nothing dominates.

**Unit.** A label, over dollars of operating cost and compliant hours (or median attainment for the multi-year frontier).

**Where it appears.** The "Operating-cost frontier" and "Operating-dominated" labels in the comparison table, and the site verdict.

**How it is computed here.** Two related computations. `compareScenarios` in `src/metrics.js` marks a row dominated when another comparable row has `cost <= cost` and `compliantHours >= compliantHours` with at least one strict inequality, scored on the common eligible hour set. `strategyFrontier` does the same over median cost and median attainment across weather years, and reports the cheapest frontier member as the verdict. Both are **operating cost only**: capital recovery and maintenance are displayed separately and are not in the dominance test. A scenario with missing prices or numerical-failure hours is not comparable and is excluded rather than assumed. Being the cheapest frontier member is a position on the cost axis, not a recommendation: at Tulsa the pad baseline is the cheapest non-dominated strategy in 100% of screened points while holding the band in a median 28.9% of hours against 66.4% for DX.

## Control class

**What it is.** A step on the ladder of environmental control, defined by the set of indoor states its equipment can reach rather than by its brand or its cost: from C0, fans and a wet pad with no heat, up to C6, an opaque uninsulated box with full mechanical authority. Each class is exhausted by a specific physical condition, which is what promotes a site to the next one.

**Unit.** A label: C0, C1, C2, C3, C4, C5, C5b, C6.

**Where it appears.** Not in the interface. It is the organizing spine of [CLASSES.md](CLASSES.md) and the vocabulary [REGIONS.md](REGIONS.md) uses when a climate needs more than the class it has.

**How it is computed here.** A class is not computed, it is constructed: each one is an ordinary scenario built from the shipped components, and it is run through the same coupled model as any other scenario. The comparison in CLASSES.md reports nine configurations (the ladder plus a heat-pump variant of C1) against calendar year 2025 at six bundled sites, under the ideal per-substep controller, with heating, cooling and dehumidification sized per site by the stated rules. What a class row reports is therefore a capability ceiling for that climate, not an installed-system prediction, not an equipment-sizing certificate and not a manufacturer comparison.

## Elementary effect and mu\*

**What it is.** The Morris screening measures. An elementary effect is the change a single parameter causes when moved one step, with everything else held; mu\* is the mean of the absolute effects, which is the influence ranking.

**Unit.** The metric's own unit per full screened range: percentage points for attainment, dollars for operating cost, kWh for electricity.

**Where it appears.** [SENSITIVITY.md](SENSITIVITY.md), [morris-screening.json](morris-screening.json), and the ranking-stability label carried by multi-year comparisons.

**How it is computed here.** `EE = (y(step j) - y(step j-1)) / delta` with `delta = 2/3` in unit-cube space, so effects across different physical units are directly comparable. Alongside mu\* the screening reports mu (the mean signed effect, giving direction) and sigma (the spread, where a sigma comparable to mu\* flags interaction or non-linearity rather than sampling noise). Eight trajectories over twelve parameters gives n = 8 usable step pairs per parameter and metric; a pair with a missing metric is dropped, never zero-filled. Morris is a screening method: it produces no distribution, no confidence interval and no probability that one strategy beats another.

## Ranking stability

**What it is.** Whether the cost order of the strategies survives the thing being varied, either the weather year or the screened parameter ranges.

**Unit.** A label (stable or unstable), plus the count of distinct orders and the share held by the most common one.

**Where it appears.** The across-years verdict and the sensitivity verdict.

**How it is computed here.** Both paths enumerate the full operating-cost order of the strategies at every year or design point, and both apply a rule fixed before the run. The across-years aggregation in `src/metrics.js` is the strict one: stable means one identical order in every year. `rankingStability` in `src/sensitivity.js` is the tolerant one: stable means the most common order holds in at least 90% of design points. Both current verdicts are **unstable**: 2 distinct orders over 5 weather years, and 3 orders over 104 screened points with the most common at 61.5%. The structure matters more than the label, and the tool reports both: the three cheapest positions are identical in 104 of 104 points, and all the instability is inside three strategies whose median costs sit within 16% of each other.

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
| Staged controller | The default causal controller: deadbands, ordered stages, minimum on and off times, dispatched on a one-minute step. Converges with cadence. |
| Ideal modulation upper bound | The retained older controller that re-optimizes every substep. Selectable, labeled, and known not to converge with cadence (1.5 pp, 1.95%). Not a prediction of achievable performance. |
| Unmet load | The steady capacity shortfall in an hour: the extra W or kg/s that would have been needed to hold a violated bound under that hour's forcing, integrated over time. Cadence-invariant to first order, and not a sum of re-counted inventory deficits. |
| Common eligible set | The intersection of eligible hours across all compared scenarios. Comparison dollars and hours use it, so they differ slightly from single-scenario totals. |
| Capital recovery | Annualized capital plus maintenance, shown separately from historical-period operating cost, and never added into the dominance test. |
| Assumption label | Every default input carries a source string saying where the number came from and what it is not: a planning assumption with its arithmetic, an illustrative placeholder, or a user-defined value. |
