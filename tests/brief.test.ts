import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { macroMilestones, workingRead, optionShortlist } from "../lib/brief.ts";
const raw = JSON.parse(
  fs.readFileSync(new URL("../data/archive.json", import.meta.url), "utf8"),
);
const rows = raw.macro
  .filter((r: any) => r[0] >= "2024-07-15" && r[0] <= "2024-09-27")
  .map((r: any) => ({ date: r[0], P: r[1], E: r[2], V: r[3] }));
test("brief preserves the July-cutoff relief and August pressure crest without 25-day averaging", () => {
  const m = macroMilestones(rows);
  assert.ok(m.length <= 9);
  assert.equal(m[0].date, "2024-07-15");
  assert.ok(m.some((r) => r.date === "2024-08-19" && r.P === 59));
  assert.ok(
    m.some(
      (r) =>
        r.read.includes("Pressure eases") &&
        r.date > "2024-07-15" &&
        r.date < "2024-08-01",
    ),
  );
  assert.ok(workingRead(rows).includes("2024-08-19"));
  for (const r of m) {
    const original = rows.find((x: any) => x.date === r.date)!;
    assert.equal(r.P, original.P);
    assert.equal(r.E, original.E);
    assert.equal(r.V, original.V);
  }
});
test("a quiet macro brief offers no fabricated directional edge", () => {
  assert.ok(
    workingRead([{ date: "2024-07-15", P: 0, E: 0, V: 0 }]).includes(
      "no clear directional edge",
    ),
  );
  assert.deepEqual(macroMilestones([]), []);
  assert.deepEqual(optionShortlist([], rows, "2024-07-15"), []);
});
test("shortlist uses real snapshot quotes and does not choose a near-worthless cheapest tail", () => {
  const d = raw.days.find((d: any) => d.date === "2024-07-15");
  const qs = d.quotes.map((r: any) =>
    Object.fromEntries(
      raw.meta.quoteColumns.map((k: string, i: number) => [k, r[i]]),
    ),
  ); // Pure fixture Greeks let the selection be checked independently of fitting.
  const candidates = qs
    .filter((q: any) => q.type === "PE" && q.expiry === "2024-08-29")
    .slice(0, 3)
    .map((q: any, i: number) => ({
      ...q,
      volume: 10000,
      oi: 10000,
      close: [500, 300, 1][i],
      greeks: { delta: [-0.7, -0.5, -0.01][i] },
      moneyness: i === 2 ? "OTM" : "ITM",
    }));
  const s = optionShortlist(candidates, rows, "2024-07-15");
  assert.ok(s.some((r) => r.preferred));
  assert.ok(!s.some((r) => Math.abs(r.q.greeks.delta) < 0.15));
  for (const r of s) assert.ok(candidates.includes(r.q));
});
