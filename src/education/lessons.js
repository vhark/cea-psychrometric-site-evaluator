import {resolveMoisture, displayRH, equilibriumTemperature} from '../moisture.js';
import {vaporPressure, enthalpy, wetBulb, padState, saturationPressure, CP_DRY_AIR, LATENT_HEAT} from '../physics.js';

const seed=(tempC,rh)=>({tempC,rh,pressurePa:101325,authoritative:'rh',rhReference:'water',dewPointReference:'water'});
export const lessonDefinitions = [
 {id:'heating',title:'Heat the air',summary:'Does lower RH mean less water?',question:'When we heat this air, what happens to its water content?',choices:['It decreases','It stays the same','It increases'],answer:1,input:seed(20,.6),parameter:{label:'Temperature rise',min:0,max:20,step:1,value:10,unit:'°C'}},
 {id:'cold-air',title:'Bring cold air inside',summary:'High RH can still offer drying.',question:'Compared with a room at 24 °C and 70% RH, can 5 °C air at 90% RH carry away moisture?',choices:['Yes, after it is warmed','No, its RH is too high','RH alone is enough to decide'],answer:0,input:seed(5,.9),parameter:{label:'Warm room temperature',min:18,max:30,step:1,value:24,unit:'°C'}},
 {id:'pad',title:'Evaporate water',summary:'Trade sensible heat for moisture.',question:'What happens when hot, dry air passes through a wetted pad?',choices:['Cooler and less water','Cooler and more water','Warmer and more water'],answer:1,input:seed(35,.2),parameter:{label:'Pad effectiveness',min:0,max:1,step:.05,value:.8,unit:'fraction'}},
 {id:'dehumidifier',title:'Condense moisture',summary:'Where does the heat go?',question:'If the condenser returns all its heat to this air, what is the net effect?',choices:['Cooler and drier','Warmer and drier','Warmer and wetter'],answer:1,input:seed(24,.75),parameter:{label:'Share of moisture removed',min:0,max:.5,step:.05,value:.25,unit:'fraction'}},
];

/** State calculations always use canonical SI values, never formatted input text. */
export function airState(input) {
 const moisture=resolveMoisture(input);
 if(!moisture.valid)throw new Error(moisture.warnings.join(' '));
 return stateAt(input.tempC,moisture.humidityRatio,input.pressurePa,moisture.basis,moisture.warnings);
}
function stateAt(tempC,w,pressurePa,basis,warnings=[]) {
 const pv=vaporPressure(w,pressurePa);
 const stableSupported=pv<=saturationPressure(tempC)*(1+1e-10);
 return {tempC,w,pressurePa,vaporPressurePa:pv,rh:displayRH(tempC,pv,basis.rhReference),
  dewPointC:equilibriumTemperature(pv),wetBulbC:stableSupported?wetBulb(tempC,w,pressurePa):null,
  enthalpyJkg:enthalpy(tempC,w),basis,warnings};
}

/** Illustrative, per kg dry air processes. No facility, equipment sizing or dispatch assumptions. */
export function runLesson(id,input,value) {
 const definition=lessonDefinitions.find(lesson=>lesson.id===id);
 if(!definition)throw new Error('Unknown lesson.');
 const setting=value??definition.parameter.value;
 if(!Number.isFinite(setting)||setting<definition.parameter.min||setting>definition.parameter.max)throw new Error('Process setting is outside its supported range.');
 const start=airState(input),result={id,start};
 let tempC=start.tempC,w=start.w;
 if(id==='heating')tempC+=setting;
 if(id==='cold-air') {
  if(setting<start.tempC)throw new Error('Choose outdoor air colder than the warm room for this lesson.');
  tempC=setting;
  result.reference={...airState({...seed(setting,.7),pressurePa:start.pressurePa}),rh:.7};
  result.dryingPotentialKgKg=result.reference.w-start.w;
 }
 if(id==='pad') {
  if(start.tempC<.01||start.vaporPressurePa>saturationPressure(start.tempC))throw new Error('The liquid-water pad lesson requires air above freezing and below saturation.');
  const end=padState(start.tempC,start.w,start.pressurePa,setting);
  tempC=end.tempC;w=end.w;
 }
 if(id==='dehumidifier') {
  if(start.tempC<.01)throw new Error('This condensing-dehumidifier lesson requires inlet air above freezing.');
  result.waterRemovedKgKg=w*setting;
  // Same coarse latent/sensible convention as simulate.js, at 2.5 L/kWh and all heat indoors.
  result.electricJkg=result.waterRemovedKgKg*3600000/2.5;
  result.heatJkg=result.waterRemovedKgKg*LATENT_HEAT+result.electricJkg;
  w-=result.waterRemovedKgKg;tempC+=result.heatJkg/CP_DRY_AIR;
 }
 result.end=stateAt(tempC,w,start.pressurePa,start.basis);
 if(id==='heating'||id==='cold-air')result.heatJkg=result.end.enthalpyJkg-start.enthalpyJkg;
 return result;
}

export function inputFromSI(input,system) {
 if(system!=='ip')return {...input,pressurePa:input.pressurePa/1000};
 return {...input,tempC:input.tempC*9/5+32,dewPointC:input.dewPointC==null?input.dewPointC:input.dewPointC*9/5+32,pressurePa:input.pressurePa/6894.757293168};
}
export function inputToSI(input,system) {
 if(system!=='ip')return {...input,pressurePa:input.pressurePa*1000};
 return {...input,tempC:(input.tempC-32)*5/9,dewPointC:input.dewPointC==null?input.dewPointC:(input.dewPointC-32)*5/9,pressurePa:input.pressurePa*6894.757293168};
}
