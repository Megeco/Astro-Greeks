import { NextResponse } from "next/server";
import {
  dataset,
  meta,
  studies,
  inputDigest,
  validatePack,
} from "@/lib/catalog";
import {
  addDays,
  daysBetween,
  validDate,
  digest,
  enriched,
  runReplay,
  auditMilestones,
  validatePlan,
  ENGINE_VERSION,
  RULE_ENGINE,
  type Plan,
} from "@/lib/research";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (x: unknown, status = 200) =>
  NextResponse.json(x, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  return json({
    meta,
    engine: ENGINE_VERSION,
    ruleEngine: RULE_ENGINE,
    studies: studies.map((s: any) => ({
      id: s.id,
      title: s.title,
      quarter: s.quarter,
      exposure: s.exposure,
      count: s.results.length,
      sourceHash: s.sourceHash,
    })),
  });
}
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length") || 0) > 3_000_000)
      return json(
        { error: "Request exceeds 3 MB. Import smaller packs." },
        413,
      );
    const body = await req.text();
    if (body.length > 3_000_000)
      return json({ error: "Request exceeds 3 MB" }, 413);
    const b = JSON.parse(body),
      data = dataset(b.packs || []);
    if (b.op === "validate") {
      const errors = validatePack(b.pack);
      if (errors.length) return json({ error: errors.join("; ") }, 400);
      dataset([...(b.packs || []), b.pack]);
      return json({ ok: true, hash: await digest(b.pack) });
    }
    if (b.op === "workspace") {
      if (!validDate(b.cutoff)) throw Error("Invalid cutoff");
      const rows = data.macro.filter(
          (m) => m[0] >= b.cutoff && m[0] <= addDays(b.cutoff, 74),
        ),
        history = data.days.filter((d) => d.date <= b.cutoff).slice(-22);
      const candidate = history.at(-1);
      const snapshot =
        candidate && daysBetween(candidate.date, b.cutoff) <= 7
          ? candidate
          : null;
      return json({
        macro: rows,
        macroMissing: 75 - rows.length,
        history: history.map(({ quotes, futures, ...d }) => d),
        snapshot: snapshot
          ? {
              date: snapshot.date,
              spot: snapshot.spot,
              vix: snapshot.vix,
              quotes: enriched(snapshot),
            }
          : null,
        coverage: {
          sessions: data.days.length,
          quotes: data.days.reduce((s, d) => s + d.quotes.length, 0),
          closed: data.closed,
        },
      });
    }
    if (b.op === "freeze") {
      const errors = validatePlan(b.plan);
      if (errors.length) return json({ error: errors.join("; ") }, 400);
      const p = b.plan as Plan;
      const frozen = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        plan: p,
        inputHash: await inputDigest(p, data),
        macroVersion: ENGINE_VERSION,
        ruleEngine: RULE_ENGINE,
        exposure: "Retrospective development / unverified vintage",
        dataSources: [
          ...meta.sources.map((s: any) => s.name),
          ...(b.packs || []).map((p: any) => p.name),
        ],
      };
      return json({ ...frozen, hash: await digest(frozen) });
    }
    if (b.op === "replay" || b.op === "monitor") {
      const f = b.record;
      if (!f || typeof f.hash !== "string")
        throw Error("Frozen record required");
      const { hash, ...payload } = f;
      if ((await digest(payload)) !== hash)
        throw Error(
          "Frozen record hash does not match. Restore the original backup.",
        );
      if (f.ruleEngine !== RULE_ENGINE || f.macroVersion !== ENGINE_VERSION)
        throw Error("This frozen record uses a different engine version");
      if ((await inputDigest(f.plan, data)) !== f.inputHash)
        throw Error(
          "As-of inputs changed since freeze. Restore the original inputs or create a new plan version.",
        );
      if (
        b.op === "monitor" &&
        (!validDate(b.observation) || b.observation < f.plan.cutoff)
      )
        throw Error("Observation must be on or after the cutoff");
      const observation = b.op === "monitor" ? b.observation : undefined;
      const result = runReplay(f.plan, data.days, data.closed, observation);
      const end = observation || f.plan.horizon;
      const view = data.days.filter(
        (d) => d.date >= f.plan.cutoff && d.date <= end,
      );
      return json({
        result,
        market: view.map(({ quotes, futures, ...d }) => d),
        timing:
          b.op === "replay"
            ? auditMilestones(
                f.plan,
                data.days.filter((d) => d.date <= addDays(f.plan.horizon, 7)),
                data.closed,
              )
            : [],
        revealedAt: new Date().toISOString(),
        exposure: f.exposure,
      });
    }
    if (b.op === "study") {
      const study = studies.find((s: any) => s.id === b.id);
      if (!study) throw Error("Study not found");
      return json(study);
    }
    return json({ error: "Unknown operation" }, 400);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Request failed" },
      400,
    );
  }
}
