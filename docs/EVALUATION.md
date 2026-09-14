# CEA Psychrometric Site Evaluator: evaluation scheme

Date: 2026-09-11. Status: evaluation plan and evidence-tier boundaries, not a claim that all higher-tier gates pass. The approved current iteration is coarse screening; executed checks and material control-cadence sensitivity are recorded in VERIFICATION.md. Benchmarked/site-calibrated gates remain the next iteration.

## 1. Evidence ladder

| Tier | Inputs and checks | Permitted output | Prohibited implication |
|---|---|---|---|
| Weather feasibility | Traceable outside state, vetted psychrometrics, target bands | Air-side cooling/drying/pad operating windows | Actual indoor conditions, tonnage, energy cost or ROI |
| Assumption-based equipment screen | Envelope/crop/light/airflow/equipment model, conservation and numerical checks | Conditional zone trajectories, target hours, loads, energy, costs | Calibrated prediction or manufacturer performance guarantee |
| Benchmarked simulation | Matched conditions against independent model and published measured data | Documented benchmark errors for the covered conditions | General accuracy outside crop/system/climate domain |
| Site-calibrated analysis | Held-out facility sensor/energy/condensate data, documented calibration | Project-specific predictive performance with uncertainty | Guaranteed crop yield, life safety, stamped design or spatial precision |

A detailed interface does not raise the evidence tier. Display it beside results and exports.

## 2. Data acceptance

- Record requested and actual dates, source/model/station, location/elevation, units, download time, raw checksum, time basis and interval semantics.
- Count expected elapsed UTC hours, valid meteorology hours, valid solar hours, joint-valid hours, imputed hours and missing hours separately.
- Observation quality: retain temperature/dew-point reports and original timestamps. Flag invalid RH/pressure, duplicates, suspect jumps and gaps. Canonical RH remains authoritative when a source's auxiliary field is dew/frost point; flag disagreement rather than replacing RH with an incompatible phase convention. Reject impossible dew-point-only inputs.
- TUL routine reports in the research sample occur at :53. A specified nearest-hour rule must use padded downloads and a maximum distance, deterministic tie-breaking, and original timestamp retention. Do not simply drop minutes and pretend the observation was at the top of the hour.
- Use an independent NOAA/NCEI source to cross-check station identity, extrema and suspicious events before calling the full Tulsa study quality-checked. The completed reference study includes 251 archived NOAA daily records and an explicit hourly-vs-daily comparison; it does not apply a calibration correction.
- Parse missing sentinels before numeric conversion; zero is a legitimate irradiance value, not a missing-data replacement.
- Preserve repeated autumn DST hours as distinct UTC intervals. Missing spring civil-clock labels are not missing observations. Test leap years, date boundaries, ZIP codes with leading zeros and schedules crossing midnight.
- POWER UTC and Open-Meteo preceding-hour radiation are different conventions. Resampling must conserve energy and map actual intervals before joins.
- Exclude missing-hour states from official weather-mode counts, but preserve them in expected-hour denominator reporting.
- Equipment trajectories cannot jump over a missing forcing interval as if no time elapsed. End the continuous segment, report the gap, then reinitialize with a labeled warm-up policy; warm-up intervals are excluded from comparative compliance.
- Economics and scenario comparisons use the same eligible intervals. No hidden provider substitution between scenarios.

## 3. Psychrometric verification

Bundle a pinned PsychroLib JavaScript version and license. Compare its use against published ASHRAE/PsychroLib reference states and independent published psychrometric values, not merely another wrapper around the same formula. Cross-language agreement checks port consistency but is not independent physical validation.

Planning tolerances: dry-bulb/dew-point/wet-bulb 0.05 K, humidity ratio 0.00001 kg/kg, moist-air enthalpy 0.1 kJ/kg for compatible reference states. Account for reference rounding. Test subfreezing air, near saturation, dry high-altitude air, warm humid air and SI/IP conversions.

Required properties and conventions:

- Moisture balance uses kg water/kg dry air and kg dry air/s, not total moist-air mass interchangeably.
- PsychroLib SI enthalpy is J/kg dry air; display may convert to kJ/kg. Pressure is Pa. RH is a fraction.
- Standard-atmosphere pressure is an explicit fallback from elevation; sea-level pressure is not station pressure.
- Evaporative pad temperature: Tpad = Tout - effectiveness × (Tout - Twb,out).
- Estimate pad humidity ratio by conserving moist-air enthalpy at Tpad. Record the approximation, including neglected liquid-water enthalpy, and prevent physically supersaturated process states. Do not conserve W and h simultaneously while changing T.
- Air VPD = saturation vapor pressure at Tair minus actual vapor pressure. Leaf VPD substitutes Tleaf in the saturation term. Do not confuse outdoor VPD with crop-zone VPD.
- At each target T, intersect VPD-derived moisture bounds with dew-point/condensation limits. Incompatible target constraints are an input error, not an optimization failure.

## 4. Weather classifier acceptance

Retain the supplied brief's primary codes, plus orthogonal opportunities/conflicts. Establish a non-overlapping precedence table before implementation. The brief contains overlapping illustrative predicates; tests must resolve them rather than count an hour twice.

Suggested precise interpretation:

1. Invalid required state: MISSING_DATA.
2. Below heating threshold: strong outdoor drying and an explicit purge request gives HEAT_MAJOR_VENT_DRY; insufficient drying with humidity-control requirement gives HEAT_VENT_HUMID; otherwise HEAT_MIN_VENT. A weather-only opportunity does not establish that purge is needed.
3. At/above cooling trigger: evaluate bypass and pad leaving state, temperature margin and moisture cap. Classify PAD_EFFECTIVE, PAD_MARGINAL or PAD_INEFFECTIVE_DEHU_NEEDED, with separate temperature/moisture failure flags. If the system has no pad, display required capability separately from installed availability.
4. Outside air meets dry-bulb cooling margin and has useful moisture/enthalpy direction: PASSIVE_VENT_COOL_DRY. Temperature relief with moisture import is a conflict flag and may be PASSIVE_VENT_COOL_HUMID even if enthalpy is unfavorable; retain enthalpy flag rather than hiding the case.
5. Humidity-only opportunity/deficit and neutral conditions: PASSIVE_HUMIDIFY_OPPORTUNITY, ACTIVE_HUMIDIFICATION_LIKELY or NEUTRAL_MIN_VENT according to explicit configured demand and precedence.

A mode name ending in NEEDED means needed to satisfy the selected weather-side target under that classification, not proof of actual crop latent load or selected equipment capacity. Results must explain that distinction.

Boundary cases worth permanent regression tests:

- Cold high-RH air dries the target when humidity ratio is lower.
- Hot humid air has a low pad temperature depression and/or unacceptable pad moisture.
- Hot dry air cools through the pad while moisture increases.
- Cool moist air reduces sensible temperature but imports water.
- Heating/purge feasibility does not become a claim of cheapest operation.
- Equality at each threshold is classified deterministically, with no missing/double-counted primary mode.
- Changes to pad effectiveness can improve temperature while worsening moisture; joint compliance is not assumed monotonic.

Outputs: hours and percentages by mode/month/day-night, calendar days with >=1/4/8 hours, episode count/median/p90/maximum, design-condition extremes, pad failure causes and winter drying opportunity. Missing hours break episodes; never stitch across them.

Sensitivity cases from supplied brief: pad 70/80/85/90%; max dew point 58/62/65 F; day maximum 80/85/90 F with specified night alternatives; pad margin 3/5/8 F; at least cool/warm crop schedules. Report changed classifications, not just new totals.

## 5. Coupled model verification

### Conservation contract

Use a well-mixed zone with dry-air inventory, moisture inventory and energy state. Transpiration transfers liquid water to vapor and consumes energy; condensation transfers vapor to liquid and releases energy. Either a total-enthalpy formulation or a consistent sensible-plus-latent formulation is acceptable. Mixing the two conventions is not.

An auditable sensible balance includes envelope transfer, solar/internal sensible gains, crop evaporation cooling, ventilation sensible exchange, delivered heating, sensible coil removal and recovered/returned dehumidifier heat. The moisture balance includes crop/substrate sources, ventilation exchange, condensate removal, humidification and explicitly modeled surface condensation. A full enthalpy balance must include the enthalpy carried by air and liquid streams and avoid adding the same latent term again.

For an indoor standalone condensing dehumidifier, sensible heat returned to the zone is approximately latent heat of removed moisture + device electrical input, with condensate temperature/enthalpy treated consistently. At the whole-zone total-energy boundary it is not two new external heat sources: condensation converts the zone's existing latent energy, and electrical input is the additional external energy. This distinction prevents the common double-counting bug.

For a split cooling system: Qtotal = Qsensible + Qlatent; outdoor heat rejection approximately equals Qtotal + compressor input, unless an explicit reheat/heat-recovery branch retains part indoors. Reheat cannot be counted both as fully rejected outdoors and delivered inside. A mini-split's latent capacity depends on coil/entering conditions and runtime, not an independent full-capacity slider.

### Proposed numerical gates

These are development tolerances, not measured accuracy claims:

- Per-step energy residual <= max(1 W, 0.1% of gross energy-flow magnitude) and moisture residual <= max(1e-8 kg/s, 0.1% of gross moisture-flow magnitude).
- Never report a numerically failed interval as compliant. NaN, negative inventory, unsupported equipment states or unresolved supersaturation are explicit failures.
- Halving integration step changes period energy by <1%, target compliance by <0.5 percentage points and maximum temperature by <0.2 K on representative stress cases; tighten or qualify where thresholds produce real classification sensitivity.
- No invented exact indoor state in weather-only mode; equipment-mode outputs include assumptions, warm-up and model version.

### Behavioral experiments

| Experiment | Observable result |
|---|---|
| Sealed adiabatic unoccupied zone with equipment off | Energy/moisture inventory conserved |
| Cold outside, heater disabled then enabled | Finite heater changes cold excursion; no free heating from ventilation |
| Fixed humidity load in sealed zone | Moisture accumulation matches mass balance; finite dehu removes only available capacity |
| Standalone dehu added under cooling demand | Moisture improves but electrical/returned sensible heat raises required cooling |
| Same dehu under heating demand | Returned heat can displace delivered heating; no negative purchased fuel |
| DX with no sensible call but moisture load | Limited latent operation or explicit overcool/reheat policy, not perfect humidity control for free |
| Hot humid outside and maximum ventilation | Moisture import can defeat target; outdoor enthalpy alone is not enough |
| Pad off/on in dry and humid climates | Wet-bulb bound respected; bypass available when pad harms joint target |
| Identical indoor system with canopy area doubled | Crop and fixture loads scale by canopy, not just floor area |
| Lights off/on in opaque facility | Crop light and heat inputs change; outdoor GHI does not become crop DLI |
| Increased shade in greenhouse | Solar cooling load falls while natural DLI can fall and lighting demand rises |
| Missing forcing hour | Gap and segment reset reported; no hidden continuous trajectory |
| Identical scenario copied unchanged | Same values, zero incremental investment result |
| Zero extra compliant hours | Incremental cost per additional hour is undefined/unfavorable, never division by zero |

### Published benchmark

Use Katzin et al. (2020), DOI 10.1016/j.biosystemseng.2020.03.010, and its actual measured dataset at https://doi.org/10.4121/78968e1b-eaea-4f37-89f9-2b98ba3ed865.v2. It contains Bleiswijk tomato greenhouse outdoor/indoor/control data and LED/HPS simulations, not Tulsa indoor HVAC ground truth. Dataset license CC BY-SA 4.0 differs from GreenLight's BSD-3-Clause-Clear code license.

Benchmark only matched envelope, crop and control cases. Report temperature/RH bias and RMSE, humidity-ratio error, energy bias, day/night and extreme-hour breakdown. Use a time-separated holdout to prevent tuning and evaluation on the same events. Agreement with GreenLight alone is model-to-model verification; agreement with held-out measurements is validation. No universal benchmark accuracy threshold is asserted before dataset applicability and sensor uncertainty are assessed.

Manufacturer curves are an additional validation source, not interchangeable with nominal equipment labels. Outside a published map, report out-of-domain operation or an explicit derating assumption; never extrapolate invisibly.

## 6. Light and crop checks

- DLI [mol/m2/day] = sum(PPFD [umol/m2/s] × elapsed seconds) / 1e6.
- Fixture electrical W = delivered PPFD × canopy area / (photon efficacy × canopy delivery fraction), with compatible units. Capacity and dimming constrain output.
- Solar-to-PAR and PAR-to-photon conversion depend on spectrum and glazing; assumptions must be visible and sensitivity-tested.
- Verify integration over 23/24/25-hour local days, incomplete days and midnight-crossing photoperiods.
- Controller must not use later weather unless explicitly running hindsight optimization. Report daily DLI deficits even when temperature/VPD passes.
- Check dark-period moisture demand and crop/substrate evaporation separately from daytime radiation response. Leaf temperature and crop transpiration uncertainty often dominate precision claims.

## 7. Investment scheme

### Physical performance

- Hjoint = elapsed eligible hours simultaneously inside temperature AND VPD bands and the selected dew-point guardrail.
- Also report separate temperature/moisture compliance, tighter precision band vs acceptable band, excursion degree-hours/kPa-hours, maximum deviation, longest failure episode, unmet heating/cooling/latent capacity, daily light deficit and equipment runtime.
- Shared eligibility denominator excludes missing weather, numerical failure, and warm-up according to explicit rules. Numerical failures remain prominent and prohibit a favorable ranking.
- Do not erase thermal risk by averaging over acceptable moisture hours or vice versa.

### Cost and value

Current period operating cost = purchased electricity + purchased fuel + water. Annual capital recovery and maintenance are separate ownership figures, not silently allocated into a partial historical window. Electricity includes lights, fans, pumps, compressors, dehu and reheat, without double counting integrated components. Demand tariffs require appropriate demand-interval data; hourly-average peaks are only an hourly proxy, not a tariff-correct 15-minute demand prediction.

For complete representative annual coverage:

Annualized capital = installed cost × capital recovery factor.

CRF = r(1+r)^n / ((1+r)^n - 1), or 1/n when r=0. Each component may have its own lifetime and maintenance assumptions.

Incremental cost per added compliant hour = (candidate annualized total cost - baseline annualized total cost) / (candidate Hjoint - baseline Hjoint), only when denominator >0 and periods are genuinely comparable. Also show incremental capex, operating savings and net change. A cheaper and better scenario dominates; a more expensive worse scenario is dominated. Negative/zero hour gain is not a bargain.

The current coarse-screen UI labels its marginal metric **operating cost per added hour** and its frontier **operating-cost frontier**; both exclude capital. It displays annual ownership separately. The annualized-total metric above remains a higher-tier evaluation requirement, not a description of the currently labeled operating-only metric.

For partial-year or selected historical windows, show observed-period operating costs and capex separately; do not annualize weather-dependent costs without a declared representative dataset. Payback is only calculable with positive net annual savings and a stated economic boundary. Improved precision may cost more and still be valuable; estimating that value requires user-supplied avoided losses, not invented crop revenue.

### Sensitivity and robustness

Run low/base/high cases for crop moisture, envelope U/leakage, shade/transmission, pad effectiveness, equipment performance and tariffs. Report whether the preferred alternative changes. Scenario ranges are not statistical confidence intervals unless a probability model supports them. Several actual years plus hot/humid/cold event analysis are preferable to treating one TMY or year-to-date record as climate resilience proof.

## 8. Release proof

- Execute real-data retrieval/import, save/reload, duplicate scenario, equipment toggle, analysis, hour inspection and CSV/config/report export in an actual browser.
- Check desktop and mobile, keyboard flow, chart/table parity, visible units, incomplete dates, failed network, corrupt import, storage denial and stale results.
- Verify a static web server serves all required runtime assets; imported dataset calculation works with external weather access disabled.
- Retain regression tests only for meaningful physical/data boundary failures. Use throwaway experiments for basic wiring demonstrations.
- Record exact run commands/environment, numerical results and browser observations in the implementation verification report. Nothing in this draft means those release gates have passed.
