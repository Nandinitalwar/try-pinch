import assert from 'node:assert/strict'
import test from 'node:test'
import {
  analyzeRawReply,
  buildMinimalQualityPrompt,
  estimateTokens,
  MINIMAL_PINCH_PROMPT,
  MINIMAL_QUALITY_CASES,
} from '../lib/minimalQualityHarness'

test('minimal prompt stays genuinely compact and production-independent', () => {
  const words = MINIMAL_PINCH_PROMPT.trim().split(/\s+/).length
  assert(words <= 230, `minimal prompt grew to ${words} words`)
  assert.doesNotMatch(MINIMAL_PINCH_PROMPT, /search_web|save_birth_data|convex|database|tool call/i)
})

test('minimal quality cases are unique and fit inside Groq free-plan context budget', () => {
  assert.equal(MINIMAL_QUALITY_CASES.length, 7)
  assert.equal(new Set(MINIMAL_QUALITY_CASES.map(testCase => testCase.id)).size, MINIMAL_QUALITY_CASES.length)

  for (const testCase of MINIMAL_QUALITY_CASES) {
    const prompt = buildMinimalQualityPrompt(testCase)
    assert.match(prompt, /Exact tropical chart, private evidence only/)
    assert.match(prompt, new RegExp(testCase.privateContext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert(estimateTokens(`${prompt}\n${testCase.userMessage}`) < 900, `${testCase.id} prompt is too large`)
  }
})

test('raw analysis reports voice and local-time failures without rewriting them', () => {
  const today = MINIMAL_QUALITY_CASES.find(testCase => testCase.id === 'today_direction')
  assert(today)
  const bad = analyzeRawReply(today, 'Here\u2019s the thing \u2014 go to bed. Trust the process.')
  assert(bad.violations.some(item => item.kind === 'ai_tell'))
  assert(bad.violations.some(item => item.kind === 'banned_phrase'))
  assert(bad.violations.some(item => item.kind === 'time_mismatch'))

  const clean = analyzeRawReply(today, 'Take a long walk before dinner. Leave your phone at home.')
  assert.deepEqual(clean.violations, [])
})
