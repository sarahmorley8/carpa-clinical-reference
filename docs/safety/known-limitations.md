# Known limitations (Phase 4)

- **No approved clinical content.** Templates and a fictional demonstration only.
- **Not yet tested on a real iPhone or Android phone.** Offline install, timers with the screen locked, sound,
  backgrounding and the update flow are tested automatically in Chromium only. Manual device scripts are in
  `docs/testing/manual-device-tests.md`.
- **Timers:** alerts are only reliable while the app is open on screen. iPhones do not vibrate for web apps and may
  mute sound in silent mode. If the phone kills the app in the background, timers are lost (memory only, by design).
- **Inactivity clear** removes running timers too (decision D21).
- **On-device rollback** is not available: a failed update never activates, and rolling back is done by publishing an
  earlier release (`docs/deployment/deploy-and-rollback.md`).
- **Not hosted yet.** The deploy workflow is ready but switched off until a Cloudflare account is connected.
- **Hosting login:** with Cloudflare Access, an installed app cannot renew an expired login by itself; update checks
  fail until you use **Sign in to receive updates** in Settings (the app warns).
- **No signed releases:** a compromised hosting account could publish a self-consistent release (Phase 5).
- **Performance figures are simulated** (4× slowed desktop CPU), not measured on a phone.
- **Releases change with every commit** (build time comes from the commit), so phones are offered an update after each
  deploy of a new commit; rebuilding the same commit produces identical files.
- **Calculator** works only for the fictional demonstration medicine. It is not a clinical tool.
- **Approval cannot be verified** yet (Phase 5).
- **ISBAR** only uses what was ticked/answered/typed; it does not know what was said on the phone.
- **Validator bundle size:** pre-compiled validators add ~34 KB (gzipped) to the app.
- **Synonyms** are spelling variants only; clinical synonyms need approval.
- **Disclaimer on first launch** blocks the app until accepted (once per device and disclaimer version).
- **Browser limits** (clipboard, app switcher, backgrounding): see `docs/privacy/privacy-design.md`.
- **Device clock:** "review overdue" and "days since update check" depend on the phone's date being correct.
