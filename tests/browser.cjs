/* Optional development check. Requires Playwright; the submitted HTML does not. */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'index.html')).href;
const out=process.env.CLT_TEST_OUTPUT||path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),engines:[],scenarios:[]};
function record(name,detail){report.scenarios.push({name,detail});console.log('PASS',name,detail||'');}
async function ready(page){await page.waitForFunction(()=>window.simState?.model&&!simState.work.theoryBusy,null,{timeout:20000});}
async function sample(page,count=1000){await page.selectOption('#target',String(count));await page.selectOption('#speed','fast');await page.click('#playBtn');await page.waitForFunction(n=>simState.sums.length>=n&&!simState.running,count,{timeout:30000});assert.equal(await page.locator('#metricM').textContent(),count.toLocaleString('en-US'));assert.equal(await page.evaluate(()=>simState.work.hist.counts.reduce((a,b)=>a+b,0)+simState.work.hist.under+simState.work.hist.over),count);}
async function main(){
  for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
    if(process.env.CLT_BROWSERS&&!process.env.CLT_BROWSERS.split(',').includes(name))continue;
    console.log('START',name);
    const browser=await engine.launch({headless:true,timeout:20000});const context=await browser.newContext({viewport:{width:1440,height:1080},offline:name==='chromium',acceptDownloads:true});const page=await context.newPage(),errors=[],network=[];
    await context.route(/^https?:/,route=>route.abort());
    page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
    try{
      await page.goto(url);console.log('LOADED',name,await page.locator('#status').textContent());await ready(page);
      assert.equal(await page.locator('.katex-error').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const checks=await page.evaluate(()=>numericalSelfTests());assert.ok(checks.every(c=>c.pass));record(name+' standalone initialization',{selfChecks:checks.length,networkMode:name==='chromium'?'offline flag + HTTP(S) blocked':'HTTP(S) blocked; WebKit file:// offline-flag limitation'});
      await page.click('#stepBtn');const first=await page.evaluate(()=>simState.sums[0]);assert.equal(await page.evaluate(()=>simState.sums.length),1);
      await page.click('#resetBtn');await ready(page);await page.click('#stepBtn');assert.equal(await page.evaluate(()=>simState.sums[0]),first);
      await page.click('#resetBtn');await ready(page);await page.click('#playBtn');await page.waitForFunction(()=>simState.sums.length>0);await page.click('#playBtn');assert.equal(await page.locator('#metricM').textContent(),(await page.evaluate(()=>simState.sums.length)).toLocaleString('en-US'));await page.click('#resetBtn');await ready(page);await sample(page);record(name+' deterministic reset, pause and complete final render');
      await page.click('#snapshotBtn');await page.click('[data-n="64"]');await ready(page);assert.equal(await page.evaluate(()=>simState.sums.length),0);assert.equal(await page.evaluate(()=>simState.snapshot.sums.length),1000);await sample(page);record(name+' snapshot isolates experimental conditions');
      for(const analysis of ['cdf','qq','trace']){await page.click(`[data-analysis="${analysis}"]`);assert.equal(await page.evaluate(()=>simState.ui.analysis),analysis);}
      for(const view of ['sum','mean','z']){await page.click(`[data-view="${view}"]`);assert.equal(await page.evaluate(()=>simState.ui.view),view);}
      await page.screenshot({path:path.join(out,name+'-desktop.png'),fullPage:true});
      // Complete JSON export/import preserves the RNG continuation exactly.
      const expected=await page.evaluate(()=>{const r=CLTMath.rng(0);r.state=simState.rng.state;return CLTMath.trial(simState.model,simState.config.n,r,groupSize()).sum;});
      const [jsonDownload]=await Promise.all([page.waitForEvent('download'),page.click('#jsonBtn')]);const saved=path.join(out,name+'-roundtrip.json');await jsonDownload.saveAs(saved);
      await page.click('#resetBtn');await ready(page);await page.setInputFiles('#importFile',saved);await page.waitForFunction(()=>simState.sums.length===1000);await page.click('#stepBtn');assert.equal(await page.evaluate(()=>simState.sums.at(-1)),expected);record(name+' JSON export / import / RNG continuation');
      const [csvDownload]=await Promise.all([page.waitForEvent('download'),page.click('#csvBtn')]);const csv=path.join(out,name+'-data.csv');await csvDownload.saveAs(csv);assert.equal(fs.readFileSync(csv,'utf8').split('\n').length,1002);
      const [pngDownload]=await Promise.all([page.waitForEvent('download'),page.click('#pngBtn')]);const png=path.join(out,name+'-figure.png');await pngDownload.saveAs(png);assert.ok(fs.statSync(png).size>15000);record(name+' CSV and PNG exports');
      // Test five modes, including nonstandard cases where normal CLT is invalid.
      for(const mode of ['spin','walk','correlated','cauchy']){await page.click(`[data-mode="${mode}"]`);await ready(page);await page.click('#stepBtn');assert.ok(Number.isFinite(await page.evaluate(()=>simState.sums[0])));if(mode==='cauchy'){assert.equal(await page.locator('[data-view="z"]').isDisabled(),true);assert.equal(await page.locator('#metricD').innerText(),'不適用');}}
      await page.click('[data-mode="correlated"]');await ready(page);await page.selectOption('#group','64');await ready(page);await sample(page);assert.ok(await page.evaluate(()=>simState.sums.every(v=>v===-64||v===64)));record(name+' all five modes and complete correlation');
      await page.click('[data-mode="spin"]');await ready(page);await page.click('[data-spin="cold"]');await ready(page);await page.click('#stepBtn');assert.equal(await page.evaluate(()=>simState.model.variance),0);assert.equal(await page.locator('[data-view="z"]').isDisabled(),true);
      await page.click('[data-spin="hot"]');await ready(page);assert.ok(Math.abs(await page.evaluate(()=>simState.model.mu))<1e-12);record(name+' physical low/high temperature limits');
      await page.click('[data-mode="free"]');await ready(page);
      for(const preset of ['uniform','bimodal','triangular','bernoulli','gaussian','exponential','constant']){await page.selectOption('#preset',preset);await ready(page);await page.click('#stepBtn');assert.ok(Number.isFinite(await page.evaluate(()=>simState.sums[0])));}
      await page.selectOption('#preset','custom');await ready(page);const box=await page.locator('#parentCanvas').boundingBox();await page.mouse.move(box.x+15,box.y+box.height*.7);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+12,{steps:8});await page.mouse.move(box.x+box.width-14,box.y+box.height*.6,{steps:8});await page.mouse.up();await ready(page);assert.ok(await page.evaluate(()=>new Set(simState.config.custom).size>10));await page.click('#drawUndo');await ready(page);record(name+' all mother distributions and custom pointer drawing');
      const oldN=await page.evaluate(()=>simState.config.n);await page.fill('#nExact','-2');await page.locator('#nExact').press('Tab');assert.equal(await page.evaluate(()=>simState.config.n),oldN);await page.fill('#nExact','16');await page.locator('#nExact').press('Tab');await ready(page);
      const corrupt=path.join(out,name+'-invalid.json');fs.writeFileSync(corrupt,JSON.stringify({format:'clt-observatory',version:'1.0.0',current:{config:{n:1e9}}}));const before=await page.evaluate(()=>JSON.stringify(simState.config));await page.setInputFiles('#importFile',corrupt);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('匯入失敗'));assert.equal(await page.evaluate(()=>JSON.stringify(simState.config)),before);record(name+' invalid controls and import are rejected');
      await page.selectOption('#preset','uniform');await ready(page);await page.click('#sweepBtn');await page.waitForFunction(()=>simState.work.sweep?.points.length===11&&!simState.work.sweepBusy,{timeout:60000});assert.ok(await page.evaluate(()=>simState.work.sweep.points.every(p=>Math.abs(p.sd/p.theory-1)<.12)));record(name+' n sweep validates square-root scaling');
      await page.locator('#galleryDetails summary').click();await page.waitForFunction(()=>document.querySelectorAll('.gallery-cell').length===4&&!simState.work.galleryBusy,{timeout:30000});record(name+' universality gallery');
      await page.click('#microscopeBtn');await page.locator('#diceSum').fill('7');assert.equal(await page.locator('.convolution-cell').count(),36);await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').isVisible(),false);
      await page.click('#tab-poe');await page.fill('#prediction','增加 n 會降低平均值的波動。');await page.click('#capturePoeBtn');await page.fill('#explanation','有限變異數與獨立性支持平方根尺度律。');await page.click('#savePoeBtn');assert.equal(await page.evaluate(()=>simState.records.length),1);await page.click('#copyPromptBtn');assert.ok((await page.locator('#promptOutput').innerText()).includes('有效獨立樣本數'));record(name+' POE notebook and AI prompt');
      await page.click('#tab-theory');assert.equal(await page.locator('.katex-error').count(),0);await page.screenshot({path:path.join(out,name+'-theory.png'),fullPage:true});
      await page.click('#tab-sim');await page.click('#themeBtn');await page.screenshot({path:path.join(out,name+'-light.png'),fullPage:true});await page.click('#displayBtn');assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('display-mode')),true);await page.click('#displayBtn');
      await page.click('#guideBtn');for(let i=0;i<5;i++)await page.click('#guideNext');assert.equal(await page.evaluate(()=>simState.ui.tab),'poe');record(name+' guide and presentation modes');
      for(const width of [375,768,1024]){await page.setViewportSize({width,height:900});await page.click('#tab-sim');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});}record(name+' responsive widths 375 / 768 / 1024');
      assert.deepEqual(errors,[]);assert.deepEqual(network,[]);record(name+' no JavaScript errors or network requests');
      report.engines.push({name,version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent),offlineFlag:name==='chromium',httpBlocked:true,errors,network});
    }finally{await context.close();await browser.close();}
  }
  fs.writeFileSync(path.join(out,(process.env.CLT_BROWSERS||'all')+'-report.json'),JSON.stringify(report,null,2));console.log(`\n${report.scenarios.length} browser scenarios passed.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
