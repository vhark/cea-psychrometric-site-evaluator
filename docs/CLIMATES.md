# Bundled climates: the five sites, their provenance and their limits

Purpose: state exactly which hourly weather ships with this repository, where each byte came from, what the bundled years measure, and what a reader must not conclude from them.

Status: five sites bundled, 22 complete calendar years. Tulsa 2025 was retrieved 2026-09-11 and its other nine years 2026-09-13; the four climate archetypes (Phoenix, Miami, Denver, Seattle) 2023 to 2025 were retrieved 2026-09-14, all with NASA POWER Hourly API `v2.10.0`. Every profile figure below was computed from the committed files, not quoted from a climate summary. Staleness is tracked by `node scripts/check-vintages.mjs` against `data/weather/index.json`.

Read this if: you are choosing which bundled site or year to run, quoting a climate figure out of this tool, or adding a site of your own.

## What is bundled

| Site | Key | ZIP | Latitude | Longitude | Time zone | Source elevation (m) | Years | Snapshot bytes |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | ---: |
| Tulsa, OK | `tulsa` | 74103 | 36.15 | -95.99 | America/Chicago | 249.54 | 2016 to 2025 (10) | 21,452,683 |
| Phoenix, AZ | `phoenix` | 85004 | 33.4484 | -112.074 | America/Phoenix | 494.49 | 2023, 2024, 2025 | 6,435,616 |
| Miami, FL | `miami` | 33101 | 25.7743 | -80.1937 | America/New_York | 2.81 | 2023, 2024, 2025 | 6,524,187 |
| Denver, CO | `denver` | 80202 | 39.7392 | -104.9903 | America/Denver | 2,094.96 | 2023, 2024, 2025 | 6,437,909 |
| Seattle, WA | `seattle` | 98104 | 47.6062 | -122.3321 | America/Los_Angeles | 110.01 | 2023, 2024, 2025 | 6,438,722 |

Each site-year is a single self-contained JSON file, `data/weather/<key>-<year>.json`, between 2.14 and 2.18 MB, listed for the application in `data/weather/index.json`. The four archetypes add **25,836,434 bytes (25.8 MB) of snapshots**, plus **11,846,117 bytes (11.8 MB) of retained original API responses** and 12 checksum files, for **37,683,550 bytes (37.7 MB) added in total**. Only the snapshot of the selected year is fetched by the browser; the retained responses are provenance, not runtime payload.

The application matches a bundled site by coordinates within 0.001 degrees, so the latitude and longitude above are the exact query coordinates used by `scripts/fetch-weather.py` and must stay identical in the fetcher registry, in `index.json` and in every snapshot. Changing a coordinate silently unbundles that site.

Source elevation is POWER's own `geometry.coordinates[2]` for the returned point, read from `raw[0].payload.geometry.coordinates` inside each snapshot. It is the source grid's elevation, **not a surveyed site elevation**, and it is what makes the reported station pressure what it is.

### Checksums and manifest

There is no combined weather manifest. Integrity is per file:

- `data/weather/<key>-<year>.sha256` holds one `sha256  filename` line for that snapshot, for example `759508251c4233b8f4372a51ecbe0c5ef6138594725ad2e10357da1a1cb0270d  phoenix-2025.json`. The filename is relative, so verify from that directory: `cd data/weather && shasum -a 256 -c phoenix-2025.sha256` (checked for four of the new files on 2026-09-14, all `OK`).
- Inside each snapshot, `raw[]` carries, per API request, the request URL, the retrieval timestamp, the SHA-256 of the original response bytes, the retained filename under `data/weather/nasa-power-*.json`, and the full parsed payload including POWER's own header and version block.
- `data/weather/index.json` is the discovery index (key, label, ZIP, coordinates, time zone, climate label, source elevation, source, years, files). It carries no checksum of its own.

A re-fetch of an identical year reproduces identical meteorology but **not an identical SHA-256**: POWER echoes its own server-side timing (`times.data`, `times.process`) in every response, so the response bytes differ run to run. Verified on 2026-09-14 by re-fetching Tulsa 2025 into a scratch directory: all 8,760 hours, all three request URLs, all retained filenames and every header field were identical to the committed file, and the only differences anywhere in the snapshot were `retrievedAt` and those two timing numbers.

## Provenance, and what these numbers are not

Source: [NASA POWER](https://power.larc.nasa.gov/) hourly point API, `RE` community, `time-standard=UTC`, parameters `T2M`, `T2MDEW`, `RH2M`, `PS`, `ALLSKY_SFC_SW_DWN`, `WS2M`. Method and resolution per [POWER methodology](https://power.larc.nasa.gov/docs/methodology/): meteorology from MERRA-2 at 0.5 degrees latitude by 0.625 degrees longitude, solar from SYN1deg at 1 degree by 1 degree. POWER's fill value `-999.0` is preserved as `null`, never as a number.

Five statements that constrain every use of this data:

1. **This is gridded reanalysis at a ZIP centroid, not a measured facility site.** No station observed these hours. The returned point coordinates do not identify a grid-cell center, and a MERRA-2 cell is tens of kilometres across, so a single cell can mix downtown, water, farmland and higher terrain. Seattle's 2023 to 2025 minimum of -11.4 C and Miami's maximum of 33.0 C are cell values, not downtown thermometer values.
2. **Three years is not a climate normal.** A climatological standard normal is a 30-year average, and the current standard period is 1991 to 2020: WMO requires each member nation to compute 30-year averages and recommends a decadal update, per [NOAA NCEI, U.S. Climate Normals](https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals), which implements *WMO Guidelines on the Calculation of Climate Normals* (WMO-No. 1203, 2017). Three consecutive years measure three particular years. The spread in the per-year counts below shows how far a single year moves: Tulsa's hours above 30 C run 982, 1,117 then 634 across 2023 to 2025, a 483-hour swing between two neighbouring years at one site.
3. **A three-year site cannot carry a ten-year risk claim.** Only Tulsa has the ten years behind this repository's multi-year distribution evidence (see [VERIFICATION.md](VERIFICATION.md)). For the four archetypes, "median of three" and "worst of three" are the honest phrasings, and the worst of three is not a design year.
4. **Solar and meteorology have different footprints.** GHI comes from a 1-degree satellite product while temperature comes from a finer reanalysis, so a cloudy-hour disagreement between them is a property of the pairing, not an error to be smoothed.
5. **Hourly means are hourly means.** Each record is a UTC hour start with interval-mean meteorology, and GHI is Wh/m2 over that hour divided by one hour. Sub-hourly peaks, gust structure and short cloud transients are absent, so nothing here proves minute-scale control behaviour.

## Coverage, verified

Coverage was verified file by file on 2026-09-14: for all 22 site-years, `coverage.expectedHours` equals the local calendar length (8,760, or 8,784 in 2024), `coverage.weatherHours` (hours with temperature, relative humidity and pressure all present) equals it, `coverage.solarHours` equals it, the length of `hours[]` equals it, and each file's SHA-256 matches its `.sha256` file. **No gaps, no missing sentinels and no partial years in any bundled file.**

| File | Expected h | Weather h | Solar h | Bytes |
| --- | ---: | ---: | ---: | ---: |
| `phoenix-2023.json` | 8,760 | 8,760 | 8,760 | 2,142,536 |
| `phoenix-2024.json` | 8,784 | 8,784 | 8,784 | 2,147,899 |
| `phoenix-2025.json` | 8,760 | 8,760 | 8,760 | 2,145,181 |
| `miami-2023.json` | 8,760 | 8,760 | 8,760 | 2,172,251 |
| `miami-2024.json` | 8,784 | 8,784 | 8,784 | 2,179,131 |
| `miami-2025.json` | 8,760 | 8,760 | 8,760 | 2,172,805 |
| `denver-2023.json` | 8,760 | 8,760 | 8,760 | 2,144,965 |
| `denver-2024.json` | 8,784 | 8,784 | 8,784 | 2,150,263 |
| `denver-2025.json` | 8,760 | 8,760 | 8,760 | 2,142,681 |
| `seattle-2023.json` | 8,760 | 8,760 | 8,760 | 2,145,537 |
| `seattle-2024.json` | 8,784 | 8,784 | 8,784 | 2,148,600 |
| `seattle-2025.json` | 8,760 | 8,760 | 8,760 | 2,144,585 |

Ten Tulsa years (2016 to 2025) pass the same check unchanged, at 8,760 hours except 8,784 in 2016, 2020 and 2024.

An exact 8,760 or 8,784 local hours is a deliberate property of the fetcher, not an assumption: it queries UTC hours with one UTC day of padding on each side, then keeps the UTC hours falling inside the local calendar year, so a spring-forward hour is genuinely absent and a fall-back hour genuinely occurs twice in local time while the UTC hour count stays exact. Arizona never observes daylight saving, so Phoenix has no repeated or skipped local hour at all.

## How the profiles were computed

By a throwaway Node script reading only the committed snapshots, using the repository's own `vendor/psychrolib.js` in SI so the psychrometrics match the tool's:

- **Period:** 2023, 2024 and 2025 for every site, including Tulsa, so the five sites are directly comparable. Tulsa's other seven bundled years are excluded from this table on purpose.
- **Local time:** hours are bucketed by local wall clock in each site's IANA zone (`Intl.DateTimeFormat`), not by UTC.
- **Summer:** local June, July and August, 2,208 hours per year, 6,624 hours per site over the three years.
- **Summer afternoon:** those months, local hours 12:00 through 17:59, 552 hours per year, 1,656 per site.
- **Dew point:** `GetTDewPointFromRelHum(tempC, rh)`. **Wet bulb:** `GetTWetBulbFromRelHum(tempC, rh, pressurePa)`, so it uses each hour's actual station pressure rather than a sea-level assumption, which matters at Denver.
- **Humidity input:** POWER `RH2M`, whose range across all 131,520 hours in this window (five sites, 26,304 hours each) is 0.0199 to 1.0000. No value required clamping, so no hour's humidity was altered.
- **Counts:** strict inequalities, `tempC > 30` and `tempC < 0`, counted per calendar year; the table gives the three-year mean with the three individual years in brackets.
- **Range columns:** dry-bulb minimum to maximum and station pressure minimum to maximum are over all 26,304 hours of the three years, not annual means.
- **Mean GHI:** arithmetic mean of `ALLSKY_SFC_SW_DWN` over all 26,304 hours including night, so it is an annual average irradiance, not a daytime average and not a peak.

## Per-site profiles, measured from the bundled files

| Site | Dry-bulb min to max (C) | Mean summer afternoon dew point (C) | Mean summer wet bulb (C) | Peak summer wet bulb (C) | Hours > 30 C per year, mean (2023, 2024, 2025) | Hours < 0 C per year, mean (2023, 2024, 2025) | Station pressure (kPa) | Mean GHI (W/m2) |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| Tulsa, OK | -17.4 to 42.6 | 19.6 | 22.4 | 28.1 | 911 (982, 1117, 634) | 630 (512, 526, 851) | 96.0 to 101.1 | 191 |
| Phoenix, AZ | -2.3 to 47.9 | 6.4 | 18.2 | 24.8 | 2,494 (2490, 2671, 2322) | 15 (18, 21, 5) | 94.2 to 97.5 | 242 |
| Miami, FL | 11.1 to 33.0 | 24.8 | 26.1 | 28.3 | 785 (974, 890, 490) | 0 (0, 0, 0) | 99.8 to 102.8 | 209 |
| Denver, CO | -22.6 to 36.5 | 3.6 | 12.2 | 17.4 | 306 (232, 344, 343) | 1,974 (2267, 1959, 1697) | 76.4 to 80.4 | 203 |
| Seattle, WA | -11.4 to 32.9 | 13.6 | 14.5 | 23.1 | 12 (24, 12, 1) | 194 (159, 152, 272) | 97.4 to 102.7 | 149 |

**Phoenix, hot-dry.** The hottest and driest of the five: 47.9 C peak dry bulb, 2,494 hours above 30 C in an average year, and a mean summer afternoon dew point of 6.4 C, 18.4 K below Miami's. That gap is the whole evaporative-cooling argument, and the 24.8 C peak summer wet bulb is the limit on it: wet-bulb depression is large almost all the time, but the monsoon months raise the wet bulb enough that pad leaving-air temperature is not uniformly low. Freezing is nearly absent (15 hours a year). Station pressure sits near 94 to 97 kPa at 494 m, already below sea level. Arizona does not observe daylight saving, so local hour buckets here are a constant UTC-7.

**Miami, hot-humid.** The mirror image: the narrowest dry-bulb range of the five (11.1 to 33.0 C), zero hours below freezing in three years, and the highest moisture by a wide margin at a 24.8 C mean summer afternoon dew point and 26.1 C mean summer wet bulb. Mean summer wet bulb here (26.1 C) is above Phoenix's *peak* summer wet bulb, so evaporative cooling has almost no depression to work with and the binding constraint is latent, not sensible. Hours above 30 C (785 a year) are fewer than Tulsa's, which is the point: the difficulty is not heat, it is that the air is close to saturation while warm. Note the marine grid cell, which damps the extremes at both ends.

**Denver, cold-dry at altitude.** Station pressure of 76.4 to 80.4 kPa at 2,094.96 m source elevation, 75 to 79 percent of the 101.325 kPa sea-level standard, is the reason this site is bundled: it exercises the pressure-dependent psychrometric path end to end, and any code that assumes 101.325 kPa will be wrong here in humidity ratio, enthalpy, wet bulb and fan mass flow at once. Climatically it is the heating case, 1,974 hours below 0 C in an average year against 306 above 30 C, with a -22.6 C minimum, and it is dry: 3.6 C mean summer afternoon dew point, 12.2 C mean summer wet bulb, the lowest of the five. Large diurnal swing plus dry air means night ventilation is cheap and winter humidification, not dehumidification, is the moisture problem.

**Seattle, cool-marine.** Almost nothing is above 30 C (12 hours in an average year, and only 1 hour in 2025) and freezing is modest at 194 hours, so neither mechanical cooling nor heavy heating dominates. Mean summer wet bulb is 14.5 C, the second lowest, which makes free cooling and evaporative assist plausible for most of the summer, while the 23.1 C peak summer wet bulb shows the heat events that do occur are not dry. The trade is light: mean GHI of 149 W/m2 is the lowest of the five, 62 percent of Phoenix's 242, so this is the supplemental-lighting and DLI-deficit site, not the cooling site.

**Tulsa, the worked example.** Bundled as a single year in 0.1.0-screening and extended to ten years in 0.2.0-screening, and the widest annual range in this table (-17.4 to 42.6 C). It is simultaneously hot and humid in summer (19.6 C mean afternoon dew point, 22.4 C mean summer wet bulb) and genuinely freezing in winter (630 hours below 0 C), so it needs both heating and dehumidification rather than specialising in either. Its per-year swing (982, 1,117 then 634 hours above 30 C) is the clearest single demonstration in this document of why one weather year is an anecdote.

## Rebuilding, and adding a site

`scripts/fetch-weather.py` needs Python 3.9 or later and nothing but the standard library. Run from `calc v1.0/`:

```sh
python3 scripts/fetch-weather.py --help                      # sites, years, defaults
python3 scripts/fetch-weather.py                             # default: tulsa 2025
python3 scripts/fetch-weather.py --site denver 2023 2024 2025
```

Each year issues three requests (the padding day before, the calendar year, the padding day after) with a 1.2 s pause between them, so a three-year site is about 14 s and nine requests. Each run asserts that POWER returned `time_standard: UTC` and that every parameter's units are the expected ones, writes the original response bytes to `data/weather/nasa-power-<key>-<start>-<end>.json`, and then checks coverage. **A year whose weather or solar hours fall short of its expected hour count, or whose fetch fails, is reported and skipped: no partial snapshot is written, and the remaining requested years still run.** The process exits 1 if any year was skipped, so it can gate a workflow. Retained response bytes from a skipped attempt are left in place deliberately, as evidence of what the source actually returned.

Verified on 2026-09-14: an attempt at the incomplete current year, `python3 scripts/fetch-weather.py 2026` into a scratch directory, reported `INCOMPLETE tulsa 2026: expected 8760 h, weather 6114 h, solar 3618 h`, wrote no snapshot, kept the three retained responses, and exited 1. The same responses show where POWER's 2026 record actually ends, and the two products are not equally current: MERRA-2 meteorology (`T2M`, `RH2M`, `PS`) runs through 2026-09-12 23:00 UTC, two days behind the retrieval, while SYN1deg solar (`ALLSKY_SFC_SW_DWN`) stops at 2026-05-31 23:00 UTC, three and a half months behind. Solar is therefore the binding lag on bundling a completed year, which is why a finished calendar year becomes bundleable the following spring rather than in January.

To add a site, add one entry to `SITES` in `scripts/fetch-weather.py` (key, label, ZIP, latitude, longitude, IANA time zone, climate label, and a `rawPrefix` for its retained responses), fetch its years, then add it to `data/weather/index.json` with exactly the coordinates the fetcher used. Tulsa's `rawPrefix` is empty because its retained responses predate the multi-site registry and keep their original names.

Adding a year to an existing site also means adding it to that site's `years` and `files` in `index.json`, which is what the application discovers, and updating the tables above. `node scripts/check-vintages.mjs` reads the newest bundled year from `index.json` and reports it aging after 15 months and stale after 24; its dataset label still says Tulsa, which now understates what it covers.
