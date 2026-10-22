// Run after npm run build. Exercises the actual production HTTP boundary.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const port=Number(process.env.SMOKE_PORT||3011),url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
async function post(x){const r=await fetch(url+'/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(x)});return {status:r.status,data:await r.json()}}
try{
 let up=false;for(let i=0;i<80;i++){try{if((await fetch(url)).ok){up=true;break}}catch{}await delay(100)}assert.ok(up,log);
 const home=await(await fetch(url)).text();assert.ok(home.includes('Our next 75 days'));assert.ok(home.includes('Nifty reference'));assert.ok(home.includes('Our observations'));assert.equal((await fetch(url+'/options')).status,200);assert.equal((await fetch(url+'/api/macro?date=invalid')).status,400);assert.equal(home.includes('P − E'),false);assert.equal(home.includes('<svg'),false);assert.equal((await fetch(url+'/research')).status,200);
 const history=await(await fetch(url+'/api/macro-history')).json();assert.equal(history.rows.length,11252);assert.equal(history.rows.filter(r=>r[4]!==null).length,7662);
 for(const date of ['1996-01-01','1999-10-01','2008-10-24','2026-10-23']){const response=await fetch(url+'/api/transits?date='+date);assert.equal(response.status,200);const j=await response.json();assert.equal(j.positions.length,12);const row=history.rows.find(r=>r[0]===date);if(row)assert.deepEqual([j.P,j.E,j.V],row.slice(1,4));}
 const boot=await(await fetch(url+'/api/research')).json();assert.equal(boot.studies.length,6);assert.equal(boot.studies[0].results,undefined);
 const w=await post({op:'workspace',cutoff:'2024-07-15'});assert.equal(w.status,200);assert.equal(w.data.macro.length,75);assert.equal(w.data.snapshot.date,'2024-07-15');assert.ok(w.data.history.every(d=>d.date<='2024-07-15'));assert.equal(w.data.snapshot.quotes.some(q=>q.strike===25500&&q.expiry==='2024-09-26'),true);
 const old=await post({op:'workspace',cutoff:'2018-02-15'});assert.equal(old.data.snapshot,null);assert.equal(old.data.macro.length,75);
 const plan={name:'API fixture',cutoff:'2024-07-15',horizon:'2024-08-20',windowStart:'2024-08-01',windowEnd:'2024-08-01',entryPolicy:'scheduled',mode:'trade',type:'PE',expiry:'2024-09-26',selection:'fixed',strike:25500,lots:1,minVolume:1000,minOI:1000,capPct:5,slippagePct:1,reserve:100,management:'monitor',profitPct:50,lossPct:40,followThroughDate:'2024-08-09',bias:'fixture',notes:'',milestones:['2024-08-19'],strictQuarter:true,ruleVersion:'v1'};
 const frozen=await post({op:'freeze',plan});assert.equal(frozen.status,200);assert.equal(frozen.data.hash.length,64);
 const reveal=await post({op:'replay',record:frozen.data});assert.equal(reveal.status,200);assert.equal(reveal.data.result.exitDate,'2024-08-06');assert.ok(Math.abs(reveal.data.result.netPnL-12833.6)<.0001);
 const mon=await post({op:'monitor',record:frozen.data,observation:'2024-08-05'});assert.equal(mon.data.result.status,'open');assert.ok(mon.data.market.every(d=>d.date<='2024-08-05'));
 const tampered=structuredClone(frozen.data);tampered.plan.capPct=50;assert.equal((await post({op:'replay',record:tampered})).status,400);
 const bad=await post({op:'validate',pack:{name:'test',source:'test',macroVersion:'other',macro:[['2018-01-01',1,2,3]]}});assert.equal(bad.status,400);
 const conflict=await post({op:'validate',pack:{name:'test',source:'test',macroVersion:boot.engine,macro:[['2024-07-15',99999,0,0]]}});assert.equal(conflict.status,400);
 const mark=await post({op:'mark',date:'2024-08-06',expiry:'2024-09-26',strike:25500,type:'PE'});assert.equal(mark.status,200);assert.ok(mark.data.mark.date<='2024-08-06');assert.equal(mark.data.mark.kind,'archive');
 const studies=await post({op:'study',id:'august-entry-comparison'});assert.equal(studies.data.results.length,72);
 console.log('PASS: production page, cutoff isolation, 2018 gap, frozen replay, monitoring cutoff, tamper rejection, import conflicts, study reveal.');
}finally{server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}
