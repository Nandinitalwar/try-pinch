import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // User profiles with birth data (memories live in Mem0, not here)
  profiles: defineTable({
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
    // Computed natal chart (real ephemeris, not LLM-guessed)
    sunSign: v.optional(v.string()),
    moonSign: v.optional(v.string()),
    risingSign: v.optional(v.string()),
    chartJson: v.optional(v.string()), // full NatalChart serialized
    updatedAt: v.optional(v.number()),
  }).index('by_phone', ['phoneNumber']),

  // Chat history (append-only; _creationTime is the timestamp)
  chats: defineTable({
    phoneNumber: v.string(),
    sessionId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    message: v.string(),
  }).index('by_phone', ['phoneNumber']),
})
