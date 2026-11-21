# GewinnRadar v0.6 – Redaktion und Fristen (Stand: 21.11.2026)

**Nur Entwicklungscode; kein Cloudflare-Deployment, keine produktiven E-Mails, keine kostenpflichtigen Ressourcen.**

## Tatsächlicher Katalogstand

| Kategorie | Anzahl |
|---|---:|
| Dokumentierte Originalquellen-/Katalogentscheidungen | 53 |
| Recherchekandidaten, **nicht freigegeben** | 41 |
| Ausgeschlossen oder für die Familienliste gesperrt | 12 |
| Verfügbare 2026-Teilnahmebedingungen näher geprüft | 11 |
| Datenschutzrelevante Originalangaben geprüft | 8 |
| Tatsächlich geöffnete Dezember-Tagesformulare vollständig verifiziert | **0** |
| Freigegebene Familienerinnerungen | **0** |

Das Ziel 50–100 **vollständig geprüfter** Tageskalender ist damit noch nicht erreicht. 53 Katalogentscheidungen sind keine 53 täglich möglichen Verlosungen. Insbesondere Single-Verlosungen, Social-Media-Verlosungen, Sonderzeiten und Rabatt-Türchen zählen nicht wie ein reguläres freies Tagesgewinnspiel.

## Korrekturen aus 2026-Originalbedingungen

- **Süddeutsche Zeitung:** offizielle [2026-Teilnahmebedingungen](https://teilnahmebedingungen.swmh.de/SZ-Adventskalender) verlangen Zustimmung zu Angeboten der SZ. Für Familienstandard **ausgeschlossen**.
- **Abendzeitung München:** [2026-Gewinnspielregeln](https://www.abendzeitung-muenchen.de/mehr/vorteilswelt/gewinnen/teilnahmebedingungen-adventskalender-2026-art-771163) verlangen Benutzerkonto und persönliche Abholung; [allgemeine Nutzungsbedingungen](https://www.abendzeitung-muenchen.de/agb/allgemeine-geschaeftsbedingungen-fuer-nutzer-unserer-digitalen-angebote-art-888009) umfassen personalisierte Werbung. Für werbefreien Familienstandard **ausgeschlossen**, sofern nicht eine eindeutig werbefreie Alternative nachgewiesen wird.
- **PILOT:** [Originalbedingungen](https://www.pilotpen.de/TNB-Adventskalender): **nur 1., 3., 5., 9., 16., 19., 24.12.** kostenlos per E-Mail ohne Kauf oder Newsletter. 22.12. erfordert Newsletter und wird nicht eingeplant. Jedes zulässige Türchen 00:00–23:59.
- **AGRAVIS:** [Originalbedingungen](https://www.agravis.de/de/unternehmen/ueber-uns/adventskalender) belegen kostenlose tägliche Gewinnspiele 00:00–23:59. Tatsächliche Pflichtfelder noch offen; automatisierte Teilnahmen verboten.
- **ALDI Nord:** [Originalbedingungen](https://www.aldiventskalender.de/teilnahmebedingungen): normales Web-Türchen benötigt E-Mail; Vorname optional. **6., 13. und 20. Dezember ausschließlich über ALDI-App**. Kaufbon-Aktion und einlösungsgebundene Rabattcoupons bleiben getrennt. [Datenschutzhinweis](https://www.aldiventskalender.de/datenschutz) beschreibt Newsletter und Reminder separat.
- **WDR 3:** [Originalbedingungen](https://www1.wdr.de/radio/wdr3/schwerpunkte/wdr3-weihnacht/teilnahmebedingungen-adventskalender-102.html) bestätigen Musikrätsel, auch E-Mail-Teilnahme; Name, Anschrift, Telefon und E-Mail für Abwicklung, keine zusätzliche Werbenutzung. Präzise Türchenfrist noch offen.
- **Urlaubsguru:** [Originalseite](https://www.urlaubsguru.de/info/adventskalender/) widerspricht sich zum Tagesende: 00:59:59 in einer FAQ, 23:59:59 an anderer Stelle. App und tägliche E-Mail-Bestätigung erforderlich. **Keine automatischen Zeitbehauptungen/Erinnerungen** bis Klärung.
- **Yellowchair:** [Originalbedingungen](https://diekreidefarbe.de/pages/teilnahmebedingungen-adventskalender) erlauben Name+E-Mail-Formular statt Social-Konto, Newsletter ist freiwillig. **Nicht alle 24 Türchen sind Gewinnspiele**, zum Teil nur Rabattangebote. Nur tatsächlich geöffnete Gewinnspieltage prüfen.
- **infra Fürth:** [Originalbedingungen](https://www.infra-fuerth.de/teilnahmebedingungen-adventskalender) bestätigen täglich kostenloses Quiz für Erwachsene in Deutschland; konkrete Pflichtfelder des Tagesformulars noch offen.
- **Ahoi Leipzig:** [Originalkalender](https://ahoi-leipzig.de/advent/) bestätigt tägliche Quizchance, nur Gewinnabwicklung, aber ortsgebundene Gutscheine möglich.
- **Landwirtschaft schafft Leben:** [Originalbedingungen](https://www.magdochjeder.de/service/gewinnspiel) bestätigen 00:01–23:59, kostenloses Tagesformular, teils regionale Gewinne und zweckgebundene Datenübertragung an Gewinngeber; Formularpflichtfelder erst bei Öffnung prüfbar.

## Neues Sicherheitsmodell

1. Recherche steht nur in `research_candidates`. Eine erfolgreiche HTTP-Prüfung ist keine Genehmigung.
2. Nach tatsächlichem Öffnen eines Tagesformulars hält ein Admin **getrennt** in `form_verifications` Originalformular-URL, Datenschutz-URL, Pflichtfelder, aktuelle Prüfung und sieben ausdrücklich belegte Eigenschaften fest. Negative/unklare Eigenschaften verhindern die Freigabe.
3. `POST /api/admin/review` akzeptiert eine Freigabe nur, wenn ein **aktueller (maximal 7 Tage alter)** passender Formularprüfnachweis vorliegt. Ein Häkchen im gewöhnlichen Admin-Formular reicht nicht mehr.
4. `reminder_windows` erfordert je Aktion und Kalendertag explizit `review_state='approved'`. Fenster werden in UTC gespeichert; Herkunft und Notiz sind Pflicht. **Keine Fenster sind vordefiniert oder genehmigt.**
5. Der vorbereitete E-Mail-Worker fragt ausschließlich nach aktuell offenen, manuell freigegebenen Fenstern **und** geprüftem Formular **und** aktiver Gewinnspiel-Freigabe **und** individuellen Favoriten und Einwilligungen. `MAIL_ENABLED` bleibt auf Standardeinstellung **aus**.
6. Die reine Planung `functions/_lib/reminder-window.js` berücksichtigt Europe/Berlin einschließlich Sommer-/Winterzeit, lehnt unmögliche und mehrdeutige Ortszeiten ab und sperrt abgelaufene oder widersprüchliche Fristen.

## Nicht für Produktion freigeben

Echte Cloudflare-D1-Integration, Datenschutzhinweise, rechtmäßige Zustimmung der Empfänger, sichere Domain und vollständig geprüfte Formulare fehlen. Alle Einträge bleiben bis dahin unveröffentlicht. Dieser Branch enthält keine personenbezogenen Echtdaten und keine aktiven Brevo-Schlüssel.
