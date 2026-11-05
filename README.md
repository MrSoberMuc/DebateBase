# DebateBase 3

Persönliche Wissensdatenbank für Diskussionen auf X (Twitter): Fakten, Definitionen, Studien, Behauptungen, Argumente und Gegenargumente mit Quellen, Prüfstatus und Verknüpfungen.

**App öffnen:** https://mrsobermuc.github.io/DebateBase/

- Läuft als installierbare App auf Android (Progressive Web App)
- Funktioniert nach dem ersten Laden auch ohne Internet
- **Alle Daten bleiben auf deinem Gerät.** Der Server (GitHub Pages) liefert nur die Programmdateien aus. Es gibt kein Konto, keine Cloud, keine KI-Dienste.

---

## Inhalt

1. [Installieren](#1-installieren)
2. [Bereiche der App](#2-bereiche-der-app)
3. [X-Beiträge teilen](#3-x-beiträge-teilen)
4. [Datensicherung](#4-datensicherung)
5. [Daten aus Version 2 übernehmen](#5-daten-aus-version-2-übernehmen)
6. [Updates](#6-updates)
7. [Wenn etwas nicht klappt](#7-wenn-etwas-nicht-klappt)
8. [Technik für Neugierige](#8-technik-für-neugierige)

---

## 1. Installieren

1. Die Adresse oben in **Chrome** auf dem Handy öffnen (nicht im Inkognito-Modus).
2. Die Seite einmal neu laden. Unter **Optionen → App** sollte „Bereit: startet auch ohne Internet“ stehen.
3. Auf **Installieren** tippen (Dashboard oder Optionen) oder in Chrome oben rechts **⋮ → App installieren**.
4. DebateBase erscheint auf dem Startbildschirm und öffnet sich ohne Browserleiste.

Browser und installierte App nutzen **dieselbe Datenbank** auf dem Gerät.

## 2. Bereiche der App

| Bereich | Wofür |
| --- | --- |
| **Start** (Dashboard) | Überblick, Schnellzugriff, offene Recherchen, Prüfstatus, Hinweise (geteilte Beiträge, Sicherung) |
| **Wissen** | Wissenseinträge (Definition, Fakt, Statistik, Studie, Behauptung, Argument, Gegenargument, Meinung, offene Frage) mit Suche und Filtern |
| **Argumente** | Argumentationskarten: Behauptung der Gegenseite + Gegenargument |
| **Quellen** | Belege mit Link, Herausgeber, Jahr; zeigt, wo sie zitiert werden |
| **Diskussion** | Schnellsuche während einer Diskussion, „Für X kopieren“ (max. 280 Zeichen) |
| **Optionen** | Darstellung, App-Status, Datensicherheit, Datenprüfung, Sicherungen, Import, Teilen |

**Prüfstatus:** Neu · In Prüfung · Belegt · Teilweise belegt · Widerlegt · Umstritten · Veraltet

**Verknüpfungen** zwischen Einträgen und Karten: Unterstützt · Widerspricht · Ergänzt · Relativiert · Basiert auf · Zitiert

### Intelligente Suche (ab Version 3.1.0)

Die Suche in Wissen, Argumente, Quellen und Diskussion findet auch:

- **Wortformen:** „Sanktion“ findet „Sanktionen“
- **verwandte Begriffe:** „UNO“ findet „Vereinte Nationen“ (eigene Gruppen unter Optionen → Verwandte Begriffe)
- **kleine Tippfehler:** „Sanktoinen“ findet „Sanktionen“
- **Wortteile:** „Klima“ findet „Klimawandel“

Treffer im Titel und in den Tags zählen mehr als Treffer in der Beschreibung (Sortierung „Relevanz“). Unter jedem Treffer steht **„Warum“**. Enthält kein Eintrag alle Suchwörter, zeigt die App **Teiltreffer** und nennt die fehlenden Wörter. In jeder Detailansicht schlägt **„Verwandte Inhalte“** passende Einträge und Karten vor, jeweils mit Begründung.

**Wichtig:** Das ist keine KI. Die App vergleicht Wörter nach festen Regeln und versteht keine Bedeutung. Alles läuft auf dem Gerät.

### Quellenanalyse (ab Version 3.2.0)

Quellen können zusätzlich zu Titel, Herausgeber, Jahr, Art, Link und Notiz strukturiert bewertet werden (alles freiwillig): **Autor**, **genaues Datum**, **Methodik**, **Kernaussagen**, **Einschränkungen** und **Interessenkonflikte** (nicht geprüft / keine bekannt / vorhanden). Neue Quellentypen: Buch, Rede oder Interview, Social-Media-Beitrag.

- **„Doku x/y“** zeigt, wie viele Angaben dokumentiert sind. Die Methodik zählt nur bei Studie, Statistik und Fachartikel.
- **„Verknüpfte Behauptungen“** listet automatisch alle Behauptungen, Argumente, Meinungen und Argumentationskarten, die die Quelle nennen.
- DebateBase **ergänzt keine Angaben selbst**. Leere Felder erscheinen als „nicht angegeben“. Nur das Jahr wird aus einem eingegebenen Datum übernommen.

### Behauptung prüfen (ab Version 3.3.0)

Im Bereich **Diskussion → Behauptung prüfen** fügst du einen Text oder X-Beitrag ein (oder tippst bei einem gespeicherten X-Beitrag auf **Behauptungen prüfen**). DebateBase

- entfernt Links, Antwort-Erwähnungen, Emojis und Thread-Zähler und merkt sich Hashtags,
- zerlegt den Text in einzelne Aussagen (auch Teilsätze mit „; “ oder „, aber …“),
- ordnet jede Aussage nach Regeln ein: *möglicherweise überprüfbare Behauptung*, *Behauptung mit Wertung*, *eher Meinung*, *Frage*, *Einordnung unklar*,
- nennt die erkannten Merkmale (Zahl, Zeitangabe, Zuschreibung, Ursache und Wirkung, Vergleich, Pauschalaussage, Vorhersage, vage Angabe, Wertung, Verneinung),
- zeigt passende gespeicherte Einträge und Karten (über gemeinsame Wörter) und
- listet **offene Fragen** (z. B. „Woher stammt die Zahl?“, „Kein passender Eintrag – noch zu recherchieren“).

Jede Einordnung ist als **unsicher** gekennzeichnet: Es gibt keine KI, die App versteht keine Bedeutung und erkennt keine Ironie. Das Ergebnis wird **nicht gespeichert**. Einzelne Aussagen übernimmst du mit **Als Eintrag speichern** (Formular vorbelegt, Speichern erst nach Bestätigung).

### Zusammenhänge und Widersprüche (ab Version 3.4.0)

Bei **Behauptung prüfen** zeigt DebateBase zu jeder Aussage, wie sie zu deinen gespeicherten Inhalten steht: **widersprechend (Kandidaten)**, **unterstützend**, **relativierend**, **ergänzend**, **nur thematisch verwandt** und **verwandte Quellen**. Unter jedem Treffer steht die **Grundlage**, also der gespeicherte Eintrag und die Regel:

- gleichartige Aussage + Prüfstatus (z. B. ein Eintrag „Widerlegt“ oder „Veraltet“ → Widerspruchskandidat),
- Behauptung der Gegenseite einer Argumentationskarte (ihr Gegenargument widerspricht),
- vorhandene Verknüpfungen (Widerspricht, Unterstützt, Relativiert …),
- abweichende Zahlen und eine Verneinung nur auf einer Seite.

Gemeinsame Wörter allein ergeben nie einen Widerspruch, sondern „nur thematisch verwandt“. Alle Ergebnisse sind Hinweise nach festen Regeln, keine Urteile.

### Antwort entwerfen (ab Version 3.5.0)

Unter **Diskussion → Antwort entwerfen** entsteht ein Antwortentwurf **nur aus deinen gespeicherten Einträgen, Argumentationskarten und Quellen**:

1. Optional eingeben, worauf du antwortest, und **Passende Einträge vorschlagen** tippen. Die Auswahl kommt aus der Zusammenhangsanalyse. Oder Einträge über die Suche selbst hinzufügen. Auch aus **Behauptung prüfen** gibt es bei jeder Aussage den Knopf **Antwort entwerfen**.
2. Stil wählen: **Sachlich und neutral**, **Argumentativ und präzise** (Erstens, Zweitens …) oder **Kurz und pointiert** (höchstens 280 Zeichen).
3. Jeder Satz stammt aus einem gespeicherten Eintrag (Kernaussage, Beschreibung oder Gegenargument) und trägt eine Belegnummer [1]. Sätze ohne Quelle oder mit ungeprüftem Status sind als **nicht belegt** markiert.
4. **Für X kopieren** (ohne Nummern, mit „Quellen: …“) oder **Mit Belegen kopieren** (mit Nummern und Belegliste).

Es entstehen keine neuen Fakten. Nur Überleitungen und der Einleitungssatz kommen aus festen Vorlagen. Der Entwurf wird nicht gespeichert. Prüfe und bearbeite ihn vor dem Posten.

### KI-Auftrag kopieren (optional, ab Version 3.6.0)

Unter **Optionen → KI-Erweiterung** einschalten (standardmäßig aus). Danach gibt es in **Behauptung prüfen** und **Antwort entwerfen** den Knopf **KI-Auftrag erstellen**:

- DebateBase zeigt den **vollständigen Prompt** als Vorschau: Aufgabe, dein Text (ohne @-Namen und Links, auf Wunsch mit), die passenden Einträge, Karten und Quellen mit ihren Kennungen und ein festes Antwortformat.
- Einträge lassen sich abwählen. Eigene Notizen und Schlussfolgerungen sind nie enthalten.
- **Prompt kopieren** legt genau diesen Text in die Zwischenablage. Du fügst ihn selbst in eine KI deiner Wahl ein. **DebateBase sendet nichts ins Internet** und braucht keine Zugangsdaten.
- Ein Protokoll auf dem Gerät zählt, wann welcher Auftrag kopiert wurde (löschbar).

Die KI antwortet mit einem Datenblock. Ab Version 3.7.0 fügst du ihn über **KI-Antwort einfügen** wieder ein:

- DebateBase findet den Block (auch mit Text davor oder danach), repariert kleine Formatfehler und meldet verständlich, wenn etwas fehlt oder abgeschnitten ist.
- Die **Vorschau** zeigt die Einschätzung der KI (ungeprüft, wird nicht gespeichert), einen Antworttext zum Kopieren und alle vorgeschlagenen Einträge, Quellen, Karten und Verknüpfungen mit Auswahl.
- **Dubletten** (ähnlicher Titel, gleicher Link) werden erkannt; doppelte Quellen werden standardmäßig mit der vorhandenen verknüpft.
- Bei Verknüpfungen helfen **„Richtung umdrehen“** und bei Karten **„Die KI meinte die Behauptung der Gegenseite“**, typische KI-Fehler zu korrigieren.
- **Übernehmen** (ab Version 3.8.0): Vorher wird automatisch eine Sicherung angelegt. Danach wird alles in einem Schritt gespeichert und Datensatz für Datensatz kontrolliert. Es entstehen nur neue Datensätze; vorhandene werden nie verändert.
- Alles Übernommene hat den Prüfstatus **„Neu“** und ist als **„KI-Vorschlag“** gekennzeichnet. Das Dashboard zeigt, wie viele KI-Vorschläge noch ungeprüft sind; die Suche nach „KI-Vorschlag“ findet sie.
- Rückgängig machen: Optionen → Automatische Sicherungen → „Vor Übernahme einer KI-Antwort“.

## 3. X-Beiträge teilen

Voraussetzung: DebateBase ist **installiert**.

1. In der X-App bei einem Beitrag auf **Teilen** tippen und **DebateBase** wählen.
2. DebateBase öffnet einen **Entwurf**. Noch ist nichts gespeichert.
3. Prüfen: Link und Text sind getrennt, der Link ist geprüft, Duplikate werden gemeldet.
4. Entscheiden: **Als X-Beitrag speichern**, **+ Wissenseintrag**, **+ Behauptung**, **Später entscheiden** oder **Verwerfen**.

Gut zu wissen:

- Übergibt X **nur den Link**, zeigt DebateBase das deutlich an. Den Text kannst du in der X-App kopieren und einfügen. DebateBase ruft bei X nie selbst etwas ab.
- Die übergebenen Originaldaten werden unverändert mit dem Beitrag gespeichert.
- Nicht entschiedene Beiträge warten im Eingang (Hinweis auf dem Dashboard).
- Ohne Installation: **X-Beitrag erfassen** und Link/Text von Hand einfügen.

## 4. Datensicherung

Deine Daten liegen in Chrome auf dem Handy. Sie gehen verloren, wenn du Chrome-Daten löschst, Chrome zurücksetzt oder das Handy verlierst. Deshalb:

- **Regelmäßig eine Sicherungsdatei herunterladen:** Optionen → Datensicherung → **Sicherungsdatei herunterladen**. Die Datei landet im Ordner „Downloads“. Lege sie zusätzlich z. B. in Google Drive ab. Das Dashboard erinnert dich, wenn die letzte Datei älter als 14 Tage ist.
- **Automatische Sicherungen** in der App: Vor jedem Import, Zurücksetzen, Löschen und Wiederherstellen wird der aktuelle Stand gesichert (die letzten 5). Wiederherstellen unter Optionen → Automatische Sicherungen. Diese Sicherungen liegen **auf demselben Gerät** und ersetzen keine Sicherungsdatei.
- **Wiederherstellen aus einer Datei:** Optionen → **Daten übernehmen oder Sicherung wiederherstellen** → Datei wählen → **Komplett ersetzen** → `ERSETZEN` eintippen.
- **Datenprüfung** (Optionen): findet Verweise ins Leere, z. B. eine Verknüpfung zu einem gelöschten Eintrag. Sie löscht nichts.

## 5. Daten aus Version 2 übernehmen

Version 2 lief als Claude-Artifact. Dessen Speicher gehört zu einer anderen Webadresse und kann von dieser App **nicht direkt gelesen** werden. Der Weg führt über den Export:

1. Version 2 öffnen → **Optionen** → **Vollständigen Export (JSON) anzeigen** → **JSON kopieren**.
2. Den Text zusätzlich aufbewahren (z. B. per Mail an dich selbst).
3. In DebateBase 3: **Daten aus Version 2 übernehmen** (Dashboard) oder Optionen → **Daten übernehmen …**, Text einfügen, **Prüfen**.
4. Vorschau ansehen. Noch ist nichts gespeichert. Bei Konflikten (gleiche ID, anderer Inhalt) entscheidest du: **Vorhandene behalten**, **Durch Datei ersetzen** oder **Beide behalten**.
5. **Importieren.** Danach liest die App alles neu ein und vergleicht es Datensatz für Datensatz („Nachkontrolle“).
6. Gleich danach eine Sicherungsdatei herunterladen.

Erkannt werden Exporte aus Version 1, Version 2 und Sicherungsdateien von Version 3. Alle Felder werden unverändert übernommen, auch unbekannte. Der Import geschieht in einem Schritt: entweder vollständig oder gar nicht.

## 6. Updates

Wenn eine neue Version veröffentlicht ist, erscheint in der App **„Eine neue Version von DebateBase ist bereit“**. Tippe auf **Jetzt aktualisieren**. Ohne deine Bestätigung wird nichts getauscht. Manuell: Optionen → App → **Nach Updates suchen**. Updates ändern deine Daten nicht.

## 7. Wenn etwas nicht klappt

| Problem | Lösung |
| --- | --- |
| Rote Meldung „Nicht dauerhaft gespeichert“ | Chrome nicht im Inkognito-Modus verwenden. App neu laden. |
| „Installieren“ fehlt | Seite einmal neu laden und kurz warten. Sonst Chrome **⋮ → App installieren** bzw. **Zum Startbildschirm hinzufügen**. |
| DebateBase fehlt im Teilen-Menü | App muss installiert sein. Nach einem Update mit neuer Teilen-Funktion ggf. **deinstallieren und neu installieren** (Daten bleiben erhalten, vorher trotzdem Sicherungsdatei herunterladen). |
| Import meldet „abgeschnitten“ | Beim Kopieren ging ein Teil verloren. In Version 2 erneut **JSON kopieren** und vollständig einfügen. |
| Nach dem Import fehlt etwas | „Bericht kopieren“ und prüfen. Stand vor dem Import: Optionen → Automatische Sicherungen → Wiederherstellen. |
| Schrift sieht offline anders aus | Die Schriften werden beim ersten Start mit Internet gespeichert. Ohne sie nutzt die App die Android-Schrift. Funktion ist nicht betroffen. |
| Andere Fehler | Optionen → Datenprüfung ansehen; Sicherungsdatei herunterladen; Fehlerbericht kopieren. |

## 8. Technik für Neugierige

### Dateien

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Grundgerüst der Seite |
| `styles.css` | Gestaltung (Hell/Dunkel, Mobile First) |
| `app.js` | Oberfläche, Bedienung, Teilen-Eingang, Installation |
| `db.js` | Datenbank (IndexedDB) mit Versionierung und Transaktionen |
| `migrate.js` | Import: Format erkennen, prüfen, Konflikte, Nachkontrolle |
| `ki.js` | Optionale KI-Erweiterung: erzeugt den kopierbaren Prompt (sendet nichts) |
| `analyse.js` | Lokale Analyse ohne KI: intelligente Suche, verwandte Inhalte (Phase 4) |
| `service-worker.js` | Offline-Speicher der App-Dateien, Updates, Empfang geteilter Beiträge |
| `manifest.json` | Angaben für Installation und Teilen-Ziel |
| `icons/` | App-Icons (erzeugt mit `tools/make-icons.py`) |
| `tests/` | Automatische Tests (für den Betrieb nicht nötig) |
| `GERAETETEST.md` | Checkliste für den Test auf dem Android-Gerät |

### Datenbank „debatebase“ (IndexedDB, Version 1)

`entries`, `args`, `sources`, `links`, `posts` (Datensätze) · `topics`, `tags` (automatisch gepflegt) · `settings`, `meta` · `inbox` (geteilte Beiträge vor der Entscheidung) · `backups` (automatische Sicherungen)

Jede Änderung wird sofort als Transaktion gespeichert („Write-through“). Spätere Änderungen am Aufbau laufen als nummerierte Schritte in `db.js` (`MIGRATIONS`), ohne vorhandene Daten zu verlieren.

### Neue Version veröffentlichen

1. Dateien ändern.
2. In `service-worker.js` die `VERSION` erhöhen, neue Dateien in `APP_FILES` eintragen. In `app.js` `APP_VERSION` anpassen.
3. Hochladen (Branch `main`). GitHub Pages veröffentlicht automatisch.

### Automatische Tests

Benötigt Node.js, Playwright und Google Chrome:

```
node tests/run-all.mjs
```

Die Tests laufen in Chrome ohne Bildschirm. Der Testserver liegt wie GitHub Pages in einem Unterordner. Sie prüfen u. a. Speichern und Neustart, Import und Konflikte, Datei-Export, Installierbarkeit, Offline-Betrieb, Updates und verschiedene Varianten des Android-Teilens. **Sie ersetzen nicht den Test auf dem echten Gerät** (siehe `GERAETETEST.md`).
