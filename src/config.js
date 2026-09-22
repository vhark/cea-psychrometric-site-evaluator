import {SHADE_SCREEN_DEFAULT,THERMAL_SCREEN_DEFAULT,INSECT_SCREEN_DEFAULT,HEAT_PUMP_DEFAULTS,HEAT_PUMP_RATING_FIELDS,
  backfillShadeScreen,backfillThermalScreen,backfillInsectScreen,shadeScreenErrors,thermalScreenErrors,
  insectScreenErrors,heatSourceErrors} from './screens.js';
import {HEAT_RECOVERY_DEFAULT,backfillHeatRecovery,heatRecoveryErrors} from './airflow.js';
export const MODEL_VERSION = '0.4.0-screening';
export const SCENARIO_SCHEMA_VERSION = 2;
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
// Fixture presets: named wattage over a declared footprint. Efficacy values are editable screening assumptions,
// not product ratings; the select derives from the scenario's own lightWm2 and efficacy, so nothing here is schema.
export const FT2_PER_M2 = 10.7639104;
export const LIGHT_FIXTURES = {
  custom: {label:'Custom fixture power'},
  led650: {label:'High light · LED 650 W over 16 ft² (40.6 W/ft²)',wattsW:650,coverageFt2:16,efficacy:2.7,
    source:'User-declared fixture class: a 650 W LED over a 4 × 4 ft footprint, the common 1000 W HPS replacement pairing. Photon efficacy 2.7 µmol/J is a screening assumption; replace it with the fixture\u2019s published PPF and input watts.'},
  hps1000: {label:'High light · HPS 1000 W over 16 ft² (62.5 W/ft²)',wattsW:1000,coverageFt2:16,efficacy:1.9,
    source:'User-declared fixture class: a 1000 W double-ended HPS over a 4 × 4 ft footprint. Photon efficacy 1.9 µmol/J is a screening assumption; replace it with the fixture\u2019s published PPF and input watts.'}
};
export const fixtureWm2 = key => {const fixture = LIGHT_FIXTURES[key]; return fixture && fixture.wattsW ? fixture.wattsW / fixture.coverageFt2 * FT2_PER_M2 : null;};
export const TRANSPIRATION_MODELS = {stanghellini:'Stanghellini (Vanthoor 2011 §8.9), state-coupled',schedule:'Declared L/m²/day schedule'};
export const AIRFLOW_BASIS = Object.freeze({
 literatureRange:'Literature range',
 adjacentProxy:'Adjacent-evidence proxy',
 projectInput:'Project-specific input',
 screeningAssumption:'Screening assumption'
});
export const AIRFLOW_EVIDENCE = Object.freeze({
 infiltration:Object.freeze({
  basis:'literatureRange',
  source:'UGA Extension Bulletin 792 greenhouse construction infiltration ranges',
  sourceUrl:'https://fieldreport.caes.uga.edu/publications/B792/greenhouses-heating-ventilation-and-cooling/',
  constructionACH:Object.freeze({glass:Object.freeze([.75,1]),doublePolyethylene:Object.freeze([.5,1])})
 }),
 controlled:Object.freeze({
  basis:'literatureRange',
  source:'Shamshiri et al. greenhouse floor-normalized controlled-air ranges',
  sourceUrl:'https://doi.org/10.25165/j.ijabe.20181101.3210',
  floorNormalizedM3sPerM2:Object.freeze({glass:Object.freeze([.04,.05]),polyethylene:Object.freeze([.03,.04])}),
  warmWeatherOperatingContextACH:60,
  fanAndPadOperatingContextACH:Object.freeze([60,90]),
  applicability:'Floor-normalized glass and polyethylene ranges convert to ACH through scenario mean height. The 60 ACH warm-weather guidance and 60 to 90 ACH fan-and-pad range are operating context, not universal validation limits.'
 }),
 closedRoom:Object.freeze({
  basis:'adjacentProxy',
  source:'Single closed-room measurement, adjacent proxy only',
  sourceUrl:'https://doi.org/10.1016/j.buildenv.2021.107766',
  measuredACH:.18,
  applicability:'One measured room does not establish a universal opaque-facility infiltration or controlled-air value.'
 }),
 unsupported:Object.freeze({
  basis:'screeningAssumption',
  applicability:'Generic greenhouse, hybrid, opaque-facility, and polycarbonate controlled-air values are screening assumptions where no direct default was established.'
 }),
 mushroom:Object.freeze({
  source:'Chen et al. mushroom-factory indoor-environment review',
  sourceUrl:'https://doi.org/10.25165/j.ijabe.20221501.6872',
  basis:'projectInput',
  applicability:'Species, growth stage, substrate loading, CO2 target, equipment, and internal circulation determine project airflow. The reference does not support a universal controlled-air default.'
 })
});
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
 greenhouse:{uValue:4,parTransmission:.65,solarTransmission:.65,infiltrationACH:.3,envelopeRatio:1.8,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'generic screening default, retained',source:GENERIC_ENVELOPE_SOURCE},
 greenhouseBasic:{uValue:6.84,parTransmission:.88,solarTransmission:.88,infiltrationACH:1,envelopeRatio:1.685,outsideAirBasis:'literatureRange',outsideAirReviewed:true,controlledAirContext:'polyethylene',opticalBasis:'sourced PAR, shortwave set equal to it',
  source:'U 6.84 W/m2K from UGA overall customary R 0.83 [S2, S4]. PAR 0.88 is the low end of the 0.88 to 0.91 UV-stabilized film range [S13]. Total-shortwave transmission is UNSOURCED and is set equal to the sourced PAR fraction as a declared screening assumption. Single-film ACH is UNSOURCED; 1.0 is the upper end of the new double-film range [S2] used as an explicit proxy.'},
 greenhouseDouble:{uValue:3.97,parTransmission:.77,solarTransmission:.77,infiltrationACH:.5,envelopeRatio:1.685,outsideAirBasis:'literatureRange',outsideAirReviewed:true,infiltrationContext:'doublePolyethylene',controlledAirContext:'polyethylene',opticalBasis:'derived two-layer assumption',
  source:'U 3.97 W/m2K from UGA overall customary R 1.43 [S2, S4]. ACH 0.5 is the low end of the 0.5 to 1.0 new double-film range [S2]. Matched-pair optical values are UNSOURCED: 0.77 is two 0.88 UV-stabilized films squared [S13], a declared two-layer assumption and not a measured assembly.'},
 greenhousePoly:{uValue:3.3,parTransmission:.65,solarTransmission:.65,infiltrationACH:.5,envelopeRatio:1.685,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'placeholder',
  source:`U 3.3 W/m2K for clear 8 mm twin-wall polycarbonate, Palram SUNLITE vendor data with no stated tolerance [S14]. ${UNSOURCED_OPTICS} Polycarbonate-specific ACH is UNSOURCED; 0.5 is transferred from the new double-film range [S2].`},
 greenhouseGlass:{uValue:6.24,parTransmission:.65,solarTransmission:.65,infiltrationACH:.75,envelopeRatio:1.685,outsideAirBasis:'literatureRange',outsideAirReviewed:true,infiltrationContext:'glass',controlledAirContext:'glass',opticalBasis:'placeholder',
  source:`U 6.24 W/m2K from UGA single-glass overall customary R 0.91 [S2, S4], a generic assembly rather than a rated product. ACH 0.75 is the low end of the 0.75 to 1.0 new glass construction range [S2]. ${UNSOURCED_OPTICS}`},
 warehouse:{uValue:4.54,parTransmission:0,solarTransmission:0,infiltrationACH:1.7,maxVentACH:2,envelopeFromGeometry:true,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'opaque by definition',
  source:'Whole metal-envelope U is UNSOURCED: 4.54 W/m2K is UGA\'s 152.4 mm poured concrete wall, customary R 1.25, used as an explicit uninsulated tilt-up proxy [S2, S4] and not a whole-building value. ACH 1.7 is NYSERDA\'s leakiest no-air-barrier small commercial example converted with its own N-factor of 18 [S18], adjacent-building evidence rather than a warehouse class value. The 2 ACH maximum is controlled outdoor-air capacity, not leakage.'},
 warehouseSip:{uValue:.27,parTransmission:0,solarTransmission:0,infiltrationACH:.4,maxVentACH:2,envelopeFromGeometry:true,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'opaque by definition',
  source:'Panel U 0.270 W/m2K from the SIPA nominal 165.1 mm EPS panel at customary R 21, R 3.70 m2K/W [S19, S4]. That is an industry-association calculated panel rating: connections, doors, roof, framing, penetrations and slab can worsen the assembly. Installed warehouse uncontrolled infiltration is UNSOURCED; 0.4 is NYSERDA\'s median converted natural rate for 26 mostly small commercial buildings [S18]. The 2 ACH maximum is controlled outdoor-air capacity, not leakage.'},
 hybrid:{uValue:4,parTransmission:.65,solarTransmission:.65,infiltrationACH:.3,envelopeRatio:1.8,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'generic screening default, retained',source:`${GENERIC_ENVELOPE_SOURCE} The 15 ACH maximum is a constrained semi-closed screening assumption requiring project review.`},
 indoor:{uValue:.3,parTransmission:0,solarTransmission:0,infiltrationACH:.3,envelopeRatio:1.8,maxVentACH:2,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,opticalBasis:'opaque by definition',source:`${GENERIC_ENVELOPE_SOURCE} The 2 ACH maximum is controlled outdoor-air capacity, not leakage.`}
};
const ENVELOPE_KEYS=['uValue','parTransmission','solarTransmission','infiltrationACH','envelopeRatio','maxVentACH','outsideAirBasis','outsideAirReviewed'];
// Cultivation systems propose a default canopy area from the floor area. Racks stack trays, so their
// canopy exceeds the footprint; the factors are stated in makeScenario and every value stays editable.
// Harvest walls are not offered: their canopy-per-floor factor came from one proprietary fixture layout
// rather than a generic format, so it would be a guess here.
export const SYSTEMS = {bench:'Greenhouse benches',microgreens:'Microgreen racks',propagation:'Propagation racks',mushroom:'Mushroom racks'};
const RETIRED_SYSTEMS = new Set(['wall']);
export const TECHNOLOGIES = {pad:'Pads + ventilation + heat',dehu:'Pads + condensing dehumidifier',dx:'DX / mini-split + dehumidifier',integrated:'Integrated HVAC + reheat',desiccant:'Desiccant + evaporative cooling',hybridDesiccant:'Liquid-desiccant hybrid (generic)',doas:'DOAS conditioning + DX sensible'};
export const DEFAULT_SCENARIO = {
 schemaVersion:SCENARIO_SCHEMA_VERSION,id:'baseline',name:'Pad + vent baseline',facility:'greenhouse',system:'bench',crop:'lettuce',technology:'pad',
 areaM2:500,canopyM2:350,heightM:4,envelopeRatio:1.8,uValue:4,thermalMassKJm2K:100,
 infiltrationACH:.3,solarTransmission:.65,parTransmission:.65,shadeFraction:.25,solarHeatFraction:1,
 minVentACH:.3,maxVentACH:40,fanWPerM3s:180,outsideAirBasis:'literatureRange',outsideAirReviewed:true,padEnabled:true,padEffectiveness:.8,padPumpW:250,
 heaterKW:120,heaterEfficiency:.9,coolingKW:0,coolingCOP:3,coolingSHR:.75,coolingMinOutdoorC:-5,coolingMaxOutdoorC:46,
 dehuKgH:0,dehuLPerKWh:2.5,dehuHeatFraction:1,integratedHVAC:false,reheatFraction:.5,humidifierKgH:0,
 desiccantKgH:0,regenerationKWhPerKg:1.2,regenerationElectricFraction:0,desiccantHeatFraction:1,hybridEvapEffectiveness:.8,
 lightWm2:80,efficacy:2.5,lightDelivery:.85,dayStart:6,photoperiod:16,dayTargetC:22,nightTargetC:18,tempToleranceC:2,
 vpdMin:.6,vpdMax:1,maxDewPointC:19,dliTarget:14,transpirationLDayM2:1.3*9/7,darkTranspirationFraction:.15,cropSensibleWm2:0,
 controlMode:'staged',transpirationModel:'stanghellini',lai:3,heatRecovery:HEAT_RECOVERY_DEFAULT,
 doasM3s:0,doasSupplyDewPointC:null,doasSupplyTempC:null,doasCoolingCOP:null,doasReheatRecoveryFraction:null,
 electricityPrice:.12,fuelPrice:.045,fuelCo2KgPerKWh:.181,waterPrice:.002,installedCost:15000,installedCostBasis:'screeningAssumption',maintenanceYear:500,lifeYears:15,discountRate:.06,
 // Inert component defaults are frozen. Scenario creation and migration clone every nested component so
 // editing one scenario cannot mutate the defaults or another scenario.
 ...HEAT_PUMP_DEFAULTS,shadeScreen:SHADE_SCREEN_DEFAULT,thermalScreen:THERMAL_SCREEN_DEFAULT,insectScreen:INSECT_SCREEN_DEFAULT,
 // No default site. A scenario is located by the user: ZIP and Locate, or direct coordinates.
 // Shipping a city here made every new scenario silently claim that city's clock and climate.
 latitude:null,longitude:null,timezone:null,zip:null,priceMode:'manual',sector:'commercial'
};
const f=(key,label,unit,min,max,step)=>({key,label,unit,min,max,step});
export const FIELDS = [
 {label:'Geometry & envelope',fields:[f('areaM2','Floor area','m²',1,100000,10),f('canopyM2','Active canopy','m²',0,500000,10),f('heightM','Mean height','m',1,30,.1),f('envelopeRatio','Envelope / floor','×',.5,10,.1),f('uValue','Envelope U-value','W/m²K',.05,15,.1),f('thermalMassKJm2K','Effective thermal mass','kJ/m²K',5,2000,5),f('infiltrationACH','Uncontrolled infiltration','ACH',0,20,.1),f('solarTransmission','Thermal solar transmission','fraction',0,1,.05),f('parTransmission','Crop light transmission','fraction',0,1,.05),f('shadeFraction','Shade fraction','fraction',0,1,.05)]},
 {label:'Crop targets & lighting',fields:[f('dayTargetC','Day target','°C',5,40,.5),f('nightTargetC','Night target','°C',5,40,.5),f('tempToleranceC','Temperature tolerance','± °C',.1,10,.5),f('vpdMin','Minimum air VPD','kPa',0,4,.05),f('vpdMax','Maximum air VPD','kPa',.05,5,.05),f('maxDewPointC','Dew-point ceiling','°C',-10,35,.5),f('dayStart','Photoperiod start','local hour',0,23,1),f('photoperiod','Photoperiod','h/day',1,24,1),f('dliTarget','Daily light target','mol/m²/day',0,60,1),f('lightWm2','Installed fixture power','W/m² canopy',0,1000,5),f('efficacy','Fixture photon efficacy','µmol/J',.5,5,.1),f('lightDelivery','Canopy light delivery','fraction',.1,1,.05),f('lai','Leaf area index','m²/m² canopy',0,8,.1),f('transpirationLDayM2','Assumed crop evaporation (schedule model)','L/m²/day',0,15,.1),f('darkTranspirationFraction','Dark / lit evaporation rate','fraction',0,1,.05),f('cropSensibleWm2','Respiration / other crop heat','W/m²',0,100,1)]},
 {label:'Airflow & evaporative cooling',fields:[f('minVentACH','Minimum controlled outdoor air','ACH',0,60,.1),f('maxVentACH','Maximum controlled outdoor-air capacity','ACH',0,120,1),f('fanWPerM3s','Fan specific power','W/(m³/s)',0,2000,10),f('padEffectiveness','Pad effectiveness','fraction',0,.95,.05),f('padPumpW','Pad pump','W',0,20000,50),f('humidifierKgH','Humidifier capacity','kg/h',0,1000,1)]},
 {label:'Heating, cooling & dehumidification',fields:[f('heaterKW','Delivered heater capacity','kW',0,10000,10),f('heaterEfficiency','Heater efficiency','fraction',.1,1,.05),f('coolingKW','Total DX cooling capacity','kW',0,10000,10),f('coolingCOP','Assumed cooling COP','W/W',.5,10,.1),f('coolingSHR','Sensible heat ratio','fraction',.2,1,.05),f('coolingMinOutdoorC','DX minimum outdoor','°C',-50,30,1),f('coolingMaxOutdoorC','DX maximum outdoor','°C',20,65,1),f('dehuKgH','Condensing dehu capacity','kg/h',0,2000,5),f('dehuLPerKWh','Dehu efficiency','L/kWh',.2,10,.1),f('dehuHeatFraction','Dehu heat returned to the zone','fraction',0,1,.1),f('reheatFraction','Recoverable condenser heat','fraction',0,1,.1)]},
 {label:'Desiccant assumptions',fields:[f('desiccantKgH','Desiccant moisture capacity','kg/h',0,2000,5),f('regenerationKWhPerKg','Regeneration energy','kWh/kg water',.1,10,.1),f('regenerationElectricFraction','Electric share of regeneration','fraction',0,1,.1),f('desiccantHeatFraction','Sorption heat returned indoors','fraction',0,1,.1),f('hybridEvapEffectiveness','Hybrid indirect evap effectiveness','fraction',0,.95,.05)]},
 {label:'DOAS conditioning (generic)',fields:[f('doasM3s','DOAS treatment capacity','m³/s',0,50,.1),f('doasSupplyDewPointC','DOAS supply dew point','°C',-10,25,.5),f('doasSupplyTempC','DOAS supply temperature','°C',5,35,.5),f('doasCoolingCOP','DOAS cooling COP','W/W',.5,10,.1),f('doasReheatRecoveryFraction','DOAS reheat recovery','fraction',0,1,.05)]},
 {label:'Investment assumptions',fields:[f('electricityPrice','Manual electricity price','$/kWh',0,2,.01),f('fuelPrice','Purchased heating fuel','$/kWh',0,1,.005),f('fuelCo2KgPerKWh','Fuel combustion CO2 factor','kg CO2/kWh fuel',0,1,.001),f('waterPrice','Water price','$/L',0,.1,.001),f('installedCost','Installed component cost','$',0,10000000,1000),f('maintenanceYear','Annual maintenance','$/year',0,1000000,100),f('lifeYears','Equipment service life','years',1,50,1),f('discountRate','Discount rate','fraction',0,.3,.01)]}
];
export function makeScenario(facility='greenhouse',system='bench',crop='lettuce'){
 const s={...DEFAULT_SCENARIO,...(CROPS[crop]||CROPS.lettuce),id:globalThis.crypto?.randomUUID?.()||`scenario-${Date.now()}`,facility,system,crop};
 delete s.label;delete s.source;
 s.shadeScreen={...SHADE_SCREEN_DEFAULT};s.thermalScreen={...THERMAL_SCREEN_DEFAULT};s.insectScreen={...INSECT_SCREEN_DEFAULT};
 s.heatRecovery={...HEAT_RECOVERY_DEFAULT};
 const envelope=FACILITY_TEMPLATES[facility];
 if(envelope){
  for(const key of ENVELOPE_KEYS)if(envelope[key]!==undefined)s[key]=envelope[key];
  // Flat-roof rectangular identity from section 3.4 on the template's own square footprint. A universal
  // typical envelope-to-floor ratio is UNSOURCED, so the geometry is computed rather than guessed.
  if(envelope.envelopeFromGeometry)s.envelopeRatio=Math.round((1+4*s.heightM/Math.sqrt(s.areaM2))*1000)/1000;
 }
 if(OPAQUE_FACILITIES.has(facility))Object.assign(s,{padEnabled:false,coolingKW:90,dehuKgH:40,technology:'dx',installedCost:80000,name:`${FACILITIES[facility]} DX + dehu`});
 if(facility==='hybrid')Object.assign(s,{maxVentACH:15,outsideAirBasis:'screeningAssumption',outsideAirReviewed:false,coolingKW:80,dehuKgH:30,integratedHVAC:true,technology:'integrated',installedCost:90000,name:'Hybrid controlled greenhouse'});
 // Rack canopy from floor area: a 0.35 m² tray on a 0.7432 m² floor module, 2.4 tiers of usable height.
 // Mushroom rooms need project-controlled air based on species, stage, loading, CO2 target, and equipment.
 if(system==='microgreens'||system==='propagation')s.canopyM2=s.areaM2*.35/.7432*2.4;
 if(system==='mushroom')Object.assign(s,{canopyM2:s.areaM2*.35/.7432*2.4,lightWm2:8,cropSensibleWm2:20,minVentACH:null,maxVentACH:null,outsideAirBasis:'projectInput',outsideAirReviewed:false,humidifierKgH:20});
 s.canopyM2=Math.round(s.canopyM2);
 return s;
}
export function applyTechnology(s,technology){
 const base={...s,technology,coolingKW:0,dehuKgH:0,desiccantKgH:0,doasM3s:0,doasSupplyDewPointC:null,doasSupplyTempC:null,doasCoolingCOP:null,doasReheatRecoveryFraction:null,integratedHVAC:false,padEnabled:s.facility!=='indoor',regenerationKWhPerKg:DEFAULT_SCENARIO.regenerationKWhPerKg,regenerationElectricFraction:DEFAULT_SCENARIO.regenerationElectricFraction,desiccantHeatFraction:DEFAULT_SCENARIO.desiccantHeatFraction};
 delete base.doasKWhPerKg;
 const scale=s.areaM2/500;
 const specs={pad:{installedCost:15000},dehu:{dehuKgH:40,installedCost:35000},dx:{coolingKW:100,dehuKgH:40,installedCost:85000},integrated:{coolingKW:140,integratedHVAC:true,installedCost:110000},desiccant:{desiccantKgH:60,installedCost:90000},hybridDesiccant:{desiccantKgH:60,regenerationElectricFraction:1,regenerationKWhPerKg:.8,desiccantHeatFraction:.2,installedCost:125000},
  doas:{outsideAirReviewed:false,coolingKW:60,installedCost:95000}};
 Object.assign(base,specs[technology]||specs.pad);
 for(const key of ['coolingKW','dehuKgH','desiccantKgH','installedCost'])base[key]*=scale;
 base.installedCostBasis='screeningAssumption';
 base.name=TECHNOLOGIES[technology]||s.name;
 return base;
}
// Published schema migration is explicit. Required treatment performance remains null until declared.
const LEGACY_INERT_KEYS=['controlMode','transpirationModel','lai'];
const COMPONENT_INERT_KEYS=['heatSource',...HEAT_PUMP_RATING_FIELDS,'heatPumpCutoffC','heatPumpCapacityDerate','dehuHeatFraction','fuelCo2KgPerKWh'];
const DOAS_FIELDS=new Set(['doasSupplyDewPointC','doasSupplyTempC','doasCoolingCOP','doasReheatRecoveryFraction']);
export function migrateScenario(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||![1,SCENARIO_SCHEMA_VERSION].includes(input.schemaVersion))
  throw new Error(`Unsupported scenario schema. Expected schemaVersion 1 or ${SCENARIO_SCHEMA_VERSION}.`);
 const sourceVersion=input.schemaVersion;
 const s={...input,schemaVersion:SCENARIO_SCHEMA_VERSION};
 const crop=CROPS[s.crop];
 for(const key of LEGACY_INERT_KEYS)if(!Object.hasOwn(s,key))
  s[key]=(key==='lai'||key==='transpirationModel')&&crop&&Object.hasOwn(crop,key)?crop[key]:DEFAULT_SCENARIO[key];
 for(const key of COMPONENT_INERT_KEYS)if(!Object.hasOwn(s,key))s[key]=DEFAULT_SCENARIO[key];
 if(!Object.hasOwn(s,'doasM3s'))s.doasM3s=0;
 if(sourceVersion===1){
  s.doasSupplyDewPointC=null;
  s.doasSupplyTempC=null;
  s.doasCoolingCOP=null;
  s.doasReheatRecoveryFraction=null;
 }else{
  for(const key of ['doasSupplyDewPointC','doasSupplyTempC','doasCoolingCOP','doasReheatRecoveryFraction'])
   if(!Object.hasOwn(s,key))s[key]=null;
 }
 const template=FACILITY_TEMPLATES[s.facility];
 if(sourceVersion===1||!Object.hasOwn(s,'outsideAirBasis'))s.outsideAirBasis=template?.outsideAirBasis??'screeningAssumption';
 if(s.system==='mushroom')s.outsideAirBasis='projectInput';
 const explicitReview=s.system==='mushroom'||s.technology==='doas'||s.doasM3s>0||s.outsideAirBasis!=='literatureRange';
 if(sourceVersion===1){
  s.outsideAirReviewed=template?.outsideAirReviewed??false;
  if(s.technology==='doas'||s.doasM3s>0||s.system==='mushroom')s.outsideAirReviewed=false;
 }else if(!Object.hasOwn(s,'outsideAirReviewed')){
  s.outsideAirReviewed=!explicitReview&&template?.outsideAirBasis==='literatureRange'&&template.outsideAirReviewed===true;
 }
 if(!Object.hasOwn(s,'installedCostBasis'))s.installedCostBasis='screeningAssumption';
 if(sourceVersion===1||!Object.hasOwn(s,'heatRecovery'))s.heatRecovery=backfillHeatRecovery(HEAT_RECOVERY_DEFAULT);
 else if(s.heatRecovery&&typeof s.heatRecovery==='object'&&!Array.isArray(s.heatRecovery))s.heatRecovery=backfillHeatRecovery(s.heatRecovery);
 s.shadeScreen=backfillShadeScreen(s.shadeScreen);
 s.thermalScreen=backfillThermalScreen(s.thermalScreen);
 s.insectScreen=backfillInsectScreen(s.insectScreen);
 delete s.doasKWhPerKg;
 return s;
}
const valueText=value=>Number(value.toFixed(2)).toString();
export function airflowEvidenceWarnings(input){
 let s;
 try{s=migrateScenario(input);}catch{return [];}
 const warnings=[];
 const template=FACILITY_TEMPLATES[s.facility];
 const infiltrationRange=AIRFLOW_EVIDENCE.infiltration.constructionACH[template?.infiltrationContext];
 if(infiltrationRange&&Number.isFinite(s.infiltrationACH)&&(s.infiltrationACH<infiltrationRange[0]||s.infiltrationACH>infiltrationRange[1])){
  const nearest=s.infiltrationACH<infiltrationRange[0]?infiltrationRange[0]:infiltrationRange[1];
  const direction=s.infiltrationACH<infiltrationRange[0]?'below':'above';
  warnings.push(`UGA Extension Bulletin 792 reports ${template.infiltrationContext==='glass'?'new glass or fiberglass':'new double-layer polyethylene'} greenhouse uncontrolled infiltration of ${infiltrationRange[0]} to ${infiltrationRange[1]} ACH. The scenario value of ${valueText(s.infiltrationACH)} ACH is ${valueText(Math.abs(s.infiltrationACH-nearest))} ACH ${direction} that construction context.`);
 }
 const controlledRange=AIRFLOW_EVIDENCE.controlled.floorNormalizedM3sPerM2[template?.controlledAirContext];
 if(controlledRange&&Number.isFinite(s.heightM)&&s.heightM>0&&Number.isFinite(s.maxVentACH)){
  const converted=controlledRange.map(flow=>flow*3600/s.heightM);
  if(s.maxVentACH<converted[0]||s.maxVentACH>converted[1]){
   const nearest=s.maxVentACH<converted[0]?converted[0]:converted[1];
   const direction=s.maxVentACH<converted[0]?'below':'above';
   warnings.push(`Shamshiri et al. report ${template.controlledAirContext} greenhouse controlled air of ${controlledRange[0]} to ${controlledRange[1]} m3/s per m2. At ${valueText(s.heightM)} m mean height, geometry conversion gives ${valueText(converted[0])} to ${valueText(converted[1])} ACH. The scenario maximum of ${valueText(s.maxVentACH)} ACH is ${valueText(Math.abs(s.maxVentACH-nearest))} ACH ${direction} that source context. UGA 60 ACH warm-weather guidance and Shamshiri 60 to 90 ACH fan-and-pad guidance are operating context, not universal validation limits.`);
  }
 }
 return warnings;
}
export function validateScenario(input){
 const errors=[];
 let s;
 try{s=migrateScenario(input);}catch(error){return [error.message];}
 for(const group of FIELDS)for(const field of group.fields){
  const value=s[field.key];
  if(value===null&&(DOAS_FIELDS.has(field.key)||(s.system==='mushroom'&&(field.key==='minVentACH'||field.key==='maxVentACH'))))continue;
  if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)errors.push(`${field.label}: enter ${field.min}–${field.max} ${field.unit}.`);
 }
 // Rack and wall formats shipped before 0.2.1. Name them so an older export fails legibly
 // rather than reporting a generic unknown value.
 if(RETIRED_SYSTEMS.has(s.system))errors.push(`Cultivation system "${s.system}" was retired: its canopy-area and tier-interception assumptions were not evidenced. Set the system to greenhouse benches and enter the active canopy area directly.`);
 else if(!Object.hasOwn(SYSTEMS,s.system))errors.push('Unknown cultivation system.');
 if(!Object.hasOwn(FACILITIES,s.facility)||!Object.hasOwn(CROPS,s.crop)||!Object.hasOwn(TECHNOLOGIES,s.technology))errors.push('Unknown facility, crop or technology.');
 if(!Object.hasOwn(CONTROL_MODES,s.controlMode))errors.push('Control mode must be staged or ideal.');
 if(!Object.hasOwn(TRANSPIRATION_MODELS,s.transpirationModel))errors.push('Transpiration model must be stanghellini or schedule.');
 for(const key of ['padEnabled','integratedHVAC'])if(typeof s[key]!=='boolean')errors.push(`${key} must be true or false.`);
 if(!Number.isFinite(s.solarHeatFraction)||s.solarHeatFraction<0||s.solarHeatFraction>1)errors.push('Absorbed solar fraction must be between zero and one.');
 if(!Object.hasOwn(AIRFLOW_BASIS,s.outsideAirBasis))errors.push('Controlled outdoor-air basis is unknown.');
 if(typeof s.outsideAirReviewed!=='boolean')errors.push('Controlled outdoor-air review state must be true or false.');
 else if(s.outsideAirBasis!=='literatureRange'&&!s.outsideAirReviewed)errors.push('Review the controlled outdoor-air capacities and fan specific power before running this scenario.');
 if(!['residential','commercial','industrial'].includes(s.sector))errors.push('Unknown electricity customer sector.');
 if(!['manual','state'].includes(s.priceMode))errors.push('Electricity price mode must be manual or state.');
 if(s.vpdMin>=s.vpdMax)errors.push('Minimum VPD must be below maximum VPD.');
 if(s.system==='mushroom'){
  if(!Number.isFinite(s.minVentACH)||s.minVentACH<0)errors.push('Mushroom minimum controlled outdoor air must be a project-specific finite ACH value.');
  if(!Number.isFinite(s.maxVentACH)||s.maxVentACH<=0)errors.push('Mushroom maximum controlled outdoor air must be a project-specific value greater than zero ACH.');
  if(!s.outsideAirReviewed)errors.push('Mushroom controlled outdoor air must be reviewed for species, growth stage, substrate loading, CO2 target, and equipment.');
 }
 if(Number.isFinite(s.minVentACH)&&Number.isFinite(s.maxVentACH)&&s.minVentACH>s.maxVentACH)errors.push('Minimum controlled outdoor air exceeds installed maximum.');
 if(s.coolingMinOutdoorC>=s.coolingMaxOutdoorC)errors.push('DX outdoor operating range is inverted.');
 if(OPAQUE_FACILITIES.has(s.facility)&&(s.parTransmission!==0||s.solarTransmission!==0))errors.push(`The ${FACILITIES[s.facility]} template is opaque by definition: direct solar and light transmission must be zero.`);
 const doasActive=s.technology==='doas'||s.doasM3s>0;
 if(doasActive){
  if(s.outsideAirReviewed!==true)errors.push('DOAS controlled outdoor air must be explicitly reviewed because treatment capacity does not add airflow.');
  const requirements=[['doasM3s','DOAS treatment capacity',0,50],['doasSupplyDewPointC','DOAS supply dew point',-10,25],['doasSupplyTempC','DOAS supply temperature',5,35],['doasCoolingCOP','DOAS cooling COP',.5,10],['doasReheatRecoveryFraction','DOAS reheat recovery fraction',0,1]];
  for(const [key,label,min,max]of requirements){
   const value=s[key],positive=key==='doasM3s';
   if(!Number.isFinite(value)||(positive?value<=min:value<min)||value>max)errors.push(`${label} must be ${positive?'greater than 0':'from '+min+' to '+max}.`);
  }
  if(Number.isFinite(s.doasSupplyDewPointC)&&Number.isFinite(s.doasSupplyTempC)&&s.doasSupplyDewPointC>s.doasSupplyTempC)
   errors.push('DOAS supply dew point cannot exceed DOAS supply temperature.');
  if(Number.isFinite(s.doasM3s)&&Number.isFinite(s.maxVentACH)&&Number.isFinite(s.areaM2)&&Number.isFinite(s.heightM)){
   const maximumM3s=s.maxVentACH*s.areaM2*s.heightM/3600;
   if(s.doasM3s>maximumM3s+1e-12)errors.push(`DOAS treatment capacity cannot exceed maximum controlled outdoor-air flow of ${maximumM3s.toFixed(2)} m3/s derived from maxVentACH, scenario area, and height.`);
  }
 }
 errors.push(...heatRecoveryErrors(s.heatRecovery),...heatSourceErrors(s),...shadeScreenErrors(s.shadeScreen),...thermalScreenErrors(s.thermalScreen),...insectScreenErrors(s.insectScreen));
 if(s.latitude==null&&s.longitude==null)errors.push('This scenario has no site. Enter a ZIP and select Locate, or enter latitude and longitude directly.');
 else if(!Number.isFinite(s.latitude)||Math.abs(s.latitude)>90||!Number.isFinite(s.longitude)||Math.abs(s.longitude)>180)errors.push('Invalid location coordinates.');
 if(s.timezone==null)errors.push('This scenario has no IANA time zone. Locate the site or enter the zone directly; an unstated zone would silently place every local day and photoperiod on the wrong clock.');
 else try{if(typeof s.timezone!=='string'||!s.timezone.trim())throw new Error();new Intl.DateTimeFormat('en',{timeZone:s.timezone});}catch{errors.push('Invalid IANA time zone.');}
 if(typeof s.name!=='string'||!s.name.trim()||s.name.length>120)errors.push('Scenario name must contain 1 to 120 characters.');
 if(typeof s.id!=='string'||!s.id||s.id.length>120)errors.push('Scenario identifier must contain 1 to 120 characters.');
 return errors;
}
