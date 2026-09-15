# Tulsa 2026 observed weather-side operating windows

One Season Farmers Field document. Generator model 0.3.0-screening; scenario schema 2, weather snapshot schema 1. No indoor simulation or operating-cost estimate is performed.

6,064 valid of 6,087 expected hours. 23 missing. UTC bounds: 2026-01-01T06:00:00.000Z through 2026-09-11T21:00:00.000Z exclusive. Operational grouping uses America/Chicago, fixed 07:00–19:00 local daytime. No future months are invented.

## Interpretation

This is a thermodynamic opportunity screen, not a lowest-energy optimization or prediction of greenhouse indoor climate. Outdoor air can cool while importing moisture. Pads can fail their moisture ceiling even when their leaving dry-bulb clears the temperature limit. A high cold-air RH does not mean high absolute moisture. Heating plus drying ventilation can impose a substantial fuel penalty, which this weather-only study does not price.

## Base targets

Day: 80°F target, 85°F maximum, heat below 68°F, maximum dew point 62°F. Night: 65°F target, 70°F maximum, heat below 63°F, maximum dew point 60°F. Pad effectiveness 80%; leaving-air margin 5°F. Requested purge and humidification are explicit scenario assumptions, not observed indoor demand. Strong drying margin 0.002 kg/kg, meaningful margin 0.0005 kg/kg.

## Modes and calendar-day exposure

| mode | hours | daysAny | daysAtLeast4 | daysAtLeast8 | longestHours |
|---|---|---|---|---|---|
| ACTIVE_HUMIDIFICATION_LIKELY | 80 | 32 | 6 | 0 | 7 |
| HEAT_MAJOR_VENT_DRY | 2086 | 117 | 111 | 108 | 544 |
| HEAT_MIN_VENT | 97 | 29 | 11 | 2 | 12 |
| HEAT_VENT_HUMID | 73 | 21 | 9 | 1 | 9 |
| MISSING_DATA | 23 | 11 | 3 | 0 | 4 |
| NEUTRAL_MIN_VENT | 477 | 143 | 51 | 8 | 10 |
| PAD_EFFECTIVE | 67 | 24 | 8 | 0 | 9 |
| PAD_INEFFECTIVE_DEHU_NEEDED | 2300 | 155 | 140 | 118 | 46 |
| PAD_MARGINAL | 2 | 2 | 0 | 0 | 1 |
| PASSIVE_HUMIDIFY_OPPORTUNITY | 172 | 49 | 20 | 2 | 7 |
| PASSIVE_VENT_COOL_DRY | 302 | 76 | 39 | 5 | 9 |
| PASSIVE_VENT_COOL_HUMID | 408 | 101 | 39 | 16 | 12 |

## Sensitivity

| case | changedHours | padEffectiveHours | padMarginalHours | padFailedHours |
|---|---|---|---|---|
| base | 0 | 67 | 2 | 2300 |
| pad_0.7 | 21 | 64 | 17 | 2288 |
| pad_0.8 | 0 | 67 | 2 | 2300 |
| pad_0.85 | 7 | 61 | 1 | 2307 |
| pad_0.9 | 10 | 59 | 0 | 2310 |
| dewpoint_58F | 329 | 30 | 0 | 2339 |
| dewpoint_62F | 142 | 93 | 14 | 2262 |
| dewpoint_65F | 556 | 114 | 92 | 2163 |
| maximum_80F | 543 | 109 | 75 | 2686 |
| maximum_85F | 0 | 67 | 2 | 2300 |
| maximum_90F | 649 | 23 | 0 | 1699 |
| margin_3F | 2 | 69 | 0 | 2300 |
| margin_5F | 0 | 67 | 2 | 2300 |
| margin_8F | 31 | 36 | 33 | 2300 |
| cool_crop | 1595 | 89 | 2 | 3015 |
| warm_crop | 1355 | 59 | 3 | 1963 |

## Data and quality check

Primary: IEM KTUL/TUL routine reports, instantaneous values nearest hourly slot within 30 minutes, preserving the original timestamp. Pressure estimates from altimeter/elevation are flagged. Secondary: NOAA USW00013968 daily extrema for 251 dates, archived independently in data/reference (SHA-256 d949ea431578…) Compare ktul_2026_noaa_crosscheck.csv. Daily official extrema and local-civil hourly samples have different sampling/day conventions; differences are quality flags, not a calibration correction. NASA solar is separately labeled and is not needed to classify weather-side feasibility.

The appended HTML report includes the monthly mode chart, day/hour map, DB/DP and DB/WB scatters, heating-moisture comparison, monthly percentile table and episode table. UTC timestamps disambiguate DST folds in the CSV.

## Limits

- No glazing, greenhouse air temperatures, actual crop moisture, HVAC loads or equipment tonnage can be inferred from these mode counts.
- Pad leaving air is not indoor temperature. The 5°F margin is an adjustable planning proxy.
- Major ventilation can conflict with CO₂ enrichment, filtration, pests, smoke, wind and rain.
- Pad fouling, freeze protection, water quality, water temperature, bleed, fan/pump parasitics and control delays are not modeled here.
- The requested dates are a partial observed year, not a typical meteorological year, extreme-design specification or annual efficiency result.
- Primary modes prioritize the documented threshold rules; secondary flags retain competing opportunities and limitations.

## Reproduction and provenance

Run `node scripts/reference-study.mjs` from the application folder. Optional arguments: snapshot JSON path and output directory. Change the explicit base/cases object for alternate targets. Refresh station data with scripts/fetch-observed.mjs, keeping the original payload. Inspect manifest.json, the input SHA-256 and source URLs. PsychroLib 2.5.0 uses SI; source units and target conversions are in the manifest.

Sources: [IEM](https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=TUL&data=tmpf%2Cdwpf%2Crelh%2Csknt%2Calti&sts=2026-01-01T05%3A30%3A00.000Z&ets=2026-09-11T21%3A16%3A26.141Z&tz=UTC&format=onlycomma&latlon=yes&elev=yes&missing=M&report_type=3), [NOAA daily summaries](https://www.ncei.noaa.gov/access/services/data/v1), [PsychroLib](https://github.com/psychrometrics/psychrolib).
