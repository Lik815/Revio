# 01 — System, Rollen und kritische Nutzerabläufe

Verifiziert gegen Commit `1679f86`. Alle Aussagen aus aktivem Code, nicht aus Dokumentation.

---

## 1. Datenflüsse und Trust Boundaries

```
                        ┌──────────────── Trust Boundary: öffentliches Internet ─────────────────┐
                        │                                                                        │
   Anonyme:r Besucher ──┼──► apps/site (Next.js, force-dynamic, SSR)                             │
                        │        │ server-side fetch + /api/find-search (WT)                     │
   Patient:in (App) ────┼──► apps/mobile (Expo) ──┐                                              │
   Therapeut:in (App) ──┼──► apps/mobile ─────────┤                                              │
                        │                          │  Bearer: 30-Tage-Zufallstoken (DB)          │
   Admin/Reviewer ──────┼──► apps/admin ───────────┤  Cookie: revio_admin_token (secure:false)   │
                        │      (Server Actions)    │  = statisches, geteiltes Geheimnis          │
                        └──────────────────────────┼──────────────────────────────────────────────┘
                                                   ▼
                        ┌──────────────── apps/api (Fastify, Railway) ─────────────────┐
                        │  CORS: origin:true · keine Security-Header · Ratelimit: 5/104 │
                        │  In-Process-Suchcache (60 s) · setInterval-Job (5 Min)        │
                        └───┬────────────┬───────────┬──────────────┬───────────────────┘
                            │            │           │              │
                            ▼            ▼           ▼              ▼
                     PostgreSQL     lokale FS /   Resend (US)   Nominatim (EU/UK)
                     (Railway)      S3-Bucket     E-Mail        Geocoding
                     P1 + P2 + P3   Fotos +                     ▲
                                    Nachweise                   │ Geräte-IP!
                                                                └── apps/mobile direkt
                                                            Expo Push (US) ◄── Token
```

**Trust Boundaries (5):**
1. Internet → API — überquert von jedem Endpunkt; Kontrollen: Zod-Validierung (durchgängig), Token-Auth, Sichtbarkeits-Gates. **Fehlend:** Ratelimit auf Auth, Security-Header.
2. Öffentlich ↔ authentifiziert — kontrolliert über `sessionToken`. **Schwachstelle:** Ablauf wird fast nie geprüft (SEC-002).
3. Nutzer ↔ Nutzer — kontrolliert über objektbezogene Ownership-Checks. **Geprüft: dicht, kein IDOR.**
4. Nutzer ↔ Admin — kontrolliert über `onRequest`-Hook auf allen 65 Admin-Routen. **Schwachstelle:** ein geteiltes Geheimnis ohne Ablauf (SEC-004).
5. API → Dritte — Resend, Nominatim, Expo, S3. Alle in `subprocessors.yaml` erfasst. **Besonderheit:** Nominatim wird auch direkt vom Mobile-Client aufgerufen, wodurch die Geräte-IP der Nutzer:innen den Anbieter erreicht (im Register korrekt vermerkt).

---

## 2. Kritische Nutzerabläufe

### F1 — Patient:in registrieren (OTP-basiert)

| | |
|---|---|
| **Rolle** | anonym → Patient:in |
| **Start / Ziel** | App-Registrierung → nutzbares Konto mit Session |
| **Schritte** | `POST /register/send-otp` → E-Mail mit 6-stelligem Code → `POST /register/confirm-otp` → `POST /auth/register` |
| **Systeme** | API, PostgreSQL, Resend |
| **Daten** | E-Mail, Vor-/Nachname (P1), Passwort (P3), OTP-Hash (P3) |
| **Fehlerzustände** | Ungültige Mail (400), bereits registriert (**409 — Enumerationsleck**), >3 Codes/Stunde (429), Code falsch/abgelaufen (400, bewusst ununterscheidbar), Bestätigung >2 h alt (400 mit erklärender Meldung) |
| **Abbruch/Rückkehr** | OTP 10 Min gültig, Bestätigung 2 h nutzbar; unbestätigte OTPs werden beim nächsten Versand gelöscht |
| **Berechtigungen** | keine |
| **Tests** | vorhanden (`app.test.ts` ab Z. 1240) |
| **Offene Risiken** | SEC-005 (`Math.random()`), SEC-007 (Brute-Force), SEC-001 (409-Enumeration), SEC-008 (`console.log` von Code+Adresse) |

Bemerkenswert positiv: Codes werden nur als SHA-256 gespeichert, nach Gebrauch gelöscht, und die Fehlermeldung bei `confirm-otp` unterscheidet bewusst nicht zwischen „kein Code" und „falscher Code".

### F2 — Therapeut:in registrieren und veröffentlichen

| | |
|---|---|
| **Rolle** | anonym → Therapeut:in |
| **Schritte** | OTP wie F1 → `POST /register/therapist` (legt `User` + `Therapist` in einer Transaktion an, `reviewStatus=DRAFT`, `isVisible=false`, `isPublished=false`) → Profil vervollständigen über `PATCH /auth/me` → `POST /therapists/me/submit-for-review` → Admin `POST /admin/therapists/:id/approve` |
| **Daten** | Name, Adresse, Koordinaten, Spezialisierungen, Kassenarten, Foto, Nachweise (alle P1) |
| **Fehlerzustände** | Profil unvollständig → 400 mit Liste der fehlenden Felder; Status ≠ DRAFT/CHANGES_REQUESTED → 400; `employmentStatus=PREPARING` → 400 (kann nie öffentlich werden) |
| **Berechtigungen** | Freigabe ausschließlich durch Admin |
| **Offene Risiken** | PRIV-001 (Standort), PRIV-002 (E-Mail öffentlich), SEC-003 (`fullName` nach Freigabe frei änderbar, ohne Neuprüfung) |

**Bewertung des Freigabe-Gates:** solide gebaut. Der Übergang nach `PENDING_REVIEW` ist auf **genau einen** Endpunkt beschränkt, mit ausdrücklichem Kommentar, dass reguläre Profil-Updates `reviewStatus` nie ändern ([`auth.ts:610-614`](../../../apps/api/src/routes/auth.ts)). Genau diese bewusste Entscheidung ist allerdings der Hebel für SEC-003.

### F3 — Öffentliche Suche

| | |
|---|---|
| **Rolle** | anonym |
| **Schritte** | `POST /search` mit `query`, optional `city`/`origin`/`radiusKm`/`homeVisit`/`kassenart` → In-Memory-Scoring über den 60-s-Cache → max. 200 Treffer |
| **Sichtbarkeitsregel** | `reviewStatus=APPROVED` ∧ `isVisible` ∧ `employmentStatus=SELF_EMPLOYED` ∧ `archivedAt=null`, danach `getTherapistPublicationState` |
| **Offene Risiken** | PRIV-001, PRIV-002, PERF-001 (Vollzeilen inkl. `passwordHash` im Cache), OPS-004 (Cache pro Instanz) |

### F4 — Buchung eines Ersttermins

| | |
|---|---|
| **Rolle** | Patient:in |
| **Schritte** | `POST /bookings` → Therapeut/Modus prüfen → Heilmittel im Angebot? → Termin in der Zukunft? → Slot über den **gemeinsamen Slot-Generator** validieren → Transaktion mit Advisory Lock → Überlappungsprüfung gegen Buchungen und Blockzeiten → `BookingRequest(PENDING)` → optional Auto-Accept → Push + `Notification` |
| **Daten** | `patientName`, `patientEmail`, `patientPhone` (P1), `heilmittel`, `message` (**P2**), `consentAcceptedAt` |
| **Fehlerzustände** | 403 (nur Patient:innen), 400 (Modus/Heilmittel/Vergangenheit/Leistung inaktiv), 409 (Slot weg, Blockzeit), 500 (**mit `_debug` — API-001**) |
| **Nebenläufigkeit** | `pg_advisory_xact_lock` je Therapeut — **nur auf PostgreSQL** |
| **Offene Risiken** | TEST-002 (Lock-Zweig nie getestet, kein DB-Constraint als Rückfallebene), API-001, DEL-001 (Daten überleben Kontolöschung) |

Positiv: die serverseitige Slot-Validierung nutzt denselben Generator wie die Anzeige, statt der Client-Angabe zu vertrauen — Buchungen außerhalb der Arbeitszeit oder zu „krummen" Zeiten sind damit ausgeschlossen. Der Kommentar benennt ausdrücklich, dass die Overlap-Prüfung in der Transaktion die verbindliche ist.

### F5 — Kontolöschung (Art. 17)

| | |
|---|---|
| **Rolle** | Patient:in oder Therapeut:in |
| **Schritte** | `DELETE /auth/me` → Prüfung auf aktive Termine → `prisma.user.delete` bzw. `prisma.therapist.delete` |
| **Fehlerzustände** | 400 mit grammatikalisch korrekt gebeugter Meldung bei aktiven Terminen ([`auth.ts:72-77`](../../../apps/api/src/routes/auth.ts)) — sorgfältig gemacht |
| **Tatsächliches Ergebnis** | **Unvollständig.** Buchungen, `ScheduledSlot` und Feedback behalten Klarnamen, E-Mail, Telefon und Heilmittel. Bei Therapeut:innen bleibt der `User` bestehen, bei Patient:innen bleiben die Buchungen. Dateien bleiben in jedem Fall. |
| **Offene Risiken** | **DEL-001 (kritisch)**, STOR-001 |

### F6 — Auskunft/Export (Art. 15/20)

`GET /auth/me/export`, Identitätsnachweis über den Session-Token, Ausgabe als JSON-Download mit `Content-Disposition`. P3-Geheimnisse sind ausgeschlossen ([`subject-data.ts`](../../../apps/api/src/utils/subject-data.ts), eigener Test vorhanden). **Sauber umgesetzt** — mit der Einschränkung aus SEC-002 (abgelaufene Tokens werden hier nicht abgewiesen).

### F7 — Praxis übernehmen (Claim)

`GET /claim/practice/:id` (öffentlich, minimale Daten) → OTP auf die **eigene** Adresse → `POST /claim/practice/:id` → `User(role=practice_owner)` + `Practice.ownerId` in einer Transaktion → Selbstverwaltung über `/claim/me/*`.
**Offene Risiken:** CLAIM-001. Positiv: die `practice_owner`-Routen sind die **einzigen**, die den Session-Ablauf konsequent prüfen.

### F8 — Serienanfrage (Inquiry, Phase 2)

`POST /inquiry` (Patient:in, `PatientRequest` + n `Inquiry` an mehrere Praxen) → Therapeut:in sieht `GET /inquiry/incoming` → `seen`/`confirm`/`confirm-all`/`decline` je Slot → `ScheduledSlot`. SLA 2 Werktage über `responseDueAt`, Reminder nach 1 Tag, danach `EXPIRED` durch den Scheduler.
**Bewertung:** die umfangreichste Zustandsmaschine im System (12 Endpunkte, 1.001 Zeilen). Autorisierung ist an **jedem** Übergang geprüft. **Offene Risiken:** OPS-004 (Scheduler), DEL-001.

---

## 3. Rollen-/Berechtigungsmatrix (verdichtet)

| Fähigkeit | anon | Patient | Therapeut | practice_owner | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Suche, öffentliche Profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bewertungen **lesen** | ❌ | ✅ | ✅ | ✅ | ❌¹ |
| Buchen / anfragen | ❌ | ✅ | ❌ | ❌ | ❌ |
| Bewerten | ❌ | ✅² | ❌ | ❌ | ❌ |
| Eigenes Profil / Verfügbarkeit | ❌ | ✅ | ✅ | ✅³ | ❌ |
| Anfragen beantworten | ❌ | ❌ | ✅ | ❌ | ❌ |
| Nachweise hochladen | ❌ | ❌ | ✅ | ❌ | ❌ |
| Export / Löschung (eigene Daten) | ❌ | ✅ | ✅ | ❌⁴ | ❌ |
| Freigaben, Patientensuche, Dokumente | ❌ | ❌ | ❌ | ❌ | ✅ |

¹ Es gibt keine Admin-Route für Bewertungen — siehe PROD-001.
² Nur mit eigener, bestätigter, bereits vergangener Buchung; genau eine Bewertung je Buchung.
³ Nur die eine eigene Praxis.
⁴ **Lücke:** `practice_owner` hat keinen Export-/Löschpfad — `GET /auth/me/export` und `DELETE /auth/me` behandeln nur `patient` und Therapeut:innen. Betroffen sind E-Mail und Passwort-Hash des Kontos. Sollte mit DEL-001 zusammen behoben werden.

---

## 4. Produktgrenzen — Abgleich mit `CLAUDE.md`

| MVP-Anspruch | Im aktiven Code | Bewertung |
|---|---|---|
| Öffentliche Therapeutensuche | `search.ts`, 7 Endpunkte | ✅ vollständig |
| Patientenregistrierung/Login | `register.ts`, `auth.ts` | ✅ vollständig |
| Buchung / Buchungsanfragen | `booking.ts`, `inquiry.ts` | ✅ vollständig, zwei parallele Modelle |
| Terminübersicht Patient:in | `GET /bookings/my` | ✅ |
| Selbstregistrierung Freelancer | `POST /register/therapist` (`isFreelancer: true` fix) | ✅ |
| Profil-/Verfügbarkeitsverwaltung | `auth.ts`, `booking.ts`, `schedule.ts` | ✅ |
| Admin-Freigabe-Workflows | `admin.ts`, 65 Endpunkte | ✅ |
| Bewertungen (login-gated, nach Termin) | `reviews.ts` | ✅ umgesetzt — **widerspricht `CLAUDE.md` §4** (DOC-001) |
| **Nicht im MVP:** Zahlungen, Akten, KI, Chat, Video | keine Spur im Code | ✅ **eingehalten** |
| Nicht-Freelancer dürfen sich nicht selbst als öffentliche Anbieter registrieren | `employmentStatus=PREPARING` kann nie öffentlich werden; `submit-for-review` weist es ab | ✅ durchgesetzt |
| App-UI ausschließlich Deutsch | `translations.js` nur `de`; Fehlermeldungen der API teils Englisch (`'Therapist not found'`, `'Only registered users can create booking requests'` in `booking.ts`) | ⚠️ API-Meldungen gemischt — sichtbar, wenn ein Client sie durchreicht |
| Keine Emojis in der UI | ✅ in der App | ⚠️ Ausnahme: `auth.ts:207` rendert `✅` in der E-Mail-Bestätigungsseite (HTML, nicht App-UI) |

**Zwei parallele Buchungsmodelle** (`BookingRequest` aus `booking.ts` und `Inquiry`/`PatientRequest` aus `inquiry.ts`) existieren nebeneinander; `ScheduledSlot` kann aus beiden entstehen und trägt dafür zwei Fremdschlüssel. Das ist Migrationszustand, keine Doppelimplementierung derselben Sache — sollte aber vor weiterem Ausbau konsolidiert werden, sonst verdoppelt sich jede künftige Änderung an Terminlogik, Absage und Löschung.
