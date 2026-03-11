# Revio — Todo & Roadmap

## Offene Aufgaben

### Auth & Profil (Therapeuten)
- [x] **Anmeldung für Therapeuten** — Login-Screen im "Therapeuten"-Tab (E-Mail + Passwort); Session-Token in AsyncStorage
- [x] **Therapeuten-Dashboard** — nach Login: eigenes Profil sehen (Foto, Bio, Spezialisierungen, etc.) statt Landing-Page
- [x] **Profil bearbeiten** — Therapeut kann Bio, Spezialisierungen, Sprachen, Hausbesuch direkt in der App ändern (PATCH /auth/me)
- [x] **Profilbild hochladen** — Therapeut kann Foto aus Galerie auswählen und hochladen (expo-image-picker)
- [x] **Test-Account** — Credentials: E-Mail `test@revio.de` / Passwort `password`

### Verifikation & Trust
- [ ] **Verifizierungs-Badge zurückbringen** — Therapeuten mit verifiziertem Kammereintrag bekommen ein sichtbares „✓ Geprüft"-Badge auf Profil und Suchergebnis
- [ ] **Verifizierung mit Website verknüpfen** — Admin-Dashboard soll Therapeuten manuell als „verifiziert" markieren können (separates Feld `verified: Boolean` in DB); dieser Status wird in der Admin-Oberfläche angezeigt und über die API ans Mobile weitergegeben
- [ ] **Kammereintrag-Prüfung** — optionales Upload-Feld für Berufsausweis/Approbationsurkunde im Registrierungsflow; Admin kann Dokument einsehen und Verifikation bestätigen

### Mobile App
- [ ] **Kartenansicht** — Google Maps oder Apple Maps Integration um Praxen auf der Karte anzuzeigen (Pins mit Distanz)
- [ ] **Push-Benachrichtigungen** — Therapeut erhält Benachrichtigung wenn Profil freigegeben oder abgelehnt wurde
- [ ] **Profil bearbeiten** — eingeloggter Therapeut kann eigenes Profil nach Freischaltung anpassen
- [ ] **Kassenart** — Feld in der DB und API hinzufügen (`kassenart: String?`), im Registrierungsflow als Pflichtfeld, in der Suche als Filter
- [ ] **Verfügbare Zeiten** — Feld für Sprechzeiten (`availability: String?`) in DB + API + Profil
- [ ] **Foto-Upload** — Therapeut kann echtes Profilfoto hochladen (statt Placeholder)

### Admin-Dashboard
- [ ] **Verifizierungs-Aktion** — Button „Verifizieren" in Therapeuten-Detailansicht, setzt `verified: true`
- [ ] **Dokumente einsehen** — Upload-Dateien im Admin abrufbar
- [ ] **E-Mail-Benachrichtigungen** — Admin-Aktionen (Approve/Reject) senden automatisch E-Mail an Therapeuten

### API
- [ ] **Auth für Therapeuten** — JWT-Login damit Therapeuten ihr Profil einsehen/bearbeiten können
- [ ] **Bestehende Praxis verknüpfen** — Endpunkt `POST /register/therapist` soll optionale `existingPracticeId` unterstützen; Praxis-Admin erhält dann eine Bestätigungsanfrage
- [ ] **Kassenart + Zeiten** — Felder im Prisma-Schema und API-Typen ergänzen
- [ ] **Geo-Koordinaten** — bei Registrierung Adresse automatisch in lat/lng auflösen (Google Geocoding API)

### Infrastruktur
- [ ] **Produktions-Deployment** — Docker + Railway/Render für API, Vercel für Admin, EAS für Mobile
- [ ] **PostgreSQL** — SQLite durch PostgreSQL ersetzen für Production
- [ ] **Umgebungsvariablen** — Secrets-Management (z. B. Doppler) einrichten

---

## Erledigt (Referenz)
- [x] pnpm-Monorepo mit apps/api, apps/admin, apps/mobile, packages/shared
- [x] Fastify 5 API mit Prisma/SQLite, Zod-Validierung, Bearer-Auth
- [x] Next.js 15 Admin-Dashboard mit Server Actions und Live-Daten
- [x] Expo Mobile App mit echter Suche und Registrierung
- [x] 33 Vitest-Tests, alle grün
- [x] TypeScript-Checks: 0 Fehler in allen drei Paketen
- [x] metro.config.js für pnpm-Symlink-Auflösung
- [x] Auto-Approve in Development-Modus (register.ts)
- [x] Therapeuten-Profil: Absturz bei null-Kassenart behoben
- [x] Therapeuten-Profil: Absturz bei null-languages/specializations behoben (Blanko-Seite)
- [x] Bottom-Nav während Registrierung nutzbar
- [x] Entfernung auf Therapeuten-Profil angezeigt
- [x] Praxis-Logo mit Initialen + medizinisches Kreuz
- [x] Registrierung: Spezialisierungen optional, Fortbildungen als Checkliste
- [x] Registrierung: Andere Sprachen als Freitext hinzufügbar
- [x] Registrierung: Neue Praxis / Bestehende verknüpfen / Überspringen
