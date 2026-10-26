# Security and privacy review (Phase 4)

Scope: the static web app, its build and deployment pipeline. Method: threat model review, code review of storage,
rendering and network paths, automated tests, dependency audit. This is an internal engineering review, **not** an
independent penetration test or certification.

## Threat model status

| Threat                               | Controls                                                                                                              | Evidence                                                                | Residual                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Lost or stolen device                | No patient data persisted; memory only; 60-min inactivity clear                                                       | e2e storage inspection; inactivity tests                                | Low (device passcode recommended)                                                                                        |
| Shared device                        | End session; inactivity clear; no patient history                                                                     | integration tests                                                       | Low                                                                                                                      |
| Malicious content file               | Schema validation, unknown fields rejected; content always rendered as text; lint bans HTML injection APIs            | e2e: `<img onerror>` / `<script>` in content displayed as text, not run | Low                                                                                                                      |
| Compromised hosting / tampered files | SHA-256 per file checked before install and on load; strict CSP; access restriction (Cloudflare Access)               | e2e tampered release blocked                                            | Medium — an attacker controlling the host could publish a consistent new release; **signed manifests planned (Phase 5)** |
| Unauthorised content change          | PR review + CI; branch protection recommended (see below); deploys only from `main`                                   | workflow files                                                          | Medium until branch protection and Phase 5 approvals                                                                     |
| Clipboard exposure                   | Warning before every ISBAR copy; no identifiers added automatically                                                   | integration test                                                        | Low–medium (OS behaviour)                                                                                                |
| Browser storage                      | Single preferences key, allow-listed fields; lint forbids other storage                                               | unit + e2e                                                              | Low                                                                                                                      |
| Debug logs / analytics               | `console` banned by lint; no analytics, error reporting or third-party requests                                       | e2e: zero requests to other origins                                     | Low                                                                                                                      |
| Dependency vulnerabilities           | 4 runtime dependencies (all MIT); pinned versions; lockfile; `npm audit` in CI                                        | 0 known vulnerabilities (2026-10-26)                                    | Low — monitor                                                                                                            |
| Service worker abuse                 | Same-origin only; caches only listed files; never self-activates; `updateViaCache: 'none'`                            | offline e2e                                                             | Low                                                                                                                      |
| Cross-site framing / clickjacking    | `frame-ancestors 'none'`, `X-Frame-Options: DENY` (header)                                                            | `_headers` test                                                         | Low (not on GitHub Pages)                                                                                                |
| Supply chain in CI                   | Actions pinned to major versions; minimal token permissions (`contents: read`); Cloudflare token scoped to Pages only | workflow review                                                         | Low–medium (pin actions to commit SHAs for organisational use)                                                           |

## Browser security policy

Production pages carry a meta Content-Security-Policy and the host sends:

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self';
manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer · X-Content-Type-Options: nosniff · X-Frame-Options: DENY ·
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=() · Cross-Origin-Opener-Policy: same-origin
```

No `unsafe-inline` or `unsafe-eval`: JSON Schema validators are pre-compiled at build time. e2e confirms no inline
scripts and no CSP violations across 7 screens.

## Recommendations before organisational use

1. **Branch protection on `main`:** require pull requests, passing CI, and (Phase 5) CODEOWNERS approval.
2. **Signed release manifest** verified by the app (Phase 5).
3. Pin GitHub Actions to commit SHAs; enable Dependabot alerts.
4. Independent security review / penetration test if deployed by an organisation.
5. Privacy Impact Assessment (see regulatory checklist).

Dependencies: [dependencies.md](dependencies.md).
