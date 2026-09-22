const $=id=>document.getElementById(id),frame=$('lab');
const check=(value,message)=>{if(!value)throw new Error(message);};
async function until(predicate){for(let i=0;i<120;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Timed out waiting for workbench.');}
$('run').addEventListener('click',async()=>{
 $('run').disabled=true;$('status').textContent='Running';let passed=0;
 async function test(name,fn){await fn();passed++;$('results').textContent+=`PASS ${name}\n`;}
 try{
  await until(()=>frame.contentDocument?.querySelector('#state-table tbody tr'));
  const doc=frame.contentDocument,win=frame.contentWindow,$l=id=>doc.getElementById(id);
  const change=(id,value)=>{$l(id).value=value;$l(id).dispatchEvent(new win.Event('change',{bubbles:true}));};
  await test('standalone air-state calculator starts without facility configuration',()=>{check($l('state-table').textContent.includes('A · Input'),'No calculator state');check($l('chart').querySelector('svg'),'No chart');});
  await test('SI/IP toggles keep canonical results without rounding drift',()=>{const before=$l('state-table').dataset.humidityRatio;for(let i=0;i<8;i++){change('units','ip');change('units','si');}check($l('state-table').dataset.humidityRatio===before,'Unit toggle changed water mass');});
  await test('each lesson completes prediction, change and explanation with shared endpoints',()=>{
   for(const id of ['heating','cold-air','pad','dehumidifier']){
    doc.querySelector(`[data-lesson="${id}"]`).click();doc.querySelector('input[name="prediction"]').click();$l('reveal').click();
    check(!$l('explanation').hidden&&$l('explanation').textContent.length>80,`Missing explanation for ${id}`);
    check($l('state-table').textContent.includes('B · After process'),`Missing endpoint for ${id}`);
    check($l('chart').querySelectorAll('.chart-point').length>=2,`Missing plotted endpoint for ${id}`);
    const before=$l('state-table').dataset.endTemperature;change('process-value',String(Number($l('process-value').value)+Number($l('process-value').step)));
    check($l('state-table').dataset.endTemperature!==before,`Process control did not recompute ${id}`);
   }
  });
  await test('RH lesson seeds do not invent an auxiliary dew-point observation',()=>{
   for(const id of ['heating','cold-air','pad','dehumidifier']){doc.querySelector(`[data-lesson="${id}"]`).click();check(!$l('state-warnings').textContent.includes('Auxiliary'),`Fabricated dew point in ${id}`);}
  });
  await test('unsupported display RH stays unavailable in worked explanations',()=>{
   doc.querySelector('[data-lesson="heating"]').click();change('temperature','-5');change('rh-reference','ice');$l('reveal').click();
   check($l('state-table').textContent.includes('Unavailable'),'Expected unsupported endpoint RH');check($l('explanation').textContent.includes('unavailable for the declared ice reference'),'Ice endpoint explanation converted unavailable RH to zero');
   change('humidity-mode','dewPointC');change('dew-point','-20');change('rh-reference','unknown');change('dew-reference','water');
   check($l('explanation').textContent.includes('unavailable for the declared unknown reference'),'Unknown inlet RH explanation converted unavailable RH to zero');
   check(!$l('explanation').textContent.includes('0.00%'),'Unavailable RH shown as zero');
  });
  await test('zero-strength processes explain the unchanged state',()=>{
   for(const id of ['heating','pad','dehumidifier']){doc.querySelector(`[data-lesson="${id}"]`).click();change('process-value','0');$l('reveal').click();check($l('explanation').textContent.includes('unchanged'),`Zero-strength ${id} claims a change`);}
  });
  await test('declared dew point works and invalid data clears stale results',()=>{
   change('humidity-mode','dewPointC');change('dew-point','10');check($l('state-table').querySelector('tbody tr'),'Dew point missing');
   change('dew-point','90');check(!$l('state-table').querySelector('tbody tr'),'Invalid state retained old table');check($l('input-error').textContent.includes('exceeds'),'Invalid dew point lacks explanation');
   change('dew-point','10');check($l('state-table').querySelector('tbody tr'),'Invalid input could not recover');
  });
  await test('named real examples keep actual pressure distinct from chart backdrop',async()=>{
   await until(()=>$l('example').options.length>=3);change('example','0');
   check($l('pressure-basis').textContent.includes('99.69'),'Real sample pressure lost');check($l('chart-basis').textContent.includes('101.325'),'Backdrop pressure changed');
   check($l('source-detail').textContent.includes('NASA POWER'),'Sample source missing');
  });
  await test('historical File import crosses the Worker with an explicit moisture convention',async()=>{
   change('import-reference','water');
   const transfer=new win.DataTransfer();transfer.items.add(new win.File(['time,tempC,rh,pressurePa,ghiWm2\n2025-01-01T00:00:00Z,12,0.5,84000,0\n2025-01-01T01:00:00Z,14,0.6,83000,0'],'lesson-fixture.csv',{type:'text/csv'}));
   $l('weather-file').files=transfer.files;$l('weather-file').dispatchEvent(new win.Event('change',{bubbles:true}));
   await until(()=>$l('import-status').textContent.includes('2 hours ready'));
   check($l('pressure-basis').textContent.includes('84'),'Import actual pressure lost');$l('next-hour').click();
   check($l('pressure-basis').textContent.includes('83'),'Next historical hour did not change state');check($l('chart-basis').textContent.includes('101.325'),'Imported point replaced backdrop pressure');
  });
  await test('legacy JSON imports retain their sealed identity and cold humidity basis',async()=>{
   const fixture=await fetch('../fixtures/legacy-moisture-snapshot.json').then(response=>response.json());
   change('import-reference','unknown');change('import-authority','dewPointC');
   const transfer=new win.DataTransfer();transfer.items.add(new win.File([JSON.stringify(fixture.snapshot)],'legacy.json',{type:'application/json'}));
   $l('weather-file').files=transfer.files;$l('weather-file').dispatchEvent(new win.Event('change',{bubbles:true}));
   await until(()=>$l('import-status').textContent.includes('3 hours ready'));
   check($l('source-detail').textContent.includes(fixture.snapshot.id),'Legacy JSON snapshot identity changed');check($l('state-table').querySelector('tbody tr'),'Legacy cold air basis invalidated');
  });
  await test('editing conventions and selecting lessons clear historical source labels',()=>{
   change('example','0');change('rh-reference','unknown');check(!$l('source-detail').textContent.includes('NASA POWER'),'Convention edit retained historical label');
   change('example','0');doc.querySelector('[data-lesson="heating"]').click();check(!$l('source-detail').textContent.includes('NASA POWER'),'Lesson selection retained historical label');
  });
  await test('narrow-screen layout fits and has keyboard operable controls',async()=>{
   frame.style.width='360px';await new Promise(resolve=>setTimeout(resolve,50));
   check(doc.documentElement.scrollWidth<=doc.documentElement.clientWidth+1,'Workbench overflows narrow viewport');
   $l('next-hour').focus();check(doc.activeElement===$l('next-hour'),'Hour button cannot receive keyboard focus');
  });
  $('status').textContent=`PASS ${passed} workbench checks`;
 }catch(error){$('status').textContent='FAIL '+error.message;$('results').textContent+=error.stack;}
 finally{$('run').disabled=false;}
});
