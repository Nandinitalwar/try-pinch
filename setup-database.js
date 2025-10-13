const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aiaonjvzzysswphmedxo.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpYW9uanZ6enlzc3dwaG1lZHhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njc1MTM4MiwiZXhwIjoyMDcyMzI3MzgyfQ.C8ZPl3Ru6fJBiJF_dJJdv_0ZeDHIE0Bl5UiGzpHMbkA'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupDatabase() {
  console.log('Setting up user_profiles table...')
  
  try {
    // Create the table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_profiles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          phone_number TEXT UNIQUE NOT NULL,
          name TEXT,
          date_of_birth DATE,
          time_of_birth TIME,
          place_of_birth TEXT,
          star_sign TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Add RLS policies
        ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

        CREATE POLICY IF NOT EXISTS "Service can manage all profiles" ON user_profiles
          FOR ALL USING (true);

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_number ON user_profiles(phone_number);

        -- Update trigger function
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        -- Update trigger
        DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
        CREATE TRIGGER update_user_profiles_updated_at
            BEFORE UPDATE ON user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `
    })

    if (error) {
      console.error('Error creating table:', error)
    } else {
      console.log('✅ Table created successfully!')
    }

    // Test the table
    const { data, error: testError } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)

    if (testError) {
      console.error('Error testing table:', testError)
    } else {
      console.log('✅ Table is accessible!')
    }

  } catch (error) {
    console.error('Setup error:', error)
  }
}

setupDatabase()