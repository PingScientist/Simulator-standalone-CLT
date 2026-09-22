/* Stress / fallback checks; run after tests/browser.cjs. Requires Playwright. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
const out=process.env.CLT_TEST_OUTPUT||path.resolve(__dirname,'../test-results');
fs.mkdirSync(out,{recursive:true});
const results=[];
function pass(name,detail){results.push({name,detail});console.log('PASS',name,detail||'');}
async function ready(p){await p.waitForFunction(()=>window.simState?.model&&!simState.work.theoryBusy,null,{timeout:20000});}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({offline:true,viewport:{width:1440,height:1080}}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);
  // Maximum FFT workload must complete without stale results after reconfiguration.
  await p.getByText('進階設定與可讀數據',{exact:true}).click();await p.selectOption('#resolution','512');await ready(p);await p.fill('#nExact','1024');await p.locator('#nExact').press('Tab');await ready(p);
  assert.equal(await p.evaluate(()=>simState.theory.pmf.length),1024*511+1);
  await p.click('[data-n="1"]');await ready(p);assert.equal(await p.evaluate(()=>simState.theory.pmf.length),512);pass('Maximum n / K and theory invalidation');
  // Invalid joint limit is rejected atomically.
  await p.click('[data-mode="spin"]');await ready(p);await p.click('[data-spin="cold"]');await ready(p);const before=await p.evaluate(()=>JSON.stringify(simState.config));
  await p.locator('#field').fill('0');await p.waitForTimeout(180);assert.equal(await p.evaluate(()=>JSON.stringify(simState.config)),before);assert.equal(await p.evaluate(()=>simState.model.mu),1);assert.ok((await p.locator('#status').textContent()).includes('聯合極限'));pass('Invalid zero-field / zero-temperature rolls back coherently');
  // 100k Cauchy results, including out-of-frame values, stay in the dataset.
  await p.click('[data-mode="cauchy"]');await ready(p);await p.selectOption('#target','100000');await p.selectOption('#speed','fast');await p.click('#playBtn');await p.waitForFunction(()=>simState.sums.length===100000&&!simState.running,null,{timeout:60000});
  const stress=await p.evaluate(()=>({count:simState.sums.length,tail:simState.work.hist.under+simState.work.hist.over,inFrame:simState.work.hist.counts.reduce((a,b)=>a+b,0),sumLength:simState.sums.length,median:document.querySelector('#metricMean').textContent}));
  // Verify the visible final state without calling the rendering implementation.
  assert.equal(await p.locator('#metricM').textContent(),'100,000');
  const tableMass=await p.evaluate(()=>Array.from(document.querySelectorAll('#histTable tr')).reduce((a,tr)=>a+Number(tr.children[1].textContent.replaceAll(',','')),0));assert.equal(tableMass,stress.inFrame);
  assert.equal(await p.evaluate(()=>simState.resources.charts.analysis.data.datasets[0].data.at(-1).x),100000);
  const mass=await p.evaluate(()=>simState.work.hist.counts.reduce((a,b)=>a+b,0)+simState.work.hist.under+simState.work.hist.over);assert.equal(mass,100000);assert.ok(await p.evaluate(()=>simState.sums.some(x=>Math.abs(x)>100)));pass('100,000 Cauchy trials retain all tails',stress);
  await p.click('#snapshotBtn');assert.equal(await p.locator('#clearSnapshotBtn').isVisible(),true);await p.click('#clearSnapshotBtn');assert.equal(await p.evaluate(()=>simState.snapshot),null);pass('A-group overlay can be removed');
  await p.evaluate(()=>{document.querySelector('#galleryDetails').open=false;});await p.click('[data-mode="spin"]');await ready(p);await p.click('[data-spin="zero"]');await ready(p);await p.fill('#nExact','128');await p.locator('#nExact').press('Tab');await ready(p);await p.selectOption('#target','10000');await p.click('#playBtn');await p.waitForFunction(()=>simState.sums.length>=10000&&!simState.running);assert.equal(await p.locator('#metricM').textContent(),'10,000');await p.evaluate(()=>document.querySelectorAll('#page-sim details').forEach(d=>d.open=false));await p.locator('#toast').waitFor({state:'hidden'});await p.screenshot({path:path.join(out,'showcase-spin-desktop.png'),fullPage:true});
  await p.setViewportSize({width:390,height:844});await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>simState.ui.reduced);await p.screenshot({path:path.join(out,'showcase-spin-mobile.png'),fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);pass('Final spin showcase, mobile and reduced-motion media');
  assert.deepEqual(errors,[]);await ctx.close();
  // A browser without Blob Worker can still initialize and compute theory.
  const fallback=await browser.newContext({offline:true});await fallback.addInitScript(()=>{window.Worker=undefined;});const q=await fallback.newPage();const fallbackErrors=[];q.on('pageerror',e=>fallbackErrors.push(e.message));await q.goto(url);await ready(q);assert.equal(await q.evaluate(()=>simState.resources.worker),null);assert.equal(await q.evaluate(()=>simState.theory.pmf.length),4081);await q.click('#stepBtn');assert.equal(await q.evaluate(()=>simState.sums.length),1);assert.deepEqual(fallbackErrors,[]);await fallback.close();pass('No-Worker fallback remains functional');
  fs.writeFileSync(path.join(out,'boundaries-report.json'),JSON.stringify({date:new Date().toISOString(),results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
