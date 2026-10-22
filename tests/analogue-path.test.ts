import test from 'node:test';
import assert from 'node:assert/strict';
import {findAnalogues,type HistoryRow} from '../lib/analogues.ts';
test('episode path pairs then-current PEV with each actual subsequent closing date',()=>{
 const rows:HistoryRow[]=Array.from({length:40},(_,i)=>({date:new Date(Date.UTC(2000,0,i+1)).toISOString().slice(0,10),P:12+i,E:i%3,V:5+i/10,close:100+i}));
 rows[1].close=null;
 const {matches}=findAnalogues(rows,{date:'2001-01-01',P:12,E:0,V:5},5,10,'2000-01-01','2000-12-31','2001-01-01');
 const m=matches[0];assert.equal(m.row.date,'2000-01-01');assert.equal(m.pathRows.length,11);assert.equal(m.pathRows[1].date,'2000-01-03');assert.equal(m.pathRows[1].P,14);assert.equal(m.pathRows[1].E,2);assert.equal(m.pathRows[1].V,5.2);assert.equal(m.pathRows[1].close,102);assert.ok(Math.abs(m.path[1]-2)<1e-10);assert.equal(m.pathRows[10].date,'2000-01-12');assert.equal(m.path[10],m.returns[10]);
 for(let j=0;j<m.pathRows.length;j++)assert.equal(m.pathRows[j],rows.find(r=>r.date===m.pathRows[j].date));
});
test('returns remain past-only and selection stays independent of price outcomes',()=>{
 const rows:HistoryRow[]=Array.from({length:60},(_,i)=>({date:new Date(Date.UTC(2000,0,i+1)).toISOString().slice(0,10),P:12,E:0,V:5,close:100+i}));
 const t={date:'2000-02-15',P:12,E:0,V:5};const a=findAnalogues(rows,t,0,10,'2000-01-01','2000-12-31','2001-01-01');const b=findAnalogues(rows.map((r,i)=>({...r,close:i%2?50:300})),t,0,10,'2000-01-01','2000-12-31','2001-01-01');assert.deepEqual(a.matches.map(m=>m.row.date),b.matches.map(m=>m.row.date));assert.ok(a.matches.every(m=>m.pathRows.at(-1)!.date<t.date));
});
