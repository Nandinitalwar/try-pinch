# Pinch - SMS AI Astrologer

## Project Overview
SMS-based AI astrologer using Twilio webhooks + Google Gemini 2.5 Flash. Next.js 14 App Router deployed on Vercel.

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
- `/app/api/webhook/twilio/route.ts` - Main Twilio webhook handler
- `/lib/agents/agents/generalTaskAgent.ts` - Core AI agent with Gemini + tools
- `/lib/agents/taskDecomposer.ts` - Routes messages to appropriate agents

## Environment Variables
Required in `.env.local` and Vercel:
- `GOOGLE_AI_API_KEY` - Gemini API
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` - Twilio
- `EXA_API_KEY` - Web search via Exa AI
- Supabase keys for user storage

## Conventions
- System prompts live in `generalTaskAgent.ts`
- Tool definitions use Gemini's function calling format
- Always add new env vars to both `.env.local` AND Vercel (`vercel env add`)