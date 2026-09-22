# Moisture conventions and independent validation references

Research checked 2026-09-22. This document distinguishes a provider's documented convention, evidence from its source code, and an application assumption. A field named `dew` or `relative_humidity` alone does not prove its subfreezing convention.

## Provider evidence

| Provider / fields | Evidence and phase convention | Normalization implication / remaining uncertainty |
| --- | --- | --- |
| NASA POWER `RH2M` | The [POWER relative-humidity methodology](https://power.larc.nasa.gov/docs/methodology/meteorology/relative-humidity/) explicitly says only RH over water is provided. It gives the Flatau liquid-water polynomial, valid −85 to 70 °C, alongside a separate ice polynomial. | Interpret RH as liquid-water referenced, including below freezing. Do not pass it unchanged into an ice-referenced RH conversion. |
| NASA POWER `T2MDEW` | The [parameter documentation](https://power.larc.nasa.gov/docs/tutorials/parameters/) identifies provider parameters; the RH methodology mentions dewpoint-derived validation. No explicit subzero dew/frost definition or `T2MDEW` generation algorithm was established in the reviewed material. | **Unverified dewpoint phase.** The explicit RH convention is stronger evidence than an inference from the name `T2MDEW`. Prefer the documented RH input until the dewpoint convention is confirmed. |
| Open-Meteo ERA5 / ERA5-Land `relative_humidity_2m`, `dew_point_2m` | [ECMWF ERA5 documentation](https://confluence.ecmwf.int/pages/viewpage.action?pageId=177481858), “Near-surface humidity,” explicitly instructs use of saturation over water when converting dewpoint. It distinguishes this from the selectable water/ice/mixed reference for RH. Open-Meteo's [ERA5 controller](https://github.com/open-meteo/open-meteo/blob/fb7e8046633bafe1244e16abf1c1491bae48ecca/Sources/App/Era5/Era5Controller.swift#L286) computes RH from raw temperature and dewpoint using its [Meteorology helper](https://github.com/open-meteo/open-meteo/blob/fb7e8046633bafe1244e16abf1c1491bae48ecca/Sources/App/Helper/Meteorology.swift). That helper uses fixed Magnus coefficients 17.625 and 243.04, without an ice switch, and clips RH to 0–100%. | The inspected ERA5 source path supports liquid-water RH/dewpoint handling. Retain provider dewpoint as the moisture observation when available; regenerating vapor pressure from rounded/clipped RH loses information. Source inspection does not prove the deployment commit serving a past request. |
| NOAA ISD `TMP`, `DEW` | [ISD format documentation](https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf), printed p.11, defines dewpoint by saturation at fixed pressure/moisture and stores tenths °C, with `+9999` missing. Printed p.133 defines original-observation flag `R` for dewpoint/RH converted from ice to water. [ISD overview](https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database) says the archive combines more than 100 source types. | Evidence supports water conversion for specifically flagged records, but does **not establish a universal phase guarantee for every `DEW` record**. Preserve source and quality flags. Do not claim a blanket ice or water guarantee from this format definition. |
| IEM METAR `tmpf`, `dwpf`, `relh` | [IEM download documentation](https://mesonet.agron.iastate.edu/request/download.phtml) defines Fahrenheit temperature/dewpoint and percent RH without a phase definition. [pyIEM observation code](https://github.com/akrherz/pyIEM/blob/584c1cf13ff02ed17b1f27b55eba7b052d171fbb/src/pyiem/observation.py) computes missing RH with MetPy `relative_humidity_from_dewpoint` without an explicit phase argument. [MetPy 1.7 documentation](https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.relative_humidity_from_dewpoint.html) specifies the default as liquid. | **Code-supported liquid convention for that computed-RH path.** This is not confirmation of the deployed historical MetPy version, every imported RH value, or every original METAR sensor's reporting convention. Preserve raw dewpoint and derivation provenance. |
| Visual Crossing `humidity`, `dew` | [Timeline API documentation](https://www2.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/) specifies percent RH and dewpoint temperature. [Weather data documentation](https://www2.visualcrossing.com/resources/documentation/weather-data/weather-data-documentation/) describes the variables but gives no ice/water rule or subzero frost conversion. | **Unverified phase for both fields.** A liquid-water interpretation must be recorded as an application assumption, not as a documented provider fact. |

## Explicit application conventions

Use vapor pressure `e` (Pa) or humidity ratio `W` (kg water/kg dry air) as the common moisture quantity. Keep the original provider field/value and its reference phase in provenance. For a stated RH phase, `e = RH_fraction × p_sat(T, phase)`; for liquid dewpoint, `e = p_sat(Tdew, water)`; for frost point, `e = p_sat(Tfrost, ice)`. Then `W = 0.621945 e / (P − e)`, using absolute station pressure in Pa. These relationships follow the perfect-gas section of [ASHRAE Fundamentals, chapter 1](https://handbook.ashrae.org/Handbooks/F25/SI/F25_Ch01/F25_Ch01_si.aspx).

The selected application policy is:

- Stable-phase calculations retain the vendored PsychroLib 2.5.0 branch: ice at/below 0.01 °C and water above it. A subzero result from its generically named dewpoint functions is consequently an ice-equilibrium temperature; do not relabel it a liquid dewpoint.
- Explicit water calculations below the triple point use Murphy–Koop (2005), equation 10, rather than extending the ASHRAE warm-water equation outside its documented range. At/above the triple point use the ASHRAE water branch. This is an application-selected combination of formulations, not a published single correlation.
- Explicit ice calculations require an ice-valid temperature. Do not extrapolate ice saturation into normal warm-air conditions.
- Unknown source phase remains unknown unless an explicitly recorded normalization assumption supplies it. Mathematical consistency cannot establish provider provenance.
- Preserve historical snapshots and their existing arrays byte-for-byte. Record legacy normalization separately; do not silently rewrite stored RH/dewpoint or claim that historical Magnus-derived values were produced by the new formulation.

Unannotated legacy `weatherState` inputs retain the old PsychroLib assumption explicitly for compatibility. New imported cold records with unknown phase are invalid rather than guessed. Existing sealed schema-2 values remain unchanged; a new model version identifies revised interpretation without rewriting the source dataset.

## Murphy–Koop primary equation and published check values

The [original paper](https://doi.org/10.1256/qj.04.94) ([accessible PDF](https://www.patarnott.com/atms360/pdf_atms360/class2017/VaporPressureIce_SupercooledH20_Murphy.pdf)), printed p.1552, equation 10, specifies **123 < T < 332 K**, with vapor pressure in Pa:

```text
ln(p_water) = 54.842763 − 6763.22/T − 4.210 ln(T) + 0.000367 T
            + tanh(0.0415 (T − 218.8))
              × (53.878 − 1331.22/T − 9.44523 ln(T) + 0.014025 T)
```

Appendix C, printed p.1561, supplies these values specifically for checking computer code. They are published reference values, not outputs of the application under test:

| Temperature K | Temperature °C | Ice pressure Pa | Liquid pressure Pa |
| ---: | ---: | ---: | ---: |
| 240 | −33.15 | 27.272 | 37.667 |
| 273.15 | 0 | 611.154 | 611.213 |
| 273.16 | 0.01 | 611.657 | 611.657 |
| 300 | 26.85 | — | 3536.8 |

At 0 °C, water and ice values differ; the exact triple point is 0.01 °C. The [IAPWS R14-08(2011) sublimation release](https://www.iapws.org/relguide/MeltSub.html) independently defines 273.16 K / 611.657 Pa. Test each branch immediately below, at, and above the application switch; allow the small mismatch between separately fitted correlations rather than asserting exact continuity.

## Independent saturation and pressure vectors

The [ASHRAE SI chapter 1 Table 3](https://handbook.ashrae.org/Handbooks/F25/SI/F25_Ch01/F25_Ch01_si.aspx) supplies the following saturation pressures from LibHuAirProp/IAPWS. This is independent of the local JavaScript implementation. Its 0 °C row is **liquid**, not the PsychroLib stable-phase branch. The triple-point row below comes from IAPWS, not that table.

| Temperature °C | Reference phase | Published saturation pressure Pa |
| ---: | --- | ---: |
| −20 | ice | 103.24 |
| −10 | ice | 259.87 |
| 0 | water | 611.21 |
| 0.01 | triple point | 611.657 |
| 20 | water | 2339.2 |
| 40 | water | 7384.4 |

For pressure coverage, the next values were calculated independently in Python from those **published rounded pressures**, with `e = 0.5 × p_sat` and `W = 0.621945 e/(P−e)`. They are derived ideal-gas reference vectors, not measured humid-air data or directly published table entries. Their RH reference phase is the preceding table's phase.

| Temperature °C | W at 70000 Pa | W at 84000 Pa | W at 101325 Pa |
| ---: | ---: | ---: | ---: |
| −20 | 0.000458978477 | 0.000382435026 | 0.000317011251 |
| −10 | 0.001156610110 | 0.000963543114 | 0.000798580678 |
| 0 | 0.002727184901 | 0.002270994392 | 0.001881514948 |
| 0.01 | 0.002729188142 | 0.002272661322 | 0.001882895134 |
| 20 | 0.010568395244 | 0.008782124341 | 0.007262982046 |
| 40 | 0.034631601848 | 0.028594300043 | 0.023520224033 |

Additional liquid-water samples, evaluated separately in Python using Murphy–Koop equation 10, are −20 °C: **125.504169354940 Pa** and −10 °C: **286.452971020122 Pa**. These help reproduce a reference calculation but are not an independent physical model. The published Appendix C checks above remain necessary to catch transcription mistakes.

Suggested fixture tolerances: 0.05% relative for ASHRAE-table saturation/derived-W comparisons; 0.002 Pa absolute for the rounded Murphy–Koop 0 °C/triple-point checks, and 0.001 Pa for its 240 K liquid check. These are application test tolerances, not claims of measurement accuracy. Do not demand machine precision against rounded publications. ASHRAE real-air Table 2 includes effects absent from the ideal-gas conversion, so do not use its humidity ratios as strict algebraic-equality fixtures.

The executable [reference fixture](../../test/fixtures/psychrometric-reference.json) is reproducibly generated by [build-moisture-reference.py](../../scripts/build-moisture-reference.py). It includes both 50% and 100% RH across the three pressures and uses a conservative 0.1% relative comparison allowance (with small absolute floors). It additionally supplies separate ice/water rows at 0 °C and 0.01 °C. Those explicit branch distinctions are required when consuming the fixture. Its liquid 0 °C value is 611.213 Pa from Murphy–Koop Table C1; the illustrative grid above instead uses ASHRAE's 611.21 Pa.

Pair reference fixtures with invariants: water/ice conversions preserve `e` and `W`; pressure changes affect `W` at fixed `e`; RH-to-dewpoint-to-RH preserves the explicitly selected phase; water RH may imply ice supersaturation below freezing. Reject `e >= P`, missing/nonfinite values, and unsupported phases rather than hiding them behind clipping. Legacy regression fixtures should be separate from the physically explicit conversions.

## Historical evidence and affected-case comparison

The [legacy snapshot fixture](../../test/fixtures/legacy-moisture-snapshot.json) was generated by executing the committed `normalizeWeather`, `sealWeatherSnapshot`, and `weatherState` from **`efeacd24fb5f89d1c2b499e46c6390a765c6afd4`**. Generation used `git archive` of that commit's `src`, `vendor`, and `package.json`, extracted into a temporary isolated directory. It imported no working-tree implementation. The fixture stores the original CSV, input rows, old direct/CSV state results, and the complete sealed schema-2 snapshot.

Its immutable identity is:

```text
weather:sha256:56d9382e8ad0fea20343d56dec0f7f7672947fe2f378fc28cab54a05cdf1445a
```

[moisture-providers.test.mjs](../../test/moisture-providers.test.mjs) verifies that current normalization and resealing reproduce this ID and the entire snapshot, without modifying its source object or numeric evidence. This is historical regression evidence produced by old code, separate from a snapshot created with the new implementation.

For the fixture's dewpoint-only input rows, computed humidity ratios are below. Values are kg water/kg dry air; displayed digits support reproducibility, not measurement accuracy. “Old CSV” first converted dewpoint to RH using the former Magnus approximation, then interpreted that RH with the PsychroLib stable-phase saturation curve. “Old direct” used the stable-phase curve directly. New water CSV and direct paths share the authoritative liquid-dewpoint interpretation; new ice uses the frost-point interpretation.

| Dry bulb / input dewpoint °C | Pressure Pa | Old CSV W | Old direct W | New water CSV = direct W | New ice W | New unspecified phase |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| −10 / −20 | 84000 | 0.000845201280 | 0.000765491918 | 0.000930636779 | 0.000765491918 | Invalid: phase unresolved |
| −20 / −30 | 70000 | 0.000372678057 | 0.000337950111 | 0.000452888850 | 0.000337950111 | Invalid: phase unresolved |
| 20 / 10 | 101325 | 0.007635357126 | 0.007630053703 | 0.007630053703 | Outside ice domain | 0.007630053703 |

The old cold CSV/direct discrepancy exceeds 9% in both cases. Explicit ice reproduces the old direct results; explicit liquid water represents a different physical moisture quantity at the same numerical subzero dewpoint. The warm row changes only the former CSV approximation; its direct interpretation remains unchanged. Historical sealed snapshot results retain their former values.

The same test file mocks NASA POWER and Open-Meteo responses at −10 °C, 50% RH, 84000 Pa, with an auxiliary −20 °C dewpoint. It checks provider unit conversion and declared liquid-water RH against equivalent CSV and direct states. NASA's auxiliary dewpoint convention remains unknown, while Open-Meteo's is water; RH remains authoritative for these adapter responses. No live network request is used in this regression test.
