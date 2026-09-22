import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function reviewBrowserChecks(browser,base,prefix){
 const context=await browser.newContext();context.setDefaultTimeout(15000);
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${base}${prefix}/index.html`);
  await page.waitForFunction(()=>document.querySelector('#weather-status').textContent.includes('No weather loaded'));
  assert.equal(await page.locator('#run-review input[type="checkbox"]').count(),1,'Review checkbox must be beside the run action');
  assert.equal(await page.locator('#scenario-form #outside-air-reviewed').count(),0);
  await page.locator('.location-details summary').click();
  for(const [id,value] of [['latitude','40'],['longitude','-105'],['timezone','UTC']])await page.locator('#'+id).fill(value);
  await page.locator('#import-file').setInputFiles({name:'review.csv',mimeType:'text/csv',buffer:Buffer.from('time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,20,0.5,101325,0\n2025-01-01T01:00:00Z,21,0.5,101325,0')});
  await page.waitForFunction(()=>document.querySelector('#weather-detail').textContent.includes('Data quality before analysis'));
  await page.locator('#scenario-name').fill('Baseline');
  await page.locator('#field-minVentACH').fill('0.4');
  await page.locator('#duplicate-scenario').click();
  await page.locator('#scenario-name').fill('Comparison');
  const rows=page.locator('#run-review .scenario-review'),checks=rows.locator('input');
  assert.equal(await rows.count(),2);
  assert.match(await rows.first().textContent(),/Minimum 0.4 ACH/);
  assert.match(await page.locator('#run-review-summary').textContent(),/Baseline, Comparison/);
  await checks.first().check();
  assert.equal(await checks.nth(1).isChecked(),false,'Review must not apply to another scenario');
  assert.equal(await page.locator('#run-all').isDisabled(),true);
  await checks.nth(1).focus();await page.keyboard.press('Space');
  assert.equal(await checks.nth(1).evaluate(el=>el===document.activeElement),true,'Review lost keyboard focus');
  assert.equal(await page.locator('#run-all').isEnabled(),true);
  await page.locator('#field-fanWPerM3s').fill('181');
  assert.equal(await checks.first().isChecked(),true);
  assert.equal(await checks.nth(1).isChecked(),false);
  await checks.nth(1).check();
  await rows.first().getByRole('button',{name:/Edit outdoor air/}).click();
  assert.equal(await page.locator('#scenario-name').inputValue(),'Baseline');
  assert.equal(await page.locator('#airflow-panel').evaluate(el=>el===document.activeElement),true);
  await page.locator('#field-maxVentACH').fill('0.1');
  await checks.first().check();
  assert.equal(await page.locator('#run-all').isDisabled(),true,'Acknowledgment must not bypass invalid airflow');
  await page.locator('#field-maxVentACH').fill('40');
  await checks.first().check();
  await page.locator('#outside-air-basis').selectOption('screeningAssumption');
  assert.equal(await checks.first().isChecked(),false,'Evidence change must clear review');
  await checks.first().check();
  await page.locator('#save-scenario').click();await page.reload();
  await page.waitForFunction(()=>document.querySelectorAll('#run-review input:checked').length===2);
  assert.equal(await page.locator('#run-all').isEnabled(),true,'Saved review did not survive reload');
  const exportedReview = async () => {
   const pending = page.waitForEvent('download'); await page.locator('#export-scenario').click();
   const download = await pending;
   return JSON.parse(await readFile(await download.path(), 'utf8')).scenarios[0].outsideAirReviewed;
  };
  assert.equal(await exportedReview(),true,'Export lost completed review');
  await page.locator('#run-all').click();
  await page.waitForFunction(()=>!document.querySelector('#results').hidden,{timeout:30000});
  await checks.first().uncheck();
  assert.equal(await page.locator('#run-all').isDisabled(),true);
  assert.equal(await page.locator('#stale-notice').isVisible(),true);
  let blockedDownloads=0;page.on('download',()=>blockedDownloads++);
  await page.locator('#export-scenario').click();
  assert.match(await page.locator('#app-message').textContent(),/Review the controlled outdoor-air/,'Revoked review must block scenario export');
  assert.equal(blockedDownloads,0,'Unreviewed scenario was exported');
  const tour=await page.evaluate(async()=>{const {TOUR_STEPS}=await import('./src/tour.js');return {hasReview:TOUR_STEPS.some(s=>s.target==='run-review'),missing:TOUR_STEPS.filter(s=>!document.getElementById(s.target)).map(s=>s.target)};});
  assert.ok(tour.hasReview,'Tour must explain review beside Run');assert.deepEqual(tour.missing,[]);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.locator('#run-review').scrollIntoViewIfNeeded();
   assert.ok(await page.locator('#run-review').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Review overflows');
   assert.ok(await page.locator('#run-review').evaluate(el=>{const a=document.getElementById('runbar').getBoundingClientRect(),b=el.getBoundingClientRect();return b.top>=a.bottom-1&&b.top-a.bottom<30;}),'Review is not directly below Run');
   if(process.env.REVIEW_SCREENSHOTS)await page.screenshot({path:`/tmp/scenario-review-${prefix?'assembled':'root'}-${width}.png`});
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${prefix||'root'} scenario review, editing, persistence, validation, run, tour and responsive layout`);
 }finally{await context.close();}
}
