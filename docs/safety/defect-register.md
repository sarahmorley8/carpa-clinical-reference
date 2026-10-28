# Defect register

| ID   | Phase | Severity                   | Description                                                            | Status        | Fix / evidence                                  |
| ---- | ----- | -------------------------- | ---------------------------------------------------------------------- | ------------- | ----------------------------------------------- |
| P2-1 | 2     | Medium                     | Unreadable (malformed) file showed "not found" instead of "blocked"    | Fixed         | `findRejected()`; e2e malformed-content test    |
| P2-2 | 2     | High (would break browser) | Validator code contained CommonJS `require`                            | Fixed         | Inlined helper; build fails on any other helper |
| P2-3 | 2     | Low                        | Dark link colour applied in light mode                                 | Fixed         | `--link` token                                  |
| P2-4 | 2     | Low                        | Some targets < 44 px                                                   | Fixed         | e2e touch-target test                           |
| P3-1 | 3     | Medium                     | Number entry overflowed phone width                                    | Fixed         | e2e no-sideways-scroll test                     |
| P3-2 | 3     | Low                        | Timer form overflowed at 320 px                                        | Fixed         | same                                            |
| P3-3 | 3     | Medium                     | Step-through listed adult medicine when Child selected                 | Fixed         | regimen filter                                  |
| P3-4 | 3     | Low                        | Timer bar covered section shortcuts                                    | Fixed         | CSS offset                                      |
| P3-5 | 3     | High                       | Offline registration loop on preference change                         | Fixed         | stable callback; update e2e test                |
| P3-6 | 3     | Medium                     | Worker hung reading cache bodies (automated Chromium)                  | Worked around | page-side verification (D20)                    |
| P3-7 | 3     | Medium                     | Worker build placeholder replaced inside a comment                     | Fixed         | exact marker check                              |
| P3-8 | 3     | Low                        | "Change" button text wrapped mid-word                                  | Fixed         | CSS                                             |
| P4-1 | 4     | Medium                     | Expired hosting login would silently stop updates for an installed app | Fixed         | `signin.html` bypass + Settings notice; e2e     |
| P4-2 | 4     | Low                        | Build banner outside a landmark (axe `region`)                         | Fixed         | `aside` landmark                                |
| P4-3 | 4     | Low                        | Dark-theme tile highlight contrast 4.41:1                              | Fixed         | highlight reduced; 4.89:1                       |

## Open issues

| ID  | Severity | Description                                                                    | Plan                                             |
| --- | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| O-1 | Medium   | No real-device testing yet (iPhone primary, Android)                           | User to run `manual-device-tests.md` once hosted |
| O-2 | Medium   | Releases from a compromised host are not detectable (no signature)             | Signed manifest, Phase 5                         |
| O-3 | Low      | Background timers unreliable on iOS                                            | Documented; platform limit                       |
| O-4 | Low      | While editing an earlier answer, the current question's buttons are also shown | Consider hiding during edit (UX review)          |
