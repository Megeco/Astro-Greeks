import {
  generateRealTransits,
  getElement,
  getSign,
  nextSignIngress,
  nextRetrogradeTransitions,
  ephemerisMetadata,
  getBodyPosition,
  parseUtcDate
} from "./realTransitGenerator.js";
import {
  getRelevantEclipses
} from "./realEclipseEngine.js";

function normalizeDegree(degree) {
  return (((degree % 360) + 360) % 360);
}

function angleDiff(a, b) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return Math.min(diff, 360 - diff);
}

function aspectOrb(a, b, target) {
  return Math.abs(angleDiff(a, b) - target);
}

function addDaysUtc(date, days) {
  const d = parseUtcDate(date);
  d.setTime(d.getTime() + days * 86400000);
  return d;
}

function daysBetween(start, end) {
  return (parseUtcDate(end).getTime() - parseUtcDate(start).getTime()) / 86400000;
}

function directedAspectOrb(a, b, target) {
  const direct = aspectOrb(a, b, target);
  const mirror = target === 0 || target === 180 ? direct : aspectOrb(a, b, 360 - target);
  return Math.min(direct, mirror);
}

function isoDate(value) {
  return value ? parseUtcDate(value).toISOString().split("T")[0] : null;
}

// Resolve the complete contiguous in-orb interval around a known active point.
// The range—not today's snapshot—is the backtestable astrological object.
function aspectWindowAtDate(pair, aspect, anchorInput, orbLimit) {
  const anchor = parseUtcDate(anchorInput);
  const limit = Number(orbLimit);
  const orbAt = date => {
    const pos = aspectDegreeForPair(pair, date);
    return directedAspectOrb(pos.p1.degree, pos.p2.degree, aspect.angle);
  };
  if (!Number.isFinite(limit) || orbAt(anchor) > limit) return null;

  const fast = pair.some(planet => ["sun", "mercury", "venus"].includes(planet));
  const medium = pair.includes("mars");
  const stepDays = fast ? 0.5 : medium ? 1 : 2;
  const maxDays = fast ? 90 : medium ? 180 : 540;

  const edge = direction => {
    let inside = anchor;
    let outside = null;
    for (let elapsed = stepDays; elapsed <= maxDays; elapsed += stepDays) {
      const test = addDaysUtc(anchor, direction * elapsed);
      if (orbAt(test) > limit) {
        outside = test;
        break;
      }
      inside = test;
    }
    if (!outside) return inside;
    for (let i = 0; i < 44; i += 1) {
      const mid = new Date((inside.getTime() + outside.getTime()) / 2);
      if (orbAt(mid) <= limit) inside = mid;
      else outside = mid;
    }
    return inside;
  };

  const start = edge(-1);
  const end = edge(1);
  const durationDays = Math.max(0, daysBetween(start, end));
  const sampleStep = Math.max(0.2, Math.min(1, durationDays / 80 || 0.2));
  let best = anchor;
  let bestOrb = orbAt(anchor);
  for (let elapsed = 0; elapsed <= durationDays; elapsed += sampleStep) {
    const test = addDaysUtc(start, elapsed);
    const orb = orbAt(test);
    if (orb < bestOrb) {
      best = test;
      bestOrb = orb;
    }
  }
  let low = addDaysUtc(best, -sampleStep);
  let high = addDaysUtc(best, sampleStep);
  for (let i = 0; i < 40; i += 1) {
    const m1 = new Date(low.getTime() + (high.getTime() - low.getTime()) / 3);
    const m2 = new Date(high.getTime() - (high.getTime() - low.getTime()) / 3);
    if (orbAt(m1) < orbAt(m2)) high = m2;
    else low = m1;
  }
  const exact = new Date((low.getTime() + high.getTime()) / 2);

  return {
    windowStart: isoDate(start),
    windowEnd: isoDate(end),
    exactDate: isoDate(exact)
  };
}

function retrogradeWindowAtDate(planet, anchorInput) {
  const anchor = parseUtcDate(anchorInput);
  const isRetrograde = date => Boolean(getBodyPosition(planet, date)?.retrograde);
  if (!isRetrograde(anchor)) return null;

  const edge = direction => {
    let inside = anchor;
    let outside = null;
    for (let elapsed = 1; elapsed <= 800; elapsed += 1) {
      const test = addDaysUtc(anchor, direction * elapsed);
      if (!isRetrograde(test)) {
        outside = test;
        break;
      }
      inside = test;
    }
    if (!outside) return inside;
    for (let i = 0; i < 42; i += 1) {
      const mid = new Date((inside.getTime() + outside.getTime()) / 2);
      if (isRetrograde(mid)) inside = mid;
      else outside = mid;
    }
    return inside;
  };

  return {
    windowStart: isoDate(edge(-1)),
    windowEnd: isoDate(edge(1))
  };
}

const MACRO_ASPECTS = [
  { name: "conjunction", angle: 0, orb: 6, type: "amplification" },
  { name: "sextile", angle: 60, orb: 4, type: "support" },
  { name: "square", angle: 90, orb: 5, type: "pressure" },
  { name: "trine", angle: 120, orb: 5, type: "support" },
  { name: "opposition", angle: 180, orb: 5, type: "pressure" }
];

const MACRO_PAIRS = [
  ["jupiter", "venus"],
  ["jupiter", "mercury"],
  ["jupiter", "mars"],
  ["jupiter", "saturn"],
  ["jupiter", "rahu"],
  ["saturn", "rahu"],
  ["saturn", "venus"],
  ["saturn", "mercury"],
  ["mars", "saturn"],
  ["mars", "rahu"],
  ["venus", "rahu"],
  ["mercury", "rahu"],
  ["sun", "rahu"]
];

// Slow structural carriers are evaluated as active field conditions rather
// than scanned as dozens of duplicate short-term catalysts. This keeps the
// macro layer sensitive to system-level contraction/amplification without
// slowing every stock request with a second large forward scan.
const STRUCTURAL_MACRO_PAIRS = [
  ["saturn", "pluto"],
  ["saturn", "uranus"],
  ["saturn", "neptune"],
  ["jupiter", "pluto"],
  ["jupiter", "uranus"],
  ["mars", "pluto"],
  ["mars", "uranus"]
];

const MACRO_PRESSURE_THRESHOLDS = {
  extreme: 45,
  high: 28,
  pressure: 15
};

const SOURCE_WEIGHTS = {
  direct: 1.0,
  cluster: 0.35,
  shadow: 0.25,
  overlap: 0.15,
  transition: 0.35
};

function weightedTransitionScore(events) {
  return (events || [])
    .filter(item => item?.type === "transition")
    .reduce((sum, item) => sum + Number(item.strength || 0) * SOURCE_WEIGHTS.transition, 0);
}

function weightedOverlapIntensity(overlap = {}) {
  return Object.fromEntries(
    Object.entries(overlap).map(([planet, count]) => [
      planet,
      Number((Number(count || 0) * SOURCE_WEIGHTS.overlap).toFixed(2))
    ])
  );
}

function weightedClusterScore(clusters = []) {
  return Number(
    clusters
      .reduce((sum, cluster) => sum + Number(cluster.density || 0) * SOURCE_WEIGHTS.cluster, 0)
      .toFixed(2)
  );
}

function titlePlanet(planet) {
  return String(planet || "")
    .charAt(0)
    .toUpperCase() + String(planet || "").slice(1);
}

function aspectTone(pair, aspect) {
  const joined = pair.join("-");
  const supportive = ["conjunction", "trine", "sextile"].includes(aspect.name);

  if (joined === "jupiter-venus" && supportive) {
    return "expansion";
  }

  if (joined === "saturn-venus" && ["trine", "sextile"].includes(aspect.name)) {
    return "expansion";
  }

  if (joined === "mars-saturn" && ["trine", "sextile"].includes(aspect.name)) {
    return "transition";
  }

  if (aspect.name === "square" || aspect.name === "opposition") {
    return "pressure";
  }

  if (pair.includes("rahu")) {
    return "volatility";
  }

  if (aspect.type === "support") {
    return "expansion";
  }

  return "transition";
}

function notesForMacroAspect(pair, aspect, degree, sign) {
  const label = `${titlePlanet(pair[0])}-${titlePlanet(pair[1])} ${aspect.name}`;
  const tone = aspectTone(pair, aspect);

  if (tone === "pressure") {
    return `${label}: hard-aspect friction, restraint or unstable amplification contributes to pressure; supportive expression is not assumed. Exact near ${Number(degree).toFixed(2)}° ${sign}.`;
  }

  if (pair.includes("jupiter") && pair.includes("venus")) {
    return `${label}: expansion, liquidity, valuation/rerating and preference-for-quality themes can strengthen; natal Venus/Jupiter contacts decide which stocks benefit. Exact near ${Number(degree).toFixed(2)}° ${sign}.`;
  }

  if (pair.includes("jupiter") && pair.includes("rahu")) {
    return `${label}: amplification and speculative heat contribute to volatility; expansion is not scored for this aspect.`;
  }

  if (pair.includes("saturn") && pair.includes("rahu")) {
    return `${label}: fear/greed compression, unstable pressure, and churning.`;
  }

  if (pair.includes("saturn") && pair.includes("venus") && ["trine", "sextile"].includes(aspect.name)) {
    return `${label}: disciplined expansion, valuation repair, selective support, and preference for durable quality.`;
  }

  if (pair.includes("saturn") && pair.includes("venus") && ["square", "opposition", "conjunction"].includes(aspect.name)) {
    return `${label}: Saturn restrains Venus themes—liquidity, valuation, confidence and preference—so expression can be delayed, compressed or highly selective.`;
  }

  if (pair.includes("saturn") && pair.includes("mercury") && ["trine", "sextile"].includes(aspect.name)) {
    return `${label}: disciplined communication, planning and execution can stabilise the field, although Saturn keeps the pace measured.`;
  }

  if (pair.includes("sun") && pair.includes("rahu")) {
    return `${label}: leadership, confidence and crowd attention are amplified or distorted, raising narrative heat and reversal sensitivity.`;
  }

  if (pair.includes("mercury") && pair.includes("rahu")) {
    return `${label}: information, messaging and expectations become more reactive, increasing headline sensitivity and false-signal risk.`;
  }

  if (pair.includes("mars") && pair.includes("saturn")) {
    return `${label}: force meets restraint; disciplined execution or friction depending on natal response.`;
  }

  return `${label}: macro aspect window; stock-specific natal contacts decide the behaviour.`;
}

function aspectDegreeForPair(pair, date) {
  const p1 = getBodyPosition(pair[0], date);
  const p2 = getBodyPosition(pair[1], date);
  return {
    p1,
    p2,
    midpoint: ((p1.degree + p2.degree) / 2) % 360
  };
}

export function findNextMacroAspect(pair, aspect, startDate, scanDays = 120) {
  const start = parseUtcDate(startDate);
  const end = addDaysUtc(start, scanDays);
  const orbAt = date => {
    const pos = aspectDegreeForPair(pair, date);
    return directedAspectOrb(pos.p1.degree, pos.p2.degree, aspect.angle);
  };
  const refine = (left, right) => {
    let low = new Date(Math.max(start.getTime(), left.getTime()));
    let high = new Date(Math.min(end.getTime(), right.getTime()));
    for (let i = 0; i < 48; i += 1) {
      const m1 = new Date(low.getTime() + (high.getTime() - low.getTime()) / 3);
      const m2 = new Date(high.getTime() - (high.getTime() - low.getTime()) / 3);
      if (orbAt(m1) < orbAt(m2)) high = m2;
      else low = m1;
    }
    return new Date((low.getTime() + high.getTime()) / 2);
  };

  // Refine local closest approaches in chronological order. A later retrograde
  // pass must not displace an earlier pass merely because its sampled orb is smaller.
  let left = { date: addDaysUtc(start, -0.25) };
  left.orb = orbAt(left.date);
  let middle = { date: start, orb: orbAt(start) };
  let exact = null;
  for (let step = 1; step <= scanDays * 4; step += 1) {
    const right = { date: addDaysUtc(start, step / 4) };
    right.orb = orbAt(right.date);
    if (middle.orb <= aspect.orb && middle.orb <= left.orb && middle.orb <= right.orb) {
      const candidate = refine(left.date, right.date);
      const candidateOrb = orbAt(candidate);
      // Do not invent a future pass from an already separating aspect at the
      // start boundary. An exact alignment at the reference time is retained.
      const atStart = candidate.getTime() - start.getTime() < 1000;
      if (candidateOrb <= aspect.orb && (!atStart || candidateOrb < 0.00001)) {
        exact = candidate;
        break;
      }
    }
    left = middle;
    middle = right;
  }
  if (!exact) return null;

  const pos = aspectDegreeForPair(pair, exact);
  const exactOrb = directedAspectOrb(pos.p1.degree, pos.p2.degree, aspect.angle);

  if (exactOrb > aspect.orb) {
    return null;
  }

  const daysTill = (exact.getTime() - start.getTime()) / 86400000;
  const tone = aspectTone(pair, aspect);
  const degree = pos.p1.degree;
  const sign = pos.p1.sign;

  return {
    label: `${titlePlanet(pair[0])}-${titlePlanet(pair[1])} ${aspect.name}`,
    name: `${pair[0]}-${pair[1]} ${aspect.name}`,
    planets: pair,
    aspect: aspect.name,
    angle: aspect.angle,
    date: exact.toISOString().split("T")[0],
    exactUtc: exact.toISOString(),
    exactIst: new Date(exact.getTime() + 5.5 * 3600000)
      .toISOString()
      .replace("Z", "+05:30"),
    daysRemaining: Number(daysTill.toFixed(2)),
    daysTill: Number(daysTill.toFixed(2)),
    timing: daysTill <= 7 ? "NEAR" : "UPCOMING",
    type: tone,
    resultingEnvironment: tone === "expansion" ? "EXPANSION / RERATING" : tone === "pressure" ? "PRESSURE / REVIEW" : tone === "volatility" ? "AMPLIFICATION / VOLATILITY" : "ASPECT SHIFT",
    notes: notesForMacroAspect(pair, aspect, degree, sign),
    source: "direct Swiss Ephemeris aspect scan + local refinement",
    eventPrecision: "direct-swiss-refined",
    precisionNote: "Every scan and refinement point is calculated directly with swe_calc_ut and SEFLG_SWIEPH.",
    orb: Number(exactOrb.toFixed(3)),
    sign,
    degree: Number(degree.toFixed(4)),
    p1: pos.p1,
    p2: pos.p2
  };
}

function buildUpcomingAspectCandidates(today) {
  const candidates = [];

  for (const pair of MACRO_PAIRS) {
    for (const aspect of MACRO_ASPECTS) {
      const hit = findNextMacroAspect(pair, aspect, today, pair.includes("mercury") || pair.includes("venus") ? 90 : 180);

      if (hit) {
        candidates.push(hit);
      }
    }
  }

  const byKey = new Map();

  for (const item of candidates.sort((a, b) => a.daysRemaining - b.daysRemaining)) {
    const key = item.label;

    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .map((item, index) => {
      if (index >= 20 || !item.planets || !item.aspect) return item;
      const aspect = MACRO_ASPECTS.find(candidate => candidate.name === item.aspect);
      if (!aspect) return item;
      return {
        ...item,
        ...aspectWindowAtDate(item.planets, aspect, item.exactUtc || item.date, Math.min(aspect.orb, 3.5)),
        // The contiguous orb window can contain multiple retrograde passes.
        // Its range must not replace the next pass's chronological exact date.
        exactDate: item.date
      };
    });
}

function buildCurrentMacroAspects(transits, today, includeWindows = true) {
  const events = [];

  for (const pair of MACRO_PAIRS) {
    const p1 = transits.positions?.[pair[0]];
    const p2 = transits.positions?.[pair[1]];

    if (!p1 || !p2) {
      continue;
    }

    for (const aspect of MACRO_ASPECTS) {
      const orb = directedAspectOrb(p1.degree, p2.degree, aspect.angle);

      if (orb <= Math.min(aspect.orb, 3.5)) {
        const tone = aspectTone(pair, aspect);
        const strength = Math.max(4, Math.round((aspect.orb - orb + 1) * 2));
        const aspectWindow = includeWindows ? aspectWindowAtDate(pair, aspect, today, Math.min(aspect.orb, 3.5)) : null;

        events.push(
          event(
            `${titlePlanet(pair[0])}-${titlePlanet(pair[1])} ${aspect.name}`,
            tone,
            strength,
            notesForMacroAspect(pair, aspect, p1.degree, p1.sign),
            today,
            "ACTIVE",
            0,
            {
              planets: pair,
              aspect: aspect.name,
              orb: Number(orb.toFixed(3)),
              ...aspectWindow,
              source: "active ephemeris provider current aspect calculation"
            }
          )
        );
      }
    }
  }

  return events;
}

function structuralAspectTone(pair, aspect) {
  const joined = pair.join("-");
  const hard = ["conjunction", "square", "opposition"].includes(aspect.name);
  const supportive = ["trine", "sextile"].includes(aspect.name);

  if (["saturn-pluto", "saturn-uranus", "saturn-neptune"].includes(joined)) {
    return hard ? "pressure" : "transition";
  }
  if (joined === "jupiter-pluto") {
    if (aspect.name === "conjunction") return "volatility";
    return supportive ? "expansion" : "pressure";
  }
  if (joined === "jupiter-uranus") {
    return supportive || aspect.name === "conjunction" ? "expansion" : "volatility";
  }
  if (joined === "mars-pluto") {
    return hard ? "pressure" : "transition";
  }
  if (joined === "mars-uranus") {
    return hard ? "volatility" : "transition";
  }
  return "transition";
}

function structuralAspectNote(pair, aspect, tone) {
  const label = `${titlePlanet(pair[0])}-${titlePlanet(pair[1])} ${aspect.name}`;
  if (pair.includes("saturn") && pair.includes("pluto")) return `${label}: slow structural compression, institutional stress, and deep reorganisation.`;
  if (pair.includes("saturn") && pair.includes("uranus")) return `${label}: stability and disruption are in conflict; system-level stress or forced adaptation can persist.`;
  if (pair.includes("saturn") && pair.includes("neptune")) return `${label}: boundaries, confidence and structures are being dissolved or rebuilt.`;
  if (pair.includes("jupiter") && pair.includes("pluto")) return `${label}: scale, liquidity and power are amplified; supportive or destabilising expression depends on the aspect and wider field.`;
  if (pair.includes("jupiter") && pair.includes("uranus")) return `${label}: expansion and disruption combine; innovation or abrupt repricing can strengthen.`;
  if (pair.includes("mars") && pair.includes("pluto")) return `${label}: concentrated force and escalation raise acute pressure.`;
  if (pair.includes("mars") && pair.includes("uranus")) return `${label}: abrupt force and disruption raise shock sensitivity and volatility.`;
  return `${label}: ${tone} structural macro field.`;
}

function buildStructuralMacroAspects(transits, today, includeWindows = true) {
  const events = [];

  for (const pair of STRUCTURAL_MACRO_PAIRS) {
    const p1 = transits.positions?.[pair[0]];
    const p2 = transits.positions?.[pair[1]];
    if (!p1 || !p2) continue;

    for (const aspect of MACRO_ASPECTS) {
      const orb = directedAspectOrb(p1.degree, p2.degree, aspect.angle);
      const orbLimit = pair.includes("mars") ? 4 : 6;
      if (orb > Math.min(aspect.orb, orbLimit)) continue;

      const nextP1 = { degree: normalizeDegree(p1.degree + Number(p1.speedLongitude || 0)) };
      const nextP2 = { degree: normalizeDegree(p2.degree + Number(p2.speedLongitude || 0)) };
      const nextOrb = directedAspectOrb(nextP1.degree, nextP2.degree, aspect.angle);
      const phase = orb <= 0.5 ? "PEAK" : nextOrb < orb ? "APPLYING" : "SEPARATING";
      const tone = structuralAspectTone(pair, aspect);
      const strength = Math.max(4, Math.round((aspect.orb - orb + 1) * 2));
      const aspectWindow = includeWindows ? aspectWindowAtDate(pair, aspect, today, Math.min(aspect.orb, orbLimit)) : null;

      events.push(event(
        `${titlePlanet(pair[0])}-${titlePlanet(pair[1])} ${aspect.name}`,
        tone,
        strength,
        structuralAspectNote(pair, aspect, tone),
        today,
        phase,
        0,
        {
          planets: pair,
          aspect: aspect.name,
          orb: Number(orb.toFixed(3)),
          orbTrend: nextOrb < orb ? "tightening" : "separating",
          ...aspectWindow,
          source: "active Swiss structural-aspect calculation"
        }
      ));
    }
  }

  return events;
}

function planetOverlapFromEvents(events) {
  const overlap = {};

  for (const item of events || []) {
    for (const planet of item.planets || []) {
      overlap[planet] = (overlap[planet] || 0) + 1;
    }
  }

  return overlap;
}

function buildEventClusters(events, windowDays = 7) {
  const dated = dedupeEvents(events || [])
    .filter(item => typeof item.daysRemaining === "number")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const clusters = [];

  for (let i = 0; i < dated.length; i += 1) {
    const base = dated[i];
    const members = dedupeEvents(dated.filter(item => Math.abs(item.daysRemaining - base.daysRemaining) <= windowDays));

    if (members.length >= 2) {
      const key = members.map(item => eventRootKey(item)).sort().join("|");

      if (!clusters.some(cluster => cluster.key === key)) {
        clusters.push({
          key,
          centerDate: base.date,
          centerDaysRemaining: base.daysRemaining,
          density: members.length,
          labels: members.map(item => item.label),
          windowDays,
          summary: `${members.length} macro events within ±${windowDays} days of ${base.date}`
        });
      }
    }
  }

  return clusters.slice(0, 8);
}

function buildShadowWindows(today, activeEvents, phases) {
  const all = [...(activeEvents || []), ...(phases || [])];

  const eclipse = all.find(item => String(item.label || "").toLowerCase().includes("eclipse") && Math.abs(Number(item.daysRemaining ?? 999)) <= 30);
  const mercury = all.find(item => String(item.label || "").toLowerCase().includes("mercury") && String(item.label || "").toLowerCase().includes("retrograde") && Math.abs(Number(item.daysRemaining ?? 999)) <= 14);
  const saturn = all.find(item => String(item.label || "").toLowerCase().includes("saturn") && String(item.label || "").toLowerCase().includes("retrograde") && Math.abs(Number(item.daysRemaining ?? 999)) <= 21);
  const aspect = all.find(item => Array.isArray(item.planets) && Math.abs(Number(item.daysRemaining ?? 999)) <= 7);

  return {
    eclipse: Boolean(eclipse),
    mercuryStation: Boolean(mercury),
    saturnStation: Boolean(saturn),
    aspect: Boolean(aspect),
    activeLabels: [...new Set([eclipse, mercury, saturn, aspect]
      .filter(Boolean)
      .map(item => item.label))]
  };
}

function buildMacroSignature(activeEvents, phases, eventClusters) {
  const focus = dedupeEvents([...(activeEvents || []), ...(phases || []).filter(item => Number(item.daysRemaining ?? 999) <= 14)])
    .map(item => item.label)
    .filter(Boolean)
    .slice(0, 6);

  if (!focus.length) {
    return eventClusters?.length
      ? `Cluster approaching: ${eventClusters[0].labels.slice(0, 3).join(" + ")}`
      : "Quiet macro sky";
  }

  return focus.join(" / ");
}

function phaseLabel(days) {
  const abs = Math.abs(days);

  if (abs <= 3) {
    return "PEAK";
  }

  if (days < 0) {
    return "SEPARATING";
  }

  return "APPLYING";
}

function todayIso(date) {
  return (
    date ||
    new Date()
      .toISOString()
      .split("T")[0]
  );
}

function moonClimate(moonDegree) {
  const element = getElement(moonDegree);

  if (element === "water") {
    return "Emotional";
  }

  if (element === "fire") {
    return "Aggressive";
  }

  if (element === "air") {
    return "Narrative";
  }

  return "Practical";
}

function event(label, type, strength, notes, date, phase, daysRemaining, extra = {}) {
  return {
    label,
    type,
    strength,
    notes,
    phase,
    daysRemaining,
    date,
    ...extra
  };
}

function eventIdentity(item) {
  const label = String(item?.label || item?.name || "").toLowerCase().trim();
  const date = String(item?.date || "").slice(0, 10);
  const aspect = String(item?.aspect || "").toLowerCase();
  const planets = Array.isArray(item?.planets) ? item.planets.join("-").toLowerCase() : "";
  return [label, date, aspect, planets].filter(Boolean).join("|");
}

function eventRootKey(item) {
  const label = String(item?.label || item?.name || "").toLowerCase().trim();
  const aspect = String(item?.aspect || "").toLowerCase();
  const planets = Array.isArray(item?.planets) ? item.planets.join("-").toLowerCase() : "";
  return [label, aspect, planets].filter(Boolean).join("|");
}

function dedupeEvents(events, { activeRoots = new Set(), dropActiveDuplicates = false } = {}) {
  const seen = new Set();
  const output = [];

  for (const item of events || []) {
    const root = eventRootKey(item);

    if (dropActiveDuplicates && activeRoots.has(root)) {
      continue;
    }

    const key = eventIdentity(item) || root;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);
  }

  return output;
}

function normalizeStaticEvent(item) {
  if (!item) return null;
  const lower = String(item.label || item.name || "").toLowerCase();
  let type = item.type;
  let resultingEnvironment = item.resultingEnvironment;
  let label = item.label;
  let name = item.name;
  let notes = item.notes;

  if (item.kind === "eclipse" || lower.includes("eclipse")) {
    const eclipseKind = item.eclipseKind || item.type || (lower.includes("solar") ? "solar" : lower.includes("lunar") ? "lunar" : "eclipse");
    const eclipseType = item.eclipseType || `${String(eclipseKind).charAt(0).toUpperCase()}${String(eclipseKind).slice(1)} Eclipse`;
    const sign = item.sign || "unknown sign";
    const degreeValue = Number(item.degree ?? item.siderealLongitude);
    const degreeText = Number.isFinite(degreeValue) ? degreeValue.toFixed(2) : "unknown";

    label = item.label || `${eclipseType.replace(/\b\w/g, c => c.toUpperCase())} in ${sign}`;
    name = item.name && !String(item.name).includes("undefined") ? item.name : eclipseType;
    resultingEnvironment = item.resultingEnvironment || (String(eclipseKind).toLowerCase() === "solar" ? "RESET / VISIBILITY" : "CULMINATION / VOLATILITY");
    notes = item.notes && !String(item.notes).includes("undefined")
      ? item.notes
      : `${label} at ${degreeText}° ${sign}.`;
  }

  if (lower.includes("saturn-venus") && (lower.includes("trine") || lower.includes("sextile"))) {
    type = "expansion";
    resultingEnvironment = "DISCIPLINED EXPANSION / VALUATION REPAIR";
  }

  if (lower.includes("mars-saturn") && (lower.includes("trine") || lower.includes("sextile"))) {
    type = "transition";
    resultingEnvironment = "DISCIPLINED EXECUTION / FRICTION TEST";
  }

  return {
    ...item,
    label,
    name,
    notes,
    type,
    resultingEnvironment,
    eventPrecision: item.eventPrecision || "direct-swiss-refined",
    precisionNote: item.precisionNote || "Timestamp is derived from direct Swiss Ephemeris calculations."
  };
}


function hardenEclipseEvent(item) {
  if (!item) return item;
  const lower = String(item.label || item.name || item.eclipseType || "").toLowerCase();
  const isEclipse = item.kind === "eclipse" || lower.includes("eclipse") || item.eclipseKind || item.eclipseType;
  if (!isEclipse) return item;

  const kindRaw = String(item.eclipseKind || item.type || (lower.includes("solar") ? "solar" : lower.includes("lunar") ? "lunar" : "eclipse")).toLowerCase();
  const kind = kindRaw.includes("solar") ? "solar" : kindRaw.includes("lunar") ? "lunar" : "eclipse";
  const typeText = String(item.eclipseType || (kind === "solar" ? "Solar Eclipse" : kind === "lunar" ? "Lunar Eclipse" : "Eclipse"));
  const prettyType = typeText
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
  const sign = item.sign || "unknown sign";
  const degreeValue = Number(item.degree ?? item.siderealLongitude ?? item.longitude);
  const degreeText = Number.isFinite(degreeValue) ? degreeValue.toFixed(2) : "unknown";
  const cleanLabel = (item.label && !String(item.label).toLowerCase().includes("undefined"))
    ? item.label
    : `${prettyType} in ${sign}`;

  return {
    ...item,
    label: cleanLabel,
    name: cleanLabel,
    notes: `${cleanLabel} at ${degreeText}° ${sign}.`,
    resultingEnvironment: item.resultingEnvironment || (kind === "solar" ? "RESET / VISIBILITY" : "CULMINATION / VOLATILITY"),
    eventPrecision: item.eventPrecision || "direct-swiss-exact",
    precisionNote: item.precisionNote || "Eclipse maximum is returned directly by Swiss Ephemeris."
  };
}

function hardenEclipseEvents(events) {
  return (events || []).map(hardenEclipseEvent);
}

function buildAspectEvents(transits, today, includeWindows = true) {
  const activeEvents = [];

  const jupiterRahuConj = aspectOrb(transits.jupiter, transits.rahu, 0);
  const jupiterRahuTrine = aspectOrb(transits.jupiter, transits.rahu, 120);
  const saturnRahuConj = aspectOrb(transits.saturn, transits.rahu, 0);
  const saturnRahuSquare = aspectOrb(transits.saturn, transits.rahu, 90);
  const saturnJupiterHard = Math.min(
    aspectOrb(transits.saturn, transits.jupiter, 90),
    aspectOrb(transits.saturn, transits.jupiter, 180)
  );

  if (jupiterRahuConj <= 8 || jupiterRahuTrine <= 6) {
    activeEvents.push(
      event(
        "Jupiter-Rahu amplification",
        "expansion",
        Math.round(18 - Math.min(jupiterRahuConj, jupiterRahuTrine)),
        "Expansion plus amplification; can support leadership or speculative heat depending on natal response.",
        today,
        "ACTIVE",
        0,
        { source: "active ephemeris provider aspect calculation" }
      )
    );
  }

  if (saturnRahuConj <= 8 || saturnRahuSquare <= 6) {
    activeEvents.push(
      event(
        "Saturn-Rahu compression",
        "pressure",
        Math.round(18 - Math.min(saturnRahuConj, saturnRahuSquare)),
        "Fear/greed instability, delays, churning, and pressure on weak structures.",
        today,
        "ACTIVE",
        0,
        { source: "active ephemeris provider aspect calculation" }
      )
    );
  }

  if (saturnJupiterHard <= 7) {
    activeEvents.push(
      event(
        "Jupiter-Saturn tension",
        "transition",
        Math.round(16 - saturnJupiterHard),
        "Expansion and restraint are both active; transition/compression environment.",
        today,
        "ACTIVE",
        0,
        { source: "active ephemeris provider aspect calculation" }
      )
    );
  }

  activeEvents.push(...buildCurrentMacroAspects(transits, today, includeWindows));
  activeEvents.push(...buildStructuralMacroAspects(transits, today, includeWindows));

  return activeEvents;
}

function currentRetrogradeEvents(transits, today, includeWindows = true) {
  const events = [];

  for (const planet of ["mercury", "venus", "mars", "jupiter", "saturn"]) {
    const position = transits.positions?.[planet];

    if (!position?.retrograde) {
      continue;
    }

    events.push(
      event(
        `${planet.toUpperCase()} retrograde active`,
        planet === "mercury" ? "volatility" : "transition",
        planet === "mercury" ? 12 : 8,
        `${planet} is retrograde in ${position.sign}; interpret as review, delay, reversal, or internalisation depending on natal contact.`,
        today,
        "ACTIVE",
        0,
        {
          planet,
          sign: position.sign,
          degree: position.degree,
          speedLongitude: position.speedLongitude,
          ...(includeWindows ? retrogradeWindowAtDate(planet, today) : null),
          source: "active ephemeris provider speed calculation"
        }
      )
    );
  }

  return events;
}

function behaviourOutline(environment, activeEvents, transits) {
  const notes = [];

  if (environment === "EXTREME PRESSURE" || environment === "HIGH PRESSURE" || environment === "PRESSURE") {
    notes.push("Pressure-dominant sky: caution, compression, weak structures under stress.");
  } else if (environment === "EXPANSION") {
    notes.push("Expansion-dominant sky: improved risk appetite, leadership search, rerating potential.");
  } else if (environment === "VOLATILE TRANSITION") {
    notes.push("Volatile transition: resets, rotations, false starts, and leadership change are more likely.");
  } else {
    notes.push("Balanced sky: no dominant macro astro force; stock-specific natal activations matter more.");
  }

  if (activeEvents.some(e => e.label?.includes("MERCURY") && e.label?.includes("retrograde"))) {
    notes.push("Mercury retrograde is active: expect narrative confusion, data/communication revisions, and choppy decision-making.");
  }

  if (activeEvents.some(e => e.label?.toLowerCase().includes("eclipse"))) {
    notes.push("Eclipse shadow is active: inflection potential is present; natal planet contacts should be checked stock-by-stock.");
  }

  if (transits?.positions?.jupiter?.sign) {
    notes.push(`Jupiter is in ${transits.positions.jupiter.sign}: expansion themes are filtered through this sign.`);
  }

  if (transits?.positions?.saturn?.sign) {
    notes.push(`Saturn is in ${transits.positions.saturn.sign}: pressure/restructuring themes are filtered through this sign.`);
  }

  return notes;
}


function formatDays(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "timing unknown";
  }

  const value = Number(days);

  if (Math.abs(value) < 0.25) {
    return "active now";
  }

  if (value < 0) {
    return `${Math.abs(value).toFixed(1)} days ago`;
  }

  return `in ${value.toFixed(1)} days`;
}

function toneForEvent(eventItem) {
  const type = String(eventItem?.type || "").toLowerCase();
  const label = String(eventItem?.label || "").toLowerCase();
  const result = String(eventItem?.resultingEnvironment || "").toLowerCase();

  // The engine type is authoritative; a planet name cannot override it.
  if (["pressure", "volatility", "reset", "expansion", "transition"].includes(type)) return type;

  if (label.includes("saturn-venus") && (label.includes("trine") || label.includes("sextile"))) {
    return "expansion";
  }

  if (label.includes("mars-saturn") && (label.includes("trine") || label.includes("sextile"))) {
    return "transition";
  }

  if (type.includes("pressure") || result.includes("pressure") || label.includes("hard")) {
    return "pressure";
  }

  if (type.includes("volatility") || result.includes("volatility") || label.includes("retrograde") || label.includes("lunar")) {
    return "volatility";
  }

  if (type.includes("reset") || result.includes("reset") || label.includes("eclipse")) {
    return "reset";
  }

  if (type.includes("expansion") || result.includes("expansion")) {
    return "expansion";
  }

  if (type.includes("transition") || result.includes("shift") || label.includes("ingress") || label.includes("saturn")) {
    return "transition";
  }

  return "monitoring";
}

function buildMacroForceLedger(activeEvents = [], phases = [], scores = {}) {
  const horizonDays = 14;
  const applying = (phases || [])
    .filter(item => {
      const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
      return Number.isFinite(days) && days >= 0 && days <= horizonDays;
    })
    .map(item => ({
      label: item.label || item.name || "Macro event",
      date: item.date || null,
      daysRemaining: Number(item.daysRemaining ?? item.daysTill ?? 0),
      tone: toneForEvent(item)
    }));

  const byTone = tone => applying.filter(item => item.tone === tone);
  const applyingPressure = [...byTone("pressure"), ...byTone("volatility")];

  return {
    support: Number(scores.support || 0),
    pressure: Number(scores.pressure || 0),
    reset: Number(scores.reset || 0),
    volatility: Number(scores.volatility || 0),
    transition: Number(scores.transition || 0),
    activeSupportNodes: activeEvents.filter(item => item.type === "expansion").map(item => item.label),
    activePressureNodes: activeEvents.filter(item => ["pressure", "volatility"].includes(item.type)).map(item => item.label),
    activeResetNodes: activeEvents.filter(item => item.type === "reset").map(item => item.label),
    activeTransitionNodes: activeEvents.filter(item => item.type === "transition").map(item => item.label),
    applyingHorizonDays: horizonDays,
    applyingPressureNodes: applyingPressure,
    applyingSupportNodes: byTone("expansion"),
    applyingResetNodes: byTone("reset"),
    applyingTransitionNodes: byTone("transition")
  };
}

function classifyMacroSovereignty(forces) {
  const support = Number(forces.support || 0);
  const pressure = Number(forces.pressure || 0);
  const reset = Number(forces.reset || 0);
  const volatility = Number(forces.volatility || 0);
  const transition = Number(forces.transition || 0);
  const applyingPressureCount = forces.applyingPressureNodes?.length || 0;
  const applyingSupportCount = forces.applyingSupportNodes?.length || 0;
  const pressureAdvancing = applyingPressureCount >= 2;
  const resetActive = reset >= 15;
  const supportActive = support >= 20;

  let environment = "BALANCED";
  let label = "BALANCED";
  let stage = "BALANCED";
  let dominantForce = "balanced";
  let message = "Macro forces are balanced; stock-specific natal catalysts matter more than the broad field.";

  if (pressure >= MACRO_PRESSURE_THRESHOLDS.extreme && pressure >= support) {
    environment = "EXTREME PRESSURE";
    label = resetActive ? "EXTREME PRESSURE · INFLECTION ACTIVE" : "EXTREME PRESSURE";
    stage = resetActive ? "EXTREME_PRESSURE_RESET" : "EXTREME_PRESSURE";
    dominantForce = "pressure";
    message = resetActive
      ? "Extreme pressure is sovereign inside an active inflection corridor; supportive nodes remain subordinate until the pressure sequence separates."
      : "Extreme pressure is sovereign; later support must first survive the active pressure sequence.";
  } else if (pressure >= MACRO_PRESSURE_THRESHOLDS.high && (pressure >= support * 0.8 || pressureAdvancing || resetActive)) {
    environment = "HIGH PRESSURE";
    label = resetActive ? "HIGH PRESSURE · INFLECTION ACTIVE" : "HIGH PRESSURE";
    stage = resetActive ? "HIGH_PRESSURE_RESET" : "HIGH_PRESSURE";
    dominantForce = "pressure";
    message = resetActive
      ? "High pressure leads the model field inside an active eclipse inflection window."
      : "High pressure is controlling immediate expression; supportive contacts are not yet sovereign.";
  } else if (resetActive && (pressure >= MACRO_PRESSURE_THRESHOLDS.pressure || pressureAdvancing)) {
    environment = "PRESSURE";
    label = supportActive ? "PRESSURE · INFLECTION · SUPPORT ACTIVE" : "PRESSURE · INFLECTION";
    stage = supportActive ? "PRESSURE_RESET_WITH_SUPPORT" : "PRESSURE_RESET";
    dominantForce = "pressure-reset";
    message = supportActive
      ? "The model field is pressure-led inside an active eclipse window; supportive events are also active."
      : "The model field is pressure-led inside an active eclipse window.";
  } else if (supportActive && pressure >= MACRO_PRESSURE_THRESHOLDS.pressure) {
    if (!pressureAdvancing && support >= pressure + 8) {
      environment = "EXPANSION";
      label = "CONTESTED EXPANSION";
      stage = "EXPANSION_WITH_PRESSURE";
      dominantForce = "support";
      message = "Expansion is leading, but active pressure can create uneven or selective expression.";
    } else {
      environment = "PRESSURE";
      label = "PRESSURE — SUPPORT ACTIVE";
      stage = "PRESSURE_WITH_SUPPORT";
      dominantForce = "pressure";
      message = "Pressure controls immediate expression while a meaningful supportive network remains active underneath.";
    }
  } else if (supportActive && !resetActive && !pressureAdvancing) {
    environment = "EXPANSION";
    label = "EXPANSION";
    stage = "EXPANSION_SOVEREIGN";
    dominantForce = "support";
    message = "Macro expansion is active where stock-specific natal contacts are receptive.";
  } else if (pressure >= MACRO_PRESSURE_THRESHOLDS.pressure) {
    environment = "PRESSURE";
    label = "PRESSURE";
    stage = pressureAdvancing ? "PRESSURE_ADVANCING" : "PRESSURE_ACTIVE";
    dominantForce = "pressure";
    message = pressureAdvancing
      ? "Pressure is active and the next pressure nodes are still applying."
      : "Macro pressure is active; stock-specific support determines resilience and repair.";
  } else if (resetActive) {
    environment = "VOLATILE TRANSITION";
    label = "INFLECTION TRANSITION";
    stage = "RESET_TRANSITION";
    dominantForce = "reset";
    message = "An inflection corridor is active. This marks concentrated turning-point and volatility potential; it is not automatically expansion or pressure until the surrounding sequence takes control.";
  } else if (volatility >= 30 || transition >= 8 || (pressure >= 10 && volatility >= 12)) {
    environment = "VOLATILE TRANSITION";
    label = "VOLATILE TRANSITION";
    stage = "VOLATILE_TRANSITION";
    dominantForce = "volatility";
    message = "Macro volatility is transition-heavy; pressure and support are not yet cleanly sovereign.";
  }

  return {
    environment,
    label,
    stage,
    dominantForce,
    message,
    supportActive,
    resetActive,
    pressureAdvancing,
    applyingPressureCount,
    applyingSupportCount,
    rule: "active-force separation + 14-day applying sequence; scores alone do not establish dominance"
  };
}

function actionForEnvironment(environment, pressure, expansion, volatility) {
  if (environment === "EXTREME PRESSURE" || pressure >= MACRO_PRESSURE_THRESHOLDS.extreme) {
    return "Extreme pressure field active";
  }

  if (environment === "HIGH PRESSURE" || pressure >= MACRO_PRESSURE_THRESHOLDS.high) {
    return "High pressure field active";
  }

  if (environment === "PRESSURE" || pressure >= MACRO_PRESSURE_THRESHOLDS.pressure || volatility >= 30) {
    return "Pressure or transition field active";
  }

  if (environment === "EXPANSION" && expansion >= 25) {
    return "Expansion field active";
  }

  if (environment === "VOLATILE TRANSITION") {
    return "Volatile transition active";
  }

  return "Balanced macro field";
}

function behaviourForTone(tone, item) {
  const label = String(item?.label || "");
  const lower = label.toLowerCase();

  if (lower.includes("saturn-venus") && (lower.includes("trine") || lower.includes("sextile"))) {
    return "Disciplined expansion: valuation repair, selective support, and preference for durable quality where natal Venus/Saturn contacts are receptive.";
  }

  if (lower.includes("mars-saturn") && (lower.includes("trine") || lower.includes("sextile"))) {
    return "Execution test: force meets restraint; constructive only where natal structure can absorb the pressure.";
  }

  if (tone === "pressure") {
    return "Compression, caution, forced review, weaker structures under stress.";
  }

  if (tone === "volatility") {
    return "Choppy decision-making, reversals, headline noise, delayed confirmation.";
  }

  if (tone === "reset") {
    return "Inflection window: turning-point intensity is elevated; natal contacts decide whether expression becomes continuation, climax, reversal or rotation.";
  }

  if (tone === "expansion") {
    return "Expansion window; leadership search, rerating, and confidence can improve where natal support exists.";
  }

  if (tone === "transition") {
    return "Sign or direction shift; market behaviour can rotate as the planetary filter changes.";
  }

  return label ? `${label}: monitor for stock-specific natal response.` : "Stable conditions; stock-specific natal activations matter most.";
}


function macroCatalystPriority(item) {
  if (!item) return 0;
  const label = String(item.label || item.name || "").toLowerCase();
  const kind = String(item.kind || "").toLowerCase();
  const planet = String(item.planet || "").toLowerCase();
  const planets = Array.isArray(item.planets) ? item.planets.map(p => String(p).toLowerCase()) : [];
  const days = Number(item.daysRemaining ?? item.daysTill ?? 999);
  let score = 0;

  const has = (...names) => names.every(name => label.includes(name) || planets.includes(name));

  // v28.0: choose the next regime-changing catalyst, not merely the first chronological event.
  if (label.includes("eclipse")) score += 120;
  if (has("saturn", "jupiter") || has("jupiter", "saturn")) score += 105;
  if (has("jupiter", "rahu") || has("jupiter", "ketu")) score += 98;
  if (has("mars", "saturn") || has("saturn", "mars")) score += 88;
  if (kind === "ingress" || label.includes("ingress")) {
    score += ["jupiter", "saturn", "rahu", "ketu"].includes(planet) ? 76 : 18;
  }
  if (label.includes("retrograde") || label.includes("direct begins") || label.includes("station")) score += 58;

  if (label.includes("jupiter") && (label.includes("venus") || label.includes("mercury") || label.includes("mars"))) score += 42;
  if (label.includes("saturn") && (label.includes("mercury") || label.includes("venus"))) score += 38;
  if (label.includes("rahu") || label.includes("ketu")) score += 34;
  if (label.includes("square") || label.includes("opposition")) score += 25;
  if (label.includes("conjunction")) score += 20;
  if (label.includes("trine") || label.includes("sextile")) score += 10;

  // Keep near catalysts visible, but do not let chronology override regime importance.
  if (Number.isFinite(days)) {
    if (days <= 7) score += 18;
    else if (days <= 30) score += 10;
    else if (days <= 90) score += 3;
  }

  return score;
}

function selectNextMacroCatalyst(phases, activeRoots = new Set()) {
  const upcoming = (phases || [])
    .filter(item => !activeRoots.has(eventRootKey(item)))
    .filter(item => Number(item.daysRemaining ?? item.daysTill ?? 999) > 0.25);

  if (!upcoming.length) return null;

  const major = upcoming
    .map(item => ({ item, priority: macroCatalystPriority(item) }))
    .filter(entry => entry.priority >= 70)
    .sort((a, b) => b.priority - a.priority || Number(a.item.daysRemaining ?? a.item.daysTill ?? 999) - Number(b.item.daysRemaining ?? b.item.daysTill ?? 999));

  return (major[0]?.item) || upcoming[0] || null;
}


function formatNarrativeShift(item) {
  if (!item) return null;
  const tone = toneForEvent(item);
  return {
    label: item.label || item.name,
    date: item.date,
    exactUtc: item.exactUtc,
    exactIst: item.exactIst,
    daysRemaining: item.daysRemaining ?? item.daysTill,
    resultingEnvironment: item.resultingEnvironment,
    notes: item.notes,
    tone,
    likelyBehaviour: behaviourForTone(tone, item),
    source: item.source || "ephemeris-derived",
    eventPrecision: item.eventPrecision || null,
    precisionNote: item.precisionNote || null
  };
}

function forwardPresentationEvents(activeEvents, phases, limit = 8) {
  const futureActive = (activeEvents || []).filter(item => {
    const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
    return Number.isFinite(days) && days > 0.25 && days <= 30;
  });

  const chronological = dedupeEvents([...futureActive, ...(phases || [])])
    .filter(item => {
      const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
      return Number.isFinite(days) && days >= 0 && days <= 30;
    })
    .sort((a, b) =>
      Number(a.daysRemaining ?? a.daysTill ?? 999) -
      Number(b.daysRemaining ?? b.daysTill ?? 999)
    );

  // Reserve space for the complete eclipse corridor before applying the
  // compact display cap. The remaining slots stay strictly chronological.
  const eclipses = chronological.filter(item =>
    /eclipse/i.test(`${item?.label || ""} ${item?.name || ""}`)
  );
  const nonEclipses = chronological.filter(item => !eclipses.includes(item));
  return [...eclipses, ...nonEclipses.slice(0, Math.max(0, limit - eclipses.length))]
    .sort((a, b) =>
      Number(a.daysRemaining ?? a.daysTill ?? 999) -
      Number(b.daysRemaining ?? b.daysTill ?? 999)
    );
}

function buildMacroEventCards(activeEvents, phases) {
  const activeCards = activeEvents.map(item => {
    const tone = toneForEvent(item);

    return {
      label: item.label,
      tone,
      phase: item.phase || "ACTIVE",
      date: item.date,
      daysRemaining: item.daysRemaining ?? 0,
      strength: item.strength ?? 0,
      notes: item.notes,
      behaviour: behaviourForTone(tone, item),
      source: item.source || "ephemeris-derived",
      eventPrecision: item.eventPrecision || null,
      precisionNote: item.precisionNote || null
    };
  });

  // A future-dated eclipse is also part of the active shadow stream. The
  // engine intentionally removes that duplicate from `phases`, so the
  // presentation feed must merge both streams before deduplication.
  const incomingCards = forwardPresentationEvents(activeEvents, phases).map(item => {
    const tone = toneForEvent(item);

    return {
      label: item.label || item.name,
      tone,
      phase: item.timing || "UPCOMING",
      date: item.date,
      exactUtc: item.exactUtc,
      exactIst: item.exactIst,
      daysRemaining: item.daysRemaining ?? item.daysTill,
      resultingEnvironment: item.resultingEnvironment,
      notes: item.notes,
      behaviour: behaviourForTone(tone, item),
      source: item.source || "ephemeris-derived",
      eventPrecision: item.eventPrecision || null,
      precisionNote: item.precisionNote || null
    };
  });

  return {
    activeCards,
    incomingCards
  };
}

function buildMacroNarrative(environment, pressure, expansion, volatility, activeEvents, phases, transits, sovereignty = null) {
  const activeRoots = new Set((activeEvents || []).map(eventRootKey));
  const nextShift = selectNextMacroCatalyst(phases, activeRoots);
  const mainActive = activeEvents[0] || null;
  const focus = mainActive || nextShift;
  const focusTone = toneForEvent(focus || {});
  const jupiterSign = transits?.positions?.jupiter?.sign || "-";
  const saturnSign = transits?.positions?.saturn?.sign || "-";
  const mercuryPosition = transits?.positions?.mercury;

  const environmentLabel = sovereignty?.label || environment;
  const headline =
    activeEvents.length > 0
      ? `${environmentLabel}: ${activeEvents.slice(0, 2).map(item => item.label).join(" + ")}`
      : `${environmentLabel}: stable macro sky, stock-specific natal contacts dominate`;

  const likelyBehaviour =
    focus
      ? behaviourForTone(focusTone, focus)
      : "No dominant macro cluster is active; individual natal charts matter more than broad macro force.";

  const mercuryLine = mercuryPosition?.retrograde
    ? `Mercury is retrograde in ${mercuryPosition.sign}: narrative review, revisions, and false signals need extra patience.`
    : `Mercury is direct in ${mercuryPosition?.sign || "-"}: narrative flow is cleaner unless a station/retrograde window is approaching.`;

  return {
    headline,
    expectedPosition: environmentLabel,
    likelyBehaviour,
    recommendedPosture: actionForEnvironment(environment, pressure, expansion, volatility),
    currentFocus: focus?.label || "Stable Window",
    currentTone: focusTone,
    timing: focus ? formatDays(focus.daysRemaining ?? focus.daysTill ?? 0) : "active now",
    context: [
      `Jupiter in ${jupiterSign}: expansion is filtered through ${jupiterSign}.`,
      `Saturn in ${saturnSign}: pressure/restructuring is filtered through ${saturnSign}.`,
      mercuryLine
    ],
    nextShift: formatNarrativeShift(nextShift)
  };
}

function buildIngressCandidates(today) {
  return [
    nextSignIngress("jupiter", today, 730),
    nextSignIngress("saturn", today, 1095),
    nextSignIngress("rahu", today, 730)
  ].filter(Boolean);
}

function buildRetrogradeCandidates(today) {
  return [
    ...nextRetrogradeTransitions("mercury", today, 365),
    ...nextRetrogradeTransitions("venus", today, 730),
    ...nextRetrogradeTransitions("mars", today, 730),
    ...nextRetrogradeTransitions("jupiter", today, 730),
    ...nextRetrogradeTransitions("saturn", today, 730)
  ];
}

function buildUpcomingEclipseCandidates(today) {
  return getRelevantEclipses(today, {
    daysBefore: 0,
    daysAfter: 365
  }).map(eclipse => ({
    label: `${eclipse.type === "solar" ? "Solar" : "Lunar"} eclipse in ${eclipse.sign}`,
    name: `${eclipse.type} eclipse`,
    date: eclipse.date,
    exactUtc: eclipse.exactUtc,
    exactIst: eclipse.exactIst,
    windowStart: isoDate(addDaysUtc(eclipse.exactUtc || eclipse.date, -30)),
    windowEnd: isoDate(addDaysUtc(eclipse.exactUtc || eclipse.date, 30)),
    exactDate: eclipse.date,
    daysRemaining: Math.max(0, eclipse.daysFromReference),
    daysTill: Math.max(0, eclipse.daysFromReference),
    timing: eclipse.daysFromReference <= 30 ? "NEAR" : "UPCOMING",
    resultingEnvironment: eclipse.type === "solar" ? "RESET / VISIBILITY" : "CULMINATION / VOLATILITY",
    notes: `${eclipse.label || `${eclipse.type === "solar" ? "Solar" : "Lunar"} Eclipse in ${eclipse.sign}`} at ${Number(eclipse.siderealLongitude ?? eclipse.degree).toFixed(2)}° ${eclipse.sign}.`,
    source: eclipse.source,
    eventPrecision: eclipse.eventPrecision,
    precisionNote: eclipse.precisionNote
  }));
}



function shortMeaningForEvent(item) {
  if (item?.notes) return item.notes;
  const meanings = {
    expansion: "Supportive astrological activity; a stronger market return is not established.",
    pressure: "Pressure contribution from the active aspect; market direction is not established.",
    volatility: "Volatility contribution: sensitivity to movement in either direction.",
    reset: "Eclipse inflection contribution; positive or negative direction is not established.",
    transition: "Transition contribution; this is not scored as expansion or pressure."
  };
  return meanings[toneForEvent(item)] || "Context event; no separate score contribution.";
}

function eventTimeLabel(item) {
  const days = Number(item?.daysRemaining ?? item?.daysTill ?? 0);

  if (!Number.isFinite(days)) {
    return item?.date || "timing pending";
  }

  if (Math.abs(days) < 0.25) {
    return "active now";
  }

  if (days < 0) {
    return `${Math.abs(days).toFixed(1)} days ago`;
  }

  return `in ${days.toFixed(1)} days`;
}

function rankOpportunity(item) {
  const tone = toneForEvent(item || {});
  if (tone !== "expansion") return 0;
  const label = String(item?.label || "").toLowerCase();
  let score = 0;

  if (tone === "expansion") score += 40;
  if (label.includes("jupiter")) score += 18;
  if (label.includes("venus")) score += 12;
  if (label.includes("trine") || label.includes("sextile") || label.includes("conjunction")) score += 8;

  const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
  if (days <= 7) score += 12;
  else if (days <= 30) score += 8;
  else if (days <= 60) score += 3;

  return score;
}

function rankRisk(item) {
  const tone = toneForEvent(item || {});
  if (!["pressure", "volatility", "reset"].includes(tone)) return 0;
  const label = String(item?.label || "").toLowerCase();
  let score = 0;

  if (["pressure", "volatility", "reset"].includes(tone)) score += 35;
  if (label.includes("saturn")) score += 14;
  if (label.includes("rahu")) score += 10;
  if (label.includes("retrograde")) score += 10;
  if (label.includes("eclipse")) score += 12;
  if (label.includes("square") || label.includes("opposition")) score += 10;

  const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
  if (days <= 7) score += 12;
  else if (days <= 30) score += 8;
  else if (days <= 60) score += 3;

  return score;
}

function formatReadableEvent(item) {
  if (!item) {
    return null;
  }

  return {
    label: item.label || item.name || "Macro event",
    date: item.date || null,
    exactIst: item.exactIst || null,
    windowStart: item.windowStart || null,
    windowEnd: item.windowEnd || null,
    exactDate: item.exactDate || null,
    timing: eventTimeLabel(item),
    tone: toneForEvent(item),
    meaning: shortMeaningForEvent(item),
    notes: item.notes || null,
    resultingEnvironment: item.resultingEnvironment || null,
    daysRemaining: Number(item.daysRemaining ?? item.daysTill ?? 0),
    phase: item.phase || item.timing || null,
    type: item.type || null,
    strength: Number.isFinite(Number(item.strength)) ? Number(item.strength) : null,
    orb: Number.isFinite(Number(item.orb)) ? Number(item.orb) : null,
    orbTrend: item.orbTrend || null,
    planets: Array.isArray(item.planets) ? item.planets : [],
    source: item.source || null,
    eventPrecision: item.eventPrecision || null,
    precisionNote: item.precisionNote || null
  };
}

function forceContribution(item, active = true) {
  if (!active) return "Forward context only";
  const strength = Number(item?.strength || 0);
  if (item?.type === "expansion") return `Expansion +${strength}`;
  if (["pressure", "volatility"].includes(item?.type)) return `Pressure +${strength}`;
  if (item?.type === "reset") return `Inflection +${strength}`;
  if (item?.type === "transition") return `Transition +${Number((strength * SOURCE_WEIGHTS.transition).toFixed(1))}`;
  return "Context only";
}

function formatMacroEvidence(item, active = true) {
  const readable = formatReadableEvent(item);
  if (!readable) return null;
  return {
    ...readable,
    status: active ? (item.phase || "ACTIVE") : (item.timing || "APPLYING"),
    contribution: forceContribution(item, active),
    explanation: item.notes || shortMeaningForEvent(item),
    evidenceRole: active ? "active score evidence" : "applying sequence evidence"
  };
}

function buildMacroReadable(environment, pressure, expansion, reset, volatility, transition, sortedActiveEvents, phases, transits, shadowWindows, eventClusters, environmentSignature, sovereignty = null) {
  const next30 = forwardPresentationEvents(sortedActiveEvents, phases)
    .map(formatReadableEvent)
    .filter(Boolean);

  const active = sortedActiveEvents
    .slice(0, 5)
    .map(formatReadableEvent)
    .filter(Boolean);

  const opportunityPool = sortedActiveEvents
    .filter(item => item.type === "expansion")
    .sort((a, b) => rankOpportunity(b) - rankOpportunity(a));
  const upcomingOpportunityPool = phases
    .filter(item => toneForEvent(item) === "expansion" && Number(item.daysRemaining ?? item.daysTill ?? -1) > 0)
    .sort((a, b) => Number(a.daysRemaining ?? a.daysTill) - Number(b.daysRemaining ?? b.daysTill));
  const riskPool = sortedActiveEvents
    .filter(item => ["pressure", "volatility", "reset"].includes(item.type))
    .sort((a, b) => rankRisk(b) - rankRisk(a));

  const activeSupport = opportunityPool[0] ? { ...formatReadableEvent(opportunityPool[0]), scope: "active", status: opportunityPool[0].phase || "ACTIVE" } : null;
  const upcomingSupport = upcomingOpportunityPool[0] ? { ...formatReadableEvent(upcomingOpportunityPool[0]), scope: "upcoming", status: "UPCOMING" } : null;
  const mainOpportunity = activeSupport || upcomingSupport || {
    label: "No expansion event mapped", timing: "today", tone: "monitoring",
    meaning: "No expansion contribution is active; this does not establish that market growth is absent."
  };
  const mainRisk = formatReadableEvent(riskPool[0]) || {
    label: "No active pressure event", timing: "today", tone: "monitoring",
    meaning: "No pressure contribution is active in this model."
  };

  const shadowSummary = shadowWindows?.activeLabels?.length
    ? `Shadow/near-window active: ${shadowWindows.activeLabels.slice(0, 4).join(" · ")}.`
    : "No major shadow window is active today.";

  const clusterSummary = eventClusters?.length
    ? `${eventClusters[0].labels.slice(0, 4).join(" + ")} clustered within ±${eventClusters[0].windowDays || 7} days.`
    : "No tight multi-event cluster is dominating the sky.";

  const dominantMessage = sovereignty?.message || (
    environment === "EXPANSION"
      ? "Macro expansion is active where stock-specific natal contacts are supportive."
      : environment === "EXTREME PRESSURE" || environment === "HIGH PRESSURE" || environment === "PRESSURE"
        ? "Macro pressure is active; stock-specific support determines resilience and repair."
        : environment === "VOLATILE TRANSITION"
          ? "Macro volatility is transition-heavy; pressure and support are not yet cleanly sovereign."
          : "Macro tone is balanced; stock-specific natal catalysts matter more than broad market force."
  );
  const environmentLabel = sovereignty?.label || environment;
  const activeEvidence = sortedActiveEvents.map(item => formatMacroEvidence(item, true)).filter(Boolean);
  const applyingEvidence = phases
    .filter(item => {
      const days = Number(item?.daysRemaining ?? item?.daysTill ?? 999);
      return Number.isFinite(days) && days > 0 && days <= 14;
    })
    .map(item => formatMacroEvidence(item, false))
    .filter(Boolean);
  const pressureEvidence = [...activeEvidence, ...applyingEvidence]
    .filter(item => ["pressure", "volatility", "reset"].includes(item.tone))
    .filter((item, index, all) => all.findIndex(other => other.label === item.label && other.date === item.date) === index)
    .slice(0, 8);
  const eclipseEvidence = activeEvidence.filter(item => item.tone === "reset" || /eclipse/i.test(item.label));

  const stockImplication = `${dominantMessage} Active support node: ${activeSupport?.label || "none"}. Next support event: ${upcomingSupport?.label || "none mapped"}. Main pressure node: ${mainRisk.label}.`;

  return {
    headline: `${environmentLabel}: ${dominantMessage}`,
    todaySky: {
      environment,
      environmentLabel,
      environmentStage: sovereignty?.stage || environment,
      pressure,
      expansion,
      reset,
      inflection: reset,
      volatility,
      transition,
      moon: moonClimate(transits.moon),
      jupiter: `${transits.positions?.jupiter?.sign || "-"} ${Number(transits.positions?.jupiter?.degree || 0).toFixed(2)}°`,
      saturn: `${transits.positions?.saturn?.sign || "-"} ${Number(transits.positions?.saturn?.degree || 0).toFixed(2)}°`,
      mercury: `${transits.positions?.mercury?.sign || "-"} ${Number(transits.positions?.mercury?.degree || 0).toFixed(2)}°${transits.positions?.mercury?.retrograde ? " Rx" : ""}`
    },
    mainOpportunity,
    activeSupport,
    upcomingSupport,
    mainRisk,
    next30Days: next30,
    activeNow: active,
    shadowClusterNotes: [
      shadowSummary,
      clusterSummary,
      `Signature: ${environmentSignature}.`
    ],
    pressureExplanation: {
      summary: dominantMessage,
      sequence: pressureEvidence,
      plainMeaning: "Pressure can be active even while supportive aspects exist. The state describes which sequence controls immediate market expression; it does not mean every stock must fall.",
      eclipseClimate: eclipseEvidence.length
        ? `Inflection is active: ${eclipseEvidence.map(item => `${item.label} (${String(item.status || item.phase || "active").toLowerCase()})`).join("; ")}.`
        : "No eclipse climate is active in the current score window."
    },
    researchEvidence: {
      active: activeEvidence,
      applying14Days: applyingEvidence,
      sovereignty: sovereignty || null,
      forceLedger: {
        pressure,
        expansion,
        eclipseInflection: reset,
        volatility,
        transition
      }
    },
    stockImplication,
    researchNotes: {
      activeEventCount: sortedActiveEvents.length,
      phaseCount: phases.length,
      opportunityRank: rankOpportunity(opportunityPool[0] || {}),
      riskRank: rankRisk(riskPool[0] || {}),
      sovereigntyRule: sovereignty?.rule || null
    }
  };
}

function macroScoreBreakdown(events, scores) {
  const slowBodies = new Set(["jupiter", "saturn", "uranus", "neptune", "pluto", "rahu", "ketu"]);
  const pressureEvents = events.filter(item => item.type === "pressure");
  const isSlow = item => {
    const planets = item.planets?.length ? item.planets : String(item.label || "").toLowerCase().match(/sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|rahu|ketu/g) || [];
    return planets.length >= 2 && planets.every(planet => slowBodies.has(planet));
  };
  const total = items => items.reduce((sum, item) => sum + item.strength, 0);
  const slowPressure = total(pressureEvents.filter(isSlow));
  const fasterPressure = total(pressureEvents.filter(item => !isSlow(item)));
  const volatileEvents = total(events.filter(item => item.type === "volatility"));
  const volatilityCore = events.filter(item => ["pressure", "volatility", "reset"].includes(item.type)).reduce((sum, item) => sum + Math.ceil(item.strength / 2), 0);
  const transitionContribution = weightedTransitionScore(events);
  return {
    pressure: { slowPressure, fasterPressure, volatileEvents, uncapped: slowPressure + fasterPressure + volatileEvents, total: scores.pressure },
    volatility: { eventContribution: volatilityCore, transitionContribution, uncapped: Number((volatilityCore + transitionContribution).toFixed(1)), total: scores.volatility },
    expansion: { uncapped: total(events.filter(item => item.type === "expansion")), total: scores.expansion },
    inflection: { uncapped: total(events.filter(item => item.type === "reset")), total: scores.reset },
    note: "Contributions use the existing weights. Pressure and volatility share events; these are model points, not probabilities or expected market returns. Slow pressure uses pressure events whose planets are all Jupiter, Saturn, the outer planets or the lunar nodes."
  };
}

function scoreActiveMacroEvents(activeEvents) {
  const pressure = activeEvents
    .filter(item => ["pressure", "volatility"].includes(item.type))
    .reduce((sum, item) => sum + item.strength, 0);

  const transition = weightedTransitionScore(activeEvents);

  const expansion = activeEvents
    .filter(item => item.type === "expansion")
    .reduce((sum, item) => sum + item.strength, 0);

  const reset = activeEvents
    .filter(item => item.type === "reset")
    .reduce((sum, item) => sum + item.strength, 0);

  const volatility = activeEvents
    .filter(item => ["volatility", "reset", "pressure"].includes(item.type))
    .reduce((sum, item) => sum + Math.ceil(item.strength / 2), 0) + transition;

  const normalizedPressure = Number(Math.min(100, pressure).toFixed(1));
  const normalizedExpansion = Number(Math.min(100, expansion).toFixed(1));
  const normalizedReset = Number(Math.min(100, reset).toFixed(1));
  const normalizedVolatility = Number(Math.min(100, volatility).toFixed(1));
  const normalizedTransition = Number(Math.min(100, transition).toFixed(1));
  const scoreBreakdown = macroScoreBreakdown(activeEvents, { pressure: normalizedPressure, expansion: normalizedExpansion, volatility: normalizedVolatility, reset: normalizedReset });
  return { pressure: normalizedPressure, expansion: normalizedExpansion, reset: normalizedReset,
    volatility: normalizedVolatility, transition: normalizedTransition, scoreBreakdown };
}

function currentMacroEvents(date, includeWindows = true) {
  const today = todayIso(date);
  const transits = generateRealTransits(today);
  const activeEvents = buildAspectEvents(transits, today, includeWindows);

  activeEvents.push(...currentRetrogradeEvents(transits, today, includeWindows));

  const nearbyEclipses = getRelevantEclipses(today, {
    daysBefore: 30,
    daysAfter: 30
  });

  for (const eclipse of nearbyEclipses) {
    const absDays = Math.abs(eclipse.daysFromReference);
    const isActive = absDays <= 30;
    if (!isActive) continue;

    activeEvents.push(
      event(
        `${eclipse.type === "solar" ? "Solar" : "Lunar"} eclipse in ${eclipse.sign}`,
        eclipse.type === "solar" ? "reset" : "volatility",
        Math.max(5, Math.round(30 - absDays)),
        `${eclipse.label || `${eclipse.type === "solar" ? "Solar" : "Lunar"} Eclipse in ${eclipse.sign}`} at ${Number(eclipse.siderealLongitude ?? eclipse.degree).toFixed(2)}° ${eclipse.sign}; shadow window ${isActive ? "active" : "approaching"}.`,
        eclipse.date,
        phaseLabel(eclipse.daysFromReference),
        Number(eclipse.daysFromReference.toFixed(4)),
        {
          exactUtc: eclipse.exactUtc,
          exactIst: eclipse.exactIst,
          windowStart: isoDate(addDaysUtc(eclipse.exactUtc || eclipse.date, -30)),
          windowEnd: isoDate(addDaysUtc(eclipse.exactUtc || eclipse.date, 30)),
          exactDate: eclipse.date,
          source: eclipse.source,
          siderealLongitude: eclipse.siderealLongitude
        }
      )
    );
  }

  return { today, transits, activeEvents };
}

// History skips presentation-window searches and future scans, never score inputs.
export function getMacroHistoryPoint(date) {
  const { today, activeEvents } = currentMacroEvents(date, false);
  const scores = scoreActiveMacroEvents(activeEvents);
  return { date: today, pressure: scores.pressure, expansion: scores.expansion, volatility: scores.volatility };
}

export function getRealEphemeris(date) {
  const { today, transits, activeEvents } = currentMacroEvents(date);
  const upcomingEclipses = buildUpcomingEclipseCandidates(today);

  const ingressCandidates = buildIngressCandidates(today);
  const retrogradeCandidates = buildRetrogradeCandidates(today);
  const aspectCandidates = buildUpcomingAspectCandidates(today);

  const activeRoots = new Set(activeEvents.map(eventRootKey));
  const phases = hardenEclipseEvents(dedupeEvents([
    ...upcomingEclipses.slice(0, 6).map(eclipse => normalizeStaticEvent({
      ...eclipse,
      label: eclipse.label || `${eclipse.eclipseKind === "solar" || eclipse.type === "solar" ? "Solar" : "Lunar"} Eclipse in ${eclipse.sign}`,
      name: eclipse.label || eclipse.eclipseType || `${eclipse.eclipseKind || eclipse.type || ""} eclipse`,
      daysRemaining: eclipse.daysRemaining ?? Math.max(0, eclipse.daysFromReference ?? eclipse.daysTill ?? 0),
      daysTill: eclipse.daysTill ?? eclipse.daysRemaining ?? Math.max(0, eclipse.daysFromReference ?? 0),
      timing: (eclipse.daysRemaining ?? eclipse.daysTill ?? eclipse.daysFromReference ?? 999) <= 30 ? "NEAR" : "UPCOMING",
      resultingEnvironment: eclipse.resultingEnvironment || ((eclipse.eclipseKind || eclipse.type) === "solar" ? "RESET / VISIBILITY" : "CULMINATION / VOLATILITY"),
      notes: eclipse.notes || `${eclipse.label || `${eclipse.eclipseKind === "solar" || eclipse.type === "solar" ? "Solar" : "Lunar"} Eclipse in ${eclipse.sign}`} at ${Number(eclipse.siderealLongitude ?? eclipse.degree).toFixed(2)}° ${eclipse.sign}.`
    })),
    ...ingressCandidates.map(ingress => normalizeStaticEvent({
      ...ingress,
      label: ingress.label || `${ingress.planet.toUpperCase()} ingress ${ingress.from} → ${ingress.to}`,
      name: ingress.name || `${ingress.planet} ingress`,
      daysRemaining: ingress.daysRemaining ?? ingress.daysTill,
      daysTill: ingress.daysTill ?? ingress.daysRemaining,
      timing: "UPCOMING",
      resultingEnvironment: ingress.resultingEnvironment || "SIGN SHIFT",
      notes: ingress.notes || `${ingress.planet} changes sidereal sign from ${ingress.from} to ${ingress.to} at ${ingress.exactUtc}.`
    })),
    ...aspectCandidates.slice(0, 12).map(aspect => normalizeStaticEvent({
      ...aspect,
      timing: aspect.daysRemaining <= 7 ? "NEAR" : "UPCOMING"
    })),
    ...retrogradeCandidates.map(retro => normalizeStaticEvent({
      ...retro,
      label: retro.label || `${retro.planet.toUpperCase()} ${retro.station}`,
      name: retro.name || `${retro.planet} ${retro.station}`,
      daysRemaining: retro.daysRemaining ?? retro.daysTill,
      daysTill: retro.daysTill ?? retro.daysRemaining,
      timing: (retro.daysTill ?? retro.daysRemaining ?? 999) <= 21 ? "NEAR" : "UPCOMING",
      resultingEnvironment: retro.resultingEnvironment || (retro.planet === "mercury" ? "REVIEW / VOLATILITY" : "RETROGRADE SHIFT"),
      notes: retro.notes || `${retro.planet} ${retro.station} in ${retro.sign} at ${Number(retro.degree).toFixed(2)}° sidereal Lahiri.`
    }))
  ].filter(Boolean), { activeRoots, dropActiveDuplicates: true })
    .sort((a, b) => Number(a.daysRemaining ?? a.daysTill ?? 999) - Number(b.daysRemaining ?? b.daysTill ?? 999)));

  const { pressure: normalizedPressure, expansion: normalizedExpansion, reset: normalizedReset,
    volatility: normalizedVolatility, transition: normalizedTransition, scoreBreakdown } = scoreActiveMacroEvents(activeEvents);
  const sortedActiveEvents = dedupeEvents(activeEvents).sort((a, b) => b.strength - a.strength);
  const forceLedger = buildMacroForceLedger(sortedActiveEvents, phases, {
    support: normalizedExpansion,
    pressure: normalizedPressure,
    reset: normalizedReset,
    inflection: normalizedReset,
    volatility: normalizedVolatility,
    transition: normalizedTransition
  });
  const sovereignty = classifyMacroSovereignty(forceLedger);
  const environment = sovereignty.environment;
  const macroNarrative = buildMacroNarrative(
    environment,
    normalizedPressure,
    normalizedExpansion,
    normalizedVolatility,
    sortedActiveEvents,
    phases,
    transits,
    sovereignty
  );
  const eventClusters = buildEventClusters([...sortedActiveEvents, ...phases], 7);
  const shadowWindows = buildShadowWindows(today, sortedActiveEvents, phases);
  const nearEvents = dedupeEvents(phases.filter(item => Number(item.daysRemaining ?? 999) <= 14));
  const macroEventSet = dedupeEvents([...sortedActiveEvents, ...nearEvents]);
  const macroOverlapIntensity = planetOverlapFromEvents(macroEventSet);
  const weightedMacroOverlapIntensity = weightedOverlapIntensity(macroOverlapIntensity);
  const macroClusterDensity = macroEventSet.length;
  const weightedMacroClusterScore = weightedClusterScore(eventClusters);
  const environmentSignature = buildMacroSignature(sortedActiveEvents, phases, eventClusters);
  const macroCards = buildMacroEventCards(sortedActiveEvents, phases);
  const macroReadable = buildMacroReadable(
    environment,
    normalizedPressure,
    normalizedExpansion,
    normalizedReset,
    normalizedVolatility,
    normalizedTransition,
    sortedActiveEvents,
    phases,
    transits,
    shadowWindows,
    eventClusters,
    environmentSignature,
    sovereignty
  );

  const preferredNextShiftEvent = selectNextMacroCatalyst(phases, new Set(sortedActiveEvents.map(eventRootKey)));
  const preferredNextShift = formatNarrativeShift(preferredNextShiftEvent) || macroNarrative.nextShift || null;
  const finalMacroNarrative = {
    ...macroNarrative,
    nextShift: preferredNextShift
  };

  return {
    today,
    metadata: ephemerisMetadata(),
    transits,
    moonClimate: moonClimate(transits.moon),
    moonSign: getSign(transits.moon),
    scoreBreakdown,
    pressure: normalizedPressure,
    expansion: normalizedExpansion,
    reset: normalizedReset,
    inflection: normalizedReset,
    volatility: normalizedVolatility,
    transition: normalizedTransition,
    environment,
    environmentLabel: sovereignty.label,
    environmentStage: sovereignty.stage,
    dominantForce: sovereignty.dominantForce,
    macroSovereignty: sovereignty,
    behaviourOutline: [
      finalMacroNarrative.likelyBehaviour,
      ...finalMacroNarrative.context,
      shadowWindows.activeLabels.length ? `Shadow windows active/near: ${shadowWindows.activeLabels.join(", ")}.` : "No major macro shadow window is active today.",
      macroClusterDensity ? `Macro cluster density: ${macroClusterDensity}; signature: ${environmentSignature}.` : `Macro cluster density: 0; signature: ${environmentSignature}.`
    ],
    macroAnalytics: {
      shadowWindows,
      overlapIntensity: macroOverlapIntensity,
      weightedOverlapIntensity: weightedMacroOverlapIntensity,
      clusterDensity: macroClusterDensity,
      weightedClusterScore: weightedMacroClusterScore,
      sourceWeights: SOURCE_WEIGHTS,
      pressureThresholds: MACRO_PRESSURE_THRESHOLDS,
      transitionScore: normalizedTransition,
      resetScore: normalizedReset,
      inflectionScore: normalizedReset,
      forceLedger,
      sovereignty,
      eventClusters,
      environmentSignature,
      upcomingAspectCandidates: aspectCandidates.slice(0, 10)
    },
    macroNarrative: finalMacroNarrative,
    macroCards,
    macroReadable,
    activeEvents: sortedActiveEvents,
    phases
  };
}

export default getRealEphemeris;

// Read-only research adapter: no score inputs, weights or event rules changed.
export function getResearchContext(date) {
 const {today,transits,activeEvents}=currentMacroEvents(date,false);
 const scores=scoreActiveMacroEvents(activeEvents);
 return {date:today,P:scores.pressure,E:scores.expansion,V:scores.volatility,
 positions:Object.entries(transits.positions).map(([planet,p])=>({planet,degree:p.degree,sign:p.sign,retrograde:p.retrograde,speed:p.speedLongitude})),
 events:activeEvents.map(e=>({label:e.label,type:e.type,strength:e.strength,phase:e.phase,orb:e.orb,notes:e.notes}))};
}
