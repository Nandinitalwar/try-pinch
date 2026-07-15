# Braintrust AI Observability Setup

This guide walks you through setting up Braintrust for AI observability in Pinch.

## What is Braintrust?

Braintrust is an AI observability platform that helps you:
- 📊 Monitor LLM calls (inputs, outputs, latency, tokens)
- 🔍 Track tool usage (web searches, function calls)
- 📈 Analyze conversation flows
- 🐛 Debug AI agent behavior
- 💰 Monitor costs and performance

## Prerequisites

1. A Braintrust account (sign up at https://www.braintrust.dev)
2. Your Vercel deployment (for production monitoring)

## Step 1: Create a Braintrust Account

1. Go to https://www.braintrust.dev
2. Sign up for a free account
3. Create a new project (e.g., "pinch-sms-astrologer")

## Step 2: Get Your API Key

1. In Braintrust dashboard, go to **Settings** → **API Keys**
2. Create a new API key
3. Copy the key (starts with `bt-`)

## Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Braintrust Configuration
BRAINTRUST_API_KEY=bt-your-api-key-here
BRAINTRUST_PARENT=project_name:pinch-sms-astrologer
```

The `BRAINTRUST_PARENT` format is `project_name:your-project-name`.

Also add them to Vercel:

```bash
vercel env add BRAINTRUST_API_KEY
vercel env add BRAINTRUST_PARENT
```

## Step 4: Verify Integration

1. Start your local dev server:
   ```bash
   npm run dev
   ```

2. Send a test message to your Twilio or SendBlue number

3. Check your terminal for Braintrust logs:
   ```
   [Braintrust] Logger initialized for project: pinch-sms-astrologer
   ```

4. Visit your Braintrust dashboard to see the logged data

## What Gets Logged

### Conversation Spans
Every SMS/iMessage conversation creates a span with:
- User phone number
- Message preview
- Response preview
- Total latency
- Error status (if any)

### LLM Calls
Every Gemini API call logs:
- Model name (`gemini-2.5-flash`)
- Input (user message + context)
- Output (AI response)
- Token usage (prompt, completion, total)
- Latency in milliseconds

### Tool Calls
Every tool usage logs:
- Tool name (e.g., `search_web`)
- Input parameters
- Output results
- Latency

## Viewing Your Data

1. Log in to https://www.braintrust.dev
2. Select your project
3. View:
   - **Logs** - All LLM calls and tool usage
   - **Traces** - Full conversation flows
   - **Analytics** - Performance metrics
   - **Costs** - Token usage and estimated costs

## Example Dashboard Views

### Conversation Trace
```
sms_conversation (2.3s)
├── task_decomposition (0.5s)
│   └── llm_call: gemini-2.5-flash
├── general_task_agent (1.5s)
│   ├── tool_call: search_web (0.8s)
│   └── llm_call: gemini-2.5-flash (0.7s)
└── memory_extraction (0.3s)
    └── llm_call: gemini-2.5-flash
```

### Metrics
- Average latency: 2.1s
- P95 latency: 4.5s
- Total tokens: 1,234
- Estimated cost: $0.003

## Debugging with Braintrust

### Finding Slow Requests
1. Go to **Logs** → Filter by latency > 5s
2. Click on a slow request to see the trace
3. Identify which step is slow (LLM call, tool call, etc.)

### Finding Errors
1. Go to **Logs** → Filter by error status
2. View error messages and stack traces
3. See the full context (input, conversation history)

### Analyzing User Patterns
1. Go to **Analytics** → Group by user
2. See which users have the most conversations
3. Identify common queries and patterns

## Best Practices

### 1. Use Descriptive Span Names
```typescript
startConversationSpan({
  name: 'sms_conversation', // Clear, descriptive name
  phoneNumber: fromNumber,
  userId: userId,
})
```

### 2. Add Metadata
```typescript
conversationSpan.log({
  metadata: {
    user_id: userId,
    has_profile: !!userProfile,
    memory_count: userMemories.length,
  }
})
```

### 3. Log Errors
```typescript
conversationSpan.log({
  error: error.message,
})
```

### 4. Flush Logs
```typescript
await flushBraintrust() // Ensure logs are sent before function exits
```

## Cost Considerations

- Braintrust has a generous free tier
- Logs are retained for 30 days on free tier
- Upgrade for longer retention and more features

## Troubleshooting

### Logs not appearing in dashboard

1. Check environment variables are set correctly
2. Verify API key is valid
3. Check Vercel logs for Braintrust errors
4. Ensure `flushBraintrust()` is called

### "Not configured" message

```
[Braintrust] Not configured - skipping observability
```

This means `BRAINTRUST_API_KEY` or `BRAINTRUST_PARENT` is missing.

### Logs delayed

Braintrust batches logs for efficiency. They may take a few seconds to appear in the dashboard.

## Next Steps

- Set up alerts for high latency or errors
- Create custom dashboards for your metrics
- Use Braintrust's evaluation features to test prompts
- Integrate with your CI/CD for automated testing

