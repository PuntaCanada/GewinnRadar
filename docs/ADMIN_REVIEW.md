# Admin-Freigabe – v0.3-Entwurf

**Nicht produktiv.** Privates GitHub-Repository und Admin-Zugang ersetzen keine Prüfung.

## Prozess
1. Ein zuvor manuell angelegtes, bestätigtes Familienkonto erhält ausschließlich durch kontrollierte D1-Administration die Rolle `admin`. Öffentliche Selbstregistrierung ist deaktiviert.
2. `POST /api/admin/contests` nimmt einen Datensatz mit Original-, Regel- und Datenschutzhinweis sowie Gewinn, Start und Enddatum an. Immer Status `review`. Ungeprüfte Datensätze werden nicht auf der Benutzerseite angezeigt.
3. Prüfer prüft Originalaktion, vollständige Teilnahmebedingungen, Datenschutz, deutsche Berechtigung, fehlende Kauf-/Abo-/Werbepflicht, Aktualität und echte Auslosung. Nicht nur Statuscode 200 als Beleg werten.
4. `POST /api/admin/review` verlangt sieben explizite Bestätigungen, Prüfdatum und konkrete Prüfernotiz; protokolliert Entscheidung und Prüfer.
5. Der separate Linkprüfer muss zusätzlich `link_state=ok` ermitteln. Bot-Sperren (403/429) sind nicht automatisch als Betrug zu bewerten, aber führen vorerst nicht zur unbedingten Freigabe.
6. Änderungen an bereits freigegebenen Veranstalterdaten erfordern eine neue Prüfung; direkte Änderung freigegebener Daten über die Admin-API wird nicht angeboten.
7. Kein Live-Katalog vorhanden. Die Datei `catalog/candidate-template.json` ist lediglich eine Vorlage.

## Bekannte Grenzen und Launch-Blocker
- Noch keine vollwertige grafische Admin-Konsole, nur geschützte API.
- Admin-Audit ist kein rechtlich ausreichendes Vertrauenssiegel; redaktionelle Prüfung bleibt erforderlich.
- Keine belastbare DNS-/Redirect-/HTTP-Sicherheitsprüfung mit Ziel-IP-Validierung: keine fremden URLs als uneingeschränkt sicher deklarieren.
- Noch keine echte D1-, Browser-, E-Mail- oder Cloudflare-Preview-Integration getestet.
- Kein automatisches Auffüllen mit ungeprüften Kalendern, keine automatische Teilnahme.
- Vor Produktivstart: strengere Login-/IP-Limits mit Cloudflare-Schutz, Sessions- und Magic-Link-Sicherheit, Löschkonzept, geeignete Datenschutzerklärung, Mail-Domain und Consent-/Unsubscribe-Prüfung.

Keine produktive E-Mail ohne ausdrückliche Zustimmung. Kontoerstellung/Einrichtung erfolgt nur in einem späteren, explizit freigegebenen Schritt.
