# How to Get API Keys for Pinch

This guide walks you through getting API keys for SendBlue (iMessage) and Braintrust (AI Observability).

---

## 🔵 SendBlue (iMessage Support)

### Step 1: Sign Up for SendBlue

1. Go to **https://sendblue.co**
2. Click **"Get Started"** or **"Sign Up"**
3. Create an account with your email
4. Verify your email address

### Step 2: Choose a Plan

SendBlue offers different plans:
- **Developer Plan** (~$20-50/month) - Good for testing
- **Growth Plan** (~$100+/month) - For production use
- Check their pricing page for current rates

**Note:** SendBlue requires a paid plan to use their API. There's no free tier.

### Step 3: Provision a Phone Number

1. Log in to your SendBlue dashboard
2. Go to **"Phone Numbers"** or **"Numbers"**
3. Click **"Get a Number"** or **"Provision Number"**
4. Choose a phone number (US numbers work best for iMessage)
5. Complete the provisioning process

**Important:** Not all SendBlue numbers support iMessage. Make sure to:
- Select a number that explicitly supports iMessage
- Verify it's activated for iMessage in the dashboard

### Step 4: Get Your API Credentials

1. In the SendBlue dashboard, go to **Settings** → **API Keys**
2. You'll see two keys:
   - **API Key ID** (sb-api-key-id) - Usually starts with `sb_`
   - **API Secret Key** (sb-api-secret-key) - A longer secret string
3. Copy both keys (you'll need them for `.env.local`)

### Step 5: Add to Your Environment

Edit `packages/api/.env.local`:

```bash
SENDBLUE_API_KEY_ID=sb_your_actual_key_id_here
SENDBLUE_API_SECRET_KEY=your_actual_secret_key_here
SENDBLUE_FROM_NUMBER=+15551234567  # Your SendBlue number in E.164 format
```

**E.164 Format:** Phone numbers must include country code with `+` prefix:
- ✅ Correct: `+15551234567`
- ❌ Wrong: `5551234567` or `(555) 123-4567`

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

### SendBlue
- **Free Tier:** ❌ No free tier
- **Paid Plans:** Starting at ~$20-50/month
- **Per Message:** Varies by plan (typically $0.01-0.03 per message)
- **iMessage:** Included in plans that support it
- **Best For:** Production iMessage support

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

### Without SendBlue:
- ✅ Twilio SMS still works
- ✅ All AI features work
- ❌ No iMessage support
- The app will log: `[SendBlue] Not configured - skipping iMessage support`

### Without Braintrust:
- ✅ All features work normally
- ❌ No AI observability/logging
- The app will log: `[Braintrust] Not configured - skipping observability`

---

## 📋 Quick Checklist

### SendBlue Setup
- [ ] Sign up at sendblue.co
- [ ] Choose a paid plan
- [ ] Provision a phone number with iMessage support
- [ ] Get API Key ID and API Secret Key
- [ ] Add to `.env.local`
- [ ] Configure webhook URL in SendBlue dashboard

### Braintrust Setup
- [ ] Sign up at braintrust.dev (free!)
- [ ] Create a project
- [ ] Get API key (starts with `bt-`)
- [ ] Note your project name
- [ ] Add to `.env.local`
- [ ] Test and view logs in dashboard

---

## 🆘 Need Help?

### SendBlue Support
- **Docs:** https://docs.sendblue.co
- **Support:** support@sendblue.co
- **Dashboard:** https://app.sendblue.co

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
   vercel env add SENDBLUE_API_KEY_ID
   vercel env add SENDBLUE_API_SECRET_KEY
   vercel env add SENDBLUE_FROM_NUMBER
   vercel env add BRAINTRUST_API_KEY
   vercel env add BRAINTRUST_PARENT
   ```
3. Configure SendBlue webhook (see `SENDBLUE_SETUP.md`)
4. Test with real messages!
5. Monitor in Braintrust dashboard

See `TESTING.md` for detailed testing instructions.

