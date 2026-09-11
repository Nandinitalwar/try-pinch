import assert from 'node:assert/strict'
import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

async function main() {
  const { SimpleMemorySystem } = await import('../lib/simpleMemory')
  const memory = new SimpleMemorySystem({ database: null })
  const cases = [
    {
      name: 'durable relationship plan',
      message: 'my sister Maya is getting married in September 2026',
      expectedCount: 1,
      expectedKey: /sister|wedding/,
    },
    {
      name: 'throwaway question',
      message: 'should i text my ex tonight',
      expectedCount: 0,
    },
    {
      name: 'transient mood',
      message: 'ugh i am so tired today',
      expectedCount: 0,
    },
    {
      name: 'sensitive credential',
      message: 'my password is hunter-seven, remember it for me',
      expectedCount: 0,
    },
    {
      name: 'sensitive health condition',
      message: 'I was diagnosed with bipolar disorder last year, remember this',
      expectedCount: 0,
    },
    {
      name: 'sensitive beliefs',
      message: 'I am Buddhist and I vote Republican, remember that',
      expectedCount: 0,
    },
  ]

  const results = []
  for (const testCase of cases) {
    const extracted = await memory.extractMemories(
      testCase.message,
      'Assistant text must never become memory.',
      'memory-extraction-live-eval'
    )
    assert.equal(
      extracted.length,
      testCase.expectedCount,
      `${testCase.name}: ${JSON.stringify(extracted)}`
    )
    if (testCase.expectedKey) {
      assert.match(extracted[0]?.memory_key || '', testCase.expectedKey)
    }
    results.push({
      name: testCase.name,
      memories: extracted.map(item => ({
        operation: item.operation,
        key: item.memory_key || item.target_key,
        content: item.memory_content,
      })),
    })
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
