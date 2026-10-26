/**
 * Phase 4 verification: performance on a slowed-down phone profile, network isolation,
 * keyboard-only use, and safe rendering of hostile content.
 * Results are written to test-results/verification.json for the Phase 4 reports.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const RESULTS = 'test-results/verification.json';
function record(key: string, value: unknown) {
  mkdirSync('test-results', { recursive: true });
  const data = existsSync(RESULTS) ? (JSON.parse(readFileSync(RESULTS, 'utf8')) as Record<string, unknown>) : {};
  data[key] = value;
  writeFileSync(RESULTS, JSON.stringify(data, null, 2));
}

async function slowPhone(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return cdp;
}

async function start(page: Page, path = '/') {
  await page.goto(path);
  await page.getByRole('button', { name: 'I understand' }).click();
}

test('performance: cold offline launch < 2 s and search feedback < 200 ms on a 4× slowed CPU', async ({
  page,
  context,
}) => {
  await start(page);
  await expect(page.getByRole('link', { name: 'Offline ready' })).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await slowPhone(page);

  const launches: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await page.goto('/');
    await page.getByRole('heading', { name: /CRITICAL/ }).waitFor();
    launches.push(Date.now() - t0);
  }

  const search = page.getByLabel('Search presentations');
  const timings: number[] = [];
  for (const q of ['a', 'as', 'ast', 'asth', 'anaph', 'sepss', 'chest', 'gastro']) {
    await search.fill('');
    const ms = await page.evaluate(async (query) => {
      const input = document.getElementById('search-input') as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      const t0 = performance.now();
      setter.call(input, query);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise<void>((resolve) => {
        const check = () =>
          document.querySelector('[aria-label="Search results"]') ? resolve() : requestAnimationFrame(check);
        check();
      });
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      return performance.now() - t0;
    }, q);
    timings.push(Math.round(ms));
  }
  record('performance', {
    cpuThrottle: '4x',
    network: 'offline (service worker cache)',
    coldLaunchMs: launches,
    searchFeedbackMs: timings,
  });
  expect(Math.max(...launches)).toBeLessThan(2000);
  expect(Math.max(...timings)).toBeLessThan(200);
});

test('security: no requests to other origins and no Content-Security-Policy violations', async ({ page }) => {
  const external: string[] = [];
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) cspErrors.push(m.text());
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.origin !== 'http://127.0.0.1:4173' && !url.protocol.startsWith('data')) external.push(r.url());
  });
  await start(page);
  for (const path of [
    '/#/p/demo-fictional-fever',
    '/#/p/asthma',
    '/#/timers',
    '/#/isbar',
    '/#/calculator',
    '/#/settings',
  ]) {
    await page.goto(path);
    await page.waitForSelector('main');
  }
  record('externalRequests', external);
  expect(external).toEqual([]);
  expect(cspErrors).toEqual([]);
});

test('security: production page carries a strict Content-Security-Policy and no inline scripts', async ({ page }) => {
  await page.goto('/');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
  const inline = await page.evaluate(() => [...document.scripts].filter((s) => !s.src).length);
  expect(inline).toBe(0);
  const headers = readFileSync('dist/_headers', 'utf8');
  for (const h of [
    'Content-Security-Policy',
    'frame-ancestors',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ])
    expect(headers).toContain(h);
  record('csp', csp);
});

test('security: hostile text inside content is shown as text, never run', async ({ page }) => {
  const hostile = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
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
      const f = bundle.files.find(
        (x: { path: string }) => x.path === 'examples/presentations/demo-fictional-fever.json',
      );
      const data = JSON.parse(f.text);
      data.redFlags[0].text = `DEMO ${hostile}`;
      f.text = JSON.stringify(data);
      const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex');
      bundleText = JSON.stringify(bundle);
      manifest.contentSha256 = sha(bundleText);
      manifest.files = manifest.files.map((x: { path: string }) =>
        x.path === f.path ? { ...x, sha256: sha(f.text) } : x,
      );
      manifestText = JSON.stringify(manifest);
    }
    await route.fulfill({
      contentType: 'application/json',
      body: route.request().url().endsWith('manifest.json') ? manifestText : bundleText,
    });
  });
  await start(page, '/#/p/demo-fictional-fever');
  await expect(page.getByText(hostile, { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(await page.locator('.action-list img').count()).toBe(0);
});

test('accessibility: core tasks work with the keyboard only', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'I understand' })).toBeFocused();
  await page.keyboard.press('Enter');
  // Tab to the first critical tile that has content and open it
  let found = false;
  for (let i = 0; i < 20 && !found; i++) {
    await page.keyboard.press('Tab');
    found = (await page.evaluate(() => document.activeElement?.textContent)) === 'Anaphylaxis';
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Anaphylaxis', level: 2 })).toBeVisible();
  // Tick a checklist item with the keyboard
  const box = page.getByRole('checkbox').first();
  await box.focus();
  await page.keyboard.press('Space');
  await expect(box).toBeChecked();
  // Open End session dialog; Escape cancels and keeps the tick
  await page.getByRole('button', { name: 'End session' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(box).toBeChecked();
});

test('accessibility: text at 150% size still fits without sideways scrolling', async ({ page }) => {
  await start(page, '/#/settings');
  await page.getByRole('radio', { name: 'Text size 150 percent' }).click();
  for (const path of ['/', '/#/p/demo-fictional-fever', '/#/timers', '/#/calculator']) {
    await page.goto(path);
    await page.waitForSelector('main');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
