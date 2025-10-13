-- User Profiles Table for Astrology Bot
-- Run this in your Supabase SQL Editor

CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL, -- User's phone number (including whatsapp: prefix)
  name TEXT,
  date_of_birth DATE,
  time_of_birth TIME,
  place_of_birth TEXT,
  star_sign TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow the service to read/write all profiles
CREATE POLICY "Service can manage all profiles" ON user_profiles
  FOR ALL USING (true);

-- Create an index for faster lookups by phone number
CREATE INDEX idx_user_profiles_phone_number ON user_profiles(phone_number);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();