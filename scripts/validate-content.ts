/**
 * Content checker for authors.
 *
 *   npm run validate-content
 *
 * Prints every problem in plain English and exits with an error code if any
 * file is rejected, so broken content can never be merged or released.
 * Set CARPA_CONTENT_PROFILE to check a specific release profile (default: preview).
 */
/* eslint-disable no-console */
import { collectContentFiles, parseProfile, ProfileNotEnabledError } from './lib/collect.ts';
import { createNodeValidators } from './lib/schemas.ts';
import { validateContent } from '../src/content/validate.ts';
import type { ContentIssue } from '../src/content/issues.ts';

function printIssue(i: ContentIssue) {
  console.log(`   • ${i.location}`);
  console.log(`     ${i.message}`);
  if (i.value !== undefined) console.log(`     Found:    ${i.value}`);
  if (i.expected !== undefined) console.log(`     Expected: ${i.expected}`);
}

function main(): number {
  const showWarnings = !process.argv.includes('--no-warnings');
  let profile;
  try {
    profile = parseProfile(process.env.CARPA_CONTENT_PROFILE);
  } catch (e) {
    console.error((e as Error).message);
    return 2;
  }
  let files;
  try {
    files = collectContentFiles(profile);
  } catch (e) {
    if (e instanceof ProfileNotEnabledError) {
      console.error(`✖ ${e.message}`);
      return 1;
    }
    throw e;
  }

  const store = validateContent(files, createNodeValidators());
  console.log(`CARPA content check — profile: ${profile}`);
  console.log(`Checked ${files.length} file(s).\n`);

  for (const r of store.rejected) {
    const label = r.title ? `  (${r.title})` : '';
    console.log(`✖ REJECTED  content/${r.file.path}${label}`);
    r.errors.forEach(printIssue);
    console.log('');
  }

  if (showWarnings && store.warnings.length) {
    console.log(`⚠ Warnings (${store.warnings.length}) — these do not block content:`);
    const byFile = new Map<string, ContentIssue[]>();
    for (const w of store.warnings) byFile.set(w.file, [...(byFile.get(w.file) ?? []), w]);
    for (const [file, list] of byFile) {
      console.log(`  content/${file}`);
      list.forEach(printIssue);
    }
    console.log('');
  }

  console.log('Completeness (placeholders / missing numbers):');
  const units = [...store.presentations.values(), ...store.medications.values(), ...store.observationSets.values()];
  for (const u of units.sort((a, b) => a.file.path.localeCompare(b.file.path))) {
    const c = u.completeness;
    const state = c.placeholders + c.missingNumbers === 0 ? 'complete' : `${c.placeholders} / ${c.missingNumbers}`;
    console.log(`  ${u.file.path.padEnd(58)} ${u.data.meta.status.padEnd(13)} ${state}`);
  }
  console.log('');

  const errorCount = store.rejected.reduce((n, r) => n + r.errors.length, 0);
  if (errorCount) {
    console.log(`✖ ${errorCount} problem(s) in ${store.rejected.length} file(s). Fix these before merging.`);
    return 1;
  }
  console.log(`✔ All ${files.length} file(s) passed. ${store.warnings.length} warning(s).`);
  return 0;
}

process.exitCode = main();
