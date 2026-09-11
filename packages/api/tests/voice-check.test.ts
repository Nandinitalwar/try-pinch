import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRewritePrompt,
  checkActivationReply,
  checkFirstChartIntroduction,
  checkRepetition,
  checkTimeCoherence,
  checkVoice,
  matchCasing,
} from '../lib/voiceCheck'

test('activation guard requires the exact missing onboarding inputs', () => {
  assert.deepEqual(
    checkActivationReply(
      "what should i call you, and what's your birth date, exact birth time, and birth city?",
      'collect-name-and-birth',
    ),
    [],
  )
  assert.ok(
    checkActivationReply('when were you born?', 'collect-name-and-birth')
      .some(violation => violation.kind === 'onboarding_miss'),
  )
  assert.deepEqual(checkActivationReply('what should i call you?', 'collect-name'), [])
  assert.ok(checkActivationReply('tell me your name and birthday', 'collect-name').length > 0)
})

test('local-time guard rejects random early sleep advice', () => {
  assert.ok(checkTimeCoherence('go to bed. deal with it tomorrow.', 'what should i do today?', 16).length > 0)
  assert.deepEqual(checkTimeCoherence('go to bed.', 'what should i do today?', 22), [])
  assert.deepEqual(checkTimeCoherence('go to bed.', "i'm exhausted, what should i do?", 16), [])
  assert.ok(checkTimeCoherence('go out for breakfast after sunrise.', 'Nandini', 17).length > 0)
  assert.ok(checkTimeCoherence('get lunch somewhere pretty.', 'Nandini', 17).length > 0)
})

test('production voice guard catches machine-written punctuation and filler', () => {
  const violations = checkVoice("Here's the thing — you should lean into it.")
  const kinds = violations.map(violation => violation.kind)
  assert.ok(kinds.includes('ai_tell'))
  assert.ok(kinds.includes('banned_phrase'))
})

test('production voice guard catches inflected therapy filler', () => {
  const violations = checkVoice('you keep holding space for everyone else.')
  assert.ok(violations.some(violation => violation.kind === 'banned_phrase'))
})

test('production voice guard catches vague decision handoffs', () => {
  const violations = checkVoice('If your gut says rest, listen to it.')
  assert.ok(violations.some(violation => violation.kind === 'hedge'))
  assert.ok(checkVoice('Just go with your gut.').some(violation => violation.kind === 'hedge'))
})

test('production voice guard catches bare chart dumps', () => {
  const violations = checkVoice('Pisces Sun, Leo Moon, Capricorn rising.')
  assert.ok(violations.some(violation => violation.detail.includes('sign-placement recitation')))
})

test('first-chart guard rejects a daily forecast with no onboarding read', () => {
  const rejectedBadDraft =
    "you're already buzzing this morning, so don't cram too much in. you'll burn out by lunch."
  const violations = checkFirstChartIntroduction(rejectedBadDraft)
  assert.ok(violations.some(violation => violation.detail.includes('does not introduce the chart')))
})

test('first-chart guard accepts a brief personality pattern and problem', () => {
  const violations = checkFirstChartIntroduction(
    "your chart is here. you're the person who can walk into a stalled room, spot the interesting angle, and get everyone moving again. your blind spot is leaving the second repetition replaces novelty, so good ideas rarely get enough time to become real.",
  )
  assert.deepEqual(violations, [])
})

test('first-chart guard accepts a natural attachment caption', () => {
  const violations = checkFirstChartIntroduction(
    "here it is. you're the person who can walk into a stalled room, spot the interesting angle, and get everyone moving again. your blind spot is leaving the second repetition replaces novelty, so good ideas rarely get enough time to become real.",
  )
  assert.deepEqual(violations, [])
})

test('first-chart guard permits a forecast after the onboarding read when requested', () => {
  const violations = checkFirstChartIntroduction(
    "make the call before lunch and leave it alone. the pressure on your decision-making peaks today, and reopening it tonight only creates noise. your chart is attached so you can see what i'm reading.",
    { answerRequested: true },
  )
  assert.deepEqual(violations, [])
})

test('first-chart guard rejects a reveal that puts the attachment before the answer', () => {
  const violations = checkFirstChartIntroduction(
    "here's your chart. you're someone who leaps first, then gets totally stuck in the weeds later. right now, just finish what you've started instead of getting distracted by something new.",
    { answerRequested: true },
  )
  assert.ok(violations.some(violation => violation.detail.includes('opens with the attachment')))
})

test('first-chart guard rejects canned activation slop and requires the photo', () => {
  const canned = checkFirstChartIntroduction(
    "your chart is attached, here it is. when something matters, you move fast and keep working until it's solid. your blind spot is obsessing over details, which wastes time. today, finish what you started.",
    { answerRequested: true, visualContext: 'A giant satin bow and a fearless pose.', historicalYear: 2014 },
  )
  assert.ok(canned.some(violation => violation.detail.includes('canned')))
  assert.ok(canned.some(violation => violation.detail.includes('ignores the image')))

  const specific = checkFirstChartIntroduction(
    "no, 2014 was the first draft, not the peak. the giant bow and fearless pose fit Jupiter boosting your camera presence that spring, before the confidence felt natural. the stronger version comes later, and your chart is attached as evidence.",
    { answerRequested: true, visualContext: 'A giant satin bow and a fearless pose.', historicalYear: 2014 },
  )
  assert.deepEqual(specific, [])
})

test('repetition guard spends assistant callbacks but follows user-led topics', () => {
  const history = ['Greg is not worth quitting over yet.']
  assert.equal(checkRepetition('Ignore Greg tonight.', history).length, 1)
  assert.equal(checkRepetition('Ignore Greg tonight.', history, 'Greg texted me again').length, 0)
})

test('repetition guard catches a near-duplicate answer without proper nouns', () => {
  const violations = checkRepetition(
    "no, don't text him. you'll get dragged into the same old mess again.",
    ["no, don't text him. you'll just get pulled into the same old mess again."],
    'should i text him again',
  )
  assert.ok(violations.some(violation => violation.detail.includes('wording substantially repeats')))
})

test('repetition guard permits short transactional acknowledgements', () => {
  assert.deepEqual(
    checkRepetition('pulling it up. here it is.', ["i've got your chart pulled up. here it is."]),
    [],
  )
})

test('rewrite prompt names repetition instead of vaguely asking again', () => {
  const violations = checkRepetition('Do not call Greg.', ['Greg already got enough airtime.'])
  assert.match(buildRewritePrompt(violations), /Repeating yourself/)
  assert.match(buildRewritePrompt(violations), /greg/)
})

test('lowercase users get deterministic lowercase sentence openings', () => {
  assert.equal(matchCasing("Don't text him. I mean it.", 'should i text him'), "don't text him. i mean it.")
  assert.equal(matchCasing('lol no, I just said no.', 'should i text him'), 'lol no, i just said no.')
  assert.equal(matchCasing('YES! Keep New York.', 'do i go'), 'YES! keep New York.')
})
