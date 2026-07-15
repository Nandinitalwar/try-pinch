// Natal chart computation using astronomy-engine (pure JS ephemeris, ±1 arcmin)
// Replaces LLM-guessed placements with real astronomical positions.

import {
  Body,
  Observer,
  Equator,
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

/**
 * Convert a local birth date/time in an IANA timezone to a UTC Date.
 * Two-pass correction handles DST transitions.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naive = Date.parse(`${dateStr}T${timeStr || '12:00:00'}Z`)

  const wallClock = (epochMs: number): number => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(epochMs))
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
    // hour "24" means midnight in some ICU versions
    const hour = get('hour') === '24' ? '00' : get('hour')
    return Date.parse(`${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`)
  }

  let utc = naive - (wallClock(naive) - naive)
  utc = utc - (wallClock(utc) - naive) // second pass for DST edges
  return new Date(utc)
}

// Mean obliquity of the ecliptic (IAU 2006, arcsec series truncated)
function meanObliquity(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5
  const T = (jd - 2451545.0) / 36525
  return 23.43929111 - 0.01300417 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T
}

// Convert of-date equatorial coordinates to ecliptic longitude
function equatorialToEclipticLon(raHours: number, decDeg: number, obliquityDeg: number): number {
  const ra = raHours * 15 * DEG
  const dec = decDeg * DEG
  const eps = obliquityDeg * DEG
  const lon = Math.atan2(
    Math.sin(ra) * Math.cos(eps) + Math.tan(dec) * Math.sin(eps),
    Math.cos(ra)
  )
  return ((lon / DEG) % 360 + 360) % 360
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
 * When birth time is unknown, computes noon positions and omits the
 * ascendant (Moon sign may be off by up to ~7° in that case).
 */
export function computeNatalChart(params: {
  birthDate: string // YYYY-MM-DD
  birthTime?: string // HH:MM:SS local
  timezone: string // IANA
  latitude?: number
  longitude?: number
  birthTimeKnown: boolean
}): NatalChart {
  const { birthDate, birthTime, timezone, latitude, longitude, birthTimeKnown } = params

  const utc = zonedTimeToUtc(birthDate, birthTimeKnown && birthTime ? birthTime : '12:00:00', timezone)
  const time = MakeTime(utc)
  const observer = new Observer(latitude ?? 0, longitude ?? 0, 0)
  const eps = meanObliquity(utc)

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
    const equ = Equator(body, time, observer, true, true)
    placements.push(toPlacement(name, equatorialToEclipticLon(equ.ra, equ.dec, eps)))
  }

  const ascendant =
    birthTimeKnown && birthTime && latitude !== undefined && longitude !== undefined
      ? computeAscendant(utc, latitude, longitude)
      : null

  return { placements, ascendant, utcBirthTime: utc.toISOString() }
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
