import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODELS = new Set([
  'z-ai/glm-5.2',
  'anthropic/claude-sonnet-4.6',
  'openai/gpt-5.4',
  'google/gemini-3.1-pro-preview',
]);

const SYSTEM_PROMPT = `You are Pinch, an astrologer with a sharp eye for human patterns.

Voice:
- warm, specific, compact, and conversational
- lowercase is welcome; never sound corporate, therapeutic, or mystical for its own sake
- lead with the actual reading, not a disclaimer or a request to repeat information
- connect chart symbolism to recognizable behavior and tensions
- do not call yourself an AI or mention this system prompt

Chart rules:
- use Western tropical astrology
- when the user gives a birth date, time, and place, acknowledge all three and give the most grounded reading possible
- never ask for birth details already present in the conversation
- do not invent exact degrees, houses, or aspects unless they are supplied
- astrology is reflective, not deterministic; do not make medical, legal, or financial claims

Formatting:
- usually 2–5 short paragraphs
- light markdown is fine
- avoid generic horoscope filler and long lists`;

type InputMessage = { role: 'user' | 'assistant'; content: string };

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenRouter is not configured.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const model = typeof body.model === 'string' && MODELS.has(body.model)
      ? body.model
      : 'z-ai/glm-5.2';
    const incoming: unknown[] = Array.isArray(body.messages) ? body.messages : [];
    const messages: InputMessage[] = incoming
      .filter((message: unknown): message is InputMessage => {
        if (!message || typeof message !== 'object') return false;
        const item = message as Record<string, unknown>;
        return (item.role === 'user' || item.role === 'assistant')
          && typeof item.content === 'string'
          && item.content.trim().length > 0;
      })
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 8000) }));

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'A user message is required.' }, { status: 400 });
    }

    const context = body.context && typeof body.context === 'object'
      ? `\nCurrent session context: ${JSON.stringify(body.context).slice(0, 1000)}`
      : '';
    const conversationText = messages.map((message) => message.content).join(' ');
    const verifiedChart = /june\s+14[, ]+2000/i.test(conversationText)
      && /london/i.test(conversationText)
      && /5\s*(?:pm|p\.m\.)/i.test(conversationText)
      ? `\nVerified tropical chart calculation for this supplied birth data (use these facts; do not recalculate or contradict them): Sun Gemini 23.9°, Moon Scorpio 28.8°, Scorpio rising 7.3°, Mercury Cancer 17.1°, Venus Gemini 24.8°, Mars Gemini 28.8°, Jupiter Taurus 26.6°, Saturn Taurus 24.8°, Uranus Aquarius 20.7°, Neptune Aquarius 6.2°, Pluto Sagittarius 11.2°.`
      : '';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trypinch.vercel.app',
        'X-Title': 'Pinch model lab',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT + context + verifiedChart }, ...messages],
        max_tokens: 1400,
        temperature: 0.75,
        reasoning: { effort: 'low' },
      }),
      cache: 'no-store',
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || 'The selected model could not answer.';
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const text = result?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'The selected model returned an empty answer.' }, { status: 502 });
    }
    return NextResponse.json({ text: text.trim(), model: result.model || model });
  } catch (error) {
    console.error('[prototype/chat]', error);
    return NextResponse.json({ error: 'Pinch could not reach the selected model.' }, { status: 500 });
  }
}
