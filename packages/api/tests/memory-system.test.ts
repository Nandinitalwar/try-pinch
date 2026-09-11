import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MEMORY_EMBEDDING_DIMENSIONS,
  SimpleMemorySystem,
  cosineSimilarity,
  isMemoryContentAllowed,
  mergeHybridMemoryResults,
  normalizeMemoryContent,
  normalizeMemoryKey,
} from '../lib/simpleMemory'

test('memory keys and content normalize deterministically', () => {
  assert.equal(normalizeMemoryKey(' Relationship: Sister Maya!! '), 'relationship:sister_maya')
  assert.equal(normalizeMemoryContent('  Maya’s   Wedding! '), 'mayas wedding')
})

test('deterministic privacy filter blocks credentials, account numbers, and exact addresses', () => {
  assert.equal(isMemoryContentAllowed('My password is hunter-seven.'), false)
  assert.equal(isMemoryContentAllowed('My credit card number is 4242 4242 4242 4242.'), false)
  assert.equal(isMemoryContentAllowed('I live at 123 Main Street.'), false)
  assert.equal(isMemoryContentAllowed('The user was diagnosed with bipolar disorder.'), false)
  assert.equal(isMemoryContentAllowed('The user identifies as Buddhist.'), false)
  assert.equal(isMemoryContentAllowed('The user votes Republican.'), false)
  assert.equal(isMemoryContentAllowed('My sister Maya is getting married in September.'), true)
})

test('hybrid recall deduplicates results and preserves exact-match signal', () => {
  const coffee: any = { _id: 'coffee', importance: 4 }
  const sister: any = { _id: 'sister', importance: 8 }
  const work: any = { _id: 'work', importance: 9 }

  const merged = mergeHybridMemoryResults(
    [
      { _id: 'sister', _score: 0.88 },
      { _id: 'work', _score: 0.62 },
      { _id: 'coffee', _score: 0.2 },
    ],
    [sister, work, coffee],
    [sister],
    10
  )

  assert.deepEqual(merged.map(memory => memory._id), ['sister', 'work'])
})

test('cosine similarity can rank a just-written memory before search indexes catch up', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1)
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0)
  assert.equal(cosineSimilarity([1], [1, 0]), -1)
})

test('extraction reads only the latest user message and carries provenance', async () => {
  let request: any
  const fakeOpenAI = {
    responses: {
      create: async (input: any) => {
        request = input
        return {
          output_text: JSON.stringify({
            operations: [{
              action: 'upsert',
              target_key: null,
              key: 'relationship:sister_maya',
              content: 'Their sister Maya is getting married in September 2026.',
              memory_type: 'relationship',
              importance: 8,
              confidence: 0.98,
              valid_until: null,
            }],
          }),
        }
      },
    },
    embeddings: { create: async () => ({ data: [] }) },
  }
  const fakeDatabase = {
    query: async () => [],
  }
  const memory = new SimpleMemorySystem({ openai: fakeOpenAI, database: fakeDatabase })
  const extracted = await memory.extractMemories(
    'my sister Maya is getting married in September',
    'You are obviously a lifelong vegan.',
    'test-user',
    'event-123'
  )

  assert.equal(request.input, 'my sister Maya is getting married in September')
  assert.doesNotMatch(request.instructions, /lifelong vegan/)
  assert.equal(extracted.length, 1)
  assert.equal(extracted[0].memory_key, 'relationship:sister_maya')
  assert.equal(extracted[0].source_event_id, 'event-123')
})

test('extraction cannot delete a memory key that does not exist', async () => {
  const fakeOpenAI = {
    responses: {
      create: async () => ({
        output_text: JSON.stringify({
          operations: [{
            action: 'delete',
            target_key: 'relationship:imaginary',
            key: null,
            content: null,
            memory_type: null,
            importance: null,
            confidence: null,
            valid_until: null,
          }],
        }),
      }),
    },
    embeddings: { create: async () => ({ data: [] }) },
  }
  const memory = new SimpleMemorySystem({
    openai: fakeOpenAI,
    database: { query: async () => [] },
  })

  assert.deepEqual(await memory.extractMemories('forget imaginary', '', 'test-user'), [])
})

test('storage embeds upserts once and sends provenance to Convex', async () => {
  const mutations: any[] = []
  const fakeOpenAI = {
    responses: { create: async () => ({ output_text: '{"operations":[]}' }) },
    embeddings: {
      create: async ({ input, dimensions }: any) => ({
        data: input.map((_: string, index: number) => ({
          index,
          embedding: Array(dimensions).fill(index + 1),
        })),
      }),
    },
  }
  const fakeDatabase = {
    mutation: async (_reference: unknown, args: any) => {
      mutations.push(args)
      return true
    },
  }
  const memory = new SimpleMemorySystem({ openai: fakeOpenAI, database: fakeDatabase })
  const stored = await memory.storeMemories('test-user', [{
    phone_number: 'test-user',
    memory_content: 'They prefer iced coffee.',
    memory_type: 'preference',
    importance: 6,
    confidence: 0.95,
    memory_key: 'preference:coffee',
    operation: 'upsert',
    source_event_id: 'event-123',
    legacy_source_id: 'mem0-456',
  }])

  assert.equal(stored, true)
  assert.equal(mutations.length, 1)
  assert.equal(mutations[0].sourceEventId, 'event-123')
  assert.equal(mutations[0].legacySourceId, 'mem0-456')
  assert.equal(mutations[0].embedding.length, MEMORY_EMBEDDING_DIMENSIONS)
  assert.equal(mutations[0].normalizedContent, 'they prefer iced coffee')
})

test('formatted recall tells the reply model not to show off memory', () => {
  const prompt = SimpleMemorySystem.formatMemories([{
    phone_number: 'test-user',
    memory_content: 'Their sister Maya is getting married in September.',
    memory_type: 'relationship',
    importance: 8,
  }])
  assert.match(prompt, /directly helps with their latest message/)
  assert.match(prompt, /Do not mention that it came from memory/)
})
