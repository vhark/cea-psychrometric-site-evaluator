/** Small request router. Files/Blobs cross the boundary without reading or parsing on the UI thread. */
export class WeatherClient {
  constructor({worker = new Worker(new URL('./weather-worker.js', import.meta.url), {type: 'module'})} = {}) {
    this.worker = worker;
    this.pending = new Map();
    this.sequence = 0;
    this.closed = false;
    this.onMessage = ({data}) => {
      const pending = this.pending.get(data?.requestId);
      if (!pending) return; // A cancelled operation can still finish; its result is never accepted.
      if (data.type === 'progress') { pending.onProgress?.(data.fraction, data.message); return; }
      if (data.type !== 'result' && data.type !== 'error') return;
      this.pending.delete(data.requestId);
      pending.cleanup();
      if (data.type === 'result') pending.resolve(data.result);
      else pending.reject(Object.assign(new Error(data.error?.message || 'Weather operation failed.'), {name: data.error?.name || 'Error'}));
    };
    this.onFailure = () => this.close(new Error('The weather worker stopped. Reload and retry; saved datasets remain available.'));
    worker.addEventListener('message', this.onMessage);
    worker.addEventListener('error', this.onFailure);
    worker.addEventListener('messageerror', this.onFailure);
  }
  request(operation, payload = {}, {signal, onProgress} = {}) {
    if (this.closed) return Promise.reject(new Error('Weather client is closed.'));
    if (signal?.aborted) return Promise.reject(new DOMException('Weather operation cancelled.', 'AbortError'));
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const abort = () => {
        if (!this.pending.delete(requestId)) return;
        cleanup();
        this.worker.postMessage({type: 'cancel', requestId});
        reject(new DOMException('Weather operation cancelled.', 'AbortError'));
      };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      this.pending.set(requestId, {resolve, reject, onProgress, cleanup});
      signal?.addEventListener('abort', abort, {once: true});
      try { this.worker.postMessage({type: 'request', requestId, operation, payload}); }
      catch (error) { this.pending.delete(requestId); cleanup(); reject(error); }
    });
  }
  fetch(options, controls) { return this.request('fetch', {options}, controls); }
  import(input, options = {}, controls) { return this.request('import', {input, options}, controls); }
  parseFile(input, options = {}, controls) { return this.request('parseFile', {input, options}, controls); }
  importRun(input, controls) { return this.request('importRun', {input}, controls); }
  save(snapshot, controls) { return this.request('save', {snapshot}, controls); }
  load(key = null, controls) { return this.request('load', {key}, controls); }
  list(options = {}, controls) { return this.request('list', options, controls); }
  export(id, controls) { return this.request('export', {id}, controls); }
  exportRun({results, snapshotId}, controls) { return this.request('exportRun', {results, snapshotId}, controls); }
  close(error = new Error('Weather client is closed.')) {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) { pending.cleanup(); pending.reject(error); }
    this.pending.clear();
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onFailure);
    this.worker.removeEventListener('messageerror', this.onFailure);
    this.worker.terminate();
  }
}
export const createWeatherClient = options => new WeatherClient(options);
