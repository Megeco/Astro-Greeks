import {
  calculateLahiriAyanamsa,
  calculateSwissPosition,
  swissRuntimeAudit
} from "./swissEphemerisRuntime.js";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces"
];

const SUPPORTED_BODIES = new Set([
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "rahu", "ketu"
]);

export function normalizeDegree(degree) {
  return (((degree % 360) + 360) % 360);
}

export function roundDegree(degree, digits = 4) {
  return Number(normalizeDegree(degree).toFixed(digits));
}

export function parseUtcDate(input, defaultHour = 12) {
  if (input instanceof Date) {
    return new Date(input.getTime());
  }

  if (typeof input === "string" && input.includes("T")) {
    return new Date(input);
  }

  return new Date(`${input}T${String(defaultHour).padStart(2, "0")}:00:00Z`);
}

export function getLahiriAyanamsa(dateOrYear) {
  const date = typeof dateOrYear === "number"
    ? new Date(Date.UTC(dateOrYear, 6, 1, 12, 0, 0))
    : parseUtcDate(dateOrYear);
  return calculateLahiriAyanamsa(date);
}

export function toSidereal(tropicalDegree, date) {
  return normalizeDegree(
    tropicalDegree - getLahiriAyanamsa(date)
  );
}

export function getSignIndex(degree) {
  return Math.floor(normalizeDegree(degree) / 30);
}

export function getSign(degree) {
  return SIGNS[getSignIndex(degree)];
}

export function getElement(degree) {
  const signIndex = getSignIndex(degree);

  if ([0, 4, 8].includes(signIndex)) {
    return "fire";
  }

  if ([1, 5, 9].includes(signIndex)) {
    return "earth";
  }

  if ([2, 6, 10].includes(signIndex)) {
    return "air";
  }

  return "water";
}

function directSwissPosition(planet, date) {
  if (!SUPPORTED_BODIES.has(planet)) {
    throw new Error(`Unsupported planet: ${planet}`);
  }
  return calculateSwissPosition(planet, date, { sidereal: true });
}

function addDays(date, days) {
  const d = parseUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMs(date, ms) {
  return new Date(parseUtcDate(date).getTime() + ms);
}

function speedLongitude(planet, date) {
  return Number(directSwissPosition(planet, parseUtcDate(date)).longitudeSpeed.toFixed(10));
}

function decoratePosition(planet, swiss) {
  const degree = swiss.longitude;
  const speed = swiss.longitudeSpeed;

  return {
    name: planet,
    planet,
    degree: roundDegree(degree),
    longitude: roundDegree(degree),
    rawLongitude: normalizeDegree(degree),
    sign: getSign(degree),
    signIndex: getSignIndex(degree),
    element: getElement(degree),
    speedLongitude: speed,
    retrograde:
      typeof speed === "number"
        ? speed < 0
        : false,
    node:
      planet === "rahu"
        ? "mean north node"
        : planet === "ketu"
          ? "mean south node"
          : undefined,
    latitude: swiss.latitude,
    distance: swiss.distance,
    julianDay: swiss.julianDay,
    returnedFlags: swiss.flags,
    ephemerisMode: swiss.ephemerisMode,
    source: "Swiss Ephemeris direct swe_calc_ut · SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_SIDEREAL"
  };
}

export function getBodyPosition(planet, input, options = {}) {
  const date = parseUtcDate(input);
  const normalizedPlanet = String(planet || "").toLowerCase();
  const swiss = directSwissPosition(normalizedPlanet, date);
  return decoratePosition(normalizedPlanet, swiss);
}

export function generateRealTransits(date, options = {}) {
  const transitDate = parseUtcDate(date);
  const dateOnly = transitDate.toISOString().split("T")[0];

  const planets = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "rahu",
    "ketu"
  ];

  const positions = {};

  for (const planet of planets) {
    positions[planet] = getBodyPosition(planet, transitDate, { preferStatic: false });
  }

  return {
    date: dateOnly,
    dateOnly,
    calculation: "direct Swiss Ephemeris swe_calc_ut with bundled .se1 files",
    ephemeris: "Swiss Ephemeris",
    provider: "direct-swiss",
    ephemerisMode: "SEFLG_SWIEPH",
    fallbackPolicy: "hard-fail",
    zodiac: "sidereal",
    ayanamsa: "Lahiri",
    ayanamsaValue: Number(getLahiriAyanamsa(transitDate).toFixed(6)),
    nodeType: "mean lunar node",
    timeBasis: "UTC noon unless exact time supplied",
    noHardcodedEvents: true,
    sun: positions.sun.degree,
    moon: positions.moon.degree,
    mercury: positions.mercury.degree,
    venus: positions.venus.degree,
    mars: positions.mars.degree,
    jupiter: positions.jupiter.degree,
    saturn: positions.saturn.degree,
    uranus: positions.uranus.degree,
    neptune: positions.neptune.degree,
    pluto: positions.pluto.degree,
    rahu: positions.rahu.degree,
    ketu: positions.ketu.degree,
    positions
  };
}

export function nextSignIngress(planet, startDate, scanDays = 730) {
  const start = parseUtcDate(startDate);
  const startPosition = getBodyPosition(planet, start);
  const startSign = startPosition.signIndex;

  let low = start;
  let high = null;

  for (let i = 1; i <= scanDays; i += 1) {
    const test = addDays(start, i);
    const position = getBodyPosition(planet, test);

    if (position.signIndex !== startSign) {
      low = addDays(start, i - 1);
      high = test;
      break;
    }
  }

  if (!high) {
    return null;
  }

  for (let i = 0; i < 48; i += 1) {
    const mid = new Date((low.getTime() + high.getTime()) / 2);
    const midPosition = getBodyPosition(planet, mid);

    if (midPosition.signIndex === startSign) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const exact = high;
  const exactPosition = getBodyPosition(planet, exact);
  const daysTill = (exact.getTime() - start.getTime()) / 86400000;

  return {
    planet,
    from: startPosition.sign,
    to: exactPosition.sign,
    date: exact.toISOString().split("T")[0],
    exactUtc: exact.toISOString(),
    exactIst: new Date(exact.getTime() + 5.5 * 3600000)
      .toISOString()
      .replace("Z", "+05:30"),
    daysTill: Number(daysTill.toFixed(2)),
    degree: exactPosition.degree,
    source: "direct Swiss Ephemeris ingress scan + binary refinement",
    eventPrecision: "direct-swiss-refined",
    precisionNote: "Every scan and refinement point is calculated by swe_calc_ut with SEFLG_SWIEPH.",
    zodiac: "sidereal",
    ayanamsa: "Lahiri model"
  };
}

export function nextRetrogradeTransitions(planet, startDate, scanDays = 730) {
  if (["sun", "moon", "rahu", "ketu"].includes(planet)) {
    return [];
  }

  const start = parseUtcDate(startDate);
  const events = [];
  let previousDate = start;
  let previousSpeed = speedLongitude(planet, previousDate);
  let previousRetrograde = previousSpeed < 0;

  for (let i = 1; i <= scanDays; i += 1) {
    const testDate = addDays(start, i);
    const currentSpeed = speedLongitude(planet, testDate);
    const currentRetrograde = currentSpeed < 0;

    if (currentRetrograde !== previousRetrograde) {
      let low = previousDate;
      let high = testDate;

      for (let j = 0; j < 44; j += 1) {
        const mid = new Date((low.getTime() + high.getTime()) / 2);
        const midRetrograde = speedLongitude(planet, mid) < 0;

        if (midRetrograde === previousRetrograde) {
          low = mid;
        } else {
          high = mid;
        }
      }

      const exact = high;
      const pos = getBodyPosition(planet, exact);
      const nowRetrograde = speedLongitude(planet, addMs(exact, 60 * 1000)) < 0;
      const daysTill = (exact.getTime() - start.getTime()) / 86400000;

      events.push({
        planet,
        date: exact.toISOString().split("T")[0],
        exactUtc: exact.toISOString(),
        exactIst: new Date(exact.getTime() + 5.5 * 3600000)
          .toISOString()
          .replace("Z", "+05:30"),
        daysTill: Number(daysTill.toFixed(2)),
        station: nowRetrograde ? "retrograde begins" : "direct begins",
        sign: pos.sign,
        degree: pos.degree,
        source: "direct Swiss Ephemeris longitude-speed zero-crossing",
        eventPrecision: "direct-swiss-refined",
        precisionNote: "Station timestamp is binary-refined from direct Swiss longitudeSpeed values.",
        zodiac: "sidereal",
        ayanamsa: "Lahiri model"
      });

      previousRetrograde = currentRetrograde;
    }

    previousDate = testDate;
    previousSpeed = currentSpeed;
  }

  return events;
}

export function ephemerisMetadata() {
  const audit = swissRuntimeAudit(new Date());
  return {
    ...audit,
    ephemeris: "Swiss Ephemeris",
    timeBasis: "Exact UTC; IST shown for readability where relevant",
    noHardcodedEvents: true,
    note: "All active planetary positions are calculated directly with Swiss Ephemeris. Static tables are not an execution path."
  };
}

export default generateRealTransits;
