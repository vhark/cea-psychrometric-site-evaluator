import {normalizeWeather, sealWeatherSnapshot} from '../../src/weather.js';
import {saveWeather, loadWeather, loadCachedWeather, listWeather, weatherKey} from '../../src/storage.js';
import {makeScenario} from '../../src/config.js';
import {simulateScenario} from '../../src/simulate.js';
import {downloadRun, parseImport} from '../../src/export.js';

const NAME='cea-psychrometric-site-evaluator';
const status=document.querySelector('#status'), output=document.querySelector('#results');
const run=document.querySelector('#run'), reset=document.querySelector('#reset');
const dedicated=(location.origin==='http://localhost:8153'||(globalThis.__ISOLATED_TEST_CONTEXT__===true&&['localhost','127.0.0.1'].includes(location.hostname)));
const units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const fixture=(changes={})=>({schemaVersion:1,source:'NASA POWER',sourceKind:'synthetic browser integration fixture',
 dataKind:'synthetic',latitude:40,longitude:-105,timezone:'America/Denver',startDate:'2025-01-01',endDate:'2025-01-01',
 retrievedAt:'2025-01-03T00:00:00Z',units,raw:{fixture:'Synthetic test data, never actual provider observations.'},
 hours:Array.from({length:24},(_,index)=>({time:Date.UTC(2025,0,1,7)+index*3600000,tempC:20,rh:.5,pressurePa:84000,ghiWm2:100,windMs:2,quality:['synthetic-test-fixture']})),...changes});
const legacyKey='40.000,-105.000|America/Denver|2025-01-01|2025-01-01';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
function opened(version){return new Promise((resolve,reject)=>{
 const request=version?indexedDB.open(NAME,version):indexedDB.open(NAME);
 request.onupgradeneeded=()=>{for(const name of ['snapshots','weather',...(version>=3?['weatherSnapshots','weatherRequests','weatherMeta']:[])])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Database blocked by another test-origin tab.'));
});}
function transaction(db,stores,mode,work){return new Promise((resolve,reject)=>{
 const tx=db.transaction(stores,mode);let value;
 tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'));
 work(tx,result=>{value=result;});
});}
async function allLegacy(){const db=await opened();try{return await transaction(db,['snapshots','weather'],'readonly',(tx,done)=>{
 const result={};let pending=2;
 for(const name of ['snapshots','weather']){const request=tx.objectStore(name).getAll();request.onsuccess=()=>{result[name]=request.result;if(!--pending)done(result);};}
});}finally{db.close();}}
async function withTimeout(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Timed out waiting for migration digest')),10000);})]);}finally{clearTimeout(timer);}}
let passed=0;
async function test(name,work){await work();passed++;output.textContent+=`PASS ${name}\n`;}

async function integration(){
 check(dedicated,'Refusing writes outside http://localhost:8153.');
 check(typeof indexedDB.databases==='function','This harness needs indexedDB.databases() to safely check the test origin.');
 check((await indexedDB.databases()).length===0,'Test origin already contains a database. Use Reset test database explicitly, or choose a clean browser profile.');
 let legacyBytes, migrated, revised, alternate, existingV3;
 await test('seed a version 2 database on the empty dedicated origin',async()=>{
  const db=await opened(2);try{await transaction(db,['snapshots','weather'],'readwrite',tx=>{
   tx.objectStore('snapshots').put(fixture(),'latest');tx.objectStore('weather').put(fixture(),legacyKey);
  });}finally{db.close();}
  legacyBytes=JSON.stringify(await allLegacy());
 });
 await test('seed a version 3 immutable revision before upgrading its derived index',async()=>{
  existingV3=await sealWeatherSnapshot(normalizeWeather(fixture({source:'Synthetic existing version 3 fixture'})));
  const db=await opened(3);try{await transaction(db,['weatherSnapshots','weatherRequests'],'readwrite',tx=>{
   tx.objectStore('weatherSnapshots').put(existingV3,existingV3.id);
   tx.objectStore('weatherRequests').put(existingV3.id,weatherKey(existingV3));
  });}finally{db.close();}
 });
 await test('migration racing a newer save cannot replace the latest pointer',async()=>{
  const original=crypto.subtle.digest;let release,first=true,reached;
  const atDigest=new Promise(resolve=>{reached=resolve;});
  crypto.subtle.digest=async function(...args){
   if(first){first=false;reached();await new Promise(resolve=>{release=resolve;});}
   return original.apply(this,args);
  };
  let loading;
  try{
   loading=loadWeather();await withTimeout(atDigest);
   revised=await saveWeather(fixture({retrievedAt:'2025-01-04T00:00:00Z',hours:fixture().hours.map(hour=>({...hour,tempC:21}))}));
   release();migrated=await loading;
  }finally{crypto.subtle.digest=original;release?.();if(loading)await loading.catch(()=>{});}
  check(migrated.id!==revised.id,'Revised weather must have a different content ID');
  check((await loadWeather()).id===revised.id,'Migration overwrote the newer latest pointer');
 });
 await test('version 4 migration keeps both legacy stores byte-identical',async()=>{
  const db=await opened();try{check(db.version===4,'Expected database version 4');}finally{db.close();}
  check(JSON.stringify(await allLegacy())===legacyBytes,'Legacy store values changed during migration');
  check((await loadCachedWeather(legacyKey)).id===migrated.id,'Legacy key did not resolve its exact migrated snapshot');
 });
 await test('version 3 revisions receive metadata and compact views without identity changes',async()=>{
  const compact=await loadCachedWeather(existingV3.id,{compact:true});
  check(compact?.id===existingV3.id&&compact.transport?.rawOmitted,'Existing revision lacks a compact view');
  check(JSON.stringify(await loadCachedWeather(existingV3.id))===JSON.stringify(existingV3),'Upgrade changed original revision');
  check((await listWeather()).some(row=>row.key===existingV3.id),'Existing revision lacks metadata index');
 });
 await test('NASA and Open-Meteo coexist at identical coordinates and dates',async()=>{
  alternate=await saveWeather(fixture({source:'Open-Meteo ERA5',retrievedAt:'2025-01-05T00:00:00Z'}),{latest:false});
  check(weatherKey(alternate)!==weatherKey(revised),'Provider request keys collided');
  check((await loadCachedWeather(weatherKey(alternate))).id===alternate.id,'Open-Meteo request did not resolve');
  check((await loadCachedWeather(weatherKey(revised))).id===revised.id,'NASA request lost its newest revision');
 });
 await test('old revisions remain addressable and listing does not roll back pointers',async()=>{
  const listed=await listWeather();
  for(const expected of [migrated,revised,alternate]){
   check(listed.some(row=>row.key===expected.id),'A revision is missing from metadata listing');
   check(JSON.stringify(await loadCachedWeather(expected.id))===JSON.stringify(expected),'Exact snapshot ID returned different data');
  }
  check(listed.filter(row=>row.provider?.id==='nasa').length===2,'Expected both NASA revisions');
  check((await loadCachedWeather(weatherKey(revised))).id===revised.id,'Listing legacy records replaced the newer request pointer');
 check((await loadWeather()).id===revised.id,'latest:false save or listing changed latest');
  check(JSON.stringify(await allLegacy())===legacyBytes,'Listing changed legacy stores');
 });
 await test('repeated metadata lists deserialize no raw snapshots or legacy rows',async()=>{
  await listWeather();
  const original=IDBDatabase.prototype.transaction,readStores=[];
  try{
   IDBDatabase.prototype.transaction=function(names,...args){readStores.push(...(typeof names==='string'?[names]:Array.from(names)));return original.call(this,names,...args);};
   const rows=await listWeather();await listWeather();
   check(rows.some(row=>row.key===revised.id),'Metadata revision disappeared');
  }finally{IDBDatabase.prototype.transaction=original;}
  check(!readStores.some(name=>['weatherSnapshots','snapshots','weather'].includes(name)),`Repeated listing read raw stores: ${readStores.join(', ')}`);
 });
 await test('compact loads preserve identity and hourly evidence without raw payloads',async()=>{
  const compact=await loadCachedWeather(revised.id,{compact:true});
  check(compact.id===revised.id,'Compact load changed snapshot identity');
  check(!Object.hasOwn(compact,'raw')&&compact.transport?.rawOmitted,'Compact load returned raw');
  check(JSON.stringify(compact.hours)===JSON.stringify(revised.hours),'Compact load changed hourly evidence');
  let refused=false;try{await saveWeather(compact);}catch(error){refused=/compact/i.test(error.message);}
  check(refused,'Saving a compact transport view must not reseal it as a full snapshot');
 });
 await test('explicit legacy audit detects same-key changes and memoizes ordinary lists',async()=>{
  const changed=fixture({retrievedAt:'2025-01-07T00:00:00Z'});
  const expected=await sealWeatherSnapshot(normalizeWeather(changed));
  const db=await opened();try{await transaction(db,'weather','readwrite',tx=>tx.objectStore('weather').put(changed,legacyKey));}finally{db.close();}
  check(!(await listWeather()).some(row=>row.key===expected.id),'Ordinary list unexpectedly rescanned legacy store');
  check((await listWeather({refreshLegacy:true})).some(row=>row.key===expected.id),'Audit missed changed legacy record');
  check((await loadWeather()).id===revised.id,'Legacy audit changed latest');
  check((await loadCachedWeather(weatherKey(revised))).id===revised.id,'Legacy audit replaced current request');
  const restore=await opened();try{await transaction(restore,'weather','readwrite',tx=>tx.objectStore('weather').put(fixture(),legacyKey));}finally{restore.close();}
 });
 await test('a superseded save finishing its digest changes no persisted records or pointers',async()=>{
  const before=await listWeather(),original=crypto.subtle.digest;let current=true,cancelled;
  try{
   crypto.subtle.digest=async function(...args){const digest=await original.apply(this,args);current=false;return digest;};
   cancelled=await saveWeather(fixture({retrievedAt:'2025-01-06T00:00:00Z'}),{isCurrent:()=>current});
  }finally{crypto.subtle.digest=original;}
  check((await loadWeather()).id===revised.id,'Superseded save changed latest');
  check((await loadCachedWeather(weatherKey(revised))).id===revised.id,'Superseded save changed request pointer');
  check(await loadCachedWeather(cancelled.id)===null,'Superseded save persisted a new snapshot');
  check((await listWeather()).length===before.length,'Superseded save changed revision count');
 });
 await test('failed index writes roll back raw revision, compact record and lookup pointers atomically',async()=>{
  const input=fixture({retrievedAt:'2025-01-08T00:00:00Z'}),expected=await sealWeatherSnapshot(normalizeWeather(input));
  const original=IDBObjectStore.prototype.add;let rejected;
  try{
   IDBObjectStore.prototype.add=function(value,key){return original.call(this,value,this.name==='weatherIndex'?revised.id:key);};
   try{await saveWeather(input);}catch(error){rejected=error;}
  }finally{IDBObjectStore.prototype.add=original;}
  check(rejected&&/storage|save weather/i.test(rejected.message),'Failed write did not return a recoverable storage error');
  check(await loadCachedWeather(expected.id)===null,'Aborted transaction left a raw revision');
  check(await loadCachedWeather(expected.id,{compact:true})===null,'Aborted transaction left a compact revision');
  check(!(await listWeather()).some(row=>row.key===expected.id),'Aborted transaction left index metadata');
  check((await loadWeather()).id===revised.id,'Aborted transaction changed latest');
  check((await loadCachedWeather(weatherKey(revised))).id===revised.id,'Aborted transaction changed request pointer');
 });
 await test('quota exceptions and in-flight cancellation roll back the complete transaction',async()=>{
  for(const kind of ['quota','cancel']){
   const input=fixture({retrievedAt:kind==='quota'?'2025-01-09T00:00:00Z':'2025-01-10T00:00:00Z'}),expected=await sealWeatherSnapshot(normalizeWeather(input));
   const original=IDBObjectStore.prototype.add,controller=new AbortController();let rejected;
   try{
    IDBObjectStore.prototype.add=function(...args){
     if(this.name==='weatherIndex'){
      if(kind==='quota')throw new DOMException('Synthetic quota denial','QuotaExceededError');
      controller.abort();return;
     }
     return original.apply(this,args);
    };
    try{await saveWeather(input,{signal:controller.signal});}catch(error){rejected=error;}
   }finally{IDBObjectStore.prototype.add=original;}
   check(rejected,`${kind} did not reject`);
   check(await loadCachedWeather(expected.id)===null,`${kind} left a raw revision`);
   check(await loadCachedWeather(expected.id,{compact:true})===null,`${kind} left a compact revision`);
   check(!(await listWeather()).some(row=>row.key===expected.id),`${kind} left metadata`);
   check((await loadWeather()).id===revised.id,`${kind} replaced current weather`);
  }
 });
 await test('schema 1 import preserves non-UTC local-day boundaries and hash on roundtrip',async()=>{
  check(migrated.schemaVersion===2&&migrated.timezone==='America/Denver','Import lost schema or time zone');
  check(migrated.hours.length===24&&migrated.hours[0].time===Date.UTC(2025,0,1,7),'Local-day UTC start changed');
  check(migrated.hours.at(-1).time===Date.UTC(2025,0,2,6),'Local-day UTC end changed');
  check((await sealWeatherSnapshot(normalizeWeather(JSON.stringify(migrated)))).id===migrated.id,'Re-import changed the weather hash');
 });
 await test('mixed forecast records remain visible but are excluded from historical selection',async()=>{
  const input=fixture({schemaVersion:2,dataKind:'mixed'});input.hours[0]={...input.hours[0],source:'fcst',dataKind:'forecast'};
  const forecast=await saveWeather(input,{latest:false});
  const listed=await listWeather(), entry=listed.find(row=>row.key===forecast.id);
  check(entry&&entry.historicalEligible===false,'Mixed forecast is eligible as cached historical weather');
  check(listed.find(row=>row.key===revised.id)?.historicalEligible===true,'Historical synthetic test fixture unexpectedly excluded');
 });
 await test('simulation and actual JSON export/re-import retain the exact snapshot ID',async()=>{
  const scenario={...makeScenario('greenhouseDouble'),latitude:40,longitude:-105,timezone:'America/Denver',outsideAirReviewed:true};
  const result=simulateScenario(scenario,revised,{stepMinutes:5});
  check(result.weatherSnapshotId===revised.id,'Simulation lost the snapshot ID');
  let exported;
  const originalURL=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;
  try{
   URL.createObjectURL=blob=>{exported=blob;return 'blob:weather-test-captured';};
   HTMLAnchorElement.prototype.click=function(){};
   for(const format of ['csv','report']){downloadRun([result],revised,format);check((await exported.text()).includes(revised.id),`${format} export lost snapshot identity`);}
   downloadRun([result],revised,'json');
  }finally{URL.createObjectURL=originalURL;HTMLAnchorElement.prototype.click=originalClick;}
  check(exported instanceof Blob,'JSON export did not produce a Blob');
  const json=await exported.text(),portable=JSON.parse(json),imported=parseImport(json);
  check(portable.results[0].weatherSnapshotId===revised.id,'Exported result lost snapshot identity');
  check(imported.snapshot.id===revised.id,'Portable import lost snapshot identity');
  check((await sealWeatherSnapshot(normalizeWeather(imported.snapshot))).id===revised.id,'Export/re-import changed the content hash');
 });
}
run.addEventListener('click',async()=>{
 run.disabled=reset.disabled=true;passed=0;output.textContent='';status.className='';status.textContent='Running actual IndexedDB integration tests…';
 try{await integration();status.textContent=`PASS: ${passed} browser integration checks`;status.className='pass';document.body.dataset.result='pass';}
 catch(error){output.textContent+=`FAIL ${error.stack||error.message}\n`;status.textContent=`FAIL after ${passed} checks`;status.className='fail';document.body.dataset.result='fail';}
 finally{run.disabled=reset.disabled=!dedicated;}
});
reset.addEventListener('click',async()=>{
 if(!dedicated)return;
 run.disabled=reset.disabled=true;
 try{await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(NAME);request.onsuccess=resolve;request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('Close other tabs on the test origin before reset.'));});status.textContent='Test database explicitly reset. Ready to run.';output.textContent='';delete document.body.dataset.result;}
 catch(error){status.textContent=error.message;}
 finally{run.disabled=reset.disabled=false;}
});
run.disabled=reset.disabled=!dedicated;
status.textContent=dedicated?'Ready. Run tests writes synthetic fixtures to this empty test origin.':'Refusing writes: open http://localhost:8153/test/browser/weather-storage.html';
if(dedicated&&new URLSearchParams(location.search).has('autorun'))run.click();
