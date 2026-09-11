'use client';

import { useEffect, useRef } from 'react';
import { ArrowUp, Mic, Plus, Wave } from './icons';

export function Composer({
  value,
  onChange,
  onSubmit,
  onFocus,
  placeholder = '',
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onFocus?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content, then let CSS max-height take over.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const hasText = value.trim().length > 0;

  return (
    <div className="composer-wrap">
      <div className="composer">
        <button className="composer-btn" aria-label="Attach">
          <Plus />
        </button>
        <textarea
          ref={ref}
          aria-label="Message Pinch"
          rows={1}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (hasText) onSubmit();
            }
          }}
        />
        {hasText ? (
          <button
            className="composer-btn composer-send"
            onClick={onSubmit}
            disabled={disabled}
            aria-label="Send"
          >
            <ArrowUp size={17} />
          </button>
        ) : (
          <>
            <button className="composer-btn" aria-label="Dictate">
              <Mic size={17} />
            </button>
            <button className="composer-btn composer-send" aria-label="Voice mode">
              <Wave size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
