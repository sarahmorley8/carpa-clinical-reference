/**
 * Always-on helpers for the patient session:
 *  - ticks timers and raises finished-timer alerts (screen, sound, vibration where supported)
 *  - keeps the screen awake while a timer runs (where supported)
 *  - clears the session after 60 minutes of inactivity, with a 60-second warning
 */
import { useEffect, useRef, useState } from 'react';
import { hrefFor } from '../navigation/router.ts';
import { hasPatientData, useSession } from '../state/session.tsx';
import { inactivityPhase, secondsUntilClear } from '../tools/inactivity.ts';
import { formatRemaining, remainingMs } from '../tools/timers.ts';
import { Icon } from './Icon.tsx';

export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---------- sound ----------
let audio: AudioContext | null = null;
function unlockAudio() {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audio && Ctor) audio = new Ctor();
    void audio?.resume();
  } catch {
    audio = null;
  }
}
function beep() {
  if (!audio) return;
  const start = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, start + i * 0.4);
    gain.gain.setValueAtTime(0, start + i * 0.4 + 0.25);
    osc.connect(gain).connect(audio.destination);
    osc.start(start + i * 0.4);
    osc.stop(start + i * 0.4 + 0.3);
  }
}
function vibrate() {
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch {
    // not supported (e.g. iPhone)
  }
}

function TimerEngine() {
  const { state, dispatch } = useSession();
  const alerted = useRef(new Set<string>());
  const running = state.timers.some((t) => t.status === 'running');

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => dispatch({ type: 'timer', action: { type: 'tick', now: Date.now() } }), 500);
    const onVisible = () => dispatch({ type: 'timer', action: { type: 'tick', now: Date.now() } });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [running, dispatch]);

  // Keep the screen awake while a timer runs (Screen Wake Lock API, where supported).
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (
          navigator as unknown as { wakeLock: { request: (t: 'screen') => Promise<typeof lock> } }
        ).wakeLock.request('screen');
      } catch {
        lock = null;
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [running]);

  const finished = state.timers.filter((t) => t.status === 'done' && !t.acknowledged);
  useEffect(() => {
    for (const t of finished) {
      if (!alerted.current.has(t.id)) {
        alerted.current.add(t.id);
        beep();
        vibrate();
      }
    }
  }, [finished]);

  if (finished.length === 0) return null;
  const t = finished[0]!;
  return (
    <div className="modal-backdrop">
      <div
        className="modal modal--critical timer-alert"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="timer-alert-title"
      >
        <h2 id="timer-alert-title" className="modal__title">
          <Icon name="alert" /> Timer finished
        </h2>
        <p className="timer-alert__label">{t.label}</p>
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => dispatch({ type: 'timer', action: { type: 'reset', id: t.id, now: Date.now() } })}
          >
            Restart
          </button>
          <button
            type="button"
            className="btn btn--primary"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- alert needs immediate focus
            autoFocus
            onClick={() => dispatch({ type: 'timer', action: { type: 'acknowledge', id: t.id } })}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function InactivityGuard() {
  const { state, dispatch } = useSession();
  const last = useRef(0);
  const [phase, setPhase] = useState<'active' | 'warning'>('active');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const hasData = hasPatientData(state);
  const hasDataRef = useRef(hasData);
  useEffect(() => {
    hasDataRef.current = hasData;
  }, [hasData]);

  useEffect(() => {
    last.current = Date.now();
    const onActivity = () => {
      last.current = Date.now();
      unlockAudio();
    };
    const opts = { capture: true, passive: true } as const;
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) document.addEventListener(ev, onActivity, opts);
    const check = () => {
      const now = Date.now();
      if (!hasDataRef.current) {
        last.current = now;
        setPhase('active');
        return;
      }
      const p = inactivityPhase(last.current, now);
      if (p === 'expired') {
        setPhase('active');
        last.current = now;
        dispatch({ type: 'end-session', reason: 'inactivity' });
      } else {
        setPhase(p);
        setSecondsLeft(secondsUntilClear(last.current, now));
      }
    };
    const t = window.setInterval(check, 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const)
        document.removeEventListener(ev, onActivity, opts);
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dispatch]);

  return (
    <>
      {phase === 'warning' && (
        <div className="modal-backdrop">
          <div
            className="modal modal--critical"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="idle-title"
            aria-describedby="idle-desc"
          >
            <h2 id="idle-title" className="modal__title">
              Clear session in {secondsLeft} s?
            </h2>
            <p id="idle-desc">
              No activity for nearly 60 minutes. Ticked items, answers, timers and the ISBAR draft will be cleared to
              protect patient privacy.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              // eslint-disable-next-line jsx-a11y/no-autofocus -- warning needs immediate focus
              autoFocus
              onClick={() => {
                last.current = Date.now();
                setPhase('active');
              }}
            >
              Keep working
            </button>
          </div>
        </div>
      )}
      {state.lastClear === 'inactivity' && (
        <div className="callout callout--caution clear-notice" role="status">
          <span>Session cleared after 60 minutes of inactivity.</span>
          <button
            type="button"
            className="btn btn--secondary btn--small"
            onClick={() => dispatch({ type: 'dismiss-clear-notice' })}
          >
            OK
          </button>
        </div>
      )}
    </>
  );
}

export function ActiveTimersStrip() {
  const { state } = useSession();
  const now = useNow(500);
  const active = state.timers.filter((t) => t.status !== 'done' || !t.acknowledged);
  if (active.length === 0) return null;
  const soonest = [...active].sort((a, b) => remainingMs(a, now) - remainingMs(b, now))[0]!;
  return (
    <a className="timer-strip" href={hrefFor({ name: 'timers' })}>
      <span className="timer-strip__label">
        {active.length} timer{active.length > 1 ? 's' : ''} · {soonest.label}
      </span>
      <span className="timer-strip__time" aria-live="off">
        {soonest.status === 'paused' ? 'PAUSED ' : ''}
        {formatRemaining(remainingMs(soonest, now))}
      </span>
    </a>
  );
}

export function SessionGuards() {
  return (
    <>
      <TimerEngine />
      <InactivityGuard />
    </>
  );
}
