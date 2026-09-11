# Claude handoff: dynamic logged-out ChatGPT onboarding prototype

## Goal

Continue the prototype at `packages/prototype`. The product idea is a better
logged-out ChatGPT first-run experience: instead of a blank “Ask anything”
composer, show a contextual sentence that types in, pauses, erases, and cycles
through the next sentence. Context is coarse time/device/city context.

Important design correction from the user: the centerpiece must **not** be a
colorful orb. It is the existing ChatGPT knot/logo mark, solid white in the dark
experience, with a single slow rotation and no bounce, breathing, parallax, or
color sweep. Keep the mark recognizable and monochrome/ChatGPT-like.

## What is already implemented

- Next.js 14 App Router prototype, no API key or model call required.
- Local dev server runs at `http://localhost:3006`.
- `/?v=bloom` is the kinetic/contextual treatment.
- `/?v=control` is the static control arm with category chips.
- Canned responses make the demo deterministic.
- Five concrete job prompts, ordered by weekday/weekend, time bucket, and device.
- Placeholder text types, pauses, erases, then advances to the next job.
- The hero ChatGPT mark follows the cursor slightly and supports a short drag spin.
- “Use this suggestion” sends the active prompt into the canned conversation.
- Dev panel can switch arm, theme, device, time zone, weekday, and hour.
- `/api/context` optionally reads coarse Vercel edge city/region/country data.
  Localhost falls back to the browser IANA timezone; no geolocation permission,
  raw IP, or precise coordinates are exposed to the client.
- Analytics events are recorded in the dev panel, including onboarding viewed,
  carousel started, prompt clicked, composer focused, first message sent,
  answer completed, share opened/copied, and signup clicked.
- Share-card prototype is included after the first answer.

## Files to inspect

- `app/page.tsx` — page state, context loading, prompt carousel, hero markup,
  sending, analytics, A/B switch.
- `components/ChatGPTMark.tsx` — inline SVG ChatGPT knot with slow rotation.
- `app/globals.css` — `.mark` and `.kinetic-mark` styles.
- `app/icon.svg` — ChatGPT knot favicon.
- `components/Shell.tsx` — uses the same mark for the small assistant avatar.
- `lib/context.ts` — timezone/device/coarse-city context derivation.
- `lib/prompts.ts` — contextual prompt catalog and mobile variants.
- `lib/usePromptCarousel.ts` — prompt rotation timing/state.
- `lib/useTypewriter.ts` — reusable character reveal hook.
- `lib/track.ts` — analytics event names and payloads.
- `components/Composer.tsx` — dynamic placeholder is rendered here.
- `README.md` — product rationale, experiment description, commands, guardrails.
- `PR_NOTES.md` — PR summary and review notes.

## Commands

```bash
cd /Users/nandinitalwar/trypinch
npm run dev:prototype
# open http://localhost:3006
npm run check -w pinch-prototype
npm run build:prototype
```

## Copy/paste prompt for Claude

You are continuing a local Next.js prototype in
`/Users/nandinitalwar/trypinch/packages/prototype`.

Read `packages/prototype/README.md`, `packages/prototype/PR_NOTES.md`, and the
components/libs listed above before editing. Preserve the existing contextual
prompt behavior, A/B control arm, canned responses, analytics, share card, and
port 3006 setup.

The visual centerpiece is now a recognizable ChatGPT knot/logo mark in
`components/ChatGPTMark.tsx`. Keep it solid, slowly rotating, code-native SVG/React,
and accessible with an appropriate label or `aria-hidden` where decorative. It can
follow the cursor and accept a short drag spin, but do not
reintroduce an orb, sphere, four gradient blobs, or a generic abstract circle.

Make the ChatGPT mark dynamic but restrained: use a slow, continuous rotation plus
a subtle cursor-following tilt and short drag gesture. It should remain
legible at desktop and mobile sizes, work in dark and light themes, and honor
`prefers-reduced-motion`. Keep the dynamic typewriter placeholder exactly as it
works now: location/time/device-aware sentences type in, pause, erase, and
cycle. Do not request browser geolocation or expose raw IP/coordinates.

Recommended implementation:

1. Preserve `ChatGPTMark.tsx` and its faithful knot SVG.
2. Keep the hero and avatar using the new mark.
3. Keep `.kinetic-mark` and `.mark` CSS free of bounce, pulse, and color-sweep
   effects; cursor interaction should be small and direct.
4. Update the small `Avatar` in `components/Shell.tsx` to use the same mark if
   visually consistent.
5. Update `app/icon.svg`, README, and PR notes so they no longer describe the
   centerpiece as an orb.
6. Run the check and production build, then visually verify both
   `http://localhost:3006/?v=bloom` and `?v=control`.

Acceptance criteria:

- No orb visuals remain in the user-facing prototype.
- The ChatGPT logo is clearly recognizable and is the animated centerpiece.
- Contextual typewriter prompts still cycle and can be clicked/sent.
- Control arm remains a valid baseline.
- Port remains 3006.
- Checks/build pass with no TypeScript or lint errors.
- Reduced-motion users get a static logo and no rapid animation.
