# 00 — Scope, Inventar und Coverage

**Audit-Datum:** 2026-08-15
**Branch:** `main`
**Start-Commit:** `dd8bf743185ffb4143009959cdc8c8d2d22cce57` („test: complete practice before approval")
**End-Commit:** `1679f86` („copy: shorten hero title on site homepage")
**Modus:** Audit-only. Keine bestehende Datei verändert, nichts committet, keine Migration/Seed ausgeführt, keine externen Aktionen ausgelöst.

> **Wichtig — das Repository hat sich während des Audits bewegt.** Zwischen Start und Abschluss sind zwei Commits dazugekommen (`be32b9c` „feat: admin link management, practice profile and mobile navigation", `1679f86`), die 15 Dateien und ~1.237 Zeilen berühren. Die zu Beginn ungetrackten Dateien (`add-link-form.tsx`, `linked-entities-section.tsx`) sind inzwischen committet.
>
> **Alle Datei-/Zeilenangaben in diesem Audit wurden am Ende gegen `1679f86` erneut verifiziert** (Phase 6). Zwei Referenzen haben sich um eine Zeile verschoben und sind korrigiert. Neu hinzugekommen und mitgeprüft: `apps/site/app/api/find-search/route.ts` (ungetrackt).

---

## 1. Zustand des Working Tree zu Audit-BEGINN

`git status --short` bei `dd8bf74` (unverändert erhalten, inzwischen größtenteils committet):

```
 M apps/admin/app/(admin)/practices/[id]/page.tsx
 M apps/admin/app/(admin)/therapists/[id]/page.tsx
 M apps/admin/lib/actions.ts
 M apps/admin/lib/api.ts
 M apps/api/src/routes/admin.ts
 M apps/api/src/utils/practice-visibility.ts
 M apps/api/test/app.test.ts
 M apps/mobile/src/screens/public/PracticeProfileScreen.js
 M apps/mobile/src/screens/public/TherapistProfileContent.js
 M apps/site/components/public-practice-profile.tsx
 M apps/site/lib/public-api.ts
 M packages/shared/src/index.ts
?? apps/admin/components/add-link-form.tsx
?? apps/admin/components/linked-entities-section.tsx
```

`git stash list`: leer.

`git status --short` bei Audit-**Ende** (`1679f86`):

```
 M apps/api/src/routes/contact.ts
 M apps/site/app/contact/page.tsx
 M apps/site/app/globals.css
 M apps/site/components/contact-form.tsx
 M apps/site/components/mobile-bottom-nav.tsx
 M apps/site/components/public-therapist-profile.tsx
 M apps/site/components/therapist-result-card.tsx
 M apps/site/lib/public-api.ts
?? apps/site/app/api/
?? apps/site/components/profile-media-image.tsx
?? docs/audit/          ← ausschließlich die Artefakte dieses Audits
```

**Befunde mit Bezug zum uncommitted Working Tree** sind im Register mit `WT` markiert. Alle übrigen Befunde beziehen sich auf committeten Code bei `1679f86`.

---

## 2. Repo- und Systemkarte

| Anwendung | Stack | Dateien | Zeilen | In CI |
|---|---|---:|---:|---|
| `apps/api` | Fastify 5, Prisma 6, Zod | 58 | 16.400 | ✅ typecheck + test |
| `apps/mobile` | Expo / React Native | 141 | 24.210 | ❌ (nur EAS-Publish) |
| `apps/admin` | Next.js 15 (App Router) | 55 | 5.954 | ✅ build |
| `apps/site` | Next.js 15 (App Router) | 47 | 4.082 | ❌ |
| `packages/shared` | TS-Typen | 1 | 492 | ❌ |

Paketmanager: pnpm 10.6.3. Node lokal v24.14.0, CI Node 22, Docker/Nixpacks Node 20 — **drei verschiedene Major-Versionen**.

---

## 3. Aktive Runtime-Entry-Points (verifiziert)

Alle 16 Routenmodule sind in [`apps/api/src/app.ts:50-65`](../../../apps/api/src/app.ts) registriert. **Kein verwaistes Routenmodul gefunden** — jede Datei unter `routes/` ist registriert.

| Modul | Prefix | Endpunkte | Auth-Modell |
|---|---|---:|---|
| `health` | — | 1 | keine |
| `config` | — | 4 | keine |
| `search` | — | 7 | **keine (öffentlich)** |
| `register` | — | 4 | keine (OTP-gated) |
| `claim` | — | 7 | teils keine, teils `practice_owner` |
| `admin` | `/admin` | 65 | statischer Bearer-Token |
| `auth` | — | 22 | `sessionToken` |
| `upload` | — | 2 | `sessionToken` (Therapeut) |
| `booking` | — | 22 | `sessionToken` |
| `reviews` | — | 4 | `sessionToken` |
| `feedback` | — | 1 | **optional** |
| `notifications` | — | 3 | `sessionToken` |
| `schedule` | — | 3 | `sessionToken` |
| `inquiry` | — | 12 | `sessionToken` |
| `match` | — | 0 | Hilfsmodul ohne Routen |
| `contact` | — | 1 | keine (Honeypot + Ratelimit) |

Hintergrundjob: `setInterval` alle 5 Min, registriert im `onReady`-Hook ([`app.ts:70-117`](../../../apps/api/src/app.ts)) — Booking-/Inquiry-Expiry und Reminder.

---

## 4. Rollen- und Berechtigungsmatrix (aus aktivem Code)

`Role`-Enum in [`schema.prisma`](../../../apps/api/prisma/schema.prisma): `therapist`, `admin`, `patient`, `practice_owner`.

> Die Ausgangshypothese des Auftrags nannte „ggf. Praxismanager". Der Code kennt **`practice_owner`** (Claim-Flow), **nicht** `manager`. `manager` + `PracticeManager` existieren ausschließlich in der toten Datei `schema.production.prisma` (siehe ARCH-001).

| Rolle | Authentifizierung | Kann | Grenzen im Code |
|---|---|---|---|
| anonym | — | Suche, öffentliche Profile, Praxis-Detail, Blog, Kontakt, Feedback, Claim starten | `getTherapistPublicationState` / `getPracticeVisibilityState` |
| Patient | `User.sessionToken` | Buchen, Anfragen, eigene Termine, Favoriten, Bewerten, Export, Löschen | Ownership-Checks konsistent vorhanden |
| Therapeut | `User.sessionToken` **oder** legacy `Therapist.sessionToken` | Profil, Services, Arbeitszeiten, Blockzeiten, Anfragen beantworten, Dokumente | `reviewStatus`-Gates für Buchbarkeit |
| `practice_owner` | `User.sessionToken` | Genau eine Praxis übernehmen und bearbeiten, Medien | Einziger Rollenzweig, der Session-Ablauf prüft |
| Admin | **ein geteilter statischer Token** | Alles: 65 Endpunkte, inkl. Patientendaten, Freigaben, Dokumente | `onRequest`-Hook [`admin.ts:272-276`](../../../apps/api/src/routes/admin.ts) |

**Kein Rollenmodell innerhalb von Admin.** Es gibt genau einen Admin-Identity (`REVIO_ADMIN_EMAIL`), kein Vier-Augen-Prinzip, keine Actor-Spalte im Audit-Log (im Code als DS-73-Lücke dokumentiert und damit bewusst offen).

---

## 5. Datenarten und Schutzklassen

Quelle: [`data-classification.yaml`](../../../apps/api/prisma/data-classification.yaml), Validator `check:classification`.

- **P0** Konfiguration, Enums, Zeitstempel
- **P1** personenbezogen: Namen, E-Mail, Adresse, Koordinaten, Telefon, Pseudo-IDs
- **P2** Art. 9 Gesundheitsdaten: `Inquiry.heilmittel`, `BookingRequest.heilmittel`, `PrescriptionData`, Freitexte von Patient:innen
- **P3** Geheimnisse: `passwordHash`, `sessionToken`, Reset-/Verifikationstoken, `expoPushToken`

**Validator-Status: FEHLGESCHLAGEN (Exit 1, 11 Verstöße)** — siehe [02-test-and-command-log.md](02-test-and-command-log.md) und DATA-001.

---

## 6. Integrationen / Unterauftragnehmer

[`subprocessors.yaml`](../../../subprocessors.yaml) ist vollständig und ehrlich gepflegt (7 Einträge + `dev_only`). Alle im Code gefundenen externen Dienste sind erfasst: Railway, Vercel, Resend, Expo Push, Nominatim/OSMF, Apple Maps, Google Maps. **Kein undokumentierter Drittanbieter im aktiven Code gefunden** (geprüft: alle `fetch`-Aufrufe in `apps/api/src`, Dependencies der vier Apps).

Die rechtlichen Felder stehen durchgängig auf `OFFEN` und sind ausdrücklich als „keine technische Aussage" markiert — korrekt getrennt. Rechtliche Bewertung ist nicht Teil dieses Audits.

---

## 7. Build-, Test- und Deployment-Landschaft

**Widersprüchlich — vier Startpfade für dieselbe API:**

| Quelle | Kommando | Migrationsmechanismus | Schema |
|---|---|---|---|
| `apps/api/package.json` `start` | `prisma migrate deploy && node dist/server.js` | Migrationen | `schema.prisma` (sqlite!) |
| `Dockerfile` CMD | `sh start.sh` | `db push --accept-data-loss` | `schema.production.prisma` |
| `nixpacks.toml` `[start]` | `prisma db push --accept-data-loss && node dist/server.js` | `db push` | `schema.production.prisma` |
| `railpack.toml` `[deploy]` | `prisma db push --skip-generate --accept-data-loss && node dist/server.js` | `db push` | `schema.production.prisma` |

Siehe OPS-001.

CI ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)): zwei Jobs — `api` (typecheck + test), `admin` (build). **Nicht in CI:** `apps/site`, `apps/mobile`, `packages/shared`, `check:classification`, Dependency-/Secret-/SAST-Scanning, Postgres-Tests, E2E, A11y.

[`.github/workflows/eas-update.yml`](../../../.github/workflows/eas-update.yml): publiziert bei **jedem Push auf `main`**, der `apps/mobile/**` berührt, automatisch ein `eas update --branch main` — ohne Testgate und ohne Freigabe. Siehe OPS-003.

---

## 8. Coverage-Matrix

| Bereich | anwendbar | verfügbare Belege | Prüfmethode | Status | Einschränkung |
|---|---|---|---|---|---|
| API-Routing / Registrierung | ja | Code | statisch, vollständig | ✅ geprüft | — |
| Auth / Session-Lifecycle | ja | Code | statisch, vollständig | ✅ geprüft | Laufzeit nicht verifiziert |
| Autorisierung / IDOR | ja | Code | statisch, alle Routen mit `:id` | ✅ geprüft | keine aktive Ausnutzung |
| Admin-Berechtigungen | ja | Code | statisch | ✅ geprüft | Prod-Konfiguration unbekannt |
| Öffentliche Sichtbarkeit / Freigabe | ja | Code + Tests | statisch | ✅ geprüft | — |
| Buchung / Slot-Integrität | ja | Code | statisch | ⚠️ teilweise | Advisory-Lock nur auf PG, in Tests nie aktiv |
| DSGVO: Klassifikation | ja | Validator | **ausgeführt** | ✅ geprüft | Exit 1 |
| DSGVO: Export | ja | Code | statisch | ✅ geprüft | — |
| DSGVO: Löschung | ja | Code + Schema | statisch | ✅ geprüft | — |
| DSGVO: Logging/Redaction | ja | Code | statisch | ✅ geprüft | Laufzeit-Logs nicht eingesehen |
| Uploads / Storage | ja | Code | statisch | ✅ geprüft | S3-Pfad nur statisch (kein S3 verfügbar) |
| Datenmodell / Indizes | ja | Schema | statisch | ✅ geprüft | keine Query-Pläne gemessen |
| Schema-Drift dev/prod | ja | beide Schemas | Diff-Skript | ✅ geprüft | Prod-DB nicht eingesehen |
| Deployment / Migrationen | ja | 4 Configs | statisch | ✅ geprüft | Railway-Projekt nicht zugänglich |
| CI/CD | ja | Workflows | statisch | ✅ geprüft | keine CI-Runs eingesehen |
| Typecheck API | ja | `tsc` | **ausgeführt** | ✅ geprüft | Exit 0 |
| Testsuite API | ja | vitest | **ausgeführt** | ⚠️ 213/215, Laufzeit NICHT PRÜFBAR | Umgebungs-I/O, siehe 02 |
| Admin-Build | ja | `next build` | **ausgeführt** | ✅ Code kompiliert + typprüft sauber | Exit 1 nur durch `rename`-Fehler der Umgebung |
| Site-Build | ja | — | nicht ausgeführt | ❌ NICHT PRÜFBAR | I/O-limitiert |
| Mobile-Tests | ja | — | kein Testskript vorhanden | ❌ NICHT PRÜFBAR | `apps/mobile` hat kein `test`-Script |
| Frontend-Code (Site/Admin) | ja | Code | statisch | ✅ geprüft | — |
| Mobile-Code | ja | Code | statisch, stichprobenartig | ⚠️ teilweise | 141 Dateien, Schwerpunkt Auth/Profil/Buchung |
| **UI/UX Laufzeit** | ja | — | — | ❌ NICHT PRÜFBAR | kein Browser, keine Screenshots, keine laufende Instanz |
| **Accessibility Laufzeit** | ja | — | — | ❌ NICHT PRÜFBAR | keine axe-/Screenreader-/Tastaturprüfung möglich |
| **Performance (gemessen)** | ja | — | — | ❌ NICHT PRÜFBAR | keine Lastmessung, keine Prod-Metriken |
| **Produktionskonfiguration** | ja | — | — | ❌ NICHT PRÜFBAR | Railway/Vercel/Doppler nicht autorisiert |
| **Backups / Restore / RTO/RPO** | ja | — | — | ❌ NICHT PRÜFBAR | keine Belege im Repo |
| **Observability / Alerting** | ja | Code | statisch | ⚠️ teilweise | kein APM/Error-Tracking im Code gefunden |
| `data/*.xlsx` | ja | Dateinamen | **bewusst nicht geöffnet** | ❌ NICHT PRÜFBAR | könnte Echtdaten enthalten (Auftragsregel) |
| Lokale `*.db` | ja | Pfade | **bewusst nicht geöffnet** | ❌ NICHT PRÜFBAR | könnte Echtdaten enthalten |

---

## 9. Nicht geprüfte Bereiche (explizit)

- Laufende Anwendungen in irgendeiner Form (Site, Admin, Mobile, API)
- Visuelle Prüfung, Kontrastmessung, Tastaturnavigation, Screenreader
- Produktionsdatenbank, Backups, tatsächliche Railway-Region (DS-83)
- Reale Secrets-Werte (nur Schlüsselnamen betrachtet)
- Inhalte von `data/*.xlsx`, `apps/api/prisma/prisma/*.db`, Upload-Verzeichnisse
- iOS-/Android-Builds, Deep-Link-Verhalten auf Geräten, Push-Zustellung
- Lasttests, Brute-Force-Tests, aktive Exploitation (auftragsgemäß unterlassen)

## 10. Offene Fragen an die Eigentümer

1. Ist `STORAGE_PROVIDER` in Produktion `local` oder `s3`? Entscheidet über die Schwere von STOR-002.
2. Ist `REVIO_ADMIN_PASSWORD` produktiv gesetzt oder greift der Default `admin123` ([`env.ts:8`](../../../apps/api/src/env.ts))?
3. Läuft die API mit genau einer Instanz? Entscheidet über OPS-004.
4. Enthalten `data/*.xlsx` echte personenbezogene Daten? Sie sind git-getrackt.
5. In welcher Region liegt die Railway-PostgreSQL (DS-83, in `subprocessors.yaml` als offen markiert)?
