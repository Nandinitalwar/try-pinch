'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Answer } from '../lib/responses';
import { useTypewriter } from '../lib/useTypewriter';
import { Avatar } from './Shell';
import { Copy, Share, ThumbDown, ThumbUp } from './icons';
import { Markdown } from './Markdown';

const THINKING_MS = 460;

export function AiMessage({
  answer,
  scrollRef,
  onDone,
  onShare,
  onCopy,
}: {
  answer: Answer;
  scrollRef: RefObject<HTMLDivElement>;
  onDone: () => void;
  onShare: () => void;
  onCopy: () => void;
}) {
  const [thinking, setThinking] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setThinking(false), THINKING_MS);
    return () => clearTimeout(t);
  }, []);

  const { shown, done, skip } = useTypewriter(answer.body, { start: !thinking });

  const firedRef = useRef(false);
  useEffect(() => {
    if (done && !firedRef.current) {
      firedRef.current = true;
      onDone();
    }
  }, [done, onDone]);

  // Follow the stream, but only while the reader is already at the bottom —
  // yanking the viewport back on someone who scrolled up is the worst bug in
  // every chat UI.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 140) el.scrollTop = el.scrollHeight;
  }, [shown, thinking, scrollRef]);

  return (
    <>
      <div className="msg-ai" onClick={() => !done && skip()}>
        <Avatar />
        <div className="msg-body">
          {thinking ? (
            <span className="caret" />
          ) : (
            <>
              <Markdown text={shown} />
              {!done && <span className="caret" />}
            </>
          )}
        </div>
      </div>

      {done && (
        <div className="actions">
          <button className="action" onClick={onCopy}>
            <Copy />
          </button>
          <button className="action" aria-label="Good response">
            <ThumbUp />
          </button>
          <button className="action" aria-label="Bad response">
            <ThumbDown />
          </button>
          <button className="action" data-primary="true" onClick={onShare}>
            <Share />
            Share this answer
          </button>
        </div>
      )}
    </>
  );
}
