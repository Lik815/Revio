# Freelancer First Appointment MVP

Technischer Umsetzungs-Blueprint fuer Revio auf Basis der aktuellen Codebase.

## Ziel

- Alle Therapeut:innen duerfen sich registrieren und in der Suche sichtbar sein.
- Nur Therapeut:innen mit `bookingMode = FIRST_APPOINTMENT_REQUEST` duerfen ueber Revio direkt fuer den ersten Termin angefragt werden.
- Fuer den MVP ist das keine Sofortbuchung, sondern eine bestaetigungspflichtige Anfrage.
- V1-Regel passend zur aktuellen Codebase:
  `requestable = publicSearchEligible && bookingMode === 'FIRST_APPOINTMENT_REQUEST'`

## Bestehende Struktur

- Mobile/freiberufliche Therapeut:innen sind heute bereits ueber den mobilen Profilpfad sichtbar:
  [apps/api/src/utils/profile-completeness.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/utils/profile-completeness.ts)
- Die Suche unterstuetzt bereits `homeVisit`, Radius und Verfuegbarkeit:
  [apps/api/src/routes/search.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/search.ts)
- Das Therapeuten-Dashboard ist der richtige Ort fuer Freelancer-Einstellungen:
  [apps/mobile/src/mobile-therapist-dashboard.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-therapist-dashboard.js)
- Die oeffentliche Therapeutenseite ist der richtige Einstieg fuer den Patienten-Anfrageflow:
  [apps/mobile/src/mobile-public-profiles.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-public-profiles.js)

## Produktregel

- `homeVisit` bedeutet: Therapeut kommt zum Patienten.
- `bookingMode` bedeutet: Therapeut ist ueber Revio direkt fuer einen Ersttermin anfragbar.
- Diese beiden Achsen muessen getrennt bleiben.

## Datenmodell

Datei:
- [apps/api/prisma/schema.prisma](/Users/vucenovic/Desktop/Revio/apps/api/prisma/schema.prisma)

### Neue Enums

```prisma
enum BookingMode {
  DIRECTORY_ONLY
  FIRST_APPOINTMENT_REQUEST
}

enum BookingRequestStatus {
  PENDING
  CONFIRMED
  DECLINED
  EXPIRED
}
```

### Therapist erweitern

```prisma
bookingMode     BookingMode  @default(DIRECTORY_ONLY)
nextFreeSlotAt  DateTime?
bookingRequests BookingRequest[]
```

### Neues Modell BookingRequest

```prisma
model BookingRequest {
  id                    String               @id @default(cuid())
  therapistId           String
  therapist             Therapist            @relation(fields: [therapistId], references: [id], onDelete: Cascade)

  status                BookingRequestStatus @default(PENDING)
  patientName           String
  patientEmail          String?
  patientPhone          String?
  preferredDays         String               @default("")
  preferredTimeWindows  String               @default("")
  message               String?
  consentAcceptedAt     DateTime

  createdAt             DateTime             @default(now())
  responseDueAt         DateTime
  respondedAt           DateTime?
  confirmedSlotAt       DateTime?

  @@index([therapistId, status, createdAt])
}
```

### Modellierungsentscheidung

- Fuer V1 werden `preferredDays` und `preferredTimeWindows` als Strings gespeichert und im API-Layer in Arrays gemappt.
- Das passt zur aktuellen Persistenzstrategie fuer `specializations`, `languages` und `certifications`.

## Shared Types

Datei:
- [packages/shared/src/index.ts](/Users/vucenovic/Desktop/Revio/packages/shared/src/index.ts)

### Neue Typen

```ts
export type BookingMode =
  | 'DIRECTORY_ONLY'
  | 'FIRST_APPOINTMENT_REQUEST';

export type BookingRequestStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'EXPIRED';

export interface BookingRequest {
  id: string;
  therapistId: string;
  status: BookingRequestStatus;
  patientName: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
  preferredDays: string[];
  preferredTimeWindows: string[];
  message?: string | null;
  createdAt: string;
  responseDueAt: string;
  respondedAt?: string | null;
  confirmedSlotAt?: string | null;
}

export interface CreateBookingRequestInput {
  therapistId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  preferredDays?: string[];
  preferredTimeWindows?: string[];
  message?: string;
  consentAccepted: true;
}
```

### Bestehende Typen erweitern

```ts
export interface Therapist {
  ...
  bookingMode?: BookingMode;
  nextFreeSlotAt?: string | null;
}

export interface SearchTherapist {
  ...
  bookingMode?: BookingMode;
  requestable?: boolean;
  nextFreeSlotAt?: string | null;
}
```

## API Blueprint

### Neue Route registrieren

Datei:
- [apps/api/src/app.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/app.ts)

```ts
import { bookingRequestRoutes } from './routes/booking-requests.js';
...
await app.register(bookingRequestRoutes);
```

### Neue Route-Datei

Neue Datei:
- `apps/api/src/routes/booking-requests.ts`

### Schema fuer Gast-Anfrage

```ts
const createBookingRequestSchema = z.object({
  therapistId: z.string().min(1),
  patientName: z.string().min(2),
  patientEmail: z.string().email().optional(),
  patientPhone: z.string().min(6).optional(),
  preferredDays: z.array(z.string()).max(7).default([]),
  preferredTimeWindows: z.array(z.string()).max(4).default([]),
  message: z.string().max(1000).optional(),
  consentAccepted: z.literal(true),
}).refine(
  (data) => Boolean(data.patientEmail?.trim()) || Boolean(data.patientPhone?.trim()),
  { message: 'E-Mail oder Telefonnummer erforderlich' },
);
```

### Endpoints

#### POST /booking-requests

Zweck:
- Gast-Anfrage fuer einen Ersttermin

Checks:
- Therapeut existiert
- `reviewStatus === 'APPROVED'`
- `isVisible === true`
- `publicSearchEligible === true`
- `bookingMode === 'FIRST_APPOINTMENT_REQUEST'`

Persistenz:
- `status = 'PENDING'`
- `responseDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000)`

Request:

```json
{
  "therapistId": "string",
  "patientName": "string",
  "patientEmail": "string",
  "patientPhone": "string",
  "preferredDays": ["Montag", "Dienstag"],
  "preferredTimeWindows": ["Vormittag"],
  "message": "string",
  "consentAccepted": true
}
```

Response:

```json
{
  "success": true,
  "requestId": "req_123",
  "status": "PENDING",
  "responseDueAt": "2026-03-30T12:00:00.000Z"
}
```

#### GET /auth/booking-requests

Zweck:
- Liste eingegangener Anfragen fuer eingeloggte Therapeut:innen

Response:

```json
{
  "requests": [
    {
      "id": "req_123",
      "status": "PENDING",
      "patientName": "Max Mustermann",
      "patientEmail": "max@example.com",
      "patientPhone": "+491701234567",
      "preferredDays": ["Montag", "Dienstag"],
      "preferredTimeWindows": ["Vormittag"],
      "message": "Ich habe starke Rueckenschmerzen.",
      "createdAt": "2026-03-29T10:00:00.000Z",
      "responseDueAt": "2026-03-30T10:00:00.000Z",
      "respondedAt": null,
      "confirmedSlotAt": null
    }
  ]
}
```

#### POST /auth/booking-requests/:id/confirm

Request:

```json
{
  "confirmedSlotAt": "2026-04-02T09:00:00.000Z"
}
```

Response:

```json
{
  "success": true,
  "status": "CONFIRMED",
  "confirmedSlotAt": "2026-04-02T09:00:00.000Z"
}
```

#### POST /auth/booking-requests/:id/decline

Request:

```json
{
  "reason": "optional"
}
```

Response:

```json
{
  "success": true,
  "status": "DECLINED"
}
```

### Ablauf fuer Expiry

- Kein Cron fuer MVP.
- Beim `GET /auth/booking-requests` und bei `confirm/decline`:
  - wenn `status === 'PENDING' && responseDueAt < now`, dann auf `EXPIRED` setzen

## API Aenderungen in bestehenden Dateien

### Registration

Datei:
- [apps/api/src/routes/register.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/register.ts)

Schema ergaenzen:

```ts
bookingMode: z.enum(['DIRECTORY_ONLY', 'FIRST_APPOINTMENT_REQUEST']).optional(),
nextFreeSlotAt: z.string().datetime().nullable().optional(),
availability: z.string().optional(),
```

Persistenz ergaenzen:

```ts
bookingMode: data.bookingMode ?? 'DIRECTORY_ONLY',
nextFreeSlotAt: data.nextFreeSlotAt ? new Date(data.nextFreeSlotAt) : null,
availability: data.availability ?? '',
```

### Auth Me

Datei:
- [apps/api/src/routes/auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/auth.ts)

`updateMeSchema` ergaenzen:

```ts
bookingMode: z.enum(['DIRECTORY_ONLY', 'FIRST_APPOINTMENT_REQUEST']).optional(),
nextFreeSlotAt: z.string().datetime().nullable().optional(),
```

`GET /auth/me` Rueckgabe ergaenzen:

```ts
bookingMode: therapist.bookingMode,
nextFreeSlotAt: therapist.nextFreeSlotAt?.toISOString() ?? null,
```

Wichtiger Fix:

```ts
...getTherapistPublicationState(therapist, { links: therapist.links }),
```

`PATCH /auth/me` erweitern:

```ts
if (data.bookingMode !== undefined) updateData.bookingMode = data.bookingMode;
if (data.nextFreeSlotAt !== undefined) {
  updateData.nextFreeSlotAt = data.nextFreeSlotAt ? new Date(data.nextFreeSlotAt) : null;
}
```

### Publication vs Requestability

Datei:
- [apps/api/src/utils/profile-completeness.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/utils/profile-completeness.ts)

Neue Helper-Funktion:

```ts
export function getTherapistRequestabilityState(
  therapist: TherapistLike & { bookingMode?: string | null; nextFreeSlotAt?: Date | string | null },
  options?: { links?: TherapistPracticeLinkLike[] },
) {
  const publication = getTherapistPublicationState(therapist, options);
  const blockingReasons: string[] = [];

  if (!publication.publicSearchEligible) blockingReasons.push(...publication.blockingReasons);
  if (therapist.bookingMode !== 'FIRST_APPOINTMENT_REQUEST') blockingReasons.push('booking_mode_disabled');

  return {
    requestable: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
  };
}
```

### Search

Datei:
- [apps/api/src/routes/search.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/search.ts)

`searchBodySchema` ergaenzen:

```ts
requestable: z.boolean().optional(),
```

Search-Ergebnis erweitern:

```ts
const requestability = getTherapistRequestabilityState(t, { links: t.links });

...
bookingMode: tAny.bookingMode ?? 'DIRECTORY_ONLY',
requestable: requestability.requestable,
nextFreeSlotAt: tAny.nextFreeSlotAt?.toISOString?.() ?? tAny.nextFreeSlotAt ?? null,
```

`GET /therapist/:id` ebenfalls erweitern um:
- `bookingMode`
- `requestable`
- `nextFreeSlotAt`

### Admin Serializer

Datei:
- [apps/api/src/routes/admin.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/admin.ts)

`TherapistRow` erweitern:

```ts
bookingMode: string;
nextFreeSlotAt: Date | null;
```

`mapTherapist(...)` erweitern:

```ts
bookingMode: t.bookingMode,
nextFreeSlotAt: t.nextFreeSlotAt?.toISOString() ?? null,
requestability: getTherapistRequestabilityState(t, { links: t.links }),
```

### Manager Guardrail

Datei:
- [apps/api/src/routes/manager-auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/manager-auth.ts)

Bei `POST /manager/practice/create-therapist` hart setzen:

```ts
bookingMode: 'DIRECTORY_ONLY',
nextFreeSlotAt: null,
```

## Mobile Mapping und State

### Mobile Mapper

Datei:
- [apps/mobile/src/mobile-utils.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-utils.js)

`mapApiTherapist(...)` erweitern:

```js
bookingMode: t.bookingMode ?? 'DIRECTORY_ONLY',
requestable: t.requestable ?? false,
nextFreeSlotAt: t.nextFreeSlotAt ?? null,
```

### App State

Datei:
- [apps/mobile/src/App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

Neue States:

```js
const [showBookingRequestSheet, setShowBookingRequestSheet] = useState(false);
const [bookingRequestTherapist, setBookingRequestTherapist] = useState(null);
const [bookingRequestLoading, setBookingRequestLoading] = useState(false);
const [bookingRequestName, setBookingRequestName] = useState('');
const [bookingRequestEmail, setBookingRequestEmail] = useState('');
const [bookingRequestPhone, setBookingRequestPhone] = useState('');
const [bookingRequestPreferredDays, setBookingRequestPreferredDays] = useState([]);
const [bookingRequestPreferredTimeWindows, setBookingRequestPreferredTimeWindows] = useState([]);
const [bookingRequestMessage, setBookingRequestMessage] = useState('');
const [bookingRequestConsent, setBookingRequestConsent] = useState(false);

const [bookingRequests, setBookingRequests] = useState([]);
const [bookingRequestsLoading, setBookingRequestsLoading] = useState(false);

const [editBookingMode, setEditBookingMode] = useState('DIRECTORY_ONLY');
const [editNextFreeSlotAt, setEditNextFreeSlotAt] = useState('');
```

Neue Handler:

```js
const openBookingRequestSheet = (therapist) => {
  setBookingRequestTherapist(therapist);
  setShowBookingRequestSheet(true);
};

const resetBookingRequestForm = () => { ... };

const handleCreateBookingRequest = async () => { ...POST /booking-requests... };

const loadBookingRequests = async () => { ...GET /auth/booking-requests... };

const handleConfirmBookingRequest = async (id, confirmedSlotAt) => { ... };

const handleDeclineBookingRequest = async (id) => { ... };
```

## Registrierung

Datei:
- [apps/mobile/src/App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

`regFreelance` fachlich mappen:

```js
bookingMode: regFreelance === true ? 'FIRST_APPOINTMENT_REQUEST' : 'DIRECTORY_ONLY',
nextFreeSlotAt: regFreelance === true ? (regNextFreeSlotAt || null) : null,
```

## Profil speichern

Datei:
- [apps/mobile/src/App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

Payload fuer `handleSaveProfile` erweitern:

```js
bookingMode: editBookingMode,
nextFreeSlotAt: editNextFreeSlotAt || null,
```

Beim Oeffnen des Edit-Mode:

```js
setEditBookingMode(th.bookingMode ?? 'DIRECTORY_ONLY');
setEditNextFreeSlotAt(th.nextFreeSlotAt ?? '');
```

## Mobile UI

### Oeffentliche Therapeutenseite

Datei:
- [apps/mobile/src/mobile-public-profiles.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-public-profiles.js)

Props erweitern:

```js
onOpenBookingRequest
```

Wenn `th.requestable === true`:
- Info-Card `Ersttermin ueber Revio`
- optional `Naechster freier Termin`
- CTA `Ersttermin anfragen`

CTA:

```jsx
<Pressable
  style={[styles.ctaBtn, { backgroundColor: c.primary }]}
  onPress={() => onOpenBookingRequest(th)}
>
  <Text style={styles.ctaBtnText}>Ersttermin anfragen</Text>
</Pressable>
```

Wenn `requestable === false`:
- bestehende Praxis-/Kontakt-CTAs unveraendert lassen

### Discover

Datei:
- [apps/mobile/src/mobile-discover-screen.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-discover-screen.js)

Ergaenzen:
- Badge `Direkt anfragbar`
- optionale Meta-Zeile `Nächster Termin`
- Filter `Nur direkt anfragbar`

Datei:
- [apps/mobile/src/App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

Search-Payload erweitern:

```js
requestable: requestableOnly || undefined,
```

### Therapeuten-Dashboard

Datei:
- [apps/mobile/src/mobile-therapist-dashboard.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-therapist-dashboard.js)

Neue Edit-Sektion:
- `Nur sichtbar`
- `Ersttermin anfragbar`
- Feld `Naechster freier Termin`
- `availability` bleibt Freitext

Neue Inbox-Sektion:
- `Offene Anfragen`
- `Bestaetigt`
- `Abgelehnt`

Anfrage-Karte:
- Name
- Eingang
- Antwortfrist
- bevorzugte Tage
- Zeitfenster
- Nachricht
- `Bestaetigen`
- `Ablehnen`

## Admin UI

### Admin Bridge

Datei:
- [apps/admin/lib/api.ts](/Users/vucenovic/Desktop/Revio/apps/admin/lib/api.ts)

Shared Types ziehen die neuen Felder mit.

### Admin Liste

Datei:
- [apps/admin/app/(admin)/therapists/page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/page.tsx)

Ergaenzen:
- Badge fuer `bookingMode`
- Warnung wenn:
  - `bookingMode === FIRST_APPOINTMENT_REQUEST`
  - aber `requestability.requestable === false`

### Admin Detail

Datei:
- [apps/admin/app/(admin)/therapists/[id]/page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/[id]/page.tsx)

Profil-Detailblock ergaenzen:

```tsx
<dt>Buchungsmodus</dt>
<dd>{therapist.bookingMode === 'FIRST_APPOINTMENT_REQUEST' ? 'Ersttermin anfragbar' : 'Nur Verzeichnis'}</dd>

<dt>Nächster freier Termin</dt>
<dd>{therapist.nextFreeSlotAt ? formatDate(therapist.nextFreeSlotAt) : '–'}</dd>
```

Zusaetzliche Warnbox:
- `Anfragbar markiert, aber noch nicht anfragbar weil: ...`

## Gast-Flow: Pflicht und Verzicht

Pflichtfelder:
- `patientName`
- `patientEmail` oder `patientPhone`
- `consentAccepted`

Optionale Felder:
- `preferredDays`
- `preferredTimeWindows`
- `message`

Bewusst nicht erfassen:
- Geburtsdatum
- Versicherungsnummer
- Diagnoseunterlagen
- Adresse
- Zahlungsdaten

## UI States

- `idle`
- `form_open`
- `submitting`
- `success`
- `error`

Success-Text:
- `Anfrage gesendet`
- `Der Therapeut hat 24 Stunden Zeit zum Antworten.`

Fehlertext:
- `Hat nicht geklappt – bitte nochmal versuchen`

## MVP Acceptance Criteria

- Standard-Therapeut:innen bleiben in Suche und Profilen sichtbar.
- Nur `bookingMode = FIRST_APPOINTMENT_REQUEST` zeigt `Ersttermin anfragen`.
- Gast kann Anfrage ohne Konto senden.
- Therapeut sieht Anfrage im Dashboard.
- Therapeut kann bestaetigen oder ablehnen.
- Nach 24h wird `PENDING` nicht mehr als offen behandelt.
- Suche kann `Nur direkt anfragbar`.
- Admin sieht `Directory only` vs `Ersttermin anfragbar`.
- Manager-erstellte Therapeut:innen bleiben standardmaessig `DIRECTORY_ONLY`.

## Nicht Teil des MVP

- Patientenkonto
- Kalender-Sync
- Slot-Engine
- Praxisbuchung
- Payment
- Rescheduling
- In-App-Chat

## Jira Tickets

### 1. Add therapist booking mode and booking request persistence

Summary:
- Erweitere das Datenmodell, damit zwischen sichtbaren Profilen und direkt anfragbaren Freelancer-Profilen unterschieden werden kann.

Description:
- Ergänze in [schema.prisma](/Users/vucenovic/Desktop/Revio/apps/api/prisma/schema.prisma) `BookingMode`, `BookingRequestStatus`, die Felder `bookingMode` und `nextFreeSlotAt` auf `Therapist` sowie das neue Modell `BookingRequest`. Erstelle die zugehörige Prisma-Migration.

Files:
- [schema.prisma](/Users/vucenovic/Desktop/Revio/apps/api/prisma/schema.prisma)

Acceptance Criteria:
- `Therapist` hat `bookingMode` mit Default `DIRECTORY_ONLY`
- `Therapist` hat `nextFreeSlotAt`
- `BookingRequest` existiert mit Status, Patientenkontakt, Präferenzen und 24h-Fristfeldern
- Migration läuft lokal ohne bestehende Daten zu verlieren

### 2. Extend shared contracts for requestable therapists and booking requests

Summary:
- Stelle sicher, dass Mobile, API und Admin dieselben Typen für neue Felder verwenden.

Description:
- Ergänze in [index.ts](/Users/vucenovic/Desktop/Revio/packages/shared/src/index.ts) die Typen `BookingMode`, `BookingRequestStatus`, `BookingRequest`, `CreateBookingRequestInput` sowie neue Felder auf `Therapist` und `SearchTherapist`.

Files:
- [index.ts](/Users/vucenovic/Desktop/Revio/packages/shared/src/index.ts)

Acceptance Criteria:
- Shared Types kompilieren
- Mobile und Admin können neue Felder ohne lokale Ad-hoc-Typen konsumieren
- bestehende Typverwendungen brechen nicht

### 3. Persist booking mode and next free slot during therapist registration

Summary:
- Das bestehende Registrierungsmodell soll `regFreelance` in ein echtes Backend-Feld übersetzen.

Description:
- Erweitere [register.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/register.ts), damit `bookingMode`, `nextFreeSlotAt` und optional `availability` gespeichert werden. `DIRECTORY_ONLY` bleibt Default.

Files:
- [register.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/register.ts)

Acceptance Criteria:
- Registrierung ohne neue Felder funktioniert unverändert
- Registrierung mit `bookingMode = FIRST_APPOINTMENT_REQUEST` speichert den Modus korrekt
- `nextFreeSlotAt` wird als `DateTime` persistiert oder `null` gesetzt

### 4. Extend therapist profile APIs with booking mode and next free slot

Summary:
- Therapeut:innen müssen ihre direkte Anfragbarkeit im bestehenden Dashboard bearbeiten können.

Description:
- Ergänze [auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/auth.ts) in `GET /auth/me` und `PATCH /auth/me` um `bookingMode` und `nextFreeSlotAt`. Passe dabei auch die Publication-Berechnung an, damit sie bei `/auth/me` mit Praxis-Links arbeitet.

Files:
- [auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/auth.ts)

Acceptance Criteria:
- Dashboard erhält neue Felder beim Laden
- Therapeut kann den Modus speichern
- bestehende Profilupdates funktionieren weiter
- `getTherapistPublicationState` wird in `/auth/me` mit `links` aufgerufen

### 5. Add requestability helper separate from publication state

Summary:
- Sichtbarkeit und direkte Termin-Anfrage sollen fachlich getrennt werden.

Description:
- Ergänze in [profile-completeness.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/utils/profile-completeness.ts) eine neue Funktion `getTherapistRequestabilityState(...)`. Diese basiert auf `publicSearchEligible` plus `bookingMode === FIRST_APPOINTMENT_REQUEST` und liefert `requestable` plus Blockergründe.

Files:
- [profile-completeness.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/utils/profile-completeness.ts)

Acceptance Criteria:
- Standard-Therapeut:innen können sichtbar sein und gleichzeitig `requestable = false`
- Freelancer mit aktivem Modus und sichtbarem Profil erhalten `requestable = true`
- Blockergründe sind dedupliziert und verständlich

### 6. Create guest booking request endpoints for first appointment requests

Summary:
- Patienten sollen ohne Konto einen Ersttermin anfragen können.

Description:
- Erstelle die neue Route `booking-requests.ts` und registriere sie in [app.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/app.ts). Implementiere `POST /booking-requests`, `GET /auth/booking-requests`, `POST /auth/booking-requests/:id/confirm` und `POST /auth/booking-requests/:id/decline`.

Files:
- [app.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/app.ts)
- `apps/api/src/routes/booking-requests.ts`

Acceptance Criteria:
- Gast-Anfrage ohne Login ist möglich
- mindestens E-Mail oder Telefon ist Pflicht
- nur `requestable` Therapeut:innen akzeptieren Anfragen
- `responseDueAt` wird auf 24h nach Eingang gesetzt
- `confirm` setzt `CONFIRMED`, `decline` setzt `DECLINED`

### 7. Extend public search and therapist detail APIs with requestability

Summary:
- Suche und Detailseiten müssen erkennen, ob ein Profil direkt anfragbar ist.

Description:
- Ergänze [search.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/search.ts) um `requestable`, `bookingMode` und `nextFreeSlotAt` in `POST /search` und `GET /therapist/:id`. Füge optional den Filter `requestable` im Search-Body hinzu.

Files:
- [search.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/search.ts)

Acceptance Criteria:
- Standard-Therapeut:innen bleiben sichtbar
- requestable Freelancer sind eindeutig markiert
- Filter `requestable=true` schließt nicht anfragbare Profile aus
- bestehende Search-Filter funktionieren weiter

### 8. Map booking mode and requestable flags into mobile therapist objects

Summary:
- Mobile muss neue API-Felder sauber in die bestehende App-State-Struktur übernehmen.

Description:
- Ergänze [mobile-utils.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-utils.js) in `mapApiTherapist(...)` um `bookingMode`, `requestable` und `nextFreeSlotAt`.

Files:
- [mobile-utils.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-utils.js)

Acceptance Criteria:
- `selectedTherapist` enthält neue Felder nach `GET /therapist/:id`
- Search-Ergebnisse enthalten dieselben Felder im Mobile-State
- bestehende Screens brechen nicht, wenn Felder fehlen

### 9. Add direct-request filter and badges to discover search

Summary:
- Patient:innen sollen in der Suche erkennen und filtern können, wer direkt anfragbar ist.

Description:
- Ergänze in [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js) den Search-State und Payload um `requestable`. Zeige in [mobile-discover-screen.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-discover-screen.js) ein Badge `Direkt anfragbar` und optional `Nächster Termin`.

Files:
- [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)
- [mobile-discover-screen.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-discover-screen.js)

Acceptance Criteria:
- Filter `Nur direkt anfragbar` ist im Discover-Flow verfügbar
- requestable Treffer sind visuell markiert
- nicht requestable Standard-Therapeut:innen bleiben ohne Filter sichtbar
- bestehende Search-UX bleibt stabil

### 10. Add guest first-appointment request flow to public therapist profile

Summary:
- Die öffentliche Therapeutenseite soll den Ersttermin-Anfrageflow starten können.

Description:
- Erweitere [mobile-public-profiles.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-public-profiles.js) um einen primären CTA `Ersttermin anfragen`, wenn `th.requestable === true`. Verwalte das Sheet und Formular-State in [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js).

Files:
- [mobile-public-profiles.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-public-profiles.js)
- [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

Acceptance Criteria:
- Standard-Therapeut:innen zeigen keinen Revio-Buchungs-CTA
- requestable Freelancer zeigen `Ersttermin anfragen`
- Gast kann Name, Kontakt, Wunschzeiten und Nachricht eingeben
- Success-State zeigt 24h-Hinweis
- Fehlermeldung ist weich formuliert

### 11. Add booking mode settings and booking request inbox to therapist dashboard

Summary:
- Therapeut:innen sollen ihre direkte Anfragbarkeit und eingehende Ersttermin-Anfragen in der App verwalten.

Description:
- Ergänze [mobile-therapist-dashboard.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-therapist-dashboard.js) und die zugehörigen State-/Fetch-Handler in [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js). Baue eine Edit-Sektion für `bookingMode` und `nextFreeSlotAt` sowie eine Inbox für offene Anfragen.

Files:
- [mobile-therapist-dashboard.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/mobile-therapist-dashboard.js)
- [App.js](/Users/vucenovic/Desktop/Revio/apps/mobile/src/App.js)

Acceptance Criteria:
- Therapeut kann zwischen `Nur sichtbar` und `Ersttermin anfragbar` wechseln
- `nextFreeSlotAt` ist bearbeitbar
- offene Anfragen sind sichtbar
- Confirm und Decline funktionieren aus dem Dashboard
- abgelaufene Anfragen erscheinen nicht mehr als offen

### 12. Surface requestability in admin and keep manager-created therapists directory-only

Summary:
- Admin muss sehen, welche Profile direkt anfragbar sind, und Manager-Flows sollen im MVP keine Freelancer-Buchbarkeit freischalten.

Description:
- Ergänze [admin.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/admin.ts), [api.ts](/Users/vucenovic/Desktop/Revio/apps/admin/lib/api.ts), [page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/page.tsx) und [[id]/page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/[id]/page.tsx) um `bookingMode`, `nextFreeSlotAt` und `requestability`. Setze in [manager-auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/manager-auth.ts) neue Praxis-Therapeut:innen immer auf `DIRECTORY_ONLY`.

Files:
- [admin.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/admin.ts)
- [api.ts](/Users/vucenovic/Desktop/Revio/apps/admin/lib/api.ts)
- [page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/page.tsx)
- [[id]/page.tsx](/Users/vucenovic/Desktop/Revio/apps/admin/app/(admin)/therapists/[id]/page.tsx)
- [manager-auth.ts](/Users/vucenovic/Desktop/Revio/apps/api/src/routes/manager-auth.ts)

Acceptance Criteria:
- Admin-Liste zeigt `Nur Verzeichnis` oder `Ersttermin anfragbar`
- Admin-Detailseite zeigt Blocker, wenn ein Profil anfragbar markiert, aber faktisch nicht requestable ist
- manager-erstellte Therapeut:innen werden standardmäßig `DIRECTORY_ONLY` angelegt
