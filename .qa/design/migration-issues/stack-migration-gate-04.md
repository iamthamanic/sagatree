<!-- migration-contract:v2 localId=GATE-04 -->
# GATE-04: PoC: Preserve revision/transaction/idempotency guarantees under SQLite writer model

## Type

chore

## Intent

Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen.

## Goal

Atomare SQLite-Autorität für Zustand, Revision, Ereignis und Idempotenz unter Konkurrenz und Prozessabbruch nachweisen. Zielpfade: .qa/evidence/stack-migration-prep/pocs/gate-04, .qa/design/gates/GATE-04-sqlite-revision-idempotency.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`.
- Source Contracts: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/evidence/stack-migration-prep/pocs/gate-04`
- `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Actor und Membership werden vor dem Schreibrecht geprüft. Idempotenz wird pro Sitzung und Schlüssel gespeichert und gegen Actor-/Payload-Wechsel geschützt; Broadcast erfolgt erst nach Commit.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: 20 Clients mit jeweils 50 Commands und gemeinsamen expectedRevision-Werten
- Wenn: ein SQLite-Writer verarbeitet die gemischten Anforderungen
- Dann: Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 2

- Gegeben: Dieselbe session_id/idempotency_key sowie ein zweiter Actor oder anderer Payload
- Wenn: Retry und missbräuchliche Wiederverwendung werden gesendet
- Dann: Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

### Fall 3

- Gegeben: Abbruchpunkte vor Commit, nach Commit und vor Broadcast
- Wenn: der Prozess wird tatsächlich mit SIGKILL beendet und aus WAL neu gestartet
- Dann: Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.
- Quelle: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`, `src/infrastructure/session/session-runtime-service.ts`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.
2. Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.
3. Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Nur akzeptierte Commands erhöhen die Revision genau einmal; Konflikte verändern weder Zustand noch session_events, und erfolgreiche Revisionen sind lückenlos.
- [ ] Ein identischer Retry liefert das gespeicherte Ergebnis; Actor-/Payload-Wechsel wird abgewiesen, während derselbe Schlüssel in einer anderen Sitzung unabhängig funktioniert.
- [ ] Zustand, Revision, session_events und Idempotenz sind gemeinsam vorhanden oder gemeinsam abwesend; Reconnect rekonstruiert bestätigte Ereignisse ohne zweite Mutation.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)
- Depends on #783 (MIG-002)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-gate-04`
- Design: `.qa/design/migration-issues/stack-migration-gate-04.md`
- Status: done
- Reihenfolge: 7; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-007`, `agent-done`, `gate-issue`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-gate-04.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

