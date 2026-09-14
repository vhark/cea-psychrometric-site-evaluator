# Existing tools, literature & public data

Purpose: record the landscape review, the literature anchors and the public data sources that decided what to reuse and what to build.

Status: research executed 2026-09-11, reviewed 2026-09-14. A targeted landscape review, not an exhaustive systematic review. Source documentation and selected source code were inspected; existing simulators were not installed or benchmarked during this research.

Read this if: you are asking why this tool exists rather than an existing one, or you need the original URL and licence for a source.

## Executive finding

**Yes, substantial parts already exist.** USDA has Virtual Grower; university groups publish greenhouse energy/climate models; Hortinergy is a close commercial product match. The specific combination of free/open-source, static self-hosting, arbitrary historical dates, greenhouse/hybrid/indoor HVAC comparison, transparent psychrometric failures and marginal cost of precision was not established by the sources inspected. That is not proof no such tool exists.

Recommendation: reuse PsychroLib directly; use GreenLight and its measured datasets as the strongest greenhouse modeling/benchmark starting point; build the accessible scenario workflow rather than claiming new greenhouse science. If detailed greenhouse predictions are the first priority, a GreenLight-backed application deserves preference over inventing a reduced-order model. If static hosting is the first priority, keep the reduced-order model's narrower claims explicit and validate it.

## 1. Existing software

| Tool | Verified scope | Access/license and fit |
|---|---|---|
| [USDA ARS Virtual Grower 3](https://www.ars.usda.gov/research/software/download/?softwareid=309) | Free greenhouse planning desktop software. Its [original paper](https://journals.ashs.org/view/journals/horttech/20/4/article-p778.xml) documents ZIP lookup, hourly typical weather, saved greenhouse/heating schedules, materials/fuels and heating investment comparisons. Current download page describes Java 32-bit on Windows and legacy Mac compatibility. | Closest established USDA grower-facing precedent. No reusable source-code license established. Published heating balance is not a solved finite-capacity humidity/HVAC model; typical months are not arbitrary observed historical dates. |
| [GreenLight](https://github.com/davkat1/GreenLight) | Current Python greenhouse/crop platform, older MATLAB 1.x discontinued. Its Vanthoor JSON equations include canopy transpiration, condensation, separate PAR/NIR optics, ventilation, pad/fan, fogging, heating and mechanical sensible/latent cooling; Katzin extensions add lighting and controls. | BSD-3-Clause-Clear. Strong scientific reuse candidate, not merely a lighting model. Requires parameterization and validation. Equipment equations are not manufacturer maps. Native Python is not a static browser dependency without separately proven port/runtime work. |
| [Hortinergy](https://www.hortinergy.com/) | Vendor explicitly advertises greenhouse inner climate, heating/cooling/dehumidification/ventilation, crop evapotranspiration, semi-closed/closed systems, pads, LED/HPS lighting, canopy PAR/DLI and scenario comparison. Reports include hourly typical-year Excel. | Closest verified commercial product match. [Offers](https://www.hortinergy.com/our-offers/) list a starter pack of 1 project + 10 scenarios at EUR 490 excluding tax and annual unlimited use at EUR 6,900 at inspection. Vendor precision claims were not independently tested. No public open-source/self-host license established. Typical-year output is not the same as selected actual historical dates. |
| [GES, University of Cambridge](https://github.com/EECi/GES) | Python/MATLAB heat, mass and CO2 exchange in an unheated, ventilated single-zone greenhouse; radiation, convection, conduction, plant transpiration and simple tomato growth/photosynthesis. Based on GDGCM and Vanthoor. | MIT. Readable reference for conservation and a small model, but the supplied example has no artificial lighting or supplemental CO2 and is not a turnkey finite-capacity HVAC comparison tool. |
| [Greenhouses Modelica library, University of Liege](https://build.openmodelica.org/Documentation/Greenhouses.html) | Dynamic greenhouse climate, heating/ventilation, crop yield, screens/lights/window controls, CHP, heat pumps and storage interactions. | Modelica License 2. Strong systems/energy modeling reference; requires a Modelica simulation toolchain rather than ordinary static JS. |
| [PsychroLib](https://github.com/psychrometrics/psychrolib) | Wet bulb, humidity ratio, dew point, vapor pressure, enthalpy and other moist-air properties in SI/IP. JavaScript source has browser support; numerical library based on ASHRAE 2017 equations. | MIT, directly reusable in browser. Not a greenhouse, crop, coil or equipment solver. Pin code/version and preserve notice. The brief's bare documentation-root URL returned 404; repository and linked API documentation are available. |
| [EnergyPlus](https://github.com/NatLabRockies/EnergyPlus) + [OpenStudio](https://github.com/NatLabRockies/OpenStudio) | Detailed native building/HVAC engine and SDK. Relevant components include moisture/heat balances, radiation/glazing, ventilation, DX/VRF, evaporative cooling, dehumidifiers and heat recovery. | Open-source, custom BSD-like permissive licenses with designation/trademark conditions. Strong detailed indoor-HVAC reference, but no ready crop-transpiration/DLI layer matching this request established. Native runtime, not a demonstrated browser-native package. |
| [GLASE lighting tools](https://glase.org/glase-tools/) and [CROP-SIM](https://glase.org/about-glase/greenhouse-crop-sim/) | Lighting/DLI tools and field work are relevant to lighting control. CROP-SIM is a 2026 USDA-NIFA-funded greenhouse climate-control training project with energy and teen-leaf lettuce growth models. | Online tool access includes membership restrictions; no reusable code license established. CROP-SIM explicitly says it will develop, validate with three commercial growers, then publish for public use. Important collaboration/watch candidate, not an established released open-source equivalent. |
| [KASPRO/De Zwart lineage](https://doi.org/10.18174/195238) | Detailed greenhouse climate/heating/controller dynamics, crop and energy-saving design studies. | Scientific reference. Current public source redistribution rights were not established. The 2019 Modelica paper describes KASPRO as non-open-access, but that dated statement is not proof of present licensing. |
| [Fitz-Rodriguez et al. web simulator](https://doi.org/10.1016/j.compag.2009.09.010) | Published 2010 web-based greenhouse environment simulation with energy/mass balance and educational scenarios. | Paper metadata and abstract-level description established; current functioning deployment/source/self-host license not established. Do not conflate with USDA Virtual Grower or assume the separately named VirtualGreenhouse is the same implementation. |

### What makes the proposed tool meaningfully different

- A grower can inspect the hour and see which physical constraint failed.
- Weather feasibility and conditional equipment prediction are visibly distinct.
- Configurations and raw inputs are portable rather than trapped in a hosted account.
- Actual historical event sequences, partial-year honesty and missing-data accounting.
- Comparison by joint climate compliance, failure duration and incremental cost, not a single opaque score.
- Explicit dehumidifier heat, mini-split latent limits, light/solar/crop coupling and equipment-map uncertainty.

## 2. Literature and validation anchors

### GreenLight publication and measured data

Katzin, D., van Mourik, S., Kempkes, F. and van Henten, E.J. (2020). *GreenLight: An open source model for greenhouses with supplemental lighting: Evaluation of heat requirements under LED and HPS lamps.* Biosystems Engineering 194, 61-81. [DOI 10.1016/j.biosystemseng.2020.03.010](https://doi.org/10.1016/j.biosystemseng.2020.03.010). Bibliographic metadata verified through Crossref.

[Measured and simulation dataset, version 2](https://doi.org/10.4121/78968e1b-eaea-4f37-89f9-2b98ba3ed865.v2): outdoor weather, indoor climate and greenhouse control actions from a Bleiswijk tomato trial; data used for the paper cover October 2009 to February 2010 for LED and HPS toplight cases. This makes it a useful independent measured-data benchmark, not just another equation source. Dataset license CC BY-SA 4.0 is separate from the model code license.

The current GreenLight model documentation also references [Vanthoor's greenhouse design thesis](https://edepot.wur.nl/160925) and contains a path for converting EnergyPlus weather into model inputs. EPW compatibility does not make TMY files observed-year data.

### Original greenhouse modeling literature

- Frantz, J.M., Hand, B., Buckingham, L. and Ghose, S. (2010). *Virtual Grower: Software to Calculate Heating Costs of Greenhouse Production in the United States.* HortTechnology 20(4), 778-785. [DOI 10.21273/HORTTECH.20.4.778](https://doi.org/10.21273/HORTTECH.20.4.778). Full paper read. Uses an assumed 33% of incident solar energy as greenhouse heating after reflection/evaporation deductions, rather than solving the requested humidity-control problem. Seasonal heating-cost examples were within about 12%, while shorter windows could differ by up to 50%; those results do not validate hourly VPD prediction.
- Vanthoor, B.H. (2011). *A model-based greenhouse design method.* [Original thesis](https://edepot.wur.nl/170301). Heat/water/CO2 and crop coupling, pad/fan and mechanical cooling, plus economic design analysis. Useful physical and economic lineage, not a guarantee that a new port or new crop/system is calibrated.
- Altes-Buch, Q., Quoilin, S. and Lemort, V. (2019). *Greenhouses: A Modelica Library for the Simulation of Greenhouse Climate and Energy Systems.* [Full paper](https://ep.liu.se/ecp/157/054/ecp19157054.pdf), [DOI 10.3384/ecp19157533](https://doi.org/10.3384/ecp19157533). Research review read full text. Homogeneous zones, tomato-specific yield, simplified optics and original HPS lighting partition limit extrapolation to multi-tier LED farms.
- Fitz-Rodriguez et al. (2010). *Dynamic modeling and simulation of greenhouse environments under several scenarios: A web-based application.* [DOI 10.1016/j.compag.2009.09.010](https://doi.org/10.1016/j.compag.2009.09.010). Historical evidence of web greenhouse simulation, not verified current software availability.
- Crawley et al. (2001). *EnergyPlus: creating a new-generation building energy simulation program.* [DOI 10.1016/S0378-7788(00)00114-6](https://doi.org/10.1016/S0378-7788(00)00114-6). Bibliographic identity checked; modern engine documentation provides the practical component references.

GreenLight reuse caution: exposed JSON equations are useful, but the inspected mechanical-cooling model uses specified COP/capacity/coil temperature rather than a product selection map. A source comment also raises a possible pad-exhaust vapor-equation discrepancy with the thesis. This is a code-review/benchmarking flag, not a reproduced defect. Preserve software notices and note that BSD-3-Clause-Clear does not grant patent rights.

### Dehumidification review

Amani, M., Foroushani, S., Sultan, M. and Bahrami, M. (2020). *Comprehensive review on dehumidification strategies for agricultural greenhouse applications.* Applied Thermal Engineering 181, 115979. [DOI 10.1016/j.applthermaleng.2020.115979](https://doi.org/10.1016/j.applthermaleng.2020.115979). Exact title/authors/year verified through Crossref. This is a relevant review, not assumed to be the same paper as the approximate “condensation dehumidification” title in the supplied brief. Full publisher text was not retrieved; do not attribute detailed numerical conclusions to it from this research.

### Psychrometric basis

[PsychroLib software paper, DOI 10.21105/joss.01137](https://doi.org/10.21105/joss.01137), source and tests provide a vetted numerical starting point. Library authors identify ASHRAE Handbook 2017 psychrometric equations. Library verification does not validate greenhouse load assumptions or equipment maps.

### Industry context, not equation source

[Greenhouse Grower, March 21, 2026, Smarter HVAC Strategies Help Growers Improve Efficiency and Climate Control](https://www.greenhousegrower.com/technology/smarter-hvac-strategies-help-growers-improve-efficiency-and-climate-control/) discusses integrated climate systems, high-humidity pad limitations, night cooling, dehumidification and energy modeling. Treat vendor statements as industry context, not empirical proof of an equipment advantage.

## 3. Public hourly weather and solar

| Source | Coverage and variables | Appropriate use and restrictions |
|---|---|---|
| [IEM ASOS/AWOS](https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?help) | Actual station reports; dry bulb/dew point, RH, wind, weather/sky and related fields. Irregular/special/routine reports require normalization. | Best match to supplied KTUL observed-weather brief. Limited source QC must be disclosed. Not a complete solar irradiance dataset. Service documents one-second per-IP throttle and possible 503 responses. Browser access worked in a one-day probe. |
| [NOAA NCEI Global Hourly/ISD](https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database) | Global station archive with temperature/dew point, wind, pressure and QC flags. Station-specific coverage and missingness. | Cross-checks and observation archive. Not a universally complete hourly irradiance source. Public bulk files differ from token-based CDO services. |
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/) | Hourly meteorology and solar API from 2001 to near-real-time for the combined use case. Meteorology approximately 0.5 x 0.625 degrees; solar 1 x 1 degree. | Keyless and [open reuse with attribution](https://registry.opendata.aws/nasa-power/). Best freely accessible general path to investigate for business-facing hosting, but coarse resolution is a substantive limitation. Typical latency 2-3 days meteorology, 5-7 days solar. Real browser request succeeded. |
| [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api) | Hourly ERA5 from 1940, 0.25 degrees; ERA5-Land from 1950, 0.1 degrees; IFS from 2017, ~9 km. Weather, pressure and solar; land/seamless variants have different variable sources. | Very convenient documented-CORS access, but reanalysis is not station observation. [Free hosted API is noncommercial only](https://open-meteo.com/en/terms), explicitly excluding promotional/commercial integrations. CC-BY data does not cancel this restriction. Commercial licensing or separate self-hosting/imports must be addressed. |
| [NSRDB](https://developer.nlr.gov/docs/solar/nsrdb/) | Actual-year GHI/DNI/DHI and meteorology; GOES aggregated catalog covers 1998 onward at 4 km/30 min, finer regional products also available. | Strong US solar-resolution comparison. API product/year availability is explicit, not necessarily current year. Developer key/email required by point-download API; public bulk access is separate. Do not embed shared keys in static source. |
| EPW/TMY | File format and typical meteorological year are different concepts. EPW can hold actual-year or typical-year weather. | Useful import format; inspect source/license and interval conventions. TMY cannot answer how a specific date range actually performed or preserve every historical extreme sequence. |

### Data gotchas that affect the design

1. NASA POWER defaults to local solar time, not local civil time; explicitly request UTC. Its [timestamp represents the start of the hour](https://power.larc.nasa.gov/docs/faqs/other/).
2. Open-Meteo shortwave radiation is the mean of the preceding hour, while meteorological states are instantaneous. Do not join equal timestamp strings without reconciling intervals.
3. A real NASA request using community RE returned solar in Wh/m2; a separate AG-community request returned different units. Read metadata and preserve energy on conversion/resampling.
4. Public archives are curated and can change. Preserve raw bytes/JSON plus hashes, not just URLs.
5. Pressure must be surface/station pressure or a documented elevation estimate, not unconverted sea-level pressure.
6. Radiation is not canopy PPFD. Glazing/shade/geometry/spectrum and crop-light models are required.
7. Station meteorology plus gridded solar is a mixed-source dataset, not all measured at the greenhouse or airport.
8. A self-hosted UI still exposes IP/location to live weather providers. Offline/private analysis requires saved local weather and locally served assets.

### ZIP lookup

[GeoNames postal dumps](https://download.geonames.org/export/zip/) offer a small downloadable US ZIP index with attribution. Preserve leading zeros and coordinates' approximate quality. Open-Meteo's geocoder also supports postal codes but carries hosted-service terms. Neither ZIP coordinates nor a nearest station establishes the actual facility microclimate. Store IANA timezone separately and show location selection to the user.

## 4. Requested AG IQ comparison

The likely match is [AGronomic IQ](https://agronomiciq.com/grow-room-hvac/). Its manufacturer page identifies unitary heating/cooling/dehumidification, Evolution and Compressor Wall families, and dry-cooler heat rejection. It lists product-family tonnage, airflow and moisture-removal ranges. Those ranges do not provide entering-air/outdoor/part-load maps or installed project costs.

Therefore: support integrated HVAC topology, but do not fabricate an AGronomic IQ efficiency or claim it outperforms a mini-split/dehu combination. A branded comparison requires a specific model, selection/submittal data, operating map and price assumptions. Manufacturer marketing about precision/yield is not validation of this calculator.

## 5. Supplied brief reconciliation

Read the entire 588-line brief in `resources/psychrometric_greenhouse_operating_hours_analysis_agent_brief.md` after initial external research.

It is narrower than the new product request: Tulsa KTUL, observed 2026-to-date, weather-only feasibility, no exact indoor temperatures/energy/transpiration without added models. Preserve:

- Day/night targets, humidity-ratio/dew-point decisions and wet-bulb pad limits.
- One primary mode per valid hour plus flags/reasons.
- Missing-data denominator, source metadata, raw archives and independent NOAA checks.
- Monthly, day/night, calendar-day exposure, episodes, extremes and threshold sensitivities.
- Explicit limits on interpreting pad outlet as greenhouse climate or feasible as cheapest.

The expanded user request adds the envelope/crop/lighting/equipment/cost models needed for conditional performance. Keep these in a separate coupled mode, not by quietly upgrading weather flags into equipment predictions. The brief's complete Tulsa report/export/script deliverables remain a reference-study requirement, not something satisfied by the research probe.

## 6. Access evidence

Preserved under `research-evidence/`:

- `ktul-2026-09-01-raw.csv`: real IEM routine observations, 24 records plus header, TUL coordinates -95.8881/36.1984 and elevation 206 m. Includes a missing wind value; temperature/dew point are present in this sample.
- `manifest.json`: URL, units, UTC range, download timestamp and SHA-256 of the unchanged CSV.
- `browser-access-probe.json`: browser JavaScript from https://example.org successfully fetched one-day IEM and NASA POWER responses, each HTTP 200 and type `cors`. NASA community RE provided 24 hours each of temperature, RH, pressure and solar with explicit units.

These probes establish limited data access feasibility only. They are not annual studies, scientific validation, a promise of API uptime, or a completed prototype. The weather research also retrieved one-day Open-Meteo and NASA native responses, but only the locally archived probes above are deliverable evidence.

Search limitations: the configured web-search service returned a signup request; Google browser search hit a bot challenge. Bing browser search and direct primary-source URLs were used instead. Some publisher text was inaccessible. Scope claims above distinguish official feature descriptions, inspected code/licenses, bibliographic metadata, and unverified scientific performance.

## 7. Build decision and linked drafts

- [PRD](PRD.md): product scope, working name, user flows, acceptance contract, source/brand caveats.
- [Evaluation](EVALUATION.md): physical invariants, data QC, benchmark strategy, control/energy/cost metrics and release proof.
- [Architecture](ARCHITECTURE.md): static deployment, adapter/data contracts, worker, coupled model, storage and provenance.

The user approved **CEA Psychrometric Site Evaluator**, static-first coarse screening now, and explicitly placed a calibrated academic-model-based greenhouse digital twin in the next iteration. See IMPLEMENTATION.md and DIGITAL-TWIN.md.

## 8. Liquid-desiccant evidence update

[Blue Frontier's current site](https://bluefrontierac.com/) describes isothermal liquid-desiccant dehumidification followed by indirect evaporative cooling, heat-pump regeneration and thermochemical storage. The earlier `/technology/` URL was unavailable; the homepage links actual technical material.

The [CalNEXT final report ET23SWE0071](https://bluefrontierac.com/wp-content/uploads/CalNext_Report.pdf), Curtis Harrington and Jonathan Hollist, UC Davis, January 13, 2026, documents a Southern California grocery-store field installation supplying 2,500 cfm of 100% outdoor air for 18 hours/day. Its executive summary reports regression-based annual electricity savings of 48%, 65% and 69% versus its DX-DOAS baseline in California climate zones 8, 12 and 15. These are not measured full-year savings at three greenhouse sites. The report recommends additional evaluation of the final commercial product.

This is materially stronger evidence than an unsupported marketing COP, but it is still a DOAS-specific field/regression study. Do not copy its savings into an indoor crop recirculation model. The prototype's generic desiccant/hybrid option uses declared finite capacities and regeneration energy; it omits thermochemical storage scheduling and does not represent a Blue Frontier product. Importing/validating the report's condition-dependent regressions is a next-iteration equipment-model task.
