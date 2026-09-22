# Weather sources

Status: 2026-09-18. Every CORS and licence claim below was checked against the live endpoint on that date, and where a claim could not be checked it says so.

Read this if: you want to know why the tool offers the five sources it offers, and why it does not offer the others. Choosing a source is a choice about how much you can claim from the answer, so the reasons are written down rather than left in someone's head.

The tool is a static page. It has no server, so it can only use a source that sends CORS headers permitting a browser to fetch it. That one constraint eliminates several otherwise excellent datasets, and no amount of good data makes up for it.

## What the model needs

Six hourly values: air temperature, dew point or relative humidity, surface pressure, global horizontal irradiance, wind speed, on a UTC hour. Pressure and irradiance are the two that usually disqualify a source. Pressure because every psychrometric quantity depends on it, and irradiance because a greenhouse is mostly a solar collector.

## Shipped

| Source | Key | Grid | Covers | Why it is here |
|---|---|---|---|---|
| Open-Meteo ERA5 | none | 0.1° temp and humidity, 0.25° the rest | 1940 | Finest free grid, one request per year, reaches furthest back |
| NOAA NCEI ISD | none | station | 1901 at some stations | Real measurement with a quality flag on every value |
| NASA POWER | none | 0.5° × 0.625°, solar 1° | 2001 | Public domain with no conditions, dedicated satellite solar |
| IEM ASOS | none | station | 1970s at many airports | Simple when you already trust a specific airport |
| Visual Crossing | yours | blended stations and model | 1970s onward | All six in one call, hourly source codes, with variable-level lineage limits |

Full pros and cons for each are in `src/providers.js` and shown in the interface when you pick one. They are kept there rather than here so the interface and the documentation cannot drift apart.

### Visual Crossing, and what using it means

It is the only source here that returns all six values in one request, reaches most US locations without you naming a station, and covers about fifty years. It is also the only one you need an account for, and the only one whose numbers you cannot fully trace.

Two things the adapter has to do to make it usable, both visible in every snapshot it produces.

Its `pressure` is sea-level pressure, which their own data documentation defines as removing the reduction due to altitude. At 1,655 m that is about 22 percent above the real station pressure, and humidity ratio follows pressure, so passing it through would corrupt every moisture figure in the run. The adapter reduces it to station pressure using the site elevation, fetched from Open-Meteo's keyless elevation service, and each hour is flagged `station-pressure-reduced-from-sea-level-and-elevation`. Your pressure from this source is derived, not measured.

The adapter requests and preserves hourly `source` codes (`obs`, `fcst`, `histfcst`, `stats`, `statsfcst`, `comb`) and contributing station identifiers. Missing station identifiers do not establish modeled provenance. Missing source codes remain unknown; a record-level observation code does not prove that each variable was measured. Missing numeric values remain gaps. Historical analysis rejects forecast/statistical rows and observation/forecast combinations, including forecasts whose valid time is now in the past.

For solar loads, hourly `solarenergy` (MJ/m²) is divided by 3,600 seconds and multiplied by 1,000,000 to obtain interval-mean W/m². If only `solarradiation` is available, the value is retained with an explicit instantaneous override, not relabeled as an interval mean. See the provider's [field definitions](https://www.visualcrossing.com/resources/documentation/weather-data/weather-data-documentation/) and [Timeline API](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/), checked for this adapter update on 2026-09-22. No live keyed call was used to validate this change; response fixtures exercise the contract.

Forecast issuance and retrieval are different clocks. `forecast.issuedAt` and `runId` remain null when not supplied; fetching a forecast today does not establish its model issue time. The canonical contract can retain forecasts for a future extension, but the current historical app does not analyze them.

### Why Open-Meteo is the default

For temperature and humidity it is about 36 times finer by area than NASA POWER, a whole year arrives in one request of about 411 KB in roughly two seconds, and it reaches back to 1940. It also reports elevation closer to reality: at Boulder its cell says 1,589 m where NASA POWER says 1,801 m, for a city at about 1,655 m. Station pressure follows elevation and humidity ratio follows pressure, so that gap is a bias in every moisture figure, not a cosmetic difference.

The adapter asks for `era5_land` and `era5` by name rather than letting the service blend them, because a value whose model is unknown cannot be reported honestly. Every hour records which model supplied each field.

**Its licence is the thing to watch.** The free tier is CC BY 4.0 and non-commercial only. Open-Meteo's own terms name "operating websites or apps that have subscriptions or display advertisements", "integrating our service into commercial products", and "conducting undisclosed research at commercial entities" as commercial use. If this tool is used to screen a site for a paying client, that last clause applies and the free tier does not cover it. A paid plan or another source does.

## Considered and rejected

Each of these was checked against the live service. They are listed so the question does not have to be reopened from scratch.

**NREL NSRDB.** The best solar data available, 4 km against NASA POWER's roughly 100 km, with explicit fill flags saying which values were gap-filled and how. Two problems. Its domain moved: `developer.nrel.gov` no longer resolves at all and it is now `developer.nlr.gov`. More seriously, the download endpoint returns a redirect to an S3 host that sends no CORS headers, so a browser follows the redirect and then fails the check. `curl -L` succeeds, which makes this easy to miss. Unusable from a static page without a proxy. The sensible path if this data is wanted is a file import: a user downloads the CSV by hand and drops it in, and the fill flags survive that intact.

**Synoptic Data.** All six from real stations across a wide network, which no other candidate manages. The free Open Access tier caps history at one year, which makes multi-year climate screening impossible, and it requires an application that is not guaranteed to be approved.

**Meteostat.** No irradiance at all. `tsun` is sunshine duration in minutes, not a flux. Pressure is sea level, not station. Worst of all, its hourly endpoint defaults to `model=true`, which substitutes model output for missing station hours with no per-record flag saying which is which. Its bulk endpoint sends no CORS headers.

**NOAA SURFRAD.** Research-grade instruments measuring all six with per-value flags and no gap filling, which makes it the most defensible dataset on this page. Seven stations nationwide. It is a validation reference for the other sources rather than a source in its own right.

**NOAA USCRN.** Excellent quality flags, honest about gaps, hourly, keyless. No pressure field and no wind field, so two of the six are simply absent.

**Copernicus CDS, ERA5 direct.** The same data Open-Meteo serves, without the middleman. Requires accepting each dataset's terms by hand in a web portal, submits asynchronous jobs that can queue for hours, and returns files from a host whose CORS behaviour could not be verified without running a real job. Not a browser target.

**PVGIS.** Keyless, hourly, covers the US, has the variables. Sends no CORS headers on a successful response. Would be a strong candidate if it sent one header.

**Oikolab.** No CORS headers on any response probed.

**Oklahoma Mesonet.** Technically ideal and licensed in a way that forbids redistribution, with fees for out-of-state users. One state only.

**WeatherAPI.com, Weatherbit, OpenWeatherMap, Tomorrow.io.** All send CORS headers and all fail on substance: free history windows of a day or less, irradiance behind a paid tier, or no irradiance in the history product at all.

**Environment and Climate Change Canada.** A model of what an open government hourly API should look like, with per-value flags and station pressure in kPa. Canada only, and no solar.

## Adding a source

Three steps, and a test enforces the first two staying in step:

1. An adapter in `src/weather.js` returning the snapshot shape, registered in `ADAPTERS`.
2. An entry in `src/providers.js` with grid, coverage, cadence, licence, limits, and at least two honest entries under both `pros` and `cons`. A source that states no costs fails the test, because a source with no stated cost is a sales pitch.
3. If it needs a key, an `apiKey` block with `help` and `signupUrl`. The field then appears only when that source is picked. A pasted key stays in the browser under a per-provider storage key, goes only to that provider, and `redactSecrets` strips it from every recorded URL before it can reach an export or the weather cache.

Visual Crossing is the only shipped source needing a key. Its adapter is the one that exercises that path, and a test asserts no key survives into a serialized snapshot.


## Canonical contract and local revisions

All app retrievals now pass through `normalizeWeather` and `sealWeatherSnapshot`. [WEATHER-SCHEMA.md](WEATHER-SCHEMA.md) documents schema 2, legacy migration, exact interval semantics, variable evidence and immutable browser storage. Provider-specific payloads remain in `raw`; they do not become the app's data model. Unknown legacy metadata is not upgraded to observed evidence.
