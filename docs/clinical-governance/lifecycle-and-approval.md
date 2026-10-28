# Content lifecycle and approval

```
 Draft ──► Under review ──► Approved ──► Published ──► Superseded
 (author)   (reviewer)       (reviewer)    (release)     (replaced)
```

## Who does what

| Role                 | Responsibility                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Author**           | Enters content exactly as written in the source, with a citation for every statement. Sets `extracted`.       |
| **Reviewer**         | Checks every item against the source, page by page, including numbers, units and populations. Fills `review`. |
| **Release approver** | Confirms that only approved content is included and signs off the release (Phase 5).                          |
| **Governance owner** | Accepts residual risks, owns incident reporting and review dates (Phase 6).                                   |

For now (personal prototype) the user holds all roles. Anything reviewed by the person who entered it is labelled
**SELF-REVIEWED — NOT INDEPENDENTLY VERIFIED**.

## Why a status field is not enough

Anyone can type `"status": "approved"`. From Phase 5, content counts as approved only when **all** of these hold:

1. **Approval record** — `content/approvals/<id>@<version>.json` names the reviewer, role, date and the **SHA-256 of
   the exact file reviewed**.
2. **Protected review** — the record reaches the main branch only through a GitHub pull request approved by a
   designated reviewer (CODEOWNERS + branch protection). Git history is the audit trail.
3. **Hash still matches** — the build recomputes every hash; any change after approval, even one character, makes the
   unit unapproved and fails a clinical build.
4. (Organisational profile) the reviewer is a different person from the author, and the release manifest is signed with
   a key held only by the release approver; the app verifies the signature before activating content.

## What the app enforces today (Phase 2)

- Approved/published files must have no placeholders, no missing numbers, and all review fields filled; otherwise they
  are rejected.
- `displayStatus()` always returns `usableAsGuidance: false`; every screen shows status labels.
- Templates must stay `draft`; demonstration content must be in `content/examples/` and is excluded from clinical
  profiles, which are disabled.
- Past `nextReviewDate` ⇒ red **REVIEW OVERDUE — VERIFY AGAINST MANUAL** (content stays visible; decision D4).
