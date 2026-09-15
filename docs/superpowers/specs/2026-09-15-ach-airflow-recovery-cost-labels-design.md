# ACH, Outdoor-Air Recovery, and Result Semantics Design

Status: historical design approved in conversation on 2026-09-15. Model `0.3.0-screening` now implements the corrected contract; see [../../IMPLEMENTATION.md](../../IMPLEMENTATION.md) and [../../VERIFICATION.md](../../VERIFICATION.md) for current APIs and executed evidence. Statements about the "current" broken model below describe the pre-cutover implementation, not the released code. Dollar and percentage-point examples in §13 illustrate label syntax, not measured findings or surviving savings claims. The old DOAS result and derived reductions are withdrawn.

## 1. Problem

The calculator currently mixes four concepts that must remain distinct:

1. Uncontrolled envelope infiltration.
2. Controlled outdoor-air flow through vents or fans.
3. Outdoor air conditioned by a dedicated outdoor air system (DOAS).
4. Internal recirculation around the room and crop canopy.

The current model treats `doasM3s` as an outdoor-air stream added to controlled ventilation. That can double-count outdoor air when the DOAS is the ventilation system. It also assigns a fixed DOAS supply temperature while charging conditioning energy only per kilogram of water removed. Cold, dry air can therefore receive sensible tempering without purchased energy.

The existing documentation also calls a `2 ACH` controllable-air ceiling “shell leakage,” uses unsourced mushroom defaults of `6–15 ACH`, compares a constrained `15 ACH` hybrid house with a closed house as though it represented a conventional open greenhouse, reports bare dollar amounts without a complete cost basis, and abbreviates differences in attainment as generic “points.”

## 2. Goals

- Make infiltration, controlled outdoor air, treatment, recovery, and recirculation semantically separate.
- Vary actual controlled outdoor-air flow in response to outdoor and indoor conditions within declared installed limits.
- Count each kilogram of outdoor air once in the zone mass and energy balances.
- Add explicit HRV and ERV treatment using an established sensible-and-latent effectiveness model.
- Repair DOAS sensible, latent, reheat, and fan energy accounting.
- Apply evidence guardrails without inventing universal ACH limits.
- Require project inputs where literature does not support a universal default.
- Expose actual airflow, treatment state, energy, cost basis, and provenance in the UI, exports, and report.
- Withdraw or regenerate conclusions based on the current DOAS and mislabeled airflow model.

## 3. Non-goals

- No wind-and-stack natural-ventilation solver.
- No vent-opening geometry, pressure coefficients, wind direction, or discharge-coefficient model.
- No canopy air-velocity or spatial CFD model.
- No crop, mushroom, or occupant CO2 mass balance.
- No manufacturer performance map inferred from a product family or marketing headline.
- No guaranteed energy savings, payback, yield, or installed-system performance claim.

Natural-greenhouse maximum ACH remains a declared effective capacity. Its relationship to weather-dependent wind and stack capacity must be stated as a limitation.

## 4. Evidence basis and applicability

### 4.1 Greenhouse infiltration and ventilation

- UGA Extension Bulletin 792 reports natural infiltration of `0.75–1.0 ACH` for new glass or fiberglass construction and `0.5–1.0 ACH` for new double-layer film. It also uses one greenhouse air-volume exchange per minute, `60 ACH`, as a warm-weather ventilation rule of thumb. These are construction and operating-context values, not a universal CEA range.
  - https://fieldreport.caes.uga.edu/publications/B792/greenhouses-heating-ventilation-and-cooling/
- Shamshiri et al. report floor-normalized greenhouse airflow guidance of `0.04–0.05 m3/s per m2` for glass and `0.03–0.04 m3/s per m2` for polyethylene, plus `60–90 ACH` for fan-and-pad systems. At `4 m` mean height, the floor-normalized ranges correspond to approximately `36–45 ACH` for glass and `27–36 ACH` for polyethylene. Geometry is therefore part of the interpretation.
  - https://doi.org/10.25165/j.ijabe.20181101.3210

### 4.2 Indoor and mushroom contexts

- Shao et al. measured `0.18 ACH` infiltration in one closed office used for an integrated vertical-farm study. This supports plausibility for that room only. It does not establish an indoor-farm ventilation maximum.
  - https://doi.org/10.1016/j.buildenv.2021.107766
- Chen et al. report that mushroom-factory ventilation lacks standardized design criteria and must respond to species, growth stage, CO2, crop loading, fresh air, and internal circulation. The current `6–15 ACH` mushroom override is therefore not a literature-backed universal range.
  - https://doi.org/10.25165/j.ijabe.20221501.6872

### 4.3 Heat recovery

- The EnergyPlus `HeatExchanger:AirToAir:SensibleAndLatent` model defines heating and cooling sensible and latent effectiveness at 75% and 100% nominal balanced airflow, interpolation over operating flow, economizer bypass, and explicit frost-control modes. It requires representative user or manufacturer performance rather than inferring it.
  - https://bigladdersoftware.com/epx/docs/24-1/engineering-reference/heat-exchangers.html#air-system-air-to-air-sensible-and-latent-effectiveness-heat-exchanger
  - https://bigladdersoftware.com/epx/docs/24-1/input-output-reference/group-heat-recovery.html#heatexchangerairtoairsensibleandlatent
- Maslak and Nimmermark found that moisture removal represented `23–29%` of modeled thermal energy in their tomato-greenhouse cases and modeled `15–17%` thermal-energy savings from a measured non-hygroscopic rotary air-to-air exchanger. Those values demonstrate relevance, not a default effectiveness or guaranteed savings range.
  - https://doi.org/10.23986/afsci.58936
- Sapounas et al. describe semi-closed greenhouses as replacing some window ventilation with air treatment so temperature, humidity, and CO2 can be controlled more independently. This supports topology and control context, not a universal ACH value.
  - https://doi.org/10.3390/agronomy10111739

## 5. Physical invariants

For every simulation step:

```text
actual total outdoor air
  = uncontrolled infiltration
  + controlled outdoor air
```

Each controlled-air parcel passes through at most one ordered treatment train before entering the zone:

```text
outdoor air
  -> optional HRV or ERV recovery core
  -> optional DOAS conditioning
  -> zone
```

When economizer or evaporative-pad operation requires untreated outdoor air, the recovery core is bypassed. The airflow is not added a second time.

Internal recirculation does not enter the outdoor-air mass balance. The current model does not calculate recirculation ACH, canopy velocity, or distribution uniformity.

## 6. Scenario contract

Retain the existing top-level airflow fields to minimize unrelated schema churn, but correct their definitions:

- `infiltrationACH`: uncontrolled outdoor-air exchange through the envelope.
- `minVentACH`: minimum controlled outdoor-air flow while the path is required or enabled. `0` means the controllable path can close fully.
- `maxVentACH`: maximum controlled outdoor-air capacity.
- `fanWPerM3s`: total supply-and-exhaust fan electric input per unit of actual controlled airflow, including the declared recovery-core, filter, and conditioning pressure drops.

Editable but incomplete scenarios may hold `null` for `minVentACH` or `maxVentACH`; both must be finite and `0 <= minVentACH <= maxVentACH` before a run. Add:

- `outsideAirBasis`: `literatureRange`, `adjacentProxy`, `projectInput`, or `screeningAssumption`.
- `outsideAirReviewed`: boolean recording explicit review of the controlled-air capacities and fan-power assumption when the selected basis or treatment requires it.

Editing either controlled-air value marks the basis `projectInput` but does not auto-acknowledge the system. The user explicitly reviews the controlled-air capacities and `fanWPerM3s` together. A literature-backed template assigns `literatureRange` and is not blocked solely for acknowledgment. An unsupported template assumption assigns `screeningAssumption` and `outsideAirReviewed: false`.

The UI labels become:

- “Uncontrolled infiltration”
- “Minimum controlled outdoor air”
- “Maximum controlled outdoor-air capacity”
- “Controlled-air fan specific power”

Add a nested `heatRecovery` object, following the existing screen-component pattern:

```js
heatRecovery: {
  type: 'none' | 'hrv' | 'erv',
  nominalM3s: number | null,
  auxiliaryW: number | null,
  sensibleHeating75: number | null,
  sensibleHeating100: number | null,
  sensibleCooling75: number | null,
  sensibleCooling100: number | null,
  latentHeating75: number | null,
  latentHeating100: number | null,
  latentCooling75: number | null,
  latentCooling100: number | null,
  economizerBypass: true,
  frostControl: 'none' | 'exhaustOnly' | 'preheat',
  minimumOutdoorOperatingC: number | null,
  frostThresholdC: number | null,
  initialDefrostFraction: number | null,
  defrostRatePerK: number | null
}
```

Rules:

- `type: 'none'` is the inert default.
- HRV requires the four sensible effectiveness values. Its latent effectiveness is exactly zero and is not editable.
- ERV requires all eight sensible and latent effectiveness values.
- All effectiveness values are dimensionless fractions from `0` to `1`.
- Recovery scenarios require `nominalM3s > 0` and `auxiliaryW >= 0`.
- No generic effectiveness or auxiliary-power values are supplied.
- `fanWPerM3s` covers the combined supply-and-exhaust fans. `heatRecovery.auxiliaryW` covers only core controls, wheel drive, or other recovery-device auxiliary input when declared, and is charged while the core is active.
- Recovery is active only from 50% through 130% of nominal flow, the documented range of the effectiveness model. Below 50%, this implementation conservatively bypasses the core and warns rather than extrapolating. Above 130%, only 130% of nominal passes through the core, the excess bypasses, and the mixed state proceeds to DOAS conditioning.
- `economizerBypass` is fixed true for this implementation. It is shown as model behavior rather than an editable false precision.
- Balanced supply and exhaust flow are assumed and reported.

Repair the existing DOAS fields as a conditioner in the single controlled-air train:

- `doasM3s`: maximum outdoor airflow the DOAS can condition, not additional outdoor airflow.
- `doasSupplyDewPointC`: maximum supply dew point after conditioning.
- `doasSupplyTempC`: supply dry-bulb target after conditioning.
- Remove `doasKWhPerKg`.
- Add `doasCoolingCOP`.
- Add `doasReheatRecoveryFraction`.
- Heating and preheat use the declared scenario heating source, efficiency or COP, and finite capacity.
- A configured DOAS requires `doasM3s > 0`, `doasCoolingCOP > 0`, and `doasReheatRecoveryFraction` from `0` to `1`.
- `doasM3s` cannot exceed the maximum controlled-air volume flow derived from `maxVentACH`.
- Selecting the DOAS technology creates an incomplete configuration. It must not silently insert the current `2 ACH` treatment capacity, cooling performance, or reheat performance as if those values were sourced.

Selecting a DOAS, HRV, or ERV configuration with missing required performance data leaves the scenario visibly incomplete and blocks the run.

## 7. Airflow conversion and context

For volume `V = areaM2 * heightM`:

```text
m3/s = ACH * V / 3600
m3/s per m2 floor = ACH * heightM / 3600
cfm = m3/s * 2118.880003
cfm/ft2 = (m3/s per m2) * 2118.880003 / 10.7639104
```

The input surface and reports show all four values with the mean height. Literature comparisons use the measure reported by the source. The tool must not compare a floor-normalized flow directly with ACH without converting through scenario height.

## 8. Controller behavior

### 8.1 Controlled airflow

The staged causal controller remains the default. It commands actual controlled airflow between `minVentACH` and `maxVentACH` using its existing ordered stages and minimum dwell times.

The controller increases direct outside air only when it can do useful work:

- Sensible cooling requires supply air cooler than zone air.
- Moisture removal requires supply humidity below both zone humidity and the active upper moisture boundary.
- Cold-weather moisture ventilation is allowed only when available heating can carry the envelope and ventilation load.
- Pad operation requires useful leaving-air temperature and an acceptable supply humidity ratio.

Reports must expose the exact stage levels. For the current `0.3–40 ACH` example, those levels are approximately `0.30`, `10.23`, `20.15`, `30.08`, and `40.00 ACH`. Maximum ACH is never presented as continuous hourly airflow.

The ideal controller remains a labeled upper-bound experiment. Capacity comparisons using either controller must retain the resolution caveat. The implementation does not claim continuous economizer optimization.

### 8.2 Recovery and bypass

For each controlled-air stage, evaluate recovery-active and recovery-bypassed supply states when a recovery core is configured and available.

- Recovery-active uses the current zone state as exhaust inlet and the current weather state as supply inlet.
- Economizer bypass uses untreated outdoor conditions.
- The staged controller selects bypass when untreated outdoor air better serves the active sensible or moisture need.
- Recovery and bypass share the same actual controlled airflow.
- Pad operation bypasses heat recovery.
- Core flow below 50% of nominal bypasses recovery. Core flow above 130% of nominal is capped at 130%, and the excess airflow bypasses before the two streams mix.

### 8.3 DOAS conditioning

DOAS conditioning applies after recovery or bypass and only up to `doasM3s`. A controller request above that capacity is not silently conditioned. It is either limited to conditioner capacity or admitted as explicit economizer bypass when untreated air itself satisfies the active condition.

## 9. HRV and ERV equations

Let the supply inlet be outdoor air, the exhaust inlet be current zone air, and the supply and exhaust flows be balanced. Determine operating sensible and latent effectiveness by linearly interpolating the declared 75% and 100% values against average operating flow divided by nominal flow, following the EnergyPlus formulation.

For balanced flows, the heat-capacity-rate ratio is one. Preserve the general ratio in the implementation so an imbalance extension does not require changing the equations.

```text
T_supply_out = T_supply_in
             + epsilon_sensible
             * (mCp_min / mCp_supply)
             * (T_exhaust_in - T_supply_in)

W_supply_out = W_supply_in
             + epsilon_latent
             * (mCp_min / mCp_supply)
             * (W_exhaust_in - W_supply_in)
```

If the calculated supply state is supersaturated, solve to the saturated state at the same moist-air enthalpy. Do not clip relative humidity.

Report sensible and latent energy transferred by the core. Recovered energy is an energy-transfer quantity, not purchased energy or cash savings.

## 10. Frost control

Recovery frost behavior cannot use one universal temperature.

### 10.1 Manufacturer-qualified no-frost operation

`frostControl: 'none'` requires `minimumOutdoorOperatingC`. If source weather falls below that value, the run is invalid unless a frost strategy is configured. The tool does not assume the unit can continue at full recovery.

### 10.2 Exhaust-only bypass

Require:

- `frostThresholdC`
- `initialDefrostFraction`
- `defrostRatePerK`

For outdoor temperature at or below the threshold:

```text
defrostFraction
  = clamp(
      initialDefrostFraction
      + defrostRatePerK * (frostThresholdC - outdoorTempC),
      0,
      1
    )
```

Supply airflow continues, but the defrost fraction bypasses the core. Recovery energy is multiplied by `1 - defrostFraction`. Report bypassed flow and defrost hours.

### 10.3 Preheat

Preheat raises outdoor air to `frostThresholdC` before the core. It consumes finite scenario heating capacity and the declared heating energy source. Preheat capacity is allocated before zone heating, then the remaining capacity can heat the zone. Report delivered preheat, purchased electricity or fuel, and hours when preheat capacity is insufficient.

## 11. DOAS thermodynamics and energy

The incoming state is the recovery-core outlet or untreated bypass state.

1. If incoming humidity exceeds the declared supply-dew-point humidity, cool and condense to saturation at the supply dew point.
2. Charge the moist-air enthalpy reduction as cooling load divided by `doasCoolingCOP`.
3. If the resulting air is below `doasSupplyTempC`, use recoverable condenser heat up to `doasReheatRecoveryFraction` of available rejection.
4. Meet remaining reheat or cold-weather heating from the finite scenario heating source.
5. If incoming air is warmer than the supply target without requiring dehumidification, charge sensible cooling to the target through `doasCoolingCOP`.
6. Do not invent supply humidification.
7. Charge fan electricity from actual controlled airflow.

The DOAS must never assign a supply temperature without charging or recovering the energy required to reach it.

## 12. Evidence guardrails

Every airflow value displayed to a user carries one status:

- Literature range
- Adjacent-evidence proxy
- Project-specific input
- Screening assumption

### 12.1 Greenhouses

- Preserve sourced construction-specific infiltration ranges.
- Identify single-film, polycarbonate-specific, generic, and hybrid infiltration values as proxies where direct evidence is absent.
- Compare warm-weather controlled-air capacity against both floor-normalized and volume-change guidance.
- A warning outside contextual guidance does not prohibit an engineered design.

### 12.2 Hybrid facilities

- `15 ACH` is a constrained or semi-closed equipment assumption, not a conventional open-greenhouse benchmark.
- Documentation must not infer a general benefit from comparing that case with a closed house.

### 12.3 Opaque indoor facilities

- `2 ACH` is an installed controlled-air capacity assumption, not leakage.
- Infiltration remains separate.
- An adjacent proxy or screening assumption with `outsideAirReviewed: false` blocks the run until the user acknowledges it or enters project values.

### 12.4 Mushroom rooms

- Selecting a mushroom system sets `minVentACH` and `maxVentACH` to `null`, `outsideAirBasis` to `projectInput`, and `outsideAirReviewed` to `false`.
- Require project-specific minimum and maximum controlled outdoor air based on species, growth stage, substrate loading, CO2 target, and equipment.
- Block the run until both values are finite, ordered, explicitly reviewed, and `maxVentACH > 0`.
- State that internal circulation remains outside the model.

## 13. UI and report semantics

### 13.1 Dollar amounts

Use these labels consistently:

- “Model-estimated operating cost for the simulated period”
- “Model-estimated annual operating cost” only for a complete annual weather run
- “Model-estimated operating-cost difference” for scenario A minus scenario B
- “Model-estimated operating-cost reduction” only when a named alternative is lower than a named baseline
- “Estimated installed capital cost” or “User-entered installed capital cost” for capital

Every operating-cost presentation states:

- Included: purchased electricity, purchased heating fuel, and water represented by the scenario.
- Price basis: manual inputs or the named historical state-sector proxy.
- Period: annual only for a complete annual weather run, otherwise the simulated period.
- Excluded unless explicitly represented: installed capital, maintenance, labor, financing, taxes, demand charges, fixed charges, time-of-use effects, and other tariff components.
- A modeled reduction is not a quote or guaranteed savings forecast.

Required narrative form:

> Model-estimated annual operating-cost reduction: $9,871/year relative to the named baseline, using the same weather and entered electricity, fuel, and water prices. Excludes capital, maintenance, labor, financing, taxes, and unmodeled tariff charges. Not a quote or guaranteed savings.

### 13.2 Percentage points

Replace `pts` and bare “points” with “percentage points (pp).” State the metric and endpoints:

> 3.7 percentage points (pp) of joint temperature-and-moisture target attainment, from 93.3% to 97.0% of eligible hours.

Do not call a percentage-point difference a percent change. Do not leave “points” ambiguous with temperature, VPD, yield, or a score.

## 14. Existing conclusions and result invalidation

- Replace “2 ACH shell leakage” with “0.4 ACH modeled infiltration plus 0.3–2 ACH controllable outdoor-air ventilation” where that scenario is discussed.
- Describe `6 ACH` as a modeled economizer-capacity scenario, not a recommended ventilation rate.
- Remove the general conclusion that a hybrid greenhouse should usually close up.
- Relabel the `15 ACH` hybrid case as constrained semi-closed operation.
- Withdraw the current `39,517 dollars` DOAS result and every savings claim derived from it. The current model omits sensible DOAS conditioning energy.
- Regenerate affected examples, tables, screenshots, reports, and changelog claims after implementation and verification.
- Retain the explicit warning that the airflow ladder is resolution-limited and is not continuous economizer optimization.

## 15. Migration and clean cutover

- Bump the scenario schema version.
- Backfill `heatRecovery.type: 'none'` for prior scenarios.
- Backfill `outsideAirBasis` from the matching facility template where evidence status is known. Backfill unsupported generic, hybrid, and opaque controlled-air defaults as `screeningAssumption` with `outsideAirReviewed: false`.
- Migrate prior non-DOAS scenarios without changing airflow behavior.
- Prior scenarios with `doasM3s > 0` must be marked as requiring review because `doasM3s` changes from additive airflow to treatment capacity.
- Remove `doasKWhPerKg` from current scenario creation, validation, UI, reports, exports, examples, and calculations.
- Do not retain a deprecated additive DOAS path or compatibility alias.
- Recompute imported run outputs. Never trust stored results calculated by the prior model version.

## 16. Verification requirements

### 16.1 Behavioral proofs

- Closed controlled-air path: `minVentACH = 0` produces no controlled airflow while infiltration remains.
- Weather response: beneficial cool or dry outdoor conditions increase actual controlled ACH; adverse hot or humid conditions hold it at minimum unless conditioned air is useful.
- No double counting: total outdoor-air mass flow equals infiltration plus one controlled stream, including DOAS, HRV, and ERV configurations.
- HRV sensible balance: recovered heat lost by exhaust equals sensible heat gained by supply within numerical tolerance.
- ERV total balance: sensible plus latent transfer closes across supply and exhaust streams.
- Economizer bypass: bypass and recovery never count simultaneous duplicate supply flow.
- Frost bypass: recovery transfer falls by the calculated non-defrost fraction while supply flow remains represented.
- Preheat: preheat consumes finite heating capacity and purchased energy before zone heating.
- DOAS cold-dry case: tempering outdoor air from `0 C` to `21 C` incurs real heating energy even when no water is removed.
- DOAS hot-humid case: cooling, condensation, and reheat close the moist-air enthalpy and water balances.
- Capacity limits: insufficient DOAS or preheat capacity remains visible as unmet load or an invalid required-air condition.
- Mushroom configuration: missing project-specific airflow blocks the run.

### 16.2 Surface verification

Serve the application and verify in the browser:

- Airflow input labels and provenance statuses.
- Height-dependent unit conversions.
- Required-input blocking for mushroom, HRV, and ERV cases.
- Hourly actual controlled and total ACH.
- Recovery, bypass, frost, and DOAS runtime reporting.
- Cost-basis wording and percentage-point wording.
- Exported report and scenario JSON.

### 16.3 Regression scope

Run focused model, conservation, schema, export, and report checks, then the existing full suite once. Re-run every affected published example and replace old outputs only after the corrected model produces reproducible results.
