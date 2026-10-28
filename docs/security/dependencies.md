# Dependency review (2026-10-26)

`npm audit`: **0 known vulnerabilities**. Versions are pinned exactly and locked in `package-lock.json`.

## Shipped to the phone (runtime)

| Package          | Version | Licence | Purpose                            |
| ---------------- | ------- | ------- | ---------------------------------- |
| react, react-dom | 18.3.1  | MIT     | User interface                     |
| minisearch       | 7.2.0   | MIT     | Offline search                     |
| decimal.js       | 10.6.0  | MIT     | Exact arithmetic in the calculator |

Plus their sub-dependencies: `scheduler`, `loose-envify`, `js-tokens` (MIT).

## Development and build only (not shipped)

Vite, TypeScript, Vitest, Testing Library, jsdom, Playwright (+ axe-core, MPL-2.0), ESLint (+ typescript-eslint,
jsx-a11y, react-hooks), Prettier, Ajv (validators are compiled at build time and the generated code is shipped), tsx,
fast-check. Licences across the whole tree: MIT (429), Apache-2.0 (22), ISC (16), BSD (13), and small numbers of
BlueOak, MPL-2.0, CC0, CC-BY-4.0 (data), Python-2.0 — none impose obligations on the shipped app beyond attribution in
the source.

Removed during development: React Router (open advisories at the time; replaced by a small in-house router).
