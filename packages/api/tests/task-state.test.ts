import test from 'node:test'
import assert from 'node:assert/strict'
import { assertTransition, normalizeIdempotencyKey, normalizeTaskTitle, parseOptionalTimestamp } from '../lib/taskState'

test('task titles normalize and reject empty or oversized input', () => {
  assert.equal(normalizeTaskTitle('  book   the flight  '), 'book the flight')
  assert.throws(() => normalizeTaskTitle('   '), /required/)
  assert.throws(() => normalizeTaskTitle('x'.repeat(241)), /240/)
})

test('idempotency keys are stable when the client omits one', () => {
  assert.equal(normalizeIdempotencyKey(undefined, 'Book the flight!'), 'book-the-flight')
  assert.equal(normalizeIdempotencyKey('request-42', 'ignored'), 'request-42')
})

test('task lifecycle prevents reopening terminal work', () => {
  assert.doesNotThrow(() => assertTransition('pending', 'completed'))
  assert.doesNotThrow(() => assertTransition('snoozed', 'pending'))
  assert.throws(() => assertTransition('completed', 'pending'), /cannot transition/)
  assert.throws(() => assertTransition('cancelled', 'snoozed'), /cannot transition/)
})

test('optional timestamps accept ISO or epoch and reject garbage', () => {
  assert.equal(parseOptionalTimestamp(undefined, 'dueAt'), undefined)
  assert.equal(parseOptionalTimestamp(1234, 'dueAt'), 1234)
  assert.equal(parseOptionalTimestamp('1970-01-01T00:00:01.000Z', 'dueAt'), 1000)
  assert.throws(() => parseOptionalTimestamp('later-ish', 'dueAt'), /valid date/)
})
