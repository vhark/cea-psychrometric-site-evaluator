export const MODEL_VERSION = '0.2.0-screening';
// lai: leaf area index (m² leaf / m² canopy) for the Stanghellini transpiration model; screening assumptions, not measured canopies.
export const CROPS = {
  lettuce: {label:'Baby-leaf lettuce',dayTargetC:22,nightTargetC:18,vpdMin:.6,vpdMax:1,dliTarget:14,photoperiod:16,lai:3,transpirationLDayM2:1.3*9/7,source:'Planning assumption: 1.3 kg/m²/week at 9 L/kg of fresh weight. Not measured transpiration; replace with site data.'},
  headLettuce: {label:'Head lettuce',dayTargetC:24,nightTargetC:18,vpdMin:.8,vpdMax:1.2,dliTarget:17,photoperiod:16,lai:3,transpirationLDayM2:2*10/7,source:'Planning assumption: 2 kg/m²/week at 10 L/kg of fresh weight. Not measured transpiration; replace with site data.'},
  basil: {label:'Basil',dayTargetC:26,nightTargetC:22,vpdMin:.8,vpdMax:1.2,dliTarget:29,photoperiod:16,lai:3,transpirationLDayM2:.9*13/7,source:'Planning assumption: 0.9 kg/m²/week at 13 L/kg. Cultivar, flowering and harvest schedule need verification.'},
  arugula: {label:'Arugula',dayTargetC:22,nightTargetC:18,vpdMin:.6,vpdMax:1,dliTarget:14,photoperiod:16,lai:2.5,transpirationLDayM2:.85*8/7,source:'Planning assumption: 0.85 kg/m²/week at 8 L/kg. Not validated against measured transpiration.'},
  microgreens: {label:'Mixed microgreens',dayTargetC:22,nightTargetC:19,vpdMin:.5,vpdMax:.9,dliTarget:8,photoperiod:15,lai:1.5,transpirationLDayM2:2,source:'Editable screening moisture schedule. Tray/cycle yield is not hourly evapotranspiration.'},
  propagation: {label:'Propagation seedlings',dayTargetC:23,nightTargetC:20,vpdMin:.4,vpdMax:.8,dliTarget:10,photoperiod:16,lai:1,transpirationLDayM2:1,source:'Planning assumption: 1 L/m²/day under mist or fog propagation. Replace with measured irrigation data.'},
  tomato: {label:'Fruiting tomato (illustrative)',dayTargetC:26,nightTargetC:20,vpdMin:.8,vpdMax:1.4,dliTarget:25,photoperiod:16,lai:3.5,transpirationLDayM2:4,source:'Illustrative warm fruiting-crop screen, not a calibrated tomato water or yield model. Replace with measured stage-specific loads.'},
  custom: {label:'Custom crop program',dayTargetC:22,nightTargetC:18,vpdMin:.6,vpdMax:1,dliTarget:14,photoperiod:16,lai:3,transpirationLDayM2:2,source:'User-defined program. The initial values are assumptions until replaced by measured inputs.'},
  mushroom: {label:'Mushroom fruiting',dayTargetC:18,nightTargetC:18,vpdMin:.1,vpdMax:.3,dliTarget:0,photoperiod:12,lai:0,transpirationModel:'schedule',transpirationLDayM2:.3,source:'Provisional moisture input. Set respiration heat and mandatory fresh air from block/CO₂ loading.'}
};
export const CONTROL_MODES = {staged:'Staged causal controller (deadband, minimum on/off, ordered stages)',ideal:'Ideal modulation upper bound (enumerating dispatcher)'};
export const TRANSPIRATION_MODELS = {stanghellini:'Stanghellini (Vanthoor 2011 §8.9), state-coupled',schedule:'Declared L/m²/day schedule'};
export const FACILITIES = {greenhouse:'Vented greenhouse',hybrid:'Hybrid greenhouse',indoor:'Indoor farm'};
// One cultivation system for now. Rack and wall formats need canopy-area and tier-interception
// evidence this screen does not have, so they are not offered rather than guessed.
export const SYSTEMS = {bench:'Greenhouse benches'};
const RETIRED_SYSTEMS = new Set(['wall', 'microgreens', 'propagation', 'mushroom']);
export const TECHNOLOGIES = {pad:'Pads + ventilation + heat',dehu:'Pads + condensing dehumidifier',dx:'DX / mini-split + dehumidifier',integrated:'Integrated HVAC + reheat',desiccant:'Desiccant + evaporative cooling',hybridDesiccant:'Liquid-desiccant hybrid (generic)',doas:'Dry-neutral DOAS + DX sensible'};
export const DEFAULT_SCENARIO = {
 schemaVersion:1,id:'baseline',name:'Pad + vent baseline',facility:'greenhouse',system:'bench',crop:'lettuce',technology:'pad',
 areaM2:500,canopyM2:350,heightM:4,envelopeRatio:1.8,uValue:4,thermalMassKJm2K:100,
 infiltrationACH:.3,solarTransmission:.65,parTransmission:.65,shadeFraction:.25,solarHeatFraction:1,
 minVentACH:.3,maxVentACH:40,fanWPerM3s:180,padEnabled:true,padEffectiveness:.8,padPumpW:250,
 heaterKW:120,heaterEfficiency:.9,coolingKW:0,coolingCOP:3,coolingSHR:.75,coolingMinOutdoorC:-5,coolingMaxOutdoorC:46,
 dehuKgH:0,dehuLPerKWh:2.5,integratedHVAC:false,reheatFraction:.5,humidifierKgH:0,
 desiccantKgH:0,regenerationKWhPerKg:1.2,regenerationElectricFraction:0,desiccantHeatFraction:1,hybridEvapEffectiveness:.8,
 lightWm2:80,efficacy:2.5,lightDelivery:.85,dayStart:6,photoperiod:16,dayTargetC:22,nightTargetC:18,tempToleranceC:2,
 vpdMin:.6,vpdMax:1,maxDewPointC:19,dliTarget:14,transpirationLDayM2:1.3*9/7,darkTranspirationFraction:.15,cropSensibleWm2:0,
 controlMode:'staged',transpirationModel:'stanghellini',lai:3,doasM3s:0,doasSupplyDewPointC:8,doasSupplyTempC:21,doasKWhPerKg:.5,
 electricityPrice:.12,fuelPrice:.045,waterPrice:.002,installedCost:15000,maintenanceYear:500,lifeYears:15,discountRate:.06,
 latitude:36.15,longitude:-95.99,timezone:'America/Chicago',zip:'74103',priceMode:'manual',sector:'commercial'
};
const f=(key,label,unit,min,max,step)=>({key,label,unit,min,max,step});
export const FIELDS = [
 {label:'Geometry & envelope',fields:[f('areaM2','Floor area','m²',1,100000,10),f('canopyM2','Active canopy','m²',0,500000,10),f('heightM','Mean height','m',1,30,.1),f('envelopeRatio','Envelope / floor','×',.5,10,.1),f('uValue','Envelope U-value','W/m²K',.05,15,.1),f('thermalMassKJm2K','Effective thermal mass','kJ/m²K',5,2000,5),f('infiltrationACH','Air leakage','ACH',0,20,.1),f('solarTransmission','Thermal solar transmission','fraction',0,1,.05),f('parTransmission','Crop light transmission','fraction',0,1,.05),f('shadeFraction','Shade fraction','fraction',0,1,.05)]},
 {label:'Crop targets & lighting',fields:[f('dayTargetC','Day target','°C',5,40,.5),f('nightTargetC','Night target','°C',5,40,.5),f('tempToleranceC','Temperature tolerance','± °C',.1,10,.5),f('vpdMin','Minimum air VPD','kPa',0,4,.05),f('vpdMax','Maximum air VPD','kPa',.05,5,.05),f('maxDewPointC','Dew-point ceiling','°C',-10,35,.5),f('dayStart','Photoperiod start','local hour',0,23,1),f('photoperiod','Photoperiod','h/day',1,24,1),f('dliTarget','Daily light target','mol/m²/day',0,60,1),f('lightWm2','Installed fixture power','W/m² canopy',0,500,5),f('efficacy','Fixture photon efficacy','µmol/J',.5,5,.1),f('lightDelivery','Canopy light delivery','fraction',.1,1,.05),f('lai','Leaf area index','m²/m² canopy',0,8,.1),f('transpirationLDayM2','Assumed crop evaporation (schedule model)','L/m²/day',0,15,.1),f('darkTranspirationFraction','Dark / lit evaporation rate','fraction',0,1,.05),f('cropSensibleWm2','Respiration / other crop heat','W/m²',0,100,1)]},
 {label:'Airflow & evaporative cooling',fields:[f('minVentACH','Minimum outside air','ACH',0,60,.1),f('maxVentACH','Maximum outside air','ACH',0,120,1),f('fanWPerM3s','Fan specific power','W/(m³/s)',0,2000,10),f('padEffectiveness','Pad effectiveness','fraction',0,.95,.05),f('padPumpW','Pad pump','W',0,20000,50),f('humidifierKgH','Humidifier capacity','kg/h',0,1000,1)]},
 {label:'Heating, cooling & dehumidification',fields:[f('heaterKW','Delivered heater capacity','kW',0,10000,10),f('heaterEfficiency','Heater efficiency','fraction',.1,1,.05),f('coolingKW','Total DX cooling capacity','kW',0,10000,10),f('coolingCOP','Assumed cooling COP','W/W',.5,10,.1),f('coolingSHR','Sensible heat ratio','fraction',.2,1,.05),f('coolingMinOutdoorC','DX minimum outdoor','°C',-50,30,1),f('coolingMaxOutdoorC','DX maximum outdoor','°C',20,65,1),f('dehuKgH','Condensing dehu capacity','kg/h',0,2000,5),f('dehuLPerKWh','Dehu efficiency','L/kWh',.2,10,.1),f('reheatFraction','Recoverable condenser heat','fraction',0,1,.1)]},
 {label:'Desiccant assumptions',fields:[f('desiccantKgH','Desiccant moisture capacity','kg/h',0,2000,5),f('regenerationKWhPerKg','Regeneration energy','kWh/kg water',.1,10,.1),f('regenerationElectricFraction','Electric share of regeneration','fraction',0,1,.1),f('desiccantHeatFraction','Sorption heat returned indoors','fraction',0,1,.1),f('hybridEvapEffectiveness','Hybrid indirect evap effectiveness','fraction',0,.95,.05)]},
 {label:'Dry-neutral DOAS (generic)',fields:[f('doasM3s','DOAS outdoor airflow','m³/s',0,50,.1),f('doasSupplyDewPointC','DOAS supply dew point','°C',-10,25,.5),f('doasSupplyTempC','DOAS supply temperature','°C',5,35,.5),f('doasKWhPerKg','DOAS energy per kg removed','kWh/kg water',.1,5,.1)]},
 {label:'Investment assumptions',fields:[f('electricityPrice','Manual electricity price','$/kWh',0,2,.01),f('fuelPrice','Purchased heating fuel','$/kWh',0,1,.005),f('waterPrice','Water price','$/L',0,.1,.001),f('installedCost','Installed component cost','$',0,10000000,1000),f('maintenanceYear','Annual maintenance','$/year',0,1000000,100),f('lifeYears','Equipment service life','years',1,50,1),f('discountRate','Discount rate','fraction',0,.3,.01)]}
];
export function makeScenario(facility='greenhouse',system='bench',crop='lettuce'){
 const s={...DEFAULT_SCENARIO,...(CROPS[crop]||CROPS.lettuce),id:globalThis.crypto?.randomUUID?.()||`scenario-${Date.now()}`,facility,system,crop};
 delete s.label;delete s.source;
 if(facility==='indoor')Object.assign(s,{solarTransmission:0,parTransmission:0,uValue:.3,maxVentACH:2,padEnabled:false,coolingKW:90,dehuKgH:40,technology:'dx',installedCost:80000,name:'Indoor DX + dehu'});
 if(facility==='hybrid')Object.assign(s,{maxVentACH:15,coolingKW:80,dehuKgH:30,integratedHVAC:true,technology:'integrated',installedCost:90000,name:'Hybrid controlled greenhouse'});
 // Canopy area stays an explicit editable input; no per-system geometry is inferred.
 s.canopyM2=Math.round(s.canopyM2);
 return s;
}
export function applyTechnology(s,technology){
 const base={...s,technology,coolingKW:0,dehuKgH:0,desiccantKgH:0,doasM3s:0,integratedHVAC:false,padEnabled:s.facility!=='indoor',regenerationKWhPerKg:DEFAULT_SCENARIO.regenerationKWhPerKg,regenerationElectricFraction:DEFAULT_SCENARIO.regenerationElectricFraction,desiccantHeatFraction:DEFAULT_SCENARIO.desiccantHeatFraction};
 const scale=s.areaM2/500;
 const specs={pad:{installedCost:15000},dehu:{dehuKgH:40,installedCost:35000},dx:{coolingKW:100,dehuKgH:40,installedCost:85000},integrated:{coolingKW:140,integratedHVAC:true,installedCost:110000},desiccant:{desiccantKgH:60,installedCost:90000},hybridDesiccant:{desiccantKgH:60,regenerationElectricFraction:1,regenerationKWhPerKg:.8,desiccantHeatFraction:.2,installedCost:125000},
  doas:{doasM3s:s.areaM2*s.heightM*2/3600,doasSupplyDewPointC:8,doasSupplyTempC:21,coolingKW:60,installedCost:95000}};
 Object.assign(base,specs[technology]||specs.pad);
 for(const key of ['coolingKW','dehuKgH','desiccantKgH','installedCost'])base[key]*=scale;
 base.name=TECHNOLOGIES[technology]||s.name;
 return base;
}
// Keys added after schemaVersion 1 was first published. Missing ones are back-filled so older saved
// scenarios keep importing; keys that existed in the first schema are never invented.
const V02_KEYS=['controlMode','transpirationModel','lai','doasM3s','doasSupplyDewPointC','doasSupplyTempC','doasKWhPerKg'];
export function backfillScenario(s){
 if(!s||typeof s!=='object')return s;
 const crop=CROPS[s.crop];
 for(const key of V02_KEYS)if(!Object.hasOwn(s,key))s[key]=(key==='lai'||key==='transpirationModel')&&crop&&Object.hasOwn(crop,key)?crop[key]:DEFAULT_SCENARIO[key];
 return s;
}
export function validateScenario(s){
 const errors=[];
 if(!s||s.schemaVersion!==1)return ['Unsupported scenario schema.'];
 backfillScenario(s);
 for(const group of FIELDS)for(const field of group.fields){const value=s[field.key];if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)errors.push(`${field.label}: enter ${field.min}–${field.max} ${field.unit}.`);}
 // Rack and wall formats shipped before 0.2.1. Name them so an older export fails legibly
 // rather than reporting a generic unknown value.
 if(RETIRED_SYSTEMS.has(s.system))errors.push(`Cultivation system "${s.system}" was retired: its canopy-area and tier-interception assumptions were not evidenced. Set the system to greenhouse benches and enter the active canopy area directly.`);
 else if(!Object.hasOwn(SYSTEMS,s.system))errors.push('Unknown cultivation system.');
 if(!Object.hasOwn(FACILITIES,s.facility)||!Object.hasOwn(CROPS,s.crop)||!Object.hasOwn(TECHNOLOGIES,s.technology))errors.push('Unknown facility, crop or technology.');
 if(!Object.hasOwn(CONTROL_MODES,s.controlMode))errors.push('Control mode must be staged or ideal.');
 if(!Object.hasOwn(TRANSPIRATION_MODELS,s.transpirationModel))errors.push('Transpiration model must be stanghellini or schedule.');
 for(const key of ['padEnabled','integratedHVAC'])if(typeof s[key]!=='boolean')errors.push(`${key} must be true or false.`);
 if(!Number.isFinite(s.solarHeatFraction)||s.solarHeatFraction<0||s.solarHeatFraction>1)errors.push('Absorbed solar fraction must be between zero and one.');
 if(!['residential','commercial','industrial'].includes(s.sector))errors.push('Unknown electricity customer sector.');
 if(!['manual','state'].includes(s.priceMode))errors.push('Electricity price mode must be manual or state.');
 if(s.vpdMin>=s.vpdMax)errors.push('Minimum VPD must be below maximum VPD.');
 if(s.minVentACH>s.maxVentACH)errors.push('Minimum airflow exceeds installed maximum.');
 if(s.coolingMinOutdoorC>=s.coolingMaxOutdoorC)errors.push('DX outdoor operating range is inverted.');
 if(s.facility==='indoor'&&(s.parTransmission!==0||s.solarTransmission!==0))errors.push('Opaque indoor template requires zero direct solar/light transmission.');
 if(!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180)errors.push('Invalid location coordinates.');
 try{if(typeof s.timezone!=='string'||!s.timezone.trim())throw new Error();new Intl.DateTimeFormat('en',{timeZone:s.timezone});}catch{errors.push('Invalid IANA time zone.');}
 if(typeof s.name!=='string'||!s.name.trim()||s.name.length>120)errors.push('Scenario name must contain 1 to 120 characters.');
 if(typeof s.id!=='string'||!s.id||s.id.length>120)errors.push('Scenario identifier must contain 1 to 120 characters.');
 return errors;
}
