# DebateBase 3 – Test auf dem Android-Gerät

Diese Checkliste prüft, was die automatischen Tests **nicht** prüfen können: echte Installation, die echte X-App, Neustarts und Flugmodus.

**Vorher:** Optionen → **Sicherungsdatei herunterladen**.

Ergebnis je Punkt notieren: ✅ klappt · ❌ klappt nicht (was ist passiert?)

## A. Installation und Start

- [ ] A1 App ist installiert und startet vom Startbildschirm **ohne Browserleiste**.
- [ ] A2 Optionen → App zeigt „Als App installiert“ und „Bereit: startet auch ohne Internet“.
- [ ] A3 Optionen → Datensicherheit zeigt „Schutz vor Löschen: Aktiv“. *(Falls nicht: notieren, kein Fehler der App.)*
- [ ] A4 Hell-, Dunkel- und Systemmodus wechseln; Statusleiste und Farben passen.

## B. Daten und Neustart

- [ ] B1 Neuen Wissenseintrag mit Quelle, Tags und Zusatzfeld anlegen.
- [ ] B2 App ganz schließen (aus „Zuletzt verwendet“ wegwischen) und neu starten: Eintrag ist da.
- [ ] B3 **Handy neu starten**, App öffnen: Eintrag ist da.
- [ ] B4 Eintrag bearbeiten, dann löschen (zweimal tippen); Verknüpfungen werden mit entfernt.
- [ ] B5 Argumentationskarte anlegen und mit einem Eintrag verknüpfen.
- [ ] B6 Optionen → Datenprüfung: „Keine Auffälligkeiten“.

## C. Offline (Flugmodus)

- [ ] C1 Flugmodus an, App neu starten: startet, oben steht „Offline“.
- [ ] C2 Alle sechs Bereiche öffnen, suchen, filtern.
- [ ] C3 Eintrag anlegen und bearbeiten.
- [ ] C4 Sicherungsdatei herunterladen (offline).
- [ ] C5 Schrift sieht aus wie online. *(Falls nicht: notieren.)*
- [ ] C6 Flugmodus aus: alles noch da.

## D. Teilen aus der X-App

- [ ] D1 In der X-App: Beitrag → Teilen → **DebateBase** ist in der Liste.
- [ ] D2 Nach dem Teilen öffnet sich der Entwurf „Geteilter X-Beitrag“.
- [ ] D3 Was kam an? (unter „Übergebene Originaldaten“ nachsehen) – Text: ja / nein · Link: ja / nein · Titel: ja / nein
- [ ] D4 Link zeigt „X-Link geprüft“, Text und Link stehen getrennt.
- [ ] D5 Speichern → Beitrag erscheint unter Diskussion → Gespeicherte X-Beiträge.
- [ ] D6 Denselben Beitrag nochmal teilen → „Dieser Beitrag ist bereits gespeichert“.
- [ ] D7 Einen Beitrag teilen und **Später entscheiden** → Dashboard zeigt „1 geteilter Beitrag wartet“.
- [ ] D8 Im Flugmodus teilen → Entwurf erscheint trotzdem.
- [ ] D9 „Speichern + Behauptung“ → Eintrag zeigt unter „Herkunft“ den X-Beitrag.

## E. Sicherung und Wiederherstellung

- [ ] E1 Sicherungsdatei liegt im Ordner „Downloads“ (Dateien-App).
- [ ] E2 Optionen → Daten übernehmen → diese Datei wählen → Vorschau zeigt „schon vorhanden“, Importieren ist gesperrt.
- [ ] E3 Einen Eintrag ändern, dieselbe Datei erneut wählen → 1 Konflikt → „Beide behalten“ → beide Versionen sind da.
- [ ] E4 Komplett ersetzen mit der Datei (`ERSETZEN`) → Stand der Datei ist wieder da, „Nachkontrolle: X von X“.
- [ ] E5 Optionen → Automatische Sicherungen → ältere Sicherung wiederherstellen.

## F. Bedienung

- [ ] F1 Alles mit einer Hand erreichbar (untere Leiste, „Neu“-Knopf).
- [ ] F2 Nirgends lässt sich die Seite seitlich verschieben.
- [ ] F3 Lange Titel und Links werden umgebrochen, nichts ragt heraus.
- [ ] F4 „Für X kopieren“ im Diskussionsmodus → in X einfügen klappt.

## H. Phase 4, Etappe 1: Intelligente Suche (ab Version 3.1.0)

*Mit den Beispieldaten oder eigenen Einträgen testen. Erst das Update (G1) durchführen.*

- [ ] H1 Wissen → „Sanktion“ suchen: der Eintrag zu Wirtschaftssanktionen erscheint, darunter „Warum: Wortform …“.
- [ ] H2 „UNO“ suchen: der Eintrag zu den Vereinten Nationen erscheint („verwandter Begriff …“).
- [ ] H3 Mit Tippfehler suchen, z. B. „Sanktoinen“: Treffer mit „ähnliche Schreibweise“.
- [ ] H4 „klima“ suchen: Sortierung „Relevanz“, der Eintrag mit „Klima“ im Titel steht oben. Auf „A bis Z“ umstellen klappt.
- [ ] H5 Zwei Wörter suchen, die nie zusammen vorkommen (z. B. „Ozonschicht Sanktionen“): Hinweis „Teiltreffer“ und „nicht gefunden: …“.
- [ ] H6 Einen Eintrag öffnen: unten „Verwandte Inhalte“ mit Begründung; das Ketten-Symbol öffnet „Neue Verknüpfung“ mit vorausgewähltem Partner.
- [ ] H7 Optionen → „Verwandte Begriffe“: eine eigene Gruppe speichern, App neu starten, Suche nutzt sie.
- [ ] H8 Flugmodus: Suche mit Begründungen funktioniert.
- [ ] H9 Nach dem Update: Anzahl der Einträge, Quellen, Karten und Verknüpfungen wie vorher (Optionen → Datensicherheit).

## I. Phase 4, Etappe 2: Quellenanalyse (ab Version 3.2.0)

- [ ] I1 Quellen: Jede Karte zeigt „Doku x/y“. Eine bestehende Quelle öffnen: Leere Angaben stehen als „nicht angegeben“ bzw. „nicht geprüft“ da, die bisherigen Angaben sind unverändert.
- [ ] I2 Bestehende Quelle bearbeiten und ohne Änderung speichern: Titel, Herausgeber, Jahr, Art, Link und Notiz sind gleich geblieben.
- [ ] I3 Neue Quelle: Autor, genaues Datum (Kalender öffnet sich), „Quellenbewertung“ aufklappen, Methodik, Kernaussagen, Einschränkungen ausfüllen, Interessenkonflikte „Vorhanden“ + Beschreibung → Speichern → „Doku 7/7“.
- [ ] I4 Jahr 2015 und Datum aus 2013 eingeben → Fehlermeldung „passen nicht zusammen“.
- [ ] I5 Quelle „Retraction of Wakefield …“ öffnen → „Verknüpfte Behauptungen“ zeigt „Impfstoffe verursachen Autismus“ (Widerlegt).
- [ ] I6 Quellen-Suche nach einem Autor oder einem Wort aus den Kernaussagen findet die Quelle.

## J. Phase 4, Etappe 3: Behauptung prüfen (ab Version 3.3.0)

- [ ] J1 Diskussion: oben Umschalter „Suchen“ / „Behauptung prüfen“. Die Suche funktioniert wie bisher.
- [ ] J2 „Behauptung prüfen“: Hinweis „Regelbasierte Analyse, keine KI“ ist sichtbar.
- [ ] J3 Diesen Text einfügen und „Analysieren“: *Die EU hat 28 Mitgliedstaaten, aber das weiß ja keiner. Experten sagen, Sanktionen wirken nie. Ich finde das lächerlich. Warum sagt das niemand?* → 5 Aussagen, jede mit „unsicher“; Aussage 1 zeigt den Eintrag „Die EU hat 28 Mitgliedstaaten“ (Veraltet) und offene Fragen.
- [ ] J4 Bei einer Aussage „Als Eintrag speichern“ → Formular ist vorbelegt (Typ Behauptung, Status Neu). Erst „Speichern“ legt den Eintrag an.
- [ ] J5 Gespeicherten X-Beitrag öffnen → „Behauptungen prüfen“ → Analyse erscheint mit „Aus X-Beitrag von @…“. Gespeicherte Behauptung zeigt unter „Herkunft“ den Beitrag.
- [ ] J6 Einen echten Beitrag aus X teilen, speichern und prüfen lassen. Notieren, was gut und was falsch erkannt wurde.
- [ ] J7 App ganz schließen und neu öffnen: Die Analyse ist weg (sie wird absichtlich nicht gespeichert), alle Einträge sind da.

## K. Phase 4, Etappe 4: Zusammenhänge und Widersprüche (ab Version 3.4.0)

*Mit den Beispieldaten testen (Diskussion → Behauptung prüfen).*

- [ ] K1 *Die EU hat 28 Mitgliedstaaten.* → „Widersprechende Inhalte (Kandidaten)“ mit dem Eintrag (Veraltet) und „Grundlage: … als „Veraltet“ markiert“; oben „Mit Widerspruchskandidaten: 1“.
- [ ] K2 *Die EU hat 27 Mitgliedstaaten.* → derselbe Eintrag unter „Unterstützende Inhalte“ mit „Zahl weicht ab (27 ↔ 28)“.
- [ ] K3 *Impfstoffe verursachen keinen Autismus.* → unterstützend, Grundlage nennt „Verneinung nur auf einer Seite“.
- [ ] K4 *Atomwaffen haben seit 1945 einen direkten Krieg zwischen Großmächten verhindert.* → Karte „Abschreckung …“ widersprechend, „Beinahe-Eskalationen …“ relativierend „über Verknüpfung“.
- [ ] K5 *Der Kalte Krieg war eine spannende Zeit.* → nur „Nur thematisch verwandt“, kein Widerspruch.
- [ ] K6 Ein Ergebnis antippen → der gespeicherte Eintrag bzw. die Quelle öffnet sich.
- [ ] K7 Einen echten X-Beitrag prüfen und notieren, welche Zusammenhänge stimmen und welche nicht.

## G. Update

- [ ] G1 Wenn „Neue Version verfügbar“ erscheint: **Jetzt aktualisieren** → App lädt neu, Daten sind da.

---

**Bei ❌:** Optionen → Datenprüfung ansehen, ggf. beim Import „Bericht kopieren“, und mir beschreiben, was passiert ist (Screenshot hilft).
