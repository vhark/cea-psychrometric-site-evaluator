import assert from 'node:assert/strict';
const json=(route,value)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
const stamp=date=>Date.parse(date+'T00:00:00Z');
export async function appBrowserChecks(browser,base,prefix){
 const context=await browser.newContext();let releaseOld,oldRequested=false,searches=0,vcRequests=[],stations=[];
 const oldReady=new Promise(resolve=>{releaseOld=resolve;});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===new URL(base).origin)return route.continue();
  if(url.hostname==='archive-api.open-meteo.com'){
   oldRequested=true;await oldReady;
   return route.fulfill({status:503,body:'delayed superseded fixture'}).catch(()=>{});
  }
  if(url.pathname.includes('/elevation'))return json(route,{elevation:[100]});
  if(url.hostname==='weather.visualcrossing.com'){
   assert.equal(url.searchParams.get('key'),'fixture-key-only');
   const parts=url.pathname.split('/'),start=parts.at(-2),end=parts.at(-1);vcRequests.push({start,end});
   const days=[];
   for(let t=stamp(start);t<=stamp(end);t+=86400000)days.push({hours:Array.from({length:24},(_,i)=>({datetimeEpoch:t/1000+i*3600,temp:20,dew:10,humidity:50,pressure:1013,solarenergy:0,source:'obs'}))});
   return json(route,{timezone:'UTC',days});
  }
  if(url.pathname.includes('/search/')){searches++;return json(route,{results:[{location:{coordinates:[-105,40]},stations:[{id:'72053300160'}],name:'Synthetic test station'}]});}
  if(url.hostname==='www.ncei.noaa.gov'){
   stations.push(url.searchParams.get('stations'));
   return json(route,[{STATION:'72053300160',NAME:'SYNTHETIC TEST FIELD',LATITUDE:'40',LONGITUDE:'-105',ELEVATION:'100',REPORT_TYPE:'FM-15',DATE:url.searchParams.get('startDate')+'T00:00:00',TMP:'+0200,5',DEW:'+0100,5',WND:'110,5,N,0067,5',MA1:'10240,5,10000,5'}]);
  }
  if(url.hostname==='power.larc.nasa.gov')return json(route,{geometry:{coordinates:[-105,40,100]},header:{time_standard:'UTC',fill_value:-999},parameters:{ALLSKY_SFC_SW_DWN:{units:'Wh/m^2'}},properties:{parameter:{ALLSKY_SFC_SW_DWN:{}}}});
  return route.abort();
 });
 const page=await context.newPage();
 const currentID=()=>page.evaluate(async()=>{const {WeatherClient}=await import(new URL('./src/weather-client.js',location.href));const client=new WeatherClient();try{return (await client.load())?.id;}finally{client.close();}});
 try{
  await page.goto(`${base}${prefix}/index.html`);
  await page.waitForFunction(()=>document.querySelector('#weather-status').textContent.includes('No weather loaded'));
  await page.locator('.location-details summary').click();
  for(const [id,value] of [['latitude','40'],['longitude','-105'],['timezone','UTC'],['start-date','2025-01-01'],['end-date','2025-01-01']])await page.locator('#'+id).fill(value);
  await page.locator('#weather-provider').selectOption('openmeteo');await page.locator('#fetch-weather').click();
  for(let i=0;!oldRequested&&i<100;i++)await page.waitForTimeout(20);
  assert.ok(oldRequested,'Delayed old fixture was never requested');
  await page.locator('#weather-provider').selectOption('visualcrossing');
  await page.locator('#provider-key').fill('fixture-key-only');await page.locator('#provider-key').blur();
  await page.locator('#start-date').fill('2025-01-02');await page.locator('#end-date').fill('2025-01-02');await page.locator('#fetch-weather').click();
  await page.waitForFunction(()=>document.querySelector('#weather-detail').textContent.includes('Visual Crossing')&&document.querySelector('#weather-detail').textContent.includes('2025-01-02'));
  const active=await currentID();releaseOld();await page.waitForTimeout(100);
  assert.equal(await currentID(),active,'Delayed old response replaced new active snapshot');
  assert.equal(await page.locator('#weather-provider').inputValue(),'visualcrossing');
  await page.locator('#retrieve-years-count').fill('2');await page.locator('#retrieve-years').click();
  await page.waitForFunction(()=>document.querySelector('#weather-status').textContent.includes('2 calendar years retrieved'),{timeout:60000});
  assert.equal(await currentID(),active,'Background keyed years changed active dataset');
  assert.ok(vcRequests.length>=25,'Multi-year keyed retrieval was not chunked');
  assert.ok(vcRequests.every(r=>(stamp(r.end)-stamp(r.start))/86400000<30),'Keyed chunk exceeded 30 days');
  await page.locator('#weather-provider').selectOption('ncei');await page.locator('#station').fill('');await page.locator('#retrieve-years').click();
  await page.waitForFunction(()=>document.querySelector('#weather-status').textContent.includes('2 calendar years retrieved'),{timeout:60000});
  assert.equal(searches,1,'NCEI auto station was not pinned after first year');
  assert.ok(stations.length>12&&stations.every(id=>id==='72053300160'));
  assert.equal(await currentID(),active,'NCEI background years changed active dataset');
  // The historical app rejects forecast content before its worker advances latest.
  const units={time:'UTC epoch milliseconds',tempC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2'};
  const snapshot={schemaVersion:1,source:'Synthetic rejected forecast fixture',timezone:'UTC',dataKind:'forecast',units,hours:[{time:stamp('2025-01-01'),tempC:20,rh:.5,pressurePa:101325,ghiWm2:0}]};
  await page.locator('#import-file').setInputFiles({name:'forecast.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});
  await page.waitForFunction(()=>/historical|forecast/i.test(document.querySelector('#app-message').textContent));
  assert.equal(await currentID(),active,'Rejected forecast import replaced active dataset');
  console.log(`PASS ${prefix||'root'} app races, keyed years, station pinning and historical rejection`);
 }finally{releaseOld();await context.close();}
 // Denied persistence must remain clearly visible after import success.
 const denied=await browser.newContext();
 await denied.route('**/src/weather-worker.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:'Object.defineProperty(globalThis,"indexedDB",{value:undefined});\n'+await response.text()});});
 const p=await denied.newPage();
 try{
  await p.goto(`${base}${prefix}/index.html`);await p.locator('.location-details summary').click();await p.locator('#timezone').fill('UTC');
  await p.locator('#import-file').setInputFiles({name:'denied.csv',mimeType:'text/csv',buffer:Buffer.from('time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,20,0.5,101325,0')});
  await p.waitForFunction(()=>document.querySelector('#weather-detail').textContent.includes('Export JSON before reloading'));
  assert.match(await p.locator('#weather-detail').textContent(),/available for this session/);
  console.log(`PASS ${prefix||'root'} app storage-denial warning`);
 }finally{await denied.close();}
}
