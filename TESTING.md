# Testing SendBlue iMessage Integration

## Quick Start

### 1. Start the Dev Server

```bash
cd packages/api
npm run dev
```

The server will start on `http://localhost:3000`

### 2. Test the SendBlue Webhook (Without SendBlue Account)

You can test the webhook endpoint even without SendBlue credentials:

```bash
./test-sendblue.sh
```

This simulates an incoming iMessage and tests your webhook processing.

**What to expect:**
- ✅ Webhook receives the message
- ✅ AI agent processes it
- ✅ Response is generated
- ⚠️ Response won't actually send (no SendBlue credentials)
- ✅ You'll see the full flow in terminal logs

### 3. Test with Real SendBlue (Requires Account)

#### Step 1: Get SendBlue Credentials

1. Sign up at https://sendblue.co
2. Get your API credentials from Settings → API Keys
3. Provision a phone number

#### Step 2: Add Credentials to `.env.local`

Edit `packages/api/.env.local`:

```bash
SENDBLUE_API_KEY_ID=your_actual_api_key_id
SENDBLUE_API_SECRET_KEY=your_actual_api_secret_key
SENDBLUE_FROM_NUMBER=+1234567890  # Your SendBlue number
```

#### Step 3: Expose Local Server with ngrok

```bash
# Install ngrok if you haven't
brew install ngrok

# Expose your local server
ngrok http 3000
```

You'll get a URL like: `https://abc123.ngrok.io`

#### Step 4: Configure SendBlue Webhook

1. Go to SendBlue dashboard → Settings → Webhooks
2. Add webhook URL: `https://abc123.ngrok.io/api/webhook/sendblue`
3. Select event type: `receive`

#### Step 5: Send a Real iMessage

Send an iMessage to your SendBlue number from your iPhone!

**Example messages to try:**
- "Hey Pinch, should I take a sick day tomorrow?"
- "What should I eat for dinner?"
- "Tell me about my day"

## Testing Checklist

- [ ] Dev server starts without errors
- [ ] Test webhook responds with 200 OK
- [ ] AI agent processes messages
- [ ] Responses are generated
- [ ] SendBlue credentials configured (optional)
- [ ] Real iMessages work (requires SendBlue account)
- [ ] Braintrust logs appear (requires Braintrust account)

## Troubleshooting

### "SendBlue not configured" message

This is normal if you haven't added SendBlue credentials yet. The app will still work, it just won't send responses via iMessage.

### Webhook returns 500 error

Check the terminal logs for the specific error. Common issues:
- Missing environment variables (Gemini API key, Supabase, etc.)
- Database connection issues
- AI agent errors

### Messages not sending

1. Verify SendBlue credentials are correct
2. Check SendBlue dashboard for API errors
3. Ensure `from_number` matches your SendBlue number
4. Check terminal logs for SendBlue API responses

## What Gets Logged

When you test, you'll see logs like:

```
[SendBlue][+15551234567] Incoming: "Hey Pinch, should I take a sick day tomorrow?"
[SendBlue] Service: iMessage, Status: RECEIVED
[SendBlue][+15551234567] Processing combined message: "Hey Pinch, should I take a sick day tomorrow?"
[SendBlue][+15551234567] History count: 0
[SendBlue][+15551234567] Sending 1 message(s)
[SendBlue][+15551234567] Message sent: msg-abc123
```

## Advanced Testing

### Test with curl

```bash
curl -X POST "http://localhost:3000/api/webhook/sendblue" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hey Pinch, what should I do today?",
    "is_outbound": false,
    "status": "RECEIVED",
    "from_number": "+15551234567",
    "number": "+15551234567",
    "to_number": "+18889211387",
    "service": "iMessage",
    "message_handle": "test-123",
    "date_sent": "2024-01-01T00:00:00Z",
    "date_updated": "2024-01-01T00:00:00Z",
    "accountEmail": "test@example.com",
    "error_code": null,
    "error_message": null,
    "error_reason": null,
    "error_detail": null,
    "was_downgraded": false,
    "plan": "blue",
    "media_url": "",
    "message_type": "message",
    "group_id": "",
    "participants": [],
    "send_style": "invisible",
    "opted_out": false,
    "sendblue_number": null,
    "group_display_name": null
  }'
```

### Test Twilio Webhook (SMS)

```bash
curl -X POST "http://localhost:3000/api/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567" \
  -d "To=+18889211387" \
  -d "Body=Hey Pinch, should I take a sick day?"
```

## Next Steps

Once local testing works:

1. Deploy to Vercel: `vercel --prod`
2. Add environment variables to Vercel
3. Update SendBlue webhook to production URL
4. Test with real iMessages!

