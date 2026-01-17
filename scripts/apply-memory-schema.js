// Quick script to test if Supabase connection works for memory tables
// Note: This won't actually create tables - you'll need to run the SQL manually in Supabase

async function testSupabaseConnection() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ Supabase environment variables not configured')
      return
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('🔗 Testing Supabase connection...')
    
    // Try to query user_profiles table (which should exist)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('phone_number')
      .limit(1)
    
    if (error) {
      console.log('❌ Supabase connection failed:', error.message)
    } else {
      console.log('✅ Supabase connection successful!')
      console.log('📝 To enable memory system:')
      console.log('   1. Copy content from database/memory_schema.sql')
      console.log('   2. Run in Supabase SQL Editor')
      console.log('   3. Restart the dev server')
      console.log('   4. Test with webhook messages')
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message)
  }
}

testSupabaseConnection()