# What is actually proven to work in hot-humid CEA

Purpose: separate what measured research establishes about controlled-environment agriculture in hot and humid
climates from what is repeated, modeled or marketed. This document exists because the tool reports a hard
verdict for Miami, and a reader is entitled to know how much of that verdict the published evidence can carry.

Status: review executed 2026-09-14 against model `0.2.0-screening`. Six parallel evidence searches across
evaporative cooling, mechanical cooling and dehumidification, desiccants, enclosed plant factories, crop and
control setpoints, and validation data and standards. 52 cited DOIs were machine-checked and all 52 resolve
(49 through Crossref, 3 through DataCite).

Read this if: you are choosing equipment for a humid site, or you want to know which of this tool's numbers
rest on measurement and which rest on assumption.

## The headline

**No Grade A evidence was found in any of the six domains.** Not one peer-reviewed study was located that
measured two or more climate-control strategies in a real hot-humid facility, against a shared crop and a
shared target band, with separated energy metering and reported uncertainty. The single most consequential
question in this field, *what is the most energy-efficient way to remove moisture when the outdoor dew point
sits above the zone ceiling for thousands of hours a year*, has **no measured answer in the published
literature reviewed here**.

That absence is the most important finding in this document, and it is corroborated from inside the field.
Hopwood et al. ([10.1016/j.biosystemseng.2024.06.005](https://doi.org/10.1016/j.biosystemseng.2024.06.005))
state that long-term measured hot-humid performance benchmarks are lacking and that their own annual
comparisons are therefore model based. Woods et al.
([10.1016/j.enconman.2025.120683](https://doi.org/10.1016/j.enconman.2025.120683)) report that of the prior
full-system experimental liquid-desiccant studies requiring no external heating or cooling, only four exist,
two report a single operating point, and "None of these four studies clearly quantify the benefits of these
systems compared to a vapor-compression system that does not use desiccant."

What *is* established is narrower and more useful than a winner: a firm thermodynamic boundary, a small number
of measured device efficiencies, one measured tropical electrical end-use split, and a set of measured
biological facts that refuse to produce the simple humidity threshold the industry uses.

## How claims are graded

Two marks, because publication tier and measurement quality are different things. A well-instrumented
government field campaign is not a vendor brochure, and a peer-reviewed simulation is not a measurement.

| Letter | Meaning |
| --- | --- |
| **A** | Peer-reviewed, measured in a real hot-humid facility, with a control or baseline and reported uncertainty |
| **B** | Peer-reviewed and measured, but short campaign, single facility, laboratory scale, or warm-humid rather than hot-humid |
| **C** | Peer-reviewed simulation or validated model, including a measured system compared against a modeled baseline |
| **D** | Not peer-reviewed: technical reports, theses, extension bulletins, conference abstracts |
| **E** | Vendor marketing with no disclosed method |

Every entry also carries a plain-words provenance note, and where a paper's capability claim and its efficiency
claim deserve different letters, both are given. Hot-humid means design dew point at or above roughly 24 C and
mean summer wet bulb at or above roughly 24 C, so that wet-bulb depression is small and the binding constraint
is latent. Arid and Mediterranean results are labeled transfer wherever they appear.

## 1. Evaporative cooling: the physics is firm, the threshold is not measured

**Proven, by thermodynamics rather than by trial.** Direct evaporative pad leaving air follows
`T_leave = T_dry - eta * (T_dry - T_wet)`, so the maximum available drop is the entering wet-bulb depression.
An outdoor wet bulb at or above the required leaving-air temperature precludes reaching that temperature by
direct evaporation at any efficiency. UF/IFAS puts Florida summer afternoon wet bulbs at 26.1 to 26.7 C, with
well-operated pads delivering air 1.7 to 2.2 C above wet bulb and a further 3.9 to 4.4 C of rise to the exhaust
([10.32473/edis-ae069-2019](https://doi.org/10.32473/edis-ae069-2019), **D**, extension engineering guidance,
no disclosed trial dataset).

**Not proven: any measured outdoor dew point above which pads stop being useful.** No dew-point-stratified
pad-on/off experiment reporting yield, disease or joint-band attainment was found. Equally, the categorical
claim that pads never work in humid climates is **not** supported: a measured Shanghai glasshouse campaign
found pads still reduced temperature
([10.1016/j.apenergy.2014.10.061](https://doi.org/10.1016/j.apenergy.2014.10.061), **B provisional**,
peer-reviewed 2,304 m2 facility, full text not recovered, secondary summary reports 2 to 3 C below ambient at
about 80 percent RH). The honest position is that the ceiling is thermodynamic and site-specific, and the
agronomic crossover has not been measured.

**The best measured evidence in this domain is about screens, not pads.** In a Thai rainy-season tomato
experiment, mean ventilation fell from 0.0719 to 0.0461 and 0.0361 m3 m-2 s-1 across nominal 40, 52 and
78 mesh, which is about 35 and 50 percent less than the coarsest *screened* house, not than an unscreened one.
Mean air temperature rose 30.8 to 31.9 C and indoor-minus-outdoor absolute humidity rose 1.05 to 2.21 g m-3
across the same treatments ([10.1016/j.biosystemseng.2006.02.016](https://doi.org/10.1016/j.biosystemseng.2006.02.016),
**B**, instrumented crop experiment with standard errors, one house per treatment, ventilation inferred from a
water balance rather than tracer gas). Finer screens therefore trap both heat and moisture, which is a
measured mechanism for a humid house losing its cheapest moisture sink.

A NIR-reflective diffusing coating in Taiwan produced measured mean air temperature of 33.3 C coated against
33.9 C uncoated, monthly reductions of 0.3 to 0.9 C, leaf temperature reductions of 2.3 to 2.4 C, and upper
canopy PPFD of 742.7 against 940.0 umol m-2 s-1
([10.21273/HORTSCI16271-21](https://doi.org/10.21273/HORTSCI16271-21), **B**, randomized replicated
compartments, single site, internal inconsistencies in its yield and light summaries that we do not average
away). The air cooling is small; the crop benefit is radiant.

Barbados natural-ventilation-plus-mist field trials reached 1.3 to 3.6 C below simultaneous outdoor air on four
selected sunny June days in an empty house, with 0.58 L m-2 h-1 of supplied mist water
([10.1016/j.biosystemseng.2018.07.004](https://doi.org/10.1016/j.biosystemseng.2018.07.004), numbers verified
in the open thesis, **D** for the extracted figures). Its widely attractive "5.6 percent of fan-pad
electricity" is 2.2 kWh estimated from device current and runtime against 39.2 kWh for a *hypothetical*
fan-pad house, with no assurance of equal temperature, VPD or delivered cooling. It is not a metered
comparison.

## 2. Mechanical cooling and dehumidification: the only measured efficiency numbers

**The clearest measured device evidence in this entire review.** A commercial refrigeration dehumidifier in a
Spanish tomato greenhouse achieved a specific moisture extraction rate of 2.0 to 3.1 kg/kWh, mean 2.4 kg/kWh,
across 35 assays on 25 days and about 85 operating hours, which inverts to 0.32 to 0.50 kWh per kg of water
([10.1016/j.applthermaleng.2018.09.107](https://doi.org/10.1016/j.applthermaleng.2018.09.107), **B**,
peer-reviewed metered device campaign, Almería, Mediterranean winter, no competing baseline). An Athens
cucumber heat-pump campaign corroborates the order of magnitude at 0.4 to 0.8 kWh/kg
([10.17660/ActaHortic.2020.1296.25](https://doi.org/10.17660/ActaHortic.2020.1296.25), **D**, abstract only,
Mediterranean transfer).

**Transfer warning, stated because it is tempting to get this backwards.** Removal per kWh generally improves
with a higher entering dew point, which would make a winter Mediterranean figure a conservative floor for
Miami. But tropical service also raises condenser sink temperature and changes compressor lift, which pushes
the other way, and the source reports an SMER that rises with evaporator surface temperature rather than an
isolated entering-dew-point sweep. **Do not treat 0.32 to 0.50 kWh/kg as a proven floor for hot-humid
service.** It is the best measured anchor available and it comes from the wrong climate.

**Outdoor air cannot dehumidify when the outdoor humidity ratio exceeds the zone's.** This is conservation, not
an experimental claim, and it disposes of a common design intuition: heating incoming air lowers its relative
humidity without lowering its humidity ratio. A dry-neutral or dedicated outdoor air system works in a humid
climate only because its own equipment dries the air first. A Canadian comparison of refrigeration against
heat-recovery and exhaust ventilation reached the matching operational conclusion, that ventilation loses
effectiveness in warm humid periods and refrigeration is the year-round answer
([10.13031/aea.31.10723](https://doi.org/10.13031/aea.31.10723), **B**, cold-climate transfer; note its "total
energy" metric adds greenhouse heat loss to electricity, which is a heating-climate definition that does not
carry to the tropics).

**Heat recovery is measured; its savings are modeled.** A French winter greenhouse heat-pump dehumidifier
measured 7.62 kW mean electrical input and 12 W/m2 condensation heat flux with no observed condensation on
plants, but its headline 6 to 8.5-fold advantage is against *simulated* ventilation-heating alternatives
([10.1016/j.biosystemseng.2015.11.011](https://doi.org/10.1016/j.biosystemseng.2015.11.011), **B** measured
operation, **C** energy advantage). This distinction decides the tropical case: recovered condenser heat is a
credit only where heat is wanted. In a hot-humid house it is a load that must be rejected.

**Semi-closed capability is measured; its energy is not.** A Korean semi-closed greenhouse held monthly
internal temperature 17.1 to 23.9 C and RH 65.9 to 85.1 percent through a monsoon summer with external
temperature reaching 28.0 C, but reported no energy meters, and monthly means do not demonstrate hourly
compliance ([10.3390/plants13152116](https://doi.org/10.3390/plants13152116), **B**, warm-humid). A Dutch
comparison measured 61 and 59 kg/m2 in semi-closed compartments against 55 kg/m2 open, with the yield gain
attributed by model to retained CO2 and partly eroded by Botrytis, so cooling cannot be isolated
([10.17660/ActaHortic.2011.893.88](https://doi.org/10.17660/ActaHortic.2011.893.88), **D**, proceedings
abstract, cold-climate). A Wuhan fan-coil tomato campaign is genuinely hot-humid but reports two summer days
and, per the appraisal that cites it, no energy, water or efficiency metric
([10.1016/j.compag.2024.108913](https://doi.org/10.1016/j.compag.2024.108913), **B**, assessed secondhand).

## 3. Desiccants: capability demonstrated, efficiency unproven

**Verdict: "desiccant is the efficient answer in humid climates" is unproven as a general CEA claim.** It is
partially demonstrated as a capability, with plausibly favorable energy under specific heat-recovery or solar
arrangements. No measured hot-humid horticultural comparison against a cooling-coil control was found.

The strongest genuinely humid field evidence is a solar-regenerated liquid-desiccant dedicated outdoor air
system at Tyndall AFB near Panama City, Florida: measured EER 14.7 Btu/(W·h) over three weeks in 2010, and 15
to 20 with an 18.8 monthly mean in August 2011, with thermal COP mostly 0.44 to 0.73
([10.2172/1060595](https://doi.org/10.2172/1060595), **D**, instrumented NREL and DoD ESTCP field campaign
whose measurement quality exceeds its publication tier; no crop, buildings service). Two details matter more
than the efficiency figures. **Its thermal COP target of 0.7 was met and its electrical target of EER 40 was
not.** And its widely quotable "63 percent improvement" compares a measured 14.7 against the incumbent
chiller's *rated* 9.0, not a measured chiller.

Three prominent efficiency headlines dissolve on inspection, and the pattern is worth naming because it
recurs:

- **Simulated comparator.** Woods et al. measured a full-scale vapor-compression plus liquid-desiccant system
  across 26 test points with calibrated RTDs and chilled-mirror hygrometers, then compared it against a
  *calibrated model* of the same system without desiccant: "The calibrated model was then used to simulate a
  baseline vapor compression system without liquid desiccant." Against that, overall electricity was 25 percent
  lower, compressor power 22 percent lower at equal supply dew point, with supply air about 9 C warmer
  ([10.1016/j.enconman.2025.120683](https://doi.org/10.1016/j.enconman.2025.120683), **B** apparatus, **C**
  comparison). The authors limit their own claim: "not generally applicable to any liquid desiccant system
  design."
- **Allocated auxiliary power.** A Singapore membrane pilot measured genuine removal over 150 h of outdoor
  operation, nine modules at 200 m3/h, mean water-vapour concentration falling from 20 ± 2 to 15.9 ± 2.4 g/m3,
  which is about 0.82 kg/h across the whole pilot. Its 26.2 percent claimed saving counts 431.4 kJ/h, roughly
  120 W, of vacuum-pump duty allocated by the permeate-to-bypass flow ratio 5.6/(5.6+64.5), not the 1.5 kW the
  pump actually draws ([10.3390/membranes5040722](https://doi.org/10.3390/membranes5040722), **B** removal,
  **C** saving).
- **Excluded thermal input.** Electricity-only COPs look excellent when large regeneration heat sits outside
  the numerator. Reported hybrid COPs of 11.3 to 18.4 cannot be read as total-energy performance without the
  regeneration boundary ([10.1016/j.apenergy.2024.124704](https://doi.org/10.1016/j.apenergy.2024.124704),
  **B** capability: measured minimum supply 18.44 C from a 36.22 C, 0.028 kg/kg hot-humid inlet, which is real
  evidence that pre-drying restores usable evaporative cooling).

Scale is the other honest number. The Singapore pilot's 0.82 kg/h sits against roughly 80 to 130 kg/h of
moisture removal for a 500 m2 leafy-greens house, two orders of magnitude apart, and an electrochemical
membrane element reports system COP around 0.33
([10.1016/j.apenergy.2017.09.035](https://doi.org/10.1016/j.apenergy.2017.09.035), **B**, bench). The one
actual desiccant crop trial found, 15 percent higher cucumber yield at Harrow, Ontario, is a cool-climate
conference abstract ([10.17660/ActaHortic.2017.1170.110](https://doi.org/10.17660/ActaHortic.2017.1170.110),
**D**), and in a tropical house the regeneration heat it usefully retained would have to be rejected instead.

## 4. Enclosed plant factories in the tropics

**The one measured tropical figure worth quoting.** A two-week metered audit at the MARDI plant factory in
Serdang, Malaysia, attributed 50.5 percent of whole-building electricity to its main air-conditioning
category, 36.0 percent to LEDs, 3.3 percent to pumps and 10.2 percent to other uses
([10.37934/arfmts.80.1.1323](https://doi.org/10.37934/arfmts.80.1.1323), **B**, single facility, two weeks, no
crop identified, whole-building boundary including office and postharvest rooms). So in a tropical plant
factory, climate conditioning can exceed lighting. Note the correction: a widely read review reports 54 percent
HVAC for this facility by folding the pump category in
([10.1016/j.rser.2024.115235](https://doi.org/10.1016/j.rser.2024.115235)); the primary audit says 50.5.

**There is no measured tropical kWh per kg.** Zero facilities were found with synchronized whole-facility
metering against harvested saleable mass. The closest transparent source reports 644 kWh/month and a 30-day
lettuce crop of 15.447 kg whole-plant fresh mass including roots, which can be divided into about 41.7 kWh/kg,
but the paper discloses no meter, interval or synchronization, and its annual figures assume 11 crops
([10.11591/ijai.v13.i4.pp3974-3986](https://doi.org/10.11591/ijai.v13.i4.pp3974-3986), **B** crop data, energy
ratio not established). **That 41.7 is arithmetic, not a benchmark, and should not be cited as one.**

**The water balance is measured, and it corrects a common sizing error.** A closed Japanese production system
over 15 days recorded irrigation 49.5, evapotranspiration 36.7, humidification 24.3 and dehumidification
55.9 kg/m2 ([10.2525/jshita.12.217](https://doi.org/10.2525/jshita.12.217), **B**, transfer). Condensate was
90 to 95 percent of evapotranspiration **plus humidifier input**, not of transpiration alone: humidifier water
was 39.8 percent of combined vapour input. A tool that sizes dehumidification from crop transpiration alone
therefore under-sizes whenever a humidifier runs, and crop-only condensate cannot be uniquely attributed
without a tracer.

Everything else in this domain is modeled. The prominent climate and façade comparisons
([10.1016/j.enconman.2021.114336](https://doi.org/10.1016/j.enconman.2021.114336),
[10.1016/j.apenergy.2020.114544](https://doi.org/10.1016/j.apenergy.2020.114544), both **C**) divide simulated
electricity by modeled production. No measured plant-factory-against-greenhouse pair in the same hot-humid
climate was found, and no isolated envelope or airtightness intervention. Insulation changes heat transfer;
airtightness changes vapour transport; the literature routinely conflates them.

## 5. The crop band: the assumption that drives the entire bill

This is the most uncomfortable result in the review. **No measured study establishes how far a humid-climate
grower can relax the humidity ceiling, or what each degree of dew-point relaxation buys in electricity at
unchanged saleable yield.** The whole dehumidification bill is set by that ceiling, and the ceiling is an
assumption.

What measurement does establish is that the ceiling cannot be a single number:

- **A universal safe RH for Botrytis does not exist.** Tomato flower infection persisted at 56 percent RH, and
  wounded-stem infection was no worse under VPD below 0.2 kPa than above 1.3 kPa, although low VPD increased
  sporulation and prolonged wound susceptibility
  ([10.1046/j.1365-3059.1996.d01-163.x](https://doi.org/10.1046/j.1365-3059.1996.d01-163.x),
  [10.1094/PDIS.1997.81.1.36](https://doi.org/10.1094/PDIS.1997.81.1.36), both **B**, inoculation experiments).
  Infection, wound healing and sporulation respond differently, so one house-RH threshold cannot represent
  them.
- **Leaf wetness beats RH as the risk variable.** A fitted response for inoculated cucumber downy mildew
  reaches 15 percent infected leaf area after 2 h of wetness at 20 C or 3 h at 25 C
  ([10.1094/PDIS-07-11-0560](https://doi.org/10.1094/PDIS-07-11-0560), **B** measurements, **C** fitted
  contour). These are equal-severity contours, not zero-risk limits.
- **Drier is not automatically better.** Lowering daytime RH from 74 to 51 percent retarded lettuce growth
  while delaying tipburn, and lowering *night* RH from 95 to 90 percent reduced growth and calcium and brought
  tipburn forward ([10.21273/JASHS.109.2.128](https://doi.org/10.21273/JASHS.109.2.128), **B**, chambers,
  cool nights). In tomato, continuously high humidity raised early yield but reduced final yield, fruit weight
  and keeping quality ([10.1080/00221589.1990.11516061](https://doi.org/10.1080/00221589.1990.11516061), **B**).
- **The famous VPD-control result is the opposite intervention.** A 22.7 percent tomato yield gain from
  fogging was measured against an unhumidified high-VPD control whose midday air also fell from 38.5 to 31.3 C,
  so cooling and humidification are confounded, and the baseline was dry-stressed rather than humid
  ([10.1038/srep43461](https://doi.org/10.1038/srep43461), **B**, transfer). It does not license raising the
  ceiling in a house already near saturation.

**Air movement is agronomy, not dehumidification.** Redesigned air distribution cut the spatial coefficient of
variation of lettuce shoot dry mass from 23.01 to 12.59 percent, but the campaigns ended at different ages and
no fan energy was metered ([10.3389/fpls.2020.00537](https://doi.org/10.3389/fpls.2020.00537), **B**,
transfer). Recirculation redistributes moisture; it does not remove water from the house.

**Screens do not universally wet the crop.** Under an aluminized thermal screen, measured canopy temperature
rose and canopy-to-air VPD increased in the lower crop layer
([10.13031/2013.15636](https://doi.org/10.13031/2013.15636), **B**, winter roses, transfer). Air RH alone is
insufficient to predict condensation risk, because what matters is leaf temperature against air dew point.

## 6. What this means for this tool

The tool's Miami verdict is that pad-and-vent reaches 7.8 percent joint-band attainment, pads plus a
dehumidifier 9.8 percent, desiccant with evaporative cooling 10.5 percent, and DX with a dehumidifier
59.7 percent, with 3,904 moisture-limited against 3,495 temperature-limited hours in a median year and 21
pad-effective hours ([REGIONS.md](REGIONS.md)). The literature **cannot confirm those numbers**, because no
measured hot-humid comparison exists. What it can do is tell us which of them rest on defensible physics and
which rest on assumptions, and in which direction each assumption is likely to be wrong.

**Consistent with measurement and physics**

- The collapse of evaporative cooling in Miami follows from the wet-bulb floor, which is thermodynamic. Our
  21 pad-effective hours is a model result, but its direction is not in question.
- Outside air cannot be the dehumidifier when the outdoor humidity ratio exceeds the zone's. Our engine already
  refuses to let it, and the mechanism is conservation rather than assumption.
- Sensible cooling being mandatory in Miami matches the only measured operational conclusion available, that
  ventilation-based moisture control fails in warm humid periods
  ([10.13031/aea.31.10723](https://doi.org/10.13031/aea.31.10723)).
- Our tropical indoor result, where cooling dominates the bill, matches the one measured tropical end-use split,
  where air conditioning exceeded lighting at 50.5 against 36.0 percent.
- Our shipped condensing-dehumidifier assumption of 2.5 L/kWh sits inside the only measured horticultural band
  found, 2.0 to 3.1 kg/kWh. That is the closest thing to external corroboration of an equipment assumption in
  this repository, and it is still a Mediterranean-winter transfer.

**Two known biases that pull in opposite directions**

1. **Our weather may be too dry.** MERRA-2 moisture near the Gulf is reported as "generally lower" than both
   ERA5 and soundings ([10.1175/JCLI-D-20-0484.1](https://doi.org/10.1175/JCLI-D-20-0484.1), **B**, 3.7 million
   soundings at 232 stations, 1980 to 2018). That is a mixed-layer mixing-ratio result at sounding hours, not a
   signed 2 m dew-point bias, and **no published signed seasonal 2 m dew-point bias for Miami or a matched
   humid-coastal station set was found.** If such a dry bias exists at the surface, our moisture-limited hour
   count and latent design condition are optimistic. We will not apply a guessed correction.
2. **Our crop moisture may be too high.** The best humid-climate Stanghellini validation reports RMSE of 18 and
   34 W m-2 using within-canopy inputs at 0.5 m against 29 and 56 W m-2 using above-canopy inputs at 1.8 m, with
   above-canopy predictions exceeding measured transpiration by 17.14 and 27.65 percent
   ([10.3390/w12020517](https://doi.org/10.3390/w12020517), **B**, Zhenjiang, two nine-day windows, locally
   parameterized resistances). Our implementation assumes canopy temperature equals air temperature and does not
   use within-canopy sensors, so our latent load is more likely overstated than understated.

So the first bias inflates the apparent ease of a humid site and the second inflates its apparent difficulty.
Neither is quantified for our configuration, and they do not cancel in any way we can claim.

**Three places the evidence says our documentation is wrong or incomplete**

1. **Design-condition naming.** ASHRAE is explicit that latent sizing belongs to the dew-point family: "Design
   conditions based on dew-point temperatures are directly related to extremes of humidity ratio, which
   represent peak moisture loads from the weather" (2017 Fundamentals, Chapter 14). We already compute separate
   0.4, 1 and 2 percent exceedances for dry bulb, wet bulb and dew point, so the crude error is absent. But
   ASHRAE's mean coincident dry bulb is obtained "by double-binning the hourly data into joint frequency
   matrices, then calculating the mean coincident value corresponding to the simple design condition", whereas
   we report the coincident state of the single ranked threshold hour. **That is a different and noisier
   statistic and must not be called MCDB.** ASHRAE's nominal record is also 25 years, 1990 to 2014 for most
   stations, against our ten reanalysis years.

   Our own Miami record shows why the distinction is not pedantic. At the 0.4 percent level the design dry bulb
   is 31.6 C with a coincident wet bulb of 25.7 C, while the design dew point is 26.2 C at a coincident dry bulb
   of 29.0 C. **The peak moisture hour is not the peak temperature hour.** Sizing latent equipment from the
   hottest hour would understate the moisture load, which is exactly the error ASHRAE's separate dew-point
   family exists to prevent.
2. **Rated dehumidifier efficiency is not operating efficiency.** DOE and AHAM rate portable units at 18.3 C
   and 60 percent RH and whole-home units at 22.8 C and 60 percent RH, over a two-hour test, with integrated
   energy factor including prescribed low-power terms (10 CFR 430 Appendix X1). A crop room near 26 C is 3 to 8
   K away from those rating points. Our L/kWh input is a single number where the physics needs a performance
   map.
3. **We do not model the screen ventilation penalty.** The measured Thai result is that finer insect screens
   cut ventilation by about 35 and 50 percent and raised indoor moisture accumulation. Our tool takes
   `maxVentACH` as a user input with no screen-dependent derate, so a user who fits fine mesh in the tropics
   will get an optimistic ventilation answer unless they lower that input themselves.

**What would settle the tool's Miami verdict**: one instrumented hot-humid facility running two strategies
against a shared band, with separated metering of compressors, pumps, fans, reheat and heat rejection,
collected condensate, a closed crop water balance, and reported out-of-band hours. That experiment does not
appear to exist. Until it does, our Miami numbers are a screening result whose direction is defensible and
whose magnitude is unvalidated, which is exactly the evidence tier this repository claims.

## 7. Named gaps, and the measurement that would close each

| Gap | What would close it |
| --- | --- |
| Most energy-efficient moisture removal in hot-humid service | Co-located or crossover campaign, same crop, leaf area, band, light and CO2; separate meters for compressor, pumps, fans, reheat, heat rejection, regeneration; collected condensate; reported out-of-band hours |
| Outdoor dew point at which pads stop paying | Pad-on/off crossover stratified by outdoor dew point, with leaf wetness, disease incidence, marketable yield and joint-band attainment |
| Fog plus forced ventilation against pad-and-fan | Matched hot-humid comparison at equal crop load and band, metering pump and fan energy, and supplied against evaporated water |
| Desiccant against a cooling coil in a crop house | Matched measured baseline, electrical and thermal kWh reported separately, storage state balanced over the campaign |
| Tropical plant factory kWh per saleable kg | Whole-facility meters plus trimmed saleable mass and discard rate, with boundaries and area denominators stated |
| Safe humidity relaxation, and its energy value | Replicated or crossover compartments at equal temperature, light and CO2, measuring saleable yield, quality, disease, leaf wetness, condensate and component electricity |
| Reanalysis surface humidity bias in humid coastal sites | Coincident station temperature, dew point and pressure against NASA POWER at the site, stratified by hour and season, with tail quantiles, reporting the change in annual hour classification |
| An open hot-humid benchmark dataset | Released measured time series with indoor and outdoor climate, HVAC electricity, condensate, runtime, sensor uncertainty, crop and LAI, across wet and dry seasons |

Datasets that exist but do not close the last gap: the GreenLight trial observations, 5-minute data over 112
days from Bleiswijk, CC BY-SA 4.0
([10.4121/78968e1b-eaea-4f37-89f9-2b98ba3ed865.v2](https://doi.org/10.4121/78968e1b-eaea-4f37-89f9-2b98ba3ed865.v2),
Dutch winter, no facility electricity series); and a Korean commercial paprika campaign at 10-minute and hourly
resolution over 278 days, CC BY 4.0 ([10.17632/mwg293k2r9.1](https://doi.org/10.17632/mwg293k2r9.1), heating is
simulation only). GreenLight itself is validated against Dutch measurements at temperature RMSE 1.74 to 2.04 C
and RH RMSE 5.52 to 8.50 percentage points
([10.1016/j.biosystemseng.2020.03.010](https://doi.org/10.1016/j.biosystemseng.2020.03.010), **C**), and the
Vanthoor lineage is validated in temperate, Mediterranean and semi-arid climates only
([10.1016/j.biosystemseng.2011.06.001](https://doi.org/10.1016/j.biosystemseng.2011.06.001), **C**; its Texas
site is inland high-elevation semi-arid, not Gulf coast). **No greenhouse model reviewed here has a published
hot-humid latent validation.**

## 8. Excluded and corrected sources

- **Excluded.** A widely cited micro-fog tomato study carries a June 2026 publisher Editorial Note stating the
  environmental data originated at a different institution, dimensions were incorrect, and the editors could
  not verify provenance ([10.1371/journal.pone.0133919](https://doi.org/10.1371/journal.pone.0133919), note at
  [10.1371/journal.pone.0351610](https://doi.org/10.1371/journal.pone.0351610)). Its figures are not used here.
  It was also a continental-temperate site.
- **Corrected.** A warm-climate review describes the UAE case of a well-known plant-factory comparison as "hot
  and humid" ([10.3390/en12142737](https://doi.org/10.3390/en12142737)); that comparison's UAE scenario is
  hot-arid, and the comparison is simulation
  ([10.1016/j.agsy.2017.11.003](https://doi.org/10.1016/j.agsy.2017.11.003), **C**).
- **Corrected.** The MARDI HVAC share is 50.5 percent in the primary audit, not the 54 percent that appears in
  a downstream review.
- **Vendor tier.** A commercial greenhouse simulation product advertises "proven algorithms" with no validation
  sample, uncertainty or open data on the inspected page: **E**.

## 9. How this review was done, and its limits

Six independent searches ran in parallel on 2026-09-14 using OpenAlex, Crossref, Semantic Scholar, DataCite,
publisher pages, open-access repositories and a browser for pages requiring JavaScript. The session's
general-purpose web search was unavailable, so bibliographic APIs and direct reads did the work. Two OSTI PDFs
were extracted locally to resolve claims their abstracts stated ambiguously.

Limits a reader should hold against this document:

- **These are bounded searches, not systematic reviews.** Every absence recorded here means "not verified in
  this review", not "does not exist". Publisher blocks, rate limits and paywalls all bit. Two liquid-desiccant
  greenhouse pilots remain unresolved full texts
  ([10.1016/j.csite.2024.105165](https://doi.org/10.1016/j.csite.2024.105165) in particular), which is why the
  desiccant verdict is worded as no verified comparison rather than none existing.
- Several strong-looking sources were graded down after reading methods rather than abstracts. Where only an
  abstract was accessible, the entry says so.
- No number in this document was measured by us. Every figure carries its source, and figures we derived by
  arithmetic from a source are labeled as derived.
