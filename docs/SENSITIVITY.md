# Structural sensitivity: Morris screening

Purpose: identify assumptions worth measuring, not quantify a probability of success.

Status: regenerated 2026-09-15, model `0.3.0-screening`, scenario schema 2. [morris-screening.json](morris-screening.json) is the primary record, artifact envelope 2. It contains 1,872 simulations, 104 design points, eight trajectories, twelve parameters, and zero numerical-failure hours. Numeric results are regenerated, not inherited from model 0.2.0.

## Method

A seeded Morris design walks one parameter at a time on a four-level unit-cube grid. Each of eight trajectories visits k + 1 = 13 design points, changing every parameter once with delta = 2/3. Seed is 1. For each step, EE = (metric after − metric before) / delta, so effects are expressed per full screened parameter range, not per one physical unit.

- mu* is the mean absolute elementary effect, the influence ranking.
- mu is the signed mean, which indicates direction.
- sigma is variation among effects, indicating interaction or nonlinearity, not an uncertainty interval.
- n is usable step pairs, eight per aggregate metric here. Missing pairs are omitted, not zero-filled.

Each design point evaluates six canonical strategies in Tulsa weather years 2023, 2024 and 2025. Each year uses 120 evenly spaced whole local days, 2,881, 2,880 and 2,881 weather hours respectively, allowing local-day DST duration. A sampled segment's first hour is warm-up and is excluded from attainment but not from energy/water. For each strategy take the median of its yearly sampled-period metric; headline influence is the unweighted mean of those six strategy medians. It is not a sum over 360 days and is not an annualized result. Per-strategy `metric@technology` effects remain in the JSON.

Factor ranges multiply a scenario input, absolute ranges replace it, and configured field limits bound values. A zero factor input stays zero. Changing ranges can change the ranking. The model, topology and all unvaried performance assumptions stay fixed.

## Screened parameters

These are screening spans, not measured distributions or universal engineering limits. In particular, the infiltration span is 0.5 to 2 times the scenario value, not a published film/polycarbonate leakage range. Construction-specific UGA guidance belongs in [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md#outdoor-air-recovery-and-doas-model-030).

| Parameter | Range | Treatment |
|---|---|---|
| `uValue` | 0.7 to 1.4 | factor |
| `infiltrationACH` | 0.5 to 2 | factor |
| `lai` | 0.7 to 1.3 | factor |
| `padEffectiveness` | 0.7 to 0.9 | absolute |
| `coolingSHR` | 0.65 to 0.85 | absolute |
| `coolingCOP` | 0.8 to 1.25 | factor |
| `solarTransmission` | 0.85 to 1.15 | factor |
| `shadeFraction` | 0.1 to 0.4 | absolute |
| `solarHeatFraction` | 0.8 to 1 | absolute |
| `dehuLPerKWh` | 0.8 to 1.25 | factor |
| `maxVentACH` | 0.6 to 1.4 | factor |
| `thermalMassKJm2K` | 0.5 to 2 | factor |

## Measured influence

All columns are mu* per full screened range. Joint temperature-and-moisture attainment is measured in percentage points (pp); this averaged effect does not have a single pair of scenario endpoints. Costs and electricity are medians of sampled-period totals, not annual totals.

Operating costs include purchased electricity, purchased heating fuel and water represented by the scenario, using manual $0.12/kWh electricity, $0.045/kWh fuel and $0.002/L water. Excluded: installed capital, maintenance, labor, financing, taxes, demand charges, fixed charges, time-of-use effects and other unmodeled tariff components. Estimated or user-entered installed capital is separate. No modeled cost, difference or reduction is an equipment quote or guaranteed savings.

| Parameter | Joint attainment pp | Modeled sampled-period operating cost USD | Purchased electricity kWh |
|---|---:|---:|---:|
| `lai` | 9.098627 | 3247.612955 | 11322.291433 |
| `uValue` | 5.891623 | 1777.099755 | 3630.053174 |
| `shadeFraction` | 3.426230 | 1266.969710 | 7300.533653 |
| `coolingSHR` | 2.344026 | 678.484158 | 4591.726254 |
| `solarTransmission` | 2.259630 | 313.044450 | 422.490837 |
| `maxVentACH` | 2.164460 | 325.421215 | 4721.880387 |
| `solarHeatFraction` | 2.055792 | 210.310019 | 141.730610 |
| `infiltrationACH` | 1.768828 | 235.829680 | 292.560872 |
| `thermalMassKJm2K` | 1.502266 | 147.963740 | 613.464343 |
| `padEffectiveness` | 0.962948 | 23.623793 | 319.192142 |
| `dehuLPerKWh` | 0.081646 | 272.284192 | 2759.770466 |
| `coolingCOP` | 0.068473 | 646.466555 | 5837.980212 |

LAI/transpiration is the aggregate leader at **9.098627 pp per full screened range**. Maximum controlled outdoor-air capacity is **2.164460 pp**, distinct from uncontrolled infiltration. These findings guide which assumptions to investigate, not which equipment to purchase.

## Ranking stability verdict

Three complete operating-cost orders occur over 104 design points; the most common holds 61.5385%, below the pre-set 90% rule. The order is pad, dehu, desiccant, dx, hybridDesiccant, integrated. The cheapest strategy remains pad at every point, but being cheapest does not mean holding the target sufficiently often. The full ranking is unstable under the screened ranges.

The regional study retains a **5 pp joint-attainment capability tier** and a **16% operating-cost decision band** as methodological rules. This regeneration does not calibrate those thresholds, prove a 16% reorder boundary or make differences within 5 pp scientifically indistinguishable. No confidence interval, probability distribution, standard error or guaranteed savings is established.

## Reproduce

```sh
node scripts/morris-screening.mjs
node scripts/morris-screening.mjs --years 2016,2025 --trajectories 4 --days 60 --out /tmp/quick.json
node --test test/sensitivity.test.mjs
```

The full regenerated run recorded 418.7 seconds. Thread count affects elapsed time, not ordered numerical aggregation. Same seed, model, source weather and scenario inputs reproduce numerical outputs; timestamps and elapsed time differ. The source and artifact infiltration rationale received a metadata-only wording correction after regeneration; no design coordinate, observation or effect changed.

## Limitations

This is one site, three subsampled years, twelve continuous inputs and eight trajectories. The study does not sweep HRV/ERV performance or frost modes, DOAS supply targets/COP/reheat, movable-screen schedules, heat-pump rating tables, insect-screen factor, spatial gradients, CO2 feedback or manufacturer part-load behavior. It does not bound those uncertainties. A well-separated aggregate ranking can hide large strategy-specific effects; read the retained per-strategy results before deciding what to measure. Weather is historical gridded evidence, not a stationary probability distribution. Independent model benchmarking and measured-site calibration remain absent.
