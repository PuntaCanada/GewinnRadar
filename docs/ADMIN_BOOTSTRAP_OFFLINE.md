# GewinnRadar – persönliche Admin-Ersteinrichtung (ohne Mailversand)

**Sicherheitszustand 21.11.2026:** `/api/health` liefert laut dem Betreiber `{"ok":true,"db_ready":true}`. Die dedizierte D1 `gewinnradar` hat alle fünf Migrationen, 17 Tabellen; `users`, `sessions`, `login_tokens`, `games`, `email_log` enthielten zuletzt je 0 Zeilen.

**Dieser PR legt keine Konten an, schreibt nicht in die Cloudflare-Datenbank, verschickt keine E-Mails und aktiviert nichts.** Der echte Login nutzt einen 15-Minuten-Magic-Link, der bei deaktiviertem `LOGIN_MAIL_ENABLED` nicht angefordert werden kann.

## Vorbereitete, manuelle Ersteinrichtung

1. Den bestehenden Cloudflare-Stand und die leere `users`-Tabelle unmittelbar vor der Ersteinrichtung noch einmal **nur lesend** bestätigen. Die Konto-E-Mail wird **nicht** in ein öffentliches GitHub-Repository, ein Issue, eine PR oder einen öffentlichen Kommentar geschrieben.
2. Ein Admin-Konto darf **nur auf ausdrückliche Freigabe** mit einer bewusst gewählten eigenen E-Mail-Adresse angelegt werden. Standardwerte: `role='admin'`, `daily_email=0`, `email_verified=0`, `senior_mode=1`, `consent_at=NULL`. Keine vorab angelegten Sitzungscookies, Login-Tokens oder Passwörter.
3. Der lokale Generator `scripts/prepare-admin-bootstrap.mjs` kann **nur auf dem eigenen Rechner** aus den lokalen Umgebungsvariablen `GEWINNRADAR_ADMIN_EMAIL` und `GEWINNRADAR_ADMIN_NAME` eine SQL-Datei erstellen. Er verweigert eine Ausgabe im Git-Repository, existierende Dateien und ungültige Eingaben; Datei-Modus 0600. Die Datei darf nicht in GitHub hochgeladen werden.
4. Der SQL-Code nutzt `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM users)`. Wenn bereits irgendein Nutzerkonto existiert, wird kein Admin hinzugefügt. Zusätzlich sind nach jeder Änderung Rolle und `daily_email=0` zu kontrollieren. Die Ausführung in D1 ist **noch nicht genehmigt**.
5. Ohne ausdrücklich genehmigten **einen** separaten Login-Mail-Test (Brevo-Absenderdomain und privates Secret sicher konfiguriert) bleibt die Anmeldung unbenutzbar. `LOGIN_MAIL_ENABLED` nicht unbemerkt aktivieren; `MAIL_ENABLED` für tägliche Rundmails ausdrücklich **ausgeschaltet** lassen.
6. Später die Konto- und Privatsphäre-Texte kontrollieren, sichere Sitzungsbeendigung testen und erst dann Familienkonten zulassen.

### Was ein erfolgreicher D1-Healthcheck nicht beweist

Die Live-D1-Bindung und zwei lesbare Tabellen sind bestätigt, aber **nicht** der E-Mail-Login, die Benutzerrechte im Livebetrieb, das vollständige Datenschutzkonzept oder das Einspielen von Adventskalendern.
