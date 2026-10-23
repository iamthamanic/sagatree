<!-- migration-contract:v2 localId=MIG-021 -->
# MIG-021: Realtime session rooms + snapshot/resync

## Type

feature

## Intent

Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen.

## Goal

Autorisierte Realtime-Räume mit durablem Snapshot und Revision-basiertem Resync bereitstellen. Zielpfade: server/src/realtime.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`.
- Source Contracts: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/realtime`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Membership wird bei Join/Reconnect/Command geprüft; Broadcasts verwenden Empfängerprojektionen und enthalten für Spieler keine GM-only Daten.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: GM und zwei Spieler mit unterschiedlichen letzten Revisionen
- Wenn: die Clients verbinden sich nach Unterbrechung erneut
- Dann: Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 2

- Gegeben: Ein fremder Actor oder inzwischen entfernter Spieler
- Wenn: Join, Reconnect und Raumkommando werden versucht
- Dann: Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 3

- Gegeben: Ein bestätigtes Command und ein sofortiger Host-Neustart
- Wenn: die Clients ihre letzte Revision melden
- Dann: Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
- Quelle: `src/infrastructure/session/session-runtime-channel.ts`, `src/infrastructure/session/session-runtime-service.ts`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
2. Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
3. Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.
- [ ] Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.
- [ ] Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #785 (GATE-02)
- Depends on #786 (GATE-03)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-021`
- Design: `.qa/design/migration-issues/stack-migration-mig-021.md`
- Status: waiting
- Reihenfolge: 19; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-019`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-021.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

