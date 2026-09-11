// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

/**
 * Insert a place, or fold it into an existing one when the same venue shows up
 * in another saved video. Repeat mentions are signal - mentionCount is what
 * "everyone sends you here" is built on - so merging is the point, not a
 * side effect. Match is exact on normalized name within a phone number;
 * anything fuzzier risks collapsing two real venues, which is unrecoverable.
 */
export const upsert = mutation({
  args: {
    phoneNumber: v.string(),
    name: v.string(),
    nameNormalized: v.string(),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    note: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    eventId: v.optional(v.id('events')),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const existing = await ctx.db
      .query('places')
      .withIndex('by_phone_name', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('nameNormalized', args.nameNormalized)
      )
      .first()

    if (existing) {
      const sourceUrls = args.sourceUrl && !existing.sourceUrls.includes(args.sourceUrl)
        ? [...existing.sourceUrls, args.sourceUrl]
        : existing.sourceUrls
      const eventIds = args.eventId && !existing.eventIds.includes(args.eventId)
        ? [...existing.eventIds, args.eventId]
        : existing.eventIds
      const tags = args.tags?.length
        ? Array.from(new Set([...(existing.tags ?? []), ...args.tags]))
        : existing.tags

      await ctx.db.patch(existing._id, {
        // Only fill gaps - never let a thinner later extraction overwrite
        // details we already resolved from a richer source.
        category: existing.category ?? args.category,
        city: existing.city ?? args.city,
        region: existing.region ?? args.region,
        note: existing.note ?? args.note,
        tags,
        sourceUrls,
        eventIds,
        mentionCount: existing.mentionCount + 1,
        lastSeen: now,
      })
      return existing._id
    }

    return await ctx.db.insert('places', {
      phoneNumber: args.phoneNumber,
      name: args.name,
      nameNormalized: args.nameNormalized,
      category: args.category,
      city: args.city,
      region: args.region,
      note: args.note,
      tags: args.tags,
      sourceUrls: args.sourceUrl ? [args.sourceUrl] : [],
      eventIds: args.eventId ? [args.eventId] : [],
      mentionCount: 1,
      firstSeen: now,
      lastSeen: now,
    })
  },
})

export const listByPhone = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('places')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .order('desc')
      .take(args.limit ?? 100)
  },
})

export const listByCity = query({
  args: {
    phoneNumber: v.string(),
    city: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('places')
      .withIndex('by_phone_city', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('city', args.city)
      )
      .take(args.limit ?? 50)
  },
})

export const markVisited = mutation({
  args: { placeId: v.id('places'), visited: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.placeId, { visited: args.visited })
  },
})
