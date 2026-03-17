# Revio — Data Model

This document defines all data entities, their fields, relationships, and storage rules.

Source of truth: `apps/api/prisma/schema.prisma` + `packages/shared/src/index.ts`

---

## 1. Status Enums

### ReviewStatus
Applies to Therapist and Practice.

```
DRAFT → PENDING_REVIEW → APPROVED
                       → REJECTED
                       → CHANGES_REQUESTED
                       → SUSPENDED (previously approved, now hidden)
```

| Status | Publicly Visible | Notes |
|--------|:---:|-------|
| `DRAFT` | ❌ | Profile being created |
| `PENDING_REVIEW` | ❌ | Submitted, awaiting admin action |
| `APPROVED` | ✅ | Only status shown publicly |
| `REJECTED` | ❌ | Therapist notified |
| `CHANGES_REQUESTED` | ❌ | Returned to therapist with notes |
| `SUSPENDED` | ❌ | Previously approved, hidden pending investigation |

### LinkStatus
Applies to TherapistPracticeLink.

```
PROPOSED → CONFIRMED
         → DISPUTED
         → REJECTED
```

Disputed links must **never** be shown publicly until resolved.

---

## 2. Therapist

The core professional profile entity.

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `id` | cuid | ✅ | Primary key |
| `email` | string | ✅ | Unique, used for login |
| `fullName` | string | ✅ | Display name |
| `professionalTitle` | string | ✅ | e.g. "Physiotherapeut/in" |
| `city` | string | ✅ | Service area |
| `bio` | string | ❌ | Professional description |
| `homeVisit` | boolean | ✅ | Default: false |
| `specializations` | string | ✅ | Comma-separated (see Storage Rules) |
| `languages` | string | ✅ | Comma-separated |
| `certifications` | string | ✅ | Comma-separated, default: "" |
| `kassenart` | string | ✅ | "Alle Kassen", "Nur Privat", etc. Default: "" |
| `availability` | string | ✅ | Free-text availability info. Default: "" |
| `isVisible` | boolean | ✅ | Therapist can hide from search. Default: true |
| `reviewStatus` | ReviewStatus | ✅ | Default: PENDING_REVIEW |
| `passwordHash` | string | ❌ | bcrypt hash |
| `sessionToken` | string | ❌ | Unique, for Bearer auth |
| `photo` | string | ❌ | URL path e.g. `/uploads/<uuid>.jpg` |
| `createdAt` | DateTime | ✅ | Auto |
| `updatedAt` | DateTime | ✅ | Auto |

**Relationships:**
- `links` → TherapistPracticeLink[] (many-to-many with Practice)
- `adminOfPractice` → Practice? (one-to-one: therapist can be admin of one practice)

### Allowed Public Fields
- Full name, photo, professional title, specializations, education/training, languages, associated practices, bio, home visit, city, kassenart, availability

### Not Allowed Publicly
- Patient testimonials without moderation, unverified medical claims, before/after cases, patient photos, treatment success claims

---

## 3. Practice

A clinic or business location.

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `id` | cuid | ✅ | Primary key |
| `name` | string | ✅ | Practice name |
| `city` | string | ✅ | Location city |
| `address` | string | ❌ | Street address |
| `phone` | string | ❌ | Contact phone |
| `hours` | string | ❌ | Opening hours |
| `lat` | float | ✅ | Geocoded latitude. Default: 0 (= not geocoded) |
| `lng` | float | ✅ | Geocoded longitude. Default: 0 |
| `reviewStatus` | ReviewStatus | ✅ | Default: PENDING_REVIEW |
| `adminEmail` | string | ❌ | Unique, practice admin login |
| `adminPasswordHash` | string | ❌ | Practice admin auth |
| `adminSessionToken` | string | ❌ | Unique |
| `adminTherapistId` | string | ❌ | Unique, FK to Therapist |
| `description` | string | ❌ | Practice description |
| `inviteToken` | string | ❌ | Unique, for invite links |
| `logo` | string | ❌ | Logo URL |
| `photos` | string | ❌ | JSON array of photo URLs |
| `createdAt` | DateTime | ✅ | Auto |
| `updatedAt` | DateTime | ✅ | Auto |

**Relationships:**
- `links` → TherapistPracticeLink[] (many-to-many with Therapist)
- `adminTherapist` → Therapist? (one-to-one)

### Geocoding
- Address + city are geocoded via Nominatim (OpenStreetMap) at creation and on address/city update
- `lat=0, lng=0` means "not geocoded yet"
- Admin endpoint `POST /admin/practices/geocode-all` batch-geocodes all practices with lat=0
- Nominatim rate limit: max 1 req/sec (1.1s delay between batch requests)
- For production: replace with Google Geocoding API

### Allowed Public Fields
- Name, logo, address, city, map location, opening hours, phone, website, photos, associated therapists

### Not Allowed Publicly
- Patient photos, patient-specific stories, misleading certifications, false location claims

---

## 4. TherapistPracticeLink

Many-to-many relationship between therapists and practices with a status lifecycle.

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `id` | cuid | ✅ | Primary key |
| `therapistId` | string | ✅ | FK to Therapist |
| `practiceId` | string | ✅ | FK to Practice |
| `status` | LinkStatus | ✅ | Default: PROPOSED |
| `initiatedBy` | string | ✅ | "THERAPIST" or "ADMIN". Default: "THERAPIST" |
| `createdAt` | DateTime | ✅ | Auto |

**Constraints:**
- `@@unique([therapistId, practiceId])` — one link per therapist-practice pair
- Cascade delete on both therapist and practice

### Dispute Rules
Flag for manual admin review when:
- Multiple therapists submit conflicting ownership claims for the same practice
- A practice address cannot be geocoded or validated
- A therapist's claimed practice has no verifiable public record

---

## 5. SearchSuggestion

Autocomplete entries populated from seed/admin data.

| Field | Type | Required | Notes |
|-------|------|:---:|-------|
| `id` | cuid | ✅ | Primary key |
| `text` | string | ✅ | Display text |
| `normalized` | string | ✅ | Normalized for matching (indexed) |
| `type` | SuggestionType | ✅ | THERAPIST_NAME, PRACTICE_NAME, SPECIALTY, CITY |
| `entityId` | string | ❌ | FK to related entity |
| `weight` | int | ✅ | Default: 1, higher = more relevant |

---

## 6. Storage Rules

### Comma-Separated String Fields
The following fields are stored as **comma-separated strings** in SQLite but exposed as **string arrays** in the API and TypeScript types:
- `specializations`
- `languages`
- `certifications`
- `kassenart` (single value, but follows same pattern)

**Write:** `array.join(', ')` before Prisma create/update
**Read:** `value.split(',').map(s => s.trim()).filter(Boolean)` in route handlers

### Photo Storage
- Photos uploaded via `POST /upload/photo` (multipart/form-data)
- Saved to filesystem: `apps/api/uploads/<uuid>.<ext>`
- DB stores only the URL path: `/uploads/<uuid>.jpg`
- Served statically via `@fastify/static` at `/uploads/`
- Allowed types: JPEG, PNG, WebP. Max 5MB.
- For production: swap filesystem write for S3 `putObject`

### Practice Photos
- `photos` field is a JSON-serialized string array: `'["/uploads/a.jpg", "/uploads/b.jpg"]'`
- Parse with `JSON.parse()`, handle parse errors gracefully

---

## 7. Data the MVP Should NOT Collect

**Patient side:**
- Patient accounts
- Diagnosis records
- Health histories
- Insurance details
- Date of birth
- Treatment history
- Symptom journals
- Medical documents
- Patient images of any kind

**Search data:**
- Search queries must not be persisted in a user-specific way
- If analytics are needed, aggregate and anonymize before storage
