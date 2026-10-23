<!-- migration-contract:v2 localId=MIG-022 -->
# MIG-022: SessionRuntimeState port (revision+idempotency)

## Type

feature

## Intent

SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren.

## Goal

SessionRuntimeState als atomaren persistenten Command-Prozessor mit Revision und Idempotenz portieren. Zielpfade: server/src/application/session, server/src/persistence/session.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`.
- Source Contracts: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/session`
- `server/src/persistence/session`

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

- Commands benötigen Session-Membership und operationale Rolle; Actor-/Payload-gebundene Idempotenz verhindert die Wiederverwendung fremder Antworten.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Zwei zulässige Commands auf derselben expectedRevision
- Wenn: beide gleichzeitig geschrieben werden
- Dann: Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

### Fall 2

- Gegeben: Ein bestätigter Command mit session_id/idempotency_key
- Wenn: Retry, andere Nutzlast und anderer Actor folgen
- Dann: Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

### Fall 3

- Gegeben: Ein Abbruch zwischen State-, Event- und Idempotenz-Schreibschritt
- Wenn: der Host aus WAL neu startet
- Dann: Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.
- Quelle: `src/infrastructure/session/session-runtime-service.ts`, `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.
2. Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.
3. Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Genau eines committet die nächste Revision samt Zustand und Ereignis; das andere erhält Konflikt und verändert keine Persistenz.
- [ ] Identischer Retry liefert dasselbe Ergebnis; abweichende Nutzlast oder Actor wird zurückgewiesen, und die Revision bleibt unverändert.
- [ ] Alle vier Datenteile inklusive Revision sind gemeinsam committet oder gemeinsam abwesend; ein Event wird erst nach erfolgreichem Commit veröffentlicht.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #790 (MIG-011)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #787 (GATE-04)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-022`
- Design: `.qa/design/migration-issues/stack-migration-mig-022.md`
- Status: ready
- Reihenfolge: 16; Welle: 2
- Labels: `P0`, `migration-wave-2-api-realtime`, `migration-order-016`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-022.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

