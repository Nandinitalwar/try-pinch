# Pinch - SMS/iMessage AI Astrologer

## Project Overview
SMS and iMessage-based AI astrologer using:
- **Twilio** for SMS webhooks
- **SendBlue** for iMessage support
- **Google Gemini 2.5 Flash** for AI responses
- **Braintrust** for AI observability
- Next.js 14 App Router deployed on Vercel

## Key Commands
- `npm run dev` - Start local dev server (port 3000)
- `npm run build` - Build for production
- `vercel --prod` - Deploy to production

## Testing Workflow
Always test webhook changes locally before deploying:
```bash
curl -X POST "http://localhost:3000/api/webhook/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+15551234567" \
  -d "To=+18889211387" \
  -d "Body=YOUR_TEST_MESSAGE"
```

## Architecture
- `/app/api/webhook/twilio/route.ts` - Twilio SMS webhook handler
- `/app/api/webhook/sendblue/route.ts` - SendBlue iMessage webhook handler
- `/lib/agents/agents/generalTaskAgent.ts` - Core AI agent with Gemini + tools
- `/lib/agents/taskDecomposer.ts` - Routes messages to appropriate agents
- `/lib/sendblue.ts` - SendBlue API client for iMessage
- `/lib/messagingService.ts` - Unified messaging service (SMS + iMessage)
- `/lib/braintrust.ts` - Braintrust observability integration

## Environment Variables
Required in `.env.local` and Vercel:

### AI & Search
- `GOOGLE_AI_API_KEY` - Gemini API key
- `EXA_API_KEY` - Web search via Exa AI

### Messaging
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - Twilio SMS
- `SENDBLUE_API_KEY_ID`, `SENDBLUE_API_SECRET_KEY`, `SENDBLUE_FROM_NUMBER` - SendBlue iMessage

### Database
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Observability
- `BRAINTRUST_API_KEY` - Braintrust AI observability (get from https://www.braintrust.dev)
- `BRAINTRUST_PARENT` - Braintrust project name (e.g., `project_name:pinch-sms-astrologer`)

## Conventions
- System prompts live in `generalTaskAgent.ts`
- Tool definitions use Gemini's function calling format
- Always add new env vars to both `.env.local` AND Vercel (`vercel env add`)