# CLAUDE.md — Revio Technical Reference

> This file is the coding agent's primary reference. For product context, design, data model, and search logic, see the `docs/` folder.
>
> | Document | Purpose |
> |----------|---------|
> | [`docs/product.md`](docs/product.md) | Purpose, MVP scope, user roles, non-goals, success criteria |
> | [`docs/data-model.md`](docs/data-model.md) | Entities, fields, relationships, storage rules |
> | [`docs/search-ranking.md`](docs/search-ranking.md) | Query processing, scoring, filters, suggestions |
> | [`docs/design-system.md`](docs/design-system.md) | Brand, colors, typography, components, icons, splash |

---

## 1. System Agents & Modules

Revio uses logical "agents" — system modules with defined responsibilities. In MVP, agents are **deterministic product components**, not AI models.

### 1.1 Search & Matching Agent

**Purpose:** Transform a patient search request into a relevant, ranked result set.

**Implementation:** `apps/api/src/routes/search.ts` + `src/utils/search-utils.ts`

| | |
|---|---|
| **Inputs** | Problem query (free text), city, optional filters (language, homeVisit, specialization, kassenart) |
| **Outputs** | Ranked `SearchTherapist[]` + deduplicated `SearchPractice[]` with lat/lng |
| **State** | Stateless — no query persistence |
| **Auth** | None (public endpoint) |

**Allowed:** Normalize text, map to specialization taxonomy, apply filters, score relevance, rank results, return structured data.

**Forbidden:** Diagnose conditions, infer medical urgency, store patient profiles, generate treatment plans, reward keyword stuffing.

**Failure cases:**
- Empty query → Zod validation rejects (400)
- No matching city → empty results (not an error)
- Malformed filters → Zod rejects

**Human review:** None per-query. Taxonomy and ranking logic reviewed periodically.

---

### 1.2 Map Agent

**Purpose:** Render location-based display of practices and therapist-linked locations.

**Implementation:** Client-side (mobile app). Data from Search Agent.

| | |
|---|---|
| **Inputs** | Practice coordinates, search results, filter context |
| **Outputs** | Map markers, preview cards, viewport-adjusted results |
| **State** | Transient user-provided location (optional) |

**Allowed:** Render markers, cluster at high density, open preview cards, reflect filters.

**Forbidden:** Collect precise patient location without explicit action, store location trails, track in background.

**Failure cases:**
- `lat=0, lng=0` → practice not geocoded, skip or show warning
- Location permission denied → fall back to manual city entry

**Human review:** None. Practice locations validated before listing (by Verification Agent).

**Status:** Planned feature (Kartenansicht). Currently list-only.

---

### 1.3 Profile Agent

**Purpose:** Manage structure, display, and lifecycle of therapist and practice profiles.

**Implementation:** `apps/api/src/routes/auth.ts` (therapist profile), `src/routes/practice.ts` (practice profile), mobile `App.js` (rendering)

| | |
|---|---|
| **Inputs** | Profile fields, media uploads, linked entities, verification status |
| **Outputs** | Public profile pages (approved only), draft profiles (for therapist) |
| **State** | Therapist record, Practice record, media assets |
| **Auth** | Bearer token (therapist) |

**Allowed:** Create draft profiles, update fields, connect to practice via Linking Agent, render after approval, track completeness for ranking.

**Forbidden:** Auto-publish unverified profiles, rewrite claims into stronger promises, create fake associations, display non-approved profiles publicly.

**Failure cases:**
- Missing required fields → Zod validation rejects
- Photo upload fails → error returned, photo field unchanged
- Session token invalid → 401

**Human review:** Yes. Public status depends on manual admin approval.

---

### 1.4 Registration Agent

**Purpose:** Handle therapist sign-up and draft account creation.

**Implementation:** `apps/api/src/routes/register.ts`, mobile `App.js` (5-step wizard)

| | |
|---|---|
| **Inputs** | Email, password, personal info, languages, practice choice |
| **Outputs** | Therapist record, draft profile, link entry, session token |
| **State** | New Therapist row + optional Practice + TherapistPracticeLink |
| **Auth** | None (public registration) |

**Registration Steps (Mobile):**
1. Email + Password
2. Personal Info (name, title, city, specializations)
3. Languages
4. Practice (new / existing / skip)
5. Preview + Submit

**Allowed:** Create draft account, hash password, create practice, propose link, return session token.

**Forbidden:** Auto-approve professional legitimacy, publish before review, collect patient data.

**Failure cases:**
- Duplicate email → 409 Conflict
- Missing required fields → Zod validation rejects
- Geocoding fails → practice created with lat=0, lng=0 (best-effort)

**Special behavior:** In development (`NODE_ENV !== 'production'`), therapists are auto-approved.

**Human review:** Yes. Public listing requires manual approval.

---

### 1.5 Verification Agent

**Purpose:** Support internal trust workflows for reviewing therapist and practice legitimacy.

**Implementation:** `apps/api/src/routes/admin.ts`, admin dashboard `app/(admin)/`

| | |
|---|---|
| **Inputs** | Submitted profiles, practice data, admin decisions |
| **Outputs** | ReviewStatus updates, cascade approve (therapist → practices + links) |
| **State** | `reviewStatus` field on Therapist and Practice |
| **Auth** | Admin token (`REVIO_ADMIN_TOKEN`) |

**Review Checklist:**
- Therapist appears to be a legitimate professional
- Profile fields sufficiently complete
- No misleading or unverifiable medical claims
- Profile photo appropriate and professional
- Practice location real and geocodable
- Therapist-practice relationship plausible
- Logo and photos meet content standards

**Allowed:** Flag incomplete profiles, request edits, update review status, cascade approve.

**Forbidden:** Fabricate credentials, auto-approve without review, silently edit credentials, publish non-approved.

**Failure cases:**
- Therapist not found → 404
- Invalid status transition → should be validated (currently any transition allowed)

**Human review:** Inherently human-dependent. Exists to structure the reviewer's workflow.

---

### 1.6 Linking Agent

**Purpose:** Manage therapist↔practice relationships and protect against false claims.

**Implementation:** Registration flow (`register.ts`), practice routes (`practice.ts`), admin routes (`admin.ts`)

| | |
|---|---|
| **Inputs** | Therapist ID, Practice ID, link request, review state |
| **Outputs** | TherapistPracticeLink record with status lifecycle |
| **State** | `TherapistPracticeLink` rows |

**Status lifecycle:** `PROPOSED` → `CONFIRMED` / `DISPUTED` / `REJECTED`

**Allowed:** Propose links, track status, flag duplicates/conflicts, route disputed to admin.

**Forbidden:** Auto-confirm disputed ownership, merge profiles without admin review, display unconfirmed links publicly.

**Dispute triggers (flag for manual review):**
- Multiple therapists submit conflicting ownership claims for same practice
- Practice address cannot be geocoded or validated
- Claimed practice has no verifiable public record

**Failure cases:**
- Duplicate link → unique constraint violation (409)
- Practice not found → 404
- Cascade approve: link confirmation fails → logged, continues with other links

**Human review:** Yes. Disputed, ambiguous, or first-time claims require admin review.

---

### 1.7 Moderation Agent

**Purpose:** Ensure profiles, photos, logos, and descriptions meet platform content standards.

**Implementation:** Currently manual via admin dashboard. No automated moderation in MVP.

| | |
|---|---|
| **Inputs** | Profile text, photos, logos, moderation rules |
| **Outputs** | Content accepted / rejected / flagged |
| **State** | Implicit in ReviewStatus |

> **Relationship to Verification Agent:** Verification = professional legitimacy (is this a real physio?). Moderation = content quality (is this photo appropriate?). Same reviewer in MVP, but conceptually separate queues for future scaling.

**Allowed:** Flag suspicious content, reject policy violations, route borderline cases to admin.

**Forbidden:** Approve patient-identifiable imagery, allow deceptive claims, auto-approve without inspection.

**Human review:** Yes. Borderline cases require admin judgment.

---

### 1.8 Upload Service

**Purpose:** Handle file uploads for profile photos.

**Implementation:** `apps/api/src/routes/upload.ts`

| | |
|---|---|
| **Inputs** | Multipart form-data with image file |
| **Outputs** | `{ url: "/uploads/<uuid>.<ext>" }` + updates therapist.photo |
| **State** | File on disk (`apps/api/uploads/`), URL in therapist record |
| **Auth** | Bearer token (therapist) |

**Constraints:**
- Max file size: 5MB
- Allowed types: JPEG, PNG, WebP
- Files named with random UUID
- For production: swap `fs.createWriteStream` for S3 `putObject`

**Failure cases:**
- No file in request → 400
- Invalid file type → 400
- File too large → 413 (handled by `@fastify/multipart`)
- Disk write fails → 500

---

### 1.9 Geocoding Service

**Purpose:** Convert address + city to lat/lng coordinates.

**Implementation:** `apps/api/src/utils/geocode.ts`

| | |
|---|---|
| **Inputs** | Address string, city string |
| **Outputs** | `{ lat, lng }` or `null` |
| **Provider** | Nominatim (OpenStreetMap), no API key |

**Best-effort:** Returns null on failure, never throws. Practice created with lat=0, lng=0 if geocoding fails.

**Rate limit:** Nominatim allows max 1 req/sec. Batch endpoint (`POST /admin/practices/geocode-all`) uses 1.1s delay.

**For production:** Replace with Google Geocoding API.

**Called by:**
- `POST /register/therapist` — geocodes new practice
- `POST /practice` — geocodes new practice
- `PATCH /my/practice` — re-geocodes if address or city changed
- `POST /admin/practices/geocode-all` — batch geocodes all lat=0 practices

---

## 2. Monorepo Layout

```
Revio/
├── package.json                 # Root scripts (pnpm -r)
├── pnpm-workspace.yaml          # apps/* + packages/*
├── apps/
│   ├── api/                     # Fastify backend
│   │   ├── prisma/schema.prisma # DB schema (SQLite)
│   │   ├── prisma/seed.ts       # 100 therapists, 30 practices
│   │   ├── prisma/prisma/dev.db # ⚠️ Nested path! See DB section
│   │   ├── src/app.ts           # Fastify app builder
│   │   ├── src/server.ts        # Entry point
│   │   ├── src/env.ts           # Zod-validated env vars
│   │   ├── src/routes/          # admin, auth, health, practice, register, search, upload
│   │   ├── src/plugins/         # prisma, admin-auth
│   │   ├── src/utils/           # geocode.ts (Nominatim)
│   │   └── uploads/             # Photo uploads (gitignored)
│   ├── admin/                   # Next.js admin dashboard
│   │   └── app/(admin)/         # Route group — ALL pages live here
│   └── mobile/
│       └── src/App.js           # Single-file app (~3800 lines)
└── packages/
    └── shared/src/index.ts      # Shared TypeScript types
```

> **⚠️ Important:** There are legacy folders `AdminRevio/` and `revioApp/` at the root. These are **old copies** — ignore them. The active code is in `apps/`.

---

## 3. How to Run

### Prerequisites
- Node.js 20+
- pnpm 10.6.3 (declared in root `package.json` → `packageManager`)

### Environment Variables (API)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | SQLite path, e.g. `file:./prisma/prisma/dev.db` |
| `REVIO_ADMIN_TOKEN` | ✅ | — | Bearer token for admin endpoints |
| `PORT` | ❌ | `4000` | API port |
| `REVIO_ADMIN_EMAIL` | ❌ | `admin@revio.de` | Admin login email |
| `REVIO_ADMIN_PASSWORD` | ❌ | `admin123` | Admin login password |

### Start Commands

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database (100 therapists, 30 practices)
pnpm db:seed

# Start API only
cd apps/api
DATABASE_URL='file:./prisma/prisma/dev.db' REVIO_ADMIN_TOKEN='dev-admin-token' PORT=4000 npx tsx src/server.ts

# Start Admin (separate terminal)
pnpm dev:admin

# Start Mobile (separate terminal)
pnpm dev:mobile
```

### Test Account
- **Email:** `test@revio.de`
- **Password:** `password`

---

## 4. Database

- **ORM:** Prisma with SQLite (production will move to PostgreSQL)
- **DB file:** `apps/api/prisma/prisma/dev.db` (note the nested `prisma/prisma/` path)
- **Schema:** `apps/api/prisma/schema.prisma`
- **Full data model:** See [`docs/data-model.md`](docs/data-model.md)

### Key Models

| Model | Purpose |
|-------|---------|
| `Therapist` | Registered physiotherapists with profile, auth, review status |
| `Practice` | Physiotherapy practices with address, geocoded lat/lng |
| `TherapistPracticeLink` | Many-to-many: therapist ↔ practice (with status lifecycle) |
| `SearchSuggestion` | Autocomplete entries for search |

### Status Enums
- **ReviewStatus:** `DRAFT` → `PENDING_REVIEW` → `APPROVED` / `REJECTED` / `CHANGES_REQUESTED` / `SUSPENDED`
- **LinkStatus:** `PROPOSED` → `CONFIRMED` / `DISPUTED` / `REJECTED`

### Important Fields
- `specializations`, `languages`, `certifications`, `kassenart`, `availability` are stored as **comma-separated strings** in the DB, but exposed as **arrays** in the API/types.
- `lat`/`lng` on Practice: geocoded via Nominatim (OpenStreetMap). Default `0` means "not geocoded yet".
- `isVisible`: therapists can hide themselves from search results.
- `photo`: URL path like `/uploads/<uuid>.jpg` (served by `@fastify/static`).

---

## 5. API Architecture

### Route Files (`src/routes/`)

| File | Prefix | Auth | Purpose |
|------|--------|------|---------|
| `health.ts` | `/health` | None | Health check |
| `search.ts` | `/search`, `/suggestions` | None | Public search for patients |
| `register.ts` | `/register/therapist` | None | Therapist registration |
| `auth.ts` | `/auth/*` | Bearer token | Login, profile, PATCH /auth/me |
| `practice.ts` | `/practice`, `/my/practice` | Bearer token | Practice CRUD for therapists |
| `practice-auth.ts` | `/practice-auth/*` | Practice token | Practice-specific auth |
| `admin.ts` | `/admin/*` | Admin token | Review, approve, reject, manage |
| `upload.ts` | `/upload/photo` | Bearer token | Multipart photo upload |

### Plugins
- **`prisma.ts`** — Decorates Fastify with `app.prisma` (PrismaClient)
- **`admin-auth.ts`** — Decorates with `app.verifyAdmin` hook (checks `REVIO_ADMIN_TOKEN`)

### Key Patterns
- Auth: `request.headers.authorization` → `Bearer <sessionToken>` → lookup `Therapist` by `sessionToken`
- Admin: `Authorization: Bearer <REVIO_ADMIN_TOKEN>` (simple token, no JWT)
- Validation: Zod schemas inline in route handlers
- Geocoding: `src/utils/geocode.ts` calls Nominatim with 1s delay between requests

---

## 6. Admin Dashboard

- **Framework:** Next.js 15 with App Router
- **Route Group:** All pages under `app/(admin)/` — do NOT create pages at `app/` level (causes route conflicts)
- **Layout:** Sidebar navigation (`components/sidebar.tsx`) + Page Shell (`components/page-shell.tsx`)
- **API calls:** `lib/api.ts` fetches from `http://localhost:4000` with admin token
- **Server Actions:** `lib/actions.ts` for approve/reject/suspend

### Pages
| Route | File | Purpose |
|-------|------|---------|
| `/` | `(admin)/page.tsx` | Dashboard overview |
| `/therapists` | `(admin)/therapists/page.tsx` | Therapist list & review |
| `/practices` | `(admin)/practices/page.tsx` | Practice list & review |
| `/links` | `(admin)/links/page.tsx` | Therapist↔Practice links |
| `/profiles` | `(admin)/profiles/page.tsx` | Detailed profile view |
| `/login` | `login/page.tsx` | Admin login (outside route group) |

---

## 7. Mobile App

- **Framework:** Expo 51 / React Native
- **Structure:** Single file `src/App.js` (~3800 lines) — all screens, navigation, state in one file
- **Navigation:** Custom bottom tab bar (Entdecken, Favoriten, Profil, Optionen)
- **Auth:** AsyncStorage for session token persistence
- **Icons:** `Ionicons` from `@expo/vector-icons`
- **API URL:** `EXPO_PUBLIC_API_URL` env var, falls back to `http://localhost:4000`

### Key Flows
1. **Search:** Patient searches by name/city/specialization → API `/search` → result list
2. **Registration:** 5-step wizard: Email+Password → Personal Info → Languages → Practice (new/existing/skip) → Preview+Submit
3. **Profile Edit:** Logged-in therapist edits bio, specializations, languages, kassenart, availability, homeVisit, isVisible
4. **Photo Upload:** `expo-image-picker` → FormData → `POST /upload/photo` → URL stored in DB

---

## 8. Testing

```bash
# Run all tests
pnpm test

# Run API tests only
cd apps/api && pnpm test

# TypeScript check all packages
pnpm typecheck
```

- **Test framework:** Vitest
- **Test file:** `apps/api/test/app.test.ts` (33 tests)
- **Setup:** `apps/api/test/setup.ts` — creates test DB, runs migrations
- **Test DB:** `apps/api/prisma/prisma/test.db`

---

## 9. Common Pitfalls

1. **DB path is nested:** `prisma/prisma/dev.db` — the `DATABASE_URL` must be `file:./prisma/prisma/dev.db` (relative to `apps/api/`)
2. **Admin routing:** Never create `page.tsx` files directly in `apps/admin/app/` — use the `(admin)` route group
3. **pnpm not in PATH:** If `pnpm` command fails, the binary is at `/Users/vucenovic/Library/pnpm/.tools/pnpm/10.6.3_tmp_7687_0/bin/pnpm`
4. **workspace:* protocol:** Don't use `npm install` — it can't resolve `workspace:*`. Always use `pnpm`.
5. **Mobile is a single file:** `App.js` is ~3800 lines. Use grep/search to find specific sections rather than reading the whole file.
6. **Comma-separated fields:** `specializations`, `languages` etc. are stored as comma-separated strings in SQLite. The API splits/joins them. Don't store arrays directly.
7. **Auto-approve in dev:** `register.ts` auto-approves therapists in development mode (`NODE_ENV !== 'production'`).
8. **Geocoding rate limit:** Nominatim allows max 1 request/second. The `geocode-all` admin endpoint adds 1.1s delays between requests.

---

## 10. Code Style

- **TypeScript** for API and Admin, **JavaScript** for Mobile (App.js)
- **ES Modules** (`"type": "module"` in API package.json)
- **Zod** for all API input validation (inline schemas in route handlers)
- **No ORM abstraction layer** — Prisma calls directly in route handlers
- **Functional components** with hooks in React/React Native
- **Dark/Light theme** support in Mobile via `useColorScheme()` + custom color map

---

## 11. Current Roadmap

See `todo.md` for the full list. Key remaining items:
- [ ] Nachweis-Upload (optional certificate upload)
- [ ] Kartenansicht (Google Maps / Apple Maps integration)
- [ ] Push-Benachrichtigungen (Expo push notifications)
- [ ] E-Mail-Benachrichtigungen (admin actions → email to therapist)
- [ ] PostgreSQL migration (replace SQLite for production)
- [ ] Production deployment (Docker + Railway/Render/Vercel/EAS)

Future agents (post-MVP) are documented in [`docs/product.md`](docs/product.md) § 10.

---

## 12. Related Documents

| Document | Purpose |
|----------|---------|
| [`docs/product.md`](docs/product.md) | Purpose, MVP scope, user roles, non-goals, workflows, success criteria |
| [`docs/data-model.md`](docs/data-model.md) | All entities, fields, relationships, storage rules |
| [`docs/search-ranking.md`](docs/search-ranking.md) | Query processing, scoring tiers, filters, suggestions, map interaction |
| [`docs/design-system.md`](docs/design-system.md) | Brand, colors, typography, components, icons, splash screen |
| [`todo.md`](todo.md) | Current roadmap and completed items |
| [`structure.md`](structure.md) | Detailed project structure and development phases |
| [`revioApp/agents.md`](revioApp/agents.md) | Original full agent specification (superseded by docs/) |
