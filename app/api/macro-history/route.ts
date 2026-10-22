import {NextResponse} from 'next/server';
import archive from '@/data/macro-history.json';
export async function GET(){
 const cutoff=new Date(Date.now()+19800000).toISOString().slice(0,10);
 return NextResponse.json({...archive,rows:archive.rows.filter(r=>String(r[0])<cutoff)},{headers:{'Cache-Control':'public, max-age=3600'}});
}
