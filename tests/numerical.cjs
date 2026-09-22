/* Run with Node 20+: node tests/numerical.cjs. No dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script id="clt-math">([\s\S]*?)<\/script>/)[1];
const M = vm.runInNewContext(source + '\nCLTMath', {});
const config = {mode:'free',preset:'uniform',n:16,target:10000,seed:12345,field:.5,temperature:1,bias:.5,group:1,resolution:256,custom:Array(128).fill(.5)};
let count=0;
function test(name,fn){fn();count++;console.log(`PASS ${name}`);}
function close(a,b,tolerance=1e-10){assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}; tolerance ${tolerance}`);}
function moments(p,min,step){let mass=0,mean=0;for(let i=0;i<p.length;i++){mass+=p[i];mean+=(min+i*step)*p[i];}let variance=0;for(let i=0;i<p.length;i++)variance+=((min+i*step)-mean)**2*p[i];return{mass,mean,variance};}
test('FFT matches direct convolution across asymmetric PMFs',()=>{
  for(const base of [[.2,.5,.3],[.01,.02,.07,.2,.7],[.5,.5]]){
    let ref=[1];
    for(let n=1;n<=18;n++){
      const next=Array(ref.length+base.length-1).fill(0);
      ref.forEach((v,i)=>base.forEach((w,j)=>next[i+j]+=v*w));ref=next;
      const out=M.convolvePower(base,n);assert.equal(out.length,ref.length);
      out.forEach((v,i)=>close(v,ref[i]));
    }
  }
});
test('Full supported FFT workload preserves theoretical moments',()=>{
  const m=M.model({...config,resolution:512,preset:'skew'}),n=1024,d=M.sumDistribution(m,n),mom=moments(d.pmf,d.min,d.step);
  close(mom.mass,1,1e-8);close(mom.mean,n*m.mu,1e-6);close(mom.variance,n*m.variance,1e-5);
  assert.ok(d.pmf.every(v=>v>=0));
});
test('Binomial includes endpoints and near-degenerate probabilities',()=>{
  for(const n of [1,2,16,128,1024])for(const p of [0,1e-6,.01,.3,.5,.999999,1]){
    const b=M.binomial(n,p),mom=moments(b,0,1);
    close(mom.mass,1,1e-10);close(mom.mean,n*p,1e-7);close(mom.variance,n*p*(1-p),1e-6);
  }
});
test('Distribution supports and actual sample means match physics',()=>{
  for(const field of [-2,-.5,0,.5,2]){
    const m=M.model({...config,mode:'spin',field,temperature:.8});
    close(m.mu,Math.tanh(field/.8));close(m.variance,1-Math.tanh(field/.8)**2);
  }
  const cold=M.model({...config,mode:'spin',field:1,temperature:0});close(cold.mu,1);close(cold.variance,0);
  const hot=M.model({...config,mode:'spin',field:1,temperature:1e15});close(hot.mu,0,1e-12);
  assert.throws(()=>M.model({...config,mode:'spin',field:0,temperature:0}));
});
test('Normal CDF, quantiles and Gamma CDF agree with analytic values',()=>{
  close(M.normalCDF(0),.5,1e-7);close(M.normalCDF(1.9599639845),.975,1e-7);
  for(const p of [.01,.1,.5,.9,.99])close(M.normalCDF(M.normalQuantile(p)),p,1e-8);
  for(const x of [.01,.1,1,5,30]){
    close(M.gammaCDF(x,1),1-Math.exp(-x),1e-11);
    close(M.gammaCDF(x,2),1-Math.exp(-x)*(1+x),1e-11);
    close(M.gammaCDF(x,3),1-Math.exp(-x)*(1+x+x*x/2),1e-11);
  }
  for(const n of [16,128,1024]){let prev=0;for(let x=0;x<2*n;x+=n/100){const v=M.gammaCDF(x,n);assert.ok(v>=prev-1e-12&&v>=0&&v<=1);prev=v;}}
});
test('Seed, resumed state and visualization do not change sampling',()=>{
  const r1=M.rng(123),r2=M.rng(123),m=M.model({...config,preset:'gaussian'});
  for(let i=0;i<500;i++)close(M.trial(m,16,r1,1,true).sum,M.trial(m,16,r2,1,false).sum,0);
  const saved=r1.state,r3=M.rng(0);r3.state=saved;
  for(let i=0;i<1000;i++)close(r1.next(),r3.next(),0);
});
test('Monte Carlo moments agree within sampling uncertainty',()=>{
  for(const preset of ['uniform','skew','bimodal','triangular','bernoulli','gaussian','exponential']){
    const m=M.model({...config,preset}),r=M.rng(991),s=M.accumulator(),n=16,repeats=20000;
    for(let i=0;i<repeats;i++)M.accumulate(s,M.trial(m,n,r).sum/n);
    const expectedVariance=m.variance/n,sd=Math.sqrt(s.m2/(s.count-1));
    close(s.mean,m.mu,6*Math.sqrt(expectedVariance/repeats));
    assert.ok(Math.abs(sd/Math.sqrt(expectedVariance)-1)<.035,`${preset}: SD outside 3.5% tolerance`);
  }
});
test('Quadrupling n halves standard deviation of the mean',()=>{
  const m=M.model({...config,preset:'gaussian'});const observed=[];
  for(const n of [16,64]){const s=M.accumulator(),r=M.rng(919);for(let i=0;i<15000;i++)M.accumulate(s,M.trial(m,n,r).sum/n);observed.push(Math.sqrt(s.m2/(s.count-1)));}
  close(observed[0]/observed[1],2,.09);
});
test('Correlated block model has the advertised variance',()=>{
  const m=M.model({...config,mode:'correlated',bias:.7});
  for(const g of [1,4,16,64]){const d=M.sumDistribution(m,64,g),mom=moments(d.pmf,d.min,d.step);close(mom.mean,64*m.mu,1e-9);close(mom.variance,64*g*m.variance,1e-8);}
  assert.throws(()=>M.sumDistribution(m,15,4));
});
test('Cauchy sample means retain scale and tails',()=>{
  const m=M.model({...config,mode:'cauchy'});
  assert.ok(!Number.isFinite(m.mu)&&!Number.isFinite(m.variance));
  for(const n of [1,64]){const r=M.rng(812),means=[];for(let i=0;i<16000;i++)means.push(M.trial(m,n,r).sum/n);means.sort((a,b)=>a-b);close(means[8000],0,.08);close(means[12000]-means[4000],2,.14);assert.ok(means.filter(x=>Math.abs(x)>10).length>600);}
});
test('CDF distance includes both sides of a discrete jump',()=>{
  const d={pmf:Float64Array.from([.5,.5]),min:-1,step:2};
  close(M.cdfDistance(d,0,1),M.normalCDF(1)-.5,1e-10);
});
test('Invalid or zero probability mass fails clearly',()=>{
  assert.throws(()=>M.discrete([0,1],[0,0],'invalid'));
  assert.throws(()=>M.discrete([0,1],[-1,2],'invalid'));
  const m=M.model({...config,preset:'constant'});close(m.variance,0);close(M.trial(m,1024,M.rng(1)).sum,512);
});
test('Submission has no required external assets',()=>{
  assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html));
  assert.ok(!/<link\b[^>]*rel=["']stylesheet/i.test(html));
  const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n');
  for(const match of css.matchAll(/url\(([^)]+)\)/g))assert.ok(match[1].startsWith('data:'),`External CSS resource: ${match[1].slice(0,80)}`);
  assert.ok(!/<(?:img|iframe|audio|video)\b[^>]*\bsrc\s*=["']https?:/i.test(html));
  assert.ok(html.includes('THIRD-PARTY LICENSES')&&html.includes('KaTeX')&&html.includes('Chart.js'));
});
console.log(`\n${count} numerical / packaging tests passed.`);
