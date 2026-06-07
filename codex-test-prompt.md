Teste die folgenden Änderungen in der Revio Mobile App (Expo/React Native, `apps/mobile`). Branch: `main`, Commit `bcbee40`. Starte die App auf einem echten Gerät oder Simulator (EAS Update / `expo start`) und prüfe jeden Punkt manuell.

## Kontext der Änderungen
1. `RootNavigator` zeigt jetzt IMMER die Bottom-Tabs (Suchen, Favoriten, Therapie, Profil, Optionen) — unabhängig davon, ob man eingeloggt ist oder nicht. Vorher wurde bei fehlendem Login nur der Auth-Screen angezeigt.
2. `ProfileScreen` rendert jetzt direkt `<AuthScreen />` (Login/Registrierung), wenn kein Nutzer eingeloggt ist — die anderen Tabs bleiben dabei sichtbar und nutzbar.
3. `TherapyScreen.handleAddSlot`: Der Slot-Composer-Modal wird jetzt korrekt geschlossen (`setShowSlotComposer(false)`), bevor die Bestätigung (`SlotCreatedModal`) erscheint. Vorher blieb der Composer offen und blockierte die Seite.
4. Alle Tab-Header (Discover, Favoriten, Therapie [Patient & Therapeut], Profil, Optionen) verwenden jetzt einheitlich `useSafeAreaInsets()` für den oberen Abstand (`paddingTop: insets.top + 8`), damit das Logo/Header auf allen Tabs den gleichen Abstand zur Statusleiste hat.

## Zu testende Szenarien

### A) Navigation ohne Login (ausgeloggt)
- App im ausgeloggten Zustand starten (oder über Optionen → Abmelden).
- Prüfen: Alle 5 Tabs (Suchen, Favoriten, Therapie, Profil, Optionen) sind sichtbar und anklickbar.
- Tab "Suchen": Physio-Suche funktioniert, Ergebnisse werden angezeigt, Filter/Karte nutzbar.
- Tab "Profil": Zeigt den Login/Registrierungs-Bildschirm (TherapistLandingScreen mit "Jetzt registrieren" / "Anmelden") direkt im Tab.
- Tab "Therapie": Zeigt sinnvollen Hinweis "Login erforderlich" mit Button zum Anmelden — Button muss zum Profil-Tab springen und dort den Login/Registrierungs-Bildschirm zeigen.
- Auch von anderen Stellen aus testen, die zu Login/Profil verzweigen: Therapeuten-Profilseite (Buchungsanfrage ohne Login), Favoriten-Tab (Login-Hinweis), Optionen-Tab (Login/Logout/Konto löschen) — überall sollte jetzt zum Profil-Tab navigiert werden (vorher zeigten diese auf eine entfernte `Auth`-Route und hätten einen Navigations-Fehler ausgelöst).
- Tab "Favoriten" und "Optionen": prüfen, ob sie im ausgeloggten Zustand sinnvoll funktionieren.

### B) Login-Flow über Profil-Tab
- Im Profil-Tab über "Anmelden" einloggen (Patient und separat Therapeut testen).
- Nach erfolgreichem Login: Profil-Tab zeigt automatisch das richtige Dashboard (Patient- bzw. Therapeuten-Dashboard), ohne App-Neustart.
- Auch Registrierung als Patient und als Freelance-Therapeut testen.

### C) Cold Start / Session-Persistenz
- Einloggen, App komplett schließen, neu starten.
- Prüfen: Nutzer bleibt eingeloggt (kein Zurückfallen auf Auth-Screen), AppTabs erscheinen direkt nach dem Boot-Loading.
- Ausloggen über Optionen, App neu starten: Auth-Screen im Profil-Tab erscheint, andere Tabs bleiben nutzbar.

### D) Therapeut: Neuen Termin-Slot anlegen
- Als Therapeut einloggen, zum Tab "Therapie" → Slot-Composer öffnen, neuen Termin-Slot anlegen und speichern.
- Prüfen:
  - Composer-Modal schließt sich automatisch nach dem Speichern.
  - Bestätigungs-Modal "Termin erstellt" erscheint mit korrektem Datum/Uhrzeit/Dauer.
  - Die Therapie-Seite ist danach NICHT blockiert — Liste der Slots aktualisiert sich, alle Interaktionen (Filter, Scrollen, Slot löschen) funktionieren weiter.
  - Mehrfach hintereinander Slots anlegen, um sicherzugehen, dass kein Block-Zustand mehr auftritt.

### E) Header / Safe-Area-Abstand
- Auf einem Gerät mit Notch/Dynamic Island (z. B. iPhone 14/15) durch alle 5 Tabs schalten.
- Prüfen: Logo/Titel-Header hat auf JEDEM Tab denselben Abstand zur Statusleiste/Notch — keine Unterschiede zwischen z. B. Suchen und Profil.
- Insbesondere testen: Discover-Tab in der "Suchergebnisse"-Ansicht (nach einer Suche) — der zweite/sticky Header dort sollte ebenfalls den korrekten Abstand haben.
- Therapie-Tab sowohl als Patient als auch als Therapeut prüfen (zwei unterschiedliche Header-Implementierungen wurden angepasst).
- Light- und Dark-Mode jeweils gegenchecken.

## Was als Bug zu melden ist
- Jegliche Inkonsistenz im oberen Abstand zwischen Tabs.
- Jeglicher Navigationsfehler/Crash beim Klick auf "Anmelden"/"Login erforderlich"-Buttons (Therapie, Favoriten, Optionen, Therapeuten-Profil — alle wurden so geändert, dass sie zum Profil-Tab springen statt zur entfernten `Auth`-Route).
- Falls der Composer beim Slot-Anlegen weiterhin hängen bleibt oder die Bestätigung ausbleibt.
- Falls beim Cold Start der Auth-Status falsch erkannt wird (eingeloggter Nutzer sieht Auth-Screen oder umgekehrt).

Bitte für jeden gefundenen Bug: Tab/Screen, Schritte zur Reproduktion, erwartetes vs. tatsächliches Verhalten, Screenshot falls möglich.
