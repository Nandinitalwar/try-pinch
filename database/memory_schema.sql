-- ============================================
-- MEMORY SYSTEM FOR CONVERSATIONAL CONTINUITY
-- ============================================

-- User Memories Table
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'preference',    -- likes/dislikes (food, colors, etc)
        'personality',   -- traits, behaviors, quirks
        'relationship',  -- family, friends, romantic
        'lifestyle',     -- job, hobbies, routine
        'goal',         -- aspirations, fears, challenges
        'experience',   -- past events, stories
        'opinion',      -- views on topics, beliefs
        'habit',        -- regular behaviors, patterns
        'physical',     -- appearance, health, body
        'other'         -- miscellaneous memorable facts
    )),
    memory_key TEXT NOT NULL,        -- brief identifier (e.g., "food_preference", "pet_name")
    memory_value TEXT NOT NULL,      -- the actual memorable fact
    importance_score INTEGER NOT NULL DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
    confidence_score REAL NOT NULL DEFAULT 0.8 CHECK (confidence_score BETWEEN 0 AND 1),
    last_mentioned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mention_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure no duplicate keys per user
    UNIQUE(phone_number, memory_key)
);

-- Memory Context Table (for grouping related memories)
CREATE TABLE IF NOT EXISTS memory_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    context_name TEXT NOT NULL,     -- e.g., "family", "work", "dating"
    memory_ids UUID[] DEFAULT '{}', -- array of memory IDs in this context
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(phone_number, context_name)
);

-- Indexes for fast memory retrieval
CREATE INDEX IF NOT EXISTS idx_user_memories_phone ON user_memories(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_recency ON user_memories(last_mentioned DESC);
CREATE INDEX IF NOT EXISTS idx_memory_contexts_phone ON memory_contexts(phone_number);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_user_memories_timestamp ON user_memories;
CREATE TRIGGER update_user_memories_timestamp
    BEFORE UPDATE ON user_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_timestamp();

DROP TRIGGER IF EXISTS update_memory_contexts_timestamp ON memory_contexts;
CREATE TRIGGER update_memory_contexts_timestamp
    BEFORE UPDATE ON memory_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_timestamp();

-- Row Level Security
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_contexts ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Service can manage all memories" ON user_memories;
CREATE POLICY "Service can manage all memories" ON user_memories
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all contexts" ON memory_contexts;
CREATE POLICY "Service can manage all contexts" ON memory_contexts
  FOR ALL USING (true);