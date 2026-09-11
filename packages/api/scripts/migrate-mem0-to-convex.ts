import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { config } from 'dotenv'
import OpenAI from 'openai'

config({ path: '.env.local', quiet: true })

const MEM0_BASE_URL = 'https://api.mem0.ai'
const CLASSIFICATION_MODEL = process.env.PINCH_MEMORY_EXTRACTION_MODEL?.trim() || 'gpt-5.6-luna'
const BATCH_SIZE = 12

type Entity = { name: string; type: string }
type LegacyMemory = {
  id: string
  memory?: string
  text?: string
  created_at?: string
}

type Decision = {
  input_index: number
  include: boolean
  key: string | null
  memory_type: string | null
  importance: number | null
  confidence: number | null
  valid_until: string | null
}

const decisionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    decisions: {
      type: 'array',
      maxItems: BATCH_SIZE,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          input_index: { type: 'integer', minimum: 0, maximum: BATCH_SIZE - 1 },
          include: { type: 'boolean' },
          key: { type: ['string', 'null'] },
          memory_type: {
            type: ['string', 'null'],
            enum: [
              'identity', 'preference', 'relationship', 'work', 'goal',
              'project', 'plan', 'routine', 'constraint', 'experience', 'other', null,
            ],
          },
          importance: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
          confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
          valid_until: { type: ['string', 'null'] },
        },
        required: [
          'input_index', 'include', 'key', 'memory_type', 'importance',
          'confidence', 'valid_until',
        ],
      },
    },
  },
  required: ['decisions'],
} as const

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function mem0Fetch(pathOrUrl: string, init: RequestInit = {}): Promise<any> {
  const apiKey = process.env.MEM0_API_KEY?.trim()
  assert.ok(apiKey, 'MEM0_API_KEY is required')
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${MEM0_BASE_URL}${pathOrUrl}`
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Mem0 request failed (${response.status})`)
  }
  return await response.json()
}

async function getEntities(): Promise<Entity[]> {
  const entities: Entity[] = []
  let next: string | null = '/v1/entities/?page=1&page_size=100'
  while (next) {
    const page = await mem0Fetch(next)
    entities.push(...(page.results ?? []))
    next = page.next
  }
  return entities.filter(entity => entity.type === 'user' && entity.name)
}

async function getLegacyMemories(userId: string): Promise<LegacyMemory[]> {
  const memories: LegacyMemory[] = []
  let page = 1
  while (true) {
    const result = await mem0Fetch(`/v3/memories/?page=${page}&page_size=200`, {
      method: 'POST',
      body: JSON.stringify({ filters: { user_id: userId } }),
    })
    memories.push(...(result.results ?? []))
    if (!result.next) break
    page += 1
  }
  return memories.sort((a, b) => Date.parse(a.created_at || '') - Date.parse(b.created_at || ''))
}

async function classifyBatch(
  openai: OpenAI,
  userId: string,
  batch: LegacyMemory[]
): Promise<Decision[]> {
  const input = batch.map((memory, inputIndex) => ({
    input_index: inputIndex,
    content: memory.memory || memory.text || '',
    created_at: memory.created_at || null,
  }))
  const response = await openai.responses.create({
    model: CLASSIFICATION_MODEL,
    instructions: `Classify already-extracted legacy memories for migration into a personal assistant's durable memory store.

Return exactly one decision per input_index. Include only an explicit, durable fact that will help a future conversation: preferences, named relationships, work/projects, durable goals, routines, constraints, and still-relevant concrete future plans.

Exclude greetings, questions, assistant-authored advice, guesses, personality or astrological interpretations, birth/chart details, saved venues/clothes, expired plans, one-off moods, duplicates within this batch, and anything sensitive: passwords, authentication secrets, payment/account numbers, government IDs, exact home/work addresses, medical diagnoses, sexuality, religion, or politics.

For included facts, choose a stable semantic key such as preference:coffee, relationship:sister_maya, work:current_role, or plan:sister_wedding. Similar facts and corrections must share a key so the newer record supersedes the older one. Do not rewrite the content; this step only classifies it. For temporary plans, set an ISO-8601 valid_until date after which recall is useless. Otherwise null. Today is ${new Date().toISOString()}.`,
    input: JSON.stringify(input),
    reasoning: { effort: 'none', context: 'current_turn' },
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'pinch_legacy_memory_decisions',
        strict: true,
        schema: decisionSchema,
      },
    },
    max_output_tokens: 4000,
    store: false,
    safety_identifier: createHash('sha256').update(userId).digest('hex'),
  })
  const parsed = JSON.parse(response.output_text || '{"decisions":[]}') as { decisions?: Decision[] }
  return parsed.decisions ?? []
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), 'OPENAI_API_KEY is required')
  assert.ok(process.env.NEXT_PUBLIC_CONVEX_URL?.trim(), 'NEXT_PUBLIC_CONVEX_URL is required')

  const [{
    SimpleMemorySystem,
    isMemoryContentAllowed,
    normalizeMemoryContent,
    normalizeMemoryKey,
  }] = await Promise.all([
    import('../lib/simpleMemory'),
  ])
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const store = new SimpleMemorySystem({ openai })
  const entities = await getEntities()
  let found = 0
  let imported = 0
  let excluded = 0

  for (let userIndex = 0; userIndex < entities.length; userIndex += 1) {
    const entity = entities[userIndex]
    const fetched = await getLegacyMemories(entity.name)
    const uniqueByContent = new Map<string, LegacyMemory>()
    for (const memory of fetched) {
      const content = (memory.memory || memory.text || '').trim()
      const normalized = normalizeMemoryContent(content)
      if (content && normalized) uniqueByContent.set(normalized, memory)
    }
    const unique = Array.from(uniqueByContent.values())
    found += fetched.length

    for (const batch of chunks(unique, BATCH_SIZE)) {
      const decisions = await classifyBatch(openai, entity.name, batch)
      const decisionByIndex = new Map(decisions.map(decision => [decision.input_index, decision]))
      const candidates = batch.flatMap((legacy, inputIndex) => {
        const decision = decisionByIndex.get(inputIndex)
        const content = (legacy.memory || legacy.text || '').trim()
        const key = normalizeMemoryKey(decision?.key || '')
        if (
          !decision?.include || !key || content.length < 8 || content.length > 500 ||
          !isMemoryContentAllowed(content)
        ) {
          excluded += 1
          return []
        }
        const validUntil = decision.valid_until ? Date.parse(decision.valid_until) : NaN
        return [{
          phone_number: entity.name,
          memory_content: content,
          memory_type: decision.memory_type || 'other',
          importance: decision.importance || 5,
          confidence: decision.confidence ?? 0.75,
          memory_key: key,
          operation: 'upsert' as const,
          valid_until: Number.isFinite(validUntil) ? validUntil : undefined,
          legacy_source_id: legacy.id,
        }]
      })
      if (candidates.length > 0) {
        assert.equal(await store.storeMemories(entity.name, candidates), true)
        imported += candidates.length
      }
    }

    console.log(`[Mem0 migration] user ${userIndex + 1}/${entities.length}: ${fetched.length} found, ${imported} imported total`)
  }

  console.log(JSON.stringify({
    ok: true,
    users: entities.length,
    found,
    imported,
    excluded,
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
