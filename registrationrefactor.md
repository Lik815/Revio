# Registration Refactor & Email Verification Deep Linking. registrationrefactor.md

## Übersicht

Zwei zusammenhängende Änderungen:
1. Onboarding-Flow vereinfacht (5 Schritte → 4)
2. E-Mail-Verifikation mit Deep Linking für native Mobile

---

## Teil 1 — Onboarding-Refactor

### Was geändert wurde

**Entfernte Felder aus dem Onboarding:**
- Bio / Kurze Vorstellung
- Berufsbezeichnung (wird serverseitig als `'Physiotherapeut/in'` gesetzt)
- Hausbesuche (gehört zur Praxis, nicht zum Therapeuten)
- Praxis-Schritt komplett entfernt (Praxis-Manager sendet Einladung)

**Neuer Flow (4 Schritte):**

| Schritt | Inhalt |
|---------|--------|
| 1 | E-Mail, Passwort, Passwort bestätigen |
| 2 | Vorname, Nachname, Stadt (optional) |
| 3 | Spezialisierungen (optional, searchable multiselect), Sprachen (searchable multiselect), Fortbildungen |
| 4 | Vorschau + Einreichen |

**Nach der Registrierung:**
- E-Mail-Verifikation (siehe Teil 2)
- Banner im Therapeuten-Dashboard wenn keine Praxis verknüpft

**Verbesserte UX:**
- Spezialisierungen: Suchfeld → Dropdown-Vorschläge → ausgewählte Chips mit ×
- Sprachen: gleiche Searchable-Multiselect-Logik
- Sprach-Liste von 10 auf 32 Sprachen erweitert
- Stadt als optional gekennzeichnet
- Inline-Fehlermeldungen bei Pflichtfeldern

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/api/prisma/schema.prisma` | `emailVerificationToken`, `emailVerifiedAt` zu User hinzugefügt |
| `apps/api/src/routes/register.ts` | Zod-Schema vereinfacht, practice/bio/homeVisit/title entfernt, E-Mail-Verifikation ergänzt |
| `apps/api/src/routes/auth.ts` | `GET /auth/verify-email` Endpoint, `emailVerified` in `/auth/me` Response |
| `apps/api/src/utils/mailer.ts` | `sendVerificationEmail()` hinzugefügt |
| `apps/mobile/src/mobile-utils.js` | `REG_STEPS = 4`, `LANGUAGE_MAP` auf 32 Sprachen erweitert |
| `apps/mobile/src/App.js` | State bereinigt, `renderRegister()` neu geschrieben |
| `apps/mobile/src/mobile-therapist-dashboard.js` | No-practice Banner mit „Praxis erstellen" / „Praxis verbinden" |

### Annahmen

- Sprachen bleiben Pflichtfeld (für Suchfilterung relevant)
- `professionalTitle` wird serverseitig gesetzt (`'Physiotherapeut/in'`)
- `city` wird als leerer String gespeichert wenn nicht angegeben (DB-Feld ist non-nullable)
- Practice-Daten können weiterhin an die API gesendet werden — aber die UI sendet nichts mehr

---

## Teil 2 — E-Mail-Verifikation mit Deep Linking

### Ansatz

| Entscheidung | Gewählt |
|---|---|
| Deep-Link-Scheme | `revo` (entspricht bestehendem `slug` in app.json) |
| Deep-Link-Format | `revo://verify?token=<32-byte-hex>` |
| Backend-Strategie | Neuer `POST /auth/verify-email` für App (gibt Session-Token zurück) + bestehender `GET /auth/verify-email` für Browser bleibt unverändert |
| Auto-Login | Ja — POST-Endpoint erstellt Session, App speichert Token und lädt Profil direkt |
| Login-Enforcement | `requiresEmailVerification Boolean @default(false)` auf User — blockiert nur selbst-registrierte Therapeuten mit unverifizierter E-Mail |

### E-Mail-Flow

1. Therapeut registriert sich
2. API generiert 32-Byte-Hex-Token, speichert in `User.emailVerificationToken`
3. Verifizierungs-E-Mail wird via Resend gesendet:
   - **Primärer Button:** `revo://verify?token=xxx` (öffnet App direkt)
   - **Fallback-Link im Text:** `{API_BASE_URL}/auth/verify-email?token=xxx` (Browser)
4. Nutzer tippt auf Button → App öffnet sich
5. App ruft `POST /auth/verify-email` mit Token auf
6. Backend markiert `emailVerifiedAt`, löscht Token, erstellt Session
7. App speichert Session-Token, lädt Profil → Nutzer landet direkt im Dashboard

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/api/prisma/schema.prisma` | `requiresEmailVerification Boolean @default(false)` zu User |
| `apps/api/prisma/migrations/…` | Migration angewendet |
| `apps/api/src/routes/register.ts` | Setzt `requiresEmailVerification: !isDev`, sendet `revo://verify?token=xxx` als primären Link |
| `apps/api/src/utils/mailer.ts` | Optionaler `browserFallbackLink`-Parameter in `sendVerificationEmail` |
| `apps/api/src/routes/auth.ts` | `POST /auth/verify-email` (Auto-Login-Endpoint); Login-Block für unverifizierte Therapeuten |
| `apps/mobile/app.json` | `"scheme": "revo"` + Android `intentFilters` für `revo://` |
| `apps/mobile/src/App.js` | State-Vars, `handleVerifyEmailLink()`, Deep-Link-Handler aufgeteilt, `renderEmailVerifyScreen()`, Hook in `renderTab` |

### Login-Enforcement

In `POST /auth/login`, nach Passwort-Prüfung, vor Session-Erstellung:

```typescript
if (user.role === 'therapist' && user.requiresEmailVerification && !user.emailVerifiedAt) {
  return reply.unauthorized('Bitte bestätige zunächst deine E-Mail-Adresse. Überprüfe deinen Posteingang.');
}
```

**Gilt nicht für:**
- Manager (andere Rolle)
- Legacy-Accounts ohne User-Row (Fallback-Pfad, `requiresEmailVerification` defaults zu `false`)
- Dev-Modus (`requiresEmailVerification` wird als `false` gesetzt, `emailVerifiedAt` sofort gesetzt)

### Deep-Link-Disambiguierung

Der Deep-Link-Handler in App.js unterscheidet Verifikations- von Einladungs-Links via URL-Muster:

```js
const isVerifyLink = /revo:\/\/verify|\/verify[?]|verify-email/.test(url);
```

- `revo://verify?token=xxx` → Verifikations-Flow
- Alles andere mit `?token=` → bestehender Invite-Claim-Flow (unverändert)

### Annahmen

1. Browser-Verifikation ist nicht der primäre UX-Pfad — der E-Mail-Button linkt auf `revo://`; Browser-URL ist sekundärer Textlink
2. Auto-Dismiss nach 2,5s im Erfolgsfall — danach landet Nutzer im Dashboard
3. Invite-Links sind unverändert — bestehende Invite-E-Mails nutzen HTTP-URLs, kein `revo://`-Scheme
4. Token hat keine serverseitige Ablaufzeit — 48h werden nur im E-Mail-Text kommuniziert

---

## Teil 3 — Visibility Issues Detection

### Was geändert wurde

Der Admin-Endpoint `GET /admin/visibility-issues` war ein Stub der immer `{ count: 0, issues: [] }` zurückgab. Ersetzt durch echte Erkennungslogik.

### Logik

Alle Therapeuten mit `reviewStatus: APPROVED` werden geladen und auf echte Sichtbarkeit geprüft:

1. **`publication_incomplete`** — `getTherapistPublicationState().publicSearchEligible === false`
   - Fehlende Pflichtfelder (fullName, professionalTitle, bio, specializations, languages)
   - `isVisible === false`
   - `onboardingStatus` erfordert explizite Publikation aber `isPublished === false`

2. **`confirmed_link_practice_not_approved`** — Hat bestätigte Links, aber alle verlinkten Praxen sind nicht APPROVED

3. **`pending_link_only`** — Nur PROPOSED/DISPUTED Links, keine CONFIRMED

4. **`no_confirmed_link`** — Überhaupt keine Links

### Response-Format

```json
{
  "count": 3,
  "issues": [
    {
      "therapistId": "...",
      "therapistName": "Max Muster",
      "email": "max@example.com",
      "reason": "confirmed_link_practice_not_approved",
      "detail": "All confirmed practices have non-APPROVED status: Praxis XY (DRAFT)",
      "linkedPractices": [{ "id": "...", "name": "Praxis XY", "status": "CONFIRMED", "reviewStatus": "DRAFT" }]
    }
  ]
}
```

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/api/src/routes/admin.ts` | Stub `GET /admin/visibility-issues` durch echte Erkennungslogik ersetzt |

### Annahmen

- Ein Therapeut mit `publicSearchEligible === true` und mindestens einer CONFIRMED + APPROVED Praxis gilt als vollständig sichtbar — kein Issue
- Hat ein Therapeut *manche* bestätigten Links zu APPROVED Praxen, gilt er als sichtbar (partial-approved-practice-link ist kein Issue)
- Nur `APPROVED` Therapeuten werden geprüft — andere Status sind intentionally nicht öffentlich

---

## Teil 4 — Admin-Dokumentenzugriff

### Ziel

Therapeuten können Qualifikationsnachweise hochladen. Admins können diese Dateien in der Admin-Oberfläche ansehen und herunterladen — ohne öffentlichen Dateizugriff.

### Architektur

```
Therapeut → POST /upload/document → apps/api/documents/<uuid>.pdf  (nicht öffentlich)
                                   → TherapistDocument (DB-Record)

Admin     → GET /admin/therapists/:id/documents → Dateiliste
          → GET /admin/documents/:filename       → Datei streamen (admin-only)

Admin UI  → /therapists/:id → Detailseite mit Dokumenten-Abschnitt
          → /api/documents/:filename → Next.js-Proxy (liest Cookie, kein Token in URL)
```

### Sicherheit

| Mechanismus | Beschreibung |
|-------------|-------------|
| Separates Verzeichnis | `apps/api/documents/` liegt außerhalb von `uploads/` (kein `@fastify/static`-Zugriff) |
| Admin-Auth auf API | `GET /admin/documents/:filename` unterliegt dem bestehenden `verifyAdmin`-Hook |
| DB-Lookup vor Dateizugriff | Datei wird nur gestreamt wenn ein `TherapistDocument`-Record existiert — kein Zugriff auf Orphan-Dateien |
| Pfad-Traversal-Schutz | Filename wird gegen `/^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/` geprüft |
| Token nicht in URLs | Admin-Dashboard nutzt Next.js-Proxy-Route `/api/documents/:filename` — liest HttpOnly-Cookie, kein Token im Browser sichtbar |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/api/prisma/schema.prisma` | `TherapistDocument`-Modell + `documents`-Relation auf `Therapist` |
| `apps/api/prisma/migrations/…` | Migration `add_therapist_documents` |
| `apps/api/src/routes/upload.ts` | `POST /upload/document` (PDF/JPG/PNG/WebP, in `documents/`) |
| `apps/api/src/routes/admin.ts` | `GET /admin/therapists/:id/documents` + `GET /admin/documents/:filename` |
| `apps/admin/lib/api.ts` | `TherapistDocument`-Typ, `getTherapistDocuments()`, `getTherapist()` |
| `apps/admin/app/api/documents/[filename]/route.ts` | Next.js-Proxy-Route (neu) |
| `apps/admin/app/(admin)/therapists/[id]/page.tsx` | Therapeuten-Detailseite mit Dokumenten-Abschnitt (neu) |
| `apps/admin/app/(admin)/therapists/page.tsx` | Therapeuten-Namen als Link zur Detailseite |

### Annahmen

- `therapist.photo` bleibt separat und weiterhin öffentlich über `uploads/` (Profilbild für Suchergebnisse)
- Keine Dateigrößenbeschränkung pro Dokument jenseits des globalen 5 MB Limits in `@fastify/multipart`
- Dokumente werden nicht gelöscht (kein Delete-Endpoint) — Follow-up-Ticket

---

---

## Teil 5 — Push-Benachrichtigungen für Admin-Entscheidungen

### Ziel

Therapeuten erhalten eine native Push-Benachrichtigung wenn ihr Profil vom Admin freigegeben oder abgelehnt wird.

### Architektur

```
Mobile App (Login)
  → Permissions anfordern
  → Expo Push Token holen (getExpoPushTokenAsync)
  → POST /auth/push-token  →  therapist.expoPushToken (DB)

Admin (Freigabe/Ablehnung)
  → POST /admin/therapists/:id/approve|reject
  → sendPushNotification()  →  Expo Push API (https://exp.host/--/api/v2/push/send)
  → Gerät des Therapeuten
```

### Sicherheit & Fehlertoleranz

- Token wird serverseitig gegen `ExponentPushToken[…]`-Format validiert (400 bei ungültigem Format)
- `sendPushNotification()` ist fire-and-forget — Fehler werden geloggt, blockieren die Admin-Aktion nie
- Push-Token wird bei jedem Login überschrieben — veraltete Tokens werden natürlich ersetzt

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/mobile/package.json` | `expo-notifications`, `expo-device` hinzugefügt |
| `apps/mobile/app.json` | `expo-notifications`-Plugin (icon, color) |
| `apps/mobile/src/App.js` | `setNotificationHandler`, `registerForPushNotifications()`, `useEffect`-Hook bei Therapist-Login |
| `apps/api/prisma/schema.prisma` | `expoPushToken String?` auf `Therapist` |
| `apps/api/prisma/migrations/…` | Migration `add_expo_push_token` |
| `apps/api/src/utils/push-notify.ts` | Expo Push API Wrapper (neu) |
| `apps/api/src/routes/auth.ts` | `POST /auth/push-token` Endpoint |
| `apps/api/src/routes/admin.ts` | Push-Aufruf in `/approve` und `/reject` |

### Benachrichtigungstexte

| Event | Titel | Body |
|-------|-------|------|
| Freigabe | `Profil freigegeben ✓` | `Dein Therapeutenprofil wurde geprüft und ist jetzt auf Revio sichtbar.` |
| Ablehnung | `Profil nicht freigegeben` | `Dein Therapeutenprofil konnte leider nicht freigegeben werden. Bitte kontaktiere uns für weitere Informationen.` |

### Annahmen

- Push-Tokens sind nur auf physischen Geräten verfügbar — Simulator wird via `Device.isDevice`-Check übersprungen
- Benachrichtigungen werden auch im Vordergrund als Banner angezeigt (`setNotificationHandler`)
- Manager erhalten keine Push-Benachrichtigungen (nicht Zielgruppe der Review-Entscheidungen)

---

## Teil 6 — Native Map Setup: Härtung und Dokumentation

### Ausgangslage

Die App enthielt bereits eine funktionierende Map-Integration. Dieses Ticket validiert, härtet und dokumentiert das bestehende Setup, ohne die Kartenlogik neu zu schreiben.

### Plattform-Auflösung

```
iOS / Android  →  react-native-maps 1.20.1  (echt nativ)
Web            →  src/MapStub.js            (Koordinaten-Projektion, kein nativer Code)
```

Zwei unabhängige Guards stellen sicher, dass `react-native-maps` nie in den Web-Bundle kommt:

| Guard | Wo | Wirkung |
|-------|----|---------|
| Metro-Resolver-Stub | `metro.config.js` | Ersetzt den Import zur Bundle-Zeit für `platform === 'web'` |
| `Platform.OS === 'web'` Ternary | `mobile-discover-screen.js` | Dead-Code-Signal an den Bundler — eliminiert den else-Branch im Web-Build |

Beide Guards müssen bestehen bleiben. Der Metro-Resolver ist der autoritative Guard; der Platform-Check ist die menschlich lesbare Deklaration.

### Karten-Provider

| Platform | Provider | API Key erforderlich? |
|----------|----------|-----------------------|
| iOS | Apple Maps (MapKit, Standard-Provider) | **Nein** |
| Android | Google Maps (Standard-Provider) | **Ja — für EAS/Production-Builds** |
| Web | MapStub.js | Nein |

### Android — Google Maps API Key

Für Android-Production-Builds (`eas build`) muss ein Google Maps API Key in `app.json` eingetragen werden:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "<DEIN_KEY>"
    }
  }
}
```

Dieser Slot ist in `app.json` bereits als Platzhalter (`""`) vorhanden. Ohne gültigen Key rendert die Karte auf Android als grauer Bildschirm.

Den Key im [Google Cloud Console Maps SDK for Android](https://console.cloud.google.com/apis/library/maps-android-backend.googleapis.com) erstellen und in EAS Secrets oder direkt in `app.json` eintragen.

Expo Go auf Android nutzt einen eigenen eingebetteten Key — dort funktioniert die Karte auch ohne eigenen Key, nur EAS/Production-Builds sind betroffen.

### Was geprüft und korrekt befunden wurde

- `tracksViewChanges={false}` auf allen Markern → kein unnötiges Re-Render bei statischen Markern ✓
- `radius={searchRadius * 1000}` (km → Meter) ✓
- `Circle ?? (() => null)` Fallback — defensiv, korrekt ✓
- `getMapRegion()` liefert `{ latitude, longitude, latitudeDelta, longitudeDelta }` — korrekt ✓
- `MapStub.js` exportiert `default`, `Marker`, `Circle` — API-Surface stimmt mit `react-native-maps` überein ✓
- `onTouchStart/End/Cancel` → `setMapScrollEnabled` — korrekte Scroll-Entkopplung in ScrollView-Kontext ✓

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/mobile/metro.config.js` | Kommentar zur Dual-Guard-Strategie erweitert |
| `apps/mobile/src/mobile-discover-screen.js` | Import-Block mit vollständigem Plattform-Kommentar versehen |
| `apps/mobile/app.json` | `android.config.googleMaps.apiKey: ""` Platzhalter ergänzt |

### Annahmen

- `PROVIDER_GOOGLE` wird nicht explizit gesetzt — Android nutzt den Default-Provider (Google Maps)
- iOS benötigt keinen API Key — MapKit ist lizenzfrei
- Expo Go auf Android funktioniert ohne eigenen Key (eingebetteter Expo-Key) — betrifft nur EAS/Production

---

## Teil 7 — Dokument-Upload im Therapeuten-Dashboard

### Ziel

Eingeloggte Therapeuten können optionale Qualifikationsnachweise direkt aus dem Dashboard hochladen. Admin-Review-Flow bleibt unverändert.

### Flow

```
Therapeut (Dashboard)
  → Tippt "Nachweis hochladen"
  → expo-document-picker öffnet Systemauswahl (PDF / Bild)
  → POST /upload/document  →  apps/api/documents/<uuid>.pdf
                           →  TherapistDocument (DB-Record)
  → Dateiname erscheint in der Dokumenten-Liste im Dashboard
  → Dateiliste wird beim nächsten Login via GET /auth/documents geladen

Admin (bestehend, unverändert)
  → GET /admin/therapists/:id/documents  →  Dokumentenliste
  → GET /admin/documents/:filename        →  Datei streamen
```

### Sicherheit

| Punkt | Umsetzung |
|-------|-----------|
| Dateitype-Validierung | Server prüft MIME-Type (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) — client-seitiger `type`-Filter in `DocumentPicker` ist nur UX |
| Auth | `POST /upload/document` erfordert gültigen Therapist-Session-Token |
| Interne Filename nicht exponiert | `GET /auth/documents` gibt nur `originalName`, `mimetype`, `uploadedAt` zurück — keine UUIDs |
| Kein öffentlicher Zugriff | Dateien liegen in `apps/api/documents/` außerhalb des statischen Pfads |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/mobile/package.json` | `expo-document-picker` hinzugefügt |
| `apps/mobile/src/App.js` | Import, State (`therapistDocuments`, `documentUploading`), `handlePickDocument()`, Fetch-Effect, neue Props an `TherapistDashboardScreen` |
| `apps/mobile/src/mobile-therapist-dashboard.js` | Props destrukturiert (`documentUploading`, `handlePickDocument`, `therapistDocuments`), Abschnitt „Nachweise & Dokumente" in View-Mode |
| `apps/api/src/routes/auth.ts` | `GET /auth/documents` — gibt Dokument-Liste für eingeloggten Therapeuten zurück |

### Annahmen

- `POST /upload/document` und `TherapistDocument`-Modell existierten bereits (Teil 4)
- Upload ist optional — kein Blocking, kein Pflichtfeld in Onboarding oder Registration
- Dokumente werden nicht gelöscht — kein Delete-UI (bestehende Beschränkung, `RM-DOC-DELETE`)
- `expo-document-picker` funktioniert auf iOS und Android nativ; auf Web öffnet sich der Browser-Datei-Dialog
- `RM-DOC-MOBILE-UI` gilt als geschlossen

---

## Teil 8 — E-Mail-Benachrichtigungen für Admin-Profilentscheidungen

### Ziel

Therapeuten erhalten eine E-Mail wenn ihr Profil vom Admin freigegeben, abgelehnt oder zur Überarbeitung zurückgegeben wird. Push-Benachrichtigungen (Teil 5) bleiben unverändert.

### Architektur

```
Admin (Freigabe / Ablehnung / Änderungen angefordert)
  → POST /admin/therapists/:id/approve|reject|request-changes
  → sendProfileApprovedEmail()    (fire-and-forget)
  → sendProfileRejectedEmail()    (fire-and-forget)
  → sendProfileChangesRequestedEmail()  (fire-and-forget)
  → Resend API  →  Therapeut-Inbox
```

### E-Mail-Inhalte

| Event | Subject | Beschreibung |
|-------|---------|-------------|
| Freigabe | `Revio – Dein Profil wurde freigegeben ✓` | Grüner Header, Bestätigung der Sichtbarkeit, Hinweis auf App |
| Ablehnung | `Revio – Dein Profil wurde nicht freigegeben` | Roter Header, Verweis auf Support-E-Mail |
| Änderungen erforderlich | `Revio – Änderungen an deinem Profil erforderlich` | Gelber Header, Aufforderung zum Einloggen + Neueinreichen |

### Fehlertoleranz

- Alle drei Mailer-Aufrufe sind fire-and-forget via `.catch((err) => fastify.log.error(...))`
- E-Mail-Fehler blockieren weder die Admin-Aktion noch die HTTP-Response
- Push-Benachrichtigungen sind davon unabhängig — beide Kanäle laufen parallel

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/api/src/utils/mailer.ts` | `sendProfileApprovedEmail()`, `sendProfileRejectedEmail()`, `sendProfileChangesRequestedEmail()` hinzugefügt |
| `apps/api/src/routes/admin.ts` | Import der drei neuen Mailer-Funktionen; fire-and-forget Aufrufe in `/approve`, `/reject`, `/request-changes` |

### Annahmen

- `RESEND_API_KEY` muss gesetzt sein — sonst wirft `getResend()` einen Fehler, der via `.catch()` abgefangen wird (kein Absturz)
- `request-changes` hatte bislang weder Push noch E-Mail — E-Mail ist neu, Push bleibt offen (`RM-PUSH-CHANGES-REQUESTED`)
- Keine HTML-Version mit CTA-Button für Freigabe/Ablehnung — reiner Infotext, da keine spezifische In-App-Aktion nötig
- `therapist.email` ist immer gesetzt (Pflichtfeld bei Registrierung)

---

## Teil 9 — Therapeuten-Such/Hinzufügen-Flow im Manager-Dashboard

### Ausgangslage

Die Handlers `handleTherapistSearch()` und `handleAddTherapist()` sowie die zugehörigen State-Variablen existierten bereits vollständig in `App.js`, wurden jedoch nie in `ManagerDashboardContent` hineingereicht oder dort genutzt. Das Manager-Dashboard bot lediglich die Einladungs-Funktion für neue Therapeuten.

### Was geändert wurde

Die bestehende Logik wurde unverändert gelassen. Lediglich die Prop-Verbindung und ein minimales UI wurden ergänzt.

### Prop-Wiring

| Prop | Quelle (App.js) | Verwendung im Dashboard |
|------|-----------------|------------------------|
| `showAddTherapistForm` | `useState(false)` | Steuert ob das Such-Panel offen ist |
| `setShowAddTherapistForm` | Setter | Toggle-Button + automatisches Schließen nach erfolgreichem Hinzufügen |
| `addTherapistQuery` | `useState('')` | Controlled Value des Suchfelds (`TextInput`) |
| `handleTherapistSearch` | Handler in App.js | `onChangeText` — setzt Query und feuert API-Call ab ≥2 Zeichen |
| `addTherapistResults` | `useState([])` | Wird als Ergebnisliste gerendert |
| `addTherapistLoading` | `useState(false)` | Zeigt „Suche …"-Text während des API-Calls |
| `addingTherapistId` | `useState(null)` | Dimmt den „Hinzufügen"-Button der laufenden Zeile |
| `handleAddTherapist` | Handler in App.js | `onPress` des „Hinzufügen"-Buttons — API-Call, Manager-Refresh, Panel schließen |

### UI-Ergänzungen

Zwischen der Therapeuten-Liste und dem bestehenden „Therapeut einladen"-Button:

1. **Toggle-Button** „Bestehenden Therapeuten hinzufügen" (outlined, muted) — klappt das Such-Panel auf/zu
2. **Such-Panel** (nur wenn aufgeklappt):
   - Auto-fokussiertes `TextInput` (Suche startet ab 2 Zeichen)
   - Lade- und Leer-Zustände
   - Ergebnisliste: Avatar + Name + Stadt + „Hinzufügen"-Button pro Treffer
3. **„Therapeut einladen"-Button** bleibt unverändert darunter

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `apps/mobile/src/App.js` | 8 neue Props in `<ManagerDashboardContent />` ergänzt |
| `apps/mobile/src/mobile-manager-dashboard.js` | Props-Destructuring erweitert; Such/Hinzufügen-UI eingefügt |

### Annahmen

- `GET /manager/therapists/search?q=&practiceId=` existiert bereits und gibt `{ therapists: [...] }` zurück — der Handler rief ihn bereits vor diesem Ticket auf
- `handleAddTherapist` setzt `showAddTherapistForm`, `addTherapistQuery` und `addTherapistResults` bei Erfolg zurück — das Panel schließt sich automatisch
- Suchergebnisse schließen bereits verknüpfte Therapeuten serverseitig aus

---

## Teil 10 — Echte Sichtbarkeit im Admin-UI

### Problem

`reviewStatus === 'APPROVED'` bedeutet nicht automatisch, dass ein Therapeut öffentlich sichtbar ist. Die Admin-UI zeigte bislang nur den `reviewStatus`, was Admins irreführen konnte.

### Sichtbarkeits-Zustände

| State | Bedeutung |
|-------|-----------|
| `not_approved` | `reviewStatus !== 'APPROVED'` — kein öffentliches Profil |
| `blocked` | `APPROVED`, aber ein oder mehrere Blocker verhindern die öffentliche Suche |
| `visible` | Erscheint tatsächlich in der öffentlichen Suche |

### Blocker-Gründe

| Code | Beschreibung |
|------|-------------|
| `profile_incomplete` | Pflichtfelder fehlen (fullName, professionalTitle, bio, specializations, languages) |
| `manually_hidden` | `isVisible === false` |
| `publication_missing` | `onboardingStatus` erfordert explizite Freigabe, aber `isPublished === false` |
| `no_confirmed_link` | Keine Praxis-Links vorhanden |
| `pending_link_only` | Nur PROPOSED/DISPUTED Links — keine bestätigten |
| `practice_not_approved` | CONFIRMED Links vorhanden, aber alle verlinkten Praxen sind nicht APPROVED |

### Architektur

```
apps/api/src/routes/admin.ts
  computeVisibility(t)  →  { visibilityState, publicSearchEligible, blockingReasons }
  mapTherapist(t)       →  fügt visibility-Objekt zum Response hinzu
  GET /admin/therapists         → enthält visibility für jeden Therapeuten
  GET /admin/therapists/:id     → enthält visibility

packages/shared/src/index.ts
  Therapist             → isVisible, isPublished, onboardingStatus ergänzt
  TherapistVisibility   → neues Interface
  TherapistWithLinks    → visibility: TherapistVisibility ergänzt

apps/admin/app/(admin)/therapists/page.tsx
  → Spalte "Sichtbarkeit" mit farbigem Badge + erstem Blocker-Grund

apps/admin/app/(admin)/therapists/[id]/page.tsx
  → Visibility-Karte über den Aktionen: Badge + erklärende Beschreibung + vollständige Blocker-Liste
```

### `computeVisibility` — Logik

Spiegelt exakt die Logik aus `visibility-issues` und `getTherapistPublicationState`:
1. `reviewStatus !== 'APPROVED'` → `not_approved`
2. Profil-Vollständigkeit via `getTherapistPublicationState()`
3. `isVisible` Check
4. `requiresExplicitPublication` + `isPublished` Check
5. Link/Practice-Status-Check

Ein Therapeut ist `visible` wenn alle fünf Checks keine Blocker ergeben.

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/shared/src/index.ts` | `isVisible`, `isPublished`, `onboardingStatus` zu `Therapist`; `VisibilityState`, `TherapistVisibility`, `visibility` zu `TherapistWithLinks` |
| `apps/api/src/routes/admin.ts` | `TherapistRow`-Typ, `computeVisibility()`-Helper, `mapTherapist()` um `isVisible`, `isPublished`, `onboardingStatus`, `visibility` erweitert |
| `apps/admin/app/(admin)/therapists/page.tsx` | Label-Maps + Spalte „Sichtbarkeit" (Badge + erster Blocker-Grund mit +N für weitere) |
| `apps/admin/app/(admin)/therapists/[id]/page.tsx` | Label-Maps + Visibility-Karte mit farbigem linken Rand, Badge, Erklärtext, vollständige Blocker-Liste |

### Annahmen

- `computeVisibility` läuft nur auf bereits geladenen Daten — kein zusätzlicher DB-Call
- Prisma-Query in `GET /admin/therapists` und `GET /admin/therapists/:id` liefert bereits alle benötigten Felder (`isVisible`, `isPublished`, `onboardingStatus`) automatisch da kein `select` sondern `include` verwendet wird
- `VisibilityState`-Typ in `shared` bleibt Admin-intern relevant — `SearchTherapist` und `Therapist`-Basis-Type sind getrennte Shapes

---

## Offene Follow-up-Tickets

| Ticket | Beschreibung |
|--------|-------------|
| `RM-RESEND` | `RESEND_API_KEY` muss in Produktion gesetzt sein, sonst keine Verifikations-E-Mails |
| `RM-TOKEN-EXPIRY` | `emailVerificationToken` hat keine DB-seitige Ablaufzeit — `emailVerificationTokenExpiresAt` ergänzen |
| `RM-INVITE-DEEPLINK` | Invite-E-Mails senden HTTP-URLs, keine `revo://`-Links — auf native Mobile funktioniert das nicht ohne Universal Links oder Scheme-Umstellung |
| `RM-REBUILD` | `app.json` Scheme-Änderung + `expo-notifications`-Plugin erfordern neuen EAS-Build / `expo run:ios` oder `expo run:android` |
| `RM-LANG-EDIT` | Profil-Bearbeitung in `mobile-therapist-dashboard.js` zeigt noch die alte flache Sprachliste — auf Searchable-Multiselect upgraden |
| `RM-TESTS` | API-Tests in `app.test.ts` abdecken: neues Registrierungsformat, Login-Block für unverifizierte Accounts, `POST /auth/verify-email` |
| `RM-DOC-DELETE` | Kein Admin-Endpoint zum Löschen von Dokumenten |
| ~~`RM-DOC-MOBILE-UI`~~ | ~~Mobile App hat keinen UI für Dokument-Upload~~ — erledigt in Teil 7 |
| `RM-DOC-S3` | Dokumente lokal gespeichert — in Produktion auf S3 umstellen |
| `RM-DOC-LIMIT` | Keine Begrenzung der Dokumentenanzahl pro Therapeut |
| `RM-PUSH-REBUILD` | `expo-notifications`-Plugin erfordert nativen Build — funktioniert nicht in Expo Go (neuere SDKs) |
| `RM-PUSH-RECEIPT` | Expo Push Receipts nicht abgerufen — veraltete/ungültige Tokens werden nicht automatisch bereinigt |
| `RM-PUSH-CREDS-IOS` | APNs-Credentials in EAS für iOS-Produktionszustellung konfigurieren |
| `RM-PUSH-CREDS-ANDROID` | FCM-Credentials für Android-Produktionszustellung konfigurieren |
| `RM-PUSH-CHANGES-REQUESTED` | `request-changes`-Aktion sendet noch keine Push-Benachrichtigung (E-Mail wurde in Teil 8 ergänzt) |
| `RM-PUSH-SUSPENDED` | `suspend`-Aktion sendet noch keine Push-Benachrichtigung |
| `RM-MAP-ANDROID-KEY` | `android.config.googleMaps.apiKey` in `app.json` ist leer — vor EAS-Android-Build befüllen |
| `RM-MAP-PROVIDER-EXPLICIT` | `PROVIDER_GOOGLE` nicht explizit gesetzt — könnte je nach RN-Maps-Version oder Expo-Config unerwarteten Provider auswählen; für Android ggf. explizit setzen |
| `RM-MGR-SEARCH-CLOSE` | Such-Panel bleibt offen wenn Manager die aktive Praxis wechselt — `setShowAddTherapistForm(false)` bei `activePracticeId`-Änderung feuern |
| `RM-MGR-SEARCH-BACKEND` | Prüfen ob `/manager/therapists/search` bereits verknüpfte Therapeuten aus Ergebnissen ausblendet — sonst verwirrende Doppel-Hinzufügen-Versuche möglich |
| `RM-MGR-SEARCH-ERROR` | Bei Fehler in `handleAddTherapist` bleibt das Panel offen, aber Ergebnisliste bleibt sichtbar — Suchfeld und Ergebnisse nach Fehler erhalten damit kein erneutes Tippen nötig ist |
| `RM-VIS-SHARED-TYPE` | `isVisible`, `isPublished`, `onboardingStatus` wurden zur geteilten `Therapist`-Basis-Type hinzugefügt — falls diese Felder in `SearchTherapist` oder anderen öffentlichen Shapes landen sollten, separat prüfen |
| `RM-VIS-DASHBOARD` | Admin-Dashboard-Übersichtskarte (`/`) zeigt noch keine Visibility-Issues-Zusammenfassung — `GET /admin/visibility-issues` könnte dort verlinkt werden |
