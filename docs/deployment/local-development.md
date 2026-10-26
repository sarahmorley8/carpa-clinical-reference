# Running the app locally

Requires Node.js 22 (see `.nvmrc`).

```bash
npm ci            # install exact versions from package-lock.json
npm run dev       # http://localhost:5173 — reloads when content or code changes
```

To try it on your phone over the same Wi-Fi: `npm run dev -- --host`, then open the "Network" address it prints on
your phone. (This is a development preview only: it is not installed and does not work offline.)

## Checks

```bash
npm run validate-content   # content report (same as Settings → Content problems)
npm run check              # content + lint + format + types + unit/integration tests
npm run test:e2e           # builds, serves on :4173 and runs browser tests
```

## Production build

```bash
npm run build      # outputs dist/ (app + release/manifest.json + release/content.json)
npm run preview    # serve dist/ locally
```

`public/_headers` sets security headers on Cloudflare Pages/Netlify. Hosting, phone installation, offline
verification, content updates and rollback are documented in Phase 4, once offline support exists.
