# Example scenario library

Purpose: importable comparison sets that each answer one design question, so the tool can be judged on a real question rather than on defaults.

Status: 2026-09-14, model `0.2.0-screening`. Every set is exercised by `test/examples.test.mjs` on a real weather week and must simulate with zero numerical failures.

Read this if: you want a worked comparison to start from, or you are adding one.

## How to use

Load a weather record first (the bundled Tulsa example is enough), then **Import JSON / CSV** and pick a file below. Every scenario in a set shares the site, crop band and geometry, so the comparison isolates the strategy. Import replaces the scenarios in your workspace, so export anything you want to keep first.

| Set | Question it answers | Scenarios |
|---|---|---|
| [decoupling-study.json](decoupling-study.json) | Is it cheaper to overcool and reheat, or to handle latent separately? | Coupled coil with reheat, dry-neutral DOAS, desiccant with evaporative cooling, liquid-desiccant hybrid |
| [indoor-microgreen-racks.json](indoor-microgreen-racks.json) | What does an opaque indoor rack farm cost when lighting is the whole sensible load? | DX with dehumidifier, DOAS, integrated HVAC with reheat |
| [mushroom-room.json](mushroom-room.json) | Can generic equipment hold a near-saturated fruiting band? | DX with dehumidifier, integrated HVAC with reheat |
| [propagation-nursery.json](propagation-nursery.json) | When the moisture ceiling binds rather than temperature, what closes the gap? | Pad and vent, pads with dehumidifier, DOAS |
| [hybrid-tomato.json](hybrid-tomato.json) | How does a semi-closed house with a tall, high-LAI crop behave? | Integrated HVAC with reheat, DOAS, pads with dehumidifier |

The canonical six-strategy comparison used throughout the documentation stays at [../example-scenarios.json](../example-scenarios.json).

## What these sets showed on Tulsa 2025

Measured with the bundled 2025 record, staged controller, Stanghellini transpiration, one-minute dispatch. These are screening figures under declared assumptions, not performance data.

| Set | Result worth knowing |
|---|---|
| Decoupling study | The dry-neutral DOAS held the band slightly better than the coupled coil (56.2% against 55.3%) on 14% less purchased electricity (211,807 against 246,930 kWh), while shifting load to fuel (417,992 against 367,321 kWh). Whether that trade is worth making depends entirely on your electricity-to-fuel price ratio, which is an editable input. |
| Propagation nursery | The clearest case for decoupling in the library: DOAS reached 52.7% against 28.2% for pad and vent, because the binding constraint is the moisture ceiling and a pad adds moisture. |
| Indoor microgreen racks | Highest attainment anywhere in the library (93.0% for DX with dehumidifier), which is what a closed box with no solar gain and generous installed capacity should give. It is also the most electricity-hungry at 344,528 kWh. |
| Mushroom room | Neither strategy holds the band: 35.9% and 22.0%. The 0.1 to 0.3 kPa VPD target with a 12-hour dark cycle is tight, and the generic capacities are not sized for it. This is reported rather than tuned away: the honest reading is that a mushroom room needs purpose-built equipment assumptions, not that the strategies failed. |
| Hybrid tomato | Attainment sits in a narrow 45.1 to 51.5% band across three very different strategies, so at this crop band the classes are closer than the capital difference between them suggests. |

## Adding a set

Keep them comparisons, not single scenarios: the tool's output is a ranking, and a lone scenario has nothing to rank against. Hold the site, crop and geometry constant so only the strategy varies, or state in `note` exactly which other input moves and why. Every set needs `schemaVersion: 1`, a `note` that says what the set demonstrates, and at least two scenarios with distinct names. Run `node --test test/examples.test.mjs` before proposing it.

Do not add a set whose equipment assumptions you cannot state. A preset that looks authoritative and is not sourced is worse than no preset.
