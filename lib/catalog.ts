import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  addDays,
  validDate,
  digest,
  stableJSON,
  ENGINE_VERSION,
  type Day,
  type Plan,
} from "./research";
const raw = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data/archive.json"), "utf8"),
);
export const studies = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data/studies.json"), "utf8"),
);
export const meta = raw.meta;
const columns = [
  "expiry",
  "strike",
  "type",
  "open",
  "close",
  "volume",
  "oi",
  "lot",
];
const baseDays: Day[] = raw.days.map((d: any) => ({
  ...d,
  quotes: d.quotes.map((q: any[]) =>
    Object.fromEntries(columns.map((k, i) => [k, q[i]])),
  ),
}));
export type Pack = {
  name: string;
  source: string;
  macroVersion: string;
  macro?: [string, number, number, number][];
  days?: Day[];
  closed?: string[];
};
export function validatePack(p: any): string[] {
  const e: string[] = [];
  if (!p || typeof p !== "object") return ["Dataset must be an object"];
  if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 160)
    e.push("Name required (160 characters maximum)");
  if (typeof p.source !== "string" || !p.source.trim())
    e.push("Source / provenance required");
  if (p.macroVersion !== ENGINE_VERSION)
    e.push(
      `Use macroVersion ${ENGINE_VERSION}; model versions cannot be mixed`,
    );
  if (
    !Array.isArray(p.days || []) ||
    !Array.isArray(p.macro || []) ||
    !Array.isArray(p.closed || [])
  )
    return [...e, "days, macro and closed must be arrays"];
  if ((p.days?.length || 0) > 300 || (p.macro?.length || 0) > 1200)
    e.push("Import at most 300 market sessions / 1,200 macro days per pack");
  for (const d of p.days || []) {
    if (
      !validDate(d.date) ||
      !Number.isFinite(d.spot) ||
      d.spot <= 0 ||
      !d.futures ||
      !Array.isArray(d.quotes)
    ) {
      e.push("Invalid market day");
      break;
    }
    if (
      [d.open, d.high, d.low, d.vix].some(
        (x) => x !== undefined && (!Number.isFinite(x) || x <= 0),
      )
    ) {
      e.push(`Invalid market value on ${d.date}`);
      break;
    }
    if (
      Object.entries(d.futures).some(
        ([k, v]) => !validDate(k) || !Number.isFinite(v) || Number(v) <= 0,
      )
    ) {
      e.push("Invalid expiry futures");
      break;
    }
    const keys = new Set();
    for (const q of d.quotes) {
      const key = [q.expiry, q.strike, q.type].join("|");
      if (
        keys.has(key) ||
        !validDate(q.expiry) ||
        q.expiry <= d.date ||
        !["CE", "PE"].includes(q.type) ||
        !Number.isInteger(q.lot) ||
        q.lot < 1 ||
        !Number.isFinite(q.strike) ||
        q.strike <= 0 ||
        ["open", "close", "volume", "oi"].some(
          (k) => !Number.isFinite(q[k]) || q[k] < 0,
        )
      ) {
        e.push(`Invalid or duplicate option on ${d.date}`);
        break;
      }
      keys.add(key);
    }
  }
  for (const m of p.macro || [])
    if (
      !Array.isArray(m) ||
      m.length !== 4 ||
      !validDate(m[0]) ||
      m.slice(1).some((v: any) => !Number.isFinite(v) || v < 0)
    ) {
      e.push("Macro rows must be [ISO date, P, E, V] with nonnegative scores");
      break;
    }
  if ((p.closed || []).some((d: any) => !validDate(d)))
    e.push("Invalid closed-session date");
  for (const a of [
    p.days?.map((d: any) => d.date) || [],
    p.macro?.map((d: any) => d[0]) || [],
    p.closed || [],
  ])
    if (new Set(a).size !== a.length) e.push("Duplicate dates within pack");
  if (!(p.days?.length || p.macro?.length || p.closed?.length))
    e.push("Dataset is empty");
  return e.slice(0, 8);
}
export function dataset(packs: Pack[] = []) {
  if (!Array.isArray(packs) || packs.length > 20)
    throw Error("Use up to 20 dataset packs");
  const days = new Map(baseDays.map((d) => [d.date, structuredClone(d)]));
  const macro = new Map<string, [string, number, number, number]>(
    raw.macro.map((m: any) => [m[0], m]),
  );
  const closed = new Set<string>();
  for (const p of packs) {
    const e = validatePack(p);
    if (e.length) throw Error(e.join("; "));
    for (const d of p.days || []) {
      const old = days.get(d.date);
      if (old) {
        for (const k of ["spot", "open", "high", "low", "vix"] as const) {
          if (old[k] !== undefined && d[k] !== undefined && old[k] !== d[k])
            throw Error(`Conflicting ${k} on ${d.date}`);
          if (old[k] === undefined && d[k] !== undefined)
            (old as any)[k] = d[k];
        }
        for (const [expiry, f] of Object.entries(d.futures)) {
          if (old.futures[expiry] !== undefined && old.futures[expiry] !== f)
            throw Error(`Conflicting futures on ${d.date}`);
          old.futures[expiry] = f;
        }
        for (const q of d.quotes) {
          const oq = old.quotes.find(
            (x) =>
              x.expiry === q.expiry &&
              x.strike === q.strike &&
              x.type === q.type,
          );
          if (oq && stableJSON(oq) !== stableJSON(q))
            throw Error(`Conflicting option on ${d.date}`);
          if (!oq) old.quotes.push(q);
        }
      } else days.set(d.date, structuredClone(d));
    }
    for (const m of p.macro || []) {
      if (macro.has(m[0]) && stableJSON(macro.get(m[0])) !== stableJSON(m))
        throw Error(`Conflicting macro on ${m[0]}`);
      macro.set(m[0], m);
    }
    for (const d of p.closed || []) closed.add(d);
  }
  return {
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    macro: [...macro.values()].sort((a, b) => a[0].localeCompare(b[0])),
    closed: [...closed].sort(),
  };
}
export async function inputDigest(p: Plan, data: ReturnType<typeof dataset>) {
  return digest({
    archive: meta.version,
    macroVersion: ENGINE_VERSION,
    days: data.days
      .filter((d) => d.date <= p.cutoff)
      .map((d) => ({
        ...d,
        quotes: d.quotes
          .slice()
          .sort((a, b) =>
            [a.expiry, a.strike, a.type]
              .join("|")
              .localeCompare([b.expiry, b.strike, b.type].join("|")),
          ),
      })),
    macro: data.macro.filter(
      (m) => m[0] >= p.cutoff && m[0] <= addDays(p.cutoff, 74),
    ),
    closed: data.closed.filter((d) => d <= addDays(p.horizon, 7)),
  });
}
