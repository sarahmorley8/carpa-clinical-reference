import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, path = '/') {
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand' }).click();
}

test('emergency pathway is reachable within two taps of opening the app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'I understand' }).click(); // first launch only
  await page.getByRole('link', { name: 'Chest pain' }).click(); // tap 1
  await expect(page.getByRole('heading', { name: 'Chest pain', level: 2 })).toBeVisible();
  await page.getByRole('link', { name: /Call for help/ }).click(); // tap 2
  await expect(page.getByRole('heading', { name: 'Consultation and retrieval' })).toBeVisible();
});

test('disclaimer is only shown once', async ({ page }) => {
  await start(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: /CRITICAL/ })).toBeVisible();
});

test('search tolerates spelling mistakes', async ({ page }) => {
  await start(page);
  await page.getByLabel('Search presentations').fill('anaphalaxis');
  await expect(
    page.getByRole('region', { name: 'Search results' }).getByRole('link', { name: /Anaphylaxis/ }),
  ).toBeVisible();
});

test('adult and paediatric reference views', async ({ page }) => {
  await start(page, '/#/p/demo-fictional-fever');
  await expect(page.getByText('DEMONSTRATION ONLY — NOT FOR CLINICAL USE')).toBeVisible();
  await page.getByRole('radio', { name: 'Child' }).click();
  await expect(page.getByText('DEMO: Check for wings (child only, fictional)')).toBeVisible();
  await expect(page.getByText('DEMO: 1.5 mg/kg (fictional), maximum 60 mg per dose')).toBeVisible();
  await page.getByRole('radio', { name: 'Adult' }).click();
  await expect(page.getByText('DEMO: Check for wings (child only, fictional)')).toHaveCount(0);
  await expect(page.getByText('DEMO: 100 mg (fictional)')).toBeVisible();
});

test('patient working state is never persisted and is gone after reload', async ({ page }) => {
  await start(page, '/#/p/demo-fictional-fever');
  await page.getByRole('radio', { name: 'Child' }).click();
  await page.getByRole('checkbox', { name: /When did the sparkling start/ }).check();
  const storage = await page.evaluate(async () => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.keys(sessionStorage),
    // The offline cache may exist; it must only hold the app's own release files.
    cachedUrls: await (async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys()) urls.push(`${name}|${req.url}`);
      }
      return urls;
    })(),
    idb: 'databases' in indexedDB ? (await indexedDB.databases()).map((d) => d.name) : [],
    url: location.href,
  }));
  expect(Object.keys(storage.local)).toEqual(['carpa.preferences.v1']);
  expect(JSON.stringify(storage.local)).not.toMatch(/hx-onset|child|sparkling/);
  expect(storage.session).toEqual([]);
  for (const entry of storage.cachedUrls) {
    expect(entry).toMatch(
      /^carpa-[0-9a-f]+\|http:\/\/127\.0\.0\.1:4173\/(index\.html|assets\/|icons\/|icon\.svg|manifest\.webmanifest|release\/)/,
    );
    expect(entry).not.toMatch(/child|hx-onset|sparkling/);
  }
  expect(storage.idb).toEqual([]);
  expect(storage.url).not.toMatch(/child|hx-onset/);

  await page.reload();
  await expect(page.getByRole('checkbox', { name: /When did the sparkling start/ })).not.toBeChecked();
  await expect(page.getByText('— not selected, showing all')).toBeVisible();
});

test('end session clears ticks', async ({ page }) => {
  await start(page, '/#/p/sepsis');
  const box = page.getByRole('checkbox').first();
  await box.check();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Clear everything' }).click();
  await expect(box).not.toBeChecked();
});

test('dark mode and text size persist', async ({ page }) => {
  await start(page, '/#/settings');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await page.getByRole('radio', { name: 'Text size 130 percent' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Text size 130 percent' })).toHaveAttribute('aria-checked', 'true');
});

test('a tampered content release is blocked entirely', async ({ page }) => {
  await page.route('**/release/content.json', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('Template', 'Tampered');
    await route.fulfill({ response: res, body });
  });
  await start(page);
  await expect(page.getByRole('alert')).toContainText('Content integrity check failed');
  await expect(page.getByRole('alert')).toContainText('Use the printed CARPA manual');
});

test('a malformed content file is blocked with a clear message; the rest still works', async ({ page }) => {
  // Rebuild a self-consistent release (valid hashes) containing one broken file.
  let manifestText = '';
  let bundleText = '';
  await page.route('**/release/*.json', async (route) => {
    if (!bundleText) {
      const base = route
        .request()
        .url()
        .replace(/[^/]+$/, '');
      const manifest = JSON.parse(await (await page.request.get(`${base}manifest.json`)).text());
      const bundle = JSON.parse(await (await page.request.get(`${base}content.json`)).text());
      const target = bundle.files.find((f: { path: string }) => f.path === 'templates/presentations/sepsis.json');
      target.text = target.text.replace('"redFlags": [', '"redFlags": [,');
      const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
      bundleText = JSON.stringify(bundle);
      manifest.contentSha256 = sha(bundleText);
      manifest.files = manifest.files.map((f: { path: string }) =>
        f.path === target.path ? { ...f, sha256: sha(target.text) } : f,
      );
      manifestText = JSON.stringify(manifest);
    }
    const isManifest = route.request().url().endsWith('manifest.json');
    await route.fulfill({ contentType: 'application/json', body: isManifest ? manifestText : bundleText });
  });
  await start(page);
  await expect(page.getByText('1 content file(s) have errors and are blocked.')).toBeVisible();
  await page.getByText('1 content file(s) have errors and are blocked.').click();
  await expect(page.getByText('content/templates/presentations/sepsis.json')).toBeVisible();
  await expect(page.getByText(/not valid JSON/)).toBeVisible();
  await page.goto('/#/p/sepsis');
  await expect(page.getByRole('alert')).toContainText('content errors and has been blocked');
  await page.goto('/#/p/asthma');
  await expect(page.getByRole('heading', { name: 'Asthma', level: 2 })).toBeVisible();
});

for (const [name, path] of [
  ['home', '/'],
  ['pathway', '/#/p/demo-fictional-fever'],
  ['template pathway', '/#/p/asthma'],
  ['escalation', '/#/p/demo-fictional-fever/escalate'],
  ['settings', '/#/settings'],
  ['tools', '/#/tools'],
  ['timers', '/#/timers'],
  ['isbar', '/#/isbar'],
  ['calculator', '/#/calculator'],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`accessibility: ${name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await start(page, path);
      await page.waitForSelector('main');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.nodes
              .map((n) => n.target.join(' '))
              .slice(0, 3)
              .join(', ')}`,
        ),
      ).toEqual([]);
    });
  }
}

test('touch targets: main controls at least 44px, everything at least 24px (WCAG 2.2)', async ({ page }) => {
  await start(page);
  for (const path of ['/', '/#/p/demo-fictional-fever', '/#/settings']) {
    await page.goto(path);
    await page.waitForSelector('main');
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      const size = (el: Element) => el.getBoundingClientRect();
      for (const el of document.querySelectorAll<HTMLElement>(
        'button, a.btn, a.list-link, .bottom-nav__item, .critical__tile, .escalate-bar, .section-nav__chip, .checklist__label',
      )) {
        const r = size(el);
        if (r.width > 0 && (r.height < 44 || r.width < 44))
          out.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      for (const el of document.querySelectorAll<HTMLElement>('a, button, input')) {
        const r = size(el);
        if (r.width > 0 && (r.height < 24 || r.width < 24) && !el.closest('p, li.statement, .cite, dd, .step__detail'))
          out.push(`min ${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(problems, path).toEqual([]);
  }
});

test('no screen scrolls sideways on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await start(page);
  for (const path of [
    '/',
    '/#/p/demo-fictional-fever',
    '/#/p/asthma',
    '/#/timers',
    '/#/isbar',
    '/#/calculator',
    '/#/settings',
  ]) {
    await page.goto(path);
    await page.waitForSelector('main');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test('step-through pathway, timer and ISBAR work together', async ({ page }) => {
  await start(page, '/#/p/demo-fictional-fever');
  await page.getByRole('radio', { name: 'Child' }).click();
  const m = page.getByRole('region', { name: /Management steps/ });
  await m.getByRole('button', { name: 'No', exact: true }).click();
  await m.getByLabel(/Enter value/).fill('3');
  await m.getByRole('button', { name: 'Confirm' }).click();
  await m.getByRole('button', { name: /Start timer/ }).click();
  await expect(page.getByRole('link', { name: /1 timer/ })).toBeVisible();
  await m.getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(m.getByText('End of pathway: continue as described in the source')).toBeVisible();
  await page.goto('/#/isbar');
  await page.getByRole('button', { name: 'Fill from ticked items and answers' }).click();
  await expect(page.getByLabel(/Assessment/)).toHaveValue(/Measure the glow level \(fictional\): 3 glow units/);
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Clear everything' }).click();
  await expect(page.getByLabel(/Assessment/)).toHaveValue('');
  await expect(page.getByRole('link', { name: /timer/ })).toHaveCount(0);
});
