import { proposal, type MacroRow } from "./desk.ts";
export type Milestone = MacroRow & {
  end?: string;
  endV?: number;
  read: string;
};
// A transparent selection of dates, not a forecast trained on outcomes.
export function macroMilestones(rows: MacroRow[]): Milestone[] {
  if (!rows.length) return [];
  const chosen = new Map<number, { read: string; end?: string }>();
  const add = (i: number, read: string, end?: string) => {
    if (i < 0 || i >= rows.length) return;
    const old = chosen.get(i);
    chosen.set(i, {
      read: old ? old.read + "; " + read : read,
      end: end || old?.end,
    });
  };
  const top = (key: "P" | "E" | "V", start = 0, end = rows.length) => {
    let best = start;
    for (let i = start; i < end; i++)
      if (rows[i][key] > rows[best][key]) best = i;
    return best;
  };
  add(
    0,
    rows[0].P > rows[0].E
      ? "Pressure already present; no obligation to buy"
      : rows[0].E > rows[0].P
        ? "Expansion present; avoid assuming an uninterrupted rise"
        : "Competing or quiet forces; direction unresolved",
  );
  // The lowest early pressure is a possible relief window; consecutive equal P/E scores form a window.
  const early = Math.min(rows.length, 22);
  let low = 0;
  for (let i = 1; i < early; i++) if (rows[i].P < rows[low].P) low = i;
  let lowEnd = low;
  while (
    lowEnd + 1 < early &&
    rows[lowEnd + 1].P === rows[low].P &&
    rows[lowEnd + 1].E === rows[low].E
  )
    lowEnd++;
  if (low > 0 && rows[low].P < rows[0].P)
    add(
      low,
      rows[low].E > rows[low].P
        ? "Pressure eases; expansion may support relief"
        : "Pressure eases; possible relief or consolidation",
      lowEnd > low ? rows[lowEnd].date : undefined,
    );
  // Identify an early pressure pulse and the strongest pressure date without averaging away interruptions.
  const peaks: number[] = [];
  for (let i = Math.max(1, lowEnd + 1); i < rows.length - 1; i++) {
    const before = rows.slice(Math.max(0, i - 3), i),
      after = rows.slice(i + 1, i + 4);
    if (
      rows[i].P > rows[i].E &&
      rows[i].P >= Math.max(...before.map((r) => r.P)) &&
      rows[i].P >= Math.max(...after.map((r) => r.P)) &&
      before.some((r) => r.P < rows[i].P) &&
      after.some((r) => r.P < rows[i].P) &&
      (!peaks.length || i - peaks.at(-1)! >= 5)
    )
      peaks.push(i);
  }
  const pressure = top("P"),
    volatility = top("V"),
    expansion = top("E");
  if (peaks.length && peaks[0] !== pressure)
    add(
      peaks[0],
      "First pressure milestone; a dip or sideways interruption is possible",
    );
  if (rows[pressure].P > 0 && pressure > 0)
    add(
      pressure,
      rows[pressure].P > rows[pressure].E
        ? "Strongest pressure milestone; downside or consolidation remains the working case"
        : "Pressure is high, but expansion competes",
    );
  if (volatility !== pressure && volatility > 0 && rows[volatility].V > 0)
    add(
      volatility,
      "Highest V score; allow for larger swings, not a direction by itself",
    );
  // First sustained expansion after the pressure crest, if present.
  const turn = rows.findIndex(
    (r, i) =>
      i > pressure &&
      r.E > r.P &&
      i + 1 < rows.length &&
      rows[i + 1].E > rows[i + 1].P,
  );
  if (turn >= 0)
    add(
      turn,
      "Expansion overtakes pressure for at least two days; review the downside case",
    );
  if (
    expansion > 0 &&
    rows[expansion].E > rows[expansion].P &&
    expansion !== turn
  )
    add(
      expansion,
      "Expansion-led milestone; a possible relief or upward phase",
    );
  const rebuild = rows.findIndex(
    (r, i) => i > lowEnd && lowEnd > 0 && r.P >= rows[low].P + 10 && r.P > r.E,
  );
  if (rebuild >= 0 && rebuild !== pressure && !chosen.has(rebuild))
    add(rebuild, "Pressure rebuilding after the quieter window");
  if (chosen.size < 8 && rows.length > 1)
    add(
      rows.length - 1,
      "End of the forward view; reassess rather than extend the same trade automatically",
    );
  return [...chosen]
    .sort((a, b) => a[0] - b[0])
    .map(([i, n]) => ({
      ...rows[i],
      ...n,
      ...(n.end ? { endV: rows.find((r) => r.date === n.end)?.V } : {}),
    }));
}
export function workingRead(rows: MacroRow[]) {
  const ms = macroMilestones(rows);
  if (!ms.length) return "Load the macro scores before forming a path.";
  const peak = rows.reduce((a, b) => (a.P >= b.P ? a : b)),
    e = rows.reduce((a, b) => (a.E >= b.E ? a : b));
  const relief = ms.find((r) => r.read.includes("Pressure eases"));
  const tail = rows.filter((r) => r.date > peak.date);
  const expansionLater = tail.some(
    (r, i) => r.E > r.P && tail[i + 1]?.E > tail[i + 1]?.P,
  );
  if (peak.P === 0 && e.E === 0)
    return "Pressure and expansion give no clear directional edge; waiting is a valid decision.";
  if (e.E > peak.P && e.E > e.P)
    return `Expansion has the stronger crest around ${e.date}; allow for pressure interruptions rather than assume a straight rise.`;
  return `${relief ? `Possible relief around ${relief.date}${relief.end ? "–" + relief.end : ""}, then pressure rebuilding` : "Pressure is the main force to investigate"}, with its strongest milestone on ${peak.date}. ${expansionLater ? "Later expansion may change the path; reassess before carrying a put further." : "A decline or sideways market are both plausible; pressure alone does not establish the size of a fall."}`;
}
export type Shortlisted = {
  q: any;
  role: string;
  why: string;
  preferred: boolean;
  side: "PE" | "CE";
};
export function optionShortlist(
  quotes: any[],
  rows: MacroRow[],
  cutoff: string,
): Shortlisted[] {
  const proposals = (["PE", "CE"] as const)
    .map((side) => proposal(rows, cutoff, side))
    .filter((p) => p !== null)
    .sort((a, b) => b!.strength - a!.strength);
  const output: Shortlisted[] = [];
  for (const p of proposals) {
    if (!p) continue;
    const dates = [
      ...new Set(
        quotes
          .filter(
            (q) =>
              q.type === p.side &&
              q.expiry > p.exit &&
              q.greeks &&
              q.volume >= 1000 &&
              q.oi >= 1000,
          )
          .map((q) => q.expiry),
      ),
    ].sort();
    if (!dates.length) continue;
    const pool = quotes.filter(
      (q) =>
        q.type === p.side &&
        q.greeks &&
        q.volume >= 1000 &&
        q.oi >= 1000 &&
        q.close > 0 &&
        q.expiry > p.exit,
    );
    const near = pool.filter((q) => q.expiry === dates[0]);
    const closest = (a: any[], target: number) =>
      a
        .filter(
          (q) =>
            Math.abs(q.greeks.delta) >= target - 0.1 &&
            Math.abs(q.greeks.delta) <= target + 0.1,
        )
        .sort(
          (a, b) =>
            Math.abs(Math.abs(a.greeks.delta) - target) -
              Math.abs(Math.abs(b.greeks.delta) - target) || a.close - b.close,
        )[0];
    const directional = closest(near, 0.7),
      half = closest(near, 0.5);
    const spot = near[0]?.referenceSpot; // optional provenance on normalized quotes
    const target = spot ? spot * (p.side === "PE" ? 0.98 : 1.02) : null;
    const cheaper = near
      .filter(
        (q) =>
          directional &&
          q.close < directional.close &&
          q.moneyness === "OTM" &&
          Math.abs(q.greeks.delta) >= 0.15 &&
          Math.abs(q.greeks.delta) <= 0.4,
      )
      .sort((a, b) =>
        target
          ? Math.abs(a.strike - target) - Math.abs(b.strike - target)
          : Math.abs(Math.abs(a.greeks.delta) - 0.3) -
            Math.abs(Math.abs(b.greeks.delta) - 0.3),
      )[0];
    const more = dates[1]
      ? closest(
          pool.filter((q) => q.expiry === dates[1]),
          0.5,
        )
      : null;
    const add = (q: any, role: string, why: string, preferred = false) => {
      if (q) output.push({ q, role, why, preferred, side: p.side });
    };
    add(
      directional,
      "Preferred directional exposure",
      "More responsive to the underlying move; larger cash outlay.",
      true,
    );
    add(
      half,
      "Balanced benchmark",
      "Less upfront cash than a higher-exposure contract, with a different decay trade-off.",
    );
    add(
      cheaper,
      "Smaller-premium alternative",
      "Lower cash at risk; needs a larger or faster favourable move.",
    );
    add(
      more,
      "Additional-time comparison",
      "More time beyond the planned exit; compare the extra premium rather than hold by default.",
    );
  }
  return output;
}
