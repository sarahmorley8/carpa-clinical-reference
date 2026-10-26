import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  loadPreferences,
  savePreferences,
  withFavouriteToggled,
  withRecent,
  type Preferences,
  type TextScale,
  type Theme,
} from './preferences.ts';

interface PreferencesApi {
  prefs: Preferences;
  setTheme: (t: Theme) => void;
  setTextScale: (s: TextScale) => void;
  toggleFavourite: (id: string) => void;
  addRecent: (id: string) => void;
  acceptDisclaimer: (version: string) => void;
}

const Ctx = createContext<PreferencesApi | null>(null);

export function PreferencesProvider({ children, initial }: { children: ReactNode; initial?: Preferences }) {
  const [prefs, setPrefs] = useState<Preferences>(() => initial ?? loadPreferences());

  const update = useCallback((fn: (p: Preferences) => Preferences) => {
    setPrefs((p) => {
      const next = fn(p);
      savePreferences(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
    root.style.setProperty('--text-scale', String(prefs.textScale));
  }, [prefs.theme, prefs.textScale]);

  const api = useMemo<PreferencesApi>(
    () => ({
      prefs,
      setTheme: (theme) => update((p) => ({ ...p, theme })),
      setTextScale: (textScale) => update((p) => ({ ...p, textScale })),
      toggleFavourite: (id) => update((p) => withFavouriteToggled(p, id)),
      addRecent: (id) => update((p) => withRecent(p, id)),
      acceptDisclaimer: (version) => update((p) => ({ ...p, disclaimerAccepted: version })),
    }),
    [prefs, update],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePreferences must be used inside PreferencesProvider');
  return v;
}
