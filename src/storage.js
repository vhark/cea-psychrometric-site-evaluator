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
 const request=indexedDB.open('cea-psychrometric-site-evaluator',2);
 request.onupgradeneeded=()=>{const db=request.result;for(const store of ['snapshots','weather'])if(!db.objectStoreNames.contains(store))db.createObjectStore(store);};
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(new Error('Weather storage is unavailable. Export the run to preserve it.'));
 request.onblocked=()=>reject(new Error('Weather storage is open in another tab with an older version. Close other tabs and reload.'));
 });}
const finite=value=>typeof value==='number'&&Number.isFinite(value);
/** Cache key: coordinates to 0.001° plus the inclusive local date range. Null when the snapshot has no coordinates. */
export function weatherKey({latitude,longitude,startDate,endDate}){
 if(!finite(latitude)||!finite(longitude)||!startDate||!endDate)return null;
 return `${latitude.toFixed(3)},${longitude.toFixed(3)}|${startDate}|${endDate}`;
}
function transact(db,store,mode,work){
 return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let value;work(tx.objectStore(store),result=>{value=result;});tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(new Error(mode==='readwrite'?'Could not save weather. Storage may be full; use the JSON export.':'Could not read saved weather.'));tx.onabort=()=>reject(new Error('Weather storage was interrupted.'));});
}
/** Saves the snapshot under its cache key when it has coordinates and, unless latest is false, as the most recent one. */
export async function saveWeather(snapshot,{latest=true}={}){
 const db=await database();
 try{
  if(latest)await transact(db,'snapshots','readwrite',store=>store.put(snapshot,'latest'));
  const key=weatherKey(snapshot);
  if(key)await transact(db,'weather','readwrite',store=>store.put(snapshot,key));
 }finally{db.close();}
}
export async function loadWeather(){
 const db=await database();
 try{return await transact(db,'snapshots','readonly',(store,done)=>{const request=store.get('latest');request.onsuccess=()=>done(request.result||null);});}finally{db.close();}
}
export async function loadCachedWeather(key){
 const db=await database();
 try{return await transact(db,'weather','readonly',(store,done)=>{const request=store.get(key);request.onsuccess=()=>done(request.result||null);});}finally{db.close();}
}
/** Metadata of every cached snapshot, without hourly payloads. */
export async function listWeather(){
 const db=await database();
 try{return await transact(db,'weather','readonly',(store,done)=>{const entries=[];const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor){done(entries);return;}const s=cursor.value||{};entries.push({key:String(cursor.key),latitude:s.latitude,longitude:s.longitude,timezone:s.timezone,startDate:s.startDate,endDate:s.endDate,source:s.source,retrievedAt:s.retrievedAt,hours:Array.isArray(s.hours)?s.hours.length:0});cursor.continue();};});}finally{db.close();}
}
