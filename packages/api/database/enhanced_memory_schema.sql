-- ============================================
-- ENHANCED CLAUDE-LIKE MEMORY SYSTEM
-- ============================================

-- Drop existing tables to recreate with enhancements
DROP TABLE IF EXISTS memory_contexts CASCADE;
DROP TABLE IF EXISTS user_memories CASCADE;

-- Enhanced User Memories Table
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    
    -- Core memory data
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'personal',      -- name, age, location, family
        'preferences',   -- likes/dislikes, styles, choices
        'context',       -- ongoing projects, situations, goals
        'relationships', -- people, pets, social connections
        'patterns',      -- behaviors, habits, communication style
        'experiences',   -- past events, stories, achievements
        'beliefs',       -- opinions, values, worldviews
        'professional',  -- work, career, skills
        'physical',      -- health, appearance, body-related
        'temporal'       -- schedules, routines, time preferences
    )),
    memory_key TEXT NOT NULL,        -- unique identifier
    memory_content TEXT NOT NULL,    -- the actual memorable fact
    memory_summary TEXT,             -- brief one-line summary for quick reference
    
    -- Claude-like scoring
    importance_score INTEGER NOT NULL DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
    confidence_score REAL NOT NULL DEFAULT 0.8 CHECK (confidence_score BETWEEN 0 AND 1),
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'disputed', 'outdated')),
    
    -- Semantic relationships
    related_memory_ids UUID[] DEFAULT '{}',
    semantic_tags TEXT[] DEFAULT '{}',       -- for grouping similar concepts
    embedding_vector VECTOR(1536),          -- for semantic similarity (if using pgvector)
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    last_mentioned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mention_count INTEGER DEFAULT 1,
    
    -- Source and context
    source_conversation_id TEXT,
    extraction_method TEXT DEFAULT 'ai_automatic' CHECK (extraction_method IN ('ai_automatic', 'user_provided', 'inferred', 'corrected')),
    
    -- Lifecycle management
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,      -- for temporary memories
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    UNIQUE(phone_number, memory_key)
);

-- Memory Clusters (for semantic grouping)
CREATE TABLE IF NOT EXISTS memory_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    cluster_name TEXT NOT NULL,              -- e.g., "food_preferences", "work_situation", "family"
    cluster_type TEXT NOT NULL,              -- 'semantic', 'temporal', 'contextual'
    description TEXT,                        -- human-readable description
    memory_ids UUID[] DEFAULT '{}',          -- memories in this cluster
    cluster_score REAL DEFAULT 0.5,         -- how cohesive/important this cluster is
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(phone_number, cluster_name)
);

-- Conversation Patterns (cross-conversation learning)
CREATE TABLE IF NOT EXISTS conversation_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN (
        'communication_style',    -- formal, casual, brief, detailed
        'topic_preference',       -- loves astrology, avoids politics
        'interaction_timing',     -- prefers morning chats, weekend conversations
        'response_style',         -- likes humor, prefers directness, needs encouragement
        'help_seeking',          -- how they ask for help, what support they need
        'feedback_style'         -- how they give/receive feedback
    )),
    pattern_description TEXT NOT NULL,
    confidence_level REAL NOT NULL DEFAULT 0.5 CHECK (confidence_level BETWEEN 0 AND 1),
    evidence_count INTEGER DEFAULT 1,        -- how many conversations support this pattern
    last_observed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(phone_number, pattern_type, pattern_description)
);

-- Memory Verification Queue (for double-checking important facts)
CREATE TABLE IF NOT EXISTS memory_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES user_memories(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('fact_check', 'user_confirmation', 'contradiction_check')),
    verification_prompt TEXT,               -- question to ask user for verification
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'skipped')),
    user_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Memory Access Log (for learning usage patterns)
CREATE TABLE IF NOT EXISTS memory_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES user_memories(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('retrieval', 'mention', 'update', 'verification')),
    context TEXT,                           -- what conversation context triggered this access
    effectiveness_score REAL,              -- did this memory help the conversation?
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Memory Preferences (user control over memory)
CREATE TABLE IF NOT EXISTS user_memory_preferences (
    phone_number TEXT PRIMARY KEY,
    memory_enabled BOOLEAN DEFAULT TRUE,
    auto_extract BOOLEAN DEFAULT TRUE,
    verification_frequency TEXT DEFAULT 'important_only' CHECK (verification_frequency IN ('never', 'important_only', 'always')),
    retention_period_days INTEGER DEFAULT 365,
    sensitive_topics TEXT[] DEFAULT '{}',    -- topics user doesn't want remembered
    preferred_memory_types TEXT[] DEFAULT '{}', -- types user wants prioritized
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Core lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_memories_phone ON user_memories(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(phone_number, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_memories_active ON user_memories(phone_number, is_active, last_accessed DESC);

-- Semantic search indexes
CREATE INDEX IF NOT EXISTS idx_user_memories_tags ON user_memories USING GIN(semantic_tags);
CREATE INDEX IF NOT EXISTS idx_user_memories_related ON user_memories USING GIN(related_memory_ids);

-- Cluster indexes
CREATE INDEX IF NOT EXISTS idx_memory_clusters_phone ON memory_clusters(phone_number);
CREATE INDEX IF NOT EXISTS idx_memory_clusters_type ON memory_clusters(cluster_type);

-- Pattern indexes
CREATE INDEX IF NOT EXISTS idx_conversation_patterns_phone ON conversation_patterns(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_patterns_type ON conversation_patterns(pattern_type);

-- Verification indexes
CREATE INDEX IF NOT EXISTS idx_memory_verifications_status ON memory_verifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_memory_verifications_phone ON memory_verifications(phone_number);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-update access count when memory is accessed
CREATE OR REPLACE FUNCTION increment_memory_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_memories 
    SET access_count = access_count + 1,
        last_accessed = NOW()
    WHERE id = NEW.memory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_user_memories_timestamp ON user_memories;
CREATE TRIGGER update_user_memories_timestamp
    BEFORE UPDATE ON user_memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_timestamp();

DROP TRIGGER IF EXISTS update_memory_clusters_timestamp ON memory_clusters;
CREATE TRIGGER update_memory_clusters_timestamp
    BEFORE UPDATE ON memory_clusters
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_timestamp();

DROP TRIGGER IF EXISTS increment_access_count ON memory_access_log;
CREATE TRIGGER increment_access_count
    AFTER INSERT ON memory_access_log
    FOR EACH ROW
    EXECUTE FUNCTION increment_memory_access();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_preferences ENABLE ROW LEVEL SECURITY;

-- Service role policies
DROP POLICY IF EXISTS "Service can manage all memories" ON user_memories;
CREATE POLICY "Service can manage all memories" ON user_memories FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all clusters" ON memory_clusters;
CREATE POLICY "Service can manage all clusters" ON memory_clusters FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all patterns" ON conversation_patterns;
CREATE POLICY "Service can manage all patterns" ON conversation_patterns FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all verifications" ON memory_verifications;
CREATE POLICY "Service can manage all verifications" ON memory_verifications FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all access logs" ON memory_access_log;
CREATE POLICY "Service can manage all access logs" ON memory_access_log FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all preferences" ON user_memory_preferences;
CREATE POLICY "Service can manage all preferences" ON user_memory_preferences FOR ALL USING (true);