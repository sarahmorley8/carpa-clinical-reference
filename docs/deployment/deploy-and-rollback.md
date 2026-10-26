# Deploying, updating content and rolling back

## How a change reaches your phone

```
edit content (GitHub)  →  pull request  →  CI: content check, lint, tests, e2e, reproducible build
        →  you review and merge  →  Deploy workflow builds and uploads to Cloudflare Pages
        →  phone (online) checks for updates  →  downloads every file and checks its SHA-256
        →  "An update has been downloaded and checked"  →  you tap Apply (only when no patient session is open)
```

Nothing changes on the phone until every file of the new release has downloaded and matched its fingerprint, and
you have tapped **Apply update now**.

## Updating content (no programming)

1. On GitHub, open the file in `content/…` → pencil icon → edit (see the
   [authoring guide](../content-authoring/guide.md)).
2. Choose **Create a new branch and start a pull request**.
3. Wait for the checks. A red ✗ on _CI_ means a content problem: open _Details_ → the _Content check_ step lists each
   problem in plain English. Fix and commit again.
4. When all checks are green, review the change (and, from Phase 5, have the reviewer approve it), then **Merge**.
5. The _Deploy_ workflow publishes it. Open the app online; apply the update when prompted.
6. Confirm in **Settings → Versions** that the content release id changed.

## Deploying manually (without GitHub Actions)

```bash
npm ci
npm run check
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) npm run build
npx wrangler pages deploy dist --project-name=carpa-reference   # or upload dist/ in the Cloudflare dashboard
```

## Verifying a deployment

- Open the site online. Settings → Versions shows the release id; Settings → Offline readiness shows **Ready**
  after a few seconds.
- On the phone: apply the update, then do the airplane-mode test in [install-on-phone.md](install-on-phone.md).

## Rolling back

A failed update never activates, so a broken _download_ needs no rollback. To withdraw a release that installed but
should not be used (e.g. a content error):

1. **Fastest:** Cloudflare dashboard → your Pages project → Deployments → choose the last good deployment →
   _Rollback to this deployment_. (Or revert the commit on GitHub; the Deploy workflow republishes.)
2. Phones receive the earlier release **as an update**: it downloads, is verified, and waits for **Apply update now**.
3. Tell users to open the app online and apply the update. Check Settings → Versions for the expected release id.

Because builds are reproducible, rolling back to an earlier commit produces exactly the earlier files. There is no
on-phone "go back" button (decision D30); rollback always goes through the same verified update path.

## If content has a safety problem

1. Roll back as above, or remove the presentation from `content/presentations/` and deploy.
2. Record it as an incident (Phase 6 process; until then, note it in `docs/safety/defect-register.md`).
3. Until phones have updated, tell users directly which presentation not to use.
