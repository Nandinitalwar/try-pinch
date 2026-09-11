# How to Get API Keys for Pinch

This guide covers Groq, Linq, and Braintrust credentials. Linq is Pinch's sole iMessage
provider; Groq is the optional free local reply-provider lane.

## Groq (free local reply testing)

1. Open **https://console.groq.com/keys** and sign in.
2. Create an API key and copy it immediately.
3. Put it in `packages/api/.env.local` without sharing it in chat:

```bash
PINCH_REPLY_PROVIDER=groq
PINCH_REPLY_MODEL=openai/gpt-oss-120b
PINCH_REPLY_REASONING_EFFORT=low
GROQ_API_KEY=your_actual_groq_key
```

Groq is not Grok: Groq is the inference provider; Grok is xAI's model. This setting only
moves the user-facing text reply to Groq. Memory extraction, memory embeddings, and voice
transcription still use `OPENAI_API_KEY`.

The free GPT-OSS limit is 1,000 requests per day but only 8K tokens per minute, so a tool
round or voice rewrite may need a minute before the next test. Do not copy these local
settings to Vercel until the live harness passes.

---

## Linq (primary iMessage provider)

### Step 1: Create a Linq account and line

1. Open **https://dashboard.linqapp.com**
2. Create an account and provision an iMessage-capable line
3. Keep the line active in the Linq dashboard

### Step 2: Generate an API token

1. Open **API → Overview → Generate new token** in the Linq dashboard
2. Copy the token immediately
3. Save it as `LINQ_API_KEY`

### Step 3: Create the webhook subscription

Create a subscription for `message.received` with this exact, version-pinned target:

```text
https://your-app.vercel.app/api/webhook/linq?version=2026-02-03
```

You can create it in the dashboard or with the Partner API:

```bash
curl -X POST https://api.linqapp.com/api/partner/v3/webhook-subscriptions \
  -H "Authorization: Bearer $LINQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://your-app.vercel.app/api/webhook/linq?version=2026-02-03",
    "subscribed_events": ["message.received"]
  }'
```

The create response includes a `signing_secret` once. Copy it immediately; Linq does not
show it again.

### Step 4: Add the credentials

Edit `packages/api/.env.local`:

```bash
LINQ_API_KEY=your_actual_linq_api_key
LINQ_WEBHOOK_SECRET=whsec_your_actual_linq_signing_secret
```

Phone numbers sent to Linq must use E.164 format, for example `+15551234567`.

---

## 🧠 Braintrust (AI Observability)

### Step 1: Sign Up for Braintrust

1. Go to **https://www.braintrust.dev**
2. Click **"Sign Up"** or **"Get Started"**
3. You can sign up with:
   - Email
   - GitHub
   - Google
4. Verify your email if needed

**Good news:** Braintrust has a **generous free tier** that's perfect for getting started!

### Step 2: Create a Project

1. After logging in, you'll be prompted to create a project
2. Click **"New Project"** or **"Create Project"**
3. Name your project (e.g., `pinch-sms-astrologer`)
4. Click **"Create"**

### Step 3: Get Your API Key

1. In your Braintrust dashboard, click on your profile/settings icon
2. Go to **"Settings"** → **"API Keys"**
3. Click **"Create API Key"** or **"New API Key"**
4. Give it a name (e.g., "Pinch Production")
5. Copy the API key - it starts with `bt-`

**Important:** Save this key immediately! Braintrust won't show it again.

### Step 4: Get Your Project Name

1. Go to your project in the Braintrust dashboard
2. Note the project name (the one you created in Step 2)
3. The format for `BRAINTRUST_PARENT` is: `project_name:your-project-name`

### Step 5: Add to Your Environment

Edit `packages/api/.env.local`:

```bash
BRAINTRUST_API_KEY=bt-your_actual_api_key_here
BRAINTRUST_PARENT=project_name:pinch-sms-astrologer
```

**Example:**
```bash
BRAINTRUST_API_KEY=bt-abc123def456ghi789
BRAINTRUST_PARENT=project_name:pinch-sms-astrologer
```

---

## 💰 Cost Comparison

### Linq
- Check the Linq dashboard for current account and messaging pricing
- Supports iMessage with RCS/SMS fallback through the same Partner API
- Pinch uses the existing chat ID for replies and Linq's managed endpoint for proactive sends

### Braintrust
- **Free Tier:** ✅ Yes! Generous free tier
- **Free Includes:**
  - Up to 1M log events per month
  - 30-day data retention
  - Full dashboard access
  - All core features
- **Paid Plans:** For higher volume or longer retention
- **Best For:** AI observability and debugging

---

## 🧪 Testing Without API Keys

You can test Pinch without these services:

### Without Linq:
- ✅ Twilio SMS still works
- ✅ All AI features work
- ❌ No iMessage support
- The app will log: `[Linq] Not configured - skipping iMessage support`

### Without Braintrust:
- ✅ All features work normally
- ❌ No AI observability/logging
- The app will log: `[Braintrust] Not configured - skipping observability`

---

## 📋 Quick Checklist

### Linq Setup
- [ ] Create an account at dashboard.linqapp.com
- [ ] Provision an iMessage-capable line
- [ ] Generate an API token
- [ ] Create a `message.received` webhook subscription pinned to `2026-02-03`
- [ ] Save the one-time signing secret
- [ ] Add both credentials to `.env.local` and Vercel

### Braintrust Setup
- [ ] Sign up at braintrust.dev (free!)
- [ ] Create a project
- [ ] Get API key (starts with `bt-`)
- [ ] Note your project name
- [ ] Add to `.env.local`
- [ ] Test and view logs in dashboard

### Groq Setup
- [ ] Create a key at console.groq.com/keys
- [ ] Add `GROQ_API_KEY` locally
- [ ] Run the plain-reply, tool-call, activation, and rewrite harness cases

---

## 🆘 Need Help?

### Linq Support
- **Docs:** https://docs.linqapp.com
- **Dashboard:** https://dashboard.linqapp.com

### Braintrust Support
- **Docs:** https://www.braintrust.dev/docs
- **Discord:** Join their community Discord
- **Dashboard:** https://www.braintrust.dev

---

## 🚀 Next Steps

Once you have your API keys:

1. Add them to `.env.local` (for local development)
2. Add them to Vercel (for production):
   ```bash
   vercel env add LINQ_API_KEY
   vercel env add LINQ_WEBHOOK_SECRET
   vercel env add BRAINTRUST_API_KEY
   vercel env add BRAINTRUST_PARENT
   ```
3. Configure the Linq webhook at `/api/webhook/linq?version=2026-02-03`
4. Test with real messages!
5. Monitor in Braintrust dashboard

See `TESTING.md` for detailed testing instructions.
