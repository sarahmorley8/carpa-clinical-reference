import { useState, type ReactNode } from 'react';
import { goBack, hrefFor, type Route } from '../navigation/router.ts';
import { hasPatientData, useSession } from '../state/session.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { Icon, type IconName } from './Icon.tsx';

export function ProfileBanner() {
  return (
    <div className="profile-banner" role="note">
      <strong>PREVIEW BUILD — PERSONAL PROTOTYPE — NOT FOR CLINICAL USE</strong>
    </div>
  );
}

export function EndSessionButton({ compact = false }: { compact?: boolean }) {
  const { state, dispatch } = useSession();
  const [confirming, setConfirming] = useState(false);
  const active = hasPatientData(state);
  return (
    <>
      <button
        type="button"
        className={`btn ${compact ? 'btn--header' : 'btn--secondary btn--block'}${active ? ' btn--active-session' : ''}`}
        onClick={() => setConfirming(true)}
      >
        <Icon name="clear" size={20} />
        <span>End session</span>
      </button>
      {confirming && (
        <ConfirmDialog
          title="End session and clear?"
          message="This clears the patient group and every ticked item from this device's memory. Nothing is saved."
          confirmLabel="Clear everything"
          tone="critical"
          onConfirm={() => {
            dispatch({ type: 'end-session' });
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

export function Header({ title, showBack, actions }: { title: string; showBack: boolean; actions?: ReactNode }) {
  return (
    <header className="app-header">
      {showBack ? (
        <button type="button" className="btn btn--header btn--icon" onClick={goBack} aria-label="Back">
          <Icon name="back" />
        </button>
      ) : (
        <span className="app-header__spacer" />
      )}
      <h1 className="app-header__title">{title}</h1>
      <div className="app-header__actions">
        {actions}
        <EndSessionButton compact />
      </div>
    </header>
  );
}

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: { name: 'home' }, label: 'Home', icon: 'home' },
  { route: { name: 'browse' }, label: 'Browse', icon: 'list' },
  { route: { name: 'tools' }, label: 'Tools', icon: 'tools' },
  { route: { name: 'settings' }, label: 'Settings', icon: 'settings' },
];

export function BottomNav({ current }: { current: Route['name'] }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((n) => (
        <a
          key={n.label}
          href={hrefFor(n.route)}
          className="bottom-nav__item"
          aria-current={current === n.route.name ? 'page' : undefined}
        >
          <Icon name={n.icon} />
          <span>{n.label}</span>
        </a>
      ))}
    </nav>
  );
}
