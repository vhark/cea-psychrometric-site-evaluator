# CEA Psychrometric Site Evaluator
## Product requirements, approved implementation scope

Purpose: state what the product must do, for whom, and what it must never claim, including the approved v0.2 site-evaluator scope in §10 and the record of what shipped beyond it in §11.

Status: approved scope, reconciled to model `0.3.0-screening` on 2026-09-15. Written 2026-09-11; §10 preserves the 2026-09-13 approval and §11 the 2026-09-14 delivery record, with explicit supersession notes. Current implementation, schemas and executed evidence are in [IMPLEMENTATION.md](IMPLEMENTATION.md) and [VERIFICATION.md](VERIFICATION.md). This specification is not validation evidence.

Read this if: you are deciding whether a proposed capability is in scope, or checking a shipped behaviour against what was approved.

**Working name: CEA Psychrometric Site Evaluator.** Descriptor: CEA climate & equipment explorer. Promise: See when your climate strategy works, what closes the gap, and what that control costs. Alternatives: Canopy Atlas (broader siting emphasis), Climate Ledger (stronger economic emphasis). Name and trademark availability have not been checked.

**Ownership and positioning.** CEA Psychrometric Site Evaluator is a Grownetics open-source tool with no customer-specific content. Grownetics code copyright remains as recorded in [../LICENSE](../LICENSE). No site is a default or a client configuration: a new scenario is unlocated until the user gives it a ZIP. Six bundled climate archetypes carry ten complete public weather years each, so those coordinates run locally without live weather requests. Every crop, envelope, equipment and price default is a labeled, editable assumption sourced from public references or stated as a planning figure. Engagement-specific material stays outside this repository.

## 1. Product decision

Build a free, open-source, static-first decision-support tool that compares greenhouse, hybrid/semi-closed greenhouse, and indoor-farm configurations against hourly historical weather. Do not represent a weather screen as a calibrated building or crop model.

Three approaches were considered:

1. **Recommended: static browser tool with two explicit analysis modes.** Reuse PsychroLib JavaScript. Implement an auditable air-side feasibility classifier and a reduced-order coupled heat/moisture equipment model. Use published models and measured datasets as offline references. Lowest hosting burden; outputs remain planning estimates until validated for their use case.
2. **GreenLight-backed scientific application.** Python GreenLight as the primary solver behind a web interface. Stronger starting point for detailed greenhouse/crop physics, but requires a runtime, substantial indoor-HVAC extensions, and calibration. A Python-in-browser port is a separate feasibility experiment, not an assumed capability.
3. **Use existing software rather than build.** Hortinergy for commercial greenhouse scenario studies; USDA Virtual Grower for appropriate legacy heating/growth studies. Fastest route to existing functionality, but not the desired free self-hostable public tool.

The open-source opportunity is the transparent, accessible comparison workflow, not a claim that greenhouse simulation is new.

**Latest user decision:** this iteration is a coarse, component-based investment and conditional control screen. The next iteration is a calibrated greenhouse digital twin using academic models, validated algorithms and measured facility data. Detailed crop-stage dynamics, spatial precision, manufacturer performance maps and calibrated building physics belong to that next iteration, not an unsupported claim made by this prototype. See `DIGITAL-TWIN.md`. Include generic desiccant and liquid-desiccant hybrid topologies now, with explicit regeneration energy and assumed performance, not branded efficiency claims.

## 2. Users and decisions

- Growers screening whether a climate supports a low-capital greenhouse strategy.
- Facility designers comparing ventilation, pad cooling, heating, dedicated dehumidification, and integrated cooling/reheat.
- Indoor growers comparing conventional DX/mini-split plus dehumidification with integrated cultivation HVAC.
- Researchers and self-hosters who need raw input, equations, assumptions, and reproducible results.

Core question: For this crop, building, equipment, weather history, and price set, how much time can each strategy meet the specified climate band, what causes the misses, and what is the incremental cost of improving control?

## 3. Two analysis modes, shared inputs and exports

### A. Weather-side operating windows

Preserve the supplied Tulsa observed-weather brief as the reference case, delivered in [../reference-study/](../reference-study/README.md). The original brief belongs to the originating project and is not bundled at a repository `resources/` path. Primary source: observed KTUL/TUL temperature and dew point. Report thermodynamic opportunities, wet-bulb limits, moisture import/export, pad leaving-air conditions and the brief's mode codes.

This mode does not calculate indoor temperature, actual dehumidification demand, equipment tonnage, energy cost, or an economic optimum. Do not call powered ventilation zero-energy passive cooling. Keep the familiar label with an explanation that the source of cooling is outside air.

### B. Coupled equipment screening

Require envelope, crop moisture, lighting, airflow, equipment capacity, operating limits, and tariff inputs. Simulate a well-mixed single zone with coupled sensible/latent effects and finite-capacity controls. Report conditional indoor temperature/humidity/VPD trajectories, energy and water use, and target attainment under the stated assumptions.

This is a reduced-order planning simulation, not CFD, a warranty, a stamped HVAC design, or a validated yield forecast. A uniform zone model cannot evaluate canopy-to-canopy precision. Hourly weather does not prove minute-scale control performance.

Both modes are part of the proposed prototype. Weather-only mode is not a substitute for the requested equipment comparison.

## 4. First complete prototype scope

### Location and weather

- US ZIP lookup plus editable latitude/longitude and IANA time zone. Show resolved location; never claim ZIP centroids are exact facility sites.
- Inclusive local calendar date range, translated to unique UTC hours. Explicit actual coverage and cutoff. No future or fabricated observations.
- Observations mode: station selection with identity, coordinates, elevation, distance, raw source timestamp and quality flags. KTUL preset for the supplied brief.
- Reanalysis mode: clearly labeled gridded reconstruction for broad geographic coverage and solar. Never label it station-observed weather.
- CSV/JSON import and provenance export are first-class, so a self-hoster is not trapped behind an API or paid key.
- Pair station meteorology and gridded solar only with visible separate provenance, spatial/temporal alignment and separate coverage measures.
- Request real weather; failed downloads produce an actionable error or an explicitly chosen cached/imported dataset, never synthetic data disguised as a result.

### Facility templates

- Vented greenhouse: glazing, shade/screen schedule, minimum/maximum ventilation, pads, heater.
- Hybrid greenhouse: solar-transmitting envelope with selectable controlled outside air and active cooling/dehumidification; not simply an arbitrary greenhouse/indoor percentage.
- Indoor farm: opaque envelope, infiltration, canopy area/tier count, scheduled lighting, DX cooling, heating and moisture control. Outdoor solar still affects the envelope if modeled, but does not directly illuminate crops.
- Separate floor area, envelope area, air volume and illuminated/transpiring canopy area. Tiering changes crop/lighting loads, not the footprint by itself.
- Editable parameters with SI internally and clearly labeled metric/imperial display. Saved templates include model/schema versions.

### Crop programs

- Cool leafy crop and warm fruiting crop illustrative presets plus a custom program; unvalidated defaults visibly labeled as assumptions rather than universal agronomic prescriptions.
- Separate crop choice from HVAC choice.
- Day/night temperature target and acceptable band, VPD band, dew-point guardrail, photoperiod, DLI target and crop-water/transpiration assumptions.
- Display RH as derived, humidity ratio/dew point as moisture state. Air VPD is the default; leaf VPD needs an explicit leaf-temperature model or user offset and is labeled separately.
- Day/night and photoperiod schedules are configured; stage/calendar programs and dynamic canopy occupancy remain future scope. Do not use outdoor reference-grass ET0 as indoor crop transpiration.

### Equipment and controls

- Ventilation with finite airflow, minimum outdoor air and fan power.
- Evaporative pads with effectiveness, water use, pump power, wet-bulb/moisture limits, and bypass.
- Heater with capacity, fuel/electric efficiency, and delivered heat vs purchased energy separation. Prototype assumes externally vented combustion; direct-fired moisture addition requires an explicit extension.
- Standalone refrigerant dehumidifier with moisture capacity, electric input, operating bounds and indoor heat release. Added dehumidification may create an unmet cooling load.
- DX/mini-split with total capacity, sensible/latent coupling, entering/leaving-state or performance-map constraints, turndown, outdoor operating limits and explicit part-load assumptions. Do not give it unlimited independent humidity control.
- Integrated cultivation HVAC with cooling, dehumidification, reheat and indoor/outdoor heat rejection accounted for separately.
- The likely match for “ag iq” is [AGronomic IQ](https://agronomiciq.com/grow-room-hvac/), whose manufacturer page identifies integrated heating/cooling/dehumidification, Evolution and Compressor Wall products, and dry-cooler heat rejection. Published product-family capacity ranges are not performance maps. Require a specific model, entering/outdoor conditions, part-load power and heat-rejection data before enabling a branded performance preset. A generic integrated-HVAC option is not evidence of that product's performance.
- Equipment can use declared constant-capacity assumptions for exploratory comparisons, but those runs carry an assumed-performance badge. No brand rankings without verified performance maps.
- Shading, pads, ventilation, DX and dehumidification are dispatched together. Avoid accidental full ventilation and closed-loop dehumidification unless the policy explicitly permits it.

### Solar and lighting

- Consume interval-mean GHI and, where available, direct/diffuse components.
- Separate optical PAR transmission from thermal solar gains. Include glazing/shade properties and uncertainty; do not silently use one coefficient for both.
- Finite fixture power, photon efficacy, canopy delivery factor, photoperiod and dimming.
- Report daily natural/artificial DLI, deficit days, lighting electricity and contribution to heat load.
- Controller uses current observations and accumulated DLI. An ideal hindsight schedule can be a separately labeled comparison, never the default causal controller.
- Account for electrical light input once: radiation absorbed indoors eventually becomes heat unless an explicitly modeled fraction leaves or is stored. Partition crop latent/sensible effects without adding latent heat twice.

### Saving and comparison

- Named local templates, duplicate/edit/delete, export/import portable JSON; no login required.
- Compare baseline and upgrades using identical weather, crop, geometry and control assumptions except the explicit scenario differences.
- Persist inputs, not just screenshots. Old results remain tied to old inputs; edits mark results stale.
- Import validation, schema version handling, errors for incompatible/malformed files, and storage-quota handling.

## 5. Results and interface

Primary layout: location/date header; facility/crop/equipment configuration rail; scenario workspace; results tabs.

- Overview: joint temperature + VPD attainment, acceptable-band vs precision-band hours, worst episode, purchased energy, operating cost, data coverage.
- Calendar: day-by-hour heatmap, with repeated DST hours distinguishable and missing hours not colored as successful.
- Psychrometrics: outdoor states and process points; target band and pad process. A DB-vs-dew-point scatter must be labeled as such, not as a full psychrometric chart.
- Loads and light: sensible/latent demand, dehumidifier heat, rejected/reused heat, unmet capacity and DLI.
- Upgrades: change in compliant hours, incremental annualized cost only when annual coverage is valid, and a cost/control Pareto frontier.
- Hour inspector: original weather, active targets, control actions, outlet/zone state, capacity limit, reason, assumptions, quality flags and source.
- Sensitivity: pad effectiveness, moisture targets, crop moisture load, envelope/solar uncertainty, equipment curves and prices.
- Exports: hourly CSV, summaries, raw inputs, manifest/configuration, and a readable report with limitations.

Accessibility: keyboard-operable forms/tabs, associated units and help, text/table alternatives to charts, non-color status labels, legible contrast, responsive desktop/mobile, reduced motion support.

### Brand

Grownetics, per the owner decision of 2026-09-16, superseding the 2026-09-15 One Season Farmers visual decision. The canonical source is [brand.grownetics.com](https://brand.grownetics.com). Interactive tools use Instrument mode; the explainer and all reports default to Archive mode regardless of OS theme, with document dark mode opt-in only. Titles use DM Sans at weight 700, body/UI Inter, and numbers IBM Plex Mono. The logomark is locked monochrome artwork: black lockup on light grounds, white on dark, never recolored, altered, cropped or recreated. Use approved tokens, full-border tinted callouts, no colored side stripes, no gradient text and no default glassmorphism. Copyright attribution is independent of the visual brand.

## 6. Definition of value and precision

- Precision is simultaneous target-band attainment, not separate favorable temperature and RH percentages.
- Show cumulative excursion severity and longest failure episodes; 99% annual compliance may hide a lethal consecutive event.
- Rank by non-dominated cost/control alternatives, not a universal score.
- Additional control-hour value is not crop revenue. User-supplied avoided-loss assumptions belong in a separate sensitivity calculation.
- For a partial date range, report period cost. Do not multiply a summer month by twelve or call a 2026-to-date run annual.
- Economic recommendations are gated on priced equipment, tariffs, eligible matched hours and explicit model uncertainty.

## 7. Acceptance contract

1. ZIP/coordinates and dates retrieve or import traceable hourly inputs and solar with honest coverage.
2. Each valid weather-side hour has exactly one primary mode, secondary flags and a reason; missing hours are counted separately.
3. A located scenario retains the brief's targets, adjustable thresholds, monthly/day/night/episode/sensitivity outputs and report limitations.
4. All three facility templates can be saved, reloaded and compared with solar/lighting/crop loads.
5. Coupled model closes heat and moisture balances, respects capacity limits, and reports rather than hides unmet demand or numerical failures.
6. Adding standalone dehumidification can trade moisture improvement for sensible cooling demand, with no double counting.
7. DX latent control is not independent free capacity; integrated reheat and condenser heat destinations are explicit.
8. Target compliance is simultaneous; DLI is daily, with incomplete-day treatment.
9. A comparison exports the exact assumptions/weather/model versions needed to repeat it.
10. Static self-hosting and imported-data operation need no account or secret server key.
11. Browser workflow and scientific checks in `EVALUATION.md` pass before prototype completion is claimed.
12. All estimates remain labeled by their evidence tier; no equipment-sizing or calibrated-precision claim without the corresponding validation.

## 8. Preserved brief deliverables

The supplied brief requested the full available KTUL 2026-to-date study, raw/derived/summary CSVs, report, reproducible script and README. These now exist in [../reference-study/](../reference-study/README.md), generated by `scripts/reference-study.mjs`. The archived record ends 2026-09-11 21:00 UTC exclusive: 6,087 expected hours, 6,064 valid and 23 missing. It is weather-side opportunity analysis, not a complete calendar year or indoor simulation.

## 9. Approval recorded

The user approved the static-first build and subsequently clarified the coarse current iteration versus calibrated digital-twin next iteration. No further architecture approval is needed. National ZIP/provider candidates, historical price coverage, annual regional generation mix, the existing calculator audit and greenhouse bench loads are part of the implementation.

## 10. v0.2 scope: from Tulsa demonstration to site evaluator (approved 2026-09-13)

Historical approval record, not a promise that every original implementation detail remains active. In model 0.3.0, schema 2, reviewed one-stream airflow and enthalpy/COP DOAS replace the original DOAS shortcut. Neither controller provides continuous economizer optimization.

### Purpose, restated

The approved goal was to answer three questions for a specific site and crop band before capital is committed: what the climate gives for free, what binds, and which declared equipment class closes the gap at what running cost. It remains an assumption-based screen, not a calibrated twin. Multi-year evidence and structural sensitivity reveal variation, but do not establish that model fidelity or unmeasured equipment performance is negligible.

### Scope (in order of value)

| # | Capability | What it adds | Physics change |
|---|---|---|---|
| 1 | **Multi-year climate risk** | Run 10 NASA POWER years (2016-2025 bundled for Tulsa; any site on request). Attainment and cost as a distribution: median year, worst year, spread, trend. Design-hour percentiles in the crop's terms (1% joint-failure hour, coincident wet-bulb). | none; worker pool |
| 2 | **Multi-site comparison** | Same facility and crop across N ZIPs. Ranking by free-cooling hours, binding constraint, cheapest non-dominated strategy, operating cost. | none |
| 3 | **Sensible / latent decomposition** | Per-hour and monthly split of solar, light, envelope, infiltration, fan and crop sensible gains vs crop and ventilation-import latent loads; space sensible-heat ratio. Makes the coupled-vs-decoupled (reheat vs DOAS/desiccant) argument visible. | expose existing balance terms |
| 4 | **CO₂ enrichment window** | Hours per strategy where ventilation stays at minimum, so enrichment is possible; weather-side counterpart. | expose existing control state |
| 5 | **Cost of precision** | Band sweeps (temperature tolerance, VPD band, dew-point cap) and photoperiod start sweeps as sensitivity sets. | none |
| 6 | **Design-basis brief** | One-page export a mechanical engineer accepts: peak sensible and latent hours with coincident outdoor state and frequency, ventilation air requirement, condensate, pad water, free-cooling hours, binding constraint, strategy verdict, evidence tier. | none |
| 7 | **Staged controller (roadmap M1)** | Deadband, minimum on/off, ordered staging as the default causal controller; the enumerating dispatcher retained as "ideal modulation upper bound". Removes the cadence artifact. | controller |
| 8 | **Stanghellini transpiration (roadmap M2)** | Vanthoor 2011 §8.9 form: `mv = 2ρ·cp·LAI/(L·γ·(rB+rS))·(satVp(Tcan) − vpAir)`, rB = 275 s/m, rS = 82·rfR·rfVP with rfR = (R+4.3)/(R+0.54), rfVP = min(5.8, 1 + c(VPD)²), c = 4.3e-6 day / 5.2e-6 night, day/night switch at 5 W/m². Canopy temperature = air temperature as a declared simplification. LAI is a scenario input. The L/m²/day schedule stays as a fallback. | crop |
| 9 | **Controlled ventilation and generic DOAS stage** | Current contract: discrete staged controlled flow, optionally recovered then DOAS-conditioned once. DOAS declares treatment capacity, supply dew point/temperature, cooling COP and bounded recovered reheat; remaining heat draws on the finite shared source. The original continuous-flow and kWh/kg specification is superseded. | equipment |

Explicitly not in v0.2: brand performance maps, 3-D or multi-zone spatial modeling, crop yield, GreenLight coupling.

### Client-facing deliverable

A site verdict: the climate offers X free hours; the binding constraint is Y; strategy class Z holds the band N% of hours in the median year and M% in the worst of ten, at $C/year operating cost; the ranking is stable/unstable across years and the screened parameter ranges. Plus the design-basis brief for the engineer of record.

## 11. Scope that landed after §10 (recorded 2026-09-14)

This section is a record of shipped work, not a new set of promises. Each entry landed after §10 was approved, so a reader comparing the tool against the approved scope can tell a shipped capability from an undocumented one. Nothing here relaxes the acceptance contract in §7 or the prohibitions in §3, and nothing here raises an evidence tier.

| Capability | What shipped | Where it is documented | Standing |
|---|---|---|---|
| **Learn view** | `src/learn.js`: ten curriculum modules that teach the reading of a result, each able to switch to Analyze and spotlight the panel it describes, reusing the guided tour's `spotlight` rather than a second implementation. `#learn` and `#learn/<module-key>` are routes alongside `#analyze`; every other fragment stays an ordinary anchor. | the view itself | Explanatory. It computes no new quantity and makes no claim of its own. |
| **Six bundled sites, ten years each** | Tulsa, Phoenix, Miami, Denver, Seattle and Fairbanks, 2016 to 2025 per site: 60 complete site-years, 87,672 h per site, 526,032 h in total, discovered from `data/weather/index.json`. §10 item 1 assumed Tulsa alone was bundled, so multi-year and multi-site work now runs offline across six climates. Fairbanks was added because the control-class ladder needed a site whose binding limit is photons rather than heat. | [CLIMATES.md](CLIMATES.md), [REGIONS.md](REGIONS.md) | Same tier as before: more weather evidence, no physics change. Reanalysis, not station observations. |
| **Control-class ladder, historical** | The 2026-09-14 record compared nine ideal-controller configurations and four hot-humid design questions. Those numerical rankings, DOAS costs and hybrid-close-up conclusions are withdrawn as current evidence after the 0.3.0 airflow/conditioning correction. | [CLASSES.md](CLASSES.md) | Current document explains topologies and limits only; current numerical evidence is the regenerated canonical browser, regional and Morris studies. |
| **Graded evidence review** | [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md): six parallel literature searches, 52 machine-checked DOIs, and an A to E grade plus a plain-words provenance note on every external claim. Its headline result is an absence: no Grade A evidence was found in any of the six domains. | [EVIDENCE-HOT-HUMID.md](EVIDENCE-HOT-HUMID.md) | Applies §7 item 12 outward. It grades the literature, it does not promote any output of this tool. External source grades are not the internal evidence tiers; the relationship is stated once in [EVALUATION.md](EVALUATION.md) §1. |
| **Insect-screen ventilation model** | `insectScreen` in `src/screens.js` derates the achievable maximum outside-air exchange by measured ratios 1.000, 0.641 and 0.502 for nominal 40, 52 and 78 mesh. The reference is the measured 40-mesh house and not an unscreened one, so the cost of the first screen stays unsourced; an installed screen with no declared factor blocks the run rather than costing nothing; minimum ventilation is a requirement rather than a capability and is not derated. | [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) §3A, [CLASSES.md](CLASSES.md) | One instrumented Thai rainy-season campaign, one house per treatment: a measured direction and magnitude, not a validated universal mesh penalty. |

### Still out of scope

The §10 exclusions stand unchanged: no brand performance maps, no 3-D or multi-zone spatial modeling, no crop yield, no GreenLight coupling. Two further exclusions are recorded because the work above invites them:

- **Central chiller and boiler plant is not modeled and is out of scope.** Every class in the ladder is packaged equipment. The scale at which central plant, hydronic distribution and a plant-side part-load curve beat packaged units is not answered here, and no figure in this repository may be read as that answer.
- **The ideal per-substep controller remains a labeled upper-bound experiment**, not a product capability or a proven continuous optimum. Both controllers are resolution-limited. The former class ladder is withdrawn as current numerical evidence; a new capacity comparison must match control assumptions and report its discrete stages.
