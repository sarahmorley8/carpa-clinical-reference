import { useRelease } from '../app/ContentContext.tsx';
import { hrefFor } from '../navigation/router.ts';
import { PREFERENCES_KEY, TEXT_SCALES, type Theme } from '../state/preferences.ts';
import { usePreferences } from '../state/PreferencesContext.tsx';
import { EndSessionButton } from '../components/AppShell.tsx';
import { ContactCard } from '../components/Escalation.tsx';
import { Icon } from '../components/Icon.tsx';
import { PresentationLink } from './HomeScreen.tsx';
import { DisclaimerText } from './Disclaimer.tsx';

export function BrowseScreen() {
  const { release } = useRelease();
  const presentations = [...release.store.presentations.values()];
  return (
    <div className="screen">
      <ul className="link-list">
        {[...release.store.refs['body-systems'].values()].map((s) => {
          const count = presentations.filter((p) => p.data.bodySystems.includes(s.id)).length;
          return (
            <li key={s.id}>
              <a className="list-link" href={hrefFor({ name: 'system', id: s.id })}>
                <span className="list-link__title">{s.label}</span>
                <span className="list-link__count">{count}</span>
                <Icon name="chevron" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SystemScreen({ id }: { id: string }) {
  const { release } = useRelease();
  const items = [...release.store.presentations.values()]
    .filter((p) => p.data.bodySystems.includes(id))
    .sort((a, b) => a.data.meta.title.localeCompare(b.data.meta.title));
  return (
    <div className="screen">
      {items.length === 0 ? (
        <p className="empty">No presentations entered for this body system yet. Use the manual.</p>
      ) : (
        <ul className="link-list">
          {items.map((p) => (
            <li key={p.data.meta.id}>
              <PresentationLink id={p.data.meta.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CriticalCategoryScreen({ id }: { id: string }) {
  const { release } = useRelease();
  const cat = release.store.refs['critical-categories'].get(id);
  return (
    <div className="screen">
      <ul className="link-list">
        {(cat?.presentationIds ?? []).map((pid) => (
          <li key={pid}>
            <PresentationLink id={pid} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ToolsScreen() {
  const tools = [
    ['Weight-based dose calculator', 'Synthetic test harness only. Not enabled for patient care.'],
    ['Timers', 'Repeat observations, reassessment, repeat doses, CPR cycles.'],
    ['ISBAR handover', 'Build a handover from what you tick. Never saved.'],
  ];
  return (
    <div className="screen">
      <a className="list-link" href={hrefFor({ name: 'contacts' })}>
        <Icon name="phone" />
        <span className="list-link__title">Contacts (medical officer, retrieval)</span>
        <Icon name="chevron" />
      </a>
      <h2 className="list-heading">Coming in Phase 3</h2>
      <ul className="tool-list">
        {tools.map(([name, desc]) => (
          <li key={name} className="tool-list__item">
            <strong>{name}</strong>
            <span>{desc}</span>
            <span className="pill pill--neutral">NOT YET AVAILABLE</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ContactsScreen() {
  const { release } = useRelease();
  return (
    <div className="screen">
      <p className="note">This app does not contact anyone for you. Follow your local procedures.</p>
      {[...release.store.refs.contacts.values()].map((c) => (
        <ContactCard key={c.id} contact={c} />
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const { release } = useRelease();
  const { prefs, setTheme, setTextScale } = usePreferences();
  const m = release.manifest;
  const themes: [Theme, string][] = [
    ['system', 'Match phone'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ];
  return (
    <div className="screen">
      <section className="settings-group" aria-labelledby="display-heading">
        <h2 id="display-heading" className="list-heading">
          Display
        </h2>
        <div className="field">
          <div className="field__label" id="theme-label">
            Colour theme
          </div>
          <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
            {themes.map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={prefs.theme === t}
                className="segmented__option"
                onClick={() => setTheme(t)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field__label" id="text-label">
            Text size
          </div>
          <div className="segmented" role="radiogroup" aria-labelledby="text-label">
            {TEXT_SCALES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={prefs.textScale === s}
                aria-label={`Text size ${Math.round(s * 100)} percent`}
                className="segmented__option"
                onClick={() => setTextScale(s)}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="session-heading">
        <h2 id="session-heading" className="list-heading">
          Patient session
        </h2>
        <p className="note">
          Ticked items and the patient group are kept in memory only, and cleared when you end the session or close the
          app.
        </p>
        <EndSessionButton />
      </section>

      <section className="settings-group" aria-labelledby="offline-heading">
        <h2 id="offline-heading" className="list-heading">
          Offline readiness
        </h2>
        <div className="callout callout--caution">
          <strong>Not available offline yet.</strong> Offline support and its verification check arrive in Phase 3. This
          preview needs an internet connection.
        </div>
      </section>

      <section className="settings-group" aria-labelledby="version-heading">
        <h2 id="version-heading" className="list-heading">
          Versions
        </h2>
        <dl className="facts">
          <dt>App version</dt>
          <dd>{__APP_VERSION__}</dd>
          <dt>Build type</dt>
          <dd>{m.profile} (not for clinical use)</dd>
          <dt>Content release</dt>
          <dd className="mono">{m.releaseId}</dd>
          <dt>Content built</dt>
          <dd>{new Date(m.builtAt).toLocaleString('en-AU')}</dd>
          <dt>Presentations</dt>
          <dd>
            {release.store.presentations.size} loaded, {release.store.rejected.length} blocked
          </dd>
        </dl>
        {release.store.rejected.length > 0 && (
          <a className="list-link" href={hrefFor({ name: 'problems' })}>
            <span className="list-link__title">Content problems ({release.store.rejected.length})</span>
            <Icon name="chevron" />
          </a>
        )}
      </section>

      <section className="settings-group" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="list-heading">
          Privacy
        </h2>
        <ul className="plain-list">
          <li>No patient information is saved on this device or sent anywhere.</li>
          <li>
            Saved on this device: display settings, favourites and recently viewed presentation names (key{' '}
            <span className="mono">{PREFERENCES_KEY}</span>).
          </li>
          <li>No analytics, tracking or accounts.</li>
          <li>
            Things this app cannot control: your phone&apos;s clipboard history, app-switcher screenshots, screen
            recording and keyboard learning.
          </li>
        </ul>
      </section>

      <section className="settings-group" aria-labelledby="disclaimer-heading">
        <h2 id="disclaimer-heading" className="list-heading">
          Disclaimer
        </h2>
        <DisclaimerText />
      </section>
    </div>
  );
}

export function ProblemsScreen() {
  const { release } = useRelease();
  const { rejected, warnings } = release.store;
  return (
    <div className="screen">
      <p className="note">
        Files listed here failed checks and are blocked. Fix them in the content folder; run{' '}
        <span className="mono">npm run validate-content</span> for the same report.
      </p>
      {rejected.length === 0 && <p className="empty">No blocked files.</p>}
      {rejected.map((r) => (
        <article key={r.file.path} className="problem">
          <h2 className="problem__file">
            <span className="pill pill--critical">BLOCKED</span> content/{r.file.path}
          </h2>
          {r.title && <div className="problem__title">{r.title}</div>}
          <ul className="problem__list">
            {r.errors.map((e, i) => (
              <li key={i}>
                <div className="problem__where">{e.location}</div>
                <div>{e.message}</div>
                {e.value !== undefined && <div className="problem__value">Found: {e.value}</div>}
                {e.expected !== undefined && <div className="problem__value">Expected: {e.expected}</div>}
              </li>
            ))}
          </ul>
        </article>
      ))}
      {warnings.length > 0 && (
        <>
          <h2 className="list-heading">Warnings ({warnings.length}) — not blocking</h2>
          <ul className="problem__list">
            {warnings.map((w, i) => (
              <li key={i}>
                <div className="problem__where">
                  content/{w.file} — {w.location}
                </div>
                <div>{w.message}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
