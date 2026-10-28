/**
 * Reads content files from disk according to the release profile, and builds
 * the release (manifest + content bundle) served to the app.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentFile, ContentTier } from '../../src/content/types.ts';
import type { ReleaseProfile } from '../../src/content/status.ts';
import type { ReleaseManifest, ReleaseBundle } from '../../src/content/release.ts';
import { RELEASE_FORMAT } from '../../src/content/release.ts';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT_DIR = path.join(ROOT_DIR, 'content');

/** Which content folders each profile may include. */
const PROFILE_FOLDERS: Record<ReleaseProfile, { folder: string; tier: ContentTier }[]> = {
  preview: [
    { folder: 'references', tier: 'main' },
    { folder: 'observations', tier: 'main' },
    { folder: 'medications', tier: 'main' },
    { folder: 'presentations', tier: 'main' },
    { folder: 'templates', tier: 'template' },
    { folder: 'examples', tier: 'example' },
  ],
  personal: [],
  organisational: [],
};

export class ProfileNotEnabledError extends Error {}

export function parseProfile(value: string | undefined): ReleaseProfile {
  const profile = value ?? 'preview';
  if (profile !== 'preview' && profile !== 'personal' && profile !== 'organisational') {
    throw new Error(`Unknown CARPA_CONTENT_PROFILE "${profile}". Use preview, personal or organisational.`);
  }
  return profile;
}

function listJson(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.sort().flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listJson(full);
    return name.endsWith('.json') ? [full] : [];
  });
}

export function collectContentFiles(profile: ReleaseProfile, contentDir = CONTENT_DIR): ContentFile[] {
  if (profile !== 'preview') {
    throw new ProfileNotEnabledError(
      `Release profile "${profile}" is not enabled yet. Clinical release profiles require approval records and release controls (Phase 5). Only "preview" builds are available.`,
    );
  }
  return PROFILE_FOLDERS[profile].flatMap(({ folder, tier }) =>
    listJson(path.join(contentDir, folder)).map((full) => ({
      path: path.relative(contentDir, full).split(path.sep).join('/'),
      tier,
      text: readFileSync(full, 'utf8'),
    })),
  );
}

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

export function buildRelease(
  profile: ReleaseProfile,
  appVersion: string,
  contentDir = CONTENT_DIR,
): { manifest: ReleaseManifest; bundleText: string } {
  const files = collectContentFiles(profile, contentDir);
  const bundle: ReleaseBundle = { format: RELEASE_FORMAT, files };
  const bundleText = JSON.stringify(bundle);
  const epoch = process.env.SOURCE_DATE_EPOCH;
  const builtAt = epoch ? new Date(Number(epoch) * 1000).toISOString() : new Date().toISOString();
  const contentSha256 = sha256(bundleText);
  const manifest: ReleaseManifest = {
    format: RELEASE_FORMAT,
    releaseId: `${profile}-${contentSha256.slice(0, 12)}`,
    profile,
    builtAt,
    appVersion,
    schemaMajor: 1,
    contentFile: 'content.json',
    contentSha256,
    files: files.map((f) => ({ path: f.path, tier: f.tier, sha256: sha256(f.text) })),
    validUntil: null,
  };
  return { manifest, bundleText };
}
