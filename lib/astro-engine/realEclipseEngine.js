import {
  getBodyPosition,
  getSign
} from "./realTransitGenerator.js";
import {
  findNextSwissEclipse
} from "./swissEphemerisRuntime.js";

const ASPECTS = [
  {
    name: "conjunction",
    angle: 0,
    weight: 3
  },
  {
    name: "sextile",
    angle: 60,
    weight: 1
  },
  {
    name: "square",
    angle: 90,
    weight: -2
  },
  {
    name: "trine",
    angle: 120,
    weight: 2
  },
  {
    name: "opposition",
    angle: 180,
    weight: -3
  }
];

function normalizeDegree(degree) {
  return (((degree % 360) + 360) % 360);
}

function roundDegree(degree) {
  return Number(normalizeDegree(degree).toFixed(2));
}

function angleDifference(a, b) {
  let diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));

  if (diff > 180) {
    diff = 360 - diff;
  }

  return diff;
}

function severity(orb) {
  if (orb <= 2) {
    return "major";
  }

  if (orb <= 5) {
    return "moderate";
  }

  return "weak";
}

function signalStrength(weight, orb, eclipseType) {
  const base = weight * (8 - orb);
  const multiplier = eclipseType === "solar" ? 1.15 : 1;

  return Number((base * multiplier).toFixed(2));
}

function dateOnly(date) {
  return date.toISOString().split("T")[0];
}

function getEclipseSearchRange(referenceDate, daysBefore, daysAfter) {
  const center = new Date(`${referenceDate}T12:00:00Z`);
  const start = new Date(center.getTime() - daysBefore * 86400000);
  const end = new Date(center.getTime() + daysAfter * 86400000);

  return {
    center,
    start,
    end
  };
}

export function getRelevantEclipses(referenceDate, options = {}) {
  const daysBefore = options.daysBefore ?? 30;
  const daysAfter = options.daysAfter ?? 30;

  const {
    center,
    start,
    end
  } = getEclipseSearchRange(referenceDate, daysBefore, daysAfter);

  const eclipses = [];

  for (const type of ["solar", "lunar"]) {
    let cursor = start;

    while (cursor <= end) {
      const eclipse = findNextSwissEclipse(type, cursor);
      const peakDate = eclipse.maximumUtc;
      if (peakDate > end) break;

      const body = type === "solar" ? "sun" : "moon";
      const position = getBodyPosition(body, peakDate);
      const daysFromReference = (peakDate.getTime() - center.getTime()) / 86400000;

      eclipses.push({
        type,
        kind: eclipse.kind,
        label: `${type === "solar" ? "Solar" : "Lunar"} ${eclipse.kind} eclipse in ${position.sign}`,
        date: dateOnly(peakDate),
        exactUtc: peakDate.toISOString(),
        exactIst: new Date(peakDate.getTime() + 5.5 * 3600000).toISOString().replace("Z", "+05:30"),
        daysFromReference: Number(daysFromReference.toFixed(4)),
        siderealLongitude: roundDegree(position.degree),
        sign: getSign(position.degree),
        source: "direct Swiss Ephemeris eclipse search + swe_calc_ut position",
        eventPrecision: "direct-swiss-exact",
        precisionNote: "Eclipse maximum is returned by Swiss Ephemeris; longitude is calculated at that exact UTC timestamp."
      });

      cursor = new Date(peakDate.getTime() + 2 * 86400000);
    }
  }

  return eclipses.sort(
    (a, b) => Math.abs(a.daysFromReference) - Math.abs(b.daysFromReference)
  );
}

function getNatalPlanets(natal) {
  return natal?.planets || natal || {};
}

export function calculateRealEclipseHits(natal, options = {}) {
  const referenceDate =
    options.referenceDate ||
    new Date()
      .toISOString()
      .split("T")[0];

  const orbLimit = options.orbLimit ?? 8;

  const eclipses =
    options.eclipses ||
    getRelevantEclipses(referenceDate, {
      daysBefore: options.daysBefore ?? 30,
      daysAfter: options.daysAfter ?? 30
    });

  const planets = getNatalPlanets(natal);
  const hits = [];

  for (const eclipse of eclipses) {
    for (const [planet, degree] of Object.entries(planets)) {
      if (typeof degree !== "number" || !Number.isFinite(degree)) {
        continue;
      }

      const exactAngle = angleDifference(eclipse.siderealLongitude, degree);

      for (const aspect of ASPECTS) {
        const orb = Math.abs(exactAngle - aspect.angle);

        if (orb <= orbLimit) {
          hits.push({
            eclipseType: eclipse.type,
            eclipseKind: eclipse.kind,
            eclipseDate: eclipse.date,
            daysFromReference: eclipse.daysFromReference,
            eclipseDegree: eclipse.siderealLongitude,
            eclipseSign: eclipse.sign,
            natalPlanet: planet,
            natalDegree: roundDegree(degree),
            aspect: aspect.name,
            exactAngle: Number(exactAngle.toFixed(2)),
            orb: Number(orb.toFixed(2)),
            severity: severity(orb),
            weight: aspect.weight,
            signalStrength: signalStrength(aspect.weight, orb, eclipse.type)
          });
        }
      }
    }
  }

  return hits.sort(
    (a, b) => Math.abs(b.signalStrength) - Math.abs(a.signalStrength)
  );
}

export default calculateRealEclipseHits;
