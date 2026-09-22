import {normalizeWeather} from './weather.js';
import {providerIdentity, sealWeatherSnapshot, assertHistoricalWeather} from './weather-contract.js';

const KEY='cea-psychrometric-site-evaluator.scenarios.v1';
export function loadScenarios(){
 const raw=localStorage.getItem(KEY);
 if(!raw)return [];
 const value=JSON.parse(raw);
 if(!Array.isArray(value))throw new Error('Saved scenarios are not a valid list. Export or clear the site storage before continuing.');
 return value;
}
export function saveScenarios(scenarios){
 if(!Array.isArray(scenarios))throw new Error('Expected a scenario list.');
 localStorage.setItem(KEY,JSON.stringify(scenarios));
}
function database(){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('cea-psychrometric-site-evaluator',3);
 request.onupgradeneeded=()=>{
  const db=request.result;
  for(const store of ['snapshots','weather','weatherSnapshots','weatherRequests','weatherMeta']){
   if(!db.objectStoreNames.contains(store))db.createObjectStore(store);
  }
 };
 request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
 request.onerror=()=>reject(new Error('Weather storage is unavailable. Export the run to preserve it.'));
 request.onblocked=()=>reject(new Error('Weather storage is open in another tab with an older version. Close other tabs and reload.'));
 });}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const REQUEST_PREFIX='weather-request:v2:';
/** Exact numeric coordinates, local calendar bounds and provider evidence identity.
 * Retrieval time and weather values identify a revision, not the request. Forecast issuance/run
 * remain part of the request so distinct forecast vintages cannot substitute for one another. */
export function weatherKey(snapshot){
 const {latitude,longitude,timezone,startDate,endDate}=snapshot;
 if(!finite(latitude)||!finite(longitude)||!startDate||!endDate)return null;
 const provider=providerIdentity(snapshot);
 return REQUEST_PREFIX+JSON.stringify([latitude,longitude,timezone||'',startDate,endDate,
  provider.id??null,provider.product??null,provider.model??null,provider.stationId??null,
  snapshot.dataKind??null,snapshot.forecast?.issuedAt??null,snapshot.forecast?.runId??null]);
}
function legacyKey(snapshot){
 const {latitude,longitude,timezone,startDate,endDate}=snapshot;
 if(!finite(latitude)||!finite(longitude)||!startDate||!endDate)return null;
 return `${latitude.toFixed(3)},${longitude.toFixed(3)}|${timezone||''}|${startDate}|${endDate}`;
}
function transact(db,stores,mode,work){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode);let value;
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(new Error(mode==='readwrite'?'Could not save weather. Storage may be full; use the JSON export.':'Could not read saved weather.',{cause:tx.error}));
  tx.onabort=()=>reject(new Error('Weather storage was interrupted.',{cause:tx.error}));
  try{work(tx,result=>{value=result;});}catch(error){tx.abort();reject(error);}
 });
}
function read(db,store,key){
 return transact(db,store,'readonly',(tx,done)=>{
  const request=tx.objectStore(store).get(key);request.onsuccess=()=>done(request.result??null);
 });
}
function entries(db,store){
 return transact(db,store,'readonly',(tx,done)=>{
  const rows=[],request=tx.objectStore(store).openCursor();
  request.onsuccess=()=>{const cursor=request.result;if(!cursor){done(rows);return;}rows.push({key:String(cursor.key),snapshot:cursor.value});cursor.continue();};
 });
}
/** One transaction commits the immutable record and its mutable lookup pointers together.
 * Legacy migration never replaces a request pointer already written by a newer save. */
function persist(db,snapshot,{latest=false,migrating=false}={}){
 return transact(db,['weatherSnapshots','weatherRequests','weatherMeta'],'readwrite',(tx,done)=>{
  const snapshots=tx.objectStore('weatherSnapshots'),requests=tx.objectStore('weatherRequests');
  const existing=snapshots.get(snapshot.id);
  existing.onsuccess=()=>{
   const stored=existing.result??snapshot;
   if(!existing.result)snapshots.add(snapshot,snapshot.id);
   const key=weatherKey(stored);
   if(key){
    if(migrating){const pointer=requests.get(key);pointer.onsuccess=()=>{if(pointer.result==null)requests.put(stored.id,key);};}
    else requests.put(stored.id,key);
   }
   if(latest){
    const meta=tx.objectStore('weatherMeta');
    if(migrating){const pointer=meta.get('latest');pointer.onsuccess=()=>{if(pointer.result==null)meta.put(stored.id,'latest');};}
    else meta.put(stored.id,'latest');
   }
   done(stored);
  };
 });
}
async function migrate(db,snapshot,{latest=false}={}){
 const sealed=await sealWeatherSnapshot(normalizeWeather(snapshot));
 return persist(db,sealed,{latest,migrating:true});
}
/** Return the sealed snapshot so callers retain the exact persisted revision ID. */
export async function saveWeather(snapshot,{latest=true,isCurrent=()=>true}={}){
 const sealed=await sealWeatherSnapshot(normalizeWeather(snapshot));
 const db=await database();
 try{return isCurrent()?await persist(db,sealed,{latest}):sealed;}finally{db.close();}
}
export async function loadWeather(){
 const db=await database();
 try{
  const id=await read(db,'weatherMeta','latest');
  if(id){
   const snapshot=await read(db,'weatherSnapshots',id);
   if(!snapshot)throw new Error('The latest weather snapshot is missing from storage. Import its saved JSON to restore it.');
   return snapshot;
  }
  const legacy=await read(db,'snapshots','latest');
  return legacy?await migrate(db,legacy,{latest:true}):null;
 }finally{db.close();}
}
/** Resolve an exact snapshot ID, a provider-aware request key, or an old coordinate key.
 * A new request may use legacy data only when its full normalized evidence identity matches. */
export async function loadCachedWeather(key){
 if(typeof key!=='string'||!key)return null;
 const db=await database();
 try{
  const snapshot=await read(db,'weatherSnapshots',key);
  if(snapshot)return snapshot;
  const id=await read(db,'weatherRequests',key);
  if(id){
   const found=await read(db,'weatherSnapshots',id);
   if(!found)throw new Error('The requested weather snapshot is missing from storage. Import its saved JSON to restore it.');
   return found;
  }
  let oldKey=key;
  if(key.startsWith(REQUEST_PREFIX)){
   let values;try{values=JSON.parse(key.slice(REQUEST_PREFIX.length));}catch{return null;}
   if(!Array.isArray(values))return null;
   const [latitude,longitude,timezone,startDate,endDate]=values;
   oldKey=legacyKey({latitude,longitude,timezone,startDate,endDate});
  }
  if(!oldKey)return null;
  const legacy=oldKey==='legacy:latest'?await read(db,'snapshots','latest'):await read(db,'weather',oldKey);
  if(!legacy)return null;
  const normalized=normalizeWeather(legacy);
  if(key.startsWith(REQUEST_PREFIX)&&weatherKey(normalized)!==key)return null;
  return await persist(db,await sealWeatherSnapshot(normalized),{migrating:true});
 }finally{db.close();}
}
export function weatherMetadata(snapshot,key=snapshot.id,extra={}){
 let requestKey=null,provider=null;
 let historicalEligible=false;
 try{assertHistoricalWeather(snapshot);historicalEligible=true;}catch{/* Forecast and future values are unavailable to historical selectors. */}
 // Invalid legacy provenance must not hide the saved record or the rest of the picker.
 try{provider=providerIdentity(snapshot);requestKey=weatherKey(snapshot);}catch{/* migrationError describes the invalid legacy record */}
 return {key,requestKey,provider,dataKind:snapshot.dataKind,historicalEligible,
  source:snapshot.source,latitude:snapshot.latitude,longitude:snapshot.longitude,timezone:snapshot.timezone,
  startDate:snapshot.startDate,endDate:snapshot.endDate,retrievedAt:snapshot.retrievedAt,
  hours:Array.isArray(snapshot.hours)?snapshot.hours.length:0,forecast:snapshot.forecast??null,...extra};
}
/** Metadata for all revisions, including legacy records that cannot yet be migrated.
 * Legacy stores remain untouched. A valid legacy latest-only import is included even without coordinates. */
export async function listWeather(){
 const db=await database();
 try{
  const rows=new Map((await entries(db,'weatherSnapshots')).map(({key,snapshot})=>[key,weatherMetadata(snapshot,key)]));
  const old=await entries(db,'weather');
  const latest=await read(db,'snapshots','latest');
  if(latest)old.push({key:'legacy:latest',snapshot:latest});
  for(const {key,snapshot} of old){
   try{
    const migrated=await migrate(db,snapshot);
    rows.set(migrated.id,weatherMetadata(migrated,migrated.id));
   }catch(error){
    rows.set(key,weatherMetadata(snapshot||{},key,{legacy:true,migrationError:error.message}));
   }
  }
  return [...rows.values()];
 }finally{db.close();}
}
