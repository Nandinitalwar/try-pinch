# Debugging Guide

## Viewing Logs

### Option 1: Web Interface (In-Memory Logs)
Visit: `https://your-domain.vercel.app/logs`

- Shows logs from current session
- Real-time updates (polls every second)
- Filter and search functionality
- **Note:** In production, logs are per-function invocation

### Option 2: Vercel Dashboard (Recommended for Production)
1. Go to: https://vercel.com/dashboard
2. Select your project: `ai_astrologer`
3. Click **Deployments** → Select latest deployment
4. Click **Functions** tab
5. Click on `api/webhook/twilio` to see logs

### Option 3: Vercel CLI
```bash
# Real-time logs
vercel logs --follow

# Logs for specific deployment
vercel logs [deployment-url]
```

## Troubleshooting Twilio Webhook

### 1. Check Webhook Configuration

**For SMS:**
1. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/active
2. Click your phone number
3. Verify **A MESSAGE COMES IN** webhook URL:
   ```
   https://aiastrologer-5qrcewwhl-nandinis-projects-49e34ec0.vercel.app/api/webhook/twilio
   ```
4. Method must be: **POST**

**For WhatsApp Sandbox:**
1. Go to: https://console.twilio.com/us1/develop/sms/senders/whatsapp-sandbox
2. Set webhook URL to the same endpoint
3. Method: **POST**

### 2. Test Webhook Manually

```bash
curl -X POST https://aiastrologer-5qrcewwhl-nandinis-projects-49e34ec0.vercel.app/api/webhook/twilio \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&Body=test&To=%2B18889211387"
```

### 3. Check Environment Variables

Verify all required variables are set in Vercel:
```bash
vercel env ls
```

Required:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 4. Common Issues

**Issue: No response from bot**
- Check Vercel function logs for errors
- Verify webhook URL is correct in Twilio Console
- Check if environment variables are set
- Verify OpenRouter API key is valid

**Issue: 401 Unauthorized**
- Twilio signature validation might be failing
- Check `TWILIO_AUTH_TOKEN` is correct

**Issue: 500 Internal Server Error**
- Check Vercel logs for stack trace
- Verify Supabase credentials
- Check OpenRouter API key and credits

**Issue: Timeout**
- Chat API has 30s timeout (configured in vercel.json)
- Check if OpenRouter is responding
- Verify network connectivity

### 5. Debug Checklist

- [ ] Webhook URL is correct in Twilio Console
- [ ] Webhook method is POST
- [ ] All environment variables are set in Vercel
- [ ] Vercel deployment is successful
- [ ] Phone number is correct format (+18889211387)
- [ ] OpenRouter API key is valid
- [ ] Supabase credentials are correct
- [ ] Check Vercel function logs for errors

## Testing Locally

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Use ngrok to expose local server:
   ```bash
   ngrok http 3000
   ```

3. Update Twilio webhook to ngrok URL:
   ```
   https://your-ngrok-url.ngrok.io/api/webhook/twilio
   ```

4. View logs at: http://localhost:3000/logs

## Monitoring

### Vercel Dashboard
- Real-time function invocations
- Error rates
- Response times
- Log streaming

### Twilio Console
- Message logs
- Webhook delivery status
- Error codes

### Supabase Dashboard
- Database queries
- User profiles
- Chat messages

