/**
 * Minimal static server for end-to-end tests (serves dist/).
 * Test hook (only with E2E_TEST_HOOKS=1): POST /__test/sw with a body replaces the sw.js
 * that is served, simulating a newly published release; DELETE /__test/sw restores it.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4173);
const hooks = process.env.E2E_TEST_HOOKS === '1';
let swOverride = null;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (hooks && url.pathname === '/__test/sw') {
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      swOverride = Buffer.concat(chunks).toString('utf8');
    } else if (req.method === 'DELETE') swOverride = null;
    res.writeHead(204).end();
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  try {
    const body = rel === '/sw.js' && swOverride !== null ? swOverride : await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      'Cache-Control': rel === '/sw.js' || rel.startsWith('/release/') ? 'no-cache' : 'public, max-age=0',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1');
