# CEA Psychrometric Site Evaluator
## Product requirements, approved implementation scope

Date: 2026-09-11. Status: approved for implementation. Execution and measured verification status are recorded separately; this specification is not evidence of validation.

**Working name: CEA Psychrometric Site Evaluator.** Descriptor: CEA climate & equipment explorer. Promise: See when your climate strategy works, what closes the gap, and what that control costs. Alternatives: Canopy Atlas (broader siting emphasis), Climate Ledger (stronger economic emphasis). Name and trademark availability have not been checked.

**Ownership and positioning (2026-09-12).** CEA Psychrometric Site Evaluator is a standalone Grownetics tool, not a One Season Farmers deliverable. OSF is the first client it is applied to. Anything OSF-specific is client data, not product identity: the bundled Tulsa 2025 example and ZIP 74103 are the OSF site; crop-program presets whose `source` says "Client assumption (OSF …)" came from OSF planning documents; the audit of the client's own separate load calculator is held privately with that engagement and is not published here. Future clients replace or add those inputs without touching the model. The repository must not depend on files outside its own folder.

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

Preserve the supplied Tulsa brief in `resources/psychrometric_greenhouse_operating_hours_analysis_agent_brief.md` as the reference case. Primary source: observed KTUL/TUL temperature and dew point. Report thermodynamic opportunities, wet-bulb limits, moisture import/export, pad leaving-air conditions, and the brief's mode codes.

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
- Stage/calendar schedules and canopy occupancy can be configured. Do not use outdoor reference-grass ET0 as indoor crop transpiration.

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

Grownetics, per `brand.grownetics.com` and the user's V4 "minimal aerospace" concept (2026-09-12 decision, superseding the enclosing project's One Season Farmers rule for this tool). Locked tokens: Brand Green `#4DB405` as the single accent, Carbon `#1C1C1A` canvas, Flash White `#F5F5F0` text, hairline dividers at 10%/20% white. Type: DM Sans display, Inter body, IBM Plex Mono for labels, data and buttons. The app runs in the dark Carbon register only; there is no light toggle. Exported documents (analysis report, observed-weather study) use Archive mode: Parchment `#F3F0ED`, Charleston `#2B2C2E`, Gold `#9A8860` catalog labels with § numbering. Chart categoricals are drawn from the brand palette (green, amber, nitrogen, electric lime, gold, sage, terracotta); attainment uses green/amber/red. Rules kept: max-width 68ch on paragraphs, left-anchored text, no gradients, no shadows, dark text on green buttons.

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
3. The Tulsa preset retains the brief's targets, adjustable thresholds, monthly/day/night/episode/sensitivity outputs and report limitations.
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

The existing brief also requests a full KTUL 2026-to-date study, raw/derived/summary CSVs, report, reproducible script/notebook and README. Preserve these as an explicit reference-study workstream and export target; the one-day research probe is not that study. Its missing future months must remain absent. This draft does not claim those artifacts or the prototype have been completed.

## 9. Approval recorded

The user approved the static-first build and subsequently clarified the coarse current iteration versus calibrated digital-twin next iteration. No further architecture approval is needed. National ZIP/provider candidates, historical price coverage, annual regional generation mix, the existing calculator audit and greenhouse bench loads are part of the implementation.

## 10. v0.2 scope: from Tulsa demonstration to site evaluator (approved 2026-09-13)

### Purpose, restated

The tool answers three questions for a specific site and crop band before capital is committed: what the climate gives for free, what the binding constraint is, and which class of equipment closes the gap at what running cost and with what confidence. It is Grownetics' "See" step before sensors exist. It is deliberately not the calibrated twin: at the site-evaluation stage the dominant uncertainties are crop transpiration, envelope leakage and the choice of weather year, all of which dwarf model fidelity. Value therefore comes from breadth of evidence (years, sites, bands) and honest sensitivity, not from physics resolution.

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
| 9 | **Modulating ventilation and generic DOAS stage** | Continuous ventilation rate; a dry-neutral-supply device defined by supply dew point, supply temperature, airflow and kWh/kg. Brand-agnostic. | equipment |

Explicitly not in v0.2: brand performance maps, 3-D or multi-zone spatial modeling, crop yield, GreenLight coupling.

### Client-facing deliverable

A site verdict: the climate offers X free hours; the binding constraint is Y; strategy class Z holds the band N% of hours in the median year and M% in the worst of ten, at $C/year operating cost; the ranking is stable/unstable across years and the screened parameter ranges. Plus the design-basis brief for the engineer of record.
