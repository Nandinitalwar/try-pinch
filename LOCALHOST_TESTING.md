# Localhost Development & Testing Guide

## 1. View Console Logs in Browser

### Start Development Server
```bash
npm run dev
```

### View Real-Time Logs
Open your browser to: **http://localhost:3000/logs**

This page shows:
- ✅ Real-time logs from all API routes
- 🎯 Color-coded log levels (INFO, ERROR, WARN, DEBUG)
- 🔍 Search/filter functionality
- 🗑️ Clear logs button
- 📊 Log count
- 📜 Auto-scroll to latest logs

### Make API Requests
In another terminal or from your app:
```bash
# Test chat API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is my horoscope?",
    "history": [],
    "userProfile": {
      "name": "Test User",
      "dateOfBirth": "1990-01-01",
      "timeOfBirth": "12:00 PM",
      "placeOfBirth": "New York, NY",
      "starSign": "Capricorn"
    }
  }'
```

**Watch the logs appear in real-time at http://localhost:3000/logs**

---

## 2. Test Supabase Data Storage

### Setup Environment Variables
Make sure `.env.local` exists with:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

### Run Supabase Tests
```bash
npm run test:supabase
```

This will:
1. ✅ Verify Supabase connection
2. ✅ Create a test user profile
3. ✅ Read the profile back
4. ✅ Update the profile
5. ✅ Verify profile completeness
6. ✅ Test birth details extraction
7. ✅ Test querying non-existent profiles

### Sample Output
```
🧪 SUPABASE USER PROFILE TESTING SUITE
Testing Supabase integration for user profile storage

============================================================
TEST 1: Supabase Connection
============================================================
ℹ Testing environment variables...
✓ NEXT_PUBLIC_SUPABASE_URL is set
✓ SUPABASE_SERVICE_ROLE_KEY is set

============================================================
TEST 2: Create User Profile
============================================================
ℹ Creating profile for phone: +15551234567
✓ Profile created successfully
ℹ Profile ID: 123e4567-e89b-12d3-a456-426614174000
ℹ Name: Test User
ℹ Date of Birth: 1990-01-01
ℹ Star Sign: Capricorn

...

============================================================
TEST SUMMARY
============================================================
Total Tests: 7
Passed: 7
Failed: 0

🎉 All tests passed! Supabase is correctly storing user data.
```

---

## 3. Manual Supabase Testing

### Check Data in Supabase Dashboard

1. Go to [app.supabase.com](https://app.supabase.com)
2. Select your project
3. Go to **Table Editor** → `user_profiles`
4. You should see test data created by the script

### Manual SQL Query
In Supabase SQL Editor:
```sql
-- View all user profiles
SELECT * FROM user_profiles ORDER BY created_at DESC LIMIT 10;

-- Check specific user
SELECT * FROM user_profiles WHERE phone_number = '+15551234567';

-- Count total users
SELECT COUNT(*) FROM user_profiles;

-- View recent updates
SELECT * FROM user_profiles 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

---

## 4. Test SMS Flow Locally

### Using Twilio CLI (Recommended)

Install Twilio CLI:
```bash
brew tap twilio/brew && brew install twilio
# or
npm install -g twilio-cli
```

Login to Twilio:
```bash
twilio login
```

Test webhook locally:
```bash
# Start your dev server
npm run dev

# In another terminal, forward Twilio webhooks to localhost
twilio phone-numbers:update YOUR_PHONE_NUMBER \
  --sms-url="http://localhost:3000/api/webhook/twilio"
```

Now send SMS to your Twilio number and it will hit your local server!

### Using ngrok (Alternative)

```bash
# Install ngrok
brew install ngrok
# or download from https://ngrok.com/

# Start dev server
npm run dev

# In another terminal, expose localhost
ngrok http 3000

# Copy the ngrok URL (e.g., https://abc123.ngrok.io)
# Set it as your Twilio webhook:
# https://abc123.ngrok.io/api/webhook/twilio
```

---

## 5. Debug Tips

### Terminal Logs
All API routes log to the terminal where you ran `npm run dev`:
```bash
=== POST /api/chat - Request received ===
Headers: {content-type: 'application/json', ...}
Client IP: ::1
Message: What is my horoscope?
...
```

### Browser Logs Page
Visit http://localhost:3000/logs to see formatted, filterable logs

### Network Tab
- Open browser DevTools (F12)
- Go to **Network** tab
- Make requests from your UI
- Click on requests to see headers, payload, response

### Supabase Logs
1. Go to Supabase Dashboard
2. Select your project
3. Click **Logs** in the sidebar
4. View database queries and errors

---

## 6. Common Issues & Solutions

### Issue: Logs page shows "No logs yet"
**Solution**: The logs API stores logs in memory. Make some API requests first.

### Issue: `npm run test:supabase` fails with connection error
**Solution**: 
1. Check `.env.local` has correct Supabase credentials
2. Verify Supabase project is running
3. Check if `user_profiles` table exists (run `database/user_profiles.sql` in Supabase SQL Editor)

### Issue: SMS webhook not working locally
**Solution**:
1. Use ngrok or Twilio CLI to expose localhost
2. Update Twilio webhook URL to point to your exposed URL
3. Check logs for errors

### Issue: "Module not found" when running tests
**Solution**:
```bash
npm install tsx --save-dev
```

---

## 7. Best Practices

### Development Workflow
1. Start dev server: `npm run dev`
2. Open logs page: http://localhost:3000/logs
3. Make changes to code
4. Test via API requests or SMS
5. Watch logs in real-time
6. Before deploying, run: `npm run test:supabase`

### Environment Variables
- Use `.env.local` for local development
- Never commit `.env.local` to git
- Use `.env.example` as a template

### Testing Checklist
Before deploying:
- [ ] `npm run dev` starts without errors
- [ ] `npm run test:supabase` passes all tests
- [ ] SMS flow works (if using Twilio)
- [ ] API endpoints respond correctly
- [ ] Logs appear on http://localhost:3000/logs

---

## 8. Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test:supabase` | Test Supabase integration |
| `npm run deploy` | Deploy to Vercel production |

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Main app |
| http://localhost:3000/logs | Real-time logs viewer |
| http://localhost:3000/api/chat | Chat API endpoint |
| http://localhost:3000/api/webhook/twilio | Twilio webhook |

---

Need help? Check the logs first! 🔍

