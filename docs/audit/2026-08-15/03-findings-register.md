# 03 — Findings Register

Stand: 2026-08-15, verifiziert gegen Commit `1679f86`.
Legende Status: **BC** = BESTÄTIGT-CODE · **BL** = BESTÄTIGT-LAUFZEIT · **IND** = INDIZ/HYPOTHESE · **NP** = NICHT PRÜFBAR
`WT` = betrifft uncommitted Working Tree.

| ID | Titel | Schwere | Prio | Status |
|---|---|---|---|---|
| [PRIV-001](#priv-001) | Standort-Datenschutzschalter wirkungslos — exakte Wohnadresse öffentlich | Kritisch | P0 | BC |
| [SEC-001](#sec-001) | Unbegrenzte Login-Versuche + Kontoaufzählung + öffentlich abgreifbare E-Mails | Kritisch | P0 | BC |
| [DEL-001](#del-001) | Kontolöschung entfernt Patientendaten nicht — Doku sagt „implementiert" | Kritisch | P0 | BC |
| [OPS-001](#ops-001) | Produktion deployt per `db push --accept-data-loss` gegen tote Zweitschema-Datei | Kritisch | P0 | BC |
| [SEC-002](#sec-002) | Session-Ablauf wird fast nirgends geprüft | Hoch | P0 | BC |
| [STOR-001](#stor-001) | Keine Datei wird je gelöscht — Nachweise überleben Kontolöschung | Hoch | P1 | BC |
| [STOR-002](#stor-002) | S3-Pfad legt private Nachweise in den öffentlichen Bucket-Namensraum | Hoch | P1 | BC |
| [SEC-003](#sec-003) | Stored XSS auf der Website über Therapeuten-Namen (JSON-LD) | Hoch | P1 | BC |
| [SEC-004](#sec-004) | Admin: geteilter statischer Token, Default-Passwort, kein Ratelimit, `secure:false` | Hoch | P1 | BC |
| [SEC-005](#sec-005) | OTP aus `Math.random()` | Hoch | P1 | BC |
| [PRIV-002](#priv-002) | Öffentliche Suche gibt E-Mail und Telefon aller Therapeut:innen aus | Hoch | P1 | BC |
| [OPS-002](#ops-002) | CI deckt Site, Mobile und die DSGVO-Prüfung nicht ab | Hoch | P1 | BC/BL |
| [SEC-006](#sec-006) | Keinerlei Security-Header | Hoch | P1 | BC |
| [OPS-003](#ops-003) | Ungebremstes EAS-Produktions-Update bei jedem Push auf `main` | Hoch | P1 | BC |
| [SEC-007](#sec-007) | OTP-Brute-Force: Limit nur pro IP, kein Versuchszähler | Mittel | P1 | BC |
| [API-001](#api-001) | Interne Fehlerdetails im 500-Response (`_debug`, `_prismaCode`) | Mittel | P1 | BC |
| [SEC-008](#sec-008) | `console.log` von OTP und E-Mail umgeht die Redaction | Mittel | P1 | BC |
| [DATA-001](#data-001) | `AdminAccessLog` unklassifiziert, speichert Patienten-E-Mails, keine Frist | Mittel | P1 | BL |
| [ARCH-001](#arch-001) | Schema-Drift dev/prod + 5 tote Prod-Modelle mit Personendaten | Mittel | P1 | BC |
| [PERF-001](#perf-001) | Keine Pagination; Suchcache lädt Passwort-Hashes in den Speicher | Mittel | P2 | BC |
| [OPS-004](#ops-004) | In-Process-Cache und Scheduler brechen bei >1 Instanz | Mittel | P2 | BC |
| [MOB-001](#mob-001) | Session-Token im Klartext in AsyncStorage | Mittel | P2 | BC |
| [CLAIM-001](#claim-001) | Praxis-Übernahme ohne Zugehörigkeitsnachweis, ohne Detektion | Mittel | P2 | BC |
| [SEC-009](#sec-009) | `POST /feedback` unauthentifiziert und ohne Ratelimit | Mittel | P2 | BC |
| [PERF-002](#perf-002) | `force-dynamic` im Root-Layout verhindert jedes Caching der SEO-Seiten | Mittel | P2 | BC |
| [PROD-001](#prod-001) | Bewertungen gehen ungeprüft live, Moderationsstatus unerreichbar | Mittel | P2 | BC |
| [DOC-001](#doc-001) | `CLAUDE.md` widerspricht sich bei Bewertungen | Mittel | P2 | BC |
| [TEST-001](#test-001) | Tests rufen einen echten Drittanbieter auf | Mittel | P2 | BL |
| [TEST-002](#test-002) | Buchungs-Nebenläufigkeit wird nie getestet | Mittel | P2 | BC |
| [TEST-003](#test-003) | Hintergrundjob läuft unbedingt auch im Test | Niedrig | P2 | BC |
| [DEBT-001](#debt-001) | Vier ungenutzte Abhängigkeiten, ungenutztes `JWT_SECRET` | Niedrig | P3 | BC |
| [DEBT-002](#debt-002) | `verifyPassword` wirft bei defektem Hash | Niedrig | P3 | BC |
| [DEBT-003](#debt-003) | Admin-Token-Vergleich nicht zeitkonstant | Niedrig | P3 | BC |
| [DEBT-004](#debt-004) | Root-`tsconfig.json` referenziert nicht auflösbares Base-Config | Niedrig | P3 | BL |
| [DEBT-005](#debt-005) | Drei Node-Major-Versionen über Umgebungen | Niedrig | P3 | BC |
| [MOB-002](#mob-002) | Debug-Screen mit Token-Anzeige in Produktionsbuilds | Niedrig | P3 | BC |
| [DATA-002](#data-002) | `data/*.xlsx` git-getrackt, Inhalt ungeprüft | Hinweis | P2 | NP |

---

<a id="priv-001"></a>
## PRIV-001 — Standort-Datenschutzschalter ist wirkungslos; exakte Wohnadress-Koordinaten werden öffentlich ausgeliefert

**Bereich/Tags:** Datenschutz, API, Mobile · `P1`, DS-21, Art. 5(1)(a), Personensicherheit
**Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Kritisch** · **Prio: P0** · W 5 / R 4

**Beobachtung.** Die App bietet Therapeut:innen die Wahl zwischen exakter und ungefährer Standortanzeige und sagt für die ungefähre Option ausdrücklich zu, dass die genaue Adresse privat bleibt. Das Backend speichert in beiden Fällen dieselben straßengenauen Koordinaten und gibt sie unauthentifiziert aus.

**Beleg.**
- Zusage in der UI: [`TherapistDashboard.js:839`](../../../apps/mobile/src/screens/profile/TherapistDashboard.js) und [`ProfileCompletionWizard.js:589`](../../../apps/mobile/src/components/ProfileCompletionWizard.js) — `{ value: 'approximate', label: 'Nur ungefähre Umgebung', sub: 'Deine genaue Adresse bleibt privat' }`; [`translations.js:488`](../../../apps/mobile/src/i18n/translations.js) — „Zeige nur eine ungefähre Position, z. B. in deiner Stadt."
- Wirkungsloser Zweig: [`auth.ts:531-537`](../../../apps/api/src/routes/auth.ts) — `if (effectivePrecision === 'exact' && exactCoords) { homeLat = exactCoords.lat } else if (exactCoords) { /* use it for approximate too */ homeLat = exactCoords.lat }`. Beide Zweige weisen identische Werte zu.
- Gleiches Muster bei Registrierung: [`register.ts:269-270`](../../../apps/api/src/routes/register.ts).
- Quelle der Koordinaten: [`auth.ts:526`](../../../apps/api/src/routes/auth.ts) `geocodeAddress(streetPart, cityPart)` mit Straße + Hausnummer.
- Kein Runden/Fuzzing im gesamten Code (geprüft `search.ts`, `geocode.ts`, `auth.ts`, `register.ts`: 0 Treffer für `toFixed|Math.round|jitter|fuzz`).
- Sink: [`search.ts:438-440`](../../../apps/api/src/routes/search.ts) — `homeLat`/`homeLng` im **unauthentifizierten** `POST /search`, für Freelancer mit `homeVisit` ohne Praxis.
- Seit dem Working-Tree-Stand zusätzlich über [`apps/site/app/api/find-search/route.ts`](../../../apps/site/app/api/find-search/route.ts) vom Browser aus erreichbar. `WT`

**Datenfluss.** Therapeut wählt „ungefähr" → `PATCH /auth/me` → Nominatim liefert Hausnummer-genaue Koordinaten → `homeLat`/`homeLng` = exakt → `POST /search` (ohne Auth) → beliebiger Dritter.

**Auswirkung.** Freiberufliche Physiotherapeut:innen arbeiten häufig von zuhause. Deren Wohnadresse ist auf Hausnummer-Genauigkeit für jede Person im Internet abrufbar — entgegen einer ausdrücklichen Zusage im Einwilligungsdialog. Das ist kein reines Minimierungsthema, sondern eine Diskrepanz zwischen zugesicherter und tatsächlicher Verarbeitung, mit realem Stalking-/Sicherheitsrisiko für die betroffene Person.

**Ursache.** Bewusste Performance-Optimierung („avoids second Nominatim request") ohne Ersatz für die Privacy-Semantik.

**Empfehlung.**
1. Sofort: bei `approximate` `homeLat/homeLng` auf Ortsmittelpunkt setzen (der `else if (cityPart …)`-Zweig existiert bereits, [`auth.ts:538-545`](../../../apps/api/src/routes/auth.ts)) — statt den Exakt-Treffer wiederzuverwenden. Kosten: ein zusätzlicher Geocode, cachebar pro Ort.
2. Zusätzlich serverseitig beim **Ausliefern** quantisieren (z. B. ~1 km Raster) statt sich auf die Speicherung zu verlassen.
3. Einmalige Korrektur der Bestandsdaten für alle Profile mit `locationPrecision='approximate'`.
4. `latitude`/`longitude` (exakt) niemals in öffentliche Responses aufnehmen.

**Aufwand:** S (Fix) + S (Datenkorrektur) · **Zuständigkeit:** Backend
**Akzeptanzkriterien.** Für `locationPrecision='approximate'` weicht `homeLat/homeLng` um ≥500 m vom Geocode der vollen Adresse ab; `POST /search` liefert für kein Profil straßengenaue Koordinaten; Bestandsdaten migriert.
**Verifikationstest.** Profil mit „ungefähr" + vollständiger Adresse anlegen → `POST /search` → Distanz zwischen geliefertem Punkt und echter Adresse messen, muss ≥500 m sein.
**Offene Frage.** Wie viele Bestandsprofile sind betroffen? (`SELECT count(*) FROM Therapist WHERE locationPrecision='approximate' AND street IS NOT NULL`)

---

<a id="sec-001"></a>
## SEC-001 — Unbegrenzte Login-Versuche, Kontoaufzählung und öffentlich abgreifbare Benutzernamen

**Bereich/Tags:** Security, Auth · OWASP API2:2023, A07:2021
**Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Kritisch** · **Prio: P0** · W 5 / R 5

**Beobachtung.** Drei einzeln mittelschwere Schwächen ergeben zusammen eine vollständige Angriffskette auf alle Therapeuten-Konten.

**Beleg.**
1. **Kein Ratelimit auf Login.** `rateLimitPlugin` registriert `@fastify/rate-limit` mit `global: false` ([`rateLimitPlugin.ts:5-7`](../../../apps/api/src/plugins/rateLimitPlugin.ts)). Per-Route-Limits existieren ausschließlich in `contact.ts:21`, `claim.ts:52`, `register.ts:52/122/167`. **`POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `PATCH /auth/password` und `POST /admin/login` haben keines.**
2. **Kontoaufzählung im Login.** [`auth.ts:94`](../../../apps/api/src/routes/auth.ts) `'Falsches Passwort. Bitte erneut versuchen.'` vs. [`auth.ts:165`](../../../apps/api/src/routes/auth.ts) `'Benutzer mit dieser E-Mail nicht gefunden.'` — unterschiedliche Antworten für „Konto existiert" und „Konto existiert nicht".
3. **Zweiter Enumerationskanal.** [`register.ts:134/137`](../../../apps/api/src/routes/register.ts) antwortet mit 409 `'Diese E-Mail-Adresse ist bereits registriert.'`
4. **Benutzernamen sind öffentlich.** [`search.ts:424`](../../../apps/api/src/routes/search.ts) und [`search.ts:566`](../../../apps/api/src/routes/search.ts) geben `email` unauthentifiziert aus — dieselbe Adresse ist der Login-Benutzername.

**Kompensierende Controls — geprüft, unzureichend.** Passwort-Hashing ist scrypt mit 16-Byte-Salt und `timingSafeEqual` ([`auth-utils.ts:6-16`](../../../apps/api/src/routes/auth-utils.ts)) — gut, bremst Online-Angriffe aber nicht. Kein Lockout, kein CAPTCHA, keine Anomalieerkennung, kein 2FA. Der Code kennt das Enumerationsproblem nachweislich (`// Always return success to prevent email enumeration`, [`auth.ts:1114`](../../../apps/api/src/routes/auth.ts); `// Same error for "not found" and "wrong code" — prevents email enumeration`, [`register.ts:184`](../../../apps/api/src/routes/register.ts)) — es ist an zwei Stellen sauber gelöst und an der wichtigsten nicht.

**Angriffskette.** `POST /search` mit generischem Begriff → vollständige Liste gültiger Login-Adressen (bis `SEARCH_RESULT_LIMIT` 200 pro Anfrage, durch Variation der Stadt vollständig abgreifbar) → unbegrenztes Passwort-Raten auf `/auth/login`. Ein Treffer öffnet ein Therapeutenkonto mit Patientennamen, -telefonnummern und angefragten Heilmitteln (P2).

**Auswirkung.** Kontoübernahme mit Zugriff auf Gesundheitsdaten Dritter. Meldepflichtiger Vorfall nach Art. 33/34 im Ernstfall.

**Empfehlung.**
1. **P0:** Ratelimit auf alle Auth-Routen — gestaffelt pro IP **und** pro Konto (z. B. 5/15 Min pro E-Mail, 20/15 Min pro IP), plus exponentielles Backoff.
2. **P0:** Einheitliche Antwort bei Login-Fehlschlag („E-Mail oder Passwort ist falsch."), unabhängig davon, ob das Konto existiert. Laufzeit angleichen (Dummy-Hash-Vergleich bei unbekanntem Konto).
3. **P1:** `email` aus `POST /search` und `GET /therapist/:id` entfernen (siehe PRIV-002). Kontaktaufnahme läuft ohnehin über Buchung/Anfrage.
4. **P1:** `/register/send-otp` nicht mehr mit 409 antworten — stattdessen wie `forgot-password` immer `{ok:true}` und die Kollision erst beim Registrierungsabschluss behandeln.
5. **P2:** Lockout-Zähler pro Konto, Benachrichtigung bei Anmeldung von neuem Gerät.

**Aufwand:** S (1+2), S (3+4), M (5) · **Zuständigkeit:** Backend
**Akzeptanzkriterien.** 20 Fehlversuche gegen dieselbe Adresse → 429; Antwort und Antwortzeit sind für existierende und nicht existierende Konten nicht unterscheidbar; `POST /search` enthält kein `email`-Feld.
**Verifikationstest.** Automatisierter Test: 25× `/auth/login` mit falschem Passwort → ab Versuch N 429. Zweiter Test: Statuscode und Body für bekanntes vs. unbekanntes Konto identisch.

---

<a id="del-001"></a>
## DEL-001 — Kontolöschung entfernt personenbezogene Daten nicht; das Löschkonzept führt das als „implementiert"

**Bereich/Tags:** Datenschutz · Art. 17 DSGVO, DS-41
**Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Kritisch** · **Prio: P0** · W 5 / R 4

**Beobachtung.** `DELETE /auth/me` löscht den `User`-Datensatz. Alle Buchungen bleiben mit vollem Klarnamen, E-Mail, Telefonnummer, angefragtem Heilmittel (P2) und Freitext bestehen — nur der Fremdschlüssel wird auf `NULL` gesetzt. Die Daten sind damit weder gelöscht noch anonymisiert, aber nicht mehr auffindbar.

**Beleg.**
- [`schema.prisma:391`](../../../apps/api/prisma/schema.prisma) — `patientUser User? @relation(fields: [patientUserId], references: [id], onDelete: SetNull)`
- Erhaltene Felder in `BookingRequest`: `patientName`, `patientEmail`, `patientPhone`, `heilmittel`, `kassenart`, `message`.
- `ScheduledSlot` hängt an `BookingRequest` (Cascade) — da diese bleibt, bleiben auch `patientName` und `patientPhone` dort.
- `AppFeedback`: [`schema.prisma:353`](../../../apps/api/prisma/schema.prisma) ebenfalls `SetNull`, `email` und `message` bleiben.
- Löschpfad: [`auth.ts:891-903`](../../../apps/api/src/routes/auth.ts).
- **Therapeutenseite spiegelbildlich:** [`auth.ts:924-930`](../../../apps/api/src/routes/auth.ts) löscht `Therapist`, lässt den `User` (E-Mail, `passwordHash`, Namen) stehen und nullt nur den Session-Token. Umgekehrt ist `Therapist.userId` ebenfalls `SetNull` ([`schema.prisma:161`](../../../apps/api/prisma/schema.prisma)).

**Dokumentationswiderspruch.** [`docs/loeschkonzept.md:17`](../../../docs/loeschkonzept.md) führt `BookingRequest` unter „Verknüpfte Nutzerdaten … | Account-Löschung | Prisma-Cascade / `SetNull` | **implementiert**". `SetNull` ist aber kein Löschmechanismus, sondern das Gegenteil: es erhält den Datensatz und kappt nur die Zuordnung. Die Zeile fasst zwei gegensätzliche Mechanismen unter einem Häkchen zusammen.

**Auswirkung.** Ein Auskunfts- oder Löschersuchen kann nach der Löschung nicht mehr bedient werden — die Daten existieren, sind aber nicht mehr der Person zuzuordnen. Betroffen sind Gesundheitsdaten (Art. 9).

**Empfehlung.**
1. Löschung als expliziten Vorgang implementieren statt über Referenz-Aktionen: in einer Transaktion Buchungen des Kontos **echt anonymisieren** (`patientName='Gelöscht'`, `patientEmail=NULL`, `patientPhone=NULL`, `message=NULL`, `heilmittel=NULL`) oder löschen, je nach dokumentierter Aufbewahrungsentscheidung.
2. Für Therapeut:innen `User` **und** `Therapist` gemeinsam in einer Transaktion behandeln.
3. `docs/loeschkonzept.md` korrigieren: `SetNull` von „implementiert" trennen und als offene Lücke führen.
4. Test, der nach `DELETE /auth/me` prüft, dass keine Tabelle mehr Klardaten der Person enthält.

**Aufwand:** M · **Zuständigkeit:** Backend + DSB
**Akzeptanzkriterien.** Nach Kontolöschung liefert eine Volltextsuche über E-Mail, Nachname und Telefonnummer in allen Tabellen null Treffer.
**Verifikationstest.** Integrationstest: Patient anlegen → buchen → Feedback senden → löschen → assert über `BookingRequest`, `ScheduledSlot`, `AppFeedback`, `Notification`, `TherapistReview`.
**Standardreferenz.** DSGVO Art. 17, `docs/dsgvo.md` DS-41.

---

<a id="ops-001"></a>
## OPS-001 — Produktion synchronisiert das Schema bei jedem Start mit `--accept-data-loss` gegen eine nicht gepflegte Zweitdatei

**Bereich/Tags:** Betrieb, Datenintegrität
**Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Kritisch** · **Prio: P0** · W 4 / R 5

**Beobachtung.** Es gibt vier widersprüchliche Startkommandos. Der real genutzte Pfad wirft bei jedem Boot Prisma `db push --accept-data-loss` gegen die Produktionsdatenbank — ohne Migrationshistorie, ohne Review, ohne Rollback.

**Beleg.**

| Quelle | Kommando |
|---|---|
| [`railpack.toml`](../../../railpack.toml) `[deploy]` | `prisma db push --schema prisma/schema.production.prisma --skip-generate --accept-data-loss && node dist/server.js` |
| [`nixpacks.toml`](../../../nixpacks.toml) `[start]` | `prisma db push --schema prisma/schema.production.prisma --accept-data-loss && node dist/server.js` |
| [`apps/api/start.sh:21`](../../../apps/api/start.sh) (Dockerfile-CMD) | `prisma db push --schema prisma/schema.production.prisma --accept-data-loss` |
| [`apps/api/package.json`](../../../apps/api/package.json) `start` | `prisma migrate deploy && node dist/server.js` ← **würde fehlschlagen** |

- 63 Migrationen liegen unter `prisma/migrations/`, werden im Produktionspfad aber **nie angewendet**.
- [`migrations/migration_lock.toml`](../../../apps/api/prisma/migrations/migration_lock.toml) — `provider = "sqlite"`. `prisma migrate deploy` gegen PostgreSQL bricht damit mit Provider-Konflikt ab; das `package.json`-`start`-Script ist also toter, irreführender Code.
- `schema.prisma` deklariert `provider = "sqlite"`, `schema.production.prisma` `postgresql` — zwei handgepflegte Dateien ohne Generator.
- `start.sh:29` zieht Seed-Daten per `db execute` nach, weil `db push` keine Migrations-SQL ausführt — ein Workaround, der das Grundproblem bestätigt.

**Auswirkung.** Jede Abweichung zwischen `schema.production.prisma` und der Live-Datenbank wird beim nächsten Deploy **durch Löschen** aufgelöst. Ein versehentlich entferntes Feld in der Schema-Datei löscht die Spalte samt Inhalten — bei Gesundheits- und Kontaktdaten irreversibel, sofern kein Backup existiert (Backup-Lage: NICHT PRÜFBAR). Kein Rollback-Pfad, keine nachvollziehbare Schemahistorie in Produktion.

**Ursache.** Der Kommentar in `railpack.toml` benennt sie: `db push` wurde eingeführt, um destruktive Änderungen nicht-interaktiv durchzubekommen, nachdem Migrationen wegen des Provider-Wechsels sqlite→postgres nicht mehr liefen.

**Empfehlung.**
1. **P0 — Vorbedingung:** Verifizieren, dass automatische Backups der Railway-PostgreSQL laufen, und einen Restore testen. Ohne das ist jeder weitere Schritt riskant.
2. **P0:** Auf **eine** Schemadatei mit `provider = "postgresql"` konsolidieren; SQLite für lokale Entwicklung aufgeben (Tests dann gegen Postgres-Container) — das beseitigt zugleich ARCH-001 und TEST-002.
3. **P0:** Migrationshistorie neu aufsetzen (`migrate diff` gegen die Live-DB → Baseline-Migration → `migrate resolve --applied`), danach ausschließlich `prisma migrate deploy` im Start.
4. **P1:** `--accept-data-loss` aus allen Configs entfernen. Die drei toten Startpfade (`nixpacks.toml`, `package.json`-`start` oder `railpack.toml`) auf einen reduzieren.

**Aufwand:** L · **Zuständigkeit:** Backend/DevOps
**Akzeptanzkriterien.** Genau eine Schemadatei und ein Startkommando im Repo; Produktionsstart wendet Migrationen an; kein `--accept-data-loss` im Repo; Restore aus Backup dokumentiert getestet.
**Offene Frage.** Existieren automatische Backups der Produktionsdatenbank, und wurde je ein Restore getestet?

---

<a id="sec-002"></a>
## SEC-002 — Ablauf des Session-Tokens wird in fast keinem Endpunkt geprüft

**Bereich/Tags:** Security, Auth · **Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Hoch** · **Prio: P0** · W 4 / R 4

**Beobachtung.** Tokens haben 30 Tage TTL ([`auth.ts:52`](../../../apps/api/src/routes/auth.ts)). Geprüft wird `sessionTokenExpiresAt` aber nur an 4 Stellen; alle übrigen ~90 authentifizierten Endpunkte akzeptieren abgelaufene Tokens unbegrenzt weiter.

**Beleg.** Vollständige Trefferliste für `sessionTokenExpiresAt` in Lesekontexten:
- [`auth.ts:280`](../../../apps/api/src/routes/auth.ts) — nur `GET /auth/me`
- [`claim.ts:115, 152, 215`](../../../apps/api/src/routes/claim.ts) — nur die `practice_owner`-Routen

**Nicht geprüft:** `PATCH /auth/me`, `DELETE /auth/me`, `GET /auth/me/export`, `PATCH /auth/password`, `PATCH /auth/push-token`, `GET /auth/documents`, alle Favoriten-Routen, gesamtes `booking.ts`, `inquiry.ts`, `reviews.ts`, `notifications.ts`, `schedule.ts`, `upload.ts`.

**Zusätzlich:** Auf dem Legacy-Login-Pfad wird auf dem `Therapist` gar kein Ablauf gesetzt — [`auth.ts:150-153`](../../../apps/api/src/routes/auth.ts) schreibt nur `sessionToken` und `userId`. Gleiches bei [`auth.ts:241-244`](../../../apps/api/src/routes/auth.ts) (`POST /auth/verify-email`). Diese Tokens laufen **nie** ab.

**Auswirkung.** Ein einmal entwendeter Token (siehe MOB-001: Klartext auf dem Gerät) bleibt praktisch unbegrenzt gültig — inklusive Datenexport (Art. 15), Kontolöschung und Passwortänderung. Die TTL existiert nur auf dem Papier.

**Empfehlung.** Auflösung von Token → Akteur in **eine** Stelle ziehen (Fastify-`preHandler`/Decorator oder eine gemeinsame `resolveActor`-Funktion), dort Ablauf **einmal** prüfen, alle Routen darauf umstellen. Beim Login auf allen Pfaden konsistent `sessionTokenExpiresAt` setzen. Rotation bei Passwortänderung erzwingen.
Heute existieren mindestens vier eigene Auflösungsfunktionen (`auth.ts` inline, `booking.ts:29/35`, `reviews.ts:4/10`, `notifications.ts:10`, `feedback.ts:17`) — die Duplikation ist die Ursache.

**Aufwand:** M · **Akzeptanzkriterien.** Manipulierter Token mit `sessionTokenExpiresAt` in der Vergangenheit liefert auf **jedem** authentifizierten Endpunkt 401. Test deckt mindestens einen Endpunkt je Routenmodul ab.

---

<a id="stor-001"></a>
## STOR-001 — Es gibt keinen einzigen Löschpfad für hochgeladene Dateien

**Bereich/Tags:** Datenschutz, Storage · DS-41 · **Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Hoch** · **Prio: P1** · W 5 / R 3

**Beleg.** `grep -rn "unlink\|rmSync\|fs.rm\|DeleteObject" apps/api/src/` → **0 Treffer**. [`storage.ts`](../../../apps/api/src/utils/storage.ts) exportiert ausschließlich `uploadFile`.

**Folgen im Einzelnen.**
- Kontolöschung: `TherapistDocument`-Zeilen kaskadieren, die **Dateien** (Qualifikationsnachweise, Approbations-/Fortbildungsbelege — sensible Berufsnachweise) bleiben auf Platte bzw. im Bucket.
- Profilfoto ersetzen: altes Foto bleibt unter seiner öffentlichen URL erreichbar.
- `POST /admin/practices/:id/photos/remove` und `POST /claim/me/photos/remove` entfernen nur den String aus dem DB-Feld ([`claim.ts:266-281`](../../../apps/api/src/routes/claim.ts)); die Datei bleibt öffentlich abrufbar. Wer die URL kennt (z. B. aus dem Cache oder einer früheren Antwort), sieht ein „gelöschtes" Foto weiter.
- Keine Quota: `POST /upload/document` ist unbegrenzt oft aufrufbar (kein Ratelimit, kein Zähler) → Storage-Erschöpfung durch ein einziges Konto.

**Empfehlung.** `deleteFile(key)` in `storage.ts` ergänzen (lokal `unlink`, S3 `DeleteObjectCommand`); an Foto-Ersetzung, Foto-Entfernung, Dokumentlöschung und Kontolöschung aufrufen. Kontolöschung als Transaktion + nachgelagerten Storage-Cleanup-Job (fehlertolerant). Dokument-Anzahl pro Therapeut begrenzen (z. B. 10). Orphan-Scan einmalig für Bestandsdateien.
**Aufwand:** M · **Akzeptanzkriterien.** Nach Kontolöschung ist keine zugehörige Datei mehr unter ihrer URL abrufbar; Foto-Ersetzung hinterlässt keine Waise.

---

<a id="stor-002"></a>
## STOR-002 — Im S3-Modus landen private Nachweise im selben Namensraum wie öffentliche Fotos

**Bereich/Tags:** Security, Storage · **Status:** BESTÄTIGT-CODE (Ausnutzbarkeit: INDIZ) · **Confidence:** Mittel · **Schwere: Hoch** · **Prio: P1** · W 3 / R 4

**Beobachtung.** `uploadFile` unterscheidet im S3-Zweig nicht zwischen öffentlichen und privaten Uploads. `localDir` und `publicPrefix` — die einzigen Parameter, die diese Trennung tragen — werden dort schlicht ignoriert.

**Beleg.** [`storage.ts:34-51`](../../../apps/api/src/utils/storage.ts):
```ts
if (env.STORAGE_PROVIDER === 's3') {
  await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET!, Key: opts.key, … }));
  return `${base}/${opts.key}`;
}
```
`opts.key` ist nur `randomBytes(16).hex + ext` ([`upload.ts:24`](../../../apps/api/src/routes/upload.ts) und [`upload.ts:58`](../../../apps/api/src/routes/upload.ts)) — kein Präfix. Profilfoto (öffentlich, `publicPrefix: '/uploads/profile-photos'`) und Verifikationsdokument (privat, `publicPrefix: '/documents'`) gehen in denselben Bucket, flach.

Im lokalen Modus ist die Trennung korrekt: [`storage-paths.ts:10-16`](../../../apps/api/src/utils/storage-paths.ts) trennt `storage/public/uploads` von `storage/private/documents`, und `@fastify/static` bedient in [`app.ts:41-45`](../../../apps/api/src/app.ts) ausschließlich `storage/public/uploads`. Der Fehler betrifft nur den S3-Pfad.

**Auswirkung.** Ist der Bucket öffentlich lesbar (Voraussetzung dafür, dass Profilfotos über `S3_PUBLIC_URL` ausgeliefert werden können), sind sämtliche Therapeuten-Qualifikationsnachweise über ihre URL abrufbar. Der 128-bit-Zufallsschlüssel ist nicht erratbar — die Vertraulichkeit hängt damit allein daran, dass die URL nie leakt (Referrer, Logs, Backups, Weitergabe).

**Warum INDIZ bei der Ausnutzbarkeit:** `STORAGE_PROVIDER` in Produktion ist mir nicht bekannt. Bei `local` besteht das Problem nicht.

**Empfehlung.** Sofort klären, ob S3 produktiv aktiv ist. Falls ja: getrennte Buckets (oder mindestens Präfixe `public/` und `private/`) mit unterschiedlicher Bucket-Policy; private Objekte ausschließlich über zeitlich begrenzte Signed URLs ausliefern. `uploadFile` um einen expliziten Parameter `visibility: 'public' | 'private'` erweitern, damit der Aufrufer die Entscheidung nicht mehr implizit über `publicPrefix` trifft.
**Akzeptanzkriterien.** Ein privat hochgeladenes Dokument ist ohne Signatur nicht abrufbar (403), auch bei Kenntnis des Schlüssels.

---

<a id="sec-003"></a>
## SEC-003 — Stored XSS auf der öffentlichen Website über den Therapeuten-Namen

**Bereich/Tags:** Security, Site · OWASP A03:2021 · **Status:** BESTÄTIGT-CODE · **Confidence:** Mittel-Hoch · **Schwere: Hoch** · **Prio: P1** · W 3 / R 4

**Beobachtung.** Die Stadtseite bettet nutzergesteuerte Felder per `JSON.stringify` in einen `<script>`-Block ein. `JSON.stringify` maskiert `<`, `>` und `/` nicht — der String `</script>` beendet den Block.

**Beleg.** [`apps/site/app/physiotherapie/[stadt]/page.tsx:106`](../../../apps/site/app/physiotherapie/[stadt]/page.tsx):
```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```
`jsonLd` enthält `t.fullName`, `p.name`, `p.address`, `p.phone` (Zeilen 47-58 derselben Datei).
`fullName` ist frei setzbar: [`auth.ts:26`](../../../apps/api/src/routes/auth.ts) — `fullName: z.string().min(2).optional()`, keine Zeichenbeschränkung, keine Sanitisierung.

**Warum die Freigabe nicht schützt.** `PATCH /auth/me` ändert `reviewStatus` bewusst nie ([`auth.ts:611-613`](../../../apps/api/src/routes/auth.ts): „Regular PATCH /auth/me updates never change reviewStatus"). Ein Konto kann also mit unauffälligem Namen die Freigabe durchlaufen und den Namen danach ohne erneute Prüfung auf eine Payload ändern.

**Der Stadt-Parameter selbst ist sauber** — [`page.tsx:33`](../../../apps/site/app/physiotherapie/[stadt]/page.tsx) validiert gegen `getCitiesWithListings()` mit `notFound()`. Reflected XSS über die URL ist damit ausgeschlossen; die Injektion läuft ausschließlich über gespeicherte Profildaten.

**Zweite Instanz:** [`apps/site/app/blog/[slug]/page.tsx:241`](../../../apps/site/app/blog/[slug]/page.tsx) mit `post.title`/`post.excerpt` — nur über Admin befüllbar, in Verbindung mit SEC-004 aber ebenfalls relevant.

**Kompensierendes Control — geprüft:** Der Blog-Fließtext wird **nicht** als HTML gerendert, sondern in React-Elemente überführt ([`page.tsx:57-118`](../../../apps/site/app/blog/[slug]/page.tsx)) und damit automatisch escaped. Das ist sauber gelöst — die Lücke betrifft nur die JSON-LD-Blöcke. Eine CSP fehlt vollständig (SEC-006), es gibt also keine zweite Verteidigungslinie.

**Empfehlung.** JSON-LD nicht per `dangerouslySetInnerHTML` einbetten, sondern die kritischen Zeichen maskieren: `JSON.stringify(x).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')`. Als Hilfsfunktion an beiden Stellen verwenden. Zusätzlich `fullName`/`name` serverseitig auf ein sinnvolles Zeichenprofil begrenzen und eine CSP setzen.
**Verifikationstest.** Profil mit `fullName = 'Test</script><script>window.__xss=1</script>'` anlegen, freigeben, Stadtseite rendern → `window.__xss` bleibt undefined.

---

<a id="sec-004"></a>
## SEC-004 — Admin-Zugang: ein geteiltes statisches Geheimnis, Default-Passwort, kein Ratelimit, Cookie ohne `secure`

**Bereich/Tags:** Security, Admin · **Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Hoch** · **Prio: P1** · W 4 / R 5

**Beleg.**
1. **Default-Zugangsdaten im Code:** [`env.ts:7-8`](../../../apps/api/src/env.ts) — `REVIO_ADMIN_EMAIL` default `'admin@revio.de'`, `REVIO_ADMIN_PASSWORD` default `'admin123'` (min. 6 Zeichen). Fehlt die Variable im Deployment, ist der Zugang mit diesem Paar offen.
2. **Token = Passwort-Äquivalent, unbegrenzt gültig:** [`admin.ts:254-257`](../../../apps/api/src/routes/admin.ts) — `tokenMatch || (emailMatch && passwordMatch)`; **allein der Token genügt, mit beliebiger E-Mail**. [`admin.ts:263`](../../../apps/api/src/routes/admin.ts) gibt genau `env.REVIO_ADMIN_TOKEN` als Session-Token zurück — für alle Admins identisch, ohne Ablauf, nur durch Rotation der Umgebungsvariable widerrufbar.
3. **Kein Ratelimit auf `/admin/login`** (siehe SEC-001).
4. **Cookie ohne `secure`:** [`actions.ts:118-126`](../../../apps/admin/lib/actions.ts) — `httpOnly: true, sameSite: 'lax', secure: false` für `revio_admin_token` **und** `revio_admin_user`.
5. **Keine individuelle Identität** → Audit-Log kann keinen Akteur führen ([`admin.ts:1256-1260`](../../../apps/api/src/routes/admin.ts)).

**Kompensierende Controls — geprüft, funktionieren.** Der `onRequest`-Hook in [`admin.ts:272-276`](../../../apps/api/src/routes/admin.ts) schützt **alle** 65 Admin-Routen (nur `/login` ausgenommen); der Verdacht „nur 6 `verifyAdmin`-Vorkommen bei 65 Routen" hat sich als unbegründet erwiesen. `httpOnly` verhindert JS-Zugriff. Next.js 15 Server Actions prüfen den Origin, was CSRF abdeckt. Die Admin-UI erzwingt zusätzlich einen Session-Check im Layout ([`layout.tsx:12-21`](../../../apps/admin/app/(admin)/layout.tsx)).

**Auswirkung.** Ein Kompromiss dieses einen Geheimnisses gibt vollständigen Zugriff auf alle Patienten- und Therapeutendaten, Freigaben und Dokumente — ohne Möglichkeit, den Vorfall einer Person zuzuordnen oder gezielt einen Zugang zu sperren.

**Empfehlung.**
1. **P1 sofort:** `.default('admin123')` und `.default('admin@revio.de')` aus `env.ts` entfernen — Startabbruch bei fehlender Variable ist hier das richtige Verhalten. Produktionswert verifizieren und rotieren.
2. **P1:** `secure: true` (und `__Host-`-Präfix) für beide Cookies; `secure` an `NODE_ENV` koppeln, nicht hart auf `false`.
3. **P1:** Ratelimit auf `/admin/login`.
4. **P2:** Echte Admin-Konten mit eigenem Datensatz, Passwort-Hash, individuellem Session-Token mit Ablauf und 2FA. Danach `AdminAccessLog` um eine Actor-Spalte erweitern (im Code als DS-73 bereits als offen markiert).

**Akzeptanzkriterien.** API startet ohne gesetztes Admin-Passwort nicht; Cookies tragen `Secure`; 20 Fehlversuche auf `/admin/login` → 429.

---

<a id="sec-005"></a>
## SEC-005 — OTP-Codes stammen aus `Math.random()`

**Bereich/Tags:** Security, Krypto · **Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Hoch** · **Prio: P1** · W 3 / R 4

**Beleg.** [`register.ts:151`](../../../apps/api/src/routes/register.ts) — `const code = String(Math.floor(100000 + Math.random() * 900000));`

`Math.random()` ist in V8 xorshift128+ und **nicht kryptografisch sicher**. Der Generatorzustand lässt sich aus einer überschaubaren Zahl beobachteter Ausgaben rekonstruieren; danach sind Folgewerte vorhersagbar. Ein Angreifer kann beliebig viele OTPs an eigene Adressen anfordern (Limit: 3/Stunde je Adresse, aber unbegrenzt viele Adressen), die Ausgaben beobachten und anschließend den Code vorhersagen, der für eine fremde Adresse erzeugt wird.

**Warum das zählt:** Der OTP ist das einzige Gate für Registrierung ([`register.ts:79`, `245`](../../../apps/api/src/routes/register.ts)) **und** für die Praxis-Übernahme ([`claim.ts:73-79`](../../../apps/api/src/routes/claim.ts)). Der Rest der Kette ist sauber gebaut — Codes werden als SHA-256 gespeichert ([`register.ts:152`](../../../apps/api/src/routes/register.ts)), 10 Minuten gültig, nach Gebrauch gelöscht. Genau deshalb fällt die schwache Quelle ins Gewicht.

**Empfehlung.** `randomInt` aus `node:crypto` verwenden: `crypto.randomInt(100000, 1000000)`. Einzeiler, keine Schnittstellenänderung.
**Akzeptanzkriterien.** Kein `Math.random()` mehr in sicherheitsrelevanten Pfaden; Lint-Regel ergänzen.

---

<a id="priv-002"></a>
## PRIV-002 — Öffentliche Suche gibt E-Mail und Telefonnummer aller Therapeut:innen aus

**Bereich/Tags:** Datenschutz · DS-21/22 · **Status:** BESTÄTIGT-CODE · **Confidence:** Hoch · **Schwere: Hoch** · **Prio: P1** · W 4 / R 4

**Beleg.** [`search.ts:424-425`](../../../apps/api/src/routes/search.ts) (`POST /search`, unauthentifiziert) und [`search.ts:566-567`](../../../apps/api/src/routes/search.ts) (`GET /therapist/:id`, unauthentifiziert) geben `email` und `phone` zurück.

**Auswirkung.** Zwei getrennte Themen: (a) Datenminimierung — für die Auswahl einer Therapeutin sind Adresse und Buchungsfunktion nötig, nicht die E-Mail; die Kontaktaufnahme ist im Produkt ohnehin über Buchung/Anfrage modelliert. (b) Sicherheit — die E-Mail ist zugleich der Login-Benutzername, siehe SEC-001. Zusätzlich Spam-/Scraping-Risiko für die Therapeut:innen.

**Empfehlung.** `email` aus beiden öffentlichen Responses entfernen. `phone` nur ausgeben, wenn die Person das explizit als Geschäftskontakt freigegeben hat (eigenes Feld, Opt-in), nicht implizit aus dem Profilfeld.
**Akzeptanzkriterien.** `POST /search` und `GET /therapist/:id` enthalten kein `email`; Vertragstest in `packages/shared` abgesichert.

---

<a id="ops-002"></a>
## OPS-002 — CI deckt Site, Mobile, Shared und die DSGVO-Prüfung nicht ab

**Status:** BESTÄTIGT-CODE + BESTÄTIGT-LAUFZEIT · **Schwere: Hoch** · **Prio: P1**

**Beleg.** [`ci.yml`](../../../.github/workflows/ci.yml) hat zwei Jobs: `api` (typecheck + test) und `admin` (build).

**Nicht abgedeckt:** `apps/site` (kein Build, kein Typecheck), `apps/mobile` (nichts — und es existiert kein `test`-Script), `packages/shared`, `pnpm --filter @revio/api check:classification`, Dependency-Audit, Secret-Scanning, SAST, Tests gegen PostgreSQL, E2E, Accessibility.

**Verschärfend:** `check:classification` **schlägt aktuell fehl** (Exit 1, 11 Verstöße — Laufzeitbeleg in [02](02-test-and-command-log.md)), und die Datei fordert die CI-Integration selbst ein ([`data-classification.yaml:10`](../../../apps/api/prisma/data-classification.yaml): „In CI aufnehmen."). Ein bereits gebautes Compliance-Control ist damit wirkungslos.

**Weiter:** Alle Tests laufen gegen SQLite, Produktion ist PostgreSQL. Verhaltensunterschiede (Advisory Locks, `contains`-Case-Sensitivity, Transaktionsisolation) sind strukturell ungetestet — siehe TEST-002.

**Empfehlung.** `check:classification` als eigenen CI-Schritt (blockierend) ergänzen und die 11 offenen Felder klassifizieren. Jobs für `site` (build+typecheck) und `mobile` (mindestens Typecheck/Lint) ergänzen. API-Tests gegen einen `postgres`-Service-Container laufen lassen. `pnpm audit --audit-level high` als eigener Schritt.
**Akzeptanzkriterien.** CI schlägt fehl, wenn ein neues Prisma-Feld unklassifiziert ist; alle vier Apps sind je PR gebaut.

---

<a id="sec-006"></a>
## SEC-006 — Keinerlei Security-Header

**Status:** BESTÄTIGT-CODE · **Schwere: Hoch** · **Prio: P1**

**Beleg.** `grep -rn "helmet\|Content-Security-Policy\|X-Content-Type\|X-Frame" apps/api/src/` → **0 Treffer**. [`app.ts`](../../../apps/api/src/app.ts) registriert `cors`, `sensible`, `multipart`, `static` — kein `@fastify/helmet`. Die Next.js-Configs ([`apps/site/next.config.ts`](../../../apps/site/next.config.ts), [`apps/admin/next.config.ts`](../../../apps/admin/next.config.ts)) enthalten nur `reactStrictMode` und keinen `headers()`-Block.

Fehlend: CSP, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`.

**Relevanz im Zusammenspiel.** Ohne `nosniff` kann ein hochgeladenes „Bild" mit abweichendem Inhalt vom Browser umgedeutet werden — die MIME-Prüfung in [`upload.ts:19`](../../../apps/api/src/routes/upload.ts) vertraut ausschließlich dem vom Client gesendeten `Content-Type` und prüft den Dateiinhalt nicht (keine Magic-Byte-Validierung, kein Re-Encoding; `sharp` ist nicht im Einsatz). Ohne CSP fehlt SEC-003 die zweite Verteidigungslinie. Ohne `frame-ancestors` ist das Admin-Dashboard klickjackbar.

**Zusätzlich:** `cors: { origin: true }` ([`app.ts:38`](../../../apps/api/src/app.ts)) spiegelt jeden Origin. Da die Authentifizierung über den `Authorization`-Header und nicht über Cookies läuft, ist das Risiko begrenzt — sauber wäre dennoch eine Allowlist.

**Empfehlung.** `@fastify/helmet` registrieren; `headers()` in beiden Next-Configs mit CSP, `nosniff`, HSTS, `frame-ancestors 'none'` (Admin) und `Referrer-Policy: strict-origin-when-cross-origin`. Uploads zusätzlich über Magic Bytes validieren und Bilder re-encodieren (entfernt zugleich EXIF-GPS-Daten aus Profilfotos — eigenständiges Datenschutzthema). CORS auf bekannte Origins begrenzen.

---

<a id="ops-003"></a>
## OPS-003 — Jeder Push auf `main` veröffentlicht ungebremst ein Produktions-Update der Mobile-App

**Status:** BESTÄTIGT-CODE · **Schwere: Hoch** · **Prio: P1**

**Beleg.** [`.github/workflows/eas-update.yml`](../../../.github/workflows/eas-update.yml):
- Trigger: `push` auf `main`, Pfadfilter `apps/mobile/**`
- Schritt: `eas update --branch main --message "$MESSAGE" --non-interactive`
- `eas.json` bindet das `production`-Build-Profil an genau diesen Channel `main`.

**Auswirkung.** Ein Commit auf `main`, der `apps/mobile/**` berührt, geht **ohne Testgate und ohne Freigabe** als OTA-Update an alle Produktionsnutzer:innen. Der `api`-CI-Job ist kein `needs`-Vorgänger, läuft also parallel und kann rot sein, während das Update bereits ausgeliefert wird. Ein Rollback ist nur durch ein weiteres Update möglich.

**Verschärfend:** Der Workflow installiert mit `npm install` (nicht `pnpm`, ohne `--frozen-lockfile`) in einem pnpm-Workspace. Transitive Abhängigkeiten werden zum Deploy-Zeitpunkt frisch aufgelöst — es geht also potenziell anderer Code an die Nutzer:innen als der getestete. Supply-Chain-Risiko.

**Hinweis für die Projektleitung:** Dies widerspricht der verbreiteten Annahme, ein `git push` löse kein EAS aus. Für `apps/mobile/**`-Änderungen auf `main` ist das nachweislich nicht der Fall.

**Empfehlung.** `needs: [api]` ergänzen, damit CI grün sein muss. Auf `pnpm install --frozen-lockfile` umstellen. Produktions-Updates über einen separaten Channel und `workflow_dispatch` bzw. Tags statt auf jedem `main`-Push; `main`-Pushes höchstens auf einen `staging`-Channel.

---

<a id="sec-007"></a>
## SEC-007 — OTP-Brute-Force: Ratelimit nur pro IP, kein Versuchszähler je Code

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P1**

**Beleg.** [`register.ts:166-167`](../../../apps/api/src/routes/register.ts) — `rateLimit: { max: 10, timeWindow: '10 minutes' }`, Standard-Key ist die IP. Das `EmailOtp`-Modell hat **kein** Feld für Fehlversuche; ein falscher Code invalidiert den OTP nicht ([`register.ts:185-187`](../../../apps/api/src/routes/register.ts) gibt nur 400 zurück).

**Angriff.** 6-stelliger Code = 10^6 Möglichkeiten, 10 Minuten gültig. 10 Versuche/10 Min pro IP bremsen nur eine einzelne IP; mit rotierenden IPs ist der Raum in der Gültigkeitsdauer angreifbar. Mit SEC-005 zusammen ist Raten gar nicht erst nötig.

**Empfehlung.** `attempts`-Spalte auf `EmailOtp`; nach 5 Fehlversuchen den OTP verbrauchen und einen neuen anfordern lassen. Ratelimit zusätzlich pro E-Mail-Adresse keyen, nicht nur pro IP.

---

<a id="api-001"></a>
## API-001 — Interne Fehlerdetails werden im 500-Response ausgeliefert

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P1**

**Beleg.** [`booking.ts:492-496`](../../../apps/api/src/routes/booking.ts):
```ts
return reply.status(500).send({
  error: 'Buchung konnte nicht abgeschlossen werden. Bitte versuche es erneut.',
  _debug: String(err?.message ?? err),
  _prismaCode: err?.code,
});
```
Prisma-Fehlermeldungen enthalten regelmäßig Tabellen-, Spalten- und Constraint-Namen und teils Feldwerte. Der Endpunkt ist für jede:n eingeloggte:n Patient:in erreichbar.

**Empfehlung.** `_debug`/`_prismaCode` entfernen; Details nur ins Log (die Redaction greift dort) und stattdessen eine Korrelations-ID zurückgeben, mit der der Support den Logeintrag findet. Zusätzlich einen globalen `setErrorHandler` setzen, der 5xx generisch beantwortet.

---

<a id="sec-008"></a>
## SEC-008 — `console.log` von OTP und E-Mail-Adresse umgeht die Redaction

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P1** · DS-60/61

**Beleg.** [`register.ts:156-157`](../../../apps/api/src/routes/register.ts):
```ts
if (!process.env.RESEND_API_KEY) {
  console.log(`[DEV] OTP for ${email}: ${code}`);
}
```
Das ist `console.log`, nicht der Fastify-Logger — die Redaction-Schicht aus [`log-redaction.ts`](../../../apps/api/src/utils/log-redaction.ts) greift hier **nicht**. Ausgegeben werden E-Mail-Adresse (P1) und der gültige Anmeldecode (P3) im Klartext.

**Auslösebedingung.** Nur wenn `RESEND_API_KEY` leer ist. `.env.example` beschreibt genau das als zulässigen Zustand („Leave empty to disable email sending"). Ein Deployment ohne gesetzten Key schreibt damit fortlaufend Anmeldecodes in den Railway-Log-Stream.

**Empfehlung.** An `NODE_ENV !== 'production'` koppeln **und** über `fastify.log.debug` ohne den Code ausgeben. Generell eine Lint-Regel gegen `console.log` in `apps/api/src` (aktuell weitere Vorkommen in `server.ts`).

---

<a id="data-001"></a>
## DATA-001 — `AdminAccessLog` ist unklassifiziert, speichert Patienten-E-Mails und hat keine Löschfrist

**Status:** BESTÄTIGT-LAUFZEIT (Validator) · **Schwere: Mittel** · **Prio: P1**

**Beleg.** Validatorausgabe (siehe [02](02-test-and-command-log.md)): `AdminAccessLog: Modell fehlt in data-classification.yaml`, alle 5 Felder unklassifiziert. Zusätzlich unklassifiziert: `Therapist.consentObtainedAt/consentChannel/consentNote`, `Therapist.archivedAt`, `Practice.ownerId`.

`AdminAccessLog.query` nimmt den rohen Suchbegriff der Patientensuche auf ([`admin.ts:1328`](../../../apps/api/src/routes/admin.ts) — `logAdminAccess('patient_search', { query })`), und dieser Suchbegriff ist laut [`actions.ts:793`](../../../apps/admin/lib/actions.ts) typischerweise eine E-Mail-Adresse. Es gibt keinen Löschjob und keine Frist für diese Tabelle; sie ist in [`docs/loeschkonzept.md`](../../../docs/loeschkonzept.md) nicht aufgeführt.

**Fairnesshinweis.** Der umgebende Code ist überdurchschnittlich sorgfältig: die Kommentare in [`admin.ts:1252-1260`](../../../apps/api/src/routes/admin.ts) begründen den Verzicht auf eine Patienten-Listenansicht (DS-20), die Protokollierung (DS-74) und die fehlende Actor-Spalte (DS-73) ausdrücklich. Der Befund ist eine Lücke in einem ansonsten bewusst gebauten Control, nicht Nachlässigkeit.

**Empfehlung.** Die 11 Felder klassifizieren; `AdminAccessLog.query` als P1 führen. Retention festlegen (Vorschlag: 90 Tage) und per Job durchsetzen. Alternativ nur einen Hash bzw. die Trefferzahl statt des Klartext-Suchbegriffs speichern — das erhält den Prüfzweck und minimiert. In `loeschkonzept.md` und `vvt.md` aufnehmen.

---

<a id="arch-001"></a>
## ARCH-001 — Zwei handgepflegte Schemata driften; fünf tote Prod-Modelle tragen Personendaten

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P1**

**Beleg (strukturelle Diff, Skript in [02](02-test-and-command-log.md)).**
- Nur in `schema.production.prisma`: `Invitation`, `ManagerPracticeAssignment`, `PracticeDeletionLog`, `PracticeManager`, `TherapistRemovalLog` (5 Modelle) sowie `Role.manager`.
- Feldunterschiede: `TherapistService.kassenarten` nur in `schema.prisma`; `Practice.inviteToken/invitations/assignments`, `Therapist.invitedByPracticeId/onboardingStatus/managerAccount/invitations`, `User.emailOtpCode/emailOtpExpiresAt/managerProfile` nur in Produktion.

**Zwei getrennte Konsequenzen.**
1. `TherapistService.kassenarten` existiert in Produktion nicht. Aktuell **kein aktiver Codepfad** greift darauf zu (geprüft: alle 8 `therapistService`-Zugriffe) — der Befund ist also latent, nicht akut. Sobald jemand das Feld benutzt, funktioniert es in Tests und bricht in Produktion.
2. Die 5 Prod-only-Modelle sind Überreste des abgelösten Praxismanager-Konzepts. Sie existieren in der Produktionsdatenbank weiter, enthalten personenbezogene Daten (Einladungen mit E-Mail-Adressen, Lösch-/Entfernungsprotokolle) und sind **in `data-classification.yaml` nicht erfasst** — der Validator sieht sie nicht, weil er gegen `schema.prisma` läuft. Sie fehlen ebenso im Löschkonzept.

**Empfehlung.** Auf ein Schema konsolidieren (siehe OPS-001). Vorher klären, ob die 5 Legacy-Tabellen in Produktion noch Daten enthalten; falls ja, dokumentiert löschen (mit DSB abgestimmt) statt beim Schema-Umbau unbemerkt zu verlieren. `kassenarten` entweder produktiv nachziehen oder aus `schema.prisma` entfernen.

---

<a id="perf-001"></a>
## PERF-001 — Keine Pagination; der Suchcache hält Passwort-Hashes und Session-Tokens im Speicher

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.**
- `grep -rn "skip:\|cursor:" apps/api/src/routes/` → **0 Treffer**. Keine Route paginiert.
- [`search.ts:224-234`](../../../apps/api/src/routes/search.ts) — `findMany` **ohne `select`**, mit `include: { links: { include: { practice: true } } }`, Ergebnis 60 s in `searchTherapistCache`. Geladen werden damit alle Spalten, u. a. `passwordHash`, `sessionToken`, `expoPushToken`, `email`, `phone`, `homeLat/homeLng`.
- Filterung und Scoring laufen anschließend in JS über die gesamte Menge.

**Auswirkung.** (a) Sicherheit/Minimierung: P3-Geheimnisse liegen ohne Notwendigkeit dauerhaft im Heap des Suchpfads — jede versehentliche Serialisierung (Spread, Error-Dump, Heap-Snapshot) legt sie offen. (b) Skalierung: Speicher und CPU wachsen linear mit dem Verzeichnis; bei bundesweiter Abdeckung ist das Modell nicht tragfähig. (c) Admin-Listen laden ohne Grenze.

**Fairnesshinweis.** Die Antwortgröße ist mit `SEARCH_RESULT_LIMIT = 200` sauber gedeckelt ([`search.ts:190, 460`](../../../apps/api/src/routes/search.ts)) und das Mapping ist explizit — es leakt heute nichts. Der Befund betrifft das Laden, nicht die Ausgabe.

**Empfehlung.** `select` mit genau den benötigten Feldern statt Vollzeilen (DS-22). Mittelfristig Filterung in die Datenbank verlagern (PostGIS oder indizierte Bounding-Box) statt In-Memory-Scan. Pagination für Admin-Listen und Suche.

---

<a id="ops-004"></a>
## OPS-004 — In-Process-Cache und Scheduler brechen, sobald mehr als eine Instanz läuft

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.**
- Cache als Modulvariable: [`search.ts:204, 210`](../../../apps/api/src/routes/search.ts). `resetSearchCache()` ([`search.ts:215-218`](../../../apps/api/src/routes/search.ts)) leert nur den **eigenen** Prozess. Eine Admin-Freigabe invalidiert damit bei N Instanzen genau eine; die übrigen liefern bis zu 60 s alte Sichtbarkeit.
- Scheduler: [`app.ts:70-117`](../../../apps/api/src/app.ts) startet `setInterval` im `onReady` — in **jeder** Instanz. Bei N Instanzen laufen Expiry und Reminder N-fach; `reminderSentAt` wird per `updateMany` ohne Sperre gesetzt, sodass mehrere Instanzen dieselben Datensätze gleichzeitig markieren können.
- Kein `SKIP LOCKED`, kein Advisory Lock, keine Leader-Wahl.

**Zusätzlich:** Der Job läuft nur solange der Prozess lebt. Bei einem Neustart alle <5 Min feuert er nie. `restartPolicyType: ON_FAILURE` in [`railway.json`](../../../railway.json) macht Neustarts wahrscheinlich.

**Empfehlung.** Kurzfristig dokumentieren, dass die API auf **einer** Instanz laufen muss. Mittelfristig: Cache nach außen verlagern (Redis) oder durch DB-Query mit Index ersetzen; Jobs in einen separaten Worker mit Advisory Lock (`pg_try_advisory_lock`) ziehen — das Muster ist in [`booking.ts:388`](../../../apps/api/src/routes/booking.ts) bereits vorhanden und könnte wiederverwendet werden.

---

<a id="mob-001"></a>
## MOB-001 — Session-Token liegt im Klartext in AsyncStorage

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.** [`AuthContext.js:60, 153, 162`](../../../apps/mobile/src/context/AuthContext.js) und [`DeepLinkHandler.js:66, 109`](../../../apps/mobile/src/context/DeepLinkHandler.js) schreiben den Token per `AsyncStorage.setItem`. `expo-secure-store` ist **keine** Abhängigkeit von `apps/mobile` (geprüft in `package.json`).

AsyncStorage speichert unverschlüsselt (Android: SQLite im App-Sandbox-Verzeichnis; iOS: Datei im Dokumentbereich). Auf gerooteten/jailbroken Geräten und teils über unverschlüsselte Backups lesbar. Der Token ist 30 Tage gültig — praktisch unbegrenzt, siehe SEC-002 — und öffnet Termine, Patientenkontakte und Gesundheitsdaten.

**Empfehlung.** `expo-secure-store` (Keychain/Keystore) für Token und Kontotyp; Migration beim App-Start. Klassifikation als P3 in `data-classification.yaml` spiegeln.

---

<a id="claim-001"></a>
## CLAIM-001 — Praxis-Übernahme ohne Zugehörigkeitsnachweis und ohne Detektionskontrolle

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beobachtung.** Wer eine **eigene** E-Mail per OTP bestätigt, kann jede noch nicht übernommene Praxis beanspruchen und danach Name, Adresse, Telefon, E-Mail, Website, Beschreibung und Fotos ändern — inklusive Neu-Geokodierung.

**Beleg.** [`claim.ts:51-103`](../../../apps/api/src/routes/claim.ts) (Übernahme, einzige Prüfung: `practice.ownerId` noch leer + OTP auf die eingegebene Adresse), [`claim.ts:143-202`](../../../apps/api/src/routes/claim.ts) (Vollbearbeitung inkl. Adresse).

**Bewusst eingegangenes Risiko.** Der Kommentar [`claim.ts:19-28`](../../../apps/api/src/routes/claim.ts) benennt die Einschränkung und den abgestimmten Trade-off ausdrücklich. Das ist saubere Dokumentation und wird hier nicht als Versäumnis gewertet.

**Was jedoch fehlt, ist das benannte kompensierende Control.** Der Kommentar nennt „Sichtbarkeit: jede Übernahme ist über `GET /admin/practices` (ownerId gesetzt) nachvollziehbar". Nachvollziehbarkeit im Sinne von „steht in einer Liste, wenn jemand hinschaut" ist keine Detektion: es gibt keine Benachrichtigung, keine Prüf-Queue, keinen Filter auf frisch übernommene Praxen und keinen Eintrag in `AdminAccessLog`. Eine Übernahme mit anschließender Adressänderung — die Patient:innen zu einer fremden Adresse oder Telefonnummer leitet — kann so unbemerkt bleiben.

**Empfehlung (verhältnismäßig, ohne den Flow zu verbauen).** Übernahme als `Notification`/Admin-Queue-Eintrag sichtbar machen; Adressänderungen nach Übernahme erneut durch die Freigabe schicken (`reviewStatus` zurücksetzen, das Gate existiert in [`practice-visibility.ts`](../../../apps/api/src/utils/practice-visibility.ts) bereits); Übernahmen in `AdminAccessLog` protokollieren.

---

<a id="sec-009"></a>
## SEC-009 — `POST /feedback` ist unauthentifiziert und ohne Ratelimit

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.** [`feedback.ts:58-97`](../../../apps/api/src/routes/feedback.ts) — kein `config.rateLimit`, Auth optional; ohne Token sind `email` und `message` (bis 5.000 Zeichen) frei wählbar und werden persistiert.

**Auswirkung.** Unbegrenztes Anlegen von Datensätzen (Storage/Spam), Fluten der Admin-Feedback-Ansicht und Speicherung fremder E-Mail-Adressen ohne deren Zutun (P1 ohne Rechtsgrundlage).

**Empfehlung.** Ratelimit wie bei `/contact` (5/10 Min), Honeypot-Feld übernehmen — [`contact.ts`](../../../apps/api/src/routes/contact.ts) ist das Vorbild und löst genau dieses Problem bereits sauber. Für nicht angemeldete Absender die E-Mail nicht speichern oder den Endpunkt auf Angemeldete beschränken.

---

<a id="perf-002"></a>
## PERF-002 — `force-dynamic` im Root-Layout verhindert jedes Caching der öffentlichen Seiten

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.** [`apps/site/app/layout.tsx:35`](../../../apps/site/app/layout.tsx) — `export const dynamic = 'force-dynamic';` gilt für **alle** Routen darunter. [`apps/site/app/page.tsx:11`](../../../apps/site/app/page.tsx) wiederholt es.

**Folge.** Jeder Seitenaufruf rendert serverseitig und ruft die API. Kein statisches Caching, keine CDN-Auslieferung, keine ISR. Die `generateStaticParams` in [`physiotherapie/[stadt]/page.tsx:11`](../../../apps/site/app/physiotherapie/[stadt]/page.tsx) und [`blog/[slug]/page.tsx:161`](../../../apps/site/app/blog/[slug]/page.tsx) laufen ins Leere — genau die Seiten, die für SEO gebaut wurden.

Für ein Discovery-Produkt, dessen Akquise über organische Suche läuft, ist das doppelt teuer: schlechtere Ladezeiten (Core Web Vitals sind Rankingfaktor) und volle API-Last je Crawl.

**Kein Messwert.** Ich habe keine Ladezeiten gemessen; dies ist ein statischer Hinweis, keine Performance-Tatsache.

**Empfehlung.** `force-dynamic` aus dem Root-Layout entfernen und gezielt nur auf die Routen setzen, die es brauchen (`/konto`, ggf. `/finden`). Für Stadt- und Profilseiten `revalidate` (z. B. 300 s) verwenden. Anschließend mit Lighthouse gegen Staging messen — vorher/nachher.

---

<a id="prod-001"></a>
## PROD-001 — Bewertungen gehen ungeprüft live; die Moderationszustände sind unerreichbar

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.** [`schema.prisma:433`](../../../apps/api/prisma/schema.prisma) — `status TherapistReviewStatus @default(PUBLISHED)`. Das Enum kennt `PUBLISHED`, `HIDDEN`, `REPORTED`. `grep -rn "HIDDEN\|REPORTED" apps/api/src apps/admin` → **0 Treffer**: es gibt weder eine Melde-Route für Nutzer:innen noch eine Admin-Route zum Ausblenden. `POST /bookings/:id/reviews` ([`reviews.ts:149-157`](../../../apps/api/src/routes/reviews.ts)) setzt keinen Status, greift also immer den Default.

**Auswirkung.** Ein Freitextkommentar (bis 1.000 Zeichen) wird ohne Prüfung für alle angemeldeten Nutzer:innen sichtbar und fließt in `avgRating` auf dem öffentlichen Profil ([`search.ts:529-534`](../../../apps/api/src/routes/search.ts)). Für Betroffene gibt es keinen Weg, eine unwahre oder beleidigende Bewertung entfernen zu lassen; für den Betreiber keinen Weg, einer Beschwerde nachzukommen. Bei Bewertungen über namentlich genannte Gesundheitsdienstleister ist das ein reales Haftungs- und Reputationsthema.

**Fairnesshinweis.** Der Zugangsschutz der Bewertungsfunktion ist vorbildlich: Login-Pflicht, Bindung an eine eigene, bestätigte und bereits vergangene Buchung, ein Review je Buchung, saubere Ownership-Prüfungen ([`reviews.ts:112, 144-146`](../../../apps/api/src/routes/reviews.ts)) und Anzeige nur als „Vorname N." ([`reviews.ts:17-23`](../../../apps/api/src/routes/reviews.ts)). Es fehlt ausschließlich die Moderation.

**Empfehlung.** Melde-Endpunkt für Nutzer:innen (`status = REPORTED`) und Admin-Ansicht zum Ausblenden. Entscheiden, ob neue Bewertungen als `PUBLISHED` starten (mit Nachmoderation) — dann reicht das — oder Vormoderation nötig ist.

---

<a id="doc-001"></a>
## DOC-001 — `CLAUDE.md` widerspricht sich bei Bewertungen

**Status:** BESTÄTIGT-CODE · **Schwere: Mittel** · **Prio: P2**

**Beleg.** [`CLAUDE.md`](../../../CLAUDE.md) Abschnitt 2 führt unter „Core MVP" auf: „patient reviews of therapists (login-gated, post-appointment)". Abschnitt 4 („Working Rules") verlangt: „Do not introduce payments, **reviews**, or medical-data features while working on MVP code."

Der aktive Code implementiert Bewertungen vollständig ([`reviews.ts`](../../../apps/api/src/routes/reviews.ts), `TherapistReview`-Modell, Aggregation in der Suche). Nach der Wahrheitsquellen-Reihenfolge gewinnt der Code — Abschnitt 4 ist veraltet.

**Auswirkung.** Ein Agent oder neue:r Entwickler:in, der/die Abschnitt 4 folgt, würde eine vorhandene, produktive Funktion für außerhalb des Scopes halten und sie im Zweifel nicht pflegen oder entfernen. Genau diese Datei ist als Orientierung für Coding-Agents gedacht.

**Empfehlung.** In Abschnitt 4 „reviews" streichen und, falls gemeint war „keine *weiteren* Bewertungsfeatures", das explizit formulieren.

---

## Dokumentationsdrift-Matrix

| Aussage | Quelle | Aktives Verhalten | Widerspruch | Auswirkung | Empfehlung |
|---|---|---|---|---|---|
| „Deine genaue Adresse bleibt privat" | Mobile-UI, `TherapistDashboard.js:839` | Exakte Koordinaten werden gespeichert und öffentlich ausgeliefert | **Ja, gravierend** | Zusage gegenüber betroffener Person nicht eingehalten | PRIV-001 |
| `BookingRequest`-Löschung „implementiert" | `loeschkonzept.md:17` | `SetNull` erhält alle Klardaten | **Ja** | Art.-17-Ersuchen nicht erfüllbar | DEL-001 |
| „Reviews nicht einführen" | `CLAUDE.md` §4 | Bewertungen vollständig implementiert (§2 nennt sie als MVP) | **Ja, intern** | Fehlleitung von Entwickler:innen/Agents | DOC-001 |
| „In CI aufnehmen" (Klassifikations-Validator) | `data-classification.yaml:10` | Nicht in CI und aktuell rot | **Ja** | Compliance-Control wirkungslos | OPS-002, DATA-001 |
| „Resend wird nicht aufgerufen, da kein echter Key" | `test/setup.ts:9` | SDK wird aufgerufen, nur Zustellung scheitert | **Ja** | Tests netzabhängig | TEST-001 |
| `prisma migrate deploy` beim Start | `apps/api/package.json` | Produktion nutzt `db push --accept-data-loss` | **Ja** | Irreführender toter Startpfad | OPS-001 |
| `schema.production.prisma` als Produktionsschema | Dateiname/Dockerfile | Enthält 5 Modelle, die es in `schema.prisma` nicht gibt | **Ja** | Drift, unklassifizierte Personendaten | ARCH-001 |
| „ggf. Praxismanager" als Rolle | Audit-Ausgangshypothese | Rolle heißt `practice_owner`; `manager` nur im toten Schema | Ja (Hypothese korrigiert) | — | in 00 dokumentiert |
| Push löst kein EAS aus | verbreitete Projektannahme | `eas-update.yml` publiziert bei `main`-Push auf `apps/mobile/**` | **Ja** | Ungewollte Produktionsauslieferung | OPS-003 |

---

## Restliche Befunde (kompakt)

<a id="test-001"></a>**TEST-001 — Tests rufen einen echten Drittanbieter auf.** `Mittel/P2`, BL.
[`setup.ts:9`](../../../apps/api/test/setup.ts) setzt `RESEND_API_KEY='test-key'`, [`register.ts:156`](../../../apps/api/src/routes/register.ts) prüft nur auf Existenz → das Resend-SDK geht bei jedem Testlauf ins Netz. Tests sind damit nicht hermetisch, offline rot und langsam; CI hängt von einem externen Dienst ab. **Empfehlung:** Mailer per `vi.mock` stubben oder die Prüfung auf `NODE_ENV === 'test'` erweitern; Kommentar in `setup.ts` korrigieren.

<a id="test-002"></a>**TEST-002 — Buchungs-Nebenläufigkeit wird nie getestet.** `Mittel/P2`, BC.
Der Schutz gegen Doppelbuchung ist ein PostgreSQL-Advisory-Lock ([`booking.ts:387-389`](../../../apps/api/src/routes/booking.ts)), aktiv nur wenn `isPostgres()` ([`booking.ts:13-16`](../../../apps/api/src/routes/booking.ts)). Tests laufen auf SQLite → der Zweig wird **nie** ausgeführt. Es gibt zudem **keinen** DB-Constraint als Rückfallebene: die Überlappungsprüfung ([`booking.ts:392-410`](../../../apps/api/src/routes/booking.ts)) ist ohne den Lock nicht atomar. Nebenbefund: `therapistLockId` ([`booking.ts:21-27`](../../../apps/api/src/routes/booking.ts)) ist ein 32-Bit-djb2-Hash — Kollisionen führen nur zu unnötiger Serialisierung, sind also unkritisch. **Empfehlung:** Tests gegen PostgreSQL; Nebenläufigkeitstest mit parallelen Buchungen auf denselben Slot; `EXCLUDE`-Constraint (btree_gist) als Rückfallebene.

<a id="test-003"></a>**TEST-003 — Hintergrundjob startet unbedingt, auch im Test.** `Niedrig/P2`, BC.
[`app.ts:70-117`](../../../apps/api/src/app.ts) registriert `setInterval` ohne Opt-out. In langsamen Läufen mutiert der Job die geteilte Test-DB (in meinem 24-Minuten-Lauf mehrfach gefeuert) — mögliche Mitursache der beiden roten Tests. **Empfehlung:** Job hinter ein Flag (`ENABLE_SCHEDULER`) legen, das in Tests aus ist; zugleich Voraussetzung für OPS-004.

<a id="debt-001"></a>**DEBT-001 — Ungenutzte Abhängigkeiten und Secrets.** `Niedrig/P3`, BC.
`bcrypt`, `jsonwebtoken`, `@fastify/cookie`, `@aws-sdk/lib-storage` sind in `apps/api/package.json` deklariert, aber in `apps/api/src` **nirgends** importiert (verifiziert). `JWT_SECRET` steht in `.env`/`.env.example`, wird aber nirgends gelesen. **Auswirkung:** unnötige Angriffsfläche und Update-Last (`bcrypt` ist nativ), irreführende Signale — ein Leser vermutet JWT-Sessions, tatsächlich sind es DB-Zufallstokens. **Empfehlung:** entfernen; `JWT_SECRET` aus `.env.example` streichen oder als „unbenutzt" kennzeichnen.

<a id="debt-002"></a>**DEBT-002 — `verifyPassword` wirft bei defektem Hash.** `Niedrig/P3`, BC.
[`auth-utils.ts:12-16`](../../../apps/api/src/routes/auth-utils.ts): fehlt das `:` im gespeicherten Hash, ist `key` `undefined` und `Buffer.from(undefined,'hex')` wirft; bei abweichender Länge wirft `timingSafeEqual`. Ergebnis wäre ein 500 statt 401. **Empfehlung:** Format defensiv prüfen und bei Abweichung `false` zurückgeben.

<a id="debt-003"></a>**DEBT-003 — Admin-Token-Vergleich nicht zeitkonstant.** `Niedrig/P3`, BC.
[`admin-auth.ts:18`](../../../apps/api/src/plugins/admin-auth.ts) — `token !== env.REVIO_ADMIN_TOKEN`. Über Netz praktisch kaum ausnutzbar, aber trivial zu beheben: `timingSafeEqual` (wird in `auth-utils.ts` bereits korrekt verwendet).

<a id="debt-004"></a>**DEBT-004 — Root-`tsconfig.json` referenziert nicht auflösbares Base-Config.** `Niedrig/P3`, BL.
`"extends": "expo/tsconfig.base"` — in jedem Vitest-Lauf als Warnung reproduziert. Blockiert einen Root-weiten `typecheck`.

<a id="debt-005"></a>**DEBT-005 — Drei Node-Major-Versionen.** `Niedrig/P3`, BC.
Lokal v24, CI Node 22 ([`ci.yml`](../../../.github/workflows/ci.yml)), Docker/Nixpacks Node 20 ([`Dockerfile`](../../../Dockerfile), [`nixpacks.toml`](../../../nixpacks.toml)). Kein `engines`-Feld, keine `.nvmrc`. **Empfehlung:** auf eine LTS festlegen und in `engines` + `.nvmrc` fixieren.

<a id="mob-002"></a>**MOB-002 — Debug-Screen in Produktionsbuilds.** `Niedrig/P3`, BC.
[`AuthDebugScreen.js`](../../../apps/mobile/src/screens/AuthDebugScreen.js) wird in [`OptionsScreen.js:85`](../../../apps/mobile/src/screens/options/OptionsScreen.js) **ohne `__DEV__`-Guard** eingebunden und zeigt Auth-Zustand sowie AsyncStorage-Schlüssel. **Mildernd:** Tokens werden über `truncate()` gekürzt, nicht vollständig ausgegeben. **Empfehlung:** hinter `__DEV__` oder eine interne Freischaltung legen.

<a id="data-002"></a>**DATA-002 — `data/*.xlsx` sind git-getrackt, Inhalt ungeprüft.** `Hinweis/P2`, NICHT PRÜFBAR.
Vier Excel-Dateien mit Kölner Praxisdaten liegen im Repository (`git ls-files data/`). Ich habe sie **auftragsgemäß nicht geöffnet**, da sie Echtdaten enthalten könnten. Enthalten sie personenbezogene Daten (z. B. Inhaber:innennamen, private Rufnummern), liegen diese unverschlüsselt in der Versionsgeschichte und sind über jeden Repo-Klon verteilt — mit Löschung aus der History nur schwer rückholbar. **Empfehlung:** Inhalt prüfen; falls personenbezogen, aus dem Repo entfernen (History-Rewrite), künftig außerhalb der Versionskontrolle halten und im VVT erfassen.

**ENV-001 — lokale Testumgebung durch iCloud-Sync unbrauchbar.** Kein Produktbefund, siehe [02, Abschnitt 5](02-test-and-command-log.md).

---

## Belegte Stärken

Diese Punkte sind geprüft und in Ordnung — sie gehören zum Ergebnis wie die Mängel.

1. **`contact.ts` ist vorbildlich.** Honeypot-Feld, geschlossene Rollen-Enum mit begründetem Kommentar, Ratelimit, `escapeHtml` im Mailer ([`mailer.ts:14-21`](../../../apps/api/src/utils/mailer.ts)), Nachricht wird bewusst **nicht** gespeichert, Fehlerbehandlung ohne Inhalte im Log. Als Muster für `feedback.ts` direkt nachnutzbar.
2. **Der Admin-Patientenbereich ist bewusst datensparsam gebaut.** Keine Listen-/Browse-Route (DS-20 begründet), Suche als POST statt GET, damit E-Mail-Adressen nicht in Access-Logs landen (DS-65), jede Suche und Detailansicht protokolliert (DS-74), und die fehlende Actor-Spalte ist als bekannte Lücke (DS-73) im Code dokumentiert statt verschwiegen. [`admin.ts:1250-1356`](../../../apps/api/src/routes/admin.ts)
3. **Autorisierung ist durchgängig objektbezogen.** In `inquiry.ts` prüft **jede** der 12 Routen die Zugehörigkeit (`inquiry.therapistId !== therapist.id` bzw. `patientUserId !== patient.id`); `reviews.ts`, `notifications.ts` (Scoping über `updateMany` mit Owner-Filter) und `booking.ts` ebenso. **Kein IDOR gefunden.**
4. **Sichtbarkeitslogik ist zentralisiert und mehrschichtig.** [`practice-visibility.ts`](../../../apps/api/src/utils/practice-visibility.ts) ist die einzige Quelle der Regel; der Prisma-Vorfilter `publicPracticeWhere` wird bewusst **nicht** als ausreichend behandelt, sondern in JS nachgeprüft — inklusive Kommentar, warum. `practiceVisibilityInclude` selektiert bewusst minimal (DS-21/22). Die Trennung `LISTED` vs. `APPROVED` verhindert ein vorgetäuschtes „Geprüft"-Signal.
5. **`subprocessors.yaml` ist ehrlich und vollständig.** Alle sieben im Code auffindbaren Drittanbieter sind erfasst; technische Felder sind belegt, rechtliche stehen ausdrücklich auf `OFFEN` mit dem Hinweis, dass sie zur DSB/Anwalt gehören. Dass Nominatim **auch direkt vom Client** aufgerufen wird (Geräte-IP statt Server-IP), ist explizit vermerkt — ein Detail, das in solchen Listen meist fehlt.
6. **Redaction-Layer für Logs** mit korrekter Begründung, warum pinos `*` nur ein Pfadsegment matcht, und mit dem ausdrücklichen Hinweis, dass die Schicht kein Freibrief ist ([`log-redaction.ts`](../../../apps/api/src/utils/log-redaction.ts)).
7. **Datenklassifizierung als Code** mit maschineller Prüfung — das Konzept ist stark. Dass der Validator gerade rot ist (DATA-001), ändert nichts daran, dass er die Lücken überhaupt sichtbar macht.
8. **Passwort-Hashing** korrekt: scrypt, 16-Byte-Zufallssalt pro Passwort, `timingSafeEqual` beim Vergleich.
9. **Bewertungen sind sauber zugangsgeschützt:** Login-Pflicht, Bindung an eigene, bestätigte, vergangene Buchung, ein Review pro Buchung (`@unique`), Anzeige pseudonymisiert als „Vorname N.".
10. **Blog-Fließtext wird in React-Elemente gerendert** statt als HTML — der naheliegendste XSS-Vektor ist damit von vornherein geschlossen.
11. **API-Typecheck ist grün** (Exit 0), bei ~16.000 Zeilen und durchgängiger Zod-Validierung an den Eingängen.
12. **Die `BackButton`-Regel aus `CLAUDE.md` wird eingehalten** — inklusive der dokumentierten Ausnahme über `topInset={false}` in geteilten Kopfzeilen ([`PracticeProfileContent.js:70-71`](../../../apps/mobile/src/screens/public/PracticeProfileContent.js), [`TherapistProfileContent.js:149-150`](../../../apps/mobile/src/screens/public/TherapistProfileContent.js), [`AuthScreenShell.js`](../../../apps/mobile/src/components/auth/AuthScreenShell.js)). Ein erster automatischer Verdacht erwies sich bei Einzelprüfung als unbegründet.
13. **Kein verwaistes Routenmodul** — jede Datei unter `routes/` ist in `app.ts` registriert und wird von mindestens einem Client verwendet.
