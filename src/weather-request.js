const DAY=86400000;
const abortError=()=>new DOMException('Weather request cancelled.','AbortError');
function delay(ms,signal){return new Promise((resolve,reject)=>{
 if(signal?.aborted){reject(abortError());return;}
 const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
 const timer=setTimeout(finish,ms);
 const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(abortError());};
 signal?.addEventListener('abort',abort,{once:true});
});}
/** The timeout includes body transfer. Returned response has a buffered body. */
export async function boundedFetch(url,{signal,timeoutMs=30000,retries=2,retryDelayMs=500,fetchImpl=fetch}={}){
 for(let attempt=0;attempt<=retries;attempt++){
  signal?.throwIfAborted();
  const controller=new AbortController(),abort=()=>controller.abort(abortError());
  signal?.addEventListener('abort',abort,{once:true});
  let expired=false;
  const timer=setTimeout(()=>{expired=true;controller.abort(new Error('Weather source timed out. Retry or request a shorter period.'));},timeoutMs);
  try{
   const response=await fetchImpl(url,{signal:controller.signal});
   if(!response.ok){
    const retry=[408,429,500,502,503,504].includes(response.status);
    const header=response.headers.get('Retry-After');
    const after=header===null?null:/^\d+(\.\d+)?$/.test(header)?Number(header)*1000:Math.max(0,Date.parse(header)-Date.now());
    await response.body?.cancel();
    if(retry&&attempt<retries){
     if(Number.isFinite(after)&&after>10000)throw new Error(`Weather source HTTP ${response.status}; retry after ${Math.ceil(after/1000)} seconds. Automatic retry budget exceeded.`);
     clearTimeout(timer);await delay(Number.isFinite(after)?after:retryDelayMs*2**attempt,signal);continue;
    }
    throw new Error(`Weather source HTTP ${response.status}. Check provider access or retry later.`);
   }
   const body=await response.text();
   return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){
   if(signal?.aborted)throw abortError();
   if(expired)throw new Error('Weather source timed out. Retry or request a shorter period.');
   // Browser network errors have no HTTP response. Their retry count remains finite.
   if(error instanceof TypeError&&attempt<retries){clearTimeout(timer);await delay(retryDelayMs*2**attempt,signal);continue;}
   throw error;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
}
export function dateChunks(startDate,endDate,maxDays=30){
 const start=Date.parse(startDate+'T00:00:00Z'),end=Date.parse(endDate+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||!Number.isInteger(maxDays)||maxDays<1)throw new Error('Choose a valid date range and chunk size.');
 const chunks=[];
 for(let t=start;t<=end;t+=maxDays*DAY)chunks.push({startDate:new Date(t).toISOString().slice(0,10),endDate:new Date(Math.min(end,t+(maxDays-1)*DAY)).toISOString().slice(0,10)});
 return chunks;
}
export function requestEstimate(startDate,endDate,provider){
 const chunks=dateChunks(startDate,endDate,provider==='visualcrossing'?30:365);
 return {hours:(Math.round((Date.parse(endDate)-Date.parse(startDate))/DAY)+1)*24,chunks:chunks.length,maxHoursPerChunk:provider==='visualcrossing'?744:8784};
}
