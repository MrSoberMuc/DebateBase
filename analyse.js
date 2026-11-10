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
  ('zwischen seit durch ohne gegen immer nie niemals alle allen jeder jede jedes jeden niemand keiner kein keine keinen keinem keines nicht nichts nur noch sehr viele einige manche mehr weniger gibt gab hat haben hatte hatten kann koennen konnte muss muessen sollte sollten wurde wurden worden weil deshalb daher darum wegen laut sagt sagte heute jahr jahre jahren prozent seit also eigentlich wirklich einfach schon wieder ganz etwa rund ueber unter mal ja nein doch eben wohl gar sogar bereits damit dabei dazu denn sondern bzw beim sagen sagt sagte sagten gesagt zeigt zeigen zeigte gezeigt behaupten weiss wissen macht machen gemacht geht gehen kommt kommen sind war waren ist gilt meint meinen finde finden denke glaube').split(' ').forEach(function (w) { RULE_WORDS[w] = 1; });
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

  /* =====================================================================
   * Zusammenhangs- und Widerspruchsanalyse (Phase 4, Etappe 4)
   * Vergleicht eine Aussage mit gespeicherten Einträgen, Argumentationskarten,
   * Verknüpfungen und Quellen. Grundlage sind ausschließlich:
   *   - gemeinsame Stichwörter (wie „gleichartig“ ist die Aussage?),
   *   - der Prüfstatus des gespeicherten Eintrags,
   *   - vorhandene Verknüpfungen (Widerspricht, Unterstützt, …),
   *   - abweichende Zahlen und eine Verneinung nur auf einer Seite,
   *   - Behauptung/Gegenargument einer Argumentationskarte.
   * Jedes Ergebnis nennt die gespeicherten Einträge, auf denen es beruht.
   * Ein „Widerspruch“ ist immer ein Kandidat, kein Urteil.
   * ===================================================================== */
  var NEG = /(?<![\p{L}])(nicht|kein|keine|keinen|keinem|keiner|keines|nie|niemals|nichts)(?![\p{L}])/iu;
  function numbers(text) {
    var out = [], m, re = /(?<![\p{L}\d])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\d])/gu;
    while ((m = re.exec(String(text || '')))) out.push(parseFloat(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : '')));
    return out;
  }
  var REL_ORDER = ['widersprechend', 'unterstuetzend', 'relativierend', 'ergaenzend', 'thematisch'];
  var REL_LABEL = { widersprechend: 'Widersprechende Inhalte', unterstuetzend: 'Unterstützende Inhalte', relativierend: 'Relativierende Inhalte', ergaenzend: 'Ergänzende Inhalte', thematisch: 'Nur thematisch verwandt' };
  var FACT_TYPES = { fakt: 1, statistik: 1, studie: 1, definition: 1 };
  var REL_SHORT = { widersprechend: 'widersprechender Inhalt', unterstuetzend: 'unterstützender Inhalt', relativierend: 'relativierender Inhalt', ergaenzend: 'ergänzender Inhalt' };
  var OPP = { widersprechend: 'unterstuetzend', unterstuetzend: 'widersprechend' };

  /* data = { entries, args, links, sources } wie gespeichert
     opts = { synIndex, statusLabel(s), ltypes } */
  function relate(text, data, opts) {
    opts = opts || {};
    var idx = opts.synIndex || synIndex(SYNONYMS), SL = opts.statusLabel || function (s) { return s; };
    var f = function (label, weight, t) { return { label: label, weight: weight, text: t == null ? '' : String(t) }; };
    var title = function (k, id) { var L = data[k] || [], o = null; for (var i = 0; i < L.length; i++) if (L[i].id === id) { o = L[i]; break; } return o; };
    /* Kerntexte: die eigentliche Aussage eines Eintrags bzw. die zwei Seiten einer Karte */
    var core = [];
    (data.entries || []).forEach(function (e) { core.push({ id: e.id, kind: 'entries', side: 'eintrag', item: e, fields: [f('Titel', 5, e.title), f('Kernaussage', 4, e.claimCore)] }); });
    (data.args || []).forEach(function (a) {
      core.push({ id: a.id, kind: 'args', side: 'behauptung', item: a, fields: [f('Titel', 5, a.title), f('Behauptung der Gegenseite', 4, a.claim)] });
      core.push({ id: a.id, kind: 'args', side: 'gegenargument', item: a, fields: [f('Gegenargument', 4, a.counter)] });
    });
    var full = [];
    (data.entries || []).forEach(function (e) { full.push({ id: e.id, kind: 'entries', item: e, fields: [f('Titel', 5, e.title), f('Tags', 4, (e.tags || []).join(', ')), f('Kernaussage', 3, e.claimCore), f('Beschreibung', 2, e.description), f('Evidenz', 1, e.evidence), f('Einschränkungen', 1, e.limits)] }); });
    (data.args || []).forEach(function (a) { full.push({ id: a.id, kind: 'args', item: a, fields: [f('Titel', 5, a.title), f('Behauptung', 3, a.claim), f('Gegenargument', 2, a.counter)] }); });

    var stNeg = NEG.test(text), stNum = numbers(text);
    var res = {}, key = function (k, id) { return k + ':' + id; };
    function add(k, item, rel, basis, how) {
      var kk = key(k, item.id), cur = res[kk];
      if (!cur) cur = res[kk] = { kind: k, id: item.id, title: item.title, status: item.status, rel: rel, basis: [], how: how };
      /* Ein direkter Vergleich (Status, Karte, Fakt) wird nicht durch eine Verknüpfung überstimmt */
      else if (!(how === 'link' && cur.how !== 'link' && cur.how !== 'woerter') && REL_ORDER.indexOf(rel) < REL_ORDER.indexOf(cur.rel)) { cur.rel = rel; cur.how = how; }
      if (cur.basis.indexOf(basis) < 0) cur.basis.push(basis);
    }

    /* 1. Gleichartige Aussagen finden (Kerntext, mindestens 60 % der Stichwörter) */
    var anchors = [];
    matchText(core, text, { synIndex: idx, max: 8 }).forEach(function (m) {
      var cov = m.matched.length / m.total;
      if (!(m.matched.length >= 2 && cov >= 0.6) && !(m.total <= 2 && m.matched.length === m.total)) return;
      var d = m.doc, o = d.item, coreText = d.fields.map(function (x) { return x.text; }).join(' ');
      /* Verneinung nur bei kurzen Kerntexten auswerten; in langen Texten ist „nicht“ zu häufig */
      var flip = words(coreText).length <= 25 && stNeg !== NEG.test(coreText);
      var cn = numbers(d.fields.length ? d.fields[0].text + ' ' + (d.fields[1] ? d.fields[1].text : '') : '');
      var numDiff = stNum.length && cn.length && !stNum.some(function (n) { return cn.indexOf(n) >= 0; });
      var same = 'Stichwörter: ' + m.matched.join(', ');
      var tags = [];
      if (flip) tags.push('Verneinung nur auf einer Seite');
      if (numDiff) tags.push('Zahl weicht ab (' + stNum.join(', ') + ' ↔ ' + cn.join(', ') + ')');
      var note = tags.length ? ' · ' + tags.join(' · ') : '';
      var rel = null, how = '';
      if (d.kind === 'args') {
        /* Karte: Aussage gleicht der Behauptung der Gegenseite → das Gegenargument widerspricht ihr */
        rel = d.side === 'behauptung' ? 'widersprechend' : 'unterstuetzend';
        if (flip) rel = OPP[rel];
        how = d.side === 'behauptung'
          ? (flip ? 'verneint die „Behauptung der Gegenseite“ dieser Karte und liegt damit eher auf der Linie ihres Gegenarguments'
                  : 'gleicht der „Behauptung der Gegenseite“ dieser Karte; ihr Gegenargument widerspricht')
          : (flip ? 'verneint das Gegenargument dieser Karte' : 'gleicht dem Gegenargument dieser Karte');
        how += ' (' + same + note + ')';
      } else {
        var st = o.status;
        if (st === 'belegt' || st === 'teilweise') { rel = 'unterstuetzend'; how = 'gleichartiger Eintrag, Prüfstatus „' + SL(st) + '“'; }
        else if (st === 'widerlegt' || st === 'veraltet') { rel = 'widersprechend'; how = 'gleichartiger Eintrag ist als „' + SL(st) + '“ markiert'; }
        else if (st === 'umstritten') { rel = 'relativierend'; how = 'gleichartiger Eintrag ist als „Umstritten“ markiert'; }
        else { rel = 'thematisch'; how = 'gleichartiger Eintrag, aber noch nicht geprüft („' + SL(st) + '“)'; }
        if (flip && OPP[rel]) rel = OPP[rel];
        /* abweichende Zahl: belegter Eintrag → Widerspruch; widerlegter/veralteter → eher Bestätigung der neuen Zahl */
        if (numDiff && !flip && OPP[rel]) rel = OPP[rel];
        how += ' (' + same + note + ')';
      }
      add(d.kind, o, rel, how, d.kind === 'args' ? 'karte' : 'status');
      /* orient: +1 = Aussage sagt dasselbe wie die „Position“ des Ankers, -1 = das Gegenteil.
         Bei Karten ist die Position das Gegenargument (Verknüpfungen beziehen sich darauf). */
      var orient = d.kind === 'args' ? ((d.side === 'behauptung') !== flip ? -1 : 1) : ((flip || numDiff) ? -1 : 1);
      anchors.push({ kind: d.kind, item: o, rel: rel, orient: orient });
    });

    /* 2. Vorhandene Verknüpfungen der gleichartigen Einträge nutzen */
    var LT = opts.ltypes || {};
    anchors.forEach(function (a) {
      var base = a.orient;
      (data.links || []).forEach(function (l) {
        var from = l.fromK === a.kind && l.fromId === a.item.id, to = l.toK === a.kind && l.toId === a.item.id;
        if (!from && !to) return;
        var pk = from ? l.toK : l.fromK, pid = from ? l.toId : l.fromId, p = title(pk, pid);
        if (!p) return;
        var verb = (LT[l.type] || [l.type, l.type])[0];
        var nm = function (k, o) { return (k === 'args' ? 'die Karte „' : '„') + o.title + '“'; };
        var desc = from ? nm(a.kind, a.item) + ' ' + verb.toLowerCase() + ' ' + nm(pk, p) : nm(pk, p) + ' ' + verb.toLowerCase() + ' ' + nm(a.kind, a.item);
        if (a.kind === 'args') desc += ' (bezieht sich auf das Gegenargument der Karte)';
        var rel = 'ergaenzend';
        if (l.type === 'widerspricht') rel = base > 0 ? 'widersprechend' : 'unterstuetzend';
        else if (l.type === 'unterstuetzt' && to) rel = base > 0 ? 'unterstuetzend' : 'widersprechend';
        else if (l.type === 'relativiert' && to) rel = 'relativierend';
        add(pk, p, rel, 'über Verknüpfung: ' + desc, 'link');
      });
    });

    /* 3. Nur thematisch verwandt: gemeinsame Wörter, aber keine gleichartige Aussage */
    matchText(full, text, { synIndex: idx, max: 6 }).forEach(function (m) {
      if (res[key(m.doc.kind, m.doc.id)]) return;
      var o = m.doc.item, cov = m.matched.length / m.total;
      /* Sonderfall: Aussage steht nahezu in der Beschreibung eines belegten Fakts */
      if (m.doc.kind === 'entries' && FACT_TYPES[o.type] && (o.status === 'belegt' || o.status === 'teilweise') && m.matched.length >= 2 && cov >= 0.6) {
        var dn = numbers(o.title + ' ' + (o.claimCore || '') + ' ' + (o.description || ''));
        var diff = stNum.length && dn.length && !stNum.some(function (n) { return dn.indexOf(n) >= 0; });
        add('entries', o, diff ? 'widersprechend' : 'unterstuetzend', (diff ? 'Zahl weicht ab (' + stNum.join(', ') + ' ↔ ' + dn.join(', ') + ') von einem' : 'Stichwörter stehen in einem') + ' belegten Eintrag vom Typ „' + (opts.typeLabel ? opts.typeLabel(o.type) : o.type) + '“ (' + m.matched.join(', ') + ')', 'fakt');
        return;
      }
      add(m.doc.kind, m.doc.item, 'thematisch', 'gemeinsame Wörter: ' + m.matched.join(', ') + ' – kein Widerspruch oder Beleg erkennbar', 'woerter');
    });

    /* 4. Verwandte Quellen: Quellen der gefundenen Einträge und Quellen mit passenden Kernaussagen */
    var srcOut = {}, srcById = {};
    (data.sources || []).forEach(function (s) { srcById[s.id] = s; });
    Object.keys(res).forEach(function (k) {
      var r = res[k], o = title(r.kind, r.id);
      if (!o || r.rel === 'thematisch') return;
      (o.sourceIds || []).forEach(function (sid) {
        var s = srcById[sid]; if (!s) return;
        var x = srcOut[sid] = srcOut[sid] || { id: sid, title: s.title, basis: [] };
        var b = 'genannt in „' + o.title + '“ (' + REL_SHORT[r.rel] + ')';
        if (x.basis.indexOf(b) < 0) x.basis.push(b);
      });
    });
    var sdocs = (data.sources || []).map(function (s) { return { id: s.id, kind: 'sources', item: s, fields: [f('Titel', 5, s.title), f('Kernaussagen', 3, s.keyClaims)] }; });
    matchText(sdocs, text, { synIndex: idx, max: 3 }).forEach(function (m) {
      var x = srcOut[m.doc.id] = srcOut[m.doc.id] || { id: m.doc.id, title: m.doc.item.title, basis: [] };
      x.basis.push('gemeinsame Wörter mit Titel/Kernaussagen: ' + m.matched.join(', '));
    });

    var groups = {};
    REL_ORDER.forEach(function (r) { groups[r] = []; });
    Object.keys(res).forEach(function (k) { groups[res[k].rel].push(res[k]); });
    return { groups: groups, sources: Object.keys(srcOut).map(function (k) { return srcOut[k]; }), anchors: anchors.length,
      negated: stNeg, numbers: stNum };
  }

  /* =====================================================================
   * Antwortassistent (Phase 4, Etappe 5)
   * Baut Antwortentwürfe ausschließlich aus Texten gespeicherter Einträge,
   * Argumentationskarten und Quellen. Es entstehen keine neuen Fakten:
   * Jeder inhaltliche Satz stammt aus einem gespeicherten Datensatz und
   * trägt dessen Belegnummer. Nicht ausreichend belegte Sätze werden markiert.
   * Nur die Überleitungen (z. B. „Erstens“) und der Einleitungssatz kommen
   * aus festen Vorlagen; der Einleitungssatz folgt der Einordnung aus
   * der Zusammenhangsanalyse und ist als Kandidat gekennzeichnet.
   * ===================================================================== */
  var STYLES = { sachlich: 'Sachlich und neutral', argument: 'Argumentativ und präzise', kurz: 'Kurz und pointiert' };
  var REL_RANK = { widersprechend: 0, relativierend: 1, unterstuetzend: 2, ergaenzend: 3, thematisch: 4 };
  var BACKED = { belegt: 1, teilweise: 1, widerlegt: 1, veraltet: 1 };
  function firstSentences(t, n) { return sentences(String(t || '').replace(/\s+/g, ' ').trim()).slice(0, n || 1).join(' '); }
  function endDot(t) { t = String(t || '').trim(); return /[.!?…“”"]$/.test(t) ? t : t + '.'; }
  function clip(t, max) { t = String(t || '').trim(); if (t.length <= max) return t; var c = t.slice(0, max - 1); var sp = c.lastIndexOf(' '); return (sp > max * 0.6 ? c.slice(0, sp) : c).replace(/[,;:\s]+$/, '') + '…'; }

  /* Der inhaltliche Satz eines Datensatzes – immer aus seinem eigenen Text */
  function coreOf(it, SL) {
    if (it.kind === 'args') return { pre: '', text: firstSentences(it.counter, 2) || it.title, from: 'Gegenargument der Karte' };
    var claimLike = it.type === 'behauptung' || it.type === 'meinung';
    if (claimLike && (it.status === 'widerlegt' || it.status === 'veraltet' || it.status === 'umstritten')) {
      var pre = it.status === 'widerlegt' ? 'Die Behauptung „' + it.title + '“ gilt als widerlegt: '
        : it.status === 'veraltet' ? 'Die Angabe „' + it.title + '“ ist veraltet: '
        : 'Ob „' + it.title + '“ zutrifft, ist umstritten: ';
      return { pre: pre, text: firstSentences(it.description, 2) || '', from: 'Beschreibung' };
    }
    if (it.claimCore) return { pre: '', text: it.claimCore, from: 'Kernaussage' };
    return { pre: '', text: firstSentences(it.description, 1) || it.title, from: it.description ? 'Beschreibung' : 'Titel' };
  }
  function backing(it, SL) {
    var n = (it.sources || []).length;
    if (!n) return { ok: false, label: 'nicht belegt: keine Quelle verknüpft' };
    if (BACKED[it.status]) return { ok: true, label: it.status === 'teilweise' ? 'teilweise belegt' : '' };
    return { ok: false, label: 'nicht belegt: Prüfstatus „' + (SL ? SL(it.status) : it.status) + '“' };
  }

  /* input: { claim, items: [{ kind, id, title, type, status, claimCore, description, counter, rel,
               sources: [{ title, publisher, year, url }] }], style, statusLabel }
     Liefert { style, opener, parts: [{ n, text, ok, label }], refs, full, x, chars, unsupported } */
  function draftReply(input) {
    var SL = input.statusLabel, style = STYLES[input.style] ? input.style : 'sachlich';
    var items = (input.items || []).slice().sort(function (a, b) { return (REL_RANK[a.rel] == null ? 3 : REL_RANK[a.rel]) - (REL_RANK[b.rel] == null ? 3 : REL_RANK[b.rel]); });
    var refs = [], parts = [];
    items.forEach(function (it) {
      var c = coreOf(it, SL), b = backing(it, SL);
      if (!String(c.text).trim()) return;
      var n = refs.length + 1;
      refs.push({ n: n, kind: it.kind, id: it.id, title: it.title, status: it.status, rel: it.rel, ok: b.ok, label: b.label, from: c.from, sources: it.sources || [] });
      parts.push({ n: n, pre: c.pre, text: c.text, ok: b.ok, label: b.label, rel: it.rel });
    });
    var rels = {}; items.forEach(function (it) { rels[it.rel] = 1; });
    var claim = String(input.claim || '').replace(/\s+/g, ' ').trim();
    var opener = '', openerNote = '';
    if (style === 'argument') {
      opener = rels.widersprechend ? 'Das lässt sich so nicht halten.' : rels.relativierend ? 'Das ist zu pauschal.' : rels.unterstuetzend ? 'Das ist richtig.' : '';
    } else if (style === 'kurz') {
      opener = rels.widersprechend ? 'Stimmt so nicht.' : rels.relativierend ? 'Zu pauschal.' : rels.unterstuetzend ? 'Richtig.' : '';
    } else if (claim) {
      opener = 'Zur Aussage „' + clip(claim, 120).replace(/[.!?;:,]+$/, '') + '“:';
    }
    if (opener && style !== 'sachlich') openerNote = 'Einleitungssatz folgt der Einordnung der Zusammenhangsanalyse (Kandidat) – bitte prüfen.';

    var ORD = ['Erstens', 'Zweitens', 'Drittens', 'Viertens', 'Fünftens'];
    var sentence = function (p, i) {
      var body = endDot(p.pre + p.text);
      if (style === 'argument') body = (i < ORD.length ? ORD[i] : 'Außerdem') + ': ' + body;
      return body;
    };
    var mark = function (p) { return ' [' + p.n + (p.label ? ' – ' + p.label : '') + ']'; };
    var useParts = parts;
    var srcTitles = []; refs.forEach(function (r) { r.sources.forEach(function (s) { if (srcTitles.indexOf(s.title) < 0) srcTitles.push(s.title); }); });

    var x;
    if (style === 'kurz') {
      /* belegte Aussagen zuerst; so viel, wie in 280 Zeichen passt */
      var ordered = parts.filter(function (p) { return p.ok; }).concat(parts.filter(function (p) { return !p.ok; }));
      var first = ordered[0];
      useParts = [];
      if (first) {
        var ref = refs[first.n - 1], src = ref.sources[0];
        var tail = src ? ' Quelle: ' + clip(src.title, 70) : '';
        var room = 280 - (opener ? opener.length + 1 : 0) - tail.length;
        var body = clip(endDot(first.pre + first.text), Math.max(40, room));
        useParts = [{ n: first.n, pre: '', text: body, ok: first.ok, label: first.label }];
        x = (opener ? opener + ' ' : '') + body + tail;
        var second = ordered[1];
        if (second && second.ok) {
          var add = ' ' + endDot(second.pre + second.text);
          if (x.length + add.length <= 280) { x = (opener ? opener + ' ' : '') + body + add + tail; useParts.push({ n: second.n, pre: '', text: endDot(second.pre + second.text), ok: true, label: second.label }); }
        }
      } else x = opener;
    } else {
      x = [opener].concat(useParts.map(sentence)).filter(Boolean).join(style === 'argument' ? '\n' : ' ') + (srcTitles.length ? '\n\nQuellen: ' + srcTitles.join('; ') : '');
    }
    var usedN = useParts.map(function (p) { return p.n; });
    var usedRefs = refs.filter(function (r) { return usedN.indexOf(r.n) >= 0; });
    var full = [opener].concat(useParts.map(function (p, i) { return (style === 'kurz' ? endDot(p.text) : sentence(p, i)) + mark(p); })).filter(Boolean).join(style === 'argument' ? '\n' : ' ') +
      (usedRefs.length ? '\n\nBelege:\n' + usedRefs.map(function (r) {
        return '[' + r.n + '] ' + r.title + ' (' + (SL ? SL(r.status) : r.status) + ')' + (r.sources.length ? ' – Quelle: ' + r.sources.map(function (s) { return [s.title, s.publisher, s.year].filter(Boolean).join(', ') + (s.url ? ' ' + s.url : ''); }).join('; ') : ' – keine Quelle');
      }).join('\n') : '');
    return { style: style, styleLabel: STYLES[style], opener: opener, openerNote: openerNote, parts: useParts, refs: usedRefs,
      full: full, x: x || '', chars: (x || '').length, unsupported: useParts.filter(function (p) { return !p.ok; }).length };
  }

  /* =====================================================================
   * Post-Formate für X (Phase 5, Etappe 1)
   * Baut einen sachlichen Post nach dem Muster
   *   Kernaussage → Beleg → Abschluss (optional)
   * für die Post-Arten Antwort, eigener Post und Zitat-Post.
   * Wie beim Antwortassistenten stammen alle inhaltlichen Sätze aus
   * gespeicherten Texten; nur Einleitung und Rückfrage sind feste Vorlagen.
   * Ziel: höchstens 280 Zeichen (kein X Premium).
   * ===================================================================== */
  var POST_TYPES = { antwort: 'Antwort', eigen: 'Eigener Post', thread: 'Thread', zitat: 'Zitat-Post' };
  var POST_CLOSE = { keiner: 'Kein Abschluss', frage: 'Rückfrage', schluss: 'Schlussfolgerung' };
  var X_MAX = 280, X_URL = 23;
  var URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;
  var WIDE_RE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}/u;
  /* Zählt ungefähr wie X: Links immer 23 Zeichen, Emojis und
     ostasiatische Schriftzeichen doppelt, Verbinder unsichtbar. */
  function xLength(t) {
    var n = 0;
    t = String(t || '').replace(URL_RE, function () { n += X_URL; return ''; });
    Array.from(t).forEach(function (c) {
      if (c === '‍' || c === '️' || c === '︎') return;
      n += WIDE_RE.test(c) ? 2 : 1;
    });
    return n;
  }
  function noEnd(t) { return String(t || '').trim().replace(/[.!?…:;,]+$/, ''); }

  /* Prüfstatus im Post (Phase 5, Etappe 2)
     Behauptungen/Meinungen mit Status widerlegt, veraltet oder umstritten
     formuliert coreOf bereits als Widerlegung bzw. offene Frage. Für alle
     anderen Einträge gilt: */
  var HEDGE = { teilweise: 'Nach bisherigen Belegen spricht einiges dafür: ', umstritten: 'Nicht abschließend geklärt, aber: ', veraltet: 'Nach älterem Stand: ' };
  function isClaimLike(it) { return it.kind !== 'args' && (it.type === 'behauptung' || it.type === 'meinung'); }
  function refutes(it) { return isClaimLike(it) && (it.status === 'widerlegt' || it.status === 'veraltet' || it.status === 'umstritten'); }
  /* Warnung zu einem Datensatz; null = unbedenklich */
  function statusWarning(it, SL, hedged) {
    var st = SL ? SL(it.status) : it.status;
    if (refutes(it)) return null;
    if (it.status === 'widerlegt') return { level: 'stop', text: 'ist widerlegt und wird nicht als Argument verwendet.' };
    if (HEDGE[it.status]) return { level: 'hedge', text: 'hat den Status „' + st + '“' + (hedged ? ' und ist vorsichtig formuliert.' : '. Vorsichtige Formulierung ist ausgeschaltet.') };
    if (it.status === 'neu' || it.status === 'pruefung') return { level: 'check', text: 'ist noch nicht geprüft (Status „' + st + '“). Vor dem Posten prüfen.' };
    return null;
  }

  /* input: { type, claim, items (wie draftReply, zusätzlich evidence, conclusion), close, statusLabel }
     Liefert { type, typeLabel, text, chars, parts: [{ role, roleLabel, text, n, ok, label }], refs, notes, unsupported } */
  function buildPost(input) {
    var SL = input.statusLabel;
    var type = POST_TYPES[input.type] ? input.type : 'antwort';
    var close = POST_CLOSE[input.close] ? input.close : 'keiner';
    var items = (input.items || []).slice().sort(function (a, b) { return (REL_RANK[a.rel] == null ? 3 : REL_RANK[a.rel]) - (REL_RANK[b.rel] == null ? 3 : REL_RANK[b.rel]); });
    var notes = [], warnings = [];
    var hedgeOn = input.hedge !== false;
    var hedgeOf = function (it) { return hedgeOn && !refutes(it) && HEDGE[it.status] ? HEDGE[it.status] : ''; };
    var cand = [];
    items.forEach(function (it) {
      if (!refutes(it) && it.status === 'widerlegt') { warnings.push({ id: it.id, kind: it.kind, title: it.title, status: it.status, level: 'stop', text: statusWarning(it, SL, hedgeOn).text }); return; }
      var c = coreOf(it, SL), b = backing(it, SL);
      if (String(c.text).trim()) cand.push({ it: it, text: endDot(hedgeOf(it) + c.pre + c.text), ok: b.ok, label: b.label, from: c.from, hedged: !!hedgeOf(it) });
    });
    var res = { type: type, typeLabel: POST_TYPES[type], text: '', chars: 0, parts: [], refs: [], notes: notes, warnings: warnings, unsupported: 0 };
    if (!cand.length) { if (warnings.length) notes.push('Kein verwendbarer Eintrag: Widerlegte Inhalte werden nicht als Argument verwendet.'); return res; }

    /* Kernaussage: der wichtigste Datensatz (Widerspruch vor Relativierung vor Unterstützung) */
    var kern = cand[0];
    /* Beleg: zuerst das Feld „Evidenz“ desselben Eintrags, sonst der nächste – belegte bevorzugt */
    var beleg = null;
    var ev = firstSentences(kern.it.evidence, 1);
    if (ev) beleg = { it: kern.it, text: endDot(ev), ok: kern.ok, label: kern.label, from: 'Evidenz' };
    else {
      var rest = cand.slice(1);
      var pick = rest.filter(function (c) { return c.ok; })[0] || rest[0];
      if (pick) beleg = pick;
    }
    /* Abschluss */
    var abschluss = null;
    if (close === 'frage') {
      abschluss = { text: type === 'antwort' ? 'Worauf stützt du deine Aussage?' : 'Welche Quellen kennt ihr dazu?', tpl: true };
    } else if (close === 'schluss') {
      var withC = cand.map(function (c) { return c.it; }).filter(function (it) { return String(it.conclusion || '').trim(); })[0];
      if (withC) {
        var b2 = backing(withC, SL), sameAsKern = withC === kern.it;
        abschluss = { it: withC, text: endDot((sameAsKern ? '' : hedgeOf(withC)) + firstSentences(withC.conclusion, 1)), ok: b2.ok, label: b2.label, from: 'Schlussfolgerung', hedged: !sameAsKern && !!hedgeOf(withC) };
      } else notes.push('Keiner der gewählten Einträge hat eine Schlussfolgerung. Der Post endet ohne Abschluss.');
    }
    /* Einleitung nur beim eigenen Post: er muss ohne Vorwissen verständlich sein */
    var claim = String(input.claim || '').replace(/\s+/g, ' ').trim();
    var intro = null;
    if ((type === 'eigen' || type === 'thread') && claim) intro = { text: 'Oft heißt es: „' + noEnd(clip(claim, 100)) + '“', tpl: true };

    var ROLE = { einleitung: 'Einleitung', kern: 'Kernaussage', beleg: 'Beleg', abschluss: 'Abschluss' };
    var refIdx = {};
    var refOf = function (it) {
      var key = it.kind + ':' + it.id;
      if (!refIdx[key]) { var b = backing(it, SL); refIdx[key] = { n: res.refs.length + 1, kind: it.kind, id: it.id, title: it.title, status: it.status, ok: b.ok, label: b.label, sources: it.sources || [] }; res.refs.push(refIdx[key]); }
      return refIdx[key];
    };
    var pushPart = function (role, p) {
      var r = p.it ? refOf(p.it) : null;
      res.parts.push({ role: role, roleLabel: ROLE[role], text: p.text, n: r ? r.n : null, from: p.from || 'Vorlage', ok: p.tpl ? true : p.ok, label: p.tpl ? '' : p.label, tpl: !!p.tpl, cut: !!p.cut, hedged: !!p.hedged });
    };
    var finishWarnings = function () {
      res.refs.forEach(function (r) {
        var it = items.filter(function (x) { return x.kind === r.kind && x.id === r.id; })[0];
        var w = it && statusWarning(it, SL, hedgeOn);
        if (w) warnings.push({ id: r.id, kind: r.kind, n: r.n, title: r.title, status: r.status, level: w.level, text: w.text });
      });
      res.follow = buildFollowUp(res.refs);
      res.unsupported = res.parts.filter(function (p) { return !p.ok; }).length;
    };

    /* Thread (Phase 5, Etappe 3): alle gewählten Einträge, je Kernaussage + Evidenz,
       automatisch an Satzgrenzen auf nummerierte Posts verteilt */
    if (type === 'thread') {
      if (intro) pushPart('einleitung', intro);
      cand.forEach(function (c) {
        pushPart('kern', c);
        var evT = firstSentences(c.it.evidence, 2);
        if (evT) pushPart('beleg', { it: c.it, text: endDot(evT), ok: c.ok, label: c.label, from: 'Evidenz' });
      });
      if (abschluss && abschluss.it && !refIdx[abschluss.it.kind + ':' + abschluss.it.id]) abschluss = null;
      if (abschluss) pushPart('abschluss', abschluss);
      res.posts = splitThread(res.parts.map(function (p) { return p.text; }));
      res.text = res.posts.join('\n\n');
      res.chars = res.posts.reduce(function (m, t) { return Math.max(m, xLength(t)); }, 0);
      finishWarnings();
      return res;
    }

    var sep = type === 'eigen' ? '\n\n' : ' ';
    var compose = function () { return [intro, kern, beleg, abschluss].filter(Boolean).map(function (p) { return p.text; }).join(sep); };
    var fits = function () { return xLength(compose()) <= X_MAX; };
    /* Kürzen: Einleitung, dann Abschluss weglassen, dann Beleg kürzen/weglassen, zuletzt Kernaussage kürzen */
    if (!fits() && intro) { intro = null; notes.push('Einleitung weggelassen, damit der Post in 280 Zeichen passt.'); }
    if (!fits() && abschluss) { abschluss = null; notes.push('Abschluss weggelassen, damit der Post in 280 Zeichen passt.'); }
    if (!fits() && beleg) {
      var roomB = X_MAX - xLength(kern.text) - sep.length;
      if (roomB >= 60) { beleg = Object.assign({}, beleg, { text: clip(beleg.text, roomB), cut: true }); notes.push('Beleg gekürzt (…). Bitte prüfen, ob der Sinn erhalten bleibt.'); }
      else { beleg = null; notes.push('Beleg weggelassen, weil die Kernaussage allein schon fast 280 Zeichen hat.'); }
    }
    if (!fits()) { kern = Object.assign({}, kern, { text: clip(kern.text, X_MAX - (beleg ? xLength(beleg.text) + sep.length : 0)), cut: true }); notes.push('Kernaussage gekürzt (…). Bitte prüfen, ob der Sinn erhalten bleibt.'); }

    [['einleitung', intro], ['kern', kern], ['beleg', beleg], ['abschluss', abschluss]].forEach(function (x) { if (x[1]) pushPart(x[0], x[1]); });
    res.text = compose();
    res.chars = xLength(res.text);
    finishWarnings();
    return res;
  }

  /* Thread aufteilen (Phase 5, Etappe 3)
     segments: Absätze (z. B. Kernaussage, Beleg). Verteilt Sätze auf Posts mit
     höchstens 280 Zeichen inklusive Nummer „1/4 “. Ein Satz wird nur dann an
     Wortgrenzen getrennt, wenn er allein nicht in einen Post passt. */
  function splitThread(segments, max) {
    max = max || X_MAX;
    var units = [];
    (segments || []).forEach(function (seg) {
      var ss = sentences(String(seg || '').replace(/[ \t]+/g, ' ').trim());
      if (!ss.length && String(seg || '').trim()) ss = [String(seg).trim()];
      ss.forEach(function (t, i) { units.push({ text: t, para: i === 0 }); });
    });
    if (!units.length) return [];
    var pack = function (room) {
      var out = [], cur = '';
      var put = function (t, para) {
        var j = cur ? (para ? '\n\n' : ' ') : '';
        if (xLength(cur + j + t) <= room) { cur += j + t; return; }
        if (cur) { out.push(cur); cur = ''; }
        if (xLength(t) <= room) { cur = t; return; }
        /* Satz zu lang: an Wortgrenzen trennen */
        t.split(' ').forEach(function (w) {
          var j2 = cur ? ' ' : '';
          if (xLength(cur + j2 + w) <= room) cur += j2 + w;
          else { if (cur) out.push(cur); cur = w; }
        });
      };
      units.forEach(function (u) { put(u.text, u.para); });
      if (cur) out.push(cur);
      return out;
    };
    var n = 1, posts = pack(max);
    if (posts.length === 1) return posts;
    for (var k = 0; k < 6; k++) {
      n = posts.length;
      posts = pack(max - xLength(n + '/' + n + ' '));
      if (posts.length <= n) break;
    }
    n = posts.length;
    return posts.map(function (t, i) { return (i + 1) + '/' + n + ' ' + t; });
  }

  /* Quellen als eigene Folgeantwort (Phase 5, Etappe 2)
     Der Post selbst bleibt ohne Link; die Quellen der verwendeten Einträge
     kommen in eine zweite Antwort, ebenfalls höchstens 280 Zeichen. */
  function buildFollowUp(refs) {
    var seen = {}, src = [];
    (refs || []).forEach(function (r) { (r.sources || []).forEach(function (s) {
      var k = s.id || (s.title + '|' + (s.url || ''));
      if (!seen[k] && (s.title || s.url)) { seen[k] = 1; src.push(s); }
    }); });
    var res = { text: '', chars: 0, sources: src, used: 0, notes: [] };
    if (!src.length) return res;
    var line = function (s, tmax, withPub) {
      var meta = [withPub ? s.publisher : '', s.year].filter(Boolean).join(', ');
      var t = s.title ? clip(s.title, tmax) : '';
      return [t + (meta ? (t ? ' (' + meta + ')' : meta) : ''), s.url || ''].filter(Boolean).join(' ');
    };
    var make = function (list, tmax, withPub) {
      return list.length === 1 ? 'Quelle: ' + line(list[0], tmax, withPub)
        : 'Quellen:\n' + list.map(function (s) { return '• ' + line(s, tmax, withPub); }).join('\n');
    };
    var steps = [[200, true], [70, true], [45, false], [30, false]];
    for (var cnt = src.length; cnt >= 1; cnt--) {
      var list = src.slice(0, cnt);
      for (var i = 0; i < steps.length; i++) {
        var t = make(list, steps[i][0], steps[i][1]);
        if (xLength(t) <= X_MAX) {
          res.text = t; res.chars = xLength(t); res.used = cnt;
          if (i > 0) res.notes.push('Titel gekürzt' + (steps[i][1] ? '' : ' und Herausgeber weggelassen') + ', damit die Folgeantwort in 280 Zeichen passt.');
          if (cnt < src.length) res.notes.push((src.length - cnt) + (src.length - cnt === 1 ? ' Quelle passt' : ' Quellen passen') + ' nicht mehr hinein: ' + src.slice(cnt).map(function (s) { return s.title || s.url; }).join('; ') + '.');
          return res;
        }
      }
    }
    var one = clip(make([src[0]], 30, false), X_MAX);
    res.text = one; res.chars = xLength(one); res.used = 1; res.notes.push('Folgeantwort stark gekürzt. Bitte prüfen.');
    return res;
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
    CLAIM_KINDS: KINDS,
    relate: relate,
    numbers: numbers,
    REL_ORDER: REL_ORDER,
    REL_LABEL: REL_LABEL,
    draftReply: draftReply,
    STYLES: STYLES,
    buildPost: buildPost,
    xLength: xLength,
    buildFollowUp: buildFollowUp,
    splitThread: splitThread,
    POST_TYPES: POST_TYPES,
    POST_CLOSE: POST_CLOSE,
    X_MAX: X_MAX
  };
})(typeof self !== 'undefined' ? self : this);
