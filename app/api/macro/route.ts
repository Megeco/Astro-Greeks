import { NextResponse } from 'next/server';
import { isDate, normalizeMacro } from '@/lib/snapshot';
export const runtime = 'nodejs';
export const maxDuration = 60;
const SOURCE = 'https://fin-lumen-new.vercel.app';
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams, date = q.get('date') || '', days = Number(q.get('days') || 1);
  if (!isDate(date) || date < '1900-01-01' || date > '2099-12-27' || !Number.isInteger(days) || days < 1 || days > 5) return NextResponse.json({ error: 'Choose a valid date and 1–5 days.' }, { status: 400 });
  try {
    const rows = await Promise.all(Array.from({ length: days }, async (_, i) => {
      const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i); const s = d.toISOString().slice(0, 10);
      const response = await fetch(`${SOURCE}/api/macro?date=${s}`, { cache: 'force-cache', next: { revalidate: 3600 }, signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw Error('The macro source is temporarily unavailable.');
      return normalizeMacro(await response.json(), s);
    }));
    return NextResponse.json({ source: SOURCE, sourceVersion: '37.9.14 family (connected service)', fetchedAt: new Date().toISOString(), rows });
  } catch {
    return NextResponse.json({ error: 'Could not load verified macro scores. Try again; no archived values were substituted.' }, { status: 502 });
  }
}
