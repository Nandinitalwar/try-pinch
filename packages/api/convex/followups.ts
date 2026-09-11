// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    phoneNumber: v.string(),
    subject: v.string(),
    askText: v.string(),
    eventAt: v.number(),
    dueAt: v.number(),
    eventId: v.optional(v.id('events')),
  },
  handler: async (ctx, args) => {
    // Don't stack duplicates when someone mentions the same thing twice.
    const existing = await ctx.db
      .query('followups')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .collect()

    const normalized = args.subject.toLowerCase().replace(/[^\w\s]/g, '').trim()
    const dupe = existing.find(
      (f: any) =>
        f.status === 'pending' &&
        f.subject.toLowerCase().replace(/[^\w\s]/g, '').trim() === normalized
    )
    if (dupe) return dupe._id

    return await ctx.db.insert('followups', {
      ...args,
      status: 'pending',
      createdAt: Date.now(),
    })
  },
})

/** Everything due to be asked about, across all users. The scheduler's query. */
export const due = query({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    return await ctx.db
      .query('followups')
      .withIndex('by_status_due', (q: any) => q.eq('status', 'pending').lte('dueAt', now))
      .take(args.limit ?? 50)
  },
})

export const markSent = mutation({
  args: { id: v.id('followups') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: 'sent' })
  },
})

export const cancel = mutation({
  args: { id: v.id('followups') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: 'cancelled' })
  },
})

export const listByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('followups')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .order('desc')
      .take(50)
  },
})
