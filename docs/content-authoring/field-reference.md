# Content field reference (schema version 1)

The authoritative rules are the JSON Schemas in [`schemas/`](../../schemas). This page explains them in plain English.
All ids are lower-case letters, numbers and single hyphens (`chest-pain`). Dates are `YYYY-MM-DD`.

## Common pieces

**Citation** (`cite`) — required on every clinical statement.

| Field      | Meaning                              |
| ---------- | ------------------------------------ |
| `sourceId` | An id from `references/sources.json` |
| `section`  | Section or chapter as printed        |
| `page`     | Page number(s) as printed            |

**Statement** — one clinical item: `id`, `text`, `cite`, `populations`, optional `severity` (`critical`, `caution`,
`info`).

**Quantity** — `{ "amount": number or null, "unit": "mg" }`. Units allowed: `g`, `mg`, `microgram`, `nanogram`, `mL`,
`L`, `unit`, `mmol`. (`microgram` is written in full to avoid mcg/mg confusion.)

**meta** — on every presentation, medication and observation set:

| Field            | Meaning                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `id`, `title`    | Unique id and display title                                                                        |
| `contentVersion` | Version of this content, e.g. `1.0.0`                                                              |
| `status`         | `draft`, `under-review`, `approved`, `published`, `superseded`                                     |
| `demonstration`  | `true` only for files in `content/examples/`                                                       |
| `populations`    | Patient groups this file covers                                                                    |
| `sources`        | Main citations for the whole file                                                                  |
| `extracted`      | `date` and `by` — who entered it and when                                                          |
| `review`         | `reviewedDate`, `reviewer` (`name`, `role`), `approvalDate`, `nextReviewDate` (each may be `null`) |
| `supersededBy`   | Id of the replacement (only when status is `superseded`)                                           |
| `dependsOn`      | Ids of other files this relies on (e.g. medications)                                               |
| `authoringNotes` | Notes for authors. Never shown as clinical content.                                                |

## Presentation (`kind: "presentation"`)

| Field                    | Meaning                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `bodySystems`            | Ids from `references/body-systems.json`                                                 |
| `keywords`, `symptoms`   | Words for search                                                                        |
| `redFlags`               | Statements with `action`: `evacuate`, `consult-now`, `consult-soon`, `see-source`       |
| `assessment`             | `history`, `observations` (may link `parameterKey`), `examination` — all tick-box items |
| `observationSetRefs`     | Ids of observation sets (`vital-signs`)                                                 |
| `investigations`         | Tick-box items                                                                          |
| `pathway`                | `entryNode`, `nodes` (steps), `edges` (branches) — see below                            |
| `medications`            | Regimen ids shown in the medication reference section                                   |
| `escalation`             | `consultCriteria` (with `action`), `retrievalCriteria`, `contactRefs`                   |
| `monitoring`, `followUp` | Statements                                                                              |
| `relatedPresentations`   | Optional ids                                                                            |

### Pathway steps (`nodes`)

All steps: `id`, `type`, `text`, `cite`, `populations`, optional `severity`.

| `type`       | Extra fields                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `info`       | —                                                                                                                       |
| `question`   | `input`: `kind` (`yes-no`, `choice`, `number`), `options` (for choice), `unit` (for number), `required`, `allowUnknown` |
| `action`     | optional `regimenRefs`, optional `timer` (`label`, `durationMinutes` or `null`, `cite`)                                 |
| `escalation` | optional `contactRefs`                                                                                                  |
| `terminal`   | `outcome`: `continue-per-source`, `consult`, `evacuate`, `go-to-presentation` (+ `targetPresentation`)                  |

### Branches (`edges`)

`id`, `from`, `to`, `kind` (`normal` or `reassess`), `cite`, and for branches leaving a question: `condition` + `label`.

Conditions (never run as code):

| Form                                                                    | Meaning                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `{ "answer": "q-id", "eq": "yes" }`                                     | answer equals a value                                              |
| `{ "answer": "q-id", "in": ["a", "b"] }`                                | answer is one of these                                             |
| `{ "answer": "q-id", "compare": "gte", "value": null, "unit": "/min" }` | number comparison (`gt`, `gte`, `lt`, `lte`); `null` until entered |
| `{ "unknown": "q-id" }`                                                 | answer was "Unknown" (only if the source defines this)             |
| `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`              | combinations                                                       |

Rules checked automatically: no loops except `reassess`; every step reachable; every route ends at a `terminal` step;
only questions branch; branches don't claim the same answer; conditions only use earlier answers; branch values match
the question's options; units match.

## Medication (`kind: "medication"`)

`name`, `formulations` (`id`, `description`, `strength` = amount + unit + optional `perVolume`), `contraindications`,
`cautions`, and `regimens`. Each regimen is one indication + population + route:

| Field                                                        | Meaning                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `indication`, `route`, `populations`, `formulationIds`       | as named                                                                                              |
| `doseText`                                                   | **The dose exactly as written in the source** — always displayed                                      |
| `dosing`                                                     | Structured dose for the (future) calculator — `weight-based`, `fixed`, `age-band` or `reference-only` |
| `frequency`, `duration`, `maxDoseText`, `monitoring`, `cite` | as named                                                                                              |

`weight-based` fields: `dosePerKg`, `maxSingleDose`, `minSingleDose`, `maxCumulative` (`amount`, `unit`,
`periodHours`), `applicableWeightKg` (`min`, `max`), `rounding` (`mode`, `increment`, `unit`) — `null` where the source
gives nothing. The calculator is not enabled for patient care.

## Observation set (`kind: "observation-set"`)

`parameters` (`key`, `label`, `unit`) and `bands` (`id`, `populationId`, `label` e.g. an age band, `values` with
`parameterKey`, `low`, `high`, optional `note`, and `cite`).

## Reference lists (`content/references/`)

Each file: `schemaVersion`, `kind`, `items`.

| `kind`                | Item fields                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `sources`             | `id`, `title`, `publisher`, `edition`, `editionDate`, `notes`              |
| `populations`         | `id`, `label`, `definition`, `cite` (or `null`)                            |
| `body-systems`        | `id`, `label`                                                              |
| `critical-categories` | `id`, `label`, `presentationIds` (navigation only)                         |
| `synonyms`            | `id`, `terms` (2 or more equivalent search words)                          |
| `contacts`            | `id`, `label`, `phone`, `description`, `verified` (`date`, `by`) or `null` |

## Versioning

Files declare `schemaVersion` (`1.x.x`). The app reads major version 1 only; anything else is rejected with a clear
message. See [`schemas/CHANGELOG.md`](../../schemas/CHANGELOG.md) for changes and migration rules.
