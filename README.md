# TryPinch - SMS AI Astrologer

SMS-based AI astrologer bot built with Next.js, Twilio, OpenRouter, and Supabase.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **SMS Gateway**: Twilio (SMS/WhatsApp)
- **AI Provider**: OpenRouter (GPT-4o-mini)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel

## Features

- SMS/WhatsApp integration via Twilio webhooks
- Persistent conversation history in Supabase
- User profile extraction and storage (name, birth details, star sign)
- Rate limiting and security headers
- Development logging interface

## Setup

### Prerequisites

- Node.js 18+
- Twilio account with phone number
- OpenRouter API key
- Supabase project

### Environment Variables

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Installation

```bash
npm install
npm run dev
```

### Database Setup

Run SQL scripts in Supabase:
- `database/unified_schema.sql` - User profiles table
- `database/chat_messages.sql` - Chat history table

### Twilio Webhook Configuration

Set webhook URL in Twilio Console:
```
https://your-domain.vercel.app/api/webhook/twilio
Method: POST
```

## API Endpoints

- `POST /api/webhook/twilio` - Twilio SMS webhook handler
- `POST /api/chat` - AI chat completions
- `POST /api/sms` - Send SMS messages
- `GET /api/logs` - Development logs (dev only)
- `GET /logs` - Log viewer UI (dev only)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # AI chat endpoint
│   │   ├── webhook/twilio/route.ts # Twilio webhook handler
│   │   ├── sms/route.ts           # SMS sending
│   │   └── logs/route.ts          # Logging API
│   ├── logs/page.tsx              # Log viewer UI
│   └── page.tsx                   # Homepage
├── lib/
│   ├── supabase.ts               # User profile service
│   ├── chatStorage.ts            # Chat history persistence
│   ├── smsService.ts             # SMS utilities
│   └── logger.ts                 # Logging service
├── database/
│   ├── unified_schema.sql        # User profiles schema
│   └── chat_messages.sql         # Chat history schema
└── vercel.json                   # Vercel configuration
```

## Development

```bash
# Start dev server
npm run dev

# Test Supabase connection
npm run test:supabase

# View logs
open http://localhost:3000/logs
```

## Deployment

```bash
# Deploy to Vercel
npm run deploy

# Or via Vercel CLI
vercel --prod
```

Set environment variables in Vercel dashboard before deploying.

## Configuration

### AI Model

Edit `app/api/chat/route.ts`:
```typescript
model: 'openai/gpt-4o-mini' // OpenRouter model identifier
```

### System Prompt

Modify `systemPrompt` in `app/api/chat/route.ts` to customize AI behavior.

### Function Timeouts

Configured in `vercel.json`:
- Chat API: 30 seconds
- Other APIs: 10 seconds

## Testing

```bash
# Test Supabase integration
npm run test:supabase

# Test chat API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello", "history": []}'
```

## License

MIT
