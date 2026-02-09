#!/usr/bin/env npx tsx
/**
 * Test if chat messages are being saved to Supabase
 */

import { supabase } from '../lib/supabase'

async function testChatPersistence() {
  console.log('Testing chat message persistence...')
  
  const testPhone = '+15551234567'
  
  // Check if any chats exist for our test phone number
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, phone_number, name')
    .eq('phone_number', testPhone)
  
  if (userError) {
    console.error('Error fetching users:', userError)
    return
  }
  
  console.log('Users with phone', testPhone, ':', users)
  
  if (users && users.length > 0) {
    const userId = users[0].id
    
    // Check chats for this user
    const { data: chats, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (chatError) {
      console.error('Error fetching chats:', chatError)
      return
    }
    
    console.log('Chat messages for user:', chats)
    console.log('Total messages in DB:', chats?.length || 0)
    
    if (!chats || chats.length === 0) {
      console.log('WARNING: No chat messages found in database!')
      console.log('Messages are likely only stored in-memory and will be lost on server restart.')
    } else {
      console.log('Chat messages ARE being persisted to Supabase')
    }
  } else {
    console.log('No user found with that phone number')
  }
}

testChatPersistence()