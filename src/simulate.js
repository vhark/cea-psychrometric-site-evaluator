import {MODEL_VERSION,backfillScenario,FACILITY_TEMPLATES} from './config.js';
import {CP_DRY_AIR as CP,LATENT_HEAT as L,clamp,humidityRatio,saturationHumidityRatio,saturationPressure,
  vaporPressure,relativeHumidity,dewPoint,airVPD,dryAirDensity,padState,weatherState,schedule,moistureBounds,classifyWeather,outdoorDryingHour,
  stanghelliniTranspiration,canopyAbsorbedWm2,localClock} from './physics.js';
import {resolveShadeScreen,resolveThermalScreen,shadeDeployed,thermalDeployed,heatSourceState,heatPumpConfigured,
  componentWarnings,componentAssumptions} from './screens.js';
import {summarizeHours,weatherSummary} from './metrics.js';

const HOUR=3600000,KWH=3600000;
const TOTALS=['electricKWh','fuelKWh','waterL','condensateKg','lightKWh','solarDLI','lightDLI','heatingKWh','heatPumpElectricKWh','coolingKWh',
  'dehuKWh','dehuHeatKWh','unmetSensibleKWh','unmetMoistureKg','regenerationKWh','regenerationElectricKWh','regenerationFuelKWh',
  'desiccantRemovedKg','desiccantHeatKWh','desiccantExportedHeatKWh','reheatKWh','rejectedHeatKWh','surfaceCondensateKg',
  'cropWaterL','padWaterL','humidifierWaterL','tempDegreeHours','vpdKPaHours','doasKWh','doasRemovedKg'];
const SENSIBLE_LOADS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','ventilationSensibleKWh','fanKWh','cropSensibleKWh','cropLatentKWh','humidifierKWh','equipmentHeatKWh'];
const LATENT_LOADS=['crop','infiltration','ventilation','doas','humidifier','removed','condensed','stored'];
const SHR_GAINS=['solarKWh','lightKWh','envelopeKWh','infiltrationSensibleKWh','ventilationSensibleKWh','fanKWh','cropSensibleKWh'];

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
  const flow=dryAirDensity(air.tempC,air.w,outside.pressurePa)*volume*air.ach/3600;
  const doasFlow=air.doasDuty>0?dryAirDensity(air.doasTempC,air.doasW,outside.pressurePa)*s.doasM3s*air.doasDuty:0;
  const massFlow=leak+flow+doasFlow;
  const ua=ctx.ua;
  const conductance=ua+CP*massFlow;
  const massDecay=Math.exp(-massFlow*dt/state.mass);
  const massGain=massFlow>0?-Math.expm1(-massFlow*dt/state.mass)/massFlow:dt/state.mass;
  const heatDecay=Math.exp(-conductance*dt/state.capacity);
  const heatGain=conductance>0?-Math.expm1(-conductance*dt/state.capacity)/conductance:dt/state.capacity;
  return {flow,leak,doasFlow,massFlow,ua,conductance,massDecay,massGain,heatDecay,heatGain,
    wetSource:leak*outside.w+flow*air.w+doasFlow*air.doasW,
    heatSource:(ua+CP*leak)*outside.tempC+CP*flow*air.tempC+CP*doasFlow*air.doasTempC};
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

// Per-hour outdoor-dependent quantities shared by both controllers, including this hour's heating source:
// a fuel heater delivers its full rating, a heat pump delivers a derated capacity at an interpolated COP,
// and a locked-out heat pump delivers nothing at all.
function hourContext(outside,s,shade,thermal) {
  const pad=outside.tempC>2?padState(outside.tempC,outside.w,outside.pressurePa,s.padEffectiveness):null;
  const heat=heatSourceState(s,outside.tempC);
  return {outside,s,pad,shade,thermal,indirectTempC:pad?outside.tempC-s.hybridEvapEffectiveness*(outside.tempC-pad.wetBulbC):null,
    dryFloor:humidityRatio(0,.05,outside.pressurePa),coilFloorW:saturationHumidityRatio(7,outside.pressurePa),
    dxOutdoorOK:outside.tempC>=s.coolingMinOutdoorC&&outside.tempC<=s.coolingMaxOutdoorC,
    heatCapacityW:heat.capacityW,heatCOP:heat.cop,heatMode:heat.mode,uaOpen:s.areaM2*s.envelopeRatio*s.uValue,
    doasTempC:s.doasSupplyTempC,doasW:Math.min(outside.w,saturationHumidityRatio(s.doasSupplyDewPointC,outside.pressurePa))};
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
  return {...hour,state,forcing,target,dt,dxAvailable,dxMoisture:dxAvailable*(1-s.coolingSHR)/L,dxSense:dxAvailable*s.coolingSHR,
    thermalClosed,ua:thermalClosed?hour.uaOpen*hour.thermal.uValueFactor:hour.uaOpen,
    infiltrationACH,ventCapACH:cap===null?null:Math.max(0,cap-infiltrationACH),
    dehuAvailable:state.tempC>=10&&state.tempC<=40?s.dehuKgH/3600:0,desiccantAvailable:state.tempC>=2&&state.tempC<=50?s.desiccantKgH/3600:0};
}
function airOption(ctx,ach,kind,doasDuty) {
  const {outside,pad}=ctx;
  const tempC=kind==='pad'?pad.tempC:kind==='indirect'?ctx.indirectTempC:outside.tempC;
  return {ach,tempC,w:kind==='pad'?pad.w:outside.w,pad:kind==='pad',indirect:kind==='indirect',doasDuty,doasTempC:ctx.doasTempC,doasW:ctx.doasW};
}
// A shut curtain with a declared gap exchange cannot pass the airflow the ladder asked for.
const cappedAir=(ctx,air)=>ctx.ventCapACH===null||air.ach<=ctx.ventCapACH?air:{...air,ach:ctx.ventCapACH};
function airOptions(ctx) {
  const {s,pad}=ctx;
  const levels=[...new Set([s.minVentACH,(s.minVentACH+s.maxVentACH)/2,s.maxVentACH])];
  const doasDuties=s.doasM3s>0?[0,.5,1]:[0];
  const options=[];
  for(const doasDuty of doasDuties)for(const ach of levels){
    options.push(airOption(ctx,ach,'outside',doasDuty));
    if(ach>0&&s.padEnabled&&pad)options.push(airOption(ctx,ach,'pad',doasDuty));
    if(ach>0&&s.technology==='hybridDesiccant'&&pad&&s.desiccantKgH>0)options.push(airOption(ctx,ach,'indirect',doasDuty));
  }
  return options;
}

// One fully specified control action integrated over a substep. `plan.humidifier` and `plan.heat`
// decide the humidifier rate and heating demand (the ideal dispatcher anticipates the end state,
// the staged controller acts on the measured state). Returns null for an unsaturable candidate.
function evaluate(ctx,rawAir,dxDuty,dehuDuty,desiccantDuty,plan) {
  const {state,outside,s,forcing,target,dt}=ctx;
  const air=cappedAir(ctx,rawAir);
  const k=coefficients(ctx,air);
  const fanW=s.fanWPerM3s*(s.areaM2*s.heightM*air.ach/3600+s.doasM3s*air.doasDuty);
  const pumpW=(air.pad||air.indirect)?s.padPumpW:0;
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
  const dehuHeatW=L*dehuKgS+dehuW;
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
  // Finite delivered heat: the fuel heater's rating, or the heat pump's derated capacity at this outdoor
  // temperature, which is zero below its declared cutoff. Nothing backfills a locked-out heat pump.
  const heaterW=Math.min(ctx.heatCapacityW,heatNeed-reheatW);
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
  const padKgS=air.pad?k.flow*Math.max(0,air.w-outside.w):0;
  // Indirect evap rejects sensible heat through a separate wet secondary
  // stream. Its water is an ideal latent-equivalent estimate, not product data.
  const indirectKgS=air.indirect?k.flow*CP*(outside.tempC-air.tempC)/L:0;
  // Generic dry-neutral DOAS: outdoor air delivered at the declared supply state; purchased energy is the
  // declared kWh per kg removed from that outdoor air. Supply tempering is assumed inside that figure.
  const doasKgS=k.doasFlow*Math.max(0,outside.w-air.doasW);
  const doasW=doasKgS*s.doasKWhPerKg*KWH;
  // A heat pump buys delivered heat as electricity at the interpolated COP; a fuel heater books it to fuel
  // at its combustion efficiency. Exactly one branch is charged for the same delivered heaterW.
  const heaterElectricW=ctx.heatCOP!==null?heaterW/ctx.heatCOP:0;
  const electricW=forcing.lightW+fanW+pumpW+dxW+dehuW+regenElectricW+doasW+heaterElectricW;
  const fuelW=(ctx.heatCOP!==null?0:heaterW/s.heaterEfficiency)+regenFuelW;
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
    regenW,regenElectricW,regenFuelW,reheatW,heaterW,heaterElectricW,electricW,fuelW,waterKgS,padKgS:padKgS+indirectKgS,humidifier,doasKgS,doasW,
    rejectedW:dxTotalW+dxW-reheatW,desiccantExportedW:L*desiccantKgS*(1-s.desiccantHeatFraction)+regenW,
    unmetSensibleW,unmetMoistureKgS};
}

// Ideal modulation upper bound: enumerate airflow and device duty combinations each substep,
// minimizing joint target excursion first and instantaneous manual-price operating cost second.
function chooseIdeal(ctx,options) {
  const {state,outside,s,target}=ctx;
  let best=null;
  const noHumidifier=()=>0;
  const heat=(unheatedT,k)=>(target.minTempC+.03-unheatedT)/k.heatGain;
  for(const option of options){
    const air=cappedAir(ctx,option);
    const k=coefficients(ctx,air);
    const baselineW=k.massDecay*state.w+k.massGain*(k.wetSource+ctx.forcing.cropKgS);
    const qBase=ctx.forcing.solarW+ctx.forcing.lightW+s.cropSensibleWm2*s.canopyM2-L*ctx.forcing.cropKgS+s.fanWPerM3s*(s.areaM2*s.heightM*air.ach/3600+s.doasM3s*air.doasDuty);
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
    return r.device==='doas'?drier(ctx.doasW,r):r.device==='dehu'?ctx.dehuAvailable>0:r.device==='desiccant'?ctx.desiccantAvailable>0:ctx.dxAvailable>0&&ctx.dxMoisture>0;
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
  const air=airOption(ctx,evap?s.maxVentACH:ventLevel(Math.max(coolVent,moistVent)),indirect?'indirect':padOn?'pad':'outside',doas/2);
  const plan={
    humidifier:(unheatedT,unhumidifiedW,k)=>c.humidifierOn?Math.min(s.humidifierKgH/3600,Math.max(0,(wMid+.5*half-state.w)/k.massGain)):0,
    heat:(unheatedT,k,recoverable)=>clamp((heatSetC-state.tempC)/heatBand,0,1)*(ctx.heatCapacityW+recoverable)};
  return evaluate(ctx,air,Math.max(dxCool,dxMoist)/2,dehu/2,desiccant/2,plan);
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
  loads.ventilationSensibleKWh+=CP*(k.flow*(air.tempC-averageT)+k.doasFlow*(air.doasTempC-averageT))*scale;
  loads.fanKWh+=picked.fanW*scale;loads.cropSensibleKWh+=s.cropSensibleWm2*s.canopyM2*scale;
  loads.cropLatentKWh-=L*forcing.cropKgS*scale;loads.humidifierKWh-=L*picked.humidifier*scale;
  loads.equipmentHeatKWh+=(picked.dehuHeatW+picked.sorptionW+picked.heaterW+picked.reheatW)*scale;
  loads.dxSensibleKWh+=picked.dxSensibleW*scale;loads.condensationKWh+=L*picked.condensate/KWH;
  const lk=loads.latentKg;
  lk.crop+=forcing.cropKgS*dt;lk.infiltration+=k.leak*(outside.w-averageW)*dt;lk.ventilation+=k.flow*(air.w-averageW)*dt;
  lk.doas+=k.doasFlow*(air.doasW-averageW)*dt;lk.humidifier+=picked.humidifier*dt;
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
  if(!Number.isFinite(stepMinutes)||stepMinutes<=0||stepMinutes>5||Math.abs(60/stepMinutes-Math.round(60/stepMinutes))>1e-9)
    throw Error('Integration step must divide one hour and be at most five minutes.');
  // Back-fill v0.2 and 0.3 keys here too: simulateScenario is the physics entry point and must not
  // depend on the caller having validated first. Copy, then fill; never mutate the input.
  const s=backfillScenario({...scenario});
  const shade=resolveShadeScreen(s.shadeScreen),thermal=resolveThermalScreen(s.thermalScreen);
  for(const t of [s.dayTargetC,s.nightTargetC])if(!moistureBounds(t,101325,s).feasible)throw Error('Temperature, VPD and dew-point targets have no joint moisture band.');
  const controlMode=s.controlMode==='ideal'?'ideal':'staged';
  const transpirationModel=s.transpirationModel==='schedule'?'schedule':'stanghellini';
  const input=canonicalHours(snapshot),hours=[],dt=stepMinutes*60,nSteps=Math.round(60/stepMinutes);
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
    'Compliance samples substep-end states, not continuous canopy conditions. Surface condensation is an ideal instantaneous equilibrium drain; no spatial surfaces, frost, condensate reuse or crop response is modeled.'
  ];
  if(s.desiccantKgH>0)warnings.push('Generic desiccant assumptions only: 2 to 50 C indoor operating bounds, fixed moisture capacity, latent-equivalent sorption heat, explicit indoor sorption fraction, and purchased regeneration split fuel/electric. Regeneration and exported sorption heat reject outdoors. Hybrid indirect evaporation uses a separate wet secondary stream and ideal latent-equivalent water, not certified liquid-desiccant product performance.');
  if(s.doasM3s>0)warnings.push('Generic dry-neutral DOAS: outdoor air delivered at the declared supply temperature and the lower of outdoor or supply dew-point moisture; purchased electricity is the declared kWh per kg removed from outdoor air plus fan power, with supply tempering assumed inside that figure. DOAS air is outdoor air and counts against CO2 enrichment. Brand-agnostic assumption, not product data.');
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
  let state=null,controller=null,lightDate=null,accumulatedDLI=0,gapCount=0;
  for(let index=0;index<input.length;index++) {
    const weather=input[index],outside=weatherState(weather,needsSolar),classification=classifyWeather(weather,s);
    const row={time:weather.time,valid:false,eligible:false,compliantFraction:null,tempC:null,rh:null,vpd:null,
      mode:'MISSING_DATA',reason:'Missing or invalid meteorology or solar. Continuous state reset.',weatherMode:classification.weatherMode,
      weatherFlags:classification.flags,padTempC:classification.padTempC??null,padDewPointC:classification.padDewPointC??null,
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
    const modeCounts={},controls={ventACH:0,padFraction:0,indirectFraction:0,dxDuty:0,dehuDuty:0,desiccantDuty:0,doasDuty:0,heaterDuty:0,humidifierFraction:0,lightFraction:0,enrichmentFraction:0,shadeFraction:0,thermalScreenFraction:0};
    const loads=emptyLoads(),startTempC=state.tempC,startW=state.w;
    const dayContributions=new Map();
    const hour=hourContext(outside,s,shade,thermal);
    const options=controlMode==='ideal'?airOptions(hour):null;
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
      // canopy (solar through the envelope plus delivered fixture power, Beer-Lambert), or the declared schedule.
      const cropKgS=transpirationModel==='stanghellini'?
        s.canopyM2*stanghelliniTranspiration(state.tempC,state.w,outside.pressurePa,
          canopyAbsorbedWm2(transmittedWm2*canopySunShare+(s.canopyM2>0?lightW/s.canopyM2:0)*s.lightDelivery,s.lai),s.lai):
        target.cropKgS;
      const forcing={solarW:transmittedWm2*s.areaM2*s.solarHeatFraction,lightW,cropKgS};
      const ctx=substepContext(hour,state,forcing,target,dt,thermalOn);
      const picked=controller?chooseStaged(ctx,controller):chooseIdeal(ctx,options);
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
      row.heatingKWh+=picked.heaterW*scale;row.heatPumpElectricKWh+=picked.heaterElectricW*scale;row.coolingKWh+=picked.dxTotalW*scale;
      row.dehuKWh+=picked.dehuW*scale;row.dehuHeatKWh+=picked.dehuHeatW*scale;
      row.regenerationKWh+=picked.regenW*scale;row.regenerationElectricKWh+=picked.regenElectricW*scale;row.regenerationFuelKWh+=picked.regenFuelW*scale;
      row.desiccantRemovedKg+=picked.desiccantKgS*dt;row.desiccantHeatKWh+=picked.sorptionW*scale;
      row.desiccantExportedHeatKWh+=picked.desiccantExportedW*scale;row.reheatKWh+=picked.reheatW*scale;row.rejectedHeatKWh+=picked.rejectedW*scale;
      row.surfaceCondensateKg+=picked.condensate;row.condensateKg+=(picked.dxKgS+picked.dehuKgS)*dt+picked.condensate;
      row.cropWaterL+=cropKgS*dt;row.padWaterL+=picked.padKgS*dt;row.humidifierWaterL+=picked.humidifier*dt;
      row.doasKWh+=picked.doasW*scale;row.doasRemovedKg+=picked.doasKgS*dt;
      row.unmetSensibleKWh+=picked.unmetSensibleW*scale;row.unmetMoistureKg+=picked.unmetMoistureKgS*dt;
      row.tempDegreeHours+=picked.temperatureMiss*dt/3600;row.vpdKPaHours+=picked.moistureMiss*dt/3600;
      row.peakCoolingKW=Math.max(row.peakCoolingKW||0,picked.dxTotalW/1000);row.peakElectricKW=Math.max(row.peakElectricKW||0,picked.electricW/1000);
      accumulateLoads(loads,picked,forcing,s,outside,averageT,averageW,dt);
      controls.ventACH+=picked.air.ach/nSteps;controls.padFraction+=(picked.air.pad?1:0)/nSteps;controls.indirectFraction+=(picked.air.indirect?1:0)/nSteps;
      controls.dxDuty+=picked.dxDuty/nSteps;controls.dehuDuty+=picked.dehuDuty/nSteps;controls.desiccantDuty+=picked.desiccantDuty/nSteps;controls.doasDuty+=picked.air.doasDuty/nSteps;
      controls.heaterDuty+=(s.heaterKW>0?picked.heaterW/(s.heaterKW*1000):0)/nSteps;controls.humidifierFraction+=(picked.humidifier>0?1:0)/nSteps;controls.lightFraction+=(forcing.lightW>0?1:0)/nSteps;
      controls.enrichmentFraction+=(picked.air.ach<=s.minVentACH+1e-9&&!picked.air.pad&&!picked.air.indirect&&picked.air.doasDuty===0?1:0)/nSteps;
      controls.shadeFraction+=(shadeOn?1:0)/nSteps;controls.thermalScreenFraction+=(thermalOn?1:0)/nSteps;
      const mode=picked.dxTotalW>0?'DX_COOL_DEHUMIDIFY':picked.desiccantKgS>0?'DESICCANT_REGENERATION':picked.dehuKgS>0?'CONDENSING_DEHUMIDIFY':picked.doasKgS>0?'DOAS_DEHUMIDIFY':
        picked.heaterW>0?'HEATING':picked.air.indirect?'INDIRECT_EVAP_COOL':picked.air.pad?'PAD_COOLING':picked.humidifier>0?'HUMIDIFY':picked.air.ach>s.minVentACH?'VENTILATION':'MINIMUM_AIR';
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
  if(gapCount)warnings.push(`${gapCount} missing/invalid weather hours break continuous operation. Each subsequent segment restarts with an excluded warm-up hour. Incomplete local days do not enter DLI deficit-day counts.`);
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
    const open=simulateScenario({...s,shadeScreen:{...s.shadeScreen,installed:false}},snapshot,{stepMinutes,screenBaseline:false});
    screens.dliCostMol=open.hours.reduce((sum,h)=>sum+(h.valid?h.solarDLI:0),0)-total('solarDLI');
  }
  if(screenBaseline&&thermal.installed){
    const open=simulateScenario({...s,thermalScreen:{...s.thermalScreen,installed:false}},snapshot,{stepMinutes,screenBaseline:false});
    screens.heatingSavedKWh=open.summary.heatingKWh-summary.heatingKWh;
  }
  if(!screenBaseline&&(shade.installed||thermal.installed))screens.basis='Screen-open reference runs were not executed for this run, so the attributed light cost and heating saving are null.';
  summary.screens=screens;
  if(summary.numericalFailureHours)warnings.push(`${summary.numericalFailureHours} numerical/physical domain failures: favorable economic ranking is prohibited.`);
  return {scenario:s,hours,summary,weatherSummary:weatherSummary(hours,s),warnings,modelVersion:MODEL_VERSION,controlModeUsed:controlMode,transpirationModelUsed:transpirationModel,
    assumptions:{evidenceTier:'Assumption-based component screening',stepMinutes,warmupHoursPerSegment:1,lightSolarConversionUmolJ:2.02,
      controlModeUsed:controlMode,transpirationModelUsed:transpirationModel,
      canopyTemperature:transpirationModel==='stanghellini'?'Equal to zone air temperature (declared simplification, no leaf energy balance).':null,
      leafAreaIndex:transpirationModel==='stanghellini'?s.lai:null,
      ...componentAssumptions(s,shade,thermal),envelope,
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
  {name:'Lower pad effectiveness',changes:{padEffectiveness:.7}},
  {name:'Higher pad effectiveness',changes:{padEffectiveness:.9}}
]) {
  return cases.map(({name,changes})=>{const result=simulateScenario({...scenario,...changes,name},snapshot);return {name,changes,summary:result.summary,weatherSummary:result.weatherSummary};});
}
