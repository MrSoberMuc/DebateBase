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
    L.push('6. Eine Verknüpfung zu einer Argumentationskarte bezieht sich immer auf mein Gegenargument (meine Position): "unterstuetzt" = stützt das Gegenargument, "widerspricht" = spricht gegen das Gegenargument und damit für die Behauptung der Gegenseite.');
    L.push('7. Quellen können nicht verknüpft werden; nenne sie im Feld "quellen" eines Eintrags oder einer Karte.');
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

  /* =====================================================================
   * Etappe 2: KI-Antwort einlesen und prüfen
   * parseAnswer(text)        findet den Datenblock und liest ihn ein
   * buildPlan(data, ctx)     prüft alles, löst Kennungen auf, findet Dubletten
   * defaultChoice(plan)      Vorauswahl (Dubletten nicht neu anlegen)
   * finalize(plan, choice)   was nach der Auswahl tatsächlich angelegt würde
   * Nichts hiervon speichert etwas.
   * ===================================================================== */
  var FLIPPABLE = { unterstuetzt: 'widerspricht', widerspricht: 'unterstuetzt' };
  var LIMITS = { entries: 20, sources: 20, cards: 10, links: 40, tags: 10 };

  /* Zählt offene Klammern außerhalb von Zeichenketten: > 0 heißt „abgeschnitten“ */
  function openBraces(t) {
    var depth = 0, inStr = false, esc = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') depth--;
    }
    return depth;
  }
  function lineOf(text, pos) { return text.slice(0, pos).split('\n').length; }
  function parseAnswer(text) {
    var raw = String(text == null ? '' : text).replace(/^﻿/, '');
    if (!raw.trim()) return { ok: false, error: 'Es wurde nichts eingefügt.' };
    var fence = /```(?:json|JSON)?[ \t]*\n?([\s\S]*?)```/.exec(raw);
    var body = fence ? fence[1] : raw;
    var a = body.indexOf('{'), b = body.lastIndexOf('}');
    if (a < 0) return { ok: false, error: 'Kein Datenblock gefunden. Die Antwort der KI muss einen Block enthalten, der mit { beginnt.' };
    if (b < a) return { ok: false, error: 'Der Datenblock ist unvollständig: Die schließende Klammer } fehlt. Wahrscheinlich wurde die Antwort nicht ganz kopiert.' };
    var js = body.slice(a, b + 1), notes = [];
    if (fence === null && (body.slice(0, a).trim() || body.slice(b + 1).trim())) notes.push('Text vor oder nach dem Datenblock wurde ignoriert.');
    var data = null, err = null;
    try { data = JSON.parse(js); } catch (e) { err = e; }
    if (!data) {
      /* kleine Reparaturen: typografische Anführungszeichen als Feldbegrenzer, Komma vor } oder ] */
      var fixed = js.replace(/,\s*([}\]])/g, '$1').replace(/([{,]\s*)[“”„]([^“”„"]+)[“”„](\s*:)/g, '$1"$2"$3');
      try { data = JSON.parse(fixed); notes.push('Kleine Formatfehler der KI wurden automatisch korrigiert.'); } catch (e2) { /* bleibt Fehler */ }
    }
    if (!data) {
      var m = /position (\d+)/.exec(err && err.message || ''), where = m ? ' (etwa Zeile ' + lineOf(js, +m[1]) + ')' : '';
      var cut = /end of (JSON )?input|Unterminated/i.test(err && err.message || '') || openBraces(body.slice(a)) > 0;
      return { ok: false, error: cut ? 'Der Datenblock ist abgeschnitten' + where + '. Bitte die Antwort vollständig kopieren.' : 'Der Datenblock ist kein gültiges JSON' + where + '. Bitte die KI, die Antwort im vorgegebenen Format zu wiederholen.' };
    }
    if (typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'Der Datenblock hat nicht das erwartete Format.' };
    if (data.debatebase !== FORMAT) notes.push('Die Kennung "debatebase": "ki-antwort" fehlt. Der Block wird trotzdem eingelesen.');
    if (data.version && data.version > FORMAT_VERSION) notes.push('Der Block hat eine neuere Formatversion (' + data.version + '). Unbekannte Felder werden ignoriert.');
    return { ok: true, data: data, notes: notes };
  }

  function norm(t) {
    return String(t == null ? '' : t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function wordSet(t) { var s = {}; norm(t).split(' ').forEach(function (w) { if (w.length >= 3) s[w] = 1; }); return s; }
  function jaccard(a, b) { var A = wordSet(a), B = wordSet(b), i = 0, u = 0, k; for (k in A) { u++; if (B[k]) i++; } for (k in B) if (!A[k]) u++; return u ? i / u : 0; }
  function similarTitle(a, b) { var na = norm(a), nb = norm(b); return !!na && (na === nb || jaccard(a, b) >= 0.8); }
  function normUrl(u) { return String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[#?].*$/, '').replace(/\/+$/, ''); }
  function str(v, max) { return typeof v === 'string' || typeof v === 'number' ? clip(String(v), max || 5000) : ''; }
  function list(v) { return Array.isArray(v) ? v : []; }

  /* ctx = { entries, args, sources (vorhandene Datensätze), sourceKinds, typeLabel } */
  function buildPlan(data, ctx) {
    ctx = ctx || {};
    var W = [], ex = { entries: {}, args: {}, sources: {} };
    (ctx.entries || []).forEach(function (o) { ex.entries[o.id] = o; });
    (ctx.args || []).forEach(function (o) { ex.args[o.id] = o; });
    (ctx.sources || []).forEach(function (o) { ex.sources[o.id] = o; });
    var kinds = ctx.sourceKinds || [], refs = {}, plan = { task: str(data.aufgabe, 20), summary: str(data.zusammenfassung, 3000), answer: str(data.antwort, 6000), claims: [], entries: [], sources: [], cards: [], links: [], warnings: W };
    var take = function (arr, max, label) { arr = list(arr); if (arr.length > max) { W.push(arr.length + ' ' + label + ' geliefert, nur die ersten ' + max + ' werden berücksichtigt.'); arr = arr.slice(0, max); } return arr; };
    var refOk = function (r, prefix, label, i) {
      r = str(r, 40).trim();
      if (!r) { r = prefix + '_' + (i + 1); W.push(label + ' ' + (i + 1) + ' hatte keine Kennung; vergeben: ' + r + '.'); }
      if (refs[r] || ex.entries[r] || ex.args[r] || ex.sources[r]) { W.push('Kennung „' + r + '“ ist doppelt; ' + label + ' ' + (i + 1) + ' wird übersprungen.'); return null; }
      return r;
    };

    list(data.behauptungen).slice(0, 30).forEach(function (c) { if (c && str(c.text)) plan.claims.push({ text: str(c.text, 1000), einordnung: str(c.einordnung, 200), bewertung: str(c.bewertung, 60), belege: list(c.belege).map(function (x) { return str(x, 40); }).filter(Boolean) }); });

    take(data.quellen, LIMITS.sources, 'Quellen').forEach(function (q, i) {
      if (!q || typeof q !== 'object') return;
      var title = str(q.titel, 300);
      if (!title) { W.push('Quelle ' + (i + 1) + ' hat keinen Titel und wird übersprungen.'); return; }
      var r = refOk(q.ref, 'q', 'Quelle', i); if (!r) return;
      var url = str(q.link, 500).trim();
      if (url && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) { W.push('Quelle „' + clip(title, 60) + '“: Link „' + clip(url, 40) + '“ ist ungültig und wird weggelassen.'); url = ''; }
      var year = str(q.jahr, 30).trim(); if (year && !/^\d{4}$/.test(year)) { W.push('Quelle „' + clip(title, 60) + '“: Jahr „' + year + '“ ist ungültig und wird weggelassen.'); year = ''; }
      var kind = str(q.typ, 60).trim(); if (kinds.length && kinds.indexOf(kind) < 0) { if (kind) W.push('Quelle „' + clip(title, 60) + '“: Typ „' + kind + '“ ist unbekannt, verwendet wird „Sonstiges“.'); kind = 'Sonstiges'; }
      var dup = null;
      Object.keys(ex.sources).some(function (id) { var s = ex.sources[id];
        if (url && s.url && normUrl(url) === normUrl(s.url)) { dup = { id: id, title: s.title, why: 'gleicher Link' }; return true; }
        if (similarTitle(title, s.title)) { dup = { id: id, title: s.title, why: 'gleicher oder sehr ähnlicher Titel' }; return true; } return false; });
      refs[r] = { kind: 'sources', isNew: true };
      plan.sources.push({ ref: r, title: title, publisher: str(q.herausgeber, 300), author: str(q.autor, 300), year: year, kind: kind || 'Sonstiges', url: url, keyClaims: str(q.kernaussagen), dup: dup });
    });

    var srcRefs = function (arr, owner) {
      return list(arr).map(function (x) { return str(x, 40).trim(); }).filter(function (x) {
        if (!x) return false;
        if (ex.sources[x] || (refs[x] && refs[x].kind === 'sources')) return true;
        W.push(owner + ': Quelle „' + x + '“ ist unbekannt und wird weggelassen.'); return false;
      }).filter(function (x, i, a) { return a.indexOf(x) === i; });
    };
    var dupEntry = function (title) { var d = null; Object.keys(ex.entries).some(function (id) { if (similarTitle(title, ex.entries[id].title)) { d = { id: id, title: ex.entries[id].title }; return true; } return false; }); return d; };

    take(data.eintraege, LIMITS.entries, 'Einträge').forEach(function (e, i) {
      if (!e || typeof e !== 'object') return;
      var title = str(e.titel, 200);
      if (!title) { W.push('Eintrag ' + (i + 1) + ' hat keinen Titel und wird übersprungen.'); return; }
      var r = refOk(e.ref, 'n', 'Eintrag', i); if (!r) return;
      var type = str(e.typ, 40).trim().toLowerCase();
      if (ENTRY_TYPES.indexOf(type) < 0) { W.push('Eintrag „' + clip(title, 60) + '“: Typ „' + type + '“ ist unbekannt, verwendet wird „behauptung“.'); type = 'behauptung'; }
      var tags = list(e.tags).map(function (t) { return str(t, 60).replace(/^#/, '').trim(); }).filter(Boolean).filter(function (t, j, a) { return a.map(norm).indexOf(norm(t)) === j; });
      if (tags.length > LIMITS.tags) { W.push('Eintrag „' + clip(title, 60) + '“: ' + tags.length + ' Tags, nur die ersten ' + LIMITS.tags + ' werden übernommen.'); tags = tags.slice(0, LIMITS.tags); }
      refs[r] = { kind: 'entries', isNew: true };
      plan.entries.push({ ref: r, title: title, type: type, claimCore: str(e.kernaussage, 1000), description: str(e.beschreibung), topic: str(e.thema, 120), tags: tags, sources: srcRefs(e.quellen, 'Eintrag „' + clip(title, 40) + '“'), dup: dupEntry(title) });
    });

    take(data.karten, LIMITS.cards, 'Karten').forEach(function (k, i) {
      if (!k || typeof k !== 'object') return;
      var title = str(k.titel, 200);
      if (!title) { W.push('Karte ' + (i + 1) + ' hat keinen Titel und wird übersprungen.'); return; }
      var r = refOk(k.ref, 'k', 'Karte', i); if (!r) return;
      var dup = null; Object.keys(ex.args).some(function (id) { if (similarTitle(title, ex.args[id].title) || (k.behauptung && similarTitle(k.behauptung, ex.args[id].claim))) { dup = { id: id, title: ex.args[id].title }; return true; } return false; });
      refs[r] = { kind: 'args', isNew: true };
      plan.cards.push({ ref: r, title: title, claim: str(k.behauptung, 3000), counter: str(k.gegenargument), topic: str(k.thema, 120), sources: srcRefs(k.quellen, 'Karte „' + clip(title, 40) + '“'), dup: dup });
    });

    var seen = {};
    take(data.verknuepfungen, LIMITS.links, 'Verknüpfungen').forEach(function (l, i) {
      if (!l || typeof l !== 'object') return;
      var from = str(l.von, 40).trim(), to = str(l.zu, 40).trim(), type = str(l.art, 40).trim().toLowerCase().replace('ü', 'ue').replace('unterstützt', 'unterstuetzt');
      var end = function (x) { if (ex.entries[x]) return { kind: 'entries', id: x, isNew: false }; if (ex.args[x]) return { kind: 'args', id: x, isNew: false }; if (refs[x] && refs[x].kind !== 'sources') return { kind: refs[x].kind, id: x, isNew: true }; return null; };
      var F = end(from), T = end(to);
      if (LINK_TYPES.indexOf(type) < 0) { W.push('Verknüpfung ' + (i + 1) + ': Art „' + type + '“ ist unbekannt und wird übersprungen.'); return; }
      if (!F || !T) { W.push('Verknüpfung ' + (i + 1) + ' (' + from + ' → ' + to + '): ' + ((refs[from] && refs[from].kind === 'sources') || (refs[to] && refs[to].kind === 'sources') || ex.sources[from] || ex.sources[to] ? 'Quellen können nicht verknüpft werden, nur Einträge und Karten' : 'unbekannte Kennung') + '; wird übersprungen.'); return; }
      if (from === to) { W.push('Verknüpfung ' + (i + 1) + ' verbindet einen Eintrag mit sich selbst und wird übersprungen.'); return; }
      var key = from + '|' + type + '|' + to; if (seen[key]) return; seen[key] = 1;
      plan.links.push({ i: plan.links.length, from: F, to: T, type: type, note: str(l.notiz, 300) });
    });
    if (!plan.entries.length && !plan.sources.length && !plan.cards.length && !plan.links.length) W.push('Die Antwort enthält nichts, was angelegt werden könnte.');
    return plan;
  }

  /* Vorauswahl: Dubletten werden nicht neu angelegt; doppelte Quellen werden mit der vorhandenen verknüpft */
  function defaultChoice(plan) {
    var c = { entries: {}, sources: {}, cards: {}, links: {}, flip: {}, rev: {} };
    plan.entries.forEach(function (e) { c.entries[e.ref] = !e.dup; });
    plan.sources.forEach(function (s) { c.sources[s.ref] = s.dup ? 'existing' : 'new'; });
    plan.cards.forEach(function (k) { c.cards[k.ref] = !k.dup; });
    plan.links.forEach(function (l) { c.links[l.i] = true; });
    return c;
  }

  /* Ergebnis nach Auswahl. Quellenverweise zeigen auf vorhandene Kennungen oder neue Quellen.
     Verknüpfungen fallen weg, wenn ein Ende nicht angelegt wird (mit Begründung). */
  function finalize(plan, choice) {
    var srcTarget = {}, out = { entries: [], sources: [], cards: [], links: [], droppedLinks: [] };
    plan.sources.forEach(function (s) {
      var ch = choice.sources[s.ref];
      if (ch === 'new') { out.sources.push(s); srcTarget[s.ref] = { isNew: true, ref: s.ref }; }
      else if (ch === 'existing' && s.dup) srcTarget[s.ref] = { isNew: false, id: s.dup.id };
    });
    var newRefs = {}; plan.sources.forEach(function (s) { newRefs[s.ref] = 1; });
    /* Neue Quelle → nach Auswahl neu oder vorhandene; sonst ist es bereits eine vorhandene Kennung */
    var mapSrc = function (arr) {
      var seen = {}, res = [];
      arr.forEach(function (r) { var t = newRefs[r] ? srcTarget[r] : { isNew: false, id: r }; if (!t) return; var k = t.isNew ? 'n:' + t.ref : 'e:' + t.id; if (!seen[k]) { seen[k] = 1; res.push(t); } });
      return res;
    };
    plan.entries.forEach(function (e) { if (choice.entries[e.ref]) out.entries.push(Object.assign({}, e, { sourceTargets: mapSrc(e.sources) })); });
    plan.cards.forEach(function (k) { if (choice.cards[k.ref]) out.cards.push(Object.assign({}, k, { sourceTargets: mapSrc(k.sources) })); });
    var alive = function (end) { if (!end.isNew) return true; return end.kind === 'entries' ? !!choice.entries[end.id] : !!choice.cards[end.id]; };
    plan.links.forEach(function (l) {
      if (!choice.links[l.i]) return;
      if (!alive(l.from) || !alive(l.to)) { out.droppedLinks.push(l); return; }
      /* Umdeuten: Die KI meinte die Behauptung der Gegenseite → Unterstützt/Widerspricht tauschen */
      var x = l;
      if (choice.flip && choice.flip[l.i] && FLIPPABLE[l.type]) x = Object.assign({}, x, { type: FLIPPABLE[l.type], flipped: true });
      /* Richtung umdrehen: die KI hat „von“ und „zu“ vertauscht */
      if (choice.rev && choice.rev[l.i]) x = Object.assign({}, x, { from: l.to, to: l.from, reversed: true });
      out.links.push(x);
    });
    return out;
  }

  /* =====================================================================
   * Etappe 3: Aus der Auswahl fertige Datensätze für DebateBase erzeugen.
   * Alles bekommt Prüfstatus „neu“ und die Herkunft origin = { kind:'ki' }.
   * Es entstehen nur NEUE Datensätze; vorhandene werden nie verändert.
   * opts = { now, uid(prefix), task, existingLinks:[{type,fromK,fromId,toK,toId}] }
   * ===================================================================== */
  function toRecords(F, opts) {
    var now = opts.now || Date.now(), uid = opts.uid, map = {}, origin = function (ref) { return { kind: 'ki', at: now, task: opts.task || '', ref: ref }; };
    var out = { entries: [], sources: [], args: [], links: [], skippedLinks: 0 };
    F.sources.forEach(function (s) { map['s:' + s.ref] = uid('s'); });
    F.entries.forEach(function (e) { map['e:' + e.ref] = uid('e'); });
    F.cards.forEach(function (k) { map['a:' + k.ref] = uid('a'); });
    var srcIds = function (targets) { return (targets || []).map(function (t) { return t.isNew ? map['s:' + t.ref] : t.id; }).filter(Boolean); };
    var endId = function (end) { return end.isNew ? map[(end.kind === 'args' ? 'a:' : 'e:') + end.id] : end.id; };
    F.sources.forEach(function (s) {
      out.sources.push({ id: map['s:' + s.ref], title: s.title, publisher: s.publisher || '', author: s.author || '', year: s.year || '', date: '', kind: s.kind || 'Sonstiges', url: s.url || '', note: '',
        method: '', keyClaims: s.keyClaims || '', limitations: '', coi: '', conflicts: '', created: now, origin: origin(s.ref) });
    });
    F.entries.forEach(function (e) {
      out.entries.push({ id: map['e:' + e.ref], title: e.title, description: e.description || '', type: e.type, status: 'neu', topic: e.topic || '', tags: (e.tags || []).slice(), sourceIds: srcIds(e.sourceTargets), postId: '',
        claimCore: e.claimCore || '', reason: '', evidence: '', limits: '', conclusion: '', created: now, updated: now, origin: origin(e.ref) });
    });
    F.cards.forEach(function (k) {
      out.args.push({ id: map['a:' + k.ref], title: k.title, claim: k.claim || '', counter: k.counter || '', topic: k.topic || '', status: 'neu', sourceIds: srcIds(k.sourceTargets), created: now, origin: origin(k.ref) });
    });
    var have = {};
    (opts.existingLinks || []).forEach(function (l) { have[l.type + '|' + l.fromK + ':' + l.fromId + '|' + l.toK + ':' + l.toId] = 1; });
    F.links.forEach(function (l) {
      var fid = endId(l.from), tid = endId(l.to);
      if (!fid || !tid) { out.skippedLinks++; return; }
      var key = l.type + '|' + l.from.kind + ':' + fid + '|' + l.to.kind + ':' + tid;
      if (have[key]) { out.skippedLinks++; return; }
      have[key] = 1;
      out.links.push({ id: uid('l'), type: l.type, fromK: l.from.kind, fromId: fid, toK: l.to.kind, toId: tid, note: l.note || '', created: now, origin: origin('') });
    });
    return out;
  }

  global.KI = {
    FORMAT: FORMAT,
    FORMAT_VERSION: FORMAT_VERSION,
    ENTRY_TYPES: ENTRY_TYPES,
    LINK_TYPES: LINK_TYPES,
    buildPrompt: buildPrompt,
    parseAnswer: parseAnswer,
    buildPlan: buildPlan,
    defaultChoice: defaultChoice,
    finalize: finalize,
    LIMITS: LIMITS,
    FLIPPABLE: FLIPPABLE,
    toRecords: toRecords
  };
})(typeof self !== 'undefined' ? self : this);
