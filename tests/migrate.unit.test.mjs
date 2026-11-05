/* Unit-Tests der Import-Logik (ohne Browser). Aufruf: node tests/migrate.unit.test.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../migrate.js');

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const KNOWN = { types: { fakt: 1, behauptung: 1, frage: 1 }, status: { neu: 1, belegt: 1, pruefung: 1, umstritten: 1, teilweise: 1 }, ltypes: { unterstuetzt: 1, widerspricht: 1 } };
const EMPTY = { entries: [], sources: [], args: [], links: [], posts: [] };
const clone = o => JSON.parse(JSON.stringify(o));
const V2 = {
  app: 'DebateBase', version: 2, exportedAt: '2026-11-05T17:00:00.000Z', counts: { entries: 2, sources: 1, args: 1, links: 1, posts: 1 },
  entries: [
    { id: 'e1', title: 'Eins', type: 'fakt', status: 'belegt', tags: ['a'], sourceIds: ['s1'], postId: 'p1', created: 1, updated: 1, eigenesFeld: { x: [1, 2] } },
    { id: 'e2', title: 'Zwei', type: 'behauptung', status: 'neu', tags: [], sourceIds: [], created: 2, updated: 2 }
  ],
  sources: [{ id: 's1', title: 'Quelle', kind: 'Studie', url: 'https://a.b', created: 1 }],
  args: [{ id: 'a1', title: 'Karte', status: 'umstritten', sourceIds: ['s1'], created: 1 }],
  links: [{ id: 'l1', type: 'unterstuetzt', fromK: 'entries', fromId: 'e1', toK: 'args', toId: 'a1', created: 1 }],
  posts: [{ id: 'p1', url: 'https://x.com/u/status/1', tweetId: '1', handle: 'u', text: 'T', convertedTo: ['e1'], created: 1 }]
};

test('parse: abgeschnittener Text bekommt verständlichen Hinweis', () => {
  const r = M.parse(JSON.stringify(V2).slice(0, 200));
  assert(!r.ok && /abgeschnitten/.test(r.error), r.error);
  assert(!M.parse('').ok, 'leerer Text');
  assert(M.parse('﻿' + JSON.stringify(V2)).ok, 'BOM');
});

test('detect: Version 1, 2, 3 und fremde Dateien', () => {
  assert(M.detect({ entries: [], sources: [], args: [] }).version === 1);
  assert(M.detect(V2).version === 2);
  assert(M.detect({ ...V2, version: 3 }).version === 3);
  assert(!M.detect({ app: 'Anders', entries: [] }).ok);
  assert(!M.detect({ foo: 1 }).ok);
  assert(!M.detect([1, 2]).ok);
  assert(!M.detect({ entries: 'x' }).ok);
});

test('analyze: Version 2 in leere Datenbank – alles neu, keine Warnungen', () => {
  const a = M.analyze(clone(V2), EMPTY, KNOWN);
  assert(a.ok && a.total === 6, 'total ' + a.total);
  assert(a.cols.entries.neu.length === 2 && a.conflicts.length === 0);
  assert(a.warnings.length === 0, a.warnings.join('; '));
});

test('analyze: unbekannte Werte und Felder bleiben unverändert, nur Hinweis', () => {
  const d = clone(V2); d.entries[1].type = 'zitat'; d.entries[1].status = 'wackelig';
  const a = M.analyze(d, EMPTY, KNOWN);
  const p = M.build(a, EMPTY, {});
  const e2 = p.write.entries.find(e => e.id === 'e2'), e1 = p.write.entries.find(e => e.id === 'e1');
  assert(e2.type === 'zitat' && e2.status === 'wackelig', 'Wert verändert');
  assert(JSON.stringify(e1.eigenesFeld) === '{"x":[1,2]}', 'Extrafeld verloren');
  assert(a.warnings.length === 2, a.warnings.join('; '));
});

test('analyze: ungültige Datensätze werden übersprungen und gemeldet', () => {
  const d = clone(V2);
  d.entries.push({ id: 'e3', title: '' }, { title: 'ohne id' }, { id: 'e1', title: 'doppelt' }, 'kaputt');
  d.links.push({ id: 'l2', type: 'unterstuetzt', fromK: 'entries' });
  const a = M.analyze(d, EMPTY, KNOWN);
  assert(a.cols.entries.invalid === 4 && a.cols.links.invalid === 1, JSON.stringify(a.skipped));
  assert(a.cols.entries.valid === 2);
});

test('analyze: Text statt Liste wird umgewandelt und gemeldet', () => {
  const d = clone(V2); d.entries[1].tags = 'NATO, Russland';
  const a = M.analyze(d, EMPTY, KNOWN);
  const e = a.cols.entries.neu.find(x => x.id === 'e2');
  assert(JSON.stringify(e.tags) === '["NATO","Russland"]' && a.warnings.length === 1);
});

test('analyze: fehlende Verweise werden gemeldet, aber nicht entfernt', () => {
  const d = clone(V2); d.sources = []; d.posts = [];
  const a = M.analyze(d, EMPTY, KNOWN);
  const e1 = a.cols.entries.neu.find(x => x.id === 'e1');
  assert(e1.sourceIds[0] === 's1' && e1.postId === 'p1', 'Verweis entfernt');
  assert(a.warnings.filter(w => /fehlende/.test(w)).length === 3, a.warnings.join('; '));
});

test('analyze: Abweichung von der angegebenen Anzahl wird gemeldet', () => {
  const d = clone(V2); d.entries.pop();
  const a = M.analyze(d, EMPTY, KNOWN);
  assert(a.warnings.some(w => /unvollständig/.test(w)));
});

test('analyze: identische Datensätze sind kein Konflikt, geänderte schon', () => {
  const cur = clone(V2);
  const d = clone(V2); d.entries[0].title = 'Eins geändert';
  // Reihenfolge der Felder egal:
  d.sources[0] = { created: 1, url: 'https://a.b', kind: 'Studie', title: 'Quelle', id: 's1' };
  const a = M.analyze(d, cur, KNOWN);
  assert(a.conflicts.length === 1 && a.conflicts[0].id === 'e1');
  assert(a.cols.sources.same.length === 1);
  const p = M.build(a, cur, { conflict: 'skip' });
  assert(p.count === 0, 'nichts zu schreiben erwartet, aber ' + p.count);
});

test('build: Konflikt ersetzen', () => {
  const cur = clone(V2), d = clone(V2); d.entries[0].title = 'Neu';
  const p = M.build(M.analyze(d, cur, KNOWN), cur, { conflict: 'replace' });
  assert(p.count === 1 && p.write.entries[0].id === 'e1' && p.write.entries[0].title === 'Neu');
});

test('build: Konflikt als Kopie – neue IDs und alle Verweise umgeschrieben', () => {
  const cur = clone(V2), d = clone(V2);
  d.entries[0].title = 'E1 neu'; d.sources[0].title = 'S1 neu'; d.posts[0].text = 'P neu'; d.args[0].title = 'A neu'; d.links[0].note = 'L neu';
  const p = M.build(M.analyze(d, cur, KNOWN), cur, { conflict: 'copy' });
  const e = p.write.entries[0], s = p.write.sources[0], po = p.write.posts[0], a = p.write.args[0], l = p.write.links[0];
  assert(e.id !== 'e1' && s.id !== 's1' && po.id !== 'p1' && a.id !== 'a1' && l.id !== 'l1', 'IDs nicht neu');
  assert(e.sourceIds[0] === s.id && e.postId === po.id && a.sourceIds[0] === s.id, 'Verweise Eintrag/Karte');
  assert(po.convertedTo[0] === e.id, 'Verweis Beitrag');
  assert(l.fromId === e.id && l.toId === a.id, 'Verweis Verknüpfung');
  assert(p.remapped === 6, 'remapped ' + p.remapped);
  assert(d.entries[0].id === 'e1', 'Originaldaten verändert');
});

test('build: Komplett ersetzen schreibt alle gültigen Datensätze', () => {
  const cur = clone(V2), d = clone(V2); d.entries[0].title = 'X';
  const p = M.build(M.analyze(d, cur, KNOWN), cur, { mode: 'replace' });
  assert(p.count === 6 && p.mode === 'replace');
});

test('verify: erkennt fehlende und abweichende Datensätze', () => {
  const p = M.build(M.analyze(clone(V2), EMPTY, KNOWN), EMPTY, {});
  const ok = M.verify(p, clone(V2));
  assert(ok.ok_all && ok.ok === 6, JSON.stringify(ok.problems));
  const bad = clone(V2); bad.entries[0].title = 'anders'; bad.posts = [];
  const v = M.verify(p, bad);
  assert(!v.ok_all && v.problems.length === 2, JSON.stringify(v.problems));
});

test('report: enthält Format, Zählung und Hinweise', () => {
  const d = clone(V2); d.entries[1].type = 'zitat';
  const a = M.analyze(d, EMPTY, KNOWN), p = M.build(a, EMPTY, {});
  const r = M.report(a, p, M.verify(p, d));
  assert(/Version 2/.test(r) && /Wissenseinträge: 2 in der Datei/.test(r) && /zitat/.test(r) && /Nachkontrolle: 6 von 6/.test(r), r);
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
