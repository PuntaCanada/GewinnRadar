# GewinnRadar – geschützter Admin-Zugang vorbereiten

**Stand: 21. November 2026.** Gilt ausschließlich für **PuntaCanada/GewinnRadar**, die Cloudflare-Pages-Adresse `gewinnradar.pages.dev` und die dedizierte D1-Datenbank `gewinnradar` mit UUID `3a5a20dd-9447-4260-ac44-9b6accc571fb`.

## Bereits nachgewiesen
- Cloudflare-Screenshot: Pages-Deployment `210ad5b` erfolgreich. Nach PR #6 muss das neue Deployment noch **separat** im Cloudflare-Dashboard bestätigt werden; GitHub-Actions-Erfolg ist kein Nachweis eines Pages-Deployments.
- Cloudflare-D1-Konsole (Nutzer-Screenshot): 17 GewinnRadar-Tabellen, Trigger `prevent_source_evidence_update`, `PRAGMA foreign_key_check` ohne angezeigte Konflikte.
- Cloudflare Pages besitzt in der versionierten `wrangler.toml` die Bindung `DB` zur identifizierten Datenbank. Ob die Pages-Function diese Bindung live benutzt, ist nicht separat belegt.
- Alle fünf Migrationen wurden einzeln durch den Eigentümer in seiner Cloudflare-Konsole ausgeführt.

## Ohne E-Mail: ausschließlich LESEN

Cloudflare → Storage & databases → D1 SQL database → `gewinnradar` → Console:

```sql
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'login_tokens', COUNT(*) FROM login_tokens
UNION ALL SELECT 'games', COUNT(*) FROM games
UNION ALL SELECT 'email_log', COUNT(*) FROM email_log;
```

Die Abfrage verändert nichts. Wenn diese Tabellen unerwartete persönliche Datensätze enthalten: stoppen und zuerst die Herkunft klären.

## Geplanter Admin-Login ohne Umgehung
1. Produktive Benutzeranlage erst mit ausdrücklicher Zustimmung, nachdem Authentifizierung, Datenschutzinformationen und Zugangsschutz geprüft wurden. **Keine** realen persönlichen E-Mail-Adressen, Passwörter, Session-Cookies, API-Schlüssel oder Magic-Link-Token in ein öffentliches GitHub-Repository einchecken.
2. Das Admin-Konto muss explizit in `users` als `role='admin'` existieren. Es gibt **keine öffentliche Selbstregistrierung**. Niemals eine Test-Sitzung oder ein festes Auth-Token in D1 anlegen.
3. Login erfolgt regulär über einen einmaligen, 15 Minuten gültigen E-Mail-Link. `LOGIN_MAIL_ENABLED` bleibt **false**, solange echte E-Mails nicht ausdrücklich freigegeben sind. Alle anderen Rollen bleiben für `/api/admin/*` gesperrt.
4. Ein späterer Test mit tatsächlich versandter Magic-Link-Mail benötigt eigenständige Freigabe, geprüfte Brevo-Absenderdomain, private Cloudflare-Secrets, Ratenbegrenzung und eine konkrete Testadresse.
5. `MAIL_ENABLED` (tägliche Gewinnspielerinnerungen) bleibt **false** – unabhängig von späteren Login-Tests.
6. Ein grüner GitHub-Test kann ein reales Cloudflare-Deployment und die Login-Domainbindung nicht beweisen. Bis dahin: keine echten Konten, keine Aufnahme privater Daten.

## Schutz vor versehentlicher Mailaktivierung
`functions/api/login.js` und `functions/_lib/login-safety.js` verlangen für die Login-Mail die explizite Variable `LOGIN_MAIL_ENABLED='true'`, einen mindestens 32 Zeichen langen Rate-Salt, eine Brevo-API-Konfiguration und die D1-Bindung. Ohne diese Werte antwortet der Login mit HTTP 503 und führt keinen Mailaufruf aus. Der getrennte Digest benötigt `MAIL_ENABLED='true'` und eigene Freigabekriterien.

Der neue lokale SQLite-Test `tests/admin-readiness.test.mjs` prüft ohne Netzwerk-/Echtkonten, dass nur Admin-Sitzungen die Admin-API lesen können, Mitglieder keine Gewinnspiele anlegen und der Mailversand bei deaktiviertem Login gesperrt ist.

**Keine produktiven E-Mails, kein kostenpflichtiger Dienst, keine anderen Datenbanken und keine weiteren Repositories.**

## Read-only Cloudflare-Liveprüfung (erst nach separat geprüftem Merge und Deployment)

Der neue öffentliche Endpunkt `https://gewinnradar.pages.dev/api/health` prüft ausschließlich, ob die echte Pages-Function die D1-Bindung `DB` hat und aus den Tabellen `users` und `games` lesen kann. Bei Erfolg antwortet er `{"ok":true,"db_ready":true}`; andernfalls mit HTTP 503 und `{"ok":false,"db_ready":false}`. Keine Adressen, Namen, Datensätze, Tabellenliste oder Secrets werden ausgegeben. Es erfolgt keine Schreiboperation und kein Mailversand.

Dieser Status beweist **nicht** automatisch, dass geschützte Anmeldung, Rechte, D1-Migrationen 0002–0005, Mailintegration oder Cloudflare-Deployment-Historie funktionieren. `/api/me` ist separat ein privatsphäreschonender Session-Test (`{"user":null}` ohne Login).

## Persönlichen Admin-Account später nur mit ausdrücklicher Freigabe

Erst nach bestätigter Live-Bindung, Sicherheits- und Rechtstextprüfung und eigener Zustimmung wird ein Admin-Konto mit bewusst gewählter persönlicher E-Mail erstellt. Standardwerte: `daily_email=0`, `email_verified=0` bis zur echten Bestätigung, keine vorgefertigte Session. Keine Accountdaten in GitHub speichern. Da die Anmeldung per Magic Link erfolgt, ist sie ohne den gesondert freigegebenen und streng geschützten LOGIN-Mailversand noch **nicht nutzbar**. Den täglichen Digest aktiviert dies nicht.

Die aktuelle Vorbereitung erstellt weder Admin-Konten noch Token. Bestehende produktive Daten bleiben unverändert.
