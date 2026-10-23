# SagaTree Epic #773 — bindende Produktentscheidungen und Implementierungsbedingungen
**Beschlossen:** 2026-10-23 durch den Repository-Owner, in dessen Auftrag via verbundenem GitHub-Zugang dokumentiert. **Scope:** Produktarchitektur und Spezifikation, keine Produktionsfreigabe.
**Quelle:** [Epic-Kommentar](https://github.com/iamthamanic/sagatree/issues/773#issuecomment-6364771554); spezifische GATE-Kommentare unten.

## Architektur-Lock
1. **Auth:** GATE-02 Variant A, Better Auth Cookie-only (HttpOnly, SameSite, Secure auf HTTPS; kein JWT-Plugin, `/api/auth/token` im Cookie-Profil gesperrt, keine JS-lesbaren Bearer); HTTP und Colyseus prüfen dieselbe serverseitige Session, Actor, Host, Membership und Widerruf. [Human decision](https://github.com/iamthamanic/sagatree/issues/785#issuecomment-6364772323). HTTPS/Tauri und Plattformnachweise bleiben Release-Kriterien.
2. **HTTP/Reatime:** GATE-03 Variant B: Hono für typed HTTP Queries/Commands, Colyseus nur für Realtime, **ein Node-Prozess**, ein Policy Service und dieselben Application-Use-Cases, keine doppelte Businesslogik. [Human decision](https://github.com/iamthamanic/sagatree/issues/786#issuecomment-6364773133). PoC ist kein Produktions-SLO.
3. **Desktop:** Tauri + derselbe Node-Sidecar als Ziel, macOS/Windows/Linux. Electron ausschließlich bei belegtem Pflichtkriterien-Fehlschlag. GATE-05 bleibt bis Welle 6 / nativen Plattformtests technisch ungeprüft; keine Desktop-Lieferfreigabe durch reine Architekturwahl. [Owner direction](https://github.com/iamthamanic/sagatree/issues/788#issuecomment-6364773974).
4. **Atlas-E2E:** Ephemeres isoliertes Postgres/GoTrue/PostgREST in CI mit synthetischem Owner, GM, P1, P2, Fremdbesitzer. Fehlende Isolation/Testinfrastruktur = FAIL, kein skip. [Owner direction](https://github.com/iamthamanic/sagatree/issues/770#issuecomment-6364774924). Existierendes Atlas UI/Backend muss die geforderten Positiv- und Negativfälle tatsächlich bestehen.
5. **Legacy-Funktionsumfang:** Aktuell eingebundene RPCs/Edge/Adapter fachlich erhalten, bekannte unsichere Altrechte **nicht** übernehmen; nicht eingebundene Legacy-Worker bleiben nicht erreichbar. Optionales tus als Post-Core-Enhancement; ein optionales Feature blockiert nicht den Core-Cutover, sofern regulärer Upload vollständig paritätisch ist. [Owner direction](https://github.com/iamthamanic/sagatree/issues/842#issuecomment-6364775504).
6. **Migration/Cutover:** Zuerst synthetische Drills, Paritätschecks, echte Restore-Belege, genau ein Writer je Datensatz. Pilotwechsel nur nach ausdrücklicher menschlicher Scope-Freigabe; initial 14 Kalendertage lesende Paritätsüberwachung, bei ungenügender Last oder Abweichung verlängern. Produktiver Cutover und spätere Supabase-Abschaltung sind **zwei separate menschliche Entscheidungen**. [Owner direction](https://github.com/iamthamanic/sagatree/issues/850#issuecomment-6364776296).
7. **Ticketmandat:** Bestehende 90 kanonische Identitäten behalten; die angeforderten Vertragskorrekturen und ggf. zusätzliche Untertickets dürfen vorbereitet werden. Keine stillschweigende Funktionsstilllegung.

## Bereits vorher freigegeben
- GATE-01: Drizzle + SagaTree Policy Service, separate World-Owner/Project-GM-Rechte. [ADR-ST-05](ADR-ST-05-gate-01-drizzle-policy.md).
- GATE-04: SQLite single writer/WAL/synchronous FULL, atomare State-/Revision-/Event-/Idempotency-Transaktionen. [ADR-ST-08](ADR-ST-08-gate-04-sqlite-single-writer.md). Kein Capacity-PASS ohne Lastprobe.
- Verbindlicher Node Modular Monolith: [host-modular-monolith.md](host-modular-monolith.md).

## UI/UX bei Migration
**Parity statt Redesign:** React/Vite/Three.js, bestehende Navigation/Flows und Design-Tokens erhalten. `src/THEME_GUIDE.md`, `src/guidelines/Guidelines.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md`, `docs/concepts/imagination-first-visualization-contract.md` und `src/shared/ui` sind die normativen Quellen. Browser/Desktop/Local/VPS haben die in den bestehenden Contracts festgelegten Journeys; Phone/Tablet/Desktop/enge Main-Panes müssen bei betroffenen UI-Slices überprüft werden.

## Issue-Readiness-Vertrag (ECC)
- **SPECIFIED**: kanonischer Implementierungsvertrag für Architektur, In/Out, Scope, konkrete Source- und Target-Pfade, Nutzerfluss (falls UI), Laufzeitvarianten, Security, Negativtests, messbare Acceptance, Dependencies. `SPECIFIED` ist **nicht** `agent-ready`.
- **READY**: SPECIFIED + alle transitive Vorgänger auf aktuellem GitHub-Stand mit belegter Abnahme + benötigte GATE-Approval-Quellen verifiziert + keine verbleibenden Source-Blocker. Label `agent-ready` nur dann und mit synchronisierter Intake-Registry setzen. Ein GitHub-Closed-Status allein ersetzt fehlende Testergebnisse nicht.
- **WAITING_DEPENDENCY**: vollständig spezifiziert, jedoch echte Vorgänger noch nicht akzeptiert.
- **BLOCKED**: ungeklärter Source-Defekt/fehlender echter Beleg oder technische Blockade. Fehlende Tests niemals als PASS.
- Gate-Entscheidung und Plattform-Release-Belege sind getrennt. Bei einem `blocked`-Ticket alle anderen unabhängig ausführbaren Tickets weiterbearbeiten, soweit bestehende Sicherheitsregeln es erlauben.
- Für jedes Migrationsticket gelten `npm run test-gate`, typisierte Verträge, echte DB-/HTTP-/WS-/Browser-Integrationsnachweise wo zutreffend, negative Authz-Canaries und die vollständige ECC-Laufbahn. Mocks oder generierte Hashes sind keine Laufzeitabnahme.

## Notwendige Reparaturen des historischen Plan-Generators
`scripts/stack-migration-issue-rendering.mjs` setzt aktuell alle GATEs immer auf `needs-design` und alle anderen Tickets auf `blocked`; `scripts/stack-migration-identities.mjs` hält `preparationAuthority.runnerExecution=false`. Eine Bereitschaftsaktualisierung muss **aus dem verifizierten GitHub-/Belegstatus** abgeleitet sein, ohne fehlende Tests zu erfinden. Der Renderer und `scripts/stack-migration-issue-contracts.mjs` müssen dieselben fachlichen Verträge in GitHub-Bodies, `.qa/design/migration-issues`, Intake, Dependency-Plan und Publish-Hashes schreiben. Derzeit existiert keine berechtigte Behauptung, dass alle 90 Issues bereits agent-ready sind.

## Abnahmegrenzen vor Start des unbeschränkten ECC-Loops
- Die 90 kanonischen Verträge mit normativem `@issue-contract` und aktuellen Design-/Runtime-/UI-Regeln reproduzierbar rendern.
- Topologische Abhängigkeiten und Transitivität prüfen; optionaler tus-Nachfolger darf den Core-Cutover nicht blockieren.
- Abgeschlossene Issues mit echten Merge-/Evidence-Belegen abgleichen; historische `blocked`-Texte und Labels bereinigen.
- Echte noch rote Gates und Atlas-Regressionsfälle reparieren, nicht überspringen.
- Erst **nach** reproduzierbarer Synchronisierung und Readiness-Check den ECC Runner auf READY-Tickets starten. Produktionsoperationen bleiben gesondert geschützt.
