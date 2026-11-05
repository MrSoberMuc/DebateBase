/* Unit-Tests des Antwortassistenten (ohne Browser). Aufruf: node tests/reply.unit.test.mjs
 * Phase 4, Etappe 5. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const SL = s => ({ veraltet: 'Veraltet', belegt: 'Belegt', widerlegt: 'Widerlegt', umstritten: 'Umstritten', neu: 'Neu', teilweise: 'Teilweise belegt' })[s] || s;
const SRC = { title: 'Länder der EU', publisher: 'Europäische Union', year: '2024', url: 'https://european-union.europa.eu' };
const EU = { kind: 'entries', id: 'e8', title: 'Die EU hat 28 Mitgliedstaaten', type: 'behauptung', status: 'veraltet', rel: 'widersprechend', sources: [SRC],
  description: 'Diese Angabe galt bis zum Austritt des Vereinigten Königreichs am 31. Januar 2020. Seitdem hat die EU 27 Mitgliedstaaten.' };
const UN = { kind: 'entries', id: 'e2', title: 'Gründung der Vereinten Nationen', type: 'fakt', status: 'belegt', rel: 'unterstuetzend', sources: [{ title: 'Charta der Vereinten Nationen', publisher: 'Vereinte Nationen', year: '1945' }],
  description: 'Die UN-Charta trat am 24. Oktober 1945 in Kraft. 51 Staaten waren Gründungsmitglieder.' };
const KARTE = { kind: 'args', id: 'a4', title: 'Sanktionen wirken nie', status: 'teilweise', rel: 'relativierend', sources: [],
  claim: 'Sanktionen haben noch nie ein Regime zum Einlenken gebracht.', counter: 'Es gibt Fälle mit teilweisem Erfolg, etwa Südafrika. Der Erfolg hängt von Ziel und Durchsetzung ab.' };
const NEU = { kind: 'entries', id: 'e20', title: 'Inflation 2023', type: 'statistik', status: 'neu', rel: 'ergaenzend', sources: [SRC], claimCore: 'Die Inflation lag 2023 bei 5,9 Prozent.' };
const draft = (items, style, claim = '') => A.draftReply({ claim, items, style, statusLabel: SL });

test('Drei Stile mit eigener Form', () => {
  const s = draft([EU, KARTE], 'sachlich', 'Die EU hat 28 Mitgliedstaaten.');
  const a = draft([EU, KARTE], 'argument', 'Die EU hat 28 Mitgliedstaaten.');
  const k = draft([EU, KARTE], 'kurz', 'Die EU hat 28 Mitgliedstaaten.');
  assert(s.styleLabel === 'Sachlich und neutral' && s.x.startsWith('Zur Aussage „Die EU hat 28 Mitgliedstaaten“:'), s.x);
  assert(a.x.startsWith('Das lässt sich so nicht halten.\nErstens: ') && a.x.includes('\nZweitens: '), a.x);
  assert(k.x.startsWith('Stimmt so nicht.') && k.chars <= 280, k.chars + ' ' + k.x);
});
test('Inhaltliche Sätze stammen wörtlich aus gespeicherten Texten', () => {
  const d = draft([EU, UN, KARTE], 'sachlich');
  const stored = [EU.description, UN.description, KARTE.counter].join(' ');
  d.parts.forEach(p => {
    const body = p.text.replace(/[.…]$/, '');
    assert(stored.includes(body), 'nicht aus gespeichertem Text: ' + p.text);
  });
  assert(d.parts[0].pre.includes('„Die EU hat 28 Mitgliedstaaten“ ist veraltet'), 'Status-Hinweis bei veralteter Behauptung');
});
test('Bei widerlegten/veralteten Behauptungen wird die Erklärung zitiert, nicht die Behauptung selbst', () => {
  const d = draft([EU], 'sachlich');
  assert(d.parts[0].text.startsWith('Diese Angabe galt bis') && !/^Die EU hat 28/.test(d.parts[0].text), d.parts[0].text);
  assert(d.refs[0].from === 'Beschreibung', d.refs[0].from);
});
test('Jeder Satz verweist auf seinen Eintrag; Belegliste nennt Quellen mit Link', () => {
  const d = draft([EU, UN], 'argument');
  assert(/\[1\]/.test(d.full) && /\[2\]/.test(d.full), d.full);
  assert(d.full.includes('Belege:\n[1] ') && d.full.includes('Quelle: Länder der EU, Europäische Union, 2024 https://european-union.europa.eu'), d.full);
  assert(d.refs.every(r => r.id && r.title), 'Verweise');
  assert(d.x.includes('Quellen: Länder der EU; Charta der Vereinten Nationen') && !/\[\d/.test(d.x), 'X-Fassung ohne Nummern, mit Quellen');
});
test('Nicht belegte Aussagen werden gekennzeichnet (ohne Quelle / ungeprüfter Status)', () => {
  const d = draft([UN, KARTE, NEU], 'sachlich');
  assert(d.unsupported === 2, 'Anzahl: ' + d.unsupported);
  assert(d.full.includes('– nicht belegt: keine Quelle verknüpft]'), 'ohne Quelle');
  assert(d.full.includes('– nicht belegt: Prüfstatus „Neu“]'), 'ungeprüft');
  const ok = d.parts.find(p => p.n === d.refs.find(r => r.id === 'e2').n);
  assert(ok.ok && !ok.label, 'belegter Fakt ohne Markierung');
});
test('Reihenfolge: widersprechende, dann relativierende, dann unterstützende Inhalte', () => {
  const d = draft([UN, KARTE, EU], 'argument');
  assert(d.refs.map(r => r.id).join() === 'e8,a4,e2', d.refs.map(r => r.id).join());
});
test('Kurz und pointiert: höchstens 280 Zeichen, belegte Aussage zuerst, Quelle angehängt', () => {
  const d = draft([KARTE, UN], 'kurz');
  assert(d.chars <= 280 && d.parts[0].n === d.refs.find(r => r.id === 'e2').n && d.x.includes('Quelle: Charta der Vereinten Nationen'), d.x);
  const long = { ...UN, description: 'Ein sehr langer Satz mit ' + 'vielen Wörtern '.repeat(40) + 'am Ende.' };
  const dl = draft([long], 'kurz');
  assert(dl.chars <= 280 && dl.x.includes('…'), dl.chars);
});
test('Einleitung ohne Einordnung bleibt neutral; Hinweis bei abgeleitetem Einleitungssatz', () => {
  const d = draft([{ ...UN, rel: 'ergaenzend' }], 'argument');
  assert(d.opener === '' && d.openerNote === '', JSON.stringify(d.opener));
  assert(draft([EU], 'argument').openerNote.includes('Kandidat'), 'Hinweis');
});
test('Keine Einträge → leerer Entwurf; Eingabedaten unverändert', () => {
  const d = draft([], 'sachlich', 'Irgendwas');
  assert(d.parts.length === 0 && d.refs.length === 0, 'leer');
  const before = JSON.stringify([EU, UN, KARTE]);
  draft([EU, UN, KARTE], 'kurz'); draft([EU, UN, KARTE], 'argument');
  assert(JSON.stringify([EU, UN, KARTE]) === before, 'verändert');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
