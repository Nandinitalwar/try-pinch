import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server'
import { v } from 'convex/values'

const allowed: Record<string, Set<string>> = {
  pending: new Set(['snoozed', 'completed', 'cancelled']),
  snoozed: new Set(['pending', 'completed', 'cancelled']),
}

export const create = mutation({
  args: {
    phoneNumber: v.string(), title: v.string(), dueAt: v.optional(v.number()),
    recurrence: v.optional(v.string()), idempotencyKey: v.string(), source: v.string(),
    sourceEventId: v.optional(v.id('events')),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('tasks')
      .withIndex('by_phone_key', (q: any) => q.eq('phoneNumber', args.phoneNumber).eq('idempotencyKey', args.idempotencyKey))
      .first()
    // Idempotency is request-level, not status-level: a retry after a worker
    // or client timeout must never create a second copy of completed work.
    if (existing) return existing

    const now = Date.now()
    const id = await ctx.db.insert('tasks', {
      ...args, status: 'pending', nextRunAt: args.dueAt, createdAt: now, updatedAt: now,
    })
    return await ctx.db.get(id)
  },
})

export const listByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => ctx.db.query('tasks')
    .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
    .order('desc').take(100),
})

export const transition = mutation({
  args: { id: v.id('tasks'), phoneNumber: v.string(), status: v.string(), snoozeUntil: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id)
    if (!task || task.phoneNumber !== args.phoneNumber) throw new Error('task not found')
    if (!allowed[task.status]?.has(args.status)) throw new Error(`invalid transition: ${task.status} -> ${args.status}`)
    if (args.status === 'snoozed' && !args.snoozeUntil) throw new Error('snoozeUntil is required')
    const now = Date.now()
    await ctx.db.patch(args.id, {
      status: args.status,
      nextRunAt: args.status === 'snoozed' ? args.snoozeUntil : undefined,
      completedAt: args.status === 'completed' ? now : undefined,
      updatedAt: now,
    })
    return await ctx.db.get(args.id)
  },
})
