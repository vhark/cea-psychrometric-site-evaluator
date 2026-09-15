# Example scenario library

Purpose: importable comparison sets that each answer one design question, so the tool can be judged on a real question rather than on defaults. Each set below is written up as a lesson: the decision it informs, the physics behind it, what the measured run actually showed, and the case where the conclusion flips.

Status: 2026-09-15, model `0.2.0-screening`, nine sets. Every set is exercised by `test/examples.test.mjs` on a real weather week and must simulate with zero numerical failures.

Read this if: you want a worked comparison to start from, you want the reasoning behind one of them, or you are adding one.

## How to use

Load a weather record first (the bundled Tulsa example is enough), then **Import JSON / CSV** and pick a file below. Import replaces the scenarios in your workspace, so export anything you want to keep first.

Most sets hold the site, crop band and geometry constant so the comparison isolates the equipment strategy. Two do the opposite on purpose: `crop-bands.json` holds the equipment fixed and varies the crop, and `climate-archetypes.json` holds the whole facility fixed and varies the site.

| Set | Question it answers | What varies | Scenarios |
|---|---|---|---|
| [decoupling-study.json](decoupling-study.json) | Is it cheaper to overcool and reheat, or to handle latent separately? | Strategy | Coupled coil with reheat, dry-neutral DOAS, desiccant with evaporative cooling, liquid-desiccant hybrid |
| [indoor-microgreen-racks.json](indoor-microgreen-racks.json) | What does an opaque indoor rack farm cost when lighting is the whole sensible load? | Strategy | DX with dehumidifier, DOAS, integrated HVAC with reheat |
| [mushroom-room.json](mushroom-room.json) | Can generic equipment hold a near-saturated fruiting band? | Strategy | DX with dehumidifier, integrated HVAC with reheat |
| [propagation-nursery.json](propagation-nursery.json) | When the moisture ceiling binds rather than temperature, what closes the gap? | Strategy | Pad and vent, pads with dehumidifier, DOAS |
| [hybrid-tomato.json](hybrid-tomato.json) | How does a semi-closed house with a tall, high-LAI crop behave? | Strategy | Integrated HVAC with reheat, DOAS, pads with dehumidifier |
| [crop-bands.json](crop-bands.json) | With the equipment fixed, how much does the crop program alone move the answer? | Crop program | Baby-leaf lettuce, basil, propagation seedlings, illustrative tomato |
| [climate-archetypes.json](climate-archetypes.json) | Does the same facility face the same constraint at a different site? | Site | Tulsa, Phoenix, Miami, Denver, Seattle, Fairbanks |
| [screens-and-heat-source.json](screens-and-heat-source.json) | Which days do you want a shade screen or a thermal curtain, and what does swapping fuel for a heat pump do? | Screens and heat source | No screens, light-guarded shade screen, thermal curtain with a declared gap, both, both plus heat pump |
| [closed-and-hybrid-air.json](closed-and-hybrid-air.json) | Can a closed facility still use outside air, and when should a hybrid house shut its curtain and run lamps instead of sunlight? | Outside-air path | Sealed box at 2, 6 and 20 ACH, sealed box plus DOAS, hybrid open, hybrid closed with a light-guarded shade, hybrid closed with an unguarded shade |

The canonical six-strategy comparison used throughout the documentation stays at [../example-scenarios.json](../example-scenarios.json).

Every measured figure on this page is screening output from this repository under declared assumptions, on the bundled Tulsa 2025 record unless another site is named. It is not performance data, and none of it is validated against a real greenhouse.

## The sets, and what each one teaches

### decoupling-study.json: overcool and reheat, or split the latent job

**Decision it informs.** Whether to buy one coil that does both jobs, or two devices that each do one.

**Mechanism.** A cooling coil removes moisture only by driving air below its dew point, so hitting a moisture target with a coil usually means overshooting the temperature target downward and then paying to put sensible heat back. Decoupled equipment attacks the two loads separately: a dry-neutral supply stream or a desiccant removes water without first making the air cold, and a smaller sensible device holds temperature. The trade is that the coupled machine is mostly electric while regeneration and reheat can be fuel, so the comparison is a question about your energy prices as much as about your air.

**What the measured run showed.** The dry-neutral DOAS held the band slightly better than the coupled coil, 56.2% against 55.3%, on 14% less purchased electricity, 211,830 against 246,957 kWh, while shifting load to fuel, 417,969 against 367,295 kWh.

**Counter-case.** The verdict flips with the electricity-to-fuel price ratio, which is an editable input, not a property of the equipment. A 0.9 pp attainment gain bought by moving roughly 50,000 kWh from electricity to fuel is a bargain at some prices and a loss at others, and a site with expensive gas or an electrification constraint should read this set the other way round.

### indoor-microgreen-racks.json: an opaque box where the lights are the load

**Decision it informs.** What the running cost of a closed rack farm looks like once the weather is almost entirely removed from the problem.

**Mechanism.** With zero solar transmission the sensible load is fixture power plus envelope conduction, and fixture power is nearly constant during the photoperiod, so the hourly load is a schedule rather than a weather series. Transpiration then arrives as latent load at the same time. That combination is easy to hold and expensive to run: every joule of light has to be bought first and then removed again.

**What the measured run showed.** The highest attainment anywhere in the library, 93.1% for DX with a dehumidifier, which is what a closed box with no solar gain and generous installed capacity should give. It is also the most electricity-hungry facility in the library: 344,731 kWh for that strategy, and the three rows of this set are the three largest electricity totals of any shipped scenario, up to 393,792 kWh for integrated HVAC with reheat.

**Counter-case.** The high attainment is a statement about installed capacity, not about the design being good. Cut the capacity, or price electricity at a site where it is dear, and the same box becomes the worst option in the library on cost per compliant hour. An opaque envelope also removes the free cooling and free light that make a greenhouse cheap in mild weather, which is exactly what the Seattle and Denver rows in the climate lesson below are about.

### mushroom-room.json: a near-saturated band against generic equipment

**Decision it informs.** Whether generic HVAC classes can be assumed for a fruiting room, or whether purpose-built equipment assumptions are required before any numbers mean anything.

**Mechanism.** A 0.1 to 0.3 kPa VPD target sits within a couple of percent of saturation, so the allowed moisture window is narrow in absolute humidity ratio, and a fruiting crop with a dark cycle produces moisture continuously while producing respiration heat. Equipment that removes water by condensation is working against a very small driving difference at that condition, and the ventilation the room needs for CO2 brings in its own moisture.

**What the measured run showed.** Neither strategy holds the band: 35.9% and 22.0%. This is reported rather than tuned away.

**Counter-case.** The honest reading is not that the strategies failed, it is that the generic capacities and the provisional moisture and respiration inputs are not a mushroom room. Both are flagged in `src/config.js` as provisional. Supply measured block loading, mandatory fresh air and real equipment capacities and this set should be re-run before anyone quotes it.

### propagation-nursery.json: when moisture binds, a pad makes it worse

**Decision it informs.** Whether the evaporative stage that is standard on a vented greenhouse belongs on a high-humidity, low-DLI crop.

**Mechanism.** An evaporative pad trades sensible heat for latent: it cools the incoming air by evaporating water into it, so it lowers dry bulb while raising absolute humidity. If the binding constraint is the dew-point ceiling or the minimum VPD rather than the temperature margin, that trade moves the zone further outside the band while spending fan and pump energy. Decoupled latent removal attacks the constraint that is actually binding.

**What the measured run showed.** The clearest case for decoupling in the library: the DOAS reached 52.7% against 28.2% for pad and vent, because the binding constraint is the moisture ceiling and a pad adds moisture.

**Counter-case.** This is a statement about a moisture-bound climate and a moisture-bound band, not about pads. Run the same nursery at a site with a large wet-bulb depression and the pad becomes a cheap first cooling stage again, which is precisely the Phoenix and Denver result below. The Morris screening makes the same point from the other direction: pad effectiveness ranks last or near last on every metric at Tulsa, because a moisture-limited climate is not fixed by a better pad.

### hybrid-tomato.json: a tall crop in a semi-closed house

**Decision it informs.** Whether the choice between equipment classes is worth the capital difference for a tall, high-transpiration crop in a semi-closed envelope.

**Mechanism.** A high leaf area index and a wide allowed VPD band mean the crop itself is a large, self-regulating moisture source: as the zone dries, transpiration rises and partly refills the moisture the equipment just removed. A semi-closed house with a restricted maximum ventilation rate also keeps the coupling between the zone and the outside weather weaker than in a fully vented house. Both effects compress the differences between equipment classes.

**What the measured run showed.** Attainment sits in a narrow 45.1 to 51.5% band across three very different strategies, so at this crop band the classes are closer than the capital difference between them suggests.

**Counter-case.** A 6.5 pp spread is not a reason to buy the cheapest machine: the classes differ in what they cost to run, in whether that cost is electricity or fuel, and in what happens in the extreme hours rather than the average ones. The tomato crop program is also the illustrative preset, so treat the absolute level as a placeholder. Leaf area and transpiration are the most influential assumption in the whole model, at 9.10 pp of attainment across the screened range, and this is the set where they are largest.

### crop-bands.json: the band changes the bill, not the feasibility

**Decision it informs.** How much of the answer is set by the crop you choose to grow, once the greenhouse and its equipment are already fixed.

**Mechanism.** The target band enters the model in two independent places. The temperature window and the VPD window set how often the zone counts as compliant and how hard the equipment has to work to get there, while the daily light target sets how many photons have to be bought when the sun does not supply them. Those two paths do not have to move together: a warmer, wider band can be easier to hold while being far more expensive to light, and the crop's leaf area and transpiration assumption ride along with the band and change the latent load at the same time.

**What the measured run showed.** Tulsa 2025, identical greenhouse, identical pad-and-vent equipment, only the crop program swapped:

| Crop program | Band | Attainment | Electricity (kWh) | Fuel (kWh) | DLI deficit days | Operating cost |
|---|---|---:|---:|---:|---:|---:|
| Baby-leaf lettuce | 22 C day, VPD 0.6 to 1.0, DLI 14, LAI 3 | 27.1% | 61,123 | 303,230 | 74 | $22,064 |
| Basil | 26 C, VPD 0.8 to 1.2, DLI 29, LAI 3 | 21.4% | 123,791 | 373,841 | 317 | $32,743 |
| Propagation seedlings | 23 C, VPD 0.4 to 0.8, DLI 10, LAI 1 | 24.4% | 42,987 | 231,719 | 25 | $16,210 |
| Fruiting tomato (illustrative) | 26 C, VPD 0.8 to 1.4, DLI 25, LAI 3.5 | 24.2% | 107,424 | 398,371 | 259 | $31,947 |

With the equipment held fixed, attainment moves only 5.7 points across four very different crops, 21.4 to 27.1, while operating cost moves by a factor of 2.0, $16,210 to $32,743, and DLI deficit days move by a factor of 12.7, 25 to 317. At this site the crop band barely changes whether the equipment can hold the band, but it dominates what running it costs, and most of that cost difference is light, not HVAC.

**Counter-case.** The tomato entry is the illustrative preset, so treat its absolute figures as a placeholder rather than a tomato result. And this near-indifference of attainment to the band is a Tulsa finding: a site where cooling rather than heating dominates would likely show the band mattering more to attainment than it does here, because a warmer target band buys real relief when the problem is rejecting heat and buys nothing when the problem is supplying it.

### climate-archetypes.json: the same house, six climates

**Decision it informs.** Whether a design, or a piece of received wisdom about equipment, transfers from one site to another.

**Mechanism.** The facility fixes the loads per degree and per gram; the weather fixes which of those loads actually occurs. An evaporative pad can only deliver the wet-bulb depression the air already has, free cooling only exists in hours when outside air is both cool enough and dry enough, and heating hours are set by how long the outside sits below the band. None of those three quantities is a property of the equipment.

**What the measured run showed.** See the climate lesson below, which is the reason this set exists.

**Counter-case.** These are single-year runs at six sites with ten bundled years each, and one year is not a climate normal, so the ordering between two similar sites can be a property of the year. The set is also only the facility half of a site comparison: it carries the site fields, and you still have to load each site's weather record before running its scenario. Running a Phoenix scenario against the Tulsa record reports Tulsa under a Phoenix name.

### screens-and-heat-source.json: a curtain buys fuel and spends humidity

**The decision it informs.** Whether to add movable shade, a thermal curtain, or both, and whether to heat with fuel or a heat pump. These are the classic greenhouse upgrades, and each one is a schedule rather than a capacity: the question is not whether to own the screen but on which hours to close it.

**The mechanism.** A shade screen multiplies incoming shortwave and PAR by the same factor unless you supply product spectra, so every joule of solar heat it keeps out is also crop light it takes away. That is why the screen in this set is light-guarded: it refuses to close when the crop is still short of its daily light target. A thermal curtain multiplies the envelope loss coefficient when it is shut, which is pure benefit for heating, except that a shut curtain also restricts the outside-air path that was carrying crop moisture away. A heat pump replaces fuel with electricity at a temperature-dependent COP, so it trades a fuel bill for an electricity bill and a cold-hour capacity derate.

**What the measured run showed.** Tulsa 2025, one greenhouse, pad and vent, staged control.

| Configuration | Attainment | Electricity kWh | Fuel kWh | Screen hours | Attributed effect |
|---|---|---|---|---|---|
| Baseline, no screens, fuel heat | 27.14% | 61,123 | 303,230 | none | reference |
| Shade screen, light-guarded | 28.89% | 60,958 | 306,500 | 970 h shade | gave up 1,051 mol/m² of crop light |
| Thermal curtain, 0.1 h⁻¹ declared gap | 22.24% | 60,798 | 236,653 | 1,179 h curtain | saved 59,919 kWh of delivered heat |
| Both screens | 23.98% | 60,633 | 239,920 | 970 h + 1,179 h | both effects, partly cancelling |
| Both plus heat pump | 23.75% | 127,251 | 0 | 970 h + 1,179 h | all heat moved to electricity |

The curtain is the result worth staring at. It cut fuel by 22% and cost 4.9 points of attainment at the same time, because restricting the outside-air path while the crop keeps transpiring traps moisture in the zone. The tool reports both halves of that trade rather than only the saving, which is the entire reason to schedule a curtain by outdoor moisture and not only by outdoor temperature. The shade screen is the mirror image: guarded, it bought 1.75 points of attainment for essentially no energy change, because it removed solar heat in hours the crop could spare the light. Ungated, the same screen closes for 1,867 hours and pushes lighting energy up by 17,834 kWh against the no-screen baseline, to replace the photons it just blocked.

**The counter-case.** Every number here is configuration-dependent in ways that flip the conclusion. The 0.1 h⁻¹ closed-gap exchange is a user input, not a sourced value: screen-gap leakage is UNSOURCED in [COMPONENT-PARAMETERS.md](../COMPONENT-PARAMETERS.md), and leaving it null makes the run warn that the moisture case is optimistic. The heat-pump rating points in this file are a labeled hypothetical, since only the eligibility floors are sourced (COP 1.75 at -15 C, 0.70 capacity derate), so whether the heat pump is cheaper than fuel depends entirely on your electricity-to-fuel price ratio and on rating points from a catalogued unit. In a cooling-dominated climate the shade screen would carry the set and the curtain would be close to irrelevant, which is the point [climate-archetypes.json](climate-archetypes.json) makes.

### closed-and-hybrid-air.json: a closed box that breathes, a hybrid house that stops

**Decision it informs.** Whether a sealed indoor room should be given a designed outside-air path instead of the leakage its template ships with, and whether a hybrid house that already owns lamps should shut its curtain and shade rather than run on daylight. Both were always representable as inputs, and neither was exercised by anything shipped, which is how the cheapest closed configuration stayed invisible.

**Mechanism.** Ventilation is a moisture sink whose capacity comes from the difference between outside and inside air rather than from a machine rating, so at -20 C, where outside air holds almost no water, exchanging air is nearly free drying. A condensing dehumidifier cannot substitute for it, because it cannot dry below its own coil dew point. The shipped opaque facility templates cap maximum exchange at 2 ACH, which represents shell leakage rather than a designed economizer, so a box left on its defaults is held away from its cheapest drying path. The hybrid question is the mirror image: a roof delivers light and heat together, so drawing the shade and shutting the curtain removes solar gain and restricts the air path in the same move, and lamps at 2.5 umol/J can buy the lost photons back. Whether that trade pays depends on whether the house is fighting a cooling load or a heating load.

**What the measured run showed.** Fairbanks, AK, calendar year 2025, 500 m2 floor, 4 m height, baby-leaf lettuce band, 150 W/m2 of fixtures, ideal controller at 5 minute steps, 0.12 USD/kWh electricity and 0.045 USD/kWh fuel. Capacities are declared assumptions held constant inside each facility so the air path is the only variable: every sealed row carries DX at 150 kW, a 100 kg/h dehumidifier, a 40 kW heater and no pad, and every hybrid row carries integrated HVAC with reheat, DX at 200 kW, a 100 kg/h dehumidifier and a 250 kW heater. One site, one year, one configuration per row, under a controller that reports a capability ceiling rather than a prediction.

| Air path, sealed insulated box | Attainment | Electricity MWh | Fuel MWh | Operating cost | Unmet moisture kg |
|---|---:|---:|---:|---:|---:|
| Shipped opaque shell leakage, 2 ACH | 90.2% | 325 | 86 | 43,739 | 1,496,419 |
| Outside-air economizer, 6 ACH | 94.7% | 311 | 101 | 42,758 | 274 |
| Oversized economizer, 20 ACH (resolution-limited, not interpretable) | 76.4% | 345 | 58 | 44,879 | 12,371 |
| Economizer 6 ACH plus dry-neutral DOAS | **94.7%** | 286 | 98 | **39,517** | 248 |

Raising the cap from the shipped 2 ACH to a designed 6 ACH is worth 4.5 points of attainment, takes unmet moisture from 1,496,419 kg to 274 kg, and costs 981 dollars a year less rather than more. Adding a dry-neutral DOAS on top of that economizer is the cheapest closed configuration in the set, 39,517 dollars against 43,739, at the same 94.7 percent attainment, and the DOAS removed 10,550 kg of water over the year. Unmet moisture is the engine's instantaneous imbalance integral, so it compares across these four rows, which share one control mode, and not against a staged-controller run.

The 20 ACH row is in the set to be looked at, not quoted. The ideal dispatcher offers three airflow levels per substep, the declared minimum, the midpoint and the maximum, so raising the maximum also moves the midpoint and deletes the intermediate flow the controller was using: 6 ACH offers 0.30, 3.15 and 6.00 and scores 94.7 percent, 12 ACH offers 0.30, 6.15 and 12.00 and scores 89.9, and 20 ACH offers 0.30, 10.15 and 20.00 and scores 76.4. The degradation tracks the midpoint, not the air, so the tool cannot currently rank economizer capacities and that row is not evidence that oversizing hurts. Size a real economizer with an engineer against the design condition.

One configuration trap, because a user will hit it: applying the DOAS technology preset on its own also sets `dehuKgH` to 0 and `coolingKW` to 60, which scores 15.2 percent in this box, so the working row keeps the box's own recirculating DX and dehumidifier and adds DOAS on top of them, which is how a closed facility is actually built.

| Hybrid house operation | Attainment | Electricity MWh | Fuel MWh | Operating cost |
|---|---:|---:|---:|---:|
| As shipped, open, 15 ACH | 98.9% | 238 | 533 | 53,477 |
| Closed up: curtain plus shade guarded on crop light, 6 ACH | 98.9% | 245 | 374 | **47,145** |
| Closed up: shade unguarded, lamps cover the light | 98.9% | 244 | 375 | 47,100 |

Closing the hybrid house up at this site costs nothing in attainment, 98.9 percent in all three rows, and saves 6,332 dollars a year by turning 159 MWh of fuel into 7 MWh of electricity. Removing the light guard changes almost nothing here, 47,100 against 47,145, because a subarctic house is short of light and its shade screen rarely deploys. The cross-site version of this comparison, where the guard is worth 6.1 points in Denver and 5.2 in Miami, is in [../CLASSES.md](../CLASSES.md). Re-home the scenario before running it at another site, meaning its latitude, longitude, ZIP and time zone as well as its weather record: a Fairbanks-homed hybrid run against Colorado weather schedules the photoperiod and the local-day light accounting on Alaska clock time, which shifted lamp energy by about a quarter when it was measured.

**Counter-case.** The economizer result is a cold-climate result. It works at Fairbanks because outside air is both cold and dry, and the same path at a hot-humid site imports latent load instead of removing it, which is the direction the Miami rows of the class ladder show. The cost ordering also rides on the 0.12 to 0.045 electricity-to-fuel price ratio: the DOAS and closed-up rows win partly by moving load between the two, so a site with expensive gas or cheap power reads them differently. And the fan, duct and heat-recovery capital that an economizer or a DOAS actually needs is not in the operating column at all, so treat these as screening comparisons of air paths, not as a purchase decision.

## The climate lesson: the binding constraint belongs to the climate, not the equipment

One pad-and-vent greenhouse, one lettuce band, one set of equipment and one set of prices, run against the 2025 record of each bundled site.

| Site | Attainment | Pad-effective h | Moisture-limited h | Temperature-limited h | Free-cooling h | Heating h |
|---|---:|---:|---:|---:|---:|---:|
| Tulsa, mixed humid | 27.1% | 244 | 3,851 | 2,952 | 401 | 4,442 |
| Phoenix, hot-dry | 46.8% | 2,334 | 1,708 | 2,184 | 2,636 | 3,029 |
| Miami, hot-humid | 7.6% | 33 | 8,176 | 7,381 | 138 | 213 |
| Denver, cold-dry at altitude | 44.2% | 1,065 | 84 | 0 | 1,345 | 6,777 |
| Seattle, cool-marine | 43.1% | 12 | 525 | 50 | 113 | 8,269 |
| Fairbanks, subarctic and light-limited | 26.5% | 40 | 224 | 9 | 89 | 8,420 |

The moisture and temperature columns are the weather-side pad-limit counts over the whole year: hours in which pad leaving air would sit above the moisture ceiling, and hours in which it would not clear the temperature margin, whether or not cooling was called for in that hour. They overlap heavily, since most failing hours fail both (2,934 of Tulsa's, and every one of Miami's temperature-limited hours), and they are wider than the single-cause attribution used in [../REGIONS.md](../REGIONS.md), which divides each pad-ineffective hour between the two causes instead. The heating column counts every heating-mode hour. Denver also recorded only 4 pad-ineffective hours, and Fairbanks 15.

Read the pad column against the free-cooling column. In Phoenix the pad is a primary cooling stage: 2,334 hours in which pad leaving air clears both the temperature margin and the moisture ceiling, alongside 2,636 hours when plain outside air is enough. In Denver the same pad works almost whenever it is asked to, 1,065 effective hours against just 4 ineffective ones, and moisture barely binds at all, 84 hours, because the air at 2,095 m of source elevation is dry and the diurnal swing is large. In Miami the identical pad is worth 33 hours in a year, in Fairbanks 40 and in Seattle 12. Those three small numbers do not have the same cause. Miami's 25.7 C mean summer wet bulb sits within a degree of Phoenix's 26.6 C peak summer wet bulb (ten-year figures, [../CLIMATES.md](../CLIMATES.md)), so there is next to no depression left to evaporate into and pad leaving air breaks the moisture ceiling in 8,176 hours, while Seattle and Fairbanks are almost never hot enough to ask for a pad at all, with 113 and 89 free-cooling hours because outside air is already inside the band rather than usefully below it.

The consequence is the lesson. The binding constraint is a property of the climate, not of the equipment: the same pad that is a primary cooling stage in Phoenix and Denver is close to useless in Miami, Seattle and Fairbanks, and not for the same reason in any of the three, and no change to pad effectiveness would alter that. It also explains why the attainment column is a poor summary on its own. Miami at 7.6%, Fairbanks at 26.5% and Seattle at 43.1% all fail this house, and they fail it differently. Miami fails on latent load that needs dehumidification: 8,176 moisture-limited hours against 213 heating hours. Seattle's 8,269 heating hours and 150.9 W/m² mean irradiance in this record, the second lowest of the six, make it a heating and supplemental-lighting problem instead. Fairbanks is the far end of that: 8,420 heating-mode hours, 765,587 kWh of fuel and $46,685 of operating cost, all the highest of the six, on 105.3 W/m² of mean irradiance, with moisture second only to Denver in how rarely it binds, 224 hours. Two constraints bind there at once, and only one of them is a capacity decision in this set: the 120 kW heater leaves 68,983 kWh of sensible load unmet, which a bigger heater would close, while the crop misses its 14 mol/m² daily light target on 208 of 365 days, the most of any site here, because the installed fixtures top out near 9.8 mol/m²/day and a December day inside this house adds about 0.2 mol/m² to that. No choice between the HVAC classes this library compares touches the second one. Choose the equipment against the constraint the site actually has, then check it against the other nine bundled years before treating one year's ordering as the answer.

Site profiles, provenance and the limits of ten bundled years of gridded reanalysis are in [../CLIMATES.md](../CLIMATES.md).

## Adding a set

Keep them comparisons, not single scenarios: the tool's output is a ranking, and a lone scenario has nothing to rank against. Hold the site, crop and geometry constant so only the strategy varies, or state in `note` exactly which other input moves and why, as `crop-bands.json` and `climate-archetypes.json` do. Every set needs `schemaVersion: 1`, a `note` that says what the set demonstrates, and at least two scenarios with distinct names. Run `node --test test/examples.test.mjs` before proposing it.

A set also needs its lesson written here, in the four parts used above: the decision it informs, the mechanism in plain physics, what the measured run showed, and the counter-case in which the conclusion flips. A set that exists but teaches nothing is a preset, and presets are how people end up quoting our defaults as findings.

Do not add a set whose equipment assumptions you cannot state. A preset that looks authoritative and is not sourced is worse than no preset.
