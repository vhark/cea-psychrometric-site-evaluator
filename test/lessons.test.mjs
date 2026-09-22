import test from 'node:test';
import assert from 'node:assert/strict';
import {enthalpy, padState, CP_DRY_AIR, LATENT_HEAT} from '../src/physics.js';
const lessons = await import('../src/education/lessons.js').catch(() => ({}));
const chart = await import('../src/workbench/psychrometric-chart.js').catch(() => ({}));
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
const input={tempC:20,rh:.6,pressurePa:101325,authoritative:'rh',rhReference:'water',dewPointReference:'water'};
test('calculator requires a declared cold humidity convention and accepts real dry air',()=>{
 assert.equal(typeof lessons.airState,'function');
 assert.throws(()=>lessons.airState({...input,tempC:-10,rhReference:'unknown'}),/unknown/);
 const dry=lessons.airState({...input,rh:0});assert.equal(dry.w,0);assert.equal(dry.dewPointC,null);
 assert.throws(()=>lessons.airState({...input,authoritative:'dewPointC',dewPointC:21}),/exceeds/);
});
test('heating preserves water mass while reducing RH and increasing enthalpy',()=>{
 assert.equal(typeof lessons.runLesson,'function');
 const result=lessons.runLesson('heating',input,10);
 assert.equal(result.end.w,result.start.w);assert.equal(result.end.tempC,30);
 assert.ok(result.end.rh<result.start.rh);near(result.heatJkg,enthalpy(30,result.start.w)-enthalpy(20,result.start.w));
});
test('cold humid air has drying potential relative to a warm room but no assumed demand',()=>{
 assert.equal(typeof lessons.runLesson,'function');
 const result=lessons.runLesson('cold-air',{...input,tempC:5,rh:.9},24);
 assert.equal(result.end.w,result.start.w);assert.ok(result.start.rh>.85);assert.ok(result.end.rh<.3);
 assert.ok(result.dryingPotentialKgKg>0);near(result.dryingPotentialKgKg,result.reference.w-result.start.w);
 assert.equal(result.reference.tempC,24);assert.equal(result.reference.rh,.7);
});
test('pad lesson endpoints come from the shared pad model and approximately conserve enthalpy',()=>{
 assert.equal(typeof lessons.runLesson,'function');
 const result=lessons.runLesson('pad',{...input,tempC:35,rh:.2},.8);
 const expected=padState(result.start.tempC,result.start.w,result.start.pressurePa,.8);
 near(result.end.tempC,expected.tempC);near(result.end.w,expected.w);
 assert.ok(result.end.w>result.start.w);assert.ok(result.end.tempC<result.start.tempC);
 near(result.end.enthalpyJkg,result.start.enthalpyJkg,1e-6);
});
test('condensing dehumidifier removes the requested water and returns latent plus electrical heat',()=>{
 assert.equal(typeof lessons.runLesson,'function');
 const result=lessons.runLesson('dehumidifier',{...input,tempC:24,rh:.75},.25);
 near(result.waterRemovedKgKg,result.start.w*.25);near(result.end.w,result.start.w*.75);
 near(result.heatJkg,LATENT_HEAT*result.waterRemovedKgKg+result.electricJkg);
 near(result.end.tempC-result.start.tempC,result.heatJkg/CP_DRY_AIR);
 assert.ok(result.end.tempC>result.start.tempC);assert.ok(result.end.rh<result.start.rh);
});
test('lesson rejects unphysical process settings and unsupported supersaturated pad input',()=>{
 assert.equal(typeof lessons.runLesson,'function');
 assert.throws(()=>lessons.runLesson('heating',input,-5),/range/);
 assert.throws(()=>lessons.runLesson('pad',input,1.2),/range/);
 assert.throws(()=>lessons.runLesson('dehumidifier',input,1.5),/range/);
 assert.throws(()=>lessons.runLesson('pad',{...input,tempC:-10,rh:1},.8),/saturat|freezing/);
});
test('SI and IP input conversions roundtrip without presentation rounding',()=>{
 assert.equal(typeof lessons.inputToSI,'function');
 const precise={tempC:21.234567891,pressurePa:84321.123456,rh:.672123456,dewPointC:13.456789};
 const ip=lessons.inputFromSI(precise,'ip');const back=lessons.inputToSI(ip,'ip');
 for(const key of Object.keys(precise))near(back[key],precise[key],1e-9);
});
test('chart RH curves use declared backdrop pressure while selected states keep actual pressure',()=>{
 assert.equal(typeof chart.chartData,'function');
 const low=lessons.airState({...input,pressurePa:84000});const high=lessons.airState(input);
 const data=chart.chartData([low],101325);
 assert.equal(data.pressurePa,101325);assert.equal(data.points[0].pressurePa,84000);assert.equal(data.points[0].w,low.w);
 assert.ok(low.w>high.w);
 const curve=data.curves.find(c=>c.rh===.6);const point=curve.points.find(p=>p.tempC===20);near(point.w,high.w);
 const altitude=chart.chartData([low],84000).curves.find(c=>c.rh===.6).points.find(p=>p.tempC===20);near(altitude.w,low.w);
});
