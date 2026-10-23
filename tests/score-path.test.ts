import test from 'node:test';
import assert from 'node:assert/strict';
import {compareScorePaths,type HistoryRow,type Analogue} from '../lib/analogues.ts';
const day=(start:string,i:number)=>new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
const path=(start:string,p:number):HistoryRow[]=>Array.from({length:75},(_,i)=>({date:day(start,i),P:p+i%7,E:i%3,V:10+i%5,close:i+100}));
const candidate=(row:HistoryRow):Analogue=>({row,index:0,distance:0,returns:{10:99},path:[],pathRows:[],worst:0});
test('full path comparison uses all 75 calendar dates and all three scores',()=>{
 const target=path('2026-10-23',12),same=path('2000-01-01',12),different=path('2001-01-01',12);different[74].P+=15;
 const r=compareScorePaths([...same,...different],target,[candidate(same[0]),candidate(different[0])]);assert.equal(r[0].distance,0);assert.equal(r[1].distance,1);assert.equal(r[0].path[20].date,day('2000-01-01',20));
});
test('incomplete or overlapping historic paths are not scored and prices never affect distance',()=>{
 const target=path('2026-10-23',12),past=path('2000-01-01',12);assert.equal(compareScorePaths(past.slice(0,74),target,[candidate(past[0])])[0].distance,null);
 assert.equal(compareScorePaths(target,target,[candidate(target[0])])[0].distance,null);
 assert.equal(compareScorePaths(past.map(r=>({...r,close:999999})),target,[candidate(past[0])])[0].distance,0);
 assert.deepEqual(compareScorePaths(past,target.slice(0,74),[candidate(past[0])]),[]);
});
