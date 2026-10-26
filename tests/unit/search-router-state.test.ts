import { describe, expect, it } from 'vitest';
import { parseHash, hrefFor, type Route } from '../../src/navigation/router.ts';
import { buildSearchIndex } from '../../src/search/search.ts';
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  PREFERENCES_KEY,
  sanitisePreferences,
  savePreferences,
  withRecent,
  MAX_RECENTS,
} from '../../src/state/preferences.ts';
import { INITIAL_SESSION, hasPatientData, sessionReducer } from '../../src/state/session.tsx';
import { realFiles, validate } from '../helpers.ts';

describe('search', () => {
  const index = buildSearchIndex(validate(realFiles()));
  const ids = (q: string) => index.search(q).map((r) => r.id);

  it('finds presentations by name, prefix and with spelling mistakes', () => {
    expect(ids('asthma')[0]).toBe('asthma');
    expect(ids('anaph')[0]).toBe('anaphylaxis');
    expect(ids('anaphalaxis')[0]).toBe('anaphylaxis');
    expect(ids('sepsiss')[0]).toBe('sepsis');
  });

  it('uses keywords, symptoms, body systems and synonym groups', () => {
    expect(ids('sparkling')).toContain('demo-fictional-fever');
    expect(ids('breathing')).toContain('asthma');
    expect(ids('gastro')).toContain('gastroenteritis-dehydration-child');
    expect(ids('anaphylactic')).toContain('anaphylaxis');
  });

  it('returns nothing for empty or unrelated queries', () => {
    expect(ids('   ')).toEqual([]);
    expect(ids('xylophone')).toEqual([]);
  });

  it('is fast enough (well under 200 ms per query)', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) index.search('chest');
    expect((performance.now() - start) / 100).toBeLessThan(20);
  });
});

describe('router', () => {
  const cases: [string, Route][] = [
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/p/chest-pain', { name: 'presentation', id: 'chest-pain' }],
    ['#/p/chest-pain/escalate', { name: 'escalation', id: 'chest-pain' }],
    ['#/system/respiratory', { name: 'system', id: 'respiratory' }],
    ['#/critical/sepsis', { name: 'critical', id: 'sepsis' }],
    ['#/settings', { name: 'settings' }],
  ];
  it.each(cases)('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
    if (hash.length > 2) expect(hrefFor(route)).toBe(hash);
  });

  it('rejects malformed ids and unknown paths', () => {
    expect(parseHash('#/p/Chest Pain').name).toBe('not-found');
    expect(parseHash('#/p/../x').name).toBe('not-found');
    expect(parseHash('#/admin').name).toBe('not-found');
  });
});

describe('preferences (non-patient data only)', () => {
  it('round-trips through a single storage key', () => {
    savePreferences({ ...DEFAULT_PREFERENCES, theme: 'dark', favourites: ['asthma'] });
    expect(Object.keys(window.localStorage)).toEqual([PREFERENCES_KEY]);
    expect(loadPreferences()).toMatchObject({ theme: 'dark', favourites: ['asthma'] });
  });

  it('falls back to safe defaults for corrupt or tampered values', () => {
    window.localStorage.setItem(PREFERENCES_KEY, '{not json');
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(
      sanitisePreferences({ theme: 'neon', textScale: 9, favourites: ['ok-id', 'Bad Id', 3], patientName: 'X' }),
    ).toEqual({ ...DEFAULT_PREFERENCES, favourites: ['ok-id'] });
  });

  it('keeps a bounded recent list, most recent first', () => {
    let p = DEFAULT_PREFERENCES;
    for (let i = 0; i < 12; i++) p = withRecent(p, `p-${i}`);
    p = withRecent(p, 'p-5');
    expect(p.recents).toHaveLength(MAX_RECENTS);
    expect(p.recents[0]).toBe('p-5');
  });
});

describe('session state (memory only)', () => {
  it('ticks, then end session clears everything', () => {
    let s = sessionReducer(INITIAL_SESSION, { type: 'set-population', population: 'child' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: 'asthma', itemId: 'history-1' });
    expect(hasPatientData(s)).toBe(true);
    s = sessionReducer(s, { type: 'end-session' });
    expect(s).toEqual({ ...INITIAL_SESSION, generation: 1 });
    expect(hasPatientData(s)).toBe(false);
  });

  it('changing population clears ticks; toggling twice unticks', () => {
    let s = sessionReducer(INITIAL_SESSION, { type: 'toggle-check', presentationId: 'a', itemId: 'x' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: 'a', itemId: 'y' });
    s = sessionReducer(s, { type: 'toggle-check', presentationId: 'a', itemId: 'x' });
    expect(s.checks.a).toEqual(['y']);
    s = sessionReducer(s, { type: 'set-population', population: 'adult' });
    expect(s.checks).toEqual({});
  });
});
