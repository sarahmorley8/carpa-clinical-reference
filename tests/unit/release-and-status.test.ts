import { describe, expect, it } from 'vitest';
import { buildRelease, collectContentFiles, ProfileNotEnabledError } from '../../scripts/lib/collect.ts';
import { ReleaseError, verifyRelease, sha256Hex } from '../../src/content/release.ts';
import { measureCompleteness } from '../../src/content/placeholders.ts';
import { displayStatus, localToday } from '../../src/content/status.ts';
import type { Meta } from '../../src/content/types.ts';
import { validators } from '../helpers.ts';

describe('release profiles', () => {
  it('clinical profiles are not enabled before Phase 5', () => {
    expect(() => collectContentFiles('personal')).toThrow(ProfileNotEnabledError);
    expect(() => collectContentFiles('organisational')).toThrow(ProfileNotEnabledError);
  });

  it('preview includes templates and examples, tagged by tier', () => {
    const tiers = new Set(collectContentFiles('preview').map((f) => f.tier));
    expect([...tiers].sort()).toEqual(['example', 'main', 'template']);
  });
});

describe('release integrity on the device', () => {
  it('a genuine release loads', async () => {
    const { manifest, bundleText } = buildRelease('preview', 'test');
    expect(await sha256Hex(bundleText)).toBe(manifest.contentSha256);
    const loaded = await verifyRelease(manifest, bundleText, 'preview', validators);
    expect(loaded.store.presentations.size).toBe(6);
  });

  it('a tampered bundle is blocked entirely', async () => {
    const { manifest, bundleText } = buildRelease('preview', 'test');
    const tampered = bundleText.replace('Template', 'Tampered');
    await expect(verifyRelease(manifest, tampered, 'preview', validators)).rejects.toThrow(ReleaseError);
  });

  it('a release for another profile or schema is refused', async () => {
    const { manifest, bundleText } = buildRelease('preview', 'test');
    await expect(
      verifyRelease({ ...manifest, profile: 'personal' }, bundleText, 'preview', validators),
    ).rejects.toThrow(/different kind of build/);
    await expect(verifyRelease({ ...manifest, schemaMajor: 2 }, bundleText, 'preview', validators)).rejects.toThrow(
      /not compatible/,
    );
    await expect(verifyRelease({ nonsense: true }, bundleText, 'preview', validators)).rejects.toThrow(/damaged/);
  });

  it('a file whose hash does not match the manifest is blocked', async () => {
    const { manifest, bundleText } = buildRelease('preview', 'test');
    const bad = { ...manifest, files: manifest.files.map((f, i) => (i === 0 ? { ...f, sha256: '0'.repeat(64) } : f)) };
    await expect(verifyRelease(bad, bundleText, 'preview', validators)).rejects.toThrow(/integrity/);
  });
});

const meta = (over: Partial<Meta> = {}): Meta => ({
  id: 'x',
  title: 'X',
  contentVersion: '1.0.0',
  status: 'draft',
  populations: ['adult'],
  sources: [{ sourceId: 's', section: 'a', page: '1' }],
  extracted: { date: '2026-01-01', by: 'Sarah' },
  review: { reviewedDate: null, reviewer: null, approvalDate: null, nextReviewDate: null },
  supersededBy: null,
  dependsOn: [],
  ...over,
});
const complete = { placeholders: 0, missingNumbers: 0, examples: [] };
const codes = (m: Meta, isTemplate = false, c = complete) =>
  displayStatus(m, c, isTemplate, '2026-10-26').badges.map((b) => b.code);

describe('display status', () => {
  it('nothing is usable as clinical guidance in this phase, whatever the file says', () => {
    const published = meta({
      status: 'published',
      review: {
        reviewedDate: '2026-01-02',
        reviewer: { name: 'Dr A', role: 'MO' },
        approvalDate: '2026-01-02',
        nextReviewDate: '2027-01-01',
      },
    });
    const s = displayStatus(published, complete, false, '2026-10-26');
    expect(s.usableAsGuidance).toBe(false);
    expect(s.badges.map((b) => b.code)).toEqual(['approval-unverified']);
  });

  it('labels demonstration, template, incomplete and draft content', () => {
    expect(codes(meta({ demonstration: true }))).toEqual(['demonstration', 'draft']);
    expect(codes(meta(), true, { placeholders: 3, missingNumbers: 0, examples: [] })).toEqual(['template', 'draft']);
    expect(codes(meta(), false, { placeholders: 0, missingNumbers: 2, examples: [] })).toEqual(['incomplete', 'draft']);
  });

  it('shows REVIEW OVERDUE (still visible, not hidden) once the review date passes', () => {
    const m = meta({
      review: { reviewedDate: null, reviewer: null, approvalDate: null, nextReviewDate: '2026-10-25' },
    });
    expect(codes(m)).toContain('review-overdue');
    const notYet = meta({
      review: { reviewedDate: null, reviewer: null, approvalDate: null, nextReviewDate: '2026-10-26' },
    });
    expect(codes(notYet)).not.toContain('review-overdue');
  });

  it('flags self-review', () => {
    const m = meta({
      review: {
        reviewedDate: '2026-01-02',
        reviewer: { name: ' sarah ', role: 'RAN' },
        approvalDate: null,
        nextReviewDate: null,
      },
    });
    expect(codes(m)).toContain('self-reviewed');
  });

  it('localToday formats the local date', () => {
    expect(localToday(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('placeholder detection', () => {
  it('counts placeholder text and missing numbers but ignores authoring notes', () => {
    const c = measureCompleteness({
      a: '[ENTER X]',
      dose: { amount: null, unit: 'mg' },
      other: null,
      meta: { authoringNotes: ['[ENTER ignored]'] },
      list: [{ low: 1, high: null }],
    });
    expect(c.placeholders).toBe(1);
    expect(c.missingNumbers).toBe(2);
  });
});
