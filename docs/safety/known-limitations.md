# Known limitations (Phase 3)

- **No approved clinical content.** Templates and a fictional demonstration only.
- **Not yet tested on a real iPhone or Android phone.** Offline install, timers with the screen locked, sound,
  backgrounding and the update flow are tested automatically in Chromium only. Manual device scripts are in
  `docs/testing/manual-device-tests.md`.
- **Timers:** alerts are only reliable while the app is open on screen. iPhones do not vibrate for web apps and may
  mute sound in silent mode. If the phone kills the app in the background, timers are lost (memory only, by design).
- **Inactivity clear** removes running timers too (decision D21).
- **On-device rollback** is not available: a failed update never activates, and rolling back is done by publishing an
  earlier release (Phase 4 documents the procedure).
- **Releases change every build** unless `SOURCE_DATE_EPOCH` is set, so phones will offer an update after every deploy.
- **Calculator** works only for the fictional demonstration medicine. It is not a clinical tool.
- **Approval cannot be verified** yet (Phase 5).
- **ISBAR** only uses what was ticked/answered/typed; it does not know what was said on the phone.
- **Validator bundle size:** pre-compiled validators add ~34 KB (gzipped) to the app.
- **Synonyms** are spelling variants only; clinical synonyms need approval.
- **Disclaimer on first launch** blocks the app until accepted (once per device and disclaimer version).
- **Browser limits** (clipboard, app switcher, backgrounding): see `docs/privacy/privacy-design.md`.
- **Device clock:** "review overdue" and "days since update check" depend on the phone's date being correct.
