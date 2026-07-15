-- ============================================
-- UNIFIED SCHEMA: Pinch SMS Astrology App
-- ============================================
-- Tables: user_profiles, user_memories, sms_chats
-- Dead tables removed: users, chats, memory_clusters,
--   conversation_patterns, memory_verifications, user_memory_preferences

-- ----------------------------
-- Drop legacy tables
-- ----------------------------
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS memory_clusters CASCADE;
DROP TABLE IF EXISTS conversation_patterns CASCADE;
DROP TABLE IF EXISTS memory_verifications CASCADE;
DROP TABLE IF EXISTS user_memory_preferences CASCADE;

-- ----------------------------
-- Shared trigger function
-- ----------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------
-- user_profiles
-- ----------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    preferred_name TEXT,
    birth_date DATE,
    birth_time TIME DEFAULT '12:00:00',
    birth_time_known BOOLEAN DEFAULT false,
    birth_time_accuracy TEXT DEFAULT 'unknown' CHECK (birth_time_accuracy IN ('exact', 'approximate', 'unknown')),
    birth_timezone TEXT,
    birth_city TEXT,
    birth_country TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage profiles" ON user_profiles;
CREATE POLICY "Service can manage profiles" ON user_profiles FOR ALL USING (true);

-- ----------------------------
-- user_memories
-- ----------------------------
CREATE TABLE IF NOT EXISTS user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL REFERENCES user_profiles(phone_number) ON DELETE CASCADE,
    memory_content TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'relationship', 'lifestyle', 'personal', 'event', 'other')),
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    is_active BOOLEAN DEFAULT true,
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'disputed', 'outdated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone_number, memory_content)
);

CREATE INDEX idx_memories_phone ON user_memories(phone_number);
CREATE INDEX idx_memories_importance ON user_memories(importance DESC) WHERE is_active = true;
CREATE INDEX idx_memories_type ON user_memories(memory_type);

CREATE TRIGGER update_user_memories_updated_at
    BEFORE UPDATE ON user_memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage memories" ON user_memories;
CREATE POLICY "Service can manage memories" ON user_memories FOR ALL USING (true);

-- ----------------------------
-- sms_chats
-- ----------------------------
CREATE TABLE IF NOT EXISTS sms_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL REFERENCES user_profiles(phone_number) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_chats_phone ON sms_chats(phone_number);
CREATE INDEX idx_sms_chats_phone_created ON sms_chats(phone_number, created_at DESC);

CREATE TRIGGER update_sms_chats_updated_at
    BEFORE UPDATE ON sms_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sms_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service can manage sms_chats" ON sms_chats;
CREATE POLICY "Service can manage sms_chats" ON sms_chats FOR ALL USING (true);
