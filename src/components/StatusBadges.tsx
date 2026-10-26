import type { StatusBadge } from '../content/status.ts';
import { Icon } from './Icon.tsx';

const ICON = { critical: 'alert', caution: 'caution', demo: 'info', neutral: 'info' } as const;

export function StatusBadges({ badges }: { badges: StatusBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <ul className="status-badges" aria-label="Content status">
      {badges.map((b) => (
        <li key={b.code} className={`status-badge status-badge--${b.tone}`}>
          <Icon name={ICON[b.tone]} size={20} />
          <span>
            <strong>{b.label}</strong>
            <span className="status-badge__desc">{b.description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Compact one-line marker for lists. */
export function StatusPill({ badges }: { badges: StatusBadge[] }) {
  const first = badges.find((b) => b.tone === 'critical') ?? badges.find((b) => b.tone === 'demo') ?? badges[0];
  if (!first) return null;
  const short: Record<StatusBadge['code'], string> = {
    demonstration: 'DEMO',
    template: 'TEMPLATE',
    incomplete: 'INCOMPLETE',
    draft: 'DRAFT',
    'under-review': 'UNDER REVIEW',
    'approved-unpublished': 'NOT PUBLISHED',
    'approval-unverified': 'UNVERIFIED',
    superseded: 'SUPERSEDED',
    'review-overdue': 'REVIEW OVERDUE',
    'self-reviewed': 'SELF-REVIEWED',
  };
  return <span className={`pill pill--${first.tone}`}>{short[first.code]}</span>;
}
