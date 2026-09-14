# Bundled climates: the six sites, their provenance and their limits

Purpose: state exactly which hourly weather ships with this repository, where each byte came from, what the bundled years measure, and what a reader must not conclude from them.

Status: six sites bundled, 60 complete calendar years (ten each). Tulsa 2025 was retrieved 2026-09-11 and its other nine years 2026-09-13; the four climate archetypes (Phoenix, Miami, Denver, Seattle) and Fairbanks were retrieved 2026-09-14, all with NASA POWER Hourly API `v2.10.0` (read from each snapshot's `sourceVersions`, identical across all 60). Every profile figure below was computed from the committed files, not quoted from a climate summary. Staleness is tracked by `node scripts/check-vintages.mjs` against `data/weather/index.json`.

Read this if: you are choosing which bundled site or year to run, quoting a climate figure out of this tool, or adding a site of your own.

## What is bundled

| Site | Key | ZIP | Latitude | Longitude | Time zone | Source elevation (m) | Years | Snapshot bytes |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | ---: |
| Tulsa, OK | `tulsa` | 74103 | 36.15 | -95.99 | America/Chicago | 249.54 | 2016 to 2025 (10) | 11,611,095 |
| Phoenix, AZ | `phoenix` | 85004 | 33.4484 | -112.074 | America/Phoenix | 494.49 | 2016 to 2025 (10) | 11,621,987 |
| Miami, FL | `miami` | 33101 | 25.7743 | -80.1937 | America/New_York | 2.81 | 2016 to 2025 (10) | 11,772,263 |
| Denver, CO | `denver` | 80202 | 39.7392 | -104.9903 | America/Denver | 2,094.96 | 2016 to 2025 (10) | 11,616,869 |
| Seattle, WA | `seattle` | 98104 | 47.6062 | -122.3321 | America/Los_Angeles | 110.01 | 2016 to 2025 (10) | 11,630,978 |
| Fairbanks, AK | `fairbanks` | 99701 | 64.8378 | -147.7164 | America/Anchorage | 366.64 | 2016 to 2025 (10) | 11,646,279 |

Each site-year is a single self-contained JSON file, `data/weather/<key>-<year>.json`, between 1.10 and 1.13 MB, listed for the application in `data/weather/index.json`. The 60 snapshots total 69,899,471 bytes (66.7 MB); the retained original API responses, three per site-year, add 59,228,306 bytes (56.5 MB) in 180 files. The four archetypes account for 44.5 MB of snapshots, 37.7 MB of retained responses and 40 checksum files: 82.2 MB in total. Fairbanks adds 11.1 MB of snapshots, 9.4 MB of retained responses and 10 checksum files: 20.5 MB. Only the snapshot of the selected year is fetched by the browser; the retained responses are provenance and are never requested at run time.

A snapshot carries the normalized hours once. It does **not** embed a second copy of the API response: that would double every file the browser downloads for data it never reads. The response bytes live beside it under `data/weather/nasa-power-*.json`, hash-matched by the `sha256` recorded in `raw[]`, and POWER's own header and version block are promoted into `sourceVersions`. Snapshots written before 2026-09-14 embedded the parsed payload and were twice this size.

The application matches a bundled site by coordinates within 0.001 degrees, so the latitude and longitude above are the exact query coordinates used by `scripts/fetch-weather.py` and must stay identical in the fetcher registry, in `index.json` and in every snapshot. Changing a coordinate silently unbundles that site.

Source elevation is POWER's own `geometry.coordinates[2]` for the returned point. It is recorded per site in `data/weather/index.json` and can be re-read from the retained response file named in that site-year's `raw[].file`. It is the source grid's elevation, **not a surveyed site elevation**, and it is what makes the reported station pressure what it is.

### Checksums and manifest

There is no combined weather manifest. Integrity is per file:

- `data/weather/<key>-<year>.sha256` holds one `sha256  filename` line for that snapshot, for example `24817db293dd7f2b105c0cb9072c718aaca19e63a9f3b9d294d884d8e7c27227  phoenix-2025.json`. The filename is relative, so verify from that directory: `cd data/weather && shasum -a 256 -c phoenix-2025.sha256`. All 61 sidecars were verified on 2026-09-14, all `OK`.
- Inside each snapshot, `raw[]` carries, per API request, the request URL, the retrieval timestamp, the SHA-256 of the original response bytes and the retained filename under `data/weather/nasa-power-*.json`. The recorded SHA-256 verifies against those retained bytes; it was checked for all 180 files on 2026-09-14, all matching. POWER's header and version block are in `sourceVersions`.
- `data/weather/index.json` is the discovery index (key, label, ZIP, coordinates, time zone, climate label, source elevation, source, years, files). It carries no checksum of its own.

A re-fetch of an identical year reproduces identical meteorology but **not an identical response SHA-256**: POWER echoes its own server-side timing (`times.data`, `times.process`) in every response, so the retained response bytes differ run to run. Verified on 2026-09-14 by re-fetching Tulsa 2025 into a scratch directory: all 8,760 hours, all three request URLs, all retained filenames and every header field were identical to the committed file. Since the snapshot no longer embeds the response, those timing numbers are not in it, and `retrievedAt` is the only field a re-fetch changes.

## Provenance, and what these numbers are not

Source: [NASA POWER](https://power.larc.nasa.gov/) hourly point API, `RE` community, `time-standard=UTC`, parameters `T2M`, `T2MDEW`, `RH2M`, `PS`, `ALLSKY_SFC_SW_DWN`, `WS2M`. Method and resolution per [POWER methodology](https://power.larc.nasa.gov/docs/methodology/): meteorology from MERRA-2 at 0.5 degrees latitude by 0.625 degrees longitude, solar from SYN1deg at 1 degree by 1 degree. POWER's fill value `-999.0` is preserved as `null`, never as a number.

Five statements that constrain every use of this data:

1. **This is gridded reanalysis at a ZIP centroid, not a measured facility site.** No station observed these hours. The returned point coordinates do not identify a grid-cell center, and a MERRA-2 cell is tens of kilometres across, so a single cell can mix downtown, water, farmland and higher terrain. Seattle's ten-year minimum of -11.4 C and maximum of 41.9 C, Miami's maximum of 33.0 C, and Fairbanks's minimum of -44.0 C are cell values, not downtown thermometer values. Fairbanks is the worst case for this limit: an interior subarctic valley pools cold air in ways a cell tens of kilometres across cannot resolve, so its winter extremes are the least transferable numbers in this document.
2. **Ten years is not a climate normal.** A climatological standard normal is a 30-year average, and the current standard period is 1991 to 2020: WMO requires each member nation to compute 30-year averages and recommends a decadal update, per [NOAA NCEI, U.S. Climate Normals](https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals), which implements *WMO Guidelines on the Calculation of Climate Normals* (WMO-No. 1203, 2017). Ten consecutive years measure ten particular years, and they carry no trend claim: a decade is far too short to separate a trend from interannual variability. What they do support is a distribution, which is what this tool uses them for. The spread in the per-year counts below shows how far a single year moves: Miami's hours above 30 C run from 119 in 2018 to 974 in 2023, an 855-hour swing at one site.
3. **Every bundled site now carries ten years, so "median of ten" and "worst of ten" are the honest phrasings.** The worst of ten is still not a design year: a design condition is an exceedance percentile, computed here at the 0.4 percent convention and reported separately in [REGIONS.md](REGIONS.md). Ten years also means a single site's ranking can be stable in this record and still be unstable under the parameter uncertainty measured in [SENSITIVITY.md](SENSITIVITY.md); the two are different questions.
4. **Solar and meteorology have different footprints.** GHI comes from a 1-degree satellite product while temperature comes from a finer reanalysis, so a cloudy-hour disagreement between them is a property of the pairing, not an error to be smoothed.
5. **Hourly means are hourly means.** Each record is a UTC hour start with interval-mean meteorology, and GHI is Wh/m2 over that hour divided by one hour. Sub-hourly peaks, gust structure and short cloud transients are absent, so nothing here proves minute-scale control behaviour.

## Coverage, verified

Coverage was verified file by file on 2026-09-14: for all 60 site-years, `coverage.expectedHours` equals the local calendar length (8,760, or 8,784 in the leap years 2016, 2020 and 2024), `coverage.weatherHours` (hours with temperature, relative humidity and pressure all present) equals it, `coverage.solarHours` equals it, the length of `hours[]` equals it, and each file's SHA-256 matches its `.sha256` file. **No gaps, no missing sentinels and no partial years in any bundled file.**

Ten years of 8,760 hours with three leap years is 87,672 hours per site, and every site holds exactly that:

| Site | Years | Expected h | Weather h | Solar h | Snapshot bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| Tulsa, OK | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,611,095 |
| Phoenix, AZ | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,621,987 |
| Miami, FL | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,772,263 |
| Denver, CO | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,616,869 |
| Seattle, WA | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,630,978 |
| Fairbanks, AK | 2016 to 2025 | 87,672 | 87,672 | 87,672 | 11,646,279 |

That is 526,032 bundled hours in total, every one of them with temperature, humidity, pressure and solar present.

An exact 8,760 or 8,784 local hours is a deliberate property of the fetcher, not an assumption: it queries UTC hours with one UTC day of padding on each side, then keeps the UTC hours falling inside the local calendar year, so a spring-forward hour is genuinely absent and a fall-back hour genuinely occurs twice in local time while the UTC hour count stays exact. Arizona never observes daylight saving, so Phoenix has no repeated or skipped local hour at all.

## How the profiles were computed

By a throwaway Node script reading only the committed snapshots, using the repository's own `vendor/psychrolib.js` in SI so the psychrometrics match the tool's:

- **Period:** all ten bundled years, 2016 to 2025, for every site, so the six sites are directly comparable over an identical window. 87,672 hours per site, 526,032 in total.
- **Local time:** hours are bucketed by local wall clock in each site's IANA zone (`Intl.DateTimeFormat`), not by UTC.
- **Summer:** local June, July and August, 2,208 hours per year, 22,080 hours per site over the ten years.
- **Summer afternoon:** those months, local hours 12:00 through 17:59, 552 hours per year, 5,520 per site.
- **Dew point:** `GetTDewPointFromRelHum(tempC, rh)`. **Wet bulb:** `GetTWetBulbFromRelHum(tempC, rh, pressurePa)`, so it uses each hour's actual station pressure rather than a sea-level assumption, which matters at Denver.
- **Humidity input:** POWER `RH2M`, whose range across all 526,032 hours is 0.0135 to 1.0000. No value required clamping, so no hour's humidity was altered.
- **Counts:** strict inequalities, `tempC > 30`, `tempC < 0` and, for Fairbanks, `tempC < -20`, counted per calendar year; the table gives the ten-year mean with the lowest and highest single years in brackets, since the range is the point.
- **Range columns:** dry-bulb minimum to maximum and station pressure minimum to maximum are over all 87,672 hours of the ten years, not annual means.
- **Mean GHI:** arithmetic mean of `ALLSKY_SFC_SW_DWN` over all 87,672 hours including night, so it is an annual average irradiance, not a daytime average and not a peak.
- **Daily light integral:** local-calendar-day sums of `ALLSKY_SFC_SW_DWN` in Wh/m2, averaged over the ten same-named months, then converted to PAR photons at the 2.02 µmol/J applied to GHI by the engine itself (`src/simulate.js`, reported as `assumptions.lightSolarConversionUmolJ`). That constant is a screening convention, not a measured spectral property of any site: a nearby choice such as 0.45 of GHI at 4.57 µmol/J moves the absolute mol/m2/day figures by about two percent, while the December-to-June ratio is unchanged because it cancels. Read the ratio as the finding and the absolute mol number as an order of magnitude.

## Per-site profiles, measured from the bundled files

| Site | Dry-bulb min to max (C) | Mean summer afternoon dew point (C) | Mean summer wet bulb (C) | Peak summer wet bulb (C) | Hours > 30 C per year, mean (min to max year) | Hours < 0 C per year, mean (min to max year) | Station pressure (kPa) | Mean GHI (W/m2) |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | ---: |
| Tulsa, OK | -17.6 to 45.0 | 19.9 | 22.4 | 29.0 | 843 (510 to 1,155) | 712 (512 to 968) | 96.0 to 101.6 | 188 |
| Phoenix, AZ | -3.7 to 48.6 | 7.4 | 18.6 | 26.6 | 2,378 (2,143 to 2,671) | 17 (1 to 44) | 94.2 to 97.5 | 243 |
| Miami, FL | 9.3 to 33.0 | 24.4 | 25.7 | 28.3 | 428 (119 to 974) | 0 (0 to 0) | 99.2 to 103.2 | 210 |
| Denver, CO | -22.6 to 36.6 | 3.9 | 12.2 | 18.8 | 293 (181 to 367) | 2,123 (1,697 to 2,530) | 76.1 to 80.5 | 202 |
| Seattle, WA | -11.4 to 41.9 | 13.6 | 14.8 | 26.6 | 15 (1 to 40) | 267 (145 to 493) | 96.2 to 102.7 | 146 |
| Fairbanks, AK | -44.0 to 28.2 | 10.6 | 11.9 | 21.6 | 0 (0 to 0) | 4,684 (4,462 to 5,061) | 92.3 to 100.4 | 106 |

**Phoenix, hot-dry.** The hottest of the six, and the driest of the sites that get hot at all: 48.6 C peak dry bulb, 2,378 hours above 30 C in an average year, and a mean summer afternoon dew point of 7.4 C, 17.0 K below Miami's. That gap is the whole evaporative-cooling argument, and the 26.6 C peak summer wet bulb is the limit on it: wet-bulb depression is large almost all the time, but the monsoon months raise the wet bulb enough that pad leaving-air temperature is not uniformly low. It is also the steadiest of them for heat: the hot-hour count moves only 2,143 to 2,671 across ten years, a 22 percent spread where Miami's moves eightfold. Freezing is nearly absent (17 hours a year, 1 in the mildest). Station pressure sits near 94 to 97 kPa at 494 m, already below sea level. Arizona does not observe daylight saving, so local hour buckets here are a constant UTC-7.

**Miami, hot-humid.** The mirror image: the narrowest dry-bulb range of the six (9.3 to 33.0 C), not one hour below freezing in ten years, and the highest moisture by a wide margin at a 24.4 C mean summer afternoon dew point and 25.7 C mean summer wet bulb. Mean summer wet bulb here is within 1 K of Phoenix's *peak*, so evaporative cooling has almost no depression to work with and the binding constraint is latent, not sensible. Hours above 30 C average 428 a year, half of Tulsa's, which is the point: the difficulty is not heat, it is that the air is close to saturation while warm. It is also the most variable site in the set on that count, 119 hours in 2018 against 974 in 2023, so a single Miami year is the weakest evidence in this repository. Note the marine grid cell, which damps the extremes at both ends.

**Denver, cold-dry at altitude.** Station pressure of 76.1 to 80.5 kPa at 2,094.96 m source elevation, 75 to 79 percent of the 101.325 kPa sea-level standard, is the reason this site is bundled: it exercises the pressure-dependent psychrometric path end to end, and any code that assumes 101.325 kPa will be wrong here in humidity ratio, enthalpy, wet bulb and fan mass flow at once. Climatically it is the heating case of the lower 48, 2,123 hours below 0 C in an average year against 293 above 30 C, with a -22.6 C minimum, and it is dry: a 3.9 C mean summer afternoon dew point and an 18.8 C peak summer wet bulb, both the lowest of the six, and a 12.2 C mean summer wet bulb that Fairbanks's 11.9 C now just undercuts. Large diurnal swing plus dry air means night ventilation is cheap and winter humidification, not dehumidification, is the moisture problem.

**Seattle, cool-marine.** Almost nothing is above 30 C (15 hours in an average year, 1 hour in the mildest) and freezing is modest at 267 hours, so neither mechanical cooling nor heavy heating dominates. Mean summer wet bulb is 14.8 C, the third lowest behind Fairbanks's 11.9 C and Denver's 12.2 C, which makes free cooling and evaporative assist plausible for most of the summer. The ten-year record adds the case three years would have hidden: a 41.9 C maximum and a 26.6 C peak summer wet bulb, both set in the 2021 heat dome and both equal to or above Phoenix's peak wet bulb. A design decision made on Seattle's averages is a decision to be unable to hold the band during that event. The trade is light: mean GHI of 146 W/m2 is 60 percent of Phoenix's 243 and the second lowest of the six, above only Fairbanks's 106, so this is the supplemental-lighting and DLI-deficit site of the lower 48, not the cooling site.

**Fairbanks, subarctic and light-limited.** The cold is the obvious number and the wrong one to lead with. Averaged over the ten years the outside daily light integral is **0.4 mol/m2/day in December against 41.2 in June, a factor of 106** (mean daily GHI of 53.5 against 5,668.2 Wh/m2/day, so the ratio holds whatever GHI-to-PAR constant is chosen). Inside a house at 0.65 transmission that December day delivers 0.25 mol/m2 against the 14 mol/m2 target the tool's default leafy-greens program asks for, which is a shortfall no envelope decision can close: the photons are not outside to be let in. Mean GHI of 106 W/m2 is the lowest of the six, 44 percent of Phoenix's 243. The cold then compounds it. An average year holds 4,684 hours below 0 C (4,462 in 2019 to 5,061 in 2023), 53 percent of the year, and 1,112 hours below -20 C (598 in 2016 to 1,728 in 2020), and those sub -20 C hours are the ones that decide equipment: the low-ambient rating the component screen asks for bottoms out at -15 C (`heatPumpCopAtMinus15C`), and `src/screens.js` returns 0 kW of compressor heat below the declared cutoff, so a heat pump entered with a -15 C cutoff is locked out for every one of them and the backup source carries the load alone. The repository establishes no generic cutoff, capacity curve or defrost penalty for any product (see [COMPONENT-PARAMETERS.md](COMPONENT-PARAMETERS.md)), so -15 C is the screen's lowest rating point, not a claim about a unit you can buy. Summer is not the problem here: zero hours above 30 C in ten years, the only site in the set with none, an 11.9 C mean summer wet bulb, the lowest of the six, and a 21.6 C peak. The dry-bulb range is the widest in this table at 72.2 K, -44.0 C in 2024 to 28.2 C in 2023, against Tulsa's 62.6 K. Station pressure runs 92.3 to 100.4 kPa at 366.64 m source elevation. One caveat carries extra weight at this site: at 64.8378 degrees north the MERRA-2 cell is an interior subarctic valley, where winter inversions and cold-air pooling are sub-grid by construction, so the -44.0 C minimum and the sub -20 C counts should be read as cell values with a wider error than anywhere else in this set. For what a climate like this does to the control class a design has to reach, see [CLASSES.md](CLASSES.md).

**Tulsa, the worked example.** Bundled as a single year in 0.1.0-screening and extended to ten years in 0.2.0-screening, and the second widest range in this table at 62.6 K: -17.6 C in 2021 to 45.0 C in 2022, behind only Fairbanks's 72.2 K. It is simultaneously hot and humid in summer (19.9 C mean afternoon dew point, 22.4 C mean summer wet bulb, a 29.0 C peak wet bulb in 2022 that is the highest of the six sites) and genuinely freezing in winter (712 hours below 0 C in an average year, 968 in the coldest), so it needs both heating and dehumidification rather than specialising in either. That double duty, not severity, is why it is the worked example. Its hot hours run 510 to 1,155 across the ten years, a 2.3-fold swing, which is the clearest demonstration in this document of why one weather year is an anecdote.

## Rebuilding, and adding a site

`scripts/fetch-weather.py` needs Python 3.9 or later and nothing but the standard library. Run from `calc v1.0/`:

```sh
python3 scripts/fetch-weather.py --help                      # sites, years, defaults
python3 scripts/fetch-weather.py                             # default: tulsa 2025
python3 scripts/fetch-weather.py --site fairbanks 2016 2017 2018   # any subset of years
```

Each year issues three requests (the padding day before, the calendar year, the padding day after) with a 1.2 s pause between them, so a ten-year site is thirty requests and about a minute of wall clock: the retrieval timestamps in Fairbanks's thirty retained responses sit a median 2.0 s apart, the pause plus POWER's own response time. Each run asserts that POWER returned `time_standard: UTC` and that every parameter's units are the expected ones, writes the original response bytes to `data/weather/nasa-power-<key>-<start>-<end>.json`, and then checks coverage. **A year whose weather or solar hours fall short of its expected hour count, or whose fetch fails, is reported and skipped: no partial snapshot is written, and the remaining requested years still run.** The process exits 1 if any year was skipped, so it can gate a workflow. Retained response bytes from a skipped attempt are left in place deliberately, as evidence of what the source actually returned.

Verified on 2026-09-14: an attempt at the incomplete current year, `python3 scripts/fetch-weather.py 2026` into a scratch directory, reported `INCOMPLETE tulsa 2026: expected 8760 h, weather 6114 h, solar 3618 h`, wrote no snapshot, kept the three retained responses, and exited 1. The same responses show where POWER's 2026 record actually ends, and the two products are not equally current: MERRA-2 meteorology (`T2M`, `RH2M`, `PS`) runs through 2026-09-12 23:00 UTC, two days behind the retrieval, while SYN1deg solar (`ALLSKY_SFC_SW_DWN`) stops at 2026-05-31 23:00 UTC, three and a half months behind. Solar is therefore the binding lag on bundling a completed year, which is why a finished calendar year becomes bundleable the following spring rather than in January.

To add a site, add one entry to `SITES` in `scripts/fetch-weather.py` (key, label, ZIP, latitude, longitude, IANA time zone, climate label, and a `rawPrefix` for its retained responses), fetch its years, then add it to `data/weather/index.json` with exactly the coordinates the fetcher used. Tulsa's `rawPrefix` is empty because its retained responses predate the multi-site registry and keep their original names. Fairbanks is the worked example of the full path: one `SITES` entry with `rawPrefix='fairbanks-'`, ten years fetched on 2026-09-14 into thirty `nasa-power-fairbanks-*.json` responses and ten snapshots with ten sidecars, then the `index.json` record carrying the same 64.8378 and -147.7164 the fetcher queried.

Adding a year to an existing site also means adding it to that site's `years` and `files` in `index.json`, which is what the application discovers, and updating the tables above. `node scripts/check-vintages.mjs` reads the newest bundled year from `index.json` and reports it aging after 15 months and stale after 24, across every bundled site.
