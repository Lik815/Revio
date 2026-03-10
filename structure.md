# Revio — Project Structure & Development Phases

## Overview

Revio is a platform for finding and managing physiotherapists in Germany. It consists of three applications sharing a unified backend, organized as a **pnpm monorepo**.

- **Mobile** — Expo/React Native app for patients to search therapists and for therapists to register
- **Admin** — Next.js 15 dashboard for moderators to review and approve submissions
- **API** — Fastify 5 backend serving both mobile and admin, with a single SQLite database via Prisma

---

## Monorepo Structure

```
Revio/
├── package.json                  # Root workspace config, shared dev scripts
├── pnpm-workspace.yaml           # Declares apps/* and packages/* as workspaces
│
├── apps/
│   ├── api/                      # @revio/api — Fastify backend
│   ├── admin/                    # @revio/admin — Next.js admin dashboard
│   └── mobile/                   # @revio/mobile — Expo React Native app
│
└── packages/
    └── shared/                   # @revio/shared — Shared TypeScript types
```

### Root `package.json` scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Starts all apps in parallel |
| `pnpm dev:api` | API only (port 4000) |
| `pnpm dev:admin` | Admin only (port 3000) |
| `pnpm dev:mobile` | Mobile Expo dev server |
| `pnpm build` | Builds all apps |
| `pnpm test` | Runs all test suites |
| `pnpm db:migrate` | Runs Prisma migrations |
| `pnpm db:seed` | Seeds the dev database |

---

## `packages/shared` — Shared Types

**Package name:** `@revio/shared`
**File:** `packages/shared/src/index.ts`

Single source of truth for all TypeScript types shared between API and admin. Both apps import from `@revio/shared` via the workspace protocol.

### Status Enums

```typescript
type ReviewStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'SUSPENDED';
type LinkStatus   = 'PROPOSED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED';
```

### Core Entities

| Type | Fields |
|------|--------|
| `Therapist` | id, email, fullName, professionalTitle, city, bio?, homeVisit, specializations[], languages[], certifications[], reviewStatus, createdAt |
| `Practice` | id, name, city, address?, phone?, lat, lng, reviewStatus, createdAt |
| `TherapistPracticeLink` | id, therapistId, practiceId, status, createdAt |

### Composite Types

| Type | Purpose |
|------|---------|
| `TherapistWithLinks` | `Therapist` + `links[]` with embedded `Practice` — used in admin list views |
| `PracticeWithLinks` | `Practice` + `links[]` with embedded therapist summary |
| `LinkWithEntities` | Link + therapist summary + practice summary — used in links admin view |
| `SearchTherapist` | Therapist fields for search results + `practices[]` + `relevance` score |
| `SearchPractice` | Slim practice shape for map pins (id, name, city, lat, lng) |
| `SearchInput` | query, city, language?, homeVisit?, specialization? |
| `SearchResponse` | therapists[], practices[], meta |
| `TherapistRegistrationInput` | All fields for registration form + nested `practice` object |
| `AdminStats` | Counts grouped by status for therapists, practices, and links |

---

## `apps/api` — Fastify Backend

**Package name:** `@revio/api`
**Port:** `4000`
**Runtime:** Node.js ESM (`"type": "module"`)
**Stack:** Fastify 5, Prisma 6, Zod, SQLite

### Directory Structure

```
apps/api/
├── src/
│   ├── server.ts               # Entry point — reads env, starts Fastify
│   ├── app.ts                  # buildApp() — registers plugins + routes
│   ├── env.ts                  # Zod env validation (PORT, DATABASE_URL, REVIO_ADMIN_TOKEN)
│   ├── plugins/
│   │   ├── prisma.ts           # Prisma client plugin — decorates fastify.prisma
│   │   └── admin-auth.ts       # Bearer token auth — decorates fastify.verifyAdmin
│   └── routes/
│       ├── health.ts           # GET /health
│       ├── search.ts           # POST /search (public)
│       ├── register.ts         # POST /register/therapist (public)
│       └── admin.ts            # /admin/* routes (protected)
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Dev data seed
│   └── migrations/             # Prisma migration history
├── test/
│   ├── app.test.ts             # 33 Vitest integration tests
│   └── setup.ts                # Global test setup/teardown (fresh DB per run)
├── vitest.config.ts            # Vitest config with globalSetup + singleThread
├── .env                        # PORT, DATABASE_URL, REVIO_ADMIN_TOKEN
└── tsconfig.json
```

### Environment Variables

```env
PORT=4000
DATABASE_URL="file:./prisma/dev.db"
REVIO_ADMIN_TOKEN=dev-admin-token
```

### Database Schema (Prisma)

```prisma
model Therapist {
  id                String                  @id @default(cuid())
  email             String                  @unique
  fullName          String
  professionalTitle String
  city              String
  bio               String?
  homeVisit         Boolean                 @default(false)
  specializations   String                  // comma-separated list
  languages         String                  // comma-separated list
  certifications    String                  @default("")
  reviewStatus      ReviewStatus            @default(PENDING_REVIEW)
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt
  links             TherapistPracticeLink[]
}

model Practice {
  id           String                  @id @default(cuid())
  name         String
  city         String
  address      String?
  phone        String?
  lat          Float                   @default(0)
  lng          Float                   @default(0)
  reviewStatus ReviewStatus            @default(PENDING_REVIEW)
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt
  links        TherapistPracticeLink[]
}

model TherapistPracticeLink {
  id          String     @id @default(cuid())
  therapistId String
  practiceId  String
  status      LinkStatus @default(PROPOSED)
  createdAt   DateTime   @default(now())
  therapist   Therapist  @relation(..., onDelete: Cascade)
  practice    Practice   @relation(..., onDelete: Cascade)

  @@unique([therapistId, practiceId])
}
```

> `specializations`, `languages`, and `certifications` are stored as comma-separated strings in SQLite (no array type support) and split into `string[]` at the API layer.

### API Routes

#### Public

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: "ok" }` |
| `POST` | `/search` | Search approved therapists with filters |
| `POST` | `/register/therapist` | Submit a new therapist + practice for review |

#### Admin (requires `Authorization: Bearer <REVIO_ADMIN_TOKEN>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/stats` | Counts grouped by status |
| `GET` | `/admin/therapists` | List all therapists (optional `?status=` filter) |
| `GET` | `/admin/therapists/:id` | Get single therapist with links |
| `POST` | `/admin/therapists/:id/approve` | Set status → APPROVED |
| `POST` | `/admin/therapists/:id/reject` | Set status → REJECTED |
| `POST` | `/admin/therapists/:id/request-changes` | Set status → CHANGES_REQUESTED |
| `POST` | `/admin/therapists/:id/suspend` | Set status → SUSPENDED |
| `GET` | `/admin/practices` | List all practices |
| `GET` | `/admin/practices/:id` | Get single practice with links |
| `POST` | `/admin/practices/:id/approve` | Set status → APPROVED |
| `POST` | `/admin/practices/:id/reject` | Set status → REJECTED |
| `POST` | `/admin/practices/:id/suspend` | Set status → SUSPENDED |
| `GET` | `/admin/links` | List all links with therapist + practice |
| `POST` | `/admin/links/:id/confirm` | Set link status → CONFIRMED |
| `POST` | `/admin/links/:id/reject` | Set link status → REJECTED |
| `POST` | `/admin/links/:id/dispute` | Set link status → DISPUTED |

### Search Logic (`POST /search`)

1. Fetches only `APPROVED` therapists whose links are `CONFIRMED` to an `APPROVED` practice
2. Filters by: city (exact, case-insensitive), language, homeVisit, specialization
3. Scores relevance: +1 if any specialization matches the query string
4. Returns sorted results (higher relevance first) + deduplicated practice list for map

### Registration Logic (`POST /register/therapist`)

1. Validates body with Zod (email, fullName, professionalTitle, city, homeVisit, specializations[], languages[], certifications[], practice{})
2. Checks for duplicate email → `409 Conflict`
3. Creates `Practice` (status: `PENDING_REVIEW`)
4. Creates `Therapist` (status: `PENDING_REVIEW`)
5. Creates `TherapistPracticeLink` (status: `PROPOSED`)
6. Returns `201 { message, therapistId }`

### Authentication

`apps/api/src/plugins/admin-auth.ts` decorates `fastify.verifyAdmin` — an `onRequest` hook that checks the `Authorization: Bearer <token>` header against `REVIO_ADMIN_TOKEN`. All `/admin/*` routes add this hook.

### Tests

`apps/api/test/app.test.ts` — 33 integration tests using Fastify's `app.inject()` (no real HTTP server). A fresh SQLite test database is created from migrations before each run and deleted after.

| Test group | Count |
|------------|-------|
| Health | 1 |
| Search | 5 |
| Registration | 5 |
| Admin auth | 2 |
| Admin stats | 2 |
| Admin therapists | 6 |
| Admin practices | 4 |
| Admin links | 5 |
| End-to-end flow | 1 |
| **Total** | **33** |

---

## `apps/admin` — Next.js Admin Dashboard

**Package name:** `@revio/admin`
**Port:** `3000`
**Stack:** Next.js 15 App Router, Server Components, Server Actions, plain CSS

### Directory Structure

```
apps/admin/
├── app/
│   ├── layout.tsx              # Root layout — sidebar + main grid
│   ├── globals.css             # Global styles, badge colors, action buttons
│   ├── page.tsx                # / — Dashboard with 4 stat cards
│   ├── therapists/
│   │   └── page.tsx            # /therapists — Review queue table
│   ├── practices/
│   │   └── page.tsx            # /practices — Practices table
│   └── links/
│       └── page.tsx            # /links — Links table with confirm/reject/dispute
├── components/
│   ├── sidebar.tsx             # Navigation sidebar (Server Component)
│   ├── page-shell.tsx          # Layout wrapper with title/description
│   └── action-buttons.tsx      # TherapistActions, PracticeActions, LinkActions (Client Components)
├── lib/
│   ├── api.ts                  # Server-side fetch client using ADMIN_TOKEN
│   └── actions.ts              # Server Actions — POST requests + revalidatePath
├── .env.local                  # NEXT_PUBLIC_API_URL, ADMIN_TOKEN
└── tsconfig.json
```

### Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
ADMIN_TOKEN=dev-admin-token
```

> `ADMIN_TOKEN` is server-only (no `NEXT_PUBLIC_` prefix). It is never sent to the browser.

### Data Flow

All pages are **async Server Components** — they fetch data server-side at request time (`cache: 'no-store'`). Mutations happen via **Server Actions** (`'use server'`), which POST to the API and call `revalidatePath()` to invalidate Next.js cache, triggering a fresh server render.

```
Browser click
  → Client Component (useTransition)
  → Server Action (lib/actions.ts)
  → POST /admin/therapists/:id/approve (API)
  → revalidatePath('/therapists')
  → Next.js re-fetches page data
  → Updated table rendered
```

### CSS Architecture

`globals.css` uses CSS custom properties (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`) and BEM-style modifier classes:

```css
/* Status badges */
.badge--APPROVED          { color: #16a34a; }
.badge--PENDING_REVIEW    { color: #ea580c; }
.badge--CHANGES_REQUESTED { color: #ca8a04; }
.badge--REJECTED          { color: #dc2626; }
.badge--SUSPENDED         { color: #64748b; }
.badge--CONFIRMED         { color: #16a34a; }
.badge--PROPOSED          { color: #2563eb; }
.badge--DISPUTED          { color: #ea580c; }

/* Action buttons */
.action-btn--approve { color: #16a34a; }
.action-btn--reject  { color: #dc2626; }
.action-btn--warn    { color: #ca8a04; }
```

---

## `apps/mobile` — Expo React Native App

**Package name:** `@revio/mobile`
**Stack:** Expo SDK, React Native (JavaScript), single-file component (`src/App.js`)

### Key Features

- **Search** — calls `POST /search` on the API, maps response to UI format
- **Filters** — chip-based UI for language, homeVisit, specialization, kassenart
- **Map view** — shows practice locations from search results
- **Registration form** — calls `POST /register/therapist`, handles 409 duplicate errors
- **Loading states** — spinner shown during API calls

### API Integration

```javascript
// Normalize API response to UI format
function mapApiTherapist(t) {
  return {
    name: t.fullName,
    title: t.professionalTitle,
    photo: null,
    kassenart: null,           // not in API yet
    fortbildungen: t.certifications,
    verifiziert: true,         // all approved therapists are verified
    homeVisit: t.homeVisit,
    sprachen: t.languages,
    spezialisierungen: t.specializations,
    practices: t.practices,
    // ...
  };
}
```

The mobile app hits `http://localhost:4000` in development (configurable via constants at the top of `App.js`).

---

## Data Flow — Full Lifecycle

```
1. REGISTRATION (Mobile)
   Therapist fills form → POST /register/therapist
   → Therapist: PENDING_REVIEW
   → Practice:  PENDING_REVIEW
   → Link:      PROPOSED

2. REVIEW (Admin)
   Admin sees therapist in queue (/therapists page)
   → POST /admin/therapists/:id/approve  → Therapist: APPROVED
   → POST /admin/practices/:id/approve   → Practice:  APPROVED
   → POST /admin/links/:id/confirm       → Link:      CONFIRMED

3. VISIBILITY (Mobile)
   Patient searches → POST /search
   → Only APPROVED therapists with CONFIRMED links to APPROVED practices appear
   → Results sorted by relevance score
```

---

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)

### First-time setup

```bash
cd Revio
pnpm install              # Install all workspace dependencies

# Set up API database
cd apps/api
cp .env.example .env      # Fill in your values
npx prisma migrate dev    # Create database + run migrations
npx tsx prisma/seed.ts    # Seed with sample data
```

### Running locally

```bash
# From repo root — starts all three apps
pnpm dev

# Or individually
pnpm dev:api              # http://localhost:4000
pnpm dev:admin            # http://localhost:3000
pnpm dev:mobile           # Expo dev server (scan QR with Expo Go)
```

### Running tests

```bash
cd apps/api
pnpm test                 # 33 integration tests (fresh test.db per run)
```

---

## Development Phases

### Phase 1 — Monorepo Setup

**Goal:** Merge the two separate projects (`AdminRevio`, `revioApp`) into a single pnpm workspace.

**What was done:**
- Created `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- Created root `package.json` with unified dev scripts using `pnpm --filter`
- Moved `AdminRevio` → `apps/admin` + `apps/api`
- Moved `revioApp` → `apps/mobile`
- Created `packages/shared/` with its own `package.json` and `tsconfig.json`
- Ran `pnpm install` to link all workspaces

**Result:** Single `pnpm install` installs all apps. All packages can reference each other via `workspace:*`.

---

### Phase 2 — Unified API

**Goal:** Build a single Fastify API that serves both mobile and admin, replacing two separate mock backends.

**What was done:**
- Rewrote `apps/api/src/app.ts` to use `buildApp()` factory (enables testing with `app.inject()`)
- Created `apps/api/src/env.ts` — Zod validation of environment variables at startup
- Created `apps/api/src/plugins/prisma.ts` — Prisma client as a Fastify plugin, decorates `fastify.prisma`
- Created `apps/api/src/plugins/admin-auth.ts` — Bearer token auth hook, decorates `fastify.verifyAdmin`
- Created `apps/api/src/routes/health.ts` — `GET /health`
- Created `apps/api/src/routes/search.ts` — `POST /search` with Zod validation and relevance scoring
- Created `apps/api/src/routes/register.ts` — `POST /register/therapist` with duplicate check
- Rewrote `apps/api/src/routes/admin.ts` — all admin routes with real Prisma queries
- Updated Prisma schema: added `certifications` field, `onDelete: Cascade`, `@@unique([therapistId, practiceId])`
- Rewrote `packages/shared/src/index.ts` — canonical types matching Prisma enum values (`'APPROVED'` not `'approved'`)
- Created `apps/api/prisma/seed.ts` — seeds one approved and one pending therapist/practice pair

**Result:** One API on port 4000 handles all reads and writes. Zero mock data in the backend.

---

### Phase 3 — Admin Frontend → API

**Goal:** Replace all hardcoded mock data in the admin dashboard with real data from the API.

**What was done:**
- Rewrote `apps/admin/lib/api.ts` — server-side fetch client using `ADMIN_TOKEN` env var, `cache: 'no-store'`
- Created `apps/admin/lib/actions.ts` — Server Actions for all admin mutations + `revalidatePath()` calls
- Created `apps/admin/components/action-buttons.tsx` — `TherapistActions`, `PracticeActions`, `LinkActions` as Client Components with `useTransition` for pending state
- Rewrote `apps/admin/app/page.tsx` — real stats from `/admin/stats`
- Rewrote `apps/admin/app/therapists/page.tsx` — real therapist list with action buttons
- Rewrote `apps/admin/app/practices/page.tsx` — real practice list with action buttons
- Rewrote `apps/admin/app/links/page.tsx` — real links with confirm/reject/dispute buttons
- Updated `apps/admin/app/globals.css` — badge modifier classes per status, action button variants
- Added `.env.local` with `NEXT_PUBLIC_API_URL` and `ADMIN_TOKEN`

**Result:** Admin dashboard fully driven by live API data. Moderator actions immediately reflect in the database and re-render the page without a manual refresh.

---

### Phase 4 — Mobile → API

**Goal:** Replace hardcoded demo therapist data in the mobile app with real API calls.

**What was done:**
- Added `mapApiTherapist()` function to normalize API response shape to the UI's expected shape
- Added `searchLoading` and `allApiTherapists` state
- Replaced `filterLocally()` / `demoResults` with `runSearchWith()` — async function calling `POST /search`
- Connected chip selection and suggestion selection to `runSearchWith()`
- Updated `applyFilters()` to handle `kassenart: null` and `fortbildungen ?? certifications` fallback
- Updated `renderPracticeProfile()` to use `allApiTherapists` instead of `demoResults`
- Updated registration submit to call `POST /register/therapist` with error handling for 409
- Added loading spinner during search
- Updated seed data: changed city from `'Cologne'` to `'Köln'` to match mobile app defaults

**Result:** Mobile app searches return real therapists from the database. Registration form creates real records that appear in the admin queue.

---

### Phase 5 — End-to-End Testing

**Goal:** Verify the full system works correctly with automated tests and TypeScript checks.

**What was done:**
- Created `apps/api/vitest.config.ts` — Vitest config with `globalSetup` and `singleThread: true` to prevent DB race conditions
- Created `apps/api/test/setup.ts` — global setup runs `prisma migrate deploy` against a fresh `test.db` before tests; teardown deletes it
- Wrote `apps/api/test/app.test.ts` — 33 integration tests using `app.inject()`:
  - Each test group uses `afterEach` to delete all records (clean slate between tests)
  - Covers: health, search (approved-only, filters, relevance), registration (validation, duplicate 409), admin auth (401 cases), stats, therapist/practice/link CRUD + status transitions, end-to-end flow (register → approve → visible in search)
- Ran `vitest run` — **33/33 tests passed**
- Ran TypeScript checks for all three TypeScript packages:
  - `@revio/api` — **0 errors**
  - `@revio/admin` — **0 errors**
  - `@revio/shared` — **0 errors**

**Result:** Full automated test coverage of the API surface. Type safety confirmed across the entire monorepo.
