/**
 * Patient working state. Held in memory ONLY: never written to storage, URLs or logs.
 * Lost when the app is closed or reloaded, and cleared by "End session".
 */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

export interface SessionState {
  /** Selected patient group, or null = not selected (all items shown, labelled). */
  population: string | null;
  /** Ticked checklist item ids, per presentation id. */
  checks: Record<string, string[]>;
  /** Increments on every clear, so screens holding local state can reset. */
  generation: number;
}

export type SessionAction =
  | { type: 'set-population'; population: string | null }
  | { type: 'toggle-check'; presentationId: string; itemId: string }
  | { type: 'clear-presentation'; presentationId: string }
  | { type: 'end-session' };

export const INITIAL_SESSION: SessionState = { population: null, checks: {}, generation: 0 };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'set-population':
      if (action.population === state.population) return state;
      // Items and branches differ by population, so ticks from the previous selection are cleared.
      return { ...state, population: action.population, checks: {} };
    case 'toggle-check': {
      const current = state.checks[action.presentationId] ?? [];
      const next = current.includes(action.itemId)
        ? current.filter((i) => i !== action.itemId)
        : [...current, action.itemId];
      return { ...state, checks: { ...state.checks, [action.presentationId]: next } };
    }
    case 'clear-presentation': {
      const checks = { ...state.checks };
      delete checks[action.presentationId];
      return { ...state, checks };
    }
    case 'end-session':
      return { ...INITIAL_SESSION, generation: state.generation + 1 };
  }
}

export function hasPatientData(state: SessionState): boolean {
  return state.population !== null || Object.values(state.checks).some((c) => c.length > 0);
}

interface SessionApi {
  state: SessionState;
  dispatch: (a: SessionAction) => void;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION);
  const api = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
