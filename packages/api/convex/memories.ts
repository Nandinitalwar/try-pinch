// Provenance-aware conversational memory stored in Convex.
// Uses Generic variants so the API package still compiles before codegen runs.
import {
  actionGeneric as action,
  mutationGeneric as mutation,
  queryGeneric as query,
} from 'convex/server'
import { v } from 'convex/values'

const activeForKey = async (ctx: any, phoneNumber: string, memoryKey: string) => {
  const matches = await ctx.db
    .query('memories')
    .withIndex('by_phone_key', (q: any) =>
      q.eq('phoneNumber', phoneNumber).eq('memoryKey', memoryKey)
    )
    .collect()
  return matches.find((memory: any) => memory.status === 'active') ?? null
}

const ownerStatus = (phoneNumber: string, status: string) => `${phoneNumber}\u0000${status}`

export const upsert = mutation({
  args: {
    phoneNumber: v.string(),
    memoryKey: v.string(),
    content: v.string(),
    normalizedContent: v.string(),
    memoryType: v.string(),
    importance: v.number(),
    confidence: v.number(),
    embedding: v.optional(v.array(v.float64())),
    embeddingModel: v.optional(v.string()),
    sourceEventId: v.optional(v.id('events')),
    legacySourceId: v.optional(v.string()),
    validUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await activeForKey(ctx, args.phoneNumber, args.memoryKey)
    const sourceEventIds = args.sourceEventId ? [args.sourceEventId] : []
    const legacySourceIds = args.legacySourceId ? [args.legacySourceId] : []

    if (existing?.normalizedContent === args.normalizedContent) {
      const mergedSources = Array.from(new Set([
        ...(existing.sourceEventIds ?? []),
        ...sourceEventIds,
      ]))
      const mergedLegacySources = Array.from(new Set([
        ...(existing.legacySourceIds ?? []),
        ...legacySourceIds,
      ]))
      await ctx.db.patch(existing._id, {
        importance: Math.max(existing.importance, args.importance),
        confidence: Math.max(existing.confidence, args.confidence),
        sourceEventIds: mergedSources,
        legacySourceIds: mergedLegacySources,
        validUntil: args.validUntil,
        updatedAt: now,
      })
      return { id: existing._id, operation: 'deduplicated' }
    }

    const id = await ctx.db.insert('memories', {
      phoneNumber: args.phoneNumber,
      memoryKey: args.memoryKey,
      content: args.content,
      normalizedContent: args.normalizedContent,
      memoryType: args.memoryType,
      importance: args.importance,
      confidence: args.confidence,
      status: 'active',
      ownerStatus: ownerStatus(args.phoneNumber, 'active'),
      embedding: args.embedding,
      embeddingModel: args.embeddingModel,
      sourceEventIds,
      legacySourceIds,
      validUntil: args.validUntil,
      createdAt: now,
      updatedAt: now,
    })

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: 'superseded',
        ownerStatus: ownerStatus(args.phoneNumber, 'superseded'),
        supersededBy: id,
        updatedAt: now,
      })
    }

    return { id, operation: existing ? 'superseded' : 'inserted' }
  },
})

export const forgetByKey = mutation({
  args: {
    phoneNumber: v.string(),
    memoryKey: v.string(),
    sourceEventId: v.optional(v.id('events')),
  },
  handler: async (ctx, args) => {
    const existing = await activeForKey(ctx, args.phoneNumber, args.memoryKey)
    if (!existing) return false

    const sourceEventIds = args.sourceEventId
      ? Array.from(new Set([...(existing.sourceEventIds ?? []), args.sourceEventId]))
      : existing.sourceEventIds
    await ctx.db.patch(existing._id, {
      status: 'deleted',
      ownerStatus: ownerStatus(args.phoneNumber, 'deleted'),
      deletedAt: Date.now(),
      updatedAt: Date.now(),
      sourceEventIds,
    })
    return true
  },
})

export const recent = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const memories = await ctx.db
      .query('memories')
      .withIndex('by_phone_status', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('status', 'active')
      )
      .order('desc')
      .take(Math.min(args.limit ?? 10, 100))
    return memories.filter((memory: any) => !memory.validUntil || memory.validUntil > now)
  },
})

export const keywordSearch = query({
  args: {
    phoneNumber: v.string(),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const memories = await ctx.db
      .query('memories')
      .withSearchIndex('search_content', (q: any) =>
        q
          .search('content', args.searchText)
          .eq('ownerStatus', ownerStatus(args.phoneNumber, 'active'))
      )
      .take(Math.min(args.limit ?? 20, 100))
    return memories.filter((memory: any) => !memory.validUntil || memory.validUntil > now)
  },
})

export const vectorSearch = action({
  args: {
    phoneNumber: v.string(),
    embedding: v.array(v.float64()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.vectorSearch('memories', 'by_embedding', {
      vector: args.embedding,
      limit: Math.min(args.limit ?? 20, 100),
      filter: (q: any) => q.eq('ownerStatus', ownerStatus(args.phoneNumber, 'active')),
    })
  },
})

export const getByIds = query({
  args: { ids: v.array(v.id('memories')) },
  handler: async (ctx, args) => {
    const now = Date.now()
    const docs = await Promise.all(args.ids.map(id => ctx.db.get(id)))
    return docs.filter((memory: any) =>
      memory && memory.status === 'active' && (!memory.validUntil || memory.validUntil > now)
    )
  },
})

export const listByPhone = query({
  args: {
    phoneNumber: v.string(),
    includeInactive: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('memories')
      .withIndex('by_phone_status', (q: any) =>
        args.includeInactive
          ? q.eq('phoneNumber', args.phoneNumber)
          : q.eq('phoneNumber', args.phoneNumber).eq('status', 'active')
      )
      .order('desc')
      .take(Math.min(args.limit ?? 100, 500))
    return all
  },
})

export const replace = mutation({
  args: {
    phoneNumber: v.string(),
    id: v.id('memories'),
    content: v.string(),
    normalizedContent: v.string(),
    embedding: v.optional(v.array(v.float64())),
    embeddingModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (
      !existing || existing.status !== 'active' ||
      existing.phoneNumber !== args.phoneNumber
    ) return false
    await ctx.db.patch(args.id, {
      content: args.content,
      normalizedContent: args.normalizedContent,
      embedding: args.embedding,
      embeddingModel: args.embeddingModel,
      updatedAt: Date.now(),
    })
    return true
  },
})

export const remove = mutation({
  args: { phoneNumber: v.string(), id: v.id('memories') },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (
      !existing || existing.status !== 'active' ||
      existing.phoneNumber !== args.phoneNumber
    ) return false
    await ctx.db.patch(args.id, {
      status: 'deleted',
      ownerStatus: ownerStatus(existing.phoneNumber, 'deleted'),
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return true
  },
})

export const clear = mutation({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query('memories')
      .withIndex('by_phone_status', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('status', 'active')
      )
      .collect()
    const now = Date.now()
    await Promise.all(active.map((memory: any) => ctx.db.patch(memory._id, {
      status: 'deleted',
      ownerStatus: ownerStatus(args.phoneNumber, 'deleted'),
      deletedAt: now,
      updatedAt: now,
    })))
    return active.length
  },
})
