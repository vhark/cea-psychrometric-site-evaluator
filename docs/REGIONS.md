# Regional verdicts: what ten observed years actually recommend

Purpose: say, per bundled climate, what the weather gives for free, what constraint binds, which equipment class the ten committed weather years support, and where the evidence does not support a choice at all.

Status: executed 2026-09-14 for model `0.2.0-screening`. Measured run: [regional-study.json](regional-study.json), six sites by ten weather years (2016 to 2025) by the six canonical strategies of [example-scenarios.json](example-scenarios.json), 360 full-year simulations at a 1-minute control step, 281.7 s on 8 worker threads. Every number below is read from that file, which `scripts/regional-study.mjs` computes from the committed NASA POWER snapshots in `data/weather`.

Read this if: you are choosing an equipment class for a climate like one of these six, or you want to see what a ten-year screen can and cannot settle.

## The short version

| Site | Climate | Cooling-side constraint | Best attainment | Verdict at this evidence tier | Cost margin | Ranking stable |
| --- | --- | --- | ---: | --- | ---: | --- |
| Tulsa, OK | humid subtropical | moisture | 71.5% | **DX + dehumidifier**, alone in the capability tier | n/a | No (2 orders, 8 of 10) |
| Phoenix, AZ | hot-dry | temperature | 56.5% | **Not resolved**: DX or integrated HVAC | 12.1% | Yes (1 order, 10 of 10) |
| Miami, FL | hot-humid | moisture | 59.7% | **DX + dehumidifier**, alone in the capability tier | n/a | Yes (1 order, 10 of 10) |
| Denver, CO | cold-dry at altitude | moisture | 69.5% | **Not resolved**: pads plus dehumidifier, or desiccant | 6.1% | No (2 orders, 6 of 10) |
| Seattle, WA | cool-marine | moisture | 87.1% | **Not resolved**: desiccant or DX | 7.8% | Yes (1 order, 10 of 10) |
| Fairbanks, AK | subarctic, light-limited | moisture | 64.0% | **Desiccant + evaporative cooling**, alone in the capability tier | n/a | No (2 orders, 5 of 10) |

Three of the six regions do not resolve. That is the result, not a failure to reach one: in those three, Phoenix, Denver and Seattle, the cheapest two strategies that hold the band equally well sit inside the cost band the Morris screening ([SENSITIVITY.md](SENSITIVITY.md)) shows the screened parameter ranges can reorder, so this evidence tier does not name a winner. The three that do resolve, Tulsa, Miami and Fairbanks, resolve on **capability**, not on cost: one strategy holds the joint band far better than every alternative, and at each of the three it is also the most expensive of the four cheapest.

## The weather side, measured

Medians over the ten years, from the weather-side screen at the example band (22 C day, 18 C night, 2 K tolerance, 19 C maximum dew point). Design conditions are the value exceeded in 0.4 percent of the pooled 87,672 hours, with the coincident state of that same hour.

| Site | Pad-effective h | Free-cooling h | Heating h | Moisture-limited h | Temperature-limited h | Design dry bulb (C) | Coincident wet bulb (C) | Design dew point (C) | Mean summer wet bulb (C) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tulsa, OK | 205 | 342 | 4,491.5 | 1,832.8 | 1,258.4 | 39.04 | 24.76 | 25.19 | 22.45 |
| Phoenix, AZ | 2,274 | 2,577.5 | 3,257 | 773.2 | 1,364.6 | 44.87 | 21.56 | 21.82 | 18.56 |
| Miami, FL | 21 | 129.5 | 225.5 | 3,903.7 | 3,495.2 | 31.31 | 25.92 | 26.58 | 25.66 |
| Denver, CO | 1,072.5 | 1,349 | 6,702 | 63.3 | 0.0 | 33.66 | 12.88 | 13.99 | 12.21 |
| Seattle, WA | 84 | 243.5 | 7,273 | 691.1 | 27.0 | 28.38 | 21.30 | 18.71 | 14.84 |
| Fairbanks, AK | 10 | 87.5 | 8,348 | 165.4 | 0.6 | 23.63 | 18.41 | 16.81 | 11.86 |

Two of these columns need reading carefully:

- **Heating hours are counted against this band's own heating threshold**, 20 C by day and 16 C by night, so hours below it are plentiful everywhere except Miami and the heating count is the largest of the three at five of the six sites. That says the band is cool, not that Phoenix is a heating climate. The comparison that separates one warm climate from another is the cooling-side one, **moisture-limited against temperature-limited**, which is why the summary table above reports that instead.
- **Moisture-limited and temperature-limited hours carry decimals** because the pad-ineffective hours are split between the two causes in the proportion the pad-failure flags observed, as `bindingConstraint` in `src/metrics.js` does. They are mean hours per year, not integer event counts.

Pad-effective hours are the clearest single discriminator in the table: 2,274 hours a year at Phoenix against 21 at Miami and 10 at Fairbanks, a factor of 227 between the widest and the narrowest evaporative window at the same crop band. Free cooling follows it.

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
| 1 | Pad + vent baseline | 28.0% | 22.6% (2019) | 30.3% (2017) | 7.7 | $22,171 | $3,013 | 59,330 | 310,678 |
| 2 | Pads + condensing dehumidifier | 42.7% | 39.1% (2019) | 45.4% (2017) | 6.2 | $27,731 | $5,135 | 123,976 | 259,973 |
| 3 | Desiccant + evaporative cooling | 52.3% | 50.5% (2018) | 56.2% (2020) | 5.8 | $32,579 | $7,043 | 63,237 | 532,465 |
| 4 | DX / mini-split + dehumidifier | 71.5% | 68.9% (2022) | 74.4% (2020) | 5.4 | $38,950 | $6,665 | 201,828 | 308,219 |
| 5 | Liquid-desiccant hybrid (dominated) | 52.6% | 51.0% (2018) | 56.9% (2020) | 5.9 | $45,387 | $10,623 | 244,123 | 321,069 |
| 6 | Integrated HVAC + reheat (dominated) | 55.3% | 51.6% (2019) | 58.0% (2017) | 6.5 | $46,064 | $7,795 | 239,813 | 369,440 |

**Verdict: DX plus a condensing dehumidifier**, on capability. It is the only strategy within 5 points of the best median attainment, holding the joint band in 71.5 percent of eligible hours with a worst year of 68.9 percent, at 38,950 dollars of median annual operating cost. The next strategy is 16.1 points behind. The cost ranking is **not stable** (2 distinct orders over the ten years, the most common holding in 8 of 10), but the instability is confined to the two most expensive strategies swapping places, and DX is the cheapest member of the capability tier in 10 of 10 years.

In plain terms: at Tulsa the pad is cheap and does not work. It runs, but the weather clears both the temperature margin and the moisture ceiling in only 205 hours a year, so a pad-only house sits inside the joint band 28 percent of the time. Adding a condensing dehumidifier buys 14.6 points for 5,560 dollars a year. Adding real mechanical cooling on top buys another 28.8 points, and that is the step that changes what the facility can promise a buyer. The cheaper options are not close substitutes; they are a different product with a wider band. Note the pad baseline's 7.7-point attainment spread across the ten years, the largest of the six here: the less equipment you install, the more your year depends on the weather you happen to get.

## Phoenix, AZ (85004), hot-dry

Phoenix is the hottest of the six, with a 44.87 C design dry bulb that arrives at only a 21.56 C coincident wet bulb, a 23.31 K wet-bulb depression and the driest design hour in the bundle, and 2,274 pad-effective hours a year, eleven times Tulsa's. It is also the only one of the six where the cooling-side constraint is **temperature** rather than moisture: 1,364.6 temperature-limited hours against 773.2 moisture-limited ones.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 45.8% | 41.5% (2022) | 48.4% (2017) | 6.9 | $14,720 | $2,343 | 35,648 | 164,992 |
| 2 | Pads + condensing dehumidifier | 49.1% | 44.9% (2022) | 52.7% (2019) | 7.7 | $15,809 | $1,612 | 46,634 | 157,356 |
| 3 | Desiccant + evaporative cooling | 50.2% | 46.2% (2022) | 54.1% (2019) | 7.9 | $16,452 | $1,632 | 36,277 | 196,779 |
| 4 | DX / mini-split + dehumidifier | 56.5% | 53.6% (2020) | 58.6% (2019) | 5.0 | $23,900 | $2,003 | 113,205 | 163,828 |
| 5 | Liquid-desiccant hybrid (dominated) | 44.3% | 43.1% (2024) | 48.7% (2019) | 5.6 | $18,704 | $3,268 | 60,493 | 166,547 |
| 6 | Integrated HVAC + reheat (dominated) | 56.5% | 54.7% (2020) | 58.7% (2019) | 4.0 | $26,791 | $2,831 | 132,887 | 174,899 |

**Verdict: not resolved.** DX at 23,900 dollars and integrated HVAC with reheat at 26,791 dollars both hold the band in 56.5 percent of eligible hours, and 12.1 percent of cost is inside the 16 percent band where the screened parameter ranges reorder strategies. Nothing here says which is cheaper at a real Phoenix site. What would resolve it: measuring canopy leaf area and transpiration and the as-built envelope U-value, the two parameters the Morris screening ranks first and second on cost, then comparing capital, maintenance and redundancy, none of which this model carries. The cost ranking itself is stable, one order in all ten years, which is worth noting: the order is reproducible, and it is still not decisive, because stability across weather years says nothing about robustness to the assumptions.

In plain terms: Phoenix is the one site where the cheap equipment is genuinely competent. The pad baseline holds the band 45.8 percent of the time for 14,720 dollars a year, and the whole 10.7-point climb to 56.5 percent costs 9,180 dollars a year more. Also read row 5: the liquid-desiccant hybrid costs 27 percent more than the pad baseline and attains 1.6 points **less**, which is what dominance means. Dry air is a poor market for a machine that sells dryness.

## Miami, FL (33101), hot-humid

Miami is the mirror image of Phoenix: the design dry bulb is only 31.31 C but it arrives with a 25.92 C coincident wet bulb, and the mean summer wet bulb of 25.66 C is above Phoenix's 0.4 percent design wet bulb. Evaporative cooling has almost nothing to work with, 21 pad-effective hours a year, and the 3,903.7 moisture-limited hours make this the only site where moisture wins the binding-constraint count outright.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 7.8% | 5.3% (2022) | 9.3% (2018) | 4.1 | $6,985 | $750 | 45,847 | 13,275 |
| 2 | Pads + condensing dehumidifier | 9.8% | 6.5% (2022) | 11.2% (2018) | 4.7 | $21,803 | $1,618 | 169,560 | 8,252 |
| 3 | Desiccant + evaporative cooling | 10.5% | 7.1% (2022) | 12.0% (2018) | 4.9 | $29,981 | $2,594 | 61,487 | 478,105 |
| 4 | DX / mini-split + dehumidifier | 59.7% | 58.2% (2023) | 61.7% (2018) | 3.5 | $40,354 | $2,173 | 311,995 | 43,758 |
| 5 | Integrated HVAC + reheat (dominated) | 41.4% | 39.8% (2022) | 43.0% (2021) | 3.2 | $43,827 | $1,798 | 336,915 | 60,194 |
| 6 | Liquid-desiccant hybrid (dominated) | 14.3% | 11.1% (2022) | 16.9% (2017) | 5.9 | $46,962 | $2,329 | 368,939 | 13,376 |

**Verdict: DX plus a condensing dehumidifier**, on capability, and it is not close. It is the only strategy within 5 points of the best median attainment, holding the band in 59.7 percent of eligible hours with a worst year of 58.2 percent, at 40,354 dollars a year. The next strategy is 18.2 points behind. The ranking is stable, one order in all ten years.

In plain terms: Miami is where the moisture-only answers fail. A dehumidifier that removes water without removing sensible heat cannot hold a 22 C, 19 C dew point band when the air outside is 31 C at a 26.6 C dew point: pads plus a dehumidifier reach 9.8 percent of hours, and spending 29,981 dollars a year on desiccant regeneration reaches 10.5 percent. Both are beaten nearly six to one by the strategy that also does sensible cooling. If you take one number from this document, take this pair: 59.7 percent against 10.5 percent for 35 percent more money. And note that 59.7 percent is the second-lowest best case of the six sites, above only Phoenix's 56.5 percent; at this band Miami is a hard site, and the honest next move is to revisit the band, the envelope and the crop targets rather than to shop for a bigger machine.

## Denver, CO (80202), cold-dry at altitude

Denver is a heating case: 6,702 hours a year below the band's heating threshold against a 33.66 C design dry bulb, and it is dry, a 12.88 C coincident wet bulb and a 12.21 C mean summer wet bulb, the second lowest of the six, above only Fairbanks's 11.86 C. Station pressure of 76 to 80 kPa at this source elevation is why the site is bundled: every psychrometric quantity here depends on the pressure path.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 42.0% | 39.8% (2019) | 44.2% (2025) | 4.3 | $25,227 | $1,886 | 43,866 | 414,314 |
| 2 | Pads + condensing dehumidifier | 68.9% | 68.0% (2022) | 69.8% (2019) | 1.8 | $26,617 | $2,281 | 69,104 | 374,324 |
| 3 | DX / mini-split + dehumidifier | 69.5% | 68.8% (2022) | 70.6% (2019) | 1.8 | $28,312 | $2,206 | 82,521 | 375,997 |
| 4 | Desiccant + evaporative cooling (dominated) | 68.2% | 67.2% (2022) | 69.0% (2019) | 1.8 | $28,251 | $2,533 | 43,787 | 479,623 |
| 5 | Liquid-desiccant hybrid (dominated) | 66.2% | 65.0% (2022) | 66.9% (2017) | 1.9 | $32,668 | $3,544 | 96,780 | 434,375 |
| 6 | Integrated HVAC + reheat (dominated) | 60.4% | 58.4% (2022) | 61.8% (2017) | 3.5 | $34,027 | $3,163 | 103,910 | 448,905 |

**Verdict: not resolved.** Four strategies sit inside the capability tier, spanning 3.3 points of median attainment (66.2 to 69.5 percent), and the two cheapest of them, pads plus a condensing dehumidifier at 26,617 dollars and desiccant with evaporative cooling at 28,251 dollars, are 6.1 percent apart, well inside the 16 percent reorder band. The cost ranking is also **not stable** here, the second weakest of the six behind Fairbanks: 2 distinct orders over ten years with the most common holding in only 6 of 10, and the swap is exactly between DX and desiccant, the third and fourth rows. What would resolve it: leaf area and transpiration, the as-built envelope, then capital and maintenance.

In plain terms: at Denver the cooling problem is nearly absent. There are 1,072.5 pad-effective hours, zero temperature-limited hours in a median year, and only 63.3 moisture-limited ones, so once you have any moisture removal at all you are at 68 percent of hours and the remaining misses are heating and light, not cooling. The whole question is which cheap moisture path you buy, and this evidence does not separate them: a 1,634 dollar annual difference between a dehumidifier and a desiccant is smaller than the error the model's own assumptions can produce. Two observations that do survive: everything above row 2 is buying almost nothing (26.9 points for 1,391 dollars is the pad-to-dehumidifier step, and nothing after it buys more than 0.6 points), and the integrated HVAC option is the worst of both worlds here, 8.5 points below the cheapest tier member at 28 percent more cost, because reheat is a poor answer to air that is already dry.

## Seattle, WA (98104), cool-marine

Seattle is the easiest band to hold of the six: 7,273 hours a year below the heating threshold, a 28.38 C design dry bulb, and a 14.84 C mean summer wet bulb. Almost no cooling demand, 84 pad-effective hours and 27.0 temperature-limited hours in a median year, but 691.1 moisture-limited hours from marine air.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 43.2% | 41.2% (2022) | 48.2% (2016) | 7.0 | $34,106 | $2,821 | 78,749 | 527,196 |
| 2 | Pads + condensing dehumidifier | 68.2% | 65.3% (2017) | 71.0% (2016) | 5.6 | $35,671 | $2,118 | 131,806 | 419,352 |
| 3 | Desiccant + evaporative cooling | 85.0% | 82.6% (2021) | 86.6% (2025) | 4.0 | $40,139 | $2,081 | 78,403 | 662,396 |
| 4 | DX / mini-split + dehumidifier | 87.1% | 85.6% (2021) | 87.8% (2019) | 2.3 | $43,255 | $2,552 | 167,291 | 495,631 |
| 5 | Liquid-desiccant hybrid (dominated) | 82.4% | 80.9% (2021) | 84.6% (2025) | 3.7 | $51,046 | $2,987 | 215,913 | 541,931 |
| 6 | Integrated HVAC + reheat (dominated) | 67.2% | 65.2% (2017) | 68.8% (2016) | 3.6 | $53,102 | $2,819 | 207,084 | 611,429 |

**Verdict: not resolved.** Desiccant with evaporative cooling at 85.0 percent and 40,139 dollars, and DX with a dehumidifier at 87.1 percent and 43,255 dollars, are 2.1 attainment points and 7.8 percent of cost apart. Both are inside the resolution of this evidence, on both axes at once. The cost ranking is stable, one order in all ten years, and desiccant is the cheapest member of the capability tier in 10 of 10 years, which is a real finding about reproducibility and still not a recommendation. What would resolve it: the same two measurements, plus the capital and maintenance comparison between a desiccant train and a DX plant.

In plain terms: Seattle is the site where this band is nearly free. The highest attainment of the six (87.1 percent) is reached here, and even the pad baseline holds the band 43.2 percent of the time. The interesting column is fuel: the desiccant option burns 662,396 kWh of fuel against DX's 495,631, while using less than half the electricity (78,403 against 167,291). That is not a tie in any real sense, it is a fuel-versus-electricity choice that a local tariff decides, and this study prices both at one declared rate at every site, so it cannot decide it. That is the honest reason the verdict stays open here.

## Fairbanks, AK (99701), subarctic, light-limited

Fairbanks is the cold end of the bundle: 8,348 hours a year below the band's heating threshold, 95.2 percent of an average year's 8,767 hours, against a 23.63 C design dry bulb, the lowest of the six. The design hour is also the closest to saturation of the six, an 18.41 C coincident wet bulb only 5.22 K below its own dry bulb, so the little cooling this site does need cannot come out of a pad: 10 pad-effective hours and 87.5 free-cooling hours a year, both the fewest of the six. The cooling-side constraint is still moisture, 165.4 moisture-limited hours a year against 0.6 temperature-limited ones, and the mean summer wet bulb of 11.86 C is the lowest of the six.

| Rank | Strategy | Attainment median | Worst year | Best year | Spread (pts) | Cost median | Cost spread | Electricity (kWh) | Fuel (kWh) |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Pad + vent baseline | 26.8% | 23.1% (2023) | 28.0% (2018) | 4.9 | $47,390 | $3,101 | 96,937 | 784,897 |
| 2 | Pads + condensing dehumidifier | 43.3% | 40.6% (2021) | 46.6% (2016) | 6.0 | $51,611 | $3,153 | 162,687 | 696,657 |
| 3 | DX / mini-split + dehumidifier | 56.1% | 52.1% (2021) | 61.2% (2025) | 9.2 | $55,900 | $2,349 | 181,625 | 741,447 |
| 4 | Desiccant + evaporative cooling | 64.0% | 59.6% (2021) | 69.7% (2025) | 10.1 | $58,752 | $2,961 | 96,481 | 1,029,915 |
| 5 | Integrated HVAC + reheat (dominated) | 40.6% | 35.9% (2023) | 43.4% (2016) | 7.5 | $58,979 | $3,145 | 171,664 | 837,477 |
| 6 | Liquid-desiccant hybrid (dominated) | 56.2% | 52.0% (2021) | 61.0% (2025) | 9.0 | $73,064 | $4,511 | 296,231 | 817,105 |

**Verdict: desiccant plus evaporative cooling**, on capability. It is the only strategy within 5 points of the best median attainment, holding the joint band in 64.0 percent of eligible hours with a worst year of 59.6 percent, at 58,752 dollars of median annual operating cost. The next strategy is 7.8 points behind. The cost ranking is **not stable**, and it is the weakest of the six: 2 distinct orders over the ten years, with neither holding in more than 5 of 10. The swap is between the recommended desiccant train and integrated HVAC with reheat, rows 4 and 5, whose median costs are 228 dollars apart, 0.4 percent, so which of them is the fourth cheapest is decided by the weather year. That instability is about the order of the list, not about the verdict: desiccant is the cheapest member of the capability tier in 10 of 10 years, and it is the only member.

In plain terms: at Fairbanks nothing outside is ever warm enough to be the problem. The house is below the band's heating threshold for 95 percent of the year, temperature-limited hours are 0.6 a year, and the moisture that has to leave is mostly the crop's own transpiration into air too cold to vent. That is the case a desiccant path suits, and the measured columns are consistent with it: the desiccant option removes water on a sorbent rather than on a cold coil, and it spends its regeneration heat inside a building that wants heat almost every hour of the year. It attains 64.0 percent while drawing the least electricity of the six here, 96,481 kWh, below even the pad baseline's 96,937, and burning the most fuel of any strategy at any site in this study, 1,029,915 kWh. The ladder up to it is steep and each rung is cheap relative to the last: the pad baseline holds the band 26.8 percent of the time, a condensing dehumidifier buys 16.5 points for 4,220 dollars a year, DX buys 12.8 more for 4,290, and the desiccant train buys the last 7.8 points for 2,851. Read the verdict as a bet on fuel: at the declared 0.045 USD/kWh, fuel is 78.8 percent of the desiccant option's median annual operating cost against 59.8 percent of DX's, and the study prices fuel and electricity at one declared rate at every site, so a real Fairbanks tariff can move the cost column even though it cannot move the attainment column. Two honest limits. First, everything here is dear: the cheapest strategy at Fairbanks costs 47,390 dollars a year, 39 percent more than the cheapest at Seattle, the next dearest site, so this climate raises the floor before it changes the choice. Second, attainment here scores the joint temperature and moisture band only, the `violation` term in `src/simulate.js`, so light never enters it. Measured over the same ten years at the model's own 2.02 umol/J conversion, outside horizontal daily light integral averages 0.4 mol/m2/day in December against 41.2 in June, a factor of 106, so a house that holds 64 percent of the temperature and moisture band at this latitude can still be light-limited for months, and that limit is the one the climate label names. For where this sits on the control-class ladder, and for the Alaska build decision itself, see [CLASSES.md](CLASSES.md). And the ranking instability is a fair warning about the size of the evidence: the desiccant option's attainment ran from 59.6 percent in 2021 to 69.7 percent in 2025, a 10.1-point swing and the widest weather-year spread of any strategy at any site here, so ten years of one gridded cell names an equipment class at this site and nothing finer.

## What ten observed years can and cannot support

**Can support.** Ten complete calendar years at one site, each 8,760 or 8,784 hours with no missing weather or solar hour, is enough to say what the weather did over that decade and how much the answer moved between the years in it. The attainment spread columns above are that: at Tulsa the pad baseline's attainment ranged over 7.7 points between 2019 and 2017, which is a measurement of how much a single weather year can mislead. Ten years also supports a ranking-stability statement, because a ranking either held in the ten years or it did not, and it supports a pooled design condition over 87,672 hours rather than one year's tail.

**Cannot support.** These ten years are ten particular years, not a sample drawn from a stationary distribution. The worst-to-best spread is what happened; it is not a forecast, not a confidence interval, not a probability that a cost lands in a range, and not a design year. Nothing in `regional-study.json` supports a statement of the form "cost is 27,000 dollars plus or minus 5,000 with 95 percent confidence", and the file's own notes say so. Three further limits:

- **A climate normal is 30 years, not 10.** The current WMO standard period is 1991 to 2020 (see [CLIMATES.md](CLIMATES.md) for the reference), so a decade measures a decade. A trend fitted to ten years of one grid cell is not a climate trend, which is why the study reports medians and spreads and no trend line.
- **This is gridded reanalysis at a ZIP centroid, not a measured facility site.** No station observed these hours. A MERRA-2 cell is tens of kilometres across, so the design conditions here are cell values, not site values, and a real project needs its own site data before sizing anything.
- **The uncertainty that dominates is not weather-year uncertainty.** The Morris screening moves attainment by 9.10 points over the leaf-area range and cost by 3,248 dollars over the sampled days, against a weather-year attainment spread of 1.8 to 10.1 points here. Running more weather years narrows the smaller of the two uncertainties. Measuring the crop and the envelope narrows the larger one. That ordering is why three of these six verdicts stay open, and it is the concrete next step at any of these sites.

Evidence tier: assumption-based screening, tier 2 of [EVALUATION.md](EVALUATION.md). No independent model benchmark, no site calibration, no equipment performance maps and no named product stand behind any number in this document.

## Reproduce

```sh
node scripts/regional-study.mjs                              # the committed run: 6 sites, 10 years, 6 strategies
node scripts/regional-study.mjs --sites denver --years 2024,2025 --out /tmp/quick.json
node scripts/regional-study.mjs --json                       # the artifact on stdout as well as --out
node --test test/regional.test.mjs                           # contract tests over the committed artifact
```

The run is deterministic: no sampling, no PRNG and no wall-clock input to any number, so identical inputs give byte-identical output apart from `generatedAt` and `runtimeSeconds`. Worker threads buy wall time only (`--concurrency`, default one less than available parallelism, capped at 8); each site-year is evaluated independently and results are re-ordered by site and year before any statistic is computed, so the thread count cannot change a value. The committed run took 281.7 s for 360 full-year simulations on 8 threads.

`docs/regional-study.json` carries more than this document quotes: per-year attainment, cost, electricity and fuel for every strategy at every site (`regions[].perYear`), the per-year weather counts (`regions[].weather.perYear`), the per-year cost order used for the stability verdict (`regions[].costOrderByYear`), and the full method notes.
