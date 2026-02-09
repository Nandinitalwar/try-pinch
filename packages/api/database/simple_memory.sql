-- ============================================
-- SIMPLE BUT EFFECTIVE MEMORY SYSTEM
-- ============================================

-- Just one table for user memories
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    memory_content TEXT NOT NULL,           -- "hates pineapple pizza", "has dog named Luna"
    memory_type TEXT NOT NULL,              -- "preference", "relationship", "lifestyle"
    importance INTEGER DEFAULT 5,           -- 1-10 how important this is
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(phone_number, memory_content)    -- no duplicates
);

-- Simple index for fast lookups
CREATE INDEX IF NOT EXISTS idx_memories_phone ON user_memories(phone_number);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON user_memories(importance DESC);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_memories_timestamp
    BEFORE UPDATE ON user_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Row level security
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage memories" ON user_memories;
CREATE POLICY "Service can manage memories" ON user_memories FOR ALL USING (true);