import {
  addDays,
  daysBetween,
  expectedSession,
  price,
  type Plan,
} from "./research.ts";
export type MacroRow = { date: string; P: number; E: number; V: number };
export function pathRead(rows: MacroRow[]) {
  if (!rows.length) return "Macro data is unavailable for this window.";
  const blocks = [rows.slice(0, 25), rows.slice(25, 50), rows.slice(50, 75)];
  return (
    blocks
      .filter((b) => b.length)
      .map((b) => {
        const p = b.reduce((s, r) => s + r.P, 0) / b.length,
          e = b.reduce((s, r) => s + r.E, 0) / b.length;
        return `${b[0].date.slice(5)}–${b.at(-1)!.date.slice(5)}: ${p > e + 3 ? "pressure-led; decline or consolidation" : e > p + 3 ? "expansion-led; upward bias" : "balanced; direction unclear"}`;
      })
      .join(" → ") + "."
  );
}
export function proposal(rows: MacroRow[], cutoff: string, side: "CE" | "PE") {
  const key = side === "PE" ? "P" : "E",
    other = side === "PE" ? "E" : "P";
  const meaningful = rows.filter(
    (r) => r.date > addDays(cutoff, 3) && r[key] > r[other] + 3 && r[key] > 0,
  );
  const peak = meaningful
    .slice()
    .sort(
      (a, b) =>
        b[key] - b[other] - (a[key] - a[other]) || a.date.localeCompare(b.date),
    )[0];
  if (!peak) return null;
  let buy = addDays(peak.date, -10);
  if (buy <= cutoff) buy = addDays(cutoff, 1);
  while (!expectedSession(buy)) buy = addDays(buy, 1);
  let exit = addDays(peak.date, 2);
  while (!expectedSession(exit)) exit = addDays(exit, 1);
  return {
    buy,
    exit,
    peak: peak.date,
    strength: peak[key] - peak[other],
    side,
  };
}
export function candidateLabels(
  quotes: any[],
  rows: MacroRow[],
  cutoff: string,
  minVolume = 1000,
  minOI = 1000,
) {
  const tags = new Map<string, string[]>();
  const id = (q: any) => `${q.expiry}|${q.strike}|${q.type}`;
  for (const side of ["CE", "PE"] as const) {
    const p = proposal(rows, cutoff, side);
    if (!p) continue;
    const eligible = quotes.filter(
      (q) =>
        q.type === side &&
        q.greeks &&
        q.expiry > addDays(p.exit, 7) &&
        q.volume >= minVolume &&
        q.oi >= minOI &&
        q.close > 0,
    );
    const add = (q: any, label: string) => {
      if (q) tags.set(id(q), [...(tags.get(id(q)) || []), label]);
    };
    add(
      eligible.slice().sort((a, b) => a.close * a.lot - b.close * b.lot)[0],
      "Lowest cash",
    );
    add(
      eligible
        .filter(
          (q) =>
            Math.abs(q.greeks.delta) >= 0.6 && Math.abs(q.greeks.delta) <= 0.8,
        )
        .sort(
          (a, b) =>
            Math.abs(Math.abs(a.greeks.delta) - 0.7) -
            Math.abs(Math.abs(b.greeks.delta) - 0.7),
        )[0],
      "Directional",
    );
    const dates = [...new Set(eligible.map((q) => q.expiry))].sort();
    if (dates.length > 1)
      add(
        eligible
          .filter(
            (q) =>
              q.expiry === dates[1] &&
              Math.abs(q.greeks.delta) >= 0.4 &&
              Math.abs(q.greeks.delta) <= 0.8,
          )
          .sort(
            (a, b) =>
              Math.abs(Math.abs(a.greeks.delta) - 0.5) -
              Math.abs(Math.abs(b.greeks.delta) - 0.5),
          )[0],
        "More time",
      );
  }
  return tags;
}
export function scenario(
  q: any,
  spot: number,
  referenceDate: string,
  exit: string,
  movePct: number,
  ivChange: number,
  lots: number,
  slip: number,
  reserve: number,
) {
  if (
    !q?.greeks ||
    exit < referenceDate ||
    exit > q.expiry ||
    movePct <= -100 ||
    q.greeks.ivPct + ivChange <= 0
  )
    return null;
  const premium = price(
    spot * (1 + movePct / 100),
    q.strike,
    (q.greeks.ivPct + ivChange) / 100,
    daysBetween(exit, q.expiry) / 365,
    q.type,
    q.greeks.carry,
  );
  const cash = q.close * (1 + slip / 100) * q.lot * lots + reserve;
  return {
    spot: spot * (1 + movePct / 100),
    premium,
    cash,
    net: premium * (1 - slip / 100) * q.lot * lots - cash,
    returnPct:
      (100 * (premium * (1 - slip / 100) * q.lot * lots - cash)) / cash,
  };
}
export function actionCue(p: any, mark: any) {
  if (!mark)
    return {
      tone: "neutral",
      text: "Update the premium",
      reason: "No observed mark; no action inferred.",
    };
  const units = p.lot * p.lots,
    cash = p.entryPremium * (1 + p.slippagePct / 100) * units + p.reserve,
    net = mark.premium * (1 - p.slippagePct / 100) * units - cash,
    ret = (net / cash) * 100,
    left = daysBetween(mark.date, p.exitDate),
    dte = daysBetween(mark.date, p.expiry);
  if (p.closed)
    return {
      tone: "neutral",
      text: "Closed",
      reason: "Position marked closed by you.",
      net,
      ret,
      cash,
    };
  if (left <= 0 || dte <= 1)
    return {
      tone: "red",
      text: "Exit due under the plan",
      reason: "The planned time exit or expiry boundary has arrived.",
      net,
      ret,
      cash,
    };
  if (ret <= -p.lossPct)
    return {
      tone: "red",
      text: "Loss exit rule triggered",
      reason:
        "Observed net loss crossed the configured limit; any next fill remains uncertain.",
      net,
      ret,
      cash,
    };
  if (ret >= p.profitPct)
    return {
      tone: "green",
      text: "Profit exit rule triggered",
      reason:
        "Observed net gain crossed the configured target; any next fill remains uncertain.",
      net,
      ret,
      cash,
    };
  if (left <= 3 || dte <= 7)
    return {
      tone: "orange",
      text: "Prepare the time exit",
      reason: "Within three days of exit or seven days of expiry.",
      net,
      ret,
      cash,
    };
  return {
    tone: ret < 0 ? "yellow" : "green",
    text: "No exit rule triggered",
    reason:
      "Time and net premium remain inside the configured boundaries. This is not a probability of recovery.",
    net,
    ret,
    cash,
  };
}
export function deskPlan(
  q: any,
  cutoff: string,
  buy: string,
  exit: string,
  notes: string,
): Plan {
  return {
    name: `${q.strike} ${q.type} · ${buy} entry`,
    cutoff,
    windowStart: buy,
    windowEnd: buy,
    horizon: exit,
    entryPolicy: "scheduled",
    mode: "trade",
    type: q.type,
    expiry: q.expiry,
    selection: "fixed",
    strike: q.strike,
    lots: 1,
    minVolume: 1000,
    minOI: 1000,
    capPct: 5,
    slippagePct: 1,
    reserve: 100,
    management: "monitor",
    profitPct: 50,
    lossPct: 40,
    followThroughDate: exit,
    bias: "Exploratory macro table proposal",
    notes,
    milestones: [],
    strictQuarter: true,
    ruleVersion: "Table desk v0.2 — exploratory dates",
  };
}
