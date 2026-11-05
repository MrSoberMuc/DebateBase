/* Unit-Tests: KI-Antwort einlesen und prüfen (ohne Browser). Aufruf: node tests/kiimport.unit.test.mjs
 * Phase 4B, Etappe 2. Das Beispiel bildet die Eigenheiten einer echten ChatGPT-Antwort nach
 * (kein Codeblock, freier Text bei „einordnung“, doppelte Quelle, Verknüpfung zu einer Karte). */
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
  sources: [{ id: 's1', title: 'Charta der Vereinten Nationen', url: 'https://www.un.org/en/about-us/un-charter' }, { id: 's8', title: 'Länder der EU', url: 'https://european-union.europa.eu' }],
  sourceKinds: ['Primärquelle', 'Studie', 'Fachartikel', 'Statistik', 'Offizielle Seite', 'Nachrichten', 'Buch', 'Rede oder Interview', 'Social-Media-Beitrag', 'Sonstiges']
};
const plan = () => K.buildPlan(K.parseAnswer(FIX).data, CTX);

/* ---------- Einlesen ---------- */
test('Reines JSON ohne Codeblock (wie ChatGPT) wird gelesen', () => {
  const r = K.parseAnswer(FIX);
  assert(r.ok && r.notes.length === 0 && r.data.eintraege.length === 4, JSON.stringify(r.notes));
});
test('Codeblock mit Text davor und danach; Text ohne Codeblock wird gemeldet', () => {
  const r = K.parseAnswer('Hier ist das Ergebnis:\n```json\n' + FIX + '\n```\nViel Erfolg!');
  assert(r.ok && r.notes.length === 0, 'Codeblock');
  const r2 = K.parseAnswer('Hier ist das Ergebnis:\n' + FIX + '\nViel Erfolg!');
  assert(r2.ok && r2.notes.some(x => x.includes('ignoriert')), 'Hinweis auf ignorierten Text');
});
test('Kleine Formatfehler werden repariert (Komma am Ende, typografische Anführungszeichen)', () => {
  const r = K.parseAnswer('{"debatebase":"ki-antwort","eintraege":[{"titel":"A","typ":"fakt",},],}');
  assert(r.ok && r.data.eintraege[0].titel === 'A' && r.notes.some(x => x.includes('korrigiert')), JSON.stringify(r));
  const r2 = K.parseAnswer('{“debatebase”: "ki-antwort", “eintraege”: []}');
  assert(r2.ok && Array.isArray(r2.data.eintraege), JSON.stringify(r2));
});
test('Verständliche Fehlermeldungen: leer, kein Block, abgeschnitten, ungültig', () => {
  assert(K.parseAnswer('   ').error === 'Es wurde nichts eingefügt.', 'leer');
  assert(K.parseAnswer('Ich kann das leider nicht.').error.startsWith('Kein Datenblock gefunden'), 'kein Block');
  assert(/abgeschnitten|nicht ganz kopiert/.test(K.parseAnswer(FIX.slice(0, 600)).error), 'abgeschnitten');
  const bad = K.parseAnswer('{"a": 1,\n"b": [1 2]}');
  assert(!bad.ok && bad.error.includes('kein gültiges JSON') && bad.error.includes('Zeile 2'), bad.error);
  assert(K.parseAnswer('[1,2]').error.startsWith('Kein Datenblock gefunden'), 'Liste ohne Datenblock');
  assert(K.parseAnswer('{"eintraege":[]}').notes.some(x => x.includes('Kennung')), 'fehlende Kennung als Hinweis');
});

/* ---------- Prüfen ---------- */
test('Einträge: Typ normalisiert, Tags bereinigt, Quellenverweise geprüft, Dublette erkannt', () => {
  const p = plan();
  assert(p.entries.length === 4, 'Anzahl');
  const n1 = p.entries[0], n2 = p.entries[1], n3 = p.entries[2], n4 = p.entries[3];
  assert(n1.tags.join() === 'EU,Brexit,Großbritannien', 'Tags: ' + n1.tags);
  assert(n1.sources.join() === 'q1,s8', 'Quellen: vorhandene und neue');
  assert(n2.sources.length === 0 && p.warnings.some(w => w.includes('„q9“ ist unbekannt')), 'unbekannte Quelle');
  assert(n3.type === 'frage', 'Typ „Frage“ → frage');
  assert(n4.dup && n4.dup.id === 'e8' && !n1.dup, 'Dublette');
});
test('Quellen: doppelte Quelle, ungültiger Link und Jahr, unbekannter Typ', () => {
  const p = plan(), [q1, q2, q3] = p.sources;
  assert(!q1.dup && q1.kind === 'Primärquelle', 'q1');
  assert(q2.dup && q2.dup.id === 's1', 'q2 = s1');
  assert(q3.url === '' && q3.year === '' && q3.kind === 'Sonstiges', JSON.stringify(q3));
  ['Link „keine-url“ ist ungültig', 'Jahr „letztes Jahr“ ist ungültig', 'Typ „Blog“ ist unbekannt'].forEach(t => assert(p.warnings.some(w => w.includes(t)), 'Hinweis fehlt: ' + t));
});
test('Verknüpfungen: Umlaut in der Art, unbekannte Kennung, Quelle, unbekannte Art, doppelt', () => {
  const p = plan();
  assert(p.links.length === 3, p.links.map(l => l.from.id + '>' + l.to.id).join());
  assert(p.links[2].type === 'unterstuetzt' && p.links[2].to.id === 'a4' && !p.links[2].to.isNew, 'Umlaut / vorhandene Karte');
  assert(p.warnings.some(w => w.includes('(e6 → n9)') && w.includes('unbekannte Kennung')), 'unbekannte Kennung');
  assert(p.warnings.some(w => w.includes('Quellen können nicht verknüpft werden')), 'Quelle');
  assert(p.warnings.some(w => w.includes('Art „erklärt“ ist unbekannt')), 'Art');
});
test('Grenzen: zu viele Einträge, doppelte Kennungen, Einträge ohne Titel', () => {
  const many = { eintraege: Array.from({ length: 25 }, (_, i) => ({ ref: 'n' + i, titel: 'T' + i, typ: 'fakt' })).concat([{ ref: 'n0', titel: 'doppelt' }]) };
  const p = K.buildPlan(many, CTX);
  assert(p.entries.length === 20 && p.warnings.some(w => w.includes('nur die ersten 20')), 'Begrenzung');
  const p2 = K.buildPlan({ eintraege: [{ ref: 'n1', titel: 'A' }, { ref: 'n1', titel: 'B' }, { ref: 'e8', titel: 'C' }, { typ: 'fakt' }] }, CTX);
  assert(p2.entries.length === 1 && p2.warnings.filter(w => w.includes('doppelt')).length === 2 && p2.warnings.some(w => w.includes('keinen Titel')), JSON.stringify(p2.warnings));
  assert(K.buildPlan({}, CTX).warnings.some(w => w.includes('nichts')), 'leere Antwort');
});

/* ---------- Auswahl ---------- */
test('Vorauswahl: Dubletten nicht neu, doppelte Quelle mit vorhandener verknüpft', () => {
  const p = plan(), c = K.defaultChoice(p);
  assert(c.entries.n1 && !c.entries.n4 && c.sources.q2 === 'existing' && c.sources.q1 === 'new' && c.cards.k1, JSON.stringify(c));
  const f = K.finalize(p, c);
  assert(f.entries.length === 3 && f.sources.length === 2 && f.cards.length === 1 && f.links.length === 3, [f.entries.length, f.sources.length, f.cards.length, f.links.length].join());
  assert(JSON.stringify(f.entries[0].sourceTargets) === '[{"isNew":true,"ref":"q1"},{"isNew":false,"id":"s8"}]', JSON.stringify(f.entries[0].sourceTargets));
});
test('Abwählen: Verknüpfungen entfallen mit Begründung; abgewählte Quelle verschwindet aus Verweisen', () => {
  const p = plan(), c = K.defaultChoice(p);
  c.entries.n1 = false; c.sources.q1 = 'skip';
  const f = K.finalize(p, c);
  assert(f.links.length === 1 && f.droppedLinks.length === 2, 'Verknüpfungen');
  assert(JSON.stringify(f.cards[0].sourceTargets) === '[]', 'Quelle entfernt');
});
test('Umdeuten bei Karten und Richtung umdrehen', () => {
  const p = plan(), c = K.defaultChoice(p);
  const toCard = p.links.find(l => l.to.id === 'k1');
  c.flip[toCard.i] = true; c.rev[0] = true;
  const f = K.finalize(p, c);
  const fl = f.links.find(l => l.i === toCard.i), rv = f.links.find(l => l.i === 0);
  assert(fl.type === 'unterstuetzt' && fl.flipped, 'Umdeuten');
  assert(rv.from.id === 'e8' && rv.to.id === 'n1' && rv.reversed, 'Richtung');
});
test('Vorhandene Daten und Eingaben werden nicht verändert; Prompt erklärt Karten-Verknüpfungen', () => {
  const before = JSON.stringify(CTX);
  const p = plan(); K.finalize(p, K.defaultChoice(p));
  assert(JSON.stringify(CTX) === before, 'Kontext verändert');
  const pr = K.buildPrompt({}, { task: 'pruefen', text: 'x' }).prompt;
  assert(pr.includes('bezieht sich immer auf mein Gegenargument') && pr.includes('Quellen können nicht verknüpft werden'), 'Regeln 6 und 7');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
