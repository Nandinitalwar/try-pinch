# SendBlue iMessage Integration Setup

This guide walks you through setting up SendBlue for iMessage support in Pinch.

## What is SendBlue?

SendBlue is an iMessage API service that allows you to send and receive iMessages programmatically. It provides:
- ✅ iMessage support with SMS fallback
- ✅ RCS messaging for Android
- ✅ Webhooks for receiving messages
- ✅ Read receipts and typing indicators
- ✅ Group messaging support

## Prerequisites

1. A SendBlue account (sign up at https://sendblue.co)
2. A SendBlue phone number (provisioned through their dashboard)
3. Your Vercel deployment URL (for webhook configuration)

## Step 1: Get SendBlue Credentials

1. Log in to your SendBlue dashboard
2. Navigate to **Settings** → **API Keys**
3. Copy your:
   - `API Key ID` (sb-api-key-id)
   - `API Secret Key` (sb-api-secret-key)
4. Note your SendBlue phone number (E.164 format, e.g., `+15551234567`)

## Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```bash
# SendBlue Configuration
SENDBLUE_API_KEY_ID=your_api_key_id_here
SENDBLUE_API_SECRET_KEY=your_api_secret_key_here
SENDBLUE_FROM_NUMBER=+15551234567
```

Also add them to Vercel:

```bash
vercel env add SENDBLUE_API_KEY_ID
vercel env add SENDBLUE_API_SECRET_KEY
vercel env add SENDBLUE_FROM_NUMBER
```

## Step 3: Configure SendBlue Webhook

1. In your SendBlue dashboard, go to **Settings** → **Webhooks**
2. Add a new webhook for **Receive** events:
   - URL: `https://your-app.vercel.app/api/webhook/sendblue`
   - Type: `receive`
3. (Optional) Add a webhook secret for security

## Step 4: Test the Integration

### Local Testing

1. Start your local dev server:
   ```bash
   npm run dev
   ```

2. Use ngrok or similar to expose your local server:
   ```bash
   ngrok http 3000
   ```

3. Update your SendBlue webhook URL to the ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/api/webhook/sendblue
   ```

4. Send a test iMessage to your SendBlue number

### Production Testing

1. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

2. Send an iMessage to your SendBlue number
3. Check Vercel logs to see the webhook being processed

## Step 5: Verify Braintrust Logging

If you have Braintrust configured, you should see:
- Conversation spans for each iMessage interaction
- LLM call logs with input/output
- Tool call logs for web searches
- Metrics like latency and token usage

Visit https://www.braintrust.dev to view your logs.

## How It Works

1. **Incoming iMessage** → SendBlue receives it
2. **Webhook** → SendBlue POSTs to `/api/webhook/sendblue`
3. **Processing** → Your app processes with AI agent
4. **Response** → App sends response via SendBlue API
5. **Delivery** → User receives iMessage (or SMS fallback)

## Message Flow

```
User (iMessage) 
    ↓
SendBlue (receives)
    ↓
Your App (webhook)
    ↓
AI Agent (processes)
    ↓
SendBlue API (sends)
    ↓
User (receives iMessage)
```

## Fallback Behavior

- If SendBlue is not configured, the app falls back to Twilio (SMS only)
- If an iMessage fails, SendBlue automatically falls back to SMS
- Both services can run simultaneously for maximum coverage

## Troubleshooting

### Webhook not receiving messages

1. Check your webhook URL is correct in SendBlue dashboard
2. Verify your Vercel deployment is live
3. Check Vercel logs for errors
4. Ensure your SendBlue number is active

### Messages not sending

1. Verify environment variables are set correctly
2. Check SendBlue API key permissions
3. Ensure `from_number` matches your SendBlue number
4. Check Vercel logs for API errors

### iMessage not working (falls back to SMS)

1. Verify the recipient has iMessage enabled
2. Check SendBlue dashboard for service status
3. Ensure your SendBlue line supports iMessage (not all do)

## Cost Considerations

- SendBlue charges per message (check their pricing)
- iMessages are typically cheaper than SMS
- Consider setting up rate limiting for production

## Next Steps

- Set up Braintrust for AI observability (see `BRAINTRUST_SETUP.md`)
- Configure Twilio as SMS fallback (see main README)
- Test group messaging features
- Implement read receipts and typing indicators

