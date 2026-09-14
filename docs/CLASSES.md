# Classes of environmental control, and the climate that promotes you to the next one

Purpose: name the discrete classes of CEA environmental control, state the physical condition that makes each
class insufficient, and show what each class actually achieved in six bundled climates so the choice between
them is a measurement rather than a preference.

Status: measured 2026-09-14 on model `0.2.0-screening`. Nine configurations against calendar year 2025 at six
sites, under the ideal per-substep controller, with equipment sized per site by the rules in
[How this was measured](#how-this-was-measured). These are capability ceilings, not installed-system
predictions, and no figure here is a manufacturer comparison or an equipment-sizing certificate.

Read this if: you are deciding whether a site needs pads, a dehumidifier, a curtain, lights, or an opaque box,
or you are asking whether a greenhouse is worth building at all at a given latitude.

## The classes

A class is defined by the set of states it can reach, not by its brand or its cost. Each row states what the
class adds and the physical condition that exhausts it.

| Class | What it is | What it can do | What exhausts it |
| --- | --- | --- | --- |
| **C0** Pad and vent, no heat | Fans, wet pad, vents | Cool toward the wet bulb, never below it; dump moisture by air exchange | The first hour below the night target. Also any hour whose wet bulb is above the target |
| **C1** Pad, vent and heat | C0 plus a burner or boiler | Hold a temperature band year round | The moisture ceiling. Nothing in C1 removes water except outside air, so a humid or a tight-and-cold house sits above its dew-point limit |
| **C2** Pads, vent, heat and dehumidifier | C1 plus a condensing unit | Hold temperature and a moisture band together | The dehumidifier's coil dew point, and the fuel bill of heating the air it dried |
| **C3** C2 plus movable curtain and shade | C2 plus scheduled envelope | Cut heat loss at night and solar gain at noon without buying capacity | Light. A shut curtain and a drawn screen both cost photons, and neither adds any |
| **C4** Hybrid: supplemental LED, DX and dehumidifier, curtain, reduced ventilation | Semi-closed house with real cooling and real light | Hold the joint band and the daily light integral | Envelope loss. Everything gained is still paid for through a 4 W/m2K wall |
| **C5** Indoor, insulated shell (SIP), DX and dehumidifier, all light electric | Opaque box, U 0.27 W/m2K | Near-total state authority at a fraction of the heating plant | Its own moisture. No solar gain means no free drying either, and a 2 ACH shell cannot use dry outside air |
| **C5b** C5 with integrated HVAC and reheat | C5 plus coupled reheat | Overcool for latent control, then reheat with recovered heat | Same as C5, plus the reheat energy |
| **C6** Indoor, uninsulated shell | Tilt-up or metal shell, U 4.54 W/m2K, 1.7 ACH | Same control authority as C5 | The envelope. It pays C5's electricity and a greenhouse's fuel bill at once |

## What each class achieved, by climate

Attainment is the share of eligible hours inside the joint temperature, VPD and dew-point band. `DLI short`
counts days the crop did not reach its 14 mol/m2 target. Capacities are what the sizing rules asked for at that
site, and they are part of the answer: they are the plant you would have to buy.

| Site | Class | Heat kW | Cool kW | Dehu kg/h | Attainment | Electricity MWh | Fuel MWh | Operating $/y | DLI short, days |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Fairbanks, AK | C0 | 0 | 217 | 0 | 5.6% | 135 | 0 | 16,538 | 189 |
| | C1 | 221 | 217 | 0 | 61.2% | 216 | 1,122 | 77,224 | 189 |
| | C1 heat pump | 221 | 217 | 0 | 52.2% | 519 | 0 | 62,951 | 189 |
| | C2 | 221 | 217 | 81 | 98.3% | 223 | 539 | 51,980 | 189 |
| | C3 | 221 | 217 | 81 | **98.4%** | 228 | 379 | 45,408 | 189 |
| | C4 | 221 | 286 | 81 | **98.6%** | 232 | 361 | 45,087 | **0** |
| | C5 | **30** | 104 | 81 | 83.6% | 322 | **82** | **43,157** | **0** |
| | C6 | 302 | 129 | 78 | 83.9% | 327 | 924 | 81,749 | 0 |
| Seattle, WA | C0 | 0 | 278 | 0 | 8.2% | 172 | 0 | 21,073 | 134 |
| | C1 | 99 | 278 | 0 | 36.6% | 210 | 737 | 59,195 | 134 |
| | C2 | 99 | 278 | 85 | 96.2% | 209 | 147 | 32,666 | 134 |
| | C3 | 99 | 278 | 84 | 97.7% | 199 | 78 | 28,290 | 134 |
| | C4 | 99 | 345 | 84 | **97.8%** | 185 | 81 | **26,785** | **0** |
| | C5 | 14 | 106 | 85 | 94.9% | 354 | 17 | 44,195 | 0 |
| | C6 | 135 | 150 | 81 | 97.7% | 362 | 261 | 56,151 | 0 |
| Denver, CO | C0 | 0 | 325 | 0 | 11.7% | 150 | 0 | 18,746 | 27 |
| | C1 | 159 | 325 | 0 | 67.3% | 216 | 538 | 50,887 | 27 |
| | C2 | 159 | 325 | 80 | 79.3% | 188 | 236 | 33,893 | 27 |
| | C3 | 159 | 325 | 76 | 84.1% | 173 | 148 | 28,123 | 27 |
| | C4 | 159 | 394 | 76 | 83.9% | 159 | 155 | **26,736** | **0** |
| | C5 | 22 | 110 | 65 | **93.7%** | 270 | 44 | 35,119 | 0 |
| | C6 | 218 | 183 | 66 | 82.2% | 286 | 414 | 53,746 | 0 |
| Tulsa, OK | C0 | 0 | 327 | 0 | 16.4% | 299 | 0 | 36,733 | 61 |
| | C1 | 135 | 327 | 0 | 59.7% | 323 | 664 | 69,643 | 61 |
| | C2 | 135 | 327 | 87 | 92.2% | 262 | 118 | 37,775 | 61 |
| | C3 | 135 | 327 | 83 | 97.1% | 241 | 73 | 33,141 | 61 |
| | C4 | 135 | 395 | 83 | **98.0%** | 237 | 76 | **32,809** | **0** |
| | C5 | 19 | 111 | 83 | 95.6% | 412 | 16 | 51,032 | 0 |
| | C6 | 184 | 199 | 79 | 96.1% | 431 | 203 | 61,759 | 0 |
| Phoenix, AZ | C0 | 0 | 388 | 0 | 40.2% | 245 | 0 | 31,247 | 9 |
| | C1 | 87 | 393 | 0 | 67.3% | 265 | 203 | 42,799 | 9 |
| | C2 | 87 | 386 | 94 | 80.0% | 271 | 54 | 36,731 | 9 |
| | C3 | 87 | 379 | 90 | 86.7% | 231 | 36 | 30,627 | 9 |
| | C4 | 87 | 448 | 92 | 81.8% | 207 | 42 | **27,876** | **0** |
| | C5 | 12 | 117 | 81 | **93.8%** | 326 | 8 | 40,389 | 0 |
| | C6 | 119 | 251 | 82 | 85.4% | 334 | 78 | 44,568 | 0 |
| Miami, FL | C0 | 0 | 302 | 0 | 15.0% | 512 | 0 | 62,099 | 12 |
| | C1 | 35 | 302 | 0 | 17.6% | 488 | 264 | 71,168 | 12 |
| | C2 | 35 | 302 | 86 | 93.3% | 348 | 1 | 42,685 | 12 |
| | C3 | 35 | 302 | 85 | 97.8% | 327 | 1 | **40,184** | 12 |
| | C4 | 35 | 370 | 85 | **99.2%** | 341 | 1 | 41,764 | **0** |
| | C5 | 5 | 109 | 82 | 97.6% | 526 | 0 | 64,107 | 0 |
| | C6 | 48 | 165 | 80 | 98.0% | 615 | 0 | 74,766 | 0 |

## The promotion rules, in the order they bind

**C0 to C1, heat: the least interesting decision.** Every site except Phoenix and Miami spends thousands of
hours below the night target, and nothing else in the ladder substitutes for heat. This promotion is never in
question outside the subtropics, and the numbers show why it is also never sufficient: C1 tops out at 61.2
percent in Fairbanks and 17.6 percent in Miami.

**C1 to C2, a dehumidifier: the largest single gain anywhere in the ladder.** It is worth 75.7 points in Miami,
59.6 in Seattle, 37.1 in Fairbanks and 32.5 in Tulsa. It also *reduces* the operating bill in every one of the six
climates, from 6,068 dollars a year in Phoenix to 31,868 in Tulsa, because the alternative way to dry a house is
to ventilate and reheat, and that is more expensive than condensing the water out. The rule: **if the site has moisture-limited hours, a dehumidifier is not an upgrade, it
is the difference between a climate-controlled house and a shed with a thermostat.** Only Phoenix, where
moisture-limited hours are 773 a year against 1,365 temperature-limited, can reasonably stop at C1 plus pads.

**C2 to C3, curtain and shade: buy the schedule, not the capacity.** Adding no kW at all, the curtain and screen
cut fuel by 160 MWh in Fairbanks, 69 MWh in Seattle and 88 MWh in Denver, worth 6,572, 4,376 and 5,770 dollars a
year. They also add attainment where the envelope was the limit (Tulsa 92.2 to 97.1, Phoenix 80.0 to 86.7). The
cost is photons: at every greenhouse site the DLI shortfall is unchanged or worse, and in Fairbanks it stays at
189 days. **A curtain is the cheapest promotion in the ladder and the only one that pays for itself in fuel.**

**C3 to C4, LED and DX: the promotion that is really about light.** Attainment moves modestly (Tulsa plus 0.9,
Miami plus 1.4, Phoenix minus 4.9 because the bigger cooling plant is being asked to hold a tighter band at the
same time as the screens), but the DLI shortfall goes to zero at every site. **This promotion is not bought for
control, it is bought for yield.** The threshold is the site's light deficit: 9 days a year in Phoenix does not
justify a lighting plant, 61 in Tulsa might, 134 in Seattle probably does, and 189 in Fairbanks is not a
supplemental-lighting decision at all.

**C4 to C5, go opaque: only when the envelope stops earning its losses.** The glazing is a bargain in Miami
(C4 holds 99.2 percent for 41,764 dollars, the box holds 97.6 percent for 64,107) and in Tulsa and Seattle. It
loses in Denver (93.7 against 83.9 percent, for 8,383 dollars more) and in Phoenix (93.8 against 81.8 percent).
The pattern is not temperature, it is **how much of the year the glazing is delivering usable light versus
importing a load you have to remove**: both sites where the box wins are high-altitude or high-irradiance sites
where midday solar gain is a cooling liability and winter loss is a heating liability at the same time.

**C5 versus C6, insulation: the clearest number in this document.** Same equipment, same control authority, same
light. Insulating the shell is worth 842 MWh of fuel and 38,592 dollars a year in Fairbanks, 370 MWh and 18,627
dollars in Denver, and 244 MWh and 11,956 dollars in Seattle. Even in Miami, where neither shell burns anything,
it is worth 10,660 dollars a year in electricity. **There is no
climate in this set where the uninsulated shell is defensible**, which is worth stating because an uninsulated
warehouse is the most commonly available building.

## Is a winter greenhouse worth it in Alaska?

The Fairbanks rows answer this directly, and the answer is not the one either side of the argument expects.

**The greenhouse can hold the climate band.** C2 reaches 98.3 percent and C3 98.4 percent. Cold is not what
defeats a greenhouse at 64.8 degrees north; a 221 kW heating plant on 500 m2 and a dehumidifier hold the
temperature and moisture band almost perfectly. The ten-year study
([REGIONS.md](REGIONS.md)) shows why it is simple to control even though it is severe: 8,348 heating hours in a
median year, 165 moisture-limited hours, 0.6 temperature-limited hours and 10 pad-effective hours. There is
essentially one problem at this site, and it is a one-directional one.

**What it cannot hold is the light.** The bundled decade gives Fairbanks an outside daily light integral of
**0.4 mol/m2 in December against 41.2 in June, a factor of 106**, converting shortwave at the engine's own
2.02 umol/J. Inside a house at 0.65 transmission, December is 0.25 mol/m2/day against a 14 mol target. With
the tool's default 80 W/m2 of supplemental fixtures, 189 days a
year finish short, and the shortfall is real rather than marginal: the darkest day reaches 9.94 mol. Clearing
the target takes **115 W/m2 installed**, measured by sweeping the density until the deficit reaches zero, which
is indoor-farm fixture density on a greenhouse bench. Above 115 W/m2 nothing changes, because delivery is
target-limited rather than capacity-limited: 115, 130, 150 and 250 W/m2 all deliver 109 MWh a year and all
finish every day at exactly 14.00 mol. That is the honest form of the question: **a winter greenhouse in
Fairbanks is a lit box with a transparent roof.**

The roof does still earn something. The lit greenhouse spends 109 MWh a year on light where the windowless box
spends 234, so summer daylight is worth 125 MWh of electricity it never has to buy. It just does not earn
enough: the same roof loses enough heat to need 279 MWh more fuel and a 221 kW plant instead of a 30 kW one.

Compare the two ways of buying that:

| | C4 lit greenhouse | C5 insulated box |
| --- | ---: | ---: |
| Heating plant | 221 kW | **30 kW** |
| Fuel | 361 MWh | **82 MWh** |
| Electricity | 232 MWh | 322 MWh |
| Operating cost | 45,087 | **43,157** |
| Attainment | **98.6%** | 83.6% |
| DLI short | 0 days | 0 days |

Operating cost is within 4 percent, so the decision is not the energy bill. It is these two facts:

1. **The box needs one seventh the heating plant and one quarter the fuel.** A 221 kW burner on 500 m2 exists
   only because the envelope loses that much at -44 C. That is capital and it is a permanent fuel exposure.
2. **The box gives up its cheapest dehumidifier.** Its 83.6 percent is a moisture result, not a temperature
   one: -20 C outside air holds almost no water, so ventilation is nearly free drying, and the opaque template
   is capped at 2 ACH while the greenhouse can move 40. The condensing dehumidifier cannot make up the
   difference because it cannot dry below its own coil dew point.

So: **in a subarctic climate, build the insulated box, and put a dry-air economizer on it.** The greenhouse's
only real advantage in Fairbanks is that it can throw a door open at a moisture problem; give the box that
ability and it wins on every remaining axis. A winter greenhouse is worth it there only if the summer crop pays
for the envelope on its own, because the winter crop is being grown under electric light either way.

## Two results that are about control, not equipment

**Oversizing can lower attainment.** Under the staged deadband controller, a Miami C1 house scored 9.6 percent
with 100 kW of cooling and 0.0 percent with 406 kW: bigger single stages overshoot the band harder. Under the
ideal controller the same sweep rises from 10.1 to 18.7 percent and saturates. **A capacity comparison is only
meaningful with staging or modulation to match**, which is why the ladder above uses the ideal controller and
reports a ceiling.

**The heat pump is a fuel-price decision, not a capability upgrade.** The C1 heat-pump rows cost less to run
than fuel at these prices at every site, but in Fairbanks attainment falls from 61.2 to 52.2 percent: with a
-15 C cutoff, the 1,112 hours a year below -20 C are hours it will not run at all. The unmet heat is reported
rather than silently burned. Below a subarctic cutoff you still need the burner, so you have bought both plants.

## Four hot-humid design questions, measured

All four were run on the bundled Miami 2025 year, 500 m2 greenhouse, ideal controller, 5-minute steps, at
0.12 USD/kWh electricity and 0.045 USD/kWh fuel. They test claims that are widely held and half right.

### Is a clear roof "air conditioning the sun"?

**Not per photon. Badly, per installed ton.** Per mol of PAR delivered to the crop, the roof admits 138 Wh of
shortwave and an LED at 2.5 umol/J burns 131 Wh of electricity, using the engine's own 2.02 umol/J solar
conversion. Those are within 5 percent, so sunlight is not thermally worse than lamplight for the same light.

Three other things are true and they are what the intuition is actually detecting:

| | Clear roof, 0.65 transmission | LED to the 14 mol target |
| --- | ---: | ---: |
| Heat admitted or released, annual | **604 MWh** | 234 MWh |
| Peak | **325 kW** | 40 kW steady over 16 h |
| Light delivered against the crop's need | **1.71x the target** | 1.00x |

So the roof brings 2.6 times the heat, because it insists on delivering 1.71 times the light the crop asked
for, and it does it at an **8-fold higher peak** that sizes the cooling plant. Our own ladder shows the
consequence: the hybrid greenhouse needed 370 kW of cooling in Miami against 109 kW for the insulated box.
That is the real penalty of glazing in a hot-humid climate, and it is a controllability and peak-load penalty
rather than a thermodynamic one. It also explains why the shade screen helps here: removing the excess light
moves the roof back toward parity instead of throwing away photons the crop wanted.

At a modern 3.0 to 3.5 umol/J fixture the LED figure falls to 109 and 94 Wh/mol, so LEDs become genuinely
better than sunlight per delivered photon, and the gap widens with every fixture generation.

### Do standalone dehumidifiers just fight the air conditioning?

**They do fight it, and it is still worth roughly half the bill.** Miami, DX fixed at 300 kW, sweeping a
standalone condensing dehumidifier:

| Dehumidifier | Attainment | Its own heat into the zone | Cooling | Total electricity | Operating cost |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 kg/h | 67.6% | 0 | 1,300 MWh | 464 MWh | 81,483 |
| 30 kg/h | 96.9% | 153 MWh | 826 MWh | 363 MWh | 50,422 |
| 60 kg/h | **97.0%** | 184 MWh | 680 MWh | **327 MWh** | **40,453** |
| 90 kg/h | 97.0% | 191 MWh | 667 MWh | 326 MWh | 40,030 |
| 120 kg/h | 97.1% | 189 MWh | 669 MWh | 326 MWh | 40,045 |

The fight is real and quantified: at 60 kg/h the dehumidifier dumps **184 MWh of its own heat** into a house
that then spends 680 MWh cooling, so about **27 percent of the remaining cooling load is the dehumidifier's own
waste heat**. And it is still the right move by a wide margin: **+29.4 points of attainment and half the
electricity**, because forcing a DX coil to do the latent work means overcooling the entire airstream and
throwing sensible capacity away. Returns stop at about 60 kg/h for this house, which is also where the
measured crop moisture peaks.

### Do you always want integrated reheat?

**Only when the coil is your dehumidifier, and then it is not optional, it is decisive.** Same Miami house
with the standalone dehumidifier removed, so the DX coil has to handle latent:

| | Attainment | Reheat recovered | Purchased heat | Operating cost |
| --- | ---: | ---: | ---: | ---: |
| DX, no reheat | 67.6% | 0 | **498 MWh** | 81,483 |
| Integrated, 50 percent recovery | 97.2% | 520 MWh | 47.6 MWh | 59,547 |
| Integrated, 100 percent recovery | **98.4%** | 557 MWh | 12.9 MWh | **57,814** |

Without reheat the house overcools to reach the dew point and then **buys 498 MWh of heat in Miami**, which is
the absurdity the intuition is reaching for, and it still only holds the band 67.6 percent of the time.
Integrated recovery is worth **up to 30.8 points and 23,669 dollars a year** here. So yes: a coil used as a
dehumidifier needs hot-gas or condenser reheat.

But the ordering is the opposite of the usual assumption. With a separate dehumidifier the reheat term nearly
vanishes (7.8 MWh in Miami, 2.4 in Tulsa, 1.4 in Seattle) because the coil rarely has to overcool, and that
path costs **40,453 dollars against 57,814** for coil-plus-full-reheat at the same attainment. **Decoupling the
latent job beats coupling it and recovering the penalty**, by 17,361 dollars a year in this house. Reheat is
the fix for a design choice, not a better design choice.

### Does an insect screen cost you, or help?

**It depends entirely on whether the outside-air path is doing work you cannot replace.** Using the measured
Thai ventilation ratios (1.000, 0.641, 0.502 for nominal 40, 52 and 78 mesh, see
[COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) section 3A):

| Site, 2025 | Strategy | Reference 40 mesh | 78 mesh |
| --- | --- | ---: | ---: |
| Miami | pad and vent only | 7.4% | **4.6%** |
| Miami | pads plus dehumidifier | 10.5% | **8.2%** |
| Tulsa | pads plus dehumidifier | 38.9% | **44.2%** |
| Fairbanks | pads plus dehumidifier | 40.4% | **49.8%** |

In Miami the screen costs attainment, matching the measured Thai direction, because ventilation is still the
only thing doing sensible work in a house with 3,495 temperature-limited hours. In Tulsa and Fairbanks the same
screen **helps**, because there the outside-air path was importing more moisture and heat than it removed and a
mechanical sink existed to take over. The effect survives the ideal controller, so it is not the staging
artifact described above.

Two cautions. The measured reference is a 40-mesh screened house, not an unscreened one, so none of this prices
the first screen. And the measured Thai houses had fans off and no mechanical drying, which is the one
configuration where the penalty can only be a penalty; the model reproduces exactly that direction in the
pad-only rows.

## How this was measured

- **Weather:** committed NASA POWER snapshots, calendar year 2025 per site, from `data/weather/`. Fairbanks is
  bundled with ten complete years like every other site; this table uses one year and is therefore a single
  sample of each climate, not a distribution. The ten-year distributions are in [REGIONS.md](REGIONS.md).
- **Facility:** 500 m2 floor, 4 m height, greenhouse benches, baby-leaf lettuce at a 22 C day and 18 C night
  target, 0.6 to 1.0 kPa VPD, 19 C dew-point ceiling, 14 mol/m2 daily light target, 16 h photoperiod.
- **Envelopes:** `greenhouseDouble` (U 3.97, 0.5 ACH, 0.77 optical) for C0 to C4, `warehouseSip` (U 0.27,
  0.4 ACH) for C5 and C5b, `warehouse` (U 4.54, 1.7 ACH) for C6. Sources and their limits are in
  [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md).
- **Sizing, one pass per class and site:** heat to envelope plus infiltration at the site's coldest bundled hour
  against a 22 C target; cooling to the greater of the analytic design load and the 95th percentile of simulated
  demand, plus 15 percent; dehumidification to the 99th percentile of hourly crop moisture production, plus 10
  percent. No iterative search: growing a capacity against a deadband controller changes the control result as
  well as the capacity, so the loop is not well posed.
- **Controller:** ideal per-substep optimization, 5 minute steps. This is a capability ceiling. The staged
  deadband controller, which is the interface default, converges to within 0.4 points of it on the Tulsa
  example strategies but not on an arbitrary oversized plant, as the section above shows.
- **Prices:** 0.12 USD/kWh electricity and 0.045 USD/kWh fuel at every site, declared manually so a cost
  difference between climates is a dispatch difference and not a tariff difference. Capital and maintenance are
  excluded from the operating column.
- **Screens where fitted:** curtain at a 0.5 U factor, 0.1 h-1 closed exchange, deployed at night below 12 C;
  shade at 0.5 shading, deployed above 600 W/m2 and guarded to a 3 mol light deficit. Those thresholds are
  declared assumptions, not measured product data.
- **Not claimed:** no yield, no capital ranking, no manufacturer comparison, no site calibration, and no
  minute-scale control claim. Unmet moisture is reported by the engine as an instantaneous imbalance integral
  and is not comparable between control modes, so it is deliberately absent from the table above.

## Reproducing this

The ladder is a throwaway analysis over committed data, in the spirit of
[EVALUATION.md](EVALUATION.md): every input above is a bundled snapshot plus a template from
`src/config.js`, and the class definitions are the shipped facility and technology combinations. The scenario
library in [examples/](examples/README.md) carries importable versions of the individual comparisons, and
[REGIONS.md](REGIONS.md) carries the ten-year, six-region study of the six canonical strategies under the
default staged controller.
