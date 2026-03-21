# Plattform starten

## Schnellstart

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

`pnpm dev` startet API, Admin-Dashboard und Mobile (Expo) gleichzeitig.

| Service | URL |
|---------|-----|
| API | http://localhost:4000 |
| API Health | http://localhost:4000/health |
| Admin | http://localhost:3000 |
| Mobile (Expo Web) | http://localhost:8081 |
| Mobile (Handy) | Expo Go per QR-Code / `exp://...` |

Hinweis:
Expo kann statt `8081` auch auf `8082` oder `8083` starten, wenn der Port schon belegt ist.

---

## Am stabilsten fuer das Handy

Wenn du auf einem echten Handy testest, ist das stabilste Setup:

1. Handy und Rechner im gleichen WLAN
2. API lokal starten
3. In `apps/mobile/.env` die LAN-IP deines Rechners eintragen
4. Expo starten

Beispiel fuer `apps/mobile/.env`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.178.191:4000
```

Dann:

```bash
pnpm dev:api
pnpm --filter @revio/mobile start --tunnel
```

Wichtig:
- `http://localhost:4000` funktioniert auf dem Handy nicht
- `expo start --tunnel` tunnelt nur die App, nicht automatisch deine API
- wenn du `apps/mobile/.env` aenderst, musst du Expo komplett neu starten

---

## Einzeln starten

```bash
# API
pnpm dev:api

# Admin-Dashboard
pnpm dev:admin

# Mobile / Expo lokal
pnpm dev:mobile

# Mobile / Expo mit Tunnel
pnpm --filter @revio/mobile start --tunnel
```

Empfehlung fuer Handy-Test:

```bash
pnpm dev:api
pnpm --filter @revio/mobile start --tunnel
```

---

## Voraussetzungen

Einmalig:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Zusatz fuer lokal:
- `apps/api/.env` muss vorhanden sein
- `apps/mobile/.env` muss auf eine erreichbare API zeigen
- Rechner und Handy sollten im gleichen WLAN sein

---

## Health-Check

Wenn etwas komisch aussieht, zuerst diese drei Dinge pruefen:

```bash
curl http://localhost:4000/health
open http://localhost:3000
```

Und fuer Mobile:
- stimmt `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`?
- Expo nach `.env`-Aenderung wirklich neu gestartet?
- zeigt Expo auf `exp://...` oder auf den korrekten Web-Port?

---

## Haeufige Fehler

`Keine Suchdaten auf dem Handy`
- meist zeigt `apps/mobile/.env` auf `localhost` oder auf eine alte `*.loca.lt`-URL
- lokal besser die LAN-IP des Rechners verwenden

`Tunnel Unavailable`
- der alte API-Tunnel ist tot
- `*.loca.lt` nur verwenden, wenn dieser Tunnel gerade wirklich aktiv ist

`EADDRINUSE`
- ein alter Prozess belegt noch den Port
- pruefen mit:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
```

`Admin aktuell nicht verfuegbar`
- meist laeuft die API auf `4000` nicht
- zuerst `http://localhost:4000/health` pruefen

`Expo startet, aber das Handy sieht keine Daten`
- Expo-Tunnel ist nicht das gleiche wie ein API-Tunnel
- die Mobile-App braucht trotzdem eine erreichbare API-URL

---

## Sauber neu starten

Wenn du alles einmal komplett frisch starten willst:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:4000 -sTCP:LISTEN
lsof -nP -iTCP:8081 -sTCP:LISTEN
kill <PID>
```

Dann z. B.:

```bash
pnpm dev:api
pnpm --filter @revio/mobile start --tunnel
```

---

## Lokale Logins

Admin:
- E-Mail: `admin@revio.de`
- Passwort: `admin123`
- Admin-Token: `dev-admin-token`

Praxismanager-Testaccount:
- E-Mail: `test@revio.de`
- Passwort: `password`
