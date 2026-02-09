-- Simple SMS chat persistence table
-- No FKs to users table, no triggers, just phone_number as the key
CREATE TABLE IF NOT EXISTS sms_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_chats_phone ON sms_chats(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_chats_phone_created ON sms_chats(phone_number, created_at);

-- RLS
ALTER TABLE sms_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service can manage all sms_chats" ON sms_chats;
CREATE POLICY "Service can manage all sms_chats" ON sms_chats FOR ALL USING (true);
