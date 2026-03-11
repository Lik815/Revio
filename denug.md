# Revio – Debug- und Review-Notizen für Claude

Erstellt am: 11.03.2026

Ziel dieses Dokuments:
- Keine Codeänderungen durchführen
- Aktuellen Stand der Web- und Mobile-App dokumentieren
- Gefundene Fehler, Inkonsistenzen und UX-/Produktverbesserungen so festhalten, dass Claude sie gezielt abarbeiten kann

## Was geprüft wurde

### Live geprüft
- Admin-Webseite unter `http://127.0.0.1:3000`
- API unter `http://127.0.0.1:4000`
- API-Endpunkte:
  - `GET /health`
  - `GET /admin/stats`
  - `GET /admin/therapists`
  - `GET /admin/practices`
  - `GET /admin/links`
  - `POST /auth/login`
  - `GET /auth/me`
  - `PATCH /auth/me`
  - `POST /register/therapist`
  - `POST /search`
  - `POST /admin/therapists/:id/approve`

### Code-/Flow-geprüft (nicht vollständig live als Expo-App geöffnet)
- Mobile-App in `apps/mobile/src/App.js`
- Navigationsstruktur
- Suchflow
- Favoriten
- Therapeutenprofil
- Praxisprofil
- Login
- Therapeuten-Dashboard
- Registrierung in 6 Schritten
- Optionen/Theme

## Wichtige Einschränkung

Die Mobile-App wurde in dieser Session **nicht als echte Expo-App auf Gerät/Simulator interaktiv geöffnet**.
Grund: Es lief kein Expo-Dev-Server, und in der verfügbaren Umgebung konnte nur die Web-App direkt geöffnet werden.

Trotzdem wurden die zugrunde liegenden Mobile-Flows real gegen die laufende API getestet und der komplette UI-/State-Flow im Code geprüft.

---

## Zusammenfassung für Claude

### Priorität Hoch
1. Mobile-App verwendet harte API-URL `http://localhost:4000`
2. Suche liefert fachlich ungenaue bzw. irrelevante Ergebnisse
3. Demo-/Seed-Daten sind sprachlich inkonsistent (deutsch vs. englisch)
4. Registrierungsflow behauptet E-Mail-Bestätigung, aber diese existiert funktional nicht

### Priorität Mittel
5. Optionen-Seite enthält Platzhalter ohne echte Funktion
6. Review-/Freigabeprozess ist fachlich inkonsistent zwischen Therapeut, Praxis und Verknüpfung
7. Erfolg-/Fehlerfeedback in der App ist an mehreren Stellen zu schwach
8. Registrierung ist unnötig lang und an einigen Stellen fachlich ungenau

### Priorität Niedrig
9. Texte/CTAs sind teils fachlich oder semantisch unpräzise
10. Favoriten sind nur lokal und ohne Hinweis auf Export/Synchronisierung
11. Theme-System bietet `system` im State, UI aber nur Hell/Dunkel

---

## Detaillierte Bugs und Befunde

### 1) Harte API-URL in der Mobile-App
**Datei:** `apps/mobile/src/App.js`

**Befund:**
```js
const BASE_URL = 'http://localhost:4000';
```

**Problem:**
- Auf einem echten iPhone/Android-Gerät zeigt `localhost` auf das Gerät selbst, nicht auf den Entwicklungsrechner.
- Dadurch werden Suche, Login, Registrierung und Profil-Updates auf echten Geräten sehr wahrscheinlich fehlschlagen.

**Auswirkung:**
- Kritischer App-Bug für reale Nutzung.

**Empfehlung für Claude:**
- API-URL konfigurierbar machen
- Nutzung von Expo-Environment-Variablen, z. B. `EXPO_PUBLIC_API_URL`
- Optional Fallback für lokale Entwicklung dokumentieren

---

### 2) Suche filtert inhaltlich zu schwach
**Datei:** `apps/api/src/routes/search.ts`

**Live beobachtet:**
- Suche nach `Rückenschmerzen` liefert Treffer, aber Ranking wirkt unpräzise.
- Suche nach `Neurologie` + `homeVisit: true` liefert ebenfalls fachlich fragwürdige Treffer.

**Ursache im Code:**
- Es wird primär nach `city` gefiltert.
- `query` beeinflusst nur `relevance`, aber schließt irrelevante Treffer nicht sauber aus.
- Wenn Suchbegriff nicht matcht, bleiben trotzdem viele Profile im Ergebnis.

**Auswirkung:**
- Nutzer sehen u. U. unpassende Therapeut:innen.
- Produkt wirkt „unscharf“ oder „kaputt“, obwohl technisch Daten zurückkommen.

**Empfehlung für Claude:**
- Query als echten Relevanz- und Filterfaktor behandeln
- Matching auf:
  - `specializations`
  - `bio`
  - ggf. `certifications`
- Normalize/Synonyme einführen (DE/EN)
- No-match-Verhalten verbessern

---

### 3) Seed-Daten sind sprachlich inkonsistent
**Datei:** `apps/api/prisma/seed.ts`

**Beispiel:**
- `Anna Becker` hat Spezialisierungen wie:
  - `back pain`
  - `sports physiotherapy`
  - `manual therapy`
- Die App-Suche/Quick-Chips arbeiten aber auf Deutsch:
  - `Rückenschmerzen`
  - `Sportverletzung`
  - `Manualtherapie`

**Auswirkung:**
- Semantisch passende Suche funktioniert schlechter als erwartet.
- QA und Demo-Eindruck werden verfälscht.

**Empfehlung für Claude:**
- Seed-Daten auf konsistente Sprache umstellen
- Entweder komplett deutsch oder systematisch normalisiert mehrsprachig

---

### 4) Registrierungs-Schritt „E-Mail bestätigen“ ist Fake-/Platzhalter-Flow
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- In Registrierung Schritt 2 wird eine E-Mail-Bestätigung suggeriert.
- Es gibt aber in der API keinen echten Verifizierungsflow.
- Der Nutzer kann einfach weitergehen.

**Auswirkung:**
- Irreführende UX
- Produkt wirkt unfertig oder täuschend

**Empfehlung für Claude:**
- Entweder echten Verifizierungsflow bauen
- oder diesen Schritt komplett entfernen
- oder ehrlich als „kommt später“ kennzeichnen

---

### 5) Registrierung „innerhalb von 48 Stunden geprüft“ ist in Dev inkonsistent zur Realität
**Dateien:**
- `apps/mobile/src/App.js`
- `apps/api/src/routes/register.ts`

**Befund:**
- UI sagt: manuelle Prüfung innerhalb von 48 Stunden
- API sagt in Dev: `auto-approved`, direkt sichtbar

**Auswirkung:**
- Widerspruch zwischen Produktversprechen und tatsächlichem Verhalten
- Für Tester verwirrend

**Empfehlung für Claude:**
- Dev-/Demo-Hinweise explizit machen
- UX-Text je nach Environment anpassen

---

### 6) Praxis-Verknüpfung in Registrierung ist fachlich unsauber
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Bei `regPracticeMode === 'existing'` wird nur ein Freitext-Name gesendet
- API `register.ts` erzeugt aber immer ein Praxisobjekt auf Basis der gesendeten Daten
- Es gibt keine echte Suche/Verknüpfung zu bestehender Praxis

**Auswirkung:**
- „Bestehende Praxis“ ist faktisch keine echte bestehende Praxis-Auswahl
- Kann Dubletten erzeugen

**Empfehlung für Claude:**
- Entweder tatsächliche Praxis-Suche + Auswahl implementieren
- oder Option vorerst entfernen/umbenennen

---

### 7) Option „Überspringen“ bei Praxis erzeugt trotzdem Pseudo-Praxis-Daten
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Bei `skip` wird dennoch gesendet:
  - Name: `Ohne Praxis`
  - Stadt: `regCity`

**Auswirkung:**
- Semantisch falsche Daten in DB möglich
- Kann pseudo-leere Praxen erzeugen

**Empfehlung für Claude:**
- Registrierung ohne Praxis korrekt unterstützen
- API-Schema optional machen oder separaten Flow für Praxislosigkeit bauen

---

### 8) Such-UI und API-Filter sind nicht vollständig abgestimmt
**Dateien:**
- `apps/mobile/src/App.js`
- `apps/api/src/routes/search.ts`

**Befund:**
- UI bietet mehrere Filter:
  - Kassenart
  - Fortbildungen
  - Hausbesuche
- API verarbeitet davon effektiv nur:
  - `homeVisit`
  - optional `language`
  - optional `specialization`
- `kassenart` wird im Mobile-Frontend rein lokal gefiltert, aber API-Daten liefern teils `null`

**Auswirkung:**
- Filter wirken, sind aber teils fake / nur teilweise wirksam
- Inkonsistente Resultate

**Empfehlung für Claude:**
- Filtermodell zwischen API und App angleichen
- Entweder API erweitern oder UI vereinfachen

---

### 9) Therapeuten-Profil zeigt Details, die oft leer oder künstlich sind
**Datei:** `apps/mobile/src/App.js`

**Beispiele:**
- `kassenart` oft `null`
- `verfügbareZeiten` oft leer
- `website` oft leer
- `behandlungsbereiche` teils identisch oder künstlich aus `specializations`

**Auswirkung:**
- Profil wirkt teilweise künstlich oder inkonsistent

**Empfehlung für Claude:**
- Leere Felder besser handhaben
- Redundante Felder reduzieren
- Nur sinnvolle Sektionen rendern

---

### 10) Erfolgsmeldungen fehlen an mehreren Stellen
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Beim Profilspeichern gibt es keinen klaren Success-Toast/Dialog
- Beim Foto-Upload gibt es kein sichtbares Feedback
- Favoriten haben keine Rückmeldung außer Icon-Wechsel

**Auswirkung:**
- Nutzer wissen oft nicht sicher, ob Aktion erfolgreich war

**Empfehlung für Claude:**
- Leichtes Feedback-System ergänzen (Toast/Banner/Snackbar)

---

### 11) Fehlerbehandlung ist teils zu generisch
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Viele `catch {}` ohne Nutzerfeedback
- oder nur sehr generische Netzwerkhinweise

**Beispiele:**
- `handlePickPhoto`
- Laden des gespeicherten Tokens
- `handleSaveProfile`

**Auswirkung:**
- Fehler bleiben unsichtbar
- Debugging und User-Erlebnis leiden

**Empfehlung für Claude:**
- Fehler expliziter behandeln
- konsistente UX für API-/Permission-/Upload-Fehler

---

### 12) Standortabfrage passiert automatisch beim Start
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Beim Mount wird direkt `Location.requestForegroundPermissionsAsync()` aufgerufen.

**Auswirkung:**
- Kann auf Nutzer zu früh/aufdringlich wirken
- Schlechter First-Launch-Moment

**Empfehlung für Claude:**
- Standort erst anfragen, wenn Nutzer aktiv „in meiner Nähe suchen“ möchte
- Alternativ kurzen Erklärungsscreen vorschalten

---

### 13) Bild-Upload speichert Base64 direkt im Profil
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Foto wird als Base64-Data-URL direkt an `PATCH /auth/me` gesendet

**Risiken:**
- Große Payloads
- schlechte Skalierung
- Speicher-/DB-Aufblähung

**Empfehlung für Claude:**
- Für MVP evtl. okay, langfristig aber Upload-/Storage-Lösung vorsehen

---

### 14) Optionen-Seite enthält Platzhalter statt echter Funktionen
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- `Datenschutz` und `Impressum` zeigen visuell Rows, aber keine echte Aktion
- `Sprache` ist statisch auf `Deutsch`

**Auswirkung:**
- Wirkt unfertig
- Nutzer erwarten Navigation

**Empfehlung für Claude:**
- Entweder echte Screens/Links implementieren
- oder deaktiviert/als „bald verfügbar“ kennzeichnen

---

### 15) Theme-State hat `system`, UI aber nicht
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Interner State unterstützt `'light' | 'dark' | 'system'`
- UI bietet nur `Hell` und `Dunkel`

**Auswirkung:**
- Unvollständige Feature-Oberfläche

**Empfehlung für Claude:**
- Entweder `System` im UI anbieten oder State vereinfachen

---

### 16) Favoriten sind rein lokal und nicht mit Login verknüpft
**Datei:** `apps/mobile/src/App.js`

**Befund:**
- Favoriten werden nur in `AsyncStorage` gespeichert
- nicht an Login / Backend gekoppelt

**Auswirkung:**
- Gerätewechsel = Verlust
- kein Sync
- für MVP okay, aber Limit klar kommunizieren

**Empfehlung für Claude:**
- Entweder besser kennzeichnen oder später Backend-Sync einplanen

---

### 17) CTA-Text teils nicht ganz korrekt
**Datei:** `apps/mobile/src/App.js`

**Beispiele:**
- In Ergebnislisten steht `Therapeut kontaktieren`, aber angerufen wird meist die Praxisnummer
- Im Therapeutenprofil CTA: `Praxis anrufen`
- Im Ergebnis evtl. missverständlich

**Empfehlung für Claude:**
- CTA wording präzisieren, z. B.:
  - `Praxis anrufen`
  - `Kontakt aufnehmen`
  - `Praxis kontaktieren`

---

### 18) Admin-/Review-Workflow fachlich nicht konsistent genug
**Dateien:**
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/register.ts`

**Live beobachtet:**
- Therapeut konnte auf `APPROVED` gesetzt werden
- Zugehörige Praxis blieb `PENDING_REVIEW`
- Link blieb `PROPOSED`

**Auswirkung:**
- Reviewprozess ist schwer nachvollziehbar
- Öffentliche Sichtbarkeit kann unerwartet wirken

**Empfehlung für Claude:**
- Review-Regeln explizit definieren
- Sichtbarkeit an bestätigte Beziehungen koppeln
- Admin-Oberfläche mit Hinweisen erweitern

---

## Mobile-App – UX-/Produktverbesserungen

### A) Suche verbessern
- Suchbegriff als echten inhaltlichen Filter nutzen
- Synonyme / Normalisierung (DE/EN)
- Bessere Leerstates
- „Beliebte Beschwerden“ aus echten Suchdaten ableiten
- „In meiner Nähe“ Button statt stiller Auto-Location

### B) Registrierung vereinfachen
- 6 Schritte sind zu lang
- Vorschlag:
  1. Konto
  2. Profil
  3. Praxis
  4. Prüfen & absenden
- Nur nötige Felder als Pflicht
- Nicht implementierte Schritte entfernen

### C) Vertrauensaufbau stärken
- Warum Standort benötigt wird erklären
- Prüfstatus sauber erklären
- Echte Hinweise, was „geprüft“ bedeutet

### D) Profilseiten aufräumen
- Weniger Platzhalterfelder
- Leere Abschnitte vermeiden
- Deutlichere CTA-Hierarchie
- Praxis- und Therapeutenkontakt klar unterscheiden

### E) Optionen sinnvoll machen
- Datenschutz und Impressum verlinken
- Sprache wirklich schaltbar machen oder entfernen
- „System“-Theme ergänzen

### F) Fehler-/Erfolgskommunikation verbessern
- Toast/Snackbar-Komponente
- Netzwerkfehler mit Retry
- Profil gespeichert / Foto aktualisiert / Login erfolgreich sichtbar machen

---

## Konkrete Aufgabenliste für Claude

### High priority fixes
1. `apps/mobile/src/App.js`
   - `BASE_URL` konfigurierbar machen
2. `apps/api/src/routes/search.ts`
   - Suchlogik fachlich verbessern
3. `apps/api/prisma/seed.ts`
   - Seed-Daten sprachlich vereinheitlichen
4. `apps/mobile/src/App.js`
   - Fake-E-Mail-Bestätigung in Registrierung entfernen oder echt machen
5. `apps/mobile/src/App.js` + `apps/api/src/routes/register.ts`
   - Praxis-Flow korrekt modellieren (`new`, `existing`, `none`)

### Medium priority fixes
6. Feedback/Toasts ergänzen
7. Optionen-Seite vervollständigen oder ehrlich reduzieren
8. Standortfreigabe nutzerfreundlicher gestalten
9. Review-/Freigabelogik konsistenter machen

### Low priority polish
10. CTA-Texte schärfen
11. Theme auf `system` erweitern oder vereinfachen
12. Favoriten-Strategie klarer machen

---

## Reproduzierbare Beobachtungen aus dieser Session

### API Health
- `GET /health` → `200 OK`

### Admin Stats
- `GET /admin/stats` lieferte gültige Dashboard-Daten

### Suche
- `POST /search` mit `Rückenschmerzen` → Ergebnisse vorhanden, aber Ranking fragwürdig
- `POST /search` mit `Neurologie` + `homeVisit: true` → ebenfalls teils unpassende Treffer

### Login
- `POST /auth/login` mit `test@revio.de / password` → funktioniert
- `POST /auth/login` mit falschem Passwort → `401`

### Profilbearbeitung
- `PATCH /auth/me` → funktioniert

### Registrierung
- `POST /register/therapist` mit existierender E-Mail → `409 Conflict`

### Admin Action
- `POST /admin/therapists/:id/approve` → funktioniert
- Fachliche Konsistenz zwischen Therapist/Practice/Link bleibt offen

---

## Abschluss

Dieses Dokument beschreibt den geprüften Ist-Zustand ohne Codeänderungen. Claude sollte damit in der Lage sein, die Mobile-App und die übergreifenden Produktprobleme systematisch zu korrigieren.
