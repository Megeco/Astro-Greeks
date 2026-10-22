import test from 'node:test';
import assert from 'node:assert/strict';
import {findAnalogues,type HistoryRow} from '../lib/analogues.ts';
const fixture=():HistoryRow[]=>Array.from({length:100},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),P:20,E:0,V:10,close:100+i}));
test('analogue selection uses only scores and non-overlapping completed past outcomes',()=>{
 const rows=fixture(),target={date:'2020-04-01',P:20,E:0,V:10};
 const a=findAnalogues(rows,target,0,10,'2020-01-01','2020-12-31','2020-04-10');
 assert.ok(a.matches.length>0);
 for(let j=0;j<a.matches.length;j++){
  const m=a.matches[j];assert.ok(rows[m.index+10].date<target.date);assert.equal(m.path.length,11);
  if(j)assert.ok(m.index-a.matches[j-1].index>10);
 }
 const changed=rows.map((r,i)=>({...r,close:i%2?200:50}));
 assert.deepEqual(findAnalogues(changed,target,0,10,'2020-01-01','2020-12-31','2020-04-10').matches.map(m=>m.row.date),a.matches.map(m=>m.row.date));
});
test('outcomes cannot leak reference-date or newer closes; zero matches stay empty',()=>{
 const rows=fixture();const a=findAnalogues(rows,{date:'2020-01-11',P:20,E:0,V:10},0,10,'2020-01-01','2020-12-31','2020-04-10');assert.equal(a.matches.length,0);
 assert.equal(findAnalogues(rows,{date:'2021-01-01',P:80,E:70,V:60},2,10,'2020-01-01','2020-12-31','2021-01-01').matches.length,0);
});
test('missing closes are not interpolated and returns count available sessions',()=>{
 const rows=fixture();rows[1].close=null;
 const m=findAnalogues(rows,{date:'2021-01-01',P:20,E:0,V:10},0,5,'2020-01-01','2020-12-31','2021-01-01').matches[0];assert.ok(Math.abs(m.returns[5]-6)<1e-10);
});
