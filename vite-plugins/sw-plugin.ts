/**
 * Generates dist/sw.js after the build: lists every output file with its SHA-256 so the
 * service worker can verify the whole release before installing it.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

const EXCLUDE = new Set(['sw.js', '_headers', '_redirects']);

function walk(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, root);
    const rel = path.relative(root, full).split(path.sep).join('/');
    return EXCLUDE.has(rel) || rel.endsWith('.map') ? [] : [rel];
  });
}

export function serviceWorkerPlugin(templatePath: string): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'carpa-service-worker',
    apply: 'build',
    configResolved(c) {
      config = c;
    },
    closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const files = walk(outDir)
        .sort()
        .map((url) => ({
          url,
          sha256: createHash('sha256')
            .update(readFileSync(path.join(outDir, url)))
            .digest('hex'),
        }));
      const manifest = JSON.parse(readFileSync(path.join(outDir, 'release/manifest.json'), 'utf8')) as {
        releaseId: string;
      };
      const buildId = createHash('sha256')
        .update(files.map((f) => `${f.url}:${f.sha256}`).join('\n'))
        .digest('hex')
        .slice(0, 16);
      const build = { buildId, releaseId: manifest.releaseId, files };
      const template = readFileSync(templatePath, 'utf8');
      const marker = 'const BUILD = __CARPA_BUILD__;';
      if (template.split(marker).length !== 2) throw new Error(`Service worker template must contain "${marker}" once`);
      writeFileSync(path.join(outDir, 'sw.js'), template.replace(marker, `const BUILD = ${JSON.stringify(build)};`));
    },
  };
}
