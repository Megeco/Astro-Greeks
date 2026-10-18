export type Quote = { strike: number; type: 'CE' | 'PE'; last: number | null; bid: number | null; ask: number | null };
export function csvRows(text: string): string[][] {
  if (text.length > 2_000_000) throw Error('Choose a CSV smaller than 2 MB.');
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(value.trim()); value = '';
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else value += c;
  }
  if (quoted) throw Error('The CSV has an unfinished quoted field.');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
const key = (s: string) => s.replace(/[^a-z]/gi, '').toUpperCase();
function value(s: string | undefined): number | null {
  if (!s || /^[—–\-]+$/.test(s.trim())) return null;
  const n = Number(s.replaceAll(',', '').trim());
  if (!Number.isFinite(n) || n < 0) throw Error('A price or strike is not a valid non-negative number.');
  return n;
}
export function parseNseChain(text: string): Quote[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const h = rows.findIndex(r => r.some(c => ['STRIKE', 'STRIKEPRICE'].includes(key(c))));
  if (h < 0) throw Error('Choose the NSE option-chain CSV with calls and puts around a Strike column.');
  const header = rows[h].map(key), mid = header.findIndex(c => ['STRIKE', 'STRIKEPRICE'].includes(c));
  const field = (type: 'CE' | 'PE', names: string[]) => header.findIndex((c, i) => names.includes(c) && (type === 'CE' ? i < mid : i > mid));
  const fields = (['CE', 'PE'] as const).map(type => ({ type, last: field(type, ['LTP', 'LASTPRICE']), bid: field(type, ['BID', 'BIDPRICE']), ask: field(type, ['ASK', 'ASKPRICE']) }));
  if (fields.some(f => f.last < 0 || f.bid < 0 || f.ask < 0)) throw Error('Both calls and puts must have LTP, Bid and Ask columns.');
  const result: Quote[] = [], seen = new Set<string>();
  for (const row of rows.slice(h + 1)) {
    if (!row.some(Boolean) || row.some(c => key(c) === 'TOTAL')) continue;
    const strike = value(row[mid]);
    if (strike === null || strike <= 0) throw Error('A data row has no valid strike. Choose one expiry on NSE before downloading.');
    for (const f of fields) {
      const last = value(row[f.last]), bid = value(row[f.bid]), ask = value(row[f.ask]);
      if (last === null && bid === null && ask === null) continue;
      const id = `${strike}|${f.type}`; if (seen.has(id)) throw Error('Duplicate strikes found. Download a single expiry rather than a combined chain.'); seen.add(id);
      result.push({ strike, type: f.type, last, bid, ask });
    }
  }
  if (!result.length) throw Error('No option prices found in this file.');
  return result.sort((a, b) => a.strike - b.strike || a.type.localeCompare(b.type));
}
export function normalizeMacro(raw: any, date: string) {
  if (raw?.success !== true || raw.date !== date || raw.metadata?.provider !== 'Swiss Ephemeris' || raw.metadata?.zodiac !== 'sidereal' || raw.metadata?.ayanamsa !== 'Lahiri') throw Error('The macro source did not return the requested Swiss/Lahiri reading.');
  const scores = [raw.pressureScore, raw.expansionScore, raw.volatilityScore ?? raw.volatility];
  if (scores.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) throw Error('The macro source returned invalid scores.');
  return { date, P: scores[0], E: scores[1], V: scores[2] };
}
export function isDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; }
