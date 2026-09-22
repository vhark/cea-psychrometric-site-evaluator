/* What each weather source is, what it is good at, and what it costs you.
 *
 * The ids here must match the adapters in weather.js, and a test asserts they do, so a source can
 * never appear in the interface without something to call.
 *
 * Every entry states its grid, its licence and its limits in the same shape, because choosing a
 * source is a choice about how much you can claim from the answer. A 9 km cell and a real instrument
 * are different kinds of evidence, and a tool that hides the difference is not helping.
 *
 * `apiKey` describes a source that needs one. The key a user pastes is theirs: it is kept in this
 * browser, sent only to that provider's own endpoint, and never written into an export, a saved
 * scenario or a log. A source with no `apiKey` needs no account at all.
 */

export const PROVIDERS = {
  openmeteo: {
    label: 'Open-Meteo, ERA5 reanalysis',
    summary: 'European reanalysis at the finest free grid this tool can reach, and the fastest to retrieve.',
    grid: 'Temperature, humidity and dew point at 0.1° (about 9 km) from ERA5-Land. Pressure, solar and wind at 0.25° (about 31 km) from ERA5.',
    coverage: '1940 to about five days ago.',
    cadence: 'Hourly.',
    licence: 'CC BY 4.0. The free tier is non-commercial use only.',
    attribution: 'Weather data by Open-Meteo.com. ERA5 and ERA5-Land produced by ECMWF and the Copernicus Climate Change Service.',
    pros: [
      'The finest free grid available here. Roughly 36 times smaller cells than NASA POWER for temperature and humidity.',
      'A whole year arrives in one request in a couple of seconds, against three chunked requests for NASA POWER.',
      'Reaches back to 1940, where NASA POWER starts in 2001.',
      'Reports which of the two models supplied each value, so the resolution behind a number is never a guess.',
    ],
    cons: [
      'Pressure, solar and wind still come from the coarser 0.25° model. Only temperature, humidity and dew point get the 9 km grid.',
      'Free use is non-commercial only, and the terms name advertising, subscriptions and undisclosed commercial research as commercial. Read them before using this at work.',
      'Wind is measured at 10 m, not the 2 m NASA POWER reports, so the two are not interchangeable.',
      'Reanalysis, not observation. No instrument recorded these hours at your address.',
    ],
    limits: 'Free tier: 10,000 calls a day, 5,000 an hour, 600 a minute, from your own browser.',
    termsUrl: 'https://open-meteo.com/en/terms',
  },

  ncei: {
    label: 'Station observations, NOAA NCEI',
    summary: 'The authoritative US observation archive, with a quality flag attached to every single value.',
    grid: 'A single station. The nearest one reporting in your period is found from your coordinates, and its name, elevation and distance are reported back.',
    coverage: '1901 onward at some stations, though most US airports start in the 1970s.',
    cadence: 'Routine METAR reports, roughly every 20 to 60 minutes, matched to the nearest UTC hour.',
    licence: 'US Government work, public domain. No restriction on use.',
    attribution: 'Observations from the NOAA National Centers for Environmental Information Integrated Surface Database.',
    pros: [
      'A real measurement, and the archive the IEM feed here is derived from.',
      'Every value carries its own quality-control flag. A value its own flag rejects is kept missing here rather than used.',
      'Finds the nearest reporting station for you, and tells you how far away and how much higher or lower it is.',
      'Reaches back further than any other source here, and the data is public domain.',
    ],
    cons: [
      'No solar. Irradiance is filled in from NASA POWER at your coordinates, so a snapshot mixes a station and a grid.',
      'Station pressure is not always reported. When it is missing the altimeter setting and station elevation are used instead, and the hour says so.',
      'A station is a point, usually an airport, and its surroundings are not your site.',
      'Reports arrive on no fixed schedule, so an hour with no report within thirty minutes stays empty.',
    ],
    limits: 'No key and no published rate limit. A year of one station is a few megabytes.',
    termsUrl: 'https://www.ncei.noaa.gov/access/services/data/v1',
  },

  visualcrossing: {
    label: 'Visual Crossing, blended',
    summary: 'All six values in one call over fifty years, at the cost of not knowing which hours were measured.',
    grid: 'Interpolated from nearby stations weighted by distance, with model output filling any hour no station covered.',
    coverage: '1970s onward at most US locations, through to forecast.',
    cadence: 'Hourly, with sub-hourly available on paid tiers.',
    licence: 'Visual Crossing terms. Free tier is 1,000 records per query and a daily record allowance. Raw data may not be redistributed publicly, and the free tier requires the attribution below.',
    attribution: 'Weather Data Provided by Visual Crossing.',
    pros: [
      'The only source here that returns all six values in a single request, with no separate solar fetch.',
      'Reaches most US locations without you choosing a station, and covers roughly fifty years.',
      'Names the stations that contributed to each hour, which is more than most blended services disclose.',
      'A generous free allowance for occasional screening work.',
    ],
    cons: [
      'Hourly source codes distinguish observations, forecasts and statistical data when supplied. Missing station identifiers do not prove modeled values. Variable-level lineage may remain unknown; forecasts and statistical records cannot enter historical analysis.',
      'Pressure arrives as sea-level pressure, which at 1,655 m is about 22 percent above the real station pressure. This tool reduces it using site elevation fetched separately, so your pressure here is derived rather than measured.',
      'Needs an account and your own key, unlike every other source offered.',
      'Its terms forbid redistributing raw data publicly, so a snapshot exported from it is not yours to republish.',
    ],
    limits: 'Free tier: 1,000 records per query, and a published daily record allowance. A year of hourly data is 8,760 records, so a multi-year run needs several queries or a paid plan.',
    termsUrl: 'https://www.visualcrossing.com/weather-services-terms/',
    apiKey: {
      help: 'Create a free account at visualcrossing.com and copy the key from your account page.',
      signupUrl: 'https://www.visualcrossing.com/sign-up/',
      placeholder: 'your Visual Crossing key',
    },
  },

  nasa: {
    label: 'NASA POWER, gridded',
    summary: 'US government reanalysis with satellite solar. Public domain, no conditions of any kind.',
    grid: 'MERRA-2 meteorology at 0.5° × 0.625° (about 3,100 km² at mid latitudes). SYN1deg solar at 1° × 1° (about 9,900 km²).',
    coverage: '2001 to about two to three months ago. Solar lags further than temperature.',
    cadence: 'Hourly.',
    licence: 'US public domain. No restriction on use, commercial or otherwise.',
    attribution: 'These data were obtained from the NASA Langley Research Center POWER Project.',
    pros: [
      'Public domain, so nothing about your use of it is restricted.',
      'Solar is a dedicated satellite product rather than a model byproduct.',
      'Long-running, stable and well documented, and the source this tool\'s committed studies were computed on.',
    ],
    cons: [
      'The coarsest grid offered here. A solar cell covers roughly 9,900 km², which will not see your valley or your city.',
      'Cell elevation can be far from real site elevation, and station pressure follows elevation. Its Denver cell sits 486 m above the city.',
      'Starts in 2001, and a completed calendar year only becomes fetchable the following spring.',
      'A year needs three separate requests with pauses, so retrieval is slower.',
    ],
    limits: 'No key and no published hard limit. Be considerate with large multi-year runs.',
    termsUrl: 'https://power.larc.nasa.gov/docs/services/api/',
  },

  iem: {
    label: 'Station observations, IEM',
    summary: 'What an actual instrument recorded, usually at an airport, with solar filled in from NASA POWER.',
    grid: 'A single point. The station is wherever it is, and this tool reports how far that is from your site.',
    coverage: 'Varies by station. Many US airports run from the 1970s onward.',
    cadence: 'Routine reports, normally hourly, matched to the nearest UTC hour.',
    licence: 'Iowa State University Environmental Mesonet, open access.',
    attribution: 'Observations from the Iowa Environmental Mesonet, Iowa State University.',
    pros: [
      'A real measurement, not a model. Simple to point at a specific airport you already trust.',
      'Point-accurate, with no cell averaging to smooth away extremes.',
      'The right choice when a nearby airport genuinely represents your site.',
    ],
    cons: [
      'The station does not move with your ZIP and must be chosen deliberately. This tool reports its distance and elevation gap for that reason.',
      'Solar is not observed. It is filled in from NASA POWER at your coordinates, so a snapshot mixes two sources.',
      'METAR archives carry limited quality control, and missing hours stay missing.',
      'Station pressure is estimated from the altimeter setting and station elevation, not measured directly.',
    ],
    limits: 'No key. Requests are paced one at a time to stay a polite client.',
    termsUrl: 'https://mesonet.agron.iastate.edu/ASOS/',
  },
};

/** Providers needing a key, for the interface to render a field only when one is selected. */
export function needsApiKey(id) { return Boolean(PROVIDERS[id]?.apiKey); }

/** Ordered for the picker: the one most people should use first. */
export const PROVIDER_ORDER = ['openmeteo', 'ncei', 'nasa', 'iem', 'visualcrossing'];
