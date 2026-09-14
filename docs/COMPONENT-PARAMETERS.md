# Component parameters: evidence and limits

Purpose: a sourced reference for movable shade, energy curtains, an envelope ladder, and air-source heat-pump heating in the CEA Psychrometric Site Evaluator. This document supplies evidence for a later implementation. It does not change the current `0.2.0-screening` model or validate it against a facility.

## Read this first: Aluminet is not automatically NIR-selective

**The inspected measurement does not support a universal claim that silver Aluminet passes relatively more PAR while selectively rejecting NIR.** Gilbert, Bertling and Savage [S1] report that their silver Aluminet and black net samples transmitted radiation neutrally across their measured **300 to 1100 nm** band. They used a spectroradiometer in propagation tunnels across autumn, winter and spring and compared laboratory measurements under an incandescent lamp. This is a measured result for those samples and that band, not a finding about every product or the entire solar spectrum. The accessible abstract does not disclose grade-specific numeric transmission or confidence intervals.

The distinction is important:

- **Measured:** near-neutral transmission of those silver and black samples within the measured band [S1]. The same abstract says manufacturers appeared to base nominal shading on PAR, and that laboratory and tunnel transmissions differed. A grade is not a universal optical test result.
- **Supported physical mechanism, not a quantified Aluminet advantage:** reflective material can reject incoming energy without absorbing as much of it; less absorption can reduce subsequent heat release by a hot internal screen. UGA describes reflection and low absorption as mechanisms reducing radiant loss [S2], and Andersson describes the reflective, low-emission aluminized strips [S3]. The size of the benefit depends on inside versus outside installation and on where reflected light ultimately goes.
- **Separate measured longwave evidence:** Andersson measured reduced net longwave loss for aluminized thermal screens [S3]. These are not the same Aluminet grade samples, and the result is not a total-solar transmission coefficient.
- **Unverified generic claim:** a material-independent NIR-rejection bonus for any silver screen. The distributor's IR-reflection language [S17] supplies no spectral curves. Reflection is not synonymous with spectral selectivity.

Default modeling policy: retain separate `screenParTransmissionFraction` and `screenSolarTransmissionFraction`. For a deliberately labeled neutral-screen scenario, use equal values based on the declared shade fraction. **Equality over total shortwave is a screening assumption, not an extrapolated measurement beyond 1100 nm.** Allow unequal values only with product-specific spectral or paired PAR/pyranometer evidence. Do not award an unsourced silver-screen bonus.

## Evidence conventions and units

Every parameter below is one of:

- **Measured:** a study result under its stated conditions.
- **Extension estimate:** planning guidance, not a product guarantee.
- **VENDOR DATA / VENDOR CLAIM:** a manufacturer or distributor value, with unspecified tolerances explicitly noted.
- **Derived:** transparent arithmetic using cited inputs.
- **UNSOURCED:** no defensible numeric value was established in the inspected material. This means unavailable evidence, not a measured zero.

Ranges are reported source ranges, material differences, or explicitly identified method differences. They are not probability distributions or confidence intervals. No arbitrary uncertainty percentage has been added. If a source provides no tolerance, numerical uncertainty remains unquantified.

Fractions are dimensionless. `uValue_Wm2K` means W/(m²·K); `rValue_m2KPerW` means m²·K/W; `infiltrationACH_hInv` means h⁻¹; temperatures use `_C`; irradiance uses `_Wm2`; delivered capacity uses `_kW`.

For legacy US R-values, NIST [S4] gives:

`rValue_m2KPerW = rValue_hFt2FPerBtu × 0.1761102`

`uValue_Wm2K = 5.678263 / rValue_hFt2FPerBtu`

These displayed conversion factors are rounded NIST factors for the international-table Btu. They are not material uncertainty. Temperatures convert by `temperature_C = (temperature_F - 32) / 1.8`, also from [S4]. Original customary R-values are retained only to make the source conversion auditable.

### Quantities that must not be substituted

- PAR photon transmission is not human-visible luminous transmission (`LT`).
- Direct solar transmittance is not SHGC. SHGC includes inward-flowing energy from absorbed solar radiation.
- Diffusion or haze is not transmission and does not create photons.
- NIR is not thermal longwave radiation.
- Whole-house heating savings are not automatically a glazing U-value reduction.
- Blower-door ACH at elevated test pressure is not natural infiltration ACH.
- A screen gap connects the crop zone to roof space. It does not necessarily exchange that air with outdoors.

## 1. Movable shade screens

### 1.1 Nominal black knitted grades

Ecologic Technologies lists black SHADE RITE lock-stitch knitted cloth in the following grades [S5]. The table below converts nominal shade to its complement only. These are **not measured PAR or total-shortwave transmissions**.

| `nominalShadePercent` | Vendor identification | `nominalTransmissionFraction`, derived complement | Deployed PAR transmission | Deployed total-shortwave / NIR transmission | Context and uncertainty |
|---:|---|---:|---|---|---|
| 30 | KSC-30 | 0.70 | UNSOURCED by grade | UNSOURCED by grade | [S5], catalogue grade; wavelength band, angular method and tolerance absent |
| 40 | KSC-40 | 0.60 | UNSOURCED by grade | UNSOURCED by grade | Same [S5] limitations |
| 50 | KSC-50 | 0.50 | UNSOURCED by grade | UNSOURCED by grade | Same [S5] limitations; Ginegar CN9950 independently confirms a black nominal grade but supplies no optical method [S6] |
| 60 | KSC-60 | 0.40 | UNSOURCED by grade | UNSOURCED by grade | Same [S5] limitations |
| 70 | KSC-70 | 0.30 | UNSOURCED by grade | UNSOURCED by grade | Same [S5] limitations |

A user can deliberately select the complement as both optical multipliers for an assumption-based neutral-screen scenario. The exported basis must say nominal grade proxy, with unquantified grade-to-measurement uncertainty. [S1] supports near-neutral behavior for its tested black sample, not the accuracy of all grade complements.

### 1.2 Aluminet grade claims, kept separate from PAR and NIR

Ecologic Technologies [S7] supplies this useful but method-incomplete catalogue. The source calls the material metallized HDPE knitted shade cloth and allows use over or under the greenhouse. It does not identify the spectral band or angular measurement geometry of its light-transmission table.

| `nominalShadePercent` | Claimed direct-light transmission, fraction | Claimed diffuse-light transmission, fraction | Claimed energy saving, percent | Deployed PAR transmission | Deployed total-shortwave / NIR transmission |
|---:|---:|---:|---:|---|---|
| 30 | 0.70 | 0.72 | Not available | UNSOURCED by grade | UNSOURCED by grade |
| 40 | 0.55 | 0.75 | 15 | UNSOURCED by grade | UNSOURCED by grade |
| 50 | 0.50 | 0.65 | 20 | UNSOURCED by grade | UNSOURCED by grade |
| 60 | 0.40 | 0.55 | 40 | UNSOURCED by grade | UNSOURCED by grade |
| 70 | Unusable source entry: `305` | 0.45 | 45 | UNSOURCED by grade | UNSOURCED by grade |

All entries are **VENDOR CLAIM** [S7], converted from percent where appropriate. The malformed direct-light entry is not silently corrected. Direct and diffuse columns are different illumination contexts, not lower and upper confidence bounds. The energy-saving denominator, weather, temperatures, screen location and sealing are unspecified, so these savings must not become U-value multipliers. Numerical tolerances are unquantified.

The non-complementary direct-light claim for the nominal 40 percent product and the difference between direct and diffuse columns demonstrate why nominal shade should not be interpreted as a measured universal transmission. They do **not** demonstrate preferential NIR rejection. Agriplast separately advertises IR reflection [S17], but gives no spectrally resolved proof. Keep the marketing claim next to [S1]'s neutral-spectrum measurement; do not reconcile them by inventing a correction.

### 1.3 Heat-loss and leakage effects

| Parameter | Evidence / usable bound | Measurement context | Model interpretation and uncertainty |
|---|---|---|---|
| `netLongwaveLossMultiplierFraction`, aluminized energy screen | 0.54 to 0.57 [S3] | Regression slope, screened versus unscreened net radiometer under greenhouse glass; Obscura A/B and A/A samples | Measured radiative-loss ratio, not overall U or Aluminet-grade coefficient. Sample spread is not a confidence interval |
| Same, transparent screens | 0.71 to 0.91 [S3] | NIR screen and Ultima screen respectively | Different materials, not a universal range for clear polyester |
| Same, white/clear diffuse Harmony | 0.82 [S3] | Same net-radiometer experiment | Single tested material; coefficient uncertainty not reported |
| Same, aluminized plus shading screen | Full table spans 0.34 to 0.54 [S3, Table 2] | Layer order and material combinations | Use the full table range rather than only the narrower abstract summary; still not whole-house U |
| Same, paired shading screens | 0.47 to 0.65 [S3, Table 3] | Different combinations and order | Material/setup variability, no universal combined coefficient |
| `closedScreenConvectiveLossMultiplierFraction` | UNSOURCED for black knit and Aluminet grades | UMass [S8] says open weave allows heat to rise and closed weave saves more energy | Need matched heat-flux or calorimetry data with sealing, air velocity and screen location |
| `screenGapExchangeACH_hInv` | UNSOURCED | Gap area alone does not specify pressure-driven flow | Need tracer-gas/airflow data across the screen plus the separate roof-to-outdoor path |

Andersson's paired screen specimens were separated by **0.01 m**, used **0.12 m by 0.12 m** samples, and repeated each combination **four times** [S3]. Those are laboratory/setup facts, not suggested installation dimensions. The paper's summary gives narrower combination ranges than its full result table. The wider full-table range is retained here rather than averaged silently.

A closed screen is a barrier to air movement and radiative transfer [S3, S8]. No standalone convective or leakage coefficient can be recovered from the radiometer measurement. An internal shade screen can also impede buoyant exhaust to roof vents [S8]. Never model it as a cooling benefit with no ventilation consequence by default.

## 2. Thermal / energy curtains

### 2.1 Savings evidence by material and scale

| Material/system | Published quantity | Reduced-order interpretation | Context, range and uncertainty |
|---|---|---|---|
| Typical installed energy/shade screen system | Heating-cost savings 30 to 50 percent [S8] | A useful whole-system comparison envelope, not a direct U multiplier | Extension planning estimate across installations; no confidence interval, weather or tariff normalization supplied |
| Clear polyester LUXOUS 1147 FR | Energy saving 47 percent [S9] | Vendor-method retained-loss complement 0.53, **not a verified installed U multiplier** | Current inside-installation product, full transparent polyester; Svensson method, no uncertainty or boundary-condition specification on page |
| Aluminized/polyester TEMPA 5557 D | Energy saving 57 percent [S10] | Vendor-method retained-loss complement 0.43, same restriction | Current inside-installation product, closed structure; Svensson method, no stated installed calibration |
| Aluminized TEMPA 6562 D | Energy saving 62 percent [S8] | Vendor figure quoted by extension, not a universal material value | Product example in extension article; lacks test conditions and tolerance |
| Lower energy screen plus upper shade screen | Additional energy saving 10 to 15 percent when both extended at night [S8] | Separate comparative evidence; no combined default multiplier | The extension text does not clearly resolve whether the increment is relative to original demand or remaining demand. Do not silently sum or compound |
| Greenhouse with thin thermal curtains | Overall customary R-value 1.42 to 3.33 [S2] | Derived `uValue_Wm2K` approximately 4.00 to 1.71 | Extension assembly range including surface coefficients, materials unspecified; not a curtain resistance to add to another assembly |

The apparent spread is not simply disagreement. The extension savings refer to whole installed systems, the vendor figures to their own rating method, and [S3] measures radiation alone. Combining them into one mean would erase the different denominators.

For later model implementation, prefer `screenClosedUValue_Wm2K` or `screenClosedULossMultiplierFraction` calibrated for the actual glazing and installed curtain. If only whole-house demand savings are available, retain them as benchmark targets for comparable weather, heating schedule and humidity-control policy, not as a direct physics coefficient.

### 2.2 Clear does not mean optically invisible

Current Svensson product pages document substantial measurement-method differences:

| Product / illumination | NEN 2675 shade, percent | Svensson-method shade, percent | Derived transmission complement range, fraction |
|---|---:|---:|---:|
| LUXOUS 1147 FR, direct | 15 | 11 | 0.85 to 0.89 |
| LUXOUS 1147 FR, diffuse | 25 | 19 | 0.75 to 0.81 |
| TEMPA 5557 D, direct | 59 | 55 | 0.41 to 0.45 |
| TEMPA 5557 D, diffuse | 64 | 61 | 0.36 to 0.39 |

Sources [S9, S10], **VENDOR DATA**. These ranges quantify named-method differences, not confidence intervals. The pages do not provide spectral curves or enough spectral-weighting detail to relabel every value as PAR or total-shortwave transmission. UMass's older Tempa example instead quotes direct/diffuse transmission **0.45 / 0.43** [S8]. Preserve that discrepancy with the current diffuse method values instead of replacing it with an average. Possible product or method changes are not established by the inspected documents.

### 2.3 Humidity penalty and control states

Screens restrict the exchange of moisture-bearing air between crop and roof space, while warmer protected leaves may experience less radiative cooling and dew. These effects can coexist. A universal `closedScreenRHIncreasePercent` is **UNSOURCED** and physically inappropriate: RH also changes with temperature, crop moisture production, roof condensation, screen permeability and active dehumidification [S3, S8, S11].

Use the existing moisture balance, not an arbitrary RH increment. If closing the screen restricts the effective outside-air path, reduce only the affected ventilation path with a declared coefficient. Do not reduce sidewall leakage or sidewall fan flow simply because an overhead screen is shut. Internal recirculating fans do not remove water from the modeled zone without an explicit condensation, dehumidification or outdoor-exchange sink.

Practical operating evidence:

- UMass describes controller inputs for sunrise/sunset timing, inside/outside light, temperatures, humidity, wind, snow, gap position and time delay [S8]. **Universal outdoor-temperature thresholds, solar thresholds in W/m², and minutes before sunset are UNSOURCED.** The source tells growers to select them; it does not prescribe a transferable numerical recipe.
- Svensson describes deliberate screen gaps of **1 to 5 percent** [S12], a vendor practice range for humid-air exchange. This is an opening-position range, **not ACH**. The page does not establish a geometry-independent flow or retained energy saving.
- UMass's humidity guidance recommends heating/venting **two to three cycles per hour** in evening and sunrise periods [S11]. This is general greenhouse operating guidance, not a screen-specific controller calibration. It explicitly notes that exchange time depends strongly on fans and vents.

A suitable simple state machine is `open`, `closed`, and `humidityGap`. Deployment can be based on heating need plus low irradiance, with a humidity/dew-point override and reopening logic to avoid a cold roof-space dump. Numeric thresholds and transitions must be operator inputs until product/crop practice data exist. This is a recommended reduced-order structure, not measured control performance.

## 3. Envelope ladder

### 3.1 Glazing and U-values

Material U-values and assembly U-values differ. For a mixed envelope calculate the area-weighted assembly value, including framing and opaque walls: `uEnvelope_Wm2K = sum(uPart_Wm2K × areaPart_m2) / sum(areaPart_m2)`. Roof and wall areas count once. Ground losses require a separate justified treatment; they are not ordinary outside-air glazing losses.

| Envelope | `uValue_Wm2K` | Optical evidence | `infiltrationACH_hInv` | Context and uncertainty |
|---|---:|---|---|---|
| Single polyethylene | 6.84, derived from customary overall R 0.83 [S2, S4] | PAR fraction 0.88 to 0.91 for UV-stabilized film; 0.82 to 0.87 IR/anti-condensate; 0.77 to 0.88 IR/anti-condensate/diffusing film [S13]. Total solar UNSOURCED | Single-film-specific range UNSOURCED | UGA assembly estimate includes surface coefficients, no tolerance. PAR ranges are UMass product-type guidance, not whole-house transmission |
| Double inflated polyethylene | 3.97, derived from overall R 1.43 [S2, S4] | Matched-pair PAR and total solar UNSOURCED. Squaring single-film transmission would be an assumption, not a measured assembly | 0.5 to 1.0 for new double-film construction [S2] | ACH estimate varies with condition and wind. UMass reports about 40 percent night heat-loss reduction versus single film [S13], broadly consistent with the UGA assembly contrast but not exact agreement |
| Clear 8 mm twin-wall polycarbonate | 3.3 [S14] | LT 0.80 and SHGC 0.81 [S14]. PAR and direct total-solar transmission UNSOURCED | Polycarbonate-specific natural ACH UNSOURCED | Palram SUNLITE vendor sheet values, no listed tolerance or frame correction. Do not substitute LT for PAR or SHGC for direct transmission |
| Single glass | 6.24, derived from overall R 0.91 [S2, S4] | Separate float-glass PAR and total-solar values UNSOURCED in inspected sources | 0.75 to 1.0 for new glass construction [S2] | Generic single-glass assembly, not a certified float thickness/coating product. U uncertainty unquantified |
| Double glass | 2.84, derived from overall R 2.00 [S2, S4] | Matched-unit PAR and total-solar UNSOURCED | Use construction-quality glass range only as an explicitly transferred proxy, not a double-glass measurement | UGA specifies a 6.35 mm gap, converted from its stated quarter-inch gap [S2, S4]. Gas, coating and framing changes require another rating |
| Diffuse glass | Diffuse-specific U UNSOURCED; single-glass U above is only an explicit same-assembly proxy | Vendor claims up to 0.975 light transmission with low-iron substrate and double-sided AR coating [S15]; PAR/total-solar split UNSOURCED | Diffuse-specific natural ACH UNSOURCED; new-glass construction range is a proxy only | Diffusion alone does not establish insulation or solar rejection. Vendor gives no uncertainty or adequately specified optical weighting for use as model input |

The generic UGA double acrylic/polycarbonate entry gives **2.84 W/(m²·K)** after conversion [S2, S4], whereas the specific Palram **8 mm twin-wall** product gives **3.3 W/(m²·K)** [S14]. This is a construction-specific difference, not evidence to average the two. Preserve the thickness and wall structure.

For glass construction aging, UGA supplies **1 to 2 h⁻¹** for old but well-maintained glass and **2 to 4 h⁻¹** for poor-condition old glass [S2]. These are natural exchange estimates affected by wind, not separate properties of glass itself. Doors, shutters, vent seals and joints often dominate leakage more than the glazing material.

The optical numbers refer to clean materials/products, unless stated otherwise. UMass identifies dust, aging and condensation effects [S13]. A generic whole-house dirt/frame factor is UNSOURCED here. Existing scenario optical coefficients must not be described as clean-panel measurements.

### 3.2 Diffuse glazing: haze is not a transmission factor

Virtue Glass [S15] markets diffuse glass with optional AR treatment and a maximum light-transmission claim above, but no traceable PAR-versus-NIR curve. Treat it as **VENDOR CLAIM**, not a calibrated preset. ReduSystems [S16] explains that haze measures scattering beyond a small angular threshold, whereas Hortiscatter characterizes angular distribution more fully. A haze percentage cannot be subtracted from light transmission or copied into `shadeFraction`.

The single-zone model can account for measured aggregate transmission. It cannot validate claims about deeper canopy penetration, avoidance of individual leaf sunburn or yield improvement. No yield multiplier is proposed.

### 3.3 Warehouse ladder

| Envelope | Sourced insulation evidence | Derived SI value | Optical treatment | Leakage evidence and uncertainty |
|---|---|---|---|---|
| Uninsulated corrugated metal warehouse | Whole metal-envelope U UNSOURCED | No default U established | Direct crop PAR/solar transmission 0 for the explicitly opaque scenario definition, not a measured wall solar absorptance | NYSERDA reports metal-finished small commercial buildings over 30 ACH50 and translates its leakiest no-air-barrier examples to approximately 1.7 natural ACH using its assumed conversion [S18]. This is not a universal warehouse value |
| Uninsulated concrete / tilt-up proxy | UGA poured concrete wall at 152.4 mm thickness, customary overall R 1.25 [S2, S4] | Wall U approximately 4.54 W/(m²·K) | Same opaque definition | Whole tilt-up warehouse ACH UNSOURCED. Panel joints and loading doors must be characterized separately; concrete-wall U is not whole-building U |
| EPS SIP, moderately insulated | SIPA nominal 165.1 mm panel, customary R 21 [S19, S4] | R 3.70 m²·K/W; panel U 0.270 W/(m²·K) | Same opaque definition | SIPA describes buildings well below 3 ACH50 [S20], not natural ACH. Installed warehouse natural infiltration UNSOURCED |
| EPS SIP, highly insulated | SIPA nominal 311.15 mm panel, customary R 42 [S19, S4] | R 7.40 m²·K/W; panel U 0.135 W/(m²·K) | Same opaque definition | Same warning; no assumed ACH50-to-natural divisor |

SIPA values are **industry-association calculated nominal panel ratings**, not a measured complete warehouse. Panel connections, doors, roof, framing, penetrations and slab can worsen the whole-envelope value. The **0.135 to 0.270 W/(m²·K)** interval above is a range across two cited EPS panel thicknesses, not a statistical tolerance or a universal SIP specification. Original nominal thicknesses are 12.25 and 6.5 inches respectively [S19]; conversions use [S4]. Other cores have different ratings.

NYSERDA's small-commercial review [S18] reports a median converted natural infiltration of **0.4 h⁻¹**, with leaky examples without an air barrier at **1.7 h⁻¹**. Its conversion uses an N-factor of **18**, explicitly part of that context, not a general conversion for every warehouse. The reviewed sample comprises **26** mostly small commercial buildings, generally below approximately **929 m²** floor area, converted from the source's 10,000 ft² threshold [S18, S4]. Treat the span as adjacent-building evidence, not a warehouse-class statistical distribution.

For new construction, [S18] recommends design natural infiltration no higher than **0.3 h⁻¹ heating** or **0.17 h⁻¹ cooling**; for existing buildings it recommends documenting assumptions above **0.7 h⁻¹ heating** or **0.4 h⁻¹ cooling**. These are design guidance, not annual constant ACH defaults. Use measured pressurization plus height/exposure/weather conversion, or natural tracer-gas measurements, where available. Loading-door schedules remain a separate source of exchange.

Opaque zero transmission does not mean zero outdoor solar heat gain. Roof/wall absorption and inward conduction are absent from the current direct-solar hook. Do not compensate by letting direct solar illuminate warehouse crops. If surface-solar loading is omitted, state that limitation.

### 3.4 Envelope-area / floor-area ratio

A universal typical ratio for gutter-connected houses or warehouses is **UNSOURCED**. It is geometry, not a material constant. Prefer dimensions over an archetype guess.

For a rectangular flat-roof warehouse with outside walls and roof, excluding the slab:

`envelopeRatioFraction = 1 + 2 × height_m × (length_m + width_m) / (length_m × width_m)`

For an equal-bay gable-roof gutter-connected greenhouse, with exterior eave walls, equal roof pitch and no intermediate exterior walls:

`envelopeRatioFraction = sec(roofPitch_rad) + 2 × eaveHeight_m × (length_m + width_m) / (length_m × width_m) + ridgeRise_m / length_m`

These are derived geometric identities, not empirical fits. The final greenhouse term represents both sets of triangular end gables under the stated geometry. Do not count internal bay walls. Irregular endwalls, service spaces and roof forms need actual area takeoffs.

UGA's published single-house worked example has **500.8 m²** envelope over **297.3 m²** floor, giving a derived ratio of approximately **1.685** [S2, S4]. The underlying source areas are 5390.6 and 3200 ft². This is a stand-alone gable example, **not** a typical gutter-connected ratio. More shared bays reduce perimeter exposure per floor area; tall warehouse boxes can reverse the expected comparison. Numerical uncertainty comes from actual dimensions and area definition, not a universal percentage band.

## 3A. Insect screens: the ventilation penalty

### 3A.1 What is established

One instrumented rainy-season campaign measured three side-by-side screened greenhouses in the humid tropics
with the fans off, and reported floor-normalized ventilation, screen geometry and microclimate together [S24].
That is the whole measured basis for this component.

| Nominal mesh | Geometry and porosity | Discharge coefficient | Measured ventilation, m3 m-2 s-1 | Ratio to 40 mesh |
| --- | --- | ---: | ---: | ---: |
| 40 | 40 x 38, aperture 0.44 x 0.39 mm, porosity 0.41 | 0.31 | 0.0719 ± 0.0025 | 1.000 |
| 52 | 52 x 22, aperture 0.80 x 0.25 mm, porosity 0.38 | 0.28 | 0.0461 ± 0.0019 | **0.641** |
| 78 | 78 x 52, aperture 0.29 x 0.18 mm, porosity 0.30 | 0.21 | 0.0361 ± 0.0022 | **0.502** |

The same campaign measured the consequences: mean air temperature 30.8, 31.1 and 31.9 °C, and mean
indoor-minus-outdoor absolute humidity 1.05, 1.63 and 2.21 g m-3 across the same three treatments [S24]. So
finer mesh measurably keeps both the crop's heat and the crop's water inside the house.

### 3A.2 What the model does with it

`insectScreen.ventilationFactor` multiplies the achievable maximum outside-air exchange. A catalogued grade
(`mesh40`, `mesh52`, `mesh78`) supplies the measured ratio; an explicit factor overrides it for a user with
real product data. The declared minimum ventilation is a requirement rather than a capability, so it is not
derated; if the derate would fall below it, the maximum clamps there and the run says so.

### 3A.3 The limits, which are severe

- **The reference is the 40-mesh house, NOT an unscreened house.** The campaign had no unscreened control, so
  **the ventilation cost of the first screen is UNSOURCED** and this model cannot supply it. Declaring
  `ventilationFactor: 1` claims a house like the measured 40-mesh one, not an unrestricted one.
- **Ratios transfer, absolute rates do not.** The source reports floor-normalized volumetric flow, not air
  changes per hour, so only the ratio is carried.
- **One house per treatment at one site, one season, fans off, young crop, unstable rainy weather.** Ventilation
  was inferred from an irrigation-minus-drainage water balance cross-checked against an energy balance, not from
  tracer gas. This is a measured direction and magnitude, not a validated universal mesh penalty.
- **Nominal mesh is not a specification.** Note that the 52-mesh sample has a *larger* aperture than the
  40-mesh one in one axis and a lower porosity overall. Match a product on porosity and aperture, not on the
  mesh number.
- **No optical or thermal effect of the mesh is modeled.** Mesh also changes light transmission [S24], and
  screen-specific PAR transmission is UNSOURCED. Use the shade-screen fields to declare an optical loss.
- **The measured direction is not universal across strategies.** It was measured in a house whose only moisture
  sink was the outside-air path. Where a mechanical sink exists the sign can reverse, which this repository
  measured and documented in [CLASSES.md](CLASSES.md).

## 4. Air-source heat-pump heating

### 4.1 What is established

NEEP ccASHP Specification v4.0 [S21] requires steady-state capacity and electrical-input reporting at outdoor temperatures **8.33 °C, -8.33 °C and -15 °C**, converted from **47 °F, 17 °F and 5 °F**, at indoor dry bulb **21.11 °C**, converted from **70 °F** [S4]. Minimum, rated and maximum capacity operation are different columns. Do not mix them into a temperature curve as if compressor loading were unchanged.

For its central heat-pump category, NEEP requires maximum-capacity COP at **-15 °C** of at least **1.75** [S21]. ENERGY STAR separately requires COP at that test point of at least **1.75** and heating capacity at least **70 percent** of its specified nominal **8.33 °C** capacity [S22]. These are **eligibility bounds, not measured values or typical ranges**. They do not establish a temperature slope, a modern-unit average, or performance below the rating point.

**NEEP explicitly excludes defrost-cycling electricity and drain-pan-heater power from its performance table** [S21]. Its lowest catalogued outdoor dry bulb means the lowest temperature with published performance data. **It is not the compressor lockout temperature.**

### 4.2 Generic curve finding: UNSOURCED

No defensible generic `heatingCOP_vsOutdoorC`, low-ambient capacity curve, defrost penalty or compressor cutoff is established by the inspected product data. The accessible NEEP list landing page points to a client-side product tool but did not expose actual unit tables in this research [S23]. A curve fitted to minimum qualification thresholds would fabricate product performance.

**Recommendation: ask for actual model-specific rating points rather than ship an invented default curve.** Required evidence and inputs:

- Outdoor and indoor model numbers, matched combination and source document revision.
- `outdoorTemp_C`, `indoorTemp_C`, `heatingCapacity_kW`, and `electricInput_kW` at consistent rated or maximum operating mode, with relevant indoor airflow.
- Published uncertainty, laboratory method or manufacturer engineering-data status. If absent, state unquantified manufacturer-data uncertainty.
- `minimumCataloguedTemp_C`, `compressorCutoff_C`, and restart/lockout policy as separate fields.
- `defrostCapacityMultiplierFraction`, `defrostInputMultiplierFraction` or an integrated-cycle performance table, together with temperature and moisture context.
- `panHeater_kW` and its control conditions, plus any separately supplied standby power.
- Backup type, finite `backupCapacity_kW`, and fuel efficiency or electrical-input accounting.

### 4.3 Reduced-order interpolation contract

A simple piecewise-linear table is preferable to a polynomial because it exposes the supplied evidence and avoids unsupported low-temperature extrapolation. Interpolate **capacity and input power**, then derive COP:

`weightFraction = (outdoorTemp_C - lowTemp_C) / (highTemp_C - lowTemp_C)`

`capacity_kW = lowCapacity_kW + weightFraction × (highCapacity_kW - lowCapacity_kW)`

`input_kW = lowInput_kW + weightFraction × (highInput_kW - lowInput_kW)`

`heatingCOP = capacity_kW / input_kW`

These equations are an explicit modeling recommendation, not an empirical fit. The valid temperature interval is only the supplied table interval, subject also to the manufacturer's actual operating limits. Keep mode and indoor condition consistent. Scaling one residential unit linearly into a facility equipment bank is a separate declared assumption, not a commercial-product map.

Capacity derate is `capacityAtColdTemp_kW / referenceCapacity_kW`, calculated from the same product and defined operating mode. It is not inferred from COP. A heat pump may maintain capacity by increasing electrical input, so constant capacity does not mean constant efficiency.

A simple defrost representation could separately reduce available heat and adjust electrical input using measured integrated-cycle factors. Without those factors, an unpenalized curve is an **excludes-defrost upper-bound scenario**, not a full operational prediction. No universal defrost percentage or outdoor-temperature window is inserted. Frost also depends on outdoor moisture and control strategy, not dry bulb alone.

Below an evidenced compressor cutoff, delivered compressor heat is **0 kW by the explicit lockout state definition**. Dispatch only the separately declared finite backup source. If there is no backup or it is insufficient, report unmet heating. Between the lowest table point and a lower operating cutoff, performance is unknown unless additional points exist. Do not clamp COP indefinitely, extrapolate into negative values, or silently enable resistance heat.

### 4.4 Rated COP versus seasonal performance

ENERGY STAR defines COP for a single operating condition and HSPF2 as seasonally accumulated delivered heat divided by electrical energy under its prescribed regional rating procedure [S22]. Actual seasonal COP should be `sum(deliveredHeating_kWh) / sum(heatingElectricity_kWh)`, including the declared auxiliaries and backup within a clearly stated boundary. It is not an arithmetic mean of point COPs, and an HSPF2 label is not an hourly COP input.

The current code books `heaterW / heaterEfficiency` to fuel and limits `heaterEfficiency` to a combustion-style fraction. A heat pump needs a separate electrical-heating branch and temperature-dependent finite heat capacity. Update moisture-tempering economics as well as zone heating: `physics.js` also uses fuel heater efficiency in its ventilation-drying comparison. This is a future integration requirement, not an implemented change.

## 5. UNSOURCED register and least-certain parameters

| Missing parameter/evidence | What would settle it |
|---|---|
| Grade-specific black knit and Aluminet PAR, total-shortwave and NIR transmission | Product-identified spectra with wavelength bands, angular integration, photon/energy weighting, shade grade, inside/outside placement and uncertainty; paired PPFD/pyranometer measurements can establish broadband effective values |
| Universal Aluminet NIR-selective benefit | Product-specific selective spectrum or matched calorimetry that separates reflection, transmission and absorption; the inspected measurement does not establish it |
| Closed-screen convective multiplier, crop-to-roof exchange and effective outdoor ACH | Measured screen porosity/permeability or tracer-gas flow with edge seals, gap dimensions, wind, buoyancy and vent positions |
| Universal curtain heating-demand-to-U conversion | Matched installed-screen heat-loss measurements or energy balance with documented glazing, areas, weather, setpoints and humidity-control loads |
| Generic RH penalty or universal deployment thresholds | Crop/house control logs and moisture balance across representative humidity conditions, with paired open/closed observations |
| Single/double float, diffuse glass and double-film separate optical coefficients | Identified assembly test certificates or spectra, including coatings, gap, frame, dirt and angle context |
| Single-film, polycarbonate and diffuse-glass-specific ACH | Facility measurements; material identity alone cannot determine leakage |
| Bare-metal whole-envelope U and a generic SIP/tilt-up warehouse ACH | Construction area takeoff, certified assembly ratings, joint/door leakage and pressurization or tracer-gas tests |
| Typical gutter-connected versus warehouse area ratio | Representative published dimension inventory; actual project drawings are preferable |
| Generic heat-pump curve, low-temperature derate, cutoff and defrost penalty | Actual matched-unit capacity/input tables, controls manual and integrated-cycle low-ambient tests with outdoor moisture conditions |

**Three least-certain parameters:**

1. `screenGapExchangeACH_hInv` or the effective outside-airflow change when a curtain closes. It couples geometry, leakage and control, strongly affects both heat and moisture, and cannot be inferred from a gap percentage.
2. `screenSolarTransmissionFraction - screenParTransmissionFraction` for nominal Aluminet grades. Marketing, ambiguous light-transmission columns and a limited-band neutral-spectrum measurement do not establish a generic selective advantage.
3. `defrostCapacityMultiplierFraction` and associated heating electricity under actual cold, humid operation. The standard product table deliberately excludes this process and no universal penalty was sourced.

## 6. Source register and access record

All sources below were accessed directly during this research. **23 distinct source documents/pages are cited**, counting the NEEP specification separately from its product-list access page and individual vendor product datasheets separately. The SIP chart is part of its parent technical page, not an extra source. This is a mixed primary/extension/vendor reference, not a systematic literature review.

- **[S1]** Gilbert, D.L., Bertling, I., and Savage, M.J. (2013). *Radiation transmission through coloured shade netting and plastics and its effect on Eucalyptus grandis × E. nitens hybrid mini-hedge shoot internode length, stem diameter and leaf area.* Acta Horticulturae 1007, 773-780. DOI 10.17660/ActaHortic.2013.1007.91. Publisher abstract read: https://ishs.org/ishs-article/1007_91/ . Full numeric tables not accessed.
- **[S2]** Ferrarezi, R.S. and Worley, J.W. *Greenhouses: Heating, Ventilation, and Cooling*, UGA Extension Bulletin 792, revised November 2025. Heating/material/ACH sections and worked geometry example read: https://fieldreport.caes.uga.edu/publications/B792/greenhouses-heating-ventilation-and-cooling/ . Extension estimates.
- **[S3]** Andersson, N.E., Aarhus University. *Properties of thermal screens used for energy saving in greenhouses*. Full research manuscript read: https://pure.au.dk/ws/files/4247455/REF403.pdf . Measured radiometer study; publication year not established from manuscript and not guessed.
- **[S4]** NIST SP 811, Appendix B.9, conversion factors by quantity. Thermal-insulance, heat-transfer and temperature tables read: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9 . Standards reference, not material data.
- **[S5]** Ecologic Technologies, *Shade Cloth & Accessories*, black SHADE RITE catalogue: https://www.ecologictechnologiesinc.com/shade_cloth_films_screens_greenhouse_shade_cloth.html . VENDOR CLAIM, grades only.
- **[S6]** Ginegar, *BLACK 50% SHADE NET*, CN9950: https://ginegar.com/default/cn9950 . VENDOR CLAIM; grade confirmation only, no optical method.
- **[S7]** Ecologic Technologies, *Aluminet Shade Cloth*: https://www.ecologictechnologiesinc.com/shade_cloth_films_screens_greenhouse_shade_cloth_aluminet.html . VENDOR CLAIM, direct/diffuse light and savings table; malformed entry retained as unusable.
- **[S8]** Bartok, J.W. Jr. (2016), *Energy and Shade Screen Systems for Greenhouses*, UMass Extension: https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/energy-shade-screen-systems-for-greenhouses . Extension estimates and explicitly identified vendor examples.
- **[S9]** Svensson, *LUXOUS 1147 FR*: https://www.ludvigsvensson.com/en-us/climate-technologies/product/luxous-1147-2675 . VENDOR DATA, named optical methods and energy-saving rating.
- **[S10]** Svensson, *TEMPA 5557 D*: https://www.ludvigsvensson.com/en-us/climate-technologies/product/tempa-5557-d-3552 . VENDOR DATA, named optical methods and energy-saving rating.
- **[S11]** Bartok, J.W. Jr., *Reducing Humidity in the Greenhouse*, UMass Extension: https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/reducing-humidity-in-greenhouse . Extension control guidance, not universal crop thresholds.
- **[S12]** Svensson, *Controlling humidity in greenhouses*: https://www.ludvigsvensson.com/en-us/climate-technologies/climate-topics/humidity-control . VENDOR practice guidance, including gap positions.
- **[S13]** Bartok, J.W. Jr., *Plastic Greenhouse Film Update*, UMass Extension: https://www.umass.edu/agriculture-food-environment/greenhouse-floriculture/fact-sheets/plastic-greenhouse-film-update . PAR by additive family and double-film heat-loss guidance.
- **[S14]** Palram, *SUNLITE twinwall and multiwall polycarbonate sheet*, Dimensions / Colors & Finishes tables: https://www.palram.com/us/product/sunlite/ . VENDOR DATA for clear 8 mm twin-wall U, LT and SHGC; original linked PDF did not convert, so no inaccessible PDF claims used.
- **[S15]** Virtue Glass, *VGC Diffused Greenhouse Glass*: https://www.virtueglassgroup.com/diffused-greenhouse-glass/ . VENDOR CLAIM, maximum light transmission without suitable full optical measurement context.
- **[S16]** ReduSystems (2020), *Replacing Haze by Hortiscatter provides more information about light diffusion*: https://www.redusystems.com/en/articles/replacing-haze-by-hortiscatter-provides-more-information-about-light-diffusion . Vendor technical explanation, not the underlying standard itself.
- **[S17]** Agriplast, *Ginegar Polysack Nets Aluminet*: https://www.agriplast.co.in/products/ginegar-polysack-nets-aluminet . VENDOR CLAIM of IR reflection, not a spectral dataset.
- **[S18]** Henderson, H. and Harley, B. (December 2022), *Infiltration Guidance for Buildings at Design Conditions*, NYS Clean Heat Program: https://cleanheat.ny.gov/assets/pdf/infiltration-guidance-for-buildings-at-design-conditions.pdf . Full guidance read; measured-building summaries plus explicit conversions and design recommendations.
- **[S19]** Structural Insulated Panel Association, *R-Values in the Real World*: https://www.sips.org/resources/r-values-in-the-real-world . Industry-association technical page; chart read directly at https://www.sips.org/images/sections/rvalue-sip.JPG . Calculated nominal panel ratings, not independent warehouse measurements.
- **[S20]** SIPA, *Frequently Asked Questions about SIPs*: https://www.sips.org/frequently-asked-questions-about-sips . Industry-association guidance; ACH50 not natural infiltration.
- **[S21]** NEEP, *Cold Climate Air Source Heat Pump Specification, Version 4.0*, effective January 2023: https://neep.org/sites/default/files/media-files/cold_climate_air_source_heat_pump_specification_-_version_4.0_final.pdf . Full specification read; eligibility and reporting requirements, not unit performance.
- **[S22]** ENERGY STAR, *Heat Pump Equipment Key Product Criteria*: https://www.energystar.gov/products/air_source_heat_pumps/key-product-criteria . Government requirements and COP/HSPF2 definitions.
- **[S23]** NEEP, *ccASHP Specification & Product List*: https://neep.org/heating-electrification/ccashp-specification-product-list . Read together with linked https://ashp.neep.org/ . Access page, not evidence for any particular unit's performance.
- **[S24]** Harmanto, Tantau, H.J., and Salokhe, V.M. (2006). *Influence of Insect Screens with Different Mesh Sizes on Ventilation Rate and Microclimate of Greenhouses in the Humid Tropics.* Agricultural Engineering International: CIGR Journal, Vol. VIII. Open full text read: https://hdl.handle.net/1813/10512 . Related journal article: *Microclimate and Air Exchange Rates in Greenhouses covered with Different Nets in the Humid Tropics*, DOI 10.1016/j.biosystemseng.2006.02.016; treat as one research program, not independent replication. Asian Institute of Technology, Pathum Thani, Thailand, rainy season June to October 2004; three 10 x 20 m houses, 300 tomato plants each, fans off. Screen geometry, discharge coefficients, ventilation with standard errors, and microclimate read from Methods and Table 2. No unscreened control.

Access limitations: the assigned web-search service returned a signup response. Direct URLs supplied by the coordinating researcher and discovered from primary-site links were then read. Publisher ScienceDirect links returned access errors, and the HTFF conference paper returned a server refusal on both attempted host forms. Their numerical results are not used. Vendor and extension access was not treated as independent laboratory verification.

## 7. What sensitivity screening should vary

These are reasoned priorities, not a new executed Morris ranking.

**Influential:**

- Effective outside-air exchange in each screen/vent state. It directly changes sensible exchange and moisture removal, can trade heating against dehumidification, and has the weakest generic evidence.
- Thermal solar transmission, deployed shade fraction and deployment duration. They change sensible load and crop radiation-driven transpiration at the same time.
- PAR transmission and daylight lost to curtains, particularly near a DLI target or the finite lighting limit. Their effect includes replacement lighting electricity and heat, not just optical loss.
- Whole-envelope `U × area` and curtain closed-state heat loss in cold climates. Treat U, geometry and savings evidence consistently so reductions are not double counted.
- Heat-pump delivered capacity, cutoff/backup policy, COP and defrost at cold design conditions. Capacity/cutoff affect unmet hours; efficiency and backup affect purchased energy, cost and emissions.

**Usually second order for this reduced-order screen, conditional on operating regime:**

- Haze/Hortiscatter without a change in measured aggregate PAR transmission. The current zone model has no validated canopy-distribution or yield mechanism, so a large numerical benefit would be unsupported.
- Layer order as a separately tuned parameter after a measured combined heat-loss value is supplied. Andersson found generally small order effects but some exceptions [S3]; carry the observed combination range rather than add an uncalibrated radiation network.
- Refined radiative-versus-convective partition after a defensible effective closed-state U is supplied. Splitting an already calibrated total adds uncertain parameters without adding observed accuracy.
- Fine timing adjustments in periods with neither heating nor shade demand. They become influential near dawn, sunset, humidity thresholds or a tight DLI limit, so do not label deployment timing universally negligible.

Do not dismiss a parameter merely because it is uncertain. Run separate cold/heating-bound, hot/solar-bound and humid/moisture-bound cases. Keep linked parameters physically consistent, and report when the preferred equipment class changes across the evidence ranges.
