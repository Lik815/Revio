# UI-Verbesserungen

Diese Notiz basiert auf der aktuellen UI in:

- `apps/mobile/src/mobile-discover-screen.js`
- `apps/mobile/src/mobile-therapist-dashboard.js`
- `apps/mobile/src/mobile-manager-dashboard.js`
- `apps/mobile/src/App.js`
- `apps/admin/app/(admin)/page.tsx`
- `apps/admin/app/(admin)/therapists/page.tsx`
- `apps/admin/app/globals.css`

## Gesamtfazit

Die UI ist schon solide und konsistent, aber viele Informationen haben visuell fast das gleiche Gewicht. Dadurch wirkt die Oberfläche funktional, aber nicht immer sofort klar. Das größte Verbesserungspotenzial liegt in Informationshierarchie, Verdichtung der Header-Bereiche und klarerer Status-Kommunikation.

## Wichtigste Verbesserungen

### 1. Suche und Karte entlasten

Betroffen:

- `apps/mobile/src/mobile-discover-screen.js`

Problem:

- Im Discover-Header konkurrieren Suche, Filter, Ergebnistext, Standort und List/Map-Toggle gleichzeitig um Aufmerksamkeit.
- Die Karte wirkt dadurch voller als nötig.

Verbesserung:

- Header auf 2 Ebenen reduzieren:
  - Zeile 1: Suche + Filter
  - Zeile 2: Standort + Radius + List/Map-Toggle
- Ergebnisanzahl visuell kleiner und sekundärer behandeln.
- Standort und Radius als kompakte Chips statt als verstreute Controls darstellen.

Nutzen:

- Schnellere Orientierung
- Weniger visuelle Unruhe
- Nearby-Suche wird verständlicher

### 2. Kartenmarker vereinfachen

Betroffen:

- `apps/mobile/src/mobile-discover-screen.js`

Problem:

- Die Praxis-Marker tragen relativ viel Text direkt auf der Karte.
- Das macht die Karte bei mehreren Treffern schnell unruhig.

Verbesserung:

- Marker kompakter machen
- Praxisname nicht dauerhaft voll auf dem Marker anzeigen
- Details lieber in einer kleinen Vorschau oder Bottom-Sheet nach Marker-Tap zeigen

Nutzen:

- Bessere Kartenlesbarkeit
- Weniger Überlagerung
- Klarerer Fokus auf räumliche Orientierung

### 3. Registrierung Schritt 3 vereinfachen

Betroffen:

- `apps/mobile/src/App.js`

Problem:

- Spezialisierungen, Sprachen und Fortbildungen liegen in einem einzigen dichten Block.
- Pflicht und optional fühlt sich nicht klar getrennt an.

Verbesserung:

- Sprachen prominenter behandeln
- Optionale Bereiche klar als optional markieren
- Spezialisierungen und Fortbildungen visuell stärker voneinander trennen
- Optional: Fortbildungen einklappbar machen

Nutzen:

- Weniger kognitive Last
- Schnellere Registrierung
- Weniger Gefühl von Formularlänge

### 4. Therapeuten-Dashboard statusklarer machen

Betroffen:

- `apps/mobile/src/mobile-therapist-dashboard.js`

Problem:

- Oben wird im Wesentlichen nur `Freigegeben` oder `In Prüfung` gezeigt.
- Für Nutzer ist aber wichtiger:
  - Ist mein Profil geprüft?
  - Ist es öffentlich sichtbar?
  - Habe ich eine Praxis?
  - Sind Nachweise hochgeladen?

Verbesserung:

- Statusbereich in mehrere kleine Zustandskarten oder Badges aufteilen:
  - Review-Status
  - Öffentliche Sichtbarkeit
  - Praxis verknüpft / nicht verknüpft
  - Dokumente vorhanden / fehlen
- Dokumentenbereich stärker an den Statusbereich anbinden

Nutzen:

- Weniger Verwirrung
- Nutzer versteht sofort, was noch fehlt
- Dashboard wird handlungsorientierter

### 5. Praxismanager-Dashboard klarer gliedern

Betroffen:

- `apps/mobile/src/mobile-manager-dashboard.js`

Problem:

- Das Dashboard enthält viele sinnvolle Bereiche, aber sie wirken visuell zu gleichrangig:
  - eigenes Profil
  - aktuelle Praxis
  - Team / Therapeut:innen
  - neue Praxis
  - Aktionen

Verbesserung:

- Reihenfolge stärker priorisieren:
  1. aktive Praxis
  2. Team / Therapeut:innen
  3. eigenes Profil
  4. sekundäre Verwaltungsaktionen
- Destruktive oder seltene Aktionen wie `Praxis löschen` visuell weiter nach unten und klar sekundär platzieren

Nutzen:

- Weniger „alles gleichzeitig“
- Dashboard wirkt fokussierter
- Wichtige Alltagsaktionen stehen klarer im Vordergrund

### 6. Typografische Hierarchie verbessern

Betroffen:

- `apps/mobile/src/App.js`
- `apps/admin/app/globals.css`

Problem:

- Viele Texte liegen im Bereich `12px–14px`
- Viele Uppercase-Kicker haben ähnliche visuelle Dominanz
- Dadurch fehlt teilweise eine starke Haupt-Neben-Hierarchie

Verbesserung:

- Weniger Kicker einsetzen
- Hauptüberschriften klarer hervorheben
- Meta-Infos kleiner und ruhiger darstellen
- Zwischen Sektionen mehr großzügige Abstände nutzen

Nutzen:

- Oberfläche wirkt ruhiger und hochwertiger
- Inhalte lassen sich schneller scannen

### 7. Karten, Suche, Dashboard und Profil stärker differenzieren

Betroffen:

- Mobile insgesamt

Problem:

- Viele Screens verwenden sehr ähnliche Muster: Card + Chips + Button
- Das ist konsistent, aber teilweise zu monoton

Verbesserung:

- Discovery stärker suchorientiert und leichtgewichtig
- Dashboard stärker status- und aktionsorientiert
- Profil stärker personenbezogen und ruhig
- Kartenansicht stärker spatial statt card-lastig

Nutzen:

- Jede Oberfläche bekommt eine klarere Rolle
- Weniger Gleichförmigkeit

### 8. Admin-UI um echte Sichtbarkeit ergänzen

Betroffen:

- `apps/admin/app/(admin)/page.tsx`
- `apps/admin/app/(admin)/therapists/page.tsx`
- `apps/admin/app/(admin)/therapists/[id]/page.tsx`

Problem:

- Die Admin-Oberfläche zeigt stark `reviewStatus`, aber nicht ausreichend den echten öffentlichen Sichtbarkeitszustand.
- `APPROVED` kann im System trotzdem bedeuten, dass das Profil nicht öffentlich sichtbar ist.

Verbesserung:

- Neben dem Review-Status auch Sichtbarkeitsstatus anzeigen:
  - öffentlich sichtbar
  - freigegeben, aber blockiert
  - nicht freigegeben
- Blocker-Gründe klar nennen

Nutzen:

- Weniger Fehlinterpretation
- Admin versteht schneller, warum Profile nicht live sind

## Priorisierte Reihenfolge

Wenn nur wenig Zeit da ist, würde ich in dieser Reihenfolge optimieren:

1. Discover-Header + Kartenlogik vereinfachen
2. Registrierung Schritt 3 entzerren
3. Therapeuten-Dashboard statusklarer machen
4. Manager-Dashboard stärker priorisieren
5. Admin-Sichtbarkeit klarer darstellen

## Konkrete nächste UI-Tickets

### Ticket 1

Discover-Header vereinfachen und Standort/Radius als kompakte Steuerleiste darstellen.

### Ticket 2

Kartendarstellung entrümpeln und Praxisdetails aus Marker-Labels in eine Vorschau verlagern.

### Ticket 3

Registrierungs-Schritt `Fachliches Profil` in Pflicht- und optionale Bereiche trennen.

### Ticket 4

Therapeuten-Dashboard um klaren Profilstatus-Bereich erweitern.

### Ticket 5

Manager-Dashboard in priorisierte Blöcke umstrukturieren.

### Ticket 6

Admin-Therapeutenansichten um echten Sichtbarkeitsstatus und Blocker-Gründe erweitern.
