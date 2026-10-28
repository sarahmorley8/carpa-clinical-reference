/**
 * Release format and on-device loading.
 *
 * A release is two files served next to the app:
 *   release/manifest.json  – identity, profile, and SHA-256 of every file
 *   release/content.json   – the raw text of every content file
 *
 * On load the app checks the bundle hash and each file hash, then re-runs the
 * full validation pipeline. Anything that fails is blocked; nothing is repaired.
 */
import type { ContentFile, ContentTier } from './types.ts';
import type { ReleaseProfile } from './status.ts';
import { validateContent, SUPPORTED_SCHEMA_MAJOR, type ContentStore } from './validate.ts';
import type { ValidatorSet } from './validators.ts';

export const RELEASE_FORMAT = 1;

export interface ReleaseManifest {
  format: number;
  releaseId: string;
  profile: ReleaseProfile;
  builtAt: string;
  appVersion: string;
  schemaMajor: number;
  contentFile: string;
  contentSha256: string;
  files: { path: string; tier: ContentTier; sha256: string }[];
  /** Set by the approver for clinical releases (Phase 5). */
  validUntil: string | null;
}

export interface ReleaseBundle {
  format: number;
  files: ContentFile[];
}

export interface LoadedRelease {
  manifest: ReleaseManifest;
  store: ContentStore;
}

/** A problem that stops the whole release loading. */
export class ReleaseError extends Error {
  constructor(
    message: string,
    public readonly detail: string,
  ) {
    super(message);
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isManifest(value: unknown): value is ReleaseManifest {
  if (value === null || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.format === 'number' &&
    typeof m.releaseId === 'string' &&
    typeof m.profile === 'string' &&
    typeof m.contentFile === 'string' &&
    /^[a-z0-9.-]+$/.test(m.contentFile) &&
    typeof m.contentSha256 === 'string' &&
    Array.isArray(m.files)
  );
}

export async function verifyRelease(
  manifestValue: unknown,
  bundleText: string,
  expectedProfile: ReleaseProfile,
  validators: ValidatorSet,
): Promise<LoadedRelease> {
  if (!isManifest(manifestValue)) {
    throw new ReleaseError('The content release is damaged.', 'The release manifest is missing required information.');
  }
  const manifest = manifestValue;
  if (manifest.format !== RELEASE_FORMAT || manifest.schemaMajor !== SUPPORTED_SCHEMA_MAJOR) {
    throw new ReleaseError(
      'This content release is not compatible with this version of the app.',
      `Release format ${manifest.format}, schema ${manifest.schemaMajor}; app expects format ${RELEASE_FORMAT}, schema ${SUPPORTED_SCHEMA_MAJOR}.`,
    );
  }
  if (manifest.profile !== expectedProfile) {
    throw new ReleaseError(
      'This content release was built for a different kind of build.',
      `Release profile "${manifest.profile}", app build profile "${expectedProfile}".`,
    );
  }
  const actual = await sha256Hex(bundleText);
  if (actual !== manifest.contentSha256) {
    throw new ReleaseError(
      'Content integrity check failed. The content does not match its release record, so it has been blocked.',
      `Expected SHA-256 ${manifest.contentSha256}, got ${actual}.`,
    );
  }
  let bundle: ReleaseBundle;
  try {
    bundle = JSON.parse(bundleText) as ReleaseBundle;
  } catch {
    throw new ReleaseError('The content release is damaged.', 'content.json is not valid JSON.');
  }
  if (bundle.format !== RELEASE_FORMAT || !Array.isArray(bundle.files)) {
    throw new ReleaseError('The content release is damaged.', 'content.json has an unexpected structure.');
  }
  const listed = new Map(manifest.files.map((f) => [f.path, f]));
  if (listed.size !== bundle.files.length) {
    throw new ReleaseError('The content release is incomplete.', 'The number of files does not match the manifest.');
  }
  for (const file of bundle.files) {
    const entry = listed.get(file.path);
    if (!entry || entry.tier !== file.tier || (await sha256Hex(file.text)) !== entry.sha256) {
      throw new ReleaseError('Content integrity check failed.', `File ${file.path} does not match the manifest.`);
    }
  }
  return { manifest, store: validateContent(bundle.files, validators) };
}

export async function fetchRelease(
  baseUrl: string,
  expectedProfile: ReleaseProfile,
  validators: ValidatorSet,
): Promise<LoadedRelease> {
  let manifestValue: unknown;
  let bundleText: string;
  try {
    const res = await fetch(`${baseUrl}release/manifest.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifestValue = await res.json();
    const contentFile = isManifest(manifestValue) ? manifestValue.contentFile : 'content.json';
    const bundleRes = await fetch(`${baseUrl}release/${contentFile}`, { cache: 'no-store' });
    if (!bundleRes.ok) throw new Error(`HTTP ${bundleRes.status}`);
    bundleText = await bundleRes.text();
  } catch (e) {
    throw new ReleaseError(
      'Clinical content could not be loaded.',
      `${e instanceof Error ? e.message : String(e)}. This preview build is not yet available offline (offline support arrives in Phase 3).`,
    );
  }
  return verifyRelease(manifestValue, bundleText, expectedProfile, validators);
}
