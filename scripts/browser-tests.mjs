import {reviewBrowserChecks} from './review-browser-checks.mjs';
import {appBrowserChecks} from './app-browser-checks.mjs';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{
 let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
 if(!path.startsWith(root+'/'))throw Error('outside root');
 if((await stat(path)).isDirectory())path+='/index.html';
 res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.writeHead(404);res.end('Not found');}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}});
let failures=0;
try{
 for(const prefix of ['','/_site/app']){
  for(const harness of ['weather-storage','weather-lifecycle','workbench']){
   const context=await browser.newContext();await context.addInitScript(()=>{globalThis.__ISOLATED_TEST_CONTEXT__=true;});const page=await context.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.goto(`${base}${prefix}/test/browser/${harness}.html?autorun`);
    if(harness==='workbench'){
     await page.locator('#run').click();await page.waitForFunction(()=>/^(PASS|FAIL)/.test(document.querySelector('#status')?.textContent||''),{timeout:120000});
     const result=await page.locator('#status').textContent();if(!result.startsWith('PASS'))throw Error(result);
    }else{
     await page.waitForFunction(()=>document.body.dataset.result,{timeout:120000});
     if(await page.locator('body').getAttribute('data-result')!=='pass')throw Error(await page.locator('#results').textContent());
    }
    if(errors.length)throw Error(errors.join('\n'));
    console.log(`PASS ${prefix||'root'} ${harness}`);
   }catch(error){failures++;console.error(`FAIL ${prefix||'root'} ${harness}: ${error.stack}`);}
   await context.close();
  }
  // Actual application starts without weather or credentials; a File crosses the
  // background boundary and its quality summary reaches the page.
  const context=await browser.newContext();await context.addInitScript(()=>{globalThis.__ISOLATED_TEST_CONTEXT__=true;});const page=await context.newPage();
  try{
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(`${base}${prefix}/index.html`);
   await page.waitForFunction(()=>document.querySelector('#weather-status')?.textContent.includes('No weather loaded'),{timeout:30000});
   await page.locator('.location-details summary').click();
   await page.locator('#timezone').fill('UTC');
   await page.locator('#import-file').setInputFiles({name:'fixture.csv',mimeType:'text/csv',buffer:Buffer.from('time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,20,0.5,101325,0')});
   await page.waitForFunction(()=>document.querySelector('#weather-detail')?.textContent.includes('Data quality before analysis'),{timeout:30000});
   if(errors.length)throw Error(errors.join('\n'));
   console.log(`PASS ${prefix||'root'} app import`);
  }catch(error){failures++;console.error(`FAIL app ${prefix}: ${error.stack}`);}
  await context.close();
  try{await reviewBrowserChecks(browser,base,prefix);}catch(error){failures++;console.error(`FAIL scenario review ${prefix}: ${error.stack}`);}
  try{await appBrowserChecks(browser,base,prefix);}catch(error){failures++;console.error(`FAIL integrated app ${prefix}: ${error.stack}`);}
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failures)process.exitCode=1;
