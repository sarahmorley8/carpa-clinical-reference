/**
 * The ONLY module allowed to use browser storage (enforced by ESLint).
 *
 * Stores non-patient preferences under a single key. Everything is validated on
 * read, so a corrupt or tampered value falls back to safe defaults. Storage can be
 * unavailable (private browsing, blocked site data); the app still works.
 */

export const PREFERENCES_KEY = 'carpa.preferences.v1';
export const DISCLAIMER_VERSION = '2026-10-26';
export const MAX_RECENTS = 8;

export type Theme = 'system' | 'light' | 'dark';
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export interface Preferences {
  theme: Theme;
  textScale: TextScale;
  /** Presentation ids only. */
  favourites: string[];
  /** Presentation ids only, most recent first. */
  recents: string[];
  disclaimerAccepted: string | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  textScale: 1,
  favourites: [],
  recents: [],
  disclaimerAccepted: null,
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const idList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, max) : [];

export function sanitisePreferences(raw: unknown): Preferences {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_PREFERENCES };
  const r = raw as Record<string, unknown>;
  return {
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'system' ? r.theme : 'system',
    textScale: TEXT_SCALES.includes(r.textScale as TextScale) ? (r.textScale as TextScale) : 1,
    favourites: idList(r.favourites, 50),
    recents: idList(r.recents, MAX_RECENTS),
    disclaimerAccepted: typeof r.disclaimerAccepted === 'string' ? r.disclaimerAccepted : null,
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadPreferences(): Preferences {
  try {
    const text = storage()?.getItem(PREFERENCES_KEY);
    return text ? sanitisePreferences(JSON.parse(text)) : { ...DEFAULT_PREFERENCES };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    storage()?.setItem(PREFERENCES_KEY, JSON.stringify(sanitisePreferences(prefs)));
  } catch {
    // Storage full or blocked: preferences simply won't persist.
  }
}

export function withRecent(prefs: Preferences, id: string): Preferences {
  return { ...prefs, recents: [id, ...prefs.recents.filter((r) => r !== id)].slice(0, MAX_RECENTS) };
}

export function withFavouriteToggled(prefs: Preferences, id: string): Preferences {
  const has = prefs.favourites.includes(id);
  return { ...prefs, favourites: has ? prefs.favourites.filter((f) => f !== id) : [...prefs.favourites, id] };
}
