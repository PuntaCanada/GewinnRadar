# Katalog 2026 – Redaktions- und Importregeln

**Ziel 50–100 originale Adventskalender, aber keine unbestätigten Einträge als freigegeben ausgeben.**

## Workflow
1. Recherchierte 2026-Aktionen mit Originalquelle, Veranstalter, Zeitraum, Teilnahmeweg, erforderlichen Angaben und Unsicherheiten in `catalog/research-2026.json` dokumentieren.
2. `node scripts/catalog-audit.mjs` prüft Struktur, Dubletten (kanonische URL/Jahr), Datumslogik, ausdrücklich ausgeschlossene Werbe-/Mitgliedschaftsaktionen und unbekannte URL-Schemata.
3. `POST /api/admin/research-import` (nur bestätigter Admin): erst `{"entries":[...]}` als Dry-Run, danach optional `{"entries":[...],"commit":true}`. Schreibt **nur** `research_candidates`, niemals `games`. Gleiche kanonische URL/Jahr oder ID wird nicht erneut eingefügt.
4. Alle Kandidaten benötigen eine separate redaktionelle Freigabe über die bestehende Admin-Freigabe. Research-Daten allein sind niemals als `verified` nutzbar und kommen in keine E-Mail.
5. `excluded` enthält begründete Ablehnungen für Pflichtwerbung, Mitgliedschaft, Kauf- oder andere Ausschlusskriterien.
6. Für einfache Senioren-Ansicht: E-Mail/Formular vor Social/App; Telefonnummer und Nutzerkonto markieren. Heuristische Filter sind Hilfen, **keine** Datenschutz-Zertifizierung.

## Lizenz / Nutzung
Nur knappe eigene Zusammenfassungen und Links auf Originalquellen, keine fremden kompletten Teilnahmebedingungen, Bilder oder Sammlerverzeichnisse kopieren. Keine automatisierte Teilnahme, keine ungeprüften externen Webseiten aus dem Worker aufrufen.

## Bekannte Grenzen
- Mehrere wirklich eigenständige Aktionen auf einer URL können sich den kanonischen Schlüssel teilen; solche Fälle werden redaktionell geprüft und nicht automatisch dupliziert.
- Research-Staging bildet keine automatische Erlaubnis zur Nutzung einer Veranstalter-API ab.
- Originaltermine sind teilweise nur für den Gesamtkalender bekannt, nicht für jeden Türchen-Gewinn.
- Kein 100%-Scam-Schutz; vor jeder Freigabe die Originale und Datenschutzformulare erneut manuell prüfen.
- Aktuelle Webrecherche ist eine Momentaufnahme vom 21.11.2026, kein automatischer Live-Verfügbarkeitsnachweis.
- Keine Änderungen an anderen Repositories, kein Cloudflare-Deployment, kein Brevo-Versand.
