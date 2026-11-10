/* Unit-Tests der Post-Formate für X (ohne Browser). Aufruf: node tests/post.unit.test.mjs
 * Phase 5, Etappe 1. */
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
const UN = { kind: 'entries', id: 'e2', title: 'Gründung der Vereinten Nationen', type: 'fakt', status: 'belegt', rel: 'unterstuetzend', sources: [{ title: 'Charta der Vereinten Nationen' }],
  description: 'Die UN-Charta trat am 24. Oktober 1945 in Kraft. 51 Staaten waren Gründungsmitglieder.' };
const INF = { kind: 'entries', id: 'e20', title: 'Inflation 2023', type: 'statistik', status: 'belegt', rel: 'ergaenzend', sources: [SRC],
  claimCore: 'Die Inflation lag 2023 bei 5,9 Prozent.', evidence: 'Laut Statistischem Bundesamt stieg der Verbraucherpreisindex 2023 um 5,9 Prozent. Weitere Details folgen.',
  conclusion: 'Die Teuerung hat sich gegenüber 2022 abgeschwächt.' };
const KARTE = { kind: 'args', id: 'a4', title: 'Sanktionen wirken nie', status: 'teilweise', rel: 'relativierend', sources: [],
  claim: 'Sanktionen haben noch nie ein Regime zum Einlenken gebracht.', counter: 'Es gibt Fälle mit teilweisem Erfolg, etwa Südafrika.' };
const post = (items, type, close = 'keiner', claim = '') => A.buildPost({ type, close, claim, items, statusLabel: SL });

test('Zeichenzählung wie X: Links 23, Emojis doppelt', () => {
  assert(A.xLength('Hallo') === 5);
  assert(A.xLength('Siehe https://www.destatis.de/DE/Themen/Wirtschaft/Preise/sehr-langer-pfad.html') === 6 + 23, A.xLength('Siehe https://www.destatis.de/DE/x'));
  assert(A.xLength('www.example.org') === 23);
  assert(A.xLength('👍') === 2 && A.xLength('a👍b') === 4, A.xLength('👍'));
  assert(A.xLength('Zeile\nZeile') === 11);
});
test('Antwort: Kernaussage, dann Beleg aus dem Feld „Evidenz“', () => {
  const p = post([INF], 'antwort');
  assert(p.parts.map(x => x.role).join() === 'kern,beleg', p.parts.map(x => x.role).join());
  assert(p.text === 'Die Inflation lag 2023 bei 5,9 Prozent. Laut Statistischem Bundesamt stieg der Verbraucherpreisindex 2023 um 5,9 Prozent.', p.text);
  assert(p.parts[1].from === 'Evidenz' && p.parts[1].n === 1, JSON.stringify(p.parts[1]));
});
test('Ohne Evidenz: Beleg kommt aus dem nächsten (belegten) Eintrag', () => {
  const p = post([UN, EU, KARTE], 'antwort');
  assert(p.parts[0].text.startsWith('Die Angabe „Die EU hat 28 Mitgliedstaaten“ ist veraltet'), p.parts[0].text);
  assert(p.parts[1].n === 2 && p.refs[1].id === 'e2', 'belegter UN-Eintrag bevorzugt vor der Karte ohne Quelle');
});
test('Inhalte stammen aus gespeicherten Texten, keine Quelle und keine Belegnummern im Post', () => {
  const p = post([EU, UN], 'zitat');
  assert(!/\[\d/.test(p.text) && !p.text.includes('Quelle'), p.text);
  assert(p.text.includes('Seitdem hat die EU 27 Mitgliedstaaten.'), p.text);
});
test('Abschluss: Rückfrage je nach Post-Art, Schlussfolgerung aus dem Eintrag', () => {
  assert(post([INF], 'antwort', 'frage').text.endsWith('Worauf stützt du deine Aussage?'));
  assert(post([INF], 'eigen', 'frage').text.endsWith('Welche Quellen kennt ihr dazu?'));
  const s = post([INF], 'zitat', 'schluss');
  assert(s.text.endsWith('Die Teuerung hat sich gegenüber 2022 abgeschwächt.') && s.parts[2].from === 'Schlussfolgerung', s.text);
  const none = post([UN], 'antwort', 'schluss');
  assert(none.parts.length === 1 && none.notes.some(x => x.includes('keine Schlussfolgerung') || x.includes('hat eine Schlussfolgerung')), JSON.stringify(none.notes));
});
test('Eigener Post: verständlich ohne Vorwissen, mit Einleitung und Absätzen', () => {
  const p = post([EU], 'eigen', 'keiner', 'Die EU hat 28 Mitgliedstaaten.');
  assert(p.text.startsWith('Oft heißt es: „Die EU hat 28 Mitgliedstaaten“\n\n'), p.text);
  assert(p.parts[0].role === 'einleitung' && p.parts[0].tpl, 'Einleitung als Vorlage');
  assert(!post([EU], 'antwort', 'keiner', 'Die EU hat 28 Mitgliedstaaten.').text.includes('Oft heißt es'), 'Antwort ohne Einleitung');
});
test('Immer höchstens 280 Zeichen: erst Einleitung/Abschluss weg, dann Beleg kürzen', () => {
  const long = 'Dies ist ein sehr langer Satz mit vielen Wörtern, der die Kernaussage eines Eintrags ausführlich beschreibt und dabei mehrere Nebensätze verwendet, damit er lang genug wird';
  const L = { ...INF, claimCore: long + '.', evidence: long + ' und zusätzlich noch weitere Erläuterungen enthält.', conclusion: 'Ein Schluss.' };
  const p = post([L], 'eigen', 'schluss', 'Eine Behauptung, die ebenfalls nicht ganz kurz ist und Platz braucht.');
  assert(p.chars <= 280, p.chars + ': ' + p.text);
  assert(p.notes.some(x => x.includes('Einleitung weggelassen')) && p.notes.some(x => x.includes('Abschluss weggelassen')) && p.notes.some(x => x.includes('Beleg gekürzt')), JSON.stringify(p.notes));
  assert(p.parts.find(x => x.role === 'beleg').cut, 'Beleg als gekürzt markiert');
  const huge = { ...INF, claimCore: (long + ' ').repeat(3).trim() + '.', evidence: 'Noch ein Beleg.' };
  const q = post([huge], 'antwort');
  assert(q.chars <= 280 && q.parts.find(x => x.role === 'kern').cut && !q.parts.find(x => x.role === 'beleg'), q.chars + ' ' + JSON.stringify(q.notes));
});
test('Nicht belegte Teile werden gezählt; Vorlagen gelten nicht als Behauptung', () => {
  const p = post([KARTE], 'antwort', 'frage');
  assert(p.unsupported === 1 && p.parts[0].label.includes('keine Quelle'), JSON.stringify(p.parts));
  assert(p.parts[1].tpl && p.parts[1].ok, 'Rückfrage ist Vorlage');
});
test('Ohne verwendbaren Text: leerer Post', () => {
  const p = post([{ kind: 'entries', id: 'x', title: '', type: 'fakt', status: 'neu', sources: [] }], 'antwort');
  assert(p.text === '' && p.parts.length === 0, JSON.stringify(p));
  assert(A.buildPost({ items: [] }).text === '');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
