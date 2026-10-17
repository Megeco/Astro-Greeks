export type Quote = {
  expiry: string;
  strike: number;
  type: "CE" | "PE";
  open: number;
  close: number;
  volume: number;
  oi: number;
  lot: number;
};
export type Day = {
  date: string;
  spot: number;
  open?: number;
  high?: number;
  low?: number;
  vix?: number;
  futures: Record<string, number>;
  quotes: Quote[];
};
export type Plan = {
  name: string;
  cutoff: string;
  horizon: string;
  windowStart: string;
  windowEnd: string;
  entryPolicy: "scheduled" | "contrarian3" | "confirmation2";
  mode: "trade" | "cash";
  type: "CE" | "PE";
  expiry: string;
  selection: "fixed" | "directional" | "half" | "otm2" | "otm4";
  strike: number;
  lots: number;
  minVolume: number;
  minOI: number;
  capPct: number;
  slippagePct: number;
  reserve: number;
  management: "fixed" | "monitor" | "conditional";
  profitPct: number;
  lossPct: number;
  followThroughDate: string;
  bias: string;
  notes: string;
  milestones: string[];
  strictQuarter: boolean;
  parentId?: string;
  ruleVersion: string;
  [key: string]: unknown;
};
export const ENGINE_VERSION = "C1-37.9.14-retrospective";
export const RULE_ENGINE = "workbench-replay-1.0";
export const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000,
  );
export const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s)) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export const quarterOf = (d: string) =>
  `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterEnd(q: string) {
  const y = Number(q.slice(0, 4)),
    n = Number(q.slice(-1));
  return new Date(Date.UTC(y, n * 3, 0)).toISOString().slice(0, 10);
}
export function quarterReviews(q: string) {
  const y = Number(q.slice(0, 4)),
    n = Number(q.slice(-1));
  return [0, 1, 2].map((i) =>
    new Date(Date.UTC(y, (n - 1) * 3 + i - 1, 15)).toISOString().slice(0, 10),
  );
}
export const CLOSED = [
  "2023-08-15",
  "2023-09-19",
  "2024-03-25",
  "2024-03-29",
  "2024-04-11",
  "2024-04-17",
  "2024-05-01",
  "2024-05-20",
  "2024-06-17",
  "2024-07-17",
  "2024-08-15",
];
export const expectedSession = (d: string, closed: string[] = []) =>
  ![0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay()) &&
  !CLOSED.includes(d) &&
  !closed.includes(d);
export function previousSession(d: string, closed: string[] = []) {
  let x = addDays(d, -1);
  for (let i = 0; i < 12 && !expectedSession(x, closed); i++)
    x = addDays(x, -1);
  return x;
}
export function effectiveExit(d: string, closed: string[] = []) {
  let x = d;
  for (let i = 0; i < 12 && !expectedSession(x, closed); i++)
    x = addDays(x, -1);
  return x;
}
export function stableJSON(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableJSON).join(",") + "]";
  return (
    "{" +
    Object.keys(v)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableJSON(v[k]))
      .join(",") +
    "}"
  );
}
export async function digest(v: any) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(stableJSON(v)),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function validatePlan(p: any): string[] {
  const e: string[] = [];
  if (!p || typeof p !== "object") return ["Plan required"];
  for (const k of ["cutoff", "horizon", "windowStart", "windowEnd"])
    if (!validDate(p[k])) e.push(`Invalid ${k}`);
  if (e.length) return e;
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 180)
    e.push("A plan name of 1–180 characters is required");
  if (p.windowStart <= p.cutoff)
    e.push("Entry must follow the information cutoff");
  if (p.windowEnd < p.windowStart || p.windowEnd > p.horizon)
    e.push("Entry window must end before the horizon");
  if (daysBetween(p.cutoff, p.horizon) > 120)
    e.push("Holding horizon is limited to 120 days");
  if (p.mode !== "cash") {
    if (!validDate(p.expiry) || p.expiry <= p.horizon)
      e.push("Expiry must follow the planned last exit");
    if (!["PE", "CE"].includes(p.type)) e.push("Call or put required");
    if (p.selection === "fixed" && !(p.strike > 0))
      e.push("Positive strike required");
  }
  if (
    !["trade", "cash"].includes(p.mode) ||
    !["scheduled", "contrarian3", "confirmation2"].includes(p.entryPolicy) ||
    !["fixed", "directional", "half", "otm2", "otm4"].includes(p.selection) ||
    !["fixed", "monitor", "conditional"].includes(p.management)
  )
    e.push("Unknown policy");
  for (const [k, lo, hi] of [
    ["lots", 1, 100],
    ["minVolume", 0, 10000000],
    ["minOI", 0, 1000000000],
    ["capPct", 0, 100],
    ["slippagePct", 0, 20],
    ["reserve", 0, 100000],
    ["profitPct", 1, 10000],
    ["lossPct", 1, 100],
  ] as const)
    if (!Number.isFinite(Number(p[k])) || p[k] < lo || p[k] > hi)
      e.push(`Invalid ${k}`);
  if (!Number.isInteger(p.lots)) e.push("Lots must be a whole number");
  if (
    p.management === "conditional" &&
    (!validDate(p.followThroughDate) ||
      p.followThroughDate < p.windowEnd ||
      p.followThroughDate >= p.horizon)
  )
    e.push(
      "Follow-through check must follow the entry window and precede the exit",
    );
  if (
    p.strictQuarter &&
    (quarterOf(p.windowStart) !== quarterOf(p.windowEnd) ||
      p.horizon > quarterEnd(quarterOf(p.windowStart)))
  )
    e.push(
      "Strict quarterly outcomes cannot cross the quarter boundary. The macro view may cross.",
    );
  if (p.notes?.length > 12000) e.push("Notes are too long");
  if (
    !Array.isArray(p.milestones) ||
    p.milestones.length > 12 ||
    p.milestones.some((d: any) => !validDate(d))
  )
    e.push("Use up to 12 valid milestone dates");
  return e;
}
function cdf(x: number) {
  const a = Math.abs(x),
    t = 1 / (1 + 0.2316419 * a),
    d = 0.3989422804014327 * Math.exp((-a * a) / 2);
  const v =
    1 -
    d *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? v : 1 - v;
}
export function price(
  s: number,
  k: number,
  v: number,
  t: number,
  type: string,
  carry: number,
  rate = 0.065,
) {
  if (t <= 0) return Math.max(type === "CE" ? s - k : k - s, 0);
  const f = s * Math.exp(carry * t),
    z = v * Math.sqrt(t),
    d1 = (Math.log(f / k) + (z * z) / 2) / z,
    d2 = d1 - z;
  return (
    Math.exp(-rate * t) *
    (type === "CE" ? f * cdf(d1) - k * cdf(d2) : k * cdf(-d2) - f * cdf(-d1))
  );
}
export function fit(q: Quote, day: Day) {
  const t = daysBetween(day.date, q.expiry) / 365,
    F = day.futures[q.expiry];
  if (t <= 1 / 365 || !F || !day.spot || q.close <= 0 || q.volume <= 0)
    return null;
  const carry = Math.log(F / day.spot) / t;
  let lo = 0.0001,
    hi = 3;
  const pr = (s: number, v: number, tt = t) =>
    price(s, q.strike, v, tt, q.type, carry);
  if (pr(day.spot, lo) > q.close + 1e-5 || pr(day.spot, hi) < q.close)
    return null;
  for (let i = 0; i < 65; i++) {
    const mid = (lo + hi) / 2;
    if (pr(day.spot, mid) > q.close) hi = mid;
    else lo = mid;
  }
  const v = (lo + hi) / 2,
    h = 0.00001;
  return {
    ivPct: v * 100,
    delta: (pr(day.spot + 1, v) - pr(day.spot - 1, v)) / 2,
    gamma: pr(day.spot + 1, v) - 2 * q.close + pr(day.spot - 1, v),
    vega: (pr(day.spot, v + h) - pr(day.spot, v - h)) / 2 / h / 100,
    theta: pr(day.spot, v, t - 1 / 365) - q.close,
    carry,
    dte: Math.round(t * 365),
  };
}
export function enriched(day: Day) {
  return day.quotes.map((q) => ({
    ...q,
    greeks: fit(q, day),
    moneyness:
      Math.abs(q.strike - day.spot) < 50
        ? "ATM"
        : (q.type === "PE" ? q.strike > day.spot : q.strike < day.spot)
          ? "ITM"
          : "OTM",
  }));
}
export function select(day: Day, p: Plan) {
  const pool = day.quotes
    .filter(
      (q) =>
        q.expiry === p.expiry &&
        q.type === p.type &&
        q.volume >= p.minVolume &&
        q.oi >= p.minOI &&
        q.close > 0 &&
        (p.selection !== "fixed" || q.strike === Number(p.strike)),
    )
    .map((q) => ({ ...q, greeks: fit(q, day) }))
    .filter((q) => q.greeks);
  if (!pool.length) return null;
  if (p.selection === "fixed") return pool[0];
  if (p.selection === "directional" || p.selection === "half") {
    const target = p.selection === "half" ? 0.5 : 0.7,
      lo = target - 0.1,
      hi = target + 0.1;
    return (
      pool
        .filter(
          (q) =>
            Math.abs(q.greeks!.delta) >= lo - 1e-9 &&
            Math.abs(q.greeks!.delta) <= hi + 1e-9,
        )
        .sort(
          (a, b) =>
            Math.abs(Math.abs(a.greeks!.delta) - target) -
              Math.abs(Math.abs(b.greeks!.delta) - target) || a.close - b.close,
        )[0] || null
    );
  }
  const otm = p.selection === "otm2" ? 0.02 : 0.04,
    target = day.spot * (p.type === "PE" ? 1 - otm : 1 + otm);
  return pool.sort(
    (a, b) =>
      Math.abs(a.strike - target) - Math.abs(b.strike - target) ||
      a.strike - b.strike,
  )[0];
}
const key = (q: Quote) => `${q.expiry}|${q.strike}|${q.type}`;
export function runReplay(
  p: Plan,
  days: Day[],
  closed: string[] = [],
  observationDate?: string,
) {
  const err = validatePlan(p);
  if (err.length) return { status: "invalid_plan", message: err.join("; ") };
  if (p.mode === "cash")
    return {
      status: "no_trade",
      message:
        "Cash was explicitly selected. Zero option P&L; no conclusion about opportunity cost without outcome data.",
      netPnL: 0,
      netReturnPct: null,
      ledger: [],
    };
  const full = days.slice().sort((a, b) => a.date.localeCompare(b.date));
  const exitDate = effectiveExit(p.horizon, closed),
    end =
      observationDate && observationDate < exitDate
        ? observationDate
        : exitDate,
    now = end < exitDate;
  const allowed = full.filter((d) => d.date <= end),
    map = new Map(allowed.map((d) => [d.date, d]));
  if (end < p.windowStart)
    return {
      status: "awaiting_entry",
      message:
        "The planned entry window has not started at this observation date.",
    };
  let buffer = p.windowStart;
  for (let j = 0; j < 4; j++) buffer = previousSession(buffer, closed);
  const missing: string[] = [];
  for (let d = buffer; d <= end; d = addDays(d, 1))
    if (expectedSession(d, closed) && !map.has(d)) missing.push(d);
  if (missing.length)
    return {
      status: "insufficient_data",
      message: `Missing market sessions: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}. No trade outcome inferred.`,
      missing,
    };
  const dates = allowed.map((d) => d.date);
  let entry: Day | undefined,
    decision: Day | undefined,
    chosen: ReturnType<typeof select> = null;
  const candidates = allowed.filter(
    (d) => d.date >= p.windowStart && d.date <= p.windowEnd,
  );
  for (const d of candidates) {
    const i = dates.indexOf(d.date),
      prior = allowed[i - 1];
    if (!prior) continue;
    if (p.entryPolicy === "scheduled" || p.entryPolicy === "contrarian3") {
      if (p.entryPolicy === "contrarian3") {
        const old = allowed[i - 4];
        if (
          !old ||
          !(p.type === "PE" ? prior.spot > old.spot : prior.spot < old.spot)
        )
          continue;
      }
      entry = d;
      decision = prior;
      chosen = select(prior, p);
      break;
    }
    const old = allowed[i - 3];
    if (
      !old ||
      !(p.type === "PE" ? prior.spot < old.spot : prior.spot > old.spot)
    )
      continue;
    const q = select(prior, p);
    if (!q) continue;
    const oldQ = old.quotes.find((z) => key(z) === key(q));
    if (!oldQ || oldQ.close <= 0 || oldQ.volume <= 0 || q.close <= oldQ.close)
      continue;
    entry = d;
    decision = prior;
    chosen = q;
    break;
  }
  if (!entry)
    return {
      status: now && end < p.windowEnd ? "awaiting_entry" : "no_trade",
      message:
        now && end < p.windowEnd
          ? "No signal yet."
          : "No qualifying entry signal in the frozen window.",
      ledger: [],
    };
  if (!chosen || !decision)
    return {
      status: "no_trade",
      message:
        "No eligible contract on the selected prior session. No substitute or later retry.",
      entryDate: entry.date,
      ledger: [],
    };
  const actual = entry.quotes.find((q) => key(q) === key(chosen!)),
    cap = chosen.close * (1 + p.capPct / 100);
  if (!actual || actual.open <= 0 || actual.volume <= 0)
    return {
      status: "missing_execution",
      message:
        "No valid traded opening print for the selected contract; no synthetic fill.",
      entryDate: entry.date,
    };
  if (actual.open > cap + 1e-8)
    return {
      status: "no_fill",
      message:
        "Opening premium exceeded the frozen cap. No later fill assumed.",
      entryDate: entry.date,
      contract: chosen,
      observedOpen: actual.open,
      cap,
      ledger: [],
    };
  const units = actual.lot * p.lots,
    slip = p.slippagePct / 100,
    cash = actual.open * (1 + slip) * units + p.reserve,
    ledger: any[] = [];
  for (const d of allowed.filter(
    (d) => d.date >= entry!.date && d.date <= end,
  )) {
    const q = d.quotes.find((z) => key(z) === key(chosen!));
    if (!q || q.close <= 0 || q.volume <= 0) {
      ledger.push({ date: d.date, status: "missing_mark" });
      continue;
    }
    const net = q.close * (1 - slip) * units - cash;
    ledger.push({
      date: d.date,
      status: "observed",
      spot: d.spot,
      high: d.high,
      low: d.low,
      vix: d.vix,
      premium: q.close,
      netPnL: net,
      netReturnPct: (100 * net) / cash,
    });
  }
  if (p.management === "conditional") {
    const check = effectiveExit(p.followThroughDate, closed);
    const dead = ledger.find((z) => z.date === check);
    const earlierSignal = ledger.some(
      (z) =>
        z.status === "observed" &&
        z.date < check &&
        (z.netReturnPct >= p.profitPct || z.netReturnPct <= -p.lossPct),
    );
    if (
      check <= end &&
      check >= entry.date &&
      (!dead || dead.status === "missing_mark") &&
      !earlierSignal
    )
      return {
        status: "missing_mark",
        message:
          "The follow-through deadline has no valid premium mark; exit management is unresolved.",
        entryDate: entry.date,
        entryCash: cash,
        contract: chosen,
        units,
        ledger,
      };
  }
  let saleDate = exitDate,
    field: "open" | "close" = "close",
    signalDate: string | undefined,
    reason = "Planned time exit";
  if (p.management !== "fixed") {
    const tr = ledger.find(
      (z) =>
        z.status === "observed" &&
        z.date < exitDate &&
        (z.netReturnPct >= p.profitPct ||
          z.netReturnPct <= -p.lossPct ||
          (p.management === "conditional" &&
            z.date === effectiveExit(p.followThroughDate, closed) &&
            z.netReturnPct <= 0)),
    );
    if (tr) {
      signalDate = tr.date;
      const i = full.findIndex((d) => d.date === tr.date),
        next = full[i + 1];
      const expected = (() => {
        let d = addDays(tr.date, 1);
        while (!expectedSession(d, closed)) d = addDays(d, 1);
        return d;
      })();
      if (!next || next.date !== expected) {
        return {
          status: "awaiting_exit",
          message:
            "A close signal requires the next actual session opening print.",
          signalDate: tr.date,
          contract: chosen,
          entryDate: entry.date,
          entryPremium: actual.open,
          entryCash: cash,
          units,
          ledger,
        };
      }
      saleDate = next.date;
      field = "open";
      reason =
        tr.netReturnPct >= p.profitPct
          ? "Profit threshold"
          : tr.netReturnPct <= -p.lossPct
            ? "Loss threshold"
            : "No profitable follow-through";
    }
  }
  const holdingLedger = ledger.filter((x) =>
      field === "open" ? x.date < saleDate : x.date <= saleDate,
    ),
    observed = holdingLedger.filter((x) => x.status === "observed"),
    latest = observed[observed.length - 1],
    base = {
      contract: chosen,
      entryDate: entry.date,
      decisionDate: decision.date,
      entryPremium: actual.open,
      entryCash: cash,
      maxLoss: cash,
      units,
      signalDate,
      exitDate: saleDate,
      exitField: field,
      reason,
      ledger: holdingLedger,
    };
  if (saleDate > end)
    return {
      ...base,
      status: "open",
      message: "Position open at the selected observation date.",
      netPnL: latest?.netPnL,
      netReturnPct: latest?.netReturnPct,
    };
  const sale = map.get(saleDate)?.quotes.find((z) => key(z) === key(chosen!));
  if (!sale || sale[field] <= 0 || sale.volume <= 0)
    return {
      ...base,
      status: "missing_exit",
      message: "No valid exit print. No substitute or zero-price assumption.",
    };
  const net = sale[field] * (1 - slip) * units - cash;
  return {
    ...base,
    status: "completed",
    exitPremium: sale[field],
    grossPnL: (sale[field] - actual.open) * units,
    netPnL: net,
    netReturnPct: (100 * net) / cash,
    daysHeld: daysBetween(entry.date, saleDate),
  };
}
export function auditMilestones(p: Plan, days: Day[], closed: string[] = []) {
  const ds = days.slice().sort((a, b) => a.date.localeCompare(b.date)),
    claimed = new Map<string, string>();
  return p.milestones.map((date) => {
    const a = ds.findIndex((d) => d.date >= date);
    if (a < 0 || daysBetween(date, ds[a].date) > 5)
      return { date, status: "unavailable" };
    const offsets = [];
    for (let j = -3; j <= 3; j++) {
      const k = a + j;
      if (k < 1 || k >= ds.length) continue;
      const d = ds[k],
        old = ds[k - 1];
      if (daysBetween(old.date, d.date) > 5) continue;
      offsets.push({
        date: d.date,
        offset: j,
        returnPct: 100 * (d.spot / old.spot - 1),
        rangePct: d.high && d.low ? (100 * (d.high - d.low)) / old.spot : null,
      });
    }
    const match = offsets
      .filter((x) => (p.type === "PE" ? x.returnPct <= -1 : x.returnPct >= 1))
      .sort(
        (x, y) =>
          Math.abs(x.offset) - Math.abs(y.offset) ||
          x.date.localeCompare(y.date),
      )[0];
    const shared = match ? claimed.get(match.date) : null;
    if (match) claimed.set(match.date, date);
    return {
      date,
      session: ds[a].date,
      offsets,
      match: match || null,
      sharedWith: shared || null,
      status: "observed",
    };
  });
}
