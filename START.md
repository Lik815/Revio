# Plattform starten

## Alles auf einmal (empfohlen)

```bash
pnpm dev
```

Startet API, Admin-Dashboard und Mobile (Expo) gleichzeitig in separaten Prozessen.

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| Admin | http://localhost:3000 |
| Mobile (Expo) | Expo Go App / http://localhost:8081 |

---

## Einzeln starten

```bash
# API
pnpm dev:api

# Admin-Dashboard
pnpm dev:admin

# Mobile / Expo
pnpm dev:mobile
```

---

## Voraussetzungen (einmalig)

```bash
# Abhängigkeiten installieren
pnpm install

# Prisma-Client generieren
pnpm db:generate

# Datenbank-Migrationen ausführen
pnpm db:migrate

# Testdaten einspielen (100 Therapeuten, 30 Praxen)
pnpm db:seed
```

`.env` muss in `apps/api/` vorhanden sein (siehe `apps/api/.env.example`).

---

## Test-Account

- **E-Mail:** `test@revio.de`
- **Passwort:** `password`
- **Admin-Token:** `dev-admin-token`
