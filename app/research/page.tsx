"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Database,
  Download,
  Eye,
  FileLock2,
  FlaskConical,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Upload,
  X,
} from "lucide-react";
import {
  addDays,
  daysBetween,
  quarterOf,
  quarterEnd,
  quarterReviews,
  ENGINE_VERSION,
  RULE_ENGINE,
  price,
  validatePlan,
  digest,
  validDate,
  type Plan,
} from "@/lib/research";
import {
  api,
  csv,
  download,
  readWorkspace,
  writeWorkspace,
  emptyWorkspace,
  type Workspace,
} from "@/lib/browser";
const fmt = (n: any, d = 0) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("en-IN", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })
    : "—";
const money = (n: any) =>
  typeof n === "number" && Number.isFinite(n)
    ? `${n < 0 ? "−" : ""}₹${fmt(Math.abs(n), 2)}`
    : "—";
const pc = (n: any) =>
  typeof n === "number" && Number.isFinite(n)
    ? `${n >= 0 ? "+" : ""}${fmt(n, 1)}%`
    : "—";
const date = (d: string) =>
  d
    ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
const tabs = [
  ["path", "Macro path", Activity],
  ["options", "Options lab", Layers3],
  ["plans", "Plan vault", FileLock2],
  ["monitor", "Monitoring", Clock],
  ["replay", "Replay & studies", FlaskConical],
  ["quarters", "Quarterly tests", LayoutDashboard],
  ["data", "Data & notebook", Database],
] as const;
const titles: Record<string, [string, string]> = {
  path: [
    "Read the path. Plan the trade.",
    "A 75-day view of pressure, expansion and volatility.",
  ],
  options: [
    "Find the right expression.",
    "Compare cash outlay, exposure and time before choosing a contract.",
  ],
  plans: [
    "Make the decision reviewable.",
    "Write the hypothesis and rules before revealing the outcome.",
  ],
  monitor: [
    "Give every position a clock.",
    "Historical monitoring at the observation date you select.",
  ],
  replay: [
    "Measure what actually happened.",
    "Keep the original forecast, losing trades and missed fills in view.",
  ],
  quarters: [
    "One quarter at a time.",
    "Chronological testing with separate trading outcomes and a fixed rule profile.",
  ],
  data: [
    "Know what the evidence contains.",
    "Data coverage, import controls, provenance and research notes.",
  ],
};
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"field " + (wide ? "wide" : "")}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <Target size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function NumberTable({
  rows,
  series,
}: {
  rows: any[];
  series: { key: string; color: string; label: string }[];
  height?: number;
}) {
  if (!rows.length)
    return (
      <Empty title="No observations available">
        Load the corresponding data to populate this table.
      </Empty>
    );
  return (
    <div className="table-wrap scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.date || i}>
              <td>{r.date}</td>
              {series.map((s) => (
                <td key={s.key}>{fmt(r[s.key], 2)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function initialPlan(cutoff = "2024-07-15"): Plan {
  return {
    name: "August pressure — September put comparison",
    cutoff,
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
    bias: "Undecided — review the daily path",
    notes:
      "Development example from the previously discussed August 2024 comparison. Write the directional, sideways and invalidation cases before freezing a new version.",
    milestones: ["2024-08-19"],
    strictQuarter: true,
    ruleVersion: "Research rules v0.1",
  };
}
export default function Workbench() {
  const [tab, setTab] = useState("replay"),
    [menu, setMenu] = useState(false),
    [cutoff, setCutoff] = useState("2024-07-15"),
    [boot, setBoot] = useState<any>(null),
    [view, setView] = useState<any>(null),
    [store, setStore] = useState<Workspace>(emptyWorkspace),
    [ready, setReady] = useState(false),
    [saved, setSaved] = useState("Loading browser records…"),
    [flash, setFlash] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [draft, setDraft] = useState<Plan>(initialPlan()),
    [active, setActive] = useState(""),
    [observation, setObservation] = useState("2024-08-06"),
    [result, setResult] = useState<any>(null),
    [resultId, setResultId] = useState(""),
    [optionType, setOptionType] = useState("PE"),
    [expiryFilter, setExpiryFilter] = useState(""),
    [sort, setSort] = useState("cost"),
    [selectedQuote, setSelectedQuote] = useState<any>(null),
    [spotChange, setSpotChange] = useState(2),
    [ivChange, setIvChange] = useState(0),
    [scenarioDate, setScenarioDate] = useState("2024-08-20"),
    [showDaily, setShowDaily] = useState(false),
    [studyId, setStudyId] = useState(""),
    [study, setStudy] = useState<any>(null),
    [studyFilter, setStudyFilter] = useState(""),
    [studyPage, setStudyPage] = useState(0),
    [quarter, setQuarter] = useState("2018-Q1"),
    [note, setNote] = useState(""),
    [noteKind, setNoteKind] = useState("Research"),
    [milestoneText, setMilestoneText] = useState("2024-08-19");
  const restoreRef = useRef<HTMLInputElement>(null),
    packRef = useRef<HTMLInputElement>(null);
  const current = store.records.find((x) => x.id === active),
    qprofile = store.quarters.find((x) => x.quarter === quarter);
  useEffect(() => {
    fetch("/api/research")
      .then((r) => r.json())
      .then(setBoot)
      .catch((e) => setFlash(e.message));
    readWorkspace()
      .then((w) => {
        setStore({ ...emptyWorkspace, ...w });
        setActive(w.records?.[0]?.id || "");
        setReady(true);
      })
      .catch(() => {
        setSaved(
          "Browser storage unavailable. Use export to retain your work.",
        );
        setReady(true);
      });
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaved("Saving…");
    const timer = setTimeout(() => {
      writeWorkspace(store)
        .then(() => setSaved("Saved in this browser"))
        .catch(() => setSaved("Save failed — export a backup now"));
    }, 350);
    return () => clearTimeout(timer);
  }, [store, ready]);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    setView(null);
    setSelectedQuote(null);
    api("workspace", { cutoff, packs: store.packs })
      .then((v) => {
        if (!cancelled) {
          setView(v);
          setExpiryFilter("");
        }
      })
      .catch((e) => {
        if (!cancelled) setFlash(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cutoff, store.packs, ready]);
  const notify = (s: string) => setFlash(s);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const put = (k: keyof Plan, v: any) => setDraft((p) => ({ ...p, [k]: v }));
  function changeCutoff(d: string) {
    if (!validDate(d)) return;
    setCutoff(d);
    setDraft((p) => ({
      ...p,
      cutoff: d,
      name: `${quarterOf(addDays(d, 17))} path assessment`,
      windowStart: addDays(d, 17),
      windowEnd: addDays(d, 17),
      horizon: addDays(d, 36),
      followThroughDate: addDays(d, 25),
      milestones: [],
    }));
    setMilestoneText("");
    setResult(null);
  }
  function backup() {
    download(
      `fin-lumen-backup-${new Date().toISOString().slice(0, 10)}.json`,
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
    notify(
      "Backup exported. It includes frozen plans, dataset packs, reveal logs and notes. The editable draft is not a frozen record.",
    );
  }
  async function restore(file: File) {
    if (file.size > 15_000_000) throw Error("Backup exceeds 15 MB");
    const x = JSON.parse(await file.text());
    if (
      x.format !== "fin-lumen-workspace-1" ||
      !["records", "packs", "quarters", "reveals", "notes"].every((k) =>
        Array.isArray(x[k]),
      )
    )
      throw Error("Not a Fin-Lumen workspace backup");
    for (const r of [...x.records, ...x.quarters]) {
      const { hash, ...payload } = r;
      if ((await digest(payload)) !== hash)
        throw Error("A frozen record has an invalid hash");
    }
    await api("workspace", {
      cutoff,
      packs: merge(store.packs, x.packs, "name"),
    });
    setStore({
      ...store,
      records: merge(store.records, x.records),
      positions: merge(store.positions, x.positions || []),
      packs: merge(store.packs, x.packs, "name"),
      quarters: merge(store.quarters, x.quarters),
      reveals: merge(store.reveals, x.reveals),
      notes: merge(store.notes, x.notes),
    });
    notify("Backup merged. Existing records were preserved.");
  }
  function merge(a: any[], b: any[], key = "id") {
    for (const x of b) {
      if (!x || typeof x[key] !== "string")
        throw Error("Invalid backup record");
      const old = a.find((y) => y[key] === x[key]);
      if (old && JSON.stringify(old) !== JSON.stringify(x))
        throw Error(`Conflicting backup record: ${x[key]}`);
    }
    return [...a, ...b.filter((x) => !a.some((y) => y[key] === x[key]))];
  }
  async function freeze() {
    const profile = store.quarters.find(
      (q) =>
        q.ruleVersion === draft.ruleVersion &&
        q.quarter === quarterOf(draft.windowStart),
    );
    if (
      profile &&
      Object.entries(profile.rules).some(([k, v]) => draft[k] !== v)
    )
      throw Error(
        "This draft differs from its frozen quarter profile. Apply the profile, or use a different rule version for a development comparison.",
      );
    const p = {
      ...draft,
      ...(profile ? { quarterProfileHash: profile.hash } : {}),
      milestones: milestoneText.split(/[\s,]+/).filter(Boolean),
    };
    const errors = validatePlan(p);
    if (errors.length) throw Error(errors.join("; "));
    const record = await api("freeze", { plan: p, packs: store.packs });
    setStore((s) => ({ ...s, records: [record, ...s.records] }));
    setActive(record.id);
    notify(
      "Plan frozen with a hash of its rules and as-of inputs. Changes now require a new version.",
    );
    setTab("plans");
  }
  async function reveal(monitor = false) {
    if (!current) throw Error("Select a frozen plan first");
    const x = await api(monitor ? "monitor" : "replay", {
      record: current,
      packs: store.packs,
      ...(monitor ? { observation } : {}),
    });
    setResult({ ...x, kind: monitor ? "monitor" : "replay" });
    setResultId(current.id);
    setStore((s) => ({
      ...s,
      reveals: [
        {
          id: crypto.randomUUID(),
          planId: current.id,
          kind: monitor ? "monitor" : "replay",
          at: x.revealedAt,
          observation: monitor ? observation : current.plan.horizon,
          result: x.result,
        },
        ...s.reveals,
      ],
    }));
  }
  const snap = view?.snapshot;
  const allQuotes: any[] = snap?.quotes || [];
  const filtered = allQuotes
    .filter(
      (q) =>
        (optionType === "all" || q.type === optionType) &&
        (!expiryFilter || q.expiry === expiryFilter) &&
        q.volume >= draft.minVolume &&
        q.oi >= draft.minOI,
    )
    .sort((a, b) =>
      sort === "delta"
        ? Math.abs(b.greeks?.delta || 0) - Math.abs(a.greeks?.delta || 0)
        : sort === "time"
          ? b.expiry.localeCompare(a.expiry) ||
            a.close * a.lot - b.close * b.lot
          : a.close * a.lot - b.close * b.lot,
    );
  const eligible = filtered.filter((q) => q.greeks && q.expiry > draft.horizon),
    cheap = eligible
      .slice()
      .sort((a, b) => a.close * a.lot - b.close * b.lot)[0],
    directional = eligible
      .slice()
      .sort(
        (a, b) =>
          Math.abs(Math.abs(a.greeks.delta) - 0.7) -
          Math.abs(Math.abs(b.greeks.delta) - 0.7),
      )[0];
  function choose(q: any) {
    setSelectedQuote(q);
    setDraft((p) => ({
      ...p,
      type: q.type,
      expiry: q.expiry,
      strike: q.strike,
      selection: "fixed",
    }));
  }
  const macro = (view?.macro || []).map((r: any) => ({
    date: r[0],
    P: r[1],
    E: r[2],
    V: r[3],
  }));
  const max = (k: string) =>
    macro.length
      ? macro.reduce((a: any, b: any) => (a[k] >= b[k] ? a : b))
      : null;
  const pmax = max("P"),
    emax = max("E"),
    vmax = max("V");
  const mean = (k: string) =>
    macro.length
      ? macro.reduce((s: number, r: any) => s + r[k], 0) / macro.length
      : 0;
  const errors = validatePlan({
    ...draft,
    milestones: milestoneText.split(/[\s,]+/).filter(Boolean),
  });
  const shown = resultId === active && result?.kind === tab ? result : null;
  const rr = shown?.result;
  const allQuarters = Array.from(
    { length: 35 },
    (_, i) => `${2018 + Math.floor(i / 4)}-Q${(i % 4) + 1}`,
  );
  const studyRows = (study?.results || []).filter(
    (r: any) =>
      !studyFilter ||
      JSON.stringify(r).toLowerCase().includes(studyFilter.toLowerCase()),
  );
  const planSelect = (
    <select
      value={active}
      onChange={(e) => {
        setActive(e.target.value);
        setResult(null);
      }}
      aria-label="Frozen plan"
    >
      <option value="">Select a frozen plan</option>
      {store.records.map((r) => (
        <option key={r.id} value={r.id}>
          {r.plan.name} · {r.hash.slice(0, 7)}
        </option>
      ))}
    </select>
  );
  return (
    <div className="shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/" aria-label="Fin-Lumen home">
          <span className="brand-mark">
            <Activity size={24} />
          </span>
          <span>
            fin-lumen<small>RESEARCH WORKBENCH</small>
          </span>
        </a>
        <div className="side-label">RESEARCH CYCLE</div>
        <nav>
          {tabs
            .filter((t) =>
              ["plans", "replay", "quarters", "data"].includes(t[0]),
            )
            .map(([id, label, Icon], i) => (
              <button
                key={id}
                className={tab === id ? "nav active" : "nav"}
                onClick={() => {
                  setTab(id);
                  setMenu(false);
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
                <small>0{i + 1}</small>
              </button>
            ))}
        </nav>
        <div className="side-bottom">
          <Badge tone="mint">
            <ShieldCheck size={12} />
            Purchase only
          </Badge>
          <p>
            Buy calls. Buy puts. Or wait.
            <br />
            Close positions by a written rule.
          </p>
          <div className="side-engine">
            C1 · 37.9.14<small>Retrospective research engine</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <b>{tabs.find((t) => t[0] === tab)?.[1]}</b>
          </div>
          <div className="top-actions">
            <span className="save-state">
              <i />
              {saved}
            </span>
            <button className="button ghost small" onClick={backup}>
              <Download size={15} />
              Export backup
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">NIFTY 50 · OPTIONS RESEARCH</div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <Badge tone="amber">Development workspace · v0.1</Badge>
          </div>
          {flash && (
            <div className="flash" role="status">
              <span>{flash}</span>
              <button aria-label="Dismiss message" onClick={() => setFlash("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <div className="cutoff-bar">
            <div>
              <span className="eyebrow">INFORMATION CUTOFF</span>
              <input
                aria-label="Information cutoff"
                type="date"
                value={cutoff}
                onChange={(e) => changeCutoff(e.target.value)}
              />
            </div>
            <div>
              <span className="eyebrow">FORECAST WINDOW</span>
              <b>
                {date(cutoff)} <ArrowRight size={14} />{" "}
                {date(addDays(cutoff, 74))}
              </b>
              <small>75 calendar days · daily scores</small>
            </div>
            <div>
              <span className="eyebrow">LAST AVAILABLE MARKET SESSION</span>
              <b>
                {loading
                  ? "Loading…"
                  : snap
                    ? date(snap.date)
                    : "No as-of snapshot"}
              </b>
              <small>
                {snap
                  ? `Nifty ${fmt(snap.spot, 2)} · archived prices`
                  : "Import market data for this cutoff"}
              </small>
            </div>
            <Badge tone="neutral">{quarterOf(cutoff)}</Badge>
          </div>
          {tab === "path" && (
            <>
              <div className="notice">
                <BookOpen size={18} />
                <div>
                  <b>Start with the path, then choose the expression.</b>
                  <p>
                    Pressure may accompany a decline, an interruption or a
                    sideways market. Scores describe a hypothesis; they are not
                    calibrated probabilities or a target in Nifty points.
                  </p>
                </div>
              </div>
              <div className="metrics">
                <Metric
                  label="PEAK PRESSURE"
                  value={pmax ? fmt(pmax.P) : "—"}
                  sub={pmax ? date(pmax.date) : "No scores"}
                />
                <Metric
                  label="PEAK EXPANSION"
                  value={emax ? fmt(emax.E) : "—"}
                  sub={emax ? date(emax.date) : "No scores"}
                />
                <Metric
                  label="PEAK VOLATILITY SCORE"
                  value={vmax ? fmt(vmax.V) : "—"}
                  sub={vmax ? date(vmax.date) : "No scores"}
                />
                <Metric
                  label="FORECAST COVERAGE"
                  value={`${macro.length}/75`}
                  sub="Daily observations, no interpolation"
                />
              </div>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>The macro path</h2>
                    <p>C1 archived P / E / V · the full forward window</p>
                  </div>
                  <button
                    className="button ghost small"
                    onClick={() => setShowDaily(!showDaily)}
                  >
                    {showDaily ? "Hide daily values" : "Show daily values"}
                  </button>
                </div>
                {loading ? (
                  <div className="skeleton" />
                ) : (
                  <NumberTable
                    rows={macro}
                    series={[
                      { key: "P", label: "Pressure", color: "#d58342" },
                      { key: "E", label: "Expansion", color: "#22816b" },
                      { key: "V", label: "Volatility score", color: "#687fba" },
                    ]}
                    height={260}
                  />
                )}{" "}
                {!!view?.macroMissing && (
                  <div className="inline-warning">
                    {view.macroMissing} macro dates missing. No values are
                    interpolated.
                  </div>
                )}
                {showDaily && (
                  <div className="table-wrap scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Pressure</th>
                          <th>Expansion</th>
                          <th>Volatility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {macro.map((r: any) => (
                          <tr key={r.date}>
                            <td>{r.date}</td>
                            <td>{r.P}</td>
                            <td>{r.E}</td>
                            <td>{r.V}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div className="two-col">
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Your working interpretation</h2>
                      <p>
                        Saved with a frozen plan, never inferred from a later
                        chart.
                      </p>
                    </div>
                    <Badge>Draft</Badge>
                  </div>
                  <Field label="Path hypothesis">
                    <select
                      value={draft.bias}
                      onChange={(e) => put("bias", e.target.value)}
                    >
                      {[
                        "Undecided — review the daily path",
                        "Expansion → interruption → expansion",
                        "Persistent expansion",
                        "Pressure with likely consolidation",
                        "Sustained downside hypothesis",
                        "Competing forces — prefer cash",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Direction, target/range, transition dates and invalidation">
                    <textarea
                      value={draft.notes}
                      onChange={(e) => put("notes", e.target.value)}
                      rows={5}
                      placeholder="Write a dated level or range, the sideways alternative and what would invalidate this path."
                    />
                  </Field>
                  <Field label="Transition dates to audit (up to 12, comma separated)">
                    <input
                      value={milestoneText}
                      onChange={(e) => setMilestoneText(e.target.value)}
                      placeholder="2024-08-19, 2024-09-03"
                    />
                  </Field>
                  <div className="card-footer">
                    <span>
                      Average P / E / V: {fmt(mean("P"), 1)} /{" "}
                      {fmt(mean("E"), 1)} / {fmt(mean("V"), 1)}
                    </span>
                    <button
                      className="button primary"
                      onClick={() => {
                        window.location.href = "/?cutoff=" + cutoff;
                      }}
                    >
                      Explore options <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Market observations at the cutoff</h2>
                      <p>Only observed prices on or before {date(cutoff)}.</p>
                    </div>
                  </div>
                  <NumberTable
                    rows={view?.history || []}
                    series={[
                      { key: "spot", color: "#257868", label: "Nifty close" },
                    ]}
                    height={210}
                  />
                  <p className="fine">
                    These trailing observations provide context for entry
                    planning. Future prices stay in replay. Scores were
                    generated retrospectively; no historical publication
                    timestamp is available.
                  </p>
                </section>
              </div>
            </>
          )}
          {tab === "plans" && (
            <>
              <div className="two-col plan-columns">
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Draft a purchase plan</h2>
                      <p>
                        The default is a previously exposed development example.
                      </p>
                    </div>
                    <Badge>Editable draft</Badge>
                  </div>
                  <div className="form-grid">
                    <Field label="Plan name" wide>
                      <input
                        value={draft.name}
                        onChange={(e) => put("name", e.target.value)}
                      />
                    </Field>
                    <Field label="Decision">
                      <select
                        value={draft.mode}
                        onChange={(e) => put("mode", e.target.value)}
                      >
                        <option value="trade">
                          Buy an option if rules qualify
                        </option>
                        <option value="cash">
                          Wait / cash for this window
                        </option>
                      </select>
                    </Field>
                    <Field label="Rule profile">
                      <input
                        value={draft.ruleVersion}
                        onChange={(e) => put("ruleVersion", e.target.value)}
                      />
                    </Field>
                    <Field label="Entry window starts">
                      <input
                        type="date"
                        value={draft.windowStart}
                        onChange={(e) => put("windowStart", e.target.value)}
                      />
                    </Field>
                    <Field label="Entry window ends">
                      <input
                        type="date"
                        value={draft.windowEnd}
                        onChange={(e) => put("windowEnd", e.target.value)}
                      />
                    </Field>
                    <Field label="Latest planned exit">
                      <input
                        type="date"
                        value={draft.horizon}
                        onChange={(e) => put("horizon", e.target.value)}
                      />
                    </Field>
                    <Field label="Entry rule">
                      <select
                        value={draft.entryPolicy}
                        onChange={(e) => put("entryPolicy", e.target.value)}
                      >
                        <option value="scheduled">
                          First session in window
                        </option>
                        <option value="contrarian3">
                          Against prior 3-session Nifty move
                        </option>
                        <option value="confirmation2">
                          2-session spot + premium confirmation
                        </option>
                      </select>
                    </Field>
                    {draft.mode === "trade" && (
                      <>
                        <Field label="Option side">
                          <select
                            value={draft.type}
                            onChange={(e) => put("type", e.target.value)}
                          >
                            <option value="PE">Buy put</option>
                            <option value="CE">Buy call</option>
                          </select>
                        </Field>
                        <Field label="Expiry">
                          <input
                            type="date"
                            value={draft.expiry}
                            onChange={(e) => put("expiry", e.target.value)}
                          />
                        </Field>
                        <Field label="Contract selection at prior close">
                          <select
                            value={draft.selection}
                            onChange={(e) => put("selection", e.target.value)}
                          >
                            <option value="fixed">Fixed strike</option>
                            <option value="directional">
                              Closest |delta| 0.70 within 0.60–0.80
                            </option>
                            <option value="half">
                              Closest |delta| 0.50 within 0.40–0.60
                            </option>
                            <option value="otm2">
                              Nearest to 2% OTM target
                            </option>
                            <option value="otm4">
                              Nearest to 4% OTM target
                            </option>
                          </select>
                        </Field>
                        <Field label="Fixed strike">
                          <input
                            type="number"
                            step="50"
                            value={draft.strike}
                            onChange={(e) =>
                              put("strike", Number(e.target.value))
                            }
                            disabled={draft.selection !== "fixed"}
                          />
                        </Field>
                        <Field label="Lots">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={draft.lots}
                            onChange={(e) =>
                              put("lots", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Opening cap over prior close (%)">
                          <input
                            type="number"
                            min="0"
                            value={draft.capPct}
                            onChange={(e) =>
                              put("capPct", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Minimum volume">
                          <input
                            type="number"
                            value={draft.minVolume}
                            onChange={(e) =>
                              put("minVolume", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Minimum open interest">
                          <input
                            type="number"
                            value={draft.minOI}
                            onChange={(e) =>
                              put("minOI", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Adverse slippage each side (%)">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={draft.slippagePct}
                            onChange={(e) =>
                              put("slippagePct", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Total cost reserve per position (₹)">
                          <input
                            type="number"
                            min="0"
                            value={draft.reserve}
                            onChange={(e) =>
                              put("reserve", Number(e.target.value))
                            }
                          />
                        </Field>
                        <Field label="Exit management" wide>
                          <select
                            value={draft.management}
                            onChange={(e) => put("management", e.target.value)}
                          >
                            <option value="fixed">
                              Fixed last-session close
                            </option>
                            <option value="monitor">
                              Profit / loss close signal → next opening print
                            </option>
                            <option value="conditional">
                              Thresholds + follow-through deadline → next open
                            </option>
                          </select>
                        </Field>
                        {draft.management !== "fixed" && (
                          <>
                            <Field label="Net profit signal (%)">
                              <input
                                type="number"
                                min="1"
                                value={draft.profitPct}
                                onChange={(e) =>
                                  put("profitPct", Number(e.target.value))
                                }
                              />
                            </Field>
                            <Field label="Net loss signal (%)">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={draft.lossPct}
                                onChange={(e) =>
                                  put("lossPct", Number(e.target.value))
                                }
                              />
                            </Field>
                            {draft.management === "conditional" && (
                              <Field
                                label="If net P&L ≤ 0 on this session, exit next open"
                                wide
                              >
                                <input
                                  type="date"
                                  value={draft.followThroughDate}
                                  onChange={(e) =>
                                    put("followThroughDate", e.target.value)
                                  }
                                />
                              </Field>
                            )}
                          </>
                        )}
                      </>
                    )}
                    <Field label="Macro path hypothesis" wide>
                      <input
                        value={draft.bias}
                        onChange={(e) => put("bias", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Dated levels/ranges, competing case and invalidation"
                      wide
                    >
                      <textarea
                        value={draft.notes}
                        rows={4}
                        onChange={(e) => put("notes", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Macro transition dates (comma separated)"
                      wide
                    >
                      <input
                        value={milestoneText}
                        onChange={(e) => setMilestoneText(e.target.value)}
                      />
                    </Field>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={draft.strictQuarter}
                      onChange={(e) => put("strictQuarter", e.target.checked)}
                    />
                    Keep entry and trading outcome inside one quarter
                  </label>
                  <p className="fine">
                    The cutoff is {date(draft.cutoff)}. The scheduled rule uses
                    the first actual session in its window. Selection uses only
                    the previous session. The opening cap is checked once; there
                    is no later retry. No valid contract means no entry. Missing
                    data means an unresolved test.
                  </p>
                  {errors.length > 0 && (
                    <ul className="validation">
                      {errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    className="button primary full"
                    disabled={busy || errors.length > 0 || !ready}
                    onClick={() => task(freeze)}
                  >
                    <LockKeyhole size={16} />
                    {draft.parentId
                      ? "Freeze a new version"
                      : "Freeze this plan"}
                  </button>
                </section>
                <div>
                  <section className="card">
                    <div className="section-heading">
                      <div>
                        <h2>The plan vault</h2>
                        <p>
                          {store.records.length} frozen records · originals
                          retained
                        </p>
                      </div>
                    </div>
                    {planSelect}
                    {current ? (
                      <>
                        <div className="frozen-summary">
                          <Badge tone="mint">
                            <LockKeyhole size={12} />
                            Frozen
                          </Badge>
                          <h3>{current.plan.name}</h3>
                          <dl>
                            <dt>Cutoff</dt>
                            <dd>{date(current.plan.cutoff)}</dd>
                            <dt>Entry window</dt>
                            <dd>
                              {current.plan.windowStart} →{" "}
                              {current.plan.windowEnd}
                            </dd>
                            <dt>Time exit</dt>
                            <dd>{date(current.plan.horizon)}</dd>
                            <dt>Decision</dt>
                            <dd>
                              {current.plan.mode === "cash"
                                ? "Wait / cash"
                                : `${current.plan.type} · ${current.plan.selection === "fixed" ? fmt(current.plan.strike) : current.plan.selection} · ${current.plan.expiry}`}
                            </dd>
                            <dt>Rule profile</dt>
                            <dd>{current.plan.ruleVersion}</dd>
                            <dt>Frozen</dt>
                            <dd>
                              {new Date(current.createdAt).toLocaleString()}
                            </dd>
                          </dl>
                          <p className="hash">SHA-256 · {current.hash}</p>
                          <p className="fine">
                            {current.exposure}. Hashes detect changes to a
                            record; browser storage is not a secure audit
                            service.
                          </p>
                        </div>
                        <div className="button-stack">
                          <button
                            className="button ghost"
                            onClick={() => {
                              setDraft({
                                ...current.plan,
                                parentId: current.id,
                              });
                              setMilestoneText(
                                current.plan.milestones.join(", "),
                              );
                              setCutoff(current.plan.cutoff);
                              notify(
                                "A new draft was opened. The frozen original remains in the vault.",
                              );
                            }}
                          >
                            <Plus size={15} />
                            Create a revised draft
                          </button>
                          <button
                            className="button primary"
                            onClick={() => setTab("replay")}
                          >
                            <Eye size={15} />
                            Go to replay
                          </button>
                          <button
                            className="button ghost"
                            onClick={() =>
                              download(
                                `plan-${current.hash.slice(0, 10)}.json`,
                                JSON.stringify(current, null, 2),
                              )
                            }
                          >
                            <Download size={15} />
                            Export this record
                          </button>
                        </div>
                      </>
                    ) : (
                      <Empty title="No frozen plans yet">
                        Freeze a trade or cash decision before revealing its
                        outcome.
                      </Empty>
                    )}
                  </section>
                  <div className="notice compact-note">
                    <ShieldCheck size={20} />
                    <p>
                      Long options only. Closing a bought option is an exit.
                      Maximum loss is the entry cash, including the configured
                      cost reserve; the premium can be lost entirely.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === "monitor" && (
            <>
              <div className="notice">
                <Clock size={18} />
                <div>
                  <b>A monitoring strip for the selected historical date.</b>
                  <p>
                    It reports time and observed premium behaviour. It does not
                    predict a crash or run automatically in the background.
                  </p>
                </div>
              </div>
              <section className="card">
                <div className="filter-row">
                  <Field label="Frozen plan">{planSelect}</Field>
                  <Field label="Historical observation date">
                    <input
                      type="date"
                      value={observation}
                      onChange={(e) => {
                        setObservation(e.target.value);
                        setResult(null);
                      }}
                    />
                  </Field>
                  <button
                    className="button primary"
                    disabled={!current || busy}
                    onClick={() => task(() => reveal(true))}
                  >
                    <Activity size={16} />
                    Assess at this date
                  </button>
                </div>
                {rr ? (
                  <>
                    <MonitorStrip
                      result={rr}
                      plan={current.plan}
                      observation={observation}
                    />
                    <ResultSummary result={rr} />
                    <NumberTable
                      rows={(rr.ledger || []).filter(
                        (x: any) => x.status === "observed",
                      )}
                      series={[
                        {
                          key: "netPnL",
                          label: "Net marked P&L (₹)",
                          color: "#257868",
                        },
                      ]}
                    />
                    <Ledger rows={rr.ledger || []} />
                  </>
                ) : (
                  <Empty title="Select a frozen plan and an observation date">
                    Only data on or before that date will contribute to the
                    monitoring result.
                  </Empty>
                )}
              </section>
            </>
          )}
          {tab === "replay" && (
            <>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>Replay a frozen decision</h2>
                    <p>
                      The plan hash and its as-of input hash must match before
                      replay.
                    </p>
                  </div>
                  <Badge tone="amber">Outcomes will be revealed</Badge>
                </div>
                <div className="filter-row">
                  <Field label="Frozen plan">{planSelect}</Field>
                  <button
                    className="button primary"
                    disabled={!current || busy}
                    onClick={() => task(() => reveal())}
                  >
                    <Eye size={16} />
                    Reveal and run replay
                  </button>
                </div>
                {rr ? (
                  <>
                    <ResultSummary result={rr} />
                    <div className="section-heading">
                      <h3>Market path after the cutoff</h3>
                      <Badge>Revealed</Badge>
                    </div>
                    <NumberTable
                      rows={shown.market || []}
                      series={[
                        { key: "spot", label: "Nifty close", color: "#257868" },
                      ]}
                    />
                    <Ledger rows={rr.ledger || []} />
                    {!!shown.timing?.length && (
                      <>
                        <h3>Timing audit around frozen transition dates</h3>
                        <p className="fine">
                          Exploratory definition: nearest daily close move of at
                          least 1% in the option direction, within ±3 trading
                          sessions. This is not proof of a reversal or a
                          successful forecast. A shared move is flagged instead
                          of counted twice.
                        </p>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Macro date</th>
                                <th>Anchor session</th>
                                <th>Nearest matching move</th>
                                <th>Offset</th>
                                <th>Daily move</th>
                                <th>Audit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shown.timing.map((r: any) => (
                                <tr key={r.date}>
                                  <td>{r.date}</td>
                                  <td>{r.session || "—"}</td>
                                  <td>
                                    {r.match?.date ||
                                      "No match / incomplete window"}
                                  </td>
                                  <td>{r.match?.offset ?? "—"}</td>
                                  <td>
                                    {r.match ? pc(r.match.returnPct) : "—"}
                                  </td>
                                  <td>
                                    {r.sharedWith
                                      ? `Shared with ${r.sharedWith}`
                                      : r.status}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <Empty title="The plan comes first">
                    Freeze a decision in the Plan vault, then reveal the outcome
                    here. Previously exposed periods remain development tests.
                  </Empty>
                )}
              </section>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>Our previous studies</h2>
                    <p>
                      767 archived policy rows across six studies. Alternatives
                      are correlated, not independent trials.
                    </p>
                  </div>
                  <Badge tone="amber">Previously examined</Badge>
                </div>
                <div className="filter-row">
                  <Field label="Original study">
                    <select
                      value={studyId}
                      onChange={(e) => {
                        setStudyId(e.target.value);
                        setStudy(null);
                        setStudyPage(0);
                      }}
                    >
                      <option value="">Choose a study</option>
                      {boot?.studies?.map((s: any) => (
                        <option value={s.id} key={s.id}>
                          {s.title} ({s.count} rows)
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className="button ghost"
                    disabled={!studyId || busy}
                    onClick={() =>
                      task(async () => {
                        const s = await api("study", { id: studyId });
                        setStudy(s);
                        setStore((w) => ({
                          ...w,
                          reveals: [
                            {
                              id: crypto.randomUUID(),
                              kind: "archived_study",
                              studyId,
                              at: new Date().toISOString(),
                            },
                            ...w.reveals,
                          ],
                        }));
                      })
                    }
                  >
                    <Eye size={16} />
                    Reveal original results
                  </button>
                </div>
                {study && (
                  <>
                    <div className="notice compact-note">
                      <BookOpen size={18} />
                      <p>
                        These are preserved original policy results, not reruns
                        under the editable rules above. A missing historical
                        field is shown as “—”. Source hash:{" "}
                        <span className="hash-inline">
                          {study.sourceHash.slice(0, 16)}…
                        </span>
                      </p>
                    </div>
                    <div className="filter-row">
                      <div className="search-input">
                        <Search size={16} />
                        <input
                          aria-label="Filter original results"
                          value={studyFilter}
                          onChange={(e) => {
                            setStudyFilter(e.target.value);
                            setStudyPage(0);
                          }}
                          placeholder="Filter policy, date, strike or status"
                        />
                      </div>
                      <button
                        className="button ghost small"
                        onClick={() =>
                          download(
                            `${study.id}-original-results.csv`,
                            csv(studyRows),
                            "text/csv",
                          )
                        }
                      >
                        <Download size={14} />
                        Export results
                      </button>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Entry</th>
                            <th>Contract / expiry</th>
                            <th>Policy</th>
                            <th>Exit</th>
                            <th>Entry cash</th>
                            <th>Net P&L</th>
                            <th>Return</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studyRows
                            .slice(studyPage * 20, studyPage * 20 + 20)
                            .map((r: any, i: number) => (
                              <tr key={i}>
                                <td>{r.entryDate || "—"}</td>
                                <td>
                                  {r.strike
                                    ? `${fmt(r.strike)} ${r.type || "CE*"}`
                                    : "—"}
                                  <small>
                                    {r.expiry || "Not stored in row"}
                                  </small>
                                </td>
                                <td>
                                  {r.exitPolicy || r.policy || "—"}
                                  <small>
                                    {r.role ||
                                      r.strikePolicy ||
                                      r.category ||
                                      r.schedule}
                                  </small>
                                </td>
                                <td>{r.exitDate || "—"}</td>
                                <td>{money(r.entryCash)}</td>
                                <td
                                  className={
                                    r.netPnL >= 0 ? "positive" : "negative"
                                  }
                                >
                                  {money(r.netPnL)}
                                </td>
                                <td>{pc(r.netReturnPct)}</td>
                                <td>
                                  <Badge>{r.status}</Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="card-footer">
                      <span>
                        {studyRows.length} matching rows · *May study calls;
                        side not stored in original row.
                      </span>
                      <div className="button-row">
                        <button
                          className="button ghost small"
                          disabled={studyPage === 0}
                          onClick={() => setStudyPage((p) => p - 1)}
                        >
                          Previous
                        </button>
                        <span>
                          {studyPage + 1} /{" "}
                          {Math.max(1, Math.ceil(studyRows.length / 20))}
                        </span>
                        <button
                          className="button ghost small"
                          disabled={(studyPage + 1) * 20 >= studyRows.length}
                          onClick={() => setStudyPage((p) => p + 1)}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
          {tab === "quarters" && (
            <>
              <div className="notice">
                <LayoutDashboard size={18} />
                <div>
                  <b>
                    Use 2018 onward, with 2018–2020 reported separately from
                    2021 onward.
                  </b>
                  <p>
                    Nifty index options began in 2001. The practical limit is
                    dated, reliable quote coverage. Three monthly reviews belong
                    to each trading quarter; the 75-day forecast can cross its
                    boundary, but strict test trades must exit inside it.
                  </p>
                </div>
              </div>
              <div className="two-col">
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>The chronological queue</h2>
                      <p>2018 Q1 → 2026 Q3 · complete calendar quarters</p>
                    </div>
                    <Badge>
                      {quarter.startsWith("2018") ||
                      Number(quarter.slice(0, 4)) < 2021
                        ? "2018–2020 cohort"
                        : "2021+ cohort"}
                    </Badge>
                  </div>
                  <Field label="Trading quarter">
                    <select
                      value={quarter}
                      onChange={(e) => setQuarter(e.target.value)}
                    >
                      {allQuarters.map((q) => (
                        <option key={q}>
                          {q}
                          {boot?.meta.exposedQuarters.includes(q)
                            ? " · exposed development"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="quarter-review">
                    {quarterReviews(quarter).map((d, i) => (
                      <button
                        key={d}
                        onClick={() => {
                          changeCutoff(d);
                          setDraft((p) => ({
                            ...p,
                            ruleVersion: qprofile?.ruleVersion || p.ruleVersion,
                            horizon:
                              p.horizon > quarterEnd(quarter)
                                ? quarterEnd(quarter)
                                : p.horizon,
                          }));
                          setTab("path");
                        }}
                      >
                        <span>REVIEW 0{i + 1}</span>
                        <b>{date(d)}</b>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </div>
                  <div className="coverage-box">
                    <Badge
                      tone={
                        boot?.meta.exposedQuarters.includes(quarter)
                          ? "amber"
                          : "neutral"
                      }
                    >
                      {boot?.meta.exposedQuarters.includes(quarter)
                        ? "Exposed development period"
                        : "Historical vintage unverified"}
                    </Badge>
                    <p>
                      {Number(quarter.slice(0, 4)) < 2023
                        ? "Market quotes are not bundled for this quarter. Import them before running a test."
                        : "Bundled coverage is partial. Check market-session and contract coverage before using a result."}
                    </p>
                  </div>
                  <h3>Freeze one rule profile for the quarter</h3>
                  <p className="fine">
                    Uses the current draft’s selection, entry, exit and cost
                    rules. Side, cash decisions, dated windows and targets
                    remain individual plan decisions. A profile is a research
                    commitment, not an enforceable trading lock.
                  </p>
                  {qprofile ? (
                    <>
                      <Badge tone="mint">
                        <LockKeyhole size={12} />
                        Profile frozen · {qprofile.ruleVersion}
                      </Badge>
                      <p className="hash">{qprofile.hash}</p>
                      <button
                        className="button ghost"
                        onClick={() => {
                          setDraft((p) => ({
                            ...p,
                            ...qprofile.rules,
                            ruleVersion: qprofile.ruleVersion,
                          }));
                          notify(
                            "Quarter rule profile applied to the draft. Choose dates and write the path before freezing each plan.",
                          );
                        }}
                      >
                        Apply profile to draft
                      </button>
                    </>
                  ) : (
                    <button
                      className="button primary"
                      disabled={busy || !ready}
                      onClick={() =>
                        task(async () => {
                          const entry = quarterReviews(quarter)[0];
                          if (!draft.strictQuarter)
                            throw Error(
                              "Enable strict quarterly outcomes in the Plan vault before freezing a quarter profile",
                            );
                          const rules = Object.fromEntries(
                            [
                              "selection",
                              "lots",
                              "minVolume",
                              "minOI",
                              "entryPolicy",
                              "capPct",
                              "slippagePct",
                              "reserve",
                              "management",
                              "profitPct",
                              "lossPct",
                              "strictQuarter",
                            ].map((k) => [k, draft[k]]),
                          );
                          const q = {
                            id: crypto.randomUUID(),
                            quarter,
                            ruleVersion: `${draft.ruleVersion} · ${quarter}`,
                            rules,
                            createdAt: new Date().toISOString(),
                            reviewDates: quarterReviews(quarter),
                            firstReview: entry,
                            exposure: boot?.meta.exposedQuarters.includes(
                              quarter,
                            )
                              ? "Exposed development"
                              : "Retrospective / unverified vintage",
                            priorReveals: store.reveals.filter((r) => {
                              const p = store.records.find(
                                (p) => p.id === r.planId,
                              );
                              return (
                                p && quarterOf(p.plan.windowStart) === quarter
                              );
                            }).length,
                          };
                          const hash = await digest(q);
                          setStore((s) => ({
                            ...s,
                            quarters: [...s.quarters, { ...q, hash }],
                          }));
                          notify(
                            "Quarter profile frozen. Apply it before creating the three monthly decisions.",
                          );
                        })
                      }
                    >
                      <LockKeyhole size={16} />
                      Freeze current rules for {quarter}
                    </button>
                  )}
                </section>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Quarter assessment</h2>
                      <p>
                        One latest replay result per frozen plan, not per click.
                      </p>
                    </div>
                  </div>
                  <QuarterAssessment
                    quarter={quarter}
                    store={store}
                    profile={qprofile}
                  />
                  <div className="divider" />
                  <h3>Keep the interpretation honest</h3>
                  <ul className="plain-list">
                    <li>
                      Previously examined periods stay in development, including
                      all six imported studies.
                    </li>
                    <li>
                      Missing data, no entry signal, no eligible contract and an
                      opening-cap rejection are different outcomes.
                    </li>
                    <li>
                      Counterfactual variants are correlated. Do not present
                      them as independent trials or combine their P&L as a
                      portfolio.
                    </li>
                    <li>
                      Calibration changes become a new version for the next
                      quarter; the earlier record stays unchanged.
                    </li>
                    <li>
                      Crossing forecast windows share information even when
                      trading outcomes do not overlap.
                    </li>
                  </ul>
                </section>
              </div>
              <section className="card">
                <div className="section-heading">
                  <h2>Profile register</h2>
                  <Badge>{store.quarters.length} frozen profiles</Badge>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Quarter</th>
                        <th>Rule profile</th>
                        <th>Exposure</th>
                        <th>Earlier local reveals</th>
                        <th>Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {store.quarters.map((q) => (
                        <tr key={q.id}>
                          <td>{q.quarter}</td>
                          <td>{q.ruleVersion}</td>
                          <td>{q.exposure}</td>
                          <td>{q.priorReveals}</td>
                          <td className="hash-inline">
                            {q.hash.slice(0, 14)}…
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!store.quarters.length && (
                    <Empty title="The register starts empty">
                      Freeze a rule profile before assessing your next quarter.
                    </Empty>
                  )}
                </div>
              </section>
            </>
          )}
          {tab === "data" && (
            <>
              <div className="metrics">
                <Metric
                  label="BUNDLED MARKET SESSIONS"
                  value="139"
                  sub="14 Aug 2023–22 Aug 2024, with gaps"
                />
                <Metric
                  label="ARCHIVED OPTION QUOTES"
                  value="55,642"
                  sub="Dated open, close, volume, OI and lot"
                />
                <Metric
                  label="MACRO DAYS"
                  value="3,287"
                  sub="1 Oct 2017–30 Sep 2026"
                />
                <Metric
                  label="ADDITIONAL DATASET PACKS"
                  value={store.packs.length}
                  sub="Saved in this browser and backups"
                />
              </div>
              <div className="two-col">
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Bring in the next quarter</h2>
                      <p>
                        Import documented JSON packs. Conflicts are rejected.
                      </p>
                    </div>
                    <Upload size={18} />
                  </div>
                  <p>
                    Supply dated Nifty observations, expiry futures, option
                    opening and closing prints, volume, open interest, actual
                    lot sizes and the exchange holiday calendar. Supply daily P
                    / E / V separately under the pinned macro version.
                  </p>
                  <div className="button-stack">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() => packRef.current?.click()}
                    >
                      <Upload size={16} />
                      Import a dataset pack
                    </button>
                    <button
                      className="button ghost"
                      onClick={() =>
                        download(
                          "fin-lumen-dataset-template.json",
                          JSON.stringify(
                            {
                              name: "2018-Q1 verified source pack",
                              source:
                                "Replace with provider, retrieval date, units, price-field definitions and lot-size source",
                              macroVersion: ENGINE_VERSION,
                              days: [],
                              macro: [],
                              closed: [],
                            },
                            null,
                            2,
                          ),
                        )
                      }
                    >
                      <Download size={16} />
                      Download JSON structure
                    </button>
                    <button
                      className="button ghost"
                      onClick={() => restoreRef.current?.click()}
                    >
                      <Upload size={16} />
                      Restore / merge a workspace backup
                    </button>
                  </div>
                  <input
                    ref={packRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f)
                        task(async () => {
                          if (f.size > 2_000_000)
                            throw Error(
                              "Import packs must be under 2 MB. Split a quarter into smaller packs.",
                            );
                          const p = JSON.parse(await f.text());
                          const x = await api("validate", {
                            pack: p,
                            packs: store.packs,
                          });
                          if (store.packs.some((v) => v.name === p.name))
                            throw Error(
                              "A pack with this name is already loaded",
                            );
                          setStore((s) => ({ ...s, packs: [...s.packs, p] }));
                          notify(
                            `Dataset validated and imported · ${x.hash.slice(0, 12)}`,
                          );
                        });
                    }}
                  />
                  <input
                    ref={restoreRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) task(() => restore(f));
                    }}
                  />
                  <p className="fine">
                    A market day has date, spot, optional open/high/low/vix,
                    futures keyed by expiry, and quotes containing expiry,
                    strike, type (CE/PE), open, close, volume, oi and lot. Macro
                    rows are [date, P, E, V]. The empty template must be
                    populated before it can be imported. Current request limit:
                    3 MB including all packs; this prototype suits small
                    research batches.
                  </p>
                  {store.packs.map((p) => (
                    <div className="pack-row" key={p.name}>
                      <Database size={16} />
                      <div>
                        <b>{p.name}</b>
                        <small>
                          {p.days?.length || 0} sessions ·{" "}
                          {p.macro?.length || 0} macro days · {p.source}
                        </small>
                      </div>
                    </div>
                  ))}
                </section>
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>Coverage & provenance</h2>
                      <p>What this first release can and cannot assess.</p>
                    </div>
                  </div>
                  <dl className="provenance">
                    <dt>Macro engine</dt>
                    <dd>{ENGINE_VERSION}</dd>
                    <dt>Replay rules</dt>
                    <dd>{RULE_ENGINE}</dd>
                    <dt>Market windows</dt>
                    <dd>
                      14 Aug–28 Sep 2023
                      <br />
                      15 Mar–22 Aug 2024
                    </dd>
                    <dt>Forecast vintage</dt>
                    <dd>
                      Retrospectively generated; historical availability has not
                      been established.
                    </dd>
                    <dt>Execution basis</dt>
                    <dd>
                      Daily traded prints with adverse slippage and a cost
                      reserve. No bid/ask depth or intraday fill simulation.
                    </dd>
                    <dt>Cost model</dt>
                    <dd>
                      User-defined total reserve and adverse slippage; not a
                      complete statutory tax/fee calculation.
                    </dd>
                    <dt>Live feeds</dt>
                    <dd>None. Import historical data for additional tests.</dd>
                    <dt>Storage</dt>
                    <dd>
                      Browser IndexedDB. No login, cloud sync or background
                      monitoring. Export before moving browser or clearing site
                      data.
                    </dd>
                  </dl>
                  <a
                    className="source-link"
                    href="https://nsearchives.nseindia.com/content/press/04062001.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NSE: Nifty index options began 4 June 2001{" "}
                    <ArrowUpRight size={14} />
                  </a>
                  <p className="fine">
                    A private GitHub repository does not make a Vercel
                    deployment private. Configure deployment access protection
                    before sharing the app.
                  </p>
                  <details>
                    <summary>Archive source fingerprints</summary>
                    {boot?.meta.sources.map((s: any) => (
                      <p className="hash" key={s.name}>
                        {s.name}
                        <br />
                        {s.sha256}
                      </p>
                    ))}
                  </details>
                </section>
              </div>
              <section className="card">
                <div className="section-heading">
                  <div>
                    <h2>Research notebook & UX gaps</h2>
                    <p>
                      Keep model questions and interface friction alongside the
                      tests.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Note type">
                    <select
                      value={noteKind}
                      onChange={(e) => setNoteKind(e.target.value)}
                    >
                      {[
                        "Research",
                        "Timing observation",
                        "Rule change for next quarter",
                        "Data issue",
                        "UX gap",
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Note" wide>
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Describe what happened, the dates and what should be tested next. Distinguish an observation from a new rule."
                    />
                  </Field>
                </div>
                <button
                  className="button primary"
                  disabled={!note.trim() || !ready}
                  onClick={() => {
                    setStore((s) => ({
                      ...s,
                      notes: [
                        {
                          id: crypto.randomUUID(),
                          at: new Date().toISOString(),
                          kind: noteKind,
                          cutoff,
                          text: note.trim(),
                        },
                        ...s.notes,
                      ],
                    }));
                    setNote("");
                  }}
                >
                  <Plus size={16} />
                  Save note
                </button>
                <div className="notes">
                  {store.notes.map((n) => (
                    <article key={n.id}>
                      <div>
                        <Badge>{n.kind}</Badge>
                        <small>
                          {date(n.cutoff)} · {new Date(n.at).toLocaleString()}
                        </small>
                      </div>
                      <p>{n.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
          <footer>
            <span>
              fin-lumen <b>research</b>
            </span>
            <p>
              Hypothesis → frozen plan → observed outcome → next-quarter
              calibration.
            </p>
            <span>Purchase only · No live orders</span>
          </footer>
        </main>
      </div>
      {busy && (
        <div className="busy" role="status">
          <span className="spinner" />
          Processing research request…
        </div>
      )}
    </div>
  );
}
function ResultSummary({ result: r }: { result: any }) {
  return (
    <>
      <div className="result-status">
        <Badge
          tone={
            r.status === "completed"
              ? "mint"
              : r.status.includes("missing") || r.status === "insufficient_data"
                ? "amber"
                : "neutral"
          }
        >
          {r.status.replaceAll("_", " ")}
        </Badge>
        <p>{r.message || r.reason}</p>
      </div>
      <div className="metrics compact">
        <Metric
          label="ENTRY CASH / MAXIMUM LOSS"
          value={money(r.entryCash)}
          sub={
            r.entryDate ? `${r.entryDate} · ${r.units ?? "—"} units` : undefined
          }
        />
        <Metric
          label="NET P&L"
          value={money(r.netPnL)}
          sub={pc(r.netReturnPct)}
        />
        <Metric
          label="ENTRY PREMIUM"
          value={money(r.entryPremium)}
          sub={
            r.contract
              ? `${r.contract.strike} ${r.contract.type} · ${r.contract.expiry}`
              : undefined
          }
        />
        <Metric
          label={
            r.status === "completed" ? "ACTUAL EXIT" : "PLANNED / PENDING EXIT"
          }
          value={r.exitDate || "—"}
          sub={
            r.exitPremium
              ? `${money(r.exitPremium)} · ${r.exitField}`
              : r.signalDate
                ? `Signal ${r.signalDate}`
                : "No exit fill inferred"
          }
        />
      </div>
    </>
  );
}
function Ledger({ rows }: { rows: any[] }) {
  return rows.length ? (
    <details className="ledger">
      <summary>Inspect daily marks ({rows.length} rows)</summary>
      <div className="table-wrap scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Nifty</th>
              <th>Premium close</th>
              <th>Net marked P&L</th>
              <th>Return</th>
              <th>Data status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td>{fmt(r.spot, 2)}</td>
                <td>{money(r.premium)}</td>
                <td>{money(r.netPnL)}</td>
                <td>{pc(r.netReturnPct)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  ) : null;
}
function MonitorStrip({
  result: r,
  plan: p,
  observation: d,
}: {
  result: any;
  plan: Plan;
  observation: string;
}) {
  const left = daysBetween(d, p.horizon),
    dte = daysBetween(d, p.expiry);
  let color = "green",
    label = "Within the planned window";
  if (
    r.status === "completed" ||
    r.status === "no_trade" ||
    r.status === "no_fill"
  ) {
    color = "neutral";
    label = "Position closed / no position";
  } else if (r.status.includes("missing") || r.status === "insufficient_data") {
    color = "red";
    label = "Data gap — monitoring unresolved";
  } else if (r.status === "awaiting_exit" || left <= 0 || dte <= 3) {
    color = "red";
    label = "Exit due / next execution required";
  } else if (left <= 3 || dte <= 7 || r.netReturnPct <= -p.lossPct * 0.8) {
    color = "orange";
    label = "Near a time or loss boundary";
  } else if (left <= 7 || dte <= 14 || r.netReturnPct < 0) {
    color = "yellow";
    label = "Watch time and premium behaviour";
  }
  return (
    <div className={"monitor-strip " + color}>
      <div>
        <i />
        <b>{label}</b>
      </div>
      <span>
        {d} · {left} calendar days to time exit · {dte} days to expiry
      </span>
    </div>
  );
}
function QuarterAssessment({
  quarter,
  store,
  profile,
}: {
  quarter: string;
  store: Workspace;
  profile: any;
}) {
  const plans = store.records.filter(
      (p) =>
        quarterOf(p.plan.windowStart) === quarter &&
        p.plan.ruleVersion === profile?.ruleVersion &&
        p.plan.quarterProfileHash === profile?.hash,
    ),
    outcomes = plans.map((p) => ({
      p,
      r: store.reveals.find((r) => r.kind === "replay" && r.planId === p.id)
        ?.result,
    })),
    done = outcomes.filter((x) => x.r?.status === "completed"),
    returns = done.map((x) => x.r.netReturnPct).sort((a, b) => a - b);
  const median = returns.length
    ? (returns[Math.floor((returns.length - 1) / 2)] +
        returns[Math.ceil((returns.length - 1) / 2)]) /
      2
    : null;
  return (
    <>
      <div className="metrics compact two">
        <Metric label="MATCHING FROZEN PLANS" value={plans.length} />
        <Metric label="COMPLETED TRADES" value={done.length} />
        <Metric
          label="MEDIAN NET RETURN"
          value={median === null ? "—" : pc(median)}
          sub="Observed trades; not a probability"
        />
        <Metric
          label="OTHER / UNRESOLVED"
          value={outcomes.length - done.length}
        />
      </div>
      {!profile ? (
        <Empty title="No quarter rule profile">
          Freeze a profile, apply it to the draft and freeze each monthly
          decision under that version.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Outcome</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map(({ p, r }) => (
                <tr key={p.id}>
                  <td>
                    {p.plan.name}
                    <small>{p.hash.slice(0, 10)}</small>
                  </td>
                  <td>{r?.status || "Not replayed"}</td>
                  <td>{pc(r?.netReturnPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="fine">
        Cash, absent signals and rejected openings remain separate from
        completed trades. No win-rate estimate is promoted as a forward
        probability. The summary includes matching rule versions only; revised
        plan variants can still be correlated.
      </p>
    </>
  );
}
