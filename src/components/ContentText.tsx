/**
 * Displays content text and citations. Content is always rendered as plain text.
 * Placeholders are shown as "NOT ENTERED" so a blank or a guess is never displayed.
 */
import { isPlaceholder } from '../content/placeholders.ts';
import type { Citation } from '../content/types.ts';
import { useRelease } from '../app/ContentContext.tsx';

export function ContentText({ text }: { text: string }) {
  if (isPlaceholder(text)) {
    return (
      <span className="not-entered">
        <span className="not-entered__tag">NOT ENTERED</span> <span className="not-entered__hint">{text}</span>
      </span>
    );
  }
  return <>{text}</>;
}

export function NumberValue({ value, unit }: { value: number | null; unit?: string }) {
  if (value === null) {
    return (
      <span className="not-entered">
        <span className="not-entered__tag">NOT ENTERED</span>
      </span>
    );
  }
  return (
    <>
      {value}
      {unit ? ` ${unit}` : ''}
    </>
  );
}

export function CiteRef({ cite }: { cite: Citation }) {
  const { release } = useRelease();
  const source = release.store.refs.sources.get(cite.sourceId);
  const missing = isPlaceholder(cite.page) || isPlaceholder(cite.section);
  const name = source?.id === 'carpa-stm' ? 'CARPA STM' : (source?.title ?? cite.sourceId);
  return (
    <span className={`cite${missing ? ' cite--missing' : ''}`}>
      {missing ? `Source: ${name} — page not entered` : `Source: ${name}, ${cite.section}, p.${cite.page}`}
    </span>
  );
}

/** Distinct source pages used by a group of items, for a section heading. */
export function pagesOf(cites: Citation[]): string {
  const pages = [...new Set(cites.filter((c) => !isPlaceholder(c.page)).map((c) => c.page))];
  if (pages.length === 0) return cites.length ? 'Pages not entered' : '';
  return `p.${pages.join(', ')}`;
}
