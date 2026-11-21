# GewinnRadar – sichere Cloudflare-D1-Einrichtung (21.11.2026)

**Nicht auf andere Projekte anwenden. Kein automatischer Remote-Datenbankzugriff. Kein E-Mail-Versand.**

## Verifizierte Zielkonfiguration

- GitHub: `PuntaCanada/GewinnRadar`, Cloudflare Pages: `gewinnradar.pages.dev`.
- D1-Name: `gewinnradar-familie`.
- D1-UUID: `3a5a20dd-9447-4260-ac44-9b6accc571fb`.
- Pages- und separater Worker-Wrangler-Eintrag nutzen beide die Bindung `DB` und diese UUID. Der Worker ist **nicht** separat zu veröffentlichen.
- Der Cloudflare-Screenshot zeigt ein erfolgreiches **Production-Deployment** von Commit `210ad5b`. Die Seite selbst und `/api/me` waren von der Rechercheumgebung aus nicht abrufbar. Der produktive Datenbankzustand ist unbekannt.

## 1. ZUERST LESEN, NICHTS SCHREIBEN

1. Cloudflare → **Storage & databases → D1 SQL database → gewinnradar-familie → Console**.
2. Vor dem Eingriff auf den exakten D1-Namen und die oben angegebene ID achten.
3. In der D1-Console nur die Abfrage aus [scripts/d1-readonly-preflight.sql](../scripts/d1-readonly-preflight.sql) ausführen. Die Abfrage ist **nur lesend** und zeigt vorhandene Tabellen/Trigger.
4. Wenn bereits Nutzertabellen, andere Produkte, unbekannte Strukturen oder echte Daten existieren: **STOPP**; niemals Tabellen löschen, nie automatisch migrieren. Erst Struktur und Backup klären.
5. Falls die Datenbank leer ist (nur interne sqlite-Tabellen), können nach bewusster Freigabe jede Migration der Reihe nach ausgeführt werden. Wenn bereits echte Daten vorhanden sind, vorher Export-/Wiederherstellungsplan klären. Eine leere Datenbank hat kein zu erhaltendes Anwendungsschema; ein Remote-Betrieb erfordert dennoch bewusste Bestätigung.

## 2. Migrationen in exakter Reihenfolge (erst nach Freigabe)

Auf dem eigenen Rechner mit authentifiziertem Wrangler sind diese Einzelbefehle eine mögliche Methode. `--remote` verändert die **echte** Cloudflare-Datenbank und darf erst nach Zustimmung ausgeführt werden. **Nicht in GitHub Actions hinterlegen.** Die `--config wrangler.toml`-Option stellt sicher, dass das GewinnRadar-Repository verwendet wird. Cloudflare dokumentiert `d1 execute NAME --remote --file=...` als Methode.

```bash
npx wrangler@4 d1 execute gewinnradar-familie --remote --config wrangler.toml --file migrations/0001_initial.sql
npx wrangler@4 d1 execute gewinnradar-familie --remote --config wrangler.toml --file migrations/0002_review_security.sql
npx wrangler@4 d1 execute gewinnradar-familie --remote --config wrangler.toml --file migrations/0003_catalog_staging.sql
npx wrangler@4 d1 execute gewinnradar-familie --remote --config wrangler.toml --file migrations/0004_source_evidence.sql
npx wrangler@4 d1 execute gewinnradar-familie --remote --config wrangler.toml --file migrations/0005_form_and_reminders.sql
```

**Alternative ohne Kommandozeile:** In der Cloudflare-D1-Console den SQL-Inhalt jeder der fünf GitHub-Dateien einzeln in exakt dieser Reihenfolge ausführen. Erst zum nächsten Schritt gehen, wenn der vorige erfolgreich war. Nicht SQL aus beliebigen Internetquellen kopieren.

## 3. Read-only-Nachprüfung

Die Abfragen aus [scripts/d1-readonly-postcheck.sql](../scripts/d1-readonly-postcheck.sql) prüfen Tabellen, Foreign Keys und ob Benutzer-/Gewinnspieltabellen noch leer sind. Auf einer frisch eingerichteten Datenbank sollten **17 Anwendungstabellen** vorhanden sein. Die Datenbankmigrationen legen keinerlei reale Nutzerkonten oder Einträge an.

Sollten einzelne SQL-Anweisungen scheitern, keine Reparatur-Updates auf gut Glück versuchen: Fehlertext und aktuelle Tabellennamen sichern. Niemals eine bestehende andere D1-Datenbank an dieses Projekt binden.

## 4. Freigabegrenzen

- `MAIL_ENABLED` und `LOGIN_MAIL_ENABLED` bleiben standardmäßig deaktiviert; **keine produktiven E-Mails**.
- Es werden keine Konten für Familienmitglieder, Passwörter, API-Keys oder andere personenbezogene Daten in GitHub eingetragen.
- Cloudflare Pages kann trotz erfolgreicher D1-Migrationen weiterhin geschützte Login-Tests, Datenschutztexte und einen redaktionell freigegebenen Gewinnspielkatalog benötigen.
- Die Tabellenmigration allein bestätigt weder eine funktionsfähige `/api/me`-Anmeldung noch dass ein externer Gewinnspiel-Link seriös ist.
- Es wird keine automatische Cloudflare-Veröffentlichung aus diesem Runbook ausgelöst, solange die Änderungen nur im PR-Branch liegen.
