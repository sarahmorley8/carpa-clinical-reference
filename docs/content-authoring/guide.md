# Adding and editing clinical content — a guide for non-programmers

> **Before you enter any real CARPA content**, read [licensing.md](../clinical-governance/licensing.md). Entering
> content from the manual needs permission from the publisher, especially if the app will ever be shared.

You never need to touch the app's code. All clinical content lives in **JSON files** in the `content/` folder. JSON is
plain text with a strict format — the app checks every file and tells you exactly what is wrong if you make a mistake.

## 1. The ideas in 60 seconds

- **One file per presentation** (e.g. asthma). It holds red flags, assessment items, management steps and so on.
- **Every clinical statement carries its own source citation**: source, section, page. The app shows the page next to
  every item so you can check it against the book.
- **Placeholders:** anything not yet entered is written as `"[ENTER FROM APPROVED CARPA SOURCE: edition, section and
page]"` (for text) or `null` (for numbers). The app shows these as **NOT ENTERED** — never as a blank and never as a
  guess.
- **Patient groups:** every item says who it applies to, e.g. `"populations": ["adult"]` or `["adult", "child"]`.
- **Status:** each file has a status — `draft`, `under-review`, `approved`, `published`, `superseded`. In this
  prototype, _nothing_ is treated as approved clinical guidance, whatever the status says.

## 2. Where files go

| Folder                             | What                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `content/presentations/`           | Presentations you are filling in                                                                     |
| `content/medications/`             | One file per medicine (formulations and doses per indication)                                        |
| `content/observations/`            | Normal observation ranges (`vital-signs.json`)                                                       |
| `content/references/`              | Shared lists: sources, patient groups, body systems, critical tiles, search synonyms, phone contacts |
| `content/templates/presentations/` | Empty templates — **copy, don't edit in place**                                                      |
| `content/examples/`                | The made-up DEMONSTRATION example. Look, but never copy values from it.                              |

## 3. Filling in a template (e.g. asthma)

1. **Copy** `content/templates/presentations/asthma.json` to `content/presentations/asthma.json`.
   The copy automatically replaces the template in the app (same id).
2. Open the copy in a text editor (on GitHub: open the file → pencil icon).
3. In `meta`:
   - `extracted` → put today's date (`YYYY-MM-DD`) and your name.
   - `sources` → the CARPA section and page(s) this presentation comes from.
   - `populations` → remove `"child"` or `"adult"` if the manual does not cover that group for this presentation.
4. Work through each section, replacing every `[ENTER ...]` placeholder **exactly as written in the manual**, with the
   `cite` section and page for that item. Add more items by copying an existing one and giving it a new unique `id`.
5. Delete the `authoringNotes` lines you no longer need (they are never shown as clinical content).
6. **Check your work:** run `npm run validate-content`, or push the change to GitHub and look at the automated check
   (a red ✗ means problems; click it to see the plain-English report). The same report appears in the app under
   **Settings → Content problems**.
7. Open the presentation in the app and compare every item against the manual, page by page.

### What an item looks like

```json
{
  "id": "history-1",
  "text": "Exactly as written in the manual",
  "cite": { "sourceId": "carpa-stm", "section": "Section name", "page": "123" },
  "populations": ["adult", "child"]
}
```

Red flags and consult criteria also have an `"action"`: `evacuate`, `consult-now`, `consult-soon` or `see-source`.

## 4. Adding a brand-new presentation

1. Copy any template (they all have the same structure) to `content/presentations/<new-id>.json`. Use lower-case
   words joined by hyphens for the file name and id, e.g. `snake-bite.json` / `"id": "snake-bite"`.
2. Change `meta.id`, `meta.title`, `bodySystems` (ids from `references/body-systems.json`) and `keywords`.
3. Fill it in as in section 3.
4. To show it as a red CRITICAL tile, add its id to the right category in `references/critical-categories.json`.

## 5. Management steps (the pathway)

The management section is a set of **steps** joined by **branches**.

- Step `type`: `info` (information), `question` (needs an answer), `action` (something to do; can link medicines and a
  timer), `escalation` (consult/escalate; links contacts), `terminal` (end of the pathway).
- Only `question` steps can branch. Each branch has a `condition` and a `label` written as in the manual
  (e.g. `"If no improvement"`).
- **Only write branches the manual actually states.** If the manual does not say what to do for an answer, leave it
  out — the app will then stop and tell the user the source does not define a next step. It never guesses.
- `reassess` branches go back to an earlier step (e.g. "reassess after treatment").

See the DEMONSTRATION file `content/examples/presentations/demo-fictional-fever.json` for a complete worked example.

## 6. Common problems and what they mean

| Message                                        | Usually means                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| _not valid JSON (line 12, column 5)_           | A missing or extra comma, quote or bracket near that line                           |
| _Wrong kind of value. Expected a number_       | A unit was typed into a number, e.g. `"5mg"` — write `5` and put the unit in `unit` |
| _Unknown field "folowUp"_                      | A spelling mistake in a field name                                                  |
| _Missing required field "cite"_                | Every item needs a citation                                                         |
| _Source "carpa" does not exist_                | The id must match one in `references/sources.json` (`carpa-stm`)                    |
| _Marked "approved" but still has placeholders_ | Only complete content can be approved                                               |
| _Answer "no" matches both branch A and B_      | Two branches claim the same answer                                                  |

## 7. Getting content approved

Read [lifecycle-and-approval.md](../clinical-governance/lifecycle-and-approval.md). In short: you enter (`draft`), a
reviewer checks it against the manual (`under-review` → `approved`), and only a controlled release can make it
`published`. Self-review is shown on screen as **SELF-REVIEWED — NOT INDEPENDENTLY VERIFIED**.
