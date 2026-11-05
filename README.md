# DebateBase 3

Persönliche Wissensdatenbank für Diskussionen auf X. Alle Daten bleiben auf deinem Gerät (IndexedDB im Browser). Der Server liefert nur die Programmdateien aus.

## Stand: Etappe 2

Neu in Etappe 2:

- Migrationsassistent für den Export aus Version 1 und 2 sowie für Sicherungsdateien
- Prüfung ohne Veränderung, Vorschau, Hinweise und übersprungene Datensätze
- Bei Konflikten (gleiche ID, anderer Inhalt) entscheidest du: behalten, ersetzen oder beide behalten
- „Komplett ersetzen“ zur Wiederherstellung einer Sicherungsdatei (mit Bestätigung)
- Import in einem Schritt (alles oder nichts) und Nachkontrolle Datensatz für Datensatz
- Echter Datei-Download der gesamten Datenbank (Ordner „Downloads“)
- Bericht zum Kopieren, Importprotokoll in den Einstellungen

Aus Etappe 1:

- Alle Funktionen aus Version 2 übernommen
- Speicherung jetzt in IndexedDB statt localStorage
- Jede Änderung wird einzeln und sofort gespeichert
- Bis zu 5 automatische Sicherungen vor gefährlichen Vorgängen
- Datenprüfung (findet Verweise ins Leere, löscht nichts)
- Erster Start mit leerer Datenbank

Noch nicht enthalten (folgen in den nächsten Etappen): Installation und Offline-Betrieb (Etappe 3), Teilen aus der X-App (Etappe 4).

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `index.html` | Grundgerüst der Seite |
| `styles.css` | Gestaltung (aus Version 2) |
| `app.js` | Oberfläche und Bedienung |
| `db.js` | Datenbank (IndexedDB) |
| `migrate.js` | Import, Prüfung, Konflikte, Nachkontrolle |
| `tests/` | Automatische Tests, werden für den Betrieb nicht gebraucht |

## Veröffentlichen mit GitHub Pages

1. Dateien in das Repository hochladen (Hauptordner).
2. Auf github.com im Repository: **Settings → Pages**.
3. Bei „Source“ **Deploy from a branch** wählen, Branch **main**, Ordner **/ (root)**, **Save**.
4. Nach 1–2 Minuten ist die App erreichbar unter `https://<benutzername>.github.io/<repository>/`.

## Tests ausführen

```
node tests/migrate.unit.test.mjs
node tests/etappe1.test.mjs
node tests/etappe2.test.mjs
```

Benötigt Node.js, Playwright und Google Chrome.
