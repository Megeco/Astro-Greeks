'use client';
import { useEffect, useRef, useState } from 'react';
import { isDate, parseNseChain, type Quote } from '@/lib/snapshot';
type Macro = { date: string; P: number; E: number; V: number };
export type Snapshot = { asOf: string; expiry: string; spot: number | null; filename: string; importedAt: string; quotes: Quote[] };
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
const fmt = (n: number | null) => n === null ? '—' : n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export default function SnapshotDesk({ positions, onMark }: { positions: any[]; onMark: (s: Snapshot, q: Quote) => void }) {
  const [date, setDate] = useState(today), [rows, setRows] = useState<Macro[]>([]), [macroAt, setMacroAt] = useState(''), [macroError, setMacroError] = useState(''), [loading, setLoading] = useState(false), [progress, setProgress] = useState('');
  const [asOf, setAsOf] = useState(''), [expiry, setExpiry] = useState(''), [spot, setSpot] = useState(''), [snapshot, setSnapshot] = useState<Snapshot | null>(null), [error, setError] = useState(''), [filter, setFilter] = useState(''), [showAll, setShowAll] = useState(false);
  const input = useRef<HTMLInputElement>(null), run = useRef(0);
  useEffect(() => { void loadMacro(1); return () => { run.current++; }; }, []);
  async function loadMacro(days: number) {
    const current = ++run.current; setLoading(true); setProgress(''); setRows([]); setMacroError(''); setMacroAt('');
    try {
      for (let i = 0; i < days; i += 5) {
        if (current !== run.current) return;
        const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i);
        const response = await fetch(`/api/macro?date=${d.toISOString().slice(0, 10)}&days=${Math.min(5, days - i)}`); const result = await response.json();
        if (!response.ok) throw Error(result.error || 'Macro request failed.');
        if (current !== run.current) return;
        setRows(previous => [...previous, ...result.rows]); setMacroAt(result.fetchedAt); setProgress(`${Math.min(i + 5, days)} of ${days} days loaded`);
      }
    } catch (e) { if (current === run.current) setMacroError((e as Error).message); }
    finally { if (current === run.current) setLoading(false); }
  }
  async function importFile(file: File) {
    setError('');
    try {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(asOf) || !isDate(asOf.slice(0, 10)) || !isDate(expiry) || expiry < asOf.slice(0, 10)) throw Error('Enter the snapshot date/time shown on NSE (IST) and its expiry before importing.');
      if (!Number.isFinite(Date.parse(asOf + ':00+05:30'))) throw Error('Enter a valid snapshot time.');
      if (Date.parse(asOf + ':00+05:30') > Date.now() + 60000) throw Error('The snapshot time cannot be in the future.');
      if (spot && !(Number.isFinite(Number(spot)) && Number(spot) > 0)) throw Error('Enter a positive Nifty spot level or leave it blank.');
      if (file.size > 2_000_000) throw Error('Choose a CSV smaller than 2 MB.');
      const quotes = parseNseChain(await file.text());
      setSnapshot({ asOf, expiry, spot: spot ? Number(spot) : null, filename: file.name, importedAt: new Date().toISOString(), quotes }); setShowAll(false); setFilter('');
    } catch (e) { setError((e as Error).message); }
    finally { if (input.current) input.current.value = ''; }
  }
  const matches = (q: Quote) => positions.filter(p => !p.closed && p.expiry === snapshot?.expiry && p.strike === q.strike && p.type === q.type && p.entryDate <= (snapshot?.asOf.slice(0, 10) || ''));
  const quotes = snapshot?.quotes.filter(q => !filter || String(q.strike).includes(filter)) || [];
  const displayed = showAll || filter ? quotes : [...quotes].sort((a, b) => snapshot?.spot ? Math.abs(a.strike - snapshot.spot) - Math.abs(b.strike - snapshot.spot) : a.strike - b.strike).slice(0, 30).sort((a, b) => a.strike - b.strike || a.type.localeCompare(b.type));
  return <>
    <section className="desk-card snapshot-panel">
      <h2>Fin-Lumen macro scores</h2>
      <p>Readings from the connected 37.9.14-family Swiss Ephemeris engine. These are macro scores, not calibrated trade probabilities.</p>
      <div className="desk-row"><label className="desk-field"><span>Start date</span><input type="date" value={date} disabled={loading} onChange={e => { setDate(e.target.value); setRows([]); setMacroAt(''); setMacroError(''); }} /></label>
        <button disabled={loading || !isDate(date)} onClick={() => loadMacro(1)}>Load this date</button><button className="ghost" disabled={loading || !isDate(date)} onClick={() => loadMacro(75)}>Load 75 days</button>
        <a href="https://fin-lumen-new.vercel.app" target="_blank" rel="noopener noreferrer">Open Fin-Lumen ↗</a>
      </div>
      {loading && <p role="status">{progress || 'Loading macro scores…'}</p>}{macroError && <p role="alert">{macroError} {rows.length > 0 && 'Only the completed dates below are available.'}</p>}
      {rows.length > 0 && <><div className="table-wrap"><table><thead><tr><th>Date</th><th>Pressure</th><th>Expansion</th><th>Macro V</th></tr></thead><tbody>{rows.slice(0, 1).map(r => <tr key={r.date}><td>{r.date}</td><td>{fmt(r.P)}</td><td>{fmt(r.E)}</td><td>{fmt(r.V)}</td></tr>)}</tbody></table></div>
      {rows.length > 1 && <details><summary>Full daily table ({rows.length} dates)</summary><div className="table-wrap full-macro"><table><thead><tr><th>Date</th><th>Pressure</th><th>Expansion</th><th>Macro V</th></tr></thead><tbody>{rows.map(r => <tr key={r.date}><td>{r.date}</td><td>{fmt(r.P)}</td><td>{fmt(r.E)}</td><td>{fmt(r.V)}</td></tr>)}</tbody></table></div></details>}
      <small>Retrieved {new Date(macroAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Macro readings may be cached for one hour. Historical requests are retrospective calculations.</small></>}
    </section>
    <section className="desk-card snapshot-panel"><h2>Nifty options · dated snapshot</h2>
      <p><a href="https://www.nseindia.com/option-chain" target="_blank" rel="noopener noreferrer">Open NSE option chain ↗</a> · Choose NIFTY and one expiry, then Download CSV. Enter the date/time displayed there and import the file. No broker connection is needed.</p>
      <div className="desk-form"><label className="desk-field"><span>Snapshot date/time (IST, entered by you)</span><input type="datetime-local" value={asOf} onChange={e => setAsOf(e.target.value)} /></label><label className="desk-field"><span>Selected expiry</span><input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></label><label className="desk-field"><span>Nifty spot shown on NSE (optional)</span><input inputMode="decimal" value={spot} onChange={e => setSpot(e.target.value)} placeholder="Enter the displayed level" /></label><label className="desk-field"><span>Single-expiry NIFTY option-chain CSV</span><input ref={input} type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); }} /></label></div>
      {error && <p role="alert">{error}</p>}
      <p className="quiet">This imports your downloaded file; it does not fetch NSE prices automatically. Expiry, time and spot are your supplied labels. LTP can be older than the snapshot.</p>
      {snapshot && <>
        <div className="snapshot-summary"><b>NIFTY · {snapshot.expiry} expiry</b><span>{snapshot.asOf.replace('T', ' ')} IST · {snapshot.quotes.length} quotes</span><span>Nifty spot: {fmt(snapshot.spot)}</span><small>Source: uploaded NSE CSV · {snapshot.filename}</small></div>
        <div className="desk-row"><label className="desk-field"><span>Find strike</span><input inputMode="numeric" value={filter} onChange={e => setFilter(e.target.value)} /></label><label><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show all quotes</label></div>
        <div className="table-wrap"><table><thead><tr><th>Strike</th><th>Option</th><th>Last traded</th><th>Bid</th><th>Ask</th><th>Monitoring</th></tr></thead><tbody>{displayed.map(q => <tr key={`${q.strike}-${q.type}`}><td>{fmt(q.strike)}</td><td>{q.type === 'CE' ? 'Call' : 'Put'}</td><td>{fmt(q.last)}</td><td>{fmt(q.bid)}</td><td>{fmt(q.ask)}</td><td>{matches(q).length > 0 && q.bid !== null && q.bid > 0 && (q.ask === null || q.ask <= 0 || q.bid <= q.ask) ? <button className="ghost small" onClick={() => onMark(snapshot, q)}>Use bid for {matches(q).length} position(s)</button> : q.bid !== null && q.ask !== null && q.ask > 0 && q.bid > q.ask ? 'Crossed quote: check source' : '—'}</td></tr>)}</tbody></table></div>
        <small>{displayed.length} of {quotes.length} matching quotes shown. The bid is a reference for closing an owned option; it is not a guaranteed fill. Snapshot prices do not enter historical replays.</small>
      </>}
    </section>
  </>;
}
