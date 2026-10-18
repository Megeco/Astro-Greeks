import { NextResponse } from 'next/server';
import { parseNiftyReport } from '@/lib/nifty-report';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET() {
  const now=new Date(Date.now()+19800000),today=now.toISOString().slice(0,10);
  const results=await Promise.allSettled(Array.from({length:7},async(_,offset)=>{
    const d=new Date(today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-offset);const date=d.toISOString().slice(0,10),stamp=date.slice(8,10)+date.slice(5,7)+date.slice(0,4);
    const source=`https://nsearchives.nseindia.com/content/indices/ind_close_all_${stamp}.csv`;
    const response=await fetch(source,{signal:AbortSignal.timeout(10000),cache:'force-cache',next:{revalidate:1800}});
    if(!response.ok)throw Error('Report unavailable');
    const close=parseNiftyReport(await response.text(),date);
    return {date,close,source,kind:'Published daily close',fetchedAt:new Date().toISOString()};
  }));
  const available=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]).sort((a,b)=>b.date.localeCompare(a.date));
  if(!available.length)return NextResponse.json({error:'No verified Nifty closing report was available in the last seven calendar days.'},{status:502});
  return NextResponse.json({...available[0],unavailableNewerReports:results.slice(0,Math.round((Date.parse(today)-Date.parse(available[0].date))/86400000)).filter(r=>r.status==='rejected').length,notice:'Latest retrievable published close; not an intraday quote. A missing newer report can reflect publication delay or source availability.'});
}
