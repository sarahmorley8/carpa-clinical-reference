# Test plan

| Layer         | Tool                                   | Where                     | Covers                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content check | `npm run validate-content`             | CI + local                | Every real content file                                                                                                                                                                                                                                   |
| Unit          | Vitest                                 | `tests/unit`              | Schema errors (plain English), lifecycle/tier rules, cross-references and cascades, pathway graph checks, placeholders, status labels, release integrity, search, router, preferences sanitising, session reducer, browser-vs-Node validator equivalence  |
| Integration   | Vitest + Testing Library (jsdom)       | `tests/integration`       | Disclaimer, home, critical navigation, search, pathway section order, NOT ENTERED display, population filtering, End session, storage contains no patient data                                                                                            |
| End-to-end    | Playwright (Pixel 7 profile, Chromium) | `tests/e2e`               | 2-tap emergency access, search, adult/child views, no persistence + reload clears, End session, preferences persist, tampered release blocked, malformed file blocked while the rest works, axe WCAG 2.2 AA (light + dark, 5 screens), touch-target sizes |
| Manual device | Scripts in `manual-device-tests.md`    | iPhone (primary), Android | Install, sunlight/low light, VoiceOver/TalkBack, (Phase 3) offline, timers, backgrounding                                                                                                                                                                 |

Clinical expectations (e.g. dose results for real medicines) must come from authorised sources and independent review,
never from AI-generated answers. Current calculator-related data is synthetic.

Phase 3 adds: engine `evaluate()` state transitions (property-based), calculator (boundaries, units, rounding, max
dose, cumulative), offline launch, failed update keeps previous release, interrupted install, inactivity clear.
