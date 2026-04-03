# Revio Plattform-Architektur: Reverse Engineering und Lern-Dokumentation

## 1. Executive Summary

Revio ist im Kern ein Monorepo mit drei aktiven Laufzeit-Teilen:

- eine Admin-Oberfläche in Next.js unter `apps/admin`
- eine API in Fastify + Prisma unter `apps/api`
- eine Mobile-App in Expo/React Native unter `apps/mobile`

Die Plattform hat zwei sehr unterschiedliche Frontends:

- Das Admin-Frontend ist ein klassisches serverseitiges Dashboard. Es rendert Seiten im Next App Router, holt Daten direkt auf dem Server aus der API und triggert Moderationsaktionen per Server Actions.
- Die Mobile-App ist stark clientseitig organisiert. Fast die gesamte App-Logik sitzt in `apps/mobile/src/App.js`: Routing, State, API-Aufrufe, Persistenz, Onboarding, Suche, Profile, Praxisverwaltung und Teile der Rollenlogik.

Architektonisch ist die API der eigentliche Mittelpunkt. Dort liegen:

- das Datenmodell in `apps/api/prisma/schema.prisma`
- die Geschäftslogik für Registrierung, Login, Suche, Einladungen, Sichtbarkeit und Admin-Freigaben
- die Kopplung zwischen Therapeut:innen, Praxen und Praxismanager:innen

Wichtig für das Gesamtverständnis:

- Es gibt kein echtes gemeinsames Frontend-Designsystem zwischen Admin und Mobile.
- Das einzige echte Shared-Package ist `packages/shared/src/index.ts` mit TypeScript-Typen.
- Die Plattform befindet sich in einer Auth-Migration: Es gibt eine neue zentrale `User`-Tabelle, aber gleichzeitig noch Legacy-Felder wie `passwordHash` und `sessionToken` direkt auf `Therapist` und `PracticeManager`.
- Die Discovery ist fachlich therapeut:innenzentriert, auch wenn sie Praxisdaten mitliefert und die Karte Praxen zeigt.

Das wichtigste mentale Modell ist:

Patient:in oder Therapeut:in interagiert im Frontend -> Frontend hält lokalen UI-State -> Frontend ruft Fastify-Routen auf -> die API liest/schreibt Prisma-Modelle -> Antwort wird im Frontend wieder in lokale View-Modelle gemappt.


## 2. Repository Overview

### Monorepo-Struktur

Die aktive Workspace-Struktur wird über `pnpm-workspace.yaml` definiert und umfasst nur:

- `apps/*`
- `packages/*`

Die Start- und Workspace-Skripte liegen in `package.json` im Repo-Root.

Aktive Anwendungen und Pakete:

- `apps/admin`: Next.js-Admin
- `apps/api`: Fastify-API mit Prisma/SQLite
- `apps/mobile`: Expo-App
- `packages/shared`: gemeinsame Typen

Wichtige Entry Points:

- Admin: `apps/admin/app/layout.tsx`
- Admin-Seiten: `apps/admin/app/login/page.tsx` und `apps/admin/app/(admin)/*`
- API-Bootstrap: `apps/api/src/server.ts`
- API-App-Zusammenbau: `apps/api/src/app.ts`
- Mobile-Entrypoint: `apps/mobile/index.js`
- Mobile-Hauptdatei: `apps/mobile/src/App.js`

### Verwendete Frameworks und Libraries

Admin:

- Next.js 15 App Router in `apps/admin/package.json`
- React 19
- Server Components und Server Actions

API:

- Fastify in `apps/api/package.json`
- Prisma mit SQLite
- Zod für Validierung
- Resend für E-Mails
- Vitest für API-Tests

Mobile:

- Expo / React Native in `apps/mobile/package.json`
- `expo-location` für Standort
- `react-native-maps` für native Karten
- AsyncStorage für lokale Persistenz
- Image Picker und Sharing

### Wie Admin und App getrennt sind

Die Trennung ist klar:

- Das Admin-Frontend lebt vollständig in `apps/admin`.
- Die Patient:innen-/Therapeut:innen-/Manager:innen-App lebt vollständig in `apps/mobile`.
- Beide sprechen dieselbe API in `apps/api` an.

Gemeinsame Frontend-Komponenten zwischen Admin und Mobile existieren nicht sichtbar im Workspace.

### Was wirklich geteilt ist

Das sichtbare Shared-Package `packages/shared/src/index.ts` enthält:

- Status-Typen wie `ReviewStatus` und `LinkStatus`
- Kern-Entity-Typen für Therapeut:in, Praxis und Links
- Search-Contracts wie `SearchInput`, `SearchTherapist`, `SearchPractice`
- Admin-Datentypen wie `AdminStats`

Wichtig: Geteilte Geschäftslogik liegt nicht dort, sondern fast vollständig in der API.

### Auffällige Nebenspur im Repo

Im Repo gibt es zusätzliche Verzeichnisse wie `AdminRevio/`, `.next`, `.expo` und Build-Artefakte. Laut Workspace-Konfiguration gehören sie nicht zur aktiven Monorepo-Struktur. Für das Verständnis der Plattform solltest du sie am Anfang ignorieren.


## 3. Architektur der Admin-Website

### Start und Laufzeit

Die Admin-App startet über `apps/admin/package.json` mit `next dev --port 3000`.

Die Root-Struktur:

- `apps/admin/app/layout.tsx`: globales HTML-Layout und Metadaten
- `apps/admin/app/login/layout.tsx`: leitet bei vorhandenem Admin-Cookie direkt auf `/` um
- `apps/admin/app/(admin)/layout.tsx`: schützt den gesamten internen Bereich

Die Zugriffssicherung ist einfach:

- Login setzt das Cookie `revio_admin_token` in `apps/admin/lib/actions.ts`
- Das geschützte Layout in `apps/admin/app/(admin)/layout.tsx` prüft dieses Cookie
- Danach ruft es `getAdminSessionState()` aus `apps/admin/lib/api.ts` auf
- Wenn die API `401` liefert, wird das Cookie gelöscht und auf `/login` umgeleitet

### Datenfluss der Admin-App

Die Admin-App spricht nie direkt mit der Datenbank. Der Fluss ist immer:

Admin-Seite -> `apps/admin/lib/api.ts` oder `apps/admin/lib/actions.ts` -> Admin-API unter `/admin/*` -> Prisma

Wichtige Bausteine:

- `apps/admin/lib/api-base.ts`: berechnet mögliche API-Basis-URLs
- `apps/admin/lib/api.ts`: lesende Zugriffe
- `apps/admin/lib/actions.ts`: schreibende Aktionen

Die API-Basis-URL ist bewusst robust:

- `INTERNAL_API_URL`
- `NEXT_PUBLIC_API_URL`
- Fallback `http://localhost:4000`
- Fallback `http://127.0.0.1:4000`

Das ist wichtig, weil die Admin-App sowohl serverseitig als auch lokal im Dev-Betrieb mit unterschiedlichen Loopback-Adressen laufen kann.

### Seitenstruktur

Es gibt nur wenige echte Admin-Seiten:

- `apps/admin/app/login/page.tsx`: Login-Formular
- `apps/admin/app/(admin)/page.tsx`: Dashboard/Übersicht
- `apps/admin/app/(admin)/therapists/page.tsx`: Therapeut:innen-Warteschlange
- `apps/admin/app/(admin)/practices/page.tsx`: Praxis-Warteschlange
- `apps/admin/app/(admin)/links/page.tsx`: Verknüpfungen
- `apps/admin/app/(admin)/managers/page.tsx`: Manager-Accounts
- `apps/admin/app/(admin)/profiles/page.tsx`: aktuell nur Platzhalter

### Wie die wichtigsten Admin-Seiten funktionieren

Dashboard:

- `apps/admin/app/(admin)/page.tsx` lädt parallel `api.getStats()` und `api.getVisibilityIssues()`
- Es rendert Kennzahlen, Review-Prioritäten und einen Meilenstein-Modal
- `visibility-issues` ist aktuell fachlich nicht umgesetzt, weil die API dazu in `apps/api/src/routes/admin.ts` immer `{ count: 0, issues: [] }` zurückgibt

Therapeut:innen:

- `apps/admin/app/(admin)/therapists/page.tsx` holt alle Therapeut:innen über `api.getTherapists()`
- Filterung passiert auf der Seite selbst über Query-Parameter `status`, `q`, `city`
- Die Seite berechnet eigene Prioritätssignale wie fehlende Profilfelder und SLA-Überschreitung
- Aktionen sind `Freigeben`, `Ablehnen`, `Änderungen`, `Sperren`

Praxen:

- `apps/admin/app/(admin)/practices/page.tsx` funktioniert analog
- Zusätzliche Priorität kommt hier aus offenen Link-Fällen

Verknüpfungen:

- `apps/admin/app/(admin)/links/page.tsx` ist fachlich wichtig, weil dort der Zusammenhang zwischen Praxis und Therapeut:in moderiert wird
- Die Seite markiert "broken chains": Therapeut:in und Praxis sind beide freigegeben, aber der Link ist noch nicht bestätigt
- Genau diese Fälle blockieren öffentliche Sichtbarkeit

Manager:

- `apps/admin/app/(admin)/managers/page.tsx` ist eine reine Übersichtsliste
- Sie zeigt, ob ein Manager zusätzlich ein Therapeut:innenprofil hat

### UI-Architektur

Wichtige Komponenten:

- `apps/admin/components/admin-shell.tsx`: Layout, mobile Navigation, API-Warnbanner
- `apps/admin/components/sidebar.tsx`: Navigation
- `apps/admin/components/action-buttons.tsx`: UI für Review-Aktionen
- `apps/admin/components/deadline-timer.tsx`: 48h-SLA-Anzeige
- `apps/admin/components/page-shell.tsx`: einheitlicher Seitenrahmen

### Fehlerbehandlung

Die globale Fehlerseite liegt in `apps/admin/app/error.tsx`.

Sie ist wichtig, weil sie genau den Zustand abfängt, den du vorher gesehen hast:

- wenn die Admin-API nicht erreichbar ist
- oder Requests abgelehnt werden

### Was die Admin-App bewusst nicht ist

- Sie hat keine eigenen Tests; `apps/admin/package.json` sagt explizit `No admin tests yet`.
- Sie hat keine Detailseiten für einzelne Entities mit tiefer Bearbeitung.
- Die globale Profilsuche ist in `apps/admin/app/(admin)/profiles/page.tsx` nur geplant.


## 4. Mobile App Architektur

### Start und Grundstruktur

Der Mobile-Entrypoint ist sehr klein:

- `apps/mobile/index.js` registriert `App` aus `apps/mobile/src/App.js`

Die Expo-Konfiguration liegt in `apps/mobile/app.json` und enthält:

- Standort-Permissions für iOS und Android
- Web-Bundler = Metro

### Das prägende Architekturmerkmal

`apps/mobile/src/App.js` ist die zentrale Schaltstelle der gesamten App.

Diese Datei übernimmt gleichzeitig:

- App-Routing
- globalen UI-State
- Auth-State
- Persistenz in AsyncStorage
- API-Aufrufe
- Suchlogik
- Onboarding-Logik
- Praxisverwaltung
- Invite-Claim-Flow
- Teile der Rollenlogik

Es gibt keine React-Navigation-Struktur und keinen externen State-Store wie Redux oder Zustand. Navigation passiert komplett über React State und viele `if`-Abzweigungen in `renderTab()`.

### Mobile-Navigation

Die Hauptnavigation basiert auf Tabs aus `apps/mobile/src/mobile-utils.js`:

- `discover`
- `favorites`
- `therapist`
- `options`

Zusätzlich gibt es viele "subscreens" als Booleans oder Selected-Entities:

- `selectedTherapist`
- `selectedPractice`
- `showCreatePractice`
- `showPracticeSearch`
- `showInvitePage`
- `showPracticeAdmin`
- `showInviteClaim`

Die zentrale Entscheidung liegt in `renderTab()` in `apps/mobile/src/App.js`.

Das bedeutet praktisch:

User tippt etwas an -> `App.js` setzt State -> `renderTab()` wechselt den Screen.

### Mobile-Module und ihre Verantwortung

Die UI ist in mehrere Dateien ausgelagert, die aber fast ausschließlich von `App.js` mit Props versorgt werden:

- `apps/mobile/src/mobile-discover-screen.js`: Suche, Ergebnisliste, Kartenansicht
- `apps/mobile/src/mobile-public-profiles.js`: öffentliche Praxis- und Therapeut:innenprofile
- `apps/mobile/src/mobile-therapist-screens.js`: Login, Landing, Praxis erstellen, Praxis suchen, Einladungsseite
- `apps/mobile/src/mobile-therapist-dashboard.js`: Therapeut:innen-Dashboard und Praxis-Admin
- `apps/mobile/src/mobile-manager-dashboard.js`: Manager-Dashboard
- `apps/mobile/src/mobile-utils.js`: Konstanten, Formatierer, API-Basis-URL, Mapper
- `apps/mobile/src/mobile-translations.js`: DE/EN-Texte
- `apps/mobile/src/MapStub.js`: Web/Desktop-Kartenstub

### Discovery / Suche

Die Discovery lebt fachlich an zwei Stellen:

- Controller und State in `apps/mobile/src/App.js`
- Rendering in `apps/mobile/src/mobile-discover-screen.js`

Wichtige Search-States in `App.js`:

- `query`
- `city`
- `userCoords`
- `searchRadius`
- `homeVisit`
- `kassenart`
- `fortbildungen`
- `results`
- `searched`
- `viewMode`

Der API-Aufruf läuft über `runSearchWith()` in `apps/mobile/src/App.js`.

Der Request geht an `/search` und schickt:

- Suchbegriff
- Ort oder `origin`
- Radius
- bestehende Filter

Die Antwort wird mit `mapApiTherapist()` aus `apps/mobile/src/mobile-utils.js` in ein Mobile-View-Model umgewandelt.

### Kartenansicht

Die Kartenansicht ist in `apps/mobile/src/mobile-discover-screen.js`.

Native Mobile:

- verwendet `react-native-maps`
- zeigt Origin-Marker, Radius-Kreis und Praxis-Marker

Web/Desktop:

- verwendet `apps/mobile/src/MapStub.js`
- das ist keine echte Straßenkarte, sondern eine schematische Projektionsfläche
- Marker und Radius werden aber trotzdem visualisiert

Wichtig: Die Karte nutzt bewusst dasselbe gefilterte Resultset wie die Liste. Die Praxismarker werden aus `results` dedupliziert, nicht mit einer separaten Map-Suche erzeugt.

### Öffentliche Detailseiten

Praxisprofil:

- Screen in `apps/mobile/src/mobile-public-profiles.js`
- Datenladung über `openPractice()` in `apps/mobile/src/App.js`
- API-Route: `/practice-detail/:id`

Therapeut:innenprofil:

- Screen in `apps/mobile/src/mobile-public-profiles.js`
- Datenladung über `openTherapistById()` in `apps/mobile/src/App.js`
- API-Route: `/therapist/:id`

### Therapeut:innenbereich

Unangemeldet:

- `TherapistLandingScreen` aus `apps/mobile/src/mobile-therapist-screens.js`
- dort starten Registrierung und Login

Angemeldet:

- `TherapistDashboardScreen` aus `apps/mobile/src/mobile-therapist-dashboard.js`
- zeigt Profil, Sichtbarkeit, Praxen und Admin-Funktionen

Wenn ein Therapeut zugleich Praxis-Admin ist, erscheinen zusätzliche Praxisverwaltungswege:

- Einladungen
- Verknüpfungsanfragen annehmen/ablehnen
- Praxis bearbeiten

### Manager:innenbereich

Wenn `accountType === 'manager'`, rendert `App.js` das `ManagerDashboardContent` aus `apps/mobile/src/mobile-manager-dashboard.js`.

Dieser Bereich unterstützt:

- mehrere Praxen pro Manager
- optional ein eigenes Therapeut:innenprofil
- Sichtbarkeitssteuerung dieses Profils
- Praxisedits
- Therapeut:innen entfernen
- neue Praxen anlegen

### Persistenz auf dem Gerät

Die lokale Persistenz ist sehr konkret und überschaubar. In `apps/mobile/src/App.js` werden unter anderem gespeichert:

- `revio_auth_token`
- `revio_account_type`
- `savedCity`
- `savedCoords`
- `savedLocationLabel`
- `appLanguage`
- `revio_favorites`
- `revio_fav_practices`

Wichtig: Favoriten sind nur lokal gespeichert. Es gibt dafür keinen Backend-Sync.

### Konfiguration und Environment

Die Mobile-App nutzt `EXPO_PUBLIC_API_URL` über `getBaseUrl()` in `apps/mobile/src/mobile-utils.js`.

Zusätzlich setzt `mobile-utils.js` spezielle Header für Tunnel-Setups:

- `bypass-tunnel-reminder` für `loca.lt`
- `ngrok-skip-browser-warning` für ngrok


## 5. Shared Modules and Common Logic

### Was wirklich shared ist

Das eigentliche Shared-Package ist `packages/shared/src/index.ts`.

Es ist wichtig, weil es den Vertrag zwischen API und Frontends definiert:

- Suchparameter
- Search-Ergebnisstruktur
- Admin-Statistiken
- Entity-Typen

Für das Verständnis heißt das:

- Die API ist die Quelle der Wahrheit.
- `packages/shared` beschreibt nur die Form der Daten.

### Was nicht shared ist

Es gibt keine gemeinsame UI-Bibliothek zwischen Admin und Mobile.

Auch die meisten Business-Regeln liegen nicht in `packages/shared`, sondern in der API:

- Profilvollständigkeit in `apps/api/src/utils/profile-completeness.ts`
- Suchnormalisierung und Scoring in `apps/api/src/utils/search-utils.ts`
- Geocoding in `apps/api/src/utils/geocode.ts`

### Gemeinsame fachliche Kernlogik

Die wichtigste fachliche Helper-Datei ist `apps/api/src/utils/profile-completeness.ts`.

Sie bestimmt:

- welche Profilfelder für Vollständigkeit nötig sind
- ob ein Profil öffentlich suchbar sein darf

Die zentrale Funktion ist `getTherapistPublicationState()`.

Öffentliche Suchbarkeit entsteht nur, wenn:

- `reviewStatus === APPROVED`
- `isVisible === true`
- und bei eingeladenen oder managerseitig angelegten Profilen zusätzlich:
  - Profil vollständig
  - `isPublished === true`

Das ist die Kernregel, die weite Teile der Plattform steuert.


## 6. Auth, Rollen, Berechtigungen und Sichtbarkeitslogik

### Rollenmodell

Sichtbare Rollen im Code:

- anonyme Patient:innen ohne Account
- Therapeut:in
- Praxismanager:in
- Praxismanager:in mit zusätzlichem Therapeut:innenprofil
- Admin

Das formale Rollen-Enum liegt in `apps/api/prisma/schema.prisma` als `Role`.

### Datenmodell für Accounts

Es gibt eine neue zentrale Tabelle `User` in `apps/api/prisma/schema.prisma`.

Daneben existieren aber weiterhin auth-relevante Felder in:

- `Therapist`
- `PracticeManager`

Das ist der Grund, warum `apps/api/src/routes/auth.ts` mehrere Login-Wege hat:

- zuerst neue `User`-basierte Logins
- danach Legacy-Fallbacks für Therapeut:innen
- danach Legacy-Fallbacks für Manager:innen

### Session-Handling

Admin:

- einfacher Bearer-Token aus Environment
- geprüft in `apps/api/src/plugins/admin-auth.ts`

Therapeut:innen und Manager:innen:

- Session-Token werden in der Datenbank gespeichert
- Mobile speichert den Token zusätzlich lokal in AsyncStorage

Wichtige Endpunkte:

- `/auth/login`
- `/auth/me`
- `/auth/logout`
- `/manager/register`
- `/manager/login`
- `/manager/me`
- `/manager/logout`

### Auth-Fluss für Therapeut:innen

Login:

- Mobile schickt E-Mail + Passwort an `/auth/login`
- die API bestimmt, ob es ein Therapeut:innen- oder Manager:innenkonto ist
- Mobile speichert Token + `accountType`
- danach lädt Mobile das Profil nach:
  - `/auth/me` für Therapeut:innen
  - `/manager/me` für Manager:innen

### Auth-Fluss für Admin

- Admin-Login sendet Credentials an `/admin/login`
- Antwort enthält den statischen Admin-Token
- der Token wird als Cookie `revio_admin_token` gespeichert
- alle weiteren Admin-Requests schicken ihn als Bearer-Token an `/admin/*`

### Berechtigungen

Therapeut:in:

- darf eigenes Profil über `/auth/me` lesen und ändern
- darf Praxis suchen und Link-Anfrage senden
- darf eigene Praxis erstellen

Therapeut:in als Praxis-Admin:

- darf eigene Praxis über `/my/practice` verwalten
- darf Verknüpfungsanfragen prüfen
- darf Therapeut:innen einladen oder neu anlegen

Manager:in:

- darf eigene Praxen über `/manager/practice` und `/manager/practices` verwalten
- darf Therapeut:innen entfernen oder anlegen
- darf Einladungstoken für eine ausgewählte Praxis laden

Admin:

- darf Review-Status und Link-Status global verändern

### Review- und Link-Status

Review-Status:

- `DRAFT`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `CHANGES_REQUESTED`
- `SUSPENDED`

Link-Status:

- `PROPOSED`
- `CONFIRMED`
- `DISPUTED`
- `REJECTED`

Wichtig: Öffentliche Sichtbarkeit hängt nicht nur am Profilstatus, sondern auch an der Praxisverknüpfung.

Ein Profil kann also fachlich "freigegeben" sein und trotzdem in der Suche fehlen, wenn:

- kein bestätigter Link existiert
- die Praxis nicht freigegeben ist
- das Profil nicht sichtbar/veröffentlicht ist


## 7. Main Workflows End-to-End

### 7.1 Patient:innensuche / Discovery

Start:

- `apps/mobile/src/mobile-discover-screen.js`
- Controller: `runSearchWith()` in `apps/mobile/src/App.js`

Ablauf:

1. User gibt Suchbegriff ein oder tippt Quick Chip.
2. `runSearchWith()` baut den Request für `/search`.
3. Die API in `apps/api/src/routes/search.ts` lädt nur öffentlich freigegebene Therapeut:innen mit bestätigten, freigegebenen Praxen.
4. Dort werden Filter, Relevanz und optional Distanz berechnet.
5. Mobile mappt das Ergebnis über `mapApiTherapist()` in `apps/mobile/src/mobile-utils.js`.
6. Die Liste rendert Therapeut:innenkarten, die Karte rendert deduplizierte Praxismarker.

Bedingungen:

- `/search` verlangt `query` und mindestens `city` oder `origin`
- nur `publicSearchEligible` Profile sind sichtbar

Erfolg:

- Therapeut:innen erscheinen als Karten in der Liste
- Praxen erscheinen als Marker auf der Karte

Fehler / Sonderfall:

- wenn keine Location gesetzt ist, öffnet Mobile zuerst das Location-Sheet
- bei kaputtem Tunnel zeigt Mobile eine Verbindungs-Alert mit API-URL

Rolle:

- anonym oder eingeloggt, beides möglich

### 7.2 Nearby Search / Map

Start:

- Location-Sheet und Radiuslogik in `apps/mobile/src/App.js`
- Kartenrendering in `apps/mobile/src/mobile-discover-screen.js`

Ablauf:

1. User wählt GPS oder manuelle Adresse.
2. Mobile speichert `city`, `locationLabel`, `savedCoords`.
3. `runSearchWith()` sendet `origin` und `radiusKm` an `/search`.
4. `apps/api/src/routes/search.ts` berechnet `distKm` über Haversine pro Praxis.
5. Die API filtert Praxen außerhalb des Radius heraus und gibt nur passende Links zurück.
6. Mobile übernimmt dieselben Ergebnisse für Liste und Karte.
7. Die Karte zeigt:
   - Origin-Marker
   - Radius-Kreis
   - Praxismarker

Wichtig:

- Die Suchlogik ist nicht map-spezifisch.
- Die Karte verwendet dasselbe Resultset wie die Liste.

### 7.3 Öffentliche Praxis- und Therapeut:innenprofile

Praxis:

- User tippt Praxis -> `openPractice()` in `apps/mobile/src/App.js`
- API-Aufruf zu `/practice-detail/:id`
- Route in `apps/api/src/routes/search.ts`
- Ergebnis wird in `PracticeProfileScreen` gerendert

Therapeut:in:

- User tippt Therapeut:in -> `openTherapistById()`
- API-Aufruf zu `/therapist/:id`
- Ergebnis wird in `TherapistProfileScreen` gerendert

Im Repo sichtbar:

- Es gibt keinen Buchungsflow.
- Der konkrete Kontaktflow ist Telefon oder Karten-/Maps-Link.

### 7.4 Therapeut:innen-Onboarding / Selbstregistrierung

Start:

- `TherapistLandingScreen` in `apps/mobile/src/mobile-therapist-screens.js`
- Registrierungsflow in `renderRegister()` in `apps/mobile/src/App.js`

Schritte:

1. Accountdaten
2. persönliche Angaben
3. fachliches Profil
4. Praxis verknüpfen oder anlegen oder überspringen
5. Vorschau und Einreichen

API:

- `POST /register/therapist` in `apps/api/src/routes/register.ts`

Was serverseitig passiert:

- Validierung mit Zod
- optionale neue Praxis oder Link zu bestehender Praxis
- Erstellung von `User`
- Erstellung von `Therapist`
- optional Erstellung eines Links zu einer Praxis

Statuslogik:

- in Dev/Test werden Profile und neue Praxen direkt `APPROVED`
- in Production bleiben sie `PENDING_REVIEW`

### 7.5 Therapeut:innen-Login und Profilpflege

Start:

- `LoginScreen` in `apps/mobile/src/mobile-therapist-screens.js`
- `handleLogin()` in `apps/mobile/src/App.js`

Ablauf:

1. Mobile sendet Login an `/auth/login`
2. API erkennt Kontoart
3. Mobile speichert Token und `accountType`
4. Mobile lädt `/auth/me`
5. `TherapistDashboardScreen` zeigt das Profil
6. Änderungen werden über `PATCH /auth/me` gespeichert

Dateien:

- `apps/api/src/routes/auth.ts`
- `apps/mobile/src/mobile-therapist-dashboard.js`

### 7.6 Praxis anlegen oder mit Praxis verknüpfen

Neue Praxis:

- UI: `CreatePracticeScreen` in `apps/mobile/src/mobile-therapist-screens.js`
- Handler: `handleCreatePractice()` in `apps/mobile/src/App.js`
- API: `POST /practice` in `apps/api/src/routes/practice.ts`

Serverseitig:

- Praxis wird erstellt
- falls nötig wird ein `PracticeManager` für diesen Therapeuten erzeugt
- Manager-Zuordnung wird angelegt
- Therapeut wird bestätigt mit der Praxis verlinkt

Bestehende Praxis verknüpfen:

- UI: `PracticeSearchScreen`
- API-Suche: `GET /practice/search`
- Anfrage: `POST /practice/:id/connect`
- Ergebnis ist ein `PROPOSED` Link

### 7.7 Praxismanager-Onboarding

Start:

- `renderManagerReg()` in `apps/mobile/src/App.js`

Ablauf:

1. Accountdaten
2. Praxisdaten
3. Rollenwahl
4. optional eigenes Therapeut:innenprofil
5. Zusammenfassung

API:

- `POST /manager/register` in `apps/api/src/routes/manager-auth.ts`

Serverseitig:

- User wird als `manager` angelegt
- Praxis wird erstellt
- erste `ManagerPracticeAssignment` wird angelegt
- optional wird gleichzeitig ein Therapeut:innenprofil erstellt

Wenn `isTherapist=true`:

- das Profil startet als `manager_onboarding`
- es ist nicht automatisch öffentlich

### 7.8 Admin Review / Approval

Start:

- Admin-Seiten in `apps/admin/app/(admin)/*`

Ablauf für Therapeut:innen:

1. Admin lädt Warteschlange über `/admin/therapists`
2. Aktion ruft z. B. `/admin/therapists/:id/approve`
3. `apps/api/src/routes/admin.ts` setzt `reviewStatus`
4. Beim Approve werden zusätzlich offene Praxen und Links desselben Therapeuten automatisch freigegeben/bestätigt

Ablauf für Praxen:

- ähnlich über `/admin/practices/*`

Ablauf für Links:

- Admin bestätigt, lehnt ab oder markiert als umstritten über `/admin/links/*`

### 7.9 Profilsichtbarkeit / Veröffentlichung

Das ist einer der wichtigsten Geschäftsprozesse.

Zentrale Logik:

- `apps/api/src/utils/profile-completeness.ts`
- `getTherapistProfileCompletion()`
- `getTherapistPublicationState()`

Besonders wichtig für eingeladene und managerseitig angelegte Profile:

1. Profil wird angelegt als `invited` oder `manager_onboarding`
2. Es ist nicht automatisch öffentlich
3. Nach Claim oder Profilbearbeitung kann `visibilityPreference` gesetzt werden
4. Nur wenn das Profil vollständig ist und explizit veröffentlicht wurde, wird `isPublished=true`
5. Erst dann wird es in Suche und Praxisdetail sichtbar

### 7.10 Einladung von Therapeut:innen

Es gibt zwei Einladungsvarianten.

Variante A: Praxisadmin lädt vorhandene Therapeut:innen ein

- UI: Invite-Suche im Therapeut:innen-Praxis-Admin
- API: `POST /my/practice/invite`
- Ergebnis: `PROPOSED` Link, initiiert von `ADMIN`

Variante B: Praxisadmin oder Manager erstellt neues Profil direkt

- UI: `InvitePageScreen`
- API:
  - `/my/practice/create-therapist`
  - oder `/manager/practice/create-therapist`
- Ergebnis:
  - neuer `Therapist`
  - bestätigter Praxislink
  - `Invitation`-Datensatz
  - optional E-Mail über Resend

### 7.11 Invitation Claim Flow

Start:

- Deep-Link-Handling in `apps/mobile/src/App.js`
- Screens in `renderInviteClaimScreen()`

Ablauf:

1. App liest `token` aus der URL
2. `GET /invite/validate`
3. Eingeladene:r Therapeut:in setzt Passwort via `POST /invite/claim`
4. Die API markiert die Einladung als verwendet und erzeugt/aktualisiert `User`
5. Danach zeigt die App den Sichtbarkeitsdialog
6. Sichtbarkeit wird über `PATCH /invite/visibility` gesetzt

### 7.12 Favoriten

Favoriten sind rein lokal.

Dateien:

- State in `apps/mobile/src/App.js`
- UI in `renderFavorites()`

Gespeichert wird in AsyncStorage:

- `revio_favorites`
- `revio_fav_practices`

Es gibt keinen Backend-Endpunkt dafür.

### 7.13 Kontakt / Booking

Im Code sichtbar:

- Telefonanruf
- Karten-/Maps-Link
- Teilen öffentlicher Profil-Links

Nicht sichtbar:

- kein Terminbuchungssystem
- keine Chat-Funktion
- keine Server-seitige Anfrage an eine Praxis außer Einladungen/Links


## 8. Wichtige Dateien und ihre Rolle

### Kritische Dateien

`apps/api/prisma/schema.prisma`

- Das wichtigste Modell der gesamten Plattform.
- Definiert User, Therapist, Practice, PracticeManager, Invitation, Links und Logs.
- Wenn du das Rollen- und Datenmodell verstehen willst, lies diese Datei zuerst.

`apps/api/src/app.ts`

- Baut die gesamte API zusammen.
- Hier siehst du alle registrierten Plugins und Routen.
- Diese Datei zeigt dir, welche Features überhaupt zur Laufzeit existieren.

`apps/api/src/routes/auth.ts`

- Kern für Login, `/auth/me`, Profil-Update und Logout.
- Wichtig, weil hier die Hybrid-Auth zwischen `User` und Legacy-Feldern sichtbar wird.
- Wird direkt von Mobile für Therapeut:innen genutzt.

`apps/api/src/routes/manager-auth.ts`

- Zentrale Datei für Praxismanager:innen.
- Enthält Registrierung, Login, Mehrfachpraxen, Profil-/Praxis-Updates, Entfernen von Therapeut:innen und zusätzliche Praxisanlage.
- Fachlich sehr wichtig, weil hier das Manager-Modell wirklich umgesetzt wird.

`apps/api/src/routes/practice.ts`

- Therapeut:innen-seitige Praxislogik.
- Neue Praxis erstellen, bestehende Praxis suchen, Connect-Request senden, eigene Praxis verwalten, Einladungen, Join per Token, Notifications.
- Zeigt die Perspektive "Therapeut als Praxisadmin".

`apps/api/src/routes/invite.ts`

- Voller Einladung- und Claim-Flow.
- Besonders wichtig für veröffentlichte vs. noch nicht veröffentlichte Profile.

`apps/api/src/routes/search.ts`

- Discovery-Kern der Plattform.
- Enthält Suchvalidierung, Relevanzlogik, Radiusfilter, Distanzberechnung, Detailendpunkte und Suggestions.
- Wenn du die Patient:innenperspektive verstehen willst, ist das die zentrale Backend-Datei.

`apps/api/src/utils/profile-completeness.ts`

- Kleine Datei, aber fachlich extrem wichtig.
- Sie entscheidet, wann ein Profil vollständig und öffentlich suchbar ist.
- Viele UI-Effekte auf Mobile lassen sich auf diese Datei zurückführen.

`apps/mobile/src/App.js`

- De facto die Mobile-Architektur in einer Datei.
- Exportiert nichts Besonderes außer der App selbst, ist aber der zentrale Orchestrator.
- Fast jede User-Interaktion der App läuft irgendwann hier durch.

`apps/mobile/src/mobile-discover-screen.js`

- Rendert Suche, Liste und Karte.
- Fachlich der wichtigste patientenseitige Screen.

`apps/mobile/src/mobile-manager-dashboard.js`

- Zeigt das Manager-Dashboard.
- Wichtig, wenn du verstehen willst, wie mehrere Praxen und Manager+Therapeut-Profil zusammenlaufen.

`apps/admin/lib/api.ts`

- Lesende Datendrehscheibe der Admin-App.
- Server Components benutzen diese Datei für Stats, Warteschlangen und Übersichten.

`apps/admin/lib/actions.ts`

- Schreibende Admin-Aktionen.
- Hier werden Review-Aktionen an die API gebunden und anschließend Seiten revalidiert.

### Unterstützende Dateien

`apps/mobile/src/mobile-utils.js`

- Enthält die API-Basis-URL, Search-Mapper, Distanzformatierung, Sprachhilfen und UI-Konstanten.
- Sehr nützlich, um zu verstehen, wie API-Daten in UI-Daten umgewandelt werden.

`apps/mobile/src/mobile-public-profiles.js`

- Öffentliche Detailprofile für Therapeut:innen und Praxen.

`apps/mobile/src/mobile-therapist-screens.js`

- Sammlung eher "flow-orientierter" Screens: Landing, Login, Praxis erstellen/suchen, Invite-UI.

`apps/mobile/src/mobile-therapist-dashboard.js`

- Zeigt Therapeut:innen-Dashboard und Praxis-Admin-Ansicht.

`apps/mobile/src/MapStub.js`

- Web-Fallback für Karten.
- Wichtig, wenn du verstehen willst, warum "Desktop" in diesem Projekt nicht dieselbe Kartenqualität wie native Mobile hat.

`apps/api/src/utils/geocode.ts`

- Geocodiert Praxisadressen bei Create/Update.

`apps/api/src/routes/upload.ts`

- Speichert Profilfotos lokal unter `apps/uploads`.

`apps/api/src/utils/mailer.ts`

- Sendet Einladungen und Re-Invites per Resend.

`apps/api/prisma/seed.ts`

- Sehr hilfreich zum Lernen.
- Zeigt Testaccounts, Seed-Praxen, Seed-Therapeut:innen und Suchdaten.

`apps/api/test/app.test.ts`

- Liefert gute End-to-End-Beispiele für beabsichtigte Flows.

### Weniger wichtige oder eher boilerplate-nahe Dateien

- `apps/admin/components/page-shell.tsx`, `sidebar.tsx`, `deadline-timer.tsx`: nützlich für das UI-Verständnis, aber nicht architekturkritisch
- `apps/admin/lib/mock-data.ts`: aktuell ungenutzt
- `apps/mobile/src/mobile-translations.js`: reine Textsammlung
- `apps/admin/app/globals.css`: Styling, nicht fachliche Logik


## 9. Wie alles zusammenhängt

### Mentales Grundmodell

Patient:innen-Suche:

Mobile-UI in `mobile-discover-screen.js` -> State/Request in `App.js` -> `POST /search` in `search.ts` -> Prisma liest `Therapist`, `Practice`, `TherapistPracticeLink` -> API berechnet Relevanz/Distanz -> Mobile mappt Response mit `mapApiTherapist()` -> Liste und Karte aktualisieren sich aus demselben Resultset.

Therapeut:innen-Profilpflege:

Dashboard-UI -> `handleSaveProfile()` in `App.js` -> `PATCH /auth/me` in `auth.ts` -> API berechnet ggf. neue Vollständigkeit/Publikationsfähigkeit -> `GET /auth/me` -> Mobile ersetzt `loggedInTherapist`.

Manager:innen-Praxispflege:

Manager-Dashboard -> `handleManagerPracticeSave()` in `App.js` -> `PATCH /manager/practice` in `manager-auth.ts` -> Re-Geocoding falls nötig -> `GET /manager/me` -> Mobile ersetzt `loggedInManager`.

Admin-Moderation:

Next-Seite -> `api.ts` liest Daten von `/admin/*` -> Admin klickt Aktion -> `actions.ts` ruft `/admin/.../approve|reject|...` -> API schreibt Status in Prisma -> Next `revalidatePath()` aktualisiert die Oberfläche.

### Zentrale Module

Zentral:

- `apps/api/prisma/schema.prisma`
- `apps/api/src/routes/search.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/manager-auth.ts`
- `apps/api/src/routes/practice.ts`
- `apps/api/src/routes/invite.ts`
- `apps/mobile/src/App.js`

Peripherer:

- Übersetzungen
- UI-Hüllkomponenten
- Styling
- Milestone-Modal

### Rolle von Shared Code

`packages/shared/src/index.ts` verbindet Admin und API typseitig.

Mobile nutzt diese Typen nicht so stark wie Admin, sondern arbeitet viel mit eigenen View-Model-Mappings in `mobile-utils.js`.

### Sichtbarkeit als Querschnittsthema

Die wichtigste Systemregel lautet sinngemäß:

Ein Profil wird nur öffentlich sichtbar, wenn Review, Sichtbarkeit, Veröffentlichung und Praxisverknüpfung gleichzeitig passen.

Diese Regel verknüpft:

- `schema.prisma`
- `profile-completeness.ts`
- `search.ts`
- `invite.ts`
- `auth.ts`
- die mobilen Dashboard-Screens
- die Admin-Link- und Review-Seiten


## 10. Technisch auffällige Stellen / Risiken / komplexe Bereiche

`apps/mobile/src/App.js` ist überladen.

- Diese Datei ist Router, Store, Controller und API-Layer gleichzeitig.
- Das macht Änderungen riskant, weil viele Flows indirekt aneinander hängen.

Auth ist hybrid und dadurch komplex.

- `User`, `Therapist` und `PracticeManager` tragen parallel Auth-Information.
- `apps/api/src/routes/auth.ts` muss neue und Legacy-Accounts gleichzeitig behandeln.
- Das ist funktional, aber langfristig wartungsintensiv.

Praxislogik ist auf zwei APIs verteilt.

- Therapeut:innen-Perspektive in `apps/api/src/routes/practice.ts`
- Manager:innen-Perspektive in `apps/api/src/routes/manager-auth.ts`
- Fachlich überlappen beide stark.

Sichtbarkeitslogik ist zentral, aber nicht vollständig zentralisiert.

- `getTherapistPublicationState()` hilft, aber mehrere Routen bauen zusätzliche Bedingungen außen herum.
- Besonders `search.ts`, `practice-detail` und UI-Feedback enthalten verwandte Logik.

Die Discovery ist fachlich therapeut:innenzentriert, nicht praxiszentriert.

- Das ist wichtig für Produktentscheidungen.
- Die Liste zeigt Therapeut:innen, die Karte deduplizierte Praxen aus denselben Ergebnissen.

Desktop-Map ist kein echtes Pendant zur nativen Map.

- `apps/mobile/src/MapStub.js` ist eine visuelle Projektion, keine echte Webkartenintegration.

Einige Features sind nur teilweise umgesetzt oder vorbereitet.

- `apps/admin/app/(admin)/profiles/page.tsx` ist ein Platzhalter
- `/admin/visibility-issues` liefert immer leer zurück
- `apps/admin/lib/mock-data.ts` scheint nicht aktiv verwendet zu werden

Es gibt unverdrahtete Manager-Funktionalität.

- In `apps/mobile/src/App.js` existieren `handleTherapistSearch()` und `handleAddTherapist()`
- Im sichtbaren `ManagerDashboardContent` werden diese Flows aber nicht an die UI weitergereicht
- Das sieht nach unvollständigem Feature oder Restbestand aus

Testing ist ungleich verteilt.

- API hat mit `apps/api/test/app.test.ts` eine brauchbare Testbasis
- Admin hat faktisch keine Tests
- Mobile hat keine sichtbaren automatisierten Tests

Infra-nahe Risiken:

- Geocoding über Nominatim in `apps/api/src/utils/geocode.ts` ist best-effort und extern abhängig
- Uploads werden lokal auf Disk gespeichert in `apps/uploads`
- E-Mail-Versand hängt an `RESEND_API_KEY`

Kleine, aber echte Kopplungsauffälligkeit:

- `apps/api/src/routes/register.ts` importiert `hashPassword` aus `./auth.js`, obwohl die Funktion eigentlich aus `auth-utils.ts` stammt und nur über `auth.ts` re-exportiert wird
- Das funktioniert, koppelt Registrierung aber unnötig an die Auth-Route-Datei


## 11. Wie ich die Plattform am besten verstehen lerne

### Beste Lesereihenfolge

1. `apps/api/prisma/schema.prisma`
2. `apps/api/src/app.ts`
3. `packages/shared/src/index.ts`
4. `apps/api/src/utils/profile-completeness.ts`
5. `apps/api/src/routes/search.ts`
6. `apps/api/src/routes/auth.ts`
7. `apps/api/src/routes/manager-auth.ts`
8. `apps/api/src/routes/practice.ts`
9. `apps/api/src/routes/invite.ts`
10. `apps/mobile/src/mobile-utils.js`
11. `apps/mobile/src/App.js`
12. `apps/mobile/src/mobile-discover-screen.js`
13. `apps/mobile/src/mobile-public-profiles.js`
14. `apps/mobile/src/mobile-therapist-dashboard.js`
15. `apps/mobile/src/mobile-manager-dashboard.js`
16. `apps/admin/lib/api.ts`
17. `apps/admin/lib/actions.ts`
18. `apps/admin/app/(admin)/therapists/page.tsx`
19. `apps/admin/app/(admin)/practices/page.tsx`
20. `apps/api/prisma/seed.ts`

### In welcher Reihenfolge du die Workflows lernen solltest

1. Suche und öffentliche Profile
2. Therapeut:innen-Login und eigenes Profil
3. Therapeut:innen-Registrierung
4. Praxis anlegen / Praxis verknüpfen
5. Praxisadmin-Flow
6. Manager-Flow mit mehreren Praxen
7. Invite-Claim-Flow
8. Admin-Moderation

### Was du am Anfang ignorieren kannst

- `apps/admin/app/(admin)/profiles/page.tsx`
- `apps/admin/lib/mock-data.ts`
- Styling-Dateien
- `.next`, `.expo`, `dist`
- das Verzeichnis `AdminRevio/`
- die lokale Upload- und E-Mail-Infrastruktur im Detail

### Praktischer Lerntrick

Wenn du die Plattform wirklich schnell verstehen willst, lies sie nicht nach "Frontend" und "Backend", sondern nach Flows:

1. Suche: `mobile-discover-screen.js` -> `App.js/runSearchWith()` -> `search.ts`
2. Login: `LoginScreen` -> `handleLogin()` -> `auth.ts` -> `auth/me`
3. Einladung: `InvitePageScreen` oder Deep Link -> `invite.ts`
4. Admin-Freigabe: Admin-Page -> `actions.ts` -> `admin.ts`

Das ist die schnellste Art, die Plattform nicht nur statisch, sondern als System zu verstehen.
