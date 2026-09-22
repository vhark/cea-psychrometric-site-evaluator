import {MOISTURE_VERSION} from './moisture.js';
import {assertHistoricalWeather} from './weather-contract.js';
import {MODEL_VERSION,migrateScenario,validateScenario,FACILITY_TEMPLATES} from './config.js';
import {CP_DRY_AIR as CP,LATENT_HEAT as L,clamp,enthalpy,humidityRatio,saturationHumidityRatio,saturationPressure,
  vaporPressure,relativeHumidity,dewPoint,airVPD,dryAirDensity,padState,weatherState,schedule,moistureBounds,classifyWeather,outdoorDryingHour,
  stanghelliniTranspiration,canopyAbsorbedWm2,localClock} from './physics.js';
import {resolveShadeScreen,resolveThermalScreen,resolveInsectScreen,shadeDeployed,thermalDeployed,heatSourceState,heatPumpConfigured,
  componentWarnings,componentAssumptions} from './screens.js';
import {summarizeHours,weatherSummary} from './metrics.js';
import {conditionDoasSupply,recoverSupplyState} from './airflow.js';

const HOUR=3600000,KWH=3600000;
const TOTALS=['electricKWh','fuelKWh','waterL','condensateKg','lightKWh','solarDLI','lightDLI','heatingKWh','heatPumpElectricKWh','coolingKWh',
  'dehuKWh','dehuHeatKWh','dehuRejectedHeatKWh','unmetSensibleKWh','unmetMoistureKg','regenerationKWh','regenerationElectricKWh','regenerationFuelKWh',
  'desiccantRemovedKg','desiccantHeatKWh','desiccantExportedHeatKWh','reheatKWh','rejectedHeatKWh','surfaceCondensateKg',
  'cropWaterL','padWaterL','humidifierWaterL','tempDegreeHours','vpdKPaHours',
  'doasCondensateKg','doasCoolingDeliveredKWh','doasCoolingElectricKWh','doasRecoveredReheatKWh','doasExternalHeatKWh','doasUnmetConditioningKWh',
  'recoverySensibleKWh','recoveryLatentKWh','recoveryAuxKWh','recoveryCoreM3','recoveryBypassM3','recoveryDefrostHours',
  'preheatDeliveredKWh','preheatElectricKWh','preheatFuelKWh','preheatInsufficientHours'];
const SENSIBLE_LOADS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','controlledOutdoorAirSensibleKWh','fanKWh','cropSensibleKWh','cropLatentKWh','humidifierKWh','equipmentHeatKWh'];
const LATENT_LOADS=['crop','infiltration','controlledOutdoorAir','humidifier','removed','condensed','stored'];
const SHR_GAINS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','controlledOutdoorAirSensibleKWh','fanKWh','cropSensibleKWh'];

// Frozen dry-air inventory and thermal capacitance per continuous segment. CP and
// latent heat are constants, so the reduced energy inventory is C*T + L*M*W.
// This is NOT a detailed psychrometric total-enthalpy zone model. Liquid sensible
// heat, vapor heat capacity, crop heat storage and envelope wetting are omitted.
// The envelope conductance, the leakage rate and the ventilation ceiling come from the substep context, not
// straight from the scenario: a closed thermal curtain multiplies the envelope loss and, where the user has
// declared a closed-state exchange, caps the outside-air path that carries moisture out of the zone.
function coefficients(ctx,air) {
  const {state,outside,s,dt}=ctx;
  const volume=s.areaM2*s.heightM;
  const leak=dryAirDensity(outside.tempC,outside.w,outside.pressurePa)*volume*ctx.infiltrationACH/3600;
  const controlledFlow=Number.isFinite(air.controlledMassFlowKgS)?air.controlledMassFlowKgS:
    dryAirDensity(air.supply.tempC,air.supply.w,outside.pressurePa)*air.controlledM3s;
  const massFlow=leak+controlledFlow;
  const ua=ctx.ua;
  const conductance=ua+CP*massFlow;
  const massDecay=Math.exp(-massFlow*dt/state.mass);
  const massGain=massFlow>0?-Math.expm1(-massFlow*dt/state.mass)/massFlow:dt/state.mass;
  const heatDecay=Math.exp(-conductance*dt/state.capacity);
  const heatGain=conductance>0?-Math.expm1(-conductance*dt/state.capacity)/conductance:dt/state.capacity;
  return {leak,controlledFlow,massFlow,ua,conductance,massDecay,massGain,heatDecay,heatGain,
    wetSource:leak*outside.w+controlledFlow*air.supply.w,
    heatSource:(ua+CP*leak)*outside.tempC+CP*controlledFlow*air.supply.tempC};
}

// Equilibrate supersaturation by converting vapor into liquid and returning its
// latent heat. Never clip RH: solve C*(Tfinal-Traw) = L*condensed water.
function condense(tempC,w,state,pressurePa) {
  if(tempC < -90 || tempC > 90 || w < -1e-12 || !Number.isFinite(tempC+w))return null;
  // Above the boiling point at this pressure the air cannot saturate; reject the candidate
  // through the normal null path instead of throwing out of the whole scenario.
  if(saturationPressure(tempC)>=pressurePa)return null;
  if(w<=saturationHumidityRatio(tempC,pressurePa))return {tempC,w,condensate:0};
  let lo=0,hi=state.mass*w;
  for(let i=0;i<45;i++){
    const kg=(lo+hi)/2,t=tempC+L*kg/state.capacity;
    if(t>=90 || saturationPressure(t)>=pressurePa || w-kg/state.mass<=saturationHumidityRatio(t,pressurePa))hi=kg;else lo=kg;
  }
  const condensate=hi;
  return {tempC:tempC+L*condensate/state.capacity,w:w-condensate/state.mass,condensate};
}
function duties(available,estimated) {
  if(available<=0)return [0];
  return [...new Set([0,clamp(estimated,0,1),.5,1].map(x=>Math.round(x*1000000)/1000000))];
}

// PsychroLib moist-air enthalpy is linear in dry-bulb temperature at fixed humidity ratio.
function temperatureAtEnthalpy(enthalpyJkg,w) {
  return (enthalpyJkg-2501000*w)/(CP+1860*w);
}
function mixSupplyStates(treated,treatedMassFlowKgS,bypass,bypassMassFlowKgS) {
  const total=treatedMassFlowKgS+bypassMassFlowKgS;
  if(total<=0)return {...bypass};
  const w=(treated.w*treatedMassFlowKgS+bypass.w*bypassMassFlowKgS)/total;
  const h=(enthalpy(treated.tempC,treated.w)*treatedMassFlowKgS+
    enthalpy(bypass.tempC,bypass.w)*bypassMassFlowKgS)/total;
  return {tempC:temperatureAtEnthalpy(h,w),w};
}

function untreatedSupplyUtility(ctx,untreated,treated) {
  const tol=Math.max(.1,ctx.s.tempToleranceC);
  const sensibleError=(ctx.state.tempC-ctx.target.targetC)/tol;
  const bounds=moistureBounds(ctx.state.tempC,ctx.outside.pressurePa,ctx.s);
  const half=Math.max(1e-7,(bounds.maxW-bounds.minW)/2);
  const moistureError=(ctx.state.w-(bounds.minW+bounds.maxW)/2)/half;
  return (-sensibleError)*(untreated.tempC-treated.tempC)/tol+
    (-moistureError)*(untreated.w-treated.w)/half;
}

// Per-hour outdoor-dependent quantities shared by both controllers, including this hour's heating source:
// a fuel heater delivers its full rating, a heat pump delivers a derated capacity at an interpolated COP,
// and a locked-out heat pump delivers nothing at all.
function hourContext(outside,s,shade,thermal) {
  const pad=outside.tempC>2?padState(outside.tempC,outside.w,outside.pressurePa,s.padEffectiveness):null;
  const heat=heatSourceState(s,outside.tempC);
  const doasConfigured=s.doasM3s>0&&Number.isFinite(s.doasSupplyTempC)&&Number.isFinite(s.doasSupplyDewPointC);
  return {outside,s,pad,shade,thermal,indirectTempC:pad?outside.tempC-s.hybridEvapEffectiveness*(outside.tempC-pad.wetBulbC):null,
    dryFloor:humidityRatio(0,.05,outside.pressurePa),coilFloorW:saturationHumidityRatio(7,outside.pressurePa),
    dxOutdoorOK:outside.tempC>=s.coolingMinOutdoorC&&outside.tempC<=s.coolingMaxOutdoorC,
    heatCapacityW:heat.capacityW,heatCOP:heat.cop,heatMode:heat.mode,uaOpen:s.areaM2*s.envelopeRatio*s.uValue,
    doasTempC:doasConfigured?s.doasSupplyTempC:null,
    doasW:doasConfigured?Math.min(outside.w,saturationHumidityRatio(s.doasSupplyDewPointC,outside.pressurePa)):null};
}
// Per-substep context: indoor-state-dependent device availability, plus the envelope and outside-air path
// implied by the thermal curtain's position in this substep.
function substepContext(hour,state,forcing,target,dt,thermalClosed) {
  const s=hour.s;
  const dxAvailable=hour.dxOutdoorOK&&state.tempC>=10?s.coolingKW*1000:0;
  // A declared closed-state exchange caps the whole outside-air path: uncontrolled leakage first, then
  // whatever ventilation the cap still allows. With no declared value nothing is restricted.
  const cap=thermalClosed?hour.thermal.closedExchangeACH:null;
  const infiltrationACH=cap===null?s.infiltrationACH:Math.min(s.infiltrationACH,cap);
  const recoveryExhaust=s.heatRecovery.type==='none'?null:condense(state.tempC,state.w,state,hour.outside.pressurePa);
  return {...hour,state,forcing,target,dt,dxAvailable,dxMoisture:dxAvailable*(1-s.coolingSHR)/L,dxSense:dxAvailable*s.coolingSHR,
    thermalClosed,ua:thermalClosed?hour.uaOpen*hour.thermal.uValueFactor:hour.uaOpen,
    infiltrationACH,ventCapACH:cap===null?null:Math.max(0,cap-infiltrationACH),recoveryExhaust,
    dehuAvailable:state.tempC>=10&&state.tempC<=40?s.dehuKgH/3600:0,desiccantAvailable:state.tempC>=2&&state.tempC<=50?s.desiccantKgH/3600:0};
}
function inactiveRecovery(outside,volumeFlowM3s,configured) {
  return {supply:{tempC:outside.tempC,w:outside.w},coreFlowM3s:0,bypassFlowM3s:configured?volumeFlowM3s:0,
    sensibleTransferW:0,latentTransferW:0,auxiliaryW:0,preheatDemandW:0,preheatDeliveredW:0,
    defrostFraction:0,preheatInsufficient:false};
}
function controlledAirOption(ctx,{controlledACH,kind='outside',doasMode='none',recoveryMode='none',doasExcessBypass=false}){
  const {outside,pad,s}=ctx;
  const cappedACH=ctx.ventCapACH===null?controlledACH:Math.min(controlledACH,ctx.ventCapACH);
  const requestedControlledM3s=s.areaM2*s.heightM*cappedACH/3600;
  const recoveryConfigured=s.heatRecovery.type!=='none';
  const direct=kind==='outside',requestedDoas=doasMode==='conditioned';
  const capacityOnly=requestedDoas&&direct&&!doasExcessBypass&&ctx.doasTempC!==null&&ctx.doasW!==null;
  const outsideDensity=direct?dryAirDensity(outside.tempC,outside.w,outside.pressurePa):0;
  const recoverAtFlow=volumeFlowM3s=>{
    if(!direct||!recoveryConfigured||recoveryMode!=='active')
      return inactiveRecovery(outside,volumeFlowM3s,recoveryConfigured);
    if(!ctx.recoveryExhaust)throw Error('Zone state cannot be reconciled to the current recovery pressure.');
    return recoverSupplyState({
      outside:{tempC:outside.tempC,w:outside.w,pressurePa:outside.pressurePa},
      exhaust:{tempC:ctx.recoveryExhaust.tempC,w:ctx.recoveryExhaust.w,pressurePa:outside.pressurePa},
      volumeFlowM3s,recovery:s.heatRecovery,bypass:false,availablePreheatW:ctx.heatCapacityW,
    });
  };
  let controlledM3s=requestedControlledM3s;
  let recovery=recoverAtFlow(controlledM3s);
  if(capacityOnly&&controlledM3s>0){
    // Capacity is stated at the DOAS inlet. Recovery and preheat can expand the outdoor-reference
    // volume before it reaches that inlet. Reduce monotonically until the resulting inlet flow is
    // feasible, never iterating upward across a discontinuous recovery support threshold.
    let inletM3s=outsideDensity*controlledM3s/
      dryAirDensity(recovery.supply.tempC,recovery.supply.w,outside.pressurePa);
    for(let i=0;i<8&&inletM3s>s.doasM3s;i++){
      controlledM3s*=s.doasM3s/inletM3s;
      recovery=recoverAtFlow(controlledM3s);
      inletM3s=outsideDensity*controlledM3s/
        dryAirDensity(recovery.supply.tempC,recovery.supply.w,outside.pressurePa);
    }
    // A discontinuity, unsupported reduced core flow, or numerical plateau must never leak untreated
    // air into a capacity-only candidate. Bypass recovery at the feasible outdoor-basis capacity.
    if(inletM3s>s.doasM3s||recovery.unsupportedFlow){
      const unsupportedFlow=Boolean(recovery.unsupportedFlow);
      controlledM3s=Math.min(requestedControlledM3s,s.doasM3s);
      recovery={...inactiveRecovery(outside,controlledM3s,recoveryConfigured),unsupportedFlow};
    }
  }
  const actualACH=controlledM3s*3600/(s.areaM2*s.heightM);
  const controlledMassFlowKgS=direct?outsideDensity*controlledM3s:null;
  const recoveredSupply=direct?recovery.supply:{tempC:outside.tempC,w:outside.w};
  const canCondition=requestedDoas&&direct&&controlledMassFlowKgS>0&&ctx.doasTempC!==null&&ctx.doasW!==null;
  const doasInletDensity=canCondition?dryAirDensity(recoveredSupply.tempC,recoveredSupply.w,outside.pressurePa):0;
  const doasInletM3s=canCondition?controlledMassFlowKgS/doasInletDensity:0;
  const treatmentM3s=canCondition?Math.min(s.doasM3s,doasInletM3s):0;
  const remainingHeatCapacityW=Math.max(0,ctx.heatCapacityW-recovery.preheatDeliveredW);
  const treatment=treatmentM3s>0?conditionDoasSupply({
    inlet:recoveredSupply,volumeFlowM3s:treatmentM3s,pressurePa:outside.pressurePa,
    supplyTempC:s.doasSupplyTempC,supplyDewPointC:s.doasSupplyDewPointC,
    coolingCOP:s.doasCoolingCOP,reheatRecoveryFraction:s.doasReheatRecoveryFraction,
    availableHeatingW:remainingHeatCapacityW,
  }):{
    outlet:{...recoveredSupply},condensateKgS:0,coolingLoadW:0,coolingElectricW:0,
    heatingDemandW:0,reheatDemandW:0,recoveredReheatW:0,externalHeatW:0,unmetConditioningW:0,
  };
  const treatedMassFlowKgS=doasInletDensity*treatmentM3s;
  const untreatedRemainderKgS=direct?Math.max(0,controlledMassFlowKgS-treatedMassFlowKgS):0;
  const untreatedMassFlowKgS=untreatedRemainderKgS<=1e-12*Math.max(1,controlledMassFlowKgS||0)?0:untreatedRemainderKgS;
  const conditioned=treatmentM3s>0;
  const supply=conditioned?mixSupplyStates(treatment.outlet,treatedMassFlowKgS,recoveredSupply,untreatedMassFlowKgS):
    kind==='pad'?{tempC:pad.tempC,w:pad.w}:kind==='indirect'?{tempC:ctx.indirectTempC,w:outside.w}:recoveredSupply;
  const coreActive=recoveryConfigured&&recovery.coreFlowM3s>0;
  return {controlledACH:actualACH,controlledM3s,requestedControlledM3s,controlledMassFlowKgS,kind,recoveryConfigured,recoveryRequested:recoveryMode,
    recoveryMode:recoveryConfigured?(coreActive?'active':'bypass'):'none',
    recoveryCoreFraction:recoveryConfigured&&controlledM3s>0?recovery.coreFlowM3s/controlledM3s:0,
    recoveryBypassFraction:recoveryConfigured&&controlledM3s>0?recovery.bypassFlowM3s/controlledM3s:0,
    recovery,
    doasMode:conditioned?'conditioned':'none',doasExcessBypass:doasExcessBypass&&untreatedMassFlowKgS>1e-12,supply,
    treatment:{...treatment,doasRequested:requestedDoas,treatmentM3s,untreatedMassFlowKgS}};
}
function recoveryVariants(ctx,args) {
  const actualACH=ctx.ventCapACH===null?args.controlledACH:Math.min(args.controlledACH,ctx.ventCapACH);
  if(args.kind==='pad'||args.kind==='indirect'||ctx.s.heatRecovery.type==='none'||actualACH<=0)
    return [controlledAirOption(ctx,{...args,recoveryMode:'bypass'})];
  return [controlledAirOption(ctx,{...args,recoveryMode:'active'}),controlledAirOption(ctx,{...args,recoveryMode:'bypass'})];
}
function airVariants(ctx,args) {
  if(args.doasMode!=='conditioned'||(args.kind??'outside')!=='outside')return recoveryVariants(ctx,args);
  const capacityOnly=recoveryVariants(ctx,{...args,doasExcessBypass:false});
  const capacityByRecovery=new Map(capacityOnly.map(option=>[option.recoveryRequested,option]));
  const usefulExcess=recoveryVariants(ctx,{...args,doasExcessBypass:true}).filter(option=>{
    const capacity=capacityByRecovery.get(option.recoveryRequested);
    return option.treatment.untreatedMassFlowKgS>1e-12&&capacity&&
      untreatedSupplyUtility(ctx,option.supply,capacity.supply)>1e-12;
  });
  return [...capacityOnly,...usefulExcess];
}
function airOptions(ctx) {
  const {s,pad}=ctx;
  const levels=[...new Set(Array.from({length:5},(_,i)=>s.minVentACH+(s.maxVentACH-s.minVentACH)*i/4))];
  const options=[];
  for(const controlledACH of levels){
    options.push(...airVariants(ctx,{controlledACH}));
    if(controlledACH>0&&s.doasM3s>0)options.push(...airVariants(ctx,{controlledACH,doasMode:'conditioned'}));
    if(controlledACH>0&&s.padEnabled&&pad)options.push(...airVariants(ctx,{controlledACH,kind:'pad'}));
    if(controlledACH>0&&s.technology==='hybridDesiccant'&&pad&&s.desiccantKgH>0)options.push(...airVariants(ctx,{controlledACH,kind:'indirect'}));
  }
  return options;
}

// One fully specified control action integrated over a substep. `plan.humidifier` and `plan.heat`
// decide the humidifier rate and heating demand (the ideal dispatcher anticipates the end state,
// the staged controller acts on the measured state). Returns null for an unsaturable candidate.
function evaluate(ctx,air,dxDuty,dehuDuty,desiccantDuty,plan) {
  const {state,outside,s,forcing,target,dt}=ctx;
  const k=coefficients(ctx,air);
  const fanW=s.fanWPerM3s*air.controlledM3s;
  const pumpW=(air.kind==='pad'||air.kind==='indirect')?s.padPumpW:0;
  const qBase=forcing.solarW+forcing.lightW+s.cropSensibleWm2*s.canopyM2-L*forcing.cropKgS+fanW;
  const baselineW=k.massDecay*state.w+k.massGain*(k.wetSource+forcing.cropKgS);
  // Refrigerant coils assume a 7 C moisture floor and actual vapor
  // inventory. Unused DX latent capacity is not silently made sensible.
  let available=Math.max(0,(baselineW-ctx.dryFloor)/k.massGain);
  const coilFloor=Math.max(0,(baselineW-ctx.coilFloorW)/k.massGain);
  const dxKgS=Math.min(ctx.dxMoisture*dxDuty,coilFloor,available);
  available-=dxKgS;
  const dehuKgS=Math.min(ctx.dehuAvailable*dehuDuty,available,Math.max(0,coilFloor-dxKgS));available-=dehuKgS;
  const desiccantKgS=Math.min(ctx.desiccantAvailable*desiccantDuty,available);
  const dxSensibleW=ctx.dxSense*dxDuty,dxTotalW=dxSensibleW+L*dxKgS;
  // Declared COP applies to actual delivered total cooling in this idealized
  // part-load model. No startup, cycling or frost performance is invented.
  const dxW=dxTotalW/s.coolingCOP;
  const dehuW=dehuKgS*3600/s.dehuLPerKWh*1000;
  // A condensing dehumidifier releases the latent heat it takes out plus its own electrical input. Where that
  // heat lands is a topology choice, not a property of the machine. An in-room or ducted-and-returned unit puts
  // all of it back into the crop air, which the cooling plant must then remove, so dehuHeatFraction is 1. A
  // remote-condenser or water-cooled unit rejects some or all of it outside the zone: declare the fraction that
  // still reaches the air. Ducting a standalone unit outside the room changes serviceability and noise, not the
  // heat path, so it does not by itself justify lowering this.
  const dehuHeatTotalW=L*dehuKgS+dehuW;
  const dehuHeatW=dehuHeatTotalW*s.dehuHeatFraction;
  const dehuRejectedW=dehuHeatTotalW-dehuHeatW;
  const sorptionW=L*desiccantKgS*s.desiccantHeatFraction;
  const regenW=desiccantKgS*s.regenerationKWhPerKg*KWH;
  const regenElectricW=regenW*s.regenerationElectricFraction;
  const regenFuelW=regenW-regenElectricW;
  const removal=dxKgS+dehuKgS+desiccantKgS;
  const equipmentQ=dehuHeatW+sorptionW-dxSensibleW;
  const unheated=k.heatDecay*state.tempC+k.heatGain*(k.heatSource+qBase+equipmentQ);
  const unhumidifiedW=baselineW-k.massGain*removal;
  const recoverable=s.integratedHVAC?s.reheatFraction*(dxTotalW+dxW):0;
  const humidifier=plan.humidifier(unheated,unhumidifiedW,k,recoverable);
  const heatNeed=Math.max(0,plan.heat(unheated-k.heatGain*L*humidifier,k,recoverable));
  const reheatW=Math.min(recoverable,heatNeed);
  // Recovery preheat has first claim on the finite source, followed by DOAS external heat, then zone heat.
  const remainingHeatCapacityW=Math.max(0,ctx.heatCapacityW-air.recovery.preheatDeliveredW-air.treatment.externalHeatW);
  const heaterW=Math.min(remainingHeatCapacityW,Math.max(0,heatNeed-reheatW));
  const q=qBase+equipmentQ-L*humidifier+reheatW+heaterW;
  const rawT=k.heatDecay*state.tempC+k.heatGain*(k.heatSource+q);
  const rawW=baselineW+k.massGain*(humidifier-removal);
  const final=condense(rawT,rawW,state,outside.pressurePa);
  if(!final)return null;
  const b=moistureBounds(final.tempC,outside.pressurePa,s);
  const temperatureMiss=Math.max(0,target.minTempC-final.tempC,final.tempC-target.maxTempC);
  const pv=vaporPressure(final.w,outside.pressurePa),ps=saturationPressure(final.tempC);
  const moistureMiss=Math.max(0,(ps-s.vpdMax*1000)-pv,pv-Math.min(ps-s.vpdMin*1000,saturationPressure(s.maxDewPointC)))/1000;
  const violation=temperatureMiss/Math.max(.1,s.tempToleranceC)+moistureMiss/Math.max(.05,s.vpdMax-s.vpdMin);
  const padKgS=air.kind==='pad'?k.controlledFlow*Math.max(0,air.supply.w-outside.w):0;
  // Indirect evap rejects sensible heat through a separate wet secondary
  // stream. Its water is an ideal latent-equivalent estimate, not product data.
  const indirectKgS=air.kind==='indirect'?k.controlledFlow*CP*(outside.tempC-air.supply.tempC)/L:0;
  const doasCondensateKgS=air.treatment.condensateKgS;
  const doasCoolingDeliveredW=air.treatment.coolingLoadW;
  const doasCoolingElectricW=air.treatment.coolingElectricW;
  const doasRecoveredReheatW=air.treatment.recoveredReheatW;
  const doasExternalHeatW=air.treatment.externalHeatW;
  const doasUnmetConditioningW=air.treatment.unmetConditioningW;
  // A heat pump buys delivered heat as electricity at the interpolated COP; a fuel heater books it to fuel.
  // Recovery preheat, DOAS external heat, and zone heat draw from one capacity in that priority order.
  const heaterElectricW=ctx.heatCOP!==null?heaterW/ctx.heatCOP:0;
  const preheatElectricW=ctx.heatCOP!==null?air.recovery.preheatDeliveredW/ctx.heatCOP:0;
  const preheatFuelW=ctx.heatCOP!==null?0:air.recovery.preheatDeliveredW/s.heaterEfficiency;
  const doasExternalElectricW=ctx.heatCOP!==null?doasExternalHeatW/ctx.heatCOP:0;
  const doasExternalFuelW=ctx.heatCOP!==null?0:doasExternalHeatW/s.heaterEfficiency;
  const electricW=forcing.lightW+fanW+pumpW+dxW+dehuW+regenElectricW+doasCoolingElectricW+
    doasExternalElectricW+heaterElectricW+preheatElectricW+air.recovery.auxiliaryW;
  const fuelW=(ctx.heatCOP!==null?0:heaterW/s.heaterEfficiency)+regenFuelW+preheatFuelW+doasExternalFuelW;
  const waterKgS=forcing.cropKgS+humidifier+padKgS+indirectKgS;
  const costRate=electricW/1000*s.electricityPrice+fuelW/1000*s.fuelPrice+waterKgS*3600*s.waterPrice;
  // Unmet load = extra steady capacity (W, kg/s) needed to hold the violated bound
  // under this step's forcing. Independent of the substep length to first order,
  // unlike the outstanding inventory deficit, which would re-count every substep.
  const heatRate=(k.heatSource+q),holdT=(1-k.heatDecay)/k.heatGain,holdW=(1-k.massDecay)/k.massGain;
  const moistureRate=k.wetSource+forcing.cropKgS+humidifier-removal;
  const unmetSensibleW=final.tempC>target.maxTempC?Math.max(0,heatRate-target.maxTempC*holdT):final.tempC<target.minTempC?Math.max(0,target.minTempC*holdT-heatRate):0;
  const unmetMoistureKgS=final.w>b.maxW?Math.max(0,moistureRate-b.maxW*holdW):final.w<b.minW?Math.max(0,b.minW*holdW-moistureRate):0;
  return {...final,k,air,rawT,rawW,q,moistureSource:forcing.cropKgS+humidifier-removal,violation,costRate,temperatureMiss,moistureMiss,
    fanW,pumpW,dxDuty,dehuDuty,desiccantDuty,dxKgS,dehuKgS,desiccantKgS,dxSensibleW,dxTotalW,dxW,dehuW,dehuHeatW,sorptionW,
    regenW,regenElectricW,regenFuelW,reheatW,heaterW,heaterElectricW,preheatElectricW,preheatFuelW,electricW,fuelW,waterKgS,
    padKgS:padKgS+indirectKgS,humidifier,doasCondensateKgS,doasCoolingDeliveredW,doasCoolingElectricW,
    doasRecoveredReheatW,doasExternalHeatW,doasUnmetConditioningW,doasExternalElectricW,doasExternalFuelW,
    rejectedW:dxTotalW+dxW-reheatW+dehuRejectedW+Math.max(0,doasCoolingDeliveredW+doasCoolingElectricW-doasRecoveredReheatW),dehuRejectedW,desiccantExportedW:L*desiccantKgS*(1-s.desiccantHeatFraction)+regenW,
    unmetSensibleW,unmetMoistureKgS};
}

// Ideal modulation upper bound: enumerate airflow and device duty combinations each substep,
// minimizing joint target excursion first and instantaneous manual-price operating cost second.
function chooseIdeal(ctx) {
  const {state,outside,s,target}=ctx;
  let best=null;
  const noHumidifier=()=>0;
  const heat=(unheatedT,k)=>(target.minTempC+.03-unheatedT)/k.heatGain;
  for(const air of airOptions(ctx)){
    const k=coefficients(ctx,air);
    const baselineW=k.massDecay*state.w+k.massGain*(k.wetSource+ctx.forcing.cropKgS);
    const qBase=ctx.forcing.solarW+ctx.forcing.lightW+s.cropSensibleWm2*s.canopyM2-L*ctx.forcing.cropKgS+s.fanWPerM3s*air.controlledM3s;
    const baselineT=k.heatDecay*state.tempC+k.heatGain*(k.heatSource+qBase);
    // Moisture targets must correspond to the temperature the thermostat will
    // actually hold, not the center setpoint when it operates at a deadband edge.
    const controlTempC=clamp(baselineT,target.minTempC+.03,target.maxTempC-.03);
    const targetBounds=moistureBounds(controlTempC,outside.pressurePa,s);
    const removalDemand=Math.max(0,(baselineW-targetBounds.maxW)/k.massGain);
    const sensibleDuty=ctx.dxSense>0?(baselineT-(target.maxTempC-.03))/(k.heatGain*ctx.dxSense):0;
    const dxDuties=duties(ctx.dxAvailable,Math.max(sensibleDuty,ctx.dxMoisture>0?removalDemand/ctx.dxMoisture:0));
    if(ctx.dxAvailable>0&&sensibleDuty>0&&sensibleDuty<1)dxDuties.push(sensibleDuty);
    const dehuDuties=duties(ctx.dehuAvailable,removalDemand/ctx.dehuAvailable);
    const desiccantDuties=duties(ctx.desiccantAvailable,removalDemand/ctx.desiccantAvailable);
    const anticipating=(unheatedT,unhumidifiedW,k,recoverable)=>{
      const anticipatedT=Math.max(unheatedT,Math.min(target.minTempC+.03,unheatedT+k.heatGain*(ctx.heatCapacityW+recoverable)));
      const b=moistureBounds(anticipatedT,outside.pressurePa,s);
      return Math.min(s.humidifierKgH/3600,Math.max(0,(b.minW-unhumidifiedW)/k.massGain));
    };
    const plans=s.humidifierKgH>0?[{humidifier:noHumidifier,heat},{humidifier:anticipating,heat}]:[{humidifier:noHumidifier,heat}];
    for(const dxDuty of dxDuties)for(const dehuDuty of dehuDuties)for(const desiccantDuty of desiccantDuties)for(const plan of plans){
      const candidate=evaluate(ctx,air,dxDuty,dehuDuty,desiccantDuty,plan);
      if(!candidate)continue;
      if(best&&(candidate.violation>best.violation+1e-8||(Math.abs(candidate.violation-best.violation)<=1e-8&&candidate.costRate>=best.costRate)))continue;
      best=candidate;
    }
  }
  return best;
}

// Staged causal controller, in the manner of a greenhouse climate computer: each loop measures the zone
// state and walks an ordered ladder of stages. Every stage has its own call and release point on the
// normalized band error (0 at the target, ±1 at the band edges), a minimum on/off time, and the ladder
// waits for the last engaged stage's minimum run before adding another, so a stage shows its effect first.
// Cooling ladder: ventilation stages 1..4 (min..max ACH) when outside air is cooler than the zone, then
// evaporative (indirect or pad) when its leaving air is cooler than the zone and pad moisture fits the band,
// then DX at 50% and 100%. Moisture ladder: ventilation when outside air is drier than the ceiling and the
// heater can carry the ventilation load, then DOAS, condensing dehumidifier, desiccant, DX at 50%/100%.
// Removal stages call high in the band because a minimum run of a finite device overshoots downward.
// Heater: proportional band, no minimum time. Humidifier: on/off with a fill limit inside the band.
const MIN_TIME_S={vent:120,indirect:300,pad:300,dx:600,dehu:600,desiccant:600,doas:600,humidifier:300};
function stagedController(s) {
  const rung=(device,stage,enter,release)=>({device,stage,enter,release,on:false,since:Infinity});
  const vent=s.maxVentACH>s.minVentACH+1e-9?4:0;
  const cool=[],moist=[];
  for(let i=1;i<=vent;i++){cool.push(rung('vent',i,.15*i,.15*i-.2));moist.push(rung('vent',i,.05+.15*i,.15*i-.15));}
  if(s.technology==='hybridDesiccant'&&s.desiccantKgH>0)cool.push(rung('indirect',1,.7,.3));
  else if(s.padEnabled)cool.push(rung('pad',1,.7,.3));
  if(s.doasM3s>0)moist.push(rung('doas',1,.5,-.3),rung('doas',2,.75,0));
  if(s.dehuKgH>0)moist.push(rung('dehu',1,.55,-.3),rung('dehu',2,.8,0));
  if(s.desiccantKgH>0)moist.push(rung('desiccant',1,.6,-.3),rung('desiccant',2,.85,0));
  if(s.coolingKW>0){cool.push(rung('dx',1,.75,.25),rung('dx',2,.9,.5));moist.push(rung('dx',1,.9,.4),rung('dx',2,.97,.6));}
  return {cool:{rungs:cool,sinceUp:Infinity,upDelay:0},moist:{rungs:moist,sinceUp:Infinity,upDelay:0},humidifierOn:false,humidifierSince:Infinity};
}
function stepLadder(ladder,error,helps,dt) {
  let next=null;
  for(const r of ladder.rungs){
    if(r.on&&!helps(r)){r.on=false;r.since=0;}
    if(!r.on&&!next&&helps(r))next=r;
  }
  if(next&&error>next.enter&&next.since>=MIN_TIME_S[next.device]&&(error>1||ladder.sinceUp>=ladder.upDelay)){next.on=true;next.since=0;ladder.sinceUp=0;ladder.upDelay=MIN_TIME_S[next.device];}
  else for(let i=ladder.rungs.length-1;i>=0;i--){
    const r=ladder.rungs[i];
    if(r.on&&error<r.release&&r.since>=MIN_TIME_S[r.device]){r.on=false;r.since=0;break;}
  }
  for(const r of ladder.rungs)r.since+=dt;
  ladder.sinceUp+=dt;
}
function chooseStaged(ctx,c) {
  const {state,outside,s,forcing,target,pad}=ctx;
  const tol=Math.max(.1,s.tempToleranceC);
  const e=(state.tempC-target.targetC)/tol;
  const b=moistureBounds(state.tempC,outside.pressurePa,s);
  const half=Math.max(1e-7,(b.maxW-b.minW)/2),wMid=(b.minW+b.maxW)/2;
  const em=(state.w-wMid)/half;
  const heatSetC=target.targetC-.25*tol,heatBand=Math.min(1,.75*tol);
  const ventLevel=stage=>s.minVentACH+(s.maxVentACH-s.minVentACH)*stage/4;
  // Outside-air gates carry their own hysteresis: a running stage keeps its supply until the margin halves.
  // A supply cools or dries only while it is cooler or drier than the zone air (and, for moisture, under the ceiling).
  const cooler=(supplyC,r)=>supplyC<state.tempC-(r.on?.25:.5);
  const drier=(supplyW,r)=>supplyW<b.maxW-(r.on?.00025:.0005)&&supplyW<state.w-(r.on?0:.00025);
  const helpsCool=r=>r.device==='vent'?cooler(outside.tempC,r):
    r.device==='indirect'?pad!==null&&cooler(ctx.indirectTempC,r):
    r.device==='pad'?pad!==null&&cooler(pad.tempC,r)&&pad.w<=b.maxW:ctx.dxAvailable>0;
  stepLadder(c.cool,e,helpsCool,ctx.dt);
  let coolVent=0,indirect=false,padOn=false,dxCool=0;
  for(const r of c.cool.rungs)if(r.on){if(r.device==='vent')coolVent=r.stage;else if(r.device==='indirect')indirect=true;else if(r.device==='pad')padOn=true;else dxCool=r.stage;}
  // Heating-limited moisture ventilation: a stage is usable only if the heating source plus current gains
  // can carry the envelope and ventilation loss to the heating setpoint at that airflow. Both terms follow
  // the current curtain position and the heat pump's derated capacity at this outdoor temperature.
  const heatCapW=ctx.heatCapacityW+forcing.solarW+forcing.lightW,ua=ctx.ua;
  const helpsMoist=r=>{
    if(r.device==='vent'){
      if(r.stage<=coolVent||!drier(outside.w,r))return false;
      const flow=dryAirDensity(outside.tempC,outside.w,outside.pressurePa)*s.areaM2*s.heightM*(ventLevel(r.stage)+ctx.infiltrationACH)/3600;
      return (ua+CP*flow)*Math.max(0,heatSetC-outside.tempC)<=heatCapW;
    }
    return r.device==='doas'?ctx.doasW!==null&&drier(ctx.doasW,r):r.device==='dehu'?ctx.dehuAvailable>0:r.device==='desiccant'?ctx.desiccantAvailable>0:ctx.dxAvailable>0&&ctx.dxMoisture>0;
  };
  stepLadder(c.moist,em,helpsMoist,ctx.dt);
  let moistVent=0,doas=0,dehu=0,desiccant=0,dxMoist=0;
  for(const r of c.moist.rungs)if(r.on){if(r.device==='vent')moistVent=r.stage;else if(r.device==='doas')doas=r.stage;else if(r.device==='dehu')dehu=r.stage;else if(r.device==='desiccant')desiccant=r.stage;else dxMoist=r.stage;}
  if(s.humidifierKgH>0&&c.humidifierSince>=MIN_TIME_S.humidifier){
    if(c.humidifierOn&&em>0){c.humidifierOn=false;c.humidifierSince=0;}
    else if(!c.humidifierOn&&em<-.5){c.humidifierOn=true;c.humidifierSince=0;}
  }
  c.humidifierSince+=ctx.dt;
  const evap=indirect||padOn;
  const variants=airVariants(ctx,{controlledACH:evap?s.maxVentACH:ventLevel(Math.max(coolVent,moistVent)),
    kind:indirect?'indirect':padOn?'pad':'outside',doasMode:doas>0?'conditioned':'none'});
  const plan={
    humidifier:(unheatedT,unhumidifiedW,k)=>c.humidifierOn?Math.min(s.humidifierKgH/3600,Math.max(0,(wMid+.5*half-state.w)/k.massGain)):0,
    heat:(unheatedT,k,recoverable)=>clamp((heatSetC-state.tempC)/heatBand,0,1)*(ctx.heatCapacityW+recoverable)};
  const candidates=variants.map(air=>evaluate(ctx,air,Math.max(dxCool,dxMoist)/2,dehu/2,desiccant/2,plan)).filter(Boolean);
  if(candidates.length<2)return candidates[0]||null;
  const selectRecovery=group=>{
    if(group.length<2)return group[0]||null;
    const active=group.find(candidate=>candidate.air.recoveryRequested==='active');
    const bypass=group.find(candidate=>candidate.air.recoveryRequested!=='active');
    if(!active||!bypass)return group[0];
    return untreatedSupplyUtility(ctx,bypass.air.supply,active.air.supply)>1e-12?bypass:active;
  };
  const capacityOnly=selectRecovery(candidates.filter(candidate=>!candidate.air.doasExcessBypass));
  const withExcess=selectRecovery(candidates.filter(candidate=>candidate.air.doasExcessBypass));
  if(!withExcess)return capacityOnly;
  return untreatedSupplyUtility(ctx,withExcess.air.supply,capacityOnly.air.supply)>1e-12?withExcess:capacityOnly;
}

function canonicalHours(snapshot) {
  const input=snapshot.hours;
  if(!Array.isArray(input)||!input.length)throw Error('Weather snapshot has no hours.');
  const sorted=input.slice().sort((a,b)=>a.time-b.time);
  if(sorted.some(h=>!Number.isFinite(h.time)))throw Error('Weather contains invalid timestamps.');
  const start=sorted[0].time,end=sorted.at(-1).time;
  if(end-start>HOUR*24*366*30)throw Error('Weather range exceeds the 30-year screening limit.');
  const byTime=new Map();
  for(const h of sorted){if((h.time-start)%HOUR!==0)throw Error('Weather intervals must share an hourly UTC alignment.');
    byTime.set(h.time,byTime.has(h.time)?{time:h.time,quality:['Duplicate timestamp; excluded.']}:h);}
  const hours=[];for(let time=start;time<=end;time+=HOUR)hours.push(byTime.get(time)||{time,quality:['Missing hourly interval.']});
  return hours;
}

function emptyLoads() {
  const loads={sensibleKWh:0,dxSensibleKWh:0,condensationKWh:0,storedKWh:0,latentKg:{},shr:null};
  for(const key of SENSIBLE_LOADS)loads[key]=0;
  for(const key of LATENT_LOADS)loads.latentKg[key]=0;
  return loads;
}
// Signed gains into zone air (+ = gain) from the same exchange terms the analytic step integrates.
function accumulateLoads(loads,picked,forcing,s,outside,averageT,averageW,dt) {
  const {k,air}=picked,scale=dt/KWH;
  loads.solarKWh+=forcing.solarW*scale;loads.lightKWh+=forcing.lightW*scale;
  loads.envelopeKWh+=k.ua*(outside.tempC-averageT)*scale;
  loads.infiltrationSensibleKWh+=CP*k.leak*(outside.tempC-averageT)*scale;
  loads.controlledOutdoorAirSensibleKWh+=CP*k.controlledFlow*(air.supply.tempC-averageT)*scale;
  loads.fanKWh+=picked.fanW*scale;loads.cropSensibleKWh+=s.cropSensibleWm2*s.canopyM2*scale;
  loads.cropLatentKWh-=L*forcing.cropKgS*scale;loads.humidifierKWh-=L*picked.humidifier*scale;
  loads.equipmentHeatKWh+=(picked.dehuHeatW+picked.sorptionW+picked.heaterW+picked.reheatW)*scale;
  loads.dxSensibleKWh+=picked.dxSensibleW*scale;loads.condensationKWh+=L*picked.condensate/KWH;
  const lk=loads.latentKg;
  lk.crop+=forcing.cropKgS*dt;lk.infiltration+=k.leak*(outside.w-averageW)*dt;
  lk.controlledOutdoorAir+=k.controlledFlow*(air.supply.w-averageW)*dt;lk.humidifier+=picked.humidifier*dt;
  lk.removed+=(picked.dxKgS+picked.dehuKgS+picked.desiccantKgS)*dt;lk.condensed+=picked.condensate;
}
function finishLoads(loads) {
  loads.sensibleKWh=SENSIBLE_LOADS.reduce((sum,key)=>sum+loads[key],0);
  const gains=SHR_GAINS.reduce((sum,key)=>sum+Math.max(0,loads[key]),0);
  const latentKWh=L*Math.max(0,loads.latentKg.crop)/KWH;
  loads.shr=gains+latentKWh>0?gains/(gains+latentKWh):null;
}

// screenBaseline: run the paired screen-open reference runs that make summary.screens attributable. It is
// set false inside those reference runs themselves, which is the only reason the option exists.
export function simulateScenario(scenario,snapshot,{stepMinutes=1,onProgress,screenBaseline=true}={}) {
  assertHistoricalWeather(snapshot);
  if(!Number.isFinite(stepMinutes)||stepMinutes<=0||stepMinutes>5||Math.abs(60/stepMinutes-Math.round(60/stepMinutes))>1e-9)
    throw Error('Integration step must divide one hour and be at most five minutes.');
  // Direct callers receive the same schema migration and completeness checks as worker and browser paths.
  // Clone first so migration and later capacity derates never mutate the caller's scenario.
  const declared=migrateScenario({...scenario});
  const scenarioErrors=validateScenario(declared);
  if(scenarioErrors.length)throw Error(`Scenario cannot be simulated: ${scenarioErrors.join(' ')}`);
  const s={...declared};
  const shade=resolveShadeScreen(s.shadeScreen),thermal=resolveThermalScreen(s.thermalScreen);
  // An insect screen restricts the outside-air path, so it lowers the achievable maximum exchange before any
  // control decision is taken. The declared minimum is a requirement rather than a capability and is left
  // alone; if the derate would fall below it, the maximum clamps to the minimum and the run says so.
  const insect=resolveInsectScreen(s.insectScreen);
  if(insect.installed&&insect.ventilationFactor<1){
    const derated=s.maxVentACH*insect.ventilationFactor;
    s.maxVentACH=Math.max(s.minVentACH,derated);
    insect.appliedACH=s.maxVentACH;
    insect.clampedToMinimum=derated<s.minVentACH-1e-9;
  }
  for(const t of [s.dayTargetC,s.nightTargetC])if(!moistureBounds(t,101325,s).feasible)throw Error('Temperature, VPD and dew-point targets have no joint moisture band.');
  const controlMode=s.controlMode==='ideal'?'ideal':'staged';
  const transpirationModel=s.transpirationModel==='schedule'?'schedule':'stanghellini';
  const input=canonicalHours(snapshot),hours=[],dt=stepMinutes*60,nSteps=Math.round(60/stepMinutes);
  if(s.heatRecovery.type!=='none'&&s.heatRecovery.frostControl==='none'){
    const below=input.find(h=>Number.isFinite(h.tempC)&&h.tempC<s.heatRecovery.minimumOutdoorOperatingC);
    if(below)throw Error(`Weather is below the heat-recovery minimum outdoor operating temperature of ${s.heatRecovery.minimumOutdoorOperatingC} C. Configure explicit frost control before simulation.`);
  }
  const needsSolar=s.solarTransmission>0||s.parTransmission>0;
  const canopySunShare=s.canopyM2>0?Math.min(1,s.areaM2/s.canopyM2):0;
  const warnings=[
    'Coarse component-based statistical screening, not a calibrated greenhouse digital twin or a guarantee of indoor conditions.',
    `${stepMinutes}-minute internal control steps with hourly source weather and analytic linear exchange, frozen dry-air inventory per segment. Constant cp=1006 J/kg K and latent heat=2.45 MJ/kg; liquid sensible heat and vapor heat capacity are omitted.`,
    'Capacity, COP, SHR and ideal part-load scaling are declared assumptions, not manufacturer performance maps. DX assumes a 7 C coil moisture floor and a 10 C indoor cutoff; condensing dehu operates only from 10 to 40 C.',
    transpirationModel==='stanghellini'?
      'Crop moisture follows the Stanghellini transpiration model (Vanthoor 2011 §8.9 form, GreenLight implementation) from zone VPD, leaf area index and shortwave absorbed by the canopy, with canopy temperature taken equal to zone air temperature. No leaf energy balance, CO2 response or crop stage dynamics. All fixture electricity becomes indoor heat; crop evaporation subtracts latent energy, including when this creates heating demand.':
      'Crop moisture is a declared L/m²/day schedule, dark-hour rate relative to a lit hour. All fixture electricity becomes indoor heat; crop evaporation subtracts latent energy, including when this creates heating demand.',
    'Pad supply uses approximately conserved PsychroLib enthalpy; pad liquid-water enthalpy is neglected. Fan heat is assigned indoors; pad pump heat is assigned outside. Humidifier is ideal adiabatic, with no auxiliary electrical power.',
    'Each continuous weather segment initializes at its current temperature target and midpoint target moisture. Its first hour is warm-up, excluded from comparative compliance. Gaps end the trajectory; no missing forcing is fabricated.',
    controlMode==='staged'?
      'Staged causal controller: each loop acts on the measured zone state with ordered stages (ventilation, evaporative, DX; ventilation, DOAS, dehumidifier, desiccant, DX for moisture), a deadband per stage and minimum on/off times (ventilation 2 min, pad 5 min, DX/dehumidifier/desiccant/DOAS 10 min, humidifier 5 min), proportional heating. It is not cost-optimized; the ideal modulation dispatcher is available as an upper bound.':
      'Ideal modulation upper bound: controller enumerates finite airflow and device duty combinations each substep, minimizes joint target excursion first and instantaneous manual-price operating cost second. Not a causal controller and not a guaranteed global economic optimum.',
    controlMode==='staged'?
      'Control cadence check, six Tulsa example strategies on synthetic diurnal fixtures: halving 1-minute control steps to 30 seconds changed purchased electricity by at most 1% and attainment by at most 0.6 percentage points over 48 hours (1.0 point for the integrated case on the hottest fixture), and by at most 0.8% and 0.4 points over 10 days. Deadband control keeps a phase sensitivity at setpoint transitions; these sample differences are not universal error bars.':
      'Control cadence is a substantive assumption for the ideal dispatcher: halving 1-minute dispatch to 30 seconds in four seasonal two-day checks changed attainment by up to 4.1 percentage points and electricity by up to 23.5%. Use the staged controller for converged comparisons.',
    'DLI lighting is causal from current sunlight and accumulated local-day photons. Solar assumes 2.02 µmol/J GHI before optical transmission, with finite footprint photons shared across stacked canopy; benches receive local irradiance without a concentrator. No future weather is used. DST days retain actual elapsed hours.',
    'Compliance samples substep-end states, not continuous canopy conditions. Surface condensation is an ideal instantaneous equilibrium drain; no spatial surfaces, condensate reuse, or frost behavior beyond the declared heat-recovery control is modeled.'
  ];
  if(s.desiccantKgH>0)warnings.push('Generic desiccant assumptions only: 2 to 50 C indoor operating bounds, fixed moisture capacity, latent-equivalent sorption heat, explicit indoor sorption fraction, and purchased regeneration split fuel/electric. Regeneration and exported sorption heat reject outdoors. Hybrid indirect evaporation uses a separate wet secondary stream and ideal latent-equivalent water, not certified liquid-desiccant product performance.');
  if(insect.installed)warnings.push(`Insect screen derates the maximum outside-air exchange by a factor of ${insect.ventilationFactor} to ${s.maxVentACH.toFixed(2)} ACH${insect.clampedToMinimum?', clamped up to the declared minimum, so the screened capacity is below the ventilation the scenario requires':''}. The factor is ${insect.basis}, measured relative to a 40-mesh screened house and NOT to an unscreened one, so it cannot price the first screen. No optical or thermal effect of the mesh is modeled.`);
  if(s.doasM3s>0)warnings.push(`Generic DOAS conditions selected controlled outdoor air after optional recovery toward a ${s.doasSupplyTempC} C supply temperature and ${s.doasSupplyDewPointC} C dew point. Cooling uses moist-air enthalpy at COP ${s.doasCoolingCOP}; condenser reheat recovery is limited to fraction ${s.doasReheatRecoveryFraction}. Treatment capacity is ${s.doasM3s} m3/s, and any useful excess remains an untreated bypass within the same controlled-air stream. Fan power uses one combined controlled-air fan basis, so treatment never adds airflow or a second fan charge. Exclusions include cycling, frost, duct, drain, and separate process-fan performance beyond declared inputs. Finite heat can leave the achieved supply short of its target. Brand-agnostic assumption, not product data.`);
  warnings.push(...componentWarnings(s,shade,thermal,s.heatSource==='heatpump'&&!heatPumpConfigured(s)?'incomplete':'ok'));
  // Envelope provenance follows the template the scenario still matches. Two of the ladder entries have no
  // sourced PAR or total-shortwave transmission at all, so a run that keeps their placeholder optics says so.
  const template=FACILITY_TEMPLATES[s.facility]||null;
  const envelope={facility:s.facility,uValue:s.uValue,envelopeRatio:s.envelopeRatio,infiltrationACH:s.infiltrationACH,
    parTransmission:s.parTransmission,solarTransmission:s.solarTransmission,
    templateSource:template?.source??null,opticalBasis:template?.opticalBasis??'user-declared',
    matchesTemplate:template?['uValue','parTransmission','solarTransmission','infiltrationACH'].every(key=>s[key]===template[key]):false};
  if(template?.opticalBasis==='placeholder'&&s.parTransmission===template.parTransmission&&s.solarTransmission===template.solarTransmission)
    warnings.push(`PAR and total-shortwave transmission for the ${s.facility} envelope are UNSOURCED in the component evidence: this run carries the tool's generic 0.65 placeholder, which is not a property of that glazing. Vendor luminous transmission and SHGC are different quantities and were not substituted. Replace both with measured values before reading any light or solar-gain figure as a glazing result.`);
  let state=null,controller=null,lightDate=null,accumulatedDLI=0,gapCount=0,unsupportedRecoveryFlow=false;
  for(let index=0;index<input.length;index++) {
    const weather=input[index],outside=weatherState(weather,needsSolar),classification=classifyWeather(weather,s);
    const row={time:weather.time,valid:false,eligible:false,compliantFraction:null,tempC:null,rh:null,vpd:null,
      mode:'MISSING_DATA',reason:'Missing or invalid meteorology or solar. Continuous state reset.',weatherMode:classification.weatherMode,
      opportunity:classification.opportunity??null,capability:classification.capability??null,operation:null,weatherFlags:classification.flags,padTempC:classification.padTempC??null,padDewPointC:classification.padDewPointC??null,
      wetBulbC:classification.wetBulbC??null,outdoorTempC:weather.tempC??null,outdoorRH:weather.rh??null,outdoorDrying:outdoorDryingHour(weather,s,classification),
      quality:weather.quality||[],energyResidualW:null,moistureResidualKgS:null};
    for(const key of TOTALS)row[key]=0;
    if(!outside){state=null;controller=null;gapCount++;hours.push(row);continue;}
    const initialTarget=schedule(weather.time,s);
    row.isDay=initialTarget.isDay;row.localDate=initialTarget.date;row.targetC=initialTarget.targetC;
    row.warmup=!state;
    if(!state){
      const b=moistureBounds(initialTarget.targetC,outside.pressurePa,s),w=(b.minW+b.maxW)/2;
      const mass=dryAirDensity(initialTarget.targetC,w,outside.pressurePa)*s.areaM2*s.heightM;
      state={tempC:initialTarget.targetC,w,mass,capacity:s.areaM2*s.thermalMassKJm2K*1000+mass*CP};
      controller=controlMode==='staged'?stagedController(s):null;
    }
    let compliant=0,maxEnergyResidual=0,maxMoistureResidual=0,failed=false;
    const modeCounts={},controls={controlledACH:0,controlledM3s:0,controlledACHMin:null,controlledACHMax:null,controlledACHStages:[],
      totalOutdoorACH:0,totalOutdoorM3s:0,totalOutdoorACHMin:null,totalOutdoorACHMax:null,
      recoveryCoreFraction:0,recoveryBypassFraction:0,recoveryDefrostFraction:0,preheatFraction:0,
      padFraction:0,indirectFraction:0,dxDuty:0,dehuDuty:0,desiccantDuty:0,doasConditionedFraction:0,doasTreatmentM3s:0,heaterDuty:0,humidifierFraction:0,lightFraction:0,enrichmentFraction:0,shadeFraction:0,thermalScreenFraction:0};
    const loads=emptyLoads(),startTempC=state.tempC,startW=state.w;
    const controlledStageHours=new Map();
    const dayContributions=new Map();
    const hour=hourContext(outside,s,shade,thermal);
    for(let sub=0;sub<nSteps;sub++) {
      const target=schedule(weather.time+(sub+.5)*dt*1000,s);
      if(lightDate!==target.date){lightDate=target.date;accumulatedDLI=0;}
      const irradiance=needsSolar?weather.ghiWm2:0;
      // Screen positions are decided on the measured hour and the causal accumulated-DLI state, before any
      // of this substep's own photons are counted. A shut shade screen multiplies crop photons and sensible
      // solar gain by its own two multipliers, which are equal unless the user supplied product spectra.
      const shadeOn=shadeDeployed(shade,irradiance,outside.tempC,Math.max(0,s.dliTarget-accumulatedDLI));
      const thermalOn=thermalDeployed(thermal,outside.tempC,target.isDay);
      const parMultiplier=(shadeOn?shade.parMultiplier:1)*(thermalOn?thermal.parMultiplier:1);
      const solarMultiplier=(shadeOn?shade.solarMultiplier:1)*(thermalOn?thermal.solarMultiplier:1);
      const transmittedWm2=irradiance*s.solarTransmission*(1-s.shadeFraction)*solarMultiplier;
      const solarPPFD=irradiance*2.02*s.parTransmission*(1-s.shadeFraction)*parMultiplier*canopySunShare;
      const solarDLI=solarPPFD*dt/1e6;
      // Use only remaining time in this civil day, including crossing-midnight programs. The window must not
      // be padded: spreading the remaining deficit over more time than is left under-delivers by half a step
      // every step, which left a fixture with ample capacity short of its target on every single day and
      // reported the crop as light-deficient. The floor is one step, so the final step asks for exactly the
      // outstanding deficit and the fixture cap still decides what arrives.
      const remaining=target.isDay?Math.max(dt/3600,Math.min(target.remainingLitHours,24-target.hour)):0;
      const requestedPPFD=target.isDay?Math.max(0,(s.dliTarget-accumulatedDLI)*1e6/(remaining*3600)-solarPPFD):0;
      const deliveredPPFD=Math.min(s.lightWm2*s.efficacy*s.lightDelivery,requestedPPFD);
      const lightW=s.canopyM2>0?deliveredPPFD*s.canopyM2/(s.efficacy*s.lightDelivery):0;
      const lightDLI=s.canopyM2>0?deliveredPPFD*dt/1e6:0;
      // Crop moisture: state-coupled Stanghellini from the current zone state and shortwave absorbed by the
      // canopy (Beer-Lambert on solar through the envelope plus fixture electrical power per m2 canopy times the delivery
      // fraction). The fixture term is electric input, not radiant PAR, which is roughly 55% of it for an LED; the
      // radiation factor rfR saturates above a few tens of W/m2, so the overstatement moves transpiration by about 1%.
      // Or the declared schedule.
      const cropKgS=transpirationModel==='stanghellini'?
        s.canopyM2*stanghelliniTranspiration(state.tempC,state.w,outside.pressurePa,
          canopyAbsorbedWm2(transmittedWm2*canopySunShare+(s.canopyM2>0?lightW/s.canopyM2:0)*s.lightDelivery,s.lai),s.lai):
        target.cropKgS;
      const forcing={solarW:transmittedWm2*s.areaM2*s.solarHeatFraction,lightW,cropKgS};
      const ctx=substepContext(hour,state,forcing,target,dt,thermalOn);
      const picked=controller?chooseStaged(ctx,controller):chooseIdeal(ctx);
      if(!picked){failed=true;break;}
      const k=picked.k;
      // Independent integral from the analytic average state, not residual := 0.
      const averageT=k.conductance>0?(state.tempC*(1-k.heatDecay)/(k.conductance*dt/state.capacity)+
        (k.heatSource+picked.q)/k.conductance*(1-(1-k.heatDecay)/(k.conductance*dt/state.capacity))):(state.tempC+picked.rawT)/2;
      const averageW=k.massFlow>0?(state.w*(1-k.massDecay)/(k.massFlow*dt/state.mass)+
        (k.wetSource+picked.moistureSource)/k.massFlow*(1-(1-k.massDecay)/(k.massFlow*dt/state.mass))):(state.w+picked.rawW)/2;
      const sensibleJ=(k.heatSource+picked.q-k.conductance*averageT)*dt;
      const moistureKg=(k.wetSource+picked.moistureSource-k.massFlow*averageW)*dt;
      const energyResidual=(state.capacity*(picked.tempC-state.tempC)-sensibleJ-L*picked.condensate)/dt;
      const moistureResidual=(state.mass*(picked.w-state.w)-moistureKg+picked.condensate)/dt;
      maxEnergyResidual=Math.max(maxEnergyResidual,Math.abs(energyResidual));maxMoistureResidual=Math.max(maxMoistureResidual,Math.abs(moistureResidual));
      if(!Number.isFinite(energyResidual+moistureResidual)||Math.abs(energyResidual)>Math.max(1,.001*Math.abs(picked.q))||Math.abs(moistureResidual)>1e-7){failed=true;break;}
      const scale=dt/KWH;
      row.electricKWh+=picked.electricW*scale;row.fuelKWh+=picked.fuelW*scale;row.waterL+=picked.waterKgS*dt;
      row.lightKWh+=lightW*scale;row.solarDLI+=solarDLI;row.lightDLI+=lightDLI;
      row.heatingKWh+=picked.heaterW*scale;row.heatPumpElectricKWh+=(picked.heaterElectricW+picked.preheatElectricW+picked.doasExternalElectricW)*scale;row.coolingKWh+=picked.dxTotalW*scale;
      row.dehuKWh+=picked.dehuW*scale;row.dehuHeatKWh+=picked.dehuHeatW*scale;row.dehuRejectedHeatKWh+=(picked.dehuRejectedW||0)*scale;
      row.regenerationKWh+=picked.regenW*scale;row.regenerationElectricKWh+=picked.regenElectricW*scale;row.regenerationFuelKWh+=picked.regenFuelW*scale;
      row.desiccantRemovedKg+=picked.desiccantKgS*dt;row.desiccantHeatKWh+=picked.sorptionW*scale;
      row.desiccantExportedHeatKWh+=picked.desiccantExportedW*scale;row.reheatKWh+=picked.reheatW*scale;row.rejectedHeatKWh+=picked.rejectedW*scale;
      row.surfaceCondensateKg+=picked.condensate;
      row.condensateKg+=(picked.dxKgS+picked.dehuKgS+picked.doasCondensateKgS)*dt+picked.condensate;
      row.cropWaterL+=cropKgS*dt;row.padWaterL+=picked.padKgS*dt;row.humidifierWaterL+=picked.humidifier*dt;
      row.doasCondensateKg+=picked.doasCondensateKgS*dt;
      row.doasCoolingDeliveredKWh+=picked.doasCoolingDeliveredW*scale;row.doasCoolingElectricKWh+=picked.doasCoolingElectricW*scale;
      row.doasRecoveredReheatKWh+=picked.doasRecoveredReheatW*scale;row.doasExternalHeatKWh+=picked.doasExternalHeatW*scale;
      row.doasUnmetConditioningKWh+=picked.doasUnmetConditioningW*scale;
      row.recoverySensibleKWh+=picked.air.recovery.sensibleTransferW*scale;
      row.recoveryLatentKWh+=picked.air.recovery.latentTransferW*scale;
      row.recoveryAuxKWh+=picked.air.recovery.auxiliaryW*scale;
      if(picked.air.recoveryConfigured){
        row.recoveryCoreM3+=picked.air.recovery.coreFlowM3s*dt;
        row.recoveryBypassM3+=picked.air.recovery.bypassFlowM3s*dt;
      }
      row.recoveryDefrostHours+=picked.air.recovery.defrostFraction*dt/3600;
      row.preheatDeliveredKWh+=picked.air.recovery.preheatDeliveredW*scale;
      row.preheatElectricKWh+=picked.preheatElectricW*scale;row.preheatFuelKWh+=picked.preheatFuelW*scale;
      row.preheatInsufficientHours+=(picked.air.recovery.preheatInsufficient?dt/3600:0);
      if(picked.air.recovery.unsupportedFlow)unsupportedRecoveryFlow=true;
      row.unmetSensibleKWh+=picked.unmetSensibleW*scale;row.unmetMoistureKg+=picked.unmetMoistureKgS*dt;
      row.tempDegreeHours+=picked.temperatureMiss*dt/3600;row.vpdKPaHours+=picked.moistureMiss*dt/3600;
      row.peakCoolingKW=Math.max(row.peakCoolingKW||0,(picked.dxTotalW+picked.doasCoolingDeliveredW)/1000);row.peakElectricKW=Math.max(row.peakElectricKW||0,picked.electricW/1000);
      accumulateLoads(loads,picked,forcing,s,outside,averageT,averageW,dt);
      controls.controlledACH+=picked.air.controlledACH/nSteps;controls.controlledM3s+=picked.air.controlledM3s/nSteps;
      controls.totalOutdoorACH+=(ctx.infiltrationACH+picked.air.controlledACH)/nSteps;
      controls.totalOutdoorM3s+=(s.areaM2*s.heightM*ctx.infiltrationACH/3600+picked.air.controlledM3s)/nSteps;
      const stageHours=dt/3600,totalOutdoorACH=ctx.infiltrationACH+picked.air.controlledACH;
      controls.controlledACHMin=controls.controlledACHMin===null?picked.air.controlledACH:Math.min(controls.controlledACHMin,picked.air.controlledACH);
      controls.controlledACHMax=controls.controlledACHMax===null?picked.air.controlledACH:Math.max(controls.controlledACHMax,picked.air.controlledACH);
      controls.totalOutdoorACHMin=controls.totalOutdoorACHMin===null?totalOutdoorACH:Math.min(controls.totalOutdoorACHMin,totalOutdoorACH);
      controls.totalOutdoorACHMax=controls.totalOutdoorACHMax===null?totalOutdoorACH:Math.max(controls.totalOutdoorACHMax,totalOutdoorACH);
      controlledStageHours.set(picked.air.controlledACH,(controlledStageHours.get(picked.air.controlledACH)||0)+stageHours);
      controls.recoveryCoreFraction+=picked.air.recoveryCoreFraction/nSteps;
      controls.recoveryBypassFraction+=picked.air.recoveryBypassFraction/nSteps;
      controls.recoveryDefrostFraction+=picked.air.recovery.defrostFraction/nSteps;
      controls.preheatFraction+=(picked.air.recovery.preheatDeliveredW>0?1:0)/nSteps;
      controls.padFraction+=(picked.air.kind==='pad'?1:0)/nSteps;controls.indirectFraction+=(picked.air.kind==='indirect'?1:0)/nSteps;
      controls.dxDuty+=picked.dxDuty/nSteps;controls.dehuDuty+=picked.dehuDuty/nSteps;controls.desiccantDuty+=picked.desiccantDuty/nSteps;
      controls.doasConditionedFraction+=(picked.air.treatment.treatmentM3s>0?1:0)/nSteps;
      controls.doasTreatmentM3s+=picked.air.treatment.treatmentM3s/nSteps;
      controls.heaterDuty+=(s.heaterKW>0?picked.heaterW/(s.heaterKW*1000):0)/nSteps;controls.humidifierFraction+=(picked.humidifier>0?1:0)/nSteps;controls.lightFraction+=(forcing.lightW>0?1:0)/nSteps;
      controls.enrichmentFraction+=(picked.air.controlledACH<=s.minVentACH+1e-9&&picked.air.kind==='outside'?1:0)/nSteps;
      controls.shadeFraction+=(shadeOn?1:0)/nSteps;controls.thermalScreenFraction+=(thermalOn?1:0)/nSteps;
      const mode=picked.dxTotalW>0?'DX_COOL_DEHUMIDIFY':picked.desiccantKgS>0?'DESICCANT_REGENERATION':picked.dehuKgS>0?'CONDENSING_DEHUMIDIFY':picked.doasCondensateKgS>0?'DOAS_DEHUMIDIFY':
        picked.doasCoolingDeliveredW>0||picked.doasExternalHeatW>0?'DOAS_CONDITIONING':picked.heaterW>0?'HEATING':picked.air.kind==='indirect'?'INDIRECT_EVAP_COOL':picked.air.kind==='pad'?'PAD_COOLING':picked.humidifier>0?'HUMIDIFY':picked.air.controlledACH>s.minVentACH?'VENTILATION':'MINIMUM_AIR';
      modeCounts[mode]=(modeCounts[mode]||0)+1;
      if(picked.violation<=1e-7)compliant++;
      if(!dayContributions.has(target.date))dayContributions.set(target.date,{date:target.date,start:weather.time+sub*dt*1000,end:0,hours:0,solarDLI:0,lightDLI:0,compliantHours:0});
      const contribution=dayContributions.get(target.date);
      contribution.end=weather.time+(sub+1)*dt*1000;contribution.hours+=dt/3600;
      contribution.solarDLI+=solarDLI;contribution.lightDLI+=lightDLI;
      if(picked.violation<=1e-7)contribution.compliantHours+=dt/3600;
      accumulatedDLI+=solarDLI+lightDLI;
      state.tempC=picked.tempC;state.w=picked.w;
    }
    if(failed){
      row.numericalFailure=true;row.reason='Numerical or physical domain failure; interval excluded and state reset.';
      row.mode='NUMERICAL_FAILURE';row.energyResidualW=maxEnergyResidual;row.moistureResidualKgS=maxMoistureResidual;state=null;controller=null;
      for(const key of TOTALS)row[key]=null;
    }else{
      row.operation={pad:{equivalentHours:controls.padFraction,operated:controls.padFraction>0},modeEquivalentHours:Object.fromEntries(Object.entries(modeCounts).map(([mode,count])=>[mode,count/nSteps]))};
      controls.controlledACHStages=[...controlledStageHours].sort((a,b)=>a[0]-b[0]).map(([ach,hours])=>({ach,hours}));
      loads.storedKWh=state.capacity*(state.tempC-startTempC)/KWH;loads.latentKg.stored=state.mass*(state.w-startW);
      finishLoads(loads);
      row.dayContributions=[...dayContributions.values()];
      Object.assign(row,{valid:true,eligible:!row.warmup,tempC:state.tempC,humidityRatio:state.w,rh:relativeHumidity(state.tempC,state.w,outside.pressurePa),
        dewPointC:dewPoint(state.tempC,state.w,outside.pressurePa),vpd:airVPD(state.tempC,state.w,outside.pressurePa),
        compliantFraction:row.warmup?null:compliant/nSteps,mode:Object.keys(modeCounts).sort((a,b)=>modeCounts[b]-modeCounts[a])[0],controls,loads,
        reason:row.warmup?'Segment initialization hour, excluded from comparative compliance.':compliant===nSteps?'All sampled substeps meet the joint target under assumed component performance.':'Finite installed controls cannot meet the joint target in every sampled substep.',
        energyResidualW:maxEnergyResidual,moistureResidualKgS:maxMoistureResidual});
    }
    hours.push(row);
    if(onProgress&&(index%24===0||index===input.length-1))onProgress((index+1)/input.length);
  }
  if(snapshot.hours.some(hour=>!hour.moisture))warnings.push('Legacy input: historical PsychroLib phase conventions are assumed for unannotated moisture values; provider provenance is unconfirmed.');
  if(gapCount)warnings.push(`${gapCount} missing/invalid weather hours break continuous operation. Each subsequent segment restarts with an excluded warm-up hour. Incomplete local days do not enter DLI deficit-day counts.`);
  if(unsupportedRecoveryFlow)warnings.push('Selected controlled airflow fell below 50% of heat-recovery nominal flow. The core was bypassed because its rating is unsupported below that limit.');
  const summary=summarizeHours(hours,s);
  summary.controlModeUsed=controlMode;summary.transpirationModelUsed=transpirationModel;
  // metrics.js aggregates a fixed field list, so the component totals are accumulated here from the same rows.
  const total=field=>hours.reduce((sum,h)=>sum+(h.valid&&Number.isFinite(h[field])?h[field]:0),0);
  const runtimeOf=field=>{
    const days=new Set();let runHours=0,equivalentHours=0;
    for(const h of hours){const duty=h.valid&&h.controls?h.controls[field]||0:0;
      if(duty>1e-9){runHours++;equivalentHours+=duty;days.add(localClock(h.time,s.timezone).date);}}
    return {hours:runHours,equivalentHours,days:days.size};
  };
  summary.heatPumpElectricKWh=total('heatPumpElectricKWh');
  summary.runtime.shadeScreen=runtimeOf('shadeFraction');
  summary.runtime.thermalScreen=runtimeOf('thermalScreenFraction');
  // Attribution by differencing against the same weather, controller and crop with that one screen forced
  // open. It is the only honest way to separate "light the shade cost" from "light the weather did not give"
  // and "heat the curtain saved" from "heat this winter did not need", because both screens change the whole
  // trajectory. The reference runs are skipped when a caller opts out, and the figures are then null.
  const screens={shadeHours:summary.runtime.shadeScreen.hours,shadeDays:summary.runtime.shadeScreen.days,
    thermalHours:summary.runtime.thermalScreen.hours,thermalDays:summary.runtime.thermalScreen.days,
    dliCostMol:shade.installed?null:0,heatingSavedKWh:thermal.installed?null:0,
    basis:'Differenced against an otherwise identical run with that screen forced open.'};
  if(screenBaseline&&shade.installed){
    const open=simulateScenario({...declared,shadeScreen:{...declared.shadeScreen,installed:false}},snapshot,{stepMinutes,screenBaseline:false});
    screens.dliCostMol=open.hours.reduce((sum,h)=>sum+(h.valid?h.solarDLI:0),0)-total('solarDLI');
  }
  if(screenBaseline&&thermal.installed){
    const open=simulateScenario({...declared,thermalScreen:{...declared.thermalScreen,installed:false}},snapshot,{stepMinutes,screenBaseline:false});
    screens.heatingSavedKWh=open.summary.heatingKWh-summary.heatingKWh;
  }
  if(!screenBaseline&&(shade.installed||thermal.installed))screens.basis='Screen-open reference runs were not executed for this run, so the attributed light cost and heating saving are null.';
  summary.screens=screens;
  if(summary.numericalFailureHours)warnings.push(`${summary.numericalFailureHours} numerical/physical domain failures: favorable economic ranking is prohibited.`);
  const airflowAssumptions={
    controlledOutdoorAir:'One controlled supply stream; infiltration is separate and no treatment adds outdoor airflow.',
    balancedRecoveryFlow:true,
    supportedRecoveryFlowFraction:{minimum:.5,maximum:1.3},
    ratingInputs:'Sensible and latent effectiveness and auxiliary power are project or manufacturer inputs; no product-family performance is inferred.',
    excessFlow:'Above 130% nominal flow, core flow is capped and the excess is mixed once as untreated bypass air.',
    effectivenessBetweenRatings:'Linear in flow ratio between the 75% and 100% ratings, extrapolated on the same line from 50% to 130% of nominal flow and clamped to 0 to 1.',
    massFlowBasis:'Pad and indirect evaporative streams are converted to mass flow at supply-side air density; plain ventilation at outdoor density, for the same declared m3/s.',
    doas:s.doasM3s>0?{
      supplyTempC:s.doasSupplyTempC,supplyDewPointC:s.doasSupplyDewPointC,coolingCOP:s.doasCoolingCOP,
      reheatRecoveryFraction:s.doasReheatRecoveryFraction,treatmentCapacityM3s:s.doasM3s,
      treatmentOrder:'Outdoor air, optional heat recovery, optional DOAS, zone.',
      fanBasis:'One combined controlled-air fan power basis; treatment does not add airflow.',
      exclusions:'No cycling, frost, duct, drain, or separate process-fan performance beyond declared inputs.',
    }:null,
  };
  return {weatherSnapshotId:snapshot.id ?? null,scenario:s,hours,summary,weatherSummary:weatherSummary(hours,s),warnings,modelVersion:MODEL_VERSION,controlModeUsed:controlMode,transpirationModelUsed:transpirationModel,
    assumptions:{moistureConversionVersion:MOISTURE_VERSION,legacyMoistureConvention:snapshot.hours.some(hour=>!hour.moisture),evidenceTier:'Assumption-based component screening',stepMinutes,warmupHoursPerSegment:1,lightSolarConversionUmolJ:2.02,
      controlModeUsed:controlMode,transpirationModelUsed:transpirationModel,
      canopyTemperature:transpirationModel==='stanghellini'?'Equal to zone air temperature (declared simplification, no leaf energy balance).':null,
      leafAreaIndex:transpirationModel==='stanghellini'?s.lai:null,
      ...componentAssumptions(s,shade,thermal),envelope,airflow:airflowAssumptions,
      screenAttribution:screens.basis,
      cpJkgK:CP,latentHeatJkg:L,psychrolibVersion:'2.5.0',psychrolibCommit:'a42717d24ed08534642d6caf7dcbbf72b9510bea'}};
}

// Explicit repeated runs keep sensitivity transparent and avoid a second solver.
export function sensitivity(scenario,snapshot,cases=[
  ...(scenario.transpirationModel==='schedule'||!(scenario.lai>0)?[
    {name:'Lower crop moisture',changes:{transpirationLDayM2:scenario.transpirationLDayM2*.75}},
    {name:'Higher crop moisture',changes:{transpirationLDayM2:scenario.transpirationLDayM2*1.25}}]:[
    {name:'Lower crop moisture',changes:{lai:scenario.lai*.75}},
    {name:'Higher crop moisture',changes:{lai:scenario.lai*1.25}}]),
  {name:'Lower pad effectiveness',changes:{padEffectiveness:Math.round(Math.max(0,scenario.padEffectiveness-.1)*100)/100}},
  {name:'Higher pad effectiveness',changes:{padEffectiveness:Math.round(Math.min(1,scenario.padEffectiveness+.1)*100)/100}}
]) {
  return cases.map(({name,changes})=>{const result=simulateScenario({...scenario,...changes,name},snapshot);return {name,changes,summary:result.summary,weatherSummary:result.weatherSummary};});
}
