/* Renders public/icon.svg to the PNG sizes iOS and Android need. Run: node scripts/generate-icons.cjs */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const out = path.join(__dirname, '../public/icons');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sizes = [
    ['apple-touch-icon.png', 180, 0],
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    ['icon-maskable-512.png', 512, 0.1],
  ];
  for (const [name, size, pad] of sizes) {
    await page.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await page.setContent(
      `<html><body style="margin:0;background:#a8321f;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
        svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
        '</body></html>',
    );
    await page.screenshot({ path: path.join(out, name), omitBackground: false });
  }
  await browser.close();
})();
