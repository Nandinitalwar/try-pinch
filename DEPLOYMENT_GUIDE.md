# Deployment Guide

## Quick Deploy to Production

### Method 1: Using NPM Script (Recommended)
```bash
npm run deploy
```

### Method 2: Using Vercel CLI
```bash
# Install Vercel CLI globally (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Method 3: Git Push (Automatic)
If you have Vercel connected to your GitHub repository:
```bash
git add .
git commit -m "Deploy to production"
git push origin main
```
Vercel will automatically deploy when you push to the main branch.

---

## Environment Variables Setup

Make sure the following environment variables are set in your Vercel dashboard:

### Required Variables:
1. `OPENAI_API_KEY` - Your OpenAI API key
2. `TWILIO_ACCOUNT_SID` - Your Twilio account SID
3. `TWILIO_AUTH_TOKEN` - Your Twilio auth token
4. `TWILIO_PHONE_NUMBER` - Your Twilio phone number (format: +1234567890)
5. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
6. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### Setting Variables in Vercel:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable for **Production**, **Preview**, and **Development**

---

## Post-Deployment Checklist

### 1. Verify Environment Variables
```bash
vercel env ls
```

### 2. Check Deployment Status
Visit your deployment URL and verify the homepage loads.

### 3. Test API Endpoints
```bash
# Test chat endpoint
curl -X POST https://your-domain.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "history": []}'

# Test SMS endpoint (from Twilio webhook)
# Configure your Twilio webhook to: https://your-domain.vercel.app/api/webhook/twilio
```

### 4. Configure Twilio Webhook
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number
4. Under "Messaging Configuration":
   - Set "A MESSAGE COMES IN" webhook to: `https://your-domain.vercel.app/api/webhook/twilio`
   - Method: `POST`
5. Save

### 5. Test SMS Flow
Send a text message to your Twilio number and verify you get a response.

---

## Monitoring & Logs

### View Logs in Vercel Dashboard
1. Go to your project in Vercel
2. Click **Deployments**
3. Select your deployment
4. Click **Functions** tab
5. View logs for each API route

### View Logs in CLI
```bash
# Real-time logs
vercel logs --follow

# Logs for specific deployment
vercel logs [deployment-url]
```

### View Logs Locally (Development)
```bash
# Start dev server
npm run dev

# Visit logs page
open http://localhost:3000/logs
```

---

## Rollback (If Needed)

If something goes wrong, you can instantly rollback:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Deployments**
4. Find a previous working deployment
5. Click the three dots (**...**) → **Promote to Production**

Or via CLI:
```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel promote [deployment-url]
```

---

## Performance Optimization

### Function Timeouts
Already configured in `vercel.json`:
- Chat API: 30 seconds
- Other APIs: 10 seconds

### Rate Limiting
Configured in `app/api/chat/route.ts`:
- Production: 10 requests/minute per IP
- Development: 100 requests/minute per IP

---

## Troubleshooting

### Issue: Functions timing out
**Solution**: Check logs in Vercel dashboard. May need to increase `maxDuration` in `vercel.json`

### Issue: Environment variables not working
**Solution**: 
1. Verify variables are set in Vercel dashboard
2. Redeploy after adding new variables
3. Check variable names match exactly (case-sensitive)

### Issue: SMS not working
**Solution**:
1. Verify Twilio webhook URL is correct
2. Check webhook is set to POST method
3. View function logs for errors
4. Test webhook manually with Twilio Console

### Issue: Supabase connection errors
**Solution**:
1. Run `npm run test:supabase` locally to verify credentials
2. Check RLS policies in Supabase dashboard
3. Verify service role key (not anon key) is being used

---

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Twilio Documentation](https://www.twilio.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

