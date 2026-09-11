'use client';

import { useEffect, useMemo, useState } from 'react';

export interface CarouselPrompt {
  id: string;
  text: string;
}

type Phase = 'typing' | 'holding' | 'erasing' | 'between';

const TYPE_MS = 34;
const ERASE_MS = 18;
const HOLD_MS = 1750;
const BETWEEN_MS = 260;

/**
 * A prompt carousel that behaves like someone typing into the composer:
 * type, pause, erase, advance. Screen readers receive a stable textarea label
 * instead of every character, and reduced-motion users see a complete prompt.
 */
export function usePromptCarousel(
  prompts: CarouselPrompt[],
  enabled = true,
  resetKey: string | number = '',
) {
  const signature = useMemo(
    () => prompts.map((prompt) => `${prompt.id}:${prompt.text}`).join('|'),
    [prompts],
  );
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState('');
  const [shownFor, setShownFor] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const [reduceMotion, setReduceMotion] = useState(false);

  const prompt = prompts.length ? prompts[index % prompts.length] : null;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    setIndex(0);
    setShown('');
    setShownFor('');
    setPhase('typing');
  }, [resetKey, signature]);

  useEffect(() => {
    if (!enabled || !prompt) return;
    if (reduceMotion) {
      setShown(prompt.text);
      setShownFor(prompt.id);
      return;
    }

    let delay = TYPE_MS;
    let next = () => {
      setShownFor(prompt.id);
      setShown((current) => prompt.text.slice(0, current.length + 1));
    };

    if (phase === 'typing' && shown.length >= prompt.text.length) {
      delay = HOLD_MS;
      next = () => setPhase('erasing');
    } else if (phase === 'erasing' && shown.length > 0) {
      delay = ERASE_MS;
      next = () => setShown((current) => current.slice(0, -1));
    } else if (phase === 'erasing') {
      delay = BETWEEN_MS;
      next = () => setPhase('between');
    } else if (phase === 'between') {
      delay = 0;
      next = () => {
        setIndex((current) => (current + 1) % prompts.length);
        setPhase('typing');
      };
    }

    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [enabled, phase, prompt, prompts.length, reduceMotion, shown]);

  return {
    prompt,
    text: reduceMotion && prompt ? prompt.text : shownFor === prompt?.id ? shown : '',
    phase,
  };
}
