# Regional verdicts: ten-year screening evidence

Purpose: compare the same declared greenhouse and six strategies across six weather records, with decision rules visible.

Status: regenerated 2026-09-15 on model `0.3.0-screening`. [regional-study.json](regional-study.json) contains **360 full-year simulations and zero numerical-failure hours**. Its envelope remains `schemaVersion:1` for the Learn consumer; `scenarioSchemaVersion:2` identifies migrated inputs. Do not confuse artifact and scenario schemas.

## Method and decision rules

- Six sites × ten years (2016 to 2025) × six canonical strategies. Committed NASA POWER snapshots, no invented years or cross-site interpolation.
- The same 500 m² greenhouse and crop/target program is re-homed to each ZIP, coordinates and IANA time zone. The staged causal controller uses one-minute steps and Stanghellini transpiration. Installed capacities and manual prices are held consistent; these are not locally sized equipment or local tariffs.
- Joint temperature-and-moisture target attainment is compliant substep time divided by eligible hours. Warm-up, missing and invalid hours are excluded from attainment. Full weather-record cost totals include valid warm-up consumption.
- Per-strategy figures below are medians over ten full weather-record totals, **not one annual result**. Worst and best attainment endpoints are the particular observed years, not probability bounds. The stored pp spread is best minus worst joint attainment.
- Operating dominance requires another strategy with no greater cost and no worse attainment, with one strict advantage. Capital is not included in this comparison.
- Capability tier: within **5 percentage points (pp)** of the best median joint attainment. Recommendation: the cheapest tier member only outside the retained **16% operating-cost band** versus the next candidate; margin = (next − cheapest) / cheapest. A single tier member can resolve without a runner-up margin.
- These 5 pp and 16% rules are **retained methodological choices**, not thresholds calibrated by the regenerated Morris run, uncertainty intervals or probabilities of a winner.
- Ranking stability: a single full operating-cost order must hold in at least 90% of years. This differs from the strict every-year rule in the interactive across-years aggregate. Repeated cost order does not establish robustness to assumptions.
- Design conditions are the single ranked 0.4%-exceedance hour with its coincident state, not ASHRAE mean-coincident design statistics. Moisture/temperature/heating counts are weather-side opportunities, not indoor simulation states.

Operating costs include purchased electricity, purchased heating fuel and water represented by the scenario, using manual $0.12/kWh electricity, $0.045/kWh fuel and $0.002/L water. Excluded: installed capital, maintenance, labor, financing, taxes, demand charges, fixed charges, time-of-use effects and other unmodeled tariff components. Estimated or user-entered installed capital is separate. No modeled cost, difference or reduction is an equipment quote or guaranteed savings.

All cost tables below are model-estimated operating cost, median of full weather-record totals over 2016 to 2025, at the stated prices. Each strategy's structured `costBasis` retains the population and period. Full annual browser costs and matched eligible-hour comparison costs are different populations; see [VERIFICATION.md](VERIFICATION.md).

## The short version

| Region | Retained-rule result | Full cost-order stability |
|---|---|---|
| Tulsa, OK | DX / mini-split + dehumidifier | Fails 90% rule |
| Phoenix, AZ | Unresolved: DX / mini-split + dehumidifier / Integrated HVAC + reheat | Meets 90% rule |
| Miami, FL | DX / mini-split + dehumidifier | Meets 90% rule |
| Denver, CO | Unresolved: Pads + condensing dehumidifier / Desiccant + evaporative cooling | Fails 90% rule |
| Seattle, WA | Unresolved: Desiccant + evaporative cooling / DX / mini-split + dehumidifier | Meets 90% rule |
| Fairbanks, AK | Desiccant + evaporative cooling | Fails 90% rule |

## Weather-side context

Medians of hourly opportunity counts over the ten weather years. Pad-only means its leaving air clears the band where plain outside air cannot cool deeply enough; it is not simulated indoor attainment.

| Site | Pad-only h | Free-cooling h | Heating h |
|---|---:|---:|---:|
| Tulsa, OK | 204.5 | 342.0 | 4,491.5 |
| Phoenix, AZ | 2,273.5 | 2,577.5 | 3,257.0 |
| Miami, FL | 20.5 | 129.5 | 225.5 |
| Denver, CO | 1,072.0 | 1,349.0 | 6,702.0 |
| Seattle, WA | 84.0 | 243.5 | 7,273.0 |
| Fairbanks, AK | 10.0 | 87.5 | 8,348.0 |

## Tulsa, OK (74103)

humid subtropical.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 28.038 | 22.589 | 30.315 | 7.726 | 22,170.57 |
| Pads + condensing dehumidifier | 42.656 | 39.143 | 45.353 | 6.209 | 27,730.61 |
| Desiccant + evaporative cooling | 52.322 | 50.459 | 56.234 | 5.775 | 32,578.70 |
| DX / mini-split + dehumidifier | 71.477 | 68.945 | 74.383 | 5.438 | 38,949.83 |
| Liquid-desiccant hybrid (generic) | 52.599 | 50.964 | 56.899 | 5.935 | 45,387.38 |
| Integrated HVAC + reheat | 55.338 | 51.563 | 58.048 | 6.485 | 46,064.46 |

DX / mini-split + dehumidifier is the only strategy within 5 pp of the best median joint temperature-and-moisture target attainment in this region, holding the target in 71.5% of eligible hours (worst year 68.9%) at $38,950 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025); its 71.5% median attainment exceeds the next strategy's 55.3% by 16.1 pp.

2 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 8 of 10 (80 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is DX / mini-split + dehumidifier in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 4470 h below the heating threshold (20 C by day, 16 C by night here), 1847 h moisture-limited and 1226 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, moisture, is what separates one warm climate from another.

## Phoenix, AZ (85004)

hot-dry.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 45.845 | 41.461 | 48.394 | 6.933 | 14,719.92 |
| Pads + condensing dehumidifier | 49.150 | 44.921 | 52.653 | 7.732 | 15,808.81 |
| Desiccant + evaporative cooling | 50.168 | 46.241 | 54.127 | 7.886 | 16,451.73 |
| DX / mini-split + dehumidifier | 56.537 | 53.588 | 58.581 | 4.993 | 23,899.53 |
| Liquid-desiccant hybrid (generic) | 44.272 | 43.117 | 48.721 | 5.604 | 18,703.55 |
| Integrated HVAC + reheat | 56.473 | 54.661 | 58.710 | 4.048 | 26,791.32 |

Not resolved by this evidence: DX / mini-split + dehumidifier at $23,900 and Integrated HVAC + reheat at $26,791 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025) differ by 12.1 percent relative to DX / mini-split + dehumidifier, inside the retained 16 percent screening band, while holding the joint temperature-and-moisture target in 56.5% and 56.5% of eligible hours; measuring canopy leaf area and transpiration and the as-built envelope U-value at the site, then comparing capital, maintenance and redundancy, is what would resolve it.

1 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 10 of 10 (100 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is DX / mini-split + dehumidifier in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 3231 h below the heating threshold (20 C by day, 16 C by night here), 806 h moisture-limited and 1368 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, temperature, is what separates one warm climate from another.

## Miami, FL (33101)

hot-humid.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 7.835 | 5.251 | 9.338 | 4.087 | 6,985.36 |
| Pads + condensing dehumidifier | 9.783 | 6.471 | 11.177 | 4.705 | 21,803.44 |
| Desiccant + evaporative cooling | 10.490 | 7.083 | 12.024 | 4.941 | 29,980.62 |
| DX / mini-split + dehumidifier | 59.681 | 58.211 | 61.730 | 3.519 | 40,354.31 |
| Integrated HVAC + reheat | 41.435 | 39.776 | 42.962 | 3.185 | 43,826.79 |
| Liquid-desiccant hybrid (generic) | 14.282 | 11.065 | 16.926 | 5.860 | 46,961.96 |

DX / mini-split + dehumidifier is the only strategy within 5 pp of the best median joint temperature-and-moisture target attainment in this region, holding the target in 59.7% of eligible hours (worst year 58.2%) at $40,354 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025); its 59.7% median attainment exceeds the next strategy's 41.4% by 18.2 pp.

1 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 10 of 10 (100 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is DX / mini-split + dehumidifier in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 226 h below the heating threshold (20 C by day, 16 C by night here), 3901 h moisture-limited and 3494 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, moisture, is what separates one warm climate from another.

## Denver, CO (80202)

cold-dry at altitude.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 41.987 | 39.839 | 44.172 | 4.334 | 25,226.53 |
| Pads + condensing dehumidifier | 68.865 | 68.050 | 69.844 | 1.794 | 26,617.39 |
| DX / mini-split + dehumidifier | 69.486 | 68.807 | 70.626 | 1.819 | 28,311.56 |
| Desiccant + evaporative cooling | 68.152 | 67.152 | 68.999 | 1.847 | 28,251.03 |
| Liquid-desiccant hybrid (generic) | 66.212 | 64.994 | 66.891 | 1.897 | 32,667.71 |
| Integrated HVAC + reheat | 60.366 | 58.366 | 61.839 | 3.472 | 34,027.24 |

Not resolved by this evidence: Pads + condensing dehumidifier at $26,617 and Desiccant + evaporative cooling at $28,251 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025) differ by 6.1 percent relative to Pads + condensing dehumidifier, inside the retained 16 percent screening band, while holding the joint temperature-and-moisture target in 68.9% and 68.2% of eligible hours; measuring canopy leaf area and transpiration and the as-built envelope U-value at the site, then comparing capital, maintenance and redundancy, is what would resolve it.

2 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 6 of 10 (60 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is Pads + condensing dehumidifier in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 6729 h below the heating threshold (20 C by day, 16 C by night here), 66 h moisture-limited and 0 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, moisture, is what separates one warm climate from another.

## Seattle, WA (98104)

cool-marine.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 43.221 | 41.228 | 48.239 | 7.011 | 34,105.57 |
| Pads + condensing dehumidifier | 68.233 | 65.342 | 70.988 | 5.646 | 35,671.05 |
| Desiccant + evaporative cooling | 84.980 | 82.580 | 86.586 | 4.007 | 40,139.09 |
| DX / mini-split + dehumidifier | 87.106 | 85.582 | 87.849 | 2.266 | 43,255.04 |
| Liquid-desiccant hybrid (generic) | 82.377 | 80.890 | 84.552 | 3.662 | 51,046.23 |
| Integrated HVAC + reheat | 67.196 | 65.220 | 68.771 | 3.551 | 53,101.81 |

Not resolved by this evidence: Desiccant + evaporative cooling at $40,139 and DX / mini-split + dehumidifier at $43,255 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025) differ by 7.8 percent relative to Desiccant + evaporative cooling, inside the retained 16 percent screening band, while holding the joint temperature-and-moisture target in 85.0% and 87.1% of eligible hours; measuring canopy leaf area and transpiration and the as-built envelope U-value at the site, then comparing capital, maintenance and redundancy, is what would resolve it.

1 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 10 of 10 (100 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is Desiccant + evaporative cooling in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 7299 h below the heating threshold (20 C by day, 16 C by night here), 699 h moisture-limited and 31 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, moisture, is what separates one warm climate from another.

## Fairbanks, AK (99701)

subarctic, light-limited.

| Strategy | Median joint attainment % | Worst % | Best % | Best minus worst pp | Modeled median-period operating cost USD |
|---|---:|---:|---:|---:|---:|
| Pad + vent baseline | 26.798 | 23.132 | 28.027 | 4.895 | 47,390.38 |
| Pads + condensing dehumidifier | 43.271 | 40.624 | 46.576 | 5.951 | 51,610.64 |
| DX / mini-split + dehumidifier | 56.106 | 52.081 | 61.242 | 9.160 | 55,900.35 |
| Desiccant + evaporative cooling | 63.954 | 59.583 | 69.663 | 10.080 | 58,751.85 |
| Integrated HVAC + reheat | 40.610 | 35.886 | 43.423 | 7.537 | 58,979.50 |
| Liquid-desiccant hybrid (generic) | 56.161 | 51.968 | 60.990 | 9.021 | 73,064.03 |

Desiccant + evaporative cooling is the only strategy within 5 pp of the best median joint temperature-and-moisture target attainment in this region, holding the target in 64.0% of eligible hours (worst year 59.6%) at $58,752 modeled operating cost (median over weather years 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025); its 64.0% median attainment exceeds the next strategy's 56.2% by 7.8 pp.

2 distinct operating-cost orders of the six strategies over 10 weather years; the most common holds in 5 of 10 (50 percent), against the pre-set rule that one order must hold in at least 90 percent of years. The cheapest member of the capability tier is Desiccant + evaporative cooling in 10 of 10 years.

Mean hours per year from the weather-side screen at this band: 8354 h below the heating threshold (20 C by day, 16 C by night here), 172 h moisture-limited and 1 h temperature-limited. Hours below a 20 C daytime threshold are plentiful at every temperate site, so the heating count says the band is cool, not that the site is a heating climate; the cooling-side comparison, moisture, is what separates one warm climate from another.

## Scope and measurement before action

Resolved means resolved by these rules among these six declared strategies, not a facility purchase recommendation. Three regions remain unresolved: Phoenix, Denver and Seattle. Measure canopy leaf area/transpiration and as-built envelope behavior, verify actual controlled-air/fan capacity and equipment ratings, then compare capital, maintenance, redundancy and site tariffs. A stable weather-year order can still be unresolved or wrong under changed assumptions.

No opaque-building, recovery or DOAS performance ranking is established by this canonical six-strategy greenhouse study. The former $39,517 DOAS result and all reductions derived from it are withdrawn. No general hybrid-close-up recommendation is retained. A 6 ACH economizer case is a capacity assumption, not a recommended ventilation rate; 15 ACH is constrained semi-closed operation. Mushroom airflow requires project inputs and internal circulation is unmodeled.

Ten particular weather years are not a forecast, stationary distribution, confidence interval or design year. No empirical calibration, independent model benchmark, manufacturer map, guaranteed savings, yield or saleable-output result is claimed.

## Reproduce

```sh
node scripts/regional-study.mjs
node --test test/regional.test.mjs
```

The regenerated run recorded 220 seconds. Learn reads the committed artifact and renders absent evidence as absent, not as a substitute example. Keep envelope schema 1 unless the consumer contract is intentionally changed.
