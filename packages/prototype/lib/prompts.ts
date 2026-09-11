import type { Context, Device } from './context';

export type PromptKind = 'local' | 'make' | 'plan' | 'learn' | 'write' | 'fun';

export interface Prompt {
  id: string;
  kind: PromptKind;
  text: string;
  mobileText?: string;
}

/**
 * Five concrete jobs, not five vague capabilities. The carousel always shows
 * these same jobs so the experiment tests activation copy rather than novelty.
 * Context changes their order and naturally grounds planning/decision jobs in
 * the visitor's coarse city.
 */
const JOBS: Record<string, Prompt> = {
  rewrite: { id: 'astro-birth', kind: 'learn', text: 'Read my chart — born [date], [time], [city]' },
  summarize: { id: 'astro-today', kind: 'local', text: "What's my energy today?", mobileText: 'my energy today?' },
  explain: { id: 'astro-week', kind: 'plan', text: 'What should I know about this week?' },
  plan: { id: 'astro-decide', kind: 'fun', text: 'Should I go out tonight or stay in?' },
  decide: { id: 'astro-memory', kind: 'write', text: 'Remember that I have a big decision coming up' },
};

function planPrompt(ctx: Context): Prompt {
  return JOBS.plan;
}

/**
 * Context-aware means the page responds to the moment without pretending to
 * know a user's tastes. The order reflects the likely job right now:
 * mornings start with writing, work hours start with compression, evenings
 * start with planning, and late nights start with explanation. Every context
 * still exposes the same five measurable jobs.
 */
export function promptsFor(ctx: Context): Prompt[] {
  const plan = planPrompt(ctx);
  const byId: Record<string, Prompt> = { ...JOBS, plan };

  let order: string[];
  order = ctx.dayKind === 'weekend'
    ? ['summarize', 'plan', 'decide', 'rewrite', 'explain']
    : (ctx.timeBucket === 'evening' || ctx.timeBucket === 'night')
      ? ['plan', 'decide', 'summarize', 'rewrite', 'explain']
      : ['summarize', 'explain', 'rewrite', 'decide', 'plan'];

  // The first frame makes the local context legible. The composer itself still
  // starts empty; this is only the first sentence that types into it.
  return order.map((key) => byId[key]);
}

export function renderPrompt(prompt: Prompt, ctx: Context): string {
  const raw = ctx.device === 'mobile' && prompt.mobileText ? prompt.mobileText : prompt.text;
  return raw.replace(/\{city\}/g, ctx.city);
}

/** The static chips in the control arm. */
export const CONTROL_CHIPS: { id: string; text: string; kind: PromptKind }[] = [
  { id: 'ctl-chart', kind: 'learn', text: 'Read my chart' },
  { id: 'ctl-today', kind: 'local', text: "Today's energy" },
  { id: 'ctl-week', kind: 'plan', text: 'This week' },
  { id: 'ctl-decision', kind: 'fun', text: 'Help me decide' },
  { id: 'ctl-memory', kind: 'write', text: 'Save a memory' },
];

export type { Device };

const LEDES: Record<string, string> = {
  lateNight: 'the sky is loud tonight',
  earlyMorning: 'what are you carrying into today?',
  morning: 'what is the sky saying to you?',
  midday: 'where is your energy landing?',
  afternoon: 'what wants your attention?',
  evening: 'what is tonight asking for?',
  night: 'what are you ready to let go of?',
};

export function ledeFor(ctx: Context): string {
  return LEDES[ctx.timeBucket] ?? 'Where should we start?';
}
