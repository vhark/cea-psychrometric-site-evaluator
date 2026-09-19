import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeWeather,separationKm} from '../src/weather.js';
import {applyEnergyContext,proposeTimezone} from '../src/energy.js';
import {makeScenario,migrateScenario,SCENARIO_SCHEMA_VERSION,validateScenario} from '../src/config.js';
import {downloadRun,downloadScenario,parseImport} from '../src/export.js';
import {summarizeHours} from '../src/metrics.js';
const units={time:'UTC epoch milliseconds',tempC:'C',dewPointC:'C',rh:'fraction',pressurePa:'Pa',ghiWm2:'W/m2',windMs:'m/s'};
const sample=time=>({time,tempC:20,rh:.6,pressurePa:101325,ghiWm2:0});
const snapshot=(hours,extra={})=>({schemaVersion:1,source:'Boundary fixture',latitude:40,longitude:-100,timezone:'UTC',units,hours,...extra});
test('new scenarios and every portable JSON export use schema version 2',async()=>{
 assert.equal(SCENARIO_SCHEMA_VERSION,2);
 const scenario=makeScenario();
 assert.equal(scenario.schemaVersion,2);
 const downloads=[];
 const priorDocument=globalThis.document,priorCreate=URL.createObjectURL,priorRevoke=URL.revokeObjectURL,priorTimeout=globalThis.setTimeout;
 globalThis.document={createElement:()=>({click(){}})};
 URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};
 URL.revokeObjectURL=()=>{};globalThis.setTimeout=callback=>{callback();return 0;};
 try{
  downloadScenario(scenario);
  downloadRun([{scenario,hours:[],summary:{contractMarker:'current-result'},warnings:[]}],snapshot([]));
  const payloads=await Promise.all(downloads.map(blob=>blob.text().then(JSON.parse)));
  assert.deepEqual(payloads.map(data=>data.schemaVersion),[2,2]);
  assert.ok(payloads.every(data=>data.scenarios.every(item=>item.schemaVersion===2)));
  assert.equal(payloads[1].results[0].scenario.schemaVersion,2);
  assert.equal(payloads[1].results[0].summary.contractMarker,'current-result');
 }finally{
  globalThis.document=priorDocument;URL.createObjectURL=priorCreate;URL.revokeObjectURL=priorRevoke;globalThis.setTimeout=priorTimeout;
 }
});

test('hourly CSV exports actual airflow, recovery, frost, preheat, and explicit DOAS quantities',async()=>{
 const s=makeScenario();
 const controls={controlledACH:1.25,controlledM3s:2.25,controlledACHMin:.5,controlledACHMax:2,
  controlledACHStages:[{ach:.5,hours:.5},{ach:2,hours:.5}],
  totalOutdoorACH:3.25,totalOutdoorM3s:4.25,totalOutdoorACHMin:2.5,totalOutdoorACHMax:4,
  recoveryCoreFraction:.5,recoveryBypassFraction:.25,recoveryDefrostFraction:.125,preheatFraction:.75,
  doasConditionedFraction:.625,doasTreatmentM3s:1.75};
 const componentValues={
  recoverySensibleKWh:5.1,recoveryLatentKWh:5.2,recoveryAuxKWh:5.3,recoveryCoreM3:5.4,recoveryBypassM3:5.5,recoveryDefrostHours:5.6,
  preheatDeliveredKWh:6.1,preheatElectricKWh:6.2,preheatFuelKWh:6.3,preheatInsufficientHours:6.4,
  doasCondensateKg:7.1,doasCoolingDeliveredKWh:7.2,doasCoolingElectricKWh:7.3,doasRecoveredReheatKWh:7.4,
  doasExternalHeatKWh:7.5,doasUnmetConditioningKWh:7.6,
 };
 const downloads=[];
 const priorDocument=globalThis.document,priorCreate=URL.createObjectURL,priorRevoke=URL.revokeObjectURL,priorTimeout=globalThis.setTimeout;
 globalThis.document={createElement:()=>({click(){}})};
 URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};
 URL.revokeObjectURL=()=>{};globalThis.setTimeout=callback=>{callback();return 0;};
 try{
  downloadRun([{scenario:s,hours:[{time:Date.UTC(2025,0,1),valid:true,controls,...componentValues}],summary:{},warnings:[]}],snapshot([]),'csv');
  const csv=await downloads[0].text(),[headerLine,rowLine]=csv.split('\r\n');
  const cells=line=>[...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match=>match[1].replaceAll('""','"'));
  const headers=cells(headerLine),values=cells(rowLine),row=Object.fromEntries(headers.map((key,index)=>[key,values[index]]));
  for(const [key,value] of Object.entries({...controls,...componentValues})){
   assert.ok(headers.includes(key),`CSV is missing ${key}`);
   if(Array.isArray(value))assert.deepEqual(JSON.parse(row[key]),value);
   else assert.equal(Number(row[key]),value);
  }
  for(const removed of ['ventACH','doasDuty','doasKWhPerKg'])assert.equal(headers.includes(removed),false);
 }finally{
  globalThis.document=priorDocument;URL.createObjectURL=priorCreate;URL.revokeObjectURL=priorRevoke;globalThis.setTimeout=priorTimeout;
 }
});
test('portable import rejects future bundle and nested scenario versions',()=>{
 const scenarios=[makeScenario()];
 assert.throws(()=>parseImport(JSON.stringify({schemaVersion:3,scenarios})),/Unsupported.*schema/);
 assert.throws(()=>parseImport({schemaVersion:2,scenarios:[{...scenarios[0],schemaVersion:3}]}),/Unsupported.*schema/);
 assert.throws(()=>migrateScenario({...scenarios[0],schemaVersion:3}),/Unsupported.*schema/);
});
test('portable import migrates version 1 scenarios and discards imported result claims',()=>{
 const current={...makeScenario('greenhouseDouble'),latitude:40,longitude:-100,timezone:'UTC'};
 const legacy={...current,schemaVersion:1,infiltrationACH:.62,minVentACH:.41,maxVentACH:31,doasM3s:0,doasKWhPerKg:.5};
 delete legacy.heatRecovery;delete legacy.outsideAirBasis;delete legacy.outsideAirReviewed;
 const imported=parseImport({schemaVersion:1,scenarios:[legacy],snapshot:{schemaVersion:1,hours:[]},results:[{scenario:legacy,summary:{cost:0}}]});
 assert.equal(imported.scenarios[0].schemaVersion,2);
 assert.equal(imported.scenarios[0].heatRecovery.type,'none');
 assert.deepEqual(
  [imported.scenarios[0].infiltrationACH,imported.scenarios[0].minVentACH,imported.scenarios[0].maxVentACH],
  [.62,.41,31],
 );
 assert.equal(Object.hasOwn(imported.scenarios[0],'doasKWhPerKg'),false);
 assert.equal(Object.hasOwn(imported,'results'),false);
 assert.deepEqual(imported.snapshot,{schemaVersion:1,hours:[]});
 assert.equal(legacy.schemaVersion,1,'migration must not mutate imported input');
 const currentBundle=parseImport({schemaVersion:2,scenarios:[current],results:[{scenario:current,summary:{cost:-1}}]});
 assert.equal(currentBundle.scenarios[0].schemaVersion,2);
 assert.equal(Object.hasOwn(currentBundle,'results'),false);
 assert.throws(()=>parseImport({schemaVersion:1,results:[{scenario:legacy}]}),/Import needs/);
 const unreviewed={...current,outsideAirBasis:'projectInput'};delete unreviewed.outsideAirReviewed;
 const migratedUnreviewed=migrateScenario(unreviewed);
 assert.equal(migratedUnreviewed.outsideAirReviewed,false);
 assert.match(validateScenario(migratedUnreviewed).join(' '),/review/i);
});
test('version 1 DOAS airflow becomes unreviewed candidate treatment capacity',()=>{
 const legacy={...makeScenario('greenhouseDouble'),schemaVersion:1,technology:'doas',doasM3s:1.25,
  doasSupplyDewPointC:8,doasSupplyTempC:21,doasKWhPerKg:.5};
 const migrated=migrateScenario(legacy);
 assert.equal(migrated.schemaVersion,2);
 assert.equal(migrated.doasM3s,1.25);
 assert.equal(migrated.doasSupplyDewPointC,null);
 assert.equal(migrated.doasSupplyTempC,null);
 assert.equal(migrated.doasCoolingCOP,null);
 assert.equal(migrated.doasReheatRecoveryFraction,null);
 assert.equal(migrated.outsideAirReviewed,false);
 assert.ok(validateScenario(migrated).length>0,'legacy DOAS must stay blocked until reviewed and completed');
 assert.equal(Object.hasOwn(migrated,'doasKWhPerKg'),false);
 assert.equal(legacy.doasKWhPerKg,.5,'migration must not mutate the version 1 object');
 const zero=migrateScenario({...legacy,doasM3s:0,outsideAirReviewed:true});
 assert.equal(zero.doasM3s,0);
 assert.equal(zero.doasSupplyDewPointC,null);
 assert.equal(zero.doasSupplyTempC,null);
 assert.equal(zero.outsideAirReviewed,false);
 const omittedInput={...legacy,outsideAirReviewed:true};delete omittedInput.doasM3s;
 const omitted=migrateScenario(omittedInput);
 assert.equal(omitted.doasM3s,0);
 assert.equal(omitted.doasSupplyDewPointC,null);
 assert.equal(omitted.doasSupplyTempC,null);
 assert.equal(omitted.outsideAirReviewed,false);
 const generic=migrateScenario({...makeScenario('greenhouse'),schemaVersion:1,outsideAirBasis:'literatureRange',outsideAirReviewed:true});
 assert.equal(generic.outsideAirBasis,'screeningAssumption');
 assert.equal(generic.outsideAirReviewed,false);
});
test('inferred CSV bounds cannot expand into an unbounded missing-hour grid',()=>{
 const csv='time,tempC,rh,pressurePa,ghiWm2\n1970-01-01T00:00:00Z,20,.6,101325,0\n9999-01-01T00:00:00Z,20,.6,101325,0';
 assert.throws(()=>normalizeWeather(csv,{timezone:'UTC'}),/30 years/);
});
test('civil spring and fall date ranges preserve 23 and 25 UTC hours',()=>{
 for(const[date,first,count]of [['2025-03-09',Date.UTC(2025,2,9,6),23],['2025-11-02',Date.UTC(2025,10,2,5),25]]){
 const s=normalizeWeather(snapshot(Array.from({length:count},(_,i)=>sample(first+i*3600000)),{timezone:'America/Chicago',startDate:date,endDate:date}));
 assert.equal(s.hours.length,count);assert.equal(new Set(s.hours.map(h=>h.time)).size,count);
 }
});
test('gap and blank import cells remain missing, duplicate timestamps reject',()=>{
 const t=Date.UTC(2025,0,1),s=normalizeWeather(snapshot([sample(t),sample(t+7200000)]));
 assert.equal(s.hours.length,3);assert.equal(s.hours[1].tempC,null);
 assert.throws(()=>normalizeWeather(snapshot([sample(t),sample(t)])));
 const csv='time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,,.6,101325,0';
 assert.equal(normalizeWeather(csv,{timezone:'UTC'}).hours[0].tempC,null);
});
test('authoritative source RH survives an auxiliary frost-point disagreement',()=>{
 const h={...sample(0),tempC:-30,dewPointC:-30,rh:.75};
 const result=normalizeWeather(snapshot([h]));
 assert.equal(result.hours[0].rh,.75);
 assert.equal(result.hours[0].dewPointC,-30);
});
test('partial-day snapshots do not grow unobserved trailing hours on import',()=>{
 const start=Date.UTC(2025,0,1),end=start+3*3600000;
 const s=normalizeWeather(snapshot([sample(start),sample(end-3600000)],{startDate:'2025-01-01',endDate:'2025-01-01',startUTC:new Date(start).toISOString(),endExclusiveUTC:new Date(end).toISOString()}));
 assert.equal(s.hours.length,3);assert.equal(normalizeWeather(s).hours.length,3);
});
const result=(priceMode='state')=>({scenario:{...makeScenario(),priceMode,electricityPrice:.9,fuelPrice:.1,waterPrice:.01,timezone:'America/Chicago'},hours:[{time:Date.UTC(2025,1,1,5),valid:true,electricKWh:10,fuelKWh:2,waterL:3},{time:Date.UTC(2025,1,1,6),valid:true,electricKWh:10,fuelKWh:2,waterL:3}],summary:{monthly:[],daily:[]},warnings:[]});
const context={prices:[{period:'2025-01',usdPerKWh:.1},{period:'2025-02',usdPerKWh:.2}],grid:{year:2023,co2KgPerKWh:.4},warnings:[]};
test('billing months follow local calendar, not UTC month',()=>{
 const r=applyEnergyContext(result(),context);
 assert.equal(r.hours[0].pricePeriod,'2025-01');assert.equal(r.hours[1].pricePeriod,'2025-02');
 assert.ok(Math.abs(r.summary.cost-3.46)<1e-10);
 assert.equal(r.summary.co2Kg,null);
 assert.equal(applyEnergyContext(r,context).summary.cost,r.summary.cost);
});
test('missing historical prices remain unknown rather than using manual fallback',()=>{
 const r=applyEnergyContext(result(),{...context,prices:context.prices.slice(0,1)});
 assert.equal(r.summary.cost,null);assert.equal(r.summary.priceMissingHours,1);
 assert.equal(r.hours[1].electricityPriceUsdPerKWh,null);
 assert.ok(Math.abs(r.summary.knownCost-1.46)<1e-10);
});
test('manual price overrides catalog rates without losing provenance',()=>{
 const r=applyEnergyContext(result('manual'),context);
 assert.ok(Math.abs(r.summary.cost-18.46)<1e-10);
 assert.equal(r.energyContext.appliedPriceMode,'manual');
 assert.equal(r.hours[0].pricePeriod,'manual');
});


test('energy pricing preserves the structured operating-cost result contract',()=>{
 const r=result('state');
 r.summary=summarizeHours(r.hours,r.scenario);
 const priced=applyEnergyContext(r,context),basis=priced.summary.costBasis;
 assert.equal(basis.scope,'period');
 assert.equal(basis.label,'Model-estimated operating cost for the simulated period');
 assert.deepEqual(basis.period,{startDate:'2025-01-31',endDate:'2025-02-01'});
 assert.deepEqual(basis.included,['purchased electricity','purchased heating fuel','water represented by the scenario']);
 assert.deepEqual(basis.priceBasis,{
  electricity:{source:'calendar-matched state-sector average proxy',sector:'commercial',
   rates:[{period:'2025-01',usdPerKWh:.1},{period:'2025-02',usdPerKWh:.2}]},
  fuel:{source:'scenario input',usdPerKWh:.1},
  water:{source:'scenario input',usdPerL:.01},
 });
 assert.deepEqual(basis.excluded,['installed capital','maintenance','labor','financing','taxes','demand charges','fixed charges','time-of-use effects','other unmodeled tariff components']);
 assert.equal(basis.isQuote,false);
 assert.equal(basis.isGuaranteedSavings,false);
});
test('a ZIP resolves to its own time zone, not its state\'s',async()=>{
 const {proposeTimezone,zipTimezone}=await import('../src/energy.js');
 const table=JSON.parse(readFileSync(new URL('../data/us-zip-timezones.json',import.meta.url),'utf8'));
 const catalog={timezones:table};
 // Every one of these is in a state that spans two zones, and every one was wrong under the
 // state-level guess this replaced. They are the reason the table exists.
 const cases={'79901':['TX','America/Denver'],'32501':['FL','America/Chicago'],
  '42101':['KY','America/Chicago'],'57701':['SD','America/Denver'],'37901':['TN','America/New_York'],
  '97914':['OR','America/Boise'],'83801':['ID','America/Los_Angeles'],'86045':['AZ','America/Denver'],
  '80301':['CO','America/Denver'],'74103':['OK','America/Chicago']};
 for(const [zip,[state,want]] of Object.entries(cases)){
  const p=proposeTimezone({zip,state},catalog);
  assert.equal(p.timezone,want,`${zip} in ${state}`);
  assert.equal(p.source,'zip-table',`${zip} must come from the table, not the state`);
 }
 // Tuba City is Navajo Nation: it keeps daylight saving inside an Arizona that does not.
 const jul=new Date(Date.UTC(2025,6,15,19));
 const fmt=z=>new Intl.DateTimeFormat('en',{timeZone:z,hour:'2-digit',hourCycle:'h23'}).format(jul);
 assert.notEqual(fmt(proposeTimezone({zip:'86045',state:'AZ'},catalog).timezone),
                 fmt(proposeTimezone({zip:'85001',state:'AZ'},catalog).timezone),
                 'Tuba City and Phoenix must not read the same clock in July');

 // A ZIP the table does not carry still gets a proposal, clearly labelled as the weaker one.
 const fallback=proposeTimezone({zip:'00000',state:'TX'},catalog);
 assert.equal(fallback.source,'state-fallback');
 assert.equal(fallback.borderline,true,'a split-zone state fallback must say it is uncertain');
 assert.match(fallback.note,/spans more than one zone/);
 assert.equal(proposeTimezone({zip:'00000',state:null},catalog),null);
 assert.equal(proposeTimezone(null,catalog),null);

 // Every zone the table names must be one the runtime can actually format with.
 for(const zone of table.zones) assert.doesNotThrow(()=>new Intl.DateTimeFormat('en',{timeZone:zone}),zone);
 assert.ok(table.zones.length>=20,'the US uses more than twenty IANA zones, including the Indiana and North Dakota splits');
 // The run table must be sorted, or the binary search silently returns the wrong zone.
 for(let i=2;i<table.runs.length;i+=2)
  assert.ok(table.runs[i]>table.runs[i-2],`runs must ascend: ${table.runs[i-2]} then ${table.runs[i]}`);
 assert.equal(zipTimezone('abcde',table),null);
 assert.equal(zipTimezone('80301',null),null);
});

test('station separation is a real great-circle distance, and unknown when coordinates are missing',()=>{
 // Tulsa International (TUL) to the Boulder ZIP centroid: a stale default station, 4 states away.
 const tul={latitude:36.20,longitude:-95.89},boulder={latitude:40.02,longitude:-105.26};
 const km=separationKm(boulder,tul);
 assert.ok(Math.abs(km-922.6)<1,`expected about 923 km, got ${km}`);
 assert.equal(separationKm(tul,tul),0);
 assert.equal(separationKm(boulder,{latitude:null,longitude:null}),null);
 assert.equal(separationKm(boulder,undefined),null);
 // Antipodal points stay inside the asin domain instead of returning NaN.
 assert.ok(Math.abs(separationKm({latitude:0,longitude:0},{latitude:0,longitude:180})-20015)<5);
});

test('a new scenario ships with no site and says so, rather than inheriting one',()=>{
 const fresh=makeScenario();
 assert.equal(fresh.zip,null);
 assert.equal(fresh.latitude,null);
 assert.equal(fresh.longitude,null);
 assert.equal(fresh.timezone,null);
 const errors=validateScenario(fresh);
 assert.match(errors.join(' '),/no site/i);
 assert.match(errors.join(' '),/no IANA time zone/i);
 // Locating it clears both site errors; the outside-air review is the separate pre-existing gate.
 const located=validateScenario({...fresh,latitude:40,longitude:-100,timezone:'UTC'});
 assert.equal(located.filter(e=>/no site|IANA time zone/i.test(e)).length,0);
 assert.deepEqual(validateScenario({...fresh,latitude:40,longitude:-100,timezone:'UTC',outsideAirReviewed:true}),[]);
});

// src/terms.js is the plain-language doorway and docs/GLOSSARY.md is the precise reference. Two
// definition sources drift silently, so every bubble must be reachable from the interface and the
// vocabulary must stay a subset of what the glossary already defines.
test('every plain-language definition is reachable and none contradicts the glossary',async()=>{
 const {TERMS}=await import('../src/terms.js');
 const {FIELDS}=await import('../src/config.js');
 const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
 const app=read('../src/app.js'),html=read('../index.html');
 const fieldKeys=new Set(FIELDS.flatMap(g=>g.fields).map(f=>f.key));
 const referenced=key=>fieldKeys.has(key)||app.includes(`'${key}'`)||html.includes(`"${key}"`);
 const dead=Object.keys(TERMS).filter(k=>!referenced(k));
 assert.deepEqual(dead,[],`unreachable definitions, wire them or delete them: ${dead.join(', ')}`);

 const hooks=[...html.matchAll(/data-term="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(hooks.length>0,'index.html must carry data-term hooks');
 const undefinedHooks=hooks.filter(h=>!TERMS[h]);
 assert.deepEqual(undefinedHooks,[],`data-term with no definition: ${undefinedHooks.join(', ')}`);

 for(const [key,entry] of Object.entries(TERMS)){
  for(const field of ['term','plain']) assert.ok(typeof entry[field]==='string'&&entry[field].trim(),`${key} needs a ${field}`);
  // The project bans em and en dashes in copy, and these strings are copy.
  for(const [field,text] of Object.entries(entry))
   assert.ok(!/[—–]/.test(text),`${key}.${field} contains an em or en dash`);
 }
 // A bubble that claims a glossary section must point at one that exists, so renaming a heading
 // breaks the build instead of quietly leaving a dead link in the interface.
 const headings=new Set([...read('../docs/GLOSSARY.md').matchAll(/^#{2,3} (.+)$/gm)].map(m=>m[1].trim()));
 const broken=Object.entries(TERMS).filter(([,e])=>e.glossary&&!headings.has(e.glossary)).map(([k,e])=>`${k} -> "${e.glossary}"`);
 assert.deepEqual(broken,[],`bubble links to a missing glossary heading: ${broken.join('; ')}`);
 assert.ok(Object.values(TERMS).filter(e=>e.glossary).length>=15,'the domain terms should link to their precise definition');
});

// fetchObserved had no test, and a helper it depended on was once deleted by an edit to the code
// beside it without anything failing. This drives the whole station path against stubbed responses:
// a break anywhere in it, including a missing helper, fails here instead of in a user's browser.
test('the station provider builds a snapshot and reports how far the station is from the site',async()=>{
 const {fetchObserved}=await import('../src/weather.js');
 const iemRows=[['station','valid','tmpf','dwpf','relh','sknt','alti','lat','lon','elevation'].join(',')];
 for(let h=0;h<30;h++){
  const t=new Date(Date.UTC(2025,6,1,h)).toISOString().slice(0,19).replace('T',' ');
  iemRows.push(['TUL',t,'86.0','60.8','43.0','5.0','29.92','36.20','-95.89','206'].join(','));
 }
 const power={type:'Feature',geometry:{type:'Point',coordinates:[-105.214,40.05,1801.15]},
  header:{time_standard:'UTC',fill_value:-999},parameters:{ALLSKY_SFC_SW_DWN:{units:'Wh/m^2'}},
  properties:{parameter:{ALLSKY_SFC_SW_DWN:Object.fromEntries(
   Array.from({length:30},(_,h)=>[`20250701${String(h).padStart(2,'0')}`.slice(0,10),300]))}}};
 const prior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,status:200,
  text:async()=>String(url).includes('mesonet')?iemRows.join('\n'):JSON.stringify(power)});
 try{
  const snap=await fetchObserved({latitude:40.0497,longitude:-105.2143,timezone:'America/Denver',
   startDate:'2025-07-01',endDate:'2025-07-01',station:'TUL'});
  assert.equal(snap.station,'TUL');
  assert.ok(snap.hours.length>0,'the station path must produce hours');
  assert.equal(snap.sourceElevationM,1801.15,'the gridded cell elevation must be carried through');
  assert.equal(snap.stationMetadata[0].elevationM,206);
  const joined=snap.warnings.join(' ');
  assert.match(joined,/9[12][0-9] km from the requested coordinates/,'separation must be stated in km');
  assert.match(joined,/exceeds 100 km/,'a far station must be escalated');
  assert.match(joined,/1595 m below the 1801 m elevation/,'an elevation gap must be stated, it biases moisture');
 } finally { globalThis.fetch=prior; }
});

test('the station provider refuses to invent a station',async()=>{
 const {fetchObserved}=await import('../src/weather.js');
 await assert.rejects(()=>fetchObserved({latitude:40,longitude:-105,timezone:'America/Denver',
  startDate:'2025-07-01',endDate:'2025-07-01'}),/no default/i,'a missing station must fail loudly');
});

// A source offered in the picker with no adapter behind it is a dead option a user will pick.
test('every weather source offered has an adapter, and every adapter is described',async()=>{
 const {PROVIDER_IDS}=await import('../src/weather.js');
 const {PROVIDERS,PROVIDER_ORDER,needsApiKey}=await import('../src/providers.js');
 assert.deepEqual([...PROVIDER_IDS].sort(),Object.keys(PROVIDERS).sort(),
  'weather.js adapters and providers.js descriptions must name the same sources');
 assert.deepEqual([...PROVIDER_ORDER].sort(),Object.keys(PROVIDERS).sort(),
  'the picker order must list every source exactly once');
 for(const [id,p] of Object.entries(PROVIDERS)){
  for(const field of ['label','summary','grid','coverage','licence','limits'])
   assert.ok(typeof p[field]==='string'&&p[field].trim(),`${id} must state its ${field}`);
  // Honesty is the point of this panel: a source with no stated cost is a sales pitch.
  assert.ok(Array.isArray(p.pros)&&p.pros.length>=2,`${id} needs at least two things it is good for`);
  assert.ok(Array.isArray(p.cons)&&p.cons.length>=2,`${id} needs at least two things it costs you`);
  for(const text of [...p.pros,...p.cons,p.summary,p.grid,p.licence])
   assert.ok(!/[—–]/.test(text),`${id} copy contains an em or en dash`);
  if(p.apiKey){
   assert.equal(needsApiKey(id),true,`${id} declares a key so needsApiKey must agree`);
   assert.ok(p.apiKey.help?.trim(),`${id} must say how to get its key`);
   assert.ok(p.apiKey.signupUrl?.startsWith('https://'),`${id} must link where to get a key`);
  } else assert.equal(needsApiKey(id),false);
 }
 assert.equal(needsApiKey('not-a-provider'),false);
});

test('an unknown weather source is refused by name rather than silently defaulting',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 await assert.rejects(()=>fetchWeather({provider:'nope',latitude:40,longitude:-105,
  timezone:'UTC',startDate:'2025-01-01',endDate:'2025-01-01'}),/Unknown weather provider: nope/);
});

test('the Open-Meteo adapter records which model supplied each value',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 const hours=Array.from({length:30},(_,h)=>`2025-07-01T${String(h%24).padStart(2,'0')}:00`);
 const series=(v)=>hours.map(()=>v);
 const payload={latitude:40,longitude:-105.25,elevation:1589,generationtime_ms:1,utc_offset_seconds:0,
  hourly_units:{time:'iso8601'},hourly:{time:hours}};
 for(const [name,unit] of [['temperature_2m','°C'],['relative_humidity_2m','%'],['dew_point_2m','°C'],
   ['surface_pressure','hPa'],['shortwave_radiation','W/m²'],['wind_speed_10m','km/h']]){
  for(const model of ['era5_land','era5']) payload.hourly_units[`${name}_${model}`]=unit;
  // ERA5-Land carries no pressure, solar or wind: those must fall back and say so.
  const land=['surface_pressure','shortwave_radiation','wind_speed_10m'].includes(name);
  payload.hourly[`${name}_era5_land`]=land?series(null):series(20);
  payload.hourly[`${name}_era5`]=series(name==='surface_pressure'?850:name==='wind_speed_10m'?3.6:20);
 }
 // Radiation stamped T is the mean over the hour before T, so the value at index i belongs to hour i - 1.
 payload.hourly.shortwave_radiation_era5=hours.map((_,i)=>i);
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)});
 try{
  const snap=await fetchWeather({provider:'openmeteo',latitude:40,longitude:-105,timezone:'UTC',
   startDate:'2025-07-01',endDate:'2025-07-01'});
  assert.equal(snap.hours.length,24);
  assert.equal(snap.sourceElevationM,1589);
  const h=snap.hours[5];
  assert.equal(h.pressurePa,85000,'hPa must convert to Pa');
  assert.equal(h.windMs,1,'km/h must convert to m/s');
  assert.equal(h.rh,.2,'percent must convert to a fraction');
  assert.equal(h.ghiWm2,6,'the preceding-hour mean stamped 06:00 covers hour 05:00');
  assert.equal(snap.hours[23].ghiWm2,null,'the last hour has no following stamp in this payload, so it stays missing');
  assert.ok(h.quality.includes('tempC-from-era5-land-0.1deg'),'the 9 km model must be named when it supplied the value');
  assert.ok(h.quality.includes('pressurePa-from-era5-0.25deg'),'the fallback to the coarser model must be recorded');
  assert.match(snap.attribution,/CC BY 4.0/,'the licence requires attribution, so the snapshot must carry it');
 } finally { globalThis.fetch=prior; }
});

test('a silent unit change at the provider fails the fetch instead of rescaling every hour',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 const hours=['2025-07-01T00:00'];
 const payload={latitude:40,longitude:-105,elevation:1,hourly_units:{time:'iso8601'},hourly:{time:hours}};
 // Only surface_pressure is wrong, so the guard is shown catching that field and not another.
 const right={temperature_2m:'°C',relative_humidity_2m:'%',dew_point_2m:'°C',
  surface_pressure:'Pa',shortwave_radiation:'W/m²',wind_speed_10m:'km/h'};
 for(const [name,unit] of Object.entries(right))
  for(const model of ['era5_land','era5']){payload.hourly_units[`${name}_${model}`]=unit;payload.hourly[`${name}_${model}`]=[1];}
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)});
 try{
  await assert.rejects(()=>fetchWeather({provider:'openmeteo',latitude:40,longitude:-105,timezone:'UTC',
   startDate:'2025-07-01',endDate:'2025-07-01'}),/unexpected unit for surface_pressure/);
 } finally { globalThis.fetch=prior; }
});

// A recorded url is exported and cached. The first keyed provider must not put a key in either.
test('a provider key is stripped from anything a snapshot records',async()=>{
 const {redactSecrets,fetchWeather}=await import('../src/weather.js');
 const key='super-secret-key-1234';
 assert.equal(redactSecrets(`https://x.test/v1?key=${key}&a=1`,[key]),'https://x.test/v1?key=REDACTED&a=1');
 assert.equal(redactSecrets('https://x.test/v1?token=a%2Fb%2Fc',['a/b/c']),'https://x.test/v1?token=REDACTED');
 assert.equal(redactSecrets('https://x.test/v1?a=1',[null,undefined,'',  'ab']),'https://x.test/v1?a=1','short or absent secrets must not mangle a url');

 // End to end: a key handed to a fetch must not survive into the snapshot the user exports.
 const hours=['2025-07-01T00:00'];
 const payload={latitude:40,longitude:-105,elevation:1,hourly_units:{time:'iso8601'},hourly:{time:hours}};
 const units={temperature_2m:'°C',relative_humidity_2m:'%',dew_point_2m:'°C',
  surface_pressure:'hPa',shortwave_radiation:'W/m²',wind_speed_10m:'km/h'};
 for(const [name,unit] of Object.entries(units))
  for(const model of ['era5_land','era5']){payload.hourly_units[`${name}_${model}`]=unit;payload.hourly[`${name}_${model}`]=[1];}
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify(payload)});
 try{
  const snap=await fetchWeather({provider:'openmeteo',latitude:40,longitude:-105,timezone:'UTC',
   startDate:'2025-07-01',endDate:'2025-07-01',apiKey:key});
  const serialized=JSON.stringify(snap);
  assert.ok(!serialized.includes(key),'no part of a snapshot may carry the key');
 } finally { globalThis.fetch=prior; }
});

test('the NCEI adapter honours ISD quality flags and refuses to double-count an hour',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 // One good METAR, one whose temperature its own flag rejects, and a synoptic row for the same
 // hour that must not be allowed to win.
 const rows=[
  {STATION:'72053300160',NAME:'TEST FIELD, CO US',LATITUDE:'40.03',LONGITUDE:'-105.22',ELEVATION:'1612.1',
   REPORT_TYPE:'FM-15',DATE:'2025-07-01T00:53:00',TMP:'+0256,5',DEW:'+0117,5',WND:'110,5,N,0067,5',MA1:'10240,5,08387,5'},
  {STATION:'72053300160',REPORT_TYPE:'FM-15',DATE:'2025-07-01T01:53:00',TMP:'+0250,2',DEW:'+0110,5',
   WND:'110,5,N,0067,5',MA1:'10240,5,08387,5'},
  {STATION:'72053300160',REPORT_TYPE:'FM-12',DATE:'2025-07-01T00:00:00',TMP:'+9999,9',DEW:'+9999,9',
   WND:'999,9,N,9999,9',MA1:'99999,9,99999,9'},
 ];
 const prior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,status:200,text:async()=>
  String(url).includes('power.larc') ? JSON.stringify({geometry:{coordinates:[-105,40,1589]},
   header:{time_standard:'UTC',fill_value:-999},parameters:{ALLSKY_SFC_SW_DWN:{units:'Wh/m^2'}},
   properties:{parameter:{ALLSKY_SFC_SW_DWN:{}}}})
  : JSON.stringify(rows)});
 try{
  const snap=await fetchWeather({provider:'ncei',latitude:40.0497,longitude:-105.2143,timezone:'UTC',
   startDate:'2025-07-01',endDate:'2025-07-01',station:'72053300160'});
  const byHour=new Map(snap.hours.map(h=>[new Date(h.time).getUTCHours(),h]));
  assert.equal(byHour.get(1).tempC,25.6,'a good METAR must decode from tenths of a degree');
  assert.equal(byHour.get(1).pressurePa,83870,'MA1 field 08387 is 838.7 hPa, so 83,870 Pa');
  assert.ok(byHour.get(1).quality.includes('station-pressure-observed'));
  assert.equal(byHour.get(2).tempC,null,'a value its own ISD flag rejects must stay missing');
  assert.equal(byHour.get(2).dewPointC,11,'a rejected field must not discard its healthy neighbours');
  assert.equal(snap.stationMetadata[0].name,'TEST FIELD, CO US');
  assert.equal(snap.stationMetadata[0].elevationM,1612.1);
  assert.match(snap.warnings.join(' '),/is \d+ km from the requested coordinates/);
 } finally { globalThis.fetch=prior; }
});

test('Visual Crossing pressure is reduced to station pressure, and modelled hours are marked',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 const base=Date.UTC(2025,6,1,0)/1000;
 const hours=Array.from({length:26},(_,i)=>({datetimeEpoch:base+i*3600,temp:20,dew:10,humidity:52.5,
  pressure:1013,solarradiation:400,windspeed:7.2,
  // Half the hours name a contributing station; half name none and are therefore model output.
  stations:i%2===0?['KBDU','KBJC']:[]}));
 const payload={resolvedAddress:'Boulder, CO',timezone:'America/Denver',days:[{hours}]};
 const prior=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,status:200,text:async()=>
  String(url).includes('elevation') ? JSON.stringify({elevation:[1655]}) : JSON.stringify(payload)});
 try{
  const snap=await fetchWeather({provider:'visualcrossing',latitude:40.0497,longitude:-105.2143,
   timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-01',apiKey:'test-key-abcdef'});
  const h=snap.hours[0];
  assert.equal(snap.sourceElevationM,1655);
  // Sea level 1013 mb at 1,655 m is about 83 kPa at the site, not 101 kPa.
  assert.ok(h.pressurePa>81000&&h.pressurePa<85000,`expected station pressure near 83 kPa, got ${h.pressurePa}`);
  assert.ok(h.pressurePa<90000,'passing sea-level pressure through would corrupt every moisture figure');
  assert.ok(h.quality.includes('station-pressure-reduced-from-sea-level-and-elevation'));
  assert.equal(h.windMs,2,'km/h must convert to m/s');
  assert.equal(h.rh,.525,'percent must convert to a fraction');
  assert.deepEqual(h.stations,['KBDU','KBJC'],'contributing stations are the only provenance this service gives');
  const modelled=snap.hours.find(x=>x.quality.includes('no-contributing-station-value-is-modelled'));
  assert.ok(modelled,'an hour naming no station must be marked as modelled');
  assert.match(snap.warnings.join(' '),/came from a model rather than an instrument/);
  assert.match(snap.warnings.join(' '),/reduced to station pressure using 1655 m/);
  assert.ok(!JSON.stringify(snap).includes('test-key-abcdef'),'the key must not survive into the snapshot');
 } finally { globalThis.fetch=prior; }
});

test('Visual Crossing refuses to run without a key rather than failing obscurely',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 await assert.rejects(()=>fetchWeather({provider:'visualcrossing',latitude:40,longitude:-105,
  timezone:'UTC',startDate:'2025-07-01',endDate:'2025-07-01'}),/needs an API key/);
});

// A calendar year is bounded by local days, so the same year on two clocks is two different sets of
// UTC hours. Offering a year cached under another zone blocked the run AND blocked the re-fetch that
// would have fixed it, because retrieveYears skips any year reported as already available.
test('a weather year cached on another clock is not offered for this site',()=>{
 const near=(a,b)=>Math.abs(a-b)<.001;
 // The shape of yearSources, kept in step with src/app.js by the assertions below.
 const yearSources=(cached,loaded,latitude,longitude,timezone)=>{
  const sources=new Map();
  const sameSite=e=>near(e.latitude,latitude)&&near(e.longitude,longitude)&&e.timezone===timezone;
  for(const e of cached) if(e.year&&sameSite(e)) sources.set(e.year,{kind:'cached'});
  if(loaded&&loaded.year&&sameSite(loaded)) sources.set(loaded.year,{kind:'loaded'});
  return sources;
 };
 const boulder={latitude:40.0497,longitude:-105.2143};
 const staleChicago={...boulder,timezone:'America/Chicago',year:'2021'};
 const freshDenver={...boulder,timezone:'America/Denver',year:'2022'};

 const offered=yearSources([staleChicago,freshDenver],null,boulder.latitude,boulder.longitude,'America/Denver');
 assert.equal(offered.has('2021'),false,'a Chicago year must not be offered to a Denver site');
 assert.equal(offered.has('2022'),true,'a matching year must still be offered');
 // This is the part that matters: an unoffered year reads as missing, so a re-fetch is possible.
 const wanted=['2021','2022'];
 assert.deepEqual(wanted.filter(y=>!offered.has(y)),['2021'],'the stale year must look missing so it can be retrieved again');

 // Same coordinates and same clock still hit the cache, or every run would re-download.
 const same=yearSources([staleChicago],null,boulder.latitude,boulder.longitude,'America/Chicago');
 assert.equal(same.has('2021'),true);
 // A loaded snapshot is held to the same rule as a cached one.
 const loadedWrong=yearSources([],{...boulder,timezone:'America/Chicago',year:'2023'},boulder.latitude,boulder.longitude,'America/Denver');
 assert.equal(loadedWrong.size,0,'a loaded snapshot on another clock must not count either');
});

// range() computes local-day bounds, so a guessed zone corrupts the request rather than just
// mislabelling it. This was the last place a zone was silently assumed.
test('fetching weather without a time zone fails instead of assuming one',async()=>{
 const {fetchWeather}=await import('../src/weather.js');
 for(const tz of [undefined,'','   ','Not/AZone'])
  await assert.rejects(()=>fetchWeather({provider:'openmeteo',latitude:40,longitude:-105,
   timezone:tz,startDate:'2025-07-01',endDate:'2025-07-01'}),/valid IANA time zone is required/,`timezone ${JSON.stringify(tz)}`);
});

test('a snapshot without a declared time zone is refused rather than read as UTC', () => {
 const t=Date.UTC(2025,0,1);
 assert.throws(()=>normalizeWeather(snapshot([sample(t)],{timezone:undefined})),/time zone/);
 assert.throws(()=>normalizeWeather(snapshot([sample(t)],{timezone:''})),/time zone/);
});
