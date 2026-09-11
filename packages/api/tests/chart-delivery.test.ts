import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createChartDeliveryToken,
  getChartDeliveryReason,
  verifyChartDeliveryToken,
} from '../lib/chartDelivery'
import { isExplicitPreferredName } from '../lib/userProfile'

const secret = 'test-chart-signing-secret'
const nowMs = 1_800_000_000_000

test('chart delivery tokens are signed, scoped, and expire', () => {
  const token = createChartDeliveryToken('+15555550100', {
    secret,
    nowMs,
    ttlMs: 60_000,
  })

  assert.deepEqual(verifyChartDeliveryToken(token, { secret, nowMs }), {
    version: 1,
    subject: '+15555550100',
    expiresAt: 1_800_000_060,
  })
  assert.equal(verifyChartDeliveryToken(`${token}x`, { secret, nowMs }), null)
  assert.equal(verifyChartDeliveryToken(token, { secret, nowMs: nowMs + 60_000 }), null)
  assert.equal(verifyChartDeliveryToken(token, { secret: 'wrong-secret', nowMs }), null)
})

test('a chart attaches only for creation, explicit requests, or the first horoscope', () => {
  const chart = '{"placements":[]}'
  const introduced = '2026-08-10T12:00:00.000Z'
  const name = 'Nandini'

  assert.equal(
    getChartDeliveryReason(undefined, { chart_json: chart }, 'march 3 1996 at 4:15am in delhi'),
    null,
  )
  assert.equal(
    getChartDeliveryReason(undefined, { preferred_name: name, chart_json: chart }, 'march 3 1996 at 4:15am in delhi'),
    'new-chart',
  )
  assert.equal(
    getChartDeliveryReason(
      { chart_json: chart },
      { preferred_name: name, chart_json: chart },
      'Nandini',
    ),
    'completed-onboarding',
  )
  assert.equal(
    getChartDeliveryReason(
      { preferred_name: name, chart_json: chart },
      { preferred_name: name, chart_json: chart },
      "what's my horoscope today?",
    ),
    'first-horoscope',
  )
  assert.equal(
    getChartDeliveryReason(
      { preferred_name: name, chart_json: chart, chart_introduced_at: introduced },
      { preferred_name: name, chart_json: chart, chart_introduced_at: introduced },
      'show me my birth chart',
    ),
    'requested-chart',
  )
  assert.equal(
    getChartDeliveryReason(
      { preferred_name: name, chart_json: chart, chart_introduced_at: introduced },
      { preferred_name: name, chart_json: chart, chart_introduced_at: introduced },
      "what's my horoscope tomorrow?",
    ),
    null,
  )
})

test('preferred names must be explicitly claimed in the latest message', () => {
  assert.equal(isExplicitPreferredName('london, england', 'Bean'), false)
  assert.equal(isExplicitPreferredName('Nandini', 'Nandini'), true)
  assert.equal(isExplicitPreferredName('call me Nandi', 'Nandi'), true)
  assert.equal(isExplicitPreferredName("my name is Nandini, it's nice to meet you", 'Nandini'), true)
})
