# Architecture overview

## Stack

React 18 + TypeScript + Vite (static build, no backend). JSON Schema (draft 2020-12) validated by Ajv, pre-compiled to
plain JavaScript at build time so the app needs no `eval` and can run under a strict Content-Security-Policy.
MiniSearch for offline fuzzy search. Vitest + Testing Library for unit/integration tests, Playwright + axe-core for
end-to-end and accessibility tests. Workbox service worker arrives in Phase 3.

## Data flow

```
 content/*.json ──► scripts/lib/collect.ts (by release profile)
                        │
                        ├─► npm run validate-content ──► validateContent() ──► plain-English report (CI gate)
                        │
                        └─► vite-plugins/content-plugin.ts
                               dev:   serves /release/manifest.json + content.json (rebuilt per request)
                               build: emits release/manifest.json + release/content.json
                                      manifest = release id, profile, SHA-256 of bundle and every file

 Device:
   fetchRelease() ─► check manifest format/profile/schema ─► SHA-256 of bundle ─► SHA-256 of each file
                  ─► validateContent()  (same code as build time)
                  ─► ContentStore { valid units, rejected files + reasons, warnings }
                  ─► UI (content rendered as text only)
```

Release failures (tampered, incompatible, unreachable) block **all** content and tell the user to use the printed
manual. A single bad file blocks only that file (and anything that depends on it).

## Validation pipeline (`src/content/validate.ts`)

1. Parse JSON (line/column on failure) 2. schema version check 3. JSON Schema 4. tier rules (demo only in examples,
   templates stay draft) 5. lifecycle rules (approved ⇒ complete + reviewer fields; superseded ⇒ replacement) 6. duplicate
   ids (main content replaces a template of the same id) 7. cross-references, repeated until stable so that a rejected
   medication also blocks presentations using it; real content may not reference demonstration content 8. pathway graph
   checks (`src/decision-engine/graph.ts`).

## Modules

| Path                              | Responsibility                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/content/`                    | Types, validation, issues (plain English), placeholders, status labels, release loading      |
| `src/decision-engine/`            | Pathway graph checks and step ordering (no UI). Interactive `evaluate()` arrives in Phase 3  |
| `src/search/`                     | Search index                                                                                 |
| `src/state/`                      | `session.tsx` (patient working state, memory only), `preferences.ts` (the only storage user) |
| `src/navigation/router.ts`        | Hash router; routes carry content ids only                                                   |
| `src/components/`, `src/screens/` | UI                                                                                           |
| `scripts/`                        | Content collection, schema compilation, author CLI                                           |

## Build profiles

| Profile          | Includes                                                           | Status                 |
| ---------------- | ------------------------------------------------------------------ | ---------------------- |
| `preview`        | main content + templates + examples, watermarked                   | Only profile available |
| `personal`       | main content with approval records (self-review allowed, labelled) | Disabled until Phase 5 |
| `organisational` | main content with independent approval + signed manifest           | Disabled until Phase 5 |

Set with `CARPA_CONTENT_PROFILE`. Non-preview profiles currently fail the build on purpose.
