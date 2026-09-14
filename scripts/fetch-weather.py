#!/usr/bin/env python3
"""Fetch real Tulsa NASA POWER RE UTC calendar-year snapshots, Python 3.9+ stdlib.
Run: python3 scripts/fetch-weather.py [year ...]   (default 2025)
Original response bytes and SHA-256 are retained alongside the normalized file.
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
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


def main(year=2025):
    OUT.mkdir(parents=True, exist_ok=True)
    start = dt.datetime(year, 1, 1, tzinfo=ZoneInfo('America/Chicago')).astimezone(UTC)
    end = dt.datetime(year + 1, 1, 1, tzinfo=ZoneInfo('America/Chicago')).astimezone(UTC)
    cursor = start.date() - dt.timedelta(days=1)
    last = end.date()
    raw, records = [], {}
    while cursor <= last:
        stop = min(last, dt.date(cursor.year, 12, 31))
        params = dict(parameters=','.join(FIELDS), community='RE', longitude=-95.99,
                      latitude=36.15, start=cursor.strftime('%Y%m%d'), end=stop.strftime('%Y%m%d'),
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
        name = f'nasa-power-{cursor:%Y%m%d}-{stop:%Y%m%d}.json'
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
    snapshot = dict(schemaVersion=1, source='NASA POWER', sourceKind='gridded reanalysis + satellite solar',
                    latitude=36.15, longitude=-95.99, timezone='America/Chicago', zip='74103',
                    startDate=f'{year}-01-01', endDate=f'{year}-12-31', retrievedAt=dt.datetime.now(UTC).isoformat(),
                    sourceUrl=raw[0]['url'], sourceUrls=[item['url'] for item in raw],
                    units=dict(time='UTC epoch milliseconds', tempC='C', dewPointC='C', rh='fraction',
                               pressurePa='Pa', ghiWm2='W/m2', windMs='m/s'),
                    interval='UTC hour start; hourly mean meteorology; Wh/m² over one hour divided by 1 hour = W/m²',
                    sourceVersions=[item['payload']['header'] for item in raw],
                    coordinateNotes='Requested 36.15,-95.99 is not an airport station. POWER returns source-native grids: MERRA-2 meteorology 0.5° latitude × 0.625° longitude; SYN1deg solar 1° × 1°. Returned point coordinates do not identify grid-cell centers. Elevation from source geometry, not measured site elevation.',
                    coverage=dict(expectedHours=len(hours), weatherHours=sum(all(h[k] is not None for k in ('tempC', 'rh', 'pressurePa')) for h in hours),
                                  solarHours=sum(h['ghiWm2'] is not None for h in hours),
                                  startUTC=start.isoformat(), endExclusiveUTC=end.isoformat(),
                                  sourceQueryPadding='One UTC day before first local day, through UTC date of exclusive local end'),
                    raw=raw, hours=hours)
    encoded = (json.dumps(snapshot, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
    (OUT / f'tulsa-{year}.json').write_bytes(encoded)
    (OUT / f'tulsa-{year}.sha256').write_text(hashlib.sha256(encoded).hexdigest() + f'  tulsa-{year}.json\n')
    print(json.dumps(snapshot['coverage'], indent=2))
    print('Snapshot SHA-256:', hashlib.sha256(encoded).hexdigest())


if __name__ == '__main__':
    import sys
    for argument in (sys.argv[1:] or ['2025']):
        main(int(argument))
