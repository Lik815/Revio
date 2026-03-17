# Revio — Search & Ranking

This document defines how search works: query processing, relevance scoring, filtering, suggestions, and result display.

Source of truth: `apps/api/src/routes/search.ts` + `apps/api/src/utils/search-utils.ts`

---

## 1. Search Input

Patients search by entering a **problem, need, or intent** plus a **city**.

Examples:
- "Rückenschmerzen" + "Köln"
- "Knieschmerzen" + "Köln"
- "Neurologische Reha" + "Köln"
- "Sportphysiotherapie" + "Köln"

The search input is treated as **transient discovery context**, not as a medical record.

### API Endpoint
`POST /search`

```typescript
{
  query: string,         // required, min 1 char
  city: string,          // required, min 1 char — exact match (case-insensitive)
  language?: string,     // optional filter
  homeVisit?: boolean,   // optional filter
  specialization?: string, // optional filter
  kassenart?: string,    // optional filter
}
```

---

## 2. Query Normalization

All search text is normalized before matching via `normalizeText()`:

1. Lowercase
2. Replace German umlauts: ä→ae, ö→oe, ü→ue, ß→ss
3. Strip diacritics (NFD + remove combining marks)
4. Trim whitespace

This ensures "Rücken", "ruecken", and "Rücken" all match the same entries.

### Generic Queries
These terms are treated as "match all therapists" (score = 1):
`physiotherapie`, `physio`, `therapeut`, `physiotherapeut`, `krankengymnastik`

---

## 3. Relevance Scoring

Each therapist is scored against the normalized query. Higher score = higher rank.

### Score Tiers (highest → lowest)

| Score | Match Type |
|-------|-----------|
| 10 | Exact therapist name match |
| 9 | Prefix match on therapist name |
| 8.5 | Substring match on therapist name |
| 8 | Exact practice name match |
| 7 | Prefix match on practice name |
| 6.5 | Substring match on practice name |
| 6 | Exact specialization match |
| 5 | Partial specialization match (e.g. "rücken" ↔ "rückenschmerzen") |
| 4 | Word-level specialization match (compound terms) |
| 3 | Certification match |
| 2 | Bio or name contains query |
| 1 | Generic query (all therapists qualify) |
| 0.5 | Base score for approved therapists (no match) |

### Match Scoring Utility (`scoreMatch`)

| Score | Condition |
|-------|-----------|
| 10 | Full exact match |
| 9 | Exact word match within string |
| 7 | Prefix of full string |
| 6 | Prefix of any word |
| 4 | Substring of full string |
| 3 | Substring of any word |
| 0 | No match |

---

## 4. Filters

Filters are applied **before** scoring. A therapist must pass all active filters to be included.

| Filter | Match Logic | Required |
|--------|-------------|:---:|
| `city` | Case-insensitive exact match | ✅ |
| `language` | Must be in therapist's languages list | ❌ |
| `homeVisit` | Must match therapist's homeVisit boolean | ❌ |
| `specialization` | Must be in therapist's specializations list | ❌ |
| `kassenart` | Must match therapist's kassenart value | ❌ |

### Visibility Rules
Only therapists matching **all** of these criteria appear in results:
- `reviewStatus === 'APPROVED'`
- `isVisible === true`
- City matches the search city
- All active filters pass

### Practice Visibility in Results
Only practices with:
- `reviewStatus === 'APPROVED'`
- Link status `CONFIRMED`
are included in a therapist's result.

---

## 5. Result Structure

Results are sorted by `relevance` (descending).

```typescript
{
  therapists: SearchTherapist[],  // Ranked list
  practices: SearchPractice[],    // Deduplicated from all results
}
```

Each `SearchTherapist` includes:
- Profile fields (name, title, specializations, languages, bio, photo, etc.)
- `relevance` score
- `practices[]` — linked approved practices with geo data

Each `SearchPractice` includes:
- Name, city, address, phone, hours, description
- `lat`, `lng` — for map markers
- Logo, photos

---

## 6. Suggestions / Autocomplete

### API Endpoint
`GET /suggest?q=<query>`

- Minimum 3 characters required
- Searches `SearchSuggestion` table by normalized text (contains match)
- Groups results by type: `THERAPIST_NAME`, `PRACTICE_NAME`, `SPECIALTY`, `CITY`
- Max 3 per type, 10 total
- Ranked by `scoreMatch() × weight`

---

## 7. Practice Search (Registration)

During registration, therapists can search for existing practices to link to.

### API Endpoint
`GET /practices/search?q=<query>`

- Minimum 2 characters
- Searches approved practices by name or city (case-insensitive contains)
- Returns max 10 results, sorted by name
- Returns: `{ id, name, city, address, phone }`

---

## 8. Ranking Principles

Search ranking must reflect Revio's core value: helping users find the right physio for their specific need.

### Guiding Factors (conceptual weight order)
1. **Problem-to-specialization relevance** — how well specializations match the query
2. **Location proximity** — city match (exact in MVP; distance-based in future)
3. **Language match** — if filtered
4. **Home visit match** — if filtered
5. **Profile completeness** — photo + specialization + practice + bio 50+ chars + education + language
6. **Verification trust level** — only `APPROVED` shown (no tiering within approved)

### Ranking Must NOT:
- Favor keyword-stuffed profiles over genuinely relevant ones
- Create false medical authority through ranking position
- Prioritize distance alone while ignoring specialization fit
- Introduce undisclosed paid placement without clear transparency rules

---

## 9. No-Results Behavior

Currently: returns empty `therapists[]` and `practices[]` arrays.

Future considerations:
- "Keine Ergebnisse in <city>" message
- Suggest broadening filters
- Show nearby cities with results
- Show "generic" therapists if specific query has no match

---

## 10. Map / List Interaction

### Current State
- Results returned as a flat list sorted by relevance
- Practices array includes `lat`/`lng` for map rendering
- Mobile app: list view only (map view is a planned feature)
- Admin dashboard: no map

### Future (Kartenansicht)
- Map-first view with practice pins
- Default pin: `#2F3E46` with R icon
- Selected pin: `#E9C46A` with `#1B1F23` R icon
- Marker clusters at high density
- Viewport-adjusted results
- Tapping pin opens practice/therapist preview card
