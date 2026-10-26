import { expect, test, type Page } from '@playwright/test';

async function installAndWaitReady(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('link', { name: 'Offline ready' })).toBeVisible({ timeout: 20_000 });
}

/** Publish a modified copy of the current sw.js on the test server (simulates a new release). */
async function serveModifiedWorker(page: Page, change: (sw: string) => string) {
  const original = await (await page.request.get('/sw.js')).text();
  await page.request.post('/__test/sw', { data: change(original), headers: { 'Content-Type': 'text/plain' } });
}

test.afterEach(async ({ request }) => {
  await request.delete('/__test/sw');
});

async function triggerUpdateCheck(page: Page) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update().catch(() => undefined);
  });
}

test('offline: verifies every file, then launches and works with no network', async ({ page, context }) => {
  await installAndWaitReady(page);
  await page.getByRole('link', { name: 'Offline ready' }).click();
  await expect(page.getByText(/All \d+ files are saved on this device and match the release/)).toBeVisible();

  await context.setOffline(true);
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: /CRITICAL/ })).toBeVisible();
  await page.getByRole('link', { name: 'Chest pain' }).click();
  await expect(page.getByRole('heading', { name: 'Chest pain', level: 2 })).toBeVisible();
  await page.goto('/#/p/demo-fictional-fever');
  await expect(page.getByText('DEMONSTRATION ONLY — NOT FOR CLINICAL USE')).toBeVisible();
});

test('a damaged cached file is detected (not reported as offline ready)', async ({ page }) => {
  await installAndWaitReady(page);
  await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names.find((n) => n.startsWith('carpa-'))!);
    const url = new URL('release/content.json', location.href).href;
    await cache.put(url, new Response('{"tampered":true}'));
  });
  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Re-check offline files' }).click();
  await expect(page.getByText('NOT ready for offline use')).toBeVisible();
  await expect(page.getByText(/damaged: release\/content.json/)).toBeVisible();
});

test('a failed update keeps the current release working', async ({ page, context }) => {
  await installAndWaitReady(page);
  const releaseBefore = await page.evaluate(
    async () => (await (await fetch('release/manifest.json')).json()).releaseId,
  );
  // New "release" whose file list has a wrong hash: install must fail.
  await serveModifiedWorker(page, (sw) =>
    sw
      .replace(/"sha256":"[0-9a-f]{64}"/, `"sha256":"${'0'.repeat(64)}"`)
      .replace(/"buildId":"[0-9a-f]+"/, '"buildId":"broken000000"'),
  );
  await triggerUpdateCheck(page);
  await expect(page.getByText('An update could not be installed.')).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await page.goto('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: /CRITICAL/ })).toBeVisible();
  const releaseAfter = await page.evaluate(async () => (await (await fetch('release/manifest.json')).json()).releaseId);
  expect(releaseAfter).toBe(releaseBefore);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((n) => n.includes('broken'))).toBe(false); // partial download removed
});

test('an update waits for the user and never applies during a patient session', async ({ page }) => {
  await installAndWaitReady(page);
  await serveModifiedWorker(page, (sw) => sw.replace(/"buildId":"[0-9a-f]+"/, '"buildId":"newrelease0001"'));

  // Start patient work, then the update arrives.
  await page.goto('/#/p/sepsis');
  await page.getByRole('checkbox').first().check();
  await triggerUpdateCheck(page);
  await expect(page.getByText('An update has been downloaded and checked.')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/available after you end the patient session/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply update now' })).toHaveCount(0);
  await expect(page.getByRole('checkbox').first()).toBeChecked();

  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Clear everything' }).click();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Apply update now' }).click()]);
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith('carpa-'))), {
      timeout: 15_000,
    })
    .toEqual(['carpa-newrelease0001']);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Offline ready' })).toBeVisible({ timeout: 15_000 });
});

test('the sign-in page always goes to the network (so a hosting login can appear) and is never cached', async ({
  page,
  context,
}) => {
  await installAndWaitReady(page);
  await page.goto('/signin.html');
  await expect(page.getByRole('heading', { name: 'You are signed in' })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) urls.push(r.url);
    return urls;
  });
  expect(cached.some((u) => u.includes('signin'))).toBe(false);
  // Offline, the sign-in page falls back to the app rather than an error page.
  await context.setOffline(true);
  await page.goto('/signin.html');
  await expect(page.getByRole('heading', { name: /CRITICAL/ })).toBeVisible();
});
