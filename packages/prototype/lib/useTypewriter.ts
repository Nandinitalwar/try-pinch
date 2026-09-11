'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveals `full` a character at a time. Chunked per frame rather than one
 * setTimeout per character so a long answer doesn't queue hundreds of timers,
 * and so the reveal rate stays honest on a slow tab.
 */
export function useTypewriter(full: string, opts: { charsPerSecond?: number; start?: boolean } = {}) {
  const { charsPerSecond = 420, start = true } = opts;
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShown('');
    setDone(false);
    doneRef.current = false;
    if (!start || !full) return;

    let raf = 0;
    let last = performance.now();
    let count = 0;

    const step = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      count = Math.min(full.length, count + elapsed * charsPerSecond);
      setShown(full.slice(0, Math.floor(count)));
      if (count >= full.length) {
        if (!doneRef.current) {
          doneRef.current = true;
          setDone(true);
        }
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [full, charsPerSecond, start]);

  const skip = () => {
    setShown(full);
    if (!doneRef.current) {
      doneRef.current = true;
      setDone(true);
    }
  };

  return { shown, done, skip };
}
