import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as compiled from 'virtual:carpa-validators';
import { fetchRelease, ReleaseError, type LoadedRelease } from '../content/release.ts';
import type { ValidatorSet } from '../content/validators.ts';
import { localToday } from '../content/status.ts';
import { buildSearchIndex, type SearchIndex } from '../search/search.ts';

export const browserValidators: ValidatorSet = {
  presentation: compiled.presentation,
  medication: compiled.medication,
  'observation-set': compiled.observationSet,
  'reference-list': compiled.referenceList,
};

export type ContentState =
  | { status: 'loading' }
  | { status: 'error'; message: string; detail: string }
  | { status: 'ready'; release: LoadedRelease; search: SearchIndex };

const Ctx = createContext<ContentState>({ status: 'loading' });

export function ContentProvider({ children, release }: { children: ReactNode; release?: LoadedRelease }) {
  const [state, setState] = useState<ContentState>(() =>
    release ? { status: 'ready', release, search: buildSearchIndex(release.store) } : { status: 'loading' },
  );
  useEffect(() => {
    if (release) return;
    let cancelled = false;
    fetchRelease(import.meta.env.BASE_URL, __CONTENT_PROFILE__, browserValidators)
      .then((r) => {
        if (!cancelled) setState({ status: 'ready', release: r, search: buildSearchIndex(r.store) });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ReleaseError) setState({ status: 'error', message: e.message, detail: e.detail });
        else setState({ status: 'error', message: 'Content could not be loaded.', detail: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [release]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useContentState(): ContentState {
  return useContext(Ctx);
}

/** For screens rendered only once content is ready. */
export function useRelease(): { release: LoadedRelease; search: SearchIndex } {
  const s = useContext(Ctx);
  if (s.status !== 'ready') throw new Error('Content not ready');
  return s;
}

export function useToday(): string {
  return useMemo(() => localToday(), []);
}
