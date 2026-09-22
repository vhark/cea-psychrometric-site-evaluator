import {weatherQuality} from './weather-quality.js';
import {fetchWeather,normalizeWeather} from './weather.js';
import {assertHistoricalWeather} from './weather-contract.js';
import {saveWeather,loadWeather,loadCachedWeather,listWeather,compactWeather,weatherMetadata} from './storage.js';
import {parseImport} from './export.js';
import {MODEL_VERSION,SCENARIO_SCHEMA_VERSION,migrateScenario} from './config.js';

// Limit applies before reading a File, so an unsupported import cannot allocate an
// unbounded parse buffer. 100 MB fixtures fit with ample JSON/header overhead.
const MAX_IMPORT_BYTES=128*1024*1024;
const active=new Map();
// Only persistence failures retain raw in worker memory. No raw payload is sent to
// the page, and the warning makes the reload/export consequence explicit.
const volatile=new Map();let volatileLatest=null;
const view=snapshot=>snapshot?{...compactWeather(snapshot),preanalysisQuality:weatherQuality(snapshot)}:null;
const memoryView=entry=>({...view(entry.snapshot),cacheWarning:entry.warning});
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
async function readInput(input,signal){
 if(input instanceof Blob){
  if(input.size>MAX_IMPORT_BYTES)throw new RangeError('Weather import exceeds 128 MiB. Split it into smaller date ranges and import again.');
  input=await input.text();
 }else if(typeof input==='string'&&input.length>MAX_IMPORT_BYTES){
  throw new RangeError('Weather import exceeds 128 MiB. Split it into smaller date ranges and import again.');
 }
 signal.throwIfAborted();
 return input;
}
async function original(id){
 if(typeof id!=='string'||!id.startsWith('weather:sha256:'))throw new Error('Export requires an exact saved weather snapshot ID.');
 const snapshot=volatile.get(id)?.snapshot??await loadCachedWeather(id);
 if(!snapshot||snapshot.id!==id)throw new Error('The original weather snapshot is missing. Import its saved JSON before exporting this run.');
 return snapshot;
}
async function execute(operation,payload,{signal,progress}){
 const checkpoint=async()=>{await pause();signal.throwIfAborted();};
 const save=async(input,options={})=>{
  await checkpoint();
  progress(.6,'Validating, identifying and saving weather');
  if(options.historicalOnly){input=normalizeWeather(input,options);assertHistoricalWeather(input);}
  let cacheWarning=null;
  const saved=await saveWeather(input,{...options,signal,isCurrent:()=>!signal.aborted,onStorageError:(error,snapshot)=>{
   cacheWarning=`Weather is available for this session, but browser storage failed. Export JSON before reloading. ${error.message}`;
   volatile.set(snapshot.id,{snapshot,warning:cacheWarning});
   if(options.latest!==false)volatileLatest=snapshot.id;
  }});
  signal.throwIfAborted();
  if(cacheWarning)return memoryView(volatile.get(saved.id));
  volatile.delete(saved.id);
  if(options.latest!==false)volatileLatest=null;
  return view(saved);
 };
 switch(operation){
  case 'fetch':{
   progress(0,'Requesting weather');
   const {latest=true,historicalOnly=false,...providerOptions}=payload.options||{};
   const snapshot=await fetchWeather({...providerOptions,signal,onProgress:(fraction,message)=>progress(fraction*.55,message)});
   return save(snapshot,{latest,historicalOnly});
  }
  case 'import':{
   progress(.1,'Reading weather file');
   const input=await readInput(payload.input,signal);
   progress(.3,'Weather file received');
   return save(input,payload.options);
  }
  case 'save':return save(payload.snapshot,{latest:payload.latest!==false});
  case 'parseFile':{
   progress(.1,'Reading import file');
   let input=await readInput(payload.input,signal);
   progress(.3,'Identifying import format');await checkpoint();
   if(typeof input==='string'&&input.trimStart().startsWith('{')){
    try{input=JSON.parse(input);}catch{throw new Error('Invalid import JSON.');}
   }
   if(typeof input==='string'||Array.isArray(input?.hours))return {scenarios:[],snapshot:await save(input,payload.options)};
   const {scenarios,snapshot}=parseImport(input);
   return {scenarios,snapshot:snapshot?await save(snapshot,payload.options):null};
  }
  case 'importRun':{
   progress(.1,'Reading portable run');
   const input=await readInput(payload.input,signal);
   progress(.3,'Validating portable scenarios');
   await checkpoint();
   const {scenarios,snapshot}=parseImport(input);
   return {scenarios,snapshot:snapshot?await save(snapshot):null};
  }
  case 'load':{
   progress(.1,'Loading saved dataset');
   const memory=volatile.get(payload.key||volatileLatest);
   if(memory)return memoryView(memory);
   return view(await (payload.key?loadCachedWeather(payload.key,{compact:true}):loadWeather({compact:true})));
  }
  case 'list':{
   progress(.1,payload.refreshLegacy?'Auditing legacy weather':'Reading dataset index');
   let rows;
   try{rows=await listWeather({refreshLegacy:!!payload.refreshLegacy});}
   catch(error){if(!volatile.size)throw error;rows=[];}
   const merged=new Map(rows.map(row=>[row.key,row]));
   for(const [id,entry] of volatile)merged.set(id,weatherMetadata(entry.snapshot,id,{cacheWarning:entry.warning}));
   return [...merged.values()];
  }
  case 'export':{
   progress(.1,'Reading original weather evidence');
   const snapshot=await original(payload.id);await checkpoint();
   progress(.7,'Preparing weather JSON');
   return new Blob([JSON.stringify(snapshot)],{type:'application/json'});
  }
  case 'exportRun':{
   if(!Array.isArray(payload.results)||!payload.results.length)throw new Error('Run an analysis before exporting results.');
   progress(.1,'Reading original weather evidence');
   const snapshot=await original(payload.snapshotId);await checkpoint();
   if(payload.results.some(result=>result.weatherSnapshotId&&result.weatherSnapshotId!==snapshot.id))throw new Error('Run results and weather snapshot identity do not match.');
   const scenarios=payload.results.map(result=>migrateScenario(result.scenario));
   const results=payload.results.map((result,index)=>({...result,scenario:scenarios[index]}));
   progress(.7,'Preparing portable run JSON');
   return new Blob([JSON.stringify({schemaVersion:SCENARIO_SCHEMA_VERSION,modelVersion:MODEL_VERSION,
    exportedAt:new Date().toISOString(),scenarios,snapshot,results})],{type:'application/json'});
  }
  default:throw new Error(`Unknown weather operation: ${operation}.`);
 }
}
self.addEventListener('message',async({data})=>{
 const {type,requestId,operation,payload={}}=data||{};
 if(type==='cancel'){active.get(requestId)?.abort();return;}
 if(type!=='request'||requestId==null)return;
 if(active.has(requestId))return; // IDs are unique per client; never replace running work.
 const controller=new AbortController();active.set(requestId,controller);
 const progress=(fraction,message)=>{if(!controller.signal.aborted)self.postMessage({type:'progress',requestId,fraction,message});};
 try{
  const result=await execute(operation,payload,{signal:controller.signal,progress});
  controller.signal.throwIfAborted();
  progress(1,'Ready');
  self.postMessage({type:'result',requestId,result});
 }catch(error){
  self.postMessage({type:'error',requestId,error:{name:controller.signal.aborted?'AbortError':error.name||'Error',
   message:controller.signal.aborted?'Weather operation cancelled.':error.message||'Weather operation failed.'}});
 }finally{active.delete(requestId);}
});
