// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

/**
 * Record a garment seen in an outfit photo. Re-seeing the same item bumps
 * wornCount rather than duplicating - how often something gets worn is the
 * signal worth keeping.
 */
export const upsert = mutation({
  args: {
    phoneNumber: v.string(),
    item: v.string(),
    itemNormalized: v.string(),
    category: v.optional(v.string()),
    color: v.optional(v.string()),
    pattern: v.optional(v.string()),
    vibe: v.optional(v.string()),
    eventId: v.optional(v.id('events')),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const existing = await ctx.db
      .query('garments')
      .withIndex('by_phone_item', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('itemNormalized', args.itemNormalized)
      )
      .first()

    if (existing) {
      const eventIds = args.eventId && !existing.eventIds.includes(args.eventId)
        ? [...existing.eventIds, args.eventId]
        : existing.eventIds

      await ctx.db.patch(existing._id, {
        category: existing.category ?? args.category,
        color: existing.color ?? args.color,
        pattern: existing.pattern ?? args.pattern,
        vibe: existing.vibe ?? args.vibe,
        eventIds,
        wornCount: existing.wornCount + 1,
        lastSeen: now,
      })
      return existing._id
    }

    return await ctx.db.insert('garments', {
      phoneNumber: args.phoneNumber,
      item: args.item,
      itemNormalized: args.itemNormalized,
      category: args.category,
      color: args.color,
      pattern: args.pattern,
      vibe: args.vibe,
      wornCount: 1,
      eventIds: args.eventId ? [args.eventId] : [],
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
      .query('garments')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .order('desc')
      .take(args.limit ?? 100)
  },
})
