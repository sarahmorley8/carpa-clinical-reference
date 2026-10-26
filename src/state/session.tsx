/**
 * Patient working state. Held in memory ONLY: never written to storage, URLs or logs.
 * Lost when the app is closed or reloaded, and cleared by "End session" or 60 minutes
 * of inactivity.
 */
import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { Answer } from '../decision-engine/evaluate.ts';
import { timerReducer, type Timer, type TimerAction } from '../tools/timers.ts';

export type IsbarSection = 'identify' | 'situation' | 'background' | 'assessment' | 'recommendation';
export type IsbarDraft = Record<IsbarSection, string>;
export const EMPTY_ISBAR: IsbarDraft = {
  identify: '',
  situation: '',
  background: '',
  assessment: '',
  recommendation: '',
};

export interface SessionState {
  /** Selected patient group, or null = not selected (all items shown, labelled). */
  population: string | null;
  /** Ticked checklist item ids, per presentation id. */
  checks: Record<string, string[]>;
  /** Pathway answers, per presentation id. */
  answers: Record<string, Record<string, Answer>>;
  /** Earlier rounds of answers set aside by "reassess", per presentation id (oldest first). */
  rounds: Record<string, Record<string, Answer>[]>;
  timers: Timer[];
  isbar: IsbarDraft;
  /** Increments on every clear, so screens holding local state can reset. */
  generation: number;
  /** Why the last clear happened, for a one-off notice. */
  lastClear: 'user' | 'inactivity' | null;
}

export type SessionAction =
  | { type: 'set-population'; population: string | null }
  | { type: 'toggle-check'; presentationId: string; itemId: string }
  | { type: 'set-answers'; presentationId: string; answers: Record<string, Answer> }
  | { type: 'reassess'; presentationId: string; answers: Record<string, Answer>; previous: Record<string, Answer> }
  | { type: 'clear-presentation'; presentationId: string }
  | { type: 'restart-pathway'; presentationId: string }
  | { type: 'timer'; action: TimerAction }
  | { type: 'set-isbar'; isbar: IsbarDraft }
  | { type: 'end-session'; reason?: 'user' | 'inactivity' }
  | { type: 'dismiss-clear-notice' };

export const INITIAL_SESSION: SessionState = {
  population: null,
  checks: {},
  answers: {},
  rounds: {},
  timers: [],
  isbar: EMPTY_ISBAR,
  generation: 0,
  lastClear: null,
};

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'set-population':
      if (action.population === state.population) return state;
      // Items, branches and doses differ by population, so work done for the previous selection is cleared.
      return { ...state, population: action.population, checks: {}, answers: {}, rounds: {} };
    case 'toggle-check': {
      const current = state.checks[action.presentationId] ?? [];
      const next = current.includes(action.itemId)
        ? current.filter((i) => i !== action.itemId)
        : [...current, action.itemId];
      return { ...state, checks: { ...state.checks, [action.presentationId]: next } };
    }
    case 'set-answers':
      return { ...state, answers: { ...state.answers, [action.presentationId]: action.answers } };
    case 'reassess':
      return {
        ...state,
        answers: { ...state.answers, [action.presentationId]: action.answers },
        rounds: {
          ...state.rounds,
          [action.presentationId]: [...(state.rounds[action.presentationId] ?? []), action.previous],
        },
      };
    case 'clear-presentation':
      return {
        ...state,
        checks: omit(state.checks, action.presentationId),
        answers: omit(state.answers, action.presentationId),
        rounds: omit(state.rounds, action.presentationId),
      };
    case 'restart-pathway':
      return {
        ...state,
        answers: omit(state.answers, action.presentationId),
        rounds: omit(state.rounds, action.presentationId),
      };
    case 'timer':
      return { ...state, timers: timerReducer(state.timers, action.action) };
    case 'set-isbar':
      return { ...state, isbar: action.isbar };
    case 'end-session':
      return { ...INITIAL_SESSION, generation: state.generation + 1, lastClear: action.reason ?? 'user' };
    case 'dismiss-clear-notice':
      return { ...state, lastClear: null };
  }
}

export function hasPatientData(state: SessionState): boolean {
  return (
    state.population !== null ||
    Object.values(state.checks).some((c) => c.length > 0) ||
    Object.values(state.answers).some((a) => Object.keys(a).length > 0) ||
    state.timers.length > 0 ||
    Object.values(state.isbar).some((t) => t.trim() !== '')
  );
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
