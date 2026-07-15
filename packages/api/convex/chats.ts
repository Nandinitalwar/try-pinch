// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

export const save = mutation({
  args: {
    phoneNumber: v.string(),
    sessionId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('chats', args)
  },
})

export const history = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20
    const messages = await ctx.db
      .query('chats')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .order('desc')
      .take(limit)
    return messages.reverse()
  },
})
