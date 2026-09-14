import {validateScenario,MODEL_VERSION} from './config.js';
import {designHours,loadDecomposition,co2Window,aggregateYears,strategyFrontier,bindingConstraint} from './metrics.js';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function csvValue(value){let text=String(value??'');if(typeof value==='string'&&/^[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function downloadScenario(scenario){download('cea-psychrometric-site-evaluator-scenario.json',JSON.stringify({schemaVersion:1,scenarios:[scenario]},null,2),'application/json');}
export function parseImport(input){
 const data=typeof input==='string'?JSON.parse(input):input;
 if(!data||typeof data!=='object'||data.schemaVersion!==1)throw new Error('Unsupported portable import schema. Expected schemaVersion 1.');
 const scenarios=Array.isArray(data.scenarios)?data.scenarios:data.scenario?[data.scenario]:data.facility?[data]:Array.isArray(data.results)?data.results.map(r=>r.scenario):[];
 if(!scenarios.length||scenarios.length>20)throw new Error('Import needs between 1 and 20 facility scenarios.');
 for(const s of scenarios){const errors=validateScenario(s);if(errors.length)throw new Error(`Invalid scenario: ${errors.join(' ')}`);}
 const ids=new Set();for(const s of scenarios){if(typeof s.id!=='string'||ids.has(s.id))s.id=crypto.randomUUID();ids.add(s.id);}
 return {scenarios,snapshot:data.snapshot||null};
}
function runtimeRows(r){
 const f=(v,d=0)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:d}):'Not available';
 const s=r.summary||{},rt=s.runtime||{},pv=r.weatherSummary?.padViability,use=k=>rt[k]?`${f(rt[k].hours)} h on ${f(rt[k].days)} days (${f(rt[k].equivalentHours,1)} equivalent full-load h)`:'Not available';
 const rows=[];
 if(r.scenario.padEnabled)rows.push(['Evaporative pad runtime',`${use('pad')}; ${f(s.padWaterL)} L water`]);
 if(pv)rows.push(['Pad viability, weather only',`${f(pv.effectiveHours)} h effective on ${f(pv.effectiveDays?.atLeast1)} days (${f(pv.effectiveDays?.atLeast4)} days with 4 h or more); ${f(pv.marginalHours)} h marginal; ${f(pv.ineffectiveHours)} h too warm or humid for pad alone on ${f(pv.ineffectiveDays?.atLeast1)} days`]);
 if(rt.indirect?.hours)rows.push(['Indirect evaporative runtime',use('indirect')]);
 if(rt.dx?.hours)rows.push(['DX cooling runtime',use('dx')]);
 if(rt.dehu?.hours)rows.push(['Condensing dehumidifier runtime',use('dehu')]);
 if(rt.desiccant?.hours)rows.push(['Desiccant runtime',use('desiccant')]);
 if(rt.heating?.hours)rows.push(['Heating runtime',use('heating')]);
 if(rt.light?.hours)rows.push(['Supplemental light runtime',use('light')]);
 if(s.reheatKWh>0)rows.push(['Reheat after overcooling for latent control',`${f(s.reheatKWh)} kWh; a decoupled latent strategy avoids this penalty`]);
 const d=r.weatherSummary?.outdoorDrying;
 if(d){const b=k=>`${f(d[k].hours)} h on ${f(d[k].days.atLeast1)} days, ${f(d[k].meanPotentialKgH,1)} kg/h mean at ${f(d.maxVentACH,1)} ACH${Number.isFinite(d[k].kWhPerKg)?`, ${f(d[k].kWhPerKg,2)} kWh/kg`:''}`;
  rows.push(['Outside air as dehumidifier',`Cool-dry ${b('coolDry')}; cold-dry (heating penalty) ${b('coldDry')}; hot-dry ${b('hotDry')}. Cheaper per kg than the condensing dehumidifier${Number.isFinite(d.dehuKWhPerKg)?` (${f(d.dehuKWhPerKg,2)} kWh/kg)`:''} on cost in ${f(d.cheaperThanDehuHours)} h and on energy in ${f(d.lowerEnergyThanDehuHours)} h.`]);}
 return rows;
}
const STYLE=`:root{color-scheme:light}body{background:#F3F0ED;color:#2B2C2E;font:15px/1.6 'Inter',system-ui,sans-serif;max-width:1000px;margin:auto;padding:40px 32px}.mark{font:700 13px 'DM Sans',sans-serif;letter-spacing:.28em;text-transform:uppercase;margin-bottom:40px}.mark em{font-style:normal;color:#4DB405}.cat{display:block;font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#9A8860;margin-bottom:8px}h1,h2{font-family:'DM Sans',sans-serif;font-weight:700;letter-spacing:-.025em;margin:0}h1{font-size:clamp(2.2rem,5vw,3.4rem);line-height:1.05;margin-bottom:14px}h2{font-size:1.5rem;margin-bottom:20px}h3{font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#9A8860;margin:28px 0 8px}p{max-width:68ch;margin:0 0 14px}section{margin:56px 0;padding-top:28px;border-top:1px solid rgba(43,44,46,.15)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(43,44,46,.15);vertical-align:top}th{font:500 11px 'Inter',sans-serif;color:rgba(43,44,46,.7);width:34%}td,pre{font-family:'IBM Plex Mono',monospace;font-size:13px;font-variant-numeric:tabular-nums}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}ul{padding-left:18px;font-size:13px;max-width:68ch}summary{font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:rgba(43,44,46,.7);cursor:pointer;padding:10px 0}.notice{border:1px solid rgba(43,44,46,.3);padding:16px 18px;font-size:13px;max-width:none}.meta{font:11px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:rgba(43,44,46,.7)}.foot{font:10px 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:rgba(43,44,46,.55);margin-top:48px}@media print{body{padding:0}details{display:block}section{break-inside:avoid}}`;
const shell=(title,cat,body,extraStyle='')=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CEA Psychrometric Site Evaluator | ${escapeHTML(title)} | Grownetics</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;600&display=swap" rel="stylesheet"><style>${STYLE}${extraStyle}</style><div class="mark">Grownetics<em>.</em></div><span class="cat">${escapeHTML(cat)}</span><h1>CEA Psychrometric Site Evaluator</h1>${body}<p class="foot">Grownetics · CEA Psychrometric Site Evaluator · Model ${escapeHTML(MODEL_VERSION)} · Generated ${escapeHTML(new Date().toISOString())}</p></html>`;
const NOTICE='Assumption-based screening, not a calibrated greenhouse digital twin, guaranteed indoor condition, equipment selection certificate or crop-yield forecast. Hourly source weather does not establish minute-scale or canopy-level precision. Installed costs and component efficiencies are editable assumptions unless separately sourced. Regional grid mix is not utility procurement or marginal emissions.';
const provenanceSection=(label,snapshot)=>`<section><h2><span class="cat">§ ${escapeHTML(label)}</span>Weather provenance</h2><pre>${escapeHTML(JSON.stringify({...snapshot,hours:undefined,raw:undefined},null,2))}</pre><p>Export JSON alongside this document to retain raw weather, hourly results and all configuration values. This document alone is not the complete reproducibility bundle.</p></section>`;
export function reportHTML(results,snapshot){
 const f=(value,digits=1)=>typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:digits}):'Not available';
 const body=results.map((r,i)=>{const s=r.summary||{};return `<section><h2><span class="cat">§ ${String(i+1).padStart(3,'0')}</span>${escapeHTML(r.scenario.name)}</h2><table><tbody>${[
 ['Facility / crop',`${r.scenario.facility} / ${r.scenario.crop}`],['Expected / valid hours',`${f(s.expectedHours,0)} / ${f(s.validHours,0)}`],['Joint climate-band attainment',`${f(s.compliancePct)}%`],['Equivalent compliant hours',f(s.compliantHours)],['Longest failure episode',`${f(s.longestFailureHours)} h`],...runtimeRows(r),['Purchased electricity',`${f(s.electricKWh)} kWh`],['Purchased heating/regeneration fuel',`${f(s.fuelKWh)} kWh`],['Period operating cost',`$${f(s.cost,2)}`],['Installed capital assumption',`$${f(r.scenario.installedCost,0)}`],['Electricity price basis',s.costBasis || r.energyContext?.appliedPriceMode || r.scenario.priceMode],['Missing data',`${f(s.missingHours,0)} hours`]
 ].map(([k,v])=>`<tr><th>${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`).join('')}</tbody></table><h3>Warnings & assumptions</h3><ul>${(r.warnings||[]).map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul><details open><summary>Full reproducible scenario</summary><pre>${escapeHTML(JSON.stringify(r.scenario,null,2))}</pre></details>${r.energyContext?`<details open><summary>Energy-source provenance</summary><pre>${escapeHTML(JSON.stringify(r.energyContext,null,2))}</pre></details>`:''}</section>`;}).join('');
 return shell('analysis report','Component efficacy & energy screening report',`<p class="notice">${escapeHTML(NOTICE)}</p><p class="meta">${escapeHTML(snapshot.startDate)} to ${escapeHTML(snapshot.endDate)} · ${escapeHTML(snapshot.timezone)} · ${escapeHTML(snapshot.source)} (${escapeHTML(snapshot.sourceKind)})</p>${body}${provenanceSection(String(results.length+1).padStart(3,'0'),snapshot)}`);
}
const BRIEF_STYLE=`.brief table{font-size:12px}.brief th,.brief td{padding:5px 6px}.brief th{width:auto}.brief td.k{font:500 11px 'Inter',sans-serif;color:rgba(43,44,46,.7);white-space:nowrap}.brief section{margin:24px 0;padding-top:16px}.brief h2{font-size:1.15rem;margin-bottom:10px}.brief p{font-size:13px}.verdict{border:1px solid rgba(43,44,46,.3);padding:12px 16px;font-size:13px;max-width:none}.appendix{break-before:page}@media print{.brief section{margin:14px 0;padding-top:10px}.brief table{font-size:10px}.brief p{font-size:11px}}`;
function localStamp(time,timezone){
 if(!Number.isFinite(time))return 'Not available';
 try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(time),g=k=>p.find(x=>x.type===k)?.value;return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}`;}
 catch{return new Date(time).toISOString();}
}
// Design-basis brief: one printed page for the engineer of record, then an appendix with the reproducible assumptions.
export function designBasisHTML(results,snapshot,{aggregate=null,sites=null}={}){
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
 const strategyRows=[
  ['Joint attainment',...per.map(({r})=>attainment(r))],
  ['Space sensible-heat ratio, period',...per.map(({loads})=>loads.hours?f(loads.total.shr,2):'No load terms')],
  ['Peak sensible hour',...per.map(({design:d})=>d.peakSensibleHour?`${f(d.peakSensibleHour.sensibleKWh)} kWh/h at ${at(d.peakSensibleHour.time,d.peakSensibleHour.outdoor)}`:'No load terms')],
  ['Peak latent hour',...per.map(({design:d})=>d.peakLatentHour?`${f(d.peakLatentHour.latentKg)} kg/h at ${at(d.peakLatentHour.time,d.peakLatentHour.outdoor)}`:'No load terms')],
  ['Worst joint-failure hour',...per.map(({design:d})=>d.jointFailure.worstHour?`${f(d.jointFailure.worstHour.tempDegreeHours,2)} K·h, ${f(d.jointFailure.worstHour.vpdKPaHours,3)} kPa·h at ${at(d.jointFailure.worstHour.time,d.jointFailure.worstHour.outdoor)}`:'No failures')],
  ['1 percent joint-failure hour',...per.map(({design:d})=>d.jointFailure.p99Violation?`${f(d.jointFailure.p99Violation.tempDegreeHours,2)} K·h, ${f(d.jointFailure.p99Violation.vpdKPaHours,3)} kPa·h at ${at(d.jointFailure.p99Violation.time,d.jointFailure.p99Violation.outdoor)}`:`Fewer than 1 percent of eligible hours fail (${f(d.jointFailure.failingHours,0)} of ${f(d.jointFailure.eligibleHours,0)})`)],
  ['Ventilation air requirement',...per.map(({design:d})=>d.ventilationAirRequirement.maxACH===null?'Not available':`${f(d.ventilationAirRequirement.maxACH)} ACH, ${f(d.ventilationAirRequirement.m3s,2)} m³/s at ${at(d.ventilationAirRequirement.atHour,d.ventilationAirRequirement.outdoor)}`)],
  ['Condensate peak',...per.map(({design:d})=>`${f(d.condensatePeakKgH)} kg/h`)],
  ['Pad water peak / runtime',...per.map(({design:d,r})=>`${f(d.padWaterPeakLH)} L/h; ${f(r.summary?.runtime?.pad?.hours,0)} h on ${f(r.summary?.runtime?.pad?.days,0)} days, ${f(r.summary?.padWaterL,0)} L`)],
  ['Outside-air drying hours, weather side',...per.map(({r})=>drying(r))],
  ['CO₂ enrichment window',...per.map(({co2})=>`${f(co2.equivalentHours,0)} equivalent h on ${f(co2.days,0)} days; weather-side ${f(co2.weatherSideHours,0)} h`)],
  ['Reheat after overcooling',...per.map(({r})=>`${f(r.summary?.reheatKWh,0)} kWh`)],
  ['Purchased electricity / fuel',...per.map(({r})=>`${f(r.summary?.electricKWh,0)} / ${f(r.summary?.fuelKWh,0)} kWh`)],
  ['Operating cost, period',...per.map(({r})=>{const e=entry(r);return aggregate&&e?`$${f(r.summary?.cost,0)}; median year $${f(e.median.cost,0)}`:`$${f(r.summary?.cost,0)}`;})],
  ['Installed capital assumption',...per.map(({r})=>`$${f(r.scenario.installedCost,0)}`)]];
 const constraintText=constraint.binding==='none'?'No weather-side constraint hours at this band: the climate alone holds the target in every valid hour.':`${constraint.binding} (mean per year: ${f(constraint.hours.moisture,0)} h moisture-limited, ${f(constraint.hours.temperature,0)} h temperature-limited, ${f(constraint.hours.heating,0)} h heating). ${constraint.basis}`;
 const verdict=frontier.best?`Cheapest non-dominated strategy by ${aggregate?'median-year':'period'} operating cost: ${frontier.best.name} at $${f(frontier.best.cost,0)} holding the band ${f(frontier.best.compliancePct)}% of eligible hours. Operating frontier: ${frontier.frontier.map(r=>`${r.name} ($${f(r.cost,0)}, ${f(r.compliancePct)}%)`).join('; ')}.${frontier.rows.some(r=>r.dominated)?` Operating-dominated: ${frontier.rows.filter(r=>r.dominated).map(r=>r.name).join(', ')}.`:''} Capital is separate and not ranked.`:'No priced strategy; operating-cost ranking is not available.';
 const siteTable=sites?.length?`<section><h2><span class="cat">§ 006</span>Site comparison</h2>${table(['Site','Free-cooling h, median year','Pad-effective h','Binding constraint','Best strategy','Median attainment','Worst-year attainment','Median operating cost','Ranking'],sites.map(row=>[`${row.site?.city??''}${row.site?.state?`, ${row.site.state}`:''} ${row.site?.zip??''}`.trim()||'Site',f(row.freeCoolingHours,0),f(row.padEffectiveHours,0),row.bindingConstraint,row.bestStrategy?.name??'None',`${f(row.bestStrategy?.compliancePct)}%`,`${f(row.worstYearCompliancePct)}%`,row.bestStrategy?`$${f(row.bestStrategy.cost,0)}`:'Unpriced',row.rankingStable?'stable':'year-dependent']))}<p>${escapeHTML(sites[0].basis||'')}</p></section>`:'';
 const site=sites?.find(row=>row.site?.latitude===snapshot.latitude&&row.site?.longitude===snapshot.longitude)?.site;
 const meta=`${site?`${site.city}, ${site.state} ${site.zip} · `:''}${f(snapshot.latitude,3)}, ${f(snapshot.longitude,3)} · ${tz} · ${snapshot.startDate} to ${snapshot.endDate}${aggregate?` · weather years ${agg.years.join(', ')}`:''} · ${snapshot.source} (${snapshot.sourceKind})`;
 const tier=first.assumptions?.evidenceTier||'Assumption-based component screening';
 const brief=`<div class="brief"><p class="meta">${escapeHTML(meta)}</p><p class="notice"><strong>Evidence tier: ${escapeHTML(tier)}.</strong> ${escapeHTML(NOTICE)} Model ${escapeHTML(first.modelVersion||MODEL_VERSION)}, ${escapeHTML(String(first.assumptions?.stepMinutes??'n/a'))} minute dispatch step${first.summary?.controlModeUsed?`, ${escapeHTML(first.summary.controlModeUsed)} control`:''}${first.summary?.transpirationModelUsed?`, ${escapeHTML(first.summary.transpirationModelUsed)} transpiration`:''}.</p>
<section><h2><span class="cat">§ 001</span>Climate design conditions</h2>${table(['Condition','0.4 %','1 %','2 %'],climateRows)}<p>${escapeHTML(`${f(climate.dryBulb.hours,0)} valid weather hours. ${climate.basis}`)}</p></section>
<section><h2><span class="cat">§ 002</span>Crop band</h2><p>${bands.map(b=>escapeHTML(b)).join('<br>')}${bands.length>1?'<br>Strategies use different bands; attainment is not an equipment-only comparison.':''}</p></section>
<section><h2><span class="cat">§ 003</span>Strategies</h2>${table(['Quantity',...results.map(r=>r.scenario.name)],strategyRows)}<p>${escapeHTML(per[0].design.basis)}</p></section>
<section><h2><span class="cat">§ 004</span>Binding constraint</h2><p class="verdict">${escapeHTML(constraintText)}</p></section>
<section><h2><span class="cat">§ 005</span>Strategy verdict</h2><p class="verdict">${escapeHTML(verdict)}</p><p>${escapeHTML(`Ranking across years: ${agg.ranking.note}`)}${aggregate?'':' Single weather period; run bundled years for a distribution.'}</p></section>${siteTable}</div>`;
 const appendix=`<div class="appendix"><h2><span class="cat">Appendix</span>Reproducible assumptions</h2>${results.map((r,i)=>`<section><h2><span class="cat">§ A${String(i+1).padStart(2,'0')}</span>${escapeHTML(r.scenario.name)}</h2><h3>Warnings & assumptions</h3><ul>${(r.warnings||[]).map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul><details open><summary>Scenario JSON</summary><pre>${escapeHTML(JSON.stringify(r.scenario,null,2))}</pre></details><details open><summary>Model assumptions</summary><pre>${escapeHTML(JSON.stringify(r.assumptions||{},null,2))}</pre></details>${r.energyContext?`<details open><summary>Energy-source provenance</summary><pre>${escapeHTML(JSON.stringify(r.energyContext,null,2))}</pre></details>`:''}</section>`).join('')}${provenanceSection(`A${String(results.length+1).padStart(2,'0')}`,snapshot)}</div>`;
 return shell('design-basis brief','Design-basis brief',`${brief}${appendix}`,BRIEF_STYLE);
}
export function downloadRun(results,snapshot,format='json',extras={}){
 if(!Array.isArray(results)||!results.length)throw new Error('Run an analysis before exporting results.');
 if(format==='report'){download('cea-psychrometric-site-evaluator-report.html',reportHTML(results,snapshot),'text/html');return;}
 if(format==='design-basis'){download('cea-psychrometric-site-evaluator-design-basis.html',designBasisHTML(results,snapshot,extras||{}),'text/html');return;}
 if(format==='csv'){
 const keys=['time','valid','weatherMode','mode','reason','tempC','rh','vpd','compliantFraction','electricKWh','fuelKWh','waterL','condensateKg','lightKWh','solarDLI','lightDLI','heatingKWh','coolingKWh','dehuKWh','dehuHeatKWh','regenerationKWh','cost','co2Kg','unmetSensibleKWh','unmetMoistureKg','energyResidualW','moistureResidualKgS'];
 const rows=[['scenario','source','sourceKind','timezone',...keys].map(csvValue).join(',')];
 for(const r of results)for(const h of r.hours)rows.push([r.scenario.name,snapshot.source,snapshot.sourceKind,snapshot.timezone,...keys.map(k=>k==='time'?new Date(h.time).toISOString():h[k])].map(csvValue).join(','));
 download('cea-psychrometric-site-evaluator-hourly.csv',rows.join('\r\n'),'text/csv');return;
 }
 if(format!=='json')throw new Error('Unsupported export format.');
 download('cea-psychrometric-site-evaluator-run.json',JSON.stringify({schemaVersion:1,modelVersion:MODEL_VERSION,exportedAt:new Date().toISOString(),scenarios:results.map(r=>r.scenario),snapshot,results}),'application/json');
}
