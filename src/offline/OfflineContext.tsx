/**
 * Offline status and safe updates (production builds only).
 *
 * "Offline ready" is only shown after the service worker has re-checked every cached
 * file against its expected SHA-256 — never merely because a service worker exists.
 * Updates download in the background but are applied only when the user taps, and only
 * when no patient session is open.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePreferences } from '../state/PreferencesContext.tsx';

export type Readiness =
  | { status: 'unsupported'; detail: string }
  | { status: 'development'; detail: string }
  | { status: 'installing'; detail: string }
  | { status: 'checking'; detail: string }
  | { status: 'ready'; detail: string; fileCount: number; releaseId: string }
  | { status: 'not-ready'; detail: string };

export type UpdateState = 'none' | 'downloading' | 'ready' | 'failed';

export interface OfflineApi {
  readiness: Readiness;
  update: UpdateState;
  verify: () => void;
  checkForUpdate: () => void;
  applyUpdate: () => void;
}

export interface BuildInfo {
  cacheName: string;
  buildId: string;
  releaseId: string;
  files: { url: string; sha256: string }[];
}

export interface VerifyResult {
  ok: boolean;
  releaseId: string;
  fileCount: number;
  missing: string[];
  corrupted: string[];
}

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

function askWorker(worker: ServiceWorker, timeoutMs = 10_000): Promise<BuildInfo> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error('No answer from the offline worker.')), timeoutMs);
    channel.port1.onmessage = (e: MessageEvent<BuildInfo>) => {
      window.clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage({ type: 'BUILD_INFO' }, [channel.port2]);
  });
}

/** Re-check every file the worker expects: present in its cache and matching its SHA-256. */
export async function verifyCache(info: BuildInfo, base: string = window.location.href): Promise<VerifyResult> {
  const cache = await caches.open(info.cacheName);
  const missing: string[] = [];
  const corrupted: string[] = [];
  for (const file of info.files) {
    const hit = await cache.match(new URL(file.url, base).href);
    if (!hit) missing.push(file.url);
    else if ((await sha256Hex(await hit.arrayBuffer())) !== file.sha256) corrupted.push(file.url);
  }
  return {
    ok: !missing.length && !corrupted.length,
    releaseId: info.releaseId,
    fileCount: info.files.length,
    missing,
    corrupted,
  };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const Ctx = createContext<OfflineApi>({
  readiness: { status: 'development', detail: '' },
  update: 'none',
  verify: () => undefined,
  checkForUpdate: () => undefined,
  applyUpdate: () => undefined,
});

export function OfflineProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const { recordUpdateCheck: recordUpdateCheckFn } = usePreferences();
  // Keep a stable reference: preferences functions change whenever preferences change, and the
  // registration effect must not re-run (and re-register) because of that.
  const recordRef = useRef(recordUpdateCheckFn);
  useEffect(() => {
    recordRef.current = recordUpdateCheckFn;
  }, [recordUpdateCheckFn]);
  const recordUpdateCheck = useCallback((t: number) => recordRef.current(t), []);
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const [readiness, setReadiness] = useState<Readiness>(() =>
    !enabled
      ? {
          status: 'development',
          detail: 'Offline support is only active in built releases, not in development or tests.',
        }
      : !supported
        ? { status: 'unsupported', detail: 'This browser does not support offline web apps.' }
        : { status: 'installing', detail: 'Downloading and checking the app for offline use…' },
  );
  const [update, setUpdate] = useState<UpdateState>('none');
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const lastCheck = useRef(0);

  const verify = useCallback(() => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) {
      setReadiness({ status: 'installing', detail: 'Downloading and checking the app for offline use…' });
      return;
    }
    setReadiness({ status: 'checking', detail: 'Checking every saved file…' });
    askWorker(worker)
      .then((info) => verifyCache(info, new URL('./', window.location.href).href))
      .then((r) => {
        if (r.ok) {
          setReadiness({
            status: 'ready',
            detail: `All ${r.fileCount} files are saved on this device and match the release.`,
            fileCount: r.fileCount,
            releaseId: r.releaseId,
          });
          void navigator.storage?.persist?.().catch(() => undefined);
        } else {
          const problems = [...r.missing.map((f) => `missing: ${f}`), ...r.corrupted.map((f) => `damaged: ${f}`)];
          setReadiness({
            status: 'not-ready',
            detail: `Some files are not available offline (${problems.slice(0, 3).join('; ')}). Connect to the internet to repair.`,
          });
        }
      })
      .catch((e: unknown) => setReadiness({ status: 'not-ready', detail: String(e instanceof Error ? e.message : e) }));
  }, []);

  const watchInstalling = useCallback((reg: ServiceWorkerRegistration) => {
    const worker = reg.installing;
    if (!worker) return;
    const isUpdate = Boolean(navigator.serviceWorker.controller);
    if (isUpdate) setUpdate('downloading');
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && isUpdate) setUpdate('ready');
      if (worker.state === 'redundant' && isUpdate && reg.waiting !== worker) setUpdate('failed');
      if (worker.state === 'redundant' && !isUpdate)
        setReadiness({
          status: 'not-ready',
          detail: 'The offline download failed. Connect to the internet and reopen the app.',
        });
    });
  }, []);

  const checkForUpdate = useCallback(() => {
    const reg = registration.current;
    if (!reg) return;
    lastCheck.current = Date.now();
    reg
      .update()
      .then(() => recordUpdateCheck(Date.now()))
      .catch(() => undefined); // offline: try again later
  }, [recordUpdateCheck]);

  useEffect(() => {
    if (!enabled || !supported) return;
    let cancelled = false;
    const sw = navigator.serviceWorker;
    // If a worker already controls the page, a later controller change can only be an update
    // the user applied (SKIP_WAITING), so reload into it. On first install the new worker
    // claims the page; then we verify instead of reloading.
    let hadController = Boolean(sw.controller);
    const onController = () => {
      if (hadController) window.location.reload();
      else {
        hadController = true;
        verify();
      }
    };
    sw.addEventListener('controllerchange', onController);
    sw.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then((reg) => {
        if (cancelled) return;
        registration.current = reg;
        if (reg.waiting && sw.controller) setUpdate('ready');
        watchInstalling(reg);
        reg.addEventListener('updatefound', () => watchInstalling(reg));
        recordUpdateCheck(Date.now());
        lastCheck.current = Date.now();
        if (sw.controller) verify();
      })
      .catch((e: unknown) => setReadiness({ status: 'not-ready', detail: `Offline setup failed: ${String(e)}` }));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheck.current > UPDATE_CHECK_INTERVAL_MS)
        checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      sw.removeEventListener('controllerchange', onController);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, supported, verify, watchInstalling, checkForUpdate, recordUpdateCheck]);

  const applyUpdate = useCallback(() => {
    registration.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  const api = useMemo(
    () => ({ readiness, update, verify, checkForUpdate, applyUpdate }),
    [readiness, update, verify, checkForUpdate, applyUpdate],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOffline(): OfflineApi {
  return useContext(Ctx);
}
