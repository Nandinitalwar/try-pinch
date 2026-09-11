import test from 'node:test'
import assert from 'node:assert/strict'
import { splitForExample } from '../lib/datasetPolicy'
import { TrainingExample, trainingGroupId } from '../lib/trainingData'

function example(groupId?: string, systemPrompt = 'context'): TrainingExample {
  return { timestamp: '2026-01-01T00:00:00Z', systemPrompt, userMessage: 'hi', chosen: 'hey', violations: [], groupId }
}

test('training group ids are stable, short, and do not expose the identifier', () => {
  const id = trainingGroupId('+14155550123')
  assert.equal(id, trainingGroupId('+14155550123'))
  assert.equal(id.length, 20)
  assert.ok(!id.includes('4155550123'))
})

test('every row from one conversation stays in one dataset split', () => {
  const rows = [example('profile-a'), example('profile-a'), example('profile-a')]
  assert.equal(new Set(rows.map(row => splitForExample(row))).size, 1)
})

test('legacy rows with identical context stay in one dataset split', () => {
  assert.equal(splitForExample(example(undefined, 'same context')), splitForExample(example(undefined, 'same context')))
})

test('invalid validation ratios fail closed', () => {
  assert.throws(() => splitForExample(example('x'), 0), /between 0 and 1/)
  assert.throws(() => splitForExample(example('x'), 1), /between 0 and 1/)
})
