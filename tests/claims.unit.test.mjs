/* Unit-Tests der Behauptungsanalyse (ohne Browser). Aufruf: node tests/claims.unit.test.mjs
 * Phase 4, Etappe 3. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }
const texts = r => r.statements.map(s => s.text);
const ids = st => st.rules.map(r => r.id);

/* ---------- Bereinigung ---------- */
test('X-Beitrag: Links, Antwort-Erwähnungen, Hashtags, Emojis, Thread-Zähler', () => {
  const c = A.cleanText('@anna @ben_2 Das ist #Klimaschutz pur 🔥 1/3 https://t.co/abc123. Mehr: https://example.org/x #Energie #CO2');
  assert(c.links.length === 2 && c.links[0] === 'https://t.co/abc123', JSON.stringify(c.links));
  assert(c.mentions.join() === 'anna,ben_2', 'Erwähnungen');
  assert(c.hashtags.join() === 'Energie,CO2,Klimaschutz', 'Hashtags: ' + c.hashtags);
  assert(c.text === 'Das ist Klimaschutz pur. Mehr:', JSON.stringify(c.text));
});

/* ---------- Satzzerlegung ---------- */
test('Sätze: Abkürzungen, Ordnungszahlen, Datum, Initialen, Dezimalzahlen', () => {
  const s = A.sentences('Die Charta trat am 24. Oktober 1945 in Kraft. Das sagt z. B. Prof. Müller. Im 1. Weltkrieg starben ca. 17 Mio. Menschen. J. Cook nennt 97,1 % bzw. 3.000 Studien! Stimmt das? Ja');
  assert(s.length === 6, s.length + ': ' + JSON.stringify(s));
  assert(s[0] === 'Die Charta trat am 24. Oktober 1945 in Kraft.', s[0]);
  assert(A.sentences('Er landete auf Platz 3. Danach kam nichts.').length === 2, 'Zahl am Satzende');
  assert(s[2].startsWith('Im 1. Weltkrieg') && s[3].startsWith('J. Cook nennt 97,1 %'), JSON.stringify(s));
});
test('Sätze: Zeilenumbrüche (Threads) trennen, Satz ohne Schlusspunkt bleibt erhalten', () => {
  const s = A.sentences('Erster Gedanke ohne Punkt\nZweiter Gedanke. Dritter');
  assert(s.join('|') === 'Erster Gedanke ohne Punkt|Zweiter Gedanke.|Dritter', s.join('|'));
});
test('Mehrere Behauptungen in einem Satz werden getrennt und gekennzeichnet', () => {
  const r = A.analyzeClaims('Die Inflation lag 2023 bei 5,9 Prozent; die Löhne stiegen um 6 Prozent. Die Steuern sinken, aber die Abgaben steigen.');
  assert(r.statements.length === 4, JSON.stringify(texts(r)));
  assert(r.statements.every(s => s.part), 'als Teilaussage markiert');
  assert(r.statements[3].text === 'aber die Abgaben steigen.', r.statements[3].text);
  assert(A.openQuestions(r.statements[0], []).some(q => q.includes('Automatisch aus einem längeren Satz')), 'Hinweis');
});

/* ---------- Regeln ---------- */
test('Regel: Zahl, Zeit, Zuschreibung → möglicherweise überprüfbar', () => {
  const st = A.analyzeClaims('Laut Umweltbundesamt lag der Anteil 2023 bei 52 %.').statements[0];
  assert(st.kind === 'pruefbar', st.kind);
  ['zahl', 'zeit', 'zuschreibung'].forEach(id => assert(ids(st).includes(id), id + ' fehlt: ' + ids(st)));
  assert(st.rules.find(r => r.id === 'zahl').words.includes('52 %'), JSON.stringify(st.rules));
});
test('Regel: Pauschal, Kausal, Vergleich, Verneinung', () => {
  const st = A.analyzeClaims('Sanktionen haben noch nie gewirkt, weil Diktatoren immer stärker als der Westen sind.').statements[0];
  ['pauschal', 'kausal', 'vergleich', 'verneinung'].forEach(id => assert(ids(st).includes(id), id + ' fehlt: ' + ids(st)));
  const q = A.openQuestions(st, []);
  assert(q.includes('Gibt es Gegenbeispiele?') && q.includes('Ist der Zusammenhang belegt oder nur zeitlich?') && q.includes('Womit genau wird verglichen?'), JSON.stringify(q));
});
test('Regel: Meinung, gemischt, vage, Vorhersage', () => {
  const r = A.analyzeClaims('Ich finde das einfach lächerlich. Diese Regierung ist eine Katastrophe, weil die Preise um 20 % stiegen. Experten sagen, das ist so. Die Arbeitslosigkeit wird bis 2030 steigen.');
  const k = r.statements.map(s => s.kind);
  assert(k[0] === 'meinung' && k[1] === 'gemischt', k.join());
  assert(ids(r.statements[2]).includes('vage') && A.openQuestions(r.statements[2], []).some(q => q.startsWith('Unklar, wer gemeint ist')), 'vage');
  assert(ids(r.statements[3]).includes('prognose'), 'Vorhersage: ' + ids(r.statements[3]));
});
test('Fragen, kurze Fragmente und Aussagen ohne Merkmale', () => {
  const r = A.analyzeClaims('Warum sagt das niemand? Krass. Der Himmel ist blau und schön.');
  assert(r.statements[0].kind === 'frage' && r.statements[0].why.includes('rhetorische'), r.statements[0].why);
  assert(r.statements[1].kind === 'fragment' && A.openQuestions(r.statements[1], []).length === 0, 'Fragment');
  assert(r.statements[2].kind === 'aussage' && r.statements[2].why === 'keine Regel hat gegriffen', 'unklar');
  assert(r.summary.frage === 1 && r.summary.fragment === 1 && r.summary.aussage === 1, JSON.stringify(r.summary));
});
test('Jede Einordnung trägt eine Begründung; Bezeichnungen behaupten keine KI', () => {
  const r = A.analyzeClaims('Die EU hat 27 Staaten. Ich finde das gut. Wer weiß das?');
  r.statements.forEach(s => assert(s.why && s.kindLabel, 'Begründung fehlt'));
  const all = JSON.stringify(A.CLAIM_KINDS) + JSON.stringify(r);
  assert(!/\bKI\b|künstliche Intelligenz|semantisch|versteht/i.test(all), 'Formulierung suggeriert KI');
  assert(Object.values(A.CLAIM_KINDS).every(l => !/^(Wahr|Falsch|Fakt)/.test(l)), 'keine Wahrheitsurteile');
});
test('Leerer oder sehr langer Text', () => {
  assert(A.analyzeClaims('').statements.length === 0 && A.analyzeClaims('   \n ').statements.length === 0, 'leer');
  const long = Array.from({ length: 200 }, (_, i) => `Aussage ${i} enthält die Zahl ${i}.`).join(' ');
  const t = Date.now(), r = A.analyzeClaims(long);
  assert(r.statements.length === 200 && Date.now() - t < 500, r.statements.length + ' / ' + (Date.now() - t) + ' ms');
});

/* ---------- Abgleich mit gespeicherten Einträgen ---------- */
function doc(id, o) {
  const f = (label, weight, text) => ({ label, weight, text: text || '' });
  return { id, kind: o.kind || 'entries', item: o, fields: [f('Titel', 5, o.title), f('Tags', 4, (o.tags || []).join(', ')), f('Beschreibung', 2, o.description)] };
}
const DOCS = [
  doc('e8', { title: 'Die EU hat 28 Mitgliedstaaten', tags: ['EU', 'Brexit'], description: 'Galt bis 2020.', status: 'veraltet' }),
  doc('e9', { title: 'Impfstoffe verursachen Autismus', tags: ['Gesundheit'], description: 'Studie zurückgezogen.', status: 'widerlegt' }),
  doc('a4', { kind: 'args', title: 'Sanktionen wirken nie', description: 'Es gibt Fälle mit teilweisem Erfolg.', status: 'teilweise' }),
  doc('e1', { title: 'Peer-Review', tags: ['Methodik'], description: 'Fachleute prüfen Manuskripte. Es gibt immer Fehler.', status: 'belegt' })
];
test('Abgleich: passende Einträge mit Stichwörtern; Abkürzung „EU“ zählt', () => {
  let m = A.matchText(DOCS, 'Die EU hat immer noch 28 Mitgliedstaaten.');
  assert(m.length && m[0].doc.id === 'e8' && m[0].matched.includes('EU') && m[0].matched.includes('Mitgliedstaaten'), JSON.stringify(m.map(x => [x.doc.id, x.matched])));
  m = A.matchText(DOCS, 'Experten sagen, Sanktion wirken nie.');
  assert(m[0].doc.id === 'a4' && m[0].matched.length === 2, JSON.stringify(m.map(x => [x.doc.id, x.matched])));
});
test('Abgleich: Regel- und Allerweltswörter allein ergeben keinen Treffer', () => {
  const m = A.matchText(DOCS, 'Es gibt immer Leute, die das sagen, und nie wird es besser.');
  assert(!m.some(x => x.doc.id === 'e1'), 'Peer-Review darf nicht über „gibt/immer“ passen: ' + JSON.stringify(m.map(x => [x.doc.id, x.matched])));
  assert(A.matchText(DOCS, 'Ich finde das lächerlich.').length === 0, 'Meinung ohne Inhalt');
});
test('Offene Fragen berücksichtigen den Prüfstatus der passenden Einträge', () => {
  const st = A.analyzeClaims('Die EU hat 28 Mitgliedstaaten.').statements[0];
  assert(A.openQuestions(st, [{ status: 'veraltet' }], s => s === 'veraltet' ? 'Veraltet' : s).includes('Passende Einträge sind nicht belegt (Veraltet).'), 'nicht belegt');
  assert(!A.openQuestions(st, [{ status: 'widerlegt' }]).some(q => q.startsWith('Passende Einträge')), 'widerlegt gilt als geprüft');
  assert(A.openQuestions(st, [])[0].startsWith('Kein passender Eintrag'), 'nichts gefunden');
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
