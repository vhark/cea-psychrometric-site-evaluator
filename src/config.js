import {SHADE_SCREEN_DEFAULT,THERMAL_SCREEN_DEFAULT,HEAT_PUMP_DEFAULTS,HEAT_PUMP_RATING_FIELDS,
  backfillShadeScreen,backfillThermalScreen,shadeScreenErrors,thermalScreenErrors,heatSourceErrors} from './screens.js';
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
// Facility templates. The ladder keys carry envelope values from docs/COMPONENT-PARAMETERS.md, each with the
// source string in FACILITY_TEMPLATES. The three original keys keep the exact numbers they shipped with, so
// every saved scenario and every example file still resolves and still reproduces its published result.
export const FACILITIES = {
 greenhouse:'Vented greenhouse (generic)',
 greenhouseBasic:'Greenhouse, single polyethylene',
 greenhouseDouble:'Greenhouse, double inflated polyethylene',
 greenhousePoly:'Greenhouse, 8 mm twin-wall polycarbonate',
 greenhouseGlass:'Greenhouse, single glass',
 hybrid:'Hybrid greenhouse',
 warehouse:'Warehouse, uninsulated',
 warehouseSip:'Warehouse, EPS SIP',
 indoor:'Indoor farm'
};
// Opaque templates define zero direct crop transmission. That is a scenario definition, not a measured wall
// absorptance: roof and wall solar absorption with inward conduction is not modeled, so outdoor solar loading
// on an opaque envelope is absent from these runs.
export const OPAQUE_FACILITIES = new Set(['indoor','warehouse','warehouseSip']);
const GENERIC_ENVELOPE_SOURCE='Generic screening placeholder retained from 0.1.0 so existing scenarios keep their numbers. Not a sourced envelope; pick a ladder entry for values traceable to docs/COMPONENT-PARAMETERS.md.';
const UNSOURCED_OPTICS='PAR and total-shortwave transmission are UNSOURCED for this glazing, so the tool\'s generic 0.65 screening value is carried as an explicit placeholder. Vendor luminous transmission and SHGC are not substituted for either quantity.';
// envelopeRatio 1.685 is UGA's published single-house worked example, 500.8 m2 envelope over 297.3 m2 floor
// [S2, S4]. It is a stand-alone gable house, not a typical gutter-connected ratio. Warehouse entries instead
// derive the ratio from the template's own dimensions with the flat-roof identity in section 3.4.
export const FACILITY_TEMPLATES = {
 greenhouse:{uValue:4,parTransmission:.65,solarTransmission:.65,infiltrationACH:.3,envelopeRatio:1.8,opticalBasis:'generic screening default, retained',source:GENERIC_ENVELOPE_SOURCE},
 greenhouseBasic:{uValue:6.84,parTransmission:.88,solarTransmission:.88,infiltrationACH:1,envelopeRatio:1.685,opticalBasis:'sourced PAR, shortwave set equal to it',
  source:'U 6.84 W/m2K from UGA overall customary R 0.83 [S2, S4]. PAR 0.88 is the low end of the 0.88 to 0.91 UV-stabilized film range [S13]. Total-shortwave transmission is UNSOURCED and is set equal to the sourced PAR fraction as a declared screening assumption. Single-film ACH is UNSOURCED; 1.0 is the upper end of the new double-film range [S2] used as an explicit proxy.'},
 greenhouseDouble:{uValue:3.97,parTransmission:.77,solarTransmission:.77,infiltrationACH:.5,envelopeRatio:1.685,opticalBasis:'derived two-layer assumption',
  source:'U 3.97 W/m2K from UGA overall customary R 1.43 [S2, S4]. ACH 0.5 is the low end of the 0.5 to 1.0 new double-film range [S2]. Matched-pair optical values are UNSOURCED: 0.77 is two 0.88 UV-stabilized films squared [S13], a declared two-layer assumption and not a measured assembly.'},
 greenhousePoly:{uValue:3.3,parTransmission:.65,solarTransmission:.65,infiltrationACH:.5,envelopeRatio:1.685,opticalBasis:'placeholder',
  source:`U 3.3 W/m2K for clear 8 mm twin-wall polycarbonate, Palram SUNLITE vendor data with no stated tolerance [S14]. ${UNSOURCED_OPTICS} Polycarbonate-specific ACH is UNSOURCED; 0.5 is transferred from the new double-film range [S2].`},
 greenhouseGlass:{uValue:6.24,parTransmission:.65,solarTransmission:.65,infiltrationACH:.75,envelopeRatio:1.685,opticalBasis:'placeholder',
  source:`U 6.24 W/m2K from UGA single-glass overall customary R 0.91 [S2, S4], a generic assembly rather than a rated product. ACH 0.75 is the low end of the 0.75 to 1.0 new glass construction range [S2]. ${UNSOURCED_OPTICS}`},
 warehouse:{uValue:4.54,parTransmission:0,solarTransmission:0,infiltrationACH:1.7,maxVentACH:2,envelopeFromGeometry:true,opticalBasis:'opaque by definition',
  source:'Whole metal-envelope U is UNSOURCED: 4.54 W/m2K is UGA\'s 152.4 mm poured concrete wall, customary R 1.25, used as an explicit uninsulated tilt-up proxy [S2, S4] and not a whole-building value. ACH 1.7 is NYSERDA\'s leakiest no-air-barrier small commercial example converted with its own N-factor of 18 [S18], adjacent-building evidence rather than a warehouse class value.'},
 warehouseSip:{uValue:.27,parTransmission:0,solarTransmission:0,infiltrationACH:.4,maxVentACH:2,envelopeFromGeometry:true,opticalBasis:'opaque by definition',
  source:'Panel U 0.270 W/m2K from the SIPA nominal 165.1 mm EPS panel at customary R 21, R 3.70 m2K/W [S19, S4]. That is an industry-association calculated panel rating: connections, doors, roof, framing, penetrations and slab can worsen the assembly. Installed warehouse natural infiltration is UNSOURCED; 0.4 is NYSERDA\'s median converted natural rate for 26 mostly small commercial buildings [S18].'},
 hybrid:{uValue:4,parTransmission:.65,solarTransmission:.65,infiltrationACH:.3,envelopeRatio:1.8,opticalBasis:'generic screening default, retained',source:GENERIC_ENVELOPE_SOURCE},
 indoor:{uValue:.3,parTransmission:0,solarTransmission:0,infiltrationACH:.3,envelopeRatio:1.8,maxVentACH:2,opticalBasis:'opaque by definition',source:GENERIC_ENVELOPE_SOURCE}
};
const ENVELOPE_KEYS=['uValue','parTransmission','solarTransmission','infiltrationACH','envelopeRatio','maxVentACH'];
// Cultivation systems propose a default canopy area from the floor area. Racks stack trays, so their
// canopy exceeds the footprint; the factors are stated in makeScenario and every value stays editable.
// Harvest walls are not offered: their canopy-per-floor factor came from one proprietary fixture layout
// rather than a generic format, so it would be a guess here.
export const SYSTEMS = {bench:'Greenhouse benches',microgreens:'Microgreen racks',propagation:'Propagation racks',mushroom:'Mushroom racks'};
const RETIRED_SYSTEMS = new Set(['wall']);
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
 // Screens are not installed and heating is fuel-fired by default, so a scenario that omits every key added
 // after schemaVersion 1 reproduces the earlier numbers exactly. The two nested objects are frozen: every
 // consumer clones them through backfillScenario rather than sharing one mutable default.
 ...HEAT_PUMP_DEFAULTS,shadeScreen:SHADE_SCREEN_DEFAULT,thermalScreen:THERMAL_SCREEN_DEFAULT,
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
 s.shadeScreen={...SHADE_SCREEN_DEFAULT};s.thermalScreen={...THERMAL_SCREEN_DEFAULT};
 const envelope=FACILITY_TEMPLATES[facility];
 if(envelope){
  for(const key of ENVELOPE_KEYS)if(envelope[key]!==undefined)s[key]=envelope[key];
  // Flat-roof rectangular identity from section 3.4 on the template's own square footprint. A universal
  // typical envelope-to-floor ratio is UNSOURCED, so the geometry is computed rather than guessed.
  if(envelope.envelopeFromGeometry)s.envelopeRatio=Math.round((1+4*s.heightM/Math.sqrt(s.areaM2))*1000)/1000;
 }
 if(OPAQUE_FACILITIES.has(facility))Object.assign(s,{padEnabled:false,coolingKW:90,dehuKgH:40,technology:'dx',installedCost:80000,name:`${FACILITIES[facility]} DX + dehu`});
 if(facility==='hybrid')Object.assign(s,{maxVentACH:15,coolingKW:80,dehuKgH:30,integratedHVAC:true,technology:'integrated',installedCost:90000,name:'Hybrid controlled greenhouse'});
 // Rack canopy from floor area: a 0.35 m² tray on a 0.7432 m² floor module, 2.4 tiers of usable height.
 // Mushroom rooms are dark, respiration-heated and ventilation-driven, so they also move the light,
 // sensible-gain, airflow and humidification defaults. Every one of these remains an editable input.
 if(system==='microgreens'||system==='propagation')s.canopyM2=s.areaM2*.35/.7432*2.4;
 if(system==='mushroom')Object.assign(s,{canopyM2:s.areaM2*.35/.7432*2.4,lightWm2:8,cropSensibleWm2:20,minVentACH:6,maxVentACH:15,humidifierKgH:20});
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
// 0.3 component keys. Their defaults are inert: fuel heating and two uninstalled screens, so a scenario
// written before they existed simulates exactly as it did. The nested screens are always rebuilt as fresh
// objects, both to fill partially declared screens and to keep the frozen defaults unshared.
const V03_KEYS=['heatSource',...HEAT_PUMP_RATING_FIELDS,'heatPumpCutoffC','heatPumpCapacityDerate'];
export function backfillScenario(s){
 if(!s||typeof s!=='object')return s;
 const crop=CROPS[s.crop];
 for(const key of V02_KEYS)if(!Object.hasOwn(s,key))s[key]=(key==='lai'||key==='transpirationModel')&&crop&&Object.hasOwn(crop,key)?crop[key]:DEFAULT_SCENARIO[key];
 for(const key of V03_KEYS)if(!Object.hasOwn(s,key))s[key]=DEFAULT_SCENARIO[key];
 s.shadeScreen=backfillShadeScreen(s.shadeScreen);
 s.thermalScreen=backfillThermalScreen(s.thermalScreen);
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
 if(OPAQUE_FACILITIES.has(s.facility)&&(s.parTransmission!==0||s.solarTransmission!==0))errors.push(`The ${FACILITIES[s.facility]} template is opaque by definition: direct solar and light transmission must be zero.`);
 errors.push(...heatSourceErrors(s),...shadeScreenErrors(s.shadeScreen),...thermalScreenErrors(s.thermalScreen));
 if(!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180)errors.push('Invalid location coordinates.');
 try{if(typeof s.timezone!=='string'||!s.timezone.trim())throw new Error();new Intl.DateTimeFormat('en',{timeZone:s.timezone});}catch{errors.push('Invalid IANA time zone.');}
 if(typeof s.name!=='string'||!s.name.trim()||s.name.length>120)errors.push('Scenario name must contain 1 to 120 characters.');
 if(typeof s.id!=='string'||!s.id||s.id.length>120)errors.push('Scenario identifier must contain 1 to 120 characters.');
 return errors;
}
