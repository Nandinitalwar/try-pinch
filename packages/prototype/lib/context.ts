/**
 * Context engine for the logged-out first prompt.
 *
 * Deliberate constraint: everything here is derived from signals the browser
 * already hands us, plus an optional coarse city derived at the hosting edge.
 * There is no browser geolocation permission dialog and no precise location.
 * A permission prompt on the logged-out landing page would cost more sessions
 * than the personalization wins.
 *
 * Pure functions, injected clock: every bucket is reachable in a test and from
 * the dev panel without waiting until Friday night.
 */

export type DayKind = 'weekday' | 'weekend';
export type TimeBucket =
  | 'earlyMorning'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'lateNight';
export type Device = 'mobile' | 'desktop';

export interface Context {
  dayKind: DayKind;
  timeBucket: TimeBucket;
  device: Device;
  city: string;
  locationSource: 'edge' | 'timezone';
  /** Stable key used for prompt lookup + analytics bucketing. */
  key: string;
  /** Human-readable context label used by generic replies and prototype telemetry. */
  label: string;
}

export interface ContextInput {
  now: Date;
  timeZone: string;
  device: Device;
  /** Coarse edge-derived city. Falls back to timezone when absent (localhost). */
  cityOverride?: string | null;
  /**
   * Dev-panel escape hatch. Every bucket has to be reachable on demand — you
   * cannot review a "Friday night" experience by waiting until Friday night.
   */
  overrides?: { hour?: number; weekday?: string };
}

/**
 * Timezone -> coarse city. Intentionally coarse: we say "in San Francisco" for
 * all of America/Los_Angeles because being vaguely right beats being precisely
 * creepy, and it costs nothing to acquire.
 */
const TZ_CITY: Record<string, string> = {
  'America/Los_Angeles': 'San Francisco',
  'America/Vancouver': 'Vancouver',
  'America/Denver': 'Denver',
  'America/Phoenix': 'Phoenix',
  'America/Chicago': 'Chicago',
  'America/New_York': 'New York',
  'America/Toronto': 'Toronto',
  'America/Mexico_City': 'Mexico City',
  'America/Sao_Paulo': 'São Paulo',
  'Europe/London': 'London',
  'Europe/Dublin': 'Dublin',
  'Europe/Paris': 'Paris',
  'Europe/Berlin': 'Berlin',
  'Europe/Madrid': 'Madrid',
  'Europe/Amsterdam': 'Amsterdam',
  'Europe/Stockholm': 'Stockholm',
  'Europe/Warsaw': 'Warsaw',
  'Europe/Istanbul': 'Istanbul',
  'Asia/Dubai': 'Dubai',
  'Asia/Kolkata': 'Bengaluru',
  'Asia/Calcutta': 'Bengaluru',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Tokyo': 'Tokyo',
  'Asia/Seoul': 'Seoul',
  'Asia/Shanghai': 'Shanghai',
  'Australia/Sydney': 'Sydney',
  'Australia/Melbourne': 'Melbourne',
  'Africa/Lagos': 'Lagos',
  'Africa/Nairobi': 'Nairobi',
  'Africa/Johannesburg': 'Johannesburg',
};

export function cityFromTimeZone(timeZone: string): string {
  const known = TZ_CITY[timeZone];
  if (known) return known;
  // Fall back to the last path segment: "America/Bogota" -> "Bogota".
  const tail = timeZone.split('/').pop();
  if (!tail) return 'your area';
  return tail.replace(/_/g, ' ');
}

export function timeBucketFor(hour: number): TimeBucket {
  if (hour < 5) return 'lateNight';
  if (hour < 9) return 'earlyMorning';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

const BUCKET_WORD: Record<TimeBucket, string> = {
  lateNight: 'late night',
  earlyMorning: 'morning',
  morning: 'morning',
  midday: 'midday',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night',
};

/** Hour + weekday read in the *user's* timezone, not the server's. */
function localParts(now: Date, timeZone: string): { hour: number; weekday: string } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
      weekday: 'long',
    });
    const parts = fmt.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours());
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Today';
    // Intl can emit hour "24" for midnight under hour12:false.
    return { hour: hour === 24 ? 0 : hour, weekday };
  } catch {
    const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      now.getDay()
    ];
    return { hour: now.getHours(), weekday };
  }
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function deriveContext({
  now,
  timeZone,
  device,
  cityOverride,
  overrides,
}: ContextInput): Context {
  const live = localParts(now, timeZone);
  const hour = overrides?.hour ?? live.hour;
  const weekday = overrides?.weekday ?? live.weekday;
  const timeBucket = timeBucketFor(hour);
  const isWeekendDay = weekday === 'Saturday' || weekday === 'Sunday';
  // Friday after work belongs to the weekend, whatever the calendar says.
  const isFridayNight =
    weekday === 'Friday' && (timeBucket === 'evening' || timeBucket === 'night');
  const dayKind: DayKind = isWeekendDay || isFridayNight ? 'weekend' : 'weekday';
  const city = cityOverride?.trim() || cityFromTimeZone(timeZone);

  return {
    dayKind,
    timeBucket,
    device,
    city,
    locationSource: cityOverride?.trim() ? 'edge' : 'timezone',
    key: `${dayKind}:${timeBucket}`,
    label: `${weekday} ${BUCKET_WORD[timeBucket]} in ${city}`,
  };
}

export function detectDevice(width: number): Device {
  return width < 768 ? 'mobile' : 'desktop';
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}
