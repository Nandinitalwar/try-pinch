# 📊 Where to View Logs

## ✅ Best Option: Vercel Dashboard (Easiest!)

### 1. **Go to your Vercel project:**
https://vercel.com/nandinis-projects-49e34ec0/ai_astrologer

### 2. **Click on your latest deployment** (at the top)

### 3. **Click "Runtime Logs" tab**

You'll see **real-time logs** including:
- 🔔 TWILIO WEBHOOK RECEIVED
- 📥 RAW WEBHOOK BODY
- 📊 All parsed data (From, To, MessageSid, etc.)
- 💾 Supabase save operations
- ✅ Success/failure messages
- 📤 Responses sent back to Twilio
- ❌ Any errors with full stack traces

---

## 🔍 What You'll See in the Logs:

### When you text the agent:

```
================================================================================
🔔 TWILIO WEBHOOK RECEIVED 2025-10-14T01:30:00.000Z
================================================================================

📥 RAW WEBHOOK BODY:
From=whatsapp%3A%2B15551234567&Body=My+name+is+Jane...

📊 PARSED WEBHOOK DATA:
From: whatsapp:+15551234567
To: +15559876543
MessageSid: SM1234567890abcdef
AccountSid: AC...
Message Body: My name is Jane and I was born on 3/15/1992 at 8:30 AM in Los Angeles
Is WhatsApp: true
All Params: { From: 'whatsapp:+15551234567', Body: 'My name is Jane...', ... }

💾 SAVING USER MESSAGE TO SUPABASE...
Phone: whatsapp:+15551234567
Message: My name is Jane and I was born on 3/15/1992 at 8:30 AM in Los Angeles
✅ User message saved to Supabase
Message ID: 12345678-1234-1234-1234-123456789012
Session ID: 87654321-4321-4321-4321-210987654321

💾 SAVING USER PROFILE TO SUPABASE...
Profile data: {
  "phone_number": "whatsapp:+15551234567",
  "name": "Jane",
  "date_of_birth": "3/15/1992",
  "time_of_birth": "8:30 AM",
  "place_of_birth": "Los Angeles"
}
✅ USER PROFILE SAVED TO SUPABASE
Profile ID: abcdef12-3456-7890-abcd-ef1234567890
Phone: whatsapp:+15551234567
Name: Jane
DOB: 3/15/1992

💾 SAVING AI RESPONSE TO SUPABASE...
✅ AI response saved to Supabase
Message ID: fedcba98-7654-3210-fedc-ba9876543210

📤 SENDING RESPONSE TO TWILIO
Type: WhatsApp
To: whatsapp:+15551234567
Response Length: 150
Response: hey jane! nice to meet you. born on march 15, 1992...

✅ WEBHOOK COMPLETE!
TwiML Response:
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>hey jane! nice to meet you. born on march 15, 1992...</Message>
</Response>
================================================================================
```

---

## 🛠️ Alternative: Vercel CLI

### View recent logs in terminal:
```bash
vercel logs https://aiastrologer-5j5fmgh5t-nandinis-projects-49e34ec0.vercel.app
```

### Stream live logs:
```bash
vercel logs https://aiastrologer.vercel.app --follow
```

But the **dashboard is much easier** to read!

---

## 🗂️ Check Supabase Directly

### View all users:
https://app.supabase.com/project/aiaonjvzzysswphmedxo/editor/28544

Run this query:
```sql
SELECT 
  phone_number,
  name,
  date_of_birth,
  time_of_birth,
  place_of_birth,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;
```

### View all chat messages:
```sql
SELECT 
  phone_number,
  role,
  substring(message, 1, 50) as message_preview,
  created_at
FROM chats
ORDER BY created_at DESC
LIMIT 20;
```

---

## 🧪 Testing Steps:

1. **Text your agent** with: `"My name is Jane, born 3/15/1992 at 8:30 AM in Los Angeles"`

2. **Immediately go to Vercel Dashboard** → Runtime Logs

3. **Watch for these key lines:**
   - ✅ `User message saved to Supabase` → Message ID
   - ✅ `USER PROFILE SAVED TO SUPABASE` → Profile ID, Name, DOB
   - ✅ `AI response saved to Supabase` → Response saved

4. **If you see ❌ FAILED:**
   - Check the error message
   - Look for stack trace
   - Verify Supabase credentials are set in Vercel

5. **Then check Supabase** to confirm data is there:
   - Go to Table Editor
   - Look in `users` table
   - Look in `chats` table

---

## 📝 Quick Links:

- **Vercel Project:** https://vercel.com/nandinis-projects-49e34ec0/ai_astrologer
- **Supabase Dashboard:** https://app.supabase.com/project/aiaonjvzzysswphmedxo
- **Production URL:** https://aiastrologer.vercel.app

---

## 🚨 If Data Isn't Saving:

Look for these errors in logs:
- `FAILED to save user message` → Check Supabase connection
- `FAILED TO SAVE USER PROFILE` → Check users table exists
- `Invalid API key` → Environment variables not set in Vercel

Then check **Environment Variables** in Vercel:
https://vercel.com/nandinis-projects-49e34ec0/ai_astrologer/settings/environment-variables

Make sure these exist:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`

