/* Exported results document: one self-contained page a client can read, save and print to PDF.
   Archive register (parchment), static HTML only, the single print button its only behaviour.
   Every interpretation sentence is generated from the run's own numbers and carries them inline,
   so a reader can check the claim, and every claim ships with the limit that bounds it. */
import {MODEL_VERSION} from './config.js';
import {designHours, loadDecomposition, co2Window, aggregateYears, strategyFrontier, bindingConstraint, FREE_COOLING_MODES} from './metrics.js';
import {escapeHTML, modeLabel, monthlyChartSpec, loadsChartSpec, yearsChartSpec, chartSVG, ARCHIVE_PALETTE} from './charts.js';

export {escapeHTML};
const finite = value => typeof value === 'number' && Number.isFinite(value);
const num = (value, digits = 1) => finite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'Not available';
const int = value => num(value, 0);
const pct = (value, digits = 1) => finite(value) ? `${num(value, digits)}%` : 'Not available';
const money = (value, digits = 0) => finite(value) ? `$${num(value, digits)}` : 'Unpriced';
const plural = (count, one, many = `${one}s`) => `${int(count)} ${count === 1 ? one : many}`;

export const STYLE = `:root{color-scheme:light}body{background:#F3F0ED;color:#2B2C2E;font:15px/1.6 'Inter',system-ui,sans-serif;max-width:1000px;margin:auto;padding:40px 32px}.mark{font:700 13px 'DM Sans',sans-serif;letter-spacing:.28em;text-transform:uppercase;margin-bottom:40px}.mark em{font-style:normal;color:#4DB405}.cat{display:block;font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#9A8860;margin-bottom:8px}h1,h2{font-family:'DM Sans',sans-serif;font-weight:700;letter-spacing:-.025em;margin:0}h1{font-size:clamp(2.2rem,5vw,3.4rem);line-height:1.05;margin-bottom:14px}h2{font-size:1.5rem;margin-bottom:20px}h3{font:600 10px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#9A8860;margin:28px 0 8px}p{max-width:68ch;margin:0 0 14px}section{margin:56px 0;padding-top:28px;border-top:1px solid rgba(43,44,46,.15)}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(43,44,46,.15);vertical-align:top}th{font:500 11px 'Inter',sans-serif;color:rgba(43,44,46,.7);width:34%}td,pre{font-family:'IBM Plex Mono',monospace;font-size:13px;font-variant-numeric:tabular-nums}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}ul{padding-left:18px;font-size:13px;max-width:68ch}summary{font:500 10px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:rgba(43,44,46,.7);cursor:pointer;padding:10px 0}.notice{border:1px solid rgba(43,44,46,.3);padding:16px 18px;font-size:13px;max-width:none}.meta{font:11px 'IBM Plex Mono',monospace;letter-spacing:.06em;color:rgba(43,44,46,.7)}.foot{font:10px 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:rgba(43,44,46,.55);margin-top:48px}@media print{body{padding:0}details{display:block}section{break-inside:avoid}}`;
export const shell = (title, cat, body, extraStyle = '') => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CEA Psychrometric Site Evaluator | ${escapeHTML(title)} | Grownetics</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;600&display=swap" rel="stylesheet"><style>${STYLE}${extraStyle}</style><div class="mark">Grownetics<em>.</em></div><span class="cat">${escapeHTML(cat)}</span><h1>CEA Psychrometric Site Evaluator</h1>${body}<p class="foot">Grownetics · CEA Psychrometric Site Evaluator · Model ${escapeHTML(MODEL_VERSION)} · Generated ${escapeHTML(new Date().toISOString())}</p></html>`;
export const NOTICE = 'Assumption-based screening, not a calibrated greenhouse digital twin, guaranteed indoor condition, equipment selection certificate or crop-yield forecast. Hourly source weather does not establish minute-scale or canopy-level precision. Installed costs and component efficiencies are editable assumptions unless separately sourced. Regional grid mix is not utility procurement or marginal emissions.';
export const provenanceSection = (label, snapshot) => `<section><h2><span class="cat">§ ${escapeHTML(label)}</span>Weather provenance</h2><pre>${escapeHTML(JSON.stringify({...snapshot, hours: undefined, raw: undefined}, null, 2))}</pre><p>Export JSON alongside this document to retain raw weather, hourly results and all configuration values. This document alone is not the complete reproducibility bundle.</p></section>`;
export function localStamp(time, timezone) {
  if (!finite(time)) return 'Not available';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(time);
    const get = key => parts.find(p => p.type === key)?.value;
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
  } catch {return new Date(time).toISOString();}
}

/* Screening evidence that belongs to the repository rather than to this run. Cited, not asserted:
   every figure here is reproducible from the named file with the named command. */
const REPO_EVIDENCE = {
  tests: 63,
  cadence: 'Staged controller cadence check on the full Tulsa 2025 year, 1 minute against 0.5 minute dispatch: 0.004, 0.383 and 0.091 percentage points of attainment and at most 0.31 percent of electricity (docs/VERIFICATION.md). The older ideal optimizer does not converge, at 1.5 points and 1.95 percent, and remains selectable only as a labeled upper bound.',
  residuals: 'Hourly conservation identities close between 1e-16 and 5e-13 relative in the bundled checks (test/conservation.test.mjs).',
  morris: 'Morris elementary-effects screening of 12 assumptions, 104 points, 1,872 simulations (docs/SENSITIVITY.md, docs/morris-screening.json): crop leaf area and transpiration lead every metric at 9.10 points of attainment, envelope U-value follows at 5.89 and shade fraction at 3.43. The cost ranking as a whole is not stable, taking 3 distinct orders, while the three cheapest positions are identical in 104 of 104 screened points and the instability is confined to strategies whose median costs sit within 16 percent of each other.',
  notClaimed: 'Five things are absent from the evidence behind this document, and none of them can be inferred from it: measured-site calibration, a benchmark against an independent greenhouse model, manufacturer performance maps, equipment sizing, and any yield or revenue forecast.'};

const REPORT_STYLE = `.report h2{font-size:1.3rem}.report section{margin:44px 0;padding-top:22px}.lede{font:400 18px/1.5 'Inter',sans-serif;max-width:60ch}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1px;background:rgba(43,44,46,.15);border:1px solid rgba(43,44,46,.15);margin:24px 0}
.facts div{background:#F3F0ED;padding:12px 14px}.facts dt{font:500 9px 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:#9A8860;margin-bottom:5px}
.facts dd{margin:0;font:13px 'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.pdf{font:500 11px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;background:#4DB405;color:#1A1A1A;border:1px solid #4DB405;border-radius:4px;padding:11px 20px;cursor:pointer}
.interp{max-width:72ch}.interp strong{font-weight:600}.verdict{border:1px solid rgba(43,44,46,.3);padding:14px 18px;font-size:14px;max-width:none;margin:0 0 18px}
figure{margin:26px 0 18px}figure svg{display:block;max-width:100%;height:auto;border:1px solid rgba(43,44,46,.15);background:#FBFAF8}
figcaption{font:11px 'IBM Plex Mono',monospace;color:rgba(43,44,46,.7);margin:8px 0 12px;max-width:80ch}
.legend{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px;font:11px 'IBM Plex Mono',monospace;margin:0 0 12px}
.legend i{display:inline-block;width:9px;height:9px;margin-right:7px;vertical-align:baseline}
.wide{table-layout:fixed}.wide th,.wide td{width:auto;font-size:12px;overflow-wrap:anywhere}.wide th:first-child,.wide td.k{width:22%}
td.k{font:500 11px 'Inter',sans-serif;color:rgba(43,44,46,.7)}.data td,.data th{padding:6px 8px;font-size:12px}
.appendix{break-before:page}.page-foot{display:none}
@page{margin:18mm}
@media print{
 html,body{background:#FFF;color:#1E1F20}
 body{max-width:none;padding:0;font-size:10.5pt}
 .mark{margin-bottom:18px}h1{font-size:22pt}.report h2{font-size:13pt}.lede{font-size:12pt}
 .pdf{display:none}
 .foot{display:none}
 /* A fixed footer overlaps body text in paged output (Chrome prints it inside the content box),
    so the identity line is a static block at the end of the document instead. */
 .page-foot{display:block;margin-top:10mm;padding-top:3mm;font:8pt 'IBM Plex Mono',monospace;color:rgba(30,31,32,.65);border-top:1px solid rgba(30,31,32,.25);break-inside:avoid}
 section,figure,table,.facts,.verdict,.notice,details{break-inside:avoid;page-break-inside:avoid}
 tr,svg,figcaption{break-inside:avoid}
 thead{display:table-header-group}
 tfoot{display:table-footer-group}
 h2,h3{break-after:avoid}
 figure svg{border-color:rgba(30,31,32,.3);background:transparent}
 .facts,.facts div{background:transparent}
 a{color:inherit;text-decoration:none}
 a[href^="http"]::after{content:" (" attr(href) ")";font:8pt 'IBM Plex Mono',monospace;overflow-wrap:anywhere}
 .appendix{break-before:page}
}`;

const table = (head, rows, cls = '') => `<table class="data${cls ? ` ${cls}` : ''}"><thead><tr>${head.map(h => `<th>${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${
  rows.map(row => `<tr>${row.map((cell, i) => `<td${i ? '' : ' class="k"'}>${escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const interp = sentences => {
  const text = sentences.filter(Boolean).join(' ');
  return text ? `<p class="interp">${escapeHTML(text)}</p>` : '';
};
const legendList = entries => entries?.length
  ? `<ul class="legend">${entries.map(e => `<li><i style="background:${escapeHTML(ARCHIVE_PALETTE[e.role] || ARCHIVE_PALETTE['chart-8'])};opacity:${escapeHTML(e.opacity ?? 1)}"></i>${escapeHTML(e.label)}</li>`).join('')}</ul>`
  : '';
const figure = (spec, caption) => `<figure>${chartSVG(spec)}<figcaption>${escapeHTML(caption)} ${escapeHTML(spec.empty ? '' : spec.desc)}</figcaption>${
  spec.empty ? '' : `${legendList(spec.legend)}${table(spec.table.head, spec.table.rows)}`}</figure>`;

const RUNTIME_LABELS = [['pad', 'Evaporative pad'], ['indirect', 'Indirect evaporative'], ['dx', 'DX cooling'], ['dehu', 'Condensing dehumidifier'],
  ['desiccant', 'Desiccant'], ['doas', 'Dry-neutral DOAS'], ['heating', 'Heating'], ['humidifier', 'Humidification'], ['light', 'Supplemental light'],
  ['shadeScreen', 'Shade screen'], ['thermalScreen', 'Thermal curtain']];
function runtimeRows(result) {
  const runtime = result.summary?.runtime || {};
  return RUNTIME_LABELS.filter(([key]) => runtime[key]?.hours > 0).map(([key, label]) => {
    const row = runtime[key], duty = row.hours > 0 ? 100 * row.equivalentHours / row.hours : null;
    return [label, int(row.hours), int(row.days), num(row.equivalentHours, 1), `${pct(duty)} mean duty while on`];
  });
}
function busiest(result) {
  const runtime = result.summary?.runtime || {};
  const rows = RUNTIME_LABELS.filter(([key]) => runtime[key]?.hours > 0).map(([key, label]) => ({label, ...runtime[key]}));
  return rows.sort((a, b) => b.hours - a.hours)[0] || null;
}

const siteLabel = (snapshot, sites) => {
  const match = sites?.find(row => row.site?.latitude === snapshot.latitude && row.site?.longitude === snapshot.longitude)?.site;
  if (match) return `${match.city}, ${match.state} ${match.zip}`;
  return `${snapshot.zip ? `ZIP ${snapshot.zip}, ` : ''}${num(snapshot.latitude, 3)}, ${num(snapshot.longitude, 3)}`;
};
const modeHours = (weatherSummary, modes) => modes.reduce((sum, mode) => sum + (weatherSummary?.modeCounts?.[mode] || 0), 0);
function rankingPositions(aggregate) {
  const orders = Object.values(aggregate.ranking?.byYear || {}).filter(order => order.length);
  if (!orders.length) return [];
  const depth = Math.min(...orders.map(order => order.length));
  return Array.from({length: depth}, (_, i) => {
    const ids = [...new Set(orders.map(order => order[i]))];
    return {position: i + 1, ids, name: aggregate.byScenario[ids[0]]?.name || 'Unnamed'};
  });
}

/* ---- generated interpretation: one function per section, each sentence carrying its own numbers ---- */

function climateSentences(design, scenario, snapshot) {
  const out = [], hours = design.dryBulb.hours, db = design.dryBulb.p99_6, dp = design.dewPoint.p99;
  if (db && finite(db.tempC)) out.push(`The 0.4 percent design dry bulb is ${num(db.tempC)} C with a coincident wet bulb of ${num(db.wetBulbC)} C and dew point of ${num(db.dewPointC)} C, a state exceeded in about ${int(hours * .004)} of the ${int(hours)} valid weather hours in this record.`);
  if (scenario.padEnabled && db && finite(db.tempC) && finite(db.wetBulbC)) {
    const ceiling = scenario.dayTargetC + scenario.tempToleranceC, leaving = db.tempC - scenario.padEffectiveness * (db.tempC - db.wetBulbC);
    const gap = leaving - ceiling;
    out.push(`At the declared ${pct(scenario.padEffectiveness * 100, 0)} pad effectiveness, ideal wet-bulb approach and no other gain, that hour leaves the pad near ${num(leaving)} C, ${num(Math.abs(gap))} K ${gap > 0 ? 'above' : 'below'} the ${num(ceiling)} C band ceiling (day target ${num(scenario.dayTargetC)} C plus ${num(scenario.tempToleranceC)} K), so the pad alone ${gap > 0 ? 'does not hold' : 'can hold'} the design hour.`);
  }
  if (dp && finite(dp.dewPointC)) {
    const over = dp.dewPointC - scenario.maxDewPointC;
    out.push(`The 1 percent design dew point of ${num(dp.dewPointC)} C sits ${num(Math.abs(over))} K ${over > 0 ? 'above' : 'below'} the ${num(scenario.maxDewPointC)} C dew-point guardrail, so ${over > 0 ? 'moisture removal, not sensible cooling, sets the equipment at the design hour' : 'sensible cooling, not moisture removal, sets the equipment at the design hour'}.`);
  }
  out.push(`Coincident values belong to the same single hour rather than to independent percentiles, and all three exceedance levels come from the ${int(hours)} valid hours of this one weather period (${snapshot.startDate} to ${snapshot.endDate}), so they are a screening basis, not the stamped design conditions an engineer of record signs.`);
  return out;
}

function strategySentences(rows, frontier, aggregate, usingMedian) {
  const out = [], best = frontier.best, priced = frontier.rows.filter(r => finite(r.cost)).sort((a, b) => a.cost - b.cost);
  const basis = usingMedian ? 'median weather year' : 'observed period';
  if (best) out.push(`${best.name} is the cheapest non-dominated strategy at ${money(best.cost)} of ${basis} operating cost while holding the joint band ${pct(best.compliancePct)} of eligible hours, out of ${plural(frontier.rows.length, 'screened strategy', 'screened strategies')}.`);
  else out.push(`No strategy carries a complete price, so the ${int(frontier.rows.length)} screened options cannot be ranked by operating cost at all.`);
  if (frontier.frontier.length > 1) out.push(`The operating-cost frontier holds ${plural(frontier.frontier.length, 'strategy', 'strategies')} (${frontier.frontier.map(r => `${r.name} at ${money(r.cost)} and ${pct(r.compliancePct)}`).join('; ')}), so more attainment is available, at a price.`);
  const dominated = frontier.rows.filter(r => r.dominated);
  if (dominated.length) out.push(`${plural(dominated.length, 'strategy is', 'strategies are')} operating-dominated, beaten on both cost and attainment: ${dominated.map(r => `${r.name} (${money(r.cost)}, ${pct(r.compliancePct)})`).join('; ')}.`);
  const scored = rows.filter(r => finite(r.compliancePct));
  if (scored.length > 1) {
    const high = Math.max(...scored.map(r => r.compliancePct)), low = Math.min(...scored.map(r => r.compliancePct));
    out.push(high - low < 2
      ? `Attainment separates the strategies by only ${num(high - low)} points (${pct(low)} to ${pct(high)}), so at this band the choice is an operating-cost and risk question rather than an attainment question.`
      : `Attainment spans ${num(high - low)} points across the strategies (${pct(low)} to ${pct(high)}), so the classes are genuinely different at this band, not price variants of one answer.`);
  }
  if (priced.length > 1) {
    const gap = priced[0].cost > 0 ? 100 * (priced[1].cost - priced[0].cost) / priced[0].cost : null;
    out.push(finite(gap) && gap < 16
      ? `${priced[0].name} and ${priced[1].name} differ by ${pct(gap)} of operating cost, inside the 16 percent band in which the screened assumption ranges reorder strategies, so this screen cannot separate those two.`
      : `${priced[0].name} undercuts ${priced[1].name} by ${pct(gap)} of operating cost, wider than the 16 percent band in which the screened assumption ranges reorder strategies, so that gap survives the screened uncertainty.`);
  }
  const capital = rows.map(r => r.installedCost).filter(finite);
  if (capital.length) out.push(`Capital is reported but never ranked: the installed assumptions span ${money(Math.min(...capital))} to ${money(Math.max(...capital))} and are editable inputs, so a strategy on the operating frontier can still be the wrong purchase.`);
  return out;
}

function padSentences(weather, scenario, summary) {
  const out = [], pv = weather?.padViability, drying = weather?.outdoorDrying;
  if (pv && pv.coolingDemandHours > 0) {
    const share = 100 * pv.effectiveHours / pv.coolingDemandHours;
    out.push(share < 15
      ? `Pad-effective weather covers ${int(pv.effectiveHours)} h of the ${int(pv.coolingDemandHours)} h that show a cooling demand, ${pct(share)}, so at this site the pad is a marginal device rather than a primary cooling stage.`
      : `Pad-effective weather covers ${int(pv.effectiveHours)} h of the ${int(pv.coolingDemandHours)} h that show a cooling demand, ${pct(share)}, so the pad carries a real share of the cooling season here.`);
    out.push(`It is effective on ${int(pv.effectiveDays?.atLeast1)} days, of which ${int(pv.effectiveDays?.atLeast4)} give four hours or more, and it is ineffective in ${int(pv.ineffectiveHours)} h on ${int(pv.ineffectiveDays?.atLeast1)} days.`);
    const causes = pv.failureCauses || {};
    if ((causes.moisture || 0) + (causes.temperature || 0) > 0) {
      const moistureBinds = (causes.moisture || 0) >= (causes.temperature || 0);
      out.push(`The limit that binds more often is the ${moistureBinds ? 'moisture ceiling' : 'temperature margin'}: counted over every classified hour, ${int(causes.moisture)} h carry the moisture-ceiling flag against ${int(causes.temperature)} h that run out of temperature margin, so ${moistureBinds ? 'adding pad area cannot help those hours, while removing moisture can' : 'the binding problem is sensible capacity at high dry bulb rather than humidity'}.`);
    }
  } else out.push('The weather screen records no cooling-demand hours at this band, so pad viability cannot be assessed from 0 candidate hours.');
  const padRun = summary?.runtime?.pad;
  if (scenario.padEnabled && padRun?.hours > 0 && pv) {
    const ratio = pv.effectiveHours > 0 ? padRun.hours / pv.effectiveHours : null;
    out.push(`The controller still ran the pad ${int(padRun.hours)} h on ${int(padRun.days)} days for ${num(summary.padWaterL, 0)} L of water${finite(ratio) ? `, ${num(ratio)} times the ${int(pv.effectiveHours)} h the weather screen calls effective` : ''}, because staging it partially helps the zone even where it cannot hold the band alone.`);
  }
  if (drying) {
    const total = drying.coolDry.hours + drying.coldDry.hours + drying.hotDry.hours;
    out.push(`Outside air can carry moisture out of the zone in ${int(total)} h (cool-dry ${int(drying.coolDry.hours)}, cold-dry ${int(drying.coldDry.hours)}, hot-dry ${int(drying.hotDry.hours)}) at up to ${num(drying.maxVentACH)} ACH.`);
    if (finite(drying.dehuKWhPerKg)) out.push(`Against the declared ${num(drying.dehuKWhPerKg, 2)} kWh/kg condensing dehumidifier, outside air is cheaper per kilogram in ${int(drying.cheaperThanDehuHours)} h and lower in energy per kilogram in ${int(drying.lowerEnergyThanDehuHours)} h, so a ventilation-first moisture sequence is worth wiring.`);
    out.push(`Those are weather-side opportunity hours, not equipment runtime: the ${int(drying.coldDry.hours)} cold-dry hours carry a heating penalty that is priced here, while the sensible import of the ${int(drying.hotDry.hours)} hot-dry hours is not.`);
  }
  return out;
}

function loadSentences(loads, scenario) {
  const out = [], total = loads.total;
  if (!loads.hours) return ['No hour in this run carries load terms, so the sensible and latent split cannot be reported from 0 hours.'];
  const latentKWh = total.cropLatentKg * loads.latentKWhPerKg;
  out.push(`Across ${int(loads.hours)} valid hours the space sensible-heat ratio is ${finite(total.shr) ? num(total.shr, 2) : 'not defined'}: ${int(total.sensibleGainKWh)} kWh of positive sensible gain against ${int(latentKWh)} kWh of crop transpiration (${int(total.cropLatentKg)} kg of water).`);
  if (finite(total.shr)) out.push(total.shr < .7
    ? `A ratio of ${num(total.shr, 2)} is latent-dominated, so a coupled cooling coil has to overcool to reach the moisture target, and a decoupled latent stage (dry-neutral DOAS or desiccant) deserves screening against the ${int(latentKWh)} kWh of latent load.`
    : `A ratio of ${num(total.shr, 2)} is sensible-dominated, so sensible capacity rather than moisture removal sets the equipment in most hours, and the ${int(latentKWh)} kWh of latent load can ride on a coupled coil.`);
  const scored = loads.monthly.filter(m => finite(m.shr));
  if (scored.length > 1) {
    const low = scored.reduce((a, b) => b.shr < a.shr ? b : a), high = scored.reduce((a, b) => b.shr > a.shr ? b : a);
    out.push(`The ratio moves through the year from ${num(low.shr, 2)} in ${low.month} to ${num(high.shr, 2)} in ${high.month}, so a single design-day ratio matches at most 1 of the ${int(scored.length)} months in this record.`);
  }
  if (loads.noGainHours) out.push(`${int(loads.noGainHours)} hours carry no positive sensible gain at all and so carry no ratio; they are the heating hours, excluded from the ${int(loads.hours - loads.noGainHours)} hours in the ratio histogram rather than counted as zero.`);
  out.push(`The ratio is defined here as positive sensible gains over those gains plus the latent heat of crop transpiration at ${num(loads.latentKWhPerKg, 3)} kWh/kg, with transpiration itself the single most influential assumption in the screening at 9.10 points of attainment, so treat ${finite(total.shr) ? num(total.shr, 2) : 'this ratio'} as a range, not a constant.`);
  return out;
}

function runtimeSentences(result) {
  const out = [], summary = result.summary || {}, scenario = result.scenario;
  const top = busiest(result);
  if (top) out.push(`The busiest component is ${top.label.toLowerCase()} at ${int(top.hours)} h on ${int(top.days)} days, ${num(top.equivalentHours, 1)} equivalent full-load hours, a mean duty of ${pct(100 * top.equivalentHours / top.hours)} while it is on.`);
  const heat = summary.heatingKWh || 0, reheat = summary.reheatKWh || 0, denominator = heat + reheat;
  if (reheat > 0 && denominator > 0) {
    const share = 100 * reheat / denominator;
    out.push(share > 10
      ? `Reheat after overcooling for moisture control is ${int(reheat)} kWh, ${pct(share)} of the ${int(denominator)} kWh of delivered heat, so this strategy pays a real reheat penalty; a dry-neutral DOAS or a desiccant stage removes moisture without overcooling first.`
      : `Reheat after overcooling is ${int(reheat)} kWh, only ${pct(share)} of the ${int(denominator)} kWh of delivered heat, so the reheat penalty is not what decides this strategy.`);
  } else out.push(`No reheat energy appears in this strategy (${int(reheat)} kWh), so it does not overcool to control moisture at this band.`);
  const unmetSensible = summary.unmetSensibleKWh || 0, unmetMoisture = summary.unmetMoistureKg || 0;
  out.push(unmetSensible + unmetMoisture > 0
    ? `Installed capacity runs out somewhere: ${int(unmetSensible)} kWh of sensible demand and ${int(unmetMoisture)} kg of moisture are reported unmet rather than absorbed silently, and the longest continuous band miss is ${num(summary.longestFailureHours)} h.`
    : `No unmet sensible or moisture demand is reported (${int(unmetSensible)} kWh and ${int(unmetMoisture)} kg), so within these assumptions the declared capacities were never the binding limit, and the longest band miss of ${num(summary.longestFailureHours)} h comes from control rather than capacity.`);
  out.push(`Runtime follows the declared capacities, not measured equipment: ${num(scenario.heaterKW)} kW of heat at ${pct(scenario.heaterEfficiency * 100, 0)} efficiency, ${num(scenario.coolingKW)} kW of cooling at COP ${num(scenario.coolingCOP, 2)} and SHR ${num(scenario.coolingSHR, 2)}, and ${num(scenario.dehuKgH, 1)} kg/h of dehumidification at ${num(scenario.dehuLPerKWh, 2)} L/kWh, all editable inputs with no manufacturer curve behind them.`);
  return out;
}

function co2Sentences(co2) {
  const out = [], share = co2.validHours ? 100 * co2.equivalentHours / co2.validHours : null;
  out.push(`Enrichment is not immediately flushed in ${num(co2.equivalentHours, 0)} duty-weighted equivalent hours spread over ${int(co2.days)} days, ${pct(share)} of the ${int(co2.validHours)} valid hours, against a weather-side counterpart of ${int(co2.weatherSideHours)} h with no primary ventilation demand.`);
  out.push(finite(share) && share < 20
    ? `At ${pct(share)} of hours the window is narrow, so enrichment here is an opportunistic addition rather than a continuous strategy.`
    : `At ${pct(share)} of hours the window is wide enough to plan enrichment around, subject to injection hardware this screen does not model.`);
  out.push(`No CO2 mass balance, injection rate, leakage or crop uptake is modeled, so the ${num(co2.equivalentHours, 0)} equivalent hours are an upper bound on opportunity and not a yield claim.`);
  return out;
}

function yearSentences(aggregate, frontier) {
  const out = [], best = frontier.best, entry = best ? aggregate.byScenario[best.id] : null;
  const years = aggregate.years.length;
  if (entry) out.push(`Over ${plural(years, 'weather year')} ${entry.name} holds the band ${pct(entry.median.compliancePct)} in the median year and ${pct(entry.worst?.compliancePct)} in its worst year (${entry.worst?.label ?? 'not available'}), a spread of ${num(entry.spread?.compliancePct)} points, with median operating cost ${money(entry.median.cost)} and a cost spread of ${money(entry.spread?.cost)}.`);
  const positions = rankingPositions(aggregate), firm = positions.filter(p => p.ids.length === 1), loose = positions.filter(p => p.ids.length > 1);
  const orders = new Set(Object.values(aggregate.ranking?.byYear || {}).map(ids => ids.join('|'))).size;
  if (positions.length) out.push(orders === 1
    ? `The operating-cost order is identical in all ${int(years)} years (${positions.map(p => `${p.position}: ${p.name}`).join('; ')}), so the ranking is firm against the choice of weather year, while the screened assumption ranges still reorder strategies whose median costs sit within 16 percent of each other.`
    : firm.length
      ? `${plural(firm.length, 'position is', 'positions are')} firm in every one of the ${int(years)} years (${firm.map(p => `${p.position}: ${p.name}`).join('; ')}), while ${plural(loose.length, 'position', 'positions')} (${loose.map(p => p.position).join(', ')}) are interchangeable across ${int(orders)} distinct cost orders.`
      : `No ranking position is firm: all ${int(positions.length)} positions change between years across ${int(orders)} distinct cost orders, so no strategy can be called the cheapest at this site on this evidence.`);
  const trend = entry?.trend;
  out.push(finite(trend?.compliancePctPerYear)
    ? `The least-squares trend over ${int(trend.numericYears)} numeric years is ${num(trend.compliancePctPerYear, 2)} points of attainment per year, which describes these observed years and is not a climate projection.`
    : `No trend is fitted: ${int(trend?.numericYears || years)} numeric weather years is below the 5-year minimum this tool requires before drawing a slope, and a sample of years is not a projection either way.`);
  return out;
}

function siteSentences(sites) {
  const out = [];
  const ranked = sites.filter(row => finite(row.freeCoolingHours)).sort((a, b) => b.freeCoolingHours - a.freeCoolingHours);
  if (ranked.length > 1) {
    const top = ranked[0], bottom = ranked.at(-1);
    const name = row => `${row.site?.city ?? 'Site'}${row.site?.state ? `, ${row.site.state}` : ''}`;
    out.push(`${name(top)} gives ${int(top.freeCoolingHours)} free-cooling hours in the median year against ${int(bottom.freeCoolingHours)} at ${name(bottom)}, a factor of ${num(bottom.freeCoolingHours > 0 ? top.freeCoolingHours / bottom.freeCoolingHours : 0)}, and ${int(top.padEffectiveHours)} against ${int(bottom.padEffectiveHours)} pad-effective hours.`);
    const differing = new Set(sites.map(row => row.bindingConstraint));
    out.push(differing.size > 1
      ? `The binding constraint is not the same problem at every site (${sites.map(row => `${name(row)}: ${row.bindingConstraint}`).join('; ')}), so one equipment answer cannot be carried across all ${int(sites.length)} of them.`
      : `All ${int(sites.length)} sites share the same binding constraint (${[...differing][0]}), so the same equipment class is at least the right starting point at each.`);
    const unstable = sites.filter(row => !row.rankingStable);
    out.push(unstable.length
      ? `${plural(unstable.length, 'site has', 'sites have')} a year-dependent cost ranking (${unstable.map(name).join(', ')}), so a site choice made on a single year of cost would be unreliable at ${int(unstable.length)} of ${int(sites.length)} sites.`
      : `The cost ranking is stable within the run years at all ${int(sites.length)} sites, which bounds year risk but not the assumption risk in the 16 percent band.`);
  }
  return out;
}

function summarySentences(context) {
  const {results, snapshot, primary, weather, design, loads, co2, aggregate, frontier, constraint, usingMedian, site} = context;
  const summary = primary.summary || {}, scenario = primary.scenario;
  const free = modeHours(weather, FREE_COOLING_MODES), classified = weather?.validHours || 0;
  const pv = weather?.padViability;
  const out = [];
  out.push(`At ${site}, over ${int(classified)} classified weather hours from ${snapshot.startDate} to ${snapshot.endDate}, the climate gives ${int(free)} hours (${pct(classified ? 100 * free / classified : null)}) in which outside air or an evaporative pad can do the cooling, of which the pad screens as effective in only ${int(pv?.effectiveHours)} h.`);
  const hours = constraint.hours;
  out.push(`What binds is ${constraint.binding}: in this period the weather screen counts ${int(hours.moisture)} h moisture-limited against ${int(hours.temperature)} h temperature-limited and ${int(hours.heating)} h of heating, so this is ${constraint.binding === 'moisture' ? 'a moisture problem before it is a cooling problem' : constraint.binding === 'temperature' ? 'a sensible-cooling problem before it is a moisture problem' : 'a heating problem before it is a cooling problem'}.`);
  if (frontier.best) out.push(`On operating cost the frontier is held by ${frontier.best.name} at ${money(frontier.best.cost)} per ${usingMedian ? 'median weather year' : 'observed period'} while holding the joint band ${pct(frontier.best.compliancePct)} of ${int(summary.eligibleHours)} eligible hours, with ${plural(frontier.rows.filter(r => r.dominated).length, 'strategy', 'strategies')} dominated on both cost and attainment.`);
  if (finite(loads.total?.shr)) out.push(`Crop moisture is ${pct(100 * (1 - loads.total.shr))} of the load the equipment sees (${int(loads.total.cropLatentKg * loads.latentKWhPerKg)} kWh latent against ${int(loads.total.sensibleGainKWh)} kWh sensible, a sensible-heat ratio of ${num(loads.total.shr, 2)}), which is the term that decides between a coupled coil and a decoupled latent stage, and it is also the least certain input in the screening.`);
  const entry = frontier.best ? aggregate.byScenario[frontier.best.id] : null;
  out.push(entry && aggregate.years.length > 1
    ? `Across ${plural(aggregate.years.length, 'weather year')} that verdict moves from ${pct(entry.median.compliancePct)} in the median year to ${pct(entry.worst?.compliancePct)} in the worst (${entry.worst?.label}), a ${num(entry.spread?.compliancePct)} point spread, and ${aggregate.ranking.stable ? `the cost order is identical in all ${int(aggregate.years.length)} years` : `the cost order changes between years, ${int(new Set(Object.values(aggregate.ranking.byYear).map(ids => ids.join('|'))).size)} distinct orders`}.`
    : `This is ${plural(aggregate.years.length, 'weather year')} only, so year risk is unmeasured here; the bundled ten-year Tulsa set moves baseline attainment by 2.7 points between its median and worst years, which is the order of variation a single year hides.`);
  out.push(REPO_EVIDENCE.morris);
  out.push(`What the reader must not conclude: these are ${int(results.length)} sets of assumed component performance run against ${int(summary.expectedHours)} hours of reanalysis weather at evidence tier "${primary.assumptions?.evidenceTier || 'Assumption-based component screening'}" on model ${primary.modelVersion || MODEL_VERSION}, so the figures cannot size equipment, cannot rank one manufacturer against another and cannot forecast a single kilogram of yield.`);
  out.push(REPO_EVIDENCE.notClaimed);
  out.push(`${REPO_EVIDENCE.residuals} ${int(REPO_EVIDENCE.tests)} regression tests pass in this repository, which bounds arithmetic and bookkeeping, not physical accuracy: no figure in this document is evidence that a built facility will behave this way.`);
  return out;
}

/* ---- document ---- */

export function reportHTML(results, snapshot, {aggregate = null, sites = null} = {}) {
  const primary = results[0], scenario = primary.scenario, summary = primary.summary || {}, timezone = snapshot.timezone;
  const per = results.map(result => ({result, design: designHours(snapshot.hours, result.hours, result.scenario), loads: loadDecomposition(result), co2: co2Window(result)}));
  const agg = aggregate || aggregateYears([{label: `${snapshot.startDate} to ${snapshot.endDate}`, snapshot, results}]);
  const frontier = strategyFrontier(agg), constraint = bindingConstraint(results.map(r => r.weatherSummary).filter(Boolean));
  const usingMedian = Boolean(aggregate) && agg.years.length > 1;
  const site = siteLabel(snapshot, sites);
  const context = {results, snapshot, primary, weather: primary.weatherSummary, design: per[0].design, loads: per[0].loads, co2: per[0].co2, aggregate: agg, frontier, constraint, usingMedian, site};
  const tier = primary.assumptions?.evidenceTier || 'Assumption-based component screening';
  const strategyRow = ({result}) => {
    const s = result.summary || {}, entry = agg.byScenario[result.scenario.id];
    return [result.scenario.name,
      usingMedian ? `${pct(entry?.median.compliancePct)} median, ${pct(entry?.worst?.compliancePct)} worst` : pct(s.compliancePct),
      usingMedian ? `${money(entry?.median.cost)} median year` : money(s.cost, 2),
      `${int(s.electricKWh)} / ${int(s.fuelKWh)}`,
      money(result.scenario.installedCost),
      frontier.rows.find(r => r.id === result.scenario.id)?.dominated ? 'Operating-dominated' : frontier.frontier.some(r => r.id === result.scenario.id) ? 'On operating frontier' : 'Unpriced or unscored'];
  };
  const generatedAt = new Date().toISOString();
  const facts = [
    ['Site', site], ['Period', `${snapshot.startDate} to ${snapshot.endDate}`], ['Time zone', timezone],
    ['Weather years', aggregate ? agg.years.join(', ') : '1, this period only'], ['Weather source', `${snapshot.source} (${snapshot.sourceKind})`],
    ['Model version', primary.modelVersion || MODEL_VERSION], ['Evidence tier', tier],
    ['Facility / crop', `${scenario.facility} / ${scenario.crop}`], ['Strategies screened', int(results.length)],
    ['Valid / missing hours', `${int(summary.validHours)} / ${int(summary.missingHours)}`],
    ['Generated', generatedAt]];
  let index = 0;
  const section = (title, inner, cls = '') => {
    index++;
    return `<section${cls ? ` class="${cls}"` : ''}><h2><span class="cat">§ ${String(index).padStart(3, '0')}</span>${escapeHTML(title)}</h2>${inner}</section>`;
  };
  const climate = per[0].design;
  const level = (block, key) => ['p99_6', 'p99', 'p98'].map(p => `${num(block?.[p]?.[key])} C`);
  const climateRows = [
    ['Dry bulb exceeded', ...level(climate.dryBulb, 'tempC')], ['  coincident wet bulb', ...level(climate.dryBulb, 'wetBulbC')],
    ['  coincident dew point', ...level(climate.dryBulb, 'dewPointC')], ['Dew point exceeded', ...level(climate.dewPoint, 'dewPointC')],
    ['  coincident dry bulb', ...level(climate.dewPoint, 'tempC')], ['Wet bulb exceeded', ...level(climate.wetBulb, 'wetBulbC')],
    ['  coincident dry bulb', ...level(climate.wetBulb, 'tempC')]];
  const peak = design => [
    ['Peak sensible hour', design.peakSensibleHour ? `${num(design.peakSensibleHour.sensibleKWh)} kWh/h at ${localStamp(design.peakSensibleHour.time, timezone)}` : 'No load terms'],
    ['Peak latent hour', design.peakLatentHour ? `${num(design.peakLatentHour.latentKg)} kg/h at ${localStamp(design.peakLatentHour.time, timezone)}` : 'No load terms'],
    ['Ventilation air requirement', finite(design.ventilationAirRequirement.maxACH) ? `${num(design.ventilationAirRequirement.maxACH)} ACH, ${num(design.ventilationAirRequirement.m3s, 2)} m³/s` : 'Not available'],
    ['Condensate peak', `${num(design.condensatePeakKgH)} kg/h`], ['Pad water peak', `${num(design.padWaterPeakLH)} L/h`]];

  const body = [
    `<p class="lede">${escapeHTML(`Site evaluation for ${site}: what the climate gives free, what binds, which strategy class sits on the operating-cost frontier, and how far that verdict survives weather years and screened assumptions.`)}</p>`,
    `<dl class="facts">${facts.map(([key, value]) => `<div><dt>${escapeHTML(key)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('')}</dl>`,
    `<p><button type="button" class="pdf" onclick="window.print()">Save as PDF</button></p>`,
    section('Executive summary', `${interp(summarySentences(context))}<p class="notice">${escapeHTML(NOTICE)}</p>`),
    section('Climate design conditions', `${table(['Condition', '0.4 percent', '1 percent', '2 percent'], climateRows)}${interp(climateSentences(climate, scenario, snapshot))}<p class="meta">${escapeHTML(climate.basis)}</p>`),
    section('Strategy comparison', `${table(['Strategy', usingMedian ? 'Joint attainment, years' : 'Joint attainment', 'Operating cost', 'Electric / fuel kWh', 'Installed capital assumption', 'Operating frontier'],
      per.map(strategyRow), 'wide')}${interp(strategySentences(frontier.rows.map(row => ({...row, installedCost: results.find(r => r.scenario.id === row.id)?.scenario.installedCost})), frontier, agg, usingMedian))}`),
    section('Operating modes through the year', `${figure(monthlyChartSpec(primary.hours, timezone), `Equipment operating modes by local month for ${scenario.name}.`)}${
      interp([`The dispatch splits into ${int(Object.keys(summary.modeCounts || {}).length)} distinct equipment modes over ${int(summary.eligibleHours)} eligible hours, with the joint band held in ${num(summary.compliantHours)} equivalent hours (${pct(summary.compliancePct)}).`,
        `Mode counts are the most frequent mode per hour under these assumptions, not a measured schedule, and ${int(summary.warmupHours)} segment warm-up hours are excluded from the comparison set.`])}`),
    section('Pad and outside-air opportunity', interp(padSentences(primary.weatherSummary, scenario, summary)) + `<p class="meta">${escapeHTML(primary.weatherSummary?.outdoorDrying?.basis || '')}</p>`),
    section('Sensible against latent load', `${figure(loadsChartSpec(per[0].loads), `Monthly space loads for ${scenario.name}, sensible gains above the axis, sensible losses and latent gains below.`)}${
      interp(loadSentences(per[0].loads, scenario))}<p class="meta">${escapeHTML(per[0].loads.basis)}</p>`),
    section('Equipment runtime and design peaks', `${table(['Component', 'Hours', 'Days', 'Equivalent full-load h', 'Duty'], runtimeRows(primary), 'wide')}${
      table(['Design quantity', 'Value'], peak(per[0].design))}${interp(runtimeSentences(primary))}`),
    section('CO2 enrichment window', `${table(['Quantity', 'Value'], [['Equivalent enrichment hours', num(per[0].co2.equivalentHours, 0)], ['Hours with any window', int(per[0].co2.hoursAny)],
      ['Days touched', int(per[0].co2.days)], ['Weather-side counterpart', `${int(per[0].co2.weatherSideHours)} h`], ['Valid hours', int(per[0].co2.validHours)]])}${interp(co2Sentences(per[0].co2))}`),
    aggregate ? section('Multi-year risk', `${figure(yearsChartSpec(agg, scenario.id), `Joint attainment by weather year for ${scenario.name}.`)}${
      table(['Strategy', 'Median attainment', 'Worst year', 'Best year', 'Median cost', 'Attainment / cost spread'],
        Object.values(agg.byScenario).map(row => [row.name, pct(row.median.compliancePct), `${row.worst?.label ?? 'n/a'} at ${pct(row.worst?.compliancePct)}`,
          `${row.best?.label ?? 'n/a'} at ${pct(row.best?.compliancePct)}`, money(row.median.cost), `${num(row.spread?.compliancePct)} pts / ${money(row.spread?.cost)}`]), 'wide')}${
      interp(yearSentences(agg, frontier))}<p class="meta">${escapeHTML(agg.basis)} ${escapeHTML(agg.ranking.note)}</p>`) : '',
    sites?.length > 1 ? section('Multi-site comparison', `${table(['Site', 'Free cooling h', 'Pad-effective h', 'Binding constraint', 'Best strategy', 'Median attainment', 'Median cost', 'Ranking'],
      sites.map(row => [`${row.site?.city ?? ''}${row.site?.state ? `, ${row.site.state}` : ''} ${row.site?.zip ?? ''}`.trim() || 'Site', int(row.freeCoolingHours), int(row.padEffectiveHours),
        row.bindingConstraint, row.bestStrategy?.name ?? 'None', pct(row.bestStrategy?.compliancePct), money(row.bestStrategy?.cost), row.rankingStable ? 'stable' : 'year-dependent']), 'wide')}${
      interp(siteSentences(sites))}<p class="meta">${escapeHTML(sites[0].basis || '')}</p>`) : '',
    section('Reproducibility and evidence', `${table(['Item', 'Value'], [
      ['Model version', primary.modelVersion || MODEL_VERSION], ['Evidence tier', tier],
      ['Controller', primary.summary?.controlModeUsed || scenario.controlMode || 'staged'], ['Transpiration model', primary.summary?.transpirationModelUsed || 'stanghellini'],
      ['Dispatch step', `${num(primary.assumptions?.stepMinutes, 2)} minute`], ['Warm-up hours per segment', int(primary.assumptions?.warmupHoursPerSegment)],
      ['Leaf area index', num(primary.assumptions?.leafAreaIndex, 2)], ['PsychroLib', `${primary.assumptions?.psychrolibVersion ?? 'not recorded'} at commit ${primary.assumptions?.psychrolibCommit ?? 'not recorded'}`],
      ['Expected / valid / missing hours', `${int(summary.expectedHours)} / ${int(summary.validHours)} / ${int(summary.missingHours)}`],
      ['Numerical failure hours', int(summary.numericalFailureHours)],
      ['Largest sensible residual', `${num(summary.maxEnergyResidualW, 12)} W`], ['Largest moisture residual', `${num(summary.maxMoistureResidualKgS, 18)} kg/s`],
      ['Electricity price basis', summary.costBasis || primary.energyContext?.appliedPriceMode || scenario.priceMode]])}
${interp([REPO_EVIDENCE.cadence, REPO_EVIDENCE.residuals, `${int(REPO_EVIDENCE.tests)} regression tests pass on this model version, covering finite capacity, photon conservation, dehumidifier and regeneration energy, cadence-invariant unmet loads, pad runtime, missingness, daylight-saving folds and price provenance.`, REPO_EVIDENCE.notClaimed])}
<p>To repeat this document: serve the repository, load the weather snapshot named above, import the scenario JSON in the appendix, run all scenarios and export the report. The run JSON carries the hourly results this page summarizes; this page alone is not the reproducibility bundle.</p>
<p><a href="${escapeHTML(snapshot.sourceUrl || 'https://power.larc.nasa.gov/')}">Weather source endpoint</a></p>`),
    `<div class="appendix">${section('Assumptions and provenance appendix', `${results.map(result => `<h3>${escapeHTML(result.scenario.name)}</h3><ul>${
      (result.warnings || []).map(w => `<li>${escapeHTML(w)}</li>`).join('')}</ul><details open><summary>Reproducible scenario JSON</summary><pre>${escapeHTML(JSON.stringify(result.scenario, null, 2))}</pre></details>${
      result.energyContext ? `<details open><summary>Energy-source provenance</summary><pre>${escapeHTML(JSON.stringify(result.energyContext, null, 2))}</pre></details>` : ''}`).join('')}
<details open><summary>Weather provenance</summary><pre>${escapeHTML(JSON.stringify({...snapshot, hours: undefined, raw: undefined}, null, 2))}</pre></details>
<details open><summary>Model assumptions</summary><pre>${escapeHTML(JSON.stringify(primary.assumptions || {}, null, 2))}</pre></details>`)}</div>`,
    `<p class="page-foot">${escapeHTML(`Grownetics · CEA Psychrometric Site Evaluator · Model ${primary.modelVersion || MODEL_VERSION} · ${site} · Generated ${generatedAt}`)}</p>`
  ].join('');
  return shell('site evaluation results', 'Site evaluation results', `<div class="report">${body}</div>`, REPORT_STYLE);
}
