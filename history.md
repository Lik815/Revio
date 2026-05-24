# Revio — Cleanup History

Datum: 04.04.2026

## Gelöschte Duplikate (macOS " 2"-Kopien)

Identische Kopien, die durch macOS-Dateiduplikation entstanden sind:

| Gelöschte Datei | Original (behalten) |
|-----------------|---------------------|
| `nixpacks 2.toml` | `nixpacks.toml` |
| `apps/mobile/.env 2.example` | `apps/mobile/.env.example` |
| `apps/mobile/src/mobile-therapist-screens 2.js` | `apps/mobile/src/mobile-therapist-screens.js` |
| `apps/mobile/src/mobile-translations 2.js` | `apps/mobile/src/mobile-translations.js` |
| `apps/admin/lib/api-base 2.ts` | `apps/admin/lib/api-base.ts` |
| `apps/admin/app/error 2.tsx` | `apps/admin/app/error.tsx` |
| `apps/api/prisma/add-koeln-freelancers 2.ts` | `apps/api/prisma/add-koeln-freelancers.ts` |
| `apps/api/prisma/generate_practice_logo 2.py` | `apps/api/prisma/generate_practice_logo.py` |
| `apps/api/prisma/schema.production 2.prisma` | `apps/api/prisma/schema.production.prisma` |
| `docs/freelancer-first-appointment-mvp 2.md` | `docs/freelancer-first-appointment-mvp.md` |
| `docs/plattform-architektur-reverse-engineering 2.md` | `docs/plattform-architektur-reverse-engineering.md` |

## Gelöschte Build-Artefakte / Cache-Ordner

| Gelöschter Pfad | Grund |
|-----------------|-------|
| `apps/admin/.next_stale_20260319_180317/` | Alter Next.js Build-Cache (46+ Dateien, ~3 Wochen alt) |
| `apps/admin/.next_stale_20260320_221633/` | Alter Next.js Build-Cache |
| `apps/admin/.next_stale_20260326_0507_chunk_mismatch/` | Alter Next.js Build-Cache (chunk mismatch debug) |
| `apps/mobile/dist/` | Expo Web Build-Output — wird bei jedem Build regeneriert |
| `apps/api/dist/` | API Build-Output — wird bei jedem Build regeneriert |

## Gelöschte leere Ordner

| Gelöschter Pfad | Grund |
|-----------------|-------|
| `uploads/` (Root-Level) | Leerer Ordner — Uploads gehen nach `apps/api/uploads/` |
| `apps/uploads/` | Leerer Ordner — nie genutzt |
| `apps/admin/app/api/documents 2/` | Leerer Duplikat-Ordner |
| `apps/admin/app/(auth)/login/` | Leerer Ordner — aktive Login-Page ist `app/login/page.tsx` |
| `scripts/ralph/` | Leerer Ordner |

## Gelöschte veraltete Dokumentation

| Gelöschte Datei | Inhalt / Grund |
|-----------------|----------------|
| `claude-todo.md` | Bug-Liste vom 11.03.2026 — alle Tasks abgearbeitet (✅ in `todo.md`). Enthielt: API-URL konfigurierbar, Suchlogik, Seed-Daten, Fake-E-Mail entfernen, Praxis-Registrierung. |
| `debug.md` | Debug-Notizen vom 11.03.2026 — Live-Test-Protokoll von Admin/API. Gefundene Bugs alle gefixt. Enthielt: Endpoint-Tests, UI-Inkonsistenzen, Seed-Daten-Probleme. |
| `codex-ui-prompt.md` | Einmaliger UI-Refactor-Prompt für Codex (529 Zeilen). Design-Token-System, Theme-Updates, Component-Refactoring. Wurde umgesetzt. |
| `uiticket.md` | UI-Verbesserungsnotizen (260 Zeilen). Informationshierarchie, Header-Verdichtung, Status-Kommunikation. Wurde teilweise umgesetzt. |
| `registrationrefactor.md` | Registrierungs-Refactor-Plan (614 Zeilen). Onboarding 5→4 Schritte, E-Mail-Verifikation mit Deep Linking. Wurde umgesetzt. |

## Gelöschte nicht mehr genutzte Dateien

| Gelöschte Datei | Inhalt / Grund |
|-----------------|----------------|
| `apps/admin/lib/mock-data.ts` | Mock-Daten (51 Zeilen) — wird nirgends importiert. Admin nutzt echte API-Daten. Enthielt: summaryCards, therapistRows mit Dummy-Daten (Julia Neumann etc.). |

## Behalten

Folgende Dateien wurden bewusst NICHT gelöscht:

- `START.md` — Schnellstart-Anleitung
- `CLAUDE.md` — AI-Context
- `structure.md` — gelöscht am 2026-05-20; Inhalt im Archiv unten gespeichert
- `docs/data-model.md`, `docs/design-system.md`, `docs/email-setup.md` etc. — Aktive Doku
- `apps/api/prisma/seed.ts` — Aktives Seed-Script
- `apps/api/prisma/schema.production.prisma` — Prod-Schema
- `apps/api/prisma/add-koeln-*.ts`, `backfill-*.ts` — Einmal-Scripts (empfohlen: in `scripts/` verschieben)

---

# Revio — Todo & Roadmap (archiviert aus todo.md)

## Offene Aufgaben

### Infrastruktur

- [ ] **PostgreSQL** — SQLite durch PostgreSQL ersetzen für Production

---

## Abgeschlossen

### Bugs & Kritische Fixes

- [x] **API-URL konfigurierbar machen** — `EXPO_PUBLIC_API_URL` Env-Variable; fallback auf `localhost:4000`. _(App.js)_
- [x] **Suchlogik fachlich verbessern** — Partial-Matching über `specializations`, `bio`, `certifications`; spezifische Queries filtern irrelevante Treffer aus. _(search.ts)_
- [x] **Seed-Daten vereinheitlichen** — Anna Becker und Max Klein auf deutsche Spezialisierungen umgestellt. _(seed.ts)_
- [x] **Fake-E-Mail-Bestätigung entfernen** — Registrierungs-Schritt 2 (E-Mail-Bestätigung) entfernt; REG_STEPS von 6 auf 5 reduziert. _(App.js)_
- [x] **Praxis-Registrierungslogik korrigieren** — `practice` im API-Schema optional; `skip`/`existing` erzeugen keine Pseudo-Praxis mehr. _(App.js, register.ts)_

### UX & Konsistenz

- [x] **Fehlermeldungen & Erfolgsfeedback** — `handleSaveProfile` und `handlePickPhoto` haben jetzt `Alert.alert` für Fehler und Erfolg. _(App.js)_
- [x] **Optionen-Seite vervollständigen** — `Datenschutz` und `Impressum` als „Bald verfügbar" gekennzeichnet. _(App.js)_
- [x] **Standortabfrage nutzerfreundlicher** — Standort wird nicht mehr beim Mount angefragt; stattdessen 📍-Button neben Ortsfeld. _(App.js)_
- [x] **Review-/Freigabelogik konsistenter machen** — Cascade-Approve bereits implementiert: Therapeut freigeben → Praxen + Links werden automatisch mitgenehmigt. _(admin.ts)_
- [x] **Such-UI und API-Filter abstimmen** — `kassenart` in DB/API/App; `certifications` → `fortbildungen` korrekt gemappt; Filter funktioniert Ende-zu-Ende. _(search.ts, App.js, schema.prisma, shared/index.ts)_
- [x] **Therapeuten-Profil leere Felder bereinigen** — Spezialisierungen, Details, Sprachen-Tags werden nur gerendert wenn Daten vorhanden. _(App.js)_
- [x] **Dev/Prod-Meldung im Registrierungsflow** — `__DEV__` bereits genutzt: Erfolgsscreen zeigt je nach Environment unterschiedlichen Text. _(App.js)_
- [x] **isVisible-Feature** — `isVisible`-Feld in DB + API + Profil-Edit; unsichtbare Therapeuten aus Suche gefiltert. Migration `20260315084328_add_is_visible`. _(schema.prisma, auth.ts, search.ts, App.js)_
- [x] **Verfügbare Zeiten** — `availability`-Feld in DB + API + Profil-Edit + Profil-Ansicht. Migration `20260315090724_add_availability`. _(schema.prisma, auth.ts, search.ts, seed.ts, App.js)_

### Polish & Tech Debt

- [x] **CTA-Texte präzisieren** — „Therapeut kontaktieren" → „Praxis anrufen" in Suchergebnissen und Favoriten. _(App.js)_
- [x] **Theme `system` ergänzen** — „System"-Option im Erscheinungsbild-Toggle hinzugefügt. _(App.js)_
- [x] **Favoriten-Strategie kommunizieren** — Hinweis „🔒 Lokal gespeichert · nicht synchronisiert · nur für dich sichtbar" im Favoriten-Tab. _(App.js)_
- [x] **Bild-Upload auf Filesystem umgestellt** — `POST /upload/photo` (multipart/form-data) speichert Datei in `apps/api/uploads/`; gibt `{ url: "/uploads/<uuid>.jpg" }` zurück; `GET /uploads/*` liefert Dateien statisch aus. App.js nutzt `FormData` statt Base64. DB enthält nur noch die URL. Für Production: `pipeline`-Block in `upload.ts` durch S3 `putObject` ersetzen. _(upload.ts, app.ts, App.js)_

### Verifikation & Trust

- ~~**Verifizierungs-Badge**~~ — entschieden: kein Badge; nur APPROVED-Profile sind sichtbar
- ~~**Admin: Verifizierung manuell setzen**~~ — nicht geplant

### Mobile App

- [x] **Push-Benachrichtigungen** — Therapeut erhält Benachrichtigung bei Profil-Freigabe/-Ablehnung/-Änderungsanforderung/Sperrung
- [x] **Kassenart** — Feld in DB + API + Registrierungsflow + Filter in Suche. _(schema.prisma, search.ts, App.js)_
- [x] **Verfügbare Zeiten** — `availability`-Feld in DB + API + Profil. _(schema.prisma, auth.ts, App.js)_
- [x] **Logo in Header** — `logo.png` in alle Header-Zeilen eingebunden. _(App.js)_

### Admin-Dashboard

- ~~**Verifizierungs-Aktion**~~ — nicht geplant; Freigabe via APPROVED-Status reicht
- [x] **Dokumente einsehen** — Upload-Dateien im Admin abrufbar + Therapeuten-Dashboard-Upload

### API

- [x] **Bestehende Praxis verknüpfen** — `GET /practices/search?q=` Endpunkt; Live-Suche im Registrierungsflow; `existingPracticeId` in `register.ts`; Link wird als PROPOSED erstellt. _(search.ts, register.ts, App.js)_
- [x] **Kassenart + Zeiten** — Felder im Prisma-Schema und API-Typen ergänzt. _(schema.prisma, auth.ts, shared/index.ts)_
- [x] **Geo-Koordinaten** — Nominatim (OpenStreetMap, kein API-Key) geocodiert Adresse+Stadt bei `POST /register/therapist`, `POST /practice` und `PATCH /my/practice`. `src/utils/geocode.ts` mit best-effort Fehlerbehandlung. Admin-Endpunkt `POST /admin/practices/geocode-all` für nachträgliches Geocoding. Für Production: Google Geocoding API eintauschen. _(geocode.ts, register.ts, practice.ts, admin.ts)_

### Infrastruktur

- [x] **Produktions-Deployment** — Docker + Railway/Render für API, Vercel für Admin, EAS für Mobile
- [x] **Umgebungsvariablen** — Secrets-Management (z. B. Doppler) einrichten

### Grundlegende Infrastruktur

- [x] Datenbank-Migration für Auth-Felder (`passwordHash`, `sessionToken`, `photo`) erstellt und Tests auf 33/33 grün
- [x] pnpm-Monorepo mit apps/api, apps/admin, apps/mobile, packages/shared
- [x] Fastify 5 API mit Prisma/SQLite, Zod-Validierung, Bearer-Auth
- [x] Next.js 15 Admin-Dashboard mit Server Actions und Live-Daten
- [x] Expo Mobile App mit echter Suche und Registrierung
- [x] 33 Vitest-Tests, alle grün
- [x] TypeScript-Checks: 0 Fehler in allen drei Paketen
- [x] metro.config.js für pnpm-Symlink-Auflösung
- [x] Auto-Approve in Development-Modus (register.ts)
- [x] Therapeuten-Profil: Absturz bei null-languages/specializations behoben
- [x] Bottom-Nav während Registrierung nutzbar
- [x] Entfernung auf Therapeuten-Profil angezeigt
- [x] Praxis-Logo mit Initialen + medizinisches Kreuz
- [x] Registrierung: Spezialisierungen optional, Fortbildungen als Checkliste
- [x] Registrierung: Andere Sprachen als Freitext hinzufügbar
- [x] Registrierung: Neue Praxis / Bestehende verknüpfen / Überspringen
- [x] Auth & Profil: Login-Screen, Session-Token, AsyncStorage
- [x] Therapeuten-Dashboard: Profil sehen nach Login
- [x] Profil bearbeiten: Bio, Spezialisierungen, Sprachen, Hausbesuch (PATCH /auth/me)
- [x] Profilbild hochladen via expo-image-picker
- [x] Test-Account: test@revio.de / password
- [x] Abmelden-Button in Optionen-Tab
- [x] „Therapeut kontaktieren" Button repariert (phone-Feld in API + Alert-Dialog)
- [x] phone-Feld zu SearchPractice Typ + search.ts hinzugefügt
- [x] Logo.png mit transparentem Hintergrund vorbereitet (assets/logo.png)
- [x] Next.js Admin-Routing: doppelte Seiten entfernt, Route-Group `(admin)` ist alleinige Quelle

---

# Archiv: `structure.md` (gelöscht am 2026-05-20)

Hinweis: Der folgende Inhalt wurde vor dem Löschen von `structure.md` unverändert in `history.md` archiviert. Der Inhalt beschreibt einen älteren Projektstand und ist nicht mehr die aktuelle Architektur-Wahrheit.

````markdown
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
````

---

# Archiv: `docs/presentation-website-plan.md` (gelöscht am 2026-05-20)

Hinweis: Der folgende Inhalt wurde vor dem Löschen von `docs/presentation-website-plan.md` unverändert in `history.md` archiviert. Der Plan beschreibt die ursprüngliche Website-Konzeption; große Teile sind inzwischen in `apps/site` umgesetzt.

````markdown
# Revio Presentation Website Plan

## 1. Goal

The website is not the product.

The app remains the product.

The website exists to:

- explain Revio quickly
- build trust
- make therapists want to join
- make patients understand the value
- create a calm, premium first impression

The website should not become:

- a second product
- a full web app
- a booking portal
- a mini marketplace

The right role for the website is:

- presentation
- positioning
- trust
- lead capture

## 2. Product Positioning

Revio helps patients find the right physiotherapy more clearly and calmly.

Revio helps therapists become visible with a professional profile and be discovered by patients who fit their expertise.

The website should communicate:

- calm
- trust
- medical quality
- clarity
- focus

It should not communicate:

- discount marketplace
- noisy startup energy
- “book instantly in one click” if that is not the true MVP

## 3. MVP Website Scope

### Build now

- Home
- For Patients
- For Therapists
- About Revio
- Contact / Interest
- Footer with legal links

### Do not build now

- full search experience
- full login
- patient dashboard
- therapist dashboard
- booking flow
- account creation in the website itself
- profile editing on web

## 4. Sitemap

### Main Navigation

- Startseite
- Für Patient:innen
- Für Therapeut:innen
- Über Revio
- Kontakt

### Footer

- Impressum
- Datenschutz
- Kontakt

## 5. Information Architecture

### Home

Purpose:

- explain Revio in a few seconds
- make the value obvious
- route people into the right path

Sections:

1. Hero
2. How it works
3. Benefits for patients
4. Benefits for therapists
5. Trust section
6. Final CTA

### For Patients

Purpose:

- explain how Revio helps patients find the right physiotherapist
- reduce friction and uncertainty

Sections:

1. Hero
2. What patients can do
3. What makes Revio different
4. What “contact” means in the MVP
5. Final CTA

### For Therapists

Purpose:

- attract therapist registrations
- explain the benefit of being listed
- position Revio as premium visibility, not admin burden

Sections:

1. Hero
2. Why join
3. What a profile includes
4. Optional direct patient contact for freelancers
5. Final CTA

### About Revio

Purpose:

- explain the motivation behind the product
- build trust and seriousness

Sections:

1. Why Revio exists
2. What Revio is not
3. Calm, trustworthy product philosophy
4. Privacy and quality mindset

### Contact / Interest

Purpose:

- collect early interest
- create a low-friction entry point

Sections:

1. Intro
2. Simple form
3. Short privacy note

## 6. Final Copy Draft

## Startseite

### Hero

Headline:

**Die passende Physiotherapie finden.**

Subline:

**Revio hilft Patient:innen, passende Physiotherapeut:innen klarer, ruhiger und vertrauenswürdiger zu entdecken.**

Primary CTA:

**Für Patient:innen**

Secondary CTA:

**Für Therapeut:innen**

### How It Works

Section label:

**So funktioniert Revio**

Copy:

**Revio bringt Patient:innen und Physiotherapeut:innen einfacher zusammen. Statt unübersichtlicher Suche steht die passende fachliche Wahl im Mittelpunkt.**

Three points:

- **Passende Spezialisierungen schneller finden**
- **Therapeut:innen in der Nähe oder für mobile Behandlungen entdecken**
- **Direkt Kontakt aufnehmen, ohne unnötige Komplexität**

### Patients Section

Section label:

**Für Patient:innen**

Headline:

**Weniger suchen. Besser entscheiden.**

Copy:

**Ob Rückenschmerzen, Reha oder neurologische Beschwerden: Revio hilft dabei, passende Physiotherapeut:innen nach Fachgebiet, Standort und Angebot übersichtlicher zu finden.**

CTA:

**Mehr für Patient:innen**

### Therapists Section

Section label:

**Für Therapeut:innen**

Headline:

**Sichtbar werden. Professionell auftreten.**

Copy:

**Mit Revio erhalten Therapeut:innen ein hochwertiges Profil, mehr Sichtbarkeit und einen klaren digitalen Auftritt — ohne sofort in komplexe Praxissoftware-Logik zu geraten.**

CTA:

**Mehr für Therapeut:innen**

### Trust Section

Section label:

**Vertrauen**

Headline:

**Ruhig, hochwertig und medizinisch glaubwürdig**

Copy:

**Revio ist bewusst minimal gedacht: klare Profile, verständliche Informationen und ein Produkt, das Vertrauen schafft statt zu überfordern.**

### Final CTA

Headline:

**Interesse an Revio?**

Copy:

**Wir bauen Revio Schritt für Schritt zu einem hochwertigen Zugang für moderne Physiotherapie auf.**

CTAs:

- **Kontakt aufnehmen**
- **Interesse als Therapeut:in**

## Für Patient:innen

### Hero

Headline:

**Passende Physiotherapie ohne Umwege finden**

Subline:

**Revio hilft dabei, Physiotherapeut:innen nach Spezialisierung, Standort und Angebot klarer zu entdecken.**

### Main Points

Headline:

**Was Patient:innen mit Revio tun können**

Points:

- **Nach passenden Schwerpunkten und Beschwerden suchen**
- **Therapeut:innen in der Nähe entdecken**
- **Mobile Physiotherapie leichter finden**
- **Direkt Kontakt aufnehmen**

### Clarification

Headline:

**Kein überladener Buchungsprozess**

Copy:

**Im Mittelpunkt steht nicht komplizierte Terminlogik, sondern die richtige fachliche Verbindung. Revio hilft zuerst dabei, passende Physiotherapeut:innen schnell und vertrauenswürdig zu finden.**

### CTA

**Kontakt aufnehmen**

## Für Therapeut:innen

### Hero

Headline:

**Ein professionelles Profil für moderne Physiotherapie**

Subline:

**Revio hilft Therapeut:innen, sichtbar zu werden und von passenden Patient:innen gefunden zu werden.**

### Benefits

Headline:

**Warum Revio**

Points:

- **Professionelle Sichtbarkeit**
- **Klarer Auftritt statt verstreuter Informationen**
- **Bessere Auffindbarkeit für passende Anfragen**
- **Ein hochwertiges Produktumfeld statt Marktplatzgefühl**

### Profile Section

Headline:

**Was ein Revio-Profil zeigt**

Points:

- **Fachgebiete**
- **Sprachen**
- **Standort**
- **Hausbesuch und Einsatzgebiet**
- **Praxisbezug oder eigenständiges Profil**

### Freelancer Section

Headline:

**Für freiberufliche Therapeut:innen**

Copy:

**Freiberufliche Therapeut:innen können in Revio zusätzlich besonders klar auffindbar sein und direkte Kontaktwege für passende Erstkontakte anbieten.**

### CTA

**Als Therapeut:in Interesse anmelden**

## Über Revio

### Hero

Headline:

**Warum es Revio gibt**

Copy:

**Die Suche nach passender Physiotherapie ist oft unnötig unübersichtlich. Revio entsteht aus dem Anspruch, diesen Zugang klarer, vertrauenswürdiger und hochwertiger zu gestalten.**

### Philosophy

Headline:

**Wofür Revio steht**

Points:

- **Klarheit statt Überforderung**
- **Qualität statt Lautstärke**
- **Vertrauen statt Marktplatzgefühl**
- **Ein digitales Produkt, das medizinisch ernst genommen werden kann**

### What Revio Is Not

Headline:

**Was Revio bewusst nicht sein will**

Copy:

**Kein überladenes Praxisbetriebssystem. Kein unruhiger Massen-Marktplatz. Kein Produkt, das durch Komplexität wichtiger wirken will als es ist.**

## Kontakt / Interesse

### Hero

Headline:

**Interesse an Revio**

Copy:

**Ob als Patient:in, Therapeut:in oder Praxis: Wir freuen uns über Interesse und Austausch.**

### Form Fields

- Name
- E-Mail
- Ich bin …
  - Patient:in
  - Therapeut:in
  - Praxis
- Nachricht

### Privacy Note

**Wir verwenden deine Angaben nur zur Kontaktaufnahme im Zusammenhang mit Revio.**

## 7. Design Direction

### Brand Feel

- calm
- premium
- trustworthy
- minimal
- medical

### Visual Principles

- plenty of whitespace
- restrained color palette
- few but strong sections
- soft surfaces, not loud cards
- clear typographic hierarchy
- minimal icon usage

### Avoid

- loud gradients
- startup clichés
- marketplace visual patterns
- app-store promo overload
- giant feature grids
- fake complexity

### Recommended UI Language

- light background
- strong but soft dark text
- subtle borders
- restrained accent color
- one primary CTA color

## 8. Suggested Technical Approach

### Recommendation

Build the presentation site as a separate lightweight app.

Best option in this monorepo:

- `apps/site`

Why:

- keeps admin and mobile concerns separate
- allows a clean marketing-focused codebase
- avoids mixing product logic into the presentation layer

### Stack Recommendation

- Next.js
- static-first pages
- minimal client state
- almost no backend dependency

### MVP Technical Scope

- static content pages
- optional simple contact form later
- shared brand tokens if helpful
- no authentication
- no product API dependency required for launch

## 9. Suggested Folder Structure

```txt
apps/site/
  app/
    page.tsx
    patients/page.tsx
    therapists/page.tsx
    about/page.tsx
    contact/page.tsx
    impressum/page.tsx
    datenschutz/page.tsx
    layout.tsx
    globals.css
  components/
    site-header.tsx
    site-footer.tsx
    hero.tsx
    section.tsx
    cta-block.tsx
  lib/
    content.ts
```

## 10. Implementation Plan

### Phase 1

Build first:

- app shell
- header
- footer
- homepage
- patients page
- therapists page

Goal:

- public-facing Revio website online quickly

### Phase 2

Add:

- about page
- contact page
- legal pages

Goal:

- complete basic presentation and trust layer

### Phase 3

Polish:

- typography tuning
- spacing refinement
- responsive cleanup
- stronger CTA hierarchy

Goal:

- premium feel

## 11. Acceptance Criteria

- The website explains Revio in under 10 seconds
- The site feels calm and premium, not like a marketplace
- Patients understand the discovery and contact value
- Therapists understand why they should join
- No page depends on product auth
- No page pretends the MVP already does full booking
- The site works well on mobile and desktop

## 12. Final Recommendation

The smartest version of the website is small.

Do not build a web version of the app.

Build a presentation layer that:

- explains Revio clearly
- makes the product feel trustworthy
- supports growth
- stays out of the way technically

The right sequence is:

1. Home
2. For Therapists
3. For Patients
4. Contact
5. About
6. Legal

That is enough for a strong MVP website.
````

---

# Archiv: alte `CLAUDE.md` (ersetzt am 2026-05-24)

Hinweis: Der folgende Inhalt war die vorherige `CLAUDE.md` und wurde beim Ersetzen archiviert.

````markdown
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

> **⚠️ DB path note:** Prisma resolves SQLite paths relative to `schema.prisma`, not the process CWD. The `DATABASE_URL="file:./prisma/prisma/dev.db"` in `.env` resolves to `apps/api/prisma/prisma/prisma/dev.db` (triple-nested). Do not be confused by this — the server, migrations, and seed all use this same path consistently.

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
- **DB file:** `apps/api/prisma/prisma/prisma/dev.db` (note the triple-nested path — Prisma resolves SQLite paths relative to `schema.prisma`, so `file:./prisma/prisma/dev.db` in `.env` becomes `prisma/` + `prisma/prisma/dev.db`)
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

1. **DB path is triple-nested:** Prisma resolves SQLite paths relative to `schema.prisma`. With `DATABASE_URL="file:./prisma/prisma/dev.db"` and schema at `apps/api/prisma/`, the actual DB file is `apps/api/prisma/prisma/prisma/dev.db`. The `.env` value is correct — don't change it.
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
| [`history.md`](history.md) | Archived project history, including the removed legacy `structure.md` content |
| [`revioApp/agents.md`](revioApp/agents.md) | Original full agent specification (superseded by docs/) |
````
