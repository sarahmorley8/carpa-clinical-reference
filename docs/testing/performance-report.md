# Performance report (Phase 4)

Measured by `tests/e2e/verification.spec.ts` on 2026-10-26: Chromium, Pixel 7 profile, **CPU slowed 4×** (approximates
a mid-range phone), network **off** (app served from the offline cache). Real-phone timings still need measuring
(manual script step 13).

| Measure                                               | Target (plan §9.2) | Result                                 | Status |
| ----------------------------------------------------- | ------------------ | -------------------------------------- | ------ |
| Cold launch to interactive Home, offline (3 runs)     | < 2000 ms          | 406–695 ms                             | ✔     |
| Search feedback per keystroke (8 queries incl. typos) | < 200 ms           | 11–28 ms                               | ✔     |
| Emergency pathway reachable                           | ≤ 2 taps           | 1 tap (critical tile), 2 to escalation | ✔     |

## Size

| File                       | Size (gzip)                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------ |
| JavaScript                 | 123.0 KB (React ~45 KB, pre-compiled validators ~34 KB, decimal.js, MiniSearch, app) |
| CSS                        | 4.9 KB                                                                               |
| Content release (17 files) | 5.5 KB                                                                               |
| Offline download total     | ~ 140 KB compressed, 13 files                                                        |

Search index is built on the device at load from ~6 presentations; with 200 presentations it is expected to remain well
within target (MiniSearch indexes thousands of short documents in milliseconds), but this has not been measured with
real content and should be re-run in Phase 5.
