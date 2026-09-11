'use client';

import type { Answer } from '../lib/responses';
import { Close } from './icons';

/**
 * Experiment B. The card is the unit that leaves the product: a question, the
 * three beats of the answer, and a link back. Deliberately not a screenshot of
 * the thread — a screenshot shares a UI, a card shares an idea.
 */
export function ShareCard({
  question,
  answer,
  link,
  onClose,
  onCopy,
}: {
  question: string;
  answer: Answer;
  link: string;
  onClose: () => void;
  onCopy: (what: 'link' | 'text') => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="share-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>

        <div className="share-card">
          <p className="share-q">{question}</p>
          <h2 className="share-title">{answer.shareTitle}</h2>
          <ul className="share-points">
            {answer.sharePoints.map((pt, i) => (
              <li key={i}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
          <div className="share-foot">
            <strong>Pinch</strong>
            <span>{link.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <div className="share-actions">
          <button className="primary" onClick={() => onCopy('link')}>
            Copy link
          </button>
          <button onClick={() => onCopy('text')}>Copy text</button>
        </div>
      </div>
    </div>
  );
}
