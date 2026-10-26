import { useState } from 'react';
import { useRelease } from '../app/ContentContext.tsx';
import { Icon } from '../components/Icon.tsx';
import { hrefFor } from '../navigation/router.ts';
import { usePreferences } from '../state/PreferencesContext.tsx';
import { hasPatientData, useSession } from '../state/session.tsx';
import { useOffline } from './OfflineContext.tsx';

/** Days without a successful update check before the app warns (operational setting, decision D24). */
export const STALE_CHECK_DAYS = 30;

export function daysSince(time: number | null, now = Date.now()): number | null {
  return time === null ? null : Math.floor((now - time) / 86_400_000);
}

export function UpdateBanner() {
  const { update, applyUpdate } = useOffline();
  const { state } = useSession();
  const { release } = useRelease();
  const [dismissed, setDismissed] = useState(false);
  if (update === 'ready') {
    const busy = hasPatientData(state);
    return (
      <div className="callout callout--caution update-banner" role="status">
        <Icon name="info" />
        <div>
          <strong>An update has been downloaded and checked.</strong>
          {busy ? (
            <p>It will be available after you end the patient session. Nothing changes during an assessment.</p>
          ) : (
            <button type="button" className="btn btn--primary btn--small" onClick={applyUpdate}>
              Apply update now
            </button>
          )}
        </div>
      </div>
    );
  }
  if (update === 'failed' && !dismissed) {
    return (
      <div className="callout callout--caution update-banner" role="alert">
        <Icon name="caution" />
        <div>
          <strong>An update could not be installed.</strong>
          <p>
            You are still using the current version (release {release.manifest.releaseId}). It will try again later.
          </p>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => setDismissed(true)}>
            OK
          </button>
        </div>
      </div>
    );
  }
  return null;
}

export function OfflinePill() {
  const { readiness } = useOffline();
  const { prefs } = usePreferences();
  const days = daysSince(prefs.lastUpdateCheck);
  if (readiness.status === 'development') return null;
  const stale = days !== null && days > STALE_CHECK_DAYS;
  const ok = readiness.status === 'ready' && !stale;
  const text =
    readiness.status === 'ready'
      ? stale
        ? `Offline ready · not checked for updates in ${days} days`
        : 'Offline ready'
      : readiness.status === 'checking' || readiness.status === 'installing'
        ? 'Preparing offline use…'
        : 'Not ready for offline use';
  return (
    <a href={hrefFor({ name: 'settings' })} className={`offline-pill offline-pill--${ok ? 'ok' : 'warn'}`}>
      <Icon name={ok ? 'check' : 'caution'} size={18} />
      {text}
    </a>
  );
}

export function OfflineSettings() {
  const { readiness, verify, checkForUpdate, update } = useOffline();
  const { prefs } = usePreferences();
  const days = daysSince(prefs.lastUpdateCheck);
  const tone = readiness.status === 'ready' ? 'ok' : 'caution';
  const label = {
    ready: 'Ready for offline use',
    'not-ready': 'NOT ready for offline use',
    checking: 'Checking…',
    installing: 'Preparing offline use…',
    unsupported: 'Offline not supported in this browser',
    development: 'Offline inactive (development build)',
  }[readiness.status];
  return (
    <>
      <div className={`callout ${tone === 'ok' ? 'callout--ok' : 'callout--caution'}`} role="status">
        <Icon name={tone === 'ok' ? 'check' : 'caution'} />
        <div>
          <strong>{label}</strong>
          <p>{readiness.detail}</p>
        </div>
      </div>
      <dl className="facts">
        <dt>Last successful update check</dt>
        <dd>
          {prefs.lastUpdateCheck ? new Date(prefs.lastUpdateCheck).toLocaleString('en-AU') : 'Never'}
          {days !== null && days > STALE_CHECK_DAYS && (
            <strong className="stale"> — over {STALE_CHECK_DAYS} days ago. Connect to the internet to check.</strong>
          )}
        </dd>
        <dt>Update status</dt>
        <dd>
          {
            {
              none: 'Up to date as of the last check',
              downloading: 'Downloading an update…',
              ready: 'Update ready',
              failed: 'Last update failed; current version kept',
            }[update]
          }
        </dd>
      </dl>
      <p className="note">
        Being online does not mean the clinical content is current. Check the release and review dates against the
        current manual.
      </p>
      {readiness.status !== 'development' && readiness.status !== 'unsupported' && (
        <div className="button-row">
          <button type="button" className="btn btn--secondary" onClick={verify}>
            Re-check offline files
          </button>
          <button type="button" className="btn btn--secondary" onClick={checkForUpdate}>
            Check for updates
          </button>
        </div>
      )}
    </>
  );
}
