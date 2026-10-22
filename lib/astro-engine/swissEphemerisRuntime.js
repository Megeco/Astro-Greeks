import {
  CalculationFlag,
  EclipseType,
  LunarPoint,
  Planet,
  SiderealMode,
  calculatePosition,
  dateToJulianDay,
  findNextLunarEclipse,
  findNextSolarEclipse,
  getAyanamsaExUt,
  julianDayToDate,
  setSiderealMode
} from "@swisseph/node";

const BODY_IDS = Object.freeze({
  sun: Planet.Sun,
  moon: Planet.Moon,
  mercury: Planet.Mercury,
  venus: Planet.Venus,
  mars: Planet.Mars,
  jupiter: Planet.Jupiter,
  saturn: Planet.Saturn,
  uranus: Planet.Uranus,
  neptune: Planet.Neptune,
  pluto: Planet.Pluto,
  rahu: LunarPoint.MeanNode
});

export const SWISS_TROPICAL_FLAGS =
  CalculationFlag.SwissEphemeris |
  CalculationFlag.Speed;

export const SWISS_SIDEREAL_FLAGS =
  SWISS_TROPICAL_FLAGS |
  CalculationFlag.Sidereal;

setSiderealMode(SiderealMode.Lahiri);

function assertDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("Swiss Ephemeris requires a valid UTC date/time.");
  }
}

function assertSwissResult(result, body, date) {
  const returnedFlags = Number(result?.flags || 0);
  const usedSwiss = Boolean(returnedFlags & CalculationFlag.SwissEphemeris);
  const usedMoshier = Boolean(returnedFlags & CalculationFlag.MoshierEphemeris);

  if (!usedSwiss || usedMoshier) {
    throw new Error(
      `Swiss Ephemeris hard failure for ${body} at ${date.toISOString()}: ` +
      `the library did not return SEFLG_SWIEPH (flags=${returnedFlags}).`
    );
  }

  if (![result.longitude, result.latitude, result.distance, result.longitudeSpeed]
    .every(Number.isFinite)) {
    throw new Error(
      `Swiss Ephemeris returned a non-finite position for ${body} at ${date.toISOString()}.`
    );
  }
}

export function swissJulianDay(date) {
  assertDate(date);
  return dateToJulianDay(date);
}

export function calculateSwissPosition(body, date, { sidereal = true } = {}) {
  assertDate(date);

  const normalizedBody = String(body || "").toLowerCase();

  if (normalizedBody === "ketu") {
    const rahu = calculateSwissPosition("rahu", date, { sidereal });
    return {
      ...rahu,
      longitude: (rahu.longitude + 180) % 360,
      body: "ketu",
      derivedFrom: "Swiss Ephemeris mean north node + 180 degrees"
    };
  }

  const bodyId = BODY_IDS[normalizedBody];
  if (bodyId === undefined) {
    throw new Error(`Unsupported Swiss Ephemeris body: ${body}`);
  }

  const julianDay = swissJulianDay(date);
  const flags = sidereal ? SWISS_SIDEREAL_FLAGS : SWISS_TROPICAL_FLAGS;
  const result = calculatePosition(julianDay, bodyId, flags);
  assertSwissResult(result, normalizedBody, date);

  return {
    ...result,
    body: normalizedBody,
    julianDay,
    requestedFlags: flags,
    provider: "Swiss Ephemeris",
    ephemerisMode: "SEFLG_SWIEPH",
    zodiac: sidereal ? "sidereal" : "tropical",
    ayanamsa: sidereal ? "Lahiri" : null
  };
}

export function calculateLahiriAyanamsa(date) {
  const julianDay = swissJulianDay(date);
  const value = getAyanamsaExUt(julianDay, CalculationFlag.SwissEphemeris);

  if (!Number.isFinite(value)) {
    throw new Error(`Swiss Ephemeris failed to calculate Lahiri ayanamsa at ${date.toISOString()}.`);
  }

  return value;
}

function julianDayToUtcDate(julianDay) {
  const value = julianDayToDate(julianDay);
  const hour = Number(value.hour || 0);
  const wholeHour = Math.floor(hour);
  const minuteFloat = (hour - wholeHour) * 60;
  const minute = Math.floor(minuteFloat);
  const secondFloat = (minuteFloat - minute) * 60;
  const second = Math.floor(secondFloat);
  const millisecond = Math.round((secondFloat - second) * 1000);

  return new Date(Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    wholeHour,
    minute,
    second,
    millisecond
  ));
}

function eclipseKind(eclipse, type) {
  if (type === "solar") {
    if (eclipse.isTotal()) return "total";
    if (eclipse.isAnnular()) return "annular";
    if (eclipse.isHybrid()) return "hybrid";
    if (eclipse.isPartial()) return "partial";
    return "solar";
  }

  if (eclipse.type & EclipseType.Total) return "total";
  if (eclipse.type & EclipseType.Partial) return "partial";
  if (eclipse.type & EclipseType.Penumbral) return "penumbral";
  return "lunar";
}

export function findNextSwissEclipse(type, startDate) {
  assertDate(startDate);
  const startJulianDay = swissJulianDay(startDate);
  const eclipse = type === "solar"
    ? findNextSolarEclipse(startJulianDay, CalculationFlag.SwissEphemeris)
    : findNextLunarEclipse(startJulianDay, CalculationFlag.SwissEphemeris);

  if (!eclipse || !Number.isFinite(eclipse.maximum)) {
    throw new Error(`Swiss Ephemeris failed to find the next ${type} eclipse.`);
  }

  return {
    type,
    kind: eclipseKind(eclipse, type),
    maximumJulianDay: eclipse.maximum,
    maximumUtc: julianDayToUtcDate(eclipse.maximum),
    rawTypeFlags: eclipse.type,
    source: "Swiss Ephemeris eclipse search"
  };
}

export function swissRuntimeAudit(date = new Date()) {
  const sun = calculateSwissPosition("sun", date);
  const moon = calculateSwissPosition("moon", date);

  return {
    provider: "Swiss Ephemeris",
    binding: "@swisseph/node",
    ephemerisMode: "SEFLG_SWIEPH",
    fallbackPolicy: "hard-fail",
    returnedFlags: {
      sun: sun.flags,
      moon: moon.flags
    },
    bundledEphemerisVerified: true,
    zodiac: "sidereal",
    ayanamsa: "Lahiri",
    nodeType: "mean lunar node",
    timestampUtc: date.toISOString()
  };
}

export default calculateSwissPosition;
