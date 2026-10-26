import { useMemo, useState } from 'react';
import { useRelease, useToday } from '../app/ContentContext.tsx';
import { displayStatus } from '../content/status.ts';
import { findRejected } from '../content/validate.ts';
import { hrefFor, type Route } from '../navigation/router.ts';
import { usePreferences } from '../state/PreferencesContext.tsx';
import { Icon } from '../components/Icon.tsx';
import { LandscapeBand } from '../components/LandscapeBand.tsx';
import { PopulationSwitch } from '../components/PopulationSwitch.tsx';
import { StatusPill } from '../components/StatusBadges.tsx';

/** Link to a presentation, with its status pill. */
export function PresentationLink({ id }: { id: string }) {
  const { release } = useRelease();
  const today = useToday();
  const loaded = release.store.presentations.get(id);
  if (!loaded) {
    const blocked = findRejected(release.store, id) !== undefined;
    return (
      <a className="list-link list-link--blocked" href={hrefFor({ name: 'presentation', id })}>
        <span className="list-link__title">{id}</span>
        <span className="pill pill--critical">{blocked ? 'CONTENT ERROR' : 'MISSING'}</span>
      </a>
    );
  }
  const status = displayStatus(loaded.data.meta, loaded.completeness, loaded.file.tier === 'template', today);
  return (
    <a className="list-link" href={hrefFor({ name: 'presentation', id })}>
      <span className="list-link__title">{loaded.data.meta.title}</span>
      <StatusPill badges={status.badges} />
      <Icon name="chevron" />
    </a>
  );
}

function criticalTarget(presentationIds: string[], categoryId: string): Route | null {
  if (presentationIds.length === 0) return null;
  if (presentationIds.length === 1) return { name: 'presentation', id: presentationIds[0]! };
  return { name: 'critical', id: categoryId };
}

export function HomeScreen() {
  const { release, search } = useRelease();
  const { prefs } = usePreferences();
  const [query, setQuery] = useState('');
  const results = useMemo(() => search.search(query), [search, query]);
  const store = release.store;
  const categories = [...store.refs['critical-categories'].values()];
  const recents = prefs.recents.filter((id) => store.presentations.has(id));
  const favourites = prefs.favourites.filter((id) => store.presentations.has(id));
  const demos = [...store.presentations.values()].filter((p) => p.data.meta.demonstration);

  return (
    <div className="screen">
      <LandscapeBand />
      {store.rejected.length > 0 && (
        <a className="callout callout--caution callout--link" href={hrefFor({ name: 'problems' })}>
          <Icon name="caution" />
          <span>
            <strong>{store.rejected.length} content file(s) have errors and are blocked.</strong> Tap for details.
          </span>
        </a>
      )}

      <section aria-labelledby="critical-heading" className="critical">
        <h2 id="critical-heading" className="critical__heading">
          <Icon name="alert" />
          CRITICAL
        </h2>
        <div className="critical__grid">
          {categories.map((c) => {
            const target = criticalTarget(c.presentationIds, c.id);
            return target ? (
              <a key={c.id} className="critical__tile" href={hrefFor(target)}>
                {c.label}
              </a>
            ) : (
              <div key={c.id} className="critical__tile critical__tile--empty">
                {c.label}
                <span className="critical__empty">No content yet — use the manual</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="search">
        <label htmlFor="search-input" className="search__label">
          Search presentations
        </label>
        <div className="search__box">
          <Icon name="search" />
          <input
            id="search-input"
            type="search"
            className="search__input"
            placeholder="Name, symptom or keyword"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
          />
        </div>
        {query.trim() !== '' && (
          <div className="search__results" role="region" aria-live="polite" aria-label="Search results">
            {results.length === 0 ? (
              <p className="empty">No presentations match “{query.trim()}”. Check the manual index.</p>
            ) : (
              <ul className="link-list">
                {results.map((r) => (
                  <li key={r.id}>
                    <PresentationLink id={r.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <PopulationSwitch />

      {favourites.length > 0 && (
        <section aria-labelledby="fav-heading">
          <h2 id="fav-heading" className="list-heading">
            Favourites
          </h2>
          <ul className="link-list">
            {favourites.map((id) => (
              <li key={id}>
                <PresentationLink id={id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recents.length > 0 && (
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="list-heading">
            Recently viewed
          </h2>
          <ul className="link-list">
            {recents.map((id) => (
              <li key={id}>
                <PresentationLink id={id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="browse-heading">
        <h2 id="browse-heading" className="list-heading">
          Browse by body system
        </h2>
        <a className="list-link" href={hrefFor({ name: 'browse' })}>
          <span className="list-link__title">All body systems</span>
          <Icon name="chevron" />
        </a>
      </section>

      {demos.length > 0 && (
        <section aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="list-heading">
            Demonstration (not clinical)
          </h2>
          <ul className="link-list">
            {demos.map((d) => (
              <li key={d.data.meta.id}>
                <PresentationLink id={d.data.meta.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
