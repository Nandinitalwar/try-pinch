// Natal chart computation using astronomy-engine (pure JS ephemeris, ±1 arcmin)
// Replaces LLM-guessed placements with real astronomical positions.

import {
  Body,
  Ecliptic,
  GeoVector,
  SunPosition,
  EclipticGeoMoon,
  SiderealTime,
  MakeTime,
} from 'astronomy-engine'

export interface Placement {
  body: string
  sign: string
  degree: number // 0-30 within the sign
  longitude: number // 0-360 ecliptic longitude
}

export interface NatalChart {
  placements: Placement[]
  ascendant: Placement | null // null when birth time unknown
  utcBirthTime: string
  calculationVersion?: 'tropical-geocentric-v2'
  zodiac?: 'tropical'
  birthTimeKnown?: boolean
  accuracy?: {
    ephemeris: 'astronomy-engine'
    coordinates: 'geocentric'
    moon: {
      certainty: 'exact-time' | 'stable-for-birth-date' | 'sign-change-possible' | 'ambiguous-local-time'
      possibleSigns: string[]
      windowStartUtc?: string
      windowEndUtc?: string
    }
    ascendant: 'exact-time' | 'approximate-time' | 'ambiguous-local-time' | 'unavailable'
    possibleAscendantSigns?: string[]
    possibleAscendants?: Placement[]
    utcCandidates?: string[]
  }
}

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]

const DEG = Math.PI / 180

function toPlacement(body: string, longitude: number): Placement {
  const lon = ((longitude % 360) + 360) % 360
  return {
    body,
    sign: SIGNS[Math.floor(lon / 30)],
    degree: Math.round((lon % 30) * 10) / 10,
    longitude: Math.round(lon * 100) / 100,
  }
}

export function validateBirthDate(value: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('birthDate must use YYYY-MM-DD')

  const [, year, month, day] = match.map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid birthDate: ${value}`)
  }
}

function normaliseBirthTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) throw new Error('birthTime must use HH:MM or HH:MM:SS')
  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = Number(match[3] || '0')
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid birthTime: ${value}`)
  }
  return `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`
}

export function validateBirthTime(value: string): void {
  normaliseBirthTime(value)
}

function validateTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
  } catch {
    throw new Error(`Invalid IANA timezone: ${value}`)
  }
}

function wallClockEpoch(epochMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(epochMs))
  const get = (type: string) => parts.find(part => part.type === type)?.value || '00'
  // hour "24" means midnight in some ICU versions.
  const hour = get('hour') === '24' ? '00' : get('hour')
  return Date.parse(`${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`)
}

/**
 * Convert a local birth date/time in an IANA timezone to a UTC Date.
 * Two-pass correction handles DST transitions.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  validateBirthDate(dateStr)
  validateTimezone(timeZone)
  const normalisedTime = normaliseBirthTime(timeStr || '12:00:00')
  const naive = Date.parse(`${dateStr}T${normalisedTime}Z`)

  let utc = naive - (wallClockEpoch(naive, timeZone) - naive)
  utc = utc - (wallClockEpoch(utc, timeZone) - naive) // second pass for DST edges
  const result = new Date(utc)

  // Reject nonexistent local times during a DST spring-forward gap rather
  // than silently calculating a chart for a different wall-clock time.
  if (wallClockEpoch(utc, timeZone) !== naive) {
    throw new Error(`${dateStr} ${normalisedTime} does not exist in ${timeZone}`)
  }

  return result
}

/**
 * Return every UTC instant matching a local wall time. Most inputs have one;
 * a DST fall-back can have two. The chart must not call that second case an
 * exact rising sign without knowing which occurrence the birth record meant.
 */
export function zonedTimeToUtcCandidates(dateStr: string, timeStr: string, timeZone: string): Date[] {
  const primary = zonedTimeToUtc(dateStr, timeStr, timeZone)
  const normalisedTime = normaliseBirthTime(timeStr)
  const desiredWallClock = Date.parse(`${dateStr}T${normalisedTime}Z`)
  const matches = new Map<number, Date>([[primary.getTime(), primary]])

  // Modern DST transitions are usually 30, 60, or 120 minutes. Scan a
  // three-hour window in 30-minute increments to cover all of those without
  // depending on a timezone database API Node does not expose.
  for (let minutes = -180; minutes <= 180; minutes += 30) {
    if (minutes === 0) continue
    const candidate = new Date(primary.getTime() + minutes * 60_000)
    if (wallClockEpoch(candidate.getTime(), timeZone) === desiredWallClock) {
      matches.set(candidate.getTime(), candidate)
    }
  }

  return Array.from(matches.values()).sort((a, b) => a.getTime() - b.getTime())
}

// Mean obliquity of the ecliptic (IAU 2006, arcsec series truncated)
function meanObliquity(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5
  const T = (jd - 2451545.0) / 36525
  return 23.43929111 - 0.01300417 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T
}

/**
 * Compute the ascendant (rising sign) from birth time and location.
 */
function computeAscendant(date: Date, latitude: number, longitude: number): Placement {
  const eps = meanObliquity(date) * DEG
  const lat = latitude * DEG

  const gast = SiderealTime(MakeTime(date)) // hours
  const lstDeg = ((gast * 15 + longitude) % 360 + 360) % 360
  const ramc = lstDeg * DEG

  const asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))
  )
  const ascDeg = ((asc / DEG) % 360 + 360) % 360
  return toPlacement('Ascendant', ascDeg)
}

/**
 * Compute a natal chart from birth data.
 * When birth time is unknown, computes noon positions, checks the Moon across
 * the local date, and omits the ascendant. A DST-ambiguous local birth time is
 * likewise never collapsed into one confident rising sign.
 */
export function computeNatalChart(params: {
  birthDate: string // YYYY-MM-DD
  birthTime?: string // HH:MM:SS local
  timezone: string // IANA
  latitude?: number
  longitude?: number
  birthTimeKnown: boolean
  birthTimeAccuracy?: 'exact' | 'approximate' | 'unknown'
}): NatalChart {
  const {
    birthDate,
    birthTime,
    timezone,
    latitude,
    longitude,
    birthTimeKnown,
    birthTimeAccuracy = birthTimeKnown ? 'exact' : 'unknown',
  } = params

  if (birthTimeKnown && !birthTime) {
    throw new Error('birthTime is required when birthTimeKnown is true')
  }
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error('latitude and longitude must be provided together')
  }
  if (latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    throw new Error(`Invalid latitude: ${latitude}`)
  }
  if (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new Error(`Invalid longitude: ${longitude}`)
  }

  const utcCandidates = birthTimeKnown && birthTime
    ? zonedTimeToUtcCandidates(birthDate, birthTime, timezone)
    : [zonedTimeToUtc(birthDate, '12:00:00', timezone)]
  const utc = utcCandidates[0]
  const localTimeAmbiguous = utcCandidates.length > 1
  const time = MakeTime(utc)

  const placements: Placement[] = []

  placements.push(toPlacement('Sun', SunPosition(time).elon))
  placements.push(toPlacement('Moon', EclipticGeoMoon(time).lon))

  const planets: Array<[string, Body]> = [
    ['Mercury', Body.Mercury],
    ['Venus', Body.Venus],
    ['Mars', Body.Mars],
    ['Jupiter', Body.Jupiter],
    ['Saturn', Body.Saturn],
    ['Uranus', Body.Uranus],
    ['Neptune', Body.Neptune],
    ['Pluto', Body.Pluto],
  ]

  for (const [name, body] of planets) {
    // Natal positions are geocentric tropical ecliptic longitudes. Equator()
    // takes an observer and is topocentric, which is the wrong coordinate
    // frame even when the numerical difference happens to be small.
    placements.push(toPlacement(name, Ecliptic(GeoVector(body, time, true)).elon))
  }

  const ascendant =
    birthTimeKnown && !localTimeAmbiguous && birthTime && latitude !== undefined && longitude !== undefined
      ? computeAscendant(utc, latitude, longitude)
      : null

  const possibleAscendants = localTimeAmbiguous && latitude !== undefined && longitude !== undefined
    ? utcCandidates.map(candidate => computeAscendant(candidate, latitude, longitude))
    : undefined
  const possibleAscendantSigns = possibleAscendants
    ? Array.from(new Set(possibleAscendants.map(candidate => candidate.sign)))
    : undefined

  let possibleMoonSigns: string[]
  let moonWindowStart: Date | undefined
  let moonWindowEnd: Date | undefined
  if (birthTimeKnown) {
    possibleMoonSigns = Array.from(new Set(utcCandidates.map(candidate =>
      toPlacement('Moon', EclipticGeoMoon(MakeTime(candidate)).lon).sign
    )))
  } else {
    moonWindowStart = zonedTimeToUtc(birthDate, '00:00:00', timezone)
    moonWindowEnd = zonedTimeToUtc(birthDate, '23:59:59', timezone)
    possibleMoonSigns = Array.from(new Set([
      toPlacement('Moon', EclipticGeoMoon(MakeTime(moonWindowStart)).lon).sign,
      placements.find(p => p.body === 'Moon')!.sign,
      toPlacement('Moon', EclipticGeoMoon(MakeTime(moonWindowEnd)).lon).sign,
    ]))
  }

  return {
    placements,
    ascendant,
    utcBirthTime: utc.toISOString(),
    calculationVersion: 'tropical-geocentric-v2',
    zodiac: 'tropical',
    birthTimeKnown,
    accuracy: {
      ephemeris: 'astronomy-engine',
      coordinates: 'geocentric',
      moon: {
        certainty: birthTimeKnown
          ? localTimeAmbiguous ? 'ambiguous-local-time' : 'exact-time'
          : possibleMoonSigns.length === 1
            ? 'stable-for-birth-date'
            : 'sign-change-possible',
        possibleSigns: possibleMoonSigns,
        windowStartUtc: moonWindowStart?.toISOString(),
        windowEndUtc: moonWindowEnd?.toISOString(),
      },
      ascendant: localTimeAmbiguous
        ? 'ambiguous-local-time'
        : ascendant
        ? birthTimeAccuracy === 'approximate' ? 'approximate-time' : 'exact-time'
        : 'unavailable',
      possibleAscendantSigns,
      possibleAscendants,
      utcCandidates: localTimeAmbiguous ? utcCandidates.map(candidate => candidate.toISOString()) : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// Transits
//
// Previously the agent web-searched for "today's horoscope" and repeated
// whatever came back, which is how it ended up confidently asserting placements
// that were not true on the date in question. Everything below is computed.
// ---------------------------------------------------------------------------

export interface TransitPosition extends Placement {
  retrograde: boolean
}

export type AspectName = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'

export interface TransitAspect {
  transitBody: string
  transitSign: string
  transitRetrograde: boolean
  aspect: AspectName
  natalBody: string
  natalSign: string
  orb: number          // degrees from exact
  applying: boolean    // tightening toward exact rather than separating
  exactDate: string | null   // ISO date the aspect perfects, when findable
  endDate: string | null     // ISO date it leaves orb
  weight: number       // significance ranking, higher is more important
}

const ASPECTS: Array<{ name: AspectName; angle: number }> = [
  { name: 'conjunction', angle: 0 },
  { name: 'sextile', angle: 60 },
  { name: 'square', angle: 90 },
  { name: 'trine', angle: 120 },
  { name: 'opposition', angle: 180 },
]

// Tighter orbs for slower bodies: a 3° Pluto orb lasts over a year and stops
// meaning anything about today.
const ORBS: Record<string, number> = {
  Moon: 5,
  Sun: 3, Mercury: 3, Venus: 3, Mars: 3,
  Jupiter: 3, Saturn: 3,
  Uranus: 2, Neptune: 2, Pluto: 2,
}

// Slow planets landing on personal points are the transits people actually
// feel for weeks. Moon transits matter for a day. Ranking reflects that.
const TRANSIT_WEIGHT: Record<string, number> = {
  Pluto: 10, Neptune: 9, Uranus: 9, Saturn: 8, Jupiter: 7,
  Mars: 5, Sun: 4, Venus: 4, Mercury: 3, Moon: 2,
}

const NATAL_WEIGHT: Record<string, number> = {
  Sun: 10, Moon: 10, Ascendant: 10,
  Venus: 7, Mars: 7, Mercury: 6,
  Saturn: 5, Jupiter: 5,
  Uranus: 2, Neptune: 2, Pluto: 2,
}

const TRANSIT_BODIES: Array<[string, Body]> = [
  ['Mercury', Body.Mercury],
  ['Venus', Body.Venus],
  ['Mars', Body.Mars],
  ['Jupiter', Body.Jupiter],
  ['Saturn', Body.Saturn],
  ['Uranus', Body.Uranus],
  ['Neptune', Body.Neptune],
  ['Pluto', Body.Pluto],
]

function eclipticLongitude(body: Body, date: Date): number {
  const time = MakeTime(date)
  return Ecliptic(GeoVector(body, time, true)).elon
}

function longitudeOf(name: string, date: Date): number {
  if (name === 'Sun') return SunPosition(MakeTime(date)).elon
  if (name === 'Moon') return EclipticGeoMoon(MakeTime(date)).lon
  const entry = TRANSIT_BODIES.find(([n]) => n === name)
  return entry ? eclipticLongitude(entry[1], date) : 0
}

/**
 * Where everything actually is right now, with retrograde detected by
 * comparing against the following day rather than looked up in a table.
 */
export function computeCurrentPositions(date: Date = new Date()): TransitPosition[] {
  const tomorrow = new Date(date.getTime() + 86400000)
  const names = ['Sun', 'Moon', ...TRANSIT_BODIES.map(([n]) => n)]

  return names.map(name => {
    const lon = longitudeOf(name, date)
    const next = longitudeOf(name, tomorrow)
    // Handle wraparound at 0/360 before deciding direction of travel.
    let delta = next - lon
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    return { ...toPlacement(name, lon), retrograde: delta < 0 }
  })
}

/** Smallest separation between two ecliptic longitudes, 0-180. */
function separation(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360 + 360) % 360)
  return diff > 180 ? 360 - diff : diff
}

/** Orb from exact for a given aspect, or null if outside the allowed orb. */
function orbFor(transitLon: number, natalLon: number, angle: number, maxOrb: number): number | null {
  const orb = Math.abs(separation(transitLon, natalLon) - angle)
  return orb <= maxOrb ? orb : null
}

/**
 * Scan forward and backward to find when an aspect perfects and when it leaves
 * orb. Sampling daily is plenty - nobody needs the hour a Saturn transit is
 * exact, and it keeps this cheap enough to run on every message.
 */
function findTiming(
  transitName: string,
  natalLon: number,
  angle: number,
  maxOrb: number,
  from: Date
): { exactDate: string | null; endDate: string | null; applying: boolean } {
  const windowDays = transitName === 'Moon' ? 3 : transitName === 'Sun' || transitName === 'Mercury' || transitName === 'Venus' ? 30 : 200
  const step = 86400000

  let bestOrb = Infinity
  let bestOffset = 0
  let endOffset: number | null = null

  for (let d = -windowDays; d <= windowDays; d++) {
    const at = new Date(from.getTime() + d * step)
    const orb = Math.abs(separation(longitudeOf(transitName, at), natalLon) - angle)

    if (orb < bestOrb) {
      bestOrb = orb
      bestOffset = d
    }
    // First day in the future where it drops out of orb.
    if (d > 0 && endOffset === null && orb > maxOrb) {
      endOffset = d
    }
  }

  const iso = (offset: number) =>
    new Date(from.getTime() + offset * step).toISOString().slice(0, 10)

  return {
    exactDate: bestOrb <= maxOrb ? iso(bestOffset) : null,
    endDate: endOffset !== null ? iso(endOffset) : null,
    // Exact still ahead means it's tightening.
    applying: bestOffset > 0,
  }
}

/**
 * Every significant aspect between where the planets are now and this person's
 * actual natal placements, ranked by how much it matters.
 */
export function computeTransits(chart: NatalChart, date: Date = new Date()): TransitAspect[] {
  const current = computeCurrentPositions(date)

  const natalPoints: Placement[] = [...chart.placements]
  if (chart.ascendant) natalPoints.push(chart.ascendant)

  const results: TransitAspect[] = []

  for (const transit of current) {
    const maxOrb = ORBS[transit.body] ?? 3

    for (const natal of natalPoints) {
      // A planet aspecting its own natal position is a return/cycle point,
      // which is meaningful; everything else pairs normally.
      for (const { name, angle } of ASPECTS) {
        const orb = orbFor(transit.longitude, natal.longitude, angle, maxOrb)
        if (orb === null) continue

        const timing = findTiming(transit.body, natal.longitude, angle, maxOrb, date)

        const weight =
          (TRANSIT_WEIGHT[transit.body] ?? 3) *
          (NATAL_WEIGHT[natal.body] ?? 3) *
          // Tight orbs matter more; at exact this doubles the score.
          (1 + (maxOrb - orb) / maxOrb)

        results.push({
          transitBody: transit.body,
          transitSign: transit.sign,
          transitRetrograde: transit.retrograde,
          aspect: name,
          natalBody: natal.body,
          natalSign: natal.sign,
          orb: Math.round(orb * 10) / 10,
          applying: timing.applying,
          exactDate: timing.exactDate,
          endDate: timing.endDate,
          weight: Math.round(weight),
        })
      }
    }
  }

  return results.sort((a, b) => b.weight - a.weight)
}

// Plain-language meaning per aspect, so the agent is handed an interpretation
// rather than geometry it would be tempted to recite.
const ASPECT_TONE: Record<AspectName, string> = {
  conjunction: 'is intensifying and bringing to a head',
  sextile: 'is opening up an easy opportunity around',
  square: 'is putting friction and pressure on',
  trine: 'is smoothing out and easing',
  opposition: 'is pulling them in two directions about',
}

const NATAL_MEANING: Record<string, string> = {
  Sun: 'their identity, confidence, what they want to be known for',
  Moon: 'their emotions, comfort, what they need to feel safe',
  Ascendant: 'how they come across, first impressions, their appearance',
  Mercury: 'how they think and communicate',
  Venus: 'love, money, what they find beautiful',
  Mars: 'drive, anger, sex, how they go after things',
  Jupiter: 'growth, luck, belief',
  Saturn: 'discipline, fear, where they feel tested',
  Uranus: 'disruption, freedom',
  Neptune: 'dreams, confusion, escapism',
  Pluto: 'power, obsession, transformation',
}

/**
 * Format transits for the agent. Deliberately written as private briefing
 * material with an explicit instruction not to repeat the vocabulary, because
 * the voice rules forbid reciting chart mechanics to the user.
 */
export function formatTransitsForAgent(transits: TransitAspect[], limit = 2): string {
  if (transits.length === 0) {
    return 'No significant transits to their chart right now. Do not invent one - just answer them directly.'
  }

  // Spell out the weekday. Left to convert an ISO date itself the model gets
  // the day wrong, and "peaks Thursday" being off by one undoes exactly the
  // credibility that precise timing is supposed to buy.
  const withDay = (iso: string): string => {
    const d = new Date(`${iso}T12:00:00Z`)
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    return `${weekday} ${monthDay}`
  }

  const lines = transits.slice(0, limit).map(t => {
    const timing = t.exactDate
      ? t.applying
        ? `builds to a peak on ${withDay(t.exactDate)}`
        : `peaked ${withDay(t.exactDate)}`
      : 'in effect now'
    const fades = t.endDate ? `, eases off around ${withDay(t.endDate)}` : ''
    const rx = t.transitRetrograde ? ' (moving backward - this is a revisiting, not a new arrival)' : ''

    return `- ${t.transitBody} in ${t.transitSign}${rx} ${ASPECT_TONE[t.aspect]} ${t.natalBody === 'Ascendant' ? 'their rising' : `their ${t.natalBody}`}, ${NATAL_MEANING[t.natalBody] ?? ''}. ${timing}${fades}. (orb ${t.orb}°)`
  })

  return `PRIVATE BRIEFING - computed and accurate. LOWEST PRIORITY CONTEXT.

Read this LAST and use it least. What you know about their actual life - their people,
their job, their plans, what they saved - always beats this. If a fact about them touches
their question at all, answer from the fact and ignore the sky entirely.

This is the weather, not the message. It tells you which way to lean when you have nothing
better; it is NOT the thing to talk about. Most replies should not reference it at all.

You are answering ONE question. Do not repeat the same transit across a conversation: if
you have already mentioned a date or a theme from this briefing, say something else or say
nothing about the sky at all.

Do NOT narrate their mood back at them. "You're feeling a boost of confidence" is not
advice, it is a horoscope, and it is exactly what this product is not. Use this to decide
WHAT TO TELL THEM TO DO, then tell them that.

Never repeat this vocabulary - no aspect names, no "orb", no geometry.
Use the day names exactly as written; do not work out a weekday yourself, you will get it wrong.

${lines.join('\n')}`
}

/**
 * Build an era-level briefing when the user asks about a past year. Sampling
 * each month catches the slow transits an astrologer would use for a question
 * like "did I peak in 2014?" without pretending the photo has an exact date.
 */
export function formatHistoricalYearForAgent(chart: NatalChart, year: number, limit = 4): string {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return 'Historical period is invalid. Do not make astrological claims about it.'
  }

  const slowBodies = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'])
  const personalPoints = new Set(['Sun', 'Moon', 'Ascendant', 'Mercury', 'Venus', 'Mars'])
  const best = new Map<string, TransitAspect & { sampledMonth: number }>()

  for (let month = 0; month < 12; month++) {
    const sampledAt = new Date(Date.UTC(year, month, 15, 12))
    for (const transit of computeTransits(chart, sampledAt)) {
      if (!slowBodies.has(transit.transitBody) || !personalPoints.has(transit.natalBody)) continue
      const key = `${transit.transitBody}:${transit.aspect}:${transit.natalBody}`
      const previous = best.get(key)
      if (!previous || transit.orb < previous.orb) {
        best.set(key, { ...transit, sampledMonth: month })
      }
    }
  }

  const ranked = Array.from(best.values())
    .sort((a, b) => b.weight - a.weight || a.orb - b.orb)
    .slice(0, limit)

  if (ranked.length === 0) {
    return `HISTORICAL ASTROLOGY BRIEFING FOR ${year}: No major slow-planet contacts to personal chart points were found in the monthly scan. Do not invent one. Make only a natal, era-level judgment and say the year alone is approximate.`
  }

  const monthName = (month: number) => new Date(Date.UTC(year, month, 15)).toLocaleDateString(
    'en-US',
    { month: 'long', timeZone: 'UTC' },
  )
  const lines = ranked.map(transit => {
    const exact = transit.exactDate?.startsWith(`${year}-`)
      ? transit.exactDate
      : `around ${monthName(transit.sampledMonth)} ${year}`
    return `- ${transit.transitBody} ${transit.aspect} natal ${transit.natalBody} (${NATAL_MEANING[transit.natalBody]}), strongest ${exact}; observed orb ${transit.orb}°.`
  })

  return `HISTORICAL ASTROLOGY BRIEFING FOR ${year} - computed from their exact natal chart.
Use this instead of today's sky because the user asked about ${year}. This is a year-level
scan, not an exact timestamp for the photo, so make a clear era-level judgment but do not
claim the picture was taken on a specific transit date. Translate the timing into normal
language. Because they explicitly asked for astrology, expose exactly one professional
anchor by naming one planet and the relevant month or season in plain language. Never dump
aspect names, orbs, or this private briefing back to the user.

${lines.join('\n')}`
}

/**
 * Format a chart for the agent's system prompt.
 */
export function formatChartForAgent(chart: NatalChart): string {
  const lines = chart.placements.map(
    p => `${p.body}: ${p.sign} ${p.degree.toFixed(1)}°`
  )
  if (chart.ascendant) {
    lines.push(`Ascendant (Rising): ${chart.ascendant.sign} ${chart.ascendant.degree.toFixed(1)}°`)
  } else {
    lines.push('Ascendant: unknown (birth time not provided)')
  }
  return lines.join('\n')
}
