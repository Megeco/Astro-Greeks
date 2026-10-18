import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMonths,keyMacroDates} from '../lib/macro-summary.ts';
import {parseNiftyReport} from '../lib/nifty-report.ts';
test('monthly summaries preserve zeros, year boundaries and first maximum ties',()=>{
 const rows=[{date:'2027-01-01',P:0,E:8,V:2},{date:'2026-12-30',P:10,E:0,V:7},{date:'2026-12-31',P:10,E:2,V:4}];
 const months=summarizeMonths(rows);assert.equal(months.length,2);assert.equal(months[0].pressure.date,'2026-12-30');assert.equal(months[0].zeroExpansion,1);assert.equal(months[1].first.P,0);assert.equal(months[0].last.date,'2026-12-31');
 const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date));const keys=keyMacroDates(sorted);assert.equal(keys.length,3);assert.ok(keys.find(x=>x.row.date==='2026-12-30')!.reasons.length>1);
});
test('daily index report must match Nifty, date, schema and positive closing value',()=>{
 const header='Index Name,Index Date,Closing Index Value\n';
 assert.equal(parseNiftyReport('\uFEFF'+header+'Nifty Bank,16-10-2026,50000\nNifty 50,16-10-2026,23146.15','2026-10-16'),23146.15);
 assert.throws(()=>parseNiftyReport(header+'Nifty 50,15-10-2026,23146.15','2026-10-16'),/date mismatch/);
 assert.throws(()=>parseNiftyReport(header+'Nifty 50,16-10-2026,0','2026-10-16'),/Invalid close/);
 assert.throws(()=>parseNiftyReport('<html>Unavailable</html>','2026-10-16'),/Not an NSE/);
});
