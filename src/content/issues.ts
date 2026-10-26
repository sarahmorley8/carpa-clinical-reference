/**
 * Content problems, written for content authors (not programmers).
 * Every problem names the file, where in the file, what is wrong and what is expected.
 */
import type { SchemaError } from './validators.ts';

export type IssueSeverity = 'error' | 'warning';

export interface ContentIssue {
  severity: IssueSeverity;
  /** Stable machine-readable code, used by tests and docs. */
  code: string;
  /** File path relative to content/, or "(release)" for whole-release problems. */
  file: string;
  /** Human-readable location, e.g. "medications → item 3 → maxDose". */
  location: string;
  message: string;
  /** The value found, if useful. */
  value?: string;
  /** What was expected, if useful. */
  expected?: string;
}

export function issue(
  severity: IssueSeverity,
  code: string,
  file: string,
  location: string,
  message: string,
  extra: { value?: string; expected?: string } = {},
): ContentIssue {
  return { severity, code, file, location, message, ...extra };
}

/** "/assessment/history/2/text" -> "assessment → history → item 3 → text" */
export function humanPath(pointer: string): string {
  if (pointer === '' || pointer === '/') return '(top of file)';
  return pointer
    .split('/')
    .slice(1)
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((seg) => (/^\d+$/.test(seg) ? `item ${Number(seg) + 1}` : seg))
    .join(' → ');
}

function joinPath(base: string, child: string): string {
  return base === '' ? `/${child}` : `${base}/${child}`;
}

export function valueAt(data: unknown, pointer: string): unknown {
  if (pointer === '') return data;
  let current: unknown = data;
  for (const raw of pointer.split('/').slice(1)) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function describeValue(value: unknown): string {
  if (value === undefined) return '(nothing)';
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = String(value);
  }
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

const TYPE_WORDS: Record<string, string> = {
  string: 'text in "quotes"',
  number: 'a number (no units or quotes, e.g. 0.5)',
  integer: 'a whole number',
  boolean: 'true or false',
  array: 'a list in [square brackets]',
  object: 'a group of fields in {curly brackets}',
  null: 'null',
};

function describePattern(pattern: string): string {
  if (pattern.includes('[a-z0-9]+(?:-[a-z0-9]+)*'))
    return "lower-case letters, numbers and single hyphens only (e.g. 'chest-pain')";
  if (pattern.includes('\\d{4}-\\d{2}-\\d{2}')) return 'a date written YYYY-MM-DD (e.g. 2026-10-26)';
  if (pattern === '\\S') return 'some text (it must not be empty)';
  if (pattern.startsWith('^1\\.')) return 'a schema version starting with 1. (e.g. "1.0.0")';
  if (pattern.includes('\\d+\\.\\d+\\.\\d+')) return 'a version written like 1.0.0';
  return `text matching the pattern ${pattern}`;
}

/** Turn Ajv errors into plain-English issues, removing noise from alternatives (oneOf). */
export function humaniseSchemaErrors(file: string, data: unknown, errors: readonly SchemaError[]): ContentIssue[] {
  const relevant = errors.filter((e) => e.keyword !== 'if');
  const hasOtherAt = (e: SchemaError) =>
    relevant.some(
      (o) =>
        o !== e &&
        o.keyword !== 'oneOf' &&
        !(o.keyword === 'type' && o.params.type === 'null') &&
        (o.instancePath === e.instancePath || o.instancePath.startsWith(`${e.instancePath}/`)),
    );

  const nullAllowedAt = new Set<string>();
  const kept = relevant.filter((e) => {
    if (e.keyword === 'oneOf' || e.keyword === 'anyOf') return !hasOtherAt(e);
    if (e.keyword === 'type' && e.params.type === 'null' && hasOtherAt(e)) {
      nullAllowedAt.add(e.instancePath);
      return false;
    }
    return true;
  });

  const seen = new Set<string>();
  const out: ContentIssue[] = [];
  for (const e of kept) {
    const result = describeSchemaError(file, data, e, nullAllowedAt.has(e.instancePath));
    const key = `${result.location}|${result.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(result);
  }
  return out;
}

function describeSchemaError(file: string, data: unknown, e: SchemaError, nullAlsoAllowed: boolean): ContentIssue {
  const here = humanPath(e.instancePath);
  const value = describeValue(valueAt(data, e.instancePath));
  const orNull = nullAlsoAllowed ? ' (or null if not yet entered)' : '';
  const p = e.params;
  switch (e.keyword) {
    case 'required': {
      const field = String(p.missingProperty);
      return issue('error', 'schema-required', file, here, `Missing required field "${field}".`, {
        expected: `a "${field}" field at ${here}`,
      });
    }
    case 'additionalProperties': {
      const field = String(p.additionalProperty);
      return issue(
        'error',
        'schema-unknown-field',
        file,
        humanPath(joinPath(e.instancePath, field)),
        `Unknown field "${field}". Check the spelling, or remove it. Unknown fields are rejected so that typos cannot hide clinical information.`,
      );
    }
    case 'type': {
      const wanted = String(p.type)
        .split(',')
        .map((t) => TYPE_WORDS[t] ?? t)
        .join(' or ');
      return issue('error', 'schema-type', file, here, `Wrong kind of value. Expected ${wanted}${orNull}.`, {
        value,
        expected: wanted + orNull,
      });
    }
    case 'enum': {
      const allowed = (p.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join(', ');
      return issue('error', 'schema-enum', file, here, `Value is not one of the allowed options.`, {
        value,
        expected: `one of: ${allowed}`,
      });
    }
    case 'const':
      return issue('error', 'schema-const', file, here, `Value must be exactly ${JSON.stringify(p.allowedValue)}.`, {
        value,
        expected: JSON.stringify(p.allowedValue),
      });
    case 'pattern': {
      const wanted = describePattern(String(p.pattern));
      return issue(
        'error',
        'schema-pattern',
        file,
        here,
        `Value is not in the right format. Expected ${wanted}${orNull}.`,
        {
          value,
          expected: wanted + orNull,
        },
      );
    }
    case 'minItems':
      return issue('error', 'schema-min-items', file, here, `List needs at least ${String(p.limit)} item(s).`, {
        value,
      });
    case 'uniqueItems':
      return issue(
        'error',
        'schema-duplicate-item',
        file,
        here,
        `List contains a duplicate: item ${Number(p.j) + 1} and item ${Number(p.i) + 1} are the same.`,
      );
    case 'exclusiveMinimum':
    case 'minimum':
      return issue(
        'error',
        'schema-minimum',
        file,
        here,
        `Number is too small. It must be ${e.keyword === 'minimum' ? 'at least' : 'greater than'} ${String(p.limit)}.`,
        { value },
      );
    case 'dependentRequired':
      return issue(
        'error',
        'schema-dependent-required',
        file,
        here,
        `"${String(p.missingProperty)}" is required when "${String(p.property)}" is present.`,
      );
    case 'discriminator':
      return issue(
        'error',
        'schema-discriminator',
        file,
        here,
        p.error === 'mapping'
          ? `Unknown "${String(p.tag)}" value ${JSON.stringify(p.tagValue)}.`
          : `Missing or invalid "${String(p.tag)}" field.`,
        { value: describeValue(p.tagValue) },
      );
    case 'oneOf':
    case 'anyOf':
      return issue('error', 'schema-no-match', file, here, 'Value does not match any of the allowed forms.', {
        value,
      });
    default:
      return issue('error', `schema-${e.keyword}`, file, here, e.message ?? `Failed check "${e.keyword}".`, {
        value,
      });
  }
}

/** Describe a JSON.parse failure, adding a line and column where possible. */
export function describeJsonError(file: string, text: string, err: unknown): ContentIssue {
  const raw = err instanceof Error ? err.message : String(err);
  let location = '(whole file)';
  const pos = /position (\d+)/.exec(raw);
  if (pos) {
    const offset = Number(pos[1]);
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    const column = offset - before.lastIndexOf('\n');
    location = `line ${line}, column ${column}`;
  }
  return issue(
    'error',
    'json-syntax',
    file,
    location,
    `This file is not valid JSON (${raw}). Common causes: a missing or extra comma, a missing quote, or a missing bracket.`,
  );
}
