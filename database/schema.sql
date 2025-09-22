-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own chat sessions
CREATE POLICY "Users can only access their own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Create user_profiles table (if not exists)
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE,
  time_of_birth TIME,
  place_of_birth TEXT,
  star_sign TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Enable Row Level Security for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for user_profiles
CREATE POLICY "Users can only access their own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Create predictions table for storing astrological predictions
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  star_sign TEXT NOT NULL,
  category TEXT NOT NULL,
  prediction_text TEXT NOT NULL,
  time_period_start DATE,
  time_period_end DATE,
  message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for predictions
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_star_sign ON predictions(star_sign);
CREATE INDEX IF NOT EXISTS idx_predictions_category ON predictions(category);

-- Enable Row Level Security for predictions
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Create policy for predictions
CREATE POLICY "Users can only access their own predictions" ON predictions
  FOR ALL USING (auth.uid() = user_id);
