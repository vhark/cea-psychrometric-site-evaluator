import {simulateScenario} from './simulate.js';
import {validateScenario} from './config.js';
import {applyEnergyContext} from './energy.js';
import {parseImport} from './export.js';
import {normalizeWeather} from './weather.js';
const megabytes=size=>Number.isFinite(size)?`${(size/1048576).toLocaleString('en-US',{maximumFractionDigits:1})} MB`:'the file';
/* Import parsing off the UI thread. Same guarantees as the main thread had: schemaVersion 1 only,
 * 1-20 validated scenarios, imported result claims dropped rather than displayed. The main thread
 * still re-checks its weather epoch before it adopts anything this returns. */
async function parseFile({id,file}){
 const post=(value,message)=>self.postMessage({id,type:'progress',value,message});
 try{
  if(!file||typeof file.text!=='function')throw new Error('No import file reached the parser. Choose the file again.');
  post(.05,`Reading ${megabytes(file.size)} in a background worker…`);
  const text=await file.text();
  post(.4,`Parsing ${megabytes(file.size)}…`);
  if(String(file.name||'').toLowerCase().endsWith('.csv')){
   const snapshot=normalizeWeather(text);
   self.postMessage({id,type:'parsed',kind:'weather-csv',scenarios:null,snapshot});
   return;
  }
  const data=JSON.parse(text);
  post(.65,'Validating the import…');
  if(data&&typeof data==='object'&&Array.isArray(data.hours)&&!data.scenarios&&!data.results){
   self.postMessage({id,type:'parsed',kind:'weather-json',scenarios:null,snapshot:normalizeWeather(data)});
   return;
  }
  const imported=parseImport(data);
  post(.85,`Normalizing ${imported.scenarios.length} scenario${imported.scenarios.length===1?'':'s'}${imported.snapshot?' and the weather snapshot':''}…`);
  self.postMessage({id,type:'parsed',kind:'run',scenarios:imported.scenarios,snapshot:imported.snapshot?normalizeWeather(imported.snapshot):null});
 }catch(error){self.postMessage({id,type:'error',message:error instanceof Error?error.message:String(error)});}
}
self.onmessage=async ({data})=>{
 if(data?.type==='parse')return parseFile(data);
 const {id,scenarios,snapshot,energyContext,label}=data;
 const prefix=label?`${label} · `:'';
 try{
  if(!Array.isArray(scenarios)||!scenarios.length||scenarios.length>20)throw new Error('Choose between 1 and 20 scenarios.');
  if(!snapshot||!Array.isArray(snapshot.hours)||!snapshot.hours.length)throw new Error('Load valid historical weather first.');
  const results=[];
  for(let i=0;i<scenarios.length;i++){
   const scenario=scenarios[i];
   const errors=validateScenario(scenario);
   if(errors.length)throw new Error(`${scenario.name}: ${errors.join(' ')}`);
   self.postMessage({id,type:'progress',value:i/scenarios.length,message:`${prefix}Evaluating ${scenario.name}`});
   let last=0;
   let result=simulateScenario(scenario,snapshot,{onProgress:value=>{
    const now=Date.now();if(now-last<120)return;last=now;
    self.postMessage({id,type:'progress',value:(i+Math.min(1,Math.max(0,value)))/scenarios.length,message:`${prefix}Evaluating ${scenario.name}`});
   }});
   if(energyContext)result=applyEnergyContext(result,energyContext);
   results.push(result);
  }
  self.postMessage({id,type:'result',results});
 }catch(error){self.postMessage({id,type:'error',message:error instanceof Error?error.message:String(error)});}
};
