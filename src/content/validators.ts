/** Shape of the compiled JSON Schema validators, shared by Node and browser. */

export const SCHEMA_BASE = 'https://schemas.carpa-reference.invalid/v1/';

export const SCHEMA_IDS = {
  presentation: 'presentation.schema.json',
  medication: 'medication.schema.json',
  'observation-set': 'observation-set.schema.json',
  'reference-list': 'reference-list.schema.json',
} as const;

/** Subset of Ajv's ErrorObject that the app relies on. */
export interface SchemaError {
  instancePath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

export interface ValidateFunction {
  (data: unknown): boolean;
  errors?: SchemaError[] | null;
}

export interface ValidatorSet {
  presentation: ValidateFunction;
  medication: ValidateFunction;
  'observation-set': ValidateFunction;
  'reference-list': ValidateFunction;
}
