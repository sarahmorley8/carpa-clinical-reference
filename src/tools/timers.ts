/**
 * Timer logic (pure). Remaining time is always computed from the clock, not by counting
 * ticks, so a timer is still correct after the phone was locked or the app backgrounded.
 * Durations come only from approved content or from what the user types. No defaults.
 */

export type TimerStatus = 'running' | 'paused' | 'done';

export interface Timer {
  id: string;
  label: string;
  durationMs: number;
  /** When running: the time it will finish (ms since epoch). */
  endsAt: number | null;
  /** When paused or done: time left. */
  remainingMs: number;
  status: TimerStatus;
  /** Where the duration came from. */
  source: 'content' | 'user';
  /** Set once the user has acknowledged the finished alert. */
  acknowledged: boolean;
}

export type TimerAction =
  | { type: 'add'; id: string; label: string; durationMs: number; source: Timer['source']; now: number }
  | { type: 'pause'; id: string; now: number }
  | { type: 'resume'; id: string; now: number }
  | { type: 'reset'; id: string; now: number }
  | { type: 'cancel'; id: string }
  | { type: 'tick'; now: number }
  | { type: 'acknowledge'; id: string };

export const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

export function isValidDuration(ms: number): boolean {
  return Number.isFinite(ms) && ms >= 1000 && ms <= MAX_TIMER_MS;
}

export function remainingMs(t: Timer, now: number): number {
  if (t.status === 'running' && t.endsAt !== null) return Math.max(0, t.endsAt - now);
  return t.remainingMs;
}

export function timerReducer(timers: Timer[], a: TimerAction): Timer[] {
  const update = (id: string, fn: (t: Timer) => Timer) => timers.map((t) => (t.id === id ? fn(t) : t));
  switch (a.type) {
    case 'add':
      if (!isValidDuration(a.durationMs) || timers.some((t) => t.id === a.id)) return timers;
      return [
        ...timers,
        {
          id: a.id,
          label: a.label,
          durationMs: a.durationMs,
          endsAt: a.now + a.durationMs,
          remainingMs: a.durationMs,
          status: 'running',
          source: a.source,
          acknowledged: false,
        },
      ];
    case 'pause':
      return update(a.id, (t) =>
        t.status === 'running' ? { ...t, status: 'paused', remainingMs: remainingMs(t, a.now), endsAt: null } : t,
      );
    case 'resume':
      return update(a.id, (t) =>
        t.status === 'paused' ? { ...t, status: 'running', endsAt: a.now + t.remainingMs } : t,
      );
    case 'reset':
      return update(a.id, (t) => ({
        ...t,
        status: 'running',
        endsAt: a.now + t.durationMs,
        remainingMs: t.durationMs,
        acknowledged: false,
      }));
    case 'cancel':
      return timers.filter((t) => t.id !== a.id);
    case 'tick': {
      let changed = false;
      const next = timers.map((t) => {
        if (t.status === 'running' && t.endsAt !== null && t.endsAt <= a.now) {
          changed = true;
          return { ...t, status: 'done' as const, remainingMs: 0, endsAt: null };
        }
        return t;
      });
      return changed ? next : timers;
    }
    case 'acknowledge':
      return update(a.id, (t) => ({ ...t, acknowledged: true }));
  }
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
