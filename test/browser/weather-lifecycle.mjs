import {WeatherClient} from '../../src/weather-client.js';
import {makeScenario} from '../../src/config.js';
const output=document.querySelector('#results'),status=document.querySelector('#status'),button=document.querySelector('#run');
const check=(value,message)=>{if(!value)throw new Error(message);};
const fixture=(changes={})=>({schemaVersion:1,source:'Synthetic weather lifecycle fixture',sourceKind:'synthetic browser integration fixture',
 dataKind:'synthetic',latitude:40,longitude:-105,timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01',
 retrievedAt:'2025-01-03T00:00:00Z',units:{time:'UTC epoch milliseconds',tempC:'C',rh:'fraction',dewPointC:'C',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'},
 raw:{fixture:'Synthetic data; never provider observations.'},hours:Array.from({length:24},(_,i)=>({time:Date.UTC(2025,0,1)+i*3600000,tempC:20,rh:.5,pressurePa:84000,ghiWm2:100,windMs:2})),...changes});
let passed=0;
async function test(name,work){await work();passed++;output.textContent+=`PASS ${name}\n`;}
// Fixture generation itself runs in a disposable worker, outside the measured UI path.
async function largeFixture(years,rawBytes){
 const source=`self.onmessage=({data})=>{const [years,rawBytes]=data,start=Date.UTC(2000,0,1),end=Date.UTC(2000+years,0,1),hours=[];
 for(let time=start;time<end;time+=3600000)hours.push({time,tempC:20,rh:.5,pressurePa:84000,ghiWm2:100,windMs:2});
 const snapshot={schemaVersion:1,source:'Synthetic responsiveness benchmark',sourceKind:'synthetic fixture',dataKind:'synthetic',latitude:40,longitude:-105,timezone:'UTC',startDate:'2000-01-01',endDate:(1999+years)+'-12-31',retrievedAt:'2025-01-03T00:00:00Z',units:{time:'UTC epoch milliseconds',tempC:'C',rh:'fraction',dewPointC:'C',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'},raw:{synthetic:'x'.repeat(rawBytes)},hours};
 self.postMessage(new Blob([JSON.stringify(snapshot)],{type:'application/json'}));};`;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);
 try{return await new Promise((resolve,reject)=>{worker.onmessage=({data})=>resolve(data);worker.onerror=reject;worker.postMessage([years,rawBytes]);});}
 finally{worker.terminate();URL.revokeObjectURL(url);}
}
async function benchmark(client){
 const baseline=new URLSearchParams(location.search).get('benchmark')==='baseline';
 if(baseline){
  // Reproduce the former main-thread preparation and raw-record listing path.
  // Keep v4 storage so both measurements use identical validation and persistence.
  const storage=await import('../../src/storage.js');
  client={import:async input=>storage.saveWeather(await input.text()),load:storage.loadCachedWeather,list:()=>new Promise((resolve,reject)=>{
   const open=indexedDB.open('cea-psychrometric-site-evaluator');open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{const db=open.result,tx=db.transaction('weatherSnapshots','readonly'),request=tx.objectStore('weatherSnapshots').getAll();let rows;
    request.onsuccess=()=>{rows=request.result.map(snapshot=>storage.weatherMetadata(snapshot));};
    tx.oncomplete=()=>{db.close();resolve(rows);};tx.onerror=()=>{db.close();reject(tx.error);};};
  })};
 }
 const measurements=[];
 for(const [label,years,rawBytes] of [['1 year',1,0],['10 years',10,0],['100 MB raw',1,100*1000*1000]]){
  const input=await largeFixture(years,rawBytes),tasks=[],observer=new PerformanceObserver(list=>tasks.push(...list.getEntries()));
  observer.observe({type:'longtask'});
  await new Promise(resolve=>setTimeout(resolve,25));tasks.length=0;
  const started=performance.now(),snapshot=await client.import(input),elapsedMs=performance.now()-started;
  const loadStarted=performance.now();await client.load(snapshot.id);const loadMs=performance.now()-loadStarted;
  const listStarted=performance.now();await client.list();await client.list();const repeatListMs=performance.now()-listStarted;
  await new Promise(resolve=>setTimeout(resolve,50));tasks.push(...observer.takeRecords());observer.disconnect();
  const row={label,bytes:input.size,hours:snapshot.hours.length,elapsedMs:Math.round(elapsedMs),loadMs:Math.round(loadMs),repeatListMs:Math.round(repeatListMs),maxMainTaskMs:Math.max(0,...tasks.map(task=>task.duration))};
  measurements.push(row);output.textContent+=`BENCHMARK ${JSON.stringify(row)}\n`;
 }
 globalThis.weatherBenchmark={mode:baseline?'main-thread baseline':'worker',userAgent:navigator.userAgent,measurements};
 if(!baseline)check(measurements.every(row=>row.maxMainTaskMs<=100),'Weather preparation exceeded the 100 ms main-thread task budget');
}
async function run(){
 check((location.origin==='http://localhost:8153'||(globalThis.__ISOLATED_TEST_CONTEXT__===true&&['localhost','127.0.0.1'].includes(location.hostname))),'Refusing writes outside isolated localhost:8153.');
 check((await indexedDB.databases()).length===0,'Use a fresh isolated browser context; this origin contains existing data.');
 const client=new WeatherClient();let current;
 try{
  await test('File import prepares and persists in a module Worker, returning a compact verified identity',async()=>{
   current=await client.import(new File([JSON.stringify(fixture())],'synthetic.json'));
   check(current.id?.startsWith('weather:sha256:'),'Missing verified snapshot identity');
   check(current.transport?.rawOmitted&&!Object.hasOwn(current,'raw'),'Worker returned raw payload');
   check((await client.load()).id===current.id,'Imported dataset was not persisted as latest');
  });
  await test('independent load/list requests retain correlation and hourly provenance',async()=>{
   const [snapshot,rows]=await Promise.all([client.load(current.id),client.list()]);
   check(snapshot.hours.length===24&&snapshot.hours[0].dataKind==='synthetic','Hourly provenance changed');
   check(rows.some(row=>row.key===current.id),'Metadata index lacks current snapshot');
  });
  await test('raw export is a Blob and roundtrip verifies the same immutable snapshot',async()=>{
   const blob=await client.export(current.id);check(blob instanceof Blob,'Raw export transferred a full object instead of a Blob');
   const original=JSON.parse(await blob.text());
   check(original.raw.fixture.startsWith('Synthetic'),'Raw evidence was lost');
   check(!original.transport,'Transport metadata leaked into the canonical export');
   check((await client.import(blob)).id===current.id,'Worker roundtrip changed content identity');
  });
  await test('portable run import/export retain scenarios and the full original snapshot',async()=>{
   const scenario={...makeScenario('greenhouseDouble'),latitude:40,longitude:-105,timezone:'UTC',outsideAirReviewed:true};
   const result={scenario,weatherSnapshotId:current.id,hours:[],summary:{}};
   const blob=await client.exportRun({results:[result],snapshotId:current.id});
   const exported=JSON.parse(await blob.text());
   check(exported.snapshot.raw.fixture,'Run export lost raw provider evidence');
   const imported=await client.importRun(blob);
   check(imported.scenarios.length===1&&imported.snapshot.id===current.id,'Portable import changed scenarios or snapshot');
   check(imported.snapshot.transport?.rawOmitted,'Portable import transferred raw');
  });
  await test('malformed import is recoverable and leaves latest intact',async()=>{
   let error;try{await client.import(new Blob(['{"broken":true}']));}catch(caught){error=caught;}
   check(error&&/schemaVersion/.test(error.message),'Malformed input did not return a recoverable validation error');
   check((await client.load()).id===current.id,'Malformed input changed latest');
  });
  await test('unsupported file size fails before parsing and leaves saved data available',async()=>{
   const part=new Blob(['x'.repeat(1024*1024)]),oversize=new Blob(Array(129).fill(part));
   let error;try{await client.import(oversize);}catch(caught){error=caught;}
   check(error?.name==='RangeError'&&/128 MiB/.test(error.message),'Oversize file lacked an explicit supported-size error');
   check((await client.load()).id===current.id,'Oversize file changed latest');
  });
  await test('cancelling preparation never commits a stale latest or extra revision',async()=>{
   const controller=new AbortController(),before=await client.list();
   const input=new Blob([JSON.stringify(fixture({retrievedAt:'2025-01-04T00:00:00Z',raw:{padding:'x'.repeat(5*1024*1024)}}))]);
   let error;try{await client.import(input,{}, {signal:controller.signal,onProgress:(fraction)=>{if(fraction>=.3)controller.abort();}});}catch(caught){error=caught;}
   check(error?.name==='AbortError','Cancellation did not settle with AbortError');
   // A subsequent request is a barrier: it runs after the worker receives cancel.
   check((await client.load()).id===current.id,'Cancelled preparation replaced latest');
   check((await client.list()).length===before.length,'Cancelled preparation persisted a stale revision');
  });
  await test('unknown operation returns a useful protocol error and worker remains usable',async()=>{
   let error;try{await client.request('does-not-exist');}catch(caught){error=caught;}
   check(/Unknown weather operation/.test(error?.message),'Unknown operation did not return an explicit error');
   check((await client.load()).id===current.id,'Worker stopped after a protocol error');
  });
  if(new URLSearchParams(location.search).has('benchmark'))await test('large fixture responsiveness measurements',()=>benchmark(client));
 }finally{client.close();}
}
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Running…';output.textContent='';
 try{await run();document.body.dataset.result='pass';status.textContent=`PASS ${passed} lifecycle checks`;}
 catch(error){document.body.dataset.result='fail';output.textContent+=`FAIL ${error.stack||error}\n`;status.textContent='FAIL';}
});
if(new URLSearchParams(location.search).has('autorun'))button.click();
