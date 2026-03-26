# Revio Mobile — UI Refactor Prompt for Codex

## Context

You are refactoring the UI of a React Native / Expo healthcare app for physiotherapists and patients in Germany. The app must feel **calm, premium, trustworthy, and minimal** — like a high-quality medical product, not a marketplace app.

The codebase is a monorepo under `apps/mobile/src/`. The relevant files are:

- `apps/mobile/src/App.js` — Main app file with COLORS, StyleSheet, and all core screens (~3800 lines)
- `apps/mobile/src/mobile-discover-screen.js` — Patient-facing search & discovery screen
- `apps/mobile/src/mobile-therapist-dashboard.js` — Therapist profile & practice management
- `apps/mobile/src/mobile-manager-dashboard.js` — Practice manager dashboard
- `apps/mobile/src/mobile-therapist-screens.js` — Login, onboarding, practice creation screens
- `apps/mobile/src/mobile-utils.js` — Shared utilities and constants

**Do not change any API calls, data logic, navigation structure, or business logic. Only change visual styling, layout, and component structure.**

---

## 1. Design Token System

### 1.1 Replace the COLORS object in App.js

Find the existing `COLORS` light/dark object and replace it with this expanded version:

```js
const COLORS = {
  light: {
    background:   '#F5F7F8',
    bgElevated:   '#FFFFFF',
    text:         '#1C2B33',
    textMuted:    '#6B838E',
    primary:      '#3E6271',
    primaryBg:    '#EBF2F5',
    accent:       '#5A9E8E',
    accentBg:     '#EAF4F1',
    card:         '#FFFFFF',
    border:       '#D4DEE3',
    muted:        '#A7B6BE',
    mutedBg:      '#EDF2F4',
    nav:          '#FFFFFF',
    success:      '#5A9E8E',
    successBg:    '#EAF4F1',
    error:        '#B94040',
    errorBg:      '#FBEAEA',
    warning:      '#8A6000',
    warningBg:    '#FEF5DC',
    saved:        '#D0526A',
  },
  dark: {
    background:   '#111A1F',
    bgElevated:   '#1A2630',
    text:         '#E8EEF1',
    textMuted:    '#7A9099',
    primary:      '#6B8FA0',
    primaryBg:    '#1A2E38',
    accent:       '#6FB8A8',
    accentBg:     '#1A2E2A',
    card:         '#1A2630',
    border:       '#2A3A44',
    muted:        '#7A9099',
    mutedBg:      '#1E2E38',
    nav:          '#151F26',
    success:      '#6FB8A8',
    successBg:    '#1A2E2A',
    error:        '#D46060',
    errorBg:      '#2E1A1A',
    warning:      '#C49A30',
    warningBg:    '#2A2010',
    saved:        '#E07090',
  },
}
```

Replace all hardcoded hex values throughout the codebase with the appropriate COLORS token. Specifically replace:
- `#E74C3C` → `C.error`
- `#FDECEA` → `C.errorBg`
- `#E05A77` → `C.saved`
- `#9ca3af` → `C.muted`
- `#506d7a` → `C.primary`
- `#1B1F23` → use `C.text` or `'#FFFFFF'` depending on background
- `#FFF8E1` → `C.warningBg`
- `#795548` → `C.warning`
- `#F57F17` → `C.warning`

---

### 1.2 Add spacing and radius constants after COLORS

```js
const SPACE = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
}

const RADIUS = {
  sm:   10,
  md:   16,
  lg:   20,
  full: 999,
}

const SHADOW = {
  card: {
    shadowColor: '#1C2B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#1C2B33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
}
```

---

### 1.3 Replace the font size scale

There are currently 14+ font sizes in use (8, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 24, 28). Consolidate to 6:

```js
const TYPE = {
  xl:      { fontSize: 26, fontWeight: '800', lineHeight: 34 },  // Hero titles
  lg:      { fontSize: 20, fontWeight: '700', lineHeight: 28 },  // Section titles, modal headers
  heading: { fontSize: 17, fontWeight: '600', lineHeight: 24 },  // Card titles, button labels
  body:    { fontSize: 15, fontWeight: '400', lineHeight: 22 },  // Body text, inputs
  meta:    { fontSize: 13, fontWeight: '500', lineHeight: 18 },  // Tags, secondary info
  label:   { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' }, // Section labels
}
```

Map existing sizes:
- `fontSize: 28` → `TYPE.xl`
- `fontSize: 24, 22` → `TYPE.lg`
- `fontSize: 20, 17` → `TYPE.lg` or `TYPE.heading`
- `fontSize: 16, 15` → `TYPE.heading` or `TYPE.body`
- `fontSize: 14, 13` → `TYPE.body` or `TYPE.meta`
- `fontSize: 12, 11` → `TYPE.meta` or `TYPE.label`
- `fontSize: 10, 8` → `TYPE.label`

---

## 2. StyleSheet Fixes

### 2.1 Fix all touch targets to minimum 44pt

Find every `paddingVertical` on interactive elements that is less than 10 and increase it. Specifically:

```js
// Fix nav items
navItem: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 10, minHeight: 44 }

// Fix kassenart buttons
kassenartBtn: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44 }

// Fix filter buttons
filterBtn: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44 }

// Fix all chip-style buttons
chip: { borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 9, minHeight: 36 }
```

Also add `hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}` to all icon-only `TouchableOpacity` elements (heart/favorite, back buttons, close buttons).

---

### 2.2 Normalize borderRadius

Replace all borderRadius values using RADIUS constants:
- `borderRadius: 6` → `RADIUS.sm` (only for checkboxes)
- `borderRadius: 10` → `RADIUS.sm`
- `borderRadius: 12` → `RADIUS.md`
- `borderRadius: 14` → `RADIUS.md`
- `borderRadius: 16` → `RADIUS.md`
- `borderRadius: 18` → `RADIUS.lg`
- `borderRadius: 20` → `RADIUS.lg`
- `borderRadius: 999` → `RADIUS.full`

---

### 2.3 Standardize CTA button text color

Find all `ctaBtnText` and `registerBtnText` style definitions and ensure button text on colored backgrounds is always `color: '#FFFFFF'`. Remove `color: '#1B1F23'` from button text styles.

```js
ctaBtnText: { ...TYPE.heading, color: '#FFFFFF' }
registerBtnText: { ...TYPE.heading, color: '#FFFFFF' }
```

---

### 2.4 Increase card padding and spacing

```js
resultCard:  { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, gap: 14 }
infoCard:    { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 10 }
infoSection: { borderWidth: 1, borderRadius: RADIUS.md, padding: 18, gap: 10 }
scrollContent: { padding: 24, gap: 16 }
```

---

## 3. Component Changes

### 3.1 Add SkeletonCard component to App.js

Add this component near the other card components:

```jsx
function SkeletonCard({ C }) {
  return (
    <View style={{
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: RADIUS.lg,
      padding: 18,
      gap: 14,
      backgroundColor: C.card,
    }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 56, height: 56, borderRadius: RADIUS.full, backgroundColor: C.mutedBg }} />
        <View style={{ gap: 8, flex: 1 }}>
          <View style={{ height: 16, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '55%' }} />
          <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '35%' }} />
        </View>
      </View>
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg }} />
      <View style={{ height: 12, borderRadius: RADIUS.sm, backgroundColor: C.mutedBg, width: '70%' }} />
      <View style={{ height: 42, borderRadius: RADIUS.md, backgroundColor: C.mutedBg }} />
    </View>
  )
}
```

In `mobile-discover-screen.js`, find the results rendering section. Where results are shown, add a loading state:

```jsx
{loading
  ? [1, 2, 3].map(i => <SkeletonCard key={i} C={C} />)
  : results.map(t => <ResultCard ... />)
}
```

---

### 3.2 Reduce Result Card information density

In `mobile-discover-screen.js`, find the result card render function and make these changes:

**Avatar size:** Increase from `width: 52, height: 52` to `width: 60, height: 60, borderRadius: RADIUS.full`

**Specialization chips:** Show maximum 2 chips, then show an overflow badge:
```jsx
{specializations.slice(0, 2).map(s => (
  <View key={s} style={[styles.tag, { backgroundColor: C.primaryBg }]}>
    <Text style={[styles.tagText, { color: C.primary }]}>{s}</Text>
  </View>
))}
{specializations.length > 2 && (
  <View style={[styles.tag, { backgroundColor: C.mutedBg }]}>
    <Text style={[styles.tagText, { color: C.textMuted }]}>+{specializations.length - 2}</Text>
  </View>
)}
```

**Remove language chips from result cards.** Languages should only appear in the full profile/detail view, not on the search result card.

**Call button:** Make it full width at the bottom of the card:
```jsx
<TouchableOpacity style={{
  backgroundColor: C.primary,
  borderRadius: RADIUS.md,
  paddingVertical: 12,
  alignItems: 'center',
  marginTop: 2,
}}>
  <Text style={{ ...TYPE.heading, color: '#FFFFFF' }}>Anrufen</Text>
</TouchableOpacity>
```

---

### 3.3 Discover Screen Header — 2-row layout

In `mobile-discover-screen.js`, restructure the header into two clear rows:

**Row 1:** Search input + filter icon button
**Row 2:** Location chip + radius chip + list/map toggle (compact, right-aligned)

The result count text (`X Therapeuten gefunden`) should use `TYPE.meta` and `C.textMuted` — not a prominent style.

Location and radius should appear as compact pill-chips:
```jsx
<TouchableOpacity style={{
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: RADIUS.full,
  paddingHorizontal: 12,
  paddingVertical: 7,
}}>
  <Ionicons name="location-outline" size={13} color={C.textMuted} />
  <Text style={{ ...TYPE.meta, color: C.textMuted }}>{city}</Text>
</TouchableOpacity>
```

---

### 3.4 Active filter indicator

The filter badge showing how many filters are active is currently `16×16`. Increase to `20×20`:

```js
filterBadge: {
  position: 'absolute',
  top: 4, right: 4,
  width: 20, height: 20,
  borderRadius: RADIUS.full,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: C.primary,
}
filterBadgeText: { ...TYPE.label, color: '#FFFFFF', fontSize: 11 }
```

Also add a visible "Filter aktiv" text label next to the filter button when any filter is active (not just the badge).

---

### 3.5 Therapist Dashboard — Status section

In `mobile-therapist-dashboard.js`, find the status display at the top of `TherapistDashboardScreen`. Replace the single status badge with a 2×2 status grid showing four separate state cards:

```jsx
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
  {/* Review Status */}
  <StatusMiniCard
    icon="shield-checkmark-outline"
    label="Prüfstatus"
    value={reviewStatusLabel}
    color={reviewStatusColor}
  />
  {/* Public visibility */}
  <StatusMiniCard
    icon="eye-outline"
    label="Sichtbar"
    value={isVisible ? 'Ja' : 'Versteckt'}
    color={isVisible ? C.success : C.muted}
  />
  {/* Practice linked */}
  <StatusMiniCard
    icon="business-outline"
    label="Praxis"
    value={hasPractice ? 'Verknüpft' : 'Fehlt'}
    color={hasPractice ? C.success : C.warning}
  />
  {/* Documents */}
  <StatusMiniCard
    icon="document-outline"
    label="Nachweise"
    value={hasDocuments ? 'Vorhanden' : 'Fehlen'}
    color={hasDocuments ? C.success : C.warning}
  />
</View>
```

Add the `StatusMiniCard` component:
```jsx
function StatusMiniCard({ icon, label, value, color, C }) {
  return (
    <View style={{
      flex: 1,
      minWidth: '45%',
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: RADIUS.md,
      padding: SPACE.md,
      gap: SPACE.xs,
      backgroundColor: C.card,
    }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ ...TYPE.label, color: C.textMuted }}>{label}</Text>
      <Text style={{ ...TYPE.meta, color: color, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}
```

---

### 3.6 Manager Dashboard — Prioritized block order

In `mobile-manager-dashboard.js`, reorder the sections in the render output to:

1. Active practice card (most important)
2. Team / therapists list
3. Own therapist profile (collapsed by default if already complete)
4. Secondary admin actions (invite, manage)
5. Destructive actions (delete practice etc.) — move to the very bottom, add visual separation with a `marginTop: SPACE.xl` and use `C.error` color for destructive buttons

---

### 3.7 Registration Step 3 — Split into required and optional

In `App.js`, find the registration step that contains Spezialisierungen, Sprachen, and Fortbildungen. Make these changes:

- Add a clear section divider between required and optional fields:
```jsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginVertical: SPACE.lg }}>
  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
  <Text style={{ ...TYPE.label, color: C.textMuted }}>Optional</Text>
  <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
</View>
```

- Mark "Sprachen" as required (keep at top, add a small `*` or "Pflicht" label)
- Mark "Fortbildungen / Zertifikate" as clearly optional
- Fortbildungen section should be collapsible — collapsed by default, expand on tap

---

## 4. Empty States

### 4.1 Shorten empty state body text

Find all `emptyBody` text elements. Any body text longer than 1 sentence should be reduced to one short sentence. The action buttons should be the focus, not the explanation.

Example:
```jsx
// Before (too long):
"Wir haben keine Therapeuten gefunden, die zu deiner Suche passen. Versuche andere Suchbegriffe oder erweitere deinen Suchradius."

// After (short + action-focused):
"Keine Treffer — andere Stadt oder weiteren Radius versuchen."
```

---

## 5. Error and Warning States

### 5.1 Replace all hardcoded error colors

Find all instances of `backgroundColor: '#FDECEA'` or `color: '#E74C3C'` or similar hardcoded error colors and replace with `C.errorBg` / `C.error`.

Find all instances of `backgroundColor: '#FFF8E1'` or `color: '#795548'` and replace with `C.warningBg` / `C.warning`.

---

### 5.2 Soften error message language

Find error `Text` elements that contain words like "Fehler", "Error", "ungültig" and replace with softer German phrasing:
- "Fehler beim Laden" → "Konnte nicht geladen werden – bitte erneut versuchen"
- "Ungültige E-Mail" → "Bitte eine gültige E-Mail eingeben"
- "Etwas ist schiefgelaufen" → "Hat nicht geklappt – bitte nochmal versuchen"

---

## 6. Navigation Bar

### 6.1 Increase nav label size

```js
navLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 }
```

### 6.2 Strengthen active tab indicator

The active tab currently uses only a background pill. Add a colored icon tint to make the active state more obvious:

```jsx
<Ionicons
  name={active ? icon : `${icon}-outline`}
  size={22}
  color={active ? C.primary : C.muted}
/>
```

---

## 7. Admin Dashboard (Next.js)

In `apps/admin/app/(admin)/therapists/page.tsx` and the therapist detail page:

### 7.1 Add real visibility status

Next to the `reviewStatus` badge, add a second badge showing actual public visibility:

- `APPROVED` + `isVisible: true` → green "Öffentlich sichtbar" badge
- `APPROVED` + `isVisible: false` → orange "Freigegeben, aber versteckt" badge
- Any other status → grey "Nicht öffentlich" badge

This requires reading the `isVisible` field from the therapist API response. It is already available in the admin endpoints.

### 7.2 Show blockers inline

If a therapist is `APPROVED` but not actually publicly searchable (e.g. missing required fields, `isVisible: false`, no practice linked), show a compact warning box:

```tsx
{isApprovedButNotVisible && (
  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
    <strong>Nicht sichtbar weil:</strong> {blockerReasons.join(', ')}
  </div>
)}
```

---

## 8. Constraints

- Do NOT change any API call URLs, parameters, or response handling
- Do NOT change navigation structure or screen names
- Do NOT change any text content or labels that are user-visible product copy (only error message phrasing as noted in section 5.2)
- Do NOT add new npm dependencies
- Do NOT change the file structure — all changes within the existing files
- Maintain full dark mode support for every change — every new color must read from `C` (the current color scheme), not hardcoded
- All new `TouchableOpacity` elements must have `activeOpacity={0.75}`
