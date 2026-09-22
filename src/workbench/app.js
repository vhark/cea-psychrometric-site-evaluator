import {airState,runLesson,lessonDefinitions,inputFromSI,inputToSI} from '../education/lessons.js';
import {hourMoisture} from '../moisture.js';
import {WeatherClient} from '../weather-client.js';
import {renderChart} from './psychrometric-chart.js';
const $=id=>document.getElementById(id);
const state={input:{...lessonDefinitions[0].input},units:'si',lesson:lessonDefinitions[0],parameter:10,revealed:false,source:null,history:null,index:0,examples:[],importController:null,client:null};
const format=(value,digits=2)=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'Unavailable';
const numberInput=id=>$(id).value.trim()===''?NaN:Number($(id).value);
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;}
function setControls(){
 const visible=inputFromSI(state.input,state.units),ip=state.units==='ip';
 $('temperature').value=Number.isFinite(visible.tempC)?Number(visible.tempC.toFixed(8)):'';
 $('pressure').value=Number.isFinite(visible.pressurePa)?Number(visible.pressurePa.toFixed(8)):'';
 $('rh').value=Number.isFinite(state.input.rh)?Number((state.input.rh*100).toFixed(8)):'';
 $('dew-point').value=Number.isFinite(visible.dewPointC)?Number(visible.dewPointC.toFixed(8)):'';
 $('humidity-mode').value=state.input.authoritative;
 $('rh-reference').value=state.input.rhReference;$('dew-reference').value=state.input.dewPointReference;
 $('temperature-label').textContent=`Dry bulb · ${ip?'°F':'°C'}`;$('dew-label').textContent=`Dew / frost point · ${ip?'°F':'°C'}`;
 $('pressure-label').textContent=`Station pressure · ${ip?'psia':'kPa'}`;
 $('rh-field').hidden=state.input.authoritative!=='rh';$('dew-field').hidden=state.input.authoritative!=='dewPointC';
}
function cell(primary,secondary){const td=node('td',primary);if(secondary)td.append(node('small',secondary));return td;}
function renderTable(points){
 const tbody=$('state-table').querySelector('tbody');tbody.replaceChildren();
 const ip=state.units==='ip';
 points.forEach((point,index)=>{
  const row=node('tr');const heading=node('th',['A · Input','B · After process','C · Room at 70% RH'][index]);heading.scope='row';
  const temp=[`${format(point.tempC)} °C`,`${format(point.tempC*9/5+32)} °F`];
  const water=[`${format(point.w*1000,3)} g/kg`,`${format(point.w*7000,2)} gr/lb`];
  const energy=[`${format(point.enthalpyJkg/1000)} kJ/kg`,`${format(point.enthalpyJkg/2326)} Btu/lb`];
  const pressure=[`${format(point.pressurePa/1000,3)} kPa`,`${format(point.pressurePa/6894.757293168,3)} psia`];
  row.append(heading,cell(temp[+ip],temp[+!ip]),cell(Number.isFinite(point.rh)?`${format(point.rh*100)}%`:'Unavailable',`RH ref: ${point.basis.rhReference}`),cell(water[+ip],water[+!ip]),cell(energy[+ip],energy[+!ip]),cell(pressure[+ip],pressure[+!ip]));tbody.append(row);
 });
 $('state-table').dataset.humidityRatio=String(points[0].w);$('state-table').dataset.endTemperature=points[1]?String(points[1].tempC):'';
}
function explain(result){
 const {start,end,id}=result,paragraphs=[];let arithmetic;
 const rhText=point=>Number.isFinite(point.rh)?`${format(point.rh*100)}%`:`unavailable for the declared ${point.basis.rhReference} reference`;
 if(start.tempC===end.tempC&&start.w===end.w){
  $('explanation').replaceChildren(node('p','At this setting, the air state is unchanged. No temperature or water-content change occurs. Increase the process setting to explore the lesson.'),node('p','ΔT = 0 °C · ΔW = 0 g/kg dry air','arithmetic'));return;
 }
 if(id==='heating'){
  paragraphs.push(`Heating changes the saturation pressure. RH is ${rhText(start)} before heating and ${rhText(end)} afterward. No water has left: the humidity ratio stays at ${format(start.w*1000,3)} g/kg dry air. Lower RH by itself does not demonstrate dehumidification.`);
  arithmetic=`ΔW = 0 g/kg · ΔT = ${format(end.tempC-start.tempC)} °C · heat added = ${format(result.heatJkg/1000)} kJ/kg dry air`;
 }
 if(id==='cold-air'){
  const potential=result.dryingPotentialKgKg;
  paragraphs.push(`Warming this outside air to ${format(end.tempC)} °C keeps its ${format(start.w*1000,3)} g/kg water content unchanged. Its RH at that temperature is ${rhText(end)}. The reference room at 70% RH contains ${format(result.reference.w*1000,3)} g/kg.`);
  paragraphs.push(potential>0?'The outside air can carry away moisture when exchanged with this room, even if its outdoor RH is high. This is a drying opportunity; it does not establish crop demand, an installed ventilation rate, or a least-cost strategy.':'At these changed inputs, the outside air does not offer drying against this room reference. Compare water content, not RH alone.');
  arithmetic=`Room W − outdoor W = ${format(potential*1000,3)} g/kg dry air · warming heat = ${format(result.heatJkg/1000)} kJ/kg dry air`;
 }
 if(id==='pad'){
  paragraphs.push(`The wetted pad lowers dry bulb by ${format(start.tempC-end.tempC)} °C while adding ${format((end.w-start.w)*1000,3)} g/kg of moisture. Water evaporates using sensible heat from the air. The endpoint comes from the same pad calculation as the site evaluator.`);
  paragraphs.push('This example is approximately constant enthalpy and neglects liquid-water enthalpy. It shows a potential process, not installed pad capacity or simulated runtime.');
  arithmetic=`T out = T in − effectiveness × (T in − wet bulb) · ${format(start.enthalpyJkg/1000)} → ${format(end.enthalpyJkg/1000)} kJ/kg dry air`;
 }
 if(id==='dehumidifier'){
  paragraphs.push(`Condensation removes ${format(result.waterRemovedKgKg*1000,3)} g/kg of water. With all condenser heat returned to the air, the latent heat released plus electrical input raises its temperature by ${format(end.tempC-start.tempC)} °C. The resulting air is drier and warmer.`);
  paragraphs.push('Teaching assumptions: 2.5 L/kWh, all heat returned indoors, latent heat 2,450 kJ/kg water, dry-air heat capacity 1.006 kJ/(kg·°C). This uses the evaluator’s coarse sensible/latent balance; it is not a detailed cooling-coil model or a measured efficiency claim. A remote condenser would change the heat path.');
  arithmetic=`Heat returned = ${format(result.waterRemovedKgKg*2450)} latent + ${format(result.electricJkg/1000)} electric = ${format(result.heatJkg/1000)} kJ/kg dry air`;
 }
 $('explanation').replaceChildren(...paragraphs.map(text=>node('p',text)),node('p',arithmetic,'arithmetic'));
}
function render(){
 $('input-error').textContent='';$('explanation').hidden=!state.revealed;
 const pressure=state.input.pressurePa;
 $('pressure-basis').textContent=`${format(pressure/1000,3)} kPa (${format(pressure/6894.757293168,3)} psia). ${state.source?.pressureBasis||'Station pressure entered directly; no elevation-derived adjustment.'}`;
 try{
  const start=airState(state.input),result=state.revealed?runLesson(state.lesson.id,state.input,state.parameter):null;
  const points=result?[start,result.end,...(result.reference?[result.reference]:[])]:[start];
  const chartPa=numberInput('chart-pressure')*1000;
  renderChart($('chart'),points,chartPa,state.units);renderTable(points);
  $('chart-basis').textContent=`Backdrop: ${format(chartPa/1000,3)} kPa; liquid-water RH curves. Selected state: ${format(pressure/1000,3)} kPa. ${Math.abs(chartPa-pressure)>.01?'The point uses its actual pressure; read its RH from the table, not the backdrop curves.':'Backdrop and input pressure match.'}`;
  const t=value=>Number.isFinite(value)?`${format(state.units==='ip'?value*9/5+32:value)} ${state.units==='ip'?'°F':'°C'}`:'Unavailable';
  $('extra-properties').textContent=`Input vapor pressure: ${format(start.vaporPressurePa/1000,3)} kPa · Stable-phase dew / frost point: ${t(start.dewPointC)} · Stable-phase wet bulb: ${t(start.wetBulbC)}. Below 0.01 °C the equilibrium point is a frost point, even when input RH is over water.`;
  $('state-warnings').textContent=[...start.warnings,...(state.source?.warnings||[])].join(' ');
  if(result)explain(result);
 }catch(error){
  $('input-error').textContent=error.message;$('chart').replaceChildren();$('state-table').querySelector('tbody').replaceChildren();
  delete $('state-table').dataset.humidityRatio;delete $('state-table').dataset.endTemperature;
  $('explanation').hidden=true;$('extra-properties').textContent='';$('state-warnings').textContent='';$('chart-basis').textContent='Correct the input to calculate and plot this state.';
 }
}
function parameterDisplay(){
 const p=state.lesson.parameter;
 $('process-output').textContent=p.unit==='fraction'?`${format(state.parameter*100,0)}%`:`${format(state.units==='ip'?(state.lesson.id==='heating'?state.parameter*9/5:state.parameter*9/5+32):state.parameter,0)} ${state.units==='ip'?'°F':'°C'}`;
}
function selectLesson(id){
 state.lesson=lessonDefinitions.find(lesson=>lesson.id===id);state.parameter=state.lesson.parameter.value;state.input={...state.lesson.input};state.source=null;state.revealed=false;
 for(const button of $('lesson-tabs').children)button.setAttribute('aria-pressed',String(button.dataset.lesson===id));
 $('lesson-number').textContent=`Lesson ${lessonDefinitions.indexOf(state.lesson)+1} / Predict first`;$('lesson-title').textContent=state.lesson.title;
 $('prediction-question').textContent=state.lesson.question;$('prediction-choices').replaceChildren();
 state.lesson.choices.forEach((choice,index)=>{const label=node('label'),input=node('input');input.type='radio';input.name='prediction';input.value=index;label.append(input,document.createTextNode(choice));$('prediction-choices').append(label);});
 const p=state.lesson.parameter;$('process-label').textContent=p.label;Object.assign($('process-value'),{min:p.min,max:p.max,step:p.step,value:p.value});
 $('prediction-feedback').textContent='';$('example').value='';$('source-detail').textContent='Illustrative lesson inputs; no historical observation is selected.';parameterDisplay();setControls();render();
}
for(const [index,lesson]of lessonDefinitions.entries()){
 const button=node('button');button.type='button';button.dataset.lesson=lesson.id;button.setAttribute('aria-pressed',String(index===0));
 button.append(node('span',`0${index+1}`,'lesson-index'),node('strong',lesson.title),node('span',lesson.summary));
 button.addEventListener('click',()=>selectLesson(lesson.id));$('lesson-tabs').append(button);
}
$('state-form').addEventListener('submit',event=>event.preventDefault());
const inputMap={temperature:'tempC',pressure:'pressurePa',rh:'rh','dew-point':'dewPointC'};
for(const [id,key]of Object.entries(inputMap))$(id).addEventListener('change',()=>{
 const value=numberInput(id);
 if(key==='rh')state.input.rh=value/100;
 else state.input[key]=inputToSI({...inputFromSI(state.input,state.units),[key]:value},state.units)[key];
 // Only the edited scalar is replaced. Rounded values in other controls never flow back.
 state.source=null;$('source-detail').textContent='Custom air state; edited values are no longer a historical observation.';$('example').value='';render();
});
for(const [id,key]of [['humidity-mode','authoritative'],['rh-reference','rhReference'],['dew-reference','dewPointReference']])$(id).addEventListener('change',()=>{state.input[key]=$(id).value;state.source=null;$('source-detail').textContent='Custom air state; the edited humidity convention is no longer the historical observation.';$('example').value='';setControls();render();});
$('units').addEventListener('change',()=>{state.units=$('units').value;setControls();parameterDisplay();render();});
$('process-value').addEventListener('input',()=>{state.parameter=numberInput('process-value');parameterDisplay();render();});
$('process-value').addEventListener('change',()=>{state.parameter=numberInput('process-value');parameterDisplay();render();});
$('reveal').addEventListener('click',()=>{
 const prediction=document.querySelector('input[name="prediction"]:checked');
 $('prediction-feedback').textContent=prediction?`${Number(prediction.value)===state.lesson.answer?'That matches the starting example.':'Compare your prediction with the result below.'} Changed inputs may produce a different outcome.`:'Try a prediction next time, then compare it with these calculated results.';
 state.revealed=true;render();
});
$('chart-pressure').addEventListener('change',render);$('match-pressure').addEventListener('click',()=>{$('chart-pressure').value=state.input.pressurePa/1000;render();});
$('theme').addEventListener('click',()=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'dark';$('theme').textContent=light?'Dark theme':'Light theme';document.querySelector('.logo').src=new URL(`../../assets/logo-${light?'black':'white'}.png`,import.meta.url).href;});
function loadHour(hour,source){
 const resolved=hourMoisture(hour);
 state.input={tempC:hour.tempC,rh:hour.rh,dewPointC:hour.dewPointC,pressurePa:hour.pressurePa,...resolved.basis};state.source={...source,warnings:resolved.warnings};state.revealed=false;
 $('prediction-feedback').textContent='Real weather loaded. Choose a process or edit this state to explore.';setControls();render();
}
$('example').addEventListener('change',()=>{
 if($('example').value==='')return;
 const example=state.examples[Number($('example').value)];
 loadHour({...example.hour,moisture:{authoritative:'rh',rhReference:'water',dewPointReference:'unknown'}},{pressureBasis:'NASA POWER hourly pressure; site source elevation 249.54 m. No elevation correction applied.'});
 $('source-detail').replaceChildren(document.createTextNode(`${example.label} · Tulsa, OK · ${example.timeUTC} · NASA POWER · `));
 const link=node('a','Source request');link.href=example.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';$('source-detail').append(link);
});
function selectHour(index){
 if(!state.history)return;
 state.index=Math.max(0,Math.min(state.history.hours.length-1,index));$('hour-index').value=state.index;
 const hour=state.history.hours[state.index];
 loadHour(hour,{pressureBasis:'Imported hourly station pressure; no elevation correction applied.'});
 $('previous-hour').disabled=state.index===0;$('next-hour').disabled=state.index===state.history.hours.length-1;
 $('hour-label').textContent=`${state.index+1} / ${state.history.hours.length} · ${new Date(hour.time).toISOString()} · ${state.history.timezone} site time zone · ${hour.dataKind||state.history.dataKind||'user-supplied'}`;
 $('source-detail').textContent=`${state.history.source} · ${state.history.sourceKind||'Imported historical weather'} · Snapshot ${state.history.id}. Selected-hour pressure is preserved.`;
 $('example').value='';
}
$('previous-hour').addEventListener('click',()=>selectHour(state.index-1));$('next-hour').addEventListener('click',()=>selectHour(state.index+1));$('hour-index').addEventListener('input',()=>selectHour(numberInput('hour-index')));
$('cancel-import').addEventListener('click',()=>state.importController?.abort());
$('weather-file').addEventListener('change',async()=>{
 const file=$('weather-file').files[0];if(!file)return;
 state.importController?.abort();const controller=new AbortController();state.importController=controller;
 $('cancel-import').hidden=false;$('import-status').textContent='Preparing weather in a background worker…';
 try{
  if(!state.client||state.client.closed)state.client=new WeatherClient();
  const reference=$('import-reference').value;
  const options={timezone:$('import-timezone').value.trim(),latest:false};
  // CSV has no embedded convention. Sealed JSON keeps its original identity and basis.
  if(/\.csv$/i.test(file.name))options.moisture={authoritative:$('import-authority').value,rhReference:reference,dewPointReference:reference};
  const {snapshot}=await state.client.parseFile(file,options,
   {signal:controller.signal,onProgress:(_,message)=>{if(state.importController===controller)$('import-status').textContent=message;}});
  if(controller.signal.aborted||state.importController!==controller)return;
  if(!snapshot?.hours?.length)throw new Error('This file contains no historical weather hours.');
  state.history=snapshot;$('history-controls').hidden=false;$('hour-index').max=snapshot.hours.length-1;selectHour(0);
  $('import-status').textContent=`${snapshot.hours.length.toLocaleString('en-US')} hours ready · ${snapshot.timezone}. Use the slider or previous/next buttons. ${snapshot.storageWarning||''}`;
 }catch(error){if(state.importController===controller)$('import-status').textContent=error.name==='AbortError'?'Import cancelled. The previous state is still available.':`Import failed: ${error.message}`;}
 finally{if(state.importController===controller){$('cancel-import').hidden=true;state.importController=null;}$('weather-file').value='';}
});
window.addEventListener('pagehide',()=>{state.importController?.abort();state.client?.close();});
selectLesson('heating');
fetch(new URL('../../data/weather/sample-hours.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('Teaching examples unavailable.');return response.json();}).then(data=>{state.examples=data.hours;data.hours.forEach((example,index)=>{const option=node('option',example.label);option.value=index;$('example').append(option);});}).catch(error=>{$('source-detail').textContent=error.message+' The calculator and lessons remain available.';});
