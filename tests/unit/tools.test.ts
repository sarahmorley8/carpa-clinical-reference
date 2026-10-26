import { describe, expect, it } from 'vitest';
import type { Presentation } from '../../src/content/types.ts';
import { INITIAL_SESSION, hasPatientData, sessionReducer, type SessionState } from '../../src/state/session.tsx';
import { inactivityPhase, INACTIVITY_LIMIT_MS, secondsUntilClear } from '../../src/tools/inactivity.ts';
import { buildIsbarLines, isbarToText, mergeIntoDraft } from '../../src/tools/isbar.ts';
import { formatRemaining, remainingMs, timerReducer, type Timer } from '../../src/tools/timers.ts';
import { readContent, realFiles, validate } from '../helpers.ts';

describe('timers', () => {
  const add = (now = 0, durationMs = 60_000): Timer[] =>
    timerReducer([], { type: 'add', id: 'a', label: 'Obs', durationMs, source: 'user', now });

  it('counts down from the clock, so backgrounding does not drift', () => {
    const t = add(1000)[0]!;
    expect(remainingMs(t, 1000)).toBe(60_000);
    expect(remainingMs(t, 31_000)).toBe(30_000);
    expect(remainingMs(t, 999_999)).toBe(0);
  });

  it('pause keeps the remaining time; resume continues from it', () => {
    let ts = add(0);
    ts = timerReducer(ts, { type: 'pause', id: 'a', now: 20_000 });
    expect(remainingMs(ts[0]!, 500_000)).toBe(40_000);
    ts = timerReducer(ts, { type: 'resume', id: 'a', now: 500_000 });
    expect(remainingMs(ts[0]!, 510_000)).toBe(30_000);
  });

  it('finishes on tick, can be restarted, acknowledged and cancelled', () => {
    let ts = add(0);
    ts = timerReducer(ts, { type: 'tick', now: 59_999 });
    expect(ts[0]!.status).toBe('running');
    ts = timerReducer(ts, { type: 'tick', now: 60_000 });
    expect(ts[0]!.status).toBe('done');
    ts = timerReducer(ts, { type: 'acknowledge', id: 'a' });
    expect(ts[0]!.acknowledged).toBe(true);
    ts = timerReducer(ts, { type: 'reset', id: 'a', now: 100_000 });
    expect(ts[0]).toMatchObject({ status: 'running', acknowledged: false, endsAt: 160_000 });
    expect(timerReducer(ts, { type: 'cancel', id: 'a' })).toEqual([]);
  });

  it('rejects invalid durations (never a default)', () => {
    expect(add(0, 0)).toEqual([]);
    expect(add(0, NaN)).toEqual([]);
    expect(add(0, 25 * 3600_000)).toEqual([]);
  });

  it('formats time', () => {
    expect(formatRemaining(65_000)).toBe('01:05');
    expect(formatRemaining(3_725_000)).toBe('1:02:05');
    expect(formatRemaining(500)).toBe('00:01');
  });
});

describe('inactivity clear (60 min, 60 s warning)', () => {
  it('phases', () => {
    expect(inactivityPhase(0, INACTIVITY_LIMIT_MS - 61_000)).toBe('active');
    expect(inactivityPhase(0, INACTIVITY_LIMIT_MS - 60_000)).toBe('warning');
    expect(secondsUntilClear(0, INACTIVITY_LIMIT_MS - 30_000)).toBe(30);
    expect(inactivityPhase(0, INACTIVITY_LIMIT_MS)).toBe('expired');
  });

  it('end-session for inactivity clears every kind of patient data', () => {
    let s: SessionState = sessionReducer(INITIAL_SESSION, { type: 'set-population', population: 'child' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: 'p', itemId: 'x' });
    s = sessionReducer(s, { type: 'set-answers', presentationId: 'p', answers: { q: { kind: 'unknown' } } });
    s = sessionReducer(s, {
      type: 'timer',
      action: { type: 'add', id: 't', label: 'x', durationMs: 5000, source: 'user', now: 0 },
    });
    s = sessionReducer(s, { type: 'set-isbar', isbar: { ...s.isbar, situation: 'typed' } });
    expect(hasPatientData(s)).toBe(true);
    s = sessionReducer(s, { type: 'end-session', reason: 'inactivity' });
    expect(hasPatientData(s)).toBe(false);
    expect(s.lastClear).toBe('inactivity');
  });

  it('changing population clears answers too', () => {
    let s = sessionReducer(INITIAL_SESSION, {
      type: 'set-answers',
      presentationId: 'p',
      answers: { q: { kind: 'unknown' } },
    });
    s = sessionReducer(s, { type: 'set-population', population: 'adult' });
    expect(s.answers).toEqual({});
  });
});

describe('ISBAR builder', () => {
  const store = validate(realFiles());
  const demo = readContent('examples/presentations/demo-fictional-fever.json') as Presentation;

  it('uses only ticked items and given answers; nothing is inferred or identifying', () => {
    let s = sessionReducer(INITIAL_SESSION, { type: 'set-population', population: 'child' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: demo.meta.id, itemId: 'hx-onset' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: demo.meta.id, itemId: 'obs-glow' });
    s = sessionReducer(s, {
      type: 'set-answers',
      presentationId: demo.meta.id,
      answers: { 'q-sparkling': { kind: 'value', value: 'yes' } },
    });
    const lines = buildIsbarLines(s, store);
    expect(lines.identify).toEqual([]);
    expect(lines.situation).toEqual(['Patient group: Child', `Reference pathway used: ${demo.meta.title}`]);
    expect(lines.background).toEqual(['DEMO: When did the sparkling start? (fictional)']);
    expect(lines.assessment).toEqual([
      'DEMO: Glow level (fictional)',
      'DEMO: Is the patient sparkling? (fictional): Yes',
    ]);
    expect(lines.recommendation).toEqual([
      'Pathway step reached: DEMO: Consult the medical officer (fictional instruction)',
      `Pathway end reached (${demo.meta.title}): consult`,
    ]);
    // un-ticked items never appear
    expect(JSON.stringify(lines)).not.toMatch(/glitter|shininess/i);
  });

  it('skips placeholder text from templates', () => {
    const s = sessionReducer(INITIAL_SESSION, { type: 'toggle-check', presentationId: 'asthma', itemId: 'history-1' });
    expect(buildIsbarLines(s, store).background).toEqual([]);
  });

  it('merging never overwrites or duplicates typed text', () => {
    const draft = {
      identify: 'RN Sam, Clinic X',
      situation: 'Calling about a child',
      background: '',
      assessment: 'A',
      recommendation: '',
    };
    const lines = {
      identify: [],
      situation: ['Patient group: Child'],
      background: ['B1'],
      assessment: ['A'],
      recommendation: [],
    };
    const merged = mergeIntoDraft(draft, lines);
    expect(merged).toEqual({ ...draft, situation: 'Calling about a child\nPatient group: Child', background: 'B1' });
    expect(mergeIntoDraft(merged, lines)).toEqual(merged);
    expect(isbarToText(merged)).toMatch(/^I — Identify:\nRN Sam, Clinic X\n\nS — Situation:/);
  });
});
