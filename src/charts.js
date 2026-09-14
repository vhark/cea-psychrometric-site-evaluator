const NS = 'http://www.w3.org/2000/svg';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const colors = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-8'];
const scatterColor = {outdoor: 'text-2', pad: 'green'};
const number = (value, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: digits}) : 'Not available';
export const modeLabel = value => String(value || 'Missing data').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function blank(container, message) {
  const p = document.createElement('p'); p.className = 'empty-chart'; p.textContent = message; container.replaceChildren(p);
}
function makeSvg(container, width, height, label) {
  const svg = svgNode('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label});
  svg.append(svgNode('title', {}, label)); container.replaceChildren(svg); return svg;
}
function ticks(svg, {left, top, width, height, max, count = 4, unit = ''}) {
  for (let i = 0; i <= count; i++) {
    const y = top + height - height * i / count;
    svg.append(svgNode('line', {x1: left, x2: left + width, y1: y, y2: y, class: 'grid-line'}));
    svg.append(svgNode('text', {x: left - 8, y: y + 3, 'text-anchor': 'end'}, number(max * i / count, max < 10 ? 1 : 0)));
  }
  if (unit) svg.append(svgNode('text', {x: left, y: top - 10, class: 'axis-label'}, unit));
}
export function modeEntries(hours, weatherOnly = false) {
  const counts = new Map();
  for (const hour of hours) {
    const mode = weatherOnly ? hour.weatherMode : hour.mode;
    if (!mode || mode === 'MISSING_DATA' || (!weatherOnly && !hour.valid)) continue;
    counts.set(mode, (counts.get(mode) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}
export function renderMonthly(container, legend, hours, timezone, weatherOnly = false) {
  const entries = modeEntries(hours, weatherOnly);
  if (!entries.length) {blank(container, 'No valid operating modes in this record.'); legend.replaceChildren(); return;}
  const monthFormat = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit'});
  const months = new Map();
  for (const hour of hours) {
    if (!Number.isFinite(hour.time)) continue;
    const parts = monthFormat.formatToParts(hour.time);
    const key = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
    if (!months.has(key)) months.set(key, new Map());
    const mode = weatherOnly ? hour.weatherMode : hour.mode;
    if (!mode || mode === 'MISSING_DATA' || (!weatherOnly && !hour.valid)) continue;
    const row = months.get(key); row.set(mode, (row.get(mode) || 0) + 1);
  }
  const data = [...months].sort((a, b) => a[0].localeCompare(b[0]));
  const width = 800, height = 225, left = 48, top = 23, plotHeight = 161, plotWidth = width - left - 12;
  const max = Math.max(1, ...data.map(([, row]) => [...row.values()].reduce((a, b) => a + b, 0)));
  const svg = makeSvg(container, width, height, `Operating-mode hours by local calendar month. ${data.length} months. See mode table below.`);
  ticks(svg, {left, top, width: plotWidth, height: plotHeight, max, unit: 'hours'});
  const step = plotWidth / data.length;
  data.forEach(([month, row], index) => {
    let y = top + plotHeight;
    entries.forEach(([mode], mi) => {
      const count = row.get(mode) || 0;
      if (!count) return;
      const h = count / max * plotHeight; y -= h;
      const rect = svgNode('rect', {x: left + index * step + step * .18, y, width: step * .64, height: h, fill: `var(--${colors[mi % colors.length]})`});
      rect.append(svgNode('title', {}, `${month}: ${modeLabel(mode)}, ${number(count)} hours`)); svg.append(rect);
    });
    if (data.length <= 18 || index % Math.ceil(data.length / 12) === 0) svg.append(svgNode('text', {x: left + index * step + step / 2, y: top + plotHeight + 20, 'text-anchor': 'middle'}, data.length <= 12 ? month.slice(5) : month));
  });
  legend.replaceChildren();
  entries.forEach(([mode], index) => {
    const span = document.createElement('span'), swatch = document.createElement('i'); swatch.className = 'swatch'; swatch.style.background = `var(--${colors[index % colors.length]})`;
    span.append(swatch, document.createTextNode(modeLabel(mode))); legend.append(span);
  });
}
/* Timeline cells carry a shape as well as a colour, so the calendar is readable without colour vision.
   Cells are batched into one Path2D per colour+shape class, so 8,760 cells cost a handful of draw calls. */
const GLYPH_NAMES = {block: 'solid block', lower: 'lower half block', upper: 'upper half block', hatch: 'open cell with a diagonal slash', dot: 'centre dot', left: 'left half block', right: 'right half block', bar: 'centre bar'};
const MODE_GLYPHS = ['block', 'lower', 'upper', 'hatch', 'dot', 'left', 'right', 'bar'];
const ATTAINMENT = {
  full: {color: 'ok', glyph: 'block', code: 'FULL', text: 'every substep inside the joint band'},
  partial: {color: 'warn', glyph: 'lower', code: 'PART', text: 'some substeps inside the joint band'},
  none: {color: 'bad', glyph: 'hatch', code: 'MISS', text: 'no substep inside the joint band'},
  invalid: {color: 'text-3', glyph: 'dot', code: 'NA', text: 'invalid, warm-up, ineligible or unavailable'},
};
const ATTAINMENT_ORDER = ['full', 'partial', 'none', 'invalid'];
/** The one classification the calendar, the day-by-hour table and the inspector all read from. */
export const attainmentClass = hour => !hour || !hour.valid || hour.eligible === false || hour.warmup || !Number.isFinite(hour.compliantFraction) ? 'invalid' : hour.compliantFraction >= .999 ? 'full' : hour.compliantFraction > 0 ? 'partial' : 'none';
export const attainmentText = cls => ATTAINMENT[cls]?.text || ATTAINMENT.invalid.text;
export const attainmentCode = cls => ATTAINMENT[cls]?.code || ATTAINMENT.invalid.code;
/** Initials for multi-word mode names, first four letters otherwise: PAD_EFFECTIVE -> PE, HEATING -> HEAT. */
export function modeCode(mode) {
  const words = String(mode || 'MISSING_DATA').split('_').filter(Boolean);
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0].slice(0, 4)).toUpperCase();
}
function glyphPath(name, fill, stroke, x, y, w, h) {
  const thick = value => Math.max(.6, value);
  switch (name) {
    case 'lower': fill.rect(x, y + h / 2, w, thick(h / 2)); break;
    case 'upper': fill.rect(x, y, w, thick(h / 2)); break;
    case 'left': fill.rect(x, y, thick(w / 2), h); break;
    case 'right': fill.rect(x + w / 2, y, thick(w / 2), h); break;
    case 'bar': fill.rect(x, y + h * .35, w, thick(h * .3)); break;
    case 'dot': {const s = Math.min(2.4, Math.max(.8, Math.min(w, h) * .34)); fill.rect(x + (w - s) / 2, y + (h - s) / 2, s, s); break;}
    case 'hatch': stroke.rect(x + .3, y + .3, Math.max(.4, w - .6), Math.max(.4, h - .6)); stroke.moveTo(x + .3, y + h - .3); stroke.lineTo(x + w - .3, y + .3); break;
    default: fill.rect(x, y, w, h);
  }
}
export function renderTimeline(container, hours, onSelect, weatherOnly = false, modeOrder = null) {
  if (!hours.length) {blank(container, 'No hourly record.'); return;}
  const start = Math.floor(hours[0].time / DAY) * DAY;
  const days = Math.max(1, Math.floor((hours.at(-1).time - start) / DAY) + 1);
  const width = 1100, height = 280, left = 32, right = 8, top = 8, bottom = 30;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const entries = modeOrder || modeEntries(hours, true), ranks = new Map(entries.map(([mode], index) => [mode, index]));
  const legendParts = weatherOnly
    ? [...entries.map(([mode], index) => `${modeLabel(mode)} (${modeCode(mode)}): ${GLYPH_NAMES[MODE_GLYPHS[index % MODE_GLYPHS.length]]}`), 'Unclassified: centre dot']
    : ATTAINMENT_ORDER.map(cls => `${ATTAINMENT[cls].code} is a ${GLYPH_NAMES[ATTAINMENT[cls].glyph]}: ${ATTAINMENT[cls].text}`);
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${days} UTC days by 24 hours. Each cell is drawn as a shape as well as a colour. ${legendParts.join('. ')}. Cells with no source hour stay empty. The day by hour table below and the hourly inspector slider are the keyboard and text alternatives.`);
  const ctx = canvas.getContext('2d');
  if (!ctx) {blank(container, 'Canvas is unavailable. Use the day by hour table, the hourly inspector and the exported hourly CSV.'); return;}
  ctx.scale(2, 2);
  const styles = getComputedStyle(document.documentElement), color = key => styles.getPropertyValue(`--${key}`).trim();
  ctx.fillStyle = color('canvas-2'); ctx.fillRect(left, top, plotWidth, plotHeight);
  const buckets = new Map(), lookup = new Map();
  const cellWidth = Math.max(.7, plotWidth / days - .5), cellHeight = Math.max(.7, plotHeight / 24 - .7);
  hours.forEach((hour, index) => {
    if (!Number.isFinite(hour.time)) return;
    const day = Math.floor((hour.time - start) / DAY), utcHour = new Date(hour.time).getUTCHours();
    lookup.set(`${day}:${utcHour}`, index);
    let spec;
    if (!weatherOnly) spec = ATTAINMENT[attainmentClass(hour)];
    else {const rank = ranks.get(hour.weatherMode); spec = rank === undefined ? ATTAINMENT.invalid : {color: colors[rank % colors.length], glyph: MODE_GLYPHS[rank % MODE_GLYPHS.length]};}
    const id = `${spec.color}|${spec.glyph}`;
    let bucket = buckets.get(id);
    if (!bucket) {bucket = {color: spec.color, glyph: spec.glyph, fill: new Path2D(), stroke: new Path2D()}; buckets.set(id, bucket);}
    glyphPath(spec.glyph, bucket.fill, bucket.stroke, left + day / days * plotWidth, top + utcHour / 24 * plotHeight, cellWidth, cellHeight);
  });
  ctx.lineWidth = Math.min(1, Math.max(.5, cellHeight / 8));
  for (const bucket of buckets.values()) {ctx.fillStyle = color(bucket.color); ctx.strokeStyle = ctx.fillStyle; ctx.fill(bucket.fill); ctx.stroke(bucket.stroke);}
  ctx.fillStyle = color('text-3'); ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'right';
  for (const hour of [0, 6, 12, 18, 23]) ctx.fillText(String(hour).padStart(2, '0'), left - 7, top + (hour + .75) / 24 * plotHeight);
  ctx.textAlign = 'left'; ctx.fillText(new Date(start).toISOString().slice(0, 10), left, height - 8);
  ctx.textAlign = 'right'; ctx.fillText(new Date(start + (days - 1) * DAY).toISOString().slice(0, 10), width - right, height - 8);
  canvas.addEventListener('click', event => {
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * width, y = (event.clientY - box.top) / box.height * height;
    const day = Math.floor((x - left) / plotWidth * days), hour = Math.floor((y - top) / plotHeight * 24);
    const index = lookup.get(`${day}:${hour}`); if (index !== undefined && hour >= 0 && hour < 24) onSelect(index);
  });
  const key = document.createElement('p'); key.className = 'timeline-key';
  key.textContent = `Shape carries the class; colour repeats it. ${legendParts.join('. ')}. Cells with no source hour stay empty.`;
  container.replaceChildren(canvas, key);
}
/* Text equivalent of the calendar, built from the same result rows. One row per local day, one column per local
   hour. A repeated local hour (autumn daylight-saving fold) keeps both codes in its cell; a local hour that does
   not exist (spring forward) stays empty, so the table never invents an hour the record does not have. */
export function renderTimelineTable(container, hours, timezone, onSelect, weatherOnly = false) {
  if (!hours.length) {blank(container, 'No hourly record.'); return;}
  const format = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'});
  const codes = new Set(), days = new Map();
  for (const [index, hour] of hours.entries()) {
    if (!Number.isFinite(hour.time)) continue;
    const parts = Object.fromEntries(format.formatToParts(hour.time).map(part => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`, localHour = Number(parts.hour) % 24;
    if (!days.has(date)) days.set(date, Array.from({length: 24}, () => []));
    const cls = attainmentClass(hour), mode = weatherOnly ? hour.weatherMode : hour.mode;
    const code = weatherOnly ? modeCode(mode) : ATTAINMENT[cls].code;
    codes.add(weatherOnly ? `${code} ${modeLabel(mode)}` : `${code} ${ATTAINMENT[cls].text}`);
    days.get(date)[localHour].push({index, code, cls,
      title: `${date} ${String(localHour).padStart(2, '0')}:00 ${timezone} · ${new Date(hour.time).toISOString()} · ${code}: ${weatherOnly ? modeLabel(mode) : ATTAINMENT[cls].text} · mode ${modeLabel(mode)}`});
  }
  if (!days.size) {blank(container, 'No hour in this record carries a usable timestamp.'); return;}
  const table = document.createElement('table'), caption = document.createElement('caption'), head = document.createElement('thead'), headRow = document.createElement('tr'), body = document.createElement('tbody');
  caption.textContent = `Local day by local hour in ${timezone}, from the same result rows as the calendar above. Codes: ${[...codes].sort().join('; ')}. An empty cell has no source hour at that local time; two codes in one cell are the repeated hour of an autumn daylight-saving fold.`;
  const corner = document.createElement('th'); corner.scope = 'col'; corner.textContent = 'Local day'; headRow.append(corner);
  for (let hour = 0; hour < 24; hour++) {const th = document.createElement('th'); th.scope = 'col'; th.textContent = String(hour).padStart(2, '0'); headRow.append(th);}
  head.append(headRow);
  for (const [date, cells] of days) {
    const row = document.createElement('tr'), label = document.createElement('th'); label.scope = 'row'; label.textContent = date; row.append(label);
    for (const entries of cells) {
      const cell = document.createElement('td');
      if (!entries.length) {cell.title = 'No source hour at this local time.'; cell.dataset.cell = 'gap';}
      else {
        cell.textContent = entries.map(entry => entry.code).join('/');
        cell.title = entries.map(entry => entry.title).join(' | ');
        cell.dataset.index = String(entries[0].index); cell.dataset.cell = weatherOnly ? 'mode' : entries[0].cls;
      }
      row.append(cell);
    }
    body.append(row);
  }
  table.append(caption, head, body);
  table.addEventListener('click', event => {
    const cell = event.target.closest('td[data-index]');
    if (cell) onSelect(Number(cell.dataset.index));
  });
  container.replaceChildren(table);
}
export function renderScatter(container, weatherHours, resultHours) {
  const pairs = [];
  const step = Math.max(1, Math.ceil(weatherHours.length / 1500));
  for (let i = 0; i < weatherHours.length; i += step) {
    const w = weatherHours[i], r = resultHours[i];
    if (Number.isFinite(w.tempC) && Number.isFinite(w.dewPointC)) pairs.push({x: w.tempC, y: w.dewPointC, kind: 'outdoor', time: w.time});
    if (r && Number.isFinite(r.padTempC) && Number.isFinite(r.padDewPointC)) pairs.push({x: r.padTempC, y: r.padDewPointC, kind: 'pad', time: r.time});
  }
  if (!pairs.length) {blank(container, 'Dry-bulb / dew-point pairs are not available in this snapshot.'); return;}
  const xmin = Math.floor(Math.min(...pairs.map(p => p.x)) / 5) * 5, xmax = Math.max(xmin + 10, Math.ceil(Math.max(...pairs.map(p => p.x)) / 5) * 5);
  const ymin = Math.floor(Math.min(...pairs.map(p => p.y)) / 5) * 5, ymax = Math.max(ymin + 10, Math.ceil(Math.max(...pairs.map(p => p.y)) / 5) * 5);
  const width = 420, height = 260, left = 42, top = 24, pw = 361, ph = 188;
  const svg = makeSvg(container, width, height, `Dry-bulb versus dew-point scatter in degrees Celsius. At most 1500 time samples from the record, every ${step} hours. Muted outdoor; green pad leaving air.`);
  for (let n = 0; n <= 4; n++) {
    const xx = left + pw * n / 4, yy = top + ph - ph * n / 4;
    svg.append(svgNode('line', {x1: left, x2: left + pw, y1: yy, y2: yy, class: 'grid-line'}));
    svg.append(svgNode('text', {x: left - 8, y: yy + 3, 'text-anchor': 'end'}, number(ymin + (ymax - ymin) * n / 4)));
    svg.append(svgNode('text', {x: xx, y: top + ph + 18, 'text-anchor': 'middle'}, number(xmin + (xmax - xmin) * n / 4)));
  }
  svg.append(svgNode('text', {x: left, y: 12, class: 'axis-label'}, 'Dew point · °C'));
  svg.append(svgNode('text', {x: left + pw / 2, y: height - 6, 'text-anchor': 'middle', class: 'axis-label'}, 'Dry bulb · °C'));
  for (const pair of pairs) {
    const point = svgNode('circle', {cx: left + (pair.x - xmin) / (xmax - xmin) * pw, cy: top + ph - (pair.y - ymin) / (ymax - ymin) * ph, r: 1.9, fill: `var(--${scatterColor[pair.kind]})`, opacity: .45});
    point.append(svgNode('title', {}, `${new Date(pair.time).toISOString()}: ${pair.kind}, DB ${number(pair.x, 1)} °C, DP ${number(pair.y, 1)} °C`)); svg.append(point);
  }
}
export function renderDLI(container, daily, target) {
  if (!daily?.length) {blank(container, 'Daily light results are not available.'); return;}
  const width = 420, height = 260, left = 42, top = 24, ph = 188, pw = 361;
  const max = Math.max(1, target * 1.15, ...daily.map(d => (d.solarDLI || 0) + (d.lightDLI || 0)));
  const svg = makeSvg(container, width, height, `Daily natural and supplemental light integral in mol per square meter per day. Target ${number(target, 1)}. Incomplete days are translucent. Exact values in hourly CSV and run JSON.`);
  ticks(svg, {left, top, width: pw, height: ph, max, unit: 'mol/m²/day'});
  const step = pw / daily.length;
  daily.forEach((day, i) => {
    let y = top + ph;
    for (const [field, color] of [['lightDLI', 'green'], ['solarDLI', 'amber']]) {
      const value = day[field]; if (!Number.isFinite(value) || value <= 0) continue;
      const h = value / max * ph; y -= h;
      const rect = svgNode('rect', {x: left + i * step, y, width: Math.max(.6, step * .82), height: h, fill: `var(--${color})`, opacity: day.complete === false ? .4 : .9});
      rect.append(svgNode('title', {}, `${day.date}: natural ${number(day.solarDLI, 1)}, supplemental ${number(day.lightDLI, 1)} mol/m²/day${day.complete === false ? ', incomplete day' : ''}`)); svg.append(rect);
    }
  });
  const y = top + ph - target / max * ph;
  svg.append(svgNode('line', {x1: left, x2: left + pw, y1: y, y2: y, stroke: 'var(--text-2)', 'stroke-dasharray': '5 4'}));
  svg.append(svgNode('text', {x: left, y: top + ph + 20}, daily[0].date));
  svg.append(svgNode('text', {x: left + pw, y: top + ph + 20, 'text-anchor': 'end'}, daily.at(-1).date));
}
const SENSIBLE_SERIES = [['solarKWh', 'Solar'], ['lightKWh', 'Lighting'], ['envelopeKWh', 'Envelope'], ['infiltrationSensibleKWh', 'Infiltration'], ['ventilationSensibleKWh', 'Ventilation'], ['fanKWh', 'Fans'], ['cropSensibleKWh', 'Crop sensible']];
const LATENT_SERIES = [['crop', 'Crop transpiration'], ['infiltration', 'Infiltration moisture'], ['ventilation', 'Ventilation moisture']];
function legendEntry(legend, label, color, opacity = 1) {
  const span = document.createElement('span'), swatch = document.createElement('i'); swatch.className = 'swatch'; swatch.style.background = color; swatch.style.opacity = String(opacity);
  span.append(swatch, document.createTextNode(label)); legend.append(span);
}
// Monthly space loads: sensible gains stacked above the axis; sensible losses (envelope, ventilation,
// infiltration in cold months) and latent gains stacked below. Hiding the losses would hide the heating story.
export function renderLoads(container, legend, decomposition) {
  const data = decomposition?.monthly || [];
  if (!data.length) {blank(container, 'Load decomposition is not available for this run.'); legend.replaceChildren(); return;}
  const lPerKg = decomposition.latentKWhPerKg;
  const up = row => SENSIBLE_SERIES.reduce((a, [k]) => a + Math.max(0, row[k] || 0), 0);
  const lossOf = row => SENSIBLE_SERIES.reduce((a, [k]) => a + Math.max(0, -(row[k] || 0)), 0);
  const latentOf = row => LATENT_SERIES.reduce((a, [k]) => a + Math.max(0, row.latentKg?.[k] || 0), 0) * lPerKg;
  const down = row => lossOf(row) + latentOf(row);
  const width = 800, height = 300, left = 56, top = 23, plotHeight = 236, plotWidth = width - left - 12;
  const maxUp = Math.max(1, ...data.map(up)), maxDown = Math.max(1, ...data.map(down)), span = maxUp + maxDown;
  const axisY = top + plotHeight * maxUp / span, scale = plotHeight / span;
  const svg = makeSvg(container, width, height, `Monthly space loads in kWh. Sensible gains above the axis; sensible losses and latent gains below. ${data.length} months. Signed values in the load table.`);
  for (const [value, y] of [[maxUp, top], [maxUp / 2, axisY - maxUp / 2 * scale], [0, axisY], [-maxDown / 2, axisY + maxDown / 2 * scale], [-maxDown, top + plotHeight]]) {
    svg.append(svgNode('line', {x1: left, x2: left + plotWidth, y1: y, y2: y, class: 'grid-line'}));
    svg.append(svgNode('text', {x: left - 8, y: y + 3, 'text-anchor': 'end'}, number(value, span < 10 ? 1 : 0)));
  }
  svg.append(svgNode('text', {x: left, y: top - 10, class: 'axis-label'}, 'kWh, gains up, losses and latent down'));
  const step = plotWidth / data.length;
  data.forEach((row, index) => {
    const x = left + index * step + step * .18, w = step * .64;
    let y = axisY;
    SENSIBLE_SERIES.forEach(([key, label], si) => {
      const value = Math.max(0, row[key] || 0); if (!value) return;
      const h = value * scale; y -= h;
      const rect = svgNode('rect', {x, y, width: w, height: h, fill: `var(--${colors[si % colors.length]})`});
      rect.append(svgNode('title', {}, `${row.month}: ${label} ${number(value)} kWh sensible gain`)); svg.append(rect);
    });
    y = axisY;
    SENSIBLE_SERIES.forEach(([key, label], si) => {
      const loss = Math.max(0, -(row[key] || 0)); if (!loss) return;
      const h = loss * scale;
      const rect = svgNode('rect', {x, y, width: w, height: h, fill: `var(--${colors[si % colors.length]})`, opacity: .45});
      rect.append(svgNode('title', {}, `${row.month}: ${label} ${number(loss)} kWh sensible loss`)); svg.append(rect); y += h;
    });
    LATENT_SERIES.forEach(([key, label], li) => {
      const kg = Math.max(0, row.latentKg?.[key] || 0); if (!kg) return;
      const h = kg * lPerKg * scale;
      const rect = svgNode('rect', {x, y, width: w, height: h, fill: `var(--${colors[(7 - li) % colors.length]})`, opacity: li ? .55 : .9});
      rect.append(svgNode('title', {}, `${row.month}: ${label} ${number(kg)} kg, ${number(kg * lPerKg)} kWh latent`)); svg.append(rect); y += h;
    });
    if (data.length <= 18 || index % Math.ceil(data.length / 12) === 0) svg.append(svgNode('text', {x: left + index * step + step / 2, y: top + plotHeight + 20, 'text-anchor': 'middle'}, data.length <= 12 ? row.month.slice(5) : row.month));
  });
  legend.replaceChildren();
  SENSIBLE_SERIES.forEach(([, label], i) => legendEntry(legend, label, `var(--${colors[i % colors.length]})`));
  legendEntry(legend, 'Same colours at 45% opacity below the axis are sensible losses', 'var(--text-2)', .45);
  LATENT_SERIES.forEach(([, label], i) => legendEntry(legend, `${label} (latent)`, `var(--${colors[(7 - i) % colors.length]})`, i ? .55 : .9));
}
// Joint attainment per weather year for one scenario, with the median as a dashed line and the worst year in the warning colour.
export function renderYears(container, aggregate, scenarioId) {
  const entry = aggregate?.byScenario?.[scenarioId];
  const years = (entry?.years || []).filter(y => Number.isFinite(y.compliancePct));
  if (!years.length) {blank(container, 'No multi-year results for this scenario.'); return;}
  const width = 420, height = 240, left = 42, top = 24, ph = 176, pw = 361, max = 100;
  const svg = makeSvg(container, width, height, `Joint climate-band attainment by weather year for ${entry.name}. Median ${number(entry.median.compliancePct, 1)} percent; worst year ${entry.worst?.label ?? 'not available'} at ${number(entry.worst?.compliancePct, 1)} percent. Values in the year table.`);
  ticks(svg, {left, top, width: pw, height: ph, max, unit: '% of eligible hours'});
  const step = pw / years.length;
  years.forEach((year, i) => {
    const h = year.compliancePct / max * ph, worst = entry.worst && year.label === entry.worst.label;
    const rect = svgNode('rect', {x: left + i * step + step * .18, y: top + ph - h, width: step * .64, height: h, fill: worst ? 'var(--warn)' : 'var(--chart-1)'});
    rect.append(svgNode('title', {}, `${year.label}: ${number(year.compliancePct, 1)} percent joint attainment${worst ? ', worst year' : ''}; operating cost ${Number.isFinite(year.cost) ? `$${number(year.cost)}` : 'unpriced'}`)); svg.append(rect);
    if (years.length <= 12 || i % Math.ceil(years.length / 12) === 0) svg.append(svgNode('text', {x: left + i * step + step / 2, y: top + ph + 20, 'text-anchor': 'middle'}, year.label));
  });
  if (Number.isFinite(entry.median.compliancePct)) {
    const y = top + ph - entry.median.compliancePct / max * ph;
    const line = svgNode('line', {x1: left, x2: left + pw, y1: y, y2: y, stroke: 'var(--text-2)', 'stroke-dasharray': '5 4'});
    line.append(svgNode('title', {}, `Median ${number(entry.median.compliancePct, 1)} percent`)); svg.append(line);
  }
}
