import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyWeather} from '../src/physics.js';
import {DEFAULT_SCENARIO} from '../src/config.js';
import {weatherSummary} from '../src/metrics.js';
import {modeLabel} from '../src/charts.js';
import {weatherQuality} from '../src/weather-quality.js';
const hour={time:Date.UTC(2025,5,1,12),tempC:35,rh:.15,pressurePa:101325,ghiWm2:400};
const scenario={...DEFAULT_SCENARIO,timezone:'UTC',dayTargetC:24,nightTargetC:24,padEffectiveness:.85};
test('hypothetical evaporative opportunity never credits an absent pad',()=>{
 const off=classifyWeather(hour,{...scenario,padEnabled:false}),on=classifyWeather(hour,{...scenario,padEnabled:true});
 assert.equal(off.opportunity.pad.cooling,true);assert.deepEqual(off.opportunity,on.opportunity);
 assert.equal(off.capability.pad.installed,false);assert.equal(off.capability.pad.useful,false);
 assert.equal(on.capability.pad.useful,true);assert.equal(off.operation,null);
 assert.equal(modeLabel(off.mode),'Evaporative cooling opportunity — pad required');
 const summary=weatherSummary([hour],{...scenario,padEnabled:false});
 assert.equal(summary.utility.padUsefulHours,0);assert.equal(summary.opportunity.padCoolingHours,1);
});
test('humid limits and cold humid drying remain weather questions; missing breaks episodes',()=>{
 assert.equal(classifyWeather({...hour,rh:.95},scenario).opportunity.pad.cooling,false);
 assert.equal(classifyWeather({...hour,tempC:0,rh:.95},scenario).opportunity.vent.drying,true);
 const hours=[hour,{...hour,time:hour.time+3600000,tempC:null},{...hour,time:hour.time+7200000}];
 const summary=weatherSummary(hours,{...scenario,padEnabled:false});
 assert.equal(summary.validHours,2);assert.equal(summary.missingHours,1);
 assert.equal(summary.episodes.PAD_EFFECTIVE_REQUIRES_PAD.maximumHours,1);
});
test('quality distinguishes finite coverage from supported interpretations and solar eligibility',()=>{
 const q=weatherQuality({hours:[hour,{...hour,tempC:90},{...hour,tempC:-10,moisture:{authoritative:'rh',rhReference:'unknown',dewPointReference:'unknown'}},{...hour,ghiWm2:null,quality:['rh-derived-from-dewpoint']}]});
 assert.equal(q.rawMeteorologyHours,4);assert.equal(q.weatherEligibleHours,2);assert.equal(q.simulationEligibleHours,1);
 assert.equal(q.unresolvedMoistureHours,1);assert.equal(q.unsupportedStateHours,2);assert.equal(q.derivedHours,1);
});
test('unavailable ventilation is a capability projection, not an outdoor-air opportunity',()=>{
 const c=classifyWeather({...hour,tempC:15},{...scenario,maxVentACH:0});
 assert.equal(c.opportunity.vent.drying,true);assert.equal(c.capability.vent.useful,false);
 assert.equal(c.utility.vent.cooling,false);assert.equal(c.utility.vent.drying,false);
 assert.equal(weatherSummary([hour],{...scenario,padEnabled:false}).padViability.coolingDemandHours,1);
});
test('installed pad without airflow retains opportunity but has zero capability',()=>{
 const s={...scenario,padEnabled:true,maxVentACH:0,minVentACH:0};
 const c=classifyWeather(hour,s);assert.equal(c.opportunity.pad.cooling,true);assert.equal(c.capability.pad.installed,true);assert.equal(c.capability.pad.useful,false);
 const summary=weatherSummary([hour],s);assert.equal(summary.utility.padUsefulHours,0);assert.equal(summary.padViability.effectiveHours,0);
});
