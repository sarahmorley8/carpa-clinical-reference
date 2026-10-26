/**
 * Decides how a content unit must be labelled on screen.
 *
 * In this phase NOTHING is usable as clinical guidance: approval records and
 * release signing arrive in Phase 5. A JSON "status" field alone is never
 * treated as proof of approval.
 */
import type { Meta } from './types.ts';
import { isComplete, type Completeness } from './placeholders.ts';

export type ReleaseProfile = 'preview' | 'personal' | 'organisational';

export type BadgeTone = 'critical' | 'caution' | 'demo' | 'neutral';

export interface StatusBadge {
  code:
    | 'demonstration'
    | 'template'
    | 'incomplete'
    | 'draft'
    | 'under-review'
    | 'approved-unpublished'
    | 'approval-unverified'
    | 'superseded'
    | 'review-overdue'
    | 'self-reviewed';
  label: string;
  description: string;
  tone: BadgeTone;
}

export interface DisplayStatus {
  /** Whether the app may present this content as clinical guidance. Always false before Phase 5. */
  usableAsGuidance: false;
  badges: StatusBadge[];
}

/** today: YYYY-MM-DD in local time. */
export function displayStatus(
  meta: Meta,
  completeness: Completeness,
  isTemplate: boolean,
  today: string,
): DisplayStatus {
  const badges: StatusBadge[] = [];
  if (meta.demonstration) {
    badges.push({
      code: 'demonstration',
      label: 'DEMONSTRATION ONLY — NOT FOR CLINICAL USE',
      description: 'Made-up content that shows how the app works. It is not from any clinical manual.',
      tone: 'demo',
    });
  }
  if (isTemplate) {
    badges.push({
      code: 'template',
      label: 'TEMPLATE — NO CLINICAL CONTENT ENTERED',
      description: 'An empty template. Every clinical item is a placeholder.',
      tone: 'caution',
    });
  } else if (!isComplete(completeness)) {
    badges.push({
      code: 'incomplete',
      label: `INCOMPLETE — ${completeness.placeholders + completeness.missingNumbers} ITEM(S) NOT ENTERED`,
      description: 'Some text or numbers have not been entered from the source yet.',
      tone: 'caution',
    });
  }
  switch (meta.status) {
    case 'draft':
      badges.push({
        code: 'draft',
        label: 'DRAFT — NOT APPROVED',
        description: 'Not reviewed or approved.',
        tone: 'caution',
      });
      break;
    case 'under-review':
      badges.push({
        code: 'under-review',
        label: 'UNDER REVIEW — NOT APPROVED',
        description: 'Waiting for review. Do not rely on it.',
        tone: 'caution',
      });
      break;
    case 'approved':
      badges.push({
        code: 'approved-unpublished',
        label: 'APPROVED — NOT YET PUBLISHED',
        description: 'Approved but not yet released as clinical content.',
        tone: 'caution',
      });
      break;
    case 'published':
      badges.push({
        code: 'approval-unverified',
        label: 'APPROVAL NOT VERIFIED',
        description: 'The file says "published", but this build cannot verify approval records yet (Phase 5).',
        tone: 'caution',
      });
      break;
    case 'superseded':
      badges.push({
        code: 'superseded',
        label: 'SUPERSEDED — DO NOT USE',
        description: `Replaced by "${meta.supersededBy ?? '?'}".`,
        tone: 'critical',
      });
      break;
  }
  if (meta.review.nextReviewDate && meta.review.nextReviewDate < today) {
    badges.push({
      code: 'review-overdue',
      label: 'REVIEW OVERDUE — VERIFY AGAINST MANUAL',
      description: `The review date (${meta.review.nextReviewDate}) has passed. Check against the current manual.`,
      tone: 'critical',
    });
  }
  if (
    meta.review.reviewer &&
    meta.review.reviewer.name.trim().toLowerCase() === meta.extracted.by.trim().toLowerCase()
  ) {
    badges.push({
      code: 'self-reviewed',
      label: 'SELF-REVIEWED — NOT INDEPENDENTLY VERIFIED',
      description: 'The person who entered this content also reviewed it.',
      tone: 'caution',
    });
  }
  return { usableAsGuidance: false, badges };
}

/** Local calendar date as YYYY-MM-DD. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
