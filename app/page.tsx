"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  api,
  readWorkspace,
  writeWorkspace,
  emptyWorkspace,
  download,
  type Workspace,
} from "@/lib/browser";
import {
  pathRead,
  proposal,
  candidateLabels,
  scenario,
  actionCue,
  deskPlan,
  type MacroRow,
} from "@/lib/desk";
import { macroMilestones, workingRead, optionShortlist } from "@/lib/brief";
import { addDays, validDate, daysBetween, digest } from "@/lib/research";
const number = (v: any, n = 0) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("en-IN", {
        minimumFractionDigits: n,
        maximumFractionDigits: n,
      })
    : "—";
const rupee = (v: any) =>
  typeof v === "number" && Number.isFinite(v)
    ? `${v < 0 ? "−" : ""}₹${number(Math.abs(v), 2)}`
    : "—";
const percent = (v: any) =>
  typeof v === "number" && Number.isFinite(v)
    ? `${v >= 0 ? "+" : ""}${number(v, 1)}%`
    : "—";
const contractKey = (q: any) => `${q.expiry}|${q.strike}|${q.type}`;
function F({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="desk-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function Desk() {
  const [tab, setTab] = useState("decision"),
    [cutoff, setCutoff] = useState("2024-07-15"),
    [store, setStore] = useState<Workspace>(emptyWorkspace),
    [ready, setReady] = useState(false),
    [view, setView] = useState<any>(null),
    [message, setMessage] = useState(""),
    [status, setStatus] = useState("Loading browser records…"),
    [busy, setBusy] = useState(false),
    [side, setSide] = useState("all"),
    [expiry, setExpiry] = useState(""),
    [onlyPicks, setOnlyPicks] = useState(false),
    [chosen, setChosen] = useState<any>(null),
    [buy, setBuy] = useState(""),
    [exit, setExit] = useState(""),
    [hypothesis, setHypothesis] = useState(""),
    [lots, setLots] = useState(1),
    [slip, setSlip] = useState(1),
    [reserve, setReserve] = useState(100),
    [buyPremium, setBuyPremium] = useState(""),
    [entryDate, setEntryDate] = useState(""),
    [actualLot, setActualLot] = useState(25),
    [positionId, setPositionId] = useState(""),
    [markDate, setMarkDate] = useState("2024-08-06"),
    [markPrice, setMarkPrice] = useState(""),
    [markSource, setMarkSource] = useState(""),
    [profit, setProfit] = useState(50),
    [loss, setLoss] = useState(40);
  const detail = useRef<HTMLElement>(null),
    restore = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("cutoff");
    if (d && validDate(d)) setCutoff(d);
    readWorkspace()
      .then((s) => {
        setStore({ ...emptyWorkspace, ...s });
        setReady(true);
      })
      .catch(() => {
        setStatus("Browser storage unavailable; use export");
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      writeWorkspace(store)
        .then(() => setStatus("Saved in this browser"))
        .catch(() => setStatus("Save failed — export a backup"));
    }, 250);
    return () => clearTimeout(timer);
  }, [store, ready]);
  useEffect(() => {
    if (!ready) return;
    let ignore = false;
    setView(null);
    setChosen(null);
    api("workspace", { cutoff, packs: store.packs })
      .then((x) => {
        if (!ignore) {
          setView(x);
          setExpiry("");
        }
      })
      .catch((e) => {
        if (!ignore) setMessage(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [cutoff, store.packs, ready]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const rows: MacroRow[] = (view?.macro || []).map((r: any) => ({
      date: r[0],
      P: r[1],
      E: r[2],
      V: r[3],
    })),
    path = workingRead(rows),
    snap = view?.snapshot,
    quotes: any[] = snap?.quotes || [],
    tags = candidateLabels(quotes, rows, cutoff),
    milestones = macroMilestones(rows),
    shortlist = optionShortlist(
      quotes.map((q) => ({ ...q, referenceSpot: snap?.spot })),
      rows,
      cutoff,
    );
  const visible = quotes
    .filter(
      (q) =>
        (side === "all" || q.type === side) &&
        (!expiry || q.expiry === expiry) &&
        q.volume >= 1000 &&
        q.oi >= 1000 &&
        (!onlyPicks || tags.has(contractKey(q))),
    )
    .sort(
      (a, b) =>
        Number(tags.has(contractKey(b))) - Number(tags.has(contractKey(a))) ||
        a.expiry.localeCompare(b.expiry) ||
        a.close * a.lot - b.close * b.lot,
    );
  const position =
      store.positions.find((p) => p.id === positionId) || store.positions[0],
    marks = position?.marks || [],
    latest = marks.length
      ? marks
          .slice()
          .sort(
            (a: any, b: any) =>
              a.date.localeCompare(b.date) || a.at.localeCompare(b.at),
          )
          .at(-1)
      : null,
    cue = position ? actionCue(position, latest) : null;
  function select(q: any) {
    const p = proposal(rows, cutoff, q.type);
    setChosen(q);
    setBuy(p?.buy || addDays(cutoff, 1));
    setExit(p?.exit || addDays(cutoff, 21));
    setEntryDate(p?.buy || addDays(cutoff, 1));
    setBuyPremium("");
    setActualLot(q.lot);
    setHypothesis(path);
    setTimeout(
      () =>
        detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }
  function backup() {
    download(
      "fin-lumen-workspace-backup.json",
      JSON.stringify(
        {
          format: "fin-lumen-workspace-1",
          exportedAt: new Date().toISOString(),
          ...store,
        },
        null,
        2,
      ),
    );
  }
  async function restoreBackup(f: File) {
    const x = JSON.parse(await f.text());
    if (x.format !== "fin-lumen-workspace-1")
      throw Error("Select a Fin-Lumen workspace backup");
    const merged: any = { ...store };
    for (const k of [
      "records",
      "positions",
      "packs",
      "quarters",
      "reveals",
      "notes",
    ] as const) {
      if (x[k] !== undefined && !Array.isArray(x[k]))
        throw Error(`Invalid ${k}`);
      const key = k === "packs" ? "name" : "id";
      const list = x[k] || [];
      for (const r of list) {
        if (!r || typeof r[key] !== "string") throw Error(`Invalid ${k} row`);
        const old = store[k].find((v: any) => v[key] === r[key]);
        if (old && JSON.stringify(old) !== JSON.stringify(r))
          throw Error(`Conflicting ${k} record; keep the original backup`);
      }
      merged[k] = [
        ...store[k],
        ...list.filter(
          (r: any) => !store[k].some((v: any) => v[key] === r[key]),
        ),
      ];
    }
    for (const r of [...merged.records, ...merged.quarters]) {
      const { hash, ...payload } = r;
      if ((await digest(payload)) !== hash)
        throw Error("A frozen record has an invalid hash");
    }
    await api("workspace", { cutoff, packs: merged.packs });
    setStore(merged);
    setMessage("Backup merged. Saved records retained.");
  }
  async function freeze() {
    if (!chosen) throw Error("Choose an option");
    const p = {
      ...deskPlan(chosen, cutoff, buy, exit, hypothesis),
      lots,
      slippagePct: slip,
      reserve,
      profitPct: profit,
      lossPct: loss,
    };
    const f = await api("freeze", { plan: p, packs: store.packs });
    setStore((s) => ({ ...s, records: [f, ...s.records] }));
    setMessage(
      "Plan frozen. Open Tests & data to reveal its replay. This did not record a purchase.",
    );
  }
  function addBought() {
    if (
      !chosen ||
      !validDate(entryDate) ||
      entryDate > chosen.expiry ||
      !(Number(buyPremium) > 0) ||
      !Number.isInteger(lots) ||
      lots < 1 ||
      !Number.isInteger(actualLot) ||
      actualLot < 1 ||
      !validDate(exit) ||
      exit < entryDate ||
      exit >= chosen.expiry
    )
      throw Error(
        "Enter a valid actual purchase date, positive paid premium, lots / dated lot size and an exit before expiry",
      );
    if (
      !Number.isFinite(slip) ||
      slip < 0 ||
      slip > 20 ||
      !Number.isFinite(reserve) ||
      reserve < 0 ||
      profit <= 0 ||
      loss <= 0 ||
      loss > 100
    )
      throw Error("Check costs and exit thresholds");
    const p = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      expiry: chosen.expiry,
      strike: chosen.strike,
      type: chosen.type,
      lot: actualLot,
      lots,
      entryDate,
      entryPremium: Number(buyPremium),
      exitDate: exit,
      slippagePct: slip,
      reserve,
      profitPct: profit,
      lossPct: loss,
      notes: hypothesis,
      marks: [],
      closed: false,
    };
    setStore((s) => ({ ...s, positions: [p, ...s.positions] }));
    setPositionId(p.id);
    setMarkDate(entryDate);
    setTab("monitor");
    setMessage(
      "Actual purchase recorded. Add a dated premium mark to assess it.",
    );
  }
  function saveMark(mark: any) {
    setStore((s) => ({
      ...s,
      positions: s.positions.map((p) =>
        p.id === position.id
          ? {
              ...p,
              marks: [...p.marks, { ...mark, at: new Date().toISOString() }],
            }
          : p,
      ),
    }));
  }
  return (
    <div className="desk">
      <header className="desk-header">
        <a className="desk-logo" href="/">
          fin-lumen <span>OPTIONS DESK</span>
        </a>
        <nav aria-label="Workspace">
          <button
            className={tab === "decision" ? "active" : ""}
            onClick={() => setTab("decision")}
          >
            Decision tables
          </button>
          <button
            className={tab === "monitor" ? "active" : ""}
            onClick={() => setTab("monitor")}
          >
            Bought options ({store.positions.filter((p) => !p.closed).length})
          </button>
          <a href="/research">Tests & data</a>
        </nav>
        <button onClick={backup} className="button ghost small">
          Export backup
        </button>
      </header>
      <main className="desk-main">
        <div className="desk-title">
          <div>
            <h1>
              {tab === "decision"
                ? "Our reading → options → plan"
                : "Bought-option monitoring"}
            </h1>
            <p>
              {tab === "decision"
                ? "Scores, choices and timing together. All values are dated."
                : "Observed premiums, remaining time and the rule behind each action."}
            </p>
          </div>
          <small>{status} · v0.3</small>
        </div>
        {message && (
          <div className="flash" role="status">
            <span>{message}</span>
            <button onClick={() => setMessage("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
        {tab === "decision" && (
          <>
            <section className="desk-card">
              <div className="desk-row">
                <h2>1. Market reference</h2>
                <F label="Assessment / information cutoff">
                  <input
                    type="date"
                    value={cutoff}
                    onChange={(e) => {
                      if (validDate(e.target.value)) setCutoff(e.target.value);
                    }}
                  />
                </F>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Market session</th>
                      <th>Nifty close</th>
                      <th>Macro view ends</th>
                      <th>Data basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{snap?.date || "No snapshot"}</td>
                      <td>{number(snap?.spot, 2)}</td>
                      <td>{addDays(cutoff, 74)}</td>
                      <td>Archived close · retrospective scores</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="desk-note">
                V is the Fin-Lumen macro volatility score. No later market
                prices are used on this page.
              </p>
            </section>
            <section className="desk-card brief-card">
              <div className="desk-row">
                <h2>2. Our working macro read</h2>
                <span>{rows.length} / 75 dates loaded</span>
              </div>
              <div className="path-line">
                <b>Working interpretation:</b> {path}
              </div>
              <div className="table-wrap">
                <table className="brief-table">
                  <thead>
                    <tr>
                      <th>Date / window</th>
                      <th>Pressure</th>
                      <th>Expansion</th>
                      <th>Macro V</th>
                      <th>What it may mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((r) => (
                      <tr key={r.date}>
                        <td>
                          {r.date}
                          {r.end ? " → " + r.end : ""}
                        </td>
                        <td>{number(r.P, 1)}</td>
                        <td>{number(r.E, 1)}</td>
                        <td>
                          {number(r.V, 1)}
                          {r.endV !== undefined && r.endV !== r.V
                            ? " → " + number(r.endV, 1)
                            : ""}
                        </td>
                        <td className="reading-cell">{r.read}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="desk-note">
                Key score dates, selected by explicit research rules. Timing may
                express early or late; a score peak is not a guaranteed price
                turning point.
              </p>
              <details className="supporting">
                <summary>See the full 75-day P / E / V table</summary>
                <div className="table-wrap full-macro">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Pressure</th>
                        <th>Expansion</th>
                        <th>Macro V</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.date}>
                          <td>{r.date}</td>
                          <td>{number(r.P, 1)}</td>
                          <td>{number(r.E, 1)}</td>
                          <td>{number(r.V, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className="desk-card">
              <div className="desk-row">
                <h2>3. Options worth investigating</h2>
              </div>
              <p className="brief-lead">
                {shortlist.find((r) => r.preferred) ? (
                  <>
                    My first comparison would be{" "}
                    <b>
                      {number(shortlist.find((r) => r.preferred)!.q.strike)}{" "}
                      {shortlist.find((r) => r.preferred)!.q.type} ·{" "}
                      {shortlist.find((r) => r.preferred)!.q.expiry}
                    </b>
                    , for directional exposure. The alternatives below show the
                    cash and time trade-offs.
                  </>
                ) : (
                  "No qualifying shortlist from the loaded data. Wait, or inspect alternatives below; missing data is not a no-trade conclusion."
                )}
              </p>
              <div className="table-wrap">
                <table className="brief-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Cutoff candidate</th>
                      <th>Premium</th>
                      <th>Cost / lot</th>
                      <th>Why consider it?</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shortlist.map((r, i) => (
                      <tr
                        key={i}
                        className={r.preferred ? "candidate-direction" : ""}
                      >
                        <td>{r.role}</td>
                        <td>
                          <b>
                            {number(r.q.strike)} {r.q.type}
                          </b>
                          <small>{r.q.expiry}</small>
                        </td>
                        <td>{rupee(r.q.close)}</td>
                        <td>
                          {rupee(r.q.close * r.q.lot)}
                          <small>{r.q.lot} units · before costs</small>
                        </td>
                        <td className="reading-cell">{r.why}</td>
                        <td>
                          <button
                            className="button ghost small"
                            onClick={() => select(r.q)}
                          >
                            Work out this plan ↓
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="desk-note">
                Reference closing prices as of {snap?.date || "the cutoff"}; not
                executable offers. “Preferred” is an exploratory role choice,
                not a calibrated profit probability.
              </p>
              <details className="supporting">
                <summary>
                  See all available calls and puts, with filters and liquidity
                  details
                </summary>
                <div className="desk-filters">
                  <select
                    aria-label="Option side"
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                  >
                    <option value="all">Calls & puts</option>
                    <option value="CE">Calls</option>
                    <option value="PE">Puts</option>
                  </select>
                  <select
                    aria-label="Expiry"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    <option value="">All expiries</option>
                    {[...new Set(quotes.map((q) => q.expiry))]
                      .sort()
                      .map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                  </select>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={onlyPicks}
                      onChange={(e) => setOnlyPicks(e.target.checked)}
                    />
                    Candidates only
                  </label>
                </div>

                <p className="desk-note">
                  Highlighted candidates:{" "}
                  <b className="pick-low">lowest cash</b> ·{" "}
                  <b className="pick-direction">directional exposure</b> ·{" "}
                  <b className="pick-time">more time</b>. These are provisional
                  comparison rules, not proven “best buys”. Volume / OI ≥1,000
                  screen liquidity only. Untick “Candidates only” to see every
                  loaded contract meeting those filters.
                </p>
                <div className="table-wrap option-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Option</th>
                        <th>Expiry</th>
                        <th>Premium close</th>
                        <th>Cash / lot</th>
                        <th>Lot</th>
                        <th>Volume</th>
                        <th>OI</th>
                        <th>Reason to compare</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((q) => {
                        const labels = tags.get(contractKey(q)) || [];
                        return (
                          <tr
                            key={contractKey(q)}
                            className={
                              chosen && contractKey(chosen) === contractKey(q)
                                ? "chosen"
                                : labels.includes("Directional")
                                  ? "candidate-direction"
                                  : labels.includes("More time")
                                    ? "candidate-time"
                                    : labels.length
                                      ? "candidate-low"
                                      : ""
                            }
                          >
                            <td>
                              <b>
                                {number(q.strike)} {q.type}
                              </b>
                              <small>{q.moneyness}</small>
                            </td>
                            <td>{q.expiry}</td>
                            <td>{number(q.close, 2)}</td>
                            <td>{rupee(q.close * q.lot)}</td>
                            <td>{q.lot}</td>
                            <td>{number(q.volume)}</td>
                            <td>{number(q.oi)}</td>
                            <td>{labels.join(" · ") || "Alternative"}</td>
                            <td>
                              <button
                                disabled={!q.greeks}
                                className="button ghost small"
                                onClick={() => select(q)}
                              >
                                View plan ↓
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!visible.length && (
                  <p className="desk-empty">
                    {!view
                      ? "Loading the dated data…"
                      : !snap
                        ? "No option data for this cutoff. Import the relevant quarter in Tests & data."
                        : onlyPicks
                          ? "No candidate meets the macro, expiry and liquidity rules. Waiting is valid; untick the filter to inspect alternatives."
                          : "No contracts meet these filters."}
                  </p>
                )}
              </details>
            </section>
            <section ref={detail} className="desk-card detail-card">
              <h2>
                4.{" "}
                {chosen
                  ? `${number(chosen.strike)} ${chosen.type} · ${chosen.expiry}`
                  : "The worked plan"}
              </h2>
              {chosen ? (
                <>
                  <p className="brief-lead">
                    Investigate{" "}
                    <b>
                      {number(chosen.strike)} {chosen.type}
                    </b>{" "}
                    for the{" "}
                    {proposal(rows, cutoff, chosen.type)?.peak || "selected"}{" "}
                    macro milestone. The next decision is whether the entry-day
                    price meets the plan—not whether to buy immediately.
                  </p>
                  <div className="table-wrap">
                    <table className="brief-table plan-brief">
                      <thead>
                        <tr>
                          <th>Decision</th>
                          <th>Worked proposal</th>
                          <th>Condition / reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Buy timing</td>
                          <td>{buy}</td>
                          <td className="reading-cell">
                            Tentative early-entry date. Check the actual
                            prior-session premium and liquidity; skip if the
                            opening price is more than 5% above that close.
                          </td>
                        </tr>
                        <tr>
                          <td>Cash to allow</td>
                          <td>
                            {rupee(
                              chosen.close *
                                (1 + slip / 100) *
                                chosen.lot *
                                lots +
                                reserve,
                            )}
                            <small>
                              {lots} lot(s) × {chosen.lot} units
                            </small>
                          </td>
                          <td className="reading-cell">
                            Based on the {snap.date} premium of{" "}
                            {rupee(chosen.close)}, plus configured slippage and
                            costs. Future entry cash is unknown.
                          </td>
                        </tr>
                        <tr>
                          <td>Exit timing</td>
                          <td>By {exit}</td>
                          <td className="reading-cell">
                            Earlier if the net +{profit}% profit or −{loss}%
                            loss rule signals an exit. Daily replay uses the
                            next opening print, which may gap.
                          </td>
                        </tr>
                        <tr>
                          <td>If it does not qualify</td>
                          <td>Wait / skip</td>
                          <td className="reading-cell">
                            No chasing a missed entry and no automatic
                            extension. The entire premium and entry costs can be
                            lost.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <h3>Three worked price examples at the proposed exit</h3>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>If Nifty is…</th>
                          <th>Illustrative option premium</th>
                          <th>Net P&L from reference entry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[-1, 0, 1].map((move) => {
                          const s = validDate(exit)
                            ? scenario(
                                chosen,
                                snap.spot,
                                snap.date,
                                exit,
                                move,
                                0,
                                lots,
                                slip,
                                reserve,
                              )
                            : null;
                          return (
                            <tr key={move}>
                              <td>
                                {number(s?.spot, 2)}
                                <small>
                                  {move > 0 ? "+" : ""}
                                  {move}% from cutoff
                                </small>
                              </td>
                              <td>{rupee(s?.premium)}</td>
                              <td
                                className={
                                  (s?.net || 0) < 0 ? "negative" : "positive"
                                }
                              >
                                {rupee(s?.net)}
                                <small>{percent(s?.returnPct)}</small>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="desk-note">
                    Examples, not targets or probability forecasts. They assume
                    entry at the cutoff close plus costs and hold other fitted
                    pricing inputs constant. Timing presets remain experimental.
                  </p>
                  <div className="desk-row">
                    <button
                      disabled={busy || !ready}
                      className="button primary"
                      onClick={() => run(freeze)}
                    >
                      Save this plan before the outcome
                    </button>
                    <span>No order is placed.</span>
                  </div>
                  <details className="supporting">
                    <summary>Adjust dates, size, costs or exit rules</summary>
                    <div className="desk-form">
                      <F label="Proposed buy date">
                        <input
                          type="date"
                          value={buy}
                          onChange={(e) => setBuy(e.target.value)}
                        />
                      </F>
                      <F label="Final exit date">
                        <input
                          type="date"
                          value={exit}
                          onChange={(e) => setExit(e.target.value)}
                        />
                      </F>
                      <F label="Lots">
                        <input
                          type="number"
                          min="1"
                          value={lots}
                          onChange={(e) => setLots(Number(e.target.value))}
                        />
                      </F>
                      <F label="Adverse slippage each side (%)">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={slip}
                          onChange={(e) => setSlip(Number(e.target.value))}
                        />
                      </F>
                      <F label="Total cost reserve (₹)">
                        <input
                          type="number"
                          min="0"
                          value={reserve}
                          onChange={(e) => setReserve(Number(e.target.value))}
                        />
                      </F>
                      <F label="Profit exit signal (%)">
                        <input
                          type="number"
                          min="1"
                          value={profit}
                          onChange={(e) => setProfit(Number(e.target.value))}
                        />
                      </F>
                      <F label="Loss exit signal (%)">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={loss}
                          onChange={(e) => setLoss(Number(e.target.value))}
                        />
                      </F>
                    </div>
                    <F label="Path and entry / exit conditions">
                      <textarea
                        rows={2}
                        value={hypothesis}
                        onChange={(e) => setHypothesis(e.target.value)}
                      />
                    </F>
                  </details>
                  <details className="purchase-details">
                    <summary>
                      I bought this option — record the actual fill
                    </summary>
                    <div className="desk-form">
                      <F label="Actual purchase date">
                        <input
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                        />
                      </F>
                      <F label="Premium actually paid per unit (₹)">
                        <input
                          type="number"
                          min="0.01"
                          step="0.05"
                          value={buyPremium}
                          onChange={(e) => setBuyPremium(e.target.value)}
                        />
                      </F>
                      <F label="Actual dated lot size">
                        <input
                          type="number"
                          min="1"
                          value={actualLot}
                          onChange={(e) => setActualLot(Number(e.target.value))}
                        />
                      </F>
                      <div>
                        <p className="desk-note">
                          Uses {lots} lot(s), the time exit above and configured
                          costs / thresholds.
                        </p>
                        <button
                          disabled={busy || !buyPremium || !ready}
                          className="button primary"
                          onClick={() => run(async () => addBought())}
                        >
                          Add to bought-option monitor
                        </button>
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                <p className="desk-empty">
                  Choose a shortlisted option above. Its timing, cash
                  requirement and exit conditions will appear here.
                </p>
              )}
            </section>
          </>
        )}
        {tab === "monitor" && (
          <>
            <section className="desk-card">
              <div className="desk-row">
                <h2>Your recorded purchases</h2>
                <span>
                  Manual updates / archived observations · no live feed
                  connected
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Expiry</th>
                      <th>Bought</th>
                      <th>Paid</th>
                      <th>Units</th>
                      <th>Planned exit</th>
                      <th>Latest mark</th>
                      <th>Net marked P&L</th>
                      <th>Action cue</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {store.positions.map((p) => {
                      const m = p.marks
                          .slice()
                          .sort(
                            (a: any, b: any) =>
                              a.date.localeCompare(b.date) ||
                              a.at.localeCompare(b.at),
                          )
                          .at(-1),
                        c = actionCue(p, m);
                      return (
                        <tr
                          key={p.id}
                          className={p.id === position?.id ? "chosen" : ""}
                        >
                          <td>
                            {number(p.strike)} {p.type}
                          </td>
                          <td>{p.expiry}</td>
                          <td>{p.entryDate}</td>
                          <td>{rupee(p.entryPremium)}</td>
                          <td>{p.lot * p.lots}</td>
                          <td>{p.exitDate}</td>
                          <td>
                            {rupee(m?.premium)}
                            <small>
                              {m?.date || "No mark"} · {m?.source || "—"}
                            </small>
                          </td>
                          <td>
                            {rupee(c.net)}
                            <small>{percent(c.ret)}</small>
                          </td>
                          <td>
                            <span className={"action " + c.tone}>{c.text}</span>
                          </td>
                          <td>
                            <button
                              className="button ghost small"
                              onClick={() => {
                                setPositionId(p.id);
                                setMarkDate(p.entryDate);
                                setMarkPrice("");
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!store.positions.length && (
                <p className="desk-empty">
                  Record an actual option purchase in the decision table. Frozen
                  hypothetical plans remain in Tests & data.
                </p>
              )}
            </section>
            {position && (
              <section className="desk-card">
                <h2>
                  {number(position.strike)} {position.type} · update and inspect
                </h2>
                <div className="desk-form">
                  <F label="Observed quote date">
                    <input
                      type="date"
                      min={position.entryDate}
                      max={position.expiry}
                      value={markDate}
                      onChange={(e) => setMarkDate(e.target.value)}
                    />
                  </F>
                  <F label="Observed premium (₹ per unit)">
                    <input
                      type="number"
                      min="0"
                      step="0.05"
                      value={markPrice}
                      onChange={(e) => setMarkPrice(e.target.value)}
                    />
                  </F>
                  <F label="Source / timestamp / note">
                    <input
                      value={markSource}
                      onChange={(e) => setMarkSource(e.target.value)}
                      placeholder="Broker quote, 14:32 IST"
                    />
                  </F>
                  <div className="desk-update-buttons">
                    <button
                      className="button primary"
                      disabled={busy || !markPrice || !markSource.trim()}
                      onClick={() =>
                        run(async () => {
                          if (
                            !validDate(markDate) ||
                            markDate < position.entryDate ||
                            markDate > position.expiry ||
                            !Number.isFinite(Number(markPrice)) ||
                            Number(markPrice) < 0
                          )
                            throw Error(
                              "Use a valid observed date and nonnegative actual premium",
                            );
                          saveMark({
                            date: markDate,
                            premium: Number(markPrice),
                            source: markSource.trim(),
                            kind: "manual",
                          });
                          setMessage(
                            "Observed mark saved. The cue is based on this mark, not an automatic live feed.",
                          );
                        })
                      }
                    >
                      Save observed mark
                    </button>
                    <button
                      className="button ghost"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (
                            markDate < position.entryDate ||
                            markDate > position.expiry
                          )
                            throw Error(
                              "Choose a date during the position’s life",
                            );
                          const x = await api("mark", {
                            packs: store.packs,
                            date: markDate,
                            expiry: position.expiry,
                            strike: position.strike,
                            type: position.type,
                          });
                          if (!x.mark) throw Error(x.message);
                          if (x.mark.date < position.entryDate)
                            throw Error(
                              "Archived quote predates this purchase",
                            );
                          saveMark(x.mark);
                          setMessage(
                            `Archived close saved for ${x.mark.date}. It is not a live quote.`,
                          );
                        })
                      }
                    >
                      Fetch archived close
                    </button>
                  </div>
                </div>
                <div className={"desk-action " + cue?.tone}>
                  <b>{cue?.text}</b>
                  <span>{cue?.reason}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Observation date</th>
                        <th>Premium</th>
                        <th>Net marked P&L</th>
                        <th>Net return</th>
                        <th>Days to exit</th>
                        <th>Days to expiry</th>
                        <th>Profit / loss signals</th>
                        <th>Probability of recovery</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{latest?.date || "—"}</td>
                        <td>{rupee(latest?.premium)}</td>
                        <td>{rupee(cue?.net)}</td>
                        <td>{percent(cue?.ret)}</td>
                        <td>
                          {latest
                            ? daysBetween(latest.date, position.exitDate)
                            : "—"}
                        </td>
                        <td>
                          {latest
                            ? daysBetween(latest.date, position.expiry)
                            : "—"}
                        </td>
                        <td>
                          +{position.profitPct}% / −{position.lossPct}%
                        </td>
                        <td>Not calibrated</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="desk-note">
                  Action cues use the selected mark’s date and the written time
                  / profit / loss rules. A historical mark must not be
                  interpreted as today’s price or today’s advice. Marks include
                  a source and saved timestamp; exits still require a real fill.
                  Closing a record does not calculate realised P&L.
                </p>
                <details>
                  <summary>
                    All saved premium observations ({marks.length})
                  </summary>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Quote date</th>
                          <th>Premium</th>
                          <th>Source</th>
                          <th>Saved at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {marks
                          .slice()
                          .reverse()
                          .map((m: any, i: number) => (
                            <tr key={i}>
                              <td>{m.date}</td>
                              <td>{rupee(m.premium)}</td>
                              <td>{m.source}</td>
                              <td>{m.at}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <button
                  className="button ghost small"
                  onClick={() =>
                    setStore((s) => ({
                      ...s,
                      positions: s.positions.map((p) =>
                        p.id === position.id ? { ...p, closed: !p.closed } : p,
                      ),
                    }))
                  }
                >
                  {position.closed
                    ? "Reopen tracking record"
                    : "Mark tracking record closed"}
                </button>
              </section>
            )}
          </>
        )}
        <footer className="desk-footer">
          <span>
            Purchase only · research presets, not calibrated probabilities
          </span>
          <div>
            <a href="/research">Tests, frozen plans & data imports</a>
            <button
              className="link-button"
              onClick={() => restore.current?.click()}
            >
              Restore backup
            </button>
          </div>
        </footer>
        <input
          ref={restore}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) run(() => restoreBackup(f));
          }}
        />
        {busy && (
          <div className="busy" role="status">
            Updating…
          </div>
        )}
      </main>
    </div>
  );
}
