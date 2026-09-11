'use client';

import { WEEKDAYS } from '../lib/context';
import { useEventLog } from '../lib/track';
import { Close, Gear } from './icons';

export interface DevState {
  variant: 'bloom' | 'control';
  theme: 'dark' | 'light';
  device: 'desktop' | 'mobile';
  liveClock: boolean;
  hour: number;
  weekday: string;
  timeZone: string;
}

const TZ_CHOICES = [
  ['America/Los_Angeles', 'San Francisco'],
  ['America/New_York', 'New York'],
  ['America/Chicago', 'Chicago'],
  ['Europe/London', 'London'],
  ['Europe/Berlin', 'Berlin'],
  ['Asia/Kolkata', 'Bengaluru'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Australia/Sydney', 'Sydney'],
  ['Africa/Lagos', 'Lagos'],
  ['America/Sao_Paulo', 'São Paulo'],
];

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={v} data-on={v === value} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function fmtHour(h: number) {
  const suffix = h < 12 ? 'am' : 'pm';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00${suffix}`;
}

/**
 * Not shipped code — the reviewer's remote control. It exists so anyone opening
 * this branch can see all fourteen contexts in ninety seconds instead of
 * trusting a description of them.
 */
export function DevPanel({
  open,
  onOpenChange,
  state,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  state: DevState;
  onChange: (patch: Partial<DevState>) => void;
  onReset: () => void;
}) {
  const events = useEventLog();

  return (
    <>
      <button
        className="dev-toggle"
        onClick={() => onOpenChange(!open)}
        aria-label="Prototype controls"
        title="Prototype controls"
      >
        {open ? <Close /> : <Gear />}
      </button>

      {open && (
        <div className="dev">
          <div className="dev-group">
            <h4>Arm</h4>
            <Seg
              value={state.variant}
              options={[
                ['bloom', 'Kinetic (B)'],
                ['control', 'Control (A)'],
              ]}
              onChange={(v) => onChange({ variant: v })}
            />
          </div>

          <div className="dev-group">
            <h4>Surface</h4>
            <div style={{ display: 'flex', gap: 6 }}>
              <Seg
                value={state.device}
                options={[
                  ['desktop', 'Desktop'],
                  ['mobile', 'Phone'],
                ]}
                onChange={(v) => onChange({ device: v })}
              />
              <Seg
                value={state.theme}
                options={[
                  ['dark', 'Dark'],
                  ['light', 'Light'],
                ]}
                onChange={(v) => onChange({ theme: v })}
              />
            </div>
          </div>

          <div className="dev-group">
            <h4>Context</h4>
            <div className="dev-row">
              <span>Clock</span>
              <Seg
                value={state.liveClock ? 'live' : 'set'}
                options={[
                  ['live', 'Live'],
                  ['set', 'Set'],
                ]}
                onChange={(v) => onChange({ liveClock: v === 'live' })}
              />
            </div>
            {!state.liveClock && (
              <>
                <div className="dev-row">
                  <span>Day</span>
                  <span className="dev-val">{state.weekday}</span>
                </div>
                <select
                  value={state.weekday}
                  onChange={(e) => onChange({ weekday: e.target.value })}
                  style={{ marginBottom: 8 }}
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <div className="dev-row">
                  <span>Hour</span>
                  <span className="dev-val">{fmtHour(state.hour)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23}
                  value={state.hour}
                  onChange={(e) => onChange({ hour: Number(e.target.value) })}
                />
              </>
            )}
            <div className="dev-row" style={{ marginTop: 8 }}>
              <span>Timezone</span>
            </div>
            <select
              value={state.timeZone}
              onChange={(e) => onChange({ timeZone: e.target.value })}
            >
              {TZ_CHOICES.map(([tz, label]) => (
                <option key={tz} value={tz}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="dev-group">
            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '7px 12px' }}
              onClick={onReset}
            >
              Reset session
            </button>
          </div>

          <h4 style={{ marginBottom: 8 }}>Events</h4>
          <div className="dev-log">
            {events.length === 0 && <div className="dev-empty">Nothing yet.</div>}
            {events
              .slice(-40)
              .reverse()
              .map((e) => (
                <div key={e.id}>
                  <b>{e.name}</b>{' '}
                  {Object.entries(e.props)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' ')}
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
