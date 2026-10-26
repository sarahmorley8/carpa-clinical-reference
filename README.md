# CARPA Clinical Reference (prototype)

A mobile-first clinical reference app prototype for remote area nurses who use the CARPA Standard Treatment Manual.

> **Status: non-clinical prototype (Phase 3 of 6). NOT FOR CLINICAL USE.**
> It contains **no approved clinical content** — only empty templates and one clearly labelled, made-up
> demonstration pathway. Passing software tests does not make it clinically safe or approved.

## What it does (so far)

- **Home screen:** red CRITICAL tiles, search (tolerates spelling mistakes), browse by body system, favourites and
  recently viewed, patient group (Adult / Child) selector.
- **Pathway screen** with the same layout for every presentation: red flags → assessment checklist → observation
  ranges → investigations → management steps → medication reference → consultation and retrieval → monitoring →
  follow-up → source and version. Every item shows its manual page.
- A sticky **"Call for help / evacuation criteria"** button on every pathway.
- **Content status labels** on every screen: DEMONSTRATION, TEMPLATE, DRAFT, REVIEW OVERDUE, SELF-REVIEWED, etc.
- **Content checking:** every content file is checked when the app loads. A broken file is blocked with a plain-English
  explanation; everything else keeps working.
- **Privacy:** ticked items and the patient group live in memory only. Nothing about a patient is saved or sent.
- Settings: dark mode, text size, versions, privacy information, disclaimer, End session.

- **Step-through pathways:** answer each question; only branches written in the source are followed. If the source
  doesn't cover an answer (or something is missing or conflicting), the pathway STOPS and says why. Changing an earlier
  answer recalculates everything after it.
- **Works offline** once installed: every file is checked against its fingerprint before use; "Offline ready" is shown
  only after checking. Updates wait for your tap and never apply during a patient session.
- **Timers** (durations from the pathway or typed by you), **ISBAR handover** builder (copy with a clipboard warning),
  and **automatic clearing after 60 minutes** of inactivity with a 60-second warning.
- **Dose calculator test harness** — fictional demonstration medicine only, not for patient care.

Next (Phase 4): verification on real phones, hosting decision, and full deployment documentation. See
[the roadmap](docs/architecture/roadmap.md).

## Where things are

| Folder                                      | What it holds                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `content/`                                  | **All clinical content** (JSON files). The only folder authors edit.                    |
| `content/templates/presentations/`          | Empty templates: chest pain, sepsis, asthma, anaphylaxis, paediatric gastro/dehydration |
| `content/examples/`                         | The DEMONSTRATION pathway (made up). Never included in clinical builds.                 |
| `schemas/`                                  | The rules every content file must follow (JSON Schema)                                  |
| `docs/content-authoring/`                   | **Start here to add content** — written for non-programmers                             |
| `docs/clinical-governance/`, `docs/safety/` | Approval process, licensing, regulatory checklist, hazard log                           |
| `src/`                                      | App code                                                                                |
| `tests/`                                    | Automated tests                                                                         |

## Guides

- [Adding or editing a presentation (non-programmer guide)](docs/content-authoring/guide.md)
- [Every content field explained](docs/content-authoring/field-reference.md)
- [Installing on your iPhone or Android phone](docs/deployment/install-on-phone.md)
- [Running the app on your computer](docs/deployment/local-development.md)
- [Content lifecycle and approval](docs/clinical-governance/lifecycle-and-approval.md)
- [Licensing — read before entering CARPA content](docs/clinical-governance/licensing.md)
- [Regulatory and governance checklist (AU / NZ)](docs/clinical-governance/regulatory-checklist.md)
- [Visual design and artwork protocols](docs/design/visual-design.md)
- [Privacy design](docs/privacy/privacy-design.md) · [Hazard log](docs/safety/hazard-log.md) ·
  [Known limitations](docs/safety/known-limitations.md) · [Risk register](docs/safety/risk-register.md)
- [Architecture](docs/architecture/overview.md) · [Decision log](docs/architecture/decision-log.md) ·
  [Test plan](docs/testing/test-plan.md) · [Phase 2 test report](docs/testing/phase-2-report.md) · [Phase 3 test report](docs/testing/phase-3-report.md)

## Quick start (for developers)

Requires Node.js 22.

```bash
npm ci                    # install exact dependency versions
npm run dev               # run locally at http://localhost:5173
npm run validate-content  # check every content file
npm run check             # content + lint + format + types + unit/integration tests
npm run test:e2e          # browser tests (builds the app first)
npm run build             # production build in dist/
```

## Disclaimer

This is a clinical reference prototype. Always confirm guidance against the current approved CARPA manual and
applicable local procedures. Follow required consultation and escalation processes. This software is not a source of
authority to supply or administer medicines.
