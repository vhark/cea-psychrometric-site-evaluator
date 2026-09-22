import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/weather-client.js').catch(() => ({}));
class FakeWorker extends EventTarget {
  sent = [];
  postMessage(message) { this.sent.push(message); }
  reply(data) { this.dispatchEvent(new MessageEvent('message', {data})); }
  terminate() { this.terminated = true; }
}
const create = () => {
  assert.equal(typeof module.WeatherClient, 'function', 'WeatherClient implements the request protocol');
  const worker = new FakeWorker();
  return {worker, client: new module.WeatherClient({worker})};
};

test('concurrent weather requests resolve only their own result and progress', async () => {
  const {worker, client} = create(), updates = [];
  const first = client.request('list', {}, {onProgress: (...args) => updates.push(args)});
  const second = client.request('load', {key: 'weather:sha256:fixture'});
  const [a, b] = worker.sent;
  assert.notEqual(a.requestId, b.requestId);
  assert.equal(a.operation, 'list');
  worker.reply({type: 'progress', requestId: a.requestId, fraction: 0.5, message: 'Index ready'});
  worker.reply({type: 'result', requestId: b.requestId, result: {id: 'fixture'}});
  worker.reply({type: 'result', requestId: a.requestId, result: []});
  assert.deepEqual(await second, {id: 'fixture'});
  assert.deepEqual(await first, []);
  assert.deepEqual(updates, [[0.5, 'Index ready']]);
  client.close();
});

test('abort rejects immediately, cancels worker work, and ignores stale results', async () => {
  const {worker, client} = create(), controller = new AbortController();
  const request = client.request('import', {input: new Blob(['large-file'])}, {signal: controller.signal});
  const rejected = assert.rejects(request, {name: 'AbortError'});
  controller.abort();
  await rejected;
  assert.deepEqual(worker.sent[1], {type: 'cancel', requestId: worker.sent[0].requestId});
  worker.reply({type: 'result', requestId: worker.sent[0].requestId, result: 'stale'});
  const next = client.list();
  worker.reply({type: 'result', requestId: worker.sent.at(-1).requestId, result: ['current']});
  assert.deepEqual(await next, ['current']);
  client.close();
});

test('an already aborted request never transfers its input', async () => {
  const {worker, client} = create(), controller = new AbortController();
  controller.abort();
  await assert.rejects(client.import(new Blob(['payload']), {}, {signal: controller.signal}), {name: 'AbortError'});
  assert.equal(worker.sent.length, 0);
  client.close();
});

test('worker error and close settle pending requests with recoverable errors', async () => {
  const {worker, client} = create();
  const request = client.save({hours: []});
  worker.reply({type: 'error', requestId: worker.sent[0].requestId, error: {name: 'QuotaExceededError', message: 'Storage is full. Export the run.'}});
  await assert.rejects(request, {name: 'QuotaExceededError', message: 'Storage is full. Export the run.'});
  const waiting = client.load();
  const rejected = assert.rejects(waiting, /closed/i);
  client.close();
  await rejected;
  assert.equal(worker.terminated, true);
  await assert.rejects(client.list(), /closed/i);
});

test('file import and export keep payload preparation off the caller thread', async () => {
  const {worker, client} = create(), input = new Blob(['provider payload']);
  const imported = client.import(input, {timezone: 'UTC'});
  assert.equal(worker.sent[0].payload.input, input);
  worker.reply({type: 'result', requestId: worker.sent[0].requestId, result: {id: 'verified', transport: {rawOmitted: true}}});
  assert.equal((await imported).id, 'verified');
  const exported = client.export('verified');
  assert.deepEqual(worker.sent.at(-1).payload, {id: 'verified'});
  const blob = new Blob(['{"raw":"provider payload"}'], {type: 'application/json'});
  worker.reply({type: 'result', requestId: worker.sent.at(-1).requestId, result: blob});
  assert.equal(await exported, blob);
  client.close();
});
