/* Unit-Tests des KI-Prompts (ohne Browser). Aufruf: node tests/ki.unit.test.mjs
 * Phase 4B, Etappe 1. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const K = require('../ki.js').KI;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }

const DATA = {
  entries: [{ id: 'e8', title: 'Die EU hat 28 Mitgliedstaaten', type: 'behauptung', status: 'veraltet', description: 'Galt bis 2020. Seitdem 27.', sourceIds: ['s8'],
    conclusion: 'GEHEIME SCHLUSSFOLGERUNG', reason: 'x', note: 'GEHEIME NOTIZ' }],
  args: [{ id: 'a4', title: 'Sanktionen wirken nie', status: 'teilweise', claim: 'Sanktionen haben nie gewirkt.', counter: 'Südafrika zeigt teilweisen Erfolg.', sourceIds: [] }],
  sources: [{ id: 's8', title: 'Länder der EU', publisher: 'Europäische Union', year: '2024', kind: 'Offizielle Seite', note: 'GEHEIME QUELLENNOTIZ', url: 'https://example.org' }]
};
const opts = { typeLabel: t => ({ behauptung: 'Behauptung' })[t] || t, statusLabel: s => ({ veraltet: 'Veraltet', teilweise: 'Teilweise belegt' })[s] || s, sourceKinds: ['Studie', 'Statistik'] };
const jsonBlock = p => JSON.parse(p.slice(p.indexOf('```json') + 7, p.indexOf('```', p.indexOf('```json') + 7)));

test('Prüf-Auftrag: Aufgabe, Text, Einträge mit Kennungen, Quellen, Regeln', () => {
  const r = K.buildPrompt(DATA, { ...opts, task: 'pruefen', text: 'Die EU hat 28 Staaten.' });
  const p = r.prompt;
  assert(p.includes('## Aufgabe\nPrüfe den Text unten') && p.includes('"""\nDie EU hat 28 Staaten.\n"""'), 'Aufgabe/Text');
  assert(p.includes('- [e8] Behauptung · Prüfstatus: Veraltet · Die EU hat 28 Mitgliedstaaten — Beschreibung: Galt bis 2020. Seitdem 27. — Quellen: s8'), 'Eintrag');
  assert(p.includes('- [a4] Argumentationskarte · Prüfstatus: Teilweise belegt') && p.includes('Mein Gegenargument: Südafrika'), 'Karte');
  assert(p.includes('- [s8] Länder der EU — Europäische Union — 2024 (Offizielle Seite)'), 'Quelle');
  assert(p.includes('Erfinde keine Quellen') && p.includes('n1, n2') && p.includes('Ändern kannst du sie nicht'), 'Regeln');
  assert(r.counts.entries === 1 && r.counts.args === 1 && r.counts.sources === 1 && r.chars === p.length, 'Zählung');
});
test('Antwortformat: gültiges JSON-Beispiel mit allen Bereichen und erlaubten Werten', () => {
  const p = K.buildPrompt(DATA, { ...opts, task: 'pruefen', text: 'x' }).prompt;
  const ex = jsonBlock(p);
  assert(ex.debatebase === K.FORMAT && ex.version === K.FORMAT_VERSION && ex.aufgabe === 'pruefen', 'Kopf');
  ['zusammenfassung', 'behauptungen', 'eintraege', 'quellen', 'karten', 'verknuepfungen'].forEach(k => assert(k in ex, k + ' fehlt'));
  assert(!('antwort' in ex), 'kein Antworttext beim Prüfen');
  assert(p.includes('Erlaubte Werte für "typ" bei Einträgen: ' + K.ENTRY_TYPES.join(', ')) && p.includes(K.LINK_TYPES.join(', ')) && p.includes('Studie, Statistik'), 'erlaubte Werte');
  assert(p.includes('Antworte mit genau einem Codeblock im Format JSON'), 'Formatanweisung');
});
test('Antwort-Auftrag: Stil, Kennungen in eckigen Klammern, 280 Zeichen, Feld „antwort“', () => {
  const p = K.buildPrompt(DATA, { ...opts, task: 'antwort', text: 'Sanktionen wirken nie.', style: 'Kurz und pointiert' }).prompt;
  assert(p.includes('im Stil „Kurz und pointiert“') && p.includes('[e6]') && p.includes('280 Zeichen'), 'Aufgabe');
  assert(jsonBlock(p).antwort, 'Feld antwort');
});
test('Datenminimierung: keine Notizen, Schlussfolgerungen, Begründungen oder Links aus der Datenbank', () => {
  const p = K.buildPrompt(DATA, { ...opts, task: 'pruefen', text: 'x' }).prompt;
  assert(!p.includes('GEHEIM') && !p.includes('https://example.org'), 'vertrauliche Felder im Prompt');
});
test('Lange Texte werden gekürzt, dreifache Anführungszeichen entschärft', () => {
  const r = K.buildPrompt({ entries: [{ id: 'e1', title: 'T', type: 'fakt', status: 'neu', description: 'a'.repeat(2000) }] }, { task: 'pruefen', text: 'Wort """ Ende ' + 'b'.repeat(6000) });
  const txt = r.prompt.split('## Text\n"""\n')[1].split('\n"""')[0];
  assert(txt.length <= 4000 && !txt.includes('"""'), txt.length);
  assert(!r.prompt.includes('a'.repeat(501)), 'Beschreibung gekürzt');
});
test('Zeilenumbrüche im Text (Threads) bleiben erhalten', () => {
  const p = K.buildPrompt({}, { task: 'pruefen', text: 'Erster Beitrag\n\n\n\nZweiter Beitrag' }).prompt;
  assert(p.includes('"""\nErster Beitrag\n\nZweiter Beitrag\n"""'), 'Umbrüche');
});
test('Ohne Einträge und ohne Text: trotzdem gültiger Prompt', () => {
  const p = K.buildPrompt({}, { task: 'pruefen' }).prompt;
  assert(p.includes('(kein Text angegeben)') && p.includes('(keine ausgewählt)') && p.includes('(keine)'), p.slice(0, 200));
  jsonBlock(p);
});

test('3.10.0: Screenshot-Hinweis im Prompt (falls vorhanden) und Feld „screenshot“ im Format', () => {
  ['pruefen', 'antwort'].forEach(task => {
    const p = K.buildPrompt(DATA, { ...opts, task, text: 'x' }).prompt;
    assert(p.includes('## Screenshot\nFalls ich einen Screenshot angehängt habe') && p.includes('Falls kein Screenshot angehängt ist, ignoriere diesen Hinweis'), 'Hinweis ' + task);
    assert(p.indexOf('## Screenshot') > p.indexOf('## Text') && p.indexOf('## Screenshot') < p.indexOf('## Meine gespeicherten Einträge'), 'Position');
    assert(jsonBlock(p).screenshot === false && p.includes('Im Feld "screenshot"'), 'Formatfeld');
  });
});
test('3.10.0: Rückmeldung „screenshot“ wird gelesen; fehlt sie, bleibt alles wie bisher', () => {
  const plan = d => K.buildPlan(Object.assign({ debatebase: 'ki-antwort', version: 1 }, d), { entries: [], args: [], sources: [] });
  assert(plan({ screenshot: true }).screenshot === true && plan({ screenshot: 'ja' }).screenshot === true, 'true');
  assert(plan({ screenshot: false }).screenshot === false && plan({ screenshot: 'false' }).screenshot === false, 'false');
  assert(plan({}).screenshot === null && plan({ screenshot: 'vielleicht' }).screenshot === null, 'keine Angabe');
  assert(JSON.stringify(plan({ screenshot: true }).warnings) === JSON.stringify(plan({}).warnings), 'keine neuen Warnungen');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
