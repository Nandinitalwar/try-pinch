import test from 'node:test'
import assert from 'node:assert/strict'
import { computeNatalChart, formatHistoricalYearForAgent, zonedTimeToUtc, zonedTimeToUtcCandidates } from '../lib/astrology'
import { renderNatalChartPng, renderNatalChartSvg } from '../lib/chartImage'

const referenceChart = () => computeNatalChart({
  birthDate: '1996-03-03',
  birthTime: '04:15:00',
  timezone: 'Asia/Kolkata',
  latitude: 28.6139,
  longitude: 77.2090,
  birthTimeKnown: true,
  birthTimeAccuracy: 'exact',
})

test('geocentric placements agree with a Swiss Ephemeris reference chart', () => {
  // Reference values generated with Swiss Ephemeris 2.10.03 for
  // 1996-03-02 22:45 UTC. Tolerance is wider than the observed difference
  // (<0.003°) so harmless ephemeris version updates do not make this flaky.
  const expected: Record<string, number> = {
    Sun: 342.64545,
    Moon: 135.01498,
    Mercury: 322.83888,
    Venus: 26.48026,
    Mars: 342.99617,
    Jupiter: 282.06279,
    Saturn: 355.64070,
    Uranus: 302.83476,
    Neptune: 296.87913,
    Pluto: 243.11312,
  }
  const chart = referenceChart()

  for (const placement of chart.placements) {
    assert.ok(Math.abs(placement.longitude - expected[placement.body]) < 0.02, placement.body)
  }
  assert.equal(chart.utcBirthTime, '1996-03-02T22:45:00.000Z')
  assert.ok(chart.ascendant)
  assert.ok(Math.abs(chart.ascendant.longitude - 295.36690) < 0.02)
  assert.equal(chart.calculationVersion, 'tropical-geocentric-v2')
  assert.equal(chart.accuracy?.moon.certainty, 'exact-time')
})

test('historical questions receive computed year-level chart timing', () => {
  const briefing = formatHistoricalYearForAgent(referenceChart(), 2014)
  assert.match(briefing, /HISTORICAL ASTROLOGY BRIEFING FOR 2014/)
  assert.match(briefing, /computed from their exact natal chart/)
  assert.match(briefing, /2014/)
  assert.match(briefing, /Use this instead of today's sky/)
})

test('unknown birth time exposes a possible Moon sign change and omits rising', () => {
  const chart = computeNatalChart({
    birthDate: '2026-01-02',
    timezone: 'America/Los_Angeles',
    birthTimeKnown: false,
  })

  assert.equal(chart.ascendant, null)
  assert.equal(chart.accuracy?.moon.certainty, 'sign-change-possible')
  assert.deepEqual(chart.accuracy?.moon.possibleSigns, ['Gemini', 'Cancer'])

  const svg = renderNatalChartSvg(chart, { birthDate: '2026-01-02', birthTimeKnown: false })
  assert.match(svg, /Moon could be Gemini or Cancer/)
  assert.match(svg, /Rising sign omitted/)
  assert.doesNotMatch(svg, />ASC</)
})

test('input validation rejects rolled dates, coordinates, zones, and DST gaps', () => {
  assert.throws(() => zonedTimeToUtc('2026-02-30', '12:00:00', 'UTC'), /Invalid birthDate/)
  assert.throws(() => zonedTimeToUtc('2026-02-03', '25:00:00', 'UTC'), /Invalid birthTime/)
  assert.throws(() => zonedTimeToUtc('2026-02-03', '12:00:00', 'Mars\/Olympus'), /Invalid IANA timezone/)
  assert.throws(
    () => zonedTimeToUtc('2026-03-08', '02:30:00', 'America/Los_Angeles'),
    /does not exist/,
  )
  assert.throws(() => computeNatalChart({
    birthDate: '2026-02-03',
    birthTime: '12:00:00',
    timezone: 'UTC',
    latitude: 91,
    longitude: 0,
    birthTimeKnown: true,
  }), /Invalid latitude/)
})

test('DST fall-back times retain both UTC and rising-position possibilities', () => {
  const candidates = zonedTimeToUtcCandidates('2021-11-07', '01:30:00', 'America/New_York')
  assert.deepEqual(candidates.map(candidate => candidate.toISOString()), [
    '2021-11-07T05:30:00.000Z',
    '2021-11-07T06:30:00.000Z',
  ])

  const chart = computeNatalChart({
    birthDate: '2021-11-07',
    birthTime: '01:30:00',
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
    birthTimeKnown: true,
  })
  assert.equal(chart.ascendant, null)
  assert.equal(chart.accuracy?.ascendant, 'ambiguous-local-time')
  assert.equal(chart.accuracy?.possibleAscendants?.length, 2)
  assert.notEqual(
    chart.accuracy?.possibleAscendants?.[0].degree,
    chart.accuracy?.possibleAscendants?.[1].degree,
  )

  const svg = renderNatalChartSvg(chart, {
    birthDate: '2021-11-07', birthTime: '01:30:00', birthTimeKnown: true,
  })
  assert.match(svg, /Local birth time is DST-ambiguous/)
  assert.match(svg, /axis omitted/)
})

test('phone SVG is accessible, portrait, private by default, and escapes profile text', () => {
  const svg = renderNatalChartSvg(referenceChart(), {
    name: 'N<&',
    birthDate: '1996-03-03',
    birthTime: '04:15:00',
    birthTimeKnown: true,
    birthCity: 'Delhi & NCR',
  })

  assert.match(svg, /^<\?xml/)
  assert.match(svg, /role="img"/)
  assert.match(svg, /width="1080" height="1350"/)
  assert.match(svg, /N&lt;&amp;'S BIRTH CHART/)
  assert.doesNotMatch(svg, /Delhi &amp; NCR/)
  assert.doesNotMatch(svg, /1996-03-03/)
  assert.doesNotMatch(svg, /PLACEMENT INDEX/)
  assert.doesNotMatch(svg, /N<&/)
  assert.match(svg, /Tropical · geocentric · exact birth time/)
})

test('full-detail SVG retains metadata and the placement index on request', () => {
  const svg = renderNatalChartSvg(referenceChart(), {
    name: 'N<&',
    birthDate: '1996-03-03',
    birthTime: '04:15:00',
    birthTimeKnown: true,
    birthCity: 'Delhi & NCR',
  }, { layout: 'full' })

  assert.match(svg, /width="1200" height="1200"/)
  assert.match(svg, /Delhi &amp; NCR/)
  assert.match(svg, /PLACEMENT INDEX/)
  assert.match(svg, /N&lt;&amp;'S BIRTH CHART/)
})

test('chart renders as a Linq-compatible PNG under the URL media limit', async () => {
  const portableSvg = renderNatalChartSvg(referenceChart(), {}, { portableLabels: true })
  assert.match(portableSvg, />ARI</)
  assert.match(portableSvg, />SU</)
  assert.doesNotMatch(portableSvg, /[♈♉♊♋♌♍♎♏♐♑♒♓☉☽☿♀♂♃♄♅♆♇]/)

  const png = await renderNatalChartPng(referenceChart(), {
    birthDate: '1996-03-03',
    birthTime: '04:15:00',
    birthTimeKnown: true,
    birthCity: 'New Delhi',
  })

  assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
  assert.ok(png.byteLength < 10 * 1024 * 1024)
})
