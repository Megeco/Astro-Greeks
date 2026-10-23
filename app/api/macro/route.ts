import {NextResponse} from 'next/server';
import {isDate} from '@/lib/snapshot';
import {getMacroHistoryPoint} from '@/lib/astro-engine/realEphemeris.js';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,date=q.get('date')||'',days=Number(q.get('days')||1);
 if(!isDate(date)||date<'1996-01-01'||date>'2099-10-17'||!Number.isInteger(days)||days<1||days>75)return NextResponse.json({error:'Choose a valid date from 1996 through 2099-10-17 and 1–75 days.'},{status:400});
 try{const rows=Array.from({length:days},(_,i)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);const s=d.toISOString().slice(0,10),p=getMacroHistoryPoint(s);return {date:s,P:p.pressure,E:p.expansion,V:p.volatility};});return NextResponse.json({source:'Bundled direct Swiss Ephemeris / Lahiri / mean node',sourceVersion:'37.9.14-consistency-3',fetchedAt:new Date().toISOString(),rows});}
 catch{return NextResponse.json({error:'Could not calculate the macro path with Swiss Ephemeris. No substitute scores were used.'},{status:503});}
}
