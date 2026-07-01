# Revio — Dynamisches Buchungssystem (Zeitfenster-Refactor)

Vollständige Dokumentation des Umbaus vom **materialisierten Slot-System** auf
**live berechnete Zeitfenster**. Referenz zum Analysieren, Debuggen und Weiterbauen.

- **Umgesetzt:** 2026-06-30 / 2026-07-01
- **Commits:** `8c524f4` (Kern), `5efaac3` + `17717c0` (Folge-Fixes)
- **Source of Truth:** `apps/api/prisma/schema.prisma`, `apps/api/src/utils/slot-generator.ts`,
  `apps/api/src/routes/booking.ts`, `packages/shared/src/index.ts`

---

## 1. Motivation & Kernidee

### Vorher
Freie Termine waren echte DB-Zeilen (`TherapistSlot`). Arbeitszeiten
(`TherapistWorkingHoursRule`) wurden per `materializeWorkingHours()` in konkrete
`AVAILABLE`-Slots umgewandelt (8 Wochen im Voraus, plus 6h-Top-up-Scheduler).
Der Patient buchte eine fixe `slotId`. **Die Slot-Dauer stand zum
Materialisierungszeitpunkt fest** (meist 20 Min) — unabhängig von der Leistung.

### Problem
Physiotherapie hat leistungsabhängige Dauern (KG 20 Min, MLD 60 Min, …), die
**pro Therapeut:in unterschiedlich** sein können. Ein fixes 20-Minuten-Raster
kann das nicht abbilden, ohne pro Leistung ein eigenes Raster zu materialisieren.

### Nachher (Zielarchitektur)
Es werden **keine freien Slots mehr gespeichert**. Gespeichert werden nur:
- **Arbeitszeiten** (`TherapistWorkingHoursRule`)
- **Blockzeiten** (`TherapistBlockedTime`)
- **gebuchte Termine** (`BookingRequest` mit `startsAt`/`endsAt`)
- **Leistungsdauern pro Therapeut** (`TherapistService`)

Daraus berechnet `generateAvailableSlots()` **live** die buchbaren Zeitfenster
für genau eine Leistung bei genau einem/einer Therapeut:in.

```
Patient wählt Heilmittel
      │
      ▼
GET /therapists/:id/available-slots?heilmittel=KG
      │  generateAvailableSlots(): Arbeitszeit − Blockzeit − Buchungen, Schritt = Dauer
      ▼
Zeitfenster-Liste (nicht gespeichert)
      │
      ▼
POST /bookings { therapistId, heilmittel, startsAt }
      │  Transaktion: Overlap-Check → BookingRequest.create (startsAt/endsAt)
      ▼
BookingRequest (blockiert den Zeitraum, solange PENDING|CONFIRMED)
```

---

## 2. Umbaustrategie: Expand → Cutover → Contract

Der Umbau lief in drei Phasen, um das Risiko trotz Clean-Break-Endzustand niedrig
zu halten (das alte System blieb bis zur Contract-Phase lauffähig):

| Phase | Inhalt |
|-------|--------|
| **Expand** | Neue Tabellen/Felder additiv, `slot-generator.ts` + Tests, drei neue Endpunkte. Altes System unverändert. |
| **Cutover** | `POST /bookings` auf `startsAt` umgestellt, Expiry-Pfade vereinfacht, Mobile-Flows umgestellt, `nextFreeSlotAt` entfernt. |
| **Contract** | `slot?.startsAt ?? confirmedSlotAt`-Leser migriert, `TherapistSlot`/Enums/Materialisierer entfernt, Test-Suite abgelöst. |

---

## 3. Datenmodell

### 3.1 Neu: `HeilmittelOption.defaultDurationMin`
Der bestehende Heilmittel-Katalog (KG, MT, MLD …) ist zugleich der Leistungskatalog.
Er bekam einen globalen Standard-Dauerwert:

```prisma
model HeilmittelOption {
  key                String  @unique   // "KG", "MT", "MLD" …
  label              String  @unique
  defaultDurationMin Int     @default(20)   // NEU — globaler Standardwert
  isActive           Boolean @default(true)
  sortOrder          Int     @default(0)
}
```

### 3.2 Neu: `TherapistService` (Dauer-Override pro Therapeut)

```prisma
model TherapistService {
  id              String  @id @default(cuid())
  therapistId     String
  heilmittelKey   String            // weiche Referenz auf HeilmittelOption.key
  durationMin     Int               // überschreibt defaultDurationMin
  bufferAfterMin  Int     @default(0)
  slotIntervalMin Int?              // null = Raster-Schritt = durationMin
  isActive        Boolean @default(true)

  @@unique([therapistId, heilmittelKey])
  @@index([therapistId, isActive])
}
```

- `heilmittelKey` ist **kein FK** (der Katalog wird separat verwaltet). Serverseitig
  gegen die aktive HeilmittelOption-Liste validiert (`PUT /therapist/services`).
- **`isActive`-Semantik** (siehe `resolveServiceConfig`, §4.2): Zeile vorhanden &
  `isActive=false` → Leistung **explizit deaktiviert** (keine Slots, Buchung abgelehnt).
  Zeile vorhanden & `isActive=true` → deren `durationMin`. Keine Zeile → Leistung wird
  über das `therapist.heilmittel`-CSV angeboten und nutzt `defaultDurationMin`.
- `slotIntervalMin` ist der **Reversibilitäts-Anker** für ein feineres Raster
  (siehe §4.3) — aktuell überall `null`.
- `bufferAfterMin` ist im Schema vorhanden, wird von der aktuellen
  Generator-Logik aber **noch nicht** berücksichtigt (Follow-up, §10).

### 3.3 Neu: `TherapistBlockedTime` (neutrale Blockzeit)

```prisma
model TherapistBlockedTime {
  id          String   @id @default(cuid())
  therapistId String
  startsAt    DateTime
  endsAt      DateTime
  title       String   @default("Blockiert")  // Pause, Urlaub, Hausbesuch …

  @@index([therapistId, startsAt, endsAt])
}
```

MVP ohne Recurrence — jeder Eintrag ist ein einzelner Zeitraum.

### 3.4 Geändert: `BookingRequest`

```prisma
model BookingRequest {
  // NEU: echter Termin-Zeitraum
  startsAt        DateTime?
  endsAt          DateTime?
  // Legacy-Anker, = startsAt gesetzt (für Alt-Leser / Kompatibilität)
  confirmedSlotAt DateTime?
  // slotId bleibt als nullable "tombstone" (FK + Relation entfernt)
  slotId          String?
  heilmittel      String?
  // … status, patientName, kassenart, cancelReason etc. unverändert
}
```

### 3.5 Geändert: `TherapistWorkingHoursRule` (verschlankt)
`durationMin`, `intervalMin` und die `slots`-Relation wurden entfernt. Die Regel
definiert jetzt **nur noch das Arbeitsfenster** — die Dauer kommt aus `TherapistService`.

```prisma
model TherapistWorkingHoursRule {
  weekday        Int        // 0-6, JS Date#getDay() (0=So..6=Sa)
  startMinute    Int
  endMinute      Int
  effectiveFrom  DateTime?
  effectiveUntil DateTime?
  isActive       Boolean @default(true)
}
```

### 3.6 Entfernt
- Model `TherapistSlot`
- Enums `SlotStatus`, `SlotSource`
- `TherapistWorkingHoursRule.durationMin` / `.intervalMin` / `.slots`
- `BookingRequest.slot`-Relation + `@unique` auf `slotId`

> **Hinweis SQLite (Dev):** Die Contract-Migration setzt `slotId` nur auf `NULL`
> und leert `TherapistSlot` (SQLite kann Spalten/Constraints nicht einfach droppen).
> Die eigentliche Tabelle verschwindet in der Dev-DB erst beim nächsten
> `prisma db push`. Für Production sind die echten `DROP`-Statements als Kommentar
> in `20260630130000_drop_therapist_slot/migration.sql` hinterlegt.

> **Hinweis Shared Types:** Das **Prisma-Schema** ist slot-frei, aber
> `packages/shared/src/index.ts` enthält weiterhin `SlotStatus`, `TherapistSlot`,
> `CreateTherapistSlotsResponse`, `BookingRequest.slot?` und `nextFreeSlotAt` als
> **Legacy-Tombstones** (bewusst, um Alt-Leser nicht zu brechen). Der Zustand ist
> also „Backend-Slot-System entfernt, Shared Types teils noch kompatibel gehalten" —
> nicht „vollständig contract-clean". Aufräumen ist ein Follow-up (§10).

---

## 4. Slot-Generator (`apps/api/src/utils/slot-generator.ts`)

Herzstück des neuen Systems. Zwei Funktionen:

### 4.1 `computeAvailableSlots(...)` — reine Berechnung (DB-frei, unit-testbar)
```ts
computeAvailableSlots(
  rules, blockedTimes, existingBookings,
  durationMin, stepMin,
  { from, to }, now,
) → { startsAt, endsAt }[]
```

### 4.2 `resolveServiceConfig(...)` + `generateAvailableSlots(...)` — DB-Wrapper
`resolveServiceConfig(fastify, therapistId, heilmittelKey)` ist die **einzige**
Stelle, an der „Leistung deaktiviert" und die Dauer bestimmt werden (verwendet von
Generator **und** `POST /bookings`): `{ disabled, durationMin, stepMin }`.

`generateAvailableSlots`:
1. `resolveServiceConfig` aufrufen — bei `disabled` → **leere Liste** (keine Slots).
2. Aktive `TherapistWorkingHoursRule` laden.
3. `TherapistBlockedTime` im Bereich laden.
4. `BookingRequest` mit Status `PENDING|CONFIRMED`, deren `[startsAt,endsAt]` den
   Bereich schneidet.
5. `computeAvailableSlots` aufrufen.

### 4.3 Algorithmus im Detail
- **DST-sicheres Tages-Stepping:** pro Regel wird der erste passende Wochentag
  gesucht und dann per `setDate(+7)` weitergezählt — **nie** Millisekunden-Arithmetik
  (die würde über die CET/CEST-Umstellung eine Stunde driften). Vorlage:
  `generateOccurrencesForRule()` in `working-hours.ts`.
- **Sequentielles Scheduling (wichtig!):** Kandidaten werden vom Fensteranfang in
  `stepMin`-Schritten durchlaufen. Trifft ein Kandidat auf eine Blockzeit oder
  Buchung, springt der Cursor **direkt ans Ende der Unterbrechung** (`overlap.endsAt`),
  statt zum nächsten Raster-Tick. Dadurch entstehen keine unnötigen Lücken.
- **Raster = Leistungsdauer** (Produktentscheidung): eine 60-Min-Leistung auf
  08:00–12:00 zeigt `08:00 / 09:00 / 10:00 / 11:00` — nicht `08:20 / 08:40 …`.
  Über `slotIntervalMin` später ohne Schema-Bruch verfeinerbar.
- Ein Slot muss **vollständig** ins Arbeitsfenster passen (`slotStart + dauer ≤ fensterEnde`).
- Nur Slots `> now`. Duplikate aus überlappenden Regeln werden entfernt.

### 4.4 Referenz-Testfall (aus `test/slot-generator.test.ts`)
```
Arbeitszeit Mo 08:00–12:00, KG = 20 Min
Blockzeit  10:00–10:30
Buchung    09:00–09:20
→ Ergebnis: 08:00 08:20 08:40 09:20 09:40 10:30 10:50 11:10 11:30  (9 Slots)
```

---

## 5. API-Endpunkte

### 5.1 Neu

| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| `GET`  | `/therapist/services` | Therapeut | Konfigurierte Leistungen auflisten |
| `PUT`  | `/therapist/services/:heilmittelKey` | Therapeut | Dauer/aktiv setzen (Upsert), validiert Key |
| `GET`  | `/therapist/blocked-times` | Therapeut | Blockzeiten auflisten (`?from&to`) |
| `POST` | `/therapist/blocked-times` | Therapeut | Blockzeit anlegen |
| `DELETE` | `/therapist/blocked-times/:id` | Therapeut | Blockzeit löschen |
| `GET`  | `/therapists/:id/available-slots` | öffentlich | Live-Zeitfenster `?heilmittel&from&to` |

`available-slots`: `heilmittel` ist Pflicht; Standard-Bereich = jetzt bis +14 Tage;
max. 90 Tage. Antwort: `{ slots: [{ startsAt, endsAt }] }`.

### 5.2 Geändert: `POST /bookings`
```jsonc
// Request
{ "therapistId": "...", "heilmittel": "KG", "startsAt": "2026-07-06T08:00:00Z",
  "kassenart": "gesetzlich", "message": "...", "consentAccepted": true }
```
Ablauf:
1. Therapeut + `bookingMode` prüfen, Heilmittel-Angebot prüfen (`splitList(therapist.heilmittel)`).
2. `resolveServiceConfig` → bei `disabled` **`400`**; sonst `endsAt = startsAt + dauer`.
3. **Arbeitszeit-/Verfügbarkeits-Check:** `generateAvailableSlots` für den Tag von
   `startsAt` erzeugen und prüfen, ob `startsAt` darin enthalten ist. Deckt über
   dieselbe Single-Source-of-Truth ab: liegt in einer Arbeitszeit, ist raster-
   ausgerichtet, keine Blockzeit/Buchung überlappt. Sonst **`409`**. (Verhindert
   Buchungen außerhalb der Arbeitszeit oder zu „krummen" Zeiten.)
4. **Transaktion** (Race-Schutz): Overlap-`findFirst` gegen `BookingRequest
   (PENDING|CONFIRMED)` und gegen `TherapistBlockedTime` → sonst `409`;
   dann `BookingRequest.create` mit `startsAt`/`endsAt`/`confirmedSlotAt = startsAt`.

Kein `slotId` mehr im Request oder in der Response.

### 5.3 Geändert: `respond` / `cancel` / `therapist-cancel`
Kein Slot-Status-Flipping mehr. Der Zeitraum wird automatisch frei, sobald der
Status `PENDING|CONFIRMED` verlässt (der Overlap-Check zählt nur diese beiden).
`serializeSlot` entfernt; Ausgabe basiert auf `startsAt`/`endsAt`.

### 5.4 Geändert: `PUT /therapist/working-hours`
Kein Materialisierer, kein Pruning mehr. Nur noch: alte Regeln löschen, neue
schreiben, zurückgeben. `durationMin` im Request wird aus Kompatibilität akzeptiert
aber ignoriert. Response: `{ rules }` (kein `materialized`/`pruned` mehr).

### 5.5 Entfernt (410 Gone als Tombstone)
`GET/POST/PATCH/DELETE /therapist/slots`, `POST /therapist/slots/bulk-delete`,
`GET /therapists/:id/slots`.

---

## 6. Expiry & Scheduler (`booking-expiry.ts`, `app.ts`)

Es gab **zwei** Kopien der Slot-Freigabe-Logik — beide wurden vereinfacht:
- `expireStaleBookings()` in `booking-expiry.ts` (bei jedem Booking-List-GET, throttled 30 s)
- `onReady`-Scheduler in `app.ts` (alle 5 Min)

Beide setzen abgelaufene `PENDING`-Buchungen jetzt nur noch auf `EXPIRED`
(`updateMany`) — kein `therapistSlot.update` mehr.

**Ebenfalls entfernt:** der zweite `onReady`-Scheduler `runWorkingHoursTopUp`
(alle 6h `materializeWorkingHours`) — im dynamischen System überflüssig.

---

## 7. `nextFreeSlotAt` (entfernt)

Das Feld wurde nie geschrieben. Aus dem **Patienten-sichtbaren Pfad** entfernt:
- `search.ts` (zwei Serializer-Stellen)
- `apps/mobile/src/utils/app-utils.js` (`mapApiTherapist`)
- `apps/mobile/src/screens/discover/DiscoverContent.js` (`formatNextSlot`-Render)

**Nicht** entfernt (bewusst, weil harmlos): die Spalte `Therapist.nextFreeSlotAt`,
das Mapping in `apps/api/src/routes/admin.ts` (nur Admin-Sicht) sowie die Felder
`Therapist.nextFreeSlotAt` / `SearchTherapist.nextFreeSlotAt` in
`packages/shared/src/index.ts`. Mobile kann den Wert nicht mehr rendern; er ist
immer `null`. Phase-2-Idee: leistungsabhängig live ableiten
(„Nächster freier KG-Termin: morgen 09:20").

---

## 8. Mobile

### 8.1 Patient-Flow (`BookingRequestForm.js`, `TherapistProfileScreen.js`)
Neuer Ablauf: **1.** Heilmittel wählen → **2.** Form lädt intern
`GET /therapists/:id/available-slots?heilmittel=…` → **3.** Zeitfenster wählen →
**4.** Kassenart/Telefon/Consent → **5.** `POST /bookings { startsAt, heilmittel }`.
State heißt jetzt `selectedStartsAt`/`selectedEndsAt` statt `selectedSlotId`.
`409` beim Buchen lädt die Zeitfenster neu (Race).

### 8.2 Therapeut-Flow
- **Neu** `TherapistServicesScreen.js` — pro Heilmittel aktivieren + Dauer setzen.
- **Neu** `BlockedTimesScreen.js` — Blockzeit hinzufügen/löschen (MVP: ISO-Text-Eingabe).
- `WorkingHoursScreen.js` — Dauer-Auswahl entfernt (Wochentag + Zeitblock bleiben).
- `TherapistDashboard.js` — neue Navigationspunkte „Leistungen" + „Blockzeiten".
- `TherapyScreen.js` — Slot-Composer/Bulk-Delete-Logik entfernt; Repeat-Booking-Flow
  lädt Slots nicht mehr vorab (Form macht das selbst).

### 8.3 Reader-Migration (Termin-Datum)
Alle Stellen, die `slot?.startsAt ?? confirmedSlotAt` lasen, lesen jetzt
`startsAt ?? slot?.startsAt ?? confirmedSlotAt` (abwärtskompatibel):
`AppointmentCards.js`, `AppointmentDetail.js`, `TherapistAppointmentDetail.js`,
`TherapistPatientDetailScreen.js`, `TherapyTabPatient.js`, `PatientDashboard.js`.
`AppointmentCards.js` leitet die Dauer aus `endsAt − startsAt` ab.

---

## 9. Race Conditions — ehrliche Einordnung

Schutz aktuell: **Transaktion + Overlap-`findFirst` direkt vor `create`**.

**Das ist kein harter Schutz.** Unter PostgreSQLs Standard-Isolation
`READ COMMITTED` können zwei parallele Requests beide „kein Konflikt" sehen und
beide inserten (Phantom-Insert). Für echte Garantie bräuchte es eines von:
`SERIALIZABLE` + Retry, einen Postgres-Advisory-Lock pro `therapistId`, oder einen
`EXCLUDE`-Constraint (von Prisma nicht nativ, nur via manuellem SQL).

**Bewusst als MVP-Risiko akzeptiert**, weil:
- Buchungen sind **Anfragen** (`PENDING`) — der/die Therapeut:in bestätigt manuell
  und sieht dabei ggf. zwei konkurrierende Anfragen auf dasselbe Fenster.
- Gleichzeitige Buchungen exakt desselben Fensters sind bei der erwarteten Last selten.

Vor breiterem Produktivbetrieb sollte hier ein Advisory-Lock oder
`SERIALIZABLE`+Retry ergänzt werden (Follow-up, §10). In SQLite (Dev) ohnehin nicht
hart garantiert.

---

## 10. Bekannte Grenzen / Follow-ups

**Offene Risiken (vor Produktivbetrieb angehen):**
- **Race Condition** bei gleichzeitiger Buchung desselben Fensters — aktuell nur
  weich abgesichert (§9). Advisory-Lock oder `SERIALIZABLE`+Retry ergänzen.

**Nice-to-have:**
- **`bufferAfterMin`** wird gespeichert, aber vom Generator noch nicht angewendet.
- **`slotIntervalMin`** (feineres Raster) ist vorbereitet, aber ungenutzt.
- **Blockzeiten-UI** nutzt im MVP eine rohe ISO-Datumseingabe — ein
  DateTimePicker-Modal wäre der nächste Schritt.
- **`confirmedSlotAt`** bleibt als Legacy-Anker doppelt zu `startsAt` befüllt; sollte
  mittelfristig konsolidiert werden.
- **Shared-Types-Tombstones** (`SlotStatus`, `TherapistSlot`,
  `CreateTherapistSlotsResponse`, `BookingRequest.slot`, `nextFreeSlotAt`) —
  siehe §3.6, bei Gelegenheit entfernbar.
- **SQLite-Dev-Tombstones** (`slotId`, `TherapistSlot`-Reste) — beim nächsten
  echten Schema-Refresh entfernbar.
- **Kalender/Timeline-Komponenten** (`TherapistDayTimeline.js`,
  `TherapistMonthCalendar.js`) sind konzeptionell noch slot-nah und würden von einer
  „Appointments first"-Überarbeitung profitieren.

**Bereits gefixt (nach Erst-Review):**
- Buchung außerhalb der Arbeitszeit wird jetzt serverseitig abgelehnt (§5.2).
- Deaktivierte Leistung (`TherapistService.isActive=false`) erzeugt keine Slots
  und wird beim Buchen abgelehnt (§4.2).

---

## 11. Tests

- `apps/api/test/slot-generator.test.ts` — 8 reine Generator-Tests (inkl. Ticket-Beispiel,
  MLD-60, Blockzeit-Vollabdeckung, Vergangenheits-Filter, Duplikat-Dedupe, mehrere Wochentage).
- `apps/api/test/app.test.ts` — Sektion „Dynamic Booking" (services/blocked-times/
  available-slots/POST-bookings/respond/cancel/expiry) + verschlankte „Therapist Working Hours".
- **Stand:** API 164 Tests grün, Mobile 30 Tests grün, `typecheck` sauber, Expo-Bundle ok.

Verifikations-Kommandos:
```sh
pnpm --filter @revio/api test
pnpm --filter @revio/api typecheck
pnpm --filter @revio/mobile test
```

---

## 12. Datei-Landkarte

**Backend**
| Datei | Rolle |
|-------|-------|
| `apps/api/prisma/schema.prisma` / `schema.production.prisma` | Datenmodell (beide gespiegelt) |
| `apps/api/prisma/migrations/20260630120000_add_dynamic_booking_system/` | Additive Migration |
| `apps/api/prisma/migrations/20260630130000_drop_therapist_slot/` | Daten-Migration + Drop |
| `apps/api/src/utils/slot-generator.ts` | Live-Berechnung der Zeitfenster |
| `apps/api/src/utils/working-hours.ts` | DST-sichere Zeititeration (Referenz), Materialisierer entfernt |
| `apps/api/src/utils/booking-expiry.ts` | Expiry → nur noch `EXPIRED` |
| `apps/api/src/routes/booking.ts` | Buchung, services, blocked-times, working-hours |
| `apps/api/src/routes/search.ts` | `available-slots`-Endpunkt, `nextFreeSlotAt` raus |
| `apps/api/src/routes/reviews.ts` | `isBookingReviewable` auf `startsAt` |
| `apps/api/src/routes/config.ts` | `heilmittelOption` mit explizitem `select` (Schema-Drift-Schutz) |

**Shared**
| `packages/shared/src/index.ts` | `AvailableSlot`, `TherapistService`, `TherapistBlockedTime`, `BookingRequest.startsAt/endsAt` |

**Mobile**
| `apps/mobile/src/screens/public/BookingRequestForm.js` | Patient: Heilmittel → Zeitfenster → Buchung |
| `apps/mobile/src/screens/public/TherapistProfileScreen.js` | Öffnet Buchungsform |
| `apps/mobile/src/screens/therapy/TherapistServicesScreen.js` | Therapeut: Leistungen/Dauer |
| `apps/mobile/src/screens/therapy/BlockedTimesScreen.js` | Therapeut: Blockzeiten |
| `apps/mobile/src/screens/therapy/WorkingHoursScreen.js` | Arbeitszeiten (ohne Dauer) |
| `apps/mobile/src/screens/profile/TherapistDashboard.js` | Navigationspunkte |
| `apps/mobile/src/screens/therapy/AppointmentCards.js` u.a. | Reader-Migration `startsAt` |
