import test from 'node:test';
import assert from 'node:assert/strict';
import { csvRows, isDate, normalizeMacro, parseNseChain } from '../lib/snapshot.ts';
const header = 'OI,CHNG IN OI,VOLUME,IV,LTP,CHNG,BID QTY,BID,ASK,ASK QTY,STRIKE,BID QTY,BID,ASK,ASK QTY,CHNG,LTP,IV,VOLUME,CHNG IN OI,OI';
const row = '1,0,20,10,"1,200.50",0,1,"1,199.00","1,202.00",1,"24,000",1,90,92,1,0,91,10,20,0,1';
test('NSE grouped headers, quoted thousands and both option sides survive import', () => {
  const quotes = parseNseChain('CALLS,,,,,,,,,,PUTS\r\n' + header + '\r\n' + row);
  assert.equal(quotes.length, 2); assert.deepEqual(quotes[0], { strike: 24000, type: 'CE', last: 1200.5, bid: 1199, ask: 1202 });
  assert.deepEqual(quotes[1], { strike: 24000, type: 'PE', last: 91, bid: 90, ask: 92 });
});
test('missing quote sides stay missing, never manufactured zero quotes', () => {
  const values = csvRows(row)[0]; for (const i of [4, 7, 8]) values[i] = '-';
  const text = values.map(x => '"' + x.replaceAll('"', '""') + '"').join(',');
  const q = parseNseChain(header + '\n' + text); assert.equal(q.length, 1); assert.equal(q[0].type, 'PE');
});
test('duplicate strikes, malformed CSV and unsupported schemas are rejected', () => {
  assert.throws(() => parseNseChain(header + '\n' + row + '\n' + row), /Duplicate/);
  assert.throws(() => csvRows('"unfinished'), /unfinished/);
  assert.throws(() => parseNseChain('strike,ltp\n24000,20'), /Both calls/);
  assert.throws(() => parseNseChain(header + '\n' + row.replace('"24,000"', 'invalid')), /valid non-negative/);
});
test('macro readings require the requested date and actual Swiss/Lahiri numeric scores', () => {
  const raw = { success: true, date: '2026-10-18', metadata: { provider: 'Swiss Ephemeris', zodiac: 'sidereal', ayanamsa: 'Lahiri' }, pressureScore: 0, expansionScore: 12, volatility: 3.5 };
  assert.deepEqual(normalizeMacro(raw, raw.date), { date: raw.date, P: 0, E: 12, V: 3.5 });
  assert.throws(() => normalizeMacro(raw, '2026-10-19'));
  assert.throws(() => normalizeMacro({ ...raw, pressureScore: null }, raw.date));
  assert.throws(() => normalizeMacro({ ...raw, metadata: {} }, raw.date));
});
test('dates must round trip exactly', () => {
  assert.ok(isDate('2024-02-29')); assert.ok(!isDate('2026-02-29')); assert.ok(!isDate('2026-13-01')); assert.ok(!isDate('today'));
});
