import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  runReplay,
  validatePlan,
  price,
  fit,
  digest,
  quarterReviews,
  effectiveExit,
  addDays,
  auditMilestones,
  type Plan,
  type Day,
} from "../lib/research.ts";
const raw = JSON.parse(
  fs.readFileSync(new URL("../data/archive.json", import.meta.url), "utf8"),
);
const days: Day[] = raw.days.map((d: any) => ({
  ...d,
  quotes: d.quotes.map((q: any[]) =>
    Object.fromEntries(
      raw.meta.quoteColumns.map((k: string, i: number) => [k, q[i]]),
    ),
  ),
}));
const plan: Plan = {
  name: "August fixture",
  cutoff: "2024-07-15",
  horizon: "2024-08-20",
  windowStart: "2024-08-01",
  windowEnd: "2024-08-01",
  entryPolicy: "scheduled",
  mode: "trade",
  type: "PE",
  expiry: "2024-09-26",
  selection: "fixed",
  strike: 25500,
  lots: 1,
  minVolume: 1000,
  minOI: 1000,
  capPct: 5,
  slippagePct: 1,
  reserve: 100,
  management: "fixed",
  profitPct: 50,
  lossPct: 40,
  followThroughDate: "2024-08-09",
  bias: "fixture",
  notes: "",
  milestones: ["2024-08-19"],
  strictQuarter: true,
  ruleVersion: "v1",
};
const approx = (a: any, b: number, t = 0.00001) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("August fixed and monitored outcomes reproduce independent archived fixtures", () => {
  const fixed: any = runReplay(plan, days);
  assert.equal(fixed.status, "completed");
  approx(fixed.netPnL, 2533.8875);
  approx(fixed.entryCash, 16261.2625);
  assert.equal(fixed.exitDate, "2024-08-20");
  const mon: any = runReplay({ ...plan, management: "monitor" }, days);
  assert.equal(mon.status, "completed");
  approx(mon.netPnL, 12833.6);
  assert.equal(mon.signalDate, "2024-08-05");
  assert.equal(mon.exitDate, "2024-08-06");
  assert.ok(
    mon.ledger!.every((r: any) => r.date < "2024-08-06"),
    "no post-exit close mark is shown as held",
  );
});
test("July losing forecast stays a loss, with dated 25-unit lot", () => {
  const p = {
    ...plan,
    cutoff: "2024-06-14",
    windowStart: "2024-06-18",
    windowEnd: "2024-06-18",
    horizon: "2024-07-22",
    expiry: "2024-07-25",
    strike: 24000,
    strictQuarter: false,
  };
  const r = runReplay(p, days);
  assert.equal(r.status, "completed");
  assert.equal(r.units, 25);
  approx(r.netPnL, -13663.325);
  const monitored: any = runReplay({ ...p, management: "monitor" }, days);
  approx(monitored.netPnL, -6229.6625);
  assert.equal(monitored.exitDate, "2024-06-27");
});
test("monitored decisions do not consume future prices", () => {
  const p = { ...plan, management: "monitor" as const };
  const end = "2024-08-05";
  const edited = structuredClone(days);
  for (const d of edited.filter((x) => x.date > end)) {
    d.spot = 1;
    d.quotes.forEach((q) => {
      q.open = 99999;
      q.close = 99999;
    });
  }
  const a = runReplay(p, days, [], end),
    b = runReplay(p, edited, [], end);
  assert.deepEqual(a, b);
  assert.equal(a.status, "open");
  assert.ok(a.ledger!.every((r: any) => r.date <= end));
});
test("missing history is unresolved, not a profitable no-trade", () => {
  const r = runReplay(
    plan,
    days.filter((d) => d.date !== "2024-08-02"),
  );
  assert.equal(r.status, "insufficient_data");
  assert.equal(r.netPnL, undefined);
  const old = runReplay(
    {
      ...plan,
      cutoff: "2018-02-15",
      windowStart: "2018-03-01",
      windowEnd: "2018-03-01",
      horizon: "2018-03-20",
      expiry: "2018-03-28",
    },
    days,
  );
  assert.equal(old.status, "insufficient_data");
});
test("no-fill at frozen opening cap does not retry later", () => {
  const r = runReplay(
    {
      ...plan,
      cutoff: "2024-06-14",
      windowStart: "2024-07-08",
      windowEnd: "2024-07-10",
      horizon: "2024-07-22",
      expiry: "2024-07-25",
      strike: 24700,
    },
    days,
  );
  assert.equal(r.status, "no_fill");
  assert.equal(r.entryDate, "2024-07-08");
  approx(r.observedOpen, 499);
});
test("explicit cash is a decision, not missing data", () => {
  const r = runReplay({ ...plan, mode: "cash" }, []);
  assert.equal(r.status, "no_trade");
  assert.equal(r.netPnL, 0);
  assert.equal(r.netReturnPct, null);
});
test("quarter boundaries restrict trading outcomes, not the macro forecast", () => {
  assert.ok(
    validatePlan({
      ...plan,
      windowStart: "2024-06-28",
      windowEnd: "2024-06-28",
      cutoff: "2024-06-15",
    }).some((e) => e.includes("quarter")),
  );
  assert.deepEqual(quarterReviews("2018-Q1"), [
    "2017-12-15",
    "2018-01-15",
    "2018-02-15",
  ]);
  assert.equal(effectiveExit("2024-08-15"), "2024-08-14");
  assert.equal(addDays("2024-07-15", 74), "2024-09-27");
});
test("IV fit reprices an actual quote and the Greek directions are coherent", () => {
  const d = days.find((d) => d.date === "2024-07-15")!,
    q = d.quotes.find(
      (q) => q.expiry === "2024-09-26" && q.strike === 25500 && q.type === "PE",
    )!,
    g = fit(q, d)!;
  assert.ok(g);
  approx(
    price(d.spot, q.strike, g.ivPct / 100, g.dte / 365, q.type, g.carry),
    q.close,
    0.0001,
  );
  assert.ok(g.delta < 0 && g.delta >= -1 && g.gamma >= 0 && g.vega > 0);
});
test("canonical hashes are key-order independent and detect changed rules", async () => {
  assert.equal(await digest({ b: 2, a: 1 }), await digest({ a: 1, b: 2 }));
  assert.notEqual(await digest(plan), await digest({ ...plan, capPct: 6 }));
});
test("missing actual entry print does not create a synthetic fill", () => {
  const d = structuredClone(days);
  d.find((d) => d.date === "2024-08-01")!.quotes = d
    .find((d) => d.date === "2024-08-01")!
    .quotes.filter(
      (q) =>
        !(
          q.expiry === plan.expiry &&
          q.strike === plan.strike &&
          q.type === plan.type
        ),
    );
  assert.equal(runReplay(plan, d).status, "missing_execution");
});
test("timing audit flags two milestones that claim the same move", () => {
  const rows: Day[] = [
    "2024-08-01",
    "2024-08-02",
    "2024-08-05",
    "2024-08-06",
    "2024-08-07",
    "2024-08-08",
    "2024-08-09",
  ].map((date, i) => ({
    date,
    spot: i < 2 ? 100 : 98,
    futures: {},
    quotes: [],
  }));
  const r = auditMilestones(
    { ...plan, milestones: ["2024-08-05", "2024-08-06"] },
    rows,
  );
  assert.equal(r[0].match?.date, "2024-08-05");
  assert.equal(r[1].sharedWith, "2024-08-05");
});
test("missing conditional deadline premium cannot pass as confirmation", () => {
  const d = structuredClone(days);
  d.find((d) => d.date === "2024-08-09")!.quotes = d
    .find((d) => d.date === "2024-08-09")!
    .quotes.filter(
      (q) =>
        !(
          q.expiry === plan.expiry &&
          q.strike === plan.strike &&
          q.type === plan.type
        ),
    );
  const r = runReplay(
    { ...plan, management: "conditional", profitPct: 10000, lossPct: 100 },
    d,
  );
  assert.equal(r.status, "missing_mark");
});
