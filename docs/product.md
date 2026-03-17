# Revio — Product Definition

## 1. Purpose

**Revio helps patients find the right physio for their specific need — more clearly, more specifically, and with more trust than generic search tools.**

Revio is a therapist discovery platform focused on helping patients find the right physiotherapist based on their problem, location, and practical needs.

The MVP is designed for Germany, starting in Cologne, and focuses only on physiotherapy.

Revio is **not** a diagnostic tool, **not** a medical records platform, and **not** a treatment recommendation engine.

---

## 2. MVP Scope

### Core Goal
Help patients find the right physiotherapist quickly and more specifically than generic search engines or map listings.

### Core Features
- Search by problem
- Filters for therapist discovery (specialization, language, home visit, distance, kassenart)
- Map-based results
- Therapist profile pages
- Practice profile pages
- Therapist self-registration
- Practice linking (new / existing / skip)
- Manual verification before public publishing

### Geographic Scope
- Country: Germany
- Launch city: Cologne

### Professional Scope
MVP: Physiotherapists only.

Future categories may include: occupational therapists, speech therapists, podiatrists, nutrition professionals, psychotherapists, sports scientists.

---

## 3. User Roles

### 3.1 Patient / Visitor
A person searching for a physiotherapist.

**Can:**
- Search by problem
- Use filters
- Browse map
- View therapist and practice profiles
- Click to contact externally

**Cannot / does not need:**
- No account required
- No patient history stored
- No diagnostic features

### 3.2 Therapist
A physiotherapist creating and managing their professional listing.

**Can:**
- Register by email
- Create personal profile (photo, bio, specializations, education, languages)
- Upload profile photo
- Connect to one or more practices
- Submit profile for review
- Toggle visibility (`isVisible`)
- Set availability and kassenart

**Cannot:**
- Self-approve public status
- Create unreviewed practice claims

### 3.3 Practice
A clinic or business location associated with one or more therapists.

**Can:**
- Appear as linked practice on therapist profiles
- Have logo, address, photos, website, phone, opening hours
- Be displayed on the map

**Cannot:**
- Be published without review
- Have unvalidated location data in listing

### 3.4 Admin / Reviewer
Internal Revio role responsible for trust and quality.

**Can:**
- Review therapist and practice submissions
- Approve, reject, or request changes to profiles
- Resolve duplicates
- Moderate content
- Manage category mapping

**Cannot:**
- Edit clinical claims in misleading ways
- Publish unverifiable profiles without review

---

## 4. Product Principles

1. **Discovery First** — Help patients find the right physio based on need, not just proximity
2. **Privacy by Design** — Collect as little user data as possible, especially on the patient side
3. **Therapist Trust First** — Therapist onboarding and profile quality are first-class priorities
4. **Clarity Over Complexity** — Keep the system simple, auditable, and limited in scope
5. **Human Review for Trust** — All public professional profiles must be manually reviewed before going live. No exceptions.

---

## 5. Explicit Non-Goals (MVP)

The MVP does **not** include:
- Patient accounts
- Patient medical records
- Diagnostic output
- Treatment plans
- AI-generated medical advice
- Public ratings and reviews
- In-app appointment booking
- Payment processing
- Insurance workflows

---

## 6. Core Workflows

### Patient Search
1. Visitor opens Revio
2. Enters a problem or need + location
3. Search normalizes query and ranks results
4. Map displays approved practices as pins
5. Visitor opens therapist or practice profile
6. Visitor contacts practice externally (phone, website)
7. **No account required at any step**

### Therapist Onboarding
1. Therapist registers by email
2. Draft account created
3. Completes profile progressively (photo, specializations, education, languages)
4. Links to one or more practices (new / existing / skip)
5. Submits profile for review
6. Enters verification + moderation queue
7. Admin approves, rejects, or requests changes
8. Profile becomes publicly visible **only** after `APPROVED` status

### Practice Creation & Linking
1. Therapist adds a new or existing practice during onboarding
2. Practice details entered (name, address, contact, hours, media)
3. Address validated and geocoded
4. Link stored as `PROPOSED`
5. Admin reviews practice and link
6. Practice and link become publicly visible only after approval

### Profile Update
1. Therapist edits profile fields
2. Minor changes (description, languages) stored immediately
3. Significant changes (specializations, photo, qualifications) should trigger re-review
4. Public profile updates only after re-approval if re-review is required

---

## 7. Privacy & Compliance

### Patient Side — DO NOT:
- Require patient account creation for search
- Store patient medical histories, diagnoses, insurance details
- Track precise visitor location without explicit consent
- Convert search behavior into hidden patient profiles
- Persist search queries in a user-specific way
- Store patient images of any kind

### Therapist Side — ALLOWED:
- Email, auth data, professional name, photo, specializations, education, languages, linked practices, bio, home visit, kassenart, availability

### Location Principle
Location may only be used when the user explicitly enters it or explicitly consents to location access. Never store passively.

### Publication Principle
Only reviewed and approved profiles should be publicly visible. No exceptions.

### Media Principle
No patient-identifiable content allowed in any uploaded profile media.

### Logging Principle
Operational logs should support security and QA but avoid storing sensitive query context tied to identifiable individuals.

---

## 8. System Guardrails

### Medical
- Never diagnose conditions
- Never triage emergencies
- Never recommend treatment plans
- Never claim outcome guarantees
- Never replace professional clinical judgment

### Trust
- Never auto-publish unverifiable professionals
- Never allow false specialization claims without review
- Never display fake or inflated credentials

### Privacy
- Never require patient account creation for search
- Never store patient medical histories
- Never track precise visitor location without explicit consent
- Never convert search behavior into hidden patient profiles

---

## 9. Success Criteria

The MVP succeeds if:
- Therapists can register and create verified professional profiles
- Practices are clearly represented and mapped
- Patients can search by problem without creating an account
- Users can filter relevant physiotherapists meaningfully
- Result quality feels more specific than a generic search engine
- Profile quality is trustworthy and consistent
- No patient-data-heavy system is required to deliver value

---

## 10. Future Expansions (Post-MVP)

These are explicitly out of MVP scope:
- **Booking** — appointment booking (requires consent flows, cancellation rules, notifications)
- **Availability** — show real-time availability in search results
- **Patient Reviews** — verified patient reviews and trust signals
- **Recommendations** — personalization beyond specialization matching
- **Multi-Discipline** — expand from physiotherapy to occupational therapy, speech therapy, etc.
- **Practice Accounts** — separate login for practice owners
- **Premium Placement** — featured listings (requires ranking transparency rules)

### Open Questions
**Resolve before build:**
- Should free-text search be combined with predefined problem categories?
- How should duplicate therapist or practice profiles be detected and merged?

**Can be deferred to post-launch:**
- When should booking be introduced?
- Will reviews be public, verified-only, or invitation-based?
- Will search analytics be stored, and if so, only in aggregated form?
