# Löschkonzept / Löschmatrix (DSGVO Art. 5(1)e, 17 · DS-30 ff.)

**Stand:** 2026-07-25 · **Bezug:** `docs/dsgvo.md` §4, `apps/api/prisma/data-classification.yaml`

Pro Datenkategorie: Aufbewahrungsfrist → Auslöser → Mechanismus → aktueller Umsetzungsstand.
Der Stand ist aus dem aktiven Code belegt; „Lücke" heißt: Regel gilt, ist aber noch nicht
automatisiert (DS-31) und damit im Sinne des Konzepts noch offen.

Fristen mit gesetzlichem Bezug (Aufbewahrungspflichten) sind als Vorschlag markiert und
gehören von Jurist:in/DSB bestätigt — ich bewerte keine Rechtsgrundlagen.

## Matrix

| Kategorie (Modelle) | Frist | Auslöser | Mechanismus | Stand |
|---|---|---|---|---|
| Konto-Stammdaten (`User`, `Therapist`) | sofort bei Antrag; Vorschlag: 30 Tage Karenz | Account-Löschung | `DELETE /auth/me` + `DELETE /admin/users/:email` → Prisma `onDelete: Cascade` | **implementiert** (Cascade); Karenzfrist/Anonymisierung offen |
| Verknüpfte Nutzerdaten (`UserFavoriteTherapist`, `Notification`, `BookingRequest`, `TherapistReview`, `PatientRequest`+`Inquiry`+`ScheduledSlot`, Therapeuten-Subtabellen) | mit dem Konto | Account-Löschung | Prisma-Cascade / `SetNull` | **implementiert** |
| Buchungs-/Anfragedaten inkl. P2 (`BookingRequest`, `Inquiry`, `PrescriptionData`, `ScheduledSlot`) bei aktivem Konto | Vorschlag: X Monate nach letztem Termin | Zeitablauf | — | **Lücke:** kein Cron; Frist X noch festzulegen (P2 → kurz halten) |
| Therapeuten-Verifizierungsdokumente (`TherapistDocument` + Datei auf Disk) | mit Therapeut; Prüfdok. ggf. kürzer | Account-Löschung / Prüfabschluss | DB-Cascade | **Teil-Lücke:** Datei-Löschung auf Disk verifizieren |
| E-Mail-OTP (`EmailOtp`) | 10 Min (`expiresAt`) | nach Nutzung / Ablauf | Löschung nach Bestätigung im Register-Flow | **Teil-Lücke:** ungenutzte, abgelaufene OTPs ohne Cleanup-Job |
| Offene Buchungen (`BookingRequest` PENDING) | Ablauf `responseDueAt` | Zeitablauf | `onReady`-Job alle 5 Min → Status `EXPIRED` | **implementiert** (Status­wechsel, keine Löschung) |
| Such-Cache (in-memory) | ~60 s TTL | TTL / `resetSearchCache()` | Speicher-TTL | **implementiert** |
| Server-/Plattform-Logs (Railway, Vercel) inkl. IP | Vorschlag: 14–30 Tage | Erstelldatum | Retention der Plattform | **Lücke:** nicht in Code/Config belegt, prüfen (DS-63) |
| Analytics (Vercel, Admin) | n/a | — | — | **entfernt 2026-07-26** (F-9): kein Tracking mehr im Admin |
| Marketing-/Newsletter | bis Widerruf | Widerruf | — | **n/a:** aktuell kein Newsletter im Code |

## Offene Punkte (Handlungsbedarf)

1. **Retention für Buchungs-/Anfragedaten definieren + Cron** — die sensibelsten Daten (P2
   Heilmittel/Diagnose in `Inquiry`/`PrescriptionData`) haben derzeit keine zeitbasierte
   Löschung. Frist festlegen (kurz, wegen P2) und automatisieren (DS-31).
2. **OTP-Cleanup-Job** für abgelaufene, ungenutzte `EmailOtp`-Zeilen.
3. **Disk-Löschung** der `TherapistDocument`-Dateien beim Löschen des Therapeuten prüfen/ergänzen.
4. **Log-Retention** bei Railway/Vercel konfigurieren und dokumentieren (DS-63).
5. **Gesetzliche Aufbewahrung vs. Löschung** (DS-33): Revio hat aktuell keine Rechnungs-/
   Buchhaltungsdaten im Schema (keine Payments). Sobald Belege dazukommen → gesperrter
   Zustand (Art. 18) statt Löschung.
6. **Backups** (DS-34): Backup-Retention der DB (Railway) dokumentieren + Regel „Löschungen
   bei Restore erneut anwenden".

## Zusammenspiel

- Was gelöscht werden kann, listet `apps/api/src/utils/subject-data.ts` (Export) spiegelbildlich —
  neue P1-Tabelle ⇒ dort UND hier ergänzen.
- Empfänger/Drittanbieter, bei denen Löschung nachzuziehen ist: `subprocessors.yaml` (DS-32).
