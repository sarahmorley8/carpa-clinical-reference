# Phase 4 verification report

Date: 2026-10-26 · Build profile: `preview` · Environment: Linux container, Node 22.22, Chromium (Playwright 1.63)

## Results

| Check                                      | Result                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Content check                              | ✔ 17/17 files (1 expected warning)                                                                          |
| ESLint / Prettier / TypeScript strict      | ✔ 0 problems                                                                                                |
| Unit + integration (Vitest)                | ✔ 125/125                                                                                                   |
| End-to-end (Playwright)                    | ✔ 41/41                                                                                                     |
| Accessibility (axe, 11 screens × 2 themes) | ✔ 0 serious/critical; 1 moderate fixed — [report](accessibility-report.md)                                  |
| Colour contrast (25 pairs)                 | ✔ all pass                                                                                                  |
| Performance (4× CPU, offline)              | ✔ launch 406–695 ms, search 11–28 ms — [report](performance-report.md)                                      |
| Offline/update scenarios                   | ✔ 5 scenarios — [report](offline-reliability-report.md)                                                     |
| Security                                   | ✔ no external requests, no CSP violations, hostile content inert — [review](../security/security-review.md) |
| `npm audit`                                | ✔ 0 known vulnerabilities — [dependencies](../security/dependencies.md)                                     |
| Reproducible build                         | ✔ identical output from the same commit                                                                     |

## Engineering acceptance criteria (plan §9.2)

| Criterion                                                           | Status                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Critical pathways ≤ 2 taps; any pathway ≤ 3 taps or search          | ✔                                                                                                                                         |
| Search feedback < 200 ms on a slowed mid-range profile              | ✔ (simulated)                                                                                                                             |
| Cold launch to interactive Home < 2 s offline                       | ✔ (simulated)                                                                                                                             |
| 100% e2e pass                                                       | ✔                                                                                                                                         |
| Offline/update verified on ≥ 1 real iOS and ≥ 1 real Android device | ☐ **not done**                                                                                                                             |
| No serious/critical axe violations; contrast 4.5:1 text / 3:1 UI    | ✔                                                                                                                                         |
| Touch targets                                                       | ✔ ≥ 44 px for main controls (most 48 px), ≥ 24 px everywhere. The plan said 48 px; chips and checklist rows are 44 px (Apple's guideline) |
| Invalid/unapproved content cannot become active in a clinical build | ✔ (clinical profiles disabled; validator rules tested)                                                                                    |
| No patient data in any storage                                      | ✔                                                                                                                                         |
| Failed update leaves the previous release active                    | ✔                                                                                                                                         |
| Lint/types zero errors; reproducible builds                         | ✔                                                                                                                                         |

## Defects

15 found and fixed across Phases 2–4; 4 open (none High). See [defect register](../safety/defect-register.md).

## What Phase 4 could not do here

- Real-device testing (needs the app hosted and your iPhone/Android phone).
- Hosting set-up (needs your Cloudflare account) — the deploy workflow is ready and disabled.

Engineering verification does not constitute clinical validation or approval. See the
[release readiness checklist](../clinical-governance/release-readiness-checklist.md).
