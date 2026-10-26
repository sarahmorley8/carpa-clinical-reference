# Known limitations (Phase 2)

- **Not offline.** The preview needs an internet connection; it is not yet installable as an offline PWA (Phase 3).
- **No approved clinical content.** Templates and a fictional demonstration only.
- **Management steps are a static list.** Interactive step-by-step navigation (answers, MISSING/CONFLICT states,
  invalidation of later answers) arrives in Phase 3.
- **No timers, ISBAR, dose calculator or inactivity clear yet** (Phase 3).
- **Approval cannot be verified.** Status fields are displayed but never trusted (Phase 5).
- **iPhone icon:** only an SVG icon; iOS home-screen icons need PNGs (Phase 3).
- **Automated tests run in Chromium only.** Real iPhone/Android testing is manual and has not been done yet.
- **Validator bundle size:** pre-compiled validators add ~34 KB (gzipped) to the app.
- **Synonyms:** the starter synonym list is spelling variants only; clinical synonyms/abbreviations need approval.
- **Body systems and critical-tile mapping** are a navigation starting point, editable in `content/references/`.
- **Disclaimer on first launch** blocks the app until accepted (once per device and disclaimer version).
- **Browser limits** (clipboard, app switcher, backgrounding): see `docs/privacy/privacy-design.md`.
- **Device clock:** "review overdue" depends on the phone's date being correct.
