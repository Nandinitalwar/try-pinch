// Pinch-owned conversational memory: structured extraction with OpenAI,
// provenance-aware storage in Convex, and hybrid keyword/vector retrieval.

import { createHash } from 'crypto'
import OpenAI from 'openai'
import { api, convex } from './convexClient'

const EMBEDDING_MODEL = process.env.PINCH_MEMORY_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small'
const EXTRACTION_MODEL = process.env.PINCH_MEMORY_EXTRACTION_MODEL?.trim() || 'gpt-5.6-luna'
export const MEMORY_EMBEDDING_DIMENSIONS = 512
export const MEMORY_SIMILARITY_THRESHOLD = 0.26

export type MemoryOperation = 'upsert' | 'delete'

export interface SimpleMemory {
  id?: string
  phone_number: string
  memory_content: string
  memory_type: string
  importance: number
  confidence?: number
  memory_key?: string
  status?: string
  source_event_ids?: string[]
  legacy_source_ids?: string[]
  legacy_source_id?: string
  valid_until?: number
  created_at?: string
  updated_at?: string
  operation?: MemoryOperation
  target_key?: string
  source_event_id?: string
}

type MemoryDocument = {
  _id: string
  _creationTime?: number
  phoneNumber: string
  memoryKey: string
  content: string
  memoryType: string
  importance: number
  confidence: number
  status: string
  embedding?: number[]
  sourceEventIds?: string[]
  legacySourceIds?: string[]
  validUntil?: number
  createdAt?: number
  updatedAt?: number
}

type VectorHit = { _id: string; _score: number }

export function normalizeMemoryKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/:_+/g, ':')
    .replace(/^_|_$/g, '')
    .slice(0, 100)
}

export function normalizeMemoryContent(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Last-line defense if an extraction model ever ignores the privacy prompt. */
export function isMemoryContentAllowed(value: string): boolean {
  const content = value.toLowerCase()
  const forbidden = [
    /\b(?:password|passcode|api[ _-]?key|secret(?: key)?|auth(?:entication)? token|access token|refresh token|private key)\b/,
    /\b(?:social security|ssn|passport number|driver'?s license|government id)\b/,
    /\b(?:credit card|debit card|card number|cvv|routing number|bank account)\b/,
    /\b(?:security )?pin(?: code)?\s*(?:is|=|:)\b/,
    /\b\d{3}-\d{2}-\d{4}\b/,
    /\b(?:\d[ -]*?){13,19}\b/,
    /\b\d{1,6}\s+(?:[a-z0-9.'-]+\s+){0,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b/,
    /\b(?:diagnosed with|diagnosis is|medical diagnosis)\b/,
    /\b(?:has|lives with|manages)\s+(?:[a-z-]+\s+){0,3}(?:disorder|disease|syndrome|cancer|diabetes|depression|adhd|autism|bipolar|ptsd)\b/,
    /\b(?:is|identifies as|came out as)\s+(?:gay|lesbian|bisexual|queer|transgender|nonbinary)\b/,
    /\b(?:is|identifies as|practices)\s+(?:christian|muslim|jewish|hindu|buddhist|sikh|atheist)\b/,
    /\b(?:registered|votes?|supports?)\s+(?:democrat|republican|libertarian|green party)\b/,
  ]
  return !forbidden.some(pattern => pattern.test(content))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return -1
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index]
    leftMagnitude += left[index] * left[index]
    rightMagnitude += right[index] * right[index]
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return -1
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude))
}

function mapDocument(memory: MemoryDocument): SimpleMemory {
  return {
    id: memory._id,
    phone_number: memory.phoneNumber,
    memory_content: memory.content,
    memory_type: memory.memoryType,
    importance: memory.importance,
    confidence: memory.confidence,
    memory_key: memory.memoryKey,
    status: memory.status,
    source_event_ids: memory.sourceEventIds,
    legacy_source_ids: memory.legacySourceIds,
    valid_until: memory.validUntil,
    created_at: memory.createdAt ? new Date(memory.createdAt).toISOString() : undefined,
    updated_at: memory.updatedAt ? new Date(memory.updatedAt).toISOString() : undefined,
  }
}

/** Reciprocal-rank fusion keeps exact names and semantic similarity useful. */
export function mergeHybridMemoryResults(
  vectorHits: VectorHit[],
  vectorDocuments: MemoryDocument[],
  keywordDocuments: MemoryDocument[],
  limit: number
): MemoryDocument[] {
  const scores = new Map<string, number>()
  const documents = new Map<string, MemoryDocument>()
  const k = 60

  vectorDocuments.forEach(document => documents.set(String(document._id), document))
  keywordDocuments.forEach(document => documents.set(String(document._id), document))

  vectorHits
    // Low-similarity tail results make memory feel random rather than personal.
    .filter(hit => hit._score >= MEMORY_SIMILARITY_THRESHOLD)
    .forEach((hit, index) => {
      const id = String(hit._id)
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1))
    })

  keywordDocuments.forEach((document, index) => {
    const id = String(document._id)
    scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1))
  })

  return Array.from(documents.values())
    .filter(document => scores.has(String(document._id)))
    .sort((a, b) => {
      const aScore = (scores.get(String(a._id)) ?? 0) + clamp(a.importance, 1, 10) / 10_000
      const bScore = (scores.get(String(b._id)) ?? 0) + clamp(b.importance, 1, 10) / 10_000
      return bScore - aScore
    })
    .slice(0, limit)
}

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    operations: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: { type: 'string', enum: ['upsert', 'delete'] },
          target_key: { type: ['string', 'null'] },
          key: { type: ['string', 'null'] },
          content: { type: ['string', 'null'] },
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
          'action', 'target_key', 'key', 'content', 'memory_type',
          'importance', 'confidence', 'valid_until',
        ],
      },
    },
  },
  required: ['operations'],
} as const

export class SimpleMemorySystem {
  private openai: any
  private database: any

  constructor(options: { openai?: any; database?: any } = {}) {
    if (Object.prototype.hasOwnProperty.call(options, 'openai')) {
      this.openai = options.openai
    } else {
      const key = process.env.OPENAI_API_KEY?.trim()
      this.openai = key ? new OpenAI({ apiKey: key }) : null
    }
    this.database = Object.prototype.hasOwnProperty.call(options, 'database')
      ? options.database
      : convex
  }

  private async embedTexts(texts: string[]): Promise<number[][]> {
    if (!this.openai || texts.length === 0) return []
    const result = await this.openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: MEMORY_EMBEDDING_DIMENSIONS,
      encoding_format: 'float',
    })
    return result.data
      .slice()
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding)
  }

  private async recentDocuments(phoneNumber: string, limit: number): Promise<MemoryDocument[]> {
    if (!this.database) return []
    try {
      return await this.database.query(api.memories.recent, { phoneNumber, limit })
    } catch (error) {
      console.error('[Memory] Convex recent lookup failed:', error)
      return []
    }
  }

  /**
   * Extract only explicit, durable facts from the user's latest message. The
   * assistant reply is intentionally ignored so a model claim can never become
   * a self-reinforcing memory.
   */
  async extractMemories(
    userMessage: string,
    _agentResponse: string,
    phoneNumber?: string,
    sourceEventId?: string | null
  ): Promise<SimpleMemory[]> {
    if (!this.openai || !userMessage.trim()) return []

    const existing = phoneNumber
      ? await this.recentDocuments(phoneNumber, 30)
      : []
    const existingContext = existing.length > 0
      ? existing.map(memory => `- ${memory.memoryKey}: ${memory.content}`).join('\n')
      : '(none)'

    try {
      const response = await this.openai.responses.create({
        model: EXTRACTION_MODEL,
        instructions: `You extract durable memory updates for a personal assistant.

Read only the user's latest message. Never store facts introduced by the assistant.
Return no operation for greetings, questions, one-off moods, jokes, advice requests, or facts that will not help a future conversation.

Good memories: explicit preferences, named relationships, work/projects, durable goals, routines, constraints, and concrete future plans.
Do not store: birth details (profile owns them), saved venues or clothing (the vault owns them), astrological interpretations, guesses, passwords, authentication secrets, payment/account numbers, government IDs, precise home/work addresses, medical diagnoses or conditions, sexuality or gender identity, religion, or political beliefs.

Use a stable semantic key like preference:coffee, relationship:sister_maya, work:current_role, or plan:sister_wedding. The content must be one short, self-contained sentence. When the latest message corrects an existing memory, upsert the SAME key with the corrected content. When the user asks you to forget something or clearly says it is no longer true without a replacement, delete its existing target key. Never delete a key that is not listed below.

For temporary plans, valid_until is an ISO-8601 date after which recall is useless. Otherwise null. Today is ${new Date().toISOString()}.

Existing active memories:
${existingContext}`,
        input: userMessage,
        reasoning: { effort: 'none', context: 'current_turn' },
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'pinch_memory_operations',
            strict: true,
            schema: extractionSchema,
          },
        },
        max_output_tokens: 1000,
        store: false,
        safety_identifier: createHash('sha256')
          .update(phoneNumber || 'anonymous-memory-user')
          .digest('hex'),
      })

      if (!response.output_text?.trim()) return []
      const parsed = JSON.parse(response.output_text) as { operations?: any[] }
      const existingKeys = new Set(existing.map(memory => memory.memoryKey))
      const memories: SimpleMemory[] = []

      for (const operation of parsed.operations ?? []) {
        if (operation.action === 'delete') {
          const targetKey = normalizeMemoryKey(operation.target_key || '')
          if (!targetKey || !existingKeys.has(targetKey)) continue
          memories.push({
            phone_number: phoneNumber || '',
            memory_content: '',
            memory_type: 'other',
            importance: 1,
            operation: 'delete',
            target_key: targetKey,
            source_event_id: sourceEventId || undefined,
          })
          continue
        }

        const key = normalizeMemoryKey(operation.key || '')
        const content = String(operation.content || '').trim().replace(/\s+/g, ' ')
        if (!key || content.length < 8 || content.length > 280 || !isMemoryContentAllowed(content)) continue

        const validUntil = operation.valid_until
          ? Date.parse(operation.valid_until)
          : NaN
        memories.push({
          phone_number: phoneNumber || '',
          memory_content: content,
          memory_type: operation.memory_type || 'other',
          importance: clamp(Number(operation.importance) || 5, 1, 10),
          confidence: clamp(Number(operation.confidence) || 0.8, 0, 1),
          memory_key: key,
          operation: 'upsert',
          valid_until: Number.isFinite(validUntil) ? validUntil : undefined,
          source_event_id: sourceEventId || undefined,
        })
      }

      return memories
    } catch (error) {
      console.error('[Memory] Extraction failed:', error)
      return []
    }
  }

  /** Embed and apply extraction operations to Convex. */
  async storeMemories(phoneNumber: string, memories: SimpleMemory[]): Promise<boolean> {
    if (!this.database || memories.length === 0) return false

    try {
      const upserts = memories.filter(memory => memory.operation !== 'delete')
      const embeddings = await this.embedTexts(upserts.map(memory => memory.memory_content))
      let embeddingIndex = 0

      for (const memory of memories) {
        if (memory.operation === 'delete') {
          await this.database.mutation(api.memories.forgetByKey, {
            phoneNumber,
            memoryKey: memory.target_key,
            sourceEventId: memory.source_event_id,
          })
          continue
        }

        const embedding = embeddings[embeddingIndex++]
        await this.database.mutation(api.memories.upsert, {
          phoneNumber,
          memoryKey: memory.memory_key,
          content: memory.memory_content,
          normalizedContent: normalizeMemoryContent(memory.memory_content),
          memoryType: memory.memory_type,
          importance: clamp(memory.importance, 1, 10),
          confidence: clamp(memory.confidence ?? 0.8, 0, 1),
          embedding,
          embeddingModel: embedding ? `${EMBEDDING_MODEL}:${MEMORY_EMBEDDING_DIMENSIONS}` : undefined,
          sourceEventId: memory.source_event_id,
          legacySourceId: memory.legacy_source_id,
          validUntil: memory.valid_until,
        })
      }

      console.log(`[Memory] Convex applied ${memories.length} memory operation(s)`)
      return true
    } catch (error) {
      console.error('[Memory] Convex storage failed:', error)
      return false
    }
  }

  /** Retrieve relevant memories with vector + full-text reciprocal-rank fusion. */
  async getMemories(phoneNumber: string, limit: number = 10, query?: string): Promise<SimpleMemory[]> {
    if (!this.database) return []
    const safeLimit = clamp(Math.floor(limit), 1, 50)

    if (!query?.trim()) {
      return (await this.recentDocuments(phoneNumber, safeLimit)).map(mapDocument)
    }

    try {
      const [queryEmbedding] = await this.embedTexts([query])
      const [vectorHits, keywordDocuments, newestDocuments] = await Promise.all([
        queryEmbedding
          ? this.database.action(api.memories.vectorSearch, {
              phoneNumber,
              embedding: queryEmbedding,
              limit: Math.max(safeLimit * 2, 20),
            })
          : Promise.resolve([]),
        this.database.query(api.memories.keywordSearch, {
          phoneNumber,
          searchText: query,
          limit: Math.max(safeLimit * 2, 20),
        }).catch((error: unknown) => {
          console.warn('[Memory] Keyword search failed, continuing with vector recall:', error)
          return []
        }),
        // Convex search indexes can briefly trail a mutation. Scoring a tiny,
        // transactionally-read recent window closes that gap for the user's
        // very next message without ever injecting unranked recent facts.
        this.recentDocuments(phoneNumber, 8),
      ]) as [VectorHit[], MemoryDocument[], MemoryDocument[]]

      const newestHits: VectorHit[] = queryEmbedding
        ? newestDocuments
            .filter(memory => memory.embedding?.length === queryEmbedding.length)
            .map(memory => ({
              _id: memory._id,
              _score: cosineSimilarity(queryEmbedding, memory.embedding as number[]),
            }))
        : []
      const bestSemanticScore = new Map<string, number>()
      for (const hit of [...vectorHits, ...newestHits]) {
        const id = String(hit._id)
        bestSemanticScore.set(id, Math.max(bestSemanticScore.get(id) ?? -1, hit._score))
      }
      const semanticHits = Array.from(bestSemanticScore, ([_id, _score]) => ({ _id, _score }))
        .sort((a, b) => b._score - a._score)

      const indexedDocuments: MemoryDocument[] = vectorHits.length > 0
        ? await this.database.query(api.memories.getByIds, {
            ids: vectorHits.map(hit => hit._id),
          })
        : []
      const vectorDocuments = Array.from(new Map(
        [...indexedDocuments, ...newestDocuments].map(memory => [String(memory._id), memory])
      ).values())
      if (process.env.PINCH_MEMORY_DEBUG === '1') {
        console.log('[Memory] Retrieval candidates:', {
          vector: semanticHits.map(hit => ({ id: hit._id, score: hit._score })),
          keyword: keywordDocuments.map(memory => memory._id),
        })
      }
      const merged = mergeHybridMemoryResults(
        semanticHits,
        vectorDocuments,
        keywordDocuments,
        safeLimit
      )

      // A search with no trustworthy match should return no memory, not random
      // recent context. Recent chat history already provides continuity.
      return merged.map(mapDocument)
    } catch (error) {
      console.error('[Memory] Hybrid recall failed:', error)
      return []
    }
  }

  async listMemories(phoneNumber: string, includeInactive = false): Promise<SimpleMemory[]> {
    if (!this.database) return []
    const docs: MemoryDocument[] = await this.database.query(api.memories.listByPhone, {
      phoneNumber,
      includeInactive,
      limit: 500,
    })
    return docs.map(mapDocument)
  }

  async editMemory(phoneNumber: string, id: string, content: string): Promise<boolean> {
    if (!this.database || !content.trim()) return false
    const [embedding] = await this.embedTexts([content.trim()])
    return await this.database.mutation(api.memories.replace, {
      phoneNumber,
      id,
      content: content.trim(),
      normalizedContent: normalizeMemoryContent(content),
      embedding,
      embeddingModel: embedding ? `${EMBEDDING_MODEL}:${MEMORY_EMBEDDING_DIMENSIONS}` : undefined,
    })
  }

  async deleteMemory(phoneNumber: string, id: string): Promise<boolean> {
    if (!this.database) return false
    return await this.database.mutation(api.memories.remove, { phoneNumber, id })
  }

  async clearMemories(phoneNumber: string): Promise<number> {
    if (!this.database) return 0
    return await this.database.mutation(api.memories.clear, { phoneNumber })
  }

  static formatMemories(memories: SimpleMemory[]): string {
    if (memories.length === 0) return 'No relevant previous memories about this user.'

    let context = 'Relevant things this user explicitly told you:\n'
    for (const memory of memories) {
      context += `- ${memory.memory_content}\n`
    }
    context += 'Use a memory only when it directly helps with their latest message. Do not mention that it came from memory.'
    return context
  }
}
