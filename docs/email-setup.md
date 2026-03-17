# E-Mail-Setup (Resend)

Revio versendet transaktionale E-Mails über **[Resend](https://resend.com)**.

---

## Absender-Adresse

```
revioclub.app@gmail.com
```

---

## Umgebungsvariablen

In `apps/api/.env` eintragen:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
MOBILE_URL=http://localhost:8081   # Basis-URL für Einladungslinks
```

---

## Resend einrichten (einmalig, ~2 Minuten)

1. Account erstellen: [resend.com](https://resend.com) → **Sign up**
2. **API Keys** → **Create API Key** → Name: `Revio`
3. Den Key (`re_...`) in `apps/api/.env` bei `RESEND_API_KEY=` eintragen

> **Free Tier:** 3.000 Mails/Monat, 100 Mails/Tag — für Entwicklung und MVP ausreichend.

### Absender-Domain (optional, für Produktion)
Im Free Tier werden Mails von `onboarding@resend.dev` gesendet.
Für `revioclub.app@gmail.com` als Absender muss die Domain verifiziert werden:
- Resend Dashboard → **Domains** → Domain hinzufügen
- Für Gmail: eigene Domain empfohlen (z.B. `mail.revio.app`)

---

## Wann werden E-Mails versendet?

| Trigger | Template | Empfänger |
|---------|----------|-----------|
| `POST /invite/therapist` | „Profil aktivieren" | Therapeut |
| `POST /invite/resend` | „Neue Einladung" | Therapeut |

Beide E-Mails sind **best-effort**: Schlägt die Mail fehl, wird der API-Request trotzdem
erfolgreich abgeschlossen. Der Fehler wird im API-Log geloggt.

---

## E-Mail-Templates

### Einladungs-Mail (`sendInviteEmail`)
- **Betreff:** `<Praxisname> lädt dich zu Revio ein`
- **Inhalt:** Name des Therapeuten, Praxisname, Aktivierungs-Button mit Einladungslink (7 Tage gültig)

### Erneute Einladung (`sendResendInviteEmail`)
- **Betreff:** `Neue Einladung von <Praxisname> – Revio`
- **Inhalt:** Hinweis dass der alte Link ungültig ist, neuer Aktivierungs-Button

---

## Einladungslink-Format

```
http://localhost:8081/invite?token=<64-Zeichen-Hex-Token>
```

In Produktion `MOBILE_URL` auf die echte App-URL setzen.

---

## Datei-Referenzen

| Datei | Zweck |
|-------|-------|
| `apps/api/src/utils/mailer.ts` | Resend-Client + Template-Funktionen |
| `apps/api/src/routes/invite.ts` | Routes die E-Mails auslösen |
| `apps/api/.env` | API-Key (nicht ins Git!) |
