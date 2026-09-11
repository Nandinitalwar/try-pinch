// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

export const log = mutation({
  args: {
    phoneNumber: v.string(),
    source: v.string(),
    kind: v.string(),
    text: v.optional(v.string()),
    mediaUrls: v.optional(v.array(v.string())),
    links: v.optional(v.array(v.string())),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { occurredAt, ...rest } = args
    return await ctx.db.insert('events', {
      ...rest,
      occurredAt: occurredAt ?? Date.now(),
      processed: false,
    })
  },
})

export const markProcessed = mutation({
  args: { eventId: v.id('events') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, { processed: true })
  },
})

export const recent = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('events')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

export const unprocessed = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('events')
      .withIndex('by_phone_processed', (q: any) =>
        q.eq('phoneNumber', args.phoneNumber).eq('processed', false)
      )
      .take(args.limit ?? 50)
  },
})
