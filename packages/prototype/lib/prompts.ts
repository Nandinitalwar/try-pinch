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
  rewrite: {
    id: 'job-rewrite',
    kind: 'write',
    text: 'Rewrite this email so it sounds confident',
    mobileText: 'Rewrite this email confidently',
  },
  summarize: {
    id: 'job-summarize',
    kind: 'write',
    text: 'Summarize this article into five bullets',
    mobileText: 'Summarize this into five bullets',
  },
  explain: {
    id: 'job-explain',
    kind: 'learn',
    text: "Explain this like I'm smart but new to it",
    mobileText: "Explain this like I'm new to it",
  },
  plan: {
    id: 'job-plan',
    kind: 'plan',
    text: 'Plan my week in {city} around a $100 budget',
    mobileText: 'Plan my week in {city} on $100',
  },
  decide: {
    id: 'job-decide',
    kind: 'fun',
    text: 'Help me choose between these two options in {city}',
    mobileText: 'Help me choose between these in {city}',
  },
};

function planPrompt(ctx: Context): Prompt {
  if (ctx.dayKind === 'weekend') {
    return {
      ...JOBS.plan,
      text: 'Plan my weekend in {city} around a $100 budget',
      mobileText: 'Plan my weekend in {city} on $100',
    };
  }
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
  if (ctx.dayKind === 'weekend') {
    order = ['plan', 'decide', 'summarize', 'explain', 'rewrite'];
  } else if (ctx.timeBucket === 'earlyMorning' || ctx.timeBucket === 'morning') {
    order = ['rewrite', 'plan', 'explain', 'summarize', 'decide'];
  } else if (ctx.timeBucket === 'midday' || ctx.timeBucket === 'afternoon') {
    order = ['summarize', 'rewrite', 'decide', 'explain', 'plan'];
  } else if (ctx.timeBucket === 'evening' || ctx.timeBucket === 'night') {
    order = ['plan', 'decide', 'rewrite', 'summarize', 'explain'];
  } else {
    order = ['explain', 'decide', 'summarize', 'rewrite', 'plan'];
  }

  // The first frame makes the local context legible. The composer itself still
  // starts empty; this is only the first sentence that types into it.
  return ['plan', ...order.filter((key) => key !== 'plan')].map((key) => byId[key]);
}

export function renderPrompt(prompt: Prompt, ctx: Context): string {
  const raw = ctx.device === 'mobile' && prompt.mobileText ? prompt.mobileText : prompt.text;
  return raw.replace(/\{city\}/g, ctx.city);
}

/** The static chips in the control arm. */
export const CONTROL_CHIPS: { id: string; text: string; kind: PromptKind }[] = [
  { id: 'ctl-image', kind: 'make', text: 'Create image' },
  { id: 'ctl-summarize', kind: 'write', text: 'Summarize text' },
  { id: 'ctl-code', kind: 'learn', text: 'Code' },
  { id: 'ctl-advice', kind: 'fun', text: 'Get advice' },
  { id: 'ctl-more', kind: 'plan', text: 'More' },
];

export type { Device };

const LEDES: Record<string, string> = {
  lateNight: 'Still up?',
  earlyMorning: "What's first today?",
  morning: 'Where should we start?',
  midday: 'What are you in the middle of?',
  afternoon: 'What can I take off your plate?',
  evening: "What's tonight looking like?",
  night: 'How do you want to end the day?',
};

export function ledeFor(ctx: Context): string {
  return LEDES[ctx.timeBucket] ?? 'Where should we start?';
}
