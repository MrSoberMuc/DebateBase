/* Unit-Tests: Quellen-Folgeantwort und Prüfstatus im Post (Phase 5, Etappe 2).
 * Aufruf: node tests/post2.unit.test.mjs */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const SL = s => ({ veraltet: 'Veraltet', belegt: 'Belegt', widerlegt: 'Widerlegt', umstritten: 'Umstritten', neu: 'Neu', teilweise: 'Teilweise belegt', pruefung: 'In Prüfung' })[s] || s;
const S1 = { id: 's1', title: 'Verbraucherpreisindex 2023', publisher: 'Statistisches Bundesamt', year: '2024', url: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Verbraucherpreisindex/_inhalt.html' };
const S2 = { id: 's2', title: 'Charta der Vereinten Nationen', publisher: 'Vereinte Nationen', year: '1945' };
const E = (id, status, extra = {}) => ({ kind: 'entries', id, title: 'Eintrag ' + id, type: 'fakt', status, rel: 'unterstuetzend', sources: [S1], claimCore: 'Aussage ' + id + '.', ...extra });
const post = (items, opt = {}) => A.buildPost({ type: 'antwort', close: 'keiner', items, statusLabel: SL, ...opt });

test('Folgeantwort mit einer Quelle: Titel, Herausgeber, Jahr, Link', () => {
  const p = post([E('e1', 'belegt')]);
  assert(p.follow.text === 'Quelle: Verbraucherpreisindex 2023 (Statistisches Bundesamt, 2024) ' + S1.url, p.follow.text);
  assert(p.follow.chars === A.xLength(p.follow.text) && p.follow.chars < 100, 'Link zählt 23');
  assert(!p.text.includes('http') && !p.text.includes('Quelle'), 'Post ohne Link');
});
test('Mehrere Quellen als Liste, doppelte nur einmal', () => {
  const p = post([E('e1', 'belegt'), E('e2', 'belegt', { sources: [S1, S2] })]);
  assert(p.follow.text.startsWith('Quellen:\n• Verbraucherpreisindex 2023') && p.follow.text.includes('\n• Charta der Vereinten Nationen (Vereinte Nationen, 1945)'), p.follow.text);
  assert(p.follow.text.split('Verbraucherpreisindex 2023').length === 2, 'S1 nur einmal');
});
test('Nur Quellen der im Post verwendeten Einträge', () => {
  const p = post([E('e1', 'belegt', { evidence: 'Beleg aus Evidenz.' }), E('e2', 'belegt', { sources: [S2] })]);
  assert(p.refs.length === 1 && !p.follow.text.includes('Charta'), p.follow.text);
});
test('Ohne Quelle: keine Folgeantwort', () => {
  const p = post([E('e1', 'belegt', { sources: [] })]);
  assert(p.follow.text === '' && p.follow.sources.length === 0);
});
test('Folgeantwort bleibt unter 280 Zeichen: kürzen, dann Quellen weglassen', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: 'x' + i, title: 'Ein ziemlich langer Titel einer Studie über Thema Nummer ' + i, publisher: 'Sehr lange Institution für Forschung', year: '2020', url: 'https://example.org/' + i }));
  const f = A.buildFollowUp([{ sources: many }]);
  assert(f.chars <= 280 && f.used >= 1 && f.used < 9, f.chars + ' / ' + f.used);
  assert(f.notes.some(x => x.includes('passen') || x.includes('passt')), JSON.stringify(f.notes));
});
test('Teilweise belegt, Umstritten, Veraltet: vorsichtig formuliert und gewarnt', () => {
  const t = post([E('e1', 'teilweise')]);
  assert(t.text.startsWith('Nach bisherigen Belegen spricht einiges dafür: Aussage e1.'), t.text);
  assert(t.parts[0].hedged && t.warnings[0].level === 'hedge' && t.warnings[0].text.includes('vorsichtig formuliert'), JSON.stringify(t.warnings));
  assert(post([E('e1', 'umstritten')]).text.startsWith('Nicht abschließend geklärt, aber: '));
  assert(post([E('e1', 'veraltet')]).text.startsWith('Nach älterem Stand: '));
  const card = { kind: 'args', id: 'a1', title: 'Karte', status: 'umstritten', rel: 'relativierend', sources: [], counter: 'Gegenargument.' };
  assert(post([card]).text.startsWith('Nicht abschließend geklärt, aber: Gegenargument.'), 'Karte');
});
test('Vorsichtige Formulierung ausschaltbar, Warnung bleibt', () => {
  const p = post([E('e1', 'teilweise')], { hedge: false });
  assert(p.text === 'Aussage e1.' && p.warnings[0].text.includes('ausgeschaltet'), p.text + JSON.stringify(p.warnings));
});
test('Widerlegter Fakt wird nicht als Argument verwendet', () => {
  const p = post([E('e1', 'widerlegt'), E('e2', 'belegt')]);
  assert(p.text === 'Aussage e2.' && p.refs.length === 1, p.text);
  assert(p.warnings.some(w => w.id === 'e1' && w.level === 'stop'), JSON.stringify(p.warnings));
  const only = post([E('e1', 'widerlegt')]);
  assert(only.text === '' && only.notes.some(x => x.includes('Widerlegte')), JSON.stringify(only));
});
test('Widerlegte Behauptung dient weiter zum Widerlegen – ohne Warnung', () => {
  const B = { kind: 'entries', id: 'e9', title: 'Impfstoffe verursachen Autismus', type: 'behauptung', status: 'widerlegt', rel: 'widersprechend', sources: [S2], description: 'Große Studien fanden keinen Zusammenhang.' };
  const p = post([B]);
  assert(p.text.startsWith('Die Behauptung „Impfstoffe verursachen Autismus“ gilt als widerlegt:') && !p.warnings.length, p.text + JSON.stringify(p.warnings));
});
test('Neu / In Prüfung: Hinweis „noch nicht geprüft“, keine Umformulierung', () => {
  const p = post([E('e1', 'pruefung')]);
  assert(p.text === 'Aussage e1.' && p.warnings[0].level === 'check' && p.warnings[0].text.includes('In Prüfung'), JSON.stringify(p.warnings));
});
test('Belegte Einträge: keine Warnung', () => {
  assert(post([E('e1', 'belegt')]).warnings.length === 0);
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
