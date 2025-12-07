-- Chat Messages Table for Astrology Bot
-- Run this in your Supabase SQL Editor

CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL, -- User's phone number (including whatsapp: prefix)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')), -- 'user' or 'assistant'
  content TEXT NOT NULL, -- The message content
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow the service to read/write all messages
CREATE POLICY "Service can manage all messages" ON chat_messages
  FOR ALL USING (true);

-- Create indexes for faster lookups
CREATE INDEX idx_chat_messages_phone_number ON chat_messages(phone_number);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_phone_created ON chat_messages(phone_number, created_at DESC);

-- Optional: Add foreign key to user_profiles (if you want to enforce referential integrity)
-- ALTER TABLE chat_messages 
--   ADD CONSTRAINT fk_chat_messages_user_profiles 
--   FOREIGN KEY (phone_number) 
--   REFERENCES user_profiles(phone_number) 
--   ON DELETE CASCADE;

