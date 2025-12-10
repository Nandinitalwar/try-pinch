# Pinch - SMS AI Astrologer

Lean SMS-based AI astrologer bot. Receives Twilio webhooks and responds via Google Gemini 2.5 Flash API.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **SMS Gateway**: Twilio webhooks
- **AI Provider**: Google Gemini 2.5 Flash
- **Memory**: In-memory storage (ephemeral, per serverless instance)
- **Hosting**: Vercel

## Memory Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User sends SMS: "what's my horoscope?"                         │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Webhook receives message                                        │
│  - Normalizes phone number                                      │
│  - Gets/Creates user ID                                          │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Load Conversation History (last 10 messages)                   │
│  messagesByUser.get(userId) → [msg1, msg2, ..., msg10]         │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Save User Message to Memory                                    │
│  messagesByUser.set(userId, [...existing, newUserMsg])         │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Pass to InteractionAgent                                       │
│  AgentContext {                                                 │
│    userId,                                                      │
│    phoneNumber,                                                 │
│    conversationHistory: [                                       │
│      {role: 'user', content: 'previous msg'},                  │
│      {role: 'assistant', content: 'previous response'},         │
│      {role: 'user', content: 'what's my horoscope?'}           │
│    ]                                                            │
│  }                                                              │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agents Use History                                             │
│  - TaskDecomposer: Analyzes with context                       │
│  - GeneralTaskAgent: Calls Gemini with full history             │
│  - Gemini API: Receives conversation history                    │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Save AI Response to Memory                                     │
│  messagesByUser.set(userId, [...existing, newAiMsg])           │
└──────────────────────┬──────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Return Response to User via TwiML                               │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Next SMS arrives                                                │
│  → Loads updated history (now includes previous exchange)        │
│  → Process with full context                                    │
│  → Save new exchange                                            │
│  → Repeat...                                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Memory Storage:**
- `messagesByUser`: Map<userId, ChatMessage[]> - All messages per user
- `sessionByUser`: Map<userId, sessionId> - Current session tracking
- `usersByPhone`: Map<phoneNumber, userId> - User identity mapping

**Note:** Memory is in-memory only (ephemeral). Lost on server restart/cold start.

## Setup

### Environment Variables

```env
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

### Installation

```bash
npm install
npm run dev
```

### Database Setup

Run `database/unified_schema.sql` in Supabase to create the `users` and `chats` tables.

### Twilio Webhook Configuration

Set webhook URL in Twilio Console:
```
https://your-domain.vercel.app/api/webhook/twilio
Method: POST
```

## API Endpoints

- `POST /api/webhook/twilio` - Twilio webhook handler (main endpoint)

## Project Structure

```
├── app/
│   ├── api/
│   │   └── webhook/twilio/route.ts  # Twilio webhook → Gemini
│   └── page.tsx                      # Simple homepage
├── lib/
│   ├── supabase.ts                  # Supabase client
│   ├── chatStorage.ts               # User & chat persistence (in-memory)
│   ├── agents/
│   │   ├── interactionAgent.ts      # Main orchestrator
│   │   ├── taskDecomposer.ts        # Task analysis
│   │   ├── executionAgent.ts        # Base agent class
│   │   └── agents/
│   │       └── generalTaskAgent.ts  # General query handler
│   └── logger.ts                    # Simple console logger
├── database/
│   └── unified_schema.sql           # Database schema
└── vercel.json                      # Vercel configuration
```

## Deployment

```bash
vercel --prod
```

Set environment variables in Vercel dashboard before deploying.

## License

MIT
