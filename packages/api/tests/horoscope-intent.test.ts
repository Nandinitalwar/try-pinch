import test from 'node:test'
import assert from 'node:assert/strict'
import { isPersonalHoroscopeRequest } from '../lib/horoscopeIntent'

test('personal horoscope requests trigger chart onboarding', () => {
  assert.equal(isPersonalHoroscopeRequest("what's my horoscope today?"), true)
  assert.equal(isPersonalHoroscopeRequest('horoscope?'), true)
  assert.equal(isPersonalHoroscopeRequest('can i get a love horoscope'), true)
  assert.equal(isPersonalHoroscopeRequest('what should i do today? idk what to do'), true)
  assert.equal(isPersonalHoroscopeRequest('should i go out tonight?'), true)
  assert.equal(isPersonalHoroscopeRequest("what's my week looking like?"), true)
})

test('general questions about horoscopes do not reveal a personal chart', () => {
  assert.equal(isPersonalHoroscopeRequest('what is a horoscope?'), false)
  assert.equal(isPersonalHoroscopeRequest('how do horoscopes work?'), false)
  assert.equal(isPersonalHoroscopeRequest('tell me about astrology'), false)
})
