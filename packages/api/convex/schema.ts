import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // User profiles with birth data. Conversational memories live in the
  // provenance-aware `memories` table below.
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
    chartIntroducedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }).index('by_phone', ['phoneNumber']),

  // Chat history (append-only; _creationTime is the timestamp)
  chats: defineTable({
    phoneNumber: v.string(),
    sessionId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    message: v.string(),
  }).index('by_phone', ['phoneNumber']),

  // Durable user facts extracted from conversation. Updates create a new active
  // document and supersede the old one, preserving the source trail instead of
  // silently rewriting what Pinch used to believe.
  memories: defineTable({
    phoneNumber: v.string(),
    memoryKey: v.string(),
    content: v.string(),
    normalizedContent: v.string(),
    memoryType: v.string(),
    importance: v.number(),
    confidence: v.number(),
    status: v.string(), // active | superseded | deleted
    ownerStatus: v.string(), // `${phoneNumber}\0${status}` for search filters
    embedding: v.optional(v.array(v.float64())),
    embeddingModel: v.optional(v.string()),
    sourceEventIds: v.array(v.id('events')),
    // Imported Mem0 rows predate the raw event log. Preserve their provider
    // IDs so the migration is still auditable even though no event exists.
    legacySourceIds: v.optional(v.array(v.string())),
    validUntil: v.optional(v.number()),
    supersededBy: v.optional(v.id('memories')),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_phone_status', ['phoneNumber', 'status'])
    .index('by_phone_key', ['phoneNumber', 'memoryKey'])
    .searchIndex('search_content', {
      searchField: 'content',
      filterFields: ['ownerStatus'],
    })
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 512,
      filterFields: ['ownerStatus'],
    }),

  // Raw append-only log of everything that arrives for a user. Never mutated,
  // so every derived entity can always be recomputed from source.
  events: defineTable({
    phoneNumber: v.string(),
    source: v.string(),   // 'imessage' | 'sms' | 'web' | 'import'
    kind: v.string(),     // 'message' | 'attachment' | 'link'
    text: v.optional(v.string()),
    mediaUrls: v.optional(v.array(v.string())),
    links: v.optional(v.array(v.string())),
    occurredAt: v.number(),
    processed: v.boolean(),  // has the extraction pass run on this yet
  })
    .index('by_phone', ['phoneNumber'])
    .index('by_phone_processed', ['phoneNumber', 'processed']),

  // The vault: places/activities extracted from shared content.
  places: defineTable({
    phoneNumber: v.string(),
    name: v.string(),
    nameNormalized: v.string(),  // lowercased, punctuation-stripped, for dedupe
    category: v.optional(v.string()),   // restaurant | bar | hotel | activity | shop
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    note: v.optional(v.string()),       // why it's worth going, in the source's words
    tags: v.optional(v.array(v.string())),
    sourceUrls: v.array(v.string()),    // the videos/links this came from
    eventIds: v.array(v.id('events')),  // provenance
    mentionCount: v.number(),           // how many saves point here
    visited: v.optional(v.boolean()),
    firstSeen: v.number(),
    lastSeen: v.number(),
  })
    .index('by_phone', ['phoneNumber'])
    .index('by_phone_name', ['phoneNumber', 'nameNormalized'])
    .index('by_phone_city', ['phoneNumber', 'city']),

  // Things the user said were coming up, so Pinch can ask how they went.
  //
  // This is the point of remembering something, rather than working the fact
  // into a later reply. Being asked "how was the date" the morning after is
  // what being known feels like; having your manager's name dropped into an
  // unrelated answer is just a system showing off its context window.
  followups: defineTable({
    phoneNumber: v.string(),
    subject: v.string(),        // "her date with Sam", "the Vellum interview"
    askText: v.string(),        // the actual message to send
    eventAt: v.number(),        // when the thing happens
    dueAt: v.number(),          // when to ask, event + a sensible gap
    status: v.string(),         // 'pending' | 'sent' | 'cancelled'
    eventId: v.optional(v.id('events')),   // provenance
    createdAt: v.number(),
  })
    .index('by_phone', ['phoneNumber'])
    .index('by_status_due', ['status', 'dueAt']),

  // Wardrobe, built from outfit photos the user sends.
  garments: defineTable({
    phoneNumber: v.string(),
    item: v.string(),
    itemNormalized: v.string(),
    category: v.optional(v.string()),
    color: v.optional(v.string()),
    pattern: v.optional(v.string()),
    vibe: v.optional(v.string()),
    wornCount: v.number(),
    eventIds: v.array(v.id('events')),
    firstSeen: v.number(),
    lastSeen: v.number(),
  })
    .index('by_phone', ['phoneNumber'])
    .index('by_phone_item', ['phoneNumber', 'itemNormalized']),
})
