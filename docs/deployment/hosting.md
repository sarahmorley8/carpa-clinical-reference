# Hosting

The app is a set of static files (`dist/`), so any static host works. Free hosting is fine for this **non-clinical
prototype**; clinical or organisational use needs a separate security, governance and operational assessment (who
controls the account, uptime, incident response, data-sovereignty and procurement rules).

## Comparison

|                                             | Cloudflare Pages (recommended)                          | Netlify                               | GitHub Pages                                                    |
| ------------------------------------------- | ------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Cost for this app                           | Free                                                    | Free tier                             | Free (public repos)                                             |
| Security headers (`public/_headers`)        | ✔                                                      | ✔                                    | ✘ (only the weaker in-page CSP applies)                         |
| Restrict to your email address              | ✔ Cloudflare Access (Zero Trust, free for small teams) | Password protection is a paid feature | ✘ — site is public; Pages from a private repo needs a paid plan |
| Deploy previews                             | ✔                                                      | ✔                                    | ✘                                                               |
| Roll back to an earlier deploy              | ✔ one click                                            | ✔ one click                          | Re-run an older build                                           |
| Fits licensing caution (content not public) | ✔ with Access                                          | Partly                                | ✘                                                               |

**Recommendation:** Cloudflare Pages with Cloudflare Access limiting the site to your email address (decision D29).
Until CARPA permission is confirmed this matters less (the build holds only templates and fictional content), but it
sets up the right habit before real content is entered.

## One-time setup (Cloudflare Pages + Access)

Menu names in Cloudflare change from time to time; if a label differs, look for the closest match.

1. **Create a Cloudflare account** (free) at cloudflare.com.
2. **Create the Pages project:** Workers & Pages → Create → Pages → _Direct upload_ → name it, e.g.
   `carpa-reference`. Upload the `dist/` folder once (from `npm run build`) to create it. You get an address like
   `https://carpa-reference.pages.dev`.
3. **Restrict access:** Zero Trust → Access → Applications → Add an application → _Self-hosted_ →
   domain `carpa-reference.pages.dev` (add `*.carpa-reference.pages.dev` too, for previews). Policy: _Allow_, Include →
   _Emails_ → your email address. Login method: _One-time PIN_. Set the **session duration to the longest allowed**
   (e.g. 1 month).
4. **Automatic deploys from GitHub** (optional but recommended):
   - Cloudflare: My Profile → API Tokens → Create Token → template _Edit Cloudflare Workers_, or a custom token with
     only **Account → Cloudflare Pages → Edit**. Copy it. Note your **Account ID** (shown on the Workers & Pages page).
   - GitHub repository → Settings → Secrets and variables → Actions:
     - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
     - Variables: `CLOUDFLARE_PAGES_PROJECT` = `carpa-reference`, `DEPLOY_ENABLED` = `true`
   - Every merge to `main` now runs all checks, builds reproducibly and deploys (`.github/workflows/deploy.yml`).
5. **Check the headers:** open the site, then in a desktop browser's developer tools → Network → the page →
   Response headers: `Content-Security-Policy` with `frame-ancestors 'none'` should be present.
6. Install on your phone: [install-on-phone.md](install-on-phone.md).

## Sign-in and offline use

With Access, the first visit asks for your email and a one-time PIN. After that the installed app runs from its
offline copy and never shows the sign-in page, so when the Access session expires **update checks start failing
silently in the background** (the app keeps working on the version it has). The app handles this:

- Settings shows **"Could not check for updates"** after a failed check, and the Home screen warns after 30 days without
  a successful check.
- **Sign in to receive updates** (Settings) opens `signin.html`, which is never cached, so the Access login appears.
  After signing in, go back to the app; the next check downloads any update.

## Other hosts

- **Netlify:** drag the `dist/` folder onto app.netlify.com → Sites. `_headers` is honoured. No free access restriction.
- **GitHub Pages:** works technically (relative paths, hash routing), but the site is public and custom headers are
  ignored. Not recommended for this project.
