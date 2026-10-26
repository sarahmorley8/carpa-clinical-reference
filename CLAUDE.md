# Working rules for this repository

This is a clinical reference app prototype. Safety rules come first.

## Never

- Invent, infer or "fill in" clinical content: doses, concentrations, routes, thresholds, ranges, sequences,
  escalation criteria, monitoring intervals, follow-up. Use placeholders (`[ENTER FROM APPROVED CARPA SOURCE: ...]`) or
  `null` for numbers. Synthetic demo content lives only in `content/examples/`, is labelled DEMONSTRATION and uses
  obviously fictional drugs/conditions.
- Persist or transmit patient data. Only `src/state/preferences.ts` may use browser storage (ESLint enforces this).
- Render content as HTML (`dangerouslySetInnerHTML`, `innerHTML` are banned by lint).
- Treat a JSON `status` field as proof of approval. `displayStatus()` keeps `usableAsGuidance: false` until Phase 5.
- Enable `personal` / `organisational` release profiles before Phase 5 approval controls exist.
- Bypass a phase checkpoint, expand scope silently, or claim clinical validation / regulatory compliance from tests.

## Always

- Run `npm run check` and `npm run test:e2e` after code changes; report failures honestly.
- Keep the decision log (`docs/architecture/decision-log.md`), known limitations and risk register up to date.
- Keep schema changes in step with `src/content/types.ts`, `schemas/CHANGELOG.md` and the field reference.
- Stop and explain any safety-critical problem before continuing.

## Layout

- `content/` clinical content (JSON) · `schemas/` JSON Schemas · `src/content/` validation pipeline (shared by Node and
  browser) · `src/decision-engine/` pathway graph logic (no React) · `scripts/` content tooling ·
  `vite-plugins/content-plugin.ts` serves/emits the content release.
- Lockfile was generated with npm 11 (npm 10.9 has a peer-resolution bug with this tree); `npm ci` works on npm 10.
- Offline: `sw/sw.template.js` (hash-verified install, never self-activates) is filled in by
  `vite-plugins/sw-plugin.ts`; e2e tests run against `tests/e2e/static-server.mjs` (test hook publishes a modified sw.js).
