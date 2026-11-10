/* Unit-Tests: Threads (Phase 5, Etappe 3). Aufruf: node tests/thread.unit.test.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const SL = s => ({ belegt: 'Belegt', teilweise: 'Teilweise belegt', widerlegt: 'Widerlegt', neu: 'Neu' })[s] || s;
const S1 = { id: 's1', title: 'Quelle A', url: 'https://example.org/a' };
const S2 = { id: 's2', title: 'Quelle B' };
const long = 'Dies ist ein Satz mit einigen Wörtern, der etwas länger ausfällt, damit der Thread mehrere Teile braucht.';
const E = (id, extra = {}) => ({ kind: 'entries', id, title: 'Eintrag ' + id, type: 'fakt', status: 'belegt', rel: 'unterstuetzend', sources: [S1], claimCore: 'Kernaussage ' + id + '. ' + long, evidence: 'Evidenz ' + id + '. ' + long + ' ' + long, ...extra });
const thread = (items, opt = {}) => A.buildPost({ type: 'thread', close: 'keiner', items, statusLabel: SL, ...opt });

test('Aufteilen: kurzer Text bleibt ein Post ohne Nummer', () => {
  const p = A.splitThread(['Ein Satz.', 'Noch einer.']);
  assert(p.length === 1 && p[0] === 'Ein Satz.\n\nNoch einer.', JSON.stringify(p));
});
test('Aufteilen: jeder Teil ≤ 280 inkl. Nummer, nur an Satzgrenzen', () => {
  const segs = [long + ' ' + long, long + ' ' + long + ' ' + long, 'Schluss?'];
  const p = A.splitThread(segs);
  assert(p.length >= 3, p.length);
  p.forEach((t, i) => { assert(A.xLength(t) <= 280, i + ': ' + A.xLength(t)); assert(t.startsWith((i + 1) + '/' + p.length + ' '), t.slice(0, 8)); });
  const body = p.map(t => t.replace(/^\d+\/\d+ /, '')).join(' ').replace(/\s+/g, ' ');
  assert(body === segs.join(' ').replace(/\s+/g, ' '), 'kein Text verloren');
  p.forEach(t => assert(/[.!?…]$/.test(t), 'endet am Satzende: ' + t.slice(-20)));
});
test('Aufteilen: überlanger Satz wird an Wortgrenzen getrennt', () => {
  const huge = Array.from({ length: 80 }, (_, i) => 'Wort' + i).join(' ') + '.';
  const p = A.splitThread([huge]);
  assert(p.length >= 2 && p.every(t => A.xLength(t) <= 280), p.map(t => A.xLength(t)).join());
  assert(p.map(t => t.replace(/^\d+\/\d+ /, '')).join(' ') === huge, 'Wörter vollständig');
});
test('Aufteilen: zweistellige Nummern passen (10/12)', () => {
  const p = A.splitThread(Array.from({ length: 30 }, () => long));
  assert(p.length >= 10 && p.every(t => A.xLength(t) <= 280), p.length + ' ' + Math.max(...p.map(t => A.xLength(t))));
  assert(p[9].startsWith('10/' + p.length + ' '), p[9].slice(0, 8));
});
test('Thread nutzt alle Einträge: Kernaussage und Evidenz je Eintrag', () => {
  const p = thread([E('e1'), E('e2'), E('e3')]);
  assert(p.posts.length >= 3, p.posts.length);
  assert(p.parts.filter(x => x.role === 'kern').length === 3 && p.parts.filter(x => x.role === 'beleg').length === 3, p.parts.map(x => x.role).join());
  const all = p.posts.join(' ');
  ['Kernaussage e1', 'Evidenz e1', 'Kernaussage e3', 'Evidenz e3'].forEach(t => assert(all.includes(t), t));
  assert(p.chars <= 280 && p.refs.length === 3, p.chars);
});
test('Thread mit Einleitung, Abschluss, Folgeantwort', () => {
  const p = thread([E('e1', { conclusion: 'Fazit e1.' }), E('e2', { sources: [S2] })], { claim: 'Eine Behauptung.', close: 'schluss' });
  assert(p.posts[0].startsWith('1/') && p.posts[0].includes('Oft heißt es: „Eine Behauptung“'), p.posts[0]);
  assert(p.posts[p.posts.length - 1].endsWith('Fazit e1.'), p.posts[p.posts.length - 1]);
  assert(p.follow.text.includes('Quelle A') && p.follow.text.includes('Quelle B'), p.follow.text);
  assert(!p.posts.join(' ').includes('http'), 'kein Link im Thread');
});
test('Thread: Prüfstatus gilt wie beim Einzelpost', () => {
  const p = thread([E('e1', { status: 'teilweise' }), E('e2', { status: 'widerlegt' })]);
  assert(p.posts[0].includes('Nach bisherigen Belegen spricht einiges dafür: Kernaussage e1.'), p.posts[0]);
  assert(!p.posts.join(' ').includes('Kernaussage e2') && p.warnings.some(w => w.id === 'e2' && w.level === 'stop'), 'widerlegt ausgelassen');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
