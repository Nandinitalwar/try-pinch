# Supabase Setup Guide

## What You Need to Store in Supabase

1. **User Profiles** - Name, birth date/time/place, star sign
2. **Chat Messages** - Full conversation history

---

## Step 1: Get Your Supabase Credentials

### Go to Supabase Dashboard
1. Visit: https://app.supabase.com
2. Select your project (or create a new one)
3. Go to **Settings** → **API**

### Copy These Values:
- **Project URL** (looks like: `https://abcdefgh.supabase.co`)
- **Service Role Key** (anon/public key is NOT enough - you need service_role)

---

## Step 2: Set Up Environment Variables

Create or update `.env.local`:

```bash
# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your_service_role_key_here

# Other required variables
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Step 3: Create Database Tables

### In Supabase Dashboard:

1. Go to **SQL Editor**
2. Click **New Query**
3. Run this script:

```sql
-- Run database/user_profiles.sql first
-- (Copy and paste the entire content from database/user_profiles.sql)

-- Then run database/chat_messages.sql
-- (Copy and paste the entire content from database/chat_messages.sql)
```

Or use the files:
- `database/user_profiles.sql` - User information table
- `database/chat_messages.sql` - Chat history table

---

## Step 4: Verify Tables Were Created

In Supabase Dashboard:
1. Go to **Table Editor**
2. You should see:
   - ✅ `user_profiles` table
   - ✅ `chat_messages` table

---

## Step 5: Test the Connection

Run the test script:

```bash
npm run test:supabase
```

You should see:
```
✓ Supabase connection
✓ Create user profile
✓ Read user profile
✓ Update user profile
✓ Profile completeness check
✓ Birth details extraction
✓ Non-existent profile handling

🎉 All tests passed!
```

---

## What Gets Stored Automatically

Once set up, the system automatically stores:

### User Profiles (`user_profiles` table)
- Phone number (unique ID)
- Name (extracted from "My name is...")
- Date of birth (extracted from "I was born on...")
- Time of birth (extracted from "at 3:30 PM")
- Place of birth (extracted from "in New York")
- Star sign (calculated or extracted)
- Timestamps (created_at, updated_at)

### Chat Messages (`chat_messages` table)
- Phone number
- Role (user or assistant)
- Message content
- Timestamp

---

## Current Storage Status

### ✅ Already Implemented:
- User profiles are saved to Supabase
- Profile extraction from messages
- Profile loading from database

### ❌ Not Yet Implemented:
- Chat messages storage (currently only in memory)
- Conversation history persistence

---

## To Enable Chat History Storage

I've created the necessary files:
- `database/chat_messages.sql` - Database schema
- `lib/chatStorage.ts` - Storage service

Would you like me to:
1. Update the webhook to save all chat messages to Supabase?
2. Load conversation history from database instead of memory?

This will make your chat history persistent across server restarts!

---

## Environment Variables Checklist

Required in `.env.local` (development):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `TWILIO_ACCOUNT_SID`
- [ ] `TWILIO_AUTH_TOKEN`
- [ ] `TWILIO_PHONE_NUMBER`

Required in Vercel (production):
Same variables, set in: **Project Settings** → **Environment Variables**

---

## Troubleshooting

### "Invalid API key" Error
- Make sure you're using **Service Role Key**, not the anon/public key
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`

### "Table does not exist" Error
- Run both SQL files in Supabase SQL Editor
- Verify tables exist in Table Editor

### "Permission denied" Error
- Check RLS policies are set correctly
- Service role should bypass RLS automatically

---

## Next Steps

1. ✅ Create tables in Supabase
2. ✅ Set environment variables
3. ✅ Test with `npm run test:supabase`
4. ⏳ Enable chat history storage (optional)
5. ⏳ Deploy to production with new env vars

Let me know if you want me to enable persistent chat history storage!

