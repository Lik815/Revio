# Revio — Todo & Roadmap

## Offene Aufgaben

### 🔴 Hoch — Bugs & Kritische Fixes

- [x] **API-URL konfigurierbar machen** — `EXPO_PUBLIC_API_URL` Env-Variable; fallback auf `localhost:4000`. _(App.js)_
- [x] **Suchlogik fachlich verbessern** — Partial-Matching über `specializations`, `bio`, `certifications`; spezifische Queries filtern irrelevante Treffer aus. _(search.ts)_
- [x] **Seed-Daten vereinheitlichen** — Anna Becker und Max Klein auf deutsche Spezialisierungen umgestellt. _(seed.ts)_
- [x] **Fake-E-Mail-Bestätigung entfernen** — Registrierungs-Schritt 2 (E-Mail-Bestätigung) entfernt; REG_STEPS von 6 auf 5 reduziert. _(App.js)_
- [x] **Praxis-Registrierungslogik korrigieren** — `practice` im API-Schema optional; `skip`/`existing` erzeugen keine Pseudo-Praxis mehr. _(App.js, register.ts)_

### 🟡 Mittel — UX & Konsistenz

- [x] **Fehlermeldungen & Erfolgsfeedback** — `handleSaveProfile` und `handlePickPhoto` haben jetzt `Alert.alert` für Fehler und Erfolg. _(App.js)_
- [x] **Optionen-Seite vervollständigen** — `Datenschutz` und `Impressum` als „Bald verfügbar" gekennzeichnet. _(App.js)_
- [x] **Standortabfrage nutzerfreundlicher** — Standort wird nicht mehr beim Mount angefragt; stattdessen 📍-Button neben Ortsfeld. _(App.js)_
- [ ] **Review-/Freigabelogik konsistenter machen** — Therapeut kann auf `APPROVED` gesetzt werden, zugehörige Praxis bleibt `PENDING_REVIEW`, Link bleibt `PROPOSED`. Sichtbarkeit an bestätigte Beziehungen koppeln, Admin-Oberfläche mit Hinweisen erweitern. _(admin.ts, register.ts)_
- [x] **Such-UI und API-Filter abstimmen** — `kassenart` in DB/API/App; `certifications` → `fortbildungen` korrekt gemappt; Filter funktioniert Ende-zu-Ende. _(search.ts, App.js, schema.prisma, shared/index.ts)_
- [ ] **Therapeuten-Profil leere Felder bereinigen** — `kassenart`, `verfügbareZeiten`, `website`, `behandlungsbereiche` sind oft leer oder künstlich. Leere Sektionen nicht rendern; redundante Felder reduzieren. _(App.js)_
- [ ] **Dev/Prod-Meldung im Registrierungsflow** — UI sagt „48 Stunden Prüfung", API gibt in Dev `auto-approved`. UX-Text je nach Environment anpassen. _(App.js, register.ts)_

### 🟢 Niedrig — Polish & Tech Debt

- [x] **CTA-Texte präzisieren** — „Therapeut kontaktieren" → „Praxis anrufen" in Suchergebnissen und Favoriten. _(App.js)_
- [x] **Theme `system` ergänzen** — „System"-Option im Erscheinungsbild-Toggle hinzugefügt. _(App.js)_
- [x] **Favoriten-Strategie kommunizieren** — Favoriten sind nur lokal in AsyncStorage, kein Sync. Hinweis „🔒 Lokal gespeichert · nicht synchronisiert · nur für dich sichtbar" ist bereits im Favoriten-Tab vorhanden. _(App.js)_
- [ ] **Bild-Upload langfristig lösen** — Foto wird als Base64-Data-URL direkt an `PATCH /auth/me` gesendet. Für MVP okay, aber große Payloads / DB-Aufblähung. Langfristig: Upload-/Storage-Lösung (S3 o.ä.). _(App.js, auth.ts)_

---

### Verifikation & Trust

- [ ] **Verifizierungs-Badge** — Therapeuten mit verifiziertem Kammereintrag bekommen ein sichtbares „✓ Geprüft"-Badge auf Profil und Suchergebnis
- [ ] **Admin: Verifizierung manuell setzen** — `verified: Boolean` Feld in DB; Admin kann Therapeuten als verifiziert markieren; Status über API ans Mobile weitergegeben
- [ ] **Kammereintrag-Upload** — Optionales Upload-Feld für Berufsausweis im Registrierungsflow; Admin kann Dokument einsehen und Verifikation bestätigen

### Mobile App

- [ ] **Kartenansicht** — Google Maps / Apple Maps Integration; Praxen als Pins mit Distanz
- [ ] **Push-Benachrichtigungen** — Therapeut erhält Benachrichtigung bei Profil-Freigabe/-Ablehnung
- [ ] **Kassenart** — Feld in DB + API (`kassenart: String?`), Pflichtfeld im Registrierungsflow, Filter in Suche
- [ ] **Verfügbare Zeiten** — Feld für Sprechzeiten (`availability: String?`) in DB + API + Profil
- [x] **Logo in Header** — `logo.png` in alle Header-Zeilen eingebunden (alle 6 Stellen ersetzt). _(App.js)_

### Admin-Dashboard

- [ ] **Verifizierungs-Aktion** — Button „Verifizieren" in Therapeuten-Detailansicht, setzt `verified: true`
- [ ] **Dokumente einsehen** — Upload-Dateien im Admin abrufbar
- [ ] **E-Mail-Benachrichtigungen** — Admin-Aktionen (Approve/Reject) senden automatisch E-Mail an Therapeuten

### API

- [ ] **Bestehende Praxis verknüpfen** — `POST /register/therapist` soll optionale `existingPracticeId` unterstützen; Praxis-Admin erhält Bestätigungsanfrage
- [ ] **Kassenart + Zeiten** — Felder im Prisma-Schema und API-Typen ergänzen
- [ ] **Geo-Koordinaten** — Bei Registrierung Adresse automatisch in lat/lng auflösen (Google Geocoding API)

### Infrastruktur

- [ ] **Produktions-Deployment** — Docker + Railway/Render für API, Vercel für Admin, EAS für Mobile
- [ ] **PostgreSQL** — SQLite durch PostgreSQL ersetzen für Production
- [ ] **Umgebungsvariablen** — Secrets-Management (z. B. Doppler) einrichten

---

## Erledigt

- [x] Datenbank-Migration für Auth-Felder (`passwordHash`, `sessionToken`, `photo`) erstellt und Tests auf 33/33 grün
- [x] pnpm-Monorepo mit apps/api, apps/admin, apps/mobile, packages/shared
- [x] Fastify 5 API mit Prisma/SQLite, Zod-Validierung, Bearer-Auth
- [x] Next.js 15 Admin-Dashboard mit Server Actions und Live-Daten
- [x] Expo Mobile App mit echter Suche und Registrierung
- [x] 33 Vitest-Tests, alle grün
- [x] TypeScript-Checks: 0 Fehler in allen drei Paketen
- [x] metro.config.js für pnpm-Symlink-Auflösung
- [x] Auto-Approve in Development-Modus (register.ts)
- [x] Therapeuten-Profil: Absturz bei null-languages/specializations behoben (Blanko-Seite)
- [x] Bottom-Nav während Registrierung nutzbar
- [x] Entfernung auf Therapeuten-Profil angezeigt
- [x] Praxis-Logo mit Initialen + medizinisches Kreuz
- [x] Registrierung: Spezialisierungen optional, Fortbildungen als Checkliste
- [x] Registrierung: Andere Sprachen als Freitext hinzufügbar
- [x] Registrierung: Neue Praxis / Bestehende verknüpfen / Überspringen
- [x] Auth & Profil: Login-Screen, Session-Token, AsyncStorage
- [x] Therapeuten-Dashboard: Profil sehen nach Login
- [x] Profil bearbeiten: Bio, Spezialisierungen, Sprachen, Hausbesuch (PATCH /auth/me)
- [x] Profilbild hochladen via expo-image-picker
- [x] Test-Account: test@revio.de / password
- [x] Abmelden-Button in Optionen-Tab
- [x] „Therapeut kontaktieren" Button repariert (phone-Feld in API + Alert-Dialog)
- [x] phone-Feld zu SearchPractice Typ + search.ts hinzugefügt
- [x] Logo.png mit transparentem Hintergrund vorbereitet (assets/logo.png)
