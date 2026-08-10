# Umsetzungsplan — Praxis-Zusatzdaten (Medien + weitere Felder)

Status: **Entwurf / geplant** (noch nicht umgesetzt). Reiner Umsetzungsplan, kein Code.

Ergänzt `docs/praxis-pflichtdaten-umsetzung.md` (Adress-Pflichtfelder + Live-Gate).
Zwei Teile: **A) Logo & Fotos befüllbar machen**, **B) weitere Praxis-Felder**.

---

## Teil A — Logo & Fotos

### A.1 Ist-Zustand (im Code verifiziert)

Die Felder existieren bereits und werden **schon angezeigt** — es fehlt nur der
Weg, sie zu befüllen.

| Ebene | Status |
|---|---|
| Datenmodell | `Practice.logo String?`, `Practice.photos String?` (JSON-Array als String) — vorhanden |
| Ausgabe API | `search.ts` parst `photos` per `JSON.parse` an 4 Stellen und liefert `logo`/`photos` aus |
| Website | `public-practice-profile.tsx` (Logo + Foto-Galerie), `practice-result-card.tsx` (Logo) |
| Mobile | `PracticeProfileContent.js`, `app-utils.js` (`resolveMediaUrl`) |
| **Schreiben/Upload** | **fehlt komplett** — kein Endpunkt, nicht in `createPracticeSchema`/`updatePracticeSchema`, nicht in `claim.ts` |

Vorhandene Infrastruktur, die wiederverwendet wird:

- `uploadFile()` in `apps/api/src/utils/storage.ts` — schreibt nach S3 **oder** lokal
  (`STORAGE_PROVIDER`), gibt die öffentliche URL zurück.
- `@fastify/multipart` ist in `app.ts` registriert, Limit **5 MB pro Datei**.
- Referenz-Implementierung: `POST /admin/therapists/:id/photo` (`admin.ts`) —
  Mimetype-Whitelist (JPEG/PNG/WebP), `randomBytes(16)`-Dateiname, `uploadFile()`.
- Ablagepfade in `storage-paths.ts`: `PUBLIC_UPLOADS_DIR`, `PROFILE_PHOTOS_DIR`.

### A.2 Neue Ablagepfade

In `storage-paths.ts` ergänzen (analog zu `PROFILE_PHOTOS_DIR`):

- `PRACTICE_LOGOS_DIR` = `PUBLIC_UPLOADS_DIR/practice-logos`, Prefix `/uploads/practice-logos`
- `PRACTICE_PHOTOS_DIR` = `PUBLIC_UPLOADS_DIR/practice-photos`, Prefix `/uploads/practice-photos`

Getrennte Verzeichnisse statt eines gemeinsamen, damit Logo und Galeriefotos
unabhängig aufgeräumt/migriert werden können.

### A.3 Endpunkte (Admin, `admin.ts`)

Alle drei mit derselben Vorbedingung wie `/practices/:id/update`:
Praxis existiert **und** `ownerId` ist null (unbeansprucht), sonst 403.

| Endpunkt | Zweck |
|---|---|
| `POST /admin/practices/:id/logo` | Ein Bild → setzt `practice.logo` (ersetzt vorhandenes) |
| `POST /admin/practices/:id/photos` | Ein Bild → **hängt an** das `photos`-Array an |
| `POST /admin/practices/:id/photos/remove` | JSON `{ url }` → entfernt genau diesen Eintrag aus dem Array |

Gemeinsame Regeln:

- Mimetype-Whitelist `image/jpeg`, `image/png`, `image/webp` (wie beim Therapeutenfoto).
- Dateiname `randomBytes(16).toString('hex') + ext` — nie der Originalname.
- `photos` wird als JSON-String geschrieben; **immer** defensiv lesen
  (`try { JSON.parse } catch { [] }`), weil das Feld ein untypisierter String ist.
- Obergrenze **max. 10 Fotos** pro Praxis → sonst 400. Verhindert unbegrenztes Wachstum.
- `resetSearchCache()` nach jeder Änderung (sonst zeigt die Suche bis zu 5 Min alte Daten).

### A.4 Claim-Flow (`claim.ts`)

Spiegelbildlich für den `practice_owner` auf der **eigenen** Praxis
(Auth wie `/claim/me/update`: Token → `role === 'practice_owner'` → `ownedPractice`):

- `POST /claim/me/logo`
- `POST /claim/me/photos`
- `POST /claim/me/photos/remove`

Gleiche Validierung/Limits wie A.3. Die Logik gehört in einen gemeinsamen Helper
(z. B. `utils/practice-media.ts`), damit Admin- und Claim-Pfad nicht auseinanderlaufen.

### A.5 Admin-UI

- **Edit-Seite** (`practices/[id]/page.tsx`): Logo-Upload (mit Vorschau des aktuellen
  Logos) + Foto-Galerie mit „Foto hinzufügen" und „Entfernen" pro Bild.
  Server-Actions in `lib/actions.ts` analog zu `forwardTherapistPhoto()` —
  Multipart weiterreichen, da `adminRequest()` nur JSON kann.
- **Neuanlage** (`practices/neu/page.tsx`): bewusst **kein** Upload. Praxis erst
  anlegen, Medien danach auf der Edit-Seite — vermeidet den Zwei-Phasen-Fall
  („angelegt, aber Upload fehlgeschlagen"), den `createTherapist` heute abfangen muss.
- `AdminPractice`-Typ in `lib/api.ts` um `logo`/`photos` erweitern;
  `mapPractice()` in `admin.ts` muss beide Felder mit ausliefern (tut es aktuell **nicht**).

### A.6 Bekannte Altlast (bewusst benannt)

Es gibt **nirgends** ein Löschen alter Dateien — auch nicht beim Therapeutenfoto.
Ein ersetztes Logo lässt die alte Datei verwaist zurück. Dieser Plan ändert das
nicht (gleiches Verhalten wie bestehend), aber der Aufräum-Job gehört als eigenes
Ticket erfasst: *„Verwaiste Uploads aufräumen (Therapeut + Praxis)"*.

---

## Teil B — Weitere Praxis-Felder

Additive, nullable Felder auf `Practice` (beide Schemas + Migration), analog zum
Adress-Paket. Nach Nutzen/Aufwand sortiert.

### B.1 Empfohlen (klein, klarer Nutzen)

| Feld | Typ | Begründung |
|---|---|---|
| `email` | `String?` | Praxis hat heute **keine** eigene Kontaktadresse — nur der Claim-Account. Lücke im Kontaktweg. |
| `website` | `String?` | Externer Auftritt der Praxis |
| `wheelchairAccessible` | `Boolean @default(false)` | Barrierefreiheit — bei Physio häufig entscheidungsrelevant |
| `parkingAvailable` | `Boolean @default(false)` | Parkplatz — häufige Rückfrage |
| `publicTransportNote` | `String?` | z. B. „5 Min. von U-Bahn X" |

Umsetzung jeweils: Prisma-Feld → Migration → `create`/`update`/`import`-Zod-Schemas →
`mapPractice` → `claim.ts` → Admin-Formulare → `data-classification.yaml`.

### B.2 Größer, eigenes Ticket

- **Strukturierte Öffnungszeiten**: `hours` ist heute Freitext. Wochentag/Zeit-Paare
  würden „Jetzt geöffnet" und Filterung ermöglichen — braucht eigenes Modell
  (`PracticeOpeningHour`) + Migration bestehender Freitexte. Nicht mit B.1 mischen.
- **`kassenart` auf Praxisebene**: existiert bisher nur pro Therapeut. Nur sinnvoll,
  wenn es fachlich Praxen gibt, deren Kassenart von ihren Therapeuten abweicht —
  vorher fachlich klären, sonst redundante Datenhaltung.

### B.3 Bewusst nicht empfohlen

- **Bewertungen auf Praxisebene**: `CLAUDE.md` §2 sieht Reviews *von Therapeuten* vor.
  Wäre eine Scope-Entscheidung, keine technische.
- **Social-Media-Links**: geringer Nutzen für eine Buchungsplattform.
- **Zahlungen / Kapazitäten auf Praxisebene**: explizit außerhalb des MVP (`CLAUDE.md` §2).

---

## DSGVO

- **Teil A**: Logo/Fotos einer Praxis sind Geschäftsdaten (`P1`), keine besondere
  Kategorie. **Aber**: Auf Praxisfotos können Mitarbeitende erkennbar sein — der
  Upload-Hinweis im Admin muss festhalten, dass für abgebildete Personen eine
  Einwilligung vorliegen muss (analog zum Zustimmungs-Gate bei Therapeutenprofilen).
- **Teil B**: `email` ist `P1`; ist es eine personenbezogene Adresse
  (`vorname.nachname@…`) statt einer Funktionsadresse, gelten Export- und
  Löschpflichten (DS-40/41) — beim Praxis-Export mit abdecken.
- Alle neuen Felder in `apps/api/prisma/data-classification.yaml` nachtragen,
  sonst schlägt `pnpm --filter @revio/api check:classification` fehl (DS-02).
- Keine neuen Subprozessoren: Uploads laufen über die bestehende Storage-Konfiguration.

## Tests (Erwartung)

- Upload akzeptiert JPEG/PNG/WebP, lehnt andere Mimetypes mit 400 ab.
- Logo-Upload ersetzt `logo`; zweiter Upload überschreibt.
- Foto-Upload hängt an; 11. Foto → 400.
- `photos/remove` entfernt genau einen Eintrag, lässt die übrigen intakt.
- Beanspruchte Praxis (`ownerId` gesetzt) → Admin-Upload 403.
- Claim-Pfad: fremde Praxis nicht manipulierbar.
- Defekter `photos`-JSON-String führt nicht zum 500, sondern wird als leer behandelt.

## Reihenfolge

1. `storage-paths.ts` + gemeinsamer Media-Helper.
2. Admin-Endpunkte (Logo, Foto hinzufügen, Foto entfernen) + `mapPractice` erweitern.
3. Admin-UI auf der Edit-Seite.
4. Claim-Endpunkte (gleicher Helper).
5. Teil B.1 Felder (ein Paket, eine Migration).
6. Klassifizierung + Tests grün, dann B.2 als separate Tickets bewerten.

## Offene Entscheidungen

- Foto-Obergrenze 10 — bestätigen oder anpassen.
- Sollen Medien auch im **Freelancer-Registrierungsflow** hochladbar sein, oder
  bleibt das Admin/Claim-exklusiv?
- Teil B.2 (`kassenart` auf Praxisebene) — fachlich nötig oder redundant?
