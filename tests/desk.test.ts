import test from "node:test";
import assert from "node:assert/strict";
import {
  proposal,
  actionCue,
  scenario,
  pathRead,
  candidateLabels,
} from "../lib/desk.ts";
test("pressure does not manufacture an expansion call signal", () => {
  const rows = [{ date: "2024-08-19", P: 59, E: 0, V: 43 }];
  assert.equal(proposal(rows, "2024-07-15", "CE"), null);
  const p = proposal(rows, "2024-07-15", "PE")!;
  assert.equal(p.peak, "2024-08-19");
  assert.ok(p.buy > "2024-07-15");
  assert.ok(p.exit > p.buy);
  assert.equal(candidateLabels([], rows, "2024-07-15").size, 0);
});
test("balanced scores remain an unclear direction rather than a bearish forecast", () => {
  assert.ok(
    pathRead([{ date: "2024-08-01", P: 10, E: 10, V: 8 }]).includes(
      "direction unclear",
    ),
  );
});
test("bought-option net loss includes both slippage sides and position reserve", () => {
  const p = {
    entryPremium: 100,
    lot: 25,
    lots: 1,
    slippagePct: 1,
    reserve: 100,
    profitPct: 50,
    lossPct: 40,
    exitDate: "2024-08-20",
    expiry: "2024-09-26",
  };
  const c = actionCue(p, { date: "2024-08-06", premium: 50 });
  assert.equal(c.cash, 2625);
  assert.equal(c.net, -1387.5);
  assert.equal(c.text, "Loss exit rule triggered");
  assert.equal(actionCue(p, null).text, "Update the premium");
  assert.equal(
    actionCue(p, { date: "2024-08-20", premium: 150 }).text,
    "Exit due under the plan",
  );
});
test("price scenarios cannot extend beyond expiry or back before the reference date", () => {
  const q = {
    expiry: "2024-09-26",
    strike: 25500,
    type: "PE",
    close: 500,
    lot: 25,
    greeks: { ivPct: 15, carry: 0.06 },
  };
  assert.equal(
    scenario(q, 24500, "2024-07-15", "2024-10-01", 0, 0, 1, 1, 100),
    null,
  );
  assert.equal(
    scenario(q, 24500, "2024-07-15", "2024-07-01", 0, 0, 1, 1, 100),
    null,
  );
  const a = scenario(q, 24500, "2024-07-15", "2024-08-20", -3, 0, 1, 1, 100)!,
    b = scenario(q, 24500, "2024-07-15", "2024-08-20", 3, 0, 1, 1, 100)!;
  assert.ok(a.premium > b.premium);
});
