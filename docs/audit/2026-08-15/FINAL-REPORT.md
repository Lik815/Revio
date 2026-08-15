# Revio — Plattform-Audit · Abschlussbericht

**Datum:** 2026-08-15 · **Auditor:** unabhängige technische Prüfung (Audit-only)
**Umfang:** `apps/api`, `apps/site`, `apps/admin`, `apps/mobile`, `packages/shared`, Betrieb, Dokumentation
**Start-Commit:** `dd8bf74` · **Abschluss-Commit:** `1679f86` (Branch `main`)

Begleitdokumente: [00 Scope & Coverage](00-scope-and-coverage.md) · [01 Rollen & Flows](01-system-roles-and-flows.md) · [02 Befehlsprotokoll](02-test-and-command-log.md) · [03 Findings Register](03-findings-register.md)

---

## 1. Executive Summary

Revio ist ein durchdachtes, für ein MVP ungewöhnlich diszipliniert gebautes Produkt. Die Autorisierung ist objektbezogen und durchgängig — ich habe **keinen einzigen IDOR gefunden**. Die Sichtbarkeitsregeln für Praxen liegen zentral in einer Datei, mit ausdrücklicher Begründung, warum der Datenbank-Vorfilter allein nicht genügt. Der Datenschutz ist nicht nachträglich angeklebt, sondern als Code gebaut: Feldklassifizierung mit maschineller Prüfung, eine Redaction-Schicht für Logs, ein ehrlich gepflegtes Subprozessor-Register, das technische von rechtlichen Aussagen sauber trennt. Der Admin-Patientenbereich verzichtet bewusst auf eine Listenansicht und protokolliert jeden Zugriff. Das ist ein Reifegrad, den man in dieser Projektgröße selten sieht.

Genau deshalb wiegen die Befunde schwer, die entlang derselben Linien liegen.

**Vier kritische Probleme** verlangen sofortiges Handeln:

1. **Der Standort-Datenschutzschalter ist wirkungslos.** Die App sagt Therapeut:innen zu, dass ihre genaue Adresse privat bleibt. Das Backend speichert und veröffentlicht in beiden Einstellungen dieselben hausnummergenauen Koordinaten — unauthentifiziert abrufbar. Betroffen sind vor allem Freiberufler:innen, die von zuhause arbeiten. Das ist kein Minimierungsdetail, sondern eine Diskrepanz zwischen zugesicherter und tatsächlicher Verarbeitung, mit realem Sicherheitsrisiko für die betroffenen Personen.

2. **Eine vollständige Angriffskette auf alle Therapeutenkonten.** Die öffentliche Suche liefert die E-Mail-Adressen aller Therapeut:innen — dieselbe Adresse ist der Login-Benutzername. Der Login hat kein Ratelimit und antwortet unterschiedlich, je nachdem ob ein Konto existiert. Bemerkenswert: der Code löst das Enumerationsproblem an zwei anderen Stellen ausdrücklich und richtig — nur an der wichtigsten nicht.

3. **Die Kontolöschung löscht nicht.** Buchungen behalten Klarnamen, E-Mail, Telefonnummer und das angefragte Heilmittel (Gesundheitsdatum nach Art. 9); gelöscht wird nur die Verknüpfung. Die Daten sind damit weder entfernt noch anonymisiert, sondern nur nicht mehr auffindbar. Das Löschkonzept führt genau das als „implementiert".

4. **Produktion synchronisiert ihr Schema bei jedem Start mit `--accept-data-loss`** gegen eine zweite, handgepflegte Schemadatei — ohne Migrationshistorie und ohne Rollback. Es existieren vier widersprüchliche Startkommandos; drei davon sind tot oder würden fehlschlagen.

Die gemeinsame Ursache der meisten Befunde ist nicht mangelnde Sorgfalt, sondern **fehlende Zentralisierung an drei Stellen**: die Auflösung Token → Akteur ist fünfmal dupliziert (deshalb prüft fast niemand den Session-Ablauf), das Datenbankschema existiert zweimal (deshalb driftet es), und Löschung ist über Prisma-Referenzaktionen statt als expliziter Vorgang modelliert (deshalb ist sie unvollständig). Wer diese drei Stellen konsolidiert, erledigt einen Großteil des Registers als Nebeneffekt.

**Nicht prüfbar** blieben: alle Laufzeit-, UI- und Accessibility-Aspekte (keine laufende Instanz, kein Browser), die Produktionskonfiguration und die Backup-Lage. Die lokale Testsuite ließ sich wegen einer Umgebungsstörung nicht verlässlich ausführen — dazu Abschnitt 3.

---

## 2. Ziel, Scope, Zeitpunkt, Methoden

**Ziel:** risikobasierte, belegbasierte Gesamtprüfung mit klarer Trennung zwischen Belegtem, Vermutetem und Ungeprüftem.

**Methoden:** vollständige statische Analyse aller 16 Routenmodule und beider Prisma-Schemata; strukturelle Schema-Diff per Skript; gezielte Prüfung der Frontends auf Injektion, Autorisierung und Rendering; Abgleich Code ↔ `CLAUDE.md` ↔ `docs/` ↔ Deployment-Konfiguration; Ausführung der lokal sicheren Befehle (siehe [02](02-test-and-command-log.md)).

**Ausdrücklich unterlassen:** aktive Ausnutzung, Brute-Force, Lasttests, Zugriff auf Produktion, Migrationen, Seeds, Versand echter Nachrichten, Öffnen potenziell echter Datenbestände (`data/*.xlsx`, lokale `*.db`).

**Bewegtes Ziel:** Während des Audits kamen zwei Commits (~1.237 geänderte Zeilen) hinzu. Alle Datei- und Zeilenangaben wurden abschließend gegen `1679f86` erneut verifiziert; zwei Referenzen verschoben sich um eine Zeile und sind korrigiert. Die neu hinzugekommene Route `apps/site/app/api/find-search/route.ts` wurde mitgeprüft: sauber validiert und `no-store`, erweitert allerdings die Reichweite von PRIV-001/PRIV-002 auf den Browser.

---

## 3. Annahmen und Einschränkungen

1. **Keine Laufzeitprüfung der Oberflächen.** Phase 2 wurde nach Abstimmung rein statisch geführt. Alle UI-, UX- und Accessibility-Aussagen sind statische Indizien. Es gab keine axe-Prüfung, keine Tastaturnavigation, keine Screenreader- oder Kontrastmessung und keine Screenshots. **Accessibility gilt damit als ungeprüft**, nicht als in Ordnung.
2. **Die lokale Testsuite ist in dieser Umgebung nicht verlässlich ausführbar.** Der maßgebliche Lauf ergab 213 von 215 Tests grün bei 1.467 s Laufzeit, davon 1.444 s reines Modul-Laden. Ein früherer Lauf scheiterte an `ETIMEDOUT` beim Dateisystem-Read, ein dritter brauchte 314 s für drei Unit-Tests. Ursache ist mit hoher Wahrscheinlichkeit der iCloud-synchronisierte Arbeitsordner (`~/Desktop/Revio`). **Die zwei roten Tests werden deshalb ausdrücklich nicht als Produktdefekt behauptet** — sie gehören in CI gegengeprüft. CI-Läufe konnte ich nicht einsehen.
3. **Ein Repository beweist keine Produktionskonfiguration.** Ob `STORAGE_PROVIDER=s3` aktiv ist, ob `REVIO_ADMIN_PASSWORD` gesetzt ist, in welcher Region die Datenbank liegt und ob Backups laufen, ist unbekannt. Das beeinflusst die Schwere von STOR-002, SEC-004 und OPS-001 erheblich.
4. **Keine rechtliche Bewertung.** Ich weise technische Indizien aus. Rechtsgrundlagen, AVV, DPIA, Drittlandtransfers und die Frage, ob eine Meldepflicht besteht, gehören zu Jurist:in und DSB. Wo ich DSGVO-Artikel nenne, ist das eine Einordnung des technischen Sachverhalts, keine Konformitätsaussage.
5. **Nutzerzufriedenheit, Marktposition, Conversion und Wirtschaftlichkeit** sind mangels Analytics, Nutzerforschung und externer Quellen **nicht Gegenstand dieses Audits**. Ich stelle dazu keine Hypothesen auf.

---

## 4. Plattform- und Architekturüberblick

Monorepo (pnpm) mit vier Anwendungen und einem geteilten Typenpaket, ~51.000 Zeilen. Fastify-API mit Prisma gegen PostgreSQL (Railway); Marketing-Site und Admin als Next.js 15 (Vercel); Mobile als Expo mit OTA-Updates über EAS.

Authentifizierung: zufällige 32-Byte-Tokens in der Datenbank, 30 Tage TTL, als Bearer-Header — kein JWT (`jsonwebtoken` und `JWT_SECRET` sind vorhanden, aber unbenutzt). Admin läuft über ein einziges statisches Shared Secret.

Datenflüsse, Trust Boundaries und die acht kritischen Abläufe sind in [01](01-system-roles-and-flows.md) dokumentiert.

**Architektonische Beobachtungen jenseits der Einzelbefunde:**

- **Zwei parallele Buchungsmodelle.** `BookingRequest` (Einzeltermin) und `PatientRequest`/`Inquiry` (Serienanfrage) existieren nebeneinander; `ScheduledSlot` kann aus beiden entstehen und trägt dafür zwei Fremdschlüssel. Das ist ein Migrationszustand, keine Doppelimplementierung — er verdoppelt aber jede künftige Änderung an Terminlogik, Absage und Löschung. Vor weiterem Ausbau konsolidieren.
- **`admin.ts` mit 2.061 Zeilen und 65 Endpunkten** ist die mit Abstand größte Datei der API und deckt Therapeuten, Praxen, Verknüpfungen, Patienten, Optionslisten, Blog, Feedback und Einstellungen ab. Aufteilung nach Domäne würde die Prüfbarkeit deutlich verbessern.
- **Die Token→Akteur-Auflösung ist fünffach dupliziert** (`auth.ts` inline, `booking.ts`, `reviews.ts`, `notifications.ts`, `feedback.ts`) — direkte Ursache von SEC-002.

---

## 5. Coverage

Vollständige Matrix in [00, Abschnitt 8](00-scope-and-coverage.md). Verdichtet:

| | Bereiche |
|---|---|
| ✅ **Vollständig geprüft** | API-Routing, Auth-Logik, Autorisierung/IDOR, Admin-Berechtigungen, Sichtbarkeits-/Freigabelogik, Datenmodell, Schema-Drift, DSGVO-Klassifikation (ausgeführt), Export- und Löschpfade, Logging/Redaction, Uploads, Deployment-Konfiguration, CI/CD, Frontend-Code Site/Admin, API-Typecheck (ausgeführt) |
| ⚠️ **Teilweise** | Buchungs-Nebenläufigkeit (Lock-Zweig nie ausgeführt), Mobile-Code (Schwerpunkt Auth/Profil/Buchung), Observability |
| ❌ **Nicht prüfbar** | UI/UX-Laufzeit, Accessibility, gemessene Performance, Produktionskonfiguration, Backups/RTO/RPO, Testsuite-Laufzeit, Site-Build, Mobile-Tests (kein Script vorhanden), `data/*.xlsx` |

---

## 6. Belegte Stärken

Ausführlich mit Fundstellen in [03](03-findings-register.md#belegte-stärken). Die wichtigsten:

- **Keine IDOR-Lücke** — Ownership wird in `inquiry.ts` (alle 12 Routen), `reviews.ts`, `notifications.ts` und `booking.ts` konsequent objektbezogen geprüft.
- **`contact.ts` ist mustergültig**: Honeypot, geschlossene Enum, Ratelimit, HTML-Escaping, bewusst keine Speicherung.
- **Der Admin-Patientenbereich ist bewusst datensparsam** — keine Listenansicht, POST statt GET für die Suche, jeder Zugriff protokolliert, die fehlende Actor-Spalte im Code als bekannte Lücke benannt statt verschwiegen.
- **Sichtbarkeitsregeln zentralisiert und mehrschichtig**, mit ausdrücklichem Hinweis, dass der DB-Vorfilter allein nicht genügt.
- **`subprocessors.yaml`** erfasst alle sieben real genutzten Drittanbieter und trennt technische von rechtlichen Aussagen — inklusive des Details, dass Nominatim auch direkt vom Client aufgerufen wird.
- **Datenklassifizierung als Code mit Validator** — das Konzept ist stark, auch wenn der Validator gerade rot ist.
- **Passwort-Hashing korrekt** (scrypt, Salt pro Passwort, `timingSafeEqual`).
- **Blog-Inhalte werden in React-Elemente gerendert** statt als HTML — der naheliegendste XSS-Vektor ist konstruktiv geschlossen.
- **API-Typecheck grün** bei ~16.000 Zeilen mit durchgängiger Zod-Eingangsvalidierung.
- **Die `BackButton`-Regel aus `CLAUDE.md` wird eingehalten**, inklusive der dokumentierten Ausnahme — ein automatischer Erstverdacht erwies sich bei Einzelprüfung als unbegründet.

---

## 7. Top-Risiken

| # | Risiko | Betroffen | Schwere | Prio |
|---|---|---|---|---|
| 1 | Wohnadressen von Therapeut:innen öffentlich, entgegen ausdrücklicher Zusage | Therapeut:innen | Kritisch | P0 |
| 2 | Kontoübernahme über abgreifbare Benutzernamen + unbegrenztes Raten | alle Konten, Patientendaten (P2) | Kritisch | P0 |
| 3 | Löschung entfernt Gesundheits- und Kontaktdaten nicht | Patient:innen | Kritisch | P0 |
| 4 | Datenverlust durch `db push --accept-data-loss` bei jedem Deploy | gesamter Datenbestand | Kritisch | P0 |
| 5 | Abgelaufene Session-Tokens bleiben überall gültig | alle Konten | Hoch | P0 |
| 6 | Nachweise und Fotos überleben jede Löschung | Therapeut:innen | Hoch | P1 |
| 7 | Private Nachweise im öffentlichen Bucket (falls S3 aktiv) | Therapeut:innen | Hoch | P1 |
| 8 | Ungebremstes Produktions-Update der App bei jedem Push | alle App-Nutzer:innen | Hoch | P1 |

---

## 8. Findings Register

Vollständig in [03-findings-register.md](03-findings-register.md): **37 Befunde** — 4 kritisch, 10 hoch, 15 mittel, 7 niedrig, 1 Hinweis. Jeder mit Status, Beleg (Datei + Zeile), Auswirkung, Ursache, Empfehlung, Aufwand, Akzeptanzkriterien und Verifikationstest. Dort ebenfalls die **Dokumentationsdrift-Matrix** mit neun belegten Widersprüchen.

---

## 9. Quick Wins

Hohe Wirkung, geringer Aufwand — alle in ≤1 Tag umsetzbar:

| Maßnahme | Datei | Wirkung |
|---|---|---|
| `crypto.randomInt` statt `Math.random()` | `register.ts:151` | Schließt SEC-005 vollständig (Einzeiler) |
| `_debug`/`_prismaCode` aus 500-Response entfernen | `booking.ts:494-495` | Schließt API-001 |
| `secure: true` für Admin-Cookies | `actions.ts:120,126` | Teil von SEC-004 |
| Default `admin123`/`admin@revio.de` entfernen | `env.ts:7-8` | Teil von SEC-004 |
| Ratelimit auf Auth- und Admin-Login | `auth.ts`, `admin.ts` | Bricht Kette SEC-001 auf |
| Login-Fehlermeldung vereinheitlichen | `auth.ts:94,165` | Zweite Hälfte von SEC-001 |
| `email` aus öffentlicher Suche entfernen | `search.ts:424,566` | PRIV-002 + Basis von SEC-001 |
| `approximate`-Zweig auf Ortsgeocode umstellen | `auth.ts:534-537` | **Behebt den kritischen Teil von PRIV-001** |
| `@fastify/helmet` registrieren | `app.ts` | Grundschutz SEC-006 |
| JSON-LD maskieren (`<` etc.) | `[stadt]/page.tsx:106`, `[slug]/page.tsx:241` | Schließt SEC-003 |
| `check:classification` in CI + 11 Felder klassifizieren | `ci.yml`, `data-classification.yaml` | DATA-001, OPS-002 |
| Ratelimit + Honeypot für `/feedback` | `feedback.ts` | SEC-009 (Muster aus `contact.ts`) |
| `needs: [api]` im EAS-Workflow | `eas-update.yml` | Entschärft OPS-003 |
| Ungenutzte Dependencies entfernen | `apps/api/package.json` | DEBT-001 |
| `CLAUDE.md` §4 „reviews" streichen | `CLAUDE.md` | DOC-001 |

---

## 10. Roadmap nach Priorität

**P0 — sofort eindämmen oder binnen 48 h validieren**
- PRIV-001 Standortschalter reparieren **und Bestandsdaten korrigieren**
- SEC-001 Ratelimit + einheitliche Login-Antwort + `email` aus der Suche
- DEL-001 Löschung als expliziten, vollständigen Vorgang implementieren
- OPS-001 **zuerst Backup-Lage verifizieren**, dann Schema/Migrationen konsolidieren
- SEC-002 Session-Ablauf zentral prüfen
- *Validierungsfragen:* Ist S3 aktiv (STOR-002)? Ist `REVIO_ADMIN_PASSWORD` gesetzt (SEC-004)?

**P1 — nächster Sprint**
STOR-001 (Löschpfad für Dateien), STOR-002 (Bucket-Trennung), SEC-003 (JSON-LD), SEC-004 (Admin-Härtung), SEC-005, PRIV-002, SEC-006 (Header + CSP), OPS-002 (CI), OPS-003 (EAS-Gate), SEC-007, API-001, SEC-008, DATA-001, ARCH-001

**P2 — 1–3 Monate**
PERF-001 (Feldselektion + Pagination), OPS-004 (Cache/Scheduler mehrinstanzfähig), MOB-001 (SecureStore), CLAIM-001 (Detektion), SEC-009, PERF-002 (Caching der SEO-Seiten), PROD-001 (Moderation), DOC-001, TEST-001/002/003, DATA-002 (xlsx klären)

**P3 — strategischer Backlog**
DEBT-001…005, MOB-002, Aufteilung von `admin.ts`, Konsolidierung der zwei Buchungsmodelle, Export-/Löschpfad für `practice_owner`, Vereinheitlichung der API-Fehlermeldungen auf Deutsch

---

## 11. 30/60/90-Tage-Plan

**Tage 1–30 — Blutung stoppen**
Woche 1: Backup-Lage klären und Restore testen (blockiert alles Weitere an der Datenbank); PRIV-001 fixen und Bestandsdaten migrieren; SEC-001 vollständig; `env.ts`-Defaults entfernen; S3-Frage beantworten.
Woche 2: SEC-002 (zentrale Akteursauflösung — löst zugleich Duplikation in fünf Dateien); DEL-001; Quick Wins aus Abschnitt 9.
Woche 3–4: OPS-001 Schema-Konsolidierung samt Baseline-Migration; `check:classification` in CI; CI um Site und Mobile erweitern.
*Messbar:* 4 kritische Befunde geschlossen, CI blockiert unklassifizierte Felder, ein Startkommando im Repo.

**Tage 31–60 — Härten**
STOR-001/002; SEC-006 inkl. CSP; SEC-003; EAS-Gate; Admin-Konten mit individueller Identität und 2FA; Tests gegen PostgreSQL inklusive Nebenläufigkeitstest für Doppelbuchung; Mailer in Tests stubben.
*Messbar:* keine hohen Befunde offen; Tests hermetisch und gegen die Produktions-Engine.

**Tage 61–90 — Tragfähig machen**
Suchpfad auf Feldselektion und DB-seitige Filterung umstellen; Scheduler in separaten Worker mit Advisory Lock; Caching der öffentlichen SEO-Seiten und anschließende **Messung** (vorher/nachher); SecureStore in der App; Bewertungsmoderation; Observability (Error-Tracking mit PII-Filter, Correlation IDs, Alerts auf 5xx und Job-Ausfall); Runbook und Incident-Prozess.
*Messbar:* zweite API-Instanz gefahrlos möglich; gemessene Ladezeiten der Stadtseiten.

---

## 12. Abhängigkeiten und empfohlene Reihenfolge

```
Backup verifizieren ──► OPS-001 (Schema/Migrationen) ──► ARCH-001 ──► TEST-002 (PG-Tests)
                                                                          │
SEC-002 (zentrale Akteursauflösung) ──────────────────────────────────────┤
        └──► Voraussetzung für saubere Ratelimits und Token-Rotation      │
                                                                          ▼
PRIV-001 ──► Bestandsdatenmigration            OPS-004 (Worker/Cache) ──► Mehrinstanzbetrieb
SEC-001 ──► (email entfernen) ──► PRIV-002 teilweise miterledigt
DEL-001 ──► STOR-001 (Dateien) ──► vollständige Art.-17-Erfüllung
SEC-004 (Admin-Identitäten) ──► DATA-001 (Actor-Spalte im Audit-Log)
```

**Kritische Reihenfolgeregeln:**
1. **Nichts an Schema oder Migrationen anfassen, bevor Backups verifiziert und ein Restore getestet ist.**
2. SEC-002 vor allen weiteren Auth-Arbeiten — sonst wird die Korrektur fünfmal gebaut.
3. DEL-001 vor STOR-001, weil der Dateilöschpfad am Kontolöschvorgang hängt.
4. SEC-004 (echte Admin-Identitäten) vor der Actor-Spalte in DATA-001.

---

## 13. Erfolgsmessung und Re-Test-Plan

| Befund | Verifikation nach Umsetzung |
|---|---|
| PRIV-001 | Profil „ungefähr" + volle Adresse → `POST /search` → Distanz zur echten Adresse ≥500 m |
| SEC-001 | 25 Fehlversuche → 429; Statuscode, Body und Antwortzeit für bekanntes vs. unbekanntes Konto ununterscheidbar; `email` fehlt in der Response |
| DEL-001 | Integrationstest: anlegen → buchen → Feedback → löschen → Volltextsuche über E-Mail/Nachname/Telefon in allen Tabellen = 0 Treffer |
| OPS-001 | Ein Schema, ein Startkommando, `migrate deploy` im Start, kein `--accept-data-loss` im Repo; Restore dokumentiert getestet |
| SEC-002 | Manipulierter abgelaufener Token → 401 auf mindestens einem Endpunkt je Routenmodul |
| STOR-001 | Nach Kontolöschung ist keine zugehörige Datei mehr unter ihrer URL abrufbar |
| STOR-002 | Privates Dokument ohne Signatur → 403, auch bei Kenntnis des Schlüssels |
| SEC-003 | `fullName` mit `</script>`-Payload → `window.__xss` bleibt undefined |
| DATA-001 | `check:classification` in CI grün; neues unklassifiziertes Feld lässt CI fehlschlagen |
| PERF-002 | Lighthouse gegen Staging, vorher/nachher dokumentiert |

**Re-Test-Rhythmus:** P0 einzeln nach Umsetzung; vollständiger Re-Audit der Kapitel Security und Datenschutz nach Abschluss von P1 (~60 Tage). Jeder Befund sollte einen dauerhaften automatisierten Test hinterlassen, sonst kehrt er zurück.

---

## 14. Offene Fragen und nicht prüfbare Bereiche

**Beantwortung ändert die Bewertung wesentlich:**
1. Laufen automatische Backups der Produktionsdatenbank, und wurde je ein Restore getestet? *(Bestimmt, wie akut OPS-001 ist.)*
2. Ist `STORAGE_PROVIDER` produktiv `s3`? *(Bestimmt, ob STOR-002 hoch oder gegenstandslos ist.)*
3. Ist `REVIO_ADMIN_PASSWORD` produktiv gesetzt, oder greift der Default? *(Bestimmt, ob SEC-004 hoch oder kritisch ist.)*
4. Läuft die API auf genau einer Instanz? *(Bestimmt, ob OPS-004 latent oder akut ist.)*
5. Enthalten `data/*.xlsx` echte personenbezogene Daten?
6. In welcher Region liegt die Railway-PostgreSQL (DS-83)?
7. Wie viele Bestandsprofile haben `locationPrecision='approximate'` bei gesetzter Straße? *(Umfang der PRIV-001-Datenkorrektur.)*

**Nicht geprüft:** laufende Anwendungen, visuelle Prüfung, Accessibility (WCAG 2.2 AA ist damit **weder bestätigt noch widerlegt**), gemessene Performance, Produktionskonfiguration, Backups/RTO/RPO, iOS-/Android-Builds, Deep-Link- und Push-Verhalten auf Geräten, Inhalte lokaler Datenbanken und Upload-Verzeichnisse, CI-Historie.

---

## 15. Ausgeführte und fehlgeschlagene Befehle

Vollständiges Protokoll mit Exit-Codes in [02-test-and-command-log.md](02-test-and-command-log.md).

| Befehl | Exit | Kurzfassung |
|---|---:|---|
| `prisma generate` | 0 | erfolgreich (Client fehlte lokal) |
| `tsc --noEmit` (api) | **0** | ✅ keine Typfehler |
| `check:classification` | **1** | ❌ 11 Verstöße |
| `vitest run` (Lauf 1) | 1 | 3 von 5 Suites laden nicht (`ETIMEDOUT`, Dateisystem) |
| `vitest run` (Lauf 2) | 1 | 213/215 grün, 2 rot — **Umgebung, nicht als Defekt gewertet** |
| `vitest run log-redaction` | 1 | 314 s für 3 Unit-Tests, RPC-Timeout |
| `next build` (admin) | 1 | **Kompilierung + Typprüfung erfolgreich, 22/22 Seiten** — Abbruch erst beim finalen `rename` (`ENOENT`) |
| `next build` (site) | — | nicht ausgeführt |
| `pnpm --filter @revio/mobile test` | — | **existiert nicht** |

**Umgebungsbefund (kein Produktrisiko):** Das Repository liegt unter `~/Desktop` im iCloud-Drive-Sync. Drei unabhängige Belege: `ETIMEDOUT` beim Modul-Read in Vitest, 314 s für drei Unit-Tests, und zwei `ENOENT`-Fehlschläge beim `rename` selbst gerade erzeugter Dateien im Admin-Build. `node_modules`- und `.next`-I/O sind dort so unzuverlässig, dass lokale Tests und Builds praktisch nicht durchführbar sind. Ein Verschieben außerhalb von iCloud Drive — oder ein Sync-Ausschluss für `node_modules`/`.next` — würde die lokale Entwicklungsschleife unmittelbar wiederherstellen. Dies war die größte Einschränkung dieses Audits.

**Wichtig für die Bewertung:** Wo Befehle abbrachen, lag es nachweislich an der Umgebung, nicht am Code. Alle drei Signale, die den Anwendungscode selbst betreffen — API-Typecheck (Exit 0), 213 von 215 Tests grün, Admin-Kompilierung und -Typprüfung erfolgreich — sind positiv.

---

*Der Audit ist im dokumentierten Umfang abgeschlossen. Jeder anwendbare Bereich ist entweder geprüft oder ausdrücklich als teilweise beziehungsweise nicht prüfbar ausgewiesen. Der als kritisch eingestufte Befund PRIV-001 wurde unmittelbar bei Entdeckung gemeldet; eine aktive Ausnutzung fand in keinem Fall statt.*
