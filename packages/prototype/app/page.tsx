'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Composer } from '../components/Composer';
import { AiMessage } from '../components/AiMessage';
import { DevPanel, type DevState } from '../components/DevPanel';
import { ShareCard } from '../components/ShareCard';
import { Sidebar, TopBar } from '../components/Shell';
import { KindIcon } from '../components/icons';
import { MODEL_OPTIONS, ModelPicker, type ModelId } from '../components/ModelPicker';
import { deriveContext, detectDevice, detectTimeZone } from '../lib/context';
import { CONTROL_CHIPS, ledeFor, promptsFor, renderPrompt } from '../lib/prompts';
import { answerFromModel, getAnswer, type Answer } from '../lib/responses';
import { track } from '../lib/track';
import { usePromptCarousel } from '../lib/usePromptCarousel';

const STORAGE_KEY = 'first-prompt.dev';
const MODEL_STORAGE_KEY = 'pinch.model';

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'ai'; question: string; answer: Answer }
  | { id: number; role: 'pending'; question: string; model: ModelId };

const DEFAULT_DEV: DevState = {
  variant: 'bloom',
  theme: 'dark',
  device: 'desktop',
  liveClock: true,
  hour: 19,
  weekday: 'Friday',
  timeZone: 'America/Los_Angeles',
};

export default function Page() {
  const [dev, setDev] = useState<DevState>(DEFAULT_DEV);
  const [devOpen, setDevOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [viewportW, setViewportW] = useState(1280);

  const [session, setSession] = useState(0);
  const [phase, setPhase] = useState<'hero' | 'thread'>('hero');
  const [edgeCity, setEdgeCity] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [share, setShare] = useState<{ q: string; a: Answer; link: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [model, setModel] = useState<ModelId>('z-ai/glm-5.2');
  const [sending, setSending] = useState(false);

  const mountAt = useRef(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusTracked = useRef(false);
  const msgId = useRef(0);

  const ctx = useMemo(
    () =>
      deriveContext({
        now: new Date(),
        timeZone: dev.timeZone,
        device: dev.device,
        cityOverride: edgeCity,
        overrides: dev.liveClock ? undefined : { hour: dev.hour, weekday: dev.weekday },
      }),
    [dev.timeZone, dev.device, dev.liveClock, dev.hour, dev.weekday, edgeCity],
  );

  const prompts = useMemo(() => promptsFor(ctx), [ctx]);
  const kineticPrompts = useMemo(
    () => prompts.map((prompt) => ({ id: prompt.id, text: renderPrompt(prompt, ctx) })),
    [ctx, prompts],
  );
  const { prompt: activePrompt, text: kineticPlaceholder } = usePromptCarousel(
    kineticPrompts,
    ready && locationReady && phase === 'hero' && dev.variant === 'bloom' && input.length === 0,
    session,
  );

  /* ── boot ─────────────────────────────────────────────── */
  useEffect(() => {
    let next: DevState = { ...DEFAULT_DEV };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) next = { ...next, ...JSON.parse(saved) };
      else next.device = detectDevice(window.innerWidth);
      const savedModel = localStorage.getItem(MODEL_STORAGE_KEY);
      if (MODEL_OPTIONS.some((candidate) => candidate.id === savedModel)) {
        setModel(savedModel as ModelId);
      }
    } catch {
      /* private mode — defaults are fine */
    }
    next.timeZone = next.timeZone || detectTimeZone();

    const urlVariant = new URLSearchParams(window.location.search).get('v');
    if (urlVariant === 'control' || urlVariant === 'bloom') next.variant = urlVariant;

    setDev(next);
    setViewportW(window.innerWidth);
    setReady(true);

    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let current = true;
    fetch('/api/context', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { city?: string | null } | null) => {
        if (current && data?.city) setEdgeCity(data.city);
      })
      .catch(() => {
        /* Localhost and offline demos intentionally fall back to timezone. */
      })
      .finally(() => {
        if (current) setLocationReady(true);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dev.theme;
  }, [dev.theme]);

  // The phone drawer starts closed, while desktop keeps ChatGPT's familiar
  // left rail open. Unlike the old `device === mobile` shortcut, this still
  // lets the hamburger actually open the drawer on a phone.
  useEffect(() => {
    setSidebarCollapsed(dev.device === 'mobile');
  }, [dev.device]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dev));
    } catch {
      /* ignore */
    }
  }, [dev, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      /* private mode — the default remains GLM 5.2 */
    }
  }, [model, ready]);

  /* ── impression + kinetic prompt timing ───────────────── */
  useEffect(() => {
    if (!ready || !locationReady) return;
    track('onboarding_viewed', {
      variant: dev.variant,
      context: ctx.key,
      city: ctx.city,
      device: ctx.device,
      location_source: ctx.locationSource,
    });
  }, [ready, locationReady, session, dev.variant, ctx.key, ctx.city, ctx.device, ctx.locationSource]);

  useEffect(() => {
    if (!ready || !locationReady || phase !== 'hero' || dev.variant !== 'bloom') return;
    track('carousel_started', {
      context: ctx.key,
      count: prompts.length,
      location_source: ctx.locationSource,
    });
  }, [ready, locationReady, phase, dev.variant, ctx.key, ctx.locationSource, session, prompts.length]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 1900);
  }, []);

  /* ── sending ──────────────────────────────────────────── */
  const send = useCallback(
    async (text: string, promptId: string | null, source: 'carousel' | 'chip' | 'composer') => {
      const clean = text.trim();
      if (!clean || sending) return;
      if (messages.length === 0) {
        track('first_message_sent', {
          source,
          variant: dev.variant,
          context: ctx.key,
          device: ctx.device,
          prompt_id: promptId,
          ms_to_first_message: Date.now() - mountAt.current,
        });
      }
      const userId = ++msgId.current;
      const pendingId = ++msgId.current;
      const history = messages.flatMap((message) => {
        if (message.role === 'user') return [{ role: 'user', content: message.text }];
        if (message.role === 'ai') return [{ role: 'assistant', content: message.answer.body }];
        return [];
      });
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', text: clean },
        { id: pendingId, role: 'pending', question: clean, model },
      ]);
      setInput('');
      setPhase('thread');
      setAnswered(false);
      setSending(true);
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [...history, { role: 'user', content: clean }],
            context: { label: ctx.label, city: ctx.city, timeZone: dev.timeZone },
          }),
        });
        const result = await response.json();
        if (!response.ok || typeof result.text !== 'string') {
          throw new Error(result.error || 'The selected oracle could not answer.');
        }
        const answer = answerFromModel(result.text);
        setMessages((prev) => prev.map((message) => message.id === pendingId
          ? { id: pendingId, role: 'ai' as const, question: clean, answer }
          : message));
      } catch (error) {
        const fallback = getAnswer(promptId, clean, ctx);
        const detail = error instanceof Error ? error.message : 'The selected oracle could not answer.';
        setMessages((prev) => prev.map((message) => message.id === pendingId
          ? {
              id: pendingId,
              role: 'ai' as const,
              question: clean,
              answer: {
                ...fallback,
                body: `${fallback.body}\n\n_Oracle unavailable: ${detail}_`,
              },
            }
          : message));
      } finally {
        setSending(false);
      }
    },
    [ctx, dev.timeZone, dev.variant, messages, model, sending],
  );

  const pickKineticPrompt = useCallback(() => {
    if (!activePrompt) return;
    const position = kineticPrompts.findIndex((prompt) => prompt.id === activePrompt.id);
    track('prompt_clicked', {
      source: 'carousel',
      prompt_id: activePrompt.id,
      position,
      context: ctx.key,
      variant: dev.variant,
      location_source: ctx.locationSource,
    });
    send(activePrompt.text, activePrompt.id, 'carousel');
  }, [activePrompt, ctx.key, ctx.locationSource, dev.variant, kineticPrompts, send]);

  const pickChip = useCallback(
    (id: string, text: string, index: number) => {
      track('prompt_clicked', {
        source: 'chip',
        prompt_id: id,
        kind: 'category',
        position: index,
        context: ctx.key,
        variant: dev.variant,
      });
      // The control arm hands you a category, not a question. You still have to
      // write the sentence — which is the whole thing we're testing.
      setInput(`${text}: `);
    },
    [ctx.key, dev.variant],
  );

  const reset = useCallback(() => {
    setMessages([]);
    setAnswered(false);
    setPhase('hero');
    setInput('');
    setShare(null);
    focusTracked.current = false;
    mountAt.current = Date.now();
    setSession((s) => s + 1);
  }, []);

  const patchDev = useCallback(
    (patch: Partial<DevState>) => {
      if ('timeZone' in patch) setEdgeCity(null);
      setDev((prev) => ({ ...prev, ...patch }));
      // Anything that changes the *experience* restarts it; theme doesn't.
      const restarts = ['variant', 'device', 'liveClock', 'hour', 'weekday', 'timeZone'];
      if (restarts.some((k) => k in patch)) reset();
    },
    [reset],
  );

  const openShare = useCallback((question: string, answer: Answer) => {
    const link = `https://chatgpt.com/s/${Math.random().toString(36).slice(2, 10)}`;
    track('share_opened', { question_len: question.length });
    setShare({ q: question, a: answer, link });
  }, []);

  const copyShare = useCallback(
    (what: 'link' | 'text') => {
      if (!share) return;
      const payload =
        what === 'link'
          ? share.link
          : `${share.a.shareTitle}\n\n${share.a.sharePoints.map((p) => `— ${p}`).join('\n')}\n\n${share.link}`;
      navigator.clipboard?.writeText(payload).catch(() => undefined);
      track('share_copied', { what });
      showToast(what === 'link' ? 'Link copied' : 'Text copied');
    },
    [share, showToast],
  );

  const onSignup = useCallback(() => {
    track('signup_clicked', { phase, variant: dev.variant, context: ctx.key });
    showToast('Prototype — no signup wired up');
  }, [phase, dev.variant, ctx.key, showToast]);

  const showFrame = dev.device === 'mobile' && viewportW >= 900;

  return (
    <div className="stage" data-frame={showFrame ? 'mobile' : undefined}>
      <div className="app" data-device={dev.device}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          onSignup={onSignup}
        />

        <main className="main">
          <TopBar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
            onSignup={onSignup}
          />

          {phase === 'hero' ? (
            <div
              className="hero"
              key={`${session}-${dev.variant}-${ctx.key}`}
            >
              {dev.variant === 'bloom' ? (
                <>
                  <div className="kinetic-mark">
                    <div className="zodiac-mark" aria-label="Pinch astrology mark">✦</div>
                  </div>
                  <h1 className="hero-lede">{ledeFor(ctx)}</h1>
                </>
              ) : (
                <h1 className="hero-title">Where should we begin?</h1>
              )}

              <Composer
                value={input}
                onChange={setInput}
                onSubmit={() => send(input, null, 'composer')}
                placeholder={
                  dev.variant === 'bloom' ? kineticPlaceholder : ''
                }
                onFocus={() => {
                  if (focusTracked.current) return;
                  focusTracked.current = true;
                  track('composer_focused', { variant: dev.variant, context: ctx.key });
                }}
                disabled={sending}
              />

              <ModelPicker value={model} onChange={setModel} disabled={sending} />

              {dev.variant === 'bloom' && activePrompt && (
                <button
                  className="kinetic-pick"
                  onClick={pickKineticPrompt}
                  aria-label={`Use suggestion: ${activePrompt.text}`}
                >
                  Use this suggestion
                </button>
              )}

              {dev.variant === 'control' && (
                <div className="chips">
                  {CONTROL_CHIPS.map((c, i) => (
                    <button key={c.id} className="chip" onClick={() => pickChip(c.id, c.text, i)}>
                      <KindIcon kind={c.kind} />
                      {c.text}
                    </button>
                  ))}
                </div>
              )}

              <p className="disclaimer" style={{ marginTop: 18 }}>
                Pinch is a reflective tool, not a substitute for professional advice.
              </p>
            </div>
          ) : (
            <>
              <div className="thread" ref={scrollRef}>
                <div className="thread-inner">
                  {messages.map((m) =>
                    m.role === 'user' ? (
                      <div className="msg-user" key={m.id}>
                        <span>{m.text}</span>
                      </div>
                    ) : m.role === 'pending' ? (
                      <div className="msg-ai model-thinking" key={m.id}>
                        <span className="zodiac-pulse" aria-hidden="true">✦</span>
                        <span>{MODEL_OPTIONS.find((candidate) => candidate.id === m.model)?.label} is reading…</span>
                      </div>
                    ) : (
                      <AiMessage
                        key={m.id}
                        answer={m.answer}
                        scrollRef={scrollRef}
                        onDone={() => {
                          setAnswered(true);
                          track('answer_completed', { variant: dev.variant });
                        }}
                        onShare={() => openShare(m.question, m.answer)}
                        onCopy={() => {
                          navigator.clipboard?.writeText(m.answer.body).catch(() => undefined);
                          showToast('Copied');
                        }}
                      />
                    ),
                  )}

                  {answered && (
                    <div className="signup-nudge">
                      <p>Keep this chat and everything after it.</p>
                      <button className="btn-primary" onClick={onSignup}>
                        Text Pinch
                      </button>
                    </div>
                  )}
                  <div style={{ height: 20 }} />
                </div>
              </div>

              <div className="thread-foot">
                <ModelPicker value={model} onChange={setModel} disabled={sending} />
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={() => send(input, null, 'composer')}
                  placeholder=""
                  disabled={sending}
                />
                <p className="disclaimer">Pinch can be wrong. Keep your own judgment.</p>
              </div>
            </>
          )}

          {share && (
            <ShareCard
              question={share.q}
              answer={share.a}
              link={share.link}
              onClose={() => setShare(null)}
              onCopy={copyShare}
            />
          )}

          {toast && <div className="toast">{toast}</div>}
        </main>

      </div>

      {/* Outside .app on purpose: in phone-preview mode the controls must sit
          beside the device, not inside the screen we're evaluating. */}
      <DevPanel
        open={devOpen}
        onOpenChange={setDevOpen}
        state={dev}
        onChange={patchDev}
        onReset={reset}
      />
    </div>
  );
}
