/* Unit-Tests: aus der Auswahl Datensätze erzeugen (ohne Browser). Aufruf: node tests/kiapply.unit.test.mjs
 * Phase 4B, Etappe 3. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const K = require('../ki.js').KI;
const FIX = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ki-antwort-beispiel.json'), 'utf8');

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }

const CTX = {
  entries: [{ id: 'e8', title: 'Die EU hat 28 Mitgliedstaaten' }, { id: 'e6', title: 'Wissenschaftlicher Konsens zum Klimawandel' }],
  args: [{ id: 'a4', title: 'Sanktionen wirken nie', claim: 'Sanktionen haben noch nie ein Regime zum Einlenken gebracht.' }],
  sources: [{ id: 's1', title: 'Charta der Vereinten Nationen' }, { id: 's8', title: 'Länder der EU' }],
  sourceKinds: ['Primärquelle', 'Studie', 'Sonstiges']
};
let counter = 0;
const uid = p => p + '_t' + (++counter);
function records(mod) {
  counter = 0;
  const p = K.buildPlan(K.parseAnswer(FIX).data, CTX), c = K.defaultChoice(p);
  if (mod) mod(p, c);
  return K.toRecords(K.finalize(p, c), { uid, now: 1000, task: p.task, existingLinks: [] });
}

test('Neue Kennungen, Prüfstatus „neu“, Herkunft „ki“ bei allen Datensätzen', () => {
  const R = records();
  assert(R.entries.length === 3 && R.sources.length === 2 && R.args.length === 1 && R.links.length === 3, [R.entries.length, R.sources.length, R.args.length, R.links.length].join());
  [...R.entries, ...R.args].forEach(o => assert(o.status === 'neu', o.title));
  [...R.entries, ...R.sources, ...R.args, ...R.links].forEach(o => assert(o.origin && o.origin.kind === 'ki' && o.origin.at === 1000 && o.origin.task === 'pruefen', JSON.stringify(o.origin)));
  const ids = [...R.entries, ...R.sources, ...R.args, ...R.links].map(o => o.id);
  assert(new Set(ids).size === ids.length && ids.every(id => /_t\d+$/.test(id)), 'eindeutige neue Kennungen');
  assert(!ids.some(id => ['e8', 'e6', 'a4', 's1', 's8', 'n1', 'q1', 'k1'].includes(id)), 'keine KI-Kennungen oder vorhandenen Kennungen');
});
test('Felder entsprechen der App; vollständige Struktur', () => {
  const R = records(), e = R.entries[0], s = R.sources[0], a = R.args[0];
  ['id', 'title', 'description', 'type', 'status', 'topic', 'tags', 'sourceIds', 'postId', 'claimCore', 'reason', 'evidence', 'limits', 'conclusion', 'created', 'updated'].forEach(k => assert(k in e, 'Eintrag: ' + k));
  ['id', 'title', 'publisher', 'author', 'year', 'date', 'kind', 'url', 'note', 'method', 'keyClaims', 'limitations', 'coi', 'conflicts', 'created'].forEach(k => assert(k in s, 'Quelle: ' + k));
  ['id', 'title', 'claim', 'counter', 'topic', 'status', 'sourceIds', 'created'].forEach(k => assert(k in a, 'Karte: ' + k));
  assert(e.title.startsWith('Brexit') && e.type === 'fakt' && e.tags.join() === 'EU,Brexit,Großbritannien', JSON.stringify(e));
});
test('Quellenverweise: neue Quellen über neue Kennung, doppelte über vorhandene', () => {
  const R = records(), byTitle = t => R.sources.find(s => s.title.startsWith(t));
  const e = R.entries[0];
  assert(e.sourceIds.length === 2 && e.sourceIds[0] === byTitle('Austrittsabkommen').id && e.sourceIds[1] === 's8', JSON.stringify(e.sourceIds));
  assert(!R.sources.some(s => s.title === 'Charta der Vereinten Nationen'), 'doppelte Quelle nicht neu angelegt');
  assert(R.args[0].sourceIds[0] === byTitle('Austrittsabkommen').id, 'Karte');
});
test('Verknüpfungen zeigen auf neue und vorhandene Datensätze; Umdeuten und Richtung werden übernommen', () => {
  const R = records((p, c) => { const k = p.links.find(l => l.to.id === 'k1'); c.flip[k.i] = true; c.rev[0] = true; });
  const brexit = R.entries[0].id, card = R.args[0].id;
  const toE8 = R.links.find(l => l.fromId === 'e8');
  assert(toE8 && toE8.toId === brexit && toE8.fromK === 'entries' && toE8.type === 'widerspricht', 'Richtung umgedreht: ' + JSON.stringify(toE8));
  const toCard = R.links.find(l => l.toId === card);
  assert(toCard && toCard.toK === 'args' && toCard.type === 'unterstuetzt', 'umgedeutet: ' + JSON.stringify(toCard));
  assert(R.links.some(l => l.toId === 'a4' && l.type === 'unterstuetzt'), 'vorhandene Karte');
});
test('Bereits vorhandene Verknüpfung wird nicht doppelt angelegt', () => {
  counter = 0;
  const p = K.buildPlan({ verknuepfungen: [{ von: 'e6', art: 'widerspricht', zu: 'e8' }, { von: 'e6', art: 'ergaenzt', zu: 'e8' }] }, CTX);
  const R = K.toRecords(K.finalize(p, K.defaultChoice(p)), { uid, now: 1, existingLinks: [{ type: 'widerspricht', fromK: 'entries', fromId: 'e6', toK: 'entries', toId: 'e8' }] });
  assert(R.links.length === 1 && R.links[0].type === 'ergaenzt' && R.skippedLinks === 1, JSON.stringify(R));
});
test('Status aus der KI-Antwort wird ignoriert; alles bleibt „neu“', () => {
  counter = 0;
  const p = K.buildPlan({ eintraege: [{ ref: 'n1', titel: 'X', typ: 'fakt', status: 'belegt', pruefstatus: 'belegt' }], karten: [{ ref: 'k1', titel: 'Y', status: 'belegt' }] }, CTX);
  const R = K.toRecords(K.finalize(p, K.defaultChoice(p)), { uid, now: 1 });
  assert(R.entries[0].status === 'neu' && R.args[0].status === 'neu', 'Status');
});
test('Abgewähltes erzeugt nichts; Eingaben bleiben unverändert', () => {
  const before = JSON.stringify(CTX);
  const R = records((p, c) => { Object.keys(c.entries).forEach(k => { c.entries[k] = false; }); Object.keys(c.cards).forEach(k => { c.cards[k] = false; }); Object.keys(c.sources).forEach(k => { c.sources[k] = 'skip'; }); });
  assert(!R.entries.length && !R.args.length && !R.sources.length && !R.links.length, 'leer');
  assert(JSON.stringify(CTX) === before, 'Kontext verändert');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
