import {MODEL_VERSION,SCENARIO_SCHEMA_VERSION,migrateScenario,validateScenario} from './config.js';
import {designHours,loadDecomposition,co2Window,compareScenarios,aggregateYears,strategyFrontier,bindingConstraint} from './metrics.js';
import {escapeHTML,reportHTML,shell,NOTICE,provenanceSection,localStamp,costBasisText,capitalBasisText,conditioningRows,airflowRows,attainmentComparisonText,comparisonPopulationText} from './report.js';
export {reportHTML};
function csvValue(value){let text=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function downloadScenario(scenario){
 const current=migrateScenario(scenario);
 download('cea-psychrometric-site-evaluator-scenario.json',JSON.stringify({schemaVersion:SCENARIO_SCHEMA_VERSION,scenarios:[current]},null,2),'application/json');
}
export function parseImport(input){
 const data=typeof input==='string'?JSON.parse(input):input;
 if(!data||typeof data!=='object'||![1,SCENARIO_SCHEMA_VERSION].includes(data.schemaVersion))
  throw new Error(`Unsupported portable import schema. Expected schemaVersion 1 or ${SCENARIO_SCHEMA_VERSION}.`);
 const rawScenarios=Array.isArray(data.scenarios)?data.scenarios:data.scenario?[data.scenario]:data.facility?[data]:[];
 if(!rawScenarios.length||rawScenarios.length>20)throw new Error('Import needs between 1 and 20 facility scenarios.');
 const scenarios=rawScenarios.map(migrateScenario);
 for(const s of scenarios){const errors=validateScenario(s);if(errors.length)throw new Error(`Invalid scenario: ${errors.join(' ')}`);}
 const ids=new Set();for(const s of scenarios){if(typeof s.id!=='string'||ids.has(s.id))s.id=crypto.randomUUID();ids.add(s.id);}
 return {scenarios,snapshot:data.snapshot||null};
}
const BRIEF_STYLE=`.brief table{font-size:12px}.brief th,.brief td{padding:5px 6px}.brief th{width:auto}.brief td.k{font:500 11px 'Inter',sans-serif;color:var(--ink-2);white-space:nowrap}.brief section{margin:24px 0;padding-top:16px}.brief h2{font-size:1.15rem;margin-bottom:10px}.brief p{font-size:13px}.verdict{border:1px solid var(--line-2);padding:12px 16px;font-size:13px;max-width:none}.appendix{break-before:page}@media print{.brief section{margin:14px 0;padding-top:10px}.brief table{font-size:10px}.brief p{font-size:11px}}`;
// Design-basis brief: one printed page for the engineer of record, then an appendix with the reproducible assumptions.
export function designBasisHTML(results,snapshot,{aggregate=null,sites=null,siteRuns=[]}={}){
 const f=(value,digits=1)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:digits}):'Not available';
 const tz=snapshot.timezone,first=results[0],s0=first.scenario;
 const state=o=>o?`${f(o.tempC)} C DB, ${f(o.wetBulbC)} C WB, ${f(o.dewPointC)} C DP`:'Not available';
 const at=(time,o)=>`${localStamp(time,tz)}; outdoor ${state(o)}`;
 const table=(head,rows)=>`<table><thead><tr>${head.map(h=>`<th>${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?'':' class="k"'}>${escapeHTML(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const per=results.map(r=>({r,design:designHours(snapshot.hours,r.hours,r.scenario),loads:loadDecomposition(r),co2:co2Window(r)}));
 const climate=per[0].design,level=(block,key)=>['p99_6','p99','p98'].map(p=>block?.[p]?.[key]);
 const climateRows=[['Dry bulb, 0.4 / 1 / 2 percent exceeded',...level(climate.dryBulb,'tempC').map(v=>`${f(v)} C`)],['  coincident wet bulb',...level(climate.dryBulb,'wetBulbC').map(v=>`${f(v)} C`)],['  coincident dew point',...level(climate.dryBulb,'dewPointC').map(v=>`${f(v)} C`)],
  ['Dew point, 0.4 / 1 / 2 percent exceeded',...level(climate.dewPoint,'dewPointC').map(v=>`${f(v)} C`)],['  coincident dry bulb',...level(climate.dewPoint,'tempC').map(v=>`${f(v)} C`)],
  ['Wet bulb, 0.4 / 1 / 2 percent exceeded',...level(climate.wetBulb,'wetBulbC').map(v=>`${f(v)} C`)],['  coincident dry bulb',...level(climate.wetBulb,'tempC').map(v=>`${f(v)} C`)]];
 const band=s=>`${s.crop}: ${f(s.dayTargetC)} C day / ${f(s.nightTargetC)} C night, tolerance ${f(s.tempToleranceC)} K; VPD ${f(s.vpdMin,2)} to ${f(s.vpdMax,2)} kPa; dew-point cap ${f(s.maxDewPointC)} C; DLI target ${f(s.dliTarget)} mol/m²/d over ${f(s.photoperiod,0)} h from ${f(s.dayStart,0)}:00`;
 const bands=[...new Set(results.map(r=>band(r.scenario)))];
 const agg=aggregate||aggregateYears([{label:`${snapshot.startDate} to ${snapshot.endDate}`,snapshot,results}]);
 const frontier=strategyFrontier(agg),constraint=bindingConstraint(results.map(r=>r.weatherSummary).filter(Boolean));
 const entry=r=>agg.byScenario[r.scenario.id];
 const attainment=r=>{const e=entry(r),s=r.summary||{};return aggregate&&e?`${f(e.median.compliancePct)}% median, ${f(e.worst?.compliancePct)}% worst (${e.worst?.label??'n/a'}) over ${e.years.length} years; this period ${f(s.compliancePct)}%`:`${f(s.compliancePct)}% (${f(s.compliantHours,0)} of ${f(s.eligibleHours,0)} eligible h)`;};
 const drying=r=>{const d=r.weatherSummary?.outdoorDrying;return d?`${f(d.coolDry.hours+d.coldDry.hours+d.hotDry.hours,0)} h (cool-dry ${f(d.coolDry.hours,0)}, cold-dry ${f(d.coldDry.hours,0)}, hot-dry ${f(d.hotDry.hours,0)}) at ${f(d.maxVentACH)} ACH`:'Not available';};
 const airflowAt=(ach,s)=>{
  if(typeof ach!=='number'||!Number.isFinite(ach)||!(s.areaM2>0)||!(s.heightM>0))return null;
  const m3s=ach*s.areaM2*s.heightM/3600,cfm=m3s*2118.880003;
  return {ach,m3s,cfm,m3sPerM2:m3s/s.areaM2,cfmPerFt2:cfm/(s.areaM2*10.7639104167)};
 };
 const airflowText=(air,time=null,outdoor=null)=>air?
  `${f(air.ach,2)} ACH, ${f(air.m3s,3)} m³/s, ${f(air.cfm,0)} cfm, ${f(air.m3sPerM2,4)} m³/s/m², ${f(air.cfmPerFt2,3)} cfm/ft²${time===null?'':` at ${at(time,outdoor)}`}`:
  'Not available';
 const strategyRows=[
  ['Joint temperature-and-moisture target attainment',...per.map(({r})=>attainment(r))],
  ['Space sensible-heat ratio, period',...per.map(({loads})=>loads.hours?f(loads.total.shr,2):'No load terms')],
  ['Peak sensible hour',...per.map(({design:d})=>d.peakSensibleHour?`${f(d.peakSensibleHour.sensibleKWh)} kWh/h at ${at(d.peakSensibleHour.time,d.peakSensibleHour.outdoor)}`:'No load terms')],
  ['Peak latent hour',...per.map(({design:d})=>d.peakLatentHour?`${f(d.peakLatentHour.latentKg)} kg/h at ${at(d.peakLatentHour.time,d.peakLatentHour.outdoor)}`:'No load terms')],
  ['Worst joint-failure hour',...per.map(({design:d})=>d.jointFailure.worstHour?`${f(d.jointFailure.worstHour.tempDegreeHours,2)} K·h, ${f(d.jointFailure.worstHour.vpdKPaHours,3)} kPa·h at ${at(d.jointFailure.worstHour.time,d.jointFailure.worstHour.outdoor)}`:'No failures')],
  ['1 percent joint-failure hour',...per.map(({design:d})=>d.jointFailure.p99Violation?`${f(d.jointFailure.p99Violation.tempDegreeHours,2)} K·h, ${f(d.jointFailure.p99Violation.vpdKPaHours,3)} kPa·h at ${at(d.jointFailure.p99Violation.time,d.jointFailure.p99Violation.outdoor)}`:`Fewer than 1 percent of eligible hours fail (${f(d.jointFailure.failingHours,0)} of ${f(d.jointFailure.eligibleHours,0)})`)],
  ['Controlled outside air, actual maximum',...per.map(({design:d})=>airflowText(d.controlledOutdoorAirRequirement,d.controlledOutdoorAirRequirement.atHour,d.controlledOutdoorAirRequirement.outdoor))],
  ['Total outside air, actual maximum',...per.map(({r})=>airflowText(airflowAt(r.summary?.outdoorAir?.totalACH?.max,r.scenario)))],
  ['Condensate peak',...per.map(({design:d})=>`${f(d.condensatePeakKgH)} kg/h`)],
  ['Pad water peak / runtime',...per.map(({design:d,r})=>`${f(d.padWaterPeakLH)} L/h; ${f(r.summary?.runtime?.pad?.hours,0)} h on ${f(r.summary?.runtime?.pad?.days,0)} days, ${f(r.summary?.padWaterL,0)} L`)],
  ['Outside-air drying hours, weather side',...per.map(({r})=>drying(r))],
  ['CO₂ enrichment window',...per.map(({co2})=>`${f(co2.equivalentHours,0)} equivalent h on ${f(co2.days,0)} days; weather-side ${f(co2.weatherSideHours,0)} h`)],
  ['Reheat after overcooling',...per.map(({r})=>`${f(r.summary?.reheatKWh,0)} kWh`)],
  ['Purchased electricity / fuel',...per.map(({r})=>`${f(r.summary?.electricKWh,0)} / ${f(r.summary?.fuelKWh,0)} kWh`)],
  ['Operating cost',...per.map(({r})=>{const e=entry(r),label=r.summary?.costBasis?.label||'Model-estimated operating cost';return aggregate&&e?`${label}: $${f(r.summary?.cost,0)}; median year $${f(e.median.cost,0)}`:`${label}: $${f(r.summary?.cost,0)}`;})],
  ['Operating cost basis',...per.map(({r})=>costBasisText(r.summary?.costBasis))],
  ['Installed capital assumption',...per.map(({r})=>capitalBasisText(r.scenario))]];
 const compared=compareScenarios(results);
 const detailTables=per.map(({r})=>`<h3>${escapeHTML(r.scenario.name)}</h3>${table(['Period quantity','Value'],[...airflowRows(r),...conditioningRows(r.summary)])}`).join('');
 const comparisons=compared.map(row=>`<p>${escapeHTML(comparisonPopulationText(row,results.find(r=>r.scenario.id===row.id)))}</p>`).join('')+compared.slice(1).map(row=>`<p>${escapeHTML(attainmentComparisonText(compared[0],row))} ${escapeHTML(`${row.operatingCostReduction?.label||row.operatingCostDifference.label}: $${f(row.operatingCostReduction?.amount??row.operatingCostDifference.amount,2)} for ${row.name} versus ${compared[0].name}, over ${f(row.matchedHours,0)} common eligible hours only (warm-up excluded), not the full-run cost population. ${costBasisText(row.costBasis)}`)}</p>`).join('');
 const constraintText=constraint.binding==='none'?'No weather-side constraint hours at this band: the climate alone holds the target in every valid hour.':`${constraint.binding} (mean per year: ${f(constraint.hours.moisture,0)} h moisture-limited, ${f(constraint.hours.temperature,0)} h temperature-limited, ${f(constraint.hours.heating,0)} h heating). ${constraint.basis}`;
 const verdict=frontier.best?`Cheapest non-dominated strategy by ${aggregate?'median-year':'period'} operating cost: ${frontier.best.name} at $${f(frontier.best.cost,0)} holding the band ${f(frontier.best.compliancePct)}% of eligible hours. Operating frontier: ${frontier.frontier.map(r=>`${r.name} ($${f(r.cost,0)}, ${f(r.compliancePct)}%)`).join('; ')}.${frontier.rows.some(r=>r.dominated)?` Operating-dominated: ${frontier.rows.filter(r=>r.dominated).map(r=>r.name).join(', ')}.`:''} Capital is separate and not ranked.`:'No priced strategy; operating-cost ranking is not available.';
 const siteTable=sites?.length?`<section><h2><span class="cat">§ 006</span>Site comparison</h2>${table(['Site','Free-cooling h, median year','Pad-effective h','Binding constraint','Best strategy','Median attainment','Worst-year attainment','Median operating cost','Ranking'],sites.map(row=>[`${row.site?.city??''}${row.site?.state?`, ${row.site.state}`:''} ${row.site?.zip??''}`.trim()||'Site',f(row.freeCoolingHours,0),f(row.padEffectiveHours,0),row.bindingConstraint,row.bestStrategy?.name??'None',`${f(row.bestStrategy?.compliancePct)}%`,`${f(row.worstYearCompliancePct)}%`,row.bestStrategy?`$${f(row.bestStrategy.cost,0)}`:'Unpriced',row.rankingStable?'stable':'year-dependent']))}<p>${escapeHTML(sites[0].basis||'')}</p></section>`:'';
 const site=sites?.find(row=>row.site?.latitude===snapshot.latitude&&row.site?.longitude===snapshot.longitude)?.site;
 const meta=`${site?`${site.city}, ${site.state} ${site.zip} · `:''}${f(snapshot.latitude,3)}, ${f(snapshot.longitude,3)} · ${tz} · ${snapshot.startDate} to ${snapshot.endDate}${aggregate?` · weather years ${agg.years.join(', ')}`:''} · ${snapshot.source} (${snapshot.sourceKind})`;
 const tier=first.assumptions?.evidenceTier||'Assumption-based component screening';
 const allCostBases=siteRuns.length?`<section><h2>All site and year price bases</h2>${siteRuns.flatMap(siteRun=>siteRun.runs.flatMap(run=>run.results.map(r=>`<p>${escapeHTML(`${siteRun.site?.city||siteRun.site?.zip||'Site'}, ${run.label}, ${r.scenario.name}: ${costBasisText(r.summary.costBasis)}`)}</p>`))).join('')}</section>`:'';
 const brief=`<div class="brief"><p class="meta">${escapeHTML(meta)}</p><p class="notice"><strong>Evidence tier: ${escapeHTML(tier)}.</strong> ${escapeHTML(NOTICE)} Model ${escapeHTML(first.modelVersion||MODEL_VERSION)}, ${escapeHTML(String(first.assumptions?.stepMinutes??'n/a'))} minute dispatch step${first.summary?.controlModeUsed?`, ${escapeHTML(first.summary.controlModeUsed)} control`:''}${first.summary?.transpirationModelUsed?`, ${escapeHTML(first.summary.transpirationModelUsed)} transpiration`:''}.</p>
<section><h2><span class="cat">§ 001</span>Climate design conditions</h2>${table(['Condition','0.4 %','1 %','2 %'],climateRows)}<p>${escapeHTML(`${f(climate.dryBulb.hours,0)} valid weather hours. ${climate.basis}`)}</p></section>
<section><h2><span class="cat">§ 002</span>Crop band</h2><p>${bands.map(b=>escapeHTML(b)).join('<br>')}${bands.length>1?'<br>Strategies use different bands; attainment is not an equipment-only comparison.':''}</p></section>
<section><h2><span class="cat">§ 003</span>Strategies</h2>${table(['Quantity',...results.map(r=>r.scenario.name)],strategyRows)}${comparisons}${detailTables}<p>${escapeHTML(per[0].design.basis)}</p></section>
<section><h2><span class="cat">§ 004</span>Binding constraint</h2><p class="verdict">${escapeHTML(constraintText)}</p></section>
<section><h2><span class="cat">§ 005</span>Strategy verdict</h2><p class="verdict">${escapeHTML(verdict)}</p><p>${escapeHTML(`Ranking across years: ${agg.ranking.note}`)}${aggregate?'':' Single weather period; run bundled years for a distribution.'}</p></section>${siteTable}${allCostBases}</div>`;
 const appendix=`<div class="appendix"><h2><span class="cat">Appendix</span>Reproducible assumptions</h2>${results.map((r,i)=>`<section><h2><span class="cat">§ A${String(i+1).padStart(2,'0')}</span>${escapeHTML(r.scenario.name)}</h2><h3>Warnings & assumptions</h3><ul>${(r.warnings||[]).map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul><details open><summary>Scenario JSON</summary><pre>${escapeHTML(JSON.stringify(r.scenario,null,2))}</pre></details><details open><summary>Model assumptions</summary><pre>${escapeHTML(JSON.stringify(r.assumptions||{},null,2))}</pre></details>${r.energyContext?`<details open><summary>Energy-source provenance</summary><pre>${escapeHTML(JSON.stringify(r.energyContext,null,2))}</pre></details>`:''}</section>`).join('')}${provenanceSection(`A${String(results.length+1).padStart(2,'0')}`,snapshot)}</div>`;
 return shell('design-basis brief','Design-basis brief',`${brief}${appendix}`,BRIEF_STYLE);
}
export function downloadRun(results,snapshot,format='json',extras={}){
 if(!Array.isArray(results)||!results.length)throw new Error('Run an analysis before exporting results.');
 if(format==='report'){download('cea-psychrometric-site-evaluator-report.html',reportHTML(results,snapshot,extras||{}),'text/html');return;}
 if(format==='design-basis'){download('cea-psychrometric-site-evaluator-design-basis.html',designBasisHTML(results,snapshot,extras||{}),'text/html');return;}
 if(format==='csv'){
 const keys=['time','valid','weatherMode','mode','reason','tempC','rh','vpd','compliantFraction','electricKWh','fuelKWh','waterL','condensateKg',
  'recoverySensibleKWh','recoveryLatentKWh','recoveryAuxKWh','recoveryCoreM3','recoveryBypassM3','recoveryDefrostHours',
  'preheatDeliveredKWh','preheatElectricKWh','preheatFuelKWh','preheatInsufficientHours',
  'doasCondensateKg','doasCoolingDeliveredKWh','doasCoolingElectricKWh','doasRecoveredReheatKWh','doasExternalHeatKWh','doasUnmetConditioningKWh',
  'lightKWh','solarDLI','lightDLI','heatingKWh','coolingKWh','dehuKWh','dehuHeatKWh','regenerationKWh','cost','co2Kg',
  'unmetSensibleKWh','unmetMoistureKg','energyResidualW','moistureResidualKgS'];
 const controlKeys=['controlledACH','controlledM3s','controlledACHMin','controlledACHMax','controlledACHStages',
  'totalOutdoorACH','totalOutdoorM3s','totalOutdoorACHMin','totalOutdoorACHMax','recoveryCoreFraction','recoveryBypassFraction',
  'recoveryDefrostFraction','preheatFraction','doasConditionedFraction','doasTreatmentM3s'];
 const costColumns=['costBasis','installedCostBasis'];
 const columns=[...keys,...controlKeys,...costColumns];
 const rows=[['scenario','source','sourceKind','timezone',...columns].map(csvValue).join(',')];
 for(const r of results)for(const h of r.hours)rows.push([r.scenario.name,snapshot.source,snapshot.sourceKind,snapshot.timezone,
  ...keys.map(k=>k==='time'?new Date(h.time).toISOString():h[k]),
  ...controlKeys.map(k=>k==='controlledACHStages'?JSON.stringify(h.controls?.[k]||[]):h.controls?.[k]),JSON.stringify(r.summary.costBasis),r.scenario.installedCostBasis].map(csvValue).join(','));
 download('cea-psychrometric-site-evaluator-hourly.csv',rows.join('\r\n'),'text/csv');return;
 }
 if(format!=='json')throw new Error('Unsupported export format.');
 const scenarios=results.map(r=>migrateScenario(r.scenario));
 const portableResults=results.map((result,index)=>({...result,scenario:scenarios[index]}));
 download('cea-psychrometric-site-evaluator-run.json',JSON.stringify({schemaVersion:SCENARIO_SCHEMA_VERSION,modelVersion:MODEL_VERSION,exportedAt:new Date().toISOString(),scenarios,snapshot,results:portableResults}),'application/json');
}
