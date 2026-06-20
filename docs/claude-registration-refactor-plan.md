# Claude Handoff: Registration Refactor Plan

## Goal

Refactor the mobile registration entry and flow so the therapist-facing landing page and the actual registration flow feel like one coherent system instead of two separately built experiences.

This is a planning-only handoff. Do not change product scope. Prefer small, safe extractions over a visual rewrite.

## Active Context

Relevant active files:

- `apps/mobile/src/screens/profile/ProfileScreen.js`
- `apps/mobile/src/screens/auth/TherapistLandingScreen.js`
- `apps/mobile/src/navigation/screens/RegistrationRouteScreen.js`
- `apps/mobile/src/screens/auth/registration/RegistrationFlow.js`
- `apps/mobile/src/screens/auth/registration/steps/RoleSelectStep.js`
- `apps/mobile/src/screens/auth/registration/steps/AccountCreateStep.js`
- `apps/mobile/src/screens/auth/registration/steps/OtpVerifyStep.js`
- `apps/mobile/src/screens/auth/registration/steps/BasicProfileStep.js`
- `apps/mobile/src/screens/auth/registration/steps/EmploymentStep.js`
- `apps/mobile/src/screens/auth/registration/steps/SpecializationsStep.js`
- `apps/mobile/src/screens/auth/LoginScreen.js`
- `apps/mobile/src/styles/app-styles.js`
- `apps/mobile/src/i18n/translations.js`

Important repo guardrails from `CLAUDE.md`:

- Confirm active behavior in active navigation and runtime entrypoints.
- Do not extend large legacy mobile files blindly.
- Respect the existing mobile structure: screens, components, hooks, context, navigation, styles.
- Keep app UI German-only.

## Current Problem

The current therapist registration experience is split into two UI layers:

1. `TherapistLandingScreen` acts as a polished public entry screen inside the profile tab.
2. `RegistrationFlow` is a separate full-screen stack flow with its own layout, spacing, and step framing.

This creates three UX/code issues:

1. Visual duplication: landing, login, and registration steps each define their own headings, card rows, spacing, and CTA styles inline.
2. Structural mismatch: the public therapist CTA enters a generic role-based registration flow, even though the entry point already implies therapist intent.
3. Refactor friction: step components are reasonably separated, but shared auth/onboarding layout primitives are not.

## Refactor Objective

Create a shared registration/auth shell and shared entry-section components so the therapist landing page, login screen, and registration steps can reuse the same building blocks.

The first refactor should improve structure, not product behavior. Only after the structure is clean should behavior changes like skipping redundant steps be considered.

## Non-Goals

Do not:

- redesign the full onboarding flow from scratch
- change backend registration rules
- merge patient and therapist business logic
- alter OTP behavior
- add new product copy unless needed for consistency
- move flow state out of `RegistrationFlow` in the first pass

## Recommended Refactor Phases

### Phase 1: Extract shared auth/onboarding UI primitives

Create a small set of reusable mobile components for auth/registration screens.

Suggested components:

- `AuthScreenShell`
  - owns `ScrollView` or `View` framing, horizontal padding, safe vertical spacing, and optional back button
- `AuthHero`
  - title, subtitle, optional centered layout, optional brand row
- `AuthFeatureList`
  - renders the icon/title/body rows currently hardcoded in `TherapistLandingScreen`
- `AuthPrimaryButton`
  - wraps existing `styles.registerBtn` usage
- `AuthSecondaryButton`
  - consistent secondary CTA style
- `AuthInlineLink`
  - for “Bereits ein Konto? Anmelden”

Keep these in a focused location like:

- `apps/mobile/src/components/auth/`

Do not over-abstract. Only extract what is already duplicated or clearly becoming duplicated.

### Phase 2: Move inline styles out of entry screens

Reduce heavy inline styling in:

- `TherapistLandingScreen.js`
- `LoginScreen.js`
- `RoleSelectStep.js`
- `AccountCreateStep.js`

Not every style needs to go into `app-styles.js`, but repeated auth/registration patterns should get named styles or component-owned style objects.

Target outcome:

- fewer one-off paddings and font weights inside screens
- clearer semantic distinction between layout and behavior
- easier visual comparison between landing and registration

### Phase 3: Align the entry experience with the actual flow

After shared primitives exist, make the public therapist entry and the registration flow read like one experience.

Recommended sequence:

1. Rebuild `TherapistLandingScreen` with the shared shell/hero/feature components.
2. Rebuild the initial registration step framing with the same shell/hero language.
3. Align login screen framing to the same auth system.

This phase can be visual-only first.

### Phase 4: Decide whether to remove the redundant role step for therapist entry

Only after Phase 1 to 3 are complete, evaluate a small behavior refinement:

- If the user comes from `TherapistLandingScreen`, consider entering `RegistrationFlow` with an initial therapist context instead of forcing the role selection again.

This should be treated as a separate, explicit decision because it changes navigation behavior, even if slightly.

If implemented, do it via route params and keep the generic role step intact for other entry points.

## Proposed File-Level Plan

### New files

Possible additions:

- `apps/mobile/src/components/auth/AuthScreenShell.js`
- `apps/mobile/src/components/auth/AuthHero.js`
- `apps/mobile/src/components/auth/AuthFeatureList.js`
- `apps/mobile/src/components/auth/AuthPrimaryButton.js`
- `apps/mobile/src/components/auth/AuthSecondaryButton.js`
- `apps/mobile/src/components/auth/AuthInlineLink.js`

### Existing files to simplify

- `apps/mobile/src/screens/auth/TherapistLandingScreen.js`
  - should become mostly composition
- `apps/mobile/src/screens/auth/LoginScreen.js`
  - should reuse shell + hero + CTA primitives where possible
- `apps/mobile/src/screens/auth/registration/steps/RoleSelectStep.js`
  - align visual language with landing
- `apps/mobile/src/screens/auth/registration/steps/AccountCreateStep.js`
  - align with shared auth layout
- `apps/mobile/src/styles/app-styles.js`
  - add only shared auth style tokens/classes that genuinely improve reuse

### Files to leave mostly untouched in first pass

- `RegistrationFlow.js`
  - keep state ownership local
- OTP/business logic files
  - avoid mixing UI refactor with logic changes

## Acceptance Criteria

The refactor is successful if:

1. `TherapistLandingScreen`, `LoginScreen`, and the first registration screens share the same framing primitives.
2. Repeated auth UI no longer lives as large inline blocks across multiple files.
3. `RegistrationFlow` remains the owner of registration state and network actions.
4. No backend/API behavior changes are required for the structural refactor.
5. Navigation behavior stays unchanged unless a separate follow-up intentionally introduces therapist-prefilled entry.

## Implementation Order

Recommended order for Claude:

1. Extract shared auth components.
2. Refactor `TherapistLandingScreen` to use them.
3. Refactor `LoginScreen` to use them.
4. Refactor `AccountCreateStep` and `RoleSelectStep` to use them.
5. Compare all affected screens visually for spacing, typography, CTA consistency, and back-button behavior.
6. Only then decide whether therapist entry should bypass the role-selection step.

## Risk Notes

- The biggest risk is over-abstracting too early and creating generic components that only fit one screen.
- The second risk is mixing structural cleanup with navigation behavior changes in the same PR.
- The third risk is reintroducing safe-area/header inconsistencies; keep using the shared `BackButton`.

## Suggested PR Split

If possible, split into two PRs:

1. `refactor/mobile-auth-shell`
   - shared components
   - landing/login/step visual refactor
   - no behavior changes

2. `feat/mobile-therapist-registration-entry`
   - optional route-param-based therapist preselection
   - only if desired after the structural cleanup

