/**
 * Detects content that has not been entered yet.
 * Text containing "[ENTER" is a placeholder; null in a numeric clinical field is a missing value.
 * Missing values are never replaced with defaults.
 */

export const PLACEHOLDER_MARKER = '[ENTER';

/** Fields where null means "clinical number not yet entered". */
const NUMERIC_FIELDS = new Set([
  'amount',
  'value',
  'low',
  'high',
  'durationMinutes',
  'min',
  'max',
  'increment',
  'periodHours',
]);

export interface Completeness {
  placeholders: number;
  missingNumbers: number;
  /** First few locations, for authoring feedback. */
  examples: string[];
}

export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.includes(PLACEHOLDER_MARKER);
}

export function measureCompleteness(data: unknown, maxExamples = 5): Completeness {
  const result: Completeness = { placeholders: 0, missingNumbers: 0, examples: [] };
  const walk = (value: unknown, path: string, key: string | null) => {
    if (isPlaceholder(value)) {
      result.placeholders += 1;
      if (result.examples.length < maxExamples) result.examples.push(path);
    } else if (value === null && key !== null && NUMERIC_FIELDS.has(key)) {
      result.missingNumbers += 1;
      if (result.examples.length < maxExamples) result.examples.push(path);
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}/${i}`, null));
    } else if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        // Authoring notes are never clinical content.
        if (k === 'authoringNotes') continue;
        walk(v, `${path}/${k}`, k);
      }
    }
  };
  walk(data, '', null);
  return result;
}

export function isComplete(c: Completeness): boolean {
  return c.placeholders === 0 && c.missingNumbers === 0;
}
