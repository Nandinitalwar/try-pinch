# PR 1: Turn the blank box into a contextual first prompt

## Why

Logged-out visitors are asked to invent a use case before they have seen value. The
highest-leverage activation change is to make the first useful prompt part of the
landing experience.

## Hypothesis

For logged-out web and mobile visitors, a composer that cycles through five
concrete jobs in an order based on local time, day, and device class will increase
first-message send rate and reduce time to first message compared with “Ask anything.”

## What changes

- Adds a slowly rotating, cursor-interactive ChatGPT mark above a placeholder that
  types, pauses, erases, and advances through five concrete jobs.
- Uses time/day/device context to order and lightly adapt the jobs; it does not
  force awkward location copy or ask for location permission.
- Keeps one suggestion visible at a time and offers a one-click send action.
- Preserves the blank composer for people who already know what they want.
- Adds a control arm, forced context controls, desktop/phone previews, dark/light
  themes, and an event log for review.

## Measurement

Primary: first-message send rate per logged-out landing session.

Secondary: prompt CTR, composer focus rate, time to first message, answer completion,
D1/D7 return rate, and signup conversion.

Roll out as a 50/50 logged-out experiment. Segment by device and context bucket, and
keep signup conversion as the guardrail. A click alone is not success; the activation
event is a sent first message.

## Risks

- Wrong local copy feels creepier than generic copy. Keep location coarse and fall
  back cleanly when timezone mapping is unknown.
- Animation can delay intent. Respect reduced-motion settings and keep the composer
  immediately usable.
- Contextual prompts can overfit novelty. Judge D1/D7 alongside first-send lift.

# PR 2: Make good answers travel as artifacts

## Why

Screenshots and copied text lose attribution and provide no clean return path. A useful
answer should leave ChatGPT as a legible artifact with a link back to the originating
experience.

## Hypothesis

For high-signal answer categories, a one-tap branded card will increase completed
shares and referred sessions compared with the existing copy/share path.

## What changes

- Adds “Share this answer” after answer completion.
- Distills the response into a question, headline, three useful beats, and a deep link.
- Supports copy-link and copy-text actions in the prototype.
- Pairs the referred landing experience with PR 1 so acquired visitors do not arrive
  at another blank box.

## Measurement

Primary: completed shares per eligible answer.

Secondary: share-sheet opens, views per share, referred first-message rate, referred
signup rate, and K-factor. Limit initial eligibility to self-expression, practical
guidance, and writing answers where the source research shows strong satisfaction.

## Sequencing

Ship PR 1 first. PR 2 can create more top-of-funnel visits, but contextual activation
is what keeps those visits from bouncing. The localhost prototype keeps both visible so
the compounding loop is easy to review without coupling their production rollouts.
