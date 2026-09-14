# Regional verdicts: what ten observed years actually recommend

Purpose: say, per bundled climate, what the weather gives for free, what constraint binds, which equipment class the ten committed weather years support, and where the evidence does not support a choice at all.

Status: executed 2026-09-14 for model `0.2.0-screening`. Measured run: [regional-study.json](regional-study.json), five sites by ten weather years (2016 to 2025) by the six canonical strategies of [example-scenarios.json](example-scenarios.json), 300 full-year simulations at a 1-minute control step, 138.8 s on 8 worker threads. Every number below is read from that file, which `scripts/regional-study.mjs` computes from the committed NASA POWER snapshots in `data/weather`.

Read this if: you are choosing an equipment class for a climate like one of these five, or you want to see what a ten-year screen can and cannot settle.

## The short version

| Site | Climate | Cooling-side constraint | Best attainment | Verdict at this evidence tier | Cost margin | Ranking stable |
| --- | --- | --- | ---: | --- | ---: | --- |
| Tulsa, OK | humid subtropical | moisture | 71.5% | **DX + dehumidifier**, alone in the capability tier | n/a | No (2 orders, 8 of 10) |
| Phoenix, AZ | hot-dry | temperature | 56.5% | **Not resolved**: DX or integrated HVAC | 12.1% | Yes (1 order, 10 of 10) |
| Miami, FL | hot-humid | moisture | 59.7% | **DX + dehumidifier**, alone in the capability tier | n/a | Yes (1 order, 10 of 10) |
| Denver, CO | cold-dry at altitude | moisture | 69.5% | **Not resolved**: pads plus dehumidifier, or desiccant | 6.1% | No (2 orders, 6 of 10) |
| Seattle, WA | cool-marine | moisture | 87.1% | **Not resolved**: desiccant or DX | 7.8% | Yes (1 order, 10 of 10) |

Three of five regions do not resolve. That is the result, not a failure to reach one: in those three the cheapest two strategies that hold the band equally well sit inside the cost band the Morris screening ([SENSITIVITY.md](SENSITIVITY.md)) shows the screened parameter ranges can reorder, so this evidence tier does not name a winner. The two that do resolve, Tulsa and Miami, resolve on **capability**, not on cost: one strategy holds the joint band far better than every alternative, and it is also the most expensive of the four cheapest.

## The weather side, measured

Medians over the ten years, from the weather-side screen at the example band (22 C day, 18 C night, 2 K tolerance, 19 C maximum dew point). Design conditions are the value exceeded in 0.4 percent of the pooled 87,672 hours, with the coincident state of that same hour.

| Site | Pad-effective h | Free-cooling h | Heating h | Moisture-limited h | Temperature-limited h | Design dry bulb (C) | Coincident wet bulb (C) | Design dew point (C) | Mean summer wet bulb (C) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tulsa, OK | 205 | 342 | 4,491.5 | 1,832.8 | 1,258.4 | 39.04 | 24.76 | 25.19 | 22.45 |
| Phoenix, AZ | 2,274 | 2,577.5 | 3,257 | 773.2 | 1,364.6 | 44.90 | 21.60 | 21.79 | 18.62 |
| Miami, FL | 21 | 129.5 | 225.5 | 3,903.7 | 3,495.2 | 31.31 | 25.92 | 26.58 | 25.66 |
| Denver, CO | 1,072.5 | 1,349 | 6,702 | 63.3 | 0.0 | 33.66 | 12.88 | 13.99 | 12.21 |
| Seattle, WA | 84 | 243.5 | 7,273 | 691.1 | 27.0 | 28.38 | 21.30 | 18.71 | 14.84 |

Two of these columns need reading carefully:

- **Heating hours are counted against this band's own heating threshold**, 20 C by day and 16 C by night, so hours below it are plentiful everywhere except Miami and the heating count is the largest of the three at four of the five sites. That says the band is cool, not that Phoenix is a heating climate. The comparison that separates one warm climate from another is the cooling-side one, **moisture-limited against temperature-limited**, which is why the summary table above reports that instead.
- **Moisture-limited and temperature-limited hours carry decimals** because the pad-ineffective hours are split between the two causes in the proportion the pad-failure flags observed, as `bindingConstraint` in `src/metrics.js` does. They are mean hours per year, not integer event counts.

Pad-effective hours are the clearest single discriminator in the table: 2,274 hours a year at Phoenix against 21 at Miami, a factor of 108 at the same crop band. Free cooling follows it.

## The rules this document applies, stated once

Two thresholds decide every verdict, and both are set from measured results rather than preference:

1. **Capability tier, 5 attainment points.** Strategies whose median joint-band attainment is within 5 points of the region's best are treated as equally capable. The Morris screening moves attainment by 9.10 percentage points over the leaf-area range alone, and leaf area is currently an assumption rather than a measurement, so attainment differences narrower than a few points are not resolved at this evidence tier. Inside the tier, dominance is not used as a separator for the same reason: a strategy that attains 0.7 points less for slightly more money has not been shown to be worse.
2. **Indistinguishable cost band, 16 percent.** Inside the capability tier, the cheapest strategy is recommended only when it is more than 16 percent cheaper than the next one. Sixteen percent is the measured Morris result: the screened parameter ranges reordered the three strategies whose median costs sat within about 16 percent of each other (13,006 / 13,732 / 15,058 dollars over the sampled days), and the three cheapest positions were the ones that held in 104 of 104 design points. A margin inside that band is therefore not a finding about equipment, and the verdict says so, names both candidates and names what would resolve it.

**Ranking stability** is reported by the same 90 percent rule the Morris screening uses over design points: the ranking is called stable when one per-year operating-cost order of the six strategies holds in at least 9 of the 10 years. The verdict also reports the narrower, decision-relevant count: how many of the ten years the recommended strategy was the cheapest member of the capability tier.

**What the cost column is.** Annual operating cost only, at the example scenarios' declared 0.12 USD/kWh electricity and 0.045 USD/kWh fuel at every site. A cost difference between two regions here is a dispatch difference, not a tariff difference, and no capital, maintenance, redundancy or demand charge is in any number. The six strategies span 15,000 to 125,000 USD of declared installed cost, so a 5,000 dollar annual operating difference can be repaid or swamped by capital that this model does not carry.

## Tulsa, OK (74103), humid subtropical

Tulsa is hot and humid in summer and genuinely freezing in winter: a 39.04 C design dry bulb arriving with a 24.76 C coincident wet bulb, and 4,491.5 hours a year below the band's heating threshold. Evaporative cooling barely qualifies here, 205 pad-effective hours a year against 1,832.8 moisture-limited hours, so the summer problem is water in the air rather than heat alone.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 28.0% | 22.6% (2019) | 30.3% (2017) | 7.7 | $22,169 | $3,012 | 59,307 | 310,699 |
| 2 | Pads + condensing dehumidifier | 42.7% | 39.1% (2019) | 45.4% (2017) | 6.2 | $27,727 | $5,134 | 123,941 | 259,997 |
| 3 | Desiccant + evaporative cooling | 52.3% | 50.5% (2018) | 56.2% (2020) | 5.8 | $32,576 | $7,042 | 63,213 | 532,476 |
| 4 | DX / mini-split + dehumidifier | 71.5% | 68.9% (2022) | 74.4% (2020) | 5.4 | $38,954 | $6,660 | 201,811 | 308,250 |
| 5 | Liquid-desiccant hybrid (dominated) | 52.6% | 51.0% (2018) | 56.9% (2020) | 5.9 | $45,385 | $10,624 | 244,098 | 321,087 |
| 6 | Integrated HVAC + reheat (dominated) | 55.3% | 51.6% (2019) | 58.0% (2017) | 6.5 | $46,062 | $7,794 | 239,790 | 369,465 |

**Verdict: DX plus a condensing dehumidifier**, on capability. It is the only strategy within 5 points of the best median attainment, holding the joint band in 71.5 percent of eligible hours with a worst year of 68.9 percent, at 38,954 dollars of median annual operating cost. The next strategy is 16.1 points behind. The cost ranking is **not stable** (2 distinct orders over the ten years, the most common holding in 8 of 10), but the instability is confined to the two most expensive strategies swapping places, and DX is the cheapest member of the capability tier in 10 of 10 years.

In plain terms: at Tulsa the pad is cheap and does not work. It runs, but the weather clears both the temperature margin and the moisture ceiling in only 205 hours a year, so a pad-only house sits inside the joint band 28 percent of the time. Adding a condensing dehumidifier buys 14.6 points for 5,558 dollars a year. Adding real mechanical cooling on top buys another 28.8 points, and that is the step that changes what the facility can promise a buyer. The cheaper options are not close substitutes; they are a different product with a wider band. Note the pad baseline's 7.7-point attainment spread across the ten years, the largest of the six here: the less equipment you install, the more your year depends on the weather you happen to get.

## Phoenix, AZ (85004), hot-dry

Phoenix is the hottest and driest of the five, with a 44.90 C design dry bulb that arrives at only a 21.60 C coincident wet bulb, and 2,274 pad-effective hours a year, eleven times Tulsa's. It is also the only one of the five where the cooling-side constraint is **temperature** rather than moisture: 1,364.6 temperature-limited hours against 773.2 moisture-limited ones.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 45.8% | 41.5% (2022) | 48.4% (2017) | 6.9 | $14,717 | $2,343 | 35,635 | 164,999 |
| 2 | Pads + condensing dehumidifier | 49.1% | 44.9% (2022) | 52.6% (2019) | 7.7 | $15,808 | $1,612 | 46,618 | 157,363 |
| 3 | Desiccant + evaporative cooling | 50.2% | 46.2% (2022) | 54.1% (2019) | 7.9 | $16,451 | $1,632 | 36,265 | 196,787 |
| 4 | DX / mini-split + dehumidifier | 56.5% | 53.6% (2020) | 58.6% (2019) | 5.0 | $23,898 | $2,002 | 113,195 | 163,838 |
| 5 | Liquid-desiccant hybrid (dominated) | 44.3% | 43.1% (2024) | 48.7% (2019) | 5.6 | $18,702 | $3,271 | 60,480 | 166,554 |
| 6 | Integrated HVAC + reheat (dominated) | 56.5% | 54.7% (2020) | 58.7% (2019) | 4.1 | $26,789 | $2,838 | 132,860 | 174,909 |

**Verdict: not resolved.** DX at 23,898 dollars and integrated HVAC with reheat at 26,789 dollars both hold the band in 56.5 percent of eligible hours, and 12.1 percent of cost is inside the 16 percent band where the screened parameter ranges reorder strategies. Nothing here says which is cheaper at a real Phoenix site. What would resolve it: measuring canopy leaf area and transpiration and the as-built envelope U-value, the two parameters the Morris screening ranks first and second on cost, then comparing capital, maintenance and redundancy, none of which this model carries. The cost ranking itself is stable, one order in all ten years, which is worth noting: the order is reproducible, and it is still not decisive, because stability across weather years says nothing about robustness to the assumptions.

In plain terms: Phoenix is the one site where the cheap equipment is genuinely competent. The pad baseline holds the band 45.8 percent of the time for 14,717 dollars a year, and the whole 10.7-point climb to 56.5 percent costs 9,181 dollars a year more. Also read row 5: the liquid-desiccant hybrid costs 27 percent more than the pad baseline and attains 1.5 points **less**, which is what dominance means. Dry air is a poor market for a machine that sells dryness.

## Miami, FL (33101), hot-humid

Miami is the mirror image of Phoenix: the design dry bulb is only 31.31 C but it arrives with a 25.92 C coincident wet bulb, and the mean summer wet bulb of 25.66 C is above Phoenix's 0.4 percent design wet bulb. Evaporative cooling has almost nothing to work with, 21 pad-effective hours a year, and the 3,903.7 moisture-limited hours make this the only site where moisture wins the binding-constraint count outright.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 7.8% | 5.3% (2022) | 9.3% (2018) | 4.1 | $6,984 | $751 | 45,834 | 13,275 |
| 2 | Pads + condensing dehumidifier | 9.8% | 6.5% (2022) | 11.2% (2018) | 4.7 | $21,801 | $1,618 | 169,546 | 8,252 |
| 3 | Desiccant + evaporative cooling | 10.5% | 7.1% (2022) | 12.0% (2018) | 4.9 | $29,979 | $2,594 | 61,474 | 478,100 |
| 4 | DX / mini-split + dehumidifier | 59.7% | 58.2% (2023) | 61.7% (2018) | 3.5 | $40,353 | $2,173 | 311,981 | 43,768 |
| 5 | Integrated HVAC + reheat (dominated) | 41.4% | 39.8% (2022) | 43.0% (2021) | 3.2 | $43,826 | $1,799 | 336,903 | 60,202 |
| 6 | Liquid-desiccant hybrid (dominated) | 14.3% | 11.1% (2022) | 16.9% (2017) | 5.9 | $46,963 | $2,330 | 368,948 | 13,378 |

**Verdict: DX plus a condensing dehumidifier**, on capability, and it is not close. It is the only strategy within 5 points of the best median attainment, holding the band in 59.7 percent of eligible hours with a worst year of 58.2 percent, at 40,353 dollars a year. The next strategy is 18.2 points behind. The ranking is stable, one order in all ten years.

In plain terms: Miami is where the moisture-only answers fail. A dehumidifier that removes water without removing sensible heat cannot hold a 22 C, 19 C dew point band when the air outside is 31 C at a 26.6 C dew point: pads plus a dehumidifier reach 9.8 percent of hours, and spending 29,979 dollars a year on desiccant regeneration reaches 10.5 percent. Both are beaten nearly six to one by the strategy that also does sensible cooling. If you take one number from this document, take this pair: 59.7 percent against 10.5 percent for 35 percent more money. And note that 59.7 percent is the second-lowest best case of the five sites, above only Phoenix's 56.5 percent; at this band Miami is a hard site, and the honest next move is to revisit the band, the envelope and the crop targets rather than to shop for a bigger machine.

## Denver, CO (80202), cold-dry at altitude

Denver is the heating case: 6,702 hours a year below the band's heating threshold against a 33.66 C design dry bulb, and it is dry, a 12.88 C coincident wet bulb and a 12.21 C mean summer wet bulb, the lowest of the five. Station pressure of 76 to 80 kPa at this source elevation is why the site is bundled: every psychrometric quantity here depends on the pressure path.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 42.0% | 39.8% (2019) | 44.2% (2025) | 4.3 | $25,225 | $1,884 | 43,844 | 414,336 |
| 2 | Pads + condensing dehumidifier | 68.9% | 68.1% (2022) | 69.8% (2019) | 1.8 | $26,616 | $2,279 | 69,090 | 374,350 |
| 3 | DX / mini-split + dehumidifier | 69.5% | 68.8% (2022) | 70.6% (2019) | 1.8 | $28,310 | $2,204 | 82,500 | 375,998 |
| 4 | Desiccant + evaporative cooling (dominated) | 68.2% | 67.2% (2022) | 69.0% (2019) | 1.8 | $28,249 | $2,532 | 43,765 | 479,635 |
| 5 | Liquid-desiccant hybrid (dominated) | 66.2% | 65.0% (2022) | 66.9% (2017) | 1.9 | $32,667 | $3,546 | 96,769 | 434,388 |
| 6 | Integrated HVAC + reheat (dominated) | 60.4% | 58.4% (2022) | 61.8% (2017) | 3.5 | $34,028 | $3,167 | 103,903 | 448,920 |

**Verdict: not resolved.** Four strategies sit inside the capability tier within 1.3 points of each other (68.2 to 69.5 percent), and the two cheapest of them, pads plus a condensing dehumidifier at 26,616 dollars and desiccant with evaporative cooling at 28,249 dollars, are 6.1 percent apart, well inside the 16 percent reorder band. The cost ranking is also **not stable** here, the weakest of the five: 2 distinct orders over ten years with the most common holding in only 6 of 10, and the swap is exactly between DX and desiccant, the third and fourth rows. What would resolve it: leaf area and transpiration, the as-built envelope, then capital and maintenance.

In plain terms: at Denver the cooling problem is nearly absent. There are 1,072.5 pad-effective hours, zero temperature-limited hours in a median year, and only 63.3 moisture-limited ones, so once you have any moisture removal at all you are at 68 percent of hours and the remaining misses are heating and light, not cooling. The whole question is which cheap moisture path you buy, and this evidence does not separate them: a 1,633 dollar annual difference between a dehumidifier and a desiccant is smaller than the error the model's own assumptions can produce. Two observations that do survive: everything above row 2 is buying almost nothing (26.9 points for 1,391 dollars is the pad-to-dehumidifier step, and nothing after it buys more than 0.6 points), and the integrated HVAC option is the worst of both worlds here, 8.5 points below the cheapest tier member at 28 percent more cost, because reheat is a poor answer to air that is already dry.

## Seattle, WA (98104), cool-marine

Seattle is the mildest of the five and the easiest band to hold: 7,273 hours a year below the heating threshold, a 28.38 C design dry bulb, and a 14.84 C mean summer wet bulb. Almost no cooling demand, 84 pad-effective hours and 27.0 temperature-limited hours in a median year, but 691.1 moisture-limited hours from marine air.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 43.2% | 41.2% (2022) | 48.2% (2016) | 7.0 | $34,103 | $2,822 | 78,717 | 527,228 |
| 2 | Pads + condensing dehumidifier | 68.2% | 65.3% (2017) | 71.0% (2016) | 5.6 | $35,668 | $2,118 | 131,775 | 419,384 |
| 3 | Desiccant + evaporative cooling | 85.0% | 82.6% (2021) | 86.6% (2025) | 4.0 | $40,137 | $2,081 | 78,371 | 662,431 |
| 4 | DX / mini-split + dehumidifier | 87.1% | 85.6% (2021) | 87.8% (2019) | 2.3 | $43,255 | $2,551 | 167,260 | 495,649 |
| 5 | Liquid-desiccant hybrid (dominated) | 82.4% | 80.9% (2021) | 84.5% (2025) | 3.7 | $51,044 | $2,981 | 215,886 | 541,926 |
| 6 | Integrated HVAC + reheat (dominated) | 67.2% | 65.2% (2017) | 68.8% (2016) | 3.5 | $53,100 | $2,815 | 207,053 | 611,446 |

**Verdict: not resolved.** Desiccant with evaporative cooling at 85.0 percent and 40,137 dollars, and DX with a dehumidifier at 87.1 percent and 43,255 dollars, are 2.1 attainment points and 7.8 percent of cost apart. Both are inside the resolution of this evidence, on both axes at once. The cost ranking is stable, one order in all ten years, and desiccant is the cheapest member of the capability tier in 10 of 10 years, which is a real finding about reproducibility and still not a recommendation. What would resolve it: the same two measurements, plus the capital and maintenance comparison between a desiccant train and a DX plant.

In plain terms: Seattle is the site where this band is nearly free. The highest attainment of the five (87.1 percent) is reached here, and even the pad baseline holds the band 43.2 percent of the time. The interesting column is fuel: the desiccant option burns 662,431 kWh of fuel against DX's 495,649, while using less than half the electricity (78,371 against 167,260). That is not a tie in any real sense, it is a fuel-versus-electricity choice that a local tariff decides, and this study prices both at one declared rate at every site, so it cannot decide it. That is the honest reason the verdict stays open here.

## What ten observed years can and cannot support

**Can support.** Ten complete calendar years at one site, each 8,760 or 8,784 hours with no missing weather or solar hour, is enough to say what the weather did over that decade and how much the answer moved between the years in it. The attainment spread columns above are that: at Tulsa the pad baseline's attainment ranged over 7.7 points between 2019 and 2017, which is a measurement of how much a single weather year can mislead. Ten years also supports a ranking-stability statement, because a ranking either held in the ten years or it did not, and it supports a pooled design condition over 87,672 hours rather than one year's tail.

**Cannot support.** These ten years are ten particular years, not a sample drawn from a stationary distribution. The worst-to-best spread is what happened; it is not a forecast, not a confidence interval, not a probability that a cost lands in a range, and not a design year. Nothing in `regional-study.json` supports a statement of the form "cost is 27,000 dollars plus or minus 5,000 with 95 percent confidence", and the file's own notes say so. Three further limits:

- **A climate normal is 30 years, not 10.** The current WMO standard period is 1991 to 2020 (see [CLIMATES.md](CLIMATES.md) for the reference), so a decade measures a decade. A trend fitted to ten years of one grid cell is not a climate trend, which is why the study reports medians and spreads and no trend line.
- **This is gridded reanalysis at a ZIP centroid, not a measured facility site.** No station observed these hours. A MERRA-2 cell is tens of kilometres across, so the design conditions here are cell values, not site values, and a real project needs its own site data before sizing anything.
- **The uncertainty that dominates is not weather-year uncertainty.** The Morris screening moves attainment by 9.10 points over the leaf-area range and cost by 3,248 dollars over the sampled days, against a weather-year attainment spread of 1.8 to 7.9 points here. Running more weather years narrows the smaller of the two uncertainties. Measuring the crop and the envelope narrows the larger one. That ordering is why three of these five verdicts stay open, and it is the concrete next step at any of these sites.

Evidence tier: assumption-based screening, tier 2 of [EVALUATION.md](EVALUATION.md). No independent model benchmark, no site calibration, no equipment performance maps and no named product stand behind any number in this document.

## Reproduce

```sh
node scripts/regional-study.mjs                              # the committed run: 5 sites, 10 years, 6 strategies
node scripts/regional-study.mjs --sites denver --years 2024,2025 --out /tmp/quick.json
node scripts/regional-study.mjs --json                       # the artifact on stdout as well as --out
node --test test/regional.test.mjs                           # contract tests over the committed artifact
```

The run is deterministic: no sampling, no PRNG and no wall-clock input to any number, so identical inputs give byte-identical output apart from `generatedAt` and `runtimeSeconds`. Worker threads buy wall time only (`--concurrency`, default one less than available parallelism, capped at 8); each site-year is evaluated independently and results are re-ordered by site and year before any statistic is computed, so the thread count cannot change a value. The committed run took 138.8 s for 300 full-year simulations on 8 threads.

`docs/regional-study.json` carries more than this document quotes: per-year attainment, cost, electricity and fuel for every strategy at every site (`regions[].perYear`), the per-year weather counts (`regions[].weather.perYear`), the per-year cost order used for the stability verdict (`regions[].costOrderByYear`), and the full method notes.
