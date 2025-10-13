# AstroWorld SMS API Setup

This application has been converted to a lean backend-only SMS service that uses Twilio to provide astrology insights via text messages.

## Quick Setup

1. **Environment Variables**: Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

2. **Required API Keys**:
   - **Twilio**: Get your Account SID, Auth Token, and phone number from [Twilio Console](https://console.twilio.com)
   - **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

3. **Twilio Webhook Configuration**:
   - In your Twilio Console, go to Phone Numbers > Manage > Active numbers
   - Click on your Twilio phone number
   - Set the webhook URL for incoming messages to: `https://your-domain.com/api/webhook/twilio`
   - Set HTTP method to `POST`

4. **Deploy and Test**:
   ```bash
   npm run build
   npm run start
   ```

## How It Works

1. **User texts your Twilio number** → Twilio sends webhook to `/api/webhook/twilio`
2. **Webhook processes message** → Calls `/api/chat` for AI response
3. **AI generates astrology response** → Sent back via SMS using `/api/sms`
4. **Conversation state maintained** → In-memory storage (use Redis/DB for production)

## Endpoints

- `POST /api/webhook/twilio` - Receives incoming SMS from Twilio
- `POST /api/sms` - Sends outgoing SMS messages
- `POST /api/chat` - AI chat completions (SMS-optimized)
- `GET /` - API documentation

## Example Conversation

```
User: "What's my horoscope for today?"
AI: "hey! what's your sign? i'd love to give you a personalized reading ✨"

User: "I'm a Leo"
AI: "perfect! leos are feeling extra confident today. great time for creative projects and showing your leadership skills. what's on your mind? 🦁"
```

## Production Notes

- Replace in-memory conversation storage with Redis or database
- Enable Twilio signature validation in production
- Monitor rate limits and costs
- Consider implementing user profiles storage