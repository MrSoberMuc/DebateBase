/* DebateBase – Optionale KI-Erweiterung, Stufe 1: Prompt mit Rückweg (Phase 4B)
 *
 * DebateBase sendet selbst NICHTS ins Internet. Diese Datei erzeugt nur einen
 * Text (Prompt), den du selbst kopierst und in eine KI deiner Wahl einfügst.
 * Der Prompt verlangt von der KI eine Antwort in einem festen Datenformat,
 * das DebateBase später wieder einlesen kann (Etappe 2 und 3).
 *
 * Datenminimierung: Es werden nur die ausgewählten Einträge, Karten und
 * Quellen übernommen, und von diesen nur Titel, Typ, Prüfstatus,
 * Kernaussage/Beschreibung bzw. Behauptung/Gegenargument und Quellenangaben.
 * Eigene Notizen und Schlussfolgerungen werden nie übernommen.
 */
(function (global) {
  'use strict';

  var FORMAT = 'ki-antwort';
  var FORMAT_VERSION = 1;
  var ENTRY_TYPES = ['fakt', 'statistik', 'studie', 'definition', 'behauptung', 'argument', 'gegenargument', 'meinung', 'frage'];
  var LINK_TYPES = ['unterstuetzt', 'widerspricht', 'ergaenzt', 'relativiert', 'basiert', 'zitiert'];
  var MAX_TEXT = 4000, MAX_FIELD = 500;

  function clip(t, n) { t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; }
  /* Anführungszeichen und Zeilenumbrüche in eingebetteten Texten entschärfen */
  function flat(t, n) { return clip(t, n || MAX_FIELD).replace(/"""/g, '“““'); }

  /* Haupttext: Zeilenumbrüche bleiben erhalten (wichtig bei Threads) */
  function mainText(t) {
    t = String(t == null ? '' : t).replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (t.length > MAX_TEXT) t = t.slice(0, MAX_TEXT - 1).trimEnd() + '…';
    return t.replace(/"""/g, '“““');
  }

  /* data = { entries:[{id,title,type,status,claimCore,description,sourceIds}],
              args:[{id,title,status,claim,counter,sourceIds}],
              sources:[{id,title,publisher,year,kind}] }
     opts = { task:'pruefen'|'antwort', text, style, typeLabel, statusLabel, sourceKinds:[...] } */
  function buildPrompt(data, opts) {
    opts = opts || {};
    var TL = opts.typeLabel || function (x) { return x; }, SL = opts.statusLabel || function (x) { return x; };
    var task = opts.task === 'antwort' ? 'antwort' : 'pruefen';
    var E = data.entries || [], A = data.args || [], S = data.sources || [];
    var text = mainText(opts.text);
    var L = [];
    L.push('Du hilfst mir bei einer Diskussion auf X (Twitter). Ich nutze die App „DebateBase“, meine persönliche Wissensdatenbank. Deine Antwort füge ich dort wieder ein; die App liest sie automatisch ein.');
    L.push('');
    L.push('## Aufgabe');
    if (task === 'pruefen') {
      L.push('Prüfe den Text unten. Zerlege ihn in einzelne Behauptungen, ordne jede ein und vergleiche sie mit meinen gespeicherten Einträgen. Schlage vor, was in meiner Datenbank fehlt: neue Wissenseinträge, Quellen, Argumentationskarten und Verknüpfungen zu meinen vorhandenen Einträgen.');
    } else {
      L.push('Formuliere eine Antwort auf den Text unten im Stil „' + (opts.style || 'Sachlich und neutral') + '“. Verwende für die Antwort ausschließlich meine gespeicherten Einträge und Quellen unten und erfinde keine Fakten. Setze hinter jede Aussage die Kennung des verwendeten Eintrags in eckigen Klammern, z. B. [e6]. Für X gilt: höchstens 280 Zeichen pro Beitrag; eine längere Antwort teilst du in nummerierte Beiträge (1/3, 2/3 …). Schlage zusätzlich vor, was in meiner Datenbank fehlt.');
    }
    L.push('');
    L.push('## Text');
    L.push('"""');
    L.push(text || '(kein Text angegeben)');
    L.push('"""');
    L.push('');
    L.push('## Meine gespeicherten Einträge');
    if (!E.length && !A.length) L.push('(keine ausgewählt)');
    E.forEach(function (e) {
      var parts = ['[' + e.id + '] ' + TL(e.type) + ' · Prüfstatus: ' + SL(e.status) + ' · ' + flat(e.title, 200)];
      if (e.claimCore) parts.push('Kernaussage: ' + flat(e.claimCore));
      if (e.description) parts.push('Beschreibung: ' + flat(e.description));
      if ((e.sourceIds || []).length) parts.push('Quellen: ' + e.sourceIds.join(', '));
      L.push('- ' + parts.join(' — '));
    });
    A.forEach(function (a) {
      var parts = ['[' + a.id + '] Argumentationskarte · Prüfstatus: ' + SL(a.status) + ' · ' + flat(a.title, 200)];
      if (a.claim) parts.push('Behauptung der Gegenseite: ' + flat(a.claim));
      if (a.counter) parts.push('Mein Gegenargument: ' + flat(a.counter));
      if ((a.sourceIds || []).length) parts.push('Quellen: ' + a.sourceIds.join(', '));
      L.push('- ' + parts.join(' — '));
    });
    L.push('');
    L.push('## Meine gespeicherten Quellen');
    if (!S.length) L.push('(keine)');
    S.forEach(function (s) { L.push('- [' + s.id + '] ' + flat(s.title, 200) + [s.publisher, s.year].filter(Boolean).map(function (x) { return ' — ' + flat(x, 120); }).join('') + (s.kind ? ' (' + s.kind + ')' : '')); });
    L.push('');
    L.push('## Regeln');
    L.push('1. Erfinde keine Quellen. Nenne eine neue Quelle nur, wenn du sicher bist, dass sie existiert, mit genauem Titel, Herausgeber und Jahr. Einen Link nur, wenn du dir sicher bist. Bist du unsicher, nenne keine Quelle, sondern lege einen Eintrag vom Typ "frage" an.');
    L.push('2. Meine vorhandenen Einträge, Karten und Quellen verweist du nur über ihre Kennung (z. B. "e6", "a2", "s4"). Ändern kannst du sie nicht.');
    L.push('3. Neue Einträge bekommen die Kennungen n1, n2 …, neue Quellen q1, q2 …, neue Argumentationskarten k1, k2 ….');
    L.push('4. Schreibe auf Deutsch. Titel höchstens 120 Zeichen. Kennzeichne Unsicherheit im Text (z. B. „laut …“, „umstritten“).');
    L.push('5. Lege nur an, was für die Diskussion wirklich nützlich ist, höchstens 8 neue Einträge.');
    L.push('');
    L.push('## Antwortformat (wichtig)');
    L.push('Antworte mit genau einem Codeblock im Format JSON. Kein Text davor oder danach. Felder, die du nicht füllen kannst, lässt du weg; leere Listen sind erlaubt.');
    L.push('```json');
    L.push(JSON.stringify(example(task), null, 2));
    L.push('```');
    L.push('Erlaubte Werte für "typ" bei Einträgen: ' + ENTRY_TYPES.join(', ') + '.');
    L.push('Erlaubte Werte für "art" bei Verknüpfungen: ' + LINK_TYPES.join(', ') + '. Lesart: "von" <art> "zu", z. B. n1 widerspricht e8.');
    if (opts.sourceKinds && opts.sourceKinds.length) L.push('Erlaubte Werte für "typ" bei Quellen: ' + opts.sourceKinds.join(', ') + '.');
    L.push('Erlaubte Werte für "bewertung" bei Behauptungen: gestützt, widerlegt, umstritten, unklar.');
    var prompt = L.join('\n');
    return { prompt: prompt, chars: prompt.length, counts: { entries: E.length, args: A.length, sources: S.length }, task: task };
  }

  function example(task) {
    var x = {
      debatebase: FORMAT,
      version: FORMAT_VERSION,
      aufgabe: task,
      zusammenfassung: 'Kurze Einschätzung in 2 bis 4 Sätzen',
      behauptungen: [{ text: 'Eine Behauptung aus dem Text', einordnung: 'überprüfbar', bewertung: 'unklar', belege: ['e6'] }],
      eintraege: [{ ref: 'n1', titel: 'Kurzer Titel', typ: 'fakt', kernaussage: 'Die Aussage in einem Satz', beschreibung: 'Erläuterung mit Einschränkungen', thema: 'Politik', tags: ['Beispiel'], quellen: ['q1'] }],
      quellen: [{ ref: 'q1', titel: 'Genauer Titel', herausgeber: 'Herausgeber', autor: 'Autor', jahr: '2024', typ: 'Studie', link: 'https://…', kernaussagen: 'Was die Quelle im Kern sagt' }],
      karten: [{ ref: 'k1', titel: 'Kurzer Titel', behauptung: 'Behauptung der Gegenseite', gegenargument: 'Gegenargument', thema: 'Politik', quellen: ['q1'] }],
      verknuepfungen: [{ von: 'n1', art: 'widerspricht', zu: 'e8', notiz: 'kurze Begründung' }]
    };
    if (task === 'antwort') x.antwort = 'Der Antworttext mit Kennungen wie [e6]';
    return x;
  }

  global.KI = {
    FORMAT: FORMAT,
    FORMAT_VERSION: FORMAT_VERSION,
    ENTRY_TYPES: ENTRY_TYPES,
    LINK_TYPES: LINK_TYPES,
    buildPrompt: buildPrompt
  };
})(typeof self !== 'undefined' ? self : this);
