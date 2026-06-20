# Claude Handoff: Therapist Patient List + Patient Detail Plan

## Goal

Add a therapist-facing patient list inside the mobile app so therapists can:

- see a list of their patients
- tap a patient to open a detail screen
- see patient-related appointments/bookings for that therapist
- see important patient contact data such as phone and email
- show address as a placeholder for now if patient address data does not yet exist

This is a plan handoff, not approval for product expansion beyond the therapist app experience.

## Product Intent

Therapists should not have to reconstruct their patient relationships from scattered booking cards and slot entries.

Instead, they should get:

1. a dedicated `Patient:innen` overview
2. a patient detail page
3. an appointment history / booking history scoped to that therapist-patient relationship

Important boundary:

- this is not a global patient directory
- a therapist may only see patients who already had a booking/request relationship with that therapist

## Current State

### In the app

The therapist therapy area currently centers around:

- slots
- incoming bookings
- booking responses

Relevant files:

- `apps/mobile/src/screens/therapy/TherapyScreen.js`
- `apps/mobile/src/screens/therapy/TherapyTabTherapist.js`
- `apps/mobile/src/components/SlotComposer.js`

There is currently no dedicated patient list or patient detail screen.

### In the API

Therapists already receive booking request data through:

- `GET /bookings/incoming`
  - implemented in `apps/api/src/routes/booking.ts`

Patients already exist implicitly through booking relationships:

- `BookingRequest.patientUserId`
- `BookingRequest.patientName`
- `BookingRequest.patientEmail`
- `BookingRequest.patientPhone`

### In the DB

Current `User` model already has:

- `firstName`
- `lastName`
- `email`
- `phone`

Relevant file:

- `apps/api/prisma/schema.prisma`

Important limitation:

- the patient `User` model currently has no address fields

### Shared contracts

Current booking contracts already include patient contact basics:

- `packages/shared/src/index.ts`

But there is no dedicated therapist-patient list/detail contract yet.

## Key Observations

1. The app already has enough data to show a first patient list using booking relationships.
2. Phone and email are already realistic to expose.
3. Address is not yet modeled on `User`, so it must be a placeholder in phase 1.
4. The existing therapist therapy UI is already busy; patient list UI should be added as a separate screen or sub-flow, not squeezed into booking cards.

## Recommended Feature Shape

### New therapist-facing flows

Add:

1. `Patient:innen` list screen
2. `Patient:in` detail screen

Suggested behavior:

- therapist opens therapy area
- therapist can switch to or open `Patient:innen`
- therapist sees deduplicated patient list
- therapist taps a patient
- therapist sees:
  - name
  - email
  - phone
  - address placeholder for now
  - all appointments / booking requests with that therapist

## Recommended Backend Design

### 1. Add a therapist patient list endpoint

Suggested endpoint:

- `GET /therapist/patients`

Auth:

- therapist only

Scope:

- return only patients connected to the authenticated therapist through booking requests / appointments

Return shape per patient:

- `patientUserId`
- `fullName`
- `email`
- `phone`
- `addressLine` or `null`
- `bookingCount`
- `lastBookingAt`
- `nextAppointmentAt`
- `lastStatus`

Important:

- deduplicate by `patientUserId`
- do not use `patientName` alone as the identity key

### 2. Add a therapist patient detail endpoint

Suggested endpoint:

- `GET /therapist/patients/:patientUserId`

Auth:

- therapist only

Validation:

- therapist may only access a patient if at least one booking relationship exists between them

Return shape:

- `patient`
  - `id`
  - `fullName`
  - `email`
  - `phone`
  - `addressLine`
- `appointments`
  - booking/request history for this therapist + this patient only

Suggested appointment fields:

- `id`
- `status`
- `slot`
- `confirmedSlotAt`
- `createdAt`
- `respondedAt`
- `message`
- `declinedReason`

### 3. Optional helper logic

Consider extracting a small serializer/helper in the booking route area to avoid repeating:

- patient display name derivation
- next appointment calculation
- deduplication logic

## Recommended Shared Types

Add new shared contracts in:

- `packages/shared/src/index.ts`

Suggested types:

- `TherapistPatientListItem`
- `TherapistPatientDetail`
- `TherapistPatientAppointment`

Example conceptual fields:

### `TherapistPatientListItem`

- `id`
- `fullName`
- `email`
- `phone`
- `addressLine?: string | null`
- `bookingCount`
- `lastBookingAt?: string | null`
- `nextAppointmentAt?: string | null`
- `lastStatus?: BookingRequestStatus | null`

### `TherapistPatientAppointment`

- `id`
- `status`
- `slot?: { id, startsAt, durationMin, status } | null`
- `confirmedSlotAt?: string | null`
- `createdAt`
- `respondedAt?: string | null`
- `message?: string | null`
- `declinedReason?: string | null`

### `TherapistPatientDetail`

- `patient: TherapistPatientListItem`
- `appointments: TherapistPatientAppointment[]`

## Recommended Mobile UX

### Phase 1 UX

Keep it simple and useful.

#### Patient list screen

Each row should show:

- patient name
- phone if available
- email if available
- next appointment or most recent appointment
- maybe booking count as supporting meta

Tap action:

- opens patient detail screen

#### Patient detail screen

Header:

- patient name
- phone
- email
- address placeholder

Body:

- chronological list of bookings/appointments with this therapist
- status badge
- date/time
- optional message
- decline reason if applicable

### Address placeholder behavior

Because address does not currently exist on patient users:

- API should return `addressLine: null`
- UI should explicitly display a placeholder such as:
  - `Adresse noch nicht verfügbar`
  - or `Adresse folgt in späterem Ausbau`

Do not fake real address data.

## Recommended Navigation Shape

### Preferred option

Add a separate therapist sub-screen rather than overloading the slot list.

Possible approaches:

1. add a segmented switch inside the therapist therapy area:
   - `Termine`
   - `Patient:innen`
2. or add a clear CTA/button from `TherapyTabTherapist` into a dedicated patient list screen

Recommendation:

- start with a dedicated screen reachable from the therapist therapy tab
- avoid making `TherapyTabTherapist.js` even denser than it already is

Suggested new mobile screens:

- `apps/mobile/src/screens/therapy/TherapistPatientsScreen.js`
- `apps/mobile/src/screens/therapy/TherapistPatientDetailScreen.js`

## Recommended Data Loading Approach

Do not piggyback entirely on `incomingBookings`.

Instead:

- fetch a real patient list from the API
- fetch patient detail separately on demand

Why:

- cleaner UI contracts
- less client-side deduplication complexity
- better privacy enforcement in one backend place
- easier future expansion

## Security / Privacy Rules

Critical requirements:

1. A therapist may only see patients tied to their own bookings.
2. No endpoint may allow arbitrary patient lookup by ID without relationship validation.
3. No global patient directory or cross-therapist visibility.
4. No admin-only or internal patient fields should leak into the therapist app.

## Address Data Strategy

### Current state

Patient address fields do not exist in the `User` model today.

### Phase 1

Use placeholder only:

- backend returns `addressLine: null`
- frontend renders a clear placeholder

### Later optional expansion

If you decide to actually store patient addresses later, add fields to `User`, for example:

- `postalCode`
- `street`
- `houseNumber`
- `city`

But this should be a separate follow-up, not required for phase 1.

## Suggested Implementation Phases

### Phase 1: Contracts + API

1. Add shared therapist-patient types in `packages/shared/src/index.ts`
2. Add `GET /therapist/patients`
3. Add `GET /therapist/patients/:patientUserId`
4. Return `addressLine: null` for now

### Phase 2: App screens

1. Add `TherapistPatientsScreen`
2. Add `TherapistPatientDetailScreen`
3. Create small presentational components if useful:
   - `PatientListCard`
   - `PatientInfoCard`
   - `PatientAppointmentHistory`

### Phase 3: Navigation integration

1. Add entry point from therapist therapy area
2. Wire selection flow to detail screen
3. Keep existing appointment/slot workflows untouched

### Phase 4: Polish

1. Loading / empty / error states
2. Better date grouping for appointment history
3. Clickable phone/email actions
4. Placeholder copy for missing address

## Acceptance Criteria

The feature is successful if:

1. A therapist can open a patient list in the app.
2. The list is deduplicated by real patient identity, not display name only.
3. A therapist can open a patient detail screen.
4. The detail screen shows that patient’s appointments/bookings with that therapist.
5. Phone and email are shown when available.
6. Address is shown as a clear placeholder if not yet modeled.
7. No therapist can access unrelated patients.

## Recommended PR Split

### PR 1

`feat/api-therapist-patient-list`

- shared types
- patient list endpoint
- patient detail endpoint

### PR 2

`feat/mobile-therapist-patients`

- patient list screen
- patient detail screen
- navigation integration

### PR 3

`polish/mobile-therapist-patient-history`

- better meta rows
- improved appointment history UI
- placeholder polish

## Files Likely Involved

### Backend

- `apps/api/src/routes/booking.ts`
- optionally a new helper under `apps/api/src/utils/`
- `apps/api/prisma/schema.prisma` only if later address storage is added

### Shared

- `packages/shared/src/index.ts`

### Mobile

- `apps/mobile/src/screens/therapy/TherapyScreen.js`
- `apps/mobile/src/screens/therapy/TherapyTabTherapist.js`
- new:
  - `apps/mobile/src/screens/therapy/TherapistPatientsScreen.js`
  - `apps/mobile/src/screens/therapy/TherapistPatientDetailScreen.js`

## Explicit Non-Goals For Phase 1

Do not add:

- patient address persistence yet
- patient edit forms
- therapist notes about patients
- cross-therapist patient sharing
- web implementation

