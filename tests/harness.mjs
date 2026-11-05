/* Gemeinsame Testumgebung: kleiner Webserver + Chrome ohne Bildschirm. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
export const PREFIX = '/DebateBase/';
/* Für Tests: einzelne Dateien durch anderen Inhalt ersetzen (z. B. neue Version) */
export const OVERRIDES = {};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  /* Wie bei GitHub Pages liegt die App in einem Unterordner */
  if (!p.startsWith(PREFIX)) { res.writeHead(404); res.end('nicht gefunden'); return; }
  p = p.slice(PREFIX.length - 1);
  if (p.endsWith('/')) p += 'index.html';
  const over = OVERRIDES[p];
  if (over != null) { res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'text/plain' }); res.end(over); return; }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nicht gefunden'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
export const BASE = `http://127.0.0.1:${server.address().port}${PREFIX}`;

export const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const results = [];
let failed = 0;
export async function test(name, fn) {
  try { await fn(); results.push(['OK  ', name]); }
  catch (e) { failed++; results.push(['FEHL', name + ' → ' + (e && e.message ? e.message.split('\n')[0] : e)]); }
}
export function assert(c, msg) { if (!c) throw new Error(msg || 'Annahme verletzt'); }

export async function newPage(ctx, width = 390) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height: 800 });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED|net::/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a'));
  return page;
}
export const counts = page => page.evaluate(() => { const D = window.DebateBase.Repo.db; return { e: D.entries.length, s: D.sources.length, a: D.args.length, l: D.links.length, p: D.posts.length }; });
export const idbCounts = page => page.evaluate(() => Promise.all(['entries', 'sources', 'args', 'links', 'posts', 'topics', 'tags', 'backups'].map(s => DB.getAll(s).then(r => [s, r.length]))).then(Object.fromEntries));
export async function reload(page) { await page.reload(); await page.waitForFunction(() => window.DebateBase && document.querySelector('#nav a')); }
export async function go(page, route) { await page.evaluate(r => { location.hash = r; }, route); await page.waitForTimeout(80); }

export const V2_EXPORT = {
  app: 'DebateBase', version: 2, exportedAt: '2026-11-05T17:00:00.000Z',
  counts: { entries: 3, sources: 2, args: 1, links: 2, posts: 1 },
  entries: [
    { id: 'e_v2a', title: 'Testeintrag Alpha', description: 'Beschreibung A', type: 'fakt', status: 'belegt', topic: 'Politik', tags: ['Energie', 'Test'], sourceIds: ['s_v2a'], postId: '', claimCore: 'Kern A', reason: '', evidence: 'Beleg A', limits: '', conclusion: '', created: 1762300000000, updated: 1762300000000 },
    { id: 'e_v2b', title: 'Testeintrag Beta', description: 'Beschreibung B', type: 'behauptung', status: 'umstritten', topic: 'Geschichte', tags: ['Test'], sourceIds: [], postId: 'p_v2a', claimCore: '', reason: 'Grund B', evidence: '', limits: 'Grenze B', conclusion: 'Schluss B', created: 1762310000000, updated: 1762320000000 },
    { id: 'e_v2c', title: 'Offene Frage Gamma', description: '', type: 'frage', status: 'pruefung', topic: 'Wissenschaft', tags: [], sourceIds: ['s_v2b'], postId: '', created: 1762330000000, updated: 1762330000000 }
  ],
  sources: [
    { id: 's_v2a', title: 'Quelle Eins', publisher: 'Amt', year: '2024', kind: 'Statistik', url: 'https://example.org/a', note: '', created: 1762200000000 },
    { id: 's_v2b', title: 'Quelle Zwei', publisher: 'Uni', year: '2020', kind: 'Studie', url: '', note: 'Notiz', created: 1762210000000 }
  ],
  args: [{ id: 'a_v2a', title: 'Karte Eins', claim: 'Behauptung', counter: 'Gegenargument', topic: 'Politik', status: 'teilweise', sourceIds: ['s_v2a'], created: 1762250000000 }],
  links: [
    { id: 'l_v2a', type: 'unterstuetzt', fromK: 'entries', fromId: 'e_v2a', toK: 'args', toId: 'a_v2a', note: 'Notiz L', created: 1762260000000 },
    { id: 'l_v2b', type: 'widerspricht', fromK: 'entries', fromId: 'e_v2b', toK: 'entries', toId: 'e_v2a', note: '', created: 1762270000000 }
  ],
  posts: [{ id: 'p_v2a', url: 'https://x.com/beispiel/status/1234567890', handle: 'beispiel', tweetId: '1234567890', text: 'Ein Beitrag mit Text.', topic: 'Geschichte', note: 'meine Notiz', convertedTo: ['e_v2b'], created: 1762305000000 }]
};


export async function finish() {
  await browser.close(); server.close();
  for (const [s, n] of results) console.log(s, n);
  console.log(`\n${results.length - failed} von ${results.length} Tests bestanden.`);
  process.exit(failed ? 1 : 0);
}
