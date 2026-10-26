# Outstanding risk register (project)

| ID  | Risk                                                                 | Impact                                      | Likelihood | Mitigation                                                            | Owner | Status     |
| --- | -------------------------------------------------------------------- | ------------------------------------------- | ---------- | --------------------------------------------------------------------- | ----- | ---------- |
| R1  | CARPA permission not granted or restricted                           | Cannot enter real content / cannot share    | Medium     | Ask early (licensing.md); design supports any authorised source       | User  | Open       |
| R2  | No independent clinical reviewer                                     | Self-review only; blocks organisational use | High       | Personal profile labels self-review; identify reviewer before Phase 5 | User  | Open       |
| R3  | App classified as a regulated medical device                         | Pre-market obligations                      | Unknown    | Get TGA advice before organisational use; calculator stays disabled   | User  | Open       |
| R4  | iOS PWA limitations (background timers, vibration, storage eviction) | Missed alerts; cache loss                   | Medium     | Document, test on device, readiness check (Phase 3)                   | Dev   | Open       |
| R5  | Transcribed content drifts from new CARPA editions                   | Outdated guidance                           | Medium     | nextReviewDate, REVIEW OVERDUE banner, edition in sources.json        | User  | Open       |
| R6  | Dependency vulnerabilities                                           | Security                                    | Low–medium | Pinned versions, lockfile, `npm audit` in CI (0 known at 2026-10-26)  | Dev   | Monitoring |
| R7  | Free hosting unsuitable for clinical use                             | Availability/security                       | Medium     | Assess hosting in Phase 4; access restriction                         | User  | Open       |
