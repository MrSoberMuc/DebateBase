/* Unit-Tests der lokalen Analyse (ohne Browser). Aufruf: node tests/analyse.unit.test.mjs
 * Phase 4, Etappe 1: intelligente Suche, Relevanz, Begründungen, verwandte Inhalte. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const clone = o => JSON.parse(JSON.stringify(o));

/* Kleine Testdatenbank im Format von docFor() in app.js */
function doc(id, o) {
  const f = (label, weight, text) => ({ label, weight, text: text || '' });
  return { id, kind: o.kind || 'entries', item: o, tags: o.tags || [], sourceIds: o.sourceIds || [], topic: o.topic || '',
    fields: [f('Titel', 5, o.title), f('Tags', 4, (o.tags || []).join(', ')), f('Themengebiet', 3, o.topic), f('Quellen', 2, o.src), f('Beschreibung', 2, o.description)] };
}
const DOCS = [
  doc('e1', { title: 'Gründung der Vereinten Nationen', tags: ['UNO', '1945'], topic: 'Internationale Beziehungen', description: 'Die UN-Charta trat 1945 in Kraft.', sourceIds: ['s1'] }),
  doc('e2', { title: 'Wirtschaftssanktionen als außenpolitisches Mittel', tags: ['Sanktionen', 'Außenpolitik'], topic: 'Internationale Beziehungen', description: 'Die Forschung zeigt gemischte Ergebnisse.' }),
  doc('e3', { title: 'Wissenschaftlicher Konsens zum Klimawandel', tags: ['Klima', 'Konsens'], topic: 'Wissenschaft', description: 'Über 97 % der Studien bestätigen den menschlichen Einfluss.', sourceIds: ['s4'] }),
  doc('e4', { title: 'Ozonschicht und Montrealer Protokoll', tags: ['Klima', 'FCKW'], topic: 'Wissenschaft', description: 'Erholung bis etwa 2066.', sourceIds: ['s4'] }),
  doc('e5', { title: 'Peer-Review', tags: ['Methodik'], topic: 'Wissenschaft', description: 'Fachleute prüfen ein Manuskript. Es wird über Sanktionen nicht gesprochen.' }),
  doc('e6', { title: 'Beinahe-Eskalationen im Kalten Krieg', tags: ['Atomwaffen', 'Abschreckung'], topic: 'Internationale Beziehungen', description: 'Kubakrise 1962.' })
];
const ids = r => r.map(x => x.id || x.doc.id);

/* ---------- Grundbausteine ---------- */
test('Normalisierung: Umlaute, ß, Akzente, Großschreibung', () => {
  assert(A.normalize('Erderwärmung') === A.normalize('ERDERWAERMUNG'), 'ä/ae');
  assert(A.normalize('Straße') === 'strasse', 'ß');
  assert(A.normalize('Café') === 'cafe', 'Akzent');
});
test('Wortstamm: Wortformen werden zusammengeführt', () => {
  const same = [['Sanktionen', 'Sanktion'], ['Staaten', 'Staat'], ['Staates', 'Staat'], ['Kriege', 'Krieg'], ['Nationen', 'Nation'], ['russischen', 'russisch'], ['Mitglieder', 'Mitglied']];
  for (const [a, b] of same) assert(A.stem(A.normalize(a)) === A.stem(A.normalize(b)), a + ' ≠ ' + b);
  assert(A.stem('konsens') === 'konsens', 'Konsens darf nicht gekürzt werden');
  assert(A.stem('1945') === '1945', 'Zahlen bleiben');
});
test('Tippfehler-Erkennung: genau ein Fehler', () => {
  assert(A.near('sanktion', 'sanktoin'), 'vertauscht');
  assert(A.near('sanktion', 'sanktio'), 'fehlt');
  assert(A.near('sanktion', 'sanktiion'), 'zu viel');
  assert(A.near('sanktion', 'sanktian'), 'ersetzt');
  assert(!A.near('sanktion', 'santkoin'), 'zwei Fehler dürfen nicht passen');
});
test('Füllwörter werden ignoriert, außer die Anfrage besteht nur daraus', () => {
  const q = A.parseQuery('der Klimawandel und die Wissenschaft', A.synIndex([]));
  assert(q.terms.map(t => t.norm).join(',') === 'klimawandel,wissenschaft', q.terms.map(t => t.norm).join(','));
  assert(A.parseQuery('der', A.synIndex([])).terms.length === 1, 'nur Füllwort');
  assert(A.parseQuery('nicht kein', A.synIndex([])).terms.length === 2, '„nicht“/„kein“ sind keine Füllwörter');
});

/* ---------- Suche ---------- */
test('Wortform: „Sanktion“ findet „Sanktionen“ (früher nicht)', () => {
  const r = A.search(DOCS, 'Sanktion');
  assert(ids(r.full)[0] === 'e2', ids(r.full).join());
  assert(r.full[0].reasons[0].includes('Wortform'), r.full[0].reasons[0]);
});
test('Verwandte Begriffe: „Vereinte Nationen“ ↔ „UNO“, auch mehrteilig und gebeugt', () => {
  let r = A.search(DOCS, 'UNO');
  assert(ids(r.full)[0] === 'e1', 'UNO');
  r = A.search(DOCS, 'Vereinte Nationen');
  assert(ids(r.full)[0] === 'e1', 'Vereinte Nationen');
  assert(r.full[0].reasons.join(' ').includes('Vereinten Nationen'), 'Originalschreibweise in Begründung: ' + r.full[0].reasons.join(' | '));
  r = A.search(DOCS, 'Kernwaffen');
  assert(ids(r.full)[0] === 'e6' && r.full[0].reasons[0].includes('verwandter Begriff „Atomwaffen“'), r.full.length && r.full[0].reasons[0]);
});
test('Eigene verwandte Begriffe werden genutzt', () => {
  const groups = A.SYNONYMS.concat([['Ozon', 'O3']]);
  const r = A.search(DOCS, 'O3', { synonyms: groups });
  assert(ids(r.full).includes('e4'), 'O3 → Ozon');
  assert(!A.search(DOCS, 'O3').full.length, 'ohne eigene Gruppe kein Treffer');
});
test('Tippfehler: „Sanktoinen“ findet „Sanktionen“ mit Hinweis', () => {
  const r = A.search(DOCS, 'Sanktoinen');
  assert(ids(r.full)[0] === 'e2' && r.full[0].reasons[0].includes('ähnliche Schreibweise'), JSON.stringify(r.full[0] && r.full[0].reasons));
});
test('Wortteil: „Klima“ findet „Klimawandel“', () => {
  const r = A.search(DOCS, 'klimawan');
  assert(ids(r.full).includes('e3') && r.full[0].reasons[0].includes('Wortteil'), JSON.stringify(r.full.map(x => x.reasons)));
});
test('Relevanz: Titel- und Tag-Treffer vor Treffern nur in der Beschreibung', () => {
  const r = A.search(DOCS, 'Sanktionen');
  assert(ids(r.full).join() === 'e2,e5', ids(r.full).join());
  assert(r.full[0].score > r.full[1].score, 'Punkte');
});
test('Relevanz: mehrere Suchwörter, genaue Wortfolge gibt Bonus', () => {
  const r = A.search(DOCS, 'Montrealer Protokoll');
  assert(ids(r.full)[0] === 'e4' && r.full[0].reasons[0].startsWith('genaue Wortfolge'), r.full[0].reasons[0]);
  const tags = A.search(DOCS, 'Klima Konsens');
  assert(!tags.full[0].reasons.some(x => x.startsWith('genaue Wortfolge in Tags')), 'zwei Tags sind keine Wortfolge');
});
test('Alle Suchwörter nötig; sonst Teiltreffer mit „nicht gefunden“', () => {
  let r = A.search(DOCS, 'Klima Sanktionen');
  assert(r.full.length === 0 && r.partial.length >= 2, 'Teiltreffer erwartet');
  assert(r.partial[0].missing.length === 1, 'fehlendes Wort benannt');
  r = A.search(DOCS, 'Klima');
  assert(r.full.length === 2 && r.partial.length === 0, 'keine Teiltreffer, wenn es vollständige gibt');
  assert(!A.search(DOCS, 'Quantenphysik').full.length && !A.search(DOCS, 'Quantenphysik').partial.length, 'kein Treffer');
  assert(!A.search(DOCS, '   ').full.length, 'leere Suche');
});
test('Jeder Treffer hat eine Begründung mit Feldname', () => {
  for (const q of ['UNO', 'Klima', 'Sanktion', '1945', 'Wissenschaft']) {
    const r = A.search(DOCS, q);
    assert(r.full.length, q);
    r.full.forEach(x => assert(x.reasons.length && /in (Titel|Tags|Themengebiet|Quellen|Beschreibung)|\((Titel|Tags|Themengebiet|Quellen|Beschreibung)\)/.test(x.reasons[0]), q + ': ' + x.reasons[0]));
  }
});
test('Bisherige Treffer bleiben erhalten (neue Suche findet mindestens das, was die alte fand)', () => {
  const old = (hay, q) => { const ts = q.toLowerCase().split(/\s+/).filter(Boolean), h = hay.toLowerCase(); return ts.every(t => h.indexOf(t) >= 0); };
  const hay = d => d.fields.map(f => f.text).join(' ');
  for (const q of ['klima', 'nato', 'Sanktionen', 'Krieg', 'wissen', '19', 'un', 'Peer-Review', 'der', 'Klima 2066', 'internationale beziehungen', 'ü', 'Außenpolitik']) {
    const want = DOCS.filter(d => old(hay(d), q)).map(d => d.id);
    const got = ids(A.search(DOCS, q).full);
    want.forEach(id => assert(got.includes(id), `„${q}“: ${id} fehlt (alt: ${want}, neu: ${got})`));
  }
});
test('Suche verändert die Daten nicht', () => {
  const before = clone(DOCS.map(d => d.item));
  A.search(DOCS, 'Klima Sanktionen UNO'); A.related(DOCS[2], DOCS, {});
  assert(JSON.stringify(before) === JSON.stringify(DOCS.map(d => d.item)), 'Daten verändert');
});
test('Geschwindigkeit: 3000 Einträge in unter 300 ms', () => {
  const many = [];
  for (let i = 0; i < 3000; i++) many.push(doc('m' + i, { title: 'Eintrag Nummer ' + i + ' über Energiepolitik', tags: ['Tag' + (i % 50), 'Energie'], topic: 'Politik', description: 'Beschreibung mit etwas Text zu Klima, Wirtschaft und Gesellschaft Nummer ' + i + '. '.repeat(3) }));
  A.search(many, 'Energie'); /* erster Lauf baut den Zwischenspeicher */
  const t = Date.now(); const r = A.search(many, 'Energie Klima Sanktoinen'); const ms = Date.now() - t;
  assert(ms < 300, ms + ' ms'); assert(r.partial.length || r.full.length, 'Ergebnis');
});

/* ---------- Verwandte Inhalte ---------- */
test('Verwandte Inhalte: gemeinsame Quelle und Tags, mit Begründung', () => {
  const r = A.related(DOCS[2], DOCS, { sourceTitle: s => 'Quelle ' + s });
  assert(r[0].doc.id === 'e4', ids(r).join());
  const why = r[0].reasons.join(' | ');
  assert(why.includes('gemeinsame Quelle: „Quelle s4“') && why.includes('gemeinsamer Tag: Klima') && why.includes('gleiches Themengebiet'), why);
});
test('Verwandte Inhalte: direkte und indirekte Verknüpfungen', () => {
  const links = [{ type: 'unterstuetzt', fromK: 'entries', fromId: 'e1', toK: 'entries', toId: 'e2' }, { type: 'widerspricht', fromK: 'entries', fromId: 'e2', toK: 'entries', toId: 'e6' }];
  const lt = { unterstuetzt: ['Unterstützt', 'Wird unterstützt von'], widerspricht: ['Widerspricht', 'Wird widersprochen von'] };
  const r = A.related(DOCS[0], DOCS, { links, ltypes: lt, label: (k, id) => 'Titel ' + id });
  const d = r.find(x => x.doc.id === 'e2'), i = r.find(x => x.doc.id === 'e6');
  assert(d && d.linked && d.reasons[0] === 'direkt verknüpft: Unterstützt', JSON.stringify(d));
  assert(i && !i.linked && i.reasons.some(x => x.includes('indirekt verbunden über „Titel e2“')), JSON.stringify(i));
  const back = A.related(DOCS[1], DOCS, { links, ltypes: lt });
  assert(back.find(x => x.doc.id === 'e1').reasons[0] === 'direkt verknüpft: Wird unterstützt von', 'Gegenrichtung');
});
test('Verwandte Inhalte: ähnliche Wörter ohne Tags/Quellen; Unverwandtes fehlt', () => {
  const extra = DOCS.concat([doc('x1', { title: 'Sanktionen gegen Südafrika', description: 'Wirtschaftliche Sanktionen und Außenpolitik' })]);
  const r = A.related(extra[6], extra, {});
  assert(r.length && r[0].doc.id === 'e2' && r[0].reasons.some(x => x.startsWith('ähnliche Begriffe: Sanktionen')), JSON.stringify(r.map(x => [x.doc.id, x.reasons])));
  assert(!r.some(x => x.doc.id === 'e4'), 'Ozonschicht ist nicht verwandt');
  assert(!r.some(x => x.doc.id === 'x1'), 'sich selbst nicht vorschlagen');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
