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
- [x] **Review-/Freigabelogik konsistenter machen** — Cascade-Approve bereits implementiert: Therapeut freigeben → Praxen + Links werden automatisch mitgenehmigt. _(admin.ts)_
- [x] **Such-UI und API-Filter abstimmen** — `kassenart` in DB/API/App; `certifications` → `fortbildungen` korrekt gemappt; Filter funktioniert Ende-zu-Ende. _(search.ts, App.js, schema.prisma, shared/index.ts)_
- [x] **Therapeuten-Profil leere Felder bereinigen** — Spezialisierungen, Details, Sprachen-Tags werden nur gerendert wenn Daten vorhanden. _(App.js)_
- [x] **Dev/Prod-Meldung im Registrierungsflow** — `__DEV__` bereits genutzt: Erfolgsscreen zeigt je nach Environment unterschiedlichen Text. _(App.js)_
- [x] **isVisible-Feature** — `isVisible`-Feld in DB + API + Profil-Edit; unsichtbare Therapeuten aus Suche gefiltert. Migration `20260315084328_add_is_visible`. _(schema.prisma, auth.ts, search.ts, App.js)_
- [x] **Verfügbare Zeiten** — `availability`-Feld in DB + API + Profil-Edit + Profil-Ansicht. Migration `20260315090724_add_availability`. _(schema.prisma, auth.ts, search.ts, seed.ts, App.js)_

### 🟢 Niedrig — Polish & Tech Debt

- [x] **CTA-Texte präzisieren** — „Therapeut kontaktieren" → „Praxis anrufen" in Suchergebnissen und Favoriten. _(App.js)_
- [x] **Theme `system` ergänzen** — „System"-Option im Erscheinungsbild-Toggle hinzugefügt. _(App.js)_
- [x] **Favoriten-Strategie kommunizieren** — Hinweis „🔒 Lokal gespeichert · nicht synchronisiert · nur für dich sichtbar" im Favoriten-Tab. _(App.js)_
- [x] **Bild-Upload auf Filesystem umgestellt** — `POST /upload/photo` (multipart/form-data) speichert Datei in `apps/api/uploads/`; gibt `{ url: "/uploads/<uuid>.jpg" }` zurück; `GET /uploads/*` liefert Dateien statisch aus. App.js nutzt `FormData` statt Base64. DB enthält nur noch die URL. Für Production: `pipeline`-Block in `upload.ts` durch S3 `putObject` ersetzen. _(upload.ts, app.ts, App.js)_

---

### Verifikation & Trust

- ~~**Verifizierungs-Badge**~~ — entschieden: kein Badge; nur APPROVED-Profile sind sichtbar
- ~~**Admin: Verifizierung manuell setzen**~~ — nicht geplant

### Mobile App

- [x] **Push-Benachrichtigungen** — Therapeut erhält Benachrichtigung bei Profil-Freigabe/-Ablehnung/-Änderungsanforderung/Sperrung
- [x] **Kassenart** — Feld in DB + API + Registrierungsflow + Filter in Suche. _(schema.prisma, search.ts, App.js)_
- [x] **Verfügbare Zeiten** — `availability`-Feld in DB + API + Profil. _(schema.prisma, auth.ts, App.js)_
- [x] **Logo in Header** — `logo.png` in alle Header-Zeilen eingebunden. _(App.js)_

### Admin-Dashboard

- ~~**Verifizierungs-Aktion**~~ — nicht geplant; Freigabe via APPROVED-Status reicht
- [x] **Dokumente einsehen** — Upload-Dateien im Admin abrufbar + Therapeuten-Dashboard-Upload

### API

- [x] **Bestehende Praxis verknüpfen** — `GET /practices/search?q=` Endpunkt; Live-Suche im Registrierungsflow; `existingPracticeId` in `register.ts`; Link wird als PROPOSED erstellt. _(search.ts, register.ts, App.js)_
- [x] **Kassenart + Zeiten** — Felder im Prisma-Schema und API-Typen ergänzt. _(schema.prisma, auth.ts, shared/index.ts)_
- [x] **Geo-Koordinaten** — Nominatim (OpenStreetMap, kein API-Key) geocodiert Adresse+Stadt bei `POST /register/therapist`, `POST /practice` und `PATCH /my/practice`. `src/utils/geocode.ts` mit best-effort Fehlerbehandlung. Admin-Endpunkt `POST /admin/practices/geocode-all` für nachträgliches Geocoding. Für Production: Google Geocoding API eintauschen. _(geocode.ts, register.ts, practice.ts, admin.ts)_

### Infrastruktur

- [x] **Produktions-Deployment** — Docker + Railway/Render für API, Vercel für Admin, EAS für Mobile
- [ ] **PostgreSQL** — SQLite durch PostgreSQL ersetzen für Production
- [x] **Umgebungsvariablen** — Secrets-Management (z. B. Doppler) einrichten

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
- [x] Therapeuten-Profil: Absturz bei null-languages/specializations behoben
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
- [x] Next.js Admin-Routing: doppelte Seiten entfernt, Route-Group `(admin)` ist alleinige Quelle
