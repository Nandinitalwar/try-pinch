import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_GROQ_REPLY_MODEL,
  DEFAULT_GLM_REPLY_MODEL,
  DEFAULT_OPENAI_REPLY_MODEL,
  getReplyProviderRequestOptions,
  GROQ_OPENAI_BASE_URL,
  GLM_OPENAI_BASE_URL,
  resolveReplyProviderConfig,
} from '../lib/replyProvider'

test('OpenAI remains the explicit default reply provider', () => {
  const config = resolveReplyProviderConfig({ OPENAI_API_KEY: 'openai-test-key' })

  assert.equal(config.provider, 'openai')
  assert.equal(config.model, DEFAULT_OPENAI_REPLY_MODEL)
  assert.equal(config.reasoningEffort, 'medium')
  assert.equal(config.baseURL, undefined)
})

test('Groq uses its OpenAI-compatible endpoint and the quality-first free model', () => {
  const config = resolveReplyProviderConfig({
    PINCH_REPLY_PROVIDER: 'groq',
    GROQ_API_KEY: 'groq-test-key',
  })

  assert.equal(config.provider, 'groq')
  assert.equal(config.model, DEFAULT_GROQ_REPLY_MODEL)
  assert.equal(config.reasoningEffort, 'low')
  assert.equal(config.baseURL, GROQ_OPENAI_BASE_URL)
})

test('reply model and reasoning remain configurable on Groq', () => {
  const config = resolveReplyProviderConfig({
    PINCH_REPLY_PROVIDER: 'groq',
    GROQ_API_KEY: 'groq-test-key',
    PINCH_REPLY_MODEL: 'openai/gpt-oss-20b',
    PINCH_REPLY_REASONING_EFFORT: 'medium',
  })

  assert.equal(config.model, 'openai/gpt-oss-20b')
  assert.equal(config.reasoningEffort, 'medium')
})

test('GLM-5.2 uses its OpenAI-compatible endpoint', () => {
  const config = resolveReplyProviderConfig({ PINCH_REPLY_PROVIDER: 'glm', GLM_API_KEY: 'glm-test-key' })
  assert.equal(config.provider, 'glm')
  assert.equal(config.model, DEFAULT_GLM_REPLY_MODEL)
  assert.equal(config.reasoningEffort, 'low')
  assert.equal(config.baseURL, GLM_OPENAI_BASE_URL)
})

test('provider-specific keys fail clearly instead of silently falling back', () => {
  assert.throws(
    () => resolveReplyProviderConfig({ PINCH_REPLY_PROVIDER: 'groq' }),
    /GROQ_API_KEY is not configured/
  )
  assert.throws(
    () => resolveReplyProviderConfig({ PINCH_REPLY_PROVIDER: 'grok', GROQ_API_KEY: 'x' }),
    /must be "openai", "groq", or "glm"/
  )
})

test('Groq requests omit fields its beta Responses API rejects', () => {
  const groq = getReplyProviderRequestOptions('groq', 'low', 'hashed-user')
  const openai = getReplyProviderRequestOptions('openai', 'medium', 'hashed-user')

  assert.deepEqual(groq, { reasoning: { effort: 'low' } })
  assert.equal('store' in groq, false)
  assert.equal('include' in groq, false)
  assert.equal('safety_identifier' in groq, false)
  assert.equal('prompt_cache_key' in groq, false)

  assert.equal(openai.store, false)
  assert.deepEqual(openai.include, ['reasoning.encrypted_content'])
  assert.equal(openai.safety_identifier, 'hashed-user')
  assert.equal(openai.prompt_cache_key, 'hashed-user')
})
