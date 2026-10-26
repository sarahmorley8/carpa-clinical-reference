# Accessibility report (Phase 4)

Target: WCAG 2.2 AA. This report covers automated and scripted checks; **manual screen-reader testing on a real iPhone
(VoiceOver) and Android phone (TalkBack) has not been done yet** and is required before this can be called conformant.

## Automated (axe-core 4.11, rules WCAG 2.0/2.1/2.2 A+AA + best practice)

11 screens × light and dark theme (Home, demo pathway, template pathway, escalation, settings, tools, timers, ISBAR,
calculator, browse, content problems).

| Result                             | Count                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Serious / critical violations      | **0** (enforced in CI for 9 screens × 2 themes)                                                                           |
| Moderate                           | 1 rule on every screen — `region`: the "preview build" banner was outside a landmark. **Fixed** (now an `aside` landmark) |
| "Needs review" (axe cannot decide) | `color-contrast` on text over gradients/overlays — checked manually below                                                 |

## Colour contrast (computed, `node scripts/contrast-report.mjs`)

All 25 colour pairs used for text and controls pass: body text 15–16:1, muted text ≥ 7.4:1, white on critical tiles
≥ 4.9:1 including the highlight area (reduced from 16% to 10% white after the dark-theme highlight measured 4.41:1),
status tints ≥ 7.9:1, control borders ≥ 4.3:1 (3:1 needed).

## Scripted checks (Playwright)

| Check                                                                                                                                                 | Result                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Keyboard only: disclaimer → critical tile → tick an item → open and cancel a dialog with Escape (focus starts on the safe button, returns afterwards) | ✔                                                                   |
| Touch targets: main controls ≥ 44 px, every control ≥ 24 px (WCAG 2.5.8)                                                                              | ✔                                                                   |
| No sideways scrolling at 320 px width, and at 150% text size                                                                                          | ✔                                                                   |
| Colour never the only signal (text + icon on every status, red flag and step)                                                                         | ✔ by design and review                                              |
| Reduced motion respected                                                                                                                              | ✔ (`prefers-reduced-motion` disables transitions)                   |
| Status messages announced (`role=status` / `alert`) for cleared answers, STOP states, timer alerts, inactivity warning                                | ✔ (markup verified; announcement wording needs screen-reader check) |

## Outstanding

- VoiceOver (iPhone) and TalkBack (Android) walkthroughs — manual script steps 7 and 11.
- Sunlight and low-light readability on a real phone — steps 3–4.
- Usability check with other remote area nurses (IEC 62366-1 practice) before organisational use.
