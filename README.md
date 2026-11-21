# GewinnRadar Familie 🎁

**Entwicklungsstand 21.11.2026:** V0.2-Grundstruktur in diesem Repository importiert, noch **keine produktive Website**.

Die Anwendung ist ein werbefreier Familienprototyp mit besonders einfacher Oberfläche für ältere Menschen. Ein Gewinnspiel wird nur nach einer eigenen Originalquellen-/Datenschutzprüfung freigeschaltet; die Datenbank ist absichtlich **leer**.

## Was implementiert wurde

- Große Schaltflächen, responsive Seniorenansicht, deutsche Beschriftung.
- Privater Familienzugang per einmaligem E-Mail-Link für zuvor angelegte Benutzer; keine Selbstregistrierung.
- Getrennte Favoriten und Teilnahme-Häkchen in Cloudflare D1, Tagesstatus für Adventskalender.
- Schutz der privaten API-Routen durch Sitzungsprüfung und Origin-Prüfung bei Änderungen.
- Gewinnspielstatus `review`, `verified`, `ended`, `rejected`; Fristprüfung.
- Konservativer HTTPS-Linktest mit Prüfhistorie: HTTP 403/429 gilt NICHT als Beweis für ein abgelaufenes Gewinnspiel.
- Tägliche Erinnerungsmails über Brevo als **deaktivierte** Funktion: Der separate Worker versendet ausschließlich bei ausdrücklich gesetztem `MAIL_ENABLED=true`, vorhandenen Geheimnissen, bestätigtem Konto und individueller E-Mail-Einwilligung.
- Quelltexttests mit lesender GitHub Action (kein Deployment, kein Mailversand).
- Keine automatische Teilnahme bei externen Gewinnspielen, kein Tracking und keine Werbe-Newsletter.

## Wichtiger aktueller GitHub-Hinweis

**Dieses Repository ist aktuell öffentlich.** Keine realen E-Mail-Adressen, Namen, Datenbankinhalte, API-Tokens oder Geheimnisse einchecken. Vor einer produktiven Familiennutzung die gewünschte Privatsphäre des Repositories kontrollieren. Die private Anwendung darf erst nach vollständiger Zugangskontrolle online gehen.

## Struktur

`public/` statische Website; `functions/api/` private API; `functions/_lib/` gemeinsame Hilfsfunktionen; `migrations/0001_initial.sql` neues D1-Schema; `worker/` geplante Cron-Prüfung und optionaler Digest; `tests/` Offline-Tests.

## Lokale Prüfungen

Mit Node.js 22 `npm test`. JavaScript kann zusätzlich per `node --check` geprüft werden. Der GitHub-Actions-Workflow führt beides aus. Die ersten Pakettests: 5/5 erfolgreich. Die GitHub-Actions-Prüfung des vollständigen Imports war erfolgreich; vorangegangene fehlgeschlagene Zwischen-Commits wurden durch den vollständigen Import behoben.

## Noch NICHT freigeben

1. Kein Cloudflare Pages-Deployment eingerichtet. Keine D1-Datenbank angelegt oder migriert.
2. `wrangler.toml` und `worker/wrangler.toml` enthalten absichtlich ungültige Platzhalter für eine **neu anzulegende** D1. Niemals eine bestehende D1 anderer Projekte verwenden.
3. Keine echten Familienkonten, keine Adressen, keine Mail-Secrets, keine produktiven E-Mails.
4. Kein bestätigter 2026-Gewinnspielkatalog. Ein erfolgreicher HTTP-Aufruf ist kein Nachweis der Seriosität.
5. Datenschutzseite ist ein **Entwurf**, kein einsatzbereiter Rechtstext. Impressum und Auftragsverarbeitungs-/Datenschutzprüfung fehlen.
6. Vor Livebetrieb fehlen u. a. Login-Abuse-Schutz (insbesondere IP-bezogene Begrenzung), formale Einladung/Einwilligung, Admin-Freigabeprozess, verifizierte Link-Redirect-/DNS-Sicherheit, Tests für D1 und Sessions, Browser-/Barrierefreiheitstests und echte Cloudflare-Bindungsprüfungen.
7. Brevo und Cloudflare zunächst auf Free-Plans belassen; vor Aktivierung Limits und Bedingungen prüfen. Kein kostenpflichtiger Dienst erforderlich oder autorisiert.

## Geplante Betriebsfolge (nur nach gesonderter Freigabe)

Zuerst Sicherheits-/Rechtstexte und Tests ergänzen, dann isolierte neue Cloudflare-D1 und Preview-Website einrichten; einzeln verifizierte Originalgewinnspiele aufnehmen. Schließlich nach Einwilligung der Familienmitglieder einen E-Mail-Test und erst danach produktiven Versand freigeben.

**Keine Änderungen an anderen PuntaCanada-Repositories.**

## Cloudflare Pages: Git-Neuverbindung (21.11.2026)

Nach Wiederherstellung der Repository-Berechtigung muss ein **neues Deployment auf dem aktuellen `main`-Commit** erzeugt werden. Ein Retry eines älteren fehlgeschlagenen Deployments kann weiterhin die veraltete D1-Platzhalter-ID enthalten. Die beiden versionierten Wrangler-Dateien enthalten inzwischen die vom Projektinhaber bereitgestellte D1-Datenbankkennung.

Diese reine Dokumentationsänderung dient als neuer `main`-Push, um das automatische GitHub→Cloudflare-Deployment anzustoßen und die Verbindung zu prüfen. Sie verändert **keine Anwendungslogik, keine Secrets, keine Datenbankdaten und keine Mail-Einstellungen**. Solange D1-Migrationen und Zugangsschutz noch nicht vollständig überprüft sind, bleiben Familienkonten und Erinnerungs-E-Mails deaktiviert.
