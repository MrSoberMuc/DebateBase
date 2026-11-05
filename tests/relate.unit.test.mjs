/* Unit-Tests der Zusammenhangs- und Widerspruchsanalyse (ohne Browser).
 * Aufruf: node tests/relate.unit.test.mjs   (Phase 4, Etappe 4) */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../analyse.js').Analyse;

let failed = 0, n = 0;
function test(name, fn) { n++; try { fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FEHL', name, '→', e.message); } }
function assert(c, m) { if (!c) throw new Error(m || 'Annahme verletzt'); }

const E = (id, title, type, status, o = {}) => ({ id, title, type, status, tags: [], sourceIds: [], description: '', claimCore: '', ...o });
const DATA = {
  entries: [
    E('e8', 'Die EU hat 28 Mitgliedstaaten', 'behauptung', 'veraltet', { sourceIds: ['s8'], description: 'Galt bis 2020. Seitdem 27.' }),
    E('e13', 'Die EU hat seit 2020 27 Mitgliedstaaten', 'fakt', 'belegt', { sourceIds: ['s8'] }),
    E('e9', 'Impfstoffe verursachen Autismus', 'behauptung', 'widerlegt', { sourceIds: ['s6'], description: 'Die Studie wurde zurückgezogen.' }),
    E('e2', 'Gründung der Vereinten Nationen', 'fakt', 'belegt', { sourceIds: ['s1'], description: 'Die UN-Charta trat am 24. Oktober 1945 in Kraft. 51 Gründungsmitglieder, heute 193 Mitgliedstaaten.' }),
    E('e6', 'Wissenschaftlicher Konsens zum Klimawandel', 'studie', 'belegt', { sourceIds: ['s4'] }),
    E('e4', 'Beinahe-Eskalationen im Kalten Krieg', 'gegenargument', 'belegt', { description: 'Kubakrise 1962 und Fehlalarm 1983.' }),
    E('e3', 'Gab es 1990 ein NATO-Versprechen zur Nichterweiterung?', 'behauptung', 'umstritten', { claimCore: 'Die NATO hat 1990 versprochen, sich nicht nach Osten zu erweitern.' }),
    E('e20', 'Sanktionen gegen Russland sind wirkungslos', 'behauptung', 'neu')
  ],
  args: [
    { id: 'a1', title: 'Abschreckung verhindert Großmachtkriege', claim: 'Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.', counter: 'Der Zusammenhang ist nicht beweisbar; es gab Beinahe-Katastrophen.', status: 'umstritten', sourceIds: [] },
    { id: 'a2', title: 'Der Klimawandel ist rein natürlich', claim: 'Das Klima hat sich schon immer verändert, also ist die heutige Erwärmung natürlich.', counter: 'Messungen zeigen, dass menschliche CO2-Emissionen die Ursache sind.', status: 'belegt', sourceIds: ['s4'] }
  ],
  links: [
    { id: 'l1', type: 'relativiert', fromK: 'entries', fromId: 'e4', toK: 'args', toId: 'a1' },
    { id: 'l2', type: 'unterstuetzt', fromK: 'entries', fromId: 'e6', toK: 'args', toId: 'a2' },
    { id: 'l3', type: 'widerspricht', fromK: 'entries', fromId: 'e13', toK: 'entries', toId: 'e8' }
  ],
  sources: [
    { id: 's1', title: 'Charta der Vereinten Nationen', keyClaims: '' },
    { id: 's4', title: 'Cook et al. 2013', keyClaims: 'Konsens zum menschengemachten Klimawandel' },
    { id: 's6', title: 'Retraction of Wakefield et al.', keyClaims: '' },
    { id: 's8', title: 'Länder der EU', keyClaims: '' }
  ]
};
const LT = { unterstuetzt: ['Unterstützt'], widerspricht: ['Widerspricht'], ergaenzt: ['Ergänzt'], relativiert: ['Relativiert'], basiert: ['Basiert auf'], zitiert: ['Zitiert'] };
const SL = { veraltet: 'Veraltet', widerlegt: 'Widerlegt', belegt: 'Belegt', umstritten: 'Umstritten', neu: 'Neu', teilweise: 'Teilweise belegt', pruefung: 'In Prüfung' };
const rel = t => A.relate(t, DATA, { ltypes: LT, statusLabel: s => SL[s] || s, typeLabel: t => t });
const where = (r, id) => { for (const k of A.REL_ORDER) { const x = r.groups[k].find(y => y.id === id); if (x) return { rel: k, x }; } return null; };

test('Veralteter gleichartiger Eintrag → Widerspruchskandidat, mit Grundlage und Quelle', () => {
  const r = rel('Die EU hat 28 Mitgliedstaaten.');
  const w = where(r, 'e8');
  assert(w && w.rel === 'widersprechend' && w.x.basis[0].includes('„Veraltet“'), JSON.stringify(w));
  assert(where(r, 'e13').rel === 'widersprechend', 'belegter Eintrag mit anderer Zahl');
  assert(r.sources.some(s => s.id === 's8' && s.basis[0].startsWith('genannt in')), 'verwandte Quelle');
});
test('Abweichende Zahl gegen veralteten Eintrag → eher Bestätigung; direkter Vergleich schlägt Verknüpfung', () => {
  const r = rel('Die EU hat 27 Mitgliedstaaten.');
  const w = where(r, 'e8');
  assert(w.rel === 'unterstuetzend' && w.x.basis[0].includes('Zahl weicht ab (27 ↔ 28)'), JSON.stringify(w));
  assert(w.x.basis.some(b => b.startsWith('über Verknüpfung')), 'Verknüpfung als zusätzliche Grundlage');
  assert(where(r, 'e13').rel === 'unterstuetzend', 'e13');
});
test('Widerlegter Eintrag: Behauptung → Widerspruch; verneinte Behauptung → Unterstützung', () => {
  assert(where(rel('Impfstoffe verursachen Autismus!'), 'e9').rel === 'widersprechend', 'gleiche Aussage');
  const w = where(rel('Impfstoffe verursachen keinen Autismus.'), 'e9');
  assert(w.rel === 'unterstuetzend' && w.x.basis[0].includes('Verneinung nur auf einer Seite'), JSON.stringify(w));
});
test('Abweichende Zahl gegenüber belegtem Fakt (aus der Beschreibung) → Widerspruchskandidat', () => {
  const w = where(rel('Die UNO hat 200 Mitgliedstaaten.'), 'e2');
  assert(w && w.rel === 'widersprechend' && w.x.basis[0].startsWith('Zahl weicht ab (200'), JSON.stringify(w));
  const ok = where(rel('Die UN-Charta trat 1945 in Kraft.'), 'e2');
  assert(ok && ok.rel === 'unterstuetzend', JSON.stringify(ok));
});
test('Argumentationskarte: Aussage gleicht der Gegenseite → Widerspruch über das Gegenargument; Verknüpfungen der Karte', () => {
  const r = rel('Das Klima hat sich schon immer verändert, die heutige Erwärmung ist natürlich.');
  const k = where(r, 'a2');
  assert(k.rel === 'widersprechend' && k.x.basis[0].includes('„Behauptung der Gegenseite“'), JSON.stringify(k));
  const e6 = where(r, 'e6');
  assert(e6.rel === 'widersprechend' && e6.x.basis[0].includes('unterstützt die Karte') && e6.x.basis[0].includes('Gegenargument'), JSON.stringify(e6));
  const r2 = rel('Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.');
  assert(where(r2, 'a1').rel === 'widersprechend' && where(r2, 'e4').rel === 'relativierend', 'Relativiert über Verknüpfung');
});
test('Aussage gleicht dem Gegenargument einer Karte → unterstützend', () => {
  const w = where(rel('Messungen zeigen, dass menschliche CO2-Emissionen die Ursache sind.'), 'a2');
  assert(w && w.rel === 'unterstuetzend' && w.x.basis[0].startsWith('gleicht dem Gegenargument'), JSON.stringify(w));
});
test('Umstritten → relativierend; ungeprüft → nur verwandt', () => {
  assert(where(rel('Die NATO hat 1990 versprochen, sich nicht nach Osten zu erweitern.'), 'e3').rel === 'relativierend', 'umstritten');
  const w = where(rel('Sanktionen gegen Russland sind wirkungslos.'), 'e20');
  assert(w.rel === 'thematisch' && w.x.basis[0].includes('noch nicht geprüft'), JSON.stringify(w));
});
test('Echter Widerspruch vs. nur thematisch verwandt', () => {
  const r = rel('Der Kalte Krieg war eine spannende Zeit.');
  const w = where(r, 'e4');
  assert(w && w.rel === 'thematisch' && w.x.basis[0].includes('kein Widerspruch oder Beleg erkennbar'), JSON.stringify(w));
  assert(r.groups.widersprechend.length === 0 && r.groups.unterstuetzend.length === 0, 'kein Widerspruch aus bloßer Themennähe');
});
test('Jedes Ergebnis nennt seine Grundlage und verweist auf gespeicherte Datensätze', () => {
  const ids = { entries: new Set(DATA.entries.map(e => e.id)), args: new Set(DATA.args.map(a => a.id)) };
  for (const t of ['Die EU hat 28 Mitgliedstaaten.', 'Impfstoffe verursachen Autismus.', 'Der Klimawandel ist rein natürlich.', 'Atomwaffen verhindern Kriege zwischen Großmächten.']) {
    const r = rel(t);
    for (const k of A.REL_ORDER) for (const x of r.groups[k]) { assert(x.basis.length && x.basis.every(b => b.length > 10), t + ': Grundlage fehlt'); assert(ids[x.kind].has(x.id), 'unbekannter Datensatz'); }
    r.sources.forEach(s => assert(s.basis.length, 'Quelle ohne Grundlage'));
  }
});
test('Keine Treffer → leere Gruppen; Daten bleiben unverändert', () => {
  const before = JSON.stringify(DATA);
  const r = rel('Mein Hund mag Spaziergänge im Regen.');
  assert(A.REL_ORDER.every(k => !r.groups[k].length) && !r.sources.length, 'leer');
  rel('Die EU hat 27 Mitgliedstaaten.'); rel('Impfstoffe verursachen keinen Autismus.');
  assert(JSON.stringify(DATA) === before, 'Daten verändert');
});
test('Zahlen erkennen: Tausenderpunkt, Komma, mehrere Zahlen', () => {
  assert(JSON.stringify(A.numbers('Rund 3.000 Studien, 97,1 % und 28 Staaten')) === '[3000,97.1,28]', JSON.stringify(A.numbers('Rund 3.000 Studien, 97,1 % und 28 Staaten')));
});

console.log(`\n${n - failed} von ${n} Tests bestanden.`);
process.exit(failed ? 1 : 0);
