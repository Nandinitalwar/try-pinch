// Uses the *Generic variants so this compiles before `npx convex dev`
// has run codegen; they are functionally identical to the generated ones.
import { queryGeneric as query, mutationGeneric as mutation } from 'convex/server'
import { v } from 'convex/values'

export const getByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('profiles')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', args.phoneNumber))
      .unique()
  },
})

export const upsert = mutation({
  args: {
    phoneNumber: v.string(),
    preferredName: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    birthTime: v.optional(v.string()),
    birthTimeKnown: v.optional(v.boolean()),
    birthTimeAccuracy: v.optional(v.string()),
    birthTimezone: v.optional(v.string()),
    birthCity: v.optional(v.string()),
    birthCountry: v.optional(v.string()),
    birthLatitude: v.optional(v.number()),
    birthLongitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { phoneNumber, ...fields } = args

    // Drop undefined fields so we never overwrite existing data with blanks
    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value
    }

    const existing = await ctx.db
      .query('profiles')
      .withIndex('by_phone', (q: any) => q.eq('phoneNumber', phoneNumber))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, updates)
      return existing._id
    }

    return await ctx.db.insert('profiles', { phoneNumber, ...updates })
  },
})
