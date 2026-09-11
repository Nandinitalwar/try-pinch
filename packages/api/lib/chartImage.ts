import { NatalChart, Placement } from './astrology'
import path from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { CHART_FONT_BASE64 } from './chartFont'

export interface ChartImageMetadata {
  name?: string
  birthDate?: string
  birthTime?: string
  birthTimeKnown?: boolean
  birthTimeAccuracy?: 'exact' | 'approximate' | 'unknown'
  birthCity?: string
  birthCountry?: string
}

export type ChartImageLayout = 'aura' | 'full'
export type AuraStyle = 'midnight' | 'prism' | 'velvet'

export interface ChartRenderOptions {
  portableLabels?: boolean
  layout?: ChartImageLayout
  auraStyle?: AuraStyle
}

const SIGN_GLYPHS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
}

// Short Latin labels are used only for the server-rendered PNG. They remain
// legible at iMessage size and avoid depending on an astrology-symbol font in
// a serverless runtime. The browser SVG keeps the familiar Unicode glyphs.
const SIGN_LABELS: Record<string, string> = {
  Aries: 'ARI', Taurus: 'TAU', Gemini: 'GEM', Cancer: 'CAN', Leo: 'LEO', Virgo: 'VIR',
  Libra: 'LIB', Scorpio: 'SCO', Sagittarius: 'SAG', Capricorn: 'CAP', Aquarius: 'AQU', Pisces: 'PIS',
}

const PLANET_GLYPHS: Record<string, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
}


const PLANET_LABELS: Record<string, string> = {
  Sun: 'SU', Moon: 'MO', Mercury: 'ME', Venus: 'VE', Mars: 'MA',
  Jupiter: 'JU', Saturn: 'SA', Uranus: 'UR', Neptune: 'NE', Pluto: 'PL',
}

const SIGN_COLORS = [
  '#ff806f', '#c7aa69', '#f4cc5d', '#78c7d2', '#ff9b65', '#9bc287',
  '#dc91c5', '#cc6d8d', '#e79555', '#9c8ec8', '#5faac7', '#7da39f',
]

const ASPECTS = [
  { angle: 0, orb: 5, color: '#d9b6ff', dash: '' },
  { angle: 60, orb: 4, color: '#62d6b4', dash: '5 8' },
  { angle: 90, orb: 5, color: '#ff756f', dash: '' },
  { angle: 120, orb: 5, color: '#65b9ff', dash: '' },
  { angle: 180, orb: 5, color: '#ff9f66', dash: '' },
]

const SIGN_HUES: Record<string, number> = {
  Aries: 8, Taurus: 42, Gemini: 55, Cancer: 188, Leo: 24, Virgo: 112,
  Libra: 326, Scorpio: 344, Sagittarius: 30, Capricorn: 264, Aquarius: 196, Pisces: 174,
}

interface AuraTheme {
  primary: string
  secondary: string
  accent: string
  backgroundStart: string
  backgroundMiddle: string
  backgroundEnd: string
  ink: string
  muted: string
  line: string
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const h = ((hue % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs(h % 2 - 1))
  const [r1, g1, b1] = h < 1 ? [chroma, x, 0]
    : h < 2 ? [x, chroma, 0]
    : h < 3 ? [0, chroma, x]
    : h < 4 ? [0, x, chroma]
    : h < 5 ? [x, 0, chroma]
    : [chroma, 0, x]
  const offset = l - chroma / 2
  const hex = (value: number) => Math.round((value + offset) * 255).toString(16).padStart(2, '0')
  return `#${hex(r1)}${hex(g1)}${hex(b1)}`
}

function auraTheme(chart: NatalChart, style: AuraStyle): AuraTheme {
  const sun = chart.placements.find(placement => placement.body === 'Sun')
  const moon = chart.placements.find(placement => placement.body === 'Moon')
  const primaryHue = SIGN_HUES[sun?.sign || 'Pisces']
  const secondaryHue = SIGN_HUES[moon?.sign || 'Leo']
  const accentHue = chart.ascendant
    ? SIGN_HUES[chart.ascendant.sign]
    : (primaryHue + secondaryHue + 120) % 360

  const treatments: Record<AuraStyle, Pick<AuraTheme, 'backgroundStart' | 'backgroundMiddle' | 'backgroundEnd' | 'ink' | 'muted' | 'line'>> = {
    midnight: {
      backgroundStart: '#111629', backgroundMiddle: '#070914', backgroundEnd: '#03040a',
      ink: '#f5f2ff', muted: '#aaa5bd', line: '#625f78',
    },
    prism: {
      backgroundStart: '#251447', backgroundMiddle: '#071b31', backgroundEnd: '#07020f',
      ink: '#fff9ff', muted: '#c2b8d0', line: '#796bb0',
    },
    velvet: {
      backgroundStart: '#22121d', backgroundMiddle: '#0e0710', backgroundEnd: '#040205',
      ink: '#fff4f0', muted: '#c1a9ad', line: '#76575f',
    },
  }
  const treatment = treatments[style]
  const saturation = style === 'velvet' ? 72 : style === 'prism' ? 88 : 78
  const lightness = style === 'velvet' ? 67 : 70
  return {
    ...treatment,
    primary: hslToHex(primaryHue, saturation, lightness),
    secondary: hslToHex(secondaryHue, saturation - 4, lightness + 2),
    accent: hslToHex(accentHue, saturation + 2, lightness + 5),
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function point(radius: number, longitude: number, cx = 600, cy = 510): { x: number; y: number } {
  // Aries begins at the left edge and the zodiac advances clockwise, matching
  // the orientation people expect from a Western astrology chart wheel.
  const radians = (180 - longitude) * Math.PI / 180
  return { x: cx + Math.cos(radians) * radius, y: cy - Math.sin(radians) * radius }
}

function lineAt(longitude: number, inner: number, outer: number, attrs: string): string {
  const a = point(inner, longitude)
  const b = point(outer, longitude)
  return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" ${attrs}/>`
}

function angularSeparation(a: number, b: number): number {
  const difference = Math.abs(((a - b) % 360 + 360) % 360)
  return difference > 180 ? 360 - difference : difference
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Put crowded planets on concentric lanes. Several bodies can share nearly the
 * same longitude; alternating just two radii made one marker hide another.
 */
function planetMarkerRadii(placements: Placement[]): Map<string, number> {
  const candidates = [258, 218, 298, 178]
  const assigned: Array<{ point: { x: number; y: number }; radius: number }> = []
  const radii = new Map<string, number>()

  for (const placement of [...placements].sort((a, b) => a.longitude - b.longitude)) {
    let chosen = candidates[0]
    let bestClearance = -1
    for (const radius of candidates) {
      const candidate = point(radius, placement.longitude)
      const clearance = assigned.length
        ? Math.min(...assigned.map(existing => distance(candidate, existing.point)))
        : Number.POSITIVE_INFINITY
      if (clearance >= 42) {
        chosen = radius
        break
      }
      if (clearance > bestClearance) {
        bestClearance = clearance
        chosen = radius
      }
    }
    assigned.push({ point: point(chosen, placement.longitude), radius: chosen })
    radii.set(placement.body, chosen)
  }

  return radii
}

function renderAspects(placements: Placement[]): string {
  const lines: string[] = []
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const separation = angularSeparation(placements[i].longitude, placements[j].longitude)
      const aspect = ASPECTS.find(candidate => Math.abs(separation - candidate.angle) <= candidate.orb)
      if (!aspect) continue
      const start = point(226, placements[i].longitude)
      const end = point(226, placements[j].longitude)
      lines.push(`<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="${aspect.color}" stroke-opacity="0.42" stroke-width="1.6"${aspect.dash ? ` stroke-dasharray="${aspect.dash}"` : ''}/>`)
    }
  }
  return lines.join('')
}

function renderPlanetMarkers(chart: NatalChart, portableLabels = false): string {
  const sorted = [...chart.placements].sort((a, b) => a.longitude - b.longitude)
  const radii = planetMarkerRadii(sorted)
  const moonUncertain = ['sign-change-possible', 'ambiguous-local-time'].includes(chart.accuracy?.moon.certainty || '')

  return sorted.map(placement => {
    const radius = radii.get(placement.body) || 258
    const tickInner = point(234, placement.longitude)
    const tickOuter = point(radius, placement.longitude)
    const label = point(radius, placement.longitude)
    const uncertain = placement.body === 'Moon' && moonUncertain
    const color = SIGN_COLORS[Math.floor(placement.longitude / 30) % SIGN_COLORS.length]
    return `<g aria-label="${escapeXml(`${placement.body} ${placement.sign} ${placement.degree} degrees`)}">
      <line x1="${tickInner.x.toFixed(2)}" y1="${tickInner.y.toFixed(2)}" x2="${tickOuter.x.toFixed(2)}" y2="${tickOuter.y.toFixed(2)}" stroke="${color}" stroke-opacity="0.72" stroke-width="1.4"${uncertain ? ' stroke-dasharray="4 4"' : ''}/>
      <circle cx="${label.x.toFixed(2)}" cy="${label.y.toFixed(2)}" r="18" fill="#070a0f" stroke="${uncertain ? '#f4cc5d' : color}" stroke-width="2"${uncertain ? ' stroke-dasharray="3 3"' : ''}/>
      <text x="${label.x.toFixed(2)}" y="${(label.y + (portableLabels ? 4 : 7)).toFixed(2)}" class="planet-glyph${portableLabels ? ' portable-planet-label' : ''}" text-anchor="middle">${portableLabels ? PLANET_LABELS[placement.body] : PLANET_GLYPHS[placement.body] || escapeXml(placement.body.slice(0, 1))}</text>
    </g>`
  }).join('')
}

function renderPlacementRows(chart: NatalChart, portableLabels = false): string {
  const placements = chart.ascendant ? [...chart.placements, chart.ascendant] : chart.placements
  return placements.map((placement, index) => {
    const column = index < 6 ? 0 : 1
    const row = column === 0 ? index : index - 6
    const x = column === 0 ? 104 : 640
    const y = 948 + row * 34
    const uncertainMoon = placement.body === 'Moon' && ['sign-change-possible', 'ambiguous-local-time'].includes(chart.accuracy?.moon.certainty || '')
    const suffix = uncertainMoon ? ' approx.' : ''
    return `<g transform="translate(${x} ${y})">
      <text class="placement-glyph${portableLabels ? ' portable-placement-label' : ''}" x="0" y="0">${portableLabels ? PLANET_LABELS[placement.body] || 'AC' : PLANET_GLYPHS[placement.body] || 'AC'}</text>
      <text class="placement-name" x="38" y="0">${escapeXml(placement.body.toUpperCase())}</text>
      <text class="placement-value" x="188" y="0">${escapeXml(`${placement.sign.toUpperCase()} / ${placement.degree.toFixed(1)}°${suffix}`)}</text>
    </g>`
  }).join('')
}

function renderSignalGrid(): string {
  const vertical = Array.from({ length: 14 }, (_, index) => {
    const x = 42 + index * 86
    return `<line x1="${x}" y1="0" x2="${x}" y2="1200"/>`
  }).join('')
  const horizontal = Array.from({ length: 15 }, (_, index) => {
    const y = 30 + index * 82
    return `<line x1="0" y1="${y}" x2="1200" y2="${y}"/>`
  }).join('')
  return `<g stroke="#84ffd9" stroke-opacity="0.035" stroke-width="1">${vertical}${horizontal}</g>`
}

function renderStars(): string {
  return Array.from({ length: 72 }, (_, index) => {
    const x = 24 + ((index * 137 + 41) % 1152)
    const y = 22 + ((index * 83 + 17) % 854)
    const radius = index % 11 === 0 ? 1.8 : index % 4 === 0 ? 1.1 : 0.7
    const opacity = 0.18 + (index % 5) * 0.08
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#d9fff4" opacity="${opacity.toFixed(2)}"/>`
  }).join('')
}

function renderIdentity(chart: NatalChart): string {
  const sun = chart.placements.find(placement => placement.body === 'Sun')
  const moon = chart.placements.find(placement => placement.body === 'Moon')
  const rows = [
    sun ? `SUN / ${SIGN_LABELS[sun.sign]}` : null,
    moon ? `MOON / ${SIGN_LABELS[moon.sign]}` : null,
    chart.ascendant ? `ASC / ${SIGN_LABELS[chart.ascendant.sign]}` : 'ASC / ---',
  ].filter(Boolean)
  return rows.map((row, index) =>
    `<text x="600" y="${486 + index * 24}" text-anchor="middle" class="identity">${row}</text>`
  ).join('')
}

function metadataLine(meta: ChartImageMetadata): string {
  const place = [meta.birthCity, meta.birthCountry].filter(Boolean).join(', ')
  const time = meta.birthTimeKnown && meta.birthTime
    ? `${meta.birthTime.slice(0, 5)}${meta.birthTimeAccuracy === 'approximate' ? ' approx.' : ''}`
    : 'time unknown'
  return [meta.birthDate, time, place].filter(Boolean).join('  ·  ')
}

const AURA_WIDTH = 1080
const AURA_HEIGHT = 1350
const AURA_CX = 540
const AURA_CY = 640

function auraPoint(radius: number, longitude: number): { x: number; y: number } {
  return point(radius, longitude, AURA_CX, AURA_CY)
}

function auraLineAt(longitude: number, inner: number, outer: number, attrs: string): string {
  const a = auraPoint(inner, longitude)
  const b = auraPoint(outer, longitude)
  return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" ${attrs}/>`
}

function chartAccuracyNote(chart: NatalChart): string {
  const moonAccuracy = chart.accuracy?.moon
  const ambiguousRising = chart.accuracy?.possibleAscendants
    ?.map(placement => `${placement.sign} ${placement.degree.toFixed(1)}°`)
    .join(' or ')
  return chart.accuracy?.ascendant === 'ambiguous-local-time'
    ? `Local birth time is DST-ambiguous. Rising could be ${ambiguousRising || chart.accuracy.possibleAscendantSigns?.join(' or ') || 'more than one position'}; axis omitted.`
    : moonAccuracy?.certainty === 'sign-change-possible'
      ? `Birth time unknown. Moon could be ${moonAccuracy.possibleSigns.join(' or ')}. Rising sign omitted.`
      : chart.ascendant
        ? `Tropical · geocentric · ${chart.accuracy?.ascendant === 'approximate-time' ? 'approximate birth time' : 'exact birth time'}`
        : 'Birth time unknown. Rising sign omitted.'
}

function auraPlanetMarkerRadii(placements: Placement[]): Map<string, number> {
  const candidates = [278, 238, 316, 200]
  const assigned: Array<{ point: { x: number; y: number } }> = []
  const radii = new Map<string, number>()

  for (const placement of [...placements].sort((a, b) => a.longitude - b.longitude)) {
    let chosen = candidates[0]
    let bestClearance = -1
    for (const radius of candidates) {
      const candidate = auraPoint(radius, placement.longitude)
      const clearance = assigned.length
        ? Math.min(...assigned.map(existing => distance(candidate, existing.point)))
        : Number.POSITIVE_INFINITY
      if (clearance >= 48) {
        chosen = radius
        break
      }
      if (clearance > bestClearance) {
        bestClearance = clearance
        chosen = radius
      }
    }
    assigned.push({ point: auraPoint(chosen, placement.longitude) })
    radii.set(placement.body, chosen)
  }
  return radii
}

function renderAuraStars(chart: NatalChart, theme: AuraTheme): string {
  let seed = chart.placements.reduce(
    (value, placement, index) => (value + Math.round(placement.longitude * 1000) * (index + 3)) >>> 0,
    2166136261,
  )
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  return Array.from({ length: 92 }, (_, index) => {
    const x = 38 + random() * (AURA_WIDTH - 76)
    const y = 205 + random() * 825
    const radius = index % 17 === 0 ? 2.4 : index % 5 === 0 ? 1.5 : 0.85
    const color = index % 9 === 0 ? theme.primary : index % 13 === 0 ? theme.secondary : theme.ink
    const opacity = 0.16 + random() * 0.48
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`
  }).join('')
}

function renderAuraAspects(placements: Placement[], theme: AuraTheme): string {
  const lines: string[] = []
  let lineIndex = 0
  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const separation = angularSeparation(placements[i].longitude, placements[j].longitude)
      const aspect = ASPECTS.find(candidate => Math.abs(separation - candidate.angle) <= candidate.orb)
      if (!aspect) continue
      const start = auraPoint(250, placements[i].longitude)
      const end = auraPoint(250, placements[j].longitude)
      const colors = [theme.primary, theme.secondary, theme.accent]
      lines.push(`<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="${colors[lineIndex % colors.length]}" stroke-opacity="0.34" stroke-width="2"${aspect.dash ? ` stroke-dasharray="7 10"` : ''}/>`)
      lineIndex += 1
    }
  }
  return lines.join('')
}

function renderAuraPlanets(chart: NatalChart, theme: AuraTheme, portableLabels = false): string {
  const sorted = [...chart.placements].sort((a, b) => a.longitude - b.longitude)
  const radii = auraPlanetMarkerRadii(sorted)
  const moonUncertain = ['sign-change-possible', 'ambiguous-local-time'].includes(chart.accuracy?.moon.certainty || '')
  const bodyColors: Record<string, string> = {
    Sun: theme.primary,
    Moon: theme.secondary,
  }

  return sorted.map((placement, index) => {
    const radius = radii.get(placement.body) || 278
    const tickInner = auraPoint(255, placement.longitude)
    const label = auraPoint(radius, placement.longitude)
    const uncertain = placement.body === 'Moon' && moonUncertain
    const color = bodyColors[placement.body] || (index % 2 === 0 ? theme.accent : theme.secondary)
    const glyph = portableLabels
      ? PLANET_LABELS[placement.body]
      : PLANET_GLYPHS[placement.body] || escapeXml(placement.body.slice(0, 1))
    return `<g aria-label="${escapeXml(`${placement.body} ${placement.sign} ${placement.degree} degrees`)}">
      <line x1="${tickInner.x.toFixed(2)}" y1="${tickInner.y.toFixed(2)}" x2="${label.x.toFixed(2)}" y2="${label.y.toFixed(2)}" stroke="${color}" stroke-opacity="0.62" stroke-width="1.8"${uncertain ? ' stroke-dasharray="5 5"' : ''}/>
      <circle cx="${label.x.toFixed(2)}" cy="${label.y.toFixed(2)}" r="23" fill="#080914" fill-opacity="0.92" stroke="${color}" stroke-width="2.4" filter="url(#marker-glow)"${uncertain ? ' stroke-dasharray="4 4"' : ''}/>
      <text x="${label.x.toFixed(2)}" y="${(label.y + (portableLabels ? 5 : 8)).toFixed(2)}" class="aura-planet${portableLabels ? ' aura-portable-planet' : ''}" text-anchor="middle">${glyph}</text>
    </g>`
  }).join('')
}

function renderAuraZodiac(chart: NatalChart, theme: AuraTheme, portableLabels = false): string {
  const sun = chart.placements.find(placement => placement.body === 'Sun')
  const moon = chart.placements.find(placement => placement.body === 'Moon')
  const highlighted = new Map<string, string>()
  if (chart.ascendant) highlighted.set(chart.ascendant.sign, theme.accent)
  if (moon) highlighted.set(moon.sign, theme.secondary)
  if (sun) highlighted.set(sun.sign, theme.primary)

  return Object.keys(SIGN_GLYPHS).map((sign, index) => {
    const start = index * 30
    const glyph = auraPoint(349, start + 15)
    const arcStart = auraPoint(389, start + 1.6)
    const arcEnd = auraPoint(389, start + 28.4)
    const activeColor = highlighted.get(sign)
    const color = activeColor || theme.line
    const opacity = activeColor ? 0.96 : 0.36
    const label = portableLabels ? SIGN_LABELS[sign] : SIGN_GLYPHS[sign]
    return `<path d="M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A 389 389 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${activeColor ? 10 : 5}" stroke-linecap="round" opacity="${opacity}"${activeColor ? ' filter="url(#ring-glow)"' : ''}/>
      ${auraLineAt(start, 320, 383, `stroke="${color}" stroke-opacity="${activeColor ? '0.72' : '0.24'}" stroke-width="1.5"`)}
      <text x="${glyph.x.toFixed(2)}" y="${(glyph.y + (portableLabels ? 5 : 10)).toFixed(2)}" class="aura-sign${portableLabels ? ' aura-portable-sign' : ''}" text-anchor="middle" fill="${activeColor || theme.muted}" opacity="${activeColor ? '1' : '0.76'}">${label}</text>`
  }).join('')
}

function renderAuraIdentity(chart: NatalChart, theme: AuraTheme): string {
  const sun = chart.placements.find(placement => placement.body === 'Sun')
  const moon = chart.placements.find(placement => placement.body === 'Moon')
  const moonValue = chart.accuracy?.moon.certainty === 'sign-change-possible'
    ? chart.accuracy.moon.possibleSigns.join(' / ')
    : moon?.sign || 'Unknown'
  const identities = [
    { label: 'SUN', value: sun?.sign || 'Unknown', color: theme.primary },
    { label: 'MOON', value: moonValue, color: theme.secondary },
    { label: 'RISING', value: chart.ascendant?.sign || 'Unknown', color: theme.accent },
  ]

  return identities.map((identity, index) => {
    const x = 44 + index * 350
    return `<g transform="translate(${x} 1082)">
      <rect width="292" height="130" rx="28" fill="#ffffff" fill-opacity="0.045" stroke="${identity.color}" stroke-opacity="0.4"/>
      <circle cx="32" cy="34" r="5" fill="${identity.color}" filter="url(#marker-glow)"/>
      <text x="50" y="41" class="aura-chip-label">${identity.label}</text>
      <text x="24" y="93" class="aura-chip-value">${escapeXml(identity.value.toUpperCase())}</text>
    </g>`
  }).join('')
}

function renderAuraNatalChartSvg(
  chart: NatalChart,
  meta: ChartImageMetadata,
  options: ChartRenderOptions,
): string {
  const style = options.auraStyle || 'midnight'
  const theme = auraTheme(chart, style)
  const sun = chart.placements.find(placement => placement.body === 'Sun')
  const moon = chart.placements.find(placement => placement.body === 'Moon')
  const thirdPlacement = chart.ascendant || chart.placements.find(placement => placement.body === 'Venus') || sun
  const auraAnchors = [sun, moon, thirdPlacement].filter(Boolean) as Placement[]
  const auraColors = [theme.primary, theme.secondary, theme.accent]
  const auraClouds = auraAnchors.map((placement, index) => {
    const anchor = auraPoint(index === 2 ? 410 : 345, placement.longitude)
    const radius = style === 'prism' ? 285 : style === 'velvet' ? 250 : 265
    return `<circle cx="${anchor.x.toFixed(1)}" cy="${anchor.y.toFixed(1)}" r="${radius}" fill="${auraColors[index]}" opacity="${style === 'prism' ? '0.28' : '0.14'}" filter="url(#aura-cloud)"/>`
  }).join('')
  const ticks = Array.from({ length: 72 }, (_, index) => {
    const longitude = index * 5
    const inner = index % 6 === 0 ? 318 : 376
    return auraLineAt(longitude, inner, 386, `stroke="${theme.ink}" stroke-opacity="${index % 6 === 0 ? '0.3' : '0.11'}" stroke-width="1"`)
  }).join('')
  const ascendantAxis = chart.ascendant
    ? `${auraLineAt(chart.ascendant.longitude, 0, 314, `stroke="${theme.accent}" stroke-width="2.2" stroke-opacity="0.72"`)}
       ${auraLineAt(chart.ascendant.longitude + 180, 0, 314, `stroke="${theme.accent}" stroke-width="1.4" stroke-opacity="0.34"`)}`
    : ''
  const displayName = meta.name ? escapeXml(meta.name.toUpperCase()) : 'YOUR NATAL SIGNATURE'
  const title = meta.name ? `${escapeXml(meta.name.toUpperCase())}'S BIRTH CHART` : 'YOUR BIRTH CHART'
  const accuracyNote = escapeXml(chartAccuracyNote(chart))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${AURA_WIDTH}" height="${AURA_HEIGHT}" viewBox="0 0 ${AURA_WIDTH} ${AURA_HEIGHT}" role="img" aria-labelledby="chart-title chart-description">
  <title id="chart-title">${title}</title>
  <desc id="chart-description">A phone-first Western tropical natal chart generated from astronomical ephemeris data.</desc>
  <defs>
    <linearGradient id="aura-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.backgroundStart}"/>
      <stop offset="0.52" stop-color="${theme.backgroundMiddle}"/>
      <stop offset="1" stop-color="${theme.backgroundEnd}"/>
    </linearGradient>
    <radialGradient id="wheel-glass" cx="50%" cy="42%" r="66%">
      <stop offset="0" stop-color="${theme.ink}" stop-opacity="0.075"/>
      <stop offset="0.7" stop-color="${theme.ink}" stop-opacity="0.018"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.2"/>
    </radialGradient>
    <linearGradient id="core-gradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${theme.primary}"/>
      <stop offset="0.5" stop-color="${theme.secondary}"/>
      <stop offset="1" stop-color="${theme.accent}"/>
    </linearGradient>
    <filter id="aura-cloud" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${style === 'prism' ? 76 : 88}"/></filter>
    <filter id="ring-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="marker-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .aura-eyebrow { fill:${theme.primary}; font-size:17px; font-weight:700; letter-spacing:5px; }
      .aura-name { fill:${theme.ink}; font-size:${meta.name ? '62px' : '48px'}; font-weight:680; letter-spacing:1.5px; }
      .aura-subtitle { fill:${theme.muted}; font-size:18px; letter-spacing:4px; }
      .aura-sign { font-family:"Apple Symbols", "Segoe UI Symbol", sans-serif; font-size:31px; }
      .aura-portable-sign { font-family:"Noto Sans", sans-serif; font-size:15px; font-weight:650; letter-spacing:1.2px; }
      .aura-planet { fill:${theme.ink}; font-family:"Apple Symbols", "Segoe UI Symbol", sans-serif; font-size:28px; font-weight:700; }
      .aura-portable-planet { font-family:"Noto Sans", sans-serif; font-size:13px; letter-spacing:0.7px; }
      .aura-core { fill:${theme.ink}; font-size:13px; font-weight:700; letter-spacing:3.2px; }
      .aura-chip-label { fill:${theme.muted}; font-size:15px; font-weight:700; letter-spacing:3px; }
      .aura-chip-value { fill:${theme.ink}; font-size:25px; font-weight:650; letter-spacing:0.7px; }
      .aura-accuracy { fill:${theme.muted}; font-size:17px; letter-spacing:0.15px; }
      .aura-footer { fill:${theme.muted}; font-size:13px; font-weight:650; letter-spacing:3px; }
    </style>
  </defs>
  <rect width="${AURA_WIDTH}" height="${AURA_HEIGHT}" fill="url(#aura-bg)"/>
  ${auraClouds}
  ${renderAuraStars(chart, theme)}
  <rect x="28" y="28" width="1024" height="1294" rx="46" fill="none" stroke="${style === 'prism' ? theme.accent : theme.ink}" stroke-opacity="${style === 'prism' ? '0.24' : '0.11'}"/>
  <text x="64" y="72" class="aura-eyebrow">PINCH / NATAL SIGNATURE</text>
  <text x="64" y="145" class="aura-name">${displayName}</text>
  <text x="66" y="184" class="aura-subtitle">YOUR SKY, HELD STILL</text>
  <text x="1018" y="72" class="aura-footer" text-anchor="end">TROPICAL / GEO</text>
  <circle cx="${AURA_CX}" cy="${AURA_CY}" r="402" fill="url(#wheel-glass)" stroke="${theme.ink}" stroke-opacity="0.12" stroke-width="1.5"/>
  <circle cx="${AURA_CX}" cy="${AURA_CY}" r="315" fill="#03040a" fill-opacity="0.42" stroke="${theme.line}" stroke-opacity="0.45"/>
  ${ticks}
  ${renderAuraZodiac(chart, theme, options.portableLabels)}
  ${ascendantAxis}
  <g>${renderAuraAspects(chart.placements, theme)}</g>
  <g>${renderAuraPlanets(chart, theme, options.portableLabels)}</g>
  <circle cx="${AURA_CX}" cy="${AURA_CY}" r="73" fill="#080914" fill-opacity="0.92" stroke="url(#core-gradient)" stroke-width="2.5" filter="url(#marker-glow)"/>
  <circle cx="${AURA_CX}" cy="${AURA_CY - 14}" r="4" fill="${theme.primary}"/>
  <text x="${AURA_CX}" y="${AURA_CY + 12}" text-anchor="middle" class="aura-core">NATAL</text>
  <text x="${AURA_CX}" y="${AURA_CY + 34}" text-anchor="middle" class="aura-core" style="font-size:9px;letter-spacing:2px;fill:${theme.muted}">SIGNATURE</text>
  ${renderAuraIdentity(chart, theme)}
  <text x="540" y="1270" text-anchor="middle" class="aura-accuracy">${accuracyNote}</text>
  <text x="540" y="1304" text-anchor="middle" class="aura-footer">CALCULATED FROM YOUR EXACT SKY</text>
</svg>`
}

/**
 * Render a natal sign wheel as standalone SVG. All geometry comes from the
 * ephemeris chart. This deliberately does not invent houses when birth time is
 * absent, and it labels a Moon sign that can change during the birth date.
 */
function renderDetailedNatalChartSvg(
  chart: NatalChart,
  meta: ChartImageMetadata = {},
  options: ChartRenderOptions = {},
): string {
  if (!Array.isArray(chart.placements) || chart.placements.length < 2) {
    throw new Error('Chart has no usable placements')
  }

  const zodiac = Object.keys(SIGN_GLYPHS).map((sign, index) => {
    const start = index * 30
    const glyph = point(337, start + 15)
    const arcStart = point(378, start + 1.4)
    const arcEnd = point(378, start + 28.6)
    return `<path d="M ${arcStart.x.toFixed(2)} ${arcStart.y.toFixed(2)} A 378 378 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}" fill="none" stroke="${SIGN_COLORS[index]}" stroke-width="7" stroke-linecap="round" opacity="0.92"/>
      ${lineAt(start, 302, 373, `stroke="${SIGN_COLORS[index]}" stroke-opacity="0.48" stroke-width="1.5"`)}
      <text x="${glyph.x.toFixed(2)}" y="${(glyph.y + (options.portableLabels ? 5 : 11)).toFixed(2)}" class="sign-glyph${options.portableLabels ? ' portable-sign-label' : ''}" text-anchor="middle" fill="${SIGN_COLORS[index]}">${options.portableLabels ? SIGN_LABELS[sign] : SIGN_GLYPHS[sign]}</text>`
  }).join('')

  const degreeTicks = Array.from({ length: 72 }, (_, index) => {
    const longitude = index * 5
    const inner = index % 6 === 0 ? 300 : index % 2 === 0 ? 366 : 371
    return lineAt(longitude, inner, 376, `stroke="#e7ddd1" stroke-opacity="${index % 6 === 0 ? '0.45' : '0.18'}" stroke-width="1"`)
  }).join('')

  const ascendantAxis = chart.ascendant
    ? `${lineAt(chart.ascendant.longitude, 0, 298, 'stroke="#f7d985" stroke-width="2" stroke-opacity="0.9"')}
       ${lineAt(chart.ascendant.longitude + 180, 0, 298, 'stroke="#f7d985" stroke-width="2" stroke-opacity="0.5"')}
       <text x="${point(394, chart.ascendant.longitude).x.toFixed(2)}" y="${(point(394, chart.ascendant.longitude).y + 5).toFixed(2)}" class="axis-label" text-anchor="middle">ASC</text>`
    : ''

  const moonAccuracy = chart.accuracy?.moon
  const ambiguousRising = chart.accuracy?.possibleAscendants
    ?.map(placement => `${placement.sign} ${placement.degree.toFixed(1)}°`)
    .join(' or ')
  const accuracyNote = chart.accuracy?.ascendant === 'ambiguous-local-time'
    ? `Local birth time is DST-ambiguous. Rising could be ${ambiguousRising || chart.accuracy.possibleAscendantSigns?.join(' or ') || 'more than one position'}; axis omitted.`
    : moonAccuracy?.certainty === 'sign-change-possible'
    ? `Birth time unknown. Moon could be ${moonAccuracy.possibleSigns.join(' or ')}. Rising sign omitted.`
    : chart.ascendant
      ? `Tropical · geocentric · ${chart.accuracy?.ascendant === 'approximate-time' ? 'approximate birth time' : 'exact birth time'}`
      : 'Birth time unknown. Rising sign omitted.'

  const title = meta.name ? `${escapeXml(meta.name.toUpperCase())}'S BIRTH CHART` : 'YOUR BIRTH CHART'
  const displayName = meta.name ? escapeXml(meta.name.toUpperCase()) : 'NATAL CHART'
  const details = escapeXml(metadataLine(meta))

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200" role="img" aria-labelledby="chart-title chart-description">
  <title id="chart-title">${title}</title>
  <desc id="chart-description">Western tropical natal chart generated from astronomical ephemeris data.</desc>
  <defs>
    <radialGradient id="bg" cx="50%" cy="36%" r="78%"><stop offset="0" stop-color="#121926"/><stop offset="0.55" stop-color="#080b11"/><stop offset="1" stop-color="#040509"/></radialGradient>
    <radialGradient id="wheel" cx="50%" cy="50%" r="62%"><stop offset="0" stop-color="#101722"/><stop offset="0.72" stop-color="#080b11"/><stop offset="1" stop-color="#05070b"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .eyebrow { fill:#78f5d1; font-size:14px; letter-spacing:4px; font-weight:650; }
      .title { fill:#f3f7f5; font-size:48px; letter-spacing:1.5px; font-weight:700; }
      .details { fill:#899b99; font-size:15px; letter-spacing:0.8px; }
      .sign-glyph { font-family:"Apple Symbols", "Segoe UI Symbol", sans-serif; font-size:34px; }
      .planet-glyph { fill:#f3f7f5; font-family:"Apple Symbols", "Segoe UI Symbol", sans-serif; font-size:25px; font-weight:700; }
      .axis-label { fill:#f7d985; font-size:12px; letter-spacing:2px; font-weight:700; }
      .placement-glyph { fill:#78f5d1; font-family:"Apple Symbols", "Segoe UI Symbol", sans-serif; font-size:21px; }
      .portable-sign-label { font-family:"Noto Sans", sans-serif; font-size:14px; font-weight:600; letter-spacing:1px; }
      .portable-planet-label { font-family:"Noto Sans", sans-serif; font-size:11px; font-weight:700; letter-spacing:0.5px; }
      .portable-placement-label { font-family:"Noto Sans", sans-serif; font-size:12px; font-weight:700; letter-spacing:0.5px; }
      .placement-name { fill:#82918f; font-size:14px; letter-spacing:1.6px; }
      .placement-value { fill:#edf5f2; font-size:15px; font-weight:600; letter-spacing:0.4px; }
      .identity { fill:#eaf5f2; font-size:13px; font-weight:650; letter-spacing:1.8px; }
      .accuracy { fill:#6f817e; font-size:12px; letter-spacing:0.3px; }
    </style>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  ${renderSignalGrid()}
  ${renderStars()}
  <path d="M 64 56 H 82 M 64 56 V 74 M 1136 56 H 1118 M 1136 56 V 74" stroke="#78f5d1" stroke-opacity="0.72" stroke-width="2"/>
  <text x="82" y="48" class="eyebrow">PINCH // NATAL SIGNAL</text>
  <text x="82" y="98" class="title">${displayName}</text>
  ${details ? `<text x="84" y="126" class="details">${details}</text>` : ''}
  <text x="1118" y="50" class="details" text-anchor="end">TROPICAL / GEO</text>
  <text x="1118" y="76" class="details" text-anchor="end">CALC / ${escapeXml(chart.calculationVersion || 'EPHEMERIS')}</text>
  <circle cx="600" cy="510" r="378" fill="url(#wheel)" stroke="#43625b" stroke-width="1.2"/>
  <circle cx="600" cy="510" r="302" fill="#06090e" fill-opacity="0.88" stroke="#35544c" stroke-width="1.2"/>
  <circle cx="600" cy="510" r="230" fill="#090e15" stroke="#273a38" stroke-width="1"/>
  ${degreeTicks}
  ${zodiac}
  ${ascendantAxis}
  <g>${renderAspects(chart.placements)}</g>
  <g>${renderPlanetMarkers(chart, options.portableLabels)}</g>
  <circle cx="600" cy="510" r="61" fill="#05080d" stroke="#78f5d1" stroke-opacity="0.7" stroke-width="1.4"/>
  ${renderIdentity(chart)}
  <line x1="82" y1="910" x2="1118" y2="910" stroke="#3c5751"/>
  <text x="84" y="932" class="eyebrow" style="font-size:11px;letter-spacing:2.4px">// PLACEMENT INDEX</text>
  <line x1="600" y1="926" x2="600" y2="1138" stroke="#243834"/>
  ${renderPlacementRows(chart, options.portableLabels)}
  <path d="M 64 1144 V 1162 H 82 M 1136 1144 V 1162 H 1118" stroke="#78f5d1" stroke-opacity="0.48" stroke-width="2"/>
  <text x="600" y="1172" class="accuracy" text-anchor="middle">${escapeXml(accuracyNote)}</text>
</svg>`
}

/**
 * Render the shareable phone card by default. The denser square diagram stays
 * available as `layout: 'full'` for people who explicitly want every degree.
 */
export function renderNatalChartSvg(
  chart: NatalChart,
  meta: ChartImageMetadata = {},
  options: ChartRenderOptions = {},
): string {
  if (!Array.isArray(chart.placements) || chart.placements.length < 2) {
    throw new Error('Chart has no usable placements')
  }
  return options.layout === 'full'
    ? renderDetailedNatalChartSvg(chart, meta, options)
    : renderAuraNatalChartSvg(chart, meta, options)
}

/** Render the verified SVG wheel as an iMessage-compatible PNG attachment. */
export async function renderNatalChartPng(
  chart: NatalChart,
  meta: ChartImageMetadata = {},
  options: ChartRenderOptions = {},
): Promise<Buffer> {
  // Sharp delegates SVG text to Fontconfig. Vercel's serverless image does
  // not include the macOS fonts used by the browser preview, so every label
  // and astrology symbol was rasterized as a missing-glyph box. Resvg loads
  // these bundled OFL fonts directly and deliberately ignores system fonts,
  // making the iMessage PNG identical across local and production hosts.
  const { Resvg } = await import('@resvg/resvg-js')
  const svg = renderNatalChartSvg(chart, meta, { ...options, portableLabels: true })
  const fontFile = path.join(tmpdir(), 'pinch-noto-sans-v27-latin-regular.ttf')
  if (!existsSync(fontFile)) {
    try {
      writeFileSync(fontFile, Buffer.from(CHART_FONT_BASE64, 'base64'), { flag: 'wx' })
    } catch (error: any) {
      // Two warm-up requests can race to materialize the same immutable font.
      if (error?.code !== 'EEXIST') throw error
    }
  }

  const renderer = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      fontFiles: [fontFile],
      loadSystemFonts: false,
      defaultFontFamily: 'Noto Sans',
      sansSerifFamily: 'Noto Sans',
    },
    textRendering: 2,
  })

  return renderer.render().asPng()
}
