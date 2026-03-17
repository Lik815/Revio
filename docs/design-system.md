# Revio — Design System

This document defines the visual identity, color palette, typography, component guidelines, and design principles for all Revio surfaces.

---

## 1. Brand

### App Name
**Revio**

### Logo
Current MVP placeholder: the letter **R** — typeset in the primary color on a light or dark background.

A full logo is pending. Until delivered, the R placeholder must be used consistently across all surfaces: app icon, splash screen, navigation header, and any marketing materials. Do not substitute with wordmarks or other shapes.

---

## 2. Color Palette

### Light Mode

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Primary | Deep Teal | `#2F3E46` | Main actions, nav bar, primary buttons, headings |
| Secondary | Sage Green | `#84A98C` | Supporting elements, tags, badges, active states |
| Accent | Warm Amber | `#E9C46A` | Highlights, CTAs, status indicators, icons |
| Background | Off White | `#F6F7F9` | App background, screen surfaces |
| Text | Near Black | `#1B1F23` | Body text, labels, primary content |

### Dark Mode

| Role | Hex | Notes |
|------|-----|-------|
| Primary | `#84A98C` | Sage green becomes the primary accent on dark backgrounds |
| Secondary | `#2F3E46` | Deep teal used as a surface/card color |
| Accent | `#E9C46A` | Warm amber unchanged — maintains contrast on dark |
| Background | `#121A1E` | Deep near-black, derived from primary tint |
| Surface (cards) | `#1E2B31` | Slightly lighter than background for card separation |
| Text | `#F0F2F4` | Near white, softened to reduce eye strain |
| Muted text | `#8A9BA3` | Secondary labels, placeholders, captions |

Dark mode should follow the system preference by default (`Appearance: Automatic`) with a manual override available in app settings ("System", "Hell", "Dunkel").

---

## 3. Typography

Until a custom typeface is selected, use system fonts:
- **iOS:** SF Pro
- **Android:** Roboto

### Font Scale

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Heading 1 | 28px | Bold | Screen titles |
| Heading 2 | 22px | SemiBold | Section headers |
| Heading 3 | 18px | SemiBold | Card titles, profile names |
| Body | 15px | Regular | Main content text |
| Caption | 13px | Regular | Labels, meta info, timestamps |
| Button | 15px | SemiBold | All button labels |

---

## 4. Visual Tone

The visual language of Revio should feel:
- **Professional** — this is a healthcare-adjacent platform. The design must earn trust.
- **Calm** — no aggressive reds, no alarming contrasts. Patients may be in pain or distress.
- **Clear** — information hierarchy is always obvious. No decorative clutter in MVP.
- **Accessible** — all text on colored backgrounds must meet WCAG AA contrast ratios minimum.

### Avoid:
- Overly clinical / hospital aesthetics (white + blue + red)
- Playful or consumer-app-style design (rounded cartoon elements, bright gradients)
- Dense information layouts — whitespace is a trust signal here

---

## 5. Components

### Buttons

| Type | Light Mode | Dark Mode |
|------|-----------|-----------|
| Primary | `#2F3E46` bg, white label | `#84A98C` bg, `#121A1E` label |
| Secondary | Outlined, `#2F3E46` border | Outlined, `#84A98C` border |
| Accent CTA ("Kontaktieren") | `#E9C46A` bg, `#1B1F23` label | Same |

### Status Badges

| Status | Background | Text |
|--------|-----------|------|
| `APPROVED` | `#84A98C` | white |
| `PENDING_REVIEW` | `#E9C46A` | `#1B1F23` |
| `CHANGES_REQUESTED` | `#F4A261` | white |
| `REJECTED` | `#C1666B` | white |
| `SUSPENDED` | `#6B7280` | white |

### Cards

| Mode | Style |
|------|-------|
| Light | White (`#FFFFFF`) with subtle shadow |
| Dark | `#1E2B31` surface, no shadow, 1px border `#2A3B43` |

### Map Markers

| State | Pin Color | Icon |
|-------|----------|------|
| Default | `#2F3E46` | White R |
| Selected / Active | `#E9C46A` | `#1B1F23` R |

### Notification Badge
- Red dot: `backgroundColor: '#E74C3C'`, 10×10px, borderRadius 5
- Positioned top-right of the notification button
- Only shown when `notifications.length > 0`

---

## 6. Icons

- **Library:** `Ionicons` from `@expo/vector-icons`
- **Style:** Outline variants preferred (e.g. `notifications-outline`, `heart-outline`)
- **Sizes:** 16px (inline), 20px (tab bar), 24px (action buttons)
- **Colors:** Match the current theme's text or muted color

---

## 7. App Icon

The MVP app icon is the letter **R** centered on a `#2F3E46` background.

| Platform | Size | Notes |
|----------|------|-------|
| iOS | 1024×1024px | No rounded corners (App Store handles masking) |
| Android | 512×512px | Adaptive icon — foreground R on `#2F3E46`, background `#2F3E46` |

The R should be rendered in white (`#FFFFFF`) or `#E9C46A` for contrast.

Once the final logo is designed, all icon assets must be regenerated and a new app version submitted to both stores.

---

## 8. Splash Screen

| Property | Value |
|----------|-------|
| Background | `#2F3E46` |
| Content | Centered R mark in white or `#E9C46A` |
| Loading | No spinner — short fade to home screen |
| Dark mode | Same (splash is always dark regardless of system preference) |

---

## 9. Logo in Navigation

- `logo.png` (with transparent background) in `assets/logo.png`
- Used in all header bars across the mobile app
- Sized proportionally within the header height
- Tinted to match theme where appropriate
