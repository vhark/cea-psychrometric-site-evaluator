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
 const request=indexedDB.open('cea-psychrometric-site-evaluator',4);
 request.onupgradeneeded=()=>{
  const db=request.result;
  for(const store of ['snapshots','weather','weatherSnapshots','weatherRequests','weatherMeta','weatherIndex','weatherCompact']){
   if(!db.objectStoreNames.contains(store))db.createObjectStore(store);
  }
  // Upgrade existing immutable revisions once. The upgrade transaction rolls back all
  // derived stores on quota/error, leaving the previous database usable on retry.
  const tx=request.transaction,cursor=tx.objectStore('weatherSnapshots').openCursor();
  cursor.onsuccess=()=>{
   const row=cursor.result;if(!row)return;
   tx.objectStore('weatherIndex').put(weatherMetadata(row.value,String(row.key)),row.key);
   tx.objectStore('weatherCompact').put(compactWeather(row.value),row.key);
   row.continue();
  };
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
  const fail=error=>{try{tx.abort();}catch{}reject(error);};
  try{work(tx,result=>{value=result;},fail);}catch(error){fail(error);}
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
function persist(db,snapshot,{latest=false,migrating=false,isCurrent=()=>true,signal}={}){
 return transact(db,['weatherSnapshots','weatherRequests','weatherMeta','weatherIndex','weatherCompact'],'readwrite',(tx,done,fail)=>{
  if(signal?.aborted){tx.abort();return;}
  if(!isCurrent()){done(snapshot);return;}
  const cancel=()=>tx.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  const cleanup=()=>signal?.removeEventListener('abort',cancel);
  tx.addEventListener('complete',cleanup,{once:true});tx.addEventListener('abort',cleanup,{once:true});
  const snapshots=tx.objectStore('weatherSnapshots'),requests=tx.objectStore('weatherRequests');
  // Reading only the key avoids deserializing raw when saving an existing revision.
  const existing=snapshots.getKey(snapshot.id);
  existing.onsuccess=()=>{try{
   if(!isCurrent()){done(snapshot);return;}
   if(existing.result==null){
    snapshots.add(snapshot,snapshot.id);
    tx.objectStore('weatherIndex').add(weatherMetadata(snapshot),snapshot.id);
    tx.objectStore('weatherCompact').add(compactWeather(snapshot),snapshot.id);
   }
   const key=weatherKey(snapshot);
   if(key){
    if(migrating){const pointer=requests.get(key);pointer.onsuccess=()=>{if(pointer.result==null)requests.put(snapshot.id,key);};}
    else requests.put(snapshot.id,key);
   }
   if(latest){
    const meta=tx.objectStore('weatherMeta');
    if(migrating){const pointer=meta.get('latest');pointer.onsuccess=()=>{if(pointer.result==null)meta.put(snapshot.id,'latest');};}
    else meta.put(snapshot.id,'latest');
   }
   done(snapshot);
  }catch(error){fail(error);}};
 });
}
/** UI transport view: identity refers to the immutable full snapshot, including raw.
 * Never normalize/reseal this projection. Export resolves its ID in weatherSnapshots. */
export function compactWeather(snapshot){
 const {raw,transport,...rest}=snapshot;
 return {...rest,transport:{rawOmitted:true}};
}
async function migrate(db,snapshot,{latest=false}={}){
 const sealed=await sealWeatherSnapshot(normalizeWeather(snapshot));
 return persist(db,sealed,{latest,migrating:true});
}
/** Return the sealed snapshot so callers retain the exact persisted revision ID. */
export async function saveWeather(snapshot,{latest=true,isCurrent=()=>true,signal,timezone,moisture,onStorageError}={}){
 if(snapshot?.transport?.rawOmitted)throw new Error('A compact weather view cannot be saved or resealed. Export its original snapshot by ID.');
 signal?.throwIfAborted();
 const sealed=await sealWeatherSnapshot(normalizeWeather(snapshot,{timezone,moisture}));
 // A queued cancel message must run before any IndexedDB write begins.
 await new Promise(resolve=>setTimeout(resolve,0));
 signal?.throwIfAborted();
 let db;
 try{db=await database();return isCurrent()?await persist(db,sealed,{latest,isCurrent,signal}):sealed;}
 catch(error){
  signal?.throwIfAborted();
  if(!onStorageError)throw error;
  if(isCurrent())await onStorageError(error,sealed);
  return sealed;
 }finally{db?.close();}
}
export async function loadWeather({compact=false}={}){
 const db=await database();
 try{
  const id=await read(db,'weatherMeta','latest');
  if(id){
   const snapshot=await read(db,compact?'weatherCompact':'weatherSnapshots',id);
   if(!snapshot)throw new Error('The latest weather snapshot is missing from storage. Import its saved JSON to restore it.');
   return snapshot;
  }
  const legacy=await read(db,'snapshots','latest');
  if(!legacy)return null;
  const migrated=await migrate(db,legacy,{latest:true});
  return compact?compactWeather(migrated):migrated;
 }finally{db.close();}
}
/** Resolve an exact snapshot ID, a provider-aware request key, or an old coordinate key.
 * A new request may use legacy data only when its full normalized evidence identity matches. */
export async function loadCachedWeather(key,{compact=false}={}){
 if(typeof key!=='string'||!key)return null;
 const db=await database();
 try{
  const snapshot=await read(db,compact?'weatherCompact':'weatherSnapshots',key);
  if(snapshot)return snapshot;
  const id=await read(db,'weatherRequests',key);
  if(id){
   const found=await read(db,compact?'weatherCompact':'weatherSnapshots',id);
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
  const migrated=await persist(db,await sealWeatherSnapshot(normalized),{migrating:true});
  return compact?compactWeather(migrated):migrated;
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
/** Metadata lists read only the compact index after the first legacy migration.
 * Old applications cannot notify this schema about in-place legacy changes, so callers
 * explicitly request refreshLegacy for an audit. That audit rehashes changed same-key
 * values, keeps every revision, and never replaces current request/latest pointers. */
export async function listWeather({refreshLegacy=false}={}){
 const db=await database();
 try{
  if(refreshLegacy||!await read(db,'weatherMeta','legacy-indexed-v4'))await indexLegacy(db);
  return (await entries(db,'weatherIndex')).map(row=>row.snapshot);
 }finally{db.close();}
}
async function indexLegacy(db){
 // Read source keys first, then migrate one payload at a time; do not retain every
 // raw response in one getAll array. Invalid records stay visible in the picker.
 const keys=await transact(db,'weather','readonly',(tx,done)=>{
  const request=tx.objectStore('weather').getAllKeys();request.onsuccess=()=>done(request.result);
 });
 const sources=[...keys.map(key=>({store:'weather',key,indexKey:String(key)})),{store:'snapshots',key:'latest',indexKey:'legacy:latest'}];
 const previous=await entries(db,'weatherIndex');
 await transact(db,'weatherIndex','readwrite',tx=>{
  for(const row of previous)if(row.snapshot.legacy)tx.objectStore('weatherIndex').delete(row.key);
 });
 for(const {store,key,indexKey} of sources){
  const snapshot=await read(db,store,key);if(!snapshot)continue;
  try{await migrate(db,snapshot);}
  catch(error){
   // Quota/transaction failures must remain recoverable and must not be memoized as
   // a successful migration. Only validation errors become legacy metadata rows.
   if(error.cause||/storage|save weather/i.test(error.message))throw error;
   await transact(db,'weatherIndex','readwrite',tx=>tx.objectStore('weatherIndex').put(
    weatherMetadata(snapshot,indexKey,{legacy:true,migrationError:error.message}),indexKey));
  }
 }
 await transact(db,'weatherMeta','readwrite',tx=>tx.objectStore('weatherMeta').put(true,'legacy-indexed-v4'));
}
