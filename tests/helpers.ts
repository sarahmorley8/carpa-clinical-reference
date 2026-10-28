import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildRelease, collectContentFiles, CONTENT_DIR } from '../scripts/lib/collect.ts';
import { createNodeValidators } from '../scripts/lib/schemas.ts';
import { verifyRelease, type LoadedRelease } from '../src/content/release.ts';
import type { ContentFile, ContentTier } from '../src/content/types.ts';
import { validateContent, type ContentStore } from '../src/content/validate.ts';

export const validators = createNodeValidators();

/** All real content files for the preview profile. */
export const realFiles = (): ContentFile[] => collectContentFiles('preview');

export function readContent(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(CONTENT_DIR, relPath), 'utf8'));
}

export function file(relPath: string, data: unknown, tier: ContentTier = 'main'): ContentFile {
  return { path: relPath, tier, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) };
}

/** Real content, with some files replaced or added. */
export function withFiles(...extra: ContentFile[]): ContentFile[] {
  const replaced = new Set(extra.map((f) => f.path));
  return [...realFiles().filter((f) => !replaced.has(f.path)), ...extra];
}

export function validate(files: ContentFile[]): ContentStore {
  return validateContent(files, validators);
}

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function loadRealRelease(): Promise<LoadedRelease> {
  const { manifest, bundleText } = buildRelease('preview', 'test');
  return verifyRelease(manifest, bundleText, 'preview', validators);
}

export function errorCodes(store: ContentStore, filePath?: string): string[] {
  return store.rejected
    .filter((r) => !filePath || r.file.path === filePath)
    .flatMap((r) => r.errors.map((e) => e.code));
}
