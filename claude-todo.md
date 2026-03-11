# Claude Todo – Revio Fix-Liste

Erstellt am: 11.03.2026

Diese Datei ist die Kurzfassung zu `denug.md`.
Ziel: schnelle Abarbeitung mit Prioritäten, konkreten Dateien und klaren Outcomes.

## High

### 1. Mobile API-URL konfigurierbar machen
**Problem:** Die Mobile-App nutzt aktuell hart `http://localhost:4000`.

**Dateien:**
- `apps/mobile/src/App.js`
- optional: `apps/mobile/app.json`
- optional: `apps/mobile/README.md` oder Projektdoku

**Ziel:**
- App soll auf echten Geräten gegen eine konfigurierbare API laufen
- keine harte `localhost`-Abhängigkeit mehr

**Akzeptanzkriterien:**
- API-URL kommt aus Config/Environment
- Dev-Setup für Simulator + echtes Gerät ist dokumentiert

---

### 2. Suchlogik fachlich verbessern
**Problem:** Suche liefert fachlich teils unpassende Treffer.

**Dateien:**
- `apps/api/src/routes/search.ts`
- optional: `packages/shared/src/index.ts`
- optional: `apps/mobile/src/App.js`

**Ziel:**
- Suchbegriff soll Ergebnisse sinnvoll filtern/ranken
- Matching auf Spezialisierung/Bio/Fortbildungen konsistent

**Akzeptanzkriterien:**
- irrelevante Profile werden nicht einfach wegen Stadt mitgeliefert
- Ranking ist nachvollziehbar
- deutschsprachige Suchbegriffe funktionieren mit Seed-Daten

---

### 3. Seed-Daten vereinheitlichen
**Problem:** Seed-Daten mischen Deutsch und Englisch.

**Dateien:**
- `apps/api/prisma/seed.ts`

**Ziel:**
- Test-/Demo-Daten sollen zur App-Sprache passen

**Akzeptanzkriterien:**
- Spezialisierungen/Kategorien sind konsistent
- Suche wirkt bei Demos realistisch

---

### 4. Fake-E-Mail-Bestätigung im Registrierungsflow entfernen oder echt bauen
**Problem:** Schritt 2 suggeriert E-Mail-Bestätigung, aber der Flow existiert nicht.

**Dateien:**
- `apps/mobile/src/App.js`
- optional: `apps/api/src/routes/register.ts`

**Ziel:**
- Kein irreführender Registrierungs-Schritt mehr

**Akzeptanzkriterien:**
- Entweder echter Verifizierungsflow
- oder ehrlicher reduzierter Flow ohne Fake-Schritt

---

### 5. Praxis-Registrierungslogik fachlich korrekt modellieren
**Problem:** `existing` und `skip` sind derzeit semantisch unsauber.

**Dateien:**
- `apps/mobile/src/App.js`
- `apps/api/src/routes/register.ts`
- optional: Prisma-Schema / Registrierungsmodell falls nötig

**Ziel:**
- klare Unterstützung für:
  - neue Praxis
  - bestehende Praxis anfragen/verknüpfen
  - keine Praxis

**Akzeptanzkriterien:**
- keine Pseudo-Praxis `Ohne Praxis`
- keine Fake-„bestehende Praxis“ nur per Freitext

---

## Medium

### 6. Fehlermeldungen und Erfolgsmeldungen verbessern
**Dateien:**
- `apps/mobile/src/App.js`

**Ziel:**
- Nutzer bekommt klares Feedback bei Save/Login/Upload/Register

**Akzeptanzkriterien:**
- sichtbare Success-/Error-States
- keine stillen `catch {}`-Fehler mehr für kritische Flows

---

### 7. Optionen-Seite vervollständigen oder entschlacken
**Dateien:**
- `apps/mobile/src/App.js`

**Ziel:**
- Platzhalter nicht mehr wie fertige Features wirken lassen

**Akzeptanzkriterien:**
- `Datenschutz` und `Impressum` funktionieren oder sind klar als Platzhalter markiert
- `Sprache` ist echt oder entfernt

---

### 8. Standortabfrage nutzerfreundlicher machen
**Dateien:**
- `apps/mobile/src/App.js`

**Ziel:**
- Permission nicht sofort ungefragt beim Start triggern

**Akzeptanzkriterien:**
- Standort erst kontextbezogen anfragen
- bessere Erklärung vor Permission-Dialog

---

### 9. Review-/Freigabelogik konsistenter machen
**Dateien:**
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/register.ts`
- optional: `apps/admin/app/therapists/page.tsx`
- optional: `apps/admin/app/practices/page.tsx`
- optional: `apps/admin/app/links/page.tsx`

**Ziel:**
- Sichtbarkeit und Statusmodell nachvollziehbar machen

**Akzeptanzkriterien:**
- klare Regel: wann ist ein Profil öffentlich sichtbar?
- saubere Beziehung zwischen Therapist / Practice / Link Status

---

## Low

### 10. CTA-Texte präzisieren
**Dateien:**
- `apps/mobile/src/App.js`

**Ziel:**
- Text soll exakt zu Aktion passen

**Beispiele:**
- `Praxis anrufen`
- `Kontakt aufnehmen`
- `Profil ansehen`

---

### 11. Theme-Handling vervollständigen
**Dateien:**
- `apps/mobile/src/App.js`

**Ziel:**
- `system` entweder wirklich anbieten oder entfernen

---

### 12. Favoritenstrategie klarer machen
**Dateien:**
- `apps/mobile/src/App.js`
- optional Backend, falls Sync kommen soll

**Ziel:**
- aktuell lokal okay, aber klar kommunizieren oder perspektivisch syncbar machen

---

## Empfohlene Reihenfolge für Claude

1. `apps/mobile/src/App.js` – API URL, Registrierung, Feedback, Permissions, UX-Texte
2. `apps/api/src/routes/search.ts` – Suchqualität
3. `apps/api/prisma/seed.ts` – Demo-/QA-Daten verbessern
4. `apps/api/src/routes/register.ts` – Registrierungsmodell korrigieren
5. `apps/api/src/routes/admin.ts` – Review-Konsistenz
6. Danach UI-Polish in Mobile-App

## Definition of Done

Claude ist fertig, wenn:
- Mobile-App nicht mehr an `localhost` hängt
- Suche deutlich relevanter ist
- Registrierung keine Fake-Schritte mehr enthält
- Praxis-Flow sauber modelliert ist
- Seed-Daten konsistent sind
- Mobile-App besseres Feedback bei Fehlern/Erfolg liefert
- Platzhalterfeatures reduziert oder korrekt umgesetzt sind
