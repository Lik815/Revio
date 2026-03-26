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

`Keine Therapeuten in der Suche` / `Kein Login möglich` / `Keine Suchdaten`
- **häufigste Ursache:** `apps/mobile/.env` zeigt auf eine alte oder tote URL (z. B. abgelaufener ngrok/localtunnel-Link oder alte LAN-IP)
- Fix: `apps/mobile/.env` auf `http://localhost:4000` setzen (für Browser/Simulator/Expo Web)

```bash
EXPO_PUBLIC_API_URL=http://localhost:4000
```

- Danach Expo **komplett neu starten** — `.env`-Änderungen werden erst beim Neustart übernommen, nicht beim Hot-Reload
- Für echtes Handy: aktuelle LAN-IP des Rechners verwenden (ändert sich bei Netzwechsel!), z. B. `http://192.168.178.X:4000`

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

Alles auf einmal killen:

```bash
lsof -ti :4000,:8081,:8082,:19000,:19001,:19002 | xargs kill -9 2>/dev/null; pkill -f "expo" 2>/dev/null; pkill -f "tsx src/server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; echo "Alles gestoppt."
```

Dann neu starten:

```bash
pnpm dev
```

Oder einzeln:

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

Therapeut + Praxis-Admin ("Physio & Motion"):
- E-Mail: `test@revio.de`
- Passwort: `password`
