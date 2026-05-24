# CLAUDE.md — Revio Booking MVP Technical Reference

> Primary reference for coding agents working on Revio.
>
> This document replaces the older Discovery-first reference. Revio is now a Booking-MVP with patient registration, appointment booking, and freelance therapist self-registration.
>
> Treat this file as the product and architecture source of truth unless a more recent `docs/` file explicitly overrides it.

---

## 0. Current Product Scope — Must Read First

Revio is a Booking-MVP for helping patients find and book appointments with freelance therapists.

### Core MVP

The MVP includes:

- Public therapist search
- Map/radius-based therapist discovery
- Patient registration and login
- Patient appointment booking
- Patient appointment overview
- Booking status tracking
- Appointment-related notifications
- Patient favorites
- Freelance therapist registration
- Freelance therapist profile management
- Freelance therapist availability / slot management
- Manual therapist verification and moderation
- Admin review workflows

### Explicitly out of MVP

Do not implement these features in the MVP:

- Payments
- Reviews
- Medical records
- AI diagnosis
- AI treatment plans
- Practice manager self-registration
- Employed therapist self-registration as public providers
- Multi-therapist practice administration
- Insurance billing workflows
- In-app chat
- Video consultations

### Registration rule

Only two user types can self-register in the MVP:

1. Patients
2. Freelance therapists

Therapists who are not freelance must not be able to self-register as public providers in the MVP.

### Product principle

The MVP should stay narrow:

1. Patients find suitable freelance therapists.
2. Patients register and book appointments.
3. Freelance therapists manage profile and availability.
4. Admin verifies therapist legitimacy.
5. The system avoids payments, reviews, medical records, and unnecessary health data.

---

## 1. Architecture Status

Revio is in a transition phase. Do not assume that every existing route, screen, model, or module is production-ready.

Before changing code, verify:

1. Whether the feature belongs to the Booking-MVP.
2. Whether the API route is actually registered in `apps/api/src/app.ts`.
3. Whether the mobile screen is active or only scaffold/migration code.
4. Whether the database model is current or legacy.
5. Whether the feature needs patient auth, therapist auth, admin auth, or no auth.
6. Whether the feature could accidentally introduce payments, reviews, or medical data.

### Known transition risks

- The mobile app has historically contained too much state and business logic in a large legacy component.
- API routes may exist as files without being registered.
- Auth structures may exist in parallel, such as session-token auth and planned JWT/auth-v2 modules.
- Database schema and code expectations may drift.
- Some files may be planned migration scaffolds rather than active implementation.
- Some UI flows may exist visually before the backend is fully aligned.

### Agent rule

Do not blindly extend legacy code. Prefer extracting services and clarifying active routes before adding new screens or new business logic.

---

## 2. Monorepo Layout

Expected structure:

```txt
Revio/
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── api/                     # Fastify backend
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/seed.ts
│   │   ├── src/app.ts           # Fastify app builder and route registration
│   │   ├── src/server.ts
│   │   ├── src/env.ts
│   │   ├── src/routes/
│   │   ├── src/plugins/
│   │   ├── src/utils/
│   │   └── uploads/             # Local dev uploads only
│   ├── admin/                   # Next.js admin dashboard
│   ├── mobile/                  # Expo / React Native app
│   └── site/                    # Marketing site, if present
└── packages/
    └── shared/                  # Shared types and DTO contracts
```

### Legacy folders

If root-level folders such as `AdminRevio/`, `revioApp/`, or similar old copies exist, do not use them unless the current project explicitly imports them.

The active code should be confirmed from:

- root `package.json`
- `pnpm-workspace.yaml`
- `apps/api/src/app.ts`
- current mobile entry file
- current admin entry file

---

## 3. User Roles

### 3.1 Visitor

A visitor is not logged in.

Allowed:

- Search therapists
- View public therapist profile previews
- View map/list results
- Open login or registration

Forbidden:

- Book appointments
- Save persistent favorites
- View appointment history
- Access therapist dashboards

### 3.2 Patient

A patient is a registered user who can book appointments.

Allowed:

- Login/logout
- Search therapists
- View public therapist profiles
- Save favorites
- Book or request appointment slots
- View upcoming appointments
- View past appointments
- Cancel appointments if allowed by booking policy
- Receive appointment notifications
- Edit basic account/profile information

Forbidden:

- Register as therapist from patient account without a separate therapist onboarding flow
- Access therapist dashboards
- Access other patients' bookings
- Leave reviews in MVP
- Make in-app payments in MVP
- Store medical records in MVP

### 3.3 Freelance Therapist

A freelance therapist is a registered provider.

Allowed:

- Register as a freelance therapist
- Login/logout
- Create and edit own profile
- Upload profile photo
- Set specializations, languages, service area, kassenart, home visits, and contact data
- Create and manage appointment slots
- Confirm, reject, edit, or cancel appointment requests depending on booking model
- View own bookings
- Receive appointment notifications
- Hide or show own profile if allowed

Forbidden:

- Register as an employed therapist for a practice in MVP
- Create fake practice associations
- Access other therapists' bookings
- Access patient data outside booking context
- Publish unverified profile publicly
- Add reviews or payment features

### 3.4 Admin / Reviewer

An admin verifies and moderates platform content.

Allowed:

- Review therapist profiles
- Approve, reject, suspend, or request changes
- Review suspicious profiles or content
- Check profile completeness
- Review booking-related support cases if needed
- Manage system-level safety and trust states

Forbidden:

- Fabricate credentials
- Silently change professional claims into stronger claims
- Approve unclear legitimacy without review
- Access or export patient data without a clear operational reason

---

## 4. System Agents and Modules

Revio uses logical agents. These are deterministic product modules, not AI agents.

---

### 4.1 Search & Matching Agent

**Purpose:** Convert a patient search request into ranked therapist results.

**Likely implementation:** `apps/api/src/routes/search.ts` and search utilities.

| Field | Description |
|---|---|
| Inputs | Query, city/location, radius, language, specialization, kassenart, homeVisit |
| Outputs | Ranked therapist results and related map data |
| State | Stateless for anonymous search; no patient profile required |
| Auth | None for public search |

Allowed:

- Normalize query text
- Match patient problem terms to therapist specializations
- Filter by location, language, kassenart, home visits, and availability
- Return only public, approved, visible therapists
- Return map coordinates only for public provider locations

Forbidden:

- Diagnose conditions
- Infer urgency
- Generate treatment plans
- Store anonymous health search profiles
- Reward keyword stuffing

Failure cases:

- Empty query can return default discovery or validation error depending on current API design
- Unknown city returns empty results, not server error
- Invalid filters return validation error

---

### 4.2 Map Agent

**Purpose:** Display therapist/provider results geographically.

| Field | Description |
|---|---|
| Inputs | Search result coordinates, patient-selected location, radius |
| Outputs | Map markers, radius circle, list/map synchronization |
| State | Transient search location |
| Auth | None required for search |

Allowed:

- Show map pins
- Show radius visualization
- Sync selected list card and map marker
- Fall back to manual city input if location permission is denied

Forbidden:

- Track location in background
- Store patient location trails
- Collect precise location without explicit user action
- Show non-approved therapist locations publicly

Implementation rule:

If map code exists, verify whether it is active in the current mobile entry file. Do not rely on old documentation that says the map is only planned.

---

### 4.3 Patient Account Agent

**Purpose:** Manage patient registration, login, profile basics, favorites, appointments, and notifications.

| Field | Description |
|---|---|
| Inputs | Email, password, name, optional phone, selected appointment |
| Outputs | Patient account, session token, favorites, bookings, notifications |
| State | Patient record, auth session, appointment records, notification records |
| Auth | Patient bearer token |

Allowed:

- Register patients
- Login/logout patients
- Store minimal patient profile data
- Save favorite therapists
- Show appointment history/status
- Show appointment-related notifications

Forbidden:

- Store medical records
- Store diagnosis data unless explicitly required by a narrow booking flow
- Treat search or booking text as medical triage
- Expose patient data to unrelated therapists
- Implement reviews
- Implement payments

Data minimization:

Patient registration should collect only data required for account and booking operations.

Recommended fields:

- email
- password hash
- name
- phone number if needed for booking
- createdAt / updatedAt
- consent timestamps if applicable

Avoid collecting:

- diagnosis
- insurance details
- medical documents
- detailed symptoms
- therapy history

---

### 4.4 Freelance Therapist Account Agent

**Purpose:** Manage freelance therapist registration and provider profile lifecycle.

| Field | Description |
|---|---|
| Inputs | Email, password, name, title, city/service area, specializations, languages, contact data |
| Outputs | Therapist account, draft profile, verification state, session token |
| State | Therapist record, auth session, profile data |
| Auth | Therapist bearer token |

Allowed:

- Register freelance therapists
- Create draft provider profile
- Edit own profile
- Upload own profile photo
- Manage own availability
- Submit profile for review
- Hide or show own profile if supported

Forbidden:

- Allow employed therapists to self-register as public providers in MVP
- Auto-publish unverified providers
- Create fake practice associations
- Allow one therapist to manage another therapist's bookings
- Add payments or reviews

Registration copy rule:

All registration UI must clearly say that provider registration is for freelance therapists.

General UI copy rule:

Do not use emojis anywhere in the app UI.

This includes, but is not limited to:

- Screen titles
- Buttons
- Empty states
- Success or error messages
- Badges
- Notifications
- Onboarding text
- Marketing-like decorative labels inside the product UI

Use clear German copy, visual hierarchy, spacing, color, and iconography instead of emojis.

Suggested German UI copy:

```txt
Ich bin freiberufliche:r Therapeut:in und möchte Termine über Revio anbieten.
```

Avoid copy such as:

```txt
Praxis registrieren
Therapeut:in im Team hinzufügen
Mitarbeiterprofil erstellen
```

unless a verified post-MVP practice flow exists.

---

### 4.5 Booking Agent

**Purpose:** Allow registered patients to book or request appointment slots with approved freelance therapists.

| Field | Description |
|---|---|
| Inputs | Patient ID, therapist ID, slot ID, appointment time, booking action |
| Outputs | Booking/appointment record, updated slot state, notifications |
| State | Slots, bookings, appointment status, notification events |
| Auth | Patient token for booking; therapist token for provider actions |

Allowed:

- Show available appointment slots
- Let patients book or request appointments
- Let therapists confirm or reject booking requests if request-based model is used
- Let therapists cancel or update availability according to rules
- Let patients cancel according to rules
- Notify both sides about status changes

Forbidden:

- Process payments
- Collect or show reviews
- Store medical records
- Double-book the same slot
- Allow booking with unapproved therapists
- Allow booking with hidden/inactive therapists
- Allow therapist access to unrelated patient data
- Let patients book in the past

Core invariants:

1. A slot can only be booked once.
2. A booking must belong to exactly one patient and one therapist.
3. A booking must reference a valid slot or a valid appointment time.
4. Public booking is only possible with approved and visible freelance therapists.
5. Booking status transitions must be explicit and validated.
6. Patient contact data is visible only inside a valid booking context.
7. Cancellations must update slot availability consistently.

Recommended statuses:

```ts
type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_THERAPIST"
  | "COMPLETED"
  | "NO_SHOW";
```

Use fewer statuses if the current implementation is simpler, but avoid ambiguous states.

---

### 4.6 Availability / Slot Agent

**Purpose:** Manage therapist appointment availability.

| Field | Description |
|---|---|
| Inputs | Therapist ID, date, start time, end time, duration, recurrence optional |
| Outputs | Available slots |
| State | Slot records |
| Auth | Therapist token |

Allowed:

- Create slots
- Edit slots
- Delete unbooked slots
- Mark slots as unavailable after booking
- Validate time ranges
- Prevent overlaps

Forbidden:

- Delete confirmed appointments silently
- Create slots for another therapist
- Create invalid or past slots
- Create overlapping slots unless explicitly supported

Recommended slot model:

```ts
type AppointmentSlot = {
  id: string;
  therapistId: string;
  startsAt: string;
  endsAt: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
};
```

---

### 4.7 Notification Agent

**Purpose:** Notify patients and therapists about appointment-related events.

| Field | Description |
|---|---|
| Inputs | Booking status changes, slot updates, admin decisions |
| Outputs | In-app notification entries, optional email later |
| State | Notification records |
| Auth | Patient or therapist token |

Allowed notification events:

- Booking requested
- Booking confirmed
- Booking rejected
- Booking cancelled
- Appointment changed
- Appointment reminder
- Therapist profile approved/rejected
- Required profile changes

Forbidden:

- Marketing notifications without explicit consent
- Medical advice
- Payment or review prompts in MVP
- Notifications revealing patient information to unrelated users

Implementation rule:

Notifications must be created from backend state changes, not only from UI assumptions.

---

### 4.8 Profile Agent

**Purpose:** Display and manage public provider profile data.

| Field | Description |
|---|---|
| Inputs | Therapist profile fields, photo, services, languages, contact data, visibility |
| Outputs | Public provider profile for approved therapists |
| State | Therapist profile record, media references |
| Auth | Therapist token for own profile; public read for approved profile |

Allowed public fields:

- Name
- Photo
- Professional title
- City/service area
- Specializations
- Languages
- Kassenart
- Home visit availability
- Contact options
- Availability/booking entry point
- Verification status

Forbidden public fields:

- Private admin notes
- Internal review comments
- Patient data
- Unverified claims
- Unapproved profile content

Ranking signals may include:

- Specialization match
- Distance
- Language match
- Kassenart match
- Home visit
- Profile completeness
- Verified status
- Availability

Do not rank by payments or reviews in MVP.

---

### 4.9 Verification and Moderation Agent

**Purpose:** Ensure that freelance therapists are legitimate and profiles are safe to publish.

| Field | Description |
|---|---|
| Inputs | Submitted therapist profiles, documents if added later, public claims |
| Outputs | Review status changes |
| State | Review status, admin notes, profile visibility |
| Auth | Admin token |

Allowed:

- Approve profiles
- Reject profiles
- Request changes
- Suspend profiles
- Review profile photo and content
- Check whether therapist appears to be a legitimate freelance professional

Forbidden:

- Auto-approve production providers
- Fabricate credentials
- Strengthen or rewrite professional claims without evidence
- Publish non-approved profiles
- Approve unclear profiles silently

Recommended statuses:

```ts
type ReviewStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "SUSPENDED";
```

---

### 4.10 Upload Service

**Purpose:** Handle profile photo uploads and future document uploads if explicitly added.

| Field | Description |
|---|---|
| Inputs | Multipart image file |
| Outputs | File URL |
| State | Local file in dev or cloud object in production |
| Auth | Therapist token for profile photo |

Allowed:

- JPEG, PNG, WebP profile images
- Max file size limit
- Randomized file names
- Store URL in therapist profile

Forbidden:

- Public access to private documents
- Uploading patient medical files in MVP
- Executable files
- Overwriting another user's media

Production rule:

Local filesystem uploads are acceptable only for local development. Production should use object storage such as S3-compatible storage with access controls.

---

### 4.11 Geocoding Service

**Purpose:** Convert provider location or service area into coordinates for map/radius search.

| Field | Description |
|---|---|
| Inputs | Address/city/service area |
| Outputs | Latitude/longitude or null |
| State | Coordinates on provider/location record |
| Auth | Backend-only service call |

Allowed:

- Geocode provider service locations
- Retry failed geocoding manually
- Mark missing geocoding clearly

Forbidden:

- Store patient location trails
- Use patient location for background tracking
- Block therapist registration only because geocoding temporarily fails, unless location is required for listing

If using Nominatim/OpenStreetMap, respect provider rate limits.

---

## 5. Data Model — Target MVP

The exact Prisma schema must be checked in `apps/api/prisma/schema.prisma`.

Target MVP entities:

```txt
User
├── PatientProfile
├── TherapistProfile
├── Session / AuthToken
├── Favorite
├── AppointmentSlot
├── Booking / Appointment
└── Notification
```

If the current schema separates `Patient`, `Therapist`, and auth fields differently, do not add another duplicate auth structure without a migration plan.

### Recommended single-source auth model

Prefer one auth source:

```ts
type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: "PATIENT" | "THERAPIST" | "ADMIN";
  sessionToken?: string;
  sessionExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

If the current system uses `sessionToken` directly on `Therapist`, keep compatibility temporarily, but plan migration toward a single auth source.

### PatientProfile

```ts
type PatientProfile = {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};
```

### TherapistProfile

```ts
type TherapistProfile = {
  id: string;
  userId: string;
  name: string;
  title?: string;
  photo?: string;
  city?: string;
  serviceArea?: string;
  lat?: number;
  lng?: number;
  specializations: string[];
  languages: string[];
  kassenart?: string[];
  homeVisit?: boolean;
  isFreelance: true;
  isVisible: boolean;
  reviewStatus: ReviewStatus;
  description?: string;
  phone?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
};
```

MVP rule:

`isFreelance` must be true for public self-registered provider accounts.

### Booking / Appointment

```ts
type Booking = {
  id: string;
  patientId: string;
  therapistId: string;
  slotId?: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  patientNote?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
};
```

Privacy rule:

`patientNote` should be optional and minimal. Do not request diagnosis or medical history in MVP booking.

### Favorite

```ts
type Favorite = {
  id: string;
  patientId: string;
  therapistId: string;
  createdAt: string;
};
```

### Notification

```ts
type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  bookingId?: string;
  readAt?: string;
  createdAt: string;
};
```

---

## 6. API Architecture

Always verify actual registration in `apps/api/src/app.ts`.

Expected MVP route groups:

| Area | Example prefix | Auth | Purpose |
|---|---|---|---|
| Health | `/health` | None | Health check |
| Config | `/config` | None | App config, if used |
| Search | `/search`, `/suggestions` | None | Public therapist discovery |
| Patient Auth | `/auth/patient/*` or `/patient-auth/*` | None / Patient | Patient registration/login/me |
| Therapist Auth | `/auth/therapist/*` or `/therapist-auth/*` | None / Therapist | Freelance therapist registration/login/me |
| Profile | `/profile/*` or `/therapists/*` | Public / Therapist | Public and own provider profile |
| Availability | `/slots/*` or `/availability/*` | Therapist | Slot management |
| Booking | `/booking/*` or `/appointments/*` | Patient / Therapist | Booking and appointment workflow |
| Favorites | `/favorites/*` | Patient | Save therapists |
| Notifications | `/notifications/*` | Patient / Therapist | Appointment-related notifications |
| Upload | `/upload/photo` | Therapist | Profile photo upload |
| Admin | `/admin/*` | Admin | Verification and moderation |

### Route inventory rule

Before implementing or modifying a route:

1. Open `apps/api/src/app.ts`.
2. Confirm the route file is imported.
3. Confirm the route is registered with the expected prefix.
4. Confirm auth middleware is applied.
5. Confirm frontend calls match the same prefix.
6. Confirm tests exist or add tests.

### Forbidden API additions

Do not add these route groups in MVP:

```txt
/payments
/reviews
/medical-records
/diagnosis
/treatment-plans
/practice-manager/self-register
```

---

## 7. Auth and Security

### Current risk

Session-token auth may exist. Planned JWT/Auth-V2 code may also exist. Avoid creating a third auth system.

### Short-term rule

If session-token auth is active, harden it:

- Add expiration if missing
- Invalidate token on logout
- Regenerate token after login
- Store only hashed passwords
- Avoid exposing tokens in logs
- Validate role for every protected route

### Role checks

Every protected route must verify role:

```txt
Patient routes      -> PATIENT only
Therapist routes    -> THERAPIST only
Admin routes        -> ADMIN only
Public search       -> no auth, but only approved visible therapists
```

### Booking security checklist

For every booking mutation:

- Patient is authenticated
- Therapist exists
- Therapist is approved
- Therapist is visible/active
- Therapist is freelance
- Slot exists
- Slot belongs to therapist
- Slot is available
- Slot is not in the past
- Slot is not already booked
- Status transition is valid
- Notification is created after successful state change

---

## 8. Mobile App Architecture

### Current principle

The mobile app must support two logged-in roles:

1. Patient
2. Freelance therapist

The app may also support a visitor state for public search.

### Language rule

The mobile app is German-only in the MVP.

Allowed:

- German UI copy
- German validation and status messages
- German onboarding, booking, profile, and settings flows

Forbidden:

- A bilingual German/English app UI in MVP
- An in-app language switcher for the app interface
- Maintaining parallel English UI copy for mobile MVP screens

Important:

This rule applies to the app interface language, not to therapist profile languages or patient-facing language filters. Therapist languages as profile/search data remain part of the MVP.

### Expected main tabs

The exact labels can differ, but the information architecture should remain clear.

#### Visitor

- Search / Entdecken
- Login / Registrieren
- Options

#### Patient

- Search / Entdecken
- Favorites
- Appointments / Termine
- Profile
- Options

#### Freelance Therapist

- Dashboard / Termine
- Availability / Slots
- Profile
- Notifications
- Options

Avoid using one tab such as “Therapie” for too many meanings. If the tab contains booking status, call it “Termine” or similar.

### Key mobile flows

1. Visitor searches for therapist.
2. Visitor opens therapist profile.
3. Visitor is asked to register/login before booking.
4. Patient registers or logs in.
5. Patient books or requests a slot.
6. Patient sees booking status.
7. Patient receives notification.
8. Freelance therapist registers.
9. Freelance therapist completes profile.
10. Admin approves therapist.
11. Therapist creates appointment slots.
12. Therapist confirms/rejects/manages bookings.

### Legacy refactor rule

If the app still uses a large legacy component, do not continue adding large new state blocks there.

Preferred extraction order:

1. `apiClient`
2. `authSession`
3. `patientService`
4. `therapistService`
5. `bookingService`
6. `availabilityService`
7. `favoritesService`
8. `notificationService`
9. screen-level components
10. route/navigation composition

---

## 9. Admin Dashboard

Admin is required because trust and manual verification are part of the product.

Expected admin functions:

- View pending freelance therapists
- Approve/reject/request changes
- Suspend therapist
- Review profile content
- View basic booking support context if required
- Review system notifications/logs if implemented

Not MVP admin functions:

- Payment management
- Review moderation
- Practice owner management
- Medical record access
- Insurance billing

Admin route group rule:

If using Next.js App Router, avoid route conflicts. Keep admin pages inside the intended route group and verify actual structure before creating new pages.

---

## 10. Privacy and Data Minimization

Revio handles appointment data. Even without medical records, appointment context can be sensitive.

### Required principles

- Collect only what is required.
- Avoid medical free-text unless absolutely necessary.
- Keep patient search anonymous until registration is needed for booking.
- Restrict patient contact data to valid booking context.
- Do not show patient details publicly.
- Do not store diagnosis or treatment plans.
- Do not use booking data for reviews or ranking.
- Do not add tracking beyond what is necessary for app function.

### Booking form rule

The booking form should ask for minimal operational data.

Allowed:

- name
- email from account
- phone if required
- selected appointment
- short optional note

Avoid:

- diagnosis
- medical history
- uploaded reports
- insurance documents
- detailed symptoms
- pain drawings
- treatment goals

---

## 11. Testing Requirements

### API tests

Minimum test coverage for Booking-MVP:

- patient registration
- patient login
- freelance therapist registration
- reject non-freelance therapist registration
- therapist profile update
- admin therapist approval
- public search shows only approved visible therapists
- create appointment slot
- prevent overlapping slots
- patient booking
- prevent double-booking
- therapist confirms booking
- therapist rejects booking
- patient cancels booking
- notification created after booking event
- patient cannot access another patient booking
- therapist cannot access another therapist booking
- payments routes do not exist
- reviews routes do not exist

### Mobile tests / manual QA

Minimum manual QA flows:

- visitor can search without account
- visitor must login/register before booking
- patient can register
- patient can book slot
- patient can see appointment status
- patient can save favorite
- freelance therapist can register
- therapist cannot publish without approval
- therapist can create slot
- therapist can manage booking request
- dark mode remains readable
- empty states are clear
- no payment/review UI appears

---

## 12. Run Commands

Verify these commands against the current repository.

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start API
pnpm dev:api

# Start Admin
pnpm dev:admin

# Start Mobile
pnpm dev:mobile

# Run tests
pnpm test

# Typecheck
pnpm typecheck
```

If `pnpm` is not available, check the `packageManager` field in root `package.json`.

---

## 13. Environment Variables

Verify exact names in `apps/api/src/env.ts`.

Expected variables may include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Database connection |
| `REVIO_ADMIN_TOKEN` | Admin API auth |
| `PORT` | API port |
| `EXPO_PUBLIC_API_URL` | Mobile API URL |
| `INTERNAL_API_URL` | Admin/server-side API URL |
| `NEXT_PUBLIC_API_URL` | Browser API URL for admin/site |
| `RESEND_API_KEY` | Email provider, if email is enabled |

Never hardcode secrets in source code.

---

## 14. Code Style and Implementation Rules

### General

- Prefer small services over large screen-level logic.
- Keep shared DTO types in `packages/shared` where practical.
- Use Zod validation on API input.
- Keep role-based auth explicit.
- Keep booking logic backend-owned.
- Keep UI derived from backend state.
- Add tests for every booking status transition.

### Backend

- Validate request bodies.
- Validate auth role.
- Validate ownership.
- Use transactions for booking mutations.
- Use database constraints for unique booking/slot rules if possible.
- Do not rely only on frontend checks.

### Mobile

- Avoid duplicate mapping logic.
- Avoid duplicating therapist field transformation across list, profile, and booking.
- Keep API calls in services.
- Keep UI components role-specific where needed.
- Make empty states clear.

### Admin

- Keep verification actions explicit.
- Show enough information for review, but avoid unnecessary patient data exposure.
- Log or track review decisions where possible.

---

## 15. File Cleanup Rules

Do not delete files only because they are not currently imported.

Classify files first:

```txt
ACTIVE            Used by current app/API/admin.
PLANNED           Intended for Booking-MVP but not wired yet.
MIGRATION_SCAFFOLD New architecture scaffold, not active yet.
LEGACY            Old implementation still needed for compatibility.
DEPRECATED        Safe to remove after verification.
UNKNOWN           Needs manual inspection.
```

Before deletion:

1. Search imports.
2. Check route registration.
3. Check package scripts.
4. Check tests.
5. Check mobile entry file.
6. Check admin routes.
7. Confirm feature scope.
8. Move to archive or delete only after clear decision.

---

## 16. MVP Roadmap

### A1 — Scope lock

Booking, patient accounts, appointments, slots, favorites, and notifications are core MVP.

Payments and reviews are excluded.

### A2 — Route inventory

Create a table of every backend route file:

```txt
file | registered? | prefix | auth | used by frontend? | keep/remove/plan
```

### A3 — Data model alignment

Unify or clearly separate:

- User
- PatientProfile
- TherapistProfile
- Session/Auth
- AppointmentSlot
- Booking
- Notification
- Favorite

Avoid duplicate auth fields and duplicate profile models.

### A4 — Booking safety

Implement or verify:

- no double-booking
- valid slot ownership
- status transitions
- patient/therapist role checks
- notification creation
- cancellation behavior

### A5 — Legacy mobile extraction

Extract services first, then screens.

Suggested service order:

1. API client
2. Auth
3. Search
4. Booking
5. Availability
6. Notifications
7. Favorites
8. Profile

### A6 — UI simplification

Clarify role-specific navigation:

- Patient: Search, Favorites, Termine, Profil, Optionen
- Therapist: Termine, Slots, Profil, Benachrichtigungen, Optionen

Remove or hide payments/reviews UI if present.

---

## 17. Definition of Done for Booking-MVP

The MVP is ready when:

- Patients can register and log in.
- Freelance therapists can register and log in.
- Non-freelance provider self-registration is blocked or not offered.
- Admin can approve therapist profiles.
- Public search shows approved visible therapists.
- Patients can view therapist profiles.
- Therapists can create available slots.
- Patients can book or request available slots.
- Double-booking is impossible.
- Patients can see appointment status.
- Therapists can manage booking requests.
- Notifications are created for relevant booking events.
- Payments are absent.
- Reviews are absent.
- Medical records are absent.
- Basic privacy and consent copy exists.
- Main API flows have tests.
- Main mobile flows pass manual QA.

---

## 18. Current Non-Negotiables

1. Revio is Booking-MVP, not Discovery-only.
2. Patients can register.
3. Patients can book appointments.
4. Only freelance therapists can self-register as providers.
5. No payments in MVP.
6. No reviews in MVP.
7. No medical records in MVP.
8. No AI diagnosis or AI treatment plans in MVP.
9. Public provider profiles require approval.
10. Booking logic must be protected against double-booking.
11. Patient data must stay minimal and access-controlled.
12. Do not add large new logic to legacy mobile code without extraction plan.
13. The mobile app UI is German-only in the MVP.
14. Do not use emojis anywhere in the app UI.

---

## 19. Suggested First Ticket

Title:

```txt
Freeze Booking-MVP architecture and align active routes
```

Tasks:

1. Confirm current mobile entry file and active screens.
2. Confirm registered API routes in `apps/api/src/app.ts`.
3. Create route inventory.
4. Confirm active Prisma models.
5. Decide final route names for patient auth, therapist auth, booking, slots, favorites, notifications.
6. Remove or hide payments/reviews UI if present.
7. Add tests for patient registration and booking.
8. Add tests that payments/reviews routes do not exist.
9. Update `docs/product.md`, `docs/data-model.md`, and `docs/search-ranking.md` to match this scope.
10. Keep this `CLAUDE.md` in sync after each architectural decision.
