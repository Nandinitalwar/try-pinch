import test from 'node:test'
import assert from 'node:assert/strict'
import { getConversationFastPath, isBareGreeting } from '../lib/conversationFastPath'

test('bare greetings get a natural reply without starting onboarding', () => {
  assert.equal(getConversationFastPath('hi'), "hey, what's up")
  assert.equal(getConversationFastPath('yo'), "yo, what's up")
  assert.equal(getConversationFastPath('morning'), 'morning :)')
})

test('greeting fast path mirrors obvious energy', () => {
  assert.equal(getConversationFastPath('hi!!'), "hey!! what's up")
  assert.equal(getConversationFastPath('HI!!'), "HEY!! WHAT'S UP")
})

test('real questions and media context still reach the agent', () => {
  assert.equal(isBareGreeting("hi, what's my horoscope?"), false)
  assert.equal(getConversationFastPath('hi [They sent a photo or video: a yellow cake]'), null)
})
