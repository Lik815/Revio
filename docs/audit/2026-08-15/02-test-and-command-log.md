# 02 — Befehls- und Testprotokoll

Alle Befehle wurden lokal auf `Mladens-MacBook-Air.local` (macOS, Darwin 25.5.0) ausgeführt.
Node v24.14.0, pnpm 10.6.3, Prisma 6.19.2, Vitest 3.2.4.

**Keine Migration, kein Seed, kein Deployment, kein Netzwerkzugriff außer dem unten dokumentierten.**

---

## 1. Ausgeführte Befehle

| # | Befehl | Exit | Ergebnis |
|---|---|---:|---|
| 1 | `git rev-parse HEAD` / `git status --short` / `git stash list` | 0 | Zustand erfasst, siehe 00 |
| 2 | `npx prisma generate` (in `apps/api`, `DATABASE_URL=file:./prisma/test.db`) | 0 | Client erzeugt (v6.19.2). War lokal **gar nicht vorhanden** |
| 3 | `npx tsc --noEmit -p tsconfig.json` (in `apps/api`) | **0** | ✅ **Keine Typfehler** |
| 4 | `pnpm --filter @revio/api check:classification` | **1** | ❌ **11 Verstöße** (siehe unten) |
| 5 | `pnpm --filter @revio/api test` (1. Lauf) | **1** | 26 Tests grün, **3 von 5 Suites laden nicht** (`ETIMEDOUT`) |
| 6 | `npx vitest run` (2. Lauf) | **1** | **213 von 215 Tests grün, 2 rot**, Dauer 1.467 s |
| 7 | `npx vitest run test/log-redaction.test.ts` | 1 | 2 von 3 grün, `[vitest-worker]: Timeout calling "onTaskUpdate"`, Dauer 314 s für 3 Unit-Tests |
| 8 | `pnpm --filter @revio/admin build` | **1** | **Kompilierung und Typprüfung erfolgreich**, 22/22 Seiten generiert; Abbruch erst beim finalen Datei-Move (`ENOENT` bei `rename`) |
| 9 | `pnpm --filter @revio/site build` | — | **nicht ausgeführt** (siehe Abschnitt 4) |

### Vorab eingeholte Erlaubnis

Befehl 5/6 löst **ausgehende HTTPS-Requests an `api.resend.com`** aus. Grund: [`test/setup.ts:9`](../../../apps/api/test/setup.ts) setzt `RESEND_API_KEY = 'test-key'`; [`register.ts:156`](../../../apps/api/src/routes/register.ts) prüft nur, **ob** die Variable gesetzt ist, und ruft dann das Resend-SDK auf. Der Kommentar in `setup.ts` („Resend selbst wird nicht aufgerufen da kein echter Key") ist sachlich falsch — das SDK wird aufgerufen, nur die Zustellung scheitert am 401. Die Ausführung wurde vorab freigegeben. **Es wurde keine E-Mail zugestellt.**

---

## 2. Ergebnis `check:classification` (Befehl 4)

```
Datenklassifizierung UNVOLLSTÄNDIG (11 Problem(e)):
  - AdminAccessLog.id: NICHT klassifiziert (DS-02)
  - AdminAccessLog.createdAt: NICHT klassifiziert (DS-02)
  - AdminAccessLog.action: NICHT klassifiziert (DS-02)
  - AdminAccessLog.query: NICHT klassifiziert (DS-02)
  - AdminAccessLog.targetUserId: NICHT klassifiziert (DS-02)
  - AdminAccessLog: Modell fehlt in data-classification.yaml
  - Therapist.consentObtainedAt: NICHT klassifiziert (DS-02)
  - Therapist.consentChannel: NICHT klassifiziert (DS-02)
  - Therapist.consentNote: NICHT klassifiziert (DS-02)
  - Therapist.archivedAt: NICHT klassifiziert (DS-02)
  - Practice.ownerId: NICHT klassifiziert (DS-02)
```

**Belegte Tatsache:** Der Validator, den die Datei selbst als CI-pflichtig bezeichnet („Neue Spalte ohne Eintrag hier => Validator schlaegt fehl (DS-02). **In CI aufnehmen.**"), ist nicht in CI und schlägt aktuell fehl. → DATA-001, OPS-002.

---

## 3. Ergebnis Testsuite (Befehl 6, maßgeblicher Lauf)

```
 Test Files  1 failed | 4 passed (5)
      Tests  2 failed | 213 passed (215)
   Duration  1467.49s (collect 1444.55s, tests 21.14s)
```

Grün: `slot-generator.test.ts` (15), `working-hours.test.ts` (11), `subject-data.test.ts`, `log-redaction.test.ts`, sowie 213 von 215 Fällen gesamt.

### Die zwei roten Tests

**(a) `Site settings > returns public site config and can toggle under construction via admin`**

```
AssertionError: expected { underConstruction: false, … } to deeply equal { underConstruction: true, … }
 ❯ test/app.test.ts:126:28
```

Die vorhergehende Assertion (Zeile 122) auf die Antwort von `POST /admin/site-settings/update` war grün — der Handler liest den Wert nach dem Schreiben aus der DB zurück und lieferte `true`. Der unmittelbar folgende Lesezugriff `GET /config/site` lieferte `false`. Beide Pfade rufen dieselbe Funktion `getPublicSiteSettings(fastify.prisma)` ohne Caching auf ([`config.ts:12-14`](../../../apps/api/src/routes/config.ts), [`app-settings.ts:40-45`](../../../apps/api/src/utils/app-settings.ts)); es gibt im gesamten Testfile nur diese eine Stelle, die den Schalter setzt.

**(b) `GET /health > returns ok`** — [`app.test.ts:101`](../../../apps/api/test/app.test.ts)

### Bewertung: INDIZ, nicht BESTÄTIGT

Beide Fehlschläge sind **nicht** als Produktdefekt belegt. Dagegen sprechen:

- 1.444 s der 1.467 s entfielen auf `collect` — reines Modul-Laden. Das ist ein Faktor >100 gegenüber CI.
- Lauf 5 scheiterte an `ETIMEDOUT: connection timed out, read` in `@fastify/proxy-addr/index.js:27` — das ist ein `require('ipaddr.js')`, also ein **Dateisystem**-Read, kein Netzwerkaufruf.
- Lauf 7 brauchte 314 s für drei reine Unit-Tests und endete mit `[vitest-worker]: Timeout calling "onTaskUpdate"` (RPC-Timeout, keine Assertion).

**Ursache ist mit hoher Wahrscheinlichkeit die Umgebung:** das Repository liegt unter `~/Desktop`, also im iCloud-Drive-Sync. `node_modules`-I/O ist dort pathologisch langsam. Erschwerend: der Expiry-Job (`setInterval`, 5 Min) startet über den `onReady`-Hook auch im Test unbedingt mit ([`app.ts:70-117`](../../../apps/api/src/app.ts)) und feuerte während des 24-Minuten-Laufs mehrfach in die geteilte Test-DB — in CI (Sekunden) nie. Siehe TEST-003.

**Konsequenz für dieses Audit:** Die Testsuite wird als **NICHT PRÜFBAR (Laufzeit)** geführt. Maßgeblich ist der CI-Lauf, den ich nicht einsehen konnte. Ich behaupte weder, dass die Tests grün sind, noch dass die zwei Fehlschläge echte Defekte sind. Beide gehören in CI gegengeprüft.

---

## 3a. Ergebnis Admin-Build (Befehl 8)

```
✓ Compiled successfully in 2.6min
  Linting and checking validity of types ...
  Collecting page data ...
✓ Generating static pages (22/22)

> Build error occurred
[Error: ENOENT: no such file or directory, rename
 '.next/export/500.html' -> '.next/server/pages/500.html']
Exit status 1
```

**Bewertung: der Anwendungscode ist in Ordnung.** Kompilierung, Typprüfung und die Generierung aller 22 Seiten waren erfolgreich. Der Abbruch passiert erst beim abschließenden Verschieben einer Datei.

Das ist derselbe Fehlertyp wie zuvor: bereits während des Builds scheiterte auch der Webpack-Cache an einem `rename` (`ENOENT … 7.pack_ -> 7.pack`). Zwei unabhängige `rename`-Fehlschläge auf Dateien, die der Prozess selbst kurz zuvor angelegt hat, sind ein klassisches Symptom eines Dateisystems, das Dateien unter dem Prozess wegsynchronisiert — und damit ein **dritter unabhängiger Beleg** für den Umgebungsbefund in Abschnitt 5.

Der Admin-Build wird deshalb als **funktional bestanden** gewertet (Code kompiliert und typprüft sauber), der Exit-Code 1 als Umgebungsartefakt. In CI läuft derselbe Build laut [`ci.yml`](../../../.github/workflows/ci.yml) als Pflichtschritt.

---

## 4. Nicht ausgeführte Befehle und Gründe

| Befehl | Grund |
|---|---|
| `pnpm --filter @revio/site build` | Nach dem Admin-Build-Abbruch nicht sinnvoll durchführbar (dieselbe I/O-Begrenzung). Zusätzlich würde der Build `generateStaticParams` gegen `localhost:4000` aufrufen, das nicht läuft. |
| `pnpm --filter @revio/mobile test` | **Existiert nicht** — `apps/mobile/package.json` hat kein `test`-Script. |
| Root-`pnpm typecheck` / `pnpm build` | Root-`tsconfig.json` referenziert `expo/tsconfig.base`, das nicht auflösbar ist (Warnung in jedem Vitest-Lauf reproduziert). Siehe DEBT-004. |
| `prisma migrate` / `prisma db push` / Seeds | Auftragsgemäß untersagt ohne Erlaubnis. |
| `pnpm audit` / Dependency-Scan | Netzwerkzugriff auf die Registry — nicht eingeholt, da nicht ergebnisrelevant genug. Als Lücke ausgewiesen (OPS-002). |
| Laufende Anwendungen, Browser, Screenshots | Keine Browser-/Screenshot-Fähigkeit in dieser Session; mit dem Auftraggeber abgestimmt, Phase 2 rein statisch zu führen. |

---

## 5. Umgebungsbefund (kein Produktbefund)

**ENV-001 — Die lokale Entwicklungsumgebung ist durch den iCloud-synchronisierten Arbeitsordner praktisch unbrauchbar für Tests.**

Belege: Befehle 5, 6, 7, 8 oben. `git`-Operationen und `tsc` (Befehl 3) laufen normal; alles, was viele kleine `node_modules`-Dateien liest (Vitest-Collect, `next build`), stallt.

Empfehlung: Repository nach `~/Projects/Revio` o. ä. außerhalb von iCloud Drive verschieben, oder `node_modules` per `.nosync`-Trick bzw. iCloud-Ausschluss von der Synchronisation ausnehmen. Das ist kein Produktrisiko, blockiert aber jede lokale Verifikation und war in diesem Audit die größte Einschränkung.
