import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedFetch,dateChunks,requestEstimate} from '../src/weather-request.js';
test('bounded requests retry transient responses and honor cancellation',async()=>{
 let calls=0;const response=await boundedFetch('https://fixture.invalid',{fetchImpl:async()=>{calls++;return new Response('',{status:calls<3?503:200});},retryDelayMs:1});
 assert.equal(response.status,200);assert.equal(calls,3);
 calls=0;await assert.rejects(boundedFetch('https://fixture.invalid',{fetchImpl:async()=>{calls++;return new Response('',{status:401});},retryDelayMs:1}),/401/);assert.equal(calls,1);
 const c=new AbortController();c.abort();await assert.rejects(boundedFetch('https://fixture.invalid',{signal:c.signal}),{name:'AbortError'});
});
test('timeout and Retry-After have finite budgets',async()=>{
 await assert.rejects(boundedFetch('https://fixture.invalid',{timeoutMs:5,retries:0,fetchImpl:(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(opts.signal.reason)))}),/timed out/);
 await assert.rejects(boundedFetch('https://fixture.invalid',{fetchImpl:async()=>new Response('',{status:429,headers:{'Retry-After':'120'}})}),/retry.*120/i);
});
test('date chunks bound VC records and preserve leap dates',()=>{
 const chunks=dateChunks('2024-01-01','2024-12-31',30);
 assert.equal(chunks.length,13);assert.equal(chunks[0].endDate,'2024-01-30');assert.equal(chunks.at(-1).endDate,'2024-12-31');
 assert.deepEqual(requestEstimate('2024-01-01','2024-12-31','visualcrossing'),{hours:8784,chunks:13,maxHoursPerChunk:744});
});
test('Visual Crossing multi-month acquisition uses bounded contiguous chunks with redacted evidence',async()=>{
 const {fetchWeather}=await import('../src/weather.js');const prior=globalThis.fetch,requests=[];
 globalThis.fetch=async url=>{
  if(String(url).includes('elevation'))return new Response(JSON.stringify({elevation:[100]}));
  const parts=new URL(url).pathname.split('/'),start=parts.at(-2),end=parts.at(-1);requests.push({start,end});
  return new Response(JSON.stringify({days:[{hours:[{datetimeEpoch:Date.parse(start+'T00:00:00Z')/1000,temp:20,humidity:50,pressure:1013,solarenergy:0,source:'obs'}]}]}));
 };
 try{
  const s=await fetchWeather({provider:'visualcrossing',latitude:40,longitude:-105,timezone:'UTC',startDate:'2024-01-01',endDate:'2024-03-01',apiKey:'private-test-secret'});
  assert.deepEqual(requests,[{start:'2024-01-01',end:'2024-01-30'},{start:'2024-01-31',end:'2024-02-29'},{start:'2024-03-01',end:'2024-03-01'}]);
  assert.equal(s.hours.length,61*24);assert.equal(s.raw.length,4);assert.ok(!JSON.stringify(s).includes('private-test-secret'));
 }finally{globalThis.fetch=prior;}
});
