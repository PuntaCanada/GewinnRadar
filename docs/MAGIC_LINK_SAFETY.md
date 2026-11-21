# GewinnRadar: einmaliger Magic-Link-Login (Sicherheitsvorbereitung)

## Zustand und Grenzen

Die produktive D1 `gewinnradar` enthält nach Bestätigung des Betreibers **ein** Administratorkonto mit `daily_email=0`, `email_verified=0`. Der D1-Gesundheitscheck ist grün. **Dieser PR verändert weder die D1-Datenbank noch Cloudflare-Variablen und verschickt keine E-Mails.**

Der bisherige `GET /api/verify?token=...` hat einen Token sofort verwendet. Sicherheits-/Link-Vorschau-Bots können solche GET-Links vor dem Empfänger öffnen. Die neue Verifikation erfordert eine bewusste zweite Aktion:

1. Der Einmal-Link führt zu einer datensparsamen Bestätigungsseite (`GET /api/verify?token=...`), die **keinen** Token verbraucht, keine Session anlegt und keine E-Mail-Bestätigung setzt.
2. Nur ein Formular mit **POST** und passendem `Origin` verarbeitet den Token. Die Anforderung ist im Backend durch Hash und Ablaufzeit (15 Minuten nach Erstellung) an ein konkretes Konto gebunden.
3. Der einmalige Token wird atomar nur bei `used_at IS NULL` und `expires_at > now` verbraucht. Erst danach wird das Konto bestätigt und ein `Secure; HttpOnly; SameSite=Lax`-Sessioncookie erzeugt. Ein zweiter POST bekommt keine neue Sitzung.
4. `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, und eine restriktive Content Security Policy begrenzen die Offenlegung von Token in der Bestätigungsseite.
5. Die lokale Test-Suite prüft wiederholtes Vorladen per GET, einmaligen POST, Token-Replay, abgelaufene/ungültige Tokens, Fremd-Origin und gesperrte E-Mails ohne Netzwerk.
6. Produktive Anmeldung bleibt gesperrt, solange `LOGIN_MAIL_ENABLED` nicht nach ausdrücklicher gesonderter Freigabe aktiviert wird. `MAIL_ENABLED` für tägliche Gewinnspiel-Erinnerungen bleibt **false**.

### Vor Freigabe später separat zu prüfen

Ein einziger ausdrücklich genehmigter Login-Mail-Test benötigt private Brevo-Absenderkonfiguration und privaten Ratenlimit-Salt in Cloudflare, sichere Senderdomain und eine Datenschutzprüfung. Keine Secrets, persönlichen E-Mail-Adressen oder Magic-Link-Tokens in GitHub speichern oder im Chat teilen.

**Keine produktiven E-Mails, keine neuen Kosten, keine anderen Projekte.**
