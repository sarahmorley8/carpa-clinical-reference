/* Computes WCAG contrast ratios for the colour pairs used in src/styles/app.css (both themes). */
const lum = (hex) => {
  const c = hex
    .replace('#', '')
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const pairs = {
  light: [
    ['Body text on sand', '#2a1d14', '#fbf6ee'],
    ['Muted text on sand', '#5b4535', '#fbf6ee'],
    ['Muted text on card', '#5b4535', '#f3e9d9'],
    ['White on critical tile (light end)', '#ffffff', '#a8321f'],
    ['White on critical tile (dark end)', '#ffffff', '#8f2a1a'],
    ['White on critical tile highlight', '#ffffff', '#b14735'],
    ['Critical text on critical tint', '#7d2212', '#f8e1d8'],
    ['Caution text on caution tint', '#4a3208', '#f7e3b4'],
    ['Demo text on demo tint', '#3e2f60', '#e8e1f0'],
    ['White on teal button', '#ffffff', '#1d5c57'],
    ['Link teal on sand', '#1d5c57', '#fbf6ee'],
    ['OK green on card', '#2f5a2a', '#f3e9d9'],
    ['Border vs sand (UI 3:1)', '#8a6f58', '#fbf6ee'],
  ],
  dark: [
    ['Body text on night', '#f6ecdf', '#17110d'],
    ['Muted text on card', '#d8c6b3', '#251c15'],
    ['White on critical tile (light end)', '#ffffff', '#b43a25'],
    ['White on critical tile (dark end)', '#ffffff', '#8f2a1a'],
    ['White on critical tile highlight', '#ffffff', '#bc4e3b'],
    ['Critical text on critical tint', '#ffc2b2', '#3d1a12'],
    ['Caution text on caution tint', '#f5cf7d', '#3a2a0d'],
    ['Demo text on demo tint', '#d9ccf5', '#261f36'],
    ['White on teal button', '#ffffff', '#2b7a73'],
    ['Link on night', '#9fdcd2', '#17110d'],
    ['OK green on card', '#a8d9a0', '#251c15'],
    ['Border vs night (UI 3:1)', '#a48a72', '#17110d'],
  ],
};
for (const [theme, list] of Object.entries(pairs)) {
  console.log(`\n${theme}`);
  for (const [name, fg, bg] of list) {
    const r = ratio(fg, bg);
    const need = name.includes('UI 3:1') ? 3 : 4.5;
    console.log(`| ${name} | ${fg} on ${bg} | ${r.toFixed(2)}:1 | ${r >= need ? 'pass' : 'FAIL'} (needs ${need}:1) |`);
  }
}
