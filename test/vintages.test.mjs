import test from 'node:test';
import assert from 'node:assert/strict';
import {DATASETS,MANIFEST_PATHS,assessVintages,summarizeVintages,parseVintage,vintageAge,statusFor} from '../src/vintages.js';
const at=(y,m,d)=>new Date(Date.UTC(y,m-1,d));
const age=(value,y,m,d)=>vintageAge(parseVintage(value),at(y,m,d));
const budget=id=>DATASETS.find(dataset=>dataset.id===id);
// Synthetic manifests in the committed shapes; every field the real check reads is present so an
// override is the only reason a dataset can come back unknown.
const manifests=(overrides={})=>({
 'data/energy/coverage.json':{pricesByState:{OK:{commercial:{lastPeriod:'2026-06'},industrial:{lastPeriod:'2026-06'}},TX:{commercial:{lastPeriod:'2026-05'}}}},
 'data/energy/manifest.json':{sources:{oedi2021:{vintage:2021},egrid2023:{vintage:2023},epaZip2023:{published:'2025-06'}},
  acquisition:[{file:'sales_revenue.xlsx',lastModified:'Wed, 26 Aug 2026 11:44:07 GMT'},{file:'geonames-US.zip',retrievedAt:'2026-09-11T21:11:17.475110+00:00'},{file:'geonames-PR.zip',retrievedAt:'2026-09-10T21:11:16.688495+00:00'}]},
 'data/weather/index.json':{sites:[{key:'tulsa',years:[2016,2024,2025]}]},
 'data/reference/noaa-provenance.json':{lastDate:'2026-09-08'},
 ...overrides});
const assess=(overrides,y,m,d)=>new Map(assessVintages(manifests(overrides),at(y,m,d)).map(item=>[item.id,item]));
test('data age is whole months since the covered period ended, across month and year boundaries',()=>{
 assert.deepEqual({...parseVintage('2026-06')},{granularity:'month',vintage:'2026-06',year:2026,month:6,day:30,endUTC:Date.UTC(2026,5,30)});
 assert.equal(age('2026-06',2026,6,30).ageMonths,0);
 assert.equal(age('2026-06',2026,7,29).ageMonths,0);
 assert.equal(age('2026-06',2026,7,30).ageMonths,1);
 assert.equal(age('2026-06',2026,9,14).ageMonths,2);
 assert.equal(age('2026-06',2026,12,31).ageMonths,6);
 assert.equal(age('2026-06',2027,1,1).ageMonths,6);
 assert.equal(age('2026-06',2027,1,30).ageMonths,7);
 // A data year ends on 31 December, so January of the next year is not yet a full month old.
 assert.equal(parseVintage(2023).day,31);
 assert.equal(age(2023,2024,1,30).ageMonths,0);
 assert.equal(age(2023,2024,1,31).ageMonths,1);
 assert.equal(age('2023',2026,9,14).ageMonths,32);
 // Retrieval dates keep day resolution; February anchors respect the actual month length.
 assert.equal(age('2026-09-11T21:11:17.475110+00:00',2026,9,14).ageDays,3);
 assert.equal(age('2026-09-11T21:11:17.475110+00:00',2027,9,10).ageMonths,11);
 assert.equal(age('2026-09-11T21:11:17.475110+00:00',2027,9,11).ageMonths,12);
 assert.equal(parseVintage('2024-02').day,29);
 assert.equal(parseVintage('2023-02').day,28);
 assert.equal(age('2024-02',2024,3,28).ageMonths,0);
 assert.equal(age('2024-02',2024,3,29).ageMonths,1);
 assert.equal(parseVintage('2023-02-29'),null);
});
test('each dataset is judged against its own cadence, so equal ages give different statuses',()=>{
 const same=assess({'data/energy/coverage.json':{pricesByState:{OK:{commercial:{lastPeriod:'2025-12'}}}},
  'data/energy/manifest.json':{sources:{oedi2021:{vintage:2021},egrid2023:{vintage:2025},epaZip2023:{published:'2025-06'}},acquisition:[{file:'geonames-US.zip',retrievedAt:'2026-09-11T00:00:00Z'}]}},2026,9,14);
 assert.equal(same.get('eia861m-prices').ageMonths,8);
 assert.equal(same.get('egrid-grid-mix').ageMonths,8);
 assert.equal(same.get('eia861m-prices').status,'aging');
 assert.equal(same.get('egrid-grid-mix').status,'current');
 // Thresholds are inclusive: a monthly series at exactly its budget is stale while an annual
 // grid vintage of the same age is not yet even aging.
 const stale=assess({'data/energy/coverage.json':{pricesByState:{OK:{commercial:{lastPeriod:'2025-11'}}}}},2026,9,14);
 assert.equal(stale.get('eia861m-prices').ageMonths,budget('eia861m-prices').staleAfterMonths);
 assert.equal(stale.get('eia861m-prices').status,'stale');
 const current=assess({},2026,9,14);
 assert.deepEqual([...current.values()].map(item=>[item.id,item.vintage,item.ageMonths,item.status]),[
  ['eia861m-prices','2026-06',2,'current'],
  ['oedi-utility-mapping','2021',56,'stale'],
  ['egrid-grid-mix','2023',32,'aging'],
  ['epa-zip-subregions','2025-06',14,'current'],
  ['geonames-zip-inventory','2026-09-11',0,'current'],
  ['bundled-weather-years','2025',8,'current'],
  ['noaa-reference-daily','2026-09-08',0,'current'],
 ]);
 assert.equal(statusFor(29,budget('oedi-utility-mapping')),'current');
 assert.equal(statusFor(30,budget('oedi-utility-mapping')),'aging');
 assert.equal(statusFor(48,budget('oedi-utility-mapping')),'stale');
 // The newest value wins when a manifest carries many: the catalog is as new as its latest month.
 assert.equal(assess({},2026,9,14).get('bundled-weather-years').vintage,'2025');
});
test('an unreadable vintage is unknown, never current, and never invents a date',()=>{
 const missing=assess({'data/energy/coverage.json':null,'data/reference/noaa-provenance.json':{},
  'data/energy/manifest.json':{sources:{oedi2021:{vintage:'eGRID2023_rev1 associations, published 2025-06'},egrid2023:{vintage:'annual'},epaZip2023:{published:null}},acquisition:[{file:'geonames-US.zip',retrievedAt:'not a date'}]},
  'data/weather/index.json':{sites:[{years:[]}]}},2026,9,14);
 for(const id of ['eia861m-prices','oedi-utility-mapping','egrid-grid-mix','epa-zip-subregions','geonames-zip-inventory','bundled-weather-years','noaa-reference-daily']){
  const item=missing.get(id);
  assert.equal(item.status,'unknown',id);
  assert.equal(item.vintage,null,id);
  assert.equal(item.ageMonths,null,id);
  assert.equal(item.ageDays,null,id);
  assert.match(item.note,/unknown|not a year, month or date/,id);
 }
 assert.match(missing.get('eia861m-prices').note,/data\/energy\/coverage\.json/);
 assert.match(missing.get('oedi-utility-mapping').note,/not a year, month or date/);
 const summary=summarizeVintages([...missing.values()]);
 assert.equal(summary.counts.current,0);
 assert.equal(summary.counts.unknown,7);
 assert.equal(summary.unknown.length,7);
 assert.equal(statusFor(null,budget('eia861m-prices')),'unknown');
 // Unknown outranks aging in the report but does not claim the data went bad, so it does not gate.
 assert.equal(summary.worst,'unknown');
 assert.equal(summary.exitCode,0);
});
test('the gate exits nonzero only when a dataset is past its own budget',()=>{
 const stale=summarizeVintages([...assess({},2031,1,15).values()]);
 assert.equal(stale.exitCode,1);
 assert.equal(stale.worst,'stale');
 assert.match(stale.headline,/7 stale/);
 assert.equal(stale.counts.stale,7);
 assert.deepEqual(stale.stale,DATASETS.map(dataset=>dataset.id));
 const fresh=summarizeVintages([...assess({'data/energy/manifest.json':{sources:{oedi2021:{vintage:2025},egrid2023:{vintage:2025},epaZip2023:{published:'2026-06'}},acquisition:[{file:'geonames-US.zip',retrievedAt:'2026-09-11T00:00:00Z'}]}},2026,9,14).values()]);
 assert.deepEqual(fresh.counts,{current:7,aging:0,stale:0,unknown:0});
 assert.equal(fresh.worst,'current');
 assert.equal(fresh.exitCode,0);
 assert.equal(fresh.headline,'7 current, 0 aging, 0 stale, 0 unknown');
 // One stale dataset among current ones still gates, and names itself.
 const mixed=summarizeVintages([...assess({'data/energy/coverage.json':{pricesByState:{OK:{commercial:{lastPeriod:'2024-01'}}}}},2026,9,14).values()]);
 assert.deepEqual(mixed.stale,['eia861m-prices','oedi-utility-mapping']);
 assert.equal(mixed.exitCode,1);
});
test('no dataset can be silently unreachable or unordered in the register',()=>{
 for(const dataset of DATASETS){
  assert.ok(dataset.agingAfterMonths<dataset.staleAfterMonths,dataset.id);
  assert.ok(MANIFEST_PATHS.includes(dataset.manifest),dataset.id);
  if(dataset.remote)assert.ok(MANIFEST_PATHS.includes(dataset.remote.manifest),dataset.id);
 }
 assert.equal(new Set(DATASETS.map(dataset=>dataset.id)).size,DATASETS.length);
});
