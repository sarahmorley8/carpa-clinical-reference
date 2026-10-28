/**
 * Vite plugin that
 *  - provides `virtual:carpa-validators` (pre-compiled JSON Schema validators, no eval),
 *  - serves the content release at /release/* during development (rebuilt on every request),
 *  - emits release/manifest.json and release/content.json into the production build.
 *
 * In the preview profile, files with errors are still emitted so the app can show
 * the problems on screen; `npm run validate-content` (run in CI) fails on them.
 */
import type { Plugin } from 'vite';
import { buildRelease } from '../scripts/lib/collect.ts';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { generateStandaloneValidators, SCHEMAS_DIR } from '../scripts/lib/schemas.ts';
import type { ReleaseProfile } from '../src/content/status.ts';

const VIRTUAL_ID = 'virtual:carpa-validators';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export function carpaContentPlugin(options: { profile: ReleaseProfile; appVersion: string }): Plugin {
  return {
    name: 'carpa-content',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      for (const f of readdirSync(SCHEMAS_DIR)) if (f.endsWith('.json')) this.addWatchFile(path.join(SCHEMAS_DIR, f));
      return generateStandaloneValidators();
    },
    configureServer(server) {
      server.watcher.add(['content', 'schemas']);
      server.watcher.on('change', (file) => {
        if (/[\\/](content|schemas)[\\/]/.test(file)) server.ws.send({ type: 'full-reload' });
      });
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.endsWith('/release/manifest.json') && !url.endsWith('/release/content.json')) return next();
        try {
          const { manifest, bundleText } = buildRelease(options.profile, options.appVersion);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(url.endsWith('manifest.json') ? JSON.stringify(manifest, null, 2) : bundleText);
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
    generateBundle() {
      const { manifest, bundleText } = buildRelease(options.profile, options.appVersion);
      this.emitFile({ type: 'asset', fileName: 'release/content.json', source: bundleText });
      this.emitFile({ type: 'asset', fileName: 'release/manifest.json', source: JSON.stringify(manifest, null, 2) });
    },
  };
}
