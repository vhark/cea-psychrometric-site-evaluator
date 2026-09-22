import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherKey, weatherMetadata} from '../src/storage.js';

const request = {
  latitude: 40.12345, longitude: -105.98765, timezone: 'America/Denver',
  startDate: '2026-09-01', endDate: '2026-09-02', dataKind: 'observation',
  provider: {id: 'iem', product: 'metar', model: null, stationId: 'KDEN'},
};

test('request keys distinguish provider, product, model, station and data kind', () => {
  const keys = [weatherKey(request)];
  for (const [field, value] of [['id', 'ncei'], ['product', 'isd'], ['model', 'model-a'], ['stationId', 'KBJC']]) {
    keys.push(weatherKey({...request, provider: {...request.provider, [field]: value}}));
  }
  keys.push(weatherKey({...request, dataKind: 'reanalysis'}));
  assert.equal(new Set(keys).size, keys.length, 'different evidence must not share a request cache entry');
});

test('forecast issuances and model runs have separate request entries', () => {
  const forecast = {...request, dataKind: 'forecast', forecast: {issuedAt: '2026-08-31T00:00:00Z', runId: '00'}};
  const later = {...forecast, forecast: {...forecast.forecast, issuedAt: '2026-08-31T06:00:00Z'}};
  const otherRun = {...forecast, forecast: {...forecast.forecast, runId: '06'}};
  assert.equal(new Set([forecast, later, otherRun].map(weatherKey)).size, 3);
});

test('request keys preserve exact coordinates and local calendar interpretation', () => {
  const variants = [request,
    {...request, latitude: 40.12346}, {...request, longitude: -105.98766},
    {...request, timezone: 'UTC'}, {...request, endDate: '2026-09-03'},
  ];
  assert.equal(new Set(variants.map(weatherKey)).size, variants.length);
});

test('same request matches regardless of property order or retrieval metadata', () => {
  assert.equal(weatherKey(request), weatherKey({
    ...request, provider: {stationId: 'KDEN', model: null, product: 'metar', id: 'iem'},
    retrievedAt: '2026-09-22T01:00:00Z', source: 'display text', hours: [{tempC: 20}],
  }));
});

test('missing location or date bounds does not claim a request cache key', () => {
  for (const field of ['latitude', 'longitude', 'startDate', 'endDate']) {
    assert.equal(weatherKey({...request, [field]: null}), null);
  }
});


test('historical cache eligibility checks hourly provenance inside mixed snapshots', () => {
  const hours = [{time: Date.UTC(2025, 0, 1), tempC: 20, dataKind: 'observation'}];
  const historical = {...request, hours};
  assert.equal(weatherMetadata(historical).historicalEligible, true);
  for (const forecastHour of [
    {...hours[0], dataKind: 'forecast'},
    {...hours[0], source: 'histfcst'},
    {...hours[0], source: 'comb'},
  ]) {
    assert.equal(weatherMetadata({...historical, dataKind: 'mixed', hours: [...hours, forecastHour]}).historicalEligible, false);
  }
});

test('future and statistical values cannot become eligible cached history', () => {
  const historical = {...request, hours: [{time: Date.UTC(2025, 0, 1), tempC: 20}]};
  assert.equal(weatherMetadata({...historical, dataKind: 'statistical'}).historicalEligible, false);
  assert.equal(weatherMetadata({...historical, hours: [{time: Date.UTC(2099, 0, 1), tempC: 20}]}).historicalEligible, false);
});
