# CLAUDE.md — Revio Agent Reference

Short operating reference for coding agents working on Revio.

This file is intentionally small. Use it for orientation and guardrails, not as a full product or architecture spec.

## 1. Source-of-Truth Order

When sources disagree, use this order:

1. Active code and registered runtime entrypoints
2. This file for agent rules and current MVP guardrails
3. Focused docs in `docs/`
4. `history.md` only as archive, never as active product truth

Check active behavior in:

- `package.json`
- `pnpm-workspace.yaml`
- `apps/api/src/app.ts`
- active mobile entry/navigation files
- active admin routes
- Prisma schema and migrations

## 2. Current Product Guardrails

Revio is currently a Booking-MVP.

Core MVP:

- public therapist discovery
- patient registration and login
- appointment booking or booking requests
- patient appointment overview
- freelance therapist self-registration
- therapist profile and availability management
- admin review and approval workflows

Out of scope for MVP:

- payments
- reviews
- medical records
- AI diagnosis
- AI treatment plans
- in-app chat
- video consultations

Registration rule:

- patients can self-register
- freelance therapists can self-register
- non-freelance therapists must not self-register as public providers

## 3. Repo Map

- `apps/api`: Fastify backend, Prisma, booking and auth logic
- `apps/admin`: Next.js admin dashboard
- `apps/mobile`: Expo / React Native mobile app
- `apps/site`: marketing site
- `packages/shared`: shared types and contracts

## 4. Working Rules

- Do not assume a route is active because a file exists. Confirm it is registered in `apps/api/src/app.ts`.
- Do not blindly extend large legacy mobile files. Prefer extracting screens, services, hooks, or helpers first.
- When developing the React/React Native apps, respect the existing structure (screens, components, hooks, context, navigation, styles). Place new code in the matching folder instead of growing one file or bypassing established patterns.
- Keep patient data minimal and access-controlled.
- Public provider visibility requires approval or another explicit trust gate verified in active code.
- Do not introduce payments, reviews, or medical-data features while working on MVP code.
- Keep app UI German-only unless the active code clearly supports another language strategy.
- Do not use emojis in app UI copy.

## 5. Testing Expectations

For behavior changes, prefer verifying:

- auth flow affected by the change
- booking or slot integrity
- role and permission boundaries
- public visibility and approval logic

Useful commands:

```sh
pnpm install
pnpm build
pnpm --filter @revio/api test
pnpm --filter @revio/api typecheck
pnpm --filter @revio/admin build
pnpm --filter @revio/site build
```

## 6. Docs To Open On Demand

Open only the focused doc you need:

- `docs/data-model.md`: entities and relationships
- `docs/search-ranking.md`: search behavior
- `docs/design-system.md`: visual rules
- `docs/email-setup.md`: email configuration
- `docs/freelancer-first-appointment-mvp.md`: freelancer booking blueprint
- `docs/plattform-architektur-reverse-engineering.md`: long-form architecture notes

Treat `history.md` as archive only.

## 7. Maintenance Rule

Keep this file short. If a section starts becoming detailed product or architecture documentation, move that detail into `docs/` and leave only a one-line pointer here.
