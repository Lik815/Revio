# Umsetzungsplan — Praxis-Pflichtdaten & „Live"-Regel

Status: **Entwurf / geplant** (noch nicht umgesetzt). Reiner Umsetzungsplan, kein Code.

## 1. Ziel

Zwei neue verbindliche Regeln für Praxen:

1. **Volle Adresse ist Pflicht** — eine Praxis braucht Straße + Hausnummer + PLZ + Stadt,
   nicht nur `city`. Grundlage für korrektes Geocoding (`lat`/`lng`) und für die Anzeige.
2. **Mindestens ein bestätigter Therapeut, um „live" (öffentlich sichtbar) zu sein.**

Gewählte Auslegung von „live": **Variante A** — eine Praxis ohne mindestens einen
`CONFIRMED`-Therapeuten-Link erscheint nicht in der öffentlichen Suche, auch nicht als
Directory-Eintrag. (Variante B — Directory-First behalten, „live" nur strenger labeln —
siehe Abschnitt 8.)

## 2. Ist-Zustand (verifiziert im Code)

- `Practice` (schema.prisma:246) hat Pflicht `name`, `city`; `address` optional; **kein**
  getrenntes `postalCode` / `street` / `houseNumber` (nur `address` als Freitext).
- Sichtbarkeit heute auf zwei Wegen:
  - **Über Therapeuten**: `reviewStatus: APPROVED` + `CONFIRMED`-Link (search.ts, `searchTherapistInclude`).
  - **Standalone**: `reviewStatus: LISTED` wird ohne jeden Therapeuten eingemischt
    (search.ts:454–492, `loadListedPractices`).
- Keine Stelle erzwingt heute Adress-Vollständigkeit oder Therapeut-Existenz beim Anlegen
  oder Freigeben.

## 3. Datenmodell-Änderungen

Prisma (`schema.prisma` + `schema.production.prisma` synchron halten):

- `Practice` neue Felder (analog zu `Therapist`):
  - `postalCode String?`  (PLZ)
  - `street String?`       (Straße)
  - `houseNumber String?`  (Hausnummer)
  - `address` bleibt bestehen (kombinierter Anzeige-String / Legacy), wird aus den
    Einzelteilen zusammengesetzt.
- Migration: additive Felder (nullable), damit Bestandsdaten nicht brechen.
  SQLite (dev) und PostgreSQL (prod) getrennt beachten — portable `ALTER TABLE ... ADD COLUMN`.
- Backfill: bestehende `address`-Freitexte bleiben; Einzelfelder werden best effort
  nachgezogen (optionaler Parser oder manuell im Admin). Kein Zwang zur Rückwirkung.

## 4. Validierung „volle Adresse"

Definition „vollständig": `street` + `houseNumber` + `postalCode` + `city` gesetzt (nicht leer).

Durchsetzungspunkte:

- `POST /admin/practices/create` (admin.ts:1183) — Zod-Schema erweitern, Felder Pflicht.
- `POST /admin/practices/import` (admin.ts:1232) — Import-Zeilen ohne vollständige Adresse
  ablehnen oder als DRAFT markieren (nicht LISTED/APPROVED).
- `POST /admin/practices/:id/update` (admin.ts:1298) und `/claim/me/update` (claim.ts) —
  gleiche Vollständigkeitsprüfung.
- Nach Adress-Set: **Geocoding** aufrufen; wenn kein Treffer → nicht „live" schalten
  (siehe Live-Gate), Admin-Hinweis „Adresse nicht geokodierbar".

Fehlerverhalten: 400 mit klarer deutscher Meldung, welches Feld fehlt.

## 5. „Live"-Gate: mindestens ein Therapeut (Variante A)

Eine Praxis gilt als **live** nur wenn **alle** zutreffen:

1. Adresse vollständig (Abschnitt 4) **und** erfolgreich geokodiert (`lat`/`lng` ≠ 0).
2. `reviewStatus` in einem sichtbaren Zustand (`APPROVED` oder `LISTED`).
3. **≥ 1 Therapeuten-Link mit `status = CONFIRMED`.**

Umsetzungsorte:

- **Freigabe** `/practices/:id/approve` (admin.ts:1337): vor dem Setzen auf APPROVED prüfen,
  dass Bedingung 1 + 3 erfüllt sind, sonst 409 mit Begründung.
- **Suche — Kernänderung** (search.ts:454, `loadListedPractices` / Standalone-Zweig):
  Der Standalone-Zweig darf nur Praxen einmischen, die ≥ 1 `CONFIRMED`-Link haben.
  Konkret: `loadListedPractices` um ein `where` auf
  `links: { some: { status: 'CONFIRMED' } }` erweitern (oder nachgelagert filtern).
  → Damit verschwinden LISTED-Praxen ohne Therapeut aus der öffentlichen Suche.
- **Konsistenz-Effekt beachten:** Wird der letzte `CONFIRMED`-Link entfernt/abgelehnt
  (admin.ts Reject/Dispute), fällt die Praxis automatisch aus der Suche (kein extra Job
  nötig, da Sichtbarkeit live über den Link berechnet wird — nur Cache-TTL beachten).

## 6. Admin-/Freelancer-UI (Folgeänderungen, separate Tickets)

- Admin-Praxisformular (apps/admin): Adressfelder aufsplitten (Straße/Hausnr./PLZ/Stadt),
  Pflichtmarkierung, „Live"-Badge nur wenn Gate erfüllt; Hinweis „braucht Therapeut".
- Freelancer-Registrierung (register.ts / mobile): bei Praxisanlage volle Adresse abfragen.
- Mobile Praxis-Profilkarte: unverändert; zeigt bereits Adresse/Stadt.

## 7. DSGVO/DSGVO-Artefakte (DS-40/41, DS-21/22)

- Neue Felder `postalCode`/`street`/`houseNumber` als `P1` in
  `apps/api/prisma/data-classification.yaml` klassifizieren, dann
  `pnpm --filter @revio/api check:classification` grün.
- Prüfen, ob Praxis-Adressfelder in Datenexport (`subject-data.ts`) und Löschpfade gehören
  (Praxis kann über `ownerId` einer Person zugeordnet sein → Export des practice_owner).
- Keine neuen Subprozessoren; Geocoding läuft bereits über Nominatim (in `subprocessors.yaml`).
  Response-Minimierung: PLZ/Straße nur ausliefern, wo für Anzeige nötig.

## 8. Alternative — Variante B (falls Directory-First erhalten bleiben soll)

Statt LISTED-ohne-Therapeut auszublenden: „live" nur strenger kennzeichnen.
- LISTED bleibt sichtbar, aber mit `verified: false` (schon vorhanden) und einem klaren
  „unbestätigt"-Label; „live"/hervorgehoben nur bei ≥ 1 `CONFIRMED`-Link.
- Kleinere Änderung (nur Sortier-/Label-Logik, kein Ausblenden), widerspricht aber der
  wörtlichen Regel „mind. 1 Therapeut, um live zu sein".

## 9. Migration & Rollout-Schritte

1. Prisma-Felder + Migration (dev SQLite + prod Postgres), Klassifizierung ergänzen.
2. Validierung an Create/Update/Import/Claim (Abschnitt 4).
3. Live-Gate in Approve + Suche (Abschnitt 5).
4. Admin-/Registrierungs-UI nachziehen.
5. Backfill/Bereinigung: bestehende LISTED-Praxen ohne Therapeut identifizieren
   (Report), Admin entscheidet: Therapeut verknüpfen oder auf DRAFT.
6. DSGVO-Artefakte aktualisieren, `check:classification` + Tests grün.

## 10. Tests (Erwartung)

- Adress-Validierung: Create/Update ohne vollständige Adresse → 400.
- Live-Gate: Praxis mit vollständiger Adresse aber ohne `CONFIRMED`-Link → nicht in Suche;
  nach Verknüpfen eines `CONFIRMED`-Therapeuten → erscheint.
- Regression: LISTED-Praxis mit Therapeut bleibt sichtbar; APPROVED-Pfad unverändert.
- Klassifizierung: `check:classification` deckt neue Felder ab.

## 11. Offene Punkte / Entscheidungen

- **Variante A vs. B** (Abschnitt 5 vs. 8) — Default in diesem Plan: **A**.
- PLZ als eigenes Feld vs. Teil von `address` — Plan: eigenes Feld `postalCode`.
- Umgang mit Bestands-LISTED-Praxen ohne Therapeut (Abschnitt 9, Schritt 5).
