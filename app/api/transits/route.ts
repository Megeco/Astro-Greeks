import {NextResponse} from 'next/server';
import {getResearchContext} from '@/lib/astro-engine/realEphemeris.js';
import {isDate} from '@/lib/snapshot';
export const runtime='nodejs';
export async function GET(request:Request){
 const date=new URL(request.url).searchParams.get('date')||'';
 if(!isDate(date)||date<'1996-01-01'||date>'2099-12-31')return NextResponse.json({error:'Choose a date from 1996 through 2099.'},{status:400});
 try{return NextResponse.json({...getResearchContext(date),version:'37.9.14-consistency-3',basis:'Direct Swiss Ephemeris · sidereal Lahiri · mean node · 12:00 UTC',fetchedAt:new Date().toISOString()});}
 catch{return NextResponse.json({error:'Swiss Ephemeris calculation unavailable. No substitute positions or scores were used.'},{status:503});}
}
