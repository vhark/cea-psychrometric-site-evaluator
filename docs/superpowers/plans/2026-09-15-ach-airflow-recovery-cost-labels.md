# ACH, Outdoor-Air Recovery, and Result Semantics Implementation Plan

**Historical approved implementation plan, 2026-09-15.** Retained as the pre-implementation record, not an active task checklist or exact current API. Model `0.3.0-screening` has landed; current contracts are in [../../IMPLEMENTATION.md](../../IMPLEMENTATION.md), current evidence and the final 157/157 integration run in [../../VERIFICATION.md](../../VERIFICATION.md). Proposed field names below can differ from the implemented names (for example `controls.controlledOutdoorAirACH`). Unchecked boxes preserve the original plan rather than indicating unfinished release work. Old numerical claims were withdrawn where no corrected artifact substantiated them.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ACH inputs contextually defensible, model one controlled outdoor-air stream with optional recovery and DOAS treatment, charge all conditioning energy, and make cost and attainment-difference labels self-explanatory.

**Architecture:** Add a DOM-free `src/airflow.js` component module for evidence, conversions, recovery, frost, and DOAS process calculations. `src/config.js` owns schema migration and scenario completeness, `src/simulate.js` owns dispatch and the zone balance, and `src/metrics.js` owns derived summaries. Presentation code consumes only result fields and shared basis objects. The simulator keeps infiltration separate, sends each controlled-air parcel through at most one ordered treatment train, and never represents internal recirculation as outside air.

**Tech Stack:** Browser-native ES modules, Node.js `node:test`, existing PsychroLib-based primitives in `src/physics.js`, static HTML/CSS, One Season Farmers Field and Instrument brand tokens.

---

## Global contracts

Apply these contracts in every task rather than introducing temporary aliases:

```text
total outdoor-air flow = infiltration flow + controlled outdoor-air flow
controlled outdoor air = one stream, optionally recovered, then optionally DOAS-conditioned
internal recirculation = outside this model
```

Current scenario schema and portable bundle schema become version `2`. Version `1` imports are migrated to version `2`, but old result arrays are never reused. Remove `doasKWhPerKg`, `controls.ventACH`, `controls.doasDuty`, the additive DOAS mass-flow term, and the separate `loads.latentKg.doas` path. Do not retain compatibility aliases for those runtime fields.

Use these new hourly names consistently:

```js
controls: {
  controlledACH,
  controlledM3s,
  totalOutdoorACH,
  totalOutdoorM3s,
  recoveryCoreFraction,
  recoveryBypassFraction,
  doasConditionedFraction,
  // existing equipment duties continue here
}

loads: {
  controlledOutdoorAirSensibleKWh,
  latentKg: { controlledOutdoorAir }
}
```

Use explicit component totals rather than one ambiguous DOAS energy number:

```js
doasCondensateKg
doasCoolingDeliveredKWh
doasCoolingElectricKWh
doasRecoveredReheatKWh
doasExternalHeatKWh
doasUnmetConditioningKWh
recoverySensibleKWh
recoveryLatentKWh
recoveryAuxKWh
recoveryBypassM3
recoveryDefrostHours
preheatDeliveredKWh
preheatElectricKWh
preheatFuelKWh
preheatInsufficientHours
```

The heating-capacity order is: recovery preheat, DOAS external heating or reheat, then zone heating. Recovered condenser heat is not purchased energy. Fan electricity is based once on actual controlled `m3/s`, using `fanWPerM3s` as the combined supply-and-exhaust specific power.

## Task 1: Add pure airflow, recovery, and DOAS process primitives

**Files:**
- Create: `src/airflow.js`
- Modify: `src/physics.js`
- Create: `test/airflow.test.mjs`

- [ ] **Step 1: Write failing conversion and recovery tests**

Cover four observable contracts in `test/airflow.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  airflowConversions,
  effectivenessAtFlow,
  recoverSupplyState,
  frostDefrostFraction,
  conditionDoasSupply,
} from '../src/airflow.js';

test('ACH conversions use scenario volume and floor-normalized height', () => {
  const flow = airflowConversions({areaM2: 500, heightM: 4}, 40);
  assert.equal(flow.m3s, 40 * 500 * 4 / 3600);
  assert.equal(flow.m3sPerM2, 40 * 4 / 3600);
  assert.ok(Math.abs(flow.cfm - flow.m3s * 2118.880003) < 1e-9);
  assert.ok(Math.abs(flow.cfmPerFt2 - flow.m3sPerM2 * 2118.880003 / 10.7639104) < 1e-9);
});
```

Also assert:
- HRV latent transfer is exactly zero.
- ERV supply sensible plus latent transfer equals the exhaust-side loss within tolerance.
- Below 50% nominal flow the core is bypassed, above 130% only the capped core fraction is recovered and the excess is mixed back once.
- The DOAS cold-dry process cannot reach a warmer supply target without a positive heating requirement, and the hot-humid process reports positive condensation, cooling, and reheat demand.

- [ ] **Step 2: Run the new test and confirm the missing-module failure**

Run:

```bash
node --test test/airflow.test.mjs
```

Expected: fail because `src/airflow.js` does not exist.

- [ ] **Step 3: Add the psychrometric saturation helper**

Export a bounded `saturatedStateAtEnthalpy(enthalpyJkg, pressurePa)` helper from `src/physics.js`. Solve temperature by bisection, derive saturated humidity ratio at each candidate temperature, and return `{tempC, w}`. Reject non-finite or out-of-domain input. Recovery code must use this when its calculated supply state is supersaturated, never clip relative humidity.

- [ ] **Step 4: Implement the DOM-free airflow module**

`src/airflow.js` must export:

```js
export const HEAT_RECOVERY_DEFAULT = Object.freeze({
  type: 'none',
  nominalM3s: null,
  auxiliaryW: null,
  sensibleHeating75: null,
  sensibleHeating100: null,
  sensibleCooling75: null,
  sensibleCooling100: null,
  latentHeating75: null,
  latentHeating100: null,
  latentCooling75: null,
  latentCooling100: null,
  economizerBypass: true,
  frostControl: 'none',
  minimumOutdoorOperatingC: null,
  frostThresholdC: null,
  initialDefrostFraction: null,
  defrostRatePerK: null,
});
```

Implement these pure functions:
- `backfillHeatRecovery(value)`, returning a fresh object.
- `heatRecoveryErrors(value)`, with HRV sensible-only and ERV sensible-plus-latent requirements.
- `airflowConversions(scenario, ach)` using the approved formulas.
- `effectivenessAtFlow(at75, at100, flowRatio)`, linear through the declared rating points. Do not extrapolate outside the supported 0.5 to 1.3 operating range.
- `frostDefrostFraction(recovery, outdoorTempC)` using the approved clamp formula.
- `recoverSupplyState({outside, exhaust, volumeFlowM3s, recovery, bypass, availablePreheatW})`, returning supply state, core and bypass flow, sensible and latent transfer, auxiliary power, preheat demand and delivery, defrost fraction, and insufficiency state.
- `conditionDoasSupply({inlet, volumeFlowM3s, pressurePa, supplyTempC, supplyDewPointC, coolingCOP, reheatRecoveryFraction, availableHeatingW})`, returning outlet state and explicit cooling, condensation, recovered reheat, external heat, and unmet conditioning terms.

Keep treatment calculations independent from controller policy. The controller decides which path to evaluate, the pure functions calculate that path.

- [ ] **Step 5: Run the focused test**

Run:

```bash
node --test test/airflow.test.mjs
```

Expected: all airflow primitive tests pass.

- [ ] **Step 6: Commit the primitive layer**

```bash
git add src/airflow.js src/physics.js test/airflow.test.mjs
git commit -m "feat: add outdoor-air treatment primitives"
```

## Task 2: Introduce schema version 2 and evidence-aware configuration

**Files:**
- Modify: `src/config.js`
- Modify: `src/export.js`
- Modify: `src/worker.js`
- Modify: `test/data.test.mjs`
- Modify: `test/model.test.mjs`

- [ ] **Step 1: Write failing schema and validation tests**

Add tests for these contracts:
- New scenarios and portable exports use schema version `2`.
- A version `1` non-DOAS scenario migrates to version `2`, receives `heatRecovery.type === 'none'`, and preserves its prior airflow behavior.
- A version `1` scenario with `doasM3s > 0` preserves that number only as a candidate treatment capacity, receives `doasCoolingCOP: null`, `doasReheatRecoveryFraction: null`, `outsideAirReviewed: false`, and is blocked until reviewed and completed.
- Future scenario or bundle versions are rejected.
- Editing or constructing a mushroom scenario with missing controlled airflow is blocked.
- A DOAS cannot exceed the maximum controlled flow derived from `maxVentACH`.
- Configured HRV and ERV cases reject missing rating data.

Replace the existing test that treats a version `2` bundle as future with version `3`.

- [ ] **Step 2: Run focused schema tests and confirm failure**

Run:

```bash
node --test test/data.test.mjs test/model.test.mjs
```

Expected: new version, migration, mushroom, recovery, and DOAS validation assertions fail.

- [ ] **Step 3: Add evidence and schema constants**

In `src/config.js`, export `SCENARIO_SCHEMA_VERSION = 2` and use it in `DEFAULT_SCENARIO`, `makeScenario`, validation, and export code. Add a facility-airflow evidence catalog with statuses and contextual ranges:

```js
export const AIRFLOW_BASIS = Object.freeze({
  literatureRange: 'Literature range',
  adjacentProxy: 'Adjacent-evidence proxy',
  projectInput: 'Project-specific input',
  screeningAssumption: 'Screening assumption',
});
```

The catalog must distinguish:
- Greenhouse construction infiltration ranges from UGA.
- Glass and polyethylene floor-normalized controlled-air ranges from Shamshiri et al., converted through scenario height before comparison.
- `60 ACH` warm-weather greenhouse guidance and `60 to 90 ACH` fan-and-pad context as operating context, not universal validation limits.
- The single `0.18 ACH` closed-room measurement as an adjacent proxy only.
- Generic, hybrid, opaque, and mushroom controlled-air values as unsupported screening or project inputs where no direct default exists.

Do not reject a project merely because it falls outside a literature context. Return a warning that names the source context, geometry conversion, and difference.

- [ ] **Step 4: Update defaults, templates, and technology application**

Change the scenario contract:

```js
outsideAirBasis: 'literatureRange',
outsideAirReviewed: true,
installedCostBasis: 'screeningAssumption',
heatRecovery: HEAT_RECOVERY_DEFAULT,
doasM3s: 0,
doasSupplyDewPointC: null,
doasSupplyTempC: null,
doasCoolingCOP: null,
doasReheatRecoveryFraction: null,
```

Specific rules:
- Label `infiltrationACH` as uncontrolled infiltration.
- Label `minVentACH` and `maxVentACH` as controlled outdoor air.
- Opaque templates retain `0.4 ACH` infiltration where already declared and treat `2 ACH` as controlled-air capacity, never leakage.
- Hybrid `15 ACH` is a constrained semi-closed screening assumption with review required.
- Mushroom selection sets `minVentACH = null`, `maxVentACH = null`, `outsideAirBasis = 'projectInput'`, and `outsideAirReviewed = false`.
- The DOAS technology preset clears treatment performance and creates an incomplete configuration. It must not inject `2 ACH`, a COP, a reheat fraction, or a performance claim.
- Remove `doasKWhPerKg` from `DEFAULT_SCENARIO`, `FIELDS`, technology application, and backfill lists.

- [ ] **Step 5: Implement explicit migration and validation**

Add `migrateScenario(input)` that clones its input and accepts only scenario versions `1` and `2`. Migration must:
- bump to `2`;
- backfill inert recovery;
- derive the controlled-air evidence basis from the matching facility template;
- mark unsupported generic, hybrid, and opaque values unreviewed;
- mark old DOAS configurations unreviewed and leave new required DOAS performance null;
- remove `doasKWhPerKg` from the migrated object.

`validateScenario` must validate the migrated version without inventing required performance. `simulateScenario` will call the same migration and validation before running in Task 3. `parseImport` must accept portable versions `1` and `2`, extract scenarios and snapshot only, migrate every scenario, discard imported results, and return version `2` scenarios. Export only version `2`.

- [ ] **Step 6: Run focused schema tests**

Run:

```bash
node --test test/data.test.mjs test/model.test.mjs
```

Expected: schema and validation tests pass. Existing DOAS physics tests may still fail until Tasks 3 through 5 and should not be weakened.

- [ ] **Step 7: Commit schema and evidence configuration**

```bash
git add src/config.js src/export.js src/worker.js test/data.test.mjs test/model.test.mjs
git commit -m "feat: add airflow evidence and schema migration"
```

## Task 3: Replace additive DOAS flow with one controlled outdoor-air stream

**Files:**
- Modify: `src/simulate.js`
- Modify: `src/metrics.js`
- Modify: `src/charts.js`
- Modify: `test/model.test.mjs`
- Modify: `test/conservation.test.mjs`
- Modify: `test/analysis.test.mjs`

- [ ] **Step 1: Write failing outdoor-air topology tests**

Add behavioral tests that isolate exchange from equipment:
- `minVentACH = maxVentACH = 0` gives `controlledACH === 0` while a positive `infiltrationACH` still changes zone temperature and moisture.
- Total outdoor-air dry-air mass flow equals infiltration plus exactly one controlled stream.
- A scenario with DOAS capacity does not increase `controlledACH` or total outdoor flow beyond the selected controlled-air stage.
- Cool or dry useful weather raises staged `controlledACH`; hot-humid adverse weather holds untreated controlled air at minimum.
- The `0.3 to 40 ACH` staged ladder exposes `0.30`, `10.225`, `20.15`, `30.075`, and `40.00 ACH` as the only direct ventilation stages.

- [ ] **Step 2: Run the topology tests and confirm additive-flow failure**

Run:

```bash
node --test test/model.test.mjs test/conservation.test.mjs test/analysis.test.mjs
```

Expected: the closed-path, total-flow, stage, and no-double-counting assertions fail against `doasFlow` and old control names.

- [ ] **Step 3: Refactor airflow options and coefficients**

Replace the old `airOption(ctx, ach, kind, doasDuty)` cross-product with one option object:

```js
{
  controlledACH,
  controlledM3s,
  kind: 'outside' | 'pad' | 'indirect',
  recoveryMode: 'none' | 'active' | 'bypass',
  doasMode: 'none' | 'conditioned',
  supply: {tempC, w},
  treatment: {...}
}
```

`coefficients()` must calculate only `leak` and `controlledFlow`. Remove `doasFlow`. The controlled supply state, treated or untreated, enters both heat and moisture source terms once. Curtain and insect-screen capacity limits apply to controlled air only after infiltration is accounted separately.

Rename hourly load fields to `controlledOutdoorAirSensibleKWh` and `latentKg.controlledOutdoorAir`. Remove the old separate DOAS latent source. Update chart load keys and analysis fixtures in the same commit.

- [ ] **Step 4: Make simulation validate before dispatch**

At the top of `simulateScenario`, migrate a clone, validate it, and throw one actionable error containing all incomplete requirements. This is required for direct API callers, workers, and browser runs to enforce the same mushroom, recovery, and DOAS rules.

- [ ] **Step 5: Emit explicit actual flow controls**

Accumulate `controlledACH`, `controlledM3s`, `totalOutdoorACH`, and `totalOutdoorM3s` per hour. `totalOutdoorACH` is `infiltrationACH + controlledACH`; it is not an internal circulation rate. Update mode selection, CO2 opportunity, and design-hour logic to use `controlledACH`. Recovery or DOAS at minimum controlled flow must not be treated as extra outdoor air.

- [ ] **Step 6: Run focused topology tests**

Run:

```bash
node --test test/model.test.mjs test/conservation.test.mjs test/analysis.test.mjs
```

Expected: topology, conservation, actual-stage, load-decomposition, and design-airflow tests pass.

- [ ] **Step 7: Commit the single-stream cutover**

```bash
git add src/simulate.js src/metrics.js src/charts.js test/model.test.mjs test/conservation.test.mjs test/analysis.test.mjs
git commit -m "fix: model one controlled outdoor-air stream"
```

## Task 4: Integrate HRV, ERV, bypass, and frost control

**Files:**
- Modify: `src/simulate.js`
- Modify: `src/metrics.js`
- Modify: `test/conservation.test.mjs`
- Modify: `test/model.test.mjs`

- [ ] **Step 1: Add failing integration tests**

Use closed-zone fixtures with independently calculated balances:
- HRV sensible heat gained by supply equals exhaust sensible heat lost.
- HRV transfers zero latent energy.
- ERV sensible plus latent transfer closes.
- Economizer bypass and pad operation report zero simultaneous recovered duplicate flow.
- Exhaust-only frost reduces recovery by exactly `1 - defrostFraction` while controlled supply flow remains unchanged.
- Preheat consumes finite heating capacity first, charges the correct electricity or fuel path, and reduces the remaining zone-heating capacity.
- If preheat cannot reach `frostThresholdC`, the core is bypassed for that substep and `preheatInsufficientHours` is visible.
- `frostControl: 'none'` rejects a weather record below `minimumOutdoorOperatingC` before returning results.

- [ ] **Step 2: Run focused tests and confirm failures**

Run:

```bash
node --test test/conservation.test.mjs test/model.test.mjs
```

Expected: recovery runtime, frost, and preheat assertions fail because the simulator does not yet call the primitives.

- [ ] **Step 3: Add recovery-active and bypass candidates**

For every controlled direct-air stage, evaluate recovery-active and recovery-bypass candidates when the core is configured. The staged controller must bypass when untreated air is more useful for the active sensible or moisture need. Pad and indirect evaporative options always bypass recovery. Both candidates share the same controlled airflow.

Below 50% nominal flow, emit only bypass behavior with a warning. Above 130%, recover only the capped core flow and mix the excess untreated bypass flow once. Charge `heatRecovery.auxiliaryW` only while core flow is active.

- [ ] **Step 4: Allocate frost preheat before other heating**

For preheat control, calculate the finite delivered heat needed to bring the outdoor stream to the frost threshold. Reserve available heating capacity in this order:

```text
preheat delivered
then DOAS external heat
then zone heater
```

If the threshold cannot be reached, retain the delivered preheat energy, bypass the core, mark insufficiency, and never operate the core below its declared protected inlet condition.

- [ ] **Step 5: Accumulate recovery and frost outputs**

Populate the explicit hourly and summary fields from the global contract. Add runtime rows for recovery-active, recovery-bypass, frost defrost, and preheat. Include balanced-flow, supported-flow range, and manufacturer-input assumptions in `result.assumptions.airflow`.

- [ ] **Step 6: Run focused integration tests**

Run:

```bash
node --test test/airflow.test.mjs test/conservation.test.mjs test/model.test.mjs
```

Expected: all recovery, frost, topology, and existing model tests pass.

- [ ] **Step 7: Commit recovery integration**

```bash
git add src/simulate.js src/metrics.js test/conservation.test.mjs test/model.test.mjs
git commit -m "feat: integrate heat recovery and frost control"
```

## Task 5: Replace the DOAS shortcut with explicit psychrometric conditioning

**Files:**
- Modify: `src/simulate.js`
- Modify: `src/metrics.js`
- Modify: `test/airflow.test.mjs`
- Modify: `test/conservation.test.mjs`
- Modify: `test/model.test.mjs`

- [ ] **Step 1: Replace old DOAS tests with failing energy-balance tests**

Delete tests that multiply removal by `doasKWhPerKg`. Add these observable contracts:
- Cold-dry `0 C` air conditioned to `21 C` incurs positive delivered and purchased heating even when condensate is exactly zero.
- Hot-humid air above the supply dew point reports positive condensate and a cooling load equal to the moist-air enthalpy drop, within tolerance.
- Cooling electricity is delivered cooling divided by `doasCoolingCOP`.
- Recovered reheat does not exceed both reheat demand and the declared fraction of condenser rejection.
- Remaining DOAS heat uses the declared finite heating source and leaves a visible unmet conditioning term if capacity runs out.
- DOAS conditions no more than `doasM3s`; no second mass stream enters the zone.

- [ ] **Step 2: Run focused DOAS tests and confirm failure**

Run:

```bash
node --test test/airflow.test.mjs test/conservation.test.mjs test/model.test.mjs
```

Expected: cold-dry heating, explicit cooling, reheat, capacity, and output-field assertions fail.

- [ ] **Step 3: Apply DOAS after recovery in each candidate**

For a conditioned candidate:
1. start with recovery output or untreated outdoor air;
2. limit conditioned volume to `doasM3s`;
3. cool and condense to saturation at the supply dew point when needed;
4. charge cooling electricity from moist-air enthalpy reduction and COP;
5. use recoverable condenser heat for reheat;
6. use remaining finite heating capacity for reheat or cold-weather tempering;
7. expose unmet conditioning rather than assigning the target supply state for free.

A controller request above DOAS capacity may only pass the excess as an explicit untreated economizer bypass candidate when that untreated air helps. It must not silently receive the conditioned state.

- [ ] **Step 4: Remove ambiguous DOAS totals and warnings**

Remove `doasKWh` and `doasRemovedKg`. Report the explicit fields from the global contract. Rewrite warnings to state supply target, COP, reheat-recovery fraction, conditioning capacity, fan basis, and exclusions. No wording may claim dry-neutral delivery when capacity is insufficient.

- [ ] **Step 5: Run focused DOAS and conservation tests**

Run:

```bash
node --test test/airflow.test.mjs test/conservation.test.mjs test/model.test.mjs
```

Expected: all tests pass, including the formerly free cold-dry tempering case.

- [ ] **Step 6: Commit corrected DOAS accounting**

```bash
git add src/simulate.js src/metrics.js test/airflow.test.mjs test/conservation.test.mjs test/model.test.mjs
git commit -m "fix: account for DOAS conditioning energy"
```

## Task 6: Add structured airflow and cost summaries to metrics and exports

**Files:**
- Modify: `src/metrics.js`
- Modify: `src/export.js`
- Modify: `test/analysis.test.mjs`
- Modify: `test/data.test.mjs`

- [ ] **Step 1: Write failing result-contract tests**

Assert behavior, not prose fragments:
- `summarizeHours` returns min, mean, maximum, and stage distribution for actual controlled and total outdoor ACH.
- `designHours().controlledOutdoorAirRequirement` identifies the maximum actual controlled ACH, `m3/s`, `cfm`, `m3/s/m2`, `cfm/ft2`, mean height, and coincident outdoor state.
- Complete January 1 through December 31 local-year runs have annual cost scope; partial records have period scope.
- `summary.costBasis` is structured and names included energy and water, price basis, period, exclusions, and no-guarantee status.
- CSV output columns expose actual airflow, recovery, frost, and DOAS terms.
- Portable run exports contain schema version `2` and no stale imported result is trusted.

- [ ] **Step 2: Run focused tests and confirm missing summaries**

Run:

```bash
node --test test/analysis.test.mjs test/data.test.mjs
```

Expected: structured basis, converted airflow, and new export-column assertions fail.

- [ ] **Step 3: Implement airflow summaries**

Add a summary object shaped like:

```js
summary.outdoorAir = {
  controlledACH: {min, mean, max, stages: [{ach, hours}]},
  totalACH: {min, mean, max},
  maximum: {ach, m3s, cfm, m3sPerM2, cfmPerFt2, heightM},
  basis: scenario.outsideAirBasis,
  reviewed: scenario.outsideAirReviewed,
};
```

Rename `ventilationAirRequirement` to `controlledOutdoorAirRequirement`. The derived flow must use the actual maximum selected stage, not configured maximum capacity when the controller never reached it.

- [ ] **Step 4: Implement structured cost basis**

Build the cost basis from scenario, snapshot, and actual record coverage:

```js
{
  scope: 'annual' | 'period',
  label: 'Model-estimated annual operating cost' | 'Model-estimated operating cost for the simulated period',
  period: {startDate, endDate},
  included: ['purchased electricity', 'purchased heating fuel', 'water represented by the scenario'],
  priceBasis: {electricity, fuel, water},
  excluded: ['installed capital', 'maintenance', 'labor', 'financing', 'taxes', 'demand charges', 'fixed charges', 'time-of-use effects', 'other unmodeled tariff components'],
  isQuote: false,
  isGuaranteedSavings: false,
}
```

`compareScenarios` must label signed differences as model-estimated operating-cost differences. Only a lower alternative relative to a named baseline may expose a positive `operatingCostReduction` object. Capital remains separate and carries `installedCostBasis`.

- [ ] **Step 5: Update exports**

The JSON export already carries result objects, so ensure it carries only version `2` scenarios and current results. Expand CSV with actual airflow and component totals. Update the design-basis brief data rows to show controlled and total outside air in all four units and to consume the structured cost basis.

- [ ] **Step 6: Run focused metrics and export tests**

Run:

```bash
node --test test/analysis.test.mjs test/data.test.mjs
```

Expected: all result-contract tests pass.

- [ ] **Step 7: Commit metrics and export contracts**

```bash
git add src/metrics.js src/export.js test/analysis.test.mjs test/data.test.mjs
git commit -m "feat: expose airflow and cost result context"
```

## Task 7: Build the airflow evidence and recovery input surface

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`

- [ ] **Step 1: Add explicit airflow controls to the scenario form**

Replace the generic airflow field group with a dedicated panel that shows:
- uncontrolled infiltration;
- minimum controlled outdoor air;
- maximum controlled outdoor-air capacity;
- controlled-air fan specific power;
- basis select or readout;
- an explicit review checkbox covering capacities and fan power;
- derived `m3/s`, `m3/s per m2`, `cfm`, and `cfm/ft2` at the scenario mean height;
- literature-context cards that preserve each source's original units and show height-based conversions.

Empty mushroom values must remain empty rather than becoming `NaN`. Editing minimum or maximum controlled ACH sets `outsideAirBasis = 'projectInput'` and clears `outsideAirReviewed`. Editing fan power also clears review. Checking review is a deliberate user action.

- [ ] **Step 2: Add nested heat-recovery controls**

Create controls for recovery type, nominal flow, auxiliary power, heating and cooling rating points, frost strategy, and strategy-specific values. Hide latent fields for HRV and display them as fixed zero. Show them for ERV. Display `economizerBypass` and balanced flow as fixed model behavior, not checkboxes.

Use the current component-panel behavior: missing required values remain blank, validation text names the field, and no generic performance is silently inserted.

- [ ] **Step 3: Repair the DOAS input panel**

Rename capacity and performance labels to treatment semantics. Add cooling COP and reheat-recovery fraction. Remove energy-per-kilogram. The DOAS preset should scroll or focus the incomplete panel and explain that project or manufacturer values are required before running.

- [ ] **Step 4: Show scenario completeness before run**

Render validation errors beside the airflow component panel and keep the run button blocked while any selected scenario is incomplete. For mushroom, name species, stage, substrate loading, CO2 target, and equipment as the inputs needed to establish project airflow. State that internal circulation and canopy velocity are not modeled.

- [ ] **Step 5: Smoke the form in a browser**

Start the static server:

```bash
npm run serve
```

Open `http://127.0.0.1:8150` and verify:
- selecting mushroom produces blank required minimum and maximum controlled-air fields;
- run remains blocked until finite, ordered, positive-maximum values are entered and reviewed;
- selecting HRV or ERV exposes the correct fields and blocks incomplete data;
- changing height updates all derived flow units;
- selecting DOAS never inserts the old `2 ACH` or `0.5 kWh/kg` assumptions.

Do not add permanent DOM-source or wording tests for this UI. Browser behavior is the proof.

- [ ] **Step 6: Commit the input surface**

```bash
git add index.html src/app.js styles.css
git commit -m "feat: add reviewed outdoor-air configuration UI"
```

## Task 8: Clarify result semantics and adopt the One Season Farmers brand

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Modify: `src/report.js`
- Modify: `src/export.js`
- Modify: `src/charts.js`
- Modify: `src/learn.js`
- Modify: `src/tour.js`
- Modify: `scripts/reference-study.mjs`

- [ ] **Step 1: Replace ambiguous result labels**

Across app, printable report, design-basis brief, charts, Learn, tour, and generated reference-study HTML:
- Replace `pts` and bare attainment “points” with `percentage points (pp)`.
- State the metric and endpoints for every calculated difference, for example `3.7 percentage points (pp) of joint temperature-and-moisture target attainment, from 93.3% to 97.0% of eligible hours`.
- Do not convert percentage-point changes into percent changes.
- Use the structured operating-cost label and basis at every dollar result.
- Label installed capital as estimated or user-entered from `installedCostBasis`.
- Use “operating-cost reduction” only for a lower named alternative against a named baseline. Add “not a quote or guaranteed savings” wherever a reduction is displayed.

- [ ] **Step 2: Add actual airflow and treatment results**

Update headline detail, runtime table, load table, hourly inspector, comparison, report, and brief to show:
- actual controlled ACH and total outdoor ACH;
- stage distribution and configured maximum capacity;
- recovery active versus bypass flow;
- sensible and latent recovery transfer, explicitly not purchased energy or cash savings;
- frost and preheat runtime and insufficiency;
- DOAS condensate, delivered cooling, purchased cooling electricity, recovered reheat, external heat, and unmet conditioning.

Never label maximum installed ACH as continuous actual flow.

- [ ] **Step 3: Replace the calculator's visual tokens with Instrument mode**

Use `brand/index.html` as the source of truth. In `index.html`, load Young Serif, Hanken Grotesk, and Spline Sans Mono. Embed the canonical `#pw` pinwheel symbol and use the One Season Farmers lockup. In `styles.css`:
- map ground, panels, ink, lines, accent, and four seasons to the approved Instrument tokens;
- set titles to Young Serif at weight 400 only;
- set body and UI to Hanken Grotesk;
- set data and metrics to Spline Sans Mono;
- remove the old Grownetics Carbon, DM Sans, Inter, and IBM Plex Mono token system;
- retain full-border tinted callouts, never colored side stripes;
- use no pure black or white, gradient text, or glassmorphism.

The calculator is an interactive tool, so it may follow OS dark mode into Instrument. Keep explicit theme overrides deterministic.

- [ ] **Step 4: Convert exported documents to Field mode**

`src/report.js`, `src/export.js`, and `scripts/reference-study.mjs` must use Field tokens by default regardless of OS preference. Dark output may exist only under explicit `[data-theme="dark"]`. Use the same pinwheel and type families. Remove old Archive-register and Grownetics identity wording from generated documents and architectural comments.

- [ ] **Step 5: Check generated HTML structure without pinning prose**

Extend the existing design-basis test only for durable safety and contract properties:
- scenario text remains escaped;
- generated documents contain no em dash;
- Field mode is default and has no `prefers-color-scheme: dark` auto-switch;
- cost basis data is present from the result object;
- no removed runtime field names appear.

Do not assert entire sentences or CSS source snapshots.

- [ ] **Step 6: Run focused presentation checks**

Run:

```bash
node --test test/analysis.test.mjs
node --check src/app.js
node --check src/report.js
node --check src/learn.js
node --check src/tour.js
node --check scripts/reference-study.mjs
```

Expected: all checks pass.

- [ ] **Step 7: Commit semantics and brand migration**

```bash
git add index.html styles.css src/app.js src/report.js src/export.js src/charts.js src/learn.js src/tour.js scripts/reference-study.mjs test/analysis.test.mjs
git commit -m "feat: clarify result semantics and apply OSF brand"
```

## Task 9: Migrate and re-run the example library

**Files:**
- Modify: `docs/example-scenarios.json`
- Modify: `docs/examples/*.json`
- Modify: `test/examples.test.mjs`

- [ ] **Step 1: Update the example contract test first**

Require outer and nested scenario schema version `2`, no `doasKWhPerKg`, a complete `heatRecovery` object, explicit outside-air basis and review state, and valid DOAS performance where DOAS is selected. Keep the real-weather-week numerical and conservation checks.

- [ ] **Step 2: Run the example test and confirm old fixtures fail**

Run:

```bash
node --test test/examples.test.mjs
```

Expected: all version `1` example sets fail the new current-schema contract, and DOAS and mushroom sets report incomplete assumptions.

- [ ] **Step 3: Migrate non-DOAS examples**

Use `migrateScenario` to produce current version `2` objects, then review each result rather than text-replacing JSON. Assign evidence status from the facility context. Preserve prior non-DOAS numeric behavior unless a value was specifically identified as mislabeled or unsupported.

- [ ] **Step 4: Repair DOAS and mushroom examples explicitly**

For each DOAS example, enter declared scenario-specific `doasM3s`, supply temperature, supply dew point, cooling COP, and reheat-recovery fraction. Label them as screening or project inputs in each set's note, not literature defaults or manufacturer data.

For mushroom examples, enter finite project-example minimum and maximum controlled airflow and mark them reviewed only in the context of that named example. State that they are illustrative inputs requiring replacement from species, stage, loading, and CO2 design. Do not restore a universal mushroom `6 to 15 ACH` default.

- [ ] **Step 5: Correct names and notes before measuring results**

In `closed-and-hybrid-air.json`:
- rename the old shell-leakage case to `0.4 ACH modeled infiltration plus 0.3 to 2 ACH controllable outdoor air`;
- describe `6 ACH` as modeled economizer capacity, not a recommendation;
- describe `15 ACH` hybrid operation as constrained semi-closed;
- remove the premise that a hybrid generally should close up;
- remove every old `$39,517` or derived reduction claim from notes.

- [ ] **Step 6: Run the full example library**

Run:

```bash
node --test test/examples.test.mjs
```

Expected: every set validates and simulates a real week with zero numerical failures and conservation residuals within the existing thresholds.

- [ ] **Step 7: Commit migrated examples**

```bash
git add docs/example-scenarios.json docs/examples test/examples.test.mjs
git commit -m "data: migrate airflow examples to schema two"
```

## Task 10: Verify the actual browser surface and regenerate browser artifacts

**Files:**
- Modify: `docs/example-comparison.html`
- Modify: `docs/example-design-basis.html`
- Modify: `docs/browser-run-metrics.json`

- [ ] **Step 1: Run the focused model suite before browser generation**

Run:

```bash
node --test test/airflow.test.mjs test/model.test.mjs test/conservation.test.mjs test/data.test.mjs test/analysis.test.mjs test/examples.test.mjs
```

Expected: all focused tests pass.

- [ ] **Step 2: Start the application and run the canonical comparison**

Run:

```bash
npm run serve
```

In the browser at `http://127.0.0.1:8150`:
1. load Tulsa 2025;
2. import `docs/example-scenarios.json`;
3. run all six scenarios;
4. inspect one minimum-air hour and one higher-airflow hour;
5. confirm controlled and total ACH, treatment state, and cost basis;
6. export run JSON, hourly CSV, printable report, and design-basis brief.

- [ ] **Step 3: Exercise incomplete and conditioned cases**

In the same browser session:
- confirm mushroom, HRV, ERV, and DOAS incomplete configurations block visibly;
- complete one HRV or ERV scenario with declared test rating points and exercise active and bypass states;
- complete one DOAS scenario and inspect cold-dry and hot-humid output using an appropriate bundled or short imported record;
- verify desktop and 390-pixel mobile layouts visually;
- verify no console errors and that Young Serif, Hanken Grotesk, and Spline Sans Mono are loaded.

- [ ] **Step 4: Replace retained browser artifacts**

Move the newly exported canonical report and design-basis brief into their committed paths. Rebuild `docs/browser-run-metrics.json` from the observed browser run, including current model version, schema version, key comparison metrics, test count, byte sizes, and SHA-256 hashes. Do not carry old numeric claims forward if they were not observed in this run.

- [ ] **Step 5: Commit browser-proven outputs**

```bash
git add docs/example-comparison.html docs/example-design-basis.html docs/browser-run-metrics.json
git commit -m "docs: regenerate verified airflow reports"
```

## Task 11: Regenerate deterministic studies affected by the model contract

**Files:**
- Modify: `scripts/regional-study.mjs`
- Modify: `scripts/morris-screening.mjs`
- Modify: `docs/regional-study.json`
- Modify: `docs/morris-screening.json`
- Modify: `test/regional.test.mjs`
- Modify: `test/sensitivity.test.mjs`

- [ ] **Step 1: Update study schemas and terminology**

Use scenario schema version `2`, the current model version, `percentage points (pp)`, and the structured operating-cost basis. Replace any study text that calls controlled airflow leakage or treats maximum ACH as continuous actual flow. Keep study methodology unchanged unless the corrected airflow contract requires a named output field.

- [ ] **Step 2: Run study contract tests and confirm stale artifacts fail**

Run:

```bash
node --test test/regional.test.mjs test/sensitivity.test.mjs
```

Expected: stale model/schema or removed-field assertions fail against the committed artifacts.

- [ ] **Step 3: Regenerate the Morris screening**

Run:

```bash
node scripts/morris-screening.mjs
node --test test/sensitivity.test.mjs
```

Expected: deterministic artifact is written, all sensitivity contract tests pass, and reported attainment effects use percentage-point units.

- [ ] **Step 4: Regenerate the regional study**

Run:

```bash
node scripts/regional-study.mjs
node --test test/regional.test.mjs
```

Expected: 360 simulations complete, the artifact uses the current model and schema, and all regional contract tests pass.

- [ ] **Step 5: Commit regenerated studies**

```bash
git add scripts/regional-study.mjs scripts/morris-screening.mjs docs/regional-study.json docs/morris-screening.json test/regional.test.mjs test/sensitivity.test.mjs
git commit -m "data: regenerate airflow-sensitive studies"
```

## Task 12: Clean up documentation, withdraw invalid claims, and verify the release

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `NOTICE`
- Modify: `docs/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION.md`
- Modify: `docs/WORKFLOW.md`
- Modify: `docs/GLOSSARY.md`
- Modify: `docs/COMPONENT-PARAMETERS.md`
- Modify: `docs/CLASSES.md`
- Modify: `docs/VERIFICATION.md`
- Modify: `docs/REGIONS.md`
- Modify: `docs/SENSITIVITY.md`
- Modify: `docs/examples/README.md`
- Modify: `reference-study/ktul_2026_operating_hours_report.html`
- Modify: `reference-study/ktul_2026_operating_hours_report.md`
- Modify: `reference-study/manifest.json`
- Modify: `reference-study/README.md`

- [ ] **Step 1: Document the implemented physical and schema contracts**

Update architecture, implementation, workflow, glossary, and component evidence documents with:
- infiltration versus controlled outdoor air versus treatment versus internal recirculation;
- ACH and all converted flow units;
- source-context tables and evidence-status meanings;
- staged actual-flow levels and controller limits;
- HRV and ERV rating points, supported flow range, bypass, balanced-flow assumption, and frost strategies;
- DOAS thermodynamics, energy allocation, and capacity behavior;
- schema version `2` migration and current export fields;
- One Season Farmers Instrument and Field brand roles.

Use the literature URLs and applicability boundaries from the approved design. Do not turn contextual ranges into universal acceptance limits.

- [ ] **Step 2: Replace stale findings with measured corrected results**

Update `docs/CLASSES.md`, `docs/VERIFICATION.md`, `docs/REGIONS.md`, `docs/SENSITIVITY.md`, `docs/examples/README.md`, README tables, Learn source references, and changelog from the regenerated artifacts only.

Required corrections:
- withdraw the old DOAS `$39,517` result and every derived savings statement unless a corrected run independently produces and supports a new value;
- identify all dollar figures as model-estimated operating cost, operating-cost difference or reduction, or estimated/user-entered capital, with period, included inputs, price basis, exclusions, and no-guarantee statement;
- replace bare attainment points with `percentage points (pp)` and endpoints;
- remove the general recommendation that a hybrid should close up;
- retain the airflow-ladder resolution caveat;
- state that `6 ACH` is a modeled capacity case, not a recommendation;
- state that `15 ACH` is constrained semi-closed operation;
- state that mushroom airflow is a required project input and internal circulation remains unmodeled.

- [ ] **Step 3: Regenerate the reference-study documents with Field branding**

Run:

```bash
node scripts/reference-study.mjs
```

Expected: the committed HTML defaults to Field mode, uses One Season Farmers fonts and mark, and the manifest and README match the generated files. This study remains a weather-side opportunity analysis, not an indoor simulation.

- [ ] **Step 4: Remove obsolete scaffolding and terminology**

Search the active source, tests, and maintained documentation for:

```text
doasKWhPerKg
doasDuty
controls.ventACH
shell leakage
Dry-neutral DOAS: outdoor air delivered at the declared supply temperature
 pts
 point spread
Grownetics brand
Archive register
Carbon register
```

Delete stale code, comments, generated claims, and migration-only temporary scripts. Keep historical design and implementation plan files as records. Do not rewrite unrelated archived research evidence.

- [ ] **Step 5: Run the complete verification suite**

Run:

```bash
npm test
node --check src/airflow.js
node --check src/config.js
node --check src/simulate.js
node --check src/metrics.js
node --check src/export.js
node --check src/report.js
node --check src/app.js
node --check scripts/regional-study.mjs
node --check scripts/morris-screening.mjs
node --check scripts/reference-study.mjs
```

Expected: the full suite and every syntax check pass.

- [ ] **Step 6: Perform final browser verification**

Repeat the canonical browser run after documentation and generated-file cleanup. Confirm:
- actual controlled and total ACH agree with the exported CSV and JSON;
- no outside-air stream is counted twice;
- cost labels name period, inclusions, basis, exclusions, and uncertainty;
- attainment differences use percentage points and endpoints;
- printable exports default to Field mode;
- desktop and mobile surfaces have no overflow or console errors.

- [ ] **Step 7: Request code review**

Use the `requesting-code-review` skill. Review specifically for psychrometric balance, capacity allocation, schema migration, stale result reuse, cost semantics, evidence overstatement, accessibility, and One Season Farmers brand compliance. Fix every confirmed issue, then rerun only the affected focused check and the complete suite once.

- [ ] **Step 8: Commit release cleanup**

```bash
git add README.md CHANGELOG.md NOTICE docs reference-study src test scripts index.html styles.css
git commit -m "docs: publish corrected airflow evidence and results"
```

## Completion evidence

Implementation is complete only when all of the following are available together:
- focused conservation proofs for direct air, HRV, ERV, frost, preheat, and DOAS;
- full `npm test` output;
- a browser-observed canonical run and conditioned-air smoke scenarios;
- schema version `2` exports that re-import and recompute;
- regenerated studies and report artifacts tied to the current model version;
- documentation with the old DOAS result and ambiguous cost or point language removed;
- One Season Farmers Instrument UI and Field documents verified at desktop and mobile widths.
