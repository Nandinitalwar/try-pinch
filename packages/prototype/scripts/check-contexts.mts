/**
 * Smoke check for the context engine — run with `npm run check` (Node's native
 * type stripping, no test framework in a prototype).
 */
import assert from 'node:assert/strict';
import { cityFromTimeZone, deriveContext, timeBucketFor, WEEKDAYS } from '../lib/context.ts';
import { promptsFor, renderPrompt } from '../lib/prompts.ts';

const at = (weekday: string, hour: number, timeZone = 'America/Los_Angeles') =>
  deriveContext({ now: new Date(), timeZone, device: 'desktop', overrides: { weekday, hour } });

// Friday after work is emotionally the weekend, and the prompts have to agree.
assert.equal(at('Friday', 19).dayKind, 'weekend');
assert.equal(at('Friday', 11).dayKind, 'weekday');
assert.equal(at('Saturday', 11).dayKind, 'weekend');
assert.equal(at('Tuesday', 2).timeBucket, 'lateNight');
assert.equal(timeBucketFor(0), 'lateNight');
assert.equal(timeBucketFor(23), 'night');

// Unknown timezones still produce something sayable rather than "undefined".
assert.equal(cityFromTimeZone('America/Los_Angeles'), 'San Francisco');
assert.equal(cityFromTimeZone('America/Argentina/Buenos_Aires'), 'Buenos Aires');
assert.equal(cityFromTimeZone(''), 'your area');
assert.equal(
  deriveContext({
    now: new Date(),
    timeZone: 'America/Los_Angeles',
    device: 'desktop',
    cityOverride: 'Oakland',
  }).city,
  'Oakland',
);

// Every reachable context must expose the same five measurable jobs, with no
// unrendered token. Context changes their order and plan wording.
let checked = 0;
for (const weekday of WEEKDAYS) {
  for (let hour = 0; hour < 24; hour++) {
    const ctx = at(weekday, hour);
    const prompts = promptsFor(ctx);
    assert.equal(prompts.length, 5, `${ctx.key} has ${prompts.length} prompts`);
    assert.deepEqual(
      prompts.map((prompt) => prompt.id).sort(),
      ['job-decide', 'job-explain', 'job-plan', 'job-rewrite', 'job-summarize'],
    );
    for (const p of prompts) {
      for (const device of ['desktop', 'mobile'] as const) {
        const text = renderPrompt(p, { ...ctx, device });
        assert.ok(!text.includes('{'), `unrendered token in ${p.id}: ${text}`);
        assert.ok(text.length > 8 && text.length < 72, `bad length for ${p.id}: ${text.length}`);
      }
    }
    checked++;
  }
}

const morning = promptsFor(at('Monday', 9)).map((prompt) => prompt.id);
const evening = promptsFor(at('Monday', 19)).map((prompt) => prompt.id);
assert.notDeepEqual(morning, evening, 'context should change prompt order');
const saturday = at('Saturday', 11);
const weekendPlan = promptsFor(saturday).find((prompt) => prompt.id === 'job-plan');
assert.ok(weekendPlan);
assert.equal(renderPrompt(weekendPlan, saturday), 'Plan my weekend in San Francisco around a $100 budget');

console.log(`ok — ${checked} weekday/hour combinations, each has 5 concrete jobs`);
