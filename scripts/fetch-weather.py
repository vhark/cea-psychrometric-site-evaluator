#!/usr/bin/env python3
"""Fetch real NASA POWER RE UTC-sampled local-calendar-year snapshots, Python 3.9+ stdlib.

Run: python3 scripts/fetch-weather.py [--site KEY] [year ...]   (default: --site tulsa 2025)

One run writes one snapshot per requested year for one site. Original response bytes and their
SHA-256 are retained alongside the normalized file. A year whose coverage is short of its expected
hour count, or whose fetch fails, is reported and skipped; no partial snapshot is written.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

OUT = Path(__file__).resolve().parents[1] / 'data' / 'weather'
UTC = dt.timezone.utc
FIELDS = {'T2M': ('tempC', 'C', 1), 'RH2M': ('rh', '%', .01),
          'PS': ('pressurePa', 'kPa', 1000), 'ALLSKY_SFC_SW_DWN': ('ghiWm2', 'Wh/m^2', 1),
          'T2MDEW': ('dewPointC', 'C', 1), 'WS2M': ('windMs', 'm/s', 1)}

# Bundled climate archetypes. `latitude`/`longitude` are the requested query coordinates and are
# what the application matches a bundled site against (within 0.001 degrees), so they must stay
# identical to data/weather/index.json. `rawPrefix` names the retained response bytes; Tulsa's
# retained bytes predate the multi-site registry and keep their original unprefixed names.
SITES = {
    'tulsa': dict(key='tulsa', label='Tulsa, OK', zip='74103', latitude=36.15, longitude=-95.99,
                  timezone='America/Chicago', climate='humid subtropical, the worked example',
                  rawPrefix='', notes=''),
    'phoenix': dict(key='phoenix', label='Phoenix, AZ', zip='85004', latitude=33.4484, longitude=-112.0740,
                    timezone='America/Phoenix', climate='hot-dry',
                    rawPrefix='phoenix-',
                    notes='Arizona does not observe daylight saving time, so America/Phoenix is a '
                          'constant UTC-7 and the local calendar year is exactly 8,760 or 8,784 hours '
                          'with no repeated or skipped local hour.'),
    'miami': dict(key='miami', label='Miami, FL', zip='33101', latitude=25.7743, longitude=-80.1937,
                  timezone='America/New_York', climate='hot-humid',
                  rawPrefix='miami-', notes=''),
    'denver': dict(key='denver', label='Denver, CO', zip='80202', latitude=39.7392, longitude=-104.9903,
                   timezone='America/Denver', climate='cold-dry at altitude',
                   rawPrefix='denver-',
                   notes='Altitude lowers station pressure well below sea level, which exercises the '
                         'pressure-dependent psychrometric path rather than a 101.325 kPa assumption.'),
    'seattle': dict(key='seattle', label='Seattle, WA', zip='98104', latitude=47.6062, longitude=-122.3321,
                    timezone='America/Los_Angeles', climate='cool-marine',
                    rawPrefix='seattle-', notes=''),
}
DEFAULT_SITE = 'tulsa'
DEFAULT_YEAR = 2025


def fetch(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={
                    'User-Agent': 'ControlWindow-public-weather-snapshot/1.0'}), timeout=180) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            if isinstance(exc, urllib.error.HTTPError) and exc.code not in (429, 500, 502, 503, 504):
                raise
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))


def main(year=DEFAULT_YEAR, site=DEFAULT_SITE):
    """Write one local-calendar-year snapshot. Returns True when it was written."""
    place = SITES[site]
    OUT.mkdir(parents=True, exist_ok=True)
    zone = ZoneInfo(place['timezone'])
    start = dt.datetime(year, 1, 1, tzinfo=zone).astimezone(UTC)
    end = dt.datetime(year + 1, 1, 1, tzinfo=zone).astimezone(UTC)
    cursor = start.date() - dt.timedelta(days=1)
    last = end.date()
    raw, records = [], {}
    while cursor <= last:
        stop = min(last, dt.date(cursor.year, 12, 31))
        params = dict(parameters=','.join(FIELDS), community='RE', longitude=place['longitude'],
                      latitude=place['latitude'], start=cursor.strftime('%Y%m%d'), end=stop.strftime('%Y%m%d'),
                      format='JSON', **{'time-standard': 'UTC'})
        url = 'https://power.larc.nasa.gov/api/temporal/hourly/point?' + urllib.parse.urlencode(params)
        print('Fetching', url, flush=True)
        body = fetch(url)
        payload = json.loads(body)
        if payload.get('messages') or 'parameter' not in payload.get('properties', {}):
            raise ValueError('NASA POWER response error: ' + str(payload.get('messages', payload)))
        if payload['header']['time_standard'] != 'UTC':
            raise ValueError('NASA POWER did not return UTC')
        for parameter, (_, unit, _) in FIELDS.items():
            if payload['parameters'][parameter]['units'] != unit:
                raise ValueError('Unexpected source units for ' + parameter)
        name = f'nasa-power-{place["rawPrefix"]}{cursor:%Y%m%d}-{stop:%Y%m%d}.json'
        (OUT / name).write_bytes(body)
        raw.append(dict(url=url, retrievedAt=dt.datetime.now(UTC).isoformat(),
                        sha256=hashlib.sha256(body).hexdigest(), file=name, payload=payload))
        fill = payload['header']['fill_value']
        for parameter, (field, _, factor) in FIELDS.items():
            for stamp, value in payload['properties']['parameter'][parameter].items():
                instant = dt.datetime.strptime(stamp, '%Y%m%d%H').replace(tzinfo=UTC)
                if start <= instant < end:
                    record = records.setdefault(int(instant.timestamp() * 1000), {})
                    record[field] = None if value is None or value == fill else value * factor
        cursor = stop + dt.timedelta(days=1)
        if cursor <= last:
            time.sleep(1.2)
    hours = []
    instant = start
    while instant < end:
        stamp = int(instant.timestamp() * 1000)
        row = {'time': stamp, **{field: None for field, _, _ in FIELDS.values()}, **records.get(stamp, {})}
        row['quality'] = ['missing-' + field for field in ('tempC', 'rh', 'pressurePa', 'ghiWm2') if row[field] is None]
        hours.append(row)
        instant += dt.timedelta(hours=1)
    coverage = dict(expectedHours=len(hours),
                    weatherHours=sum(all(h[k] is not None for k in ('tempC', 'rh', 'pressurePa')) for h in hours),
                    solarHours=sum(h['ghiWm2'] is not None for h in hours),
                    startUTC=start.isoformat(), endExclusiveUTC=end.isoformat(),
                    sourceQueryPadding='One UTC day before first local day, through UTC date of exclusive local end')
    snapshot = dict(schemaVersion=1, source='NASA POWER', sourceKind='gridded reanalysis + satellite solar',
                    latitude=place['latitude'], longitude=place['longitude'], timezone=place['timezone'], zip=place['zip'],
                    startDate=f'{year}-01-01', endDate=f'{year}-12-31', retrievedAt=dt.datetime.now(UTC).isoformat(),
                    sourceUrl=raw[0]['url'], sourceUrls=[item['url'] for item in raw],
                    units=dict(time='UTC epoch milliseconds', tempC='C', dewPointC='C', rh='fraction',
                               pressurePa='Pa', ghiWm2='W/m2', windMs='m/s'),
                    interval='UTC hour start; hourly mean meteorology; Wh/m² over one hour divided by 1 hour = W/m²',
                    sourceVersions=[item['payload']['header'] for item in raw],
                    coordinateNotes=f'Requested {place["latitude"]},{place["longitude"]} is not an airport station. '
                                    'POWER returns source-native grids: MERRA-2 meteorology 0.5° latitude × 0.625° '
                                    'longitude; SYN1deg solar 1° × 1°. Returned point coordinates do not identify '
                                    'grid-cell centers. Elevation from source geometry, not measured site elevation.',
                    coverage=coverage,
                    raw=raw, hours=hours)
    if coverage['weatherHours'] != coverage['expectedHours'] or coverage['solarHours'] != coverage['expectedHours']:
        print(f'INCOMPLETE {site} {year}: expected {coverage["expectedHours"]} h, '
              f'weather {coverage["weatherHours"]} h, solar {coverage["solarHours"]} h. '
              'No snapshot written; retained response bytes remain for inspection.', flush=True)
        return False
    encoded = (json.dumps(snapshot, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
    (OUT / f'{site}-{year}.json').write_bytes(encoded)
    (OUT / f'{site}-{year}.sha256').write_text(hashlib.sha256(encoded).hexdigest() + f'  {site}-{year}.json\n')
    print(json.dumps(coverage, indent=2))
    print('Snapshot SHA-256:', hashlib.sha256(encoded).hexdigest())
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Fetch NASA POWER hourly weather for one bundled site and one or more local calendar years.',
        epilog='Sites: ' + '; '.join(f'{key} = {place["label"]} ({place["zip"]}, {place["climate"]})'
                                     for key, place in SITES.items()))
    parser.add_argument('--site', default=DEFAULT_SITE, choices=list(SITES),
                        help=f'bundled site key (default: {DEFAULT_SITE})')
    parser.add_argument('years', nargs='*', type=int, metavar='year',
                        help=f'local calendar years to fetch (default: {DEFAULT_YEAR})')
    arguments = parser.parse_args()
    skipped = []
    for requested in (arguments.years or [DEFAULT_YEAR]):
        try:
            if not main(requested, arguments.site):
                skipped.append(f'{arguments.site} {requested} incomplete coverage')
        except Exception as exc:  # one bad year must not abandon the rest of the run
            print(f'FAILED {arguments.site} {requested}: {type(exc).__name__}: {exc}', flush=True)
            skipped.append(f'{arguments.site} {requested} {type(exc).__name__}')
    if skipped:
        print('Skipped: ' + '; '.join(skipped), flush=True)
        sys.exit(1)
