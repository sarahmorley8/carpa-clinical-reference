# Release readiness checklist

A release may be used clinically only when **every** item is ticked with evidence. Engineering items alone never
authorise clinical use. Status as of Phase 4 (2026-10-26).

## A. Engineering (Phase 4)

| Item                                                                                     | Status | Evidence                                                                |
| ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| All automated checks pass (content, lint, types, unit/integration, e2e)                  | ✔     | `docs/testing/phase-4-report.md`                                        |
| Accessibility: 0 serious/critical automated issues; contrast verified                    | ✔     | `docs/testing/accessibility-report.md`                                  |
| Accessibility: VoiceOver and TalkBack walkthroughs                                       | ☐      | manual scripts 7, 11                                                    |
| Offline and update behaviour verified in automation                                      | ✔     | `docs/testing/offline-reliability-report.md`                            |
| Offline, install, timers, updates verified on a real iPhone **and** a real Android phone | ☐      | manual scripts 1–21                                                     |
| Performance targets met (simulated)                                                      | ✔     | `docs/testing/performance-report.md`                                    |
| Performance confirmed on a real mid-range phone                                          | ☐      |                                                                         |
| Security review done; recommendations triaged                                            | ✔ / ☐ | `docs/security/security-review.md` (branch protection, signing pending) |
| Reproducible build                                                                       | ✔     | `npm run check:reproducible`                                            |
| Hosting set up with access restriction and security headers                              | ☐      | `docs/deployment/hosting.md`                                            |
| Rollback procedure rehearsed                                                             | ☐      | `docs/deployment/deploy-and-rollback.md`                                |
| Defect register has no open High issues                                                  | ✔     | `docs/safety/defect-register.md`                                        |

## B. Content and clinical safety (Phase 5)

| Item                                                                                                 | Status                     |
| ---------------------------------------------------------------------------------------------------- | -------------------------- |
| Written permission to reproduce/adapt CARPA content, conditions recorded                             | ☐                          |
| Every published unit independently reviewed against the current edition; approval records hash-bound | ☐                          |
| No placeholders or missing numbers in published content (enforced)                                   | ✔ (enforced by validator) |
| Review dates set; expiry behaviour accepted (D4: shown with REVIEW OVERDUE)                          | ☐                          |
| Calculator independently validated against authorised expected values — or remains disabled          | ☐ (disabled)               |
| Hazard log reviewed; residual risks accepted by an accountable person                                | ☐                          |
| Signed release manifest                                                                              | ☐                          |

## C. Governance and regulatory (Phase 6)

| Item                                                                        | Status |
| --------------------------------------------------------------------------- | ------ |
| Intended use statement approved                                             | ☐      |
| TGA (and, if relevant, Medsafe) assessment documented                       | ☐      |
| Privacy Impact Assessment (organisational use)                              | ☐      |
| Medicines authority alignment (e.g. NT SSTPs) confirmed                     | ☐      |
| Cultural safety consultation (organisational use); artwork licensed if used | ☐      |
| Content maintenance owner and review cadence named                          | ☐      |
| Incident reporting procedure and contact                                    | ☐      |
| Organisational ICT/clinical governance approval                             | ☐      |
| Release approved and signed off by the accountable person                   | ☐      |

**Current status: NOT ready for clinical use.** The app remains a non-clinical prototype.
