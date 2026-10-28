# Phase 3 test report — functional reference app

Date: 2026-10-26 · Environment: Linux container, Node 22.22, Chromium (Playwright 1.63, Pixel 7 profile) · Build
profile: `preview`

## Automated results

| Check                                           | Result                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run validate-content`                      | ✔ 17/17 files; 1 expected warning                                               |
| ESLint, Prettier, TypeScript strict             | ✔ 0 problems                                                                    |
| Unit + integration (Vitest)                     | ✔ 125/125 (includes property-based tests for the pathway engine and calculator) |
| End-to-end (Playwright)                         | ✔ 34/34                                                                         |
| axe-core WCAG 2.x A/AA, 9 screens × light/dark  | ✔ 0 serious/critical                                                            |
| No sideways scrolling at 320 px wide, 7 screens | ✔                                                                               |
| `npm audit`                                     | ✔ 0 known vulnerabilities                                                       |
| Production build                                | JS 122.8 KB gzip, CSS 4.9 KB, content 5.5 KB; 11 files cached for offline        |

## New end-to-end scenarios

- Offline: every file verified → reload with network off → Home, Chest pain and demo pathway work.
- A damaged cached file is detected and reported as **NOT ready**, naming the file.
- A failed update (wrong hash) never activates; the previous release keeps working offline; the partial cache is deleted.
- An update downloaded during a patient session is held; "Apply" only appears after End session; after applying, only
  the new cache remains and offline readiness is re-verified.
- Step-through pathway + timer + ISBAR fill + End session clears all of it.
- Patient data never appears in localStorage, sessionStorage, IndexedDB, the URL, or the offline cache.

## Defects found and fixed during Phase 3

| #    | Defect                                                                         | Fix                                                                          |
| ---- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| P3-1 | Number entry row overflowed the phone width in the step-through pathway        | Grid/flex children allowed to shrink; e2e "no sideways scrolling" test added |
| P3-2 | Timer form overflowed at 320 px                                                | Fixed grid columns                                                           |
| P3-3 | Step-through listed the adult medicine when Child was selected                 | Regimens filtered by patient group                                           |
| P3-4 | Timer bar covered the section shortcut buttons                                 | Shortcuts offset when a timer is active                                      |
| P3-5 | Offline registration re-ran every time preferences changed (registration loop) | Stable callback reference; caught by the update e2e test                     |
| P3-6 | Service worker hung reading cache bodies under automated Chromium              | Verification moved to the page (decision D20)                                |
| P3-7 | Placeholder replacement in the service worker build hit a comment              | Exact marker, build fails if not found once                                  |

## Not tested

- **Real iPhone and Android devices** (install, airplane mode, timers when locked/backgrounded, sound, wake lock,
  VoiceOver/TalkBack). Scripts: `manual-device-tests.md`.
- Hosting, HTTPS headers and update propagation on a real host (Phase 4).

Engineering results do not constitute clinical validation or approval.
