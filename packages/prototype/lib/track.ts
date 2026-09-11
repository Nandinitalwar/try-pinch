'use client';

import { useEffect, useState } from 'react';

/**
 * The events this experiment would actually be judged on. They are emitted here
 * so the shape is reviewable in the PR — wire the sink to whatever the real
 * pipeline is and the call sites don't change.
 */
export type EventName =
  | 'onboarding_viewed'      // logged-out landing rendered, with variant + context key
  | 'carousel_started'       // the kinetic contextual placeholder started cycling
  | 'prompt_clicked'         // the current kinetic suggestion or control chip was chosen
  | 'composer_focused'       // user went for the blank box instead
  | 'first_message_sent'     // ★ primary metric: any first message, however it started
  | 'answer_completed'       // the stream finished without the user bailing
  | 'share_opened'           // share card rendered
  | 'share_copied'           // ★ secondary metric: link actually copied
  | 'signup_clicked';        // the money event

export interface TrackedEvent {
  id: number;
  name: EventName;
  at: number;
  props: Record<string, string | number | boolean | null>;
}

const listeners = new Set<(e: TrackedEvent) => void>();
const log: TrackedEvent[] = [];
let seq = 0;

export function track(name: EventName, props: TrackedEvent['props'] = {}) {
  const event: TrackedEvent = { id: ++seq, name, at: Date.now(), props };
  log.push(event);
  if (typeof console !== 'undefined') {
    console.info(`[track] ${name}`, props);
  }
  listeners.forEach((fn) => fn(event));
}

export function useEventLog(): TrackedEvent[] {
  const [events, setEvents] = useState<TrackedEvent[]>(() => [...log]);
  useEffect(() => {
    const fn = (e: TrackedEvent) => setEvents((prev) => [...prev, e]);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return events;
}
