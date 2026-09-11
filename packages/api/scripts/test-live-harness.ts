import assert from 'node:assert/strict'
import { checkActivationReply, checkFirstChartIntroduction, checkRepetition, checkVoice } from '../lib/voiceCheck'

const baseUrl = (process.env.PINCH_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const sessionId = `live-harness-${Date.now()}`

async function chat(message: string, targetSessionId = sessionId): Promise<{
  response: string
  sessionId: string
  chartGenerated: boolean
}> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId: targetSessionId }),
  })
  if (!response.ok) throw new Error(`chat returned ${response.status}: ${await response.text()}`)
  return response.json()
}

function assertCleanVoice(reply: string): void {
  const violations = checkVoice(reply)
  assert.deepEqual(violations, [], `voice violations in "${reply}": ${JSON.stringify(violations)}`)
}

async function main() {
  const partialSessionId = `${sessionId}-partial`
  const partial = await chat(
    "my birthday is march 3 1996 but i don't know the time or birth city",
    partialSessionId,
  )
  assert.equal(partial.chartGenerated, false)
  assertCleanVoice(partial.response)

  const firstHoroscope = await chat("what's my horoscope today?")
  assert.equal(firstHoroscope.chartGenerated, false)
  assertCleanVoice(firstHoroscope.response)
  assert.deepEqual(
    checkActivationReply(firstHoroscope.response, 'collect-name-and-birth'),
    [],
    `first activation question skipped an input: ${firstHoroscope.response}`,
  )

  const birth = await chat('i was born march 3 1996 at 4:15am in new delhi, india')
  assert.equal(birth.chartGenerated, false)
  assertCleanVoice(birth.response)
  assert.deepEqual(checkActivationReply(birth.response, 'collect-name'), [])

  const namedReveal = await chat('Nandini')
  assert.equal(namedReveal.chartGenerated, true)
  assertCleanVoice(namedReveal.response)
  assert.deepEqual(
    checkFirstChartIntroduction(namedReveal.response, { answerRequested: true }),
    [],
    `first chart was not explained: ${namedReveal.response}`,
  )

  const chartResponse = await fetch(`${baseUrl}/api/chart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  })
  if (!chartResponse.ok) throw new Error(`chart returned ${chartResponse.status}: ${await chartResponse.text()}`)
  assert.match(chartResponse.headers.get('content-type') || '', /^image\/svg\+xml/)
  const svg = await chartResponse.text()
  assert.match(svg, /Pisces 12\.6°/)
  assert.match(svg, /Capricorn 25\.4°/)
  assert.match(svg, /Tropical · geocentric · exact birth time/)

  const advice = await chat('should i text my ex tonight')
  assert.equal(advice.chartGenerated, false)
  assertCleanVoice(advice.response)
  assert.match(advice.response.slice(0, 32), /\b(no|nope|nah|don't|do not|leave|skip|absolutely not)\b/i)

  const show = await chat('show me my chart again')
  assert.equal(show.chartGenerated, true)
  assertCleanVoice(show.response)
  assert.doesNotMatch(show.response, /can(?:not|'t) (?:show|send|display)/i)
  assert.deepEqual(checkRepetition(show.response, [namedReveal.response], 'show me my chart again'), [])

  const repeatedAdvice = await chat('should i text my ex tonight')
  assertCleanVoice(repeatedAdvice.response)
  assert.deepEqual(
    checkRepetition(repeatedAdvice.response, [advice.response], 'should i text my ex tonight'),
    [],
    'the repeated question received substantially the same answer wording',
  )

  console.log(JSON.stringify({
    ok: true,
    sessionId,
    partialReply: partial.response,
    firstHoroscopeReply: firstHoroscope.response,
    birthReply: birth.response,
    namedRevealReply: namedReveal.response,
    adviceReply: advice.response,
    repeatedAdviceReply: repeatedAdvice.response,
    chartReply: show.response,
    svgBytes: Buffer.byteLength(svg),
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
