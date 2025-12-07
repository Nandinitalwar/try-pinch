# 🔄 OpenRouter Setup Guide

## ✅ Why OpenRouter?

OpenRouter provides:
- Access to **multiple AI models** (Claude, GPT-4, Gemini, etc.)
- **Lower costs** than direct OpenAI
- **Automatic failover** between models
- **Pay-as-you-go** pricing

---

## 🔑 Get Your OpenRouter API Key

### 1. **Sign up at OpenRouter:**
https://openrouter.ai/

### 2. **Go to Keys:**
https://openrouter.ai/keys

### 3. **Create a new API key**
- Click "Create Key"
- Give it a name (e.g., "AI Astrologer Bot")
- Copy the key (starts with `sk-or-v1-...`)

### 4. **Add credits** (optional but recommended):
- Go to: https://openrouter.ai/credits
- Add $5-10 to start

---

## 💰 Pricing (Current Model: Claude 3.5 Sonnet)

- **Input:** $3.00 / 1M tokens
- **Output:** $15.00 / 1M tokens

**Example:** 1000 messages ≈ $0.50 - $2.00

Much cheaper than OpenAI's GPT-4!

---

## 🔧 Setup Steps:

### 1. **Add to Local Environment:**

Add to your `.env.local`:
```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 2. **Add to Vercel:**

```bash
vercel env add OPENROUTER_API_KEY production
# Paste your key when prompted
```

### 3. **Deploy:**

```bash
vercel --prod --yes --force
```

---

## 🎯 Current Configuration:

**Model:** `anthropic/claude-3.5-sonnet`
- Best balance of quality and cost
- Excellent for conversational AI
- Supports long context

### Want a Different Model?

Edit `app/api/chat/route.ts` line 227:

**Popular alternatives:**
```typescript
model: 'openai/gpt-4o-mini',        // Cheaper, faster
model: 'openai/gpt-4o',             // Most capable OpenAI
model: 'anthropic/claude-3-opus',   // Best quality (expensive)
model: 'google/gemini-pro-1.5',     // Google's model
model: 'meta-llama/llama-3.1-70b',  // Open source, fast
```

See all models: https://openrouter.ai/models

---

## 📊 Monitor Usage:

Check your spending:
https://openrouter.ai/activity

---

## 🚀 Quick Start:

```bash
# 1. Get your key from OpenRouter
# 2. Add to environment:
echo "OPENROUTER_API_KEY=sk-or-v1-your-key-here" | vercel env add OPENROUTER_API_KEY production

# 3. Deploy
vercel --prod --yes --force

# 4. Test by texting your agent!
```

---

## ⚠️ Important Notes:

- **Keep your API key secret** - never commit to git
- **Monitor your usage** - set up billing alerts on OpenRouter
- **Test locally first** before deploying to production
- **OpenRouter requires** HTTP-Referer header (already configured)

---

## 🔗 Quick Links:

- **OpenRouter Dashboard:** https://openrouter.ai/
- **API Keys:** https://openrouter.ai/keys
- **Credits:** https://openrouter.ai/credits
- **Models:** https://openrouter.ai/models
- **Docs:** https://openrouter.ai/docs

---

## ✅ What Changed:

1. ✅ Updated API endpoint to OpenRouter
2. ✅ Changed model to Claude 3.5 Sonnet
3. ✅ Added required OpenRouter headers
4. ✅ Updated environment variable from `OPENAI_API_KEY` to `OPENROUTER_API_KEY`

**Ready to deploy once you have your OpenRouter API key!** 🎉

