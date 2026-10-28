# Phase 2 test report — interactive prototype

Date: 2026-10-26 · Environment: Linux container, Node 22.22, Chromium (Playwright 1.63) · Build profile: `preview`

## Automated results

| Check                                                     | Result                                                                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run validate-content`                                | ✔ 17/17 files pass; 1 expected warning (demo branch overlap can only be checked at run time) |
| ESLint (incl. jsx-a11y strict, storage/HTML/console bans) | ✔ 0 problems — rules confirmed to fire on a probe file                                       |
| Prettier                                                  | ✔                                                                                            |
| TypeScript (`strict`)                                     | ✔ 0 errors                                                                                   |
| Unit + integration (Vitest)                               | ✔ 73/73                                                                                      |
| End-to-end (Playwright, Pixel 7 profile)                  | ✔ 20/20                                                                                      |
| axe-core WCAG 2.0/2.1/2.2 A+AA, 5 screens × light/dark    | ✔ 0 serious/critical violations                                                              |
| `npm audit`                                               | ✔ 0 known vulnerabilities                                                                    |
| Production build                                          | ✔ JS 95.7 KB gzip (incl. ~34 KB validators), CSS 3.8 KB, content 5.5 KB                      |

## Defects found and fixed during Phase 2

| #    | Defect                                                                                                  | Fix                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P2-1 | A file too malformed to read its id showed "Presentation not found" instead of "blocked" (found by e2e) | `findRejected()` matches by file name when the id is unreadable; the page links to Content problems |
| P2-2 | Ajv standalone code contained a CommonJS `require` (fails in browser)                                   | Inline JSON deep-equal helper; build fails if any other runtime helper appears                      |
| P2-3 | Link colour rule applied dark-theme styles in light mode                                                | Introduced `--link` token per theme                                                                 |
| P2-4 | Section chips and checklist labels below 44 px                                                          | Raised to 44 px; e2e test enforces 44 px main / 24 px minimum                                       |

## Not tested (requires real devices or later phases)

- Real iPhone Safari and Android Chrome (manual scripts in `manual-device-tests.md` — not yet run).
- VoiceOver/TalkBack, sunlight and low-light readability (manual).
- Offline, install, updates, timers, ISBAR, calculator, inactivity clear (Phase 3).

Engineering results do not constitute clinical validation or approval.
