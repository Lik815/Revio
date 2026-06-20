# Claude Handoff: Web Search + Public Profiles Plan

## Goal

Extend the public website so patients can actually find therapists on the web and open public therapist/practice profile pages backed by the database.

Important product boundary:

- therapist registration stays app-only
- booking / appointment requests stay app-only
- website becomes discovery + profile viewing, not full app parity

This is a planning handoff. Do not treat it as approval to redesign product scope.

## Current State

### Website

The website is currently mostly marketing content:

- `apps/site/app/page.tsx`
- `apps/site/app/patients/page.tsx`
- `apps/site/app/therapists/page.tsx`

The homepage hero visually shows a search field, but it is not functional:

- `apps/site/components/hero.tsx`
  - the input is `readOnly`
  - there is no search submit behavior
  - no search results route exists yet

### Mobile app

The mobile app already has the public experience we should conceptually mirror:

- therapist public profile:
  - `apps/mobile/src/screens/public/TherapistProfileScreen.js`
  - `apps/mobile/src/screens/public/TherapistProfileContent.js`
- practice public profile:
  - `apps/mobile/src/screens/public/PracticeProfileScreen.js`
  - `apps/mobile/src/screens/public/PracticeProfileContent.js`
- public search UX:
  - `apps/mobile/src/screens/discover/DiscoverContent.js`
  - `apps/mobile/src/hooks/use-search.js`

### API / DB

The API already exposes most of the public data needed for web pages, and this data is DB-backed through Prisma:

- search:
  - `apps/api/src/routes/search.ts`
  - `POST /search`
- therapist public detail:
  - `GET /therapist/:id`
- practice public detail:
  - `GET /practice-detail/:id`
- public slots:
  - `GET /therapists/:id/slots`

Shared contracts already exist:

- `packages/shared/src/index.ts`

## Product Decision

The website should support:

- searching therapists
- filtering/searching by complaint/specialization/location
- opening therapist profiles
- opening practice profiles
- showing public profile data from the DB

The website should not support:

- therapist registration on web
- patient registration as part of this feature
- booking or appointment requests on web
- app-only account actions such as favorites/reviews submission

The website should instead clearly route those actions into the app.

## Recommended User Experience

### Website scope

Web should cover:

- discover therapists
- compare therapists
- inspect public profile details
- inspect practice details
- view public contact information where already public

App should remain responsible for:

- therapist registration
- patient login
- booking / appointment requests
- authenticated reviews
- favorites / therapy workflow

### CTA strategy

Replace blocked actions with explicit app-only messaging:

- on therapist pages:
  - `Terminbuchung aktuell nur in der Revio App`
- on therapist-facing acquisition areas:
  - `Registrierung aktuell nur in der App`
- optionally:
  - app deep link
  - store/download CTA

## What Already Exists and Can Be Reused

### Reusable data source

Keep the website as a consumer of public API endpoints instead of querying Prisma directly from the site app.

Why:

- public visibility rules already live in the API
- publication filtering is already enforced
- reduces duplication of domain logic
- keeps web and mobile aligned

### Reusable information architecture from mobile

Therapist profile already has the right content structure:

- avatar / identity header
- professional title
- city / home visit / languages / kassenart
- bio
- specializations
- treatment areas
- certifications
- linked practices
- contact rows
- booking CTA area

Practice profile already has:

- logo / identity header
- address / phone / hours
- description
- therapist list

We should mirror this structure on web, but not literally port the React Native UI.

## Gaps To Close

### Website gaps

Missing today:

1. Real search route and results page
2. Public therapist detail route
3. Public practice detail route
4. Data fetching layer for public API on the site
5. Search result cards and profile components
6. App-only CTA handling for booking/registration

### API / contract gaps

For a first implementation, the API is already sufficient.

Optional follow-up improvements:

1. Add SEO-friendly slugs for therapists and practices
2. Add a web-friendly public search GET interface if URL-based search becomes awkward with `POST /search`
3. Expose read-only public review aggregates later if desired

## Recommended Route Structure

Suggested website routes:

- `/finden`
  - search page with results
- `/therapeut/[id]`
  - public therapist profile
- `/praxis/[id]`
  - public practice profile

Optional later:

- `/therapeut/[slug]-[id]`
- `/praxis/[slug]-[id]`

## Recommended Architecture

### Site-side API layer

Create a focused public API helper in the site app, e.g.:

- `apps/site/lib/public-api.ts`

Responsibilities:

- resolve API base URL using existing `apps/site/lib/api-base.ts`
- fetch search results
- fetch therapist detail
- fetch practice detail
- normalize API payloads into site-friendly objects

Do not reuse mobile-only mapper utilities directly from the React Native app.

Instead, create site-local mappers inspired by:

- `apps/mobile/src/utils/app-utils.js`
  - especially `mapApiTherapist`

### Next.js rendering approach

Use App Router pages with server-side data fetching for public pages.

Recommended:

- search page:
  - server-render from URL search params where possible
  - optionally use a client component only for progressive filter interactivity
- profile pages:
  - server-render detail data
  - add metadata per therapist/practice

Keep the site as a public read-only surface.

## Implementation Plan

### Phase 1: Add site public API layer

Create:

- `apps/site/lib/public-api.ts`

Functions:

- `searchTherapists(input)`
- `getPublicTherapist(id)`
- `getPublicPractice(id)`

This layer should:

- use the existing API base helper:
  - `apps/site/lib/api-base.ts`
- centralize fetch error handling
- keep payload normalization out of page files

### Phase 2: Build real web search page

Create:

- `apps/site/app/finden/page.tsx`

Behavior:

- read `q`, `city`, and selected filters from search params
- call the API `/search`
- render results from DB-backed public data

Initial filters should stay small and aligned with active API behavior:

- query
- city
- home visit
- kassenart
- maybe requestable-only later if useful

Do not try to port the entire mobile filter modal in the first pass.

### Phase 3: Make hero search functional

Update:

- `apps/site/components/hero.tsx`
- maybe `apps/site/app/page.tsx`

Change:

- replace the read-only fake search with a real form
- submit to `/finden?q=...`

Important:

- keep the hero visually close to today
- do not overcomplicate with instant suggestions in the first pass

### Phase 4: Build public therapist profile page

Create:

- `apps/site/app/therapeut/[id]/page.tsx`
- maybe `apps/site/components/public-therapist-profile.tsx`

Data source:

- `GET /therapist/:id`

The page should include:

- name
- professional title
- photo/avatar fallback
- city
- home visit info
- service radius if available
- languages
- kassenart
- bio
- specializations
- treatment areas if available
- certifications
- linked practices
- phone/email if currently public in API payload

Do not implement web booking.

Instead show:

- app-only booking CTA
- clear copy that booking happens in the app

### Phase 5: Build public practice profile page

Create:

- `apps/site/app/praxis/[id]/page.tsx`
- maybe `apps/site/components/public-practice-profile.tsx`

Data source:

- `GET /practice-detail/:id`

The page should include:

- practice name
- logo/avatar fallback
- city
- address
- phone
- hours
- description
- therapist list with links to public therapist pages

### Phase 6: Build reusable site components

Suggested components:

- `apps/site/components/search-bar.tsx`
- `apps/site/components/search-filters.tsx`
- `apps/site/components/therapist-result-card.tsx`
- `apps/site/components/practice-result-card.tsx`
- `apps/site/components/public-therapist-profile.tsx`
- `apps/site/components/public-practice-profile.tsx`
- `apps/site/components/app-only-cta.tsx`

Do not over-componentize too early. Extract only after page structures are clear.

### Phase 7: Add metadata and SEO

For profile pages:

- dynamic page title
- description
- canonical URLs
- Open Graph metadata

Potential later enhancement:

- structured data for medical/business profiles

## Suggested Data Mapping

Site-local normalized shapes should mirror only what the website needs.

Example therapist view model:

- `id`
- `fullName`
- `professionalTitle`
- `photo`
- `city`
- `bio`
- `homeVisit`
- `serviceRadiusKm`
- `languages`
- `kassenart`
- `specializations`
- `treatmentAreas`
- `certifications`
- `practices`
- `bookingMode`
- `requestable`
- `nextFreeSlotAt`
- `phone`
- `email`

Example practice view model:

- `id`
- `name`
- `city`
- `address`
- `phone`
- `hours`
- `description`
- `logo`
- `photos`
- `therapists`

## Important UX Constraints

### Registration

Do not create a web registration flow.

Therapist pages and therapist-marketing surfaces can contain:

- `In der App registrieren`
- `App herunterladen`

But not:

- web signup form
- web onboarding wizard

### Booking

Do not implement slot selection or booking requests on web in this phase.

Even though `/therapists/:id/slots` exists, the product decision here is:

- booking remains app-only

The web profile can optionally show:

- `Online-Termine verfügbar`
- `Terminbuchung nur in der App`

But should not open a booking flow on the site.

### Reviews

The mobile profile includes authenticated review behavior.

Do not copy that directly to web yet.

For the first pass:

- omit review submission
- omit auth-gated review UX
- optionally omit reviews entirely unless there is a clear public-read requirement

## Risks

1. Copying too much mobile UI literally will make the site feel like a stretched phone screen.
2. Querying Prisma directly from the site would duplicate public visibility logic already enforced in the API.
3. Mixing search implementation, profile pages, booking, and registration into one batch will create avoidable complexity.
4. Reusing mobile utilities directly may drag React Native assumptions into the site code.

## Security / Platform Note

The site currently runs:

- `next@15.5.14`
- `react@19.1.0`

Before or alongside a broader public search/profile rollout, review whether the site dependencies should be upgraded to currently patched versions for the stack in use.

Relevant file:

- `apps/site/package.json`

## Acceptance Criteria

The feature is successful if:

1. A user can search therapists on the website using real DB-backed data.
2. A user can open a public therapist detail page on the website.
3. A user can open a public practice detail page on the website.
4. The website never offers therapist registration directly on web.
5. The website never allows booking directly on web.
6. Public visibility still follows API publication rules.
7. The structure and information hierarchy feel consistent with the mobile public profiles.

## Recommended PR Split

### PR 1

`feat/site-public-search`

- site public API layer
- `/finden`
- hero search form submission
- result cards

### PR 2

`feat/site-public-profiles`

- `/therapeut/[id]`
- `/praxis/[id]`
- shared public profile components
- app-only CTA treatment

### PR 3

`feat/site-profile-seo-polish`

- metadata
- canonical URLs
- optional richer search params
- optional store/deep-link polish

## Minimal File Plan

New files:

- `apps/site/lib/public-api.ts`
- `apps/site/app/finden/page.tsx`
- `apps/site/app/therapeut/[id]/page.tsx`
- `apps/site/app/praxis/[id]/page.tsx`
- `apps/site/components/search-bar.tsx`
- `apps/site/components/therapist-result-card.tsx`
- `apps/site/components/public-therapist-profile.tsx`
- `apps/site/components/public-practice-profile.tsx`
- `apps/site/components/app-only-cta.tsx`

Likely touched files:

- `apps/site/components/hero.tsx`
- `apps/site/app/page.tsx`
- `apps/site/app/globals.css`

