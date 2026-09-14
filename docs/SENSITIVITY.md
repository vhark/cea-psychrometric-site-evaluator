# Structural sensitivity: Morris screening

Purpose: report which assumptions actually move the answer, and whether the strategy ranking survives them.

Status: executed 2026-09-14 for model `0.2.0-screening`, roadmap milestone **M3** ([DIGITAL-TWIN.md](DIGITAL-TWIN.md)) complete.
Measured run: [morris-screening.json](morris-screening.json), Tulsa 2023 to 2025, 120 sampled days per year,
8 trajectories over 12 parameters (104 design points), six example strategies, 1,872 full simulations, 290 s.

**Coverage limit, stated because it is easy to miss:** those 12 parameters are the ones that existed when the
screening ran. Components added since have **never been screened**: movable shade and thermal screens, the
air-source heat-pump rating points, the envelope ladder entries, and the insect-screen ventilation factor. The
ranking-stability verdict below therefore says nothing about them. Section 7 of
[COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md) lists what a next screening pass should vary, and the
control-class results in [CLASSES.md](CLASSES.md) are single-point runs rather than screened ranges.

Read this if: you are deciding what to measure first at a real site, or judging how much weight a cost ranking can carry.

## What this is, and what it is not

Morris elementary effects is a **screening** method. It answers one question: which assumptions move the
answer enough to be worth measuring next. It does that with a small number of one-at-a-time model
evaluations spread over the parameter space, so it can afford the real coupled simulation instead of a
surrogate.

It does **not** produce a probability distribution over outcomes, a confidence interval, a standard error
on cost or attainment, or a probability that one strategy beats another. The screened ranges are defensible
engineering spans, not fitted or elicited priors, and the sample is a space-filling design, not a Monte
Carlo draw from anything. Any statement of the form "cost is 11,000 dollars plus or minus X with 95%
confidence" is unsupported by this file and by the model behind it. Quantified uncertainty needs
calibration against measurements, which is milestone M6, not M3.

What M3 does earn: every strategy comparison can now carry a computed label, "ranking stable" or "ranking
unstable under the screened ranges", instead of a prose disclaimer that close rankings are exploratory.

## Method

For `k` parameters mapped to the unit cube, a Morris trajectory starts at a random point of a `p`-level grid
(`p = 4`) and then moves **one parameter at a time** by a fixed step `delta = p / (2(p-1)) = 2/3`, visiting
`k + 1` points. With an even number of levels exactly one direction of that step stays inside `[0, 1]`, so
the walk never needs rejection and every parameter moves exactly once per trajectory.

The elementary effect of the parameter changed at step `j` is

```
EE = ( y(step j) - y(step j-1) ) / delta
```

with `y` the model metric and `delta` the step **in unit space**. An effect is therefore the metric change
that parameter would cause over its whole screened range, which makes parameters with different physical
units directly comparable. Over the trajectories, each parameter and metric gets:

- **mu\*** = mean absolute effect. The influence ranking. Robust to a response that changes sign.
- **mu** = mean signed effect. The direction (a positive `mu` for cost means raising the parameter raises cost).
- **sigma** = standard deviation of the effects. Large relative to `mu*` means the effect depends on where
  the other parameters are, that is, interaction or non-linearity, not sampling noise.
- **n** = number of usable step pairs (8 here; a pair is dropped, never zero-filled, if a metric is missing).

Sampling is a seeded `mulberry32` PRNG, so a seed plus the inputs reproduces the design exactly. Every
sampled value is clamped to the editable field limits in `src/config.js`, so each design point is a scenario
the interface would accept. `factor` parameters multiply the scenario's own value (so a 500 m² pad house and
an opaque indoor room are perturbed proportionally, and a zero stays zero); `absolute` parameters replace it.

**Metrics.** Each design point runs all six example strategies over all three weather years. Per strategy
the three metrics are taken as the median over years, exactly as the interface aggregates a multi-year run.
The headline metric is the unweighted mean of the six strategy medians (the level of the whole screen's
answer); per-strategy values are kept in the JSON under `metric@technology`.

**Weather subsampling.** Each year is reduced to 120 evenly spaced **whole local days** (2,880 hours), so
one screening run is 1,872 simulations rather than 5,500 hours of compute. Costs and kWh in this document
are therefore totals over the 360 sampled days, not annual figures. Each sampled day is a separate
continuous segment, so the simulator spends its first hour as controller warm-up and excludes it from
compliance. That cost is identical at every design point, which is what a comparison of effects requires.

## Screened parameters

Twelve parameters, the ones that are both influential in principle and genuinely uncertain in a screening
deployment. Ranges are engineering spans with a stated reason, not distributions.

| Key | Quantity | Screened range | Why this range |
|---|---|---|---|
| `uValue` | Envelope U-value | × 0.7 to × 1.4 | Nominal U-values are quoted for clean, still, new assemblies. Aged, dirty, wind-exposed envelopes with unaccounted thermal bridges run higher; a tight double layer runs lower. Roughly 3 to 6 W/m²K around the 4 W/m²K default. |
| `infiltrationACH` | Air leakage | × 0.5 to × 2 | Greenhouse leakage is almost never blower-door measured. Published envelope leakage for film and polycarbonate houses spans about half to twice a nominal 0.3 ACH, and rises with wind. |
| `lai` | Crop transpiration scale (LAI, and the L/m²/day fallback) | × 0.7 to × 1.3 | Leaf area index moves through the crop cycle, between cultivars and with plant density; Stanghellini transpiration scales with it. The declared L/m²/day schedule is scaled by the same factor so scheduled scenarios respond identically. |
| `padEffectiveness` | Pad saturation effectiveness | 0.70 to 0.90 | Cellulose pad manufacturer data: about 0.70 for 100 mm media at high face velocity to about 0.90 for 200 mm media at low face velocity. Fouling and uneven wetting sit at the low end. |
| `coolingSHR` | DX sensible heat ratio | 0.65 to 0.85 | Coil sensible heat ratio at CEA entering conditions depends on coil rows, airflow and entering wet bulb. This span covers ordinary equipment without an equipment map (milestone M4). |
| `coolingCOP` | Cooling COP | × 0.8 to × 1.25 | A single constant COP stands in for condensing temperature, part-load degradation and fan power. Seasonal performance around a nominal 3 commonly lands within minus 20 to plus 25 percent. |
| `solarTransmission` | Thermal solar transmission | × 0.85 to × 1.15 | Glazing transmission falls with age, dust and condensation, and varies with structure shading and incidence angle; a nominal value is a clean-new figure. |
| `shadeFraction` | Shade fraction | 0.10 to 0.40 | Operational shading ranges from light screening to heavy summer whitewash or a deployed screen. It is a management decision, not a fixed property, so it is screened as an absolute range. |
| `solarHeatFraction` | Absorbed share of transmitted solar | 0.80 to 1.00 | Not all transmitted shortwave becomes zone sensible heat in the same hour: part is reflected back out, part is absorbed by floor and structure and released later or conducted away. This brackets the single-zone assumption. |
| `dehuLPerKWh` | Dehumidifier efficiency | × 0.8 to × 1.25 | Rated L/kWh is measured at a test point (typically warm and humid). Field performance at CEA dew points and part load differs, and integral fan and control power is often excluded from the rating. |
| `maxVentACH` | Installed maximum ventilation | × 0.6 to × 1.4 | Fan tables are free-delivery ratings; achievable airflow depends on pad and louver pressure drop, wind and inlet area. Natural vent capacity depends on wind and stack, which this screen does not resolve (milestone M4). |
| `thermalMassKJm2K` | Effective thermal mass | × 0.5 to × 2 | The capacitance actually coupled to zone air on hourly timescales (floor surface layer, benches, growing medium, structure) is never measured for a screen; half to twice a nominal 100 kJ/m²K is the honest span. |

## Measured ranking

`n = 8` step pairs for every parameter and metric; no design point failed numerically (0 excluded hours over
1,872 simulations). Effects are per full screened range, over the 360 sampled days, averaged over the six
strategies.

### Joint-band attainment (percentage points)

| Rank | Parameter | mu\* | mu | sigma | sigma / mu\* |
|---|---|---:|---:|---:|---:|
| 1 | `lai` | 9.10 | -9.10 | 3.89 | 0.43 |
| 2 | `uValue` | 5.89 | -5.89 | 1.86 | 0.32 |
| 3 | `shadeFraction` | 3.43 | 3.43 | 1.70 | 0.50 |
| 4 | `coolingSHR` | 2.34 | -2.34 | 1.46 | 0.62 |
| 5 | `solarTransmission` | 2.26 | -2.26 | 0.58 | 0.26 |
| 6 | `maxVentACH` | 2.16 | -2.16 | 2.16 | 1.00 |
| 7 | `solarHeatFraction` | 2.06 | -2.06 | 0.50 | 0.24 |
| 8 | `infiltrationACH` | 1.77 | 0.49 | 2.13 | 1.20 |
| 9 | `thermalMassKJm2K` | 1.50 | -1.50 | 1.07 | 0.71 |
| 10 | `padEffectiveness` | 0.96 | 0.96 | 0.34 | 0.36 |
| 11 | `dehuLPerKWh` | 0.08 | 0.04 | 0.09 | 1.11 |
| 12 | `coolingCOP` | 0.07 | -0.07 | 0.04 | 0.64 |

### Operating cost (dollars over the sampled days)

| Rank | Parameter | mu\* | mu | sigma | sigma / mu\* |
|---|---|---:|---:|---:|---:|
| 1 | `lai` | 3,248 | 3,248 | 246 | 0.08 |
| 2 | `uValue` | 1,777 | 1,777 | 123 | 0.07 |
| 3 | `shadeFraction` | 1,267 | 1,267 | 201 | 0.16 |
| 4 | `coolingSHR` | 679 | 679 | 156 | 0.23 |
| 5 | `coolingCOP` | 646 | -646 | 100 | 0.16 |
| 6 | `maxVentACH` | 325 | 267 | 210 | 0.65 |
| 7 | `solarTransmission` | 313 | -313 | 72.8 | 0.23 |
| 8 | `dehuLPerKWh` | 272 | -272 | 39.5 | 0.15 |
| 9 | `infiltrationACH` | 236 | 236 | 48.9 | 0.21 |
| 10 | `solarHeatFraction` | 210 | -210 | 65.9 | 0.31 |
| 11 | `thermalMassKJm2K` | 148 | 148 | 66.4 | 0.45 |
| 12 | `padEffectiveness` | 23.5 | -23.4 | 16.3 | 0.69 |

### Purchased electricity (kWh over the sampled days)

| Rank | Parameter | mu\* | mu | sigma | sigma / mu\* |
|---|---|---:|---:|---:|---:|
| 1 | `lai` | 11,325 | 11,325 | 1,491 | 0.13 |
| 2 | `shadeFraction` | 7,299 | 7,299 | 1,141 | 0.16 |
| 3 | `coolingCOP` | 5,838 | -5,838 | 921 | 0.16 |
| 4 | `maxVentACH` | 4,722 | 4,722 | 1,502 | 0.32 |
| 5 | `coolingSHR` | 4,594 | 4,594 | 1,130 | 0.25 |
| 6 | `uValue` | 3,629 | 3,629 | 1,117 | 0.31 |
| 7 | `dehuLPerKWh` | 2,761 | -2,761 | 461 | 0.17 |
| 8 | `thermalMassKJm2K` | 617 | 617 | 358 | 0.58 |
| 9 | `solarTransmission` | 422 | -308 | 377 | 0.89 |
| 10 | `padEffectiveness` | 319 | -319 | 167 | 0.52 |
| 11 | `infiltrationACH` | 293 | 270 | 275 | 0.94 |
| 12 | `solarHeatFraction` | 139 | -49.6 | 163 | 1.17 |

### Reading the ranking

- **Crop transpiration is the single most influential assumption on all three metrics**, and it is currently
  a client assumption (1.3 kg/m²/week × 9 L/kg for the lettuce preset), not a measurement. A 30% error in
  canopy leaf area is half the screened range, so it moves attainment by about 4.5 points, cost by about
  1,600 dollars over the 360 sampled days and electricity by about 5,700 kWh at this facility scale.
  Measuring transpiration, or at least LAI through
  the cycle, buys more accuracy than any equipment refinement. This directly orders milestone M4: the
  highest-value map is not the DX curve.
- **Envelope U-value is second on cost and attainment.** It is cheap to pin down (glazing spec plus an
  as-built inspection) and worth doing before any equipment selection.
- **Shade fraction is third**, and it is not a physical unknown at all: it is an operating decision. Its
  high rank says the shade schedule should be designed deliberately rather than inherited from a default.
- **`coolingCOP` is nearly irrelevant to attainment (rank 12) but fifth on cost and third on electricity.**
  That is the expected split: COP does not change what the equipment can hold, only what holding it costs.
  The same logic puts `dehuLPerKWh` near the bottom for attainment and mid-table for energy.
- **`padEffectiveness` ranks last or near last on every metric**, which agrees with the weather-side pad
  screen in [AUDIT.md](AUDIT.md): at Tulsa the pad clears both limits in only 244 hours a year, so pad
  quality has little leverage. Better pads do not fix a moisture-limited climate.
- **High sigma relative to mu\* flags interaction, not noise.** `infiltrationACH` (1.20 on attainment),
  `solarHeatFraction` (1.17 on electricity), `maxVentACH` (1.00 on attainment) and `dehuLPerKWh` (1.11 on
  attainment) all change sign or magnitude depending on where the other parameters sit; leakage helps in a
  cool dry hour and hurts in a humid one. Those four are exactly the parameters a variance-based method
  (Sobol, milestone M6 tooling) would need to resolve. Morris flags them; it does not decompose them.

## Ranking stability verdict

**Unstable under the screened ranges**, by the pre-set rule that one order must hold in at least 90% of
design points.

| Strategy order by operating cost | Points | Share |
|---|---:|---:|
| pad < dehu < desiccant < dx < hybridDesiccant < integrated | 64 | 61.5% |
| pad < dehu < desiccant < dx < integrated < hybridDesiccant | 23 | 22.1% |
| pad < dehu < desiccant < hybridDesiccant < dx < integrated | 17 | 16.3% |

Read the structure, not only the verdict:

- **The three cheapest positions are identical in 104 of 104 points**: pad, then pads with a condensing
  dehumidifier, then desiccant with evaporative cooling. That part of the ranking is stable.
- **All instability is inside the three most expensive strategies** (DX, liquid-desiccant hybrid, integrated
  HVAC with reheat), whose median costs over the sampled days sit within about 16% of each other
  (13,006 / 13,732 / 15,058 dollars), DX and the hybrid within 6%. Those three should be treated as a tie at screening resolution and
  separated on grounds this model does not carry: capital cost, maintenance, redundancy, supplier support.
- **The cheapest non-dominated strategy is the pad baseline in 100% of points.** That is a statement about
  the cost axis only: the pad baseline also holds the joint band in a median 28.9% of eligible hours, versus
  66.4% for DX. It is the cheap corner of the frontier, not a recommendation.

Per-strategy spread over the 104 screened points, for context:

| Strategy | Median cost | Cost range | Median attainment | Attainment range |
|---|---:|---:|---:|---:|
| pad | 7,321 | 5,523 to 8,953 | 28.9% | 21.8 to 34.7 |
| dehu | 9,205 | 6,871 to 11,799 | 45.5% | 38.7 to 55.6 |
| desiccant | 10,232 | 7,129 to 13,017 | 53.6% | 43.3 to 59.5 |
| dx | 13,006 | 9,305 to 18,190 | 66.4% | 49.3 to 76.7 |
| hybridDesiccant | 13,732 | 9,576 to 17,879 | 56.2% | 43.3 to 62.5 |
| integrated | 15,058 | 10,479 to 20,170 | 55.1% | 45.5 to 71.9 |

The ranges above are the span of the screening design, not a predictive interval.

## Reproduce

```sh
node scripts/morris-screening.mjs                      # the committed run: 2023-2025, 8 trajectories, 120 days
node scripts/morris-screening.mjs --years 2016,2025 --trajectories 4 --days 60 --out /tmp/quick.json
node --test test/sensitivity.test.mjs
```

Same seed and same inputs give byte-identical output apart from `generatedAt` and `runtimeSeconds`. Work is
split over worker threads for wall time only (`--concurrency`, default: one less than available
parallelism, capped at 8); each design point is independent
and results are re-ordered by the design before any statistic is computed, so thread count cannot change a
number. The committed run took 290 s on 8 threads.

`src/sensitivity.js` is importable without a DOM: `MORRIS_PARAMETERS`, `morrisDesign`, `applyPoint`,
`elementaryEffects`, `rankByMuStar`, `rankingStability`.

## Limitations

- **Screening, not uncertainty quantification.** Repeated for emphasis: no distributions, no intervals, no
  probability that a strategy wins. See the opening section.
- **Ranges are judgement.** Each has a stated rationale, but widening or narrowing a range moves that
  parameter in the ranking roughly in proportion. The ranking is conditional on the table above.
- **Only 12 continuous parameters are screened.** Structural choices are not: controller logic (staged
  versus ideal), the single-zone well-mixed assumption, constant equipment performance, hourly weather
  interpolation, the absence of spatial gradients and crop physiology. A structural error is not bounded by
  any of these effects, and the largest remaining errors are probably structural.
- **Subsampled weather.** 120 days per year, three years, one site (Tulsa). Effects are averaged over that
  sample; a different climate reorders parameters (a humid coastal site would raise `padEffectiveness` and
  `dehuLPerKWh`).
- **Eight trajectories** is a small sample by Morris convention (10 to 20 is typical). The top of the
  ranking is well separated (`lai` leads the second-place parameter by 54% to 83% on every metric) and is
  not sensitive to that; parameters separated by less than their sigma, such as `coolingSHR`,
  `solarTransmission`, `maxVentACH` and `solarHeatFraction` on attainment, are not reliably ordered against
  each other. Raise `--trajectories` before quoting those positions.
- **Effects are averaged over the six strategies.** A parameter that matters enormously to one strategy and
  not at all to the others is diluted in the headline ranking. The per-strategy effects are computable from
  the `metric@technology` entries in the JSON, which the file retains for every point.
