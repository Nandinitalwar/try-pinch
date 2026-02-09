-- ============================================
-- UNIFIED SCHEMA: Support Both SMS & Web Users
-- ============================================

-- ----------------------------
-- Users Table (updated to support phone numbers)
-- ----------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE, -- For SMS/WhatsApp users
    name TEXT,
    date_of_birth DATE, -- For astrology
    time_of_birth TIME,
    place_of_birth TEXT,
    star_sign TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT users_identifier_check CHECK (email IS NOT NULL OR phone_number IS NOT NULL)
);

-- Add indexes for phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ----------------------------
-- Chats Table (updated)
-- ----------------------------
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user','assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------
-- Indexes for faster queries
-- ----------------------------
CREATE INDEX IF NOT EXISTS idx_chats_user_created ON chats(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chats_session_id ON chats(session_id);

-- ----------------------------
-- Function to update updated_at timestamp
-- ----------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------
-- Enable Row Level Security
-- ----------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role to manage all data
DROP POLICY IF EXISTS "Service can manage all users" ON users;
CREATE POLICY "Service can manage all users" ON users
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service can manage all chats" ON chats;
CREATE POLICY "Service can manage all chats" ON chats
  FOR ALL USING (true);

