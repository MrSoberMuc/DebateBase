/* DebateBase – Lokale Analyse (Phase 4)
 *
 * Diese Datei enthält nur Rechenregeln, keine Bildschirmteile und keine
 * Speicherzugriffe. Sie verändert keine Daten.
 *
 * WICHTIG: Hier arbeitet KEINE künstliche Intelligenz. Alles beruht auf festen
 * Regeln: Wörter vergleichen, Wortendungen kürzen, eine Liste verwandter
 * Begriffe, kleine Tippfehler erkennen und Punkte vergeben. Die App versteht
 * die Bedeutung eines Textes nicht.
 *
 * Inhalt:
 *   normalize / words / stem     Text in vergleichbare Wörter zerlegen
 *   SYNONYMS                     eingebaute Liste verwandter Begriffe
 *   search(docs, query, opts)    Suche mit Punkten und Begründung
 *   related(target, docs, opts)  verwandte Inhalte mit Begründung
 *   analyzeClaims(text)          Text in Aussagen zerlegen und nach Regeln einordnen
 *   matchText(docs, text, opts)  passende gespeicherte Einträge zu einer Aussage
 *   openQuestions(...)           offene Fragen zu einer Aussage
 */
(function (global) {
  'use strict';

  /* ---------- Text vergleichbar machen ---------- */

  /* Kleinschreibung; ä→ae, ö→oe, ü→ue, ß→ss; Akzente entfernen.
     So gelten „Erderwärmung“ und „Erderwaermung“ als gleich. */
  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* Zerlegt Text in Wörter. Liefert Originalform und vergleichbare Form. */
  var SPLIT = /[^\p{L}\p{N}]+/u;
  function words(s) {
    var out = [];
    String(s == null ? '' : s).split(SPLIT).forEach(function (raw) {
      if (!raw) return;
      var n = normalize(raw);
      if (n) out.push({ raw: raw, norm: n });
    });
    return out;
  }
  /* Vergleichbarer Text mit einfachen Leerzeichen, für Wortfolgen */
  function flat(s) { return words(s).map(function (w) { return w.norm; }).join(' '); }

  /* Füllwörter, die bei der Suche keine Rolle spielen.
     „nicht“ und „kein“ fehlen absichtlich: Sie ändern die Aussage. */
  var STOP = {};
  ('der die das den dem des ein eine einer eines einem einen und oder aber sowie in im ins an am auf aus bei mit nach von vom zu zum zur fuer ueber unter vor um durch gegen ohne bis seit ' +
   'ist sind war waren wird werden wurde wurden sein hat haben hatte hatten es er sie wir ihr ich du man sich als auch so wie wenn dass da dann doch noch nur schon sehr mehr dieser diese dieses ' +
   'jener jene welche welcher welches was wer wo the of and a an to in is are on for').split(' ').forEach(function (w) { STOP[w] = 1; });
  function isStop(n) { return !!STOP[n]; }

  /* Einfache Wortstamm-Regel für Deutsch: häufige Endungen abschneiden.
     „Sanktionen“, „Sanktion“ → „sanktion“; „Staaten“, „Staates“ → „staat“.
     Das ist eine Näherung und liegt manchmal daneben. */
  var SUFFIXES = ['ern', 'em', 'en', 'er', 'es', 'e'];
  function stem(n) {
    if (/^\d/.test(n)) return n;
    for (var i = 0; i < SUFFIXES.length; i++) {
      var s = SUFFIXES[i];
      if (n.length - s.length >= 4 && n.slice(-s.length) === s) return n.slice(0, -s.length);
    }
    /* Plural-s nur nach Vokal („Autos“), nicht bei „Konsens“ oder „Prozess“ */
    if (n.length >= 5 && /[aeiouy]s$/.test(n)) return n.slice(0, -1);
    return n;
  }

  /* Tippfehler: höchstens ein Zeichen anders, fehlend, zu viel oder vertauscht */
  function near(a, b) {
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0;
    while (i < la && i < lb && a[i] === b[i]) i++;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;                       /* ersetzt */
      return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); /* vertauscht */
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); /* fehlt / zu viel */
  }

  /* ---------- Verwandte Begriffe ---------- */
  /* Allgemeine Gruppen gleichbedeutender oder sehr eng verwandter Begriffe.
     Eigene Gruppen legst du in den Optionen an. */
  var SYNONYMS = [
    ['UNO', 'UN', 'Vereinte Nationen'],
    ['EU', 'Europäische Union'],
    ['NATO', 'Nordatlantikpakt', 'Nordatlantikvertrag'],
    ['USA', 'Vereinigte Staaten', 'Amerika'],
    ['Großbritannien', 'Vereinigtes Königreich', 'Britannien', 'UK'],
    ['BRD', 'Bundesrepublik Deutschland'],
    ['DDR', 'Deutsche Demokratische Republik'],
    ['UdSSR', 'Sowjetunion'],
    ['Russland', 'Russische Föderation'],
    ['Kalter Krieg', 'Ost-West-Konflikt'],
    ['Klimawandel', 'Erderwärmung', 'globale Erwärmung', 'Klimakrise'],
    ['CO2', 'Kohlendioxid', 'Kohlenstoffdioxid'],
    ['Atomwaffen', 'Kernwaffen', 'Nuklearwaffen'],
    ['Atomkraft', 'Kernkraft', 'Kernenergie', 'Atomenergie'],
    ['erneuerbare Energien', 'regenerative Energien', 'Ökostrom'],
    ['Impfung', 'Impfstoff', 'Vakzin', 'Schutzimpfung'],
    ['Covid', 'Corona', 'Covid-19', 'SARS-CoV-2'],
    ['WHO', 'Weltgesundheitsorganisation'],
    ['EZB', 'Europäische Zentralbank'],
    ['BIP', 'Bruttoinlandsprodukt'],
    ['Inflation', 'Teuerung', 'Geldentwertung'],
    ['Arbeitslosigkeit', 'Erwerbslosigkeit'],
    ['Migration', 'Einwanderung', 'Zuwanderung'],
    ['Flüchtlinge', 'Geflüchtete'],
    ['Holocaust', 'Shoah'],
    ['Nationalsozialismus', 'NS-Zeit'],
    ['Desinformation', 'Falschinformation', 'Fake News'],
    ['Peer-Review', 'Begutachtung']
  ];

  /* Baut aus Gruppen ein Nachschlagewerk: vergleichbare Form → Gruppe */
  function synIndex(groups) {
    var byNorm = {}, multi = [];
    (groups || []).forEach(function (g) {
      var members = [];
      (g || []).forEach(function (label) {
        var f = flat(label);
        if (f && !members.some(function (m) { return m.norm === f; })) members.push({ label: String(label).trim(), norm: f });
      });
      if (members.length < 2) return;
      members.forEach(function (m) {
        (byNorm[m.norm] = byNorm[m.norm] || []).push(members);
        if (m.norm.indexOf(' ') > 0) multi.push(m);
      });
    });
    multi.sort(function (a, b) { return b.norm.length - a.norm.length; });
    return { byNorm: byNorm, multi: multi };
  }

  /* ---------- Vorbereitung der Datensätze ---------- */
  /* Ein Dokument: { id, kind, item, fields: [{ label, weight, text }] }
     Die vorbereitete Form wird zwischengespeichert, solange sich der Text nicht ändert. */
  var cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function prepField(f) {
    var w = words(f.text), list = [], set = {}, stems = {};
    w.forEach(function (x) { list.push(x); set[x.norm] = x.raw; var st = stem(x.norm); if (!stems[st]) stems[st] = x.raw; });
    /* Abschnitte (durch Komma, Semikolon, Zeilenumbruch getrennt) für Wortfolgen,
       damit z. B. zwei Tags nicht als zusammenhängende Wortfolge gelten */
    var segs = String(f.text || '').split(/[,;|\n]+/).map(function (t) { var w2 = words(t); return { flat: ' ' + w2.map(function (x) { return x.norm; }).join(' ') + ' ', stem: ' ' + w2.map(function (x) { return stem(x.norm); }).join(' ') + ' ' }; });
    return { label: f.label, weight: f.weight, words: list, set: set, stems: stems, segs: segs, flat: ' ' + list.map(function (x) { return x.norm; }).join(' ') + ' ', joined: list.map(function (x) { return x.norm; }).join('') };
  }
  function prep(doc) {
    var key = doc.fields.map(function (f) { return f.label + '\u0001' + (f.text || ''); }).join('\u0002');
    var hit = cache && doc.item && typeof doc.item === 'object' ? cache.get(doc.item) : null;
    if (hit && hit.key === key) return hit.fields;
    var fields = doc.fields.map(prepField);
    if (cache && doc.item && typeof doc.item === 'object') cache.set(doc.item, { key: key, fields: fields });
    return fields;
  }

  /* ---------- Suchanfrage zerlegen ---------- */
  function parseQuery(q, idx) {
    idx = idx || synIndex([]);
    var all = words(q), f = ' ' + all.map(function (w) { return w.norm; }).join(' ') + ' ';
    var terms = [], used = {};
    /* Mehrteilige verwandte Begriffe zuerst („Vereinte Nationen“) */
    idx.multi.forEach(function (m) {
      var p = f.indexOf(' ' + m.norm + ' ');
      if (p < 0) return;
      var start = f.slice(0, p + 1).trim().split(' ').filter(Boolean).length, n = m.norm.split(' ').length;
      for (var k = start; k < start + n; k++) if (used[k]) return;
      for (k = start; k < start + n; k++) used[k] = 1;
      terms.push(makeTerm(all.slice(start, start + n).map(function (w) { return w.raw; }).join(' '), m.norm, idx, start));
    });
    var meaningful = all.filter(function (w, i) { return !used[i] && !isStop(w.norm); }).length;
    all.forEach(function (w, i) {
      if (used[i]) return;
      /* Füllwörter weglassen, außer die Anfrage besteht nur daraus */
      if (isStop(w.norm) && (meaningful || terms.length)) return;
      terms.push(makeTerm(w.raw, w.norm, idx, i));
    });
    terms.sort(function (a, b) { return a.pos - b.pos; });
    return { terms: terms, flat: all.map(function (w) { return w.norm; }).join(' '), wordCount: all.length };
  }
  function makeTerm(raw, n, idx, pos) {
    var alts = [{ norm: n, stem: n.indexOf(' ') < 0 ? stem(n) : null, syn: null }], seen = {};
    seen[n] = 1;
    (idx.byNorm[n] || []).forEach(function (group) {
      group.forEach(function (m) {
        if (seen[m.norm]) return; seen[m.norm] = 1;
        alts.push({ norm: m.norm, stem: m.norm.indexOf(' ') < 0 ? stem(m.norm) : null, syn: m.label });
      });
    });
    return { raw: raw, norm: n, alts: alts, pos: pos };
  }

  /* ---------- Treffer in einem Feld bewerten ---------- */
  var MULT = { exact: 3, stem: 2.5, syn: 2.4, part: 1.5, fuzzy: 1 };
  function findWord(field, pred) { for (var i = 0; i < field.words.length; i++) if (pred(field.words[i].norm)) return field.words[i].raw; return ''; }
  function inSegs(field, phrase, key) { for (var i = 0; i < field.segs.length; i++) if (field.segs[i][key].indexOf(' ' + phrase + ' ') >= 0) return true; return false; }
  /* Originalschreibweise einer Wortfolge im Feld, z. B. „Vereinten Nationen“ */
  function rawPhrase(field, sp) {
    var st = sp.split(' '), w = field.words;
    for (var i = 0; i + st.length <= w.length; i++) {
      var ok = true;
      for (var j = 0; j < st.length; j++) if (stem(w[i + j].norm) !== st[j]) { ok = false; break; }
      if (ok) return w.slice(i, i + st.length).map(function (x) { return x.raw; }).join(' ');
    }
    return '';
  }
  function stemPhrase(n) { return n.split(' ').map(stem).join(' '); }
  function matchAlt(field, alt, term) {
    var n = alt.norm, isSyn = !!alt.syn;
    if (n.indexOf(' ') > 0) {
      if (inSegs(field, n, 'flat')) return { type: isSyn ? 'syn' : 'exact', word: alt.syn || term.raw };
      if (inSegs(field, stemPhrase(n), 'stem')) return { type: isSyn ? 'syn' : 'stem', word: isSyn ? alt.syn : rawPhrase(field, stemPhrase(n)) || term.raw };
      return null;
    }
    if (field.set[n] != null) return { type: isSyn ? 'syn' : 'exact', word: field.set[n] };
    if (alt.stem && field.stems[alt.stem] != null) return { type: isSyn ? 'syn' : 'stem', word: field.stems[alt.stem] };
    /* Wortteil, z. B. „klima“ in „Klimawandel“. Bei verwandten Begriffen erst ab 4 Zeichen. */
    if ((!isSyn || n.length >= 4) && (!term.strict || n.length >= 5) && field.flat.indexOf(n) >= 0) {
      return { type: isSyn ? 'syn' : 'part', word: findWord(field, function (w) { return w.indexOf(n) >= 0; }) || term.raw };
    }
    /* Wortteil über Wortgrenzen (z. B. bei Bindestrichen) */
    if (term.strict) return null;
    if (!isSyn && n.length >= 4 && field.joined.indexOf(n) >= 0) return { type: 'part', word: term.raw };
    if (!isSyn && n.length >= 5) {
      var w = findWord(field, function (x) { return x.length >= 5 && near(n, x); });
      if (w) return { type: 'fuzzy', word: w };
    }
    return null;
  }
  function matchTerm(field, term) {
    var best = null;
    term.alts.forEach(function (alt) {
      var m = matchAlt(field, alt, term);
      if (m && (!best || MULT[m.type] > MULT[best.type])) { best = m; best.alt = alt; }
    });
    return best;
  }

  function reasonText(term, m, label) {
    var q = '„' + term.raw + '“', w = '„' + m.word + '“';
    switch (m.type) {
      case 'exact': return q + ' in ' + label;
      case 'stem': return 'Wortform ' + w + ' zu ' + q + ' in ' + label;
      case 'syn': return 'verwandter Begriff ' + '„' + m.alt.syn + '“ zu ' + q + ' in ' + label;
      case 'part': return 'Wortteil ' + q + ' in ' + w + ' (' + label + ')';
      case 'fuzzy': return 'ähnliche Schreibweise ' + w + ' zu ' + q + ' in ' + label;
    }
    return q;
  }

  /* ---------- Suche ----------
     Liefert { full: [...], partial: [...], terms }.
     full    = Datensätze, die ALLE Suchwörter enthalten (wie bisher, nur besser sortiert)
     partial = nur gefüllt, wenn es keine vollständigen Treffer gibt
     Jeder Treffer: { doc, score, reasons: [Text], missing: [Suchwort] } */
  function search(docs, query, opts) {
    opts = opts || {};
    var idx = opts.synIndex || synIndex(opts.synonyms || SYNONYMS);
    var pq = parseQuery(query, idx);
    if (!pq.terms.length) return { full: [], partial: [], terms: [] };
    var full = [], partial = [];
    docs.forEach(function (doc, order) {
      var fields = prep(doc), score = 0, reasons = [], missing = [], hit = 0;
      pq.terms.forEach(function (term) {
        var tScore = 0, best = null, bestField = null;
        fields.forEach(function (fd) {
          var m = matchTerm(fd, term);
          if (!m) return;
          var s = fd.weight * MULT[m.type];
          tScore += s;
          if (!best || s > best.s) { best = m; best.s = s; bestField = fd; }
        });
        if (best) { hit++; score += tScore; reasons.push({ s: best.s, t: reasonText(term, best, bestField.label) }); }
        else missing.push(term.raw);
      });
      if (!hit) return;
      /* Bonus: genaue Wortfolge aus mehreren Wörtern */
      if (pq.wordCount > 1 && pq.flat) {
        var sp = stemPhrase(pq.flat);
        for (var i = 0; i < fields.length; i++) {
          if (inSegs(fields[i], pq.flat, 'flat') || inSegs(fields[i], sp, 'stem')) {
            var bonus = fields[i].weight >= 5 ? 10 : 4;
            score += bonus;
            if (pq.terms.length > 1) reasons.unshift({ s: 99, t: 'genaue Wortfolge in ' + fields[i].label });
            break;
          }
        }
      }
      reasons.sort(function (a, b) { return b.s - a.s; });
      var r = { doc: doc, score: Math.round(score * 10) / 10, reasons: reasons.map(function (x) { return x.t; }), missing: missing, order: order };
      (missing.length ? partial : full).push(r);
    });
    var by = function (a, b) { return b.score - a.score || a.order - b.order; };
    full.sort(by);
    partial.sort(function (a, b) { return a.missing.length - b.missing.length || by(a, b); });
    return { full: full, partial: full.length ? [] : partial, terms: pq.terms.map(function (t) { return t.raw; }) };
  }

  /* ---------- Verwandte Inhalte ----------
     target, docs: Dokumente wie bei search; zusätzlich je Dokument:
       tags: [Text], sourceIds: [id], topic: Text
     opts.links: [{ type, fromK, fromId, toK, toId }]
     opts.label(kind, id) → Anzeigename;  opts.sourceTitle(id) → Titel
     opts.ltypes: { type: [Bezeichnung] }
     Liefert die besten Treffer mit Punkten und Begründungen. */
  function bag(doc) {
    var b = {}, show = {};
    prep(doc).forEach(function (f) {
      if (f.weight < 2) return; /* nur inhaltliche Felder */
      f.words.forEach(function (w) {
        if (w.norm.length < 3 || isStop(w.norm) || /^\d+$/.test(w.norm)) return;
        var st = stem(w.norm);
        b[st] = (b[st] || 0) + (f.weight >= 4 ? 2 : 1);
        if (!show[st]) show[st] = w.raw;
      });
    });
    return { tf: b, show: show };
  }
  function related(target, docs, opts) {
    opts = opts || {};
    var key = function (d) { return d.kind + ':' + d.id; }, tk = key(target), links = opts.links || [], lt = opts.ltypes || {};
    var others = docs.filter(function (d) { return key(d) !== tk; });
    var all = [target].concat(others), bags = {}, df = {};
    all.forEach(function (d) { var b = bag(d); bags[key(d)] = b; Object.keys(b.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    var N = all.length, idf = function (t) { return Math.log((N + 1) / (df[t] || 1)); };
    var vec = function (b) { var v = {}, len = 0; Object.keys(b.tf).forEach(function (t) { v[t] = b.tf[t] * idf(t); len += v[t] * v[t]; }); return { v: v, len: Math.sqrt(len) }; };
    var tv = vec(bags[tk]);
    /* direkte und indirekte Verknüpfungen */
    var direct = {}, neighbours = {};
    links.forEach(function (l) {
      var a = l.fromK + ':' + l.fromId, b = l.toK + ':' + l.toId;
      if (a === tk) direct[b] = (direct[b] || []).concat([(lt[l.type] || [l.type])[0]]);
      else if (b === tk) direct[a] = (direct[a] || []).concat([(lt[l.type] || [l.type, l.type])[1] || l.type]);
    });
    links.forEach(function (l) {
      var a = l.fromK + ':' + l.fromId, b = l.toK + ':' + l.toId;
      if (direct[a] && b !== tk) (neighbours[b] = neighbours[b] || []).push(a);
      if (direct[b] && a !== tk) (neighbours[a] = neighbours[a] || []).push(b);
    });
    var tTags = {}; (target.tags || []).forEach(function (t) { tTags[normalize(t).trim()] = t; });
    var tSrc = {}; (target.sourceIds || []).forEach(function (s) { tSrc[s] = 1; });
    var tTopic = normalize(target.topic || '').trim();
    var out = [];
    others.forEach(function (d) {
      var k = key(d), score = 0, reasons = [], linked = !!direct[k];
      if (linked) { score += 10; reasons.push('direkt verknüpft: ' + direct[k].join(', ')); }
      if (neighbours[k]) {
        var via = neighbours[k].filter(function (x, i, a) { return a.indexOf(x) === i; });
        score += 2 * Math.min(via.length, 2);
        reasons.push('indirekt verbunden über „' + via.slice(0, 2).map(function (x) { var p = x.split(':'); return opts.label ? opts.label(p[0], p.slice(1).join(':')) : x; }).join('“, „') + '“');
      }
      var shared = (d.sourceIds || []).filter(function (s) { return tSrc[s]; });
      if (shared.length) { score += 4 * shared.length; reasons.push((shared.length === 1 ? 'gemeinsame Quelle: ' : 'gemeinsame Quellen: ') + shared.map(function (s) { return '„' + (opts.sourceTitle ? opts.sourceTitle(s) : s) + '“'; }).join(', ')); }
      var tags = (d.tags || []).filter(function (t) { return tTags[normalize(t).trim()] != null; });
      if (tags.length) { score += 3 * tags.length; reasons.push((tags.length === 1 ? 'gemeinsamer Tag: ' : 'gemeinsame Tags: ') + tags.join(', ')); }
      if (tTopic && normalize(d.topic || '').trim() === tTopic) { score += 1; reasons.push('gleiches Themengebiet: ' + d.topic); }
      var dv = vec(bags[k]), dot = 0, common = [];
      Object.keys(tv.v).forEach(function (t) { if (dv.v[t]) { dot += tv.v[t] * dv.v[t]; common.push(t); } });
      var cos = tv.len && dv.len ? dot / (tv.len * dv.len) : 0;
      if (cos >= 0.08 && common.length) {
        score += Math.round(cos * 20 * 10) / 10;
        common.sort(function (a, b) { return tv.v[b] * dv.v[b] - tv.v[a] * dv.v[a]; });
        reasons.push('ähnliche Begriffe: ' + common.slice(0, 4).map(function (t) { return bags[tk].show[t]; }).join(', '));
      }
      if (score >= (opts.min || 3)) out.push({ doc: d, score: Math.round(score * 10) / 10, reasons: reasons, linked: linked });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, opts.max || 6);
  }


  /* =====================================================================
   * Behauptungsanalyse (Phase 4, Etappe 3)
   * Alles beruht auf festen Regeln (Satzzeichen, Schlüsselwörter, Zahlen).
   * Die App erkennt keine Ironie, keinen Zusammenhang über Sätze hinweg und
   * versteht die Bedeutung nicht. Jede Einordnung ist daher ein Hinweis.
   * ===================================================================== */

  /* Wortgrenzen, die auch für Umlaute funktionieren */
  function wordRe(list) {
    var esc = list.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); });
    return new RegExp('(?<![\\p{L}\\p{N}])(' + esc.join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
  }
  var MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember', 'jan', 'feb', 'mär', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'okt', 'nov', 'dez'];
  var RULES = [
    { id: 'zahl', label: 'Zahl oder Menge', checkable: true, hint: 'Zahlen lassen sich meist mit einer Quelle prüfen.',
      re: /(?<![\p{L}])\d(?:[\d.,]*\d)?\s*(%|prozent)?|(?<![\p{L}])(prozent|millionen?|milliarden?|tausende?|hälfte|drittel|viertel|mehrheit|minderheit|doppelt|verdoppelt|dreifach|verdreifacht)(?![\p{L}])/giu },
    { id: 'zeit', label: 'Zeitangabe', checkable: true, hint: 'Gilt die Aussage für diesen Zeitpunkt? Ist sie noch aktuell?',
      re: new RegExp('(?<![\\p{L}\\p{N}])((1[0-9]|20)\\d\\d|' + MONTHS.join('|') + '|jahrhunderts?|jahrzehnts?|seit jahren|letztes jahr|dieses jahr|heute|gestern)(?![\\p{L}\\p{N}])', 'giu') },
    { id: 'zuschreibung', label: 'Zuschreibung oder Zitat', checkable: true, hint: 'Hat die genannte Person oder Quelle das wirklich so gesagt?',
      re: wordRe(['laut', 'zufolge', 'sagt', 'sagte', 'sagten', 'behauptet', 'behauptete', 'erklärt', 'erklärte', 'berichtet', 'berichtete', 'schreibt', 'schrieb', 'nach angaben', 'eine studie', 'die studie', 'studie zeigt', 'umfrage', 'räumt ein', 'räumte ein', 'gab zu', 'bestätigt', 'bestätigte', 'meldet', 'meldete']) },
    { id: 'kausal', label: 'Ursache und Wirkung', checkable: true, hint: 'Ist der Zusammenhang belegt oder nur zeitlich?',
      re: wordRe(['weil', 'deshalb', 'daher', 'darum', 'deswegen', 'wegen', 'aufgrund', 'infolge', 'führt zu', 'führte zu', 'führen zu', 'führten zu', 'verursacht', 'verursachen', 'verursachte', 'bewirkt', 'bewirkte', 'sorgt für', 'sorgte für', 'schuld', 'liegt an', 'lag an', 'als folge', 'die folge', 'dank', 'durch die'] ) },
    { id: 'vergleich', label: 'Vergleich', checkable: true, hint: 'Womit genau wird verglichen (Zeitraum, Bezugsgröße)?',
      re: wordRe(['mehr als', 'weniger als', 'höher als', 'niedriger als', 'größer als', 'kleiner als', 'im vergleich', 'doppelt so', 'stärker als', 'schwächer als', 'besser als', 'schlechter als', 'öfter als', 'am meisten', 'am wenigsten', 'höchste', 'höchsten', 'niedrigste', 'niedrigsten', 'rekord', 'rekordhoch', 'rekordtief']) },
    { id: 'pauschal', label: 'Pauschalaussage', checkable: true, hint: 'Ein einziges Gegenbeispiel genügt, um sie zu widerlegen.',
      re: wordRe(['immer', 'nie', 'niemals', 'alle', 'allen', 'jeder', 'jede', 'jedes', 'jeden', 'niemand', 'keiner', 'ausnahmslos', 'zwangsläufig', 'grundsätzlich', 'stets', 'noch nie', 'überhaupt nicht', 'überhaupt kein', 'komplett', 'völlig', 'nur noch']) },
    { id: 'prognose', label: 'Vorhersage', checkable: false, hint: 'Vorhersagen sind heute nicht prüfbar, nur ihre Grundlage.',
      re: new RegExp('(?<![\\p{L}\\p{N}])(wird bald|werden bald|künftig|zukünftig|in zukunft|droht|drohen|demnächst|voraussichtlich|prognose|prognostiziert|bis (19|20)\\d\\d)(?![\\p{L}\\p{N}])', 'giu') },
    { id: 'vage', label: 'Vage Angabe', checkable: false, hint: 'Wer genau? Welche Studie, welche Quelle?',
      re: wordRe(['viele', 'einige', 'manche', 'experten', 'expertinnen', 'wissenschaftler sagen', 'forscher sagen', 'man sagt', 'angeblich', 'bekanntlich', 'jeder weiß', 'offensichtlich', 'studien zeigen', 'studien belegen', 'es heißt', 'gerüchten zufolge', 'irgendwie', 'die medien', 'die politik']) },
    { id: 'meinung', label: 'Wertung', checkable: false, hint: 'Wertungen lassen sich nicht wie Fakten prüfen.',
      re: wordRe(['ich finde', 'ich denke', 'ich glaube', 'meiner meinung', 'meines erachtens', 'für mich', 'sollte', 'sollten', 'müsste', 'müssten', 'muss endlich', 'müssen endlich', 'skandal', 'skandalös', 'lächerlich', 'unverschämt', 'schlimm', 'peinlich', 'endlich', 'leider', 'hoffentlich', 'zum glück', 'toll', 'super', 'katastrophe', 'katastrophal', 'wahnsinn', 'dumm', 'idiotisch', 'gut so', 'richtig so', 'unfassbar', 'frechheit', 'schande']) },
    { id: 'verneinung', label: 'Verneinung', checkable: false, hint: 'Eine Verneinung kehrt die Aussage um. Beim Abgleich darauf achten.',
      re: wordRe(['nicht', 'kein', 'keine', 'keinen', 'keinem', 'keiner', 'keines', 'nie', 'niemals', 'nichts']) }
  ];

  /* Bereinigt einen Text oder X-Beitrag: Links, Erwähnungen, Hashtags, Emojis */
  function cleanText(text) {
    var links = [], mentions = [], tags = [];
    var t = String(text == null ? '' : text).replace(/\r/g, '');
    t = t.replace(/https?:\/\/\S+/gi, function (u) { var tail = (/[)\].,;!?]+$/.exec(u) || [''])[0]; links.push(u.slice(0, u.length - tail.length)); return ' ' + tail.replace(/[)\]]/g, ''); });
    t = t.replace(/(^|[^\p{L}\p{N}_])@([A-Za-z0-9_]{1,30})/gu, function (m, pre, h) { mentions.push(h); return pre + '@' + h; });
    /* Antwort-Präfix „@a @b …“ am Anfang entfernen */
    t = t.replace(/^(\s*@[A-Za-z0-9_]+[\s,:]*)+/, '');
    /* Hashtag-Block am Ende („… #Klima #Energie“) wird nur als Stichwort gemerkt */
    t = t.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, function (m) { m.replace(/#([\p{L}\p{N}_]+)/gu, function (x, h) { tags.push(h); }); return ''; });
    t = t.replace(/#([\p{L}\p{N}_]+)/gu, function (m, h) { tags.push(h); return h; });
    t = t.replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, ' ');
    /* Thread-Zähler wie „1/5“ oder „(2/7)“ */
    t = t.replace(/(^|\s)\(?\d{1,2}\s?\/\s?\d{1,2}\)?(?=\s|$)/g, ' ');
    t = t.split('\n').map(function (l) { return l.replace(/[ \t]+/g, ' ').replace(/ ([.,;:!?])/g, '$1').trim(); }).join('\n').replace(/\n{2,}/g, '\n').trim();
    return { text: t, links: links, mentions: mentions, hashtags: tags };
  }

  var ABBR = {};
  ('z b u a d h bzw ca dr prof nr vgl usw etc mio mrd jh jhd st ggf evtl inkl v a s o i d r bspw sog abs art lt mind max min std tsd hr fr mr mrs bzgl ehem gegr geb ff vs zt z t u u o ä u ä d i').split(' ').forEach(function (a) { ABBR[a] = 1; });
  var MONTH_START = new RegExp('^(' + MONTHS.join('|') + ')', 'i');
  var ORD_BEFORE = /(?:^|\s)(am|im|dem|der|den|des|die|das|zum|zur|vom|bis|seit|ab|beim|vor|nach|ein|eine|einem|einen|jeden|jedem)\s*$/i;

  /* Zerlegt Text in Sätze. Achtet auf Abkürzungen („z. B.“), Ordnungszahlen
     („24. Oktober“, „1. Weltkrieg“), Initialen und Dezimalzahlen. */
  function sentences(text) {
    var out = [];
    String(text || '').split(/\n+/).forEach(function (line) {
      var start = 0, re = /[.!?…]+["“”»«')\]]*(?=\s|$)/g, m;
      while ((m = re.exec(line))) {
        var end = m.index + m[0].length, punct = m[0];
        var before = line.slice(start, m.index), tokM = /([\p{L}\p{N}.]+)$/u.exec(before), tok = tokM ? tokM[1].toLowerCase() : '';
        var rest = line.slice(end).replace(/^\s+/, '');
        if (rest && /^[.]+$/.test(punct.replace(/["“”»«')\]]/g, ''))) {
          var bare = tok.replace(/\./g, ' ').trim();
          if (ABBR[bare] || ABBR[tok.replace(/\./g, '')]) continue;           /* bekannte Abkürzung */
          if (/^\p{L}$/u.test(tok)) continue;                                   /* Initiale, „z. B.“ */
          /* Ordnungszahl: „am 24. Oktober“, „im 1. Weltkrieg“; aber „Platz 3. Danach …“ trennt */
          if (/^\d{1,2}$/.test(tok) && (MONTH_START.test(rest) || ORD_BEFORE.test(before.slice(0, before.length - tok.length)))) continue;
          if (/^\p{Ll}/u.test(rest) || MONTH_START.test(rest)) continue;        /* klein weiter: kein Satzende */
        }
        var s = line.slice(start, end).trim();
        if (s) out.push(s);
        start = end;
      }
      var tail = line.slice(start).trim();
      if (tail) out.push(tail);
    });
    return out;
  }

  /* Trennt einen Satz an Semikolon und an „, aber / jedoch / doch“ in Teilaussagen */
  function parts(sentence) {
    var p = sentence.split(/\s*;\s*|,\s+(?=(?:aber|jedoch|doch)\s)/i).map(function (x) { return x.trim(); }).filter(function (x) { return words(x).length; });
    return p.length > 1 ? p : [sentence];
  }

  function applyRules(s) {
    var hits = [];
    RULES.forEach(function (r) {
      r.re.lastIndex = 0;
      var found = [], m;
      while ((m = r.re.exec(s))) { var w = m[0].trim(); if (w && found.indexOf(w.toLowerCase()) < 0) found.push(w.toLowerCase()); if (m[0] === '') r.re.lastIndex++; }
      if (found.length) hits.push({ id: r.id, label: r.label, hint: r.hint, checkable: r.checkable, words: found.slice(0, 4) });
    });
    return hits;
  }
  var KINDS = {
    pruefbar: 'Möglicherweise überprüfbare Behauptung',
    gemischt: 'Behauptung mit Wertung',
    meinung: 'Eher Meinung oder Wertung',
    frage: 'Frage',
    aussage: 'Aussage – Einordnung unklar',
    fragment: 'Zu kurz für eine Einordnung'
  };
  function classify(s, hits) {
    var has = function (id) { return hits.some(function (h) { return h.id === id; }); };
    var checkable = hits.some(function (h) { return h.checkable; });
    var n = words(s).length;
    if (/\?["“”»«')\]]*$/.test(s)) return { kind: 'frage', why: 'endet mit Fragezeichen' + (checkable ? '; enthält aber Merkmale einer Behauptung (z. B. rhetorische Frage, nicht sicher erkennbar)' : '') };
    if (n < 3) return { kind: 'fragment', why: 'weniger als drei Wörter' };
    if (checkable && has('meinung')) return { kind: 'gemischt', why: 'prüfbare Merkmale und wertende Wörter' };
    if (checkable) return { kind: 'pruefbar', why: 'enthält ' + hits.filter(function (h) { return h.checkable; }).map(function (h) { return h.label; }).join(', ') };
    if (has('meinung')) return { kind: 'meinung', why: 'wertende Wörter, keine prüfbaren Merkmale' };
    return { kind: 'aussage', why: 'keine Regel hat gegriffen' };
  }

  /* Hauptfunktion: zerlegt einen Text in Aussagen und ordnet sie ein */
  function analyzeClaims(text) {
    var c = cleanText(text), list = [];
    sentences(c.text).forEach(function (s) {
      var p = parts(s);
      p.forEach(function (x) {
        var hits = applyRules(x), cl = classify(x, hits);
        list.push({ n: list.length + 1, text: x, sentence: s, part: p.length > 1, kind: cl.kind, kindLabel: KINDS[cl.kind], why: cl.why, rules: hits });
      });
    });
    return { text: c.text, links: c.links, mentions: c.mentions, hashtags: c.hashtags, statements: list,
      summary: list.reduce(function (a, s) { a[s.kind] = (a[s.kind] || 0) + 1; return a; }, {}) };
  }

  /* Offene Fragen zu einer Aussage. matches: gefundene Einträge [{ status }] */
  var OPEN_STATUS = { neu: 1, pruefung: 1, umstritten: 1, veraltet: 1 };
  function openQuestions(st, matches, statusLabel) {
    var q = [], has = function (id) { return st.rules.some(function (h) { return h.id === id; }); };
    if (st.kind === 'fragment') return q;
    matches = matches || [];
    if (st.kind !== 'meinung') {
      if (!matches.length) q.push('Kein passender Eintrag in deiner Datenbank. Noch zu recherchieren.');
      else if (matches.every(function (m) { return OPEN_STATUS[m.status]; })) q.push('Passende Einträge sind nicht belegt (' + matches.map(function (m) { return statusLabel ? statusLabel(m.status) : m.status; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') + ').');
    }
    if (has('zahl') && !has('zuschreibung')) q.push('Woher stammt die Zahl? Quelle und Bezugsjahr nennt der Text nicht.');
    if (has('zuschreibung')) q.push('Stimmt die Zuschreibung? Originalquelle oder Originalzitat suchen.');
    if (has('vage')) q.push('Unklar, wer gemeint ist: Welche Personen, welche Studie?');
    if (has('kausal')) q.push('Ist der Zusammenhang belegt oder nur zeitlich?');
    if (has('vergleich')) q.push('Womit genau wird verglichen?');
    if (has('pauschal')) q.push('Gibt es Gegenbeispiele?');
    if (has('prognose')) q.push('Worauf stützt sich die Vorhersage?');
    if (st.kind === 'aussage') q.push('Keine Merkmale erkannt: Selbst einschätzen, ob die Aussage überprüfbar ist.');
    if (st.part) q.push('Automatisch aus einem längeren Satz getrennt. Zusammenhang prüfen.');
    return q;
  }

  /* ---------- Abgleich eines Textes mit gespeicherten Einträgen ----------
     Anders als die Suche muss nicht jedes Wort vorkommen. Gezählt werden nur
     inhaltliche Wörter; Treffer brauchen mindestens zwei davon oder einen
     starken Treffer in Titel/Tags. Keine Tippfehler-Toleranz (zu ungenau). */
  var RULE_WORDS = {};
  ('immer nie niemals alle allen jeder jede jedes jeden niemand keiner kein keine keinen keinem keines nicht nichts nur noch sehr viele einige manche mehr weniger gibt gab hat haben hatte hatten kann koennen konnte muss muessen sollte sollten wurde wurden worden weil deshalb daher darum wegen laut sagt sagte heute jahr jahre jahren prozent seit also eigentlich wirklich einfach schon wieder ganz etwa rund ueber unter mal ja nein doch eben wohl gar sogar bereits damit dabei dazu denn sondern bzw beim sagen sagt sagte sagten gesagt zeigt zeigen zeigte gezeigt behaupten weiss wissen macht machen gemacht geht gehen kommt kommen sind war waren ist gilt meint meinen finde finden denke glaube').split(' ').forEach(function (w) { RULE_WORDS[w] = 1; });
  function matchText(docs, text, opts) {
    opts = opts || {};
    var idx = opts.synIndex || synIndex(opts.synonyms || SYNONYMS);
    var pq = parseQuery(text, idx);
    /* Abkürzungen in Großbuchstaben (EU, UN, CO2) zählen auch mit zwei Zeichen */
    var terms = pq.terms.filter(function (t) { return (t.norm.length >= 3 || /^[A-ZÄÖÜ][A-ZÄÖÜ0-9]+$/.test(t.raw)) && !RULE_WORDS[t.norm] && !isStop(t.norm) && !/^\d+$/.test(t.norm); });
    terms.forEach(function (t) { t.strict = true; });
    if (!terms.length) return [];
    var out = [];
    docs.forEach(function (doc) {
      var fields = prep(doc), score = 0, matched = [], reasons = [], strong = false;
      terms.forEach(function (term) {
        var best = null, bf = null, tScore = 0;
        fields.forEach(function (fd) {
          var m = matchTerm(fd, term);
          if (!m) return;
          var s = fd.weight * MULT[m.type]; tScore += s;
          if (!best || s > best.s) { best = m; best.s = s; bf = fd; }
        });
        if (!best) return;
        matched.push(term.raw); score += tScore;
        if (bf.weight >= 4 && term.norm.length >= 5 && best.type !== 'part') strong = true;
        reasons.push({ s: best.s, t: reasonText(term, best, bf.label) });
      });
      if (matched.length >= 2 || (matched.length === 1 && strong)) {
        reasons.sort(function (a, b) { return b.s - a.s; });
        out.push({ doc: doc, score: Math.round(score * 10) / 10, matched: matched, total: terms.length, reasons: reasons.map(function (r) { return r.t; }) });
      }
    });
    out.sort(function (a, b) { return b.matched.length - a.matched.length || b.score - a.score; });
    return out.slice(0, opts.max || 3);
  }

  global.Analyse = {
    normalize: normalize,
    words: words,
    flat: flat,
    stem: stem,
    isStop: isStop,
    near: near,
    SYNONYMS: SYNONYMS,
    synIndex: synIndex,
    parseQuery: parseQuery,
    search: search,
    related: related,
    cleanText: cleanText,
    sentences: sentences,
    analyzeClaims: analyzeClaims,
    openQuestions: openQuestions,
    matchText: matchText,
    CLAIM_KINDS: KINDS
  };
})(typeof self !== 'undefined' ? self : this);
