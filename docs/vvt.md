# Verarbeitungsverzeichnis (VVT · DSGVO Art. 30 · DS-10/§14)

**Stand:** 2026-07-25 · **Rolle:** Revio als Verantwortlicher

Grundgerüst, aus dem aktiven Code abgeleitet. **Die Rechtsgrundlagen (Spalte „RG")
sind Vorschläge und von Jurist:in/DSB zu bestätigen** — ich bewerte keine Rechtsgrundlagen.
Verweise: Empfänger → `subprocessors.yaml`, Fristen → `docs/loeschkonzept.md`,
Datenklassen → `apps/api/prisma/data-classification.yaml`.

Abkürzungen RG (Art. 6/9): `Vertrag`=6(1)b · `Einwilligung`=6(1)a / 9(2)a ·
`Pflicht`=6(1)c · `bI`=berechtigtes Interesse 6(1)f.

---

## V-1 Registrierung & Authentifizierung
- **Zweck:** Konten für Patient:innen und (Freelance-)Therapeut:innen anlegen, Login, E-Mail-Verifizierung, Passwort-Reset.
- **Betroffene:** Patient:innen, Therapeut:innen.
- **Daten:** `User`, `Therapist` (P1: E-Mail, Name, Telefon, Adresse; P3: Hashes/Tokens).
- **RG (Vorschlag):** Vertrag (Kontonutzung); E-Mail-Versand technisch notwendig.
- **Empfänger:** Resend (E-Mail-Versand), Railway (Hosting).
- **Frist:** bis Account-Löschung (Löschkonzept).
- **Drittland:** Resend (US) → Transfermechanismus offen (F-6).

## V-2 Terminbuchung & Behandlungsanfragen  ⚠ besondere Kategorien (Art. 9)
- **Zweck:** Buchungsanfragen und Serien-/Einzelterminanfragen zwischen Patient:in und Therapeut:in vermitteln und terminieren.
- **Betroffene:** Patient:innen, Therapeut:innen.
- **Daten:** `BookingRequest`, `PatientRequest`, `Inquiry`, `InquirySlot`, `ScheduledSlot`, `PrescriptionData` — enthält **P2** (Heilmittel, Freitext, ICD-/Indikations-/Verordnungsdaten = Gesundheitsdaten).
- **RG (Vorschlag):** Vertrag zur Vermittlung **+ ausdrückliche Einwilligung nach Art. 9(2)a** für die Gesundheitsdaten (`BookingRequest.consentAcceptedAt` deutet auf eingeholte Zustimmung — Text/Version prüfen, DS-53).
- **Empfänger:** Railway.
- **Frist:** an letzten Termin koppeln (Löschkonzept, offen).
- **DSFA:** wegen P2 in großem Umfang **Art. 35 prüfen** (siehe docs/dsgvo.md §14 Nr. 6).

## V-3 Patientenbewertungen
- **Zweck:** login-gebundene Bewertungen nach absolviertem Termin.
- **Betroffene:** Patient:innen (Autor), Therapeut:innen (bewertet).
- **Daten:** `TherapistReview` (P1: Kommentar, Verknüpfung zu Termin).
- **RG (Vorschlag):** berechtigtes Interesse (Transparenz) / Einwilligung.
- **Frist:** mit Konto bzw. bis Widerruf.

## V-4 Push-Benachrichtigungen
- **Zweck:** Statusmeldungen (Anfragen, Bestätigungen) an die Mobile-App.
- **Daten:** `User.expoPushToken` / `Therapist.expoPushToken` (P3), Nachrichteninhalt.
- **RG (Vorschlag):** Einwilligung (Geräteberechtigung) / bI.
- **Empfänger:** Expo (US) → Transfermechanismus offen (F-6). Inhalte minimal (keine Gesundheitsdetails).

## V-5 Therapeuten-Discovery, Suche & Geocoding
- **Zweck:** öffentliche Therapeutensuche, Umkreissuche, Kartendarstellung.
- **Betroffene:** Suchende Nutzer:innen, Therapeut:innen.
- **Daten:** Suchbegriff/Ort/Koordinaten (P1, **nicht** geloggt seit F-2), Therapeuten-Profil/Standort.
- **RG (Vorschlag):** Vertrag/bI (Kernfunktion).
- **Empfänger:** Nominatim/OSMF (Geocoding — **auch clientseitig**, Geräte-IP), Apple/Google Maps (Kartenkacheln).
- **Drittland:** Google/Apple (US) → offen (F-6).

## V-6 Admin-Prüfung & Freigabe
- **Zweck:** Prüfung/Freigabe von Therapeuten-Profilen und Verifizierungsdokumenten, Sichtbarkeitssteuerung.
- **Daten:** `Therapist`, `TherapistDocument` (P1; Dateiinhalte ggf. P1/P2).
- **RG (Vorschlag):** Vertrag / Pflicht (Sorgfalt bei Vermittlung).
- **Empfänger:** Railway. Zugriff protokollieren (DS-74 — aktuell Lücke).

## V-7 App-Feedback
- **Zweck:** Feedback aus der App entgegennehmen.
- **Daten:** `AppFeedback` (P1: E-Mail, Nachricht, optional userId).
- **RG (Vorschlag):** bI.
- **Frist:** nach Bearbeitung (Löschkonzept, offen).

---

## Offene VVT-Punkte
- Rechtsgrundlagen je Verarbeitung durch DSB/Anwalt bestätigen (alle „Vorschlag").
- **DSFA (Art. 35)** für V-2 erstellen (P2-Gesundheitsdaten, Kernaktivität).
- Einwilligungstext + Version für die Gesundheitsdaten dokumentieren (DS-53; `consentAcceptedAt` prüfen).
- Empfänger-Transfermechanismen (F-6) und Löschfristen (Löschkonzept) je Zeile finalisieren.
