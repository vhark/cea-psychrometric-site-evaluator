#!/usr/bin/env node
// Report how old every bundled data snapshot is against its own staleness budget (audit item 6).
// Reads committed manifests only, writes nothing, and makes no network request unless asked:
//
//   node scripts/check-vintages.mjs                  aligned table; exit 1 if anything is stale
//   node scripts/check-vintages.mjs --json           same assessment as machine output
//   node scripts/check-vintages.mjs --check-remote    additionally probe each recorded source URL
//   node scripts/check-vintages.mjs --now 2026-09-14  assess against a fixed UTC clock
//   node scripts/check-vintages.mjs --timeout 10      per-request seconds for --check-remote
//
// Exit code: 0 when nothing is stale, 1 when at least one dataset is past its budget (so this can
// gate a workflow), 2 on a usage error. Remote findings are informational and never change the
// code: an upstream file that moved is not evidence that the local snapshot went bad. Nothing here
// mutates a data file; refreshing is always a deliberate, separate command.
import {readFileSync} from 'node:fs';
import {DATASETS, MANIFEST_PATHS, assessVintages, summarizeVintages, pluck} from '../src/vintages.js';

const USER_AGENT = 'ControlWindow-vintage-check/1.0';
const here = path => new URL(path, import.meta.url);
const options = {json: false, remote: false, now: undefined, timeoutMs: 10000};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
 const arg = argv[i];
 if (arg === '--json') options.json = true;
 else if (arg === '--check-remote') options.remote = true;
 else if (arg === '--now') options.now = argv[++i];
 else if (arg === '--timeout') options.timeoutMs = Number(argv[++i]) * 1000;
 else fail(`Unknown argument ${arg}. Usage: check-vintages.mjs [--json] [--check-remote] [--now YYYY-MM-DD] [--timeout seconds]`);
}
if (options.now !== undefined && !Number.isFinite(new Date(options.now).getTime())) fail(`--now ${options.now} is not a date.`);
if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) fail('--timeout needs a positive number of seconds.');

function fail(message) {
 process.stderr.write(message + '\n');
 process.exit(2);
}

// A manifest that is missing or unreadable stays null: assessVintages reports that as unknown
// rather than substituting a date.
const manifests = {};
const unreadable = [];
for (const path of MANIFEST_PATHS) {
 try {
  manifests[path] = JSON.parse(readFileSync(here('../' + path), 'utf8'));
 } catch (error) {
  manifests[path] = null;
  unreadable.push(`${path}: ${error.message}`);
 }
}

const clock = options.now === undefined ? new Date() : new Date(options.now);
const assessments = assessVintages(manifests, clock);
const summary = summarizeVintages(assessments);
const remote = options.remote ? await checkRemote() : null;

if (options.json) {
 process.stdout.write(JSON.stringify({generatedAt: new Date().toISOString(), clock: clock.toISOString(), unreadableManifests: unreadable, datasets: assessments, summary, remote}, null, 2) + '\n');
} else {
 process.stdout.write(render() + '\n');
}
process.exit(summary.exitCode);

function render() {
 const header = ['Dataset', 'Vintage', 'Age', 'Status', 'Refresh'];
 const rows = assessments.map(item => [
  item.id,
  item.vintage ?? 'unknown',
  item.ageMonths === null ? '-' : `${item.ageMonths} mo`,
  item.status.toUpperCase(),
  item.refreshCommand,
 ]);
 const width = header.map((_, column) => Math.max(...[header, ...rows].map(row => row[column].length)));
 const line = row => row.map((cell, column) => (column === 2 ? cell.padStart(width[column]) : cell.padEnd(width[column]))).join('  ').trimEnd();
 const out = [
  `Bundled data vintages at ${clock.toISOString().slice(0, 10)} (UTC), ${assessments.length} datasets. Ages are whole months since each covered period ended.`,
  '',
  line(header),
  line(width.map(w => '-'.repeat(w))),
  ...rows.map(line),
  '',
  `${summary.headline}. Budgets are per dataset; see docs/ENERGY-DATA.md "Vintage and refresh".`,
 ];
 for (const item of assessments.filter(a => a.status !== 'current')) {
  out.push('', `${item.id} (${item.status}, budget ${item.agingAfterMonths}/${item.staleAfterMonths} mo aging/stale): ${item.note}`);
 }
 if (unreadable.length) out.push('', 'Unreadable manifests: ' + unreadable.join('; '));
 if (remote) out.push('', ...renderRemote());
 out.push('', summary.exitCode ? 'Stale datasets found. Nothing refreshes automatically; run the refresh command above deliberately.' : 'Nothing is past its budget. Nothing refreshes automatically.');
 return out.join('\n');
}

function renderRemote() {
 const lines = ['Upstream check (informational; does not affect the exit code):'];
 if (remote.every(probe => probe.error)) lines.push(' Network unavailable: every probe failed. Upstream state is unknown and the local vintages above are unaffected.');
 for (const probe of remote) {
  const verdict = probe.error ? `unreachable (${probe.error})`
   : !probe.ok ? `HTTP ${probe.status}: upstream file may have moved or been withdrawn`
   : probe.newerThanLocal === true ? `HTTP ${probe.status}, upstream last-modified ${probe.lastModified} is NEWER than the local ${probe.localLastModified}`
   : probe.newerThanLocal === false ? `HTTP ${probe.status}, upstream unchanged since ${probe.localLastModified}`
   : `HTTP ${probe.status}, last-modified ${probe.lastModified ?? 'not reported'}; no local last-modified recorded to compare`;
  lines.push(` ${probe.id}: ${verdict}`);
  lines.push(`   ${probe.url}`);
 }
 for (const dataset of DATASETS.filter(d => !d.remote)) lines.push(` ${dataset.id}: skipped, ${dataset.manifest} records no source URL.`);
 return lines;
}

// HEAD first; some publishers reject HEAD, so fall back to a one-byte ranged GET rather than
// downloading a 21 MB workbook to learn its date.
async function probe(url) {
 const request = method => fetch(url, {method, redirect: 'follow', headers: method === 'GET' ? {'User-Agent': USER_AGENT, Range: 'bytes=0-0'} : {'User-Agent': USER_AGENT}, signal: AbortSignal.timeout(options.timeoutMs)});
 let response = await request('HEAD');
 if ([403, 405, 501].includes(response.status)) response = await request('GET');
 return {ok: response.ok, status: response.status, lastModified: response.headers.get('last-modified')};
}

async function checkRemote() {
 const probes = [];
 for (const dataset of DATASETS) {
  if (!dataset.remote) continue;
  const manifest = manifests[dataset.remote.manifest];
  const urls = [...new Set(pluck(manifest, dataset.remote.urlField).filter(value => typeof value === 'string'))];
  const localDates = dataset.remote.lastModifiedField ? pluck(manifest, dataset.remote.lastModifiedField).filter(value => typeof value === 'string') : [];
  const local = localDates.map(value => ({value, time: new Date(value).getTime()})).filter(entry => Number.isFinite(entry.time)).sort((a, b) => b.time - a.time)[0] || null;
  if (!urls.length) {
   probes.push({id: dataset.id, url: null, error: `${dataset.remote.manifest} records no URL at ${dataset.remote.urlField}`, ok: null, status: null, lastModified: null, localLastModified: local?.value ?? null, newerThanLocal: null});
   continue;
  }
  for (const url of urls) {
   const record = {id: dataset.id, url, localLastModified: local?.value ?? null, ok: null, status: null, lastModified: null, newerThanLocal: null, error: null};
   try {
    Object.assign(record, await probe(url));
   } catch (error) {
    record.error = error.name === 'TimeoutError' ? `timed out after ${options.timeoutMs / 1000} s` : `${error.name}: ${error.message}`;
   }
   const upstream = record.lastModified ? new Date(record.lastModified).getTime() : NaN;
   if (Number.isFinite(upstream) && local) record.newerThanLocal = upstream > local.time;
   probes.push(record);
  }
 }
 return probes;
}
