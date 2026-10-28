# Schema changelog

## 1.0.0 — 2026-10-26

Initial schema: common definitions, presentation (with pathway graph), medication (formulations and regimens),
observation set, reference lists (sources, populations, body systems, critical categories, synonyms, contacts).

## Rules

- **Patch** (1.0.x): wording/description changes only.
- **Minor** (1.x.0): new optional fields only. Existing files stay valid.
- **Major** (2.0.0): anything that can invalidate existing files. Requires a migration script in `schemas/migrations/`
  that changes **structure only, never clinical values**, and every migrated unit returns to `under-review`.
- Keep `src/content/types.ts` and `docs/content-authoring/field-reference.md` in step with every change.
- Schemas must not use `minLength`, `maxLength` or `format` (they need Ajv runtime helpers in the browser build);
  use `pattern` instead. The build fails if this rule is broken.
