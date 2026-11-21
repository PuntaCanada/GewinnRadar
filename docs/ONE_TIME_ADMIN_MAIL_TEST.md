# GewinnRadar – Einmaliger Admin-Magic-Link-Test (standardmäßig AUS)

Stand: 21.11.2026. **Dieser PR verändert ausschließlich `PuntaCanada/GewinnRadar`. Es wird nichts an die produktive D1 geschrieben, kein Secret geändert und keine E-Mail verschickt.**

## Garantiegrenzen

- Regulärer `POST /api/login` bleibt solange gesperrt, wie `LOGIN_MAIL_ENABLED=false` gilt.
- Gesonderter Test-Endpunkt: `POST /api/admin-login-test`, einfache Bedienoberfläche unter `/admin-login-test.html`.
- Die Testfunktion ist standardmäßig **AUS**. Es genügt NICHT, Brevo-Secrets zu besitzen.
- Für eine **spätere gesonderte Freigabe** müssen alle folgenden Voraussetzungen gemeinsam gelten:
  - `LOGIN_MAIL_ENABLED=false` bleibt ausdrücklich bestehen
  - `ADMIN_MAGIC_LINK_TEST_ENABLED=true` wird eigens und vorübergehend gesetzt
  - `ADMIN_MAGIC_LINK_TEST_CODE` enthält einen zufällig erzeugten privaten, mindestens 32 Zeichen langen, unvorhersehbaren Testcode als Cloudflare-Secret (nicht im GitHub-Repo, nicht im Chat!)
  - `ADMIN_MAGIC_LINK_TEST_EXPIRES_AT` enthält einen UTC-Zeitpunkt `YYYY-MM-DDTHH:MM:SSZ`, der in der Zukunft liegt und höchstens 24 Stunden entfernt ist
  - Bereits vorhandene `LOGIN_RATE_SALT`, `BREVO_API_KEY`, `SENDER_EMAIL` und D1-Bindung `DB` sind vorhanden
  - In der produktiven D1 existiert **genau ein** Benutzer mit `role='admin'`.
- Kein Formulareingabefeld für die Empfängeradresse: Die Adresse wird nur aus der einzigen bestehenden Admin-Zeile gelesen. Es erfolgt kein Versand an Mitglieder oder frei eingegebene Adressen.
- Der private Code wird über HTTPS per POST übermittelt, nicht über die URL. Ohne passenden Origin und Secret-Code wird kein Token erzeugt. Ein geheimer Testcode wird nicht im öffentlichen Code gespeichert.
- Eine **atomare** D1-`INSERT OR IGNORE`-Sperre in der bereits vorhandenen Tabelle `login_limits` wird **vor** jedem Mailversand gesetzt. Der Beleg ist über Redeployments und gleichzeitige Anfragen hinweg dauerhaft, auch wenn die Sendung fehlschlägt. Dieses System erlaubt höchstens **einen Versuch**, nicht eine garantierte Zustellung.
- Bei einem Fehler wird der noch nicht genutzte Login-Token gelöscht, die einmalige Versandfreigabe aber **nicht** zurückgesetzt.
- Der erhaltene Anmeldelink erfordert weiterhin die bewusste POST-Bestätigung, hat 15 Minuten Gültigkeit und kann nur einmal verwendet werden.
- Tägliche Erinnerungen werden über den **separaten Worker** gesteuert. `MAIL_ENABLED` bleibt deaktiviert.

## Praktisches Vorgehen – erst nach späterer ausdrücklicher Mailfreigabe

1. Green CI/Chromium/Wrangler prüfen, PR mergen und den Cloudflare-Deploy-Commit unabhängig bestätigen.
2. Sicherstellen, dass keine anderen Admin-Konten existieren und `LOGIN_MAIL_ENABLED=false` wirklich wirksam ist.
3. Erst wenn ein einziger **echter** Testversand ausdrücklich gewünscht wird, das separate Secret und einen kurzlebigen Ablaufzeitpunkt setzen. Für die Code-Eingabe ist keine Browserkonsole nötig.
4. `https://gewinnradar.pages.dev/admin-login-test.html` öffnen, den privaten Code eingeben und genau einmal absenden. Keine reale E-Mail-Adresse eintippen.
5. Testschalter sofort wieder auf `false` stellen, selbst wenn der Test erfolgreich war. Falls ein Fehler auftrat: nicht blind erneut aktivieren – die einmalige D1-Freigabe bleibt verbraucht.
6. Nach dem ersten tatsächlichen Login HTTPS-Session, Adminrechte, Logout und sauberes E-Mail-Branding prüfen. Vor vollständigem Livebetrieb Datenschutz- und Impressumsfragen klären.

## Noch NICHT ausführen

`ADMIN_MAGIC_LINK_TEST_ENABLED` wird in diesem PR **nicht** gesetzt, der Code nicht für einen realen Mailversand verwendet, kein kostenpflichtiger Brevo-Tarif gewählt. Keine anderen Repositories oder Cloudflare-Projekte ändern.

### Manuelle rein lesende Kontrolle der Versuchssperre (keine E-Mail-Adressen)

Die eine Sicherheitsmarkierung liegt in `login_limits`; ihr Vorhandensein kann später ohne Ausgabe personenbezogener Daten geprüft werden:

```sql
SELECT COUNT(*) AS verbrauchte_testfreigaben
FROM login_limits WHERE bucket='single-admin-mail-test';
```

Vor einem echten Versuch ist 0 zu erwarten, danach 1. Die Markierung nicht löschen oder bearbeiten, nur um einen weiteren Test zu ermöglichen.
