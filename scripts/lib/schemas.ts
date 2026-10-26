/**
 * Loads the JSON Schemas and compiles them with Ajv.
 *
 * - In Node (scripts, tests) the schemas are compiled directly.
 * - For the browser, `generateStandaloneValidators()` produces plain JavaScript
 *   so the app never needs `eval`/`new Function` (keeps a strict CSP possible).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import standaloneCodeModule from 'ajv/dist/standalone/index.js';
import type { ValidatorSet } from '../../src/content/validators.ts';
import { SCHEMA_BASE, SCHEMA_IDS } from '../../src/content/validators.ts';

const standaloneCode =
  (standaloneCodeModule as unknown as { default?: typeof standaloneCodeModule }).default ?? standaloneCodeModule;

export const SCHEMAS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../schemas');

const SCHEMA_FILES = [
  'common.schema.json',
  'presentation.schema.json',
  'medication.schema.json',
  'observation-set.schema.json',
  'reference-list.schema.json',
] as const;

function createAjv(forStandalone: boolean): Ajv2020 {
  const ajv = new Ajv2020({
    allErrors: true,
    discriminator: true,
    strict: true,
    // allOf/if-then on optional properties is intentional in the schemas
    strictRequired: false,
    inlineRefs: false,
    code: forStandalone ? { source: true, esm: true, lines: false } : undefined,
  });
  for (const file of SCHEMA_FILES) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(SCHEMAS_DIR, file), 'utf8')) as object);
  }
  return ajv;
}

/** Validators for use in Node (scripts and tests). */
export function createNodeValidators(): ValidatorSet {
  const ajv = createAjv(false);
  const get = (id: string) => {
    const fn = ajv.getSchema(SCHEMA_BASE + id);
    if (!fn) throw new Error(`Schema not found: ${id}`);
    return fn as unknown as ValidatorSet[keyof ValidatorSet];
  };
  return {
    presentation: get(SCHEMA_IDS.presentation),
    medication: get(SCHEMA_IDS.medication),
    'observation-set': get(SCHEMA_IDS['observation-set']),
    'reference-list': get(SCHEMA_IDS['reference-list']),
  };
}

/** ES module source exporting one validate function per content kind. */
export function generateStandaloneValidators(): string {
  const ajv = createAjv(true);
  const code = standaloneCode(ajv, {
    presentation: SCHEMA_BASE + SCHEMA_IDS.presentation,
    medication: SCHEMA_BASE + SCHEMA_IDS.medication,
    observationSet: SCHEMA_BASE + SCHEMA_IDS['observation-set'],
    referenceList: SCHEMA_BASE + SCHEMA_IDS['reference-list'],
  });
  // Ajv emits CommonJS require() for runtime helpers even in ESM mode. The only
  // helper our schemas need is deep equality (uniqueItems); inline it so the
  // module is self-contained. Any other helper is a schema change to review.
  const inlined = code.replace(/require\("ajv\/dist\/runtime\/equal"\)/g, '({ default: __jsonEqual })');
  const leftover = /require\("([^"]+)"\)/.exec(inlined);
  if (leftover) {
    throw new Error(
      `Standalone validator code needs Ajv runtime helper "${leftover[1]}". ` +
        'Avoid minLength/maxLength/format in schemas (use pattern instead).',
    );
  }
  return `${inlined}\n${JSON_EQUAL_SOURCE}`;
}

/** Deep equality for JSON values (null, boolean, number, string, array, object). */
const JSON_EQUAL_SOURCE = `function __jsonEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!__jsonEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !__jsonEqual(a[k], b[k])) return false;
  }
  return true;
}`;
