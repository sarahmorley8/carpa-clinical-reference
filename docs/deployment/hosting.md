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
2. **Create an API token for GitHub:** My Profile → API Tokens → Create Token → _Create Custom Token_.
   Permissions: **Account → Cloudflare Pages → Edit** (nothing else). Account resources: your account. Create, then
   **copy the token** (it is shown once). Never paste it into chat or email.
3. **Find your Account ID:** Workers & Pages overview (right-hand side), or the URL `dash.cloudflare.com/<account id>`.
4. **Add them to GitHub:** repository → Settings → Secrets and variables → Actions.
   - _Secrets_ tab → New repository secret: `CLOUDFLARE_API_TOKEN` (the token), `CLOUDFLARE_ACCOUNT_ID`.
   - _Variables_ tab → New repository variable: `CLOUDFLARE_PAGES_PROJECT` = `carpa-reference`,
     `DEPLOY_ENABLED` = `true`.
5. **Deploy:** merge the pull request (or Actions → Deploy → _Run workflow_). The workflow runs every check, creates
   the Pages project the first time, builds reproducibly and deploys. The app is then at
   `https://carpa-reference.pages.dev` (if that name is taken, choose another in step 4 and use it below).
6. **Restrict access to your email:** Zero Trust (left menu; choose the _Free_ plan if asked) → Access →
   Applications → Add an application → _Self-hosted_. Add the domains `carpa-reference.pages.dev` and
   `*.carpa-reference.pages.dev`. Policy: _Allow_, Include → _Emails_ → your email address. Login method:
   _One-time PIN_. Session duration: the longest allowed (e.g. 1 month).
7. **Check:** open the address in a private browser window — you should be asked for your email and a PIN before the
   app appears.
8. Install on your phone: [install-on-phone.md](install-on-phone.md).

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
