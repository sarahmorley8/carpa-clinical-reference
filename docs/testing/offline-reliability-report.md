# Offline reliability report (Phase 4)

## Design

- The service worker installs a release only if **every** file (13) downloads and matches its SHA-256; otherwise the
  install fails, the partial cache is deleted and the previous release keeps running.
- "Offline ready" is shown only after the page re-checks every cached file against its hash.
- A new release never activates by itself; **Apply update now** appears only when no patient data is open.
- `signin.html` is never cached so an expired hosting login can be renewed.

## Automated evidence (Chromium)

| Scenario                                                                                                                                           | Result |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| First visit installs and verifies all files; network off; reload → Home, Chest pain, demo pathway work                                             | ✔     |
| Cached file damaged → re-check reports NOT ready and names the file                                                                                | ✔     |
| New release with a wrong hash → install fails, banner "update could not be installed", previous release still works offline, partial cache removed | ✔     |
| New release while a patient item is ticked → held; Apply hidden; after End session → applied; only new cache remains; readiness re-verified        | ✔     |
| Sign-in page goes to the network online, falls back to the app offline, never cached                                                               | ✔     |
| Offline cache contains only release files (no patient data)                                                                                        | ✔     |
| Builds reproducible (identical files and service worker from the same commit)                                                                      | ✔     |

## Platform behaviour to confirm on real phones (not yet tested)

| Topic                                                | Expected                                                                                                   | Risk                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| iOS home-screen app storage                          | Installed web apps are generally exempt from Safari's 7-day data clearing; app requests persistent storage | Medium — verify by leaving the phone for > 7 days |
| iOS low storage                                      | iOS may evict website data; app would show NOT ready / fail to open offline                                | Low–medium                                        |
| Deleting the home-screen icon / clearing Safari data | Removes the offline copy; reinstall online                                                                 | Known                                             |
| Background timers                                    | Not reliable on iOS when the app is backgrounded or screen locked                                          | Documented limitation                             |
| Update while offline for weeks                       | Keeps working on the installed release; 30-day warning                                                     | Designed                                          |

Manual script: `manual-device-tests.md` steps 12–21.
