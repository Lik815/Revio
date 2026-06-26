# Claude Handoff: Therapist Working Hours (Arbeitszeiten) Plan

## Goal

Convert the current ad-hoc slot generation tools plus the disconnected
free-text "Sprechzeiten" field into a coherent "Arbeitszeiten" (working
hours) concept for therapists.

Status: implemented (Phases 1-3 and the non-optional parts of Phase 4 below).
Not implemented: the optional public-profile display of structured working
hours (Phase 4, item 2) — `availability` ("Sprechzeiten") was renamed to a
generic "Zusätzlicher Hinweis" field but working hours themselves are not
yet shown on the public therapist profile.

## Product Intent

- Therapists should be able to define their recurring weekly availability
  once, instead of manually re-running "Serie anlegen" every time the
  booking window runs low.
- Today's "Sprechzeiten" field looks like it serves this purpose but
  doesn't — it is freetext, disconnected from booking, and not even shown
  to patients anywhere.
- Boundary: stay inside Booking-MVP scope per `CLAUDE.md` — no payments, no
  medical records, no AI scheduling, German-only UI, no gendered labels.

## Current State

### In the app (mobile)

- `apps/mobile/src/components/SeriesSlotComposer.js` — the closest existing
  analog to "working hours": a one-shot form (Startdatum / Ende / Dauer /
  Wochentage / Uhrzeiten-oder-Zeitblock / Wiederholung) that generates a
  flat list of concrete slot timestamps client-side via
  `apps/mobile/src/utils/recurring-slots.js` (`generateRecurringSlots`),
  then POSTs them all at once. Capped at `MAX_SLOTS = 200` per run. There is
  no server-side recurrence concept — once generated, each slot is just a
  plain row; nothing remembers "this therapist works Mo/We/Fr 8–12."
- `apps/mobile/src/components/SlotComposer.js` (`TherapistSlotComposer`) —
  single ad-hoc slot creation, unrelated to recurring hours.
- `apps/mobile/src/screens/profile/TherapistDashboard.js:582` — a free-text
  `TextInput` labeled "Sprechzeiten" (`t('availabilityLabel')`), placeholder
  "z. B. ab sofort, Mo–Fr 8:00–18:00 Uhr". Purely descriptive string,
  edited here, displayed read-only on the same screen
  (`TherapistDashboard.js:831-834`). It is **not** rendered anywhere in the
  patient-facing public profile/discover screens — confirmed via grep,
  `availability` only appears in backend register/auth/search code and this
  one dashboard screen.
- Entry point gating: slot creation (single or series) is only reachable
  once `bookingMode === 'FIRST_APPOINTMENT_REQUEST'` is active, which
  itself requires `reviewStatus === 'APPROVED'`
  (`apps/mobile/src/screens/therapy/TherapyTabTherapist.js`).

### In the API

- `apps/api/prisma/schema.prisma`:
  - `Therapist.availability String @default("")` — the free-text
    Sprechzeiten field.
  - `TherapistSlot` — `id, therapistId, startsAt (DateTime), durationMin
    (Int), status (AVAILABLE|BOOKED|CANCELLED), createdAt`, unique on
    `(therapistId, startsAt)`. This is the only structured availability
    primitive in the system — every bookable instant is one literal row.
  - `BookingRequest.slotId` — bookings always reference a concrete
    pre-existing slot row; there is no on-the-fly "compute availability
    from a rule" path anywhere.
- Registered slot/booking routes, all in `apps/api/src/routes/booking.ts`
  unless noted:
  - `GET /therapist/slots` — therapist's own slots (auth-scoped)
  - `POST /therapist/slots` — bulk-insert concrete slots (used by both
    single-add and the series composer); wraps insert in try/catch for
    `P2002` unique-conflict, reports conflicts as `skipped`
    (`booking.ts:217-222`)
  - `PATCH /therapist/slots/:id`
  - `DELETE /therapist/slots/:id`
  - `POST /therapist/slots/bulk-delete` (`slotIds[]`, `.max(500)`,
    AVAILABLE-only)
  - `GET /therapists/:id/slots` (`apps/api/src/routes/search.ts:430`) —
    the patient-facing read of a specific therapist's open slots
  - `POST /bookings` — patient books a specific existing slot
- `availability` (Sprechzeiten) lifecycle: set at registration
  (`register.ts:297`), editable via `PATCH` (`auth.ts:432`), returned by
  `auth.ts:328` and included in `search.ts:329,415` search results — but
  again, never rendered to patients in the mobile app today.
- No `WorkingHoursRule` / recurrence / exception model exists anywhere in
  the schema today.

### Known precedent / risk

A prior incident in this repo: `TherapistSlot` was created without its
`(therapistId, startsAt)` unique constraint for several days before the
constraint migration landed; duplicate-slot data that had already formed in
that window made the constraint migration fail silently, which took a
manual dedupe migration to fix later (see git history around
`dedupe_therapist_slots`). Any feature that introduces automatic or
background slot generation must be designed with this failure mode in
mind from the start — idempotent generation, safe re-runs, and conflict
handling are not optional polish here.

## The Gap

"Arbeitszeiten" does not exist as a concept today. What exists is:

1. A manual, one-shot burst generator (Serie anlegen) that produces real
   rows up to a fixed cap, with no memory of the pattern that produced
   them — the therapist must remember to re-run it.
2. A disconnected free-text blurb (Sprechzeiten) that isn't even
   patient-visible.

## Resolved Direction: Option A — Rolling Materializer

Therapists store recurring working hours as **rules**. The server
generates concrete `TherapistSlot` rows from those rules for a rolling
window (e.g. the next 6–8 weeks). `TherapistSlot` stays the single source
of bookability truth — `POST /bookings`, `GET /therapists/:id/slots`, the
slot list, delete/cancel flows, and search all keep working unchanged.

Rejected alternative — on-the-fly computed availability (no materialized
rows until booking time): would require rebuilding the public slots
endpoint, the unique-slot-per-booking model, and every screen that assumes
AVAILABLE rows already exist to list/filter/delete. Far larger blast
radius for no clear MVP-stage benefit.

### Why Option A fits this codebase specifically

- `POST /bookings` and `GET /therapists/:id/slots` already expect concrete
  slot IDs — unchanged under Option A.
- The app already lists, deletes, and books concrete slots everywhere.
- `SeriesSlotComposer` already generates concrete slots from a
  weekday+time pattern — it just doesn't persist the pattern itself today.
  Option A persists exactly that pattern as a rule.
- Smaller blast radius: `TherapistSlot` remains the only thing booking
  logic has to reason about.

## Data Model

New table `TherapistWorkingHoursRule`:

```txt
id
therapistId
weekday              // 0-6, MUST match the existing JS Date.getDay()
                      // convention already used by WEEKDAY_OPTIONS in
                      // apps/mobile/src/utils/recurring-slots.js:
                      // { 0: So, 1: Mo, 2: Di, 3: Mi, 4: Do, 5: Fr, 6: Sa }
                      // Using ISO/Monday-first numbering here instead
                      // would silently mismatch the existing Wochentage
                      // UI/logic by one day.
startMinute          // minutes since midnight, e.g. 480 for 08:00
endMinute            // e.g. 720 for 12:00
durationMin          // 20, 30, 40...
intervalMin          // optional, usually equals durationMin
effectiveFrom
effectiveUntil
isActive
createdAt
updatedAt
```

A weekday with a lunch gap ("Mo 8–12 und 14–18") is two rows with the same
`weekday`, not a schema change — multiple blocks per weekday already work
via multiple rows. Worth stating explicitly in any implementation ticket so
it isn't assumed each weekday can only have one continuous block.

Extend `TherapistSlot` with:

```txt
source              // MANUAL | WORKING_HOURS
workingHoursRuleId?  // set when source === WORKING_HOURS
```

This lets the materializer know which AVAILABLE slots it owns and can
safely regenerate/prune when a rule changes, without ever touching
manually-created slots.

## Generation Rules

- Server generates slots for a rolling window (e.g. 8 weeks ahead).
- Generation must be idempotent — running it again must never create
  duplicates. Reuse the existing `(therapistId, startsAt)` unique
  constraint and the same `P2002`-as-`skipped` handling already used in
  `POST /therapist/slots` (`booking.ts:217-222`) rather than inventing new
  conflict-handling logic.
- `BOOKED` slots are never deleted or modified by the materializer, full
  stop.
- When a rule changes: only future `AVAILABLE` slots that came from that
  rule (`source === WORKING_HOURS`, matching `workingHoursRuleId`) are
  eligible for deletion/regeneration. Manually-created slots
  (`source === MANUAL`) are never touched by rule changes.
- Date/time generation (weekday matching, interval stepping, DST-safe
  arithmetic across the CET↔CEST transitions) should reuse/port the logic
  already written and tested in
  `apps/mobile/src/utils/recurring-slots.js` (`generateRecurringSlots`) —
  see `apps/mobile/test/recurring-slots.test.js`'s "DST safety (Germany
  CET/CEST)" suite, which already covers the March and October
  transitions. Re-deriving this independently on the server risks silently
  diverging from logic that's already correct and tested.
- The minute-range math (`startMinute`/`endMinute`/`intervalMin` →
  concrete time-of-day list) should reuse the same approach as
  `SeriesSlotComposer.js`'s `generateTimeBlock(from, to, intervalMin)`,
  which already does this exact computation client-side.

## API Routes

- `GET /therapist/working-hours` — list the authenticated therapist's
  rules.
- `PUT /therapist/working-hours` — replace/update rules, triggers
  regeneration within the rolling window per the rules above.
- Confirm both are actually registered in `apps/api/src/app.ts` once
  implemented — do not assume a route file alone makes it active (see
  `CLAUDE.md` §1).

## Mobile UX

Do not keep growing `SeriesSlotComposer.js` — add a new, separate
"Arbeitszeiten" screen/flow instead, consistent with `CLAUDE.md`'s guidance
to extract rather than extend already-large screens:

- Wochentage auswählen (multi-select, reuse the existing single-line
  Wochentage row pattern from `SeriesSlotComposer.js`).
- Zeitblock(e) auswählen, z. B. 08:00–12:00 (supports adding a second
  block per day for lunch gaps).
- Dauer/Takt auswählen.
- Preview line: "Es werden Termine für die nächsten 8 Wochen erstellt."
- CTA: "Arbeitszeiten speichern".

"Serie anlegen" stays available as a manual/one-off tool (e.g. covering a
single exceptional week); "Arbeitszeiten" becomes the normal path for
standing availability. Single ad-hoc slot creation
(`TherapistSlotComposer`) is unaffected either way.

## Sprechzeiten Field

Do not remove `availability` immediately. Rename its label from
"Sprechzeiten" to something like "Hinweis zu Terminen" or "Zusätzlicher
Hinweis" (a `translations.js` string change only, `availabilityLabel` key —
no schema change needed, it stays a plain string either way). The real
bookable times come from `TherapistWorkingHoursRule` + `TherapistSlot`;
this field becomes explicitly secondary/free-text context rather than
implying it's the source of truth for availability.

## Suggested Implementation Phases

### Phase 1: Backend data model + generator

1. Add `TherapistWorkingHoursRule` to `schema.prisma` + migration.
2. Add `source`/`workingHoursRuleId` to `TherapistSlot` + migration.
3. Build a pure generator function: rules → concrete slot timestamps
   (porting the DST-safe logic from `recurring-slots.js`).
4. Build the materializer: rules → rolling-window `TherapistSlot` rows,
   idempotent, reusing the existing `P2002`-skip pattern.

### Phase 2: API routes

1. `GET /therapist/working-hours`
2. `PUT /therapist/working-hours` (triggers materializer run + safe
   prune/regeneration of `WORKING_HOURS`-sourced future `AVAILABLE` slots
   per the Generation Rules above)
3. Register both in `apps/api/src/app.ts`.

### Phase 3: Mobile UI

1. New "Arbeitszeiten" screen (see Mobile UX above).
2. Entry point from `TherapyTabTherapist.js`, alongside (not replacing)
   the existing "+ Termin" / Serie flow.

### Phase 4: Polish

1. Rename Sprechzeiten label (see above).
2. Optional: show structured working hours on the public therapist
   profile.
3. Tests: duplicate generation, rule changes against already-booked
   slots, DST transitions, rolling-window top-up behavior.

## Acceptance Criteria

1. A therapist can define recurring weekly working hours as rules.
2. The server materializes concrete, bookable `TherapistSlot` rows from
   those rules for a rolling window, without therapist action.
3. Re-running generation never creates duplicate slots.
4. Changing a rule never deletes or modifies an already-`BOOKED` slot.
5. Manually-created slots (`source === MANUAL`) are never touched by
   rule-driven regeneration.
6. Existing booking, search, and slot-management flows continue to work
   unchanged (`TherapistSlot` remains the single source of bookability
   truth).
7. DST transitions (CET↔CEST) produce correct local times, matching the
   coverage already proven in `recurring-slots.test.js`.

## Files Likely Involved

### Backend

- `apps/api/prisma/schema.prisma`
- `apps/api/src/routes/booking.ts` (new working-hours routes, or a new
  sibling route file)
- `apps/api/src/app.ts` (route registration)
- New: a generator/materializer module, e.g. under
  `apps/api/src/utils/` or `apps/api/src/services/`

### Shared

- `packages/shared/src/index.ts` (new working-hours rule contracts)
- Consider extracting the DST-safe generation logic from
  `apps/mobile/src/utils/recurring-slots.js` into `packages/shared` so the
  mobile client and the new server-side materializer share one
  implementation instead of two.

### Mobile

- New: an "Arbeitszeiten" screen/flow
- `apps/mobile/src/screens/therapy/TherapyTabTherapist.js` (entry point)
- `apps/mobile/src/i18n/translations.js` (`availabilityLabel` rename)
- `apps/mobile/src/screens/profile/TherapistDashboard.js` (Sprechzeiten
  field, if its surrounding copy/section needs adjusting alongside the
  rename)

## Explicit Non-Goals

- No payments, medical records, AI scheduling, or chat (Booking-MVP scope).
- No on-the-fly computed availability (Option B) — explicitly rejected for
  this stage.
- No removal of the Sprechzeiten field — rename/reframe only.
- No change to `POST /bookings`, `GET /therapists/:id/slots`, or any
  existing slot list/delete UI — Option A is chosen specifically so these
  stay untouched.
- No code has been written yet — this document describes the agreed
  direction, not a completed implementation.
