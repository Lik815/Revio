# DSGVO-Regelwerk für Entwicklung & Audit

**Zweck:** Verbindliche, prüfbare Regeln für Menschen und KI-Agenten, die an dieser Plattform bauen.
**Gilt für:** Jeden Commit, jedes Feature, jede neue Datenbanktabelle, jedes neue Drittanbieter-Tool.

**Konvention:**
`MUSS` = Verstoß blockiert den Merge. `SOLL` = Abweichung muss im PR begründet werden.
Jede Regel hat eine ID (`DS-xx`) und ist im PR referenzierbar.

**Abgrenzung:** Dieses Dokument deckt die *technische* Umsetzung ab. Rechtsgrundlagen-Bewertung,
Verträge, Datenschutzerklärung und Meldungen an die Aufsichtsbehörde gehören zu Jurist:in / DSB.
Ich bin kein Anwalt — für die rechtliche Bewertung braucht ihr eine juristische Freigabe.

---

## 1. Voraussetzung: Datenklassifizierung

Ohne diesen Schritt sind alle folgenden Regeln nicht prüfbar.

**DS-01 (MUSS):** Jedes Feld in jedem Schema ist einer Klasse zugeordnet:

| Klasse | Beispiele | Regel |
|---|---|---|
| `P0` – keine Personendaten | Feature-Flags, Preise, Konfiguration | frei nutzbar |
| `P1` – personenbezogen | Name, E-Mail, IP, User-ID, Cookie-ID, Device-ID, Standort | volle DSGVO |
| `P2` – besondere Kategorien (Art. 9) | Gesundheit, Religion, Biometrie, Gewerkschaft, sexuelle Orientierung, ethnische Herkunft | + explizite Einwilligung, + DSFA-Pflicht prüfen |
| `P3` – Zugangsdaten / Geheimnisse | Passwörter, Tokens, API-Keys | nie im Klartext, nie im Log, nie im Export |

**DS-02 (MUSS):** Die Klassifizierung lebt im Code, nicht in einer Wiki-Seite —
als Kommentar/Annotation/Decorator am Modell oder als `data-classification.yaml` neben dem Schema.
Neue Spalte ohne Klassifizierung = Build failed.

**DS-03 (MUSS):** Pseudonyme Identifier (User-ID, Cookie-ID, Session-ID, Device-Fingerprint,
gehashte E-Mail) sind `P1`. „Ist ja nur ein Hash" ist keine Anonymisierung.
Anonym ist nur, was *unumkehrbar* nicht mehr zuordenbar ist — auch nicht durch Verknüpfung.

---

## 2. Rechtsgrundlage & Zweckbindung (Art. 5, 6)

**DS-10 (MUSS):** Jede Verarbeitung von `P1`/`P2` hat genau eine dokumentierte Rechtsgrundlage:
Vertrag (Art. 6(1)b), Einwilligung (a), rechtliche Pflicht (c), berechtigtes Interesse (f).
Notiert im Verarbeitungsverzeichnis (siehe §14) — mit Verweis auf Tabelle/Feld.

**DS-11 (MUSS):** Zweckbindung. Daten, die für Zweck A erhoben wurden, dürfen nicht ohne neue
Grundlage für Zweck B genutzt werden. Konkret: Support-Datenbank ≠ Marketing-Verteiler,
Bestelldaten ≠ Trainingsdaten, Login-IP ≠ Analytics.

**DS-12 (MUSS):** Ein neuer Zweck ist ein Feature mit eigenem Ticket, eigener Rechtsgrundlage
und eigenem Eintrag im Verzeichnis — kein Nebeneffekt eines Refactorings.

---

## 3. Datenminimierung (Art. 5(1)c)

**DS-20 (MUSS):** Kein Feld ohne konkreten, heute existierenden Use Case.
„Könnten wir später mal brauchen" ist ein Ablehnungsgrund im Review.

**DS-21 (MUSS):** Kein `SELECT *` in Code, der über eine Netzwerkgrenze geht
(API-Response, Queue-Message, Webhook, Export). Felder explizit auflisten.

**DS-22 (MUSS):** API-Responses geben nur die Felder zurück, die der Client rendert.
Kein „Full-Object-Dump", weil das Serializer-Default ist. Response-DTOs statt ORM-Objekte.

**DS-23 (SOLL):** Pflichtfelder im Formular auf das Minimum reduzieren. Geburtsdatum,
Telefonnummer, Anrede, vollständige Adresse nur, wenn funktional zwingend.

**DS-24 (MUSS):** IP-Adressen werden gekürzt (`a.b.c.0` / letzte 80 Bit bei IPv6) gespeichert,
außer die volle IP ist für Sicherheit/Missbrauchsabwehr nötig — dann max. 7 Tage.

---

## 4. Speicherbegrenzung & Löschung (Art. 5(1)e, 17)

**DS-30 (MUSS):** Es gibt eine **Löschmatrix**: pro Datenkategorie → Aufbewahrungsfrist →
Auslöser → Mechanismus. Kein Datensatz ohne Zeile in dieser Matrix.

Beispielzeilen:

| Kategorie | Frist | Auslöser | Mechanismus |
|---|---|---|---|
| Account-Stammdaten | 30 Tage nach Kündigung | Account-Löschung | `purge_user` Job |
| Rechnungen / Buchungsbelege | 10 Jahre (§147 AO, §257 HGB) | Rechnungsdatum | Archiv, Zugriff gesperrt |
| Server-Logs mit IP | 7–14 Tage | Erstelldatum | Log-Retention der Plattform |
| Session-Daten | 24 h nach Ablauf | TTL | Redis TTL |
| Bewerbungsunterlagen | 6 Monate nach Absage | Absagedatum | Cron |
| Marketing-Kontakt | bis Widerruf | Widerruf | Sofort-Job + Sperrliste |

**DS-31 (MUSS):** Löschung ist automatisiert (Cronjob / TTL / Lifecycle-Policy).
Ein manueller Prozess „macht jemand einmal im Quartal" gilt als nicht vorhanden.

**DS-32 (MUSS):** Löschung erfasst *alle* Kopien: Primär-DB, Read-Replicas, Suchindex
(Elastic/Meilisearch), Cache (Redis), Data Warehouse, Object Storage, Queues, CDN,
Drittanbieter (CRM, Mailtool, Support-Tool, Analytics). Checkliste pro Datenklasse.

**DS-33 (MUSS):** Konflikt Löschpflicht vs. gesetzliche Aufbewahrungspflicht wird als
**Einschränkung der Verarbeitung** (Art. 18) gelöst: Datensatz wandert in gesperrten Zustand,
nur noch für den gesetzlichen Zweck lesbar — nicht in Suche, nicht in Analytics, nicht im Support-UI.

**DS-34 (MUSS):** Backups: Löschung muss dokumentiert entweder in Backups nachgezogen werden
oder die Backup-Retention ist kurz und dokumentiert (z. B. 30 Tage), plus Regel:
„Bei Restore werden zwischenzeitliche Löschungen erneut angewendet" — inkl. Job, der das tut.

**DS-35 (MUSS):** Soft-Delete (`deleted_at`) ist **keine** Löschung. Nach der Karenzzeit
muss ein Hard-Delete oder eine echte Anonymisierung folgen.

---

## 5. Betroffenenrechte (Art. 15–22)

Frist: **1 Monat** ab Antrag. Das heißt: es braucht Werkzeuge, keine Ad-hoc-SQL-Abenteuer.

**DS-40 (MUSS):** Es existiert eine Funktion `export_subject_data(subject_id)`, die *alle*
Daten zu einer Person über *alle* Systeme hinweg in maschinenlesbarem Format (JSON/CSV)
ausgibt — Art. 15 + Art. 20. Neue Tabelle mit `P1`-Daten ⇒ Export erweitern, sonst Merge-Block.

**DS-41 (MUSS):** Es existiert `delete_subject_data(subject_id)` mit derselben Vollständigkeits-
anforderung, inkl. Rückgabe eines Protokolls, was gelöscht und was (mit Grund) aufbewahrt wurde.

**DS-42 (MUSS):** Berichtigung (Art. 16): Nutzer:innen können ihre Stammdaten selbst ändern,
oder es gibt ein Admin-Tool dafür. Korrekturen propagieren an Downstream-Systeme.

**DS-43 (MUSS):** Widerspruch/Widerruf (Art. 7(3), 21) ist so einfach wie die Erteilung:
Ein Klick, kein Login-Zwang bei E-Mail-Abmeldung, keine Hotline, kein Formular per Post.

**DS-44 (MUSS):** Identitätsprüfung vor Auskunft/Löschung — aber ohne dafür *zusätzliche*
Daten zu verlangen (kein Ausweis-Upload, wenn eine E-Mail-Bestätigung reicht).

**DS-45 (SOLL):** Jede Anfrage wird mit Eingang, Frist, Bearbeiter, Ergebnis protokolliert.

**DS-46 (MUSS):** Automatisierte Einzelentscheidungen mit rechtlicher Wirkung
(Scoring, automatische Ablehnung, Preis-/Kreditentscheidung) — Art. 22: nur mit Grundlage,
mit Möglichkeit menschlicher Überprüfung, und die Logik ist erklärbar dokumentiert.

---

## 6. Einwilligung, Cookies & Tracking (Art. 7 DSGVO, §25 TDDDG)

**DS-50 (MUSS):** Vor Einwilligung: **kein** Zugriff auf Endgeräte-Speicher außer technisch
zwingend. Kein Analytics-Cookie, kein `localStorage` für Tracking, kein Marketing-Pixel,
kein A/B-Test-SDK, kein Session-Replay. Technisch notwendig = Session, Login, Warenkorb,
Sprachwahl, CSRF, Load-Balancing.

**DS-51 (MUSS):** Banner-Regeln: „Ablehnen" ist auf der ersten Ebene und gleich prominent wie
„Akzeptieren". Keine vorangekreuzten Boxen. Kein Nudging durch Farbe/Größe.
Weiterscrollen oder Wegklicken ist keine Einwilligung.

**DS-52 (MUSS):** Granular pro Zweck (Statistik / Marketing / Personalisierung), nicht
„alles oder nichts".

**DS-53 (MUSS):** Einwilligung ist beweisbar gespeichert: Zeitstempel, Zweck-Liste,
**Version des Einwilligungstexts**, Nachweis-ID. Textänderung ⇒ neue Version ⇒ neu einholen,
wenn sich der Zweck ändert.

**DS-54 (MUSS):** Widerruf ist so leicht erreichbar wie das Banner (persistenter Link/Button)
und wirkt sofort — inkl. Löschen der gesetzten Cookies und Stopp der Weitergabe.

**DS-55 (MUSS):** Skripte werden erst *nach* Zustimmung geladen (Consent-Gate im Tag-Manager
oder eigener Loader). Laden-und-dann-nicht-feuern reicht nicht: schon der Request an den
Drittanbieter überträgt die IP.

---

## 7. Logging, Monitoring, Analytics — die häufigste Fehlerquelle

**DS-60 (MUSS):** Keine `P1`/`P3`-Daten in Anwendungslogs. Verboten: vollständige Request-Bodies,
Header-Dumps mit `Authorization`/`Cookie`, E-Mail-Adressen, Namen, Zahlungsdaten, Tokens.
Erlaubt: pseudonyme User-ID, Trace-ID, Statuscode, Dauer.

**DS-61 (MUSS):** Redaction-Layer im Logger, nicht Disziplin der Entwickler:innen —
Deny-Liste für Feldnamen (`password`, `token`, `email`, `iban`, `authorization`, `secret`, …)
plus Muster-Erkennung. Getestet mit Unit-Test.

**DS-62 (MUSS):** Error-Tracking (Sentry o. ä.): PII-Scrubbing aktiv, `sendDefaultPii = false`,
Breadcrumbs und lokale Variablen prüfen, EU-Hosting oder AVV + Transfermechanismus.

**DS-63 (MUSS):** Log-Retention ist konfiguriert und kurz (Richtwert 14–30 Tage,
Security-Audit-Logs länger, aber begründet). Unbegrenzte Logs = Verstoß gegen DS-30.

**DS-64 (MUSS):** Analytics ohne Einwilligung nur, wenn keine Endgeräte-Speicherung stattfindet
*und* die Daten nicht personenbezogen sind (z. B. serverseitig, IP gekürzt, keine IDs) —
das ist eng, im Zweifel Einwilligung einholen.

**DS-65 (MUSS):** Keine personenbezogenen Daten in URLs/Query-Parametern (landen in Logs,
Referrern, Proxies, Browser-History). Keine Tokens im Query-String.

---

## 8. Sicherheit / TOMs (Art. 32)

**DS-70 (MUSS):** TLS 1.2+ überall, HSTS, keine Klartextprotokolle intern.

**DS-71 (MUSS):** Verschlüsselung at rest für DB, Backups, Object Storage.
`P2`-Daten zusätzlich feldverschlüsselt.

**DS-72 (MUSS):** Passwörter mit Argon2id (oder bcrypt/scrypt) + Salt. Niemals reversibel.

**DS-73 (MUSS):** Least Privilege: App-DB-User ohne `DROP`/`ALTER`, getrennte Rollen für
Support/Admin/Entwicklung, kein geteilter Admin-Account, MFA für alle privilegierten Zugänge.

**DS-74 (MUSS):** Zugriff auf Produktionsdaten durch Mitarbeitende ist protokolliert
(wer, wann, welcher Datensatz, warum) und auf begründete Fälle beschränkt.

**DS-75 (MUSS):** Secrets in einem Secret-Manager, nie im Repo, nie in `.env` im Image.
Rotation dokumentiert.

**DS-76 (SOLL):** Regelmäßige Überprüfung der Maßnahmen (Art. 32(1)d): Pentest / Dependency-Scan
/ Zugriffs-Review mindestens jährlich, dokumentiert.

---

## 9. Dritte: Auftragsverarbeiter & Drittlandtransfer (Art. 28, 44 ff.)

**DS-80 (MUSS):** Kein neuer Drittanbieter, der `P1` sieht, ohne: (a) AVV/DPA unterschrieben,
(b) Eintrag in der Subprozessor-Liste, (c) Prüfung des Serverstandorts, (d) Freigabe durch DSB.
Das gilt auch für „nur ein kleines SDK" — Fonts, Maps, Captcha, Chat-Widget, CDN, Push-Dienst.

**DS-81 (MUSS):** Eine maschinenlesbare Subprozessor-Liste liegt im Repo
(`subprocessors.yaml`: Anbieter, Zweck, Datenkategorien, Standort, AVV-Datum, Transfermechanismus)
und ist Teil des Reviews bei jeder neuen Abhängigkeit.

**DS-82 (MUSS):** Transfer in Drittländer (v. a. USA) nur mit gültigem Mechanismus:
Angemessenheitsbeschluss (EU-US Data Privacy Framework — Zertifizierung des konkreten Anbieters
prüfen), sonst Standardvertragsklauseln + Transfer Impact Assessment.
Der Status dieser Mechanismen ändert sich durch Rechtsprechung — vor Go-live aktuell prüfen lassen.

**DS-83 (SOLL):** EU-Region bevorzugen, wo verfügbar (Hosting, DB, Mail, Monitoring, LLM).

---

## 10. KI / LLM-spezifische Regeln

**DS-90 (MUSS):** Keine `P1`/`P2`-Daten in Prompts an externe Modelle ohne Rechtsgrundlage,
AVV mit dem Anbieter und vertraglich zugesicherten Trainings-Ausschluss (Zero-Retention prüfen).

**DS-91 (MUSS):** Vor dem Prompt: Pseudonymisierung/Redaction (Namen, E-Mails, Adressen,
Kundennummern durch Platzhalter ersetzen, nach der Antwort zurückmappen), wo funktional möglich.

**DS-92 (MUSS):** Prompt- und Response-Logs unterliegen denselben Regeln wie alle Logs
(DS-60 bis DS-63) — inklusive Löschmatrix und Export bei Auskunftsersuchen.

**DS-93 (MUSS):** Keine Produktionsdaten mit Personenbezug als Trainings- oder Fine-Tuning-Daten
ohne eigene Rechtsgrundlage. Zweckbindung (DS-11) gilt hier besonders.

**DS-94 (MUSS):** Wenn ein Modell eine Entscheidung über Menschen trifft oder wesentlich
vorbereitet → DS-46 (Art. 22) greift: menschliche Überprüfbarkeit, Dokumentation der Logik.

**DS-95 (SOLL):** RAG-Indizes über personenbezogene Dokumente brauchen Zugriffskontrolle
auf Dokumentebene *und* müssen bei Löschung neu indiziert werden (DS-32).

---

## 11. Entwicklung, Test, Staging

**DS-100 (MUSS):** Keine Produktionsdaten in Dev/Staging/Local. Test-Daten sind synthetisch
oder irreversibel anonymisiert (nicht nur „E-Mail überschrieben").

**DS-101 (MUSS):** Kein Versand echter E-Mails/SMS/Push aus Nicht-Prod-Umgebungen
(Mail-Catcher, geblockte Domains).

**DS-102 (MUSS):** Keine `P1`-Daten in Tickets, Screenshots, Slack, Repos, Testfixtures.

---

## 12. Frontend-Fallen (mit deutscher Rechtsprechung im Blick)

**DS-110 (MUSS):** Keine Ressourcen von Drittanbieter-CDNs, die die IP übertragen, ohne
Rechtsgrundlage — Google Fonts, Font Awesome, jQuery-CDN, Google Maps, reCAPTCHA,
eingebettete YouTube-/Vimeo-Player, Social-Plugins. Self-Hosting ist der Default.
(Google Fonts per CDN wurde vom LG München I 2022 als Verstoß bewertet — Abmahnwelle folgte.)

**DS-111 (MUSS):** Karten, Videos, Chat-Widgets: 2-Klick-Lösung oder Consent-Gate.

**DS-112 (MUSS):** Kontaktformulare: TLS, Datenminimierung, Zweckhinweis + Link zur
Datenschutzerklärung direkt am Formular, keine unnötigen Pflichtfelder.

**DS-113 (MUSS):** Datenschutzerklärung und Impressum von jeder Seite aus max. 2 Klicks
erreichbar; Datenschutzerklärung spiegelt tatsächlich eingesetzte Dienste wider
(sie wird bei jeder Änderung an `subprocessors.yaml` mit aktualisiert).

---

## 13. Datenpanne (Art. 33, 34)

**DS-120 (MUSS):** Es gibt ein Incident-Runbook mit: Erkennung → Bewertung → Meldung an
Aufsichtsbehörde **innerhalb 72 h** → ggf. Benachrichtigung der Betroffenen → Dokumentation.
Namen und Erreichbarkeit der verantwortlichen Personen stehen darin.

**DS-121 (MUSS):** Es gibt Detektion, die eine Panne überhaupt sichtbar macht:
Alerting auf ungewöhnliche Exporte/Massenabfragen, Zugriffs-Audit-Logs, Alarm bei
öffentlich gewordenen Storage-Buckets.

**DS-122 (MUSS):** Jede Panne wird intern dokumentiert — auch die nicht meldepflichtigen.

---

## 14. Dokumente, die existieren müssen

Ohne diese ist das System technisch vielleicht sauber, aber nicht nachweisbar konform
(Rechenschaftspflicht, Art. 5(2)):

1. **Verarbeitungsverzeichnis (VVT, Art. 30)** — pro Verarbeitung: Zweck, Rechtsgrundlage,
   Kategorien von Betroffenen und Daten, Empfänger, Drittland, Löschfrist, TOMs.
2. **TOM-Dokument (Art. 32)** — die technischen und organisatorischen Maßnahmen aus §8.
3. **Löschmatrix / Löschkonzept** (DS-30).
4. **Subprozessor-Liste + AVVs** (DS-81).
5. **Datenschutzerklärung + Cookie-Richtlinie**, konsistent mit dem tatsächlichen Code.
6. **DSFA (Art. 35)**, falls hohes Risiko: Scoring/Profiling, systematische Überwachung,
   große Mengen `P2`-Daten, neue Technologien, Daten von Kindern.
7. **Incident-Runbook** (DS-120).
8. **Benennung eines Datenschutzbeauftragten**, falls erforderlich
   (u. a. §38 BDSG: i. d. R. ab 20 Personen, die ständig automatisiert personenbezogene Daten
   verarbeiten — oder wenn eine DSFA-pflichtige Kernaktivität vorliegt).
9. **Verpflichtung der Mitarbeitenden auf Vertraulichkeit** + Schulungsnachweis.
10. **Auftragsverarbeitungsverträge mit euren Kunden**, falls ihr selbst Auftragsverarbeiter seid.

---

## 15. Definition of Done — Checkliste für jeden PR

Ein Feature, das personenbezogene Daten berührt, ist erst fertig, wenn:

- [ ] Alle neuen Felder klassifiziert (DS-01/02)
- [ ] Rechtsgrundlage benannt, VVT-Eintrag ergänzt (DS-10)
- [ ] Jedes Feld hat einen aktuellen Use Case (DS-20)
- [ ] Zeile in der Löschmatrix + implementierter Löschpfad (DS-30/31/32)
- [ ] Im Datenexport enthalten (DS-40)
- [ ] Im Löschjob enthalten (DS-41)
- [ ] Keine PII in Logs, Errors, Metriken, URLs (DS-60/65)
- [ ] Neuer Drittanbieter? → AVV, Subprozessor-Liste, Standort geprüft (DS-80/81/82)
- [ ] Neues Tracking/Cookie? → hinter Consent-Gate (DS-50/55)
- [ ] Datenschutzerklärung muss angepasst werden? (DS-113)
- [ ] Keine Prod-Daten in Tests/Fixtures (DS-100/102)

---

# TEIL B — Prüfen, ob ein bestehendes System konform ist

## 16. Audit-Vorgehen

### Phase 1 — Discovery (was passiert überhaupt?)

1. **Daten-Inventar erstellen:** Alle Schemata dumpen, jede Spalte klassifizieren.
   `information_schema.columns` + Sichtprüfung von Stichproben pro Tabelle.
2. **Datenflüsse zeichnen:** Woher kommen die Daten, wohin gehen sie?
   Ausgehende Netzwerkverbindungen der Anwendung protokollieren (welche Domains?) —
   das findet Drittanbieter, die niemand mehr auf dem Zettel hat.
3. **Frontend-Requests aufnehmen:** DevTools Network + Cookie-/Storage-Inventar,
   einmal *vor* und einmal *nach* Consent. Alles, was vorher feuert, ist ein Finding.
4. **Abhängigkeiten scannen:** SDKs, Pixel, Fonts, Analytics im Code suchen.
5. **Vertragslage abgleichen:** Gefundene Anbieter gegen vorhandene AVVs mappen.

### Phase 2 — Automatisierbare Prüfungen

| Check | Methode | Erwartung |
|---|---|---|
| PII in Logs | Regex über Log-Sample: E-Mail-Muster, IBAN, `password`, `Bearer `, Telefonnummer | 0 Treffer |
| Nicht klassifizierte Spalten | Diff Schema ↔ Klassifizierungsdatei | leer |
| Verwaiste Daten | Rows mit `created_at` älter als Löschfrist | 0 |
| Soft-Delete-Leichen | `WHERE deleted_at < now() - retention` | 0 |
| Drittanbieter-Requests vor Consent | Headless-Browser-Lauf ohne Zustimmung, Domainliste | nur eigene Domains |
| Klartext-Passwörter | Stichprobe Hash-Format | Argon2/bcrypt/scrypt |
| Unverschlüsselte Verbindungen | TLS-Scan, HTTP→HTTPS-Redirect | alles TLS 1.2+ |
| Secrets im Repo | `gitleaks` / `trufflehog` über die gesamte History | 0 |
| Öffentliche Buckets | Cloud-Provider-Policy-Check | 0 |
| Log-Retention | Config-Prüfung | gesetzt & begründet |

Diese Checks gehören in die CI, sonst verfallen sie.

### Phase 3 — Manuelle Testfälle

Jeder Test hat ein *beobachtbares* Ergebnis. „Sieht ok aus" gilt nicht.

**T-01 Auskunft:** Testnutzer anlegen, überall Spuren erzeugen (Bestellung, Support-Ticket,
Newsletter, Login), Auskunft anfordern. → Export enthält *alle* Systeme, maschinenlesbar,
innerhalb der Frist.

**T-02 Löschung:** Denselben Nutzer löschen. → Danach in Primär-DB, Replica, Suchindex, Cache,
Warehouse, CRM, Mailtool, Support-Tool kein Treffer mehr auf die Identifikatoren; Rechnungen
existieren noch, aber gesperrt und nicht mehr im Support-UI sichtbar.

**T-03 Consent:** Seite im frischen Inkognito-Profil laden, Banner ignorieren.
→ Kein Request an Drittanbieter, kein nicht-essenzielles Cookie, kein `localStorage`-Eintrag.

**T-04 Widerruf:** Zustimmung geben, dann widerrufen. → Cookies gelöscht, Requests stoppen,
Widerruf in der Nachweis-DB protokolliert.

**T-05 Newsletter-Abmeldung:** Ein Klick aus der Mail heraus, ohne Login. → Sofort wirksam,
keine weitere Mail.

**T-06 Berichtigung:** Name ändern. → Änderung erscheint in allen Downstream-Systemen.

**T-07 Log-Hygiene:** Registrierung, Login mit falschem Passwort, fehlerhafter Checkout
durchspielen, danach Logs und Error-Tracker durchsuchen. → Keine E-Mail, kein Passwort,
kein Token, kein voller Request-Body.

**T-08 Zugriffskontrolle:** Als Nutzer A per API-ID-Manipulation Daten von Nutzer B abrufen.
→ 403. (IDOR ist gleichzeitig Sicherheitslücke *und* Datenschutzverstoß.)

**T-09 Export-Missbrauch:** Als Support-Rolle Massenexport versuchen.
→ Entweder blockiert oder protokolliert und alarmiert.

**T-10 Aufbewahrung:** Datensatz künstlich altern lassen (Zeitstempel manipulieren),
Löschjob laufen lassen. → Datensatz verschwindet.

### Phase 4 — Findings bewerten

| Schweregrad | Kriterium | Reaktion |
|---|---|---|
| Kritisch | `P2`-Daten offen, keine Rechtsgrundlage, Transfer ohne Mechanismus, Datenabfluss möglich | sofort stoppen/fixen |
| Hoch | Löschung funktioniert nicht, Tracking ohne Consent, PII in Logs | Fix in laufendem Sprint |
| Mittel | Kein VVT-Eintrag, zu lange Retention, fehlende Doku | geplanter Fix |
| Niedrig | Kosmetik, Prozesslücken | Backlog |

---

## 17. Häufigste Befunde in der Praxis

Damit lohnt sich der Anfang, wenn Zeit knapp ist:

1. Tracking/Fonts/Maps laden vor der Einwilligung.
2. Es gibt keinen funktionierenden Löschpfad — nur `deleted_at`.
3. PII in Logs und im Error-Tracker.
4. Kein Verarbeitungsverzeichnis.
5. Drittanbieter ohne AVV, die niemand mehr kennt.
6. Produktionsdaten in Staging.
7. Unbegrenzte Log- und Backup-Retention.
8. Kein Prozess für Auskunftsersuchen — jedes Mal Handarbeit.
9. Analytics-Daten werden für Zwecke genutzt, für die sie nicht erhoben wurden.
10. Datenschutzerklärung passt nicht zum tatsächlichen Code.

---

# TEIL C — Revio Ist-Zustand (Audit-Befunde)

**Stand:** 2026-07-24 · **Methode:** statischer Code-Audit gegen die Checks aus §16 Phase 2
(kein Laufzeit-/Browser-Test, kein Vertrags-/Doku-Abgleich mit realen AVVs).
Diese Momentaufnahme veraltet mit dem Code — bei DSGVO-relevanten Änderungen aktualisieren.

Revio verarbeitet als Therapeuten-Vermittlung besondere Kategorien (`P2`, Gesundheitsbezug:
Heilmittel, Spezialisierungen, Patienten-Anfragen) → erhöhtes Risiko, DSFA-Pflicht (Art. 35)
plausibel. Das macht die offenen Punkte unten überdurchschnittlich wichtig.

### Was schon passt (Positivbefunde)

- **DS-72 Passwörter:** `scrypt` + Salt in `apps/api/src/routes/auth-utils.ts` — konform, nicht reversibel.
- **DS-110 Fonts:** Site nutzt System-/self-hosted Fonts (`Avenir Next`, `system-ui`), **keine** Google-Fonts-CDN.
- **DS-113 Pflichtseiten:** `apps/site/app/datenschutz/page.tsx` und `impressum/page.tsx` existieren.
- **Account-Löschung vorhanden:** `DELETE /auth/me` (`apps/api/src/routes/auth.ts`) mit Guard gegen
  offene Termine; Prisma-`onDelete: Cascade` räumt verknüpfte Daten der Primär-DB.
- **DS-65 (Teil):** Session-Token im `Authorization: Bearer`-Header, nicht im Query-String.
- **DS-24 (Teil):** Es werden serverseitig **keine** IP-Adressen in der DB gespeichert (kein `ipAddress`-Feld gefunden).

### Offene Findings

| # | Regel | Schweregrad | Befund | Fundort |
|---|---|---|---|---|
| ~~F-1~~ | DS-40 | ~~Hoch~~ | **Behoben (2026-07-25):** `GET /auth/me/export` liefert alle personenbezogenen Daten der eingeloggten Person als JSON (Patient + Therapeut), ohne P3-Geheimnisse. Logik in `utils/subject-data.ts`, per Test abgesichert (`test/subject-data.test.ts`). Noch offen: Berichtigung/Löschung von Drittanbietern (Resend/Nominatim-Cache) hängt an F-5. | `apps/api/src/routes/auth.ts`, `apps/api/src/utils/subject-data.ts` |
| ~~F-2~~ | DS-60/61 | ~~Hoch~~ | **Behoben (2026-07-25):** Suche loggt keine Koordinaten/Begriff/Ort mehr, nur nicht-personenbezogene Metadaten. | `apps/api/src/routes/search.ts` |
| ~~F-3~~ | DS-60 | ~~Hoch~~ | **Behoben (2026-07-25):** Request-Body wird bei Validierungsfehler nicht mehr geloggt, nur die Zod-Fehler. | `apps/api/src/routes/auth.ts` |
| ~~F-4~~ | DS-61 | ~~Hoch~~ | **Behoben (2026-07-25):** Redaction-Layer im pino-Logger (`utils/log-redaction.ts`), per Unit-Test abgesichert (`test/log-redaction.test.ts`). | `apps/api/src/app.ts` |
| F-5 | DS-80/81 | Hoch → Mittel | **Teilweise behoben (2026-07-25):** `subprocessors.yaml` im Repo-Root angelegt, 7 Subprozessoren mit Personenbezug erfasst (Railway, Vercel, Resend, Expo, Nominatim, Apple/Google Maps). Offen: AVV-Abschluss + DSB-Freigabe (rechtlich, Felder auf `OFFEN`). | `subprocessors.yaml` |
| F-6 | DS-82 | Hoch | US-Transfers (Resend, Expo, Vercel, Google Maps) ohne dokumentierten Mechanismus (DPF/SCC+TIA). In `subprocessors.yaml` als `OFFEN` markiert — braucht juristische Bewertung (DSB/Anwalt). | `subprocessors.yaml` |
| ~~F-7~~ | DS-01/02 | ~~Mittel~~ | **Behoben (2026-07-25):** `data-classification.yaml` klassifiziert alle 318 Skalarfelder (27 Modelle); Validator `check:classification` als CI-Gate. | `apps/api/prisma/data-classification.yaml` |
| ~~F-8~~ | DS-30 | ~~Mittel~~ | **Behoben (2026-07-25):** Löschmatrix in `docs/loeschkonzept.md` (mit offenen Automatisierungs-Lücken: Retention-Cron, OTP-Cleanup, Log-Retention). | `docs/loeschkonzept.md` |
| ~~F-9~~ | DS-50/64 | ~~Mittel~~ | **Behoben (2026-07-26):** `@vercel/analytics` + `@vercel/speed-insights` aus dem Admin entfernt (Layout, package.json, Lockfile). Internes Ops-Tool ohne Tracking. | `apps/admin/app/layout.tsx` |
| F-10 | DS-30/§14 | Mittel → teilw. | **Teilweise behoben (2026-07-25):** VVT-Grundgerüst in `docs/vvt.md`. Offen: TOM-Dokument, Incident-Runbook; Rechtsgrundlagen/DSFA durch DSB. | `docs/vvt.md` |
| F-11 | DS-62 | Mittel | Kein Error-Tracking mit aktivem PII-Scrubbing dokumentiert (kein Sentry-Config-Nachweis). | — |
| F-12 | DS-32 | Niedrig | Löschung erfasst Search-Cache (`searchTherapistCache`) nicht explizit; TTL ~60s mildert. | `apps/api/src/routes/search.ts` |
| F-13 | DS-100 | Niedrig | Seed-Daten nutzen `randomuser.me`-Fotos; synthetisch, aber externer Abruf beim Seeding. | `apps/api/prisma/seed.ts` |

### Empfohlene Reihenfolge

1. ~~**F-2/F-3/F-4** (PII aus Logs + Redaction-Layer)~~ — **erledigt 2026-07-25.**
2. ~~**F-1** (`export_subject_data`)~~ — **erledigt 2026-07-25** (`GET /auth/me/export`).
3. **F-5** (`subprocessors.yaml`) — technisch erledigt 2026-07-25; **F-6** (Transfer-Mechanismen/AVV) bleibt juristisch offen (DSB/Anwalt).
4. ~~**F-7/F-8/F-10** (Klassifizierung, Löschmatrix, VVT)~~ — technisch erledigt 2026-07-25 (VVT-Gerüst steht; DSFA/Rechtsgrundlagen bleiben bei DSB).
5. ~~**F-9** (Analytics hinter Consent oder entfernen)~~ — **erledigt 2026-07-26** (Tracking entfernt).
6. Offene Automatisierungs-Lücken aus `docs/loeschkonzept.md` (Retention-Cron, OTP-Cleanup, Log-Retention). ← nächster technischer Schritt
7. Juristisch (DSB/Anwalt): **F-6** (Transfer-Mechanismen/AVV), DSFA für V-2, Rechtsgrundlagen im VVT.

Rechtliche Bewertung (DSFA-Pflicht, Rechtsgrundlagen, AVV-Inhalte, Transfer-Zulässigkeit)
gehört zu Jurist:in / Datenschutzbeauftragtem — dieser Audit deckt nur die technische Seite ab.
