<!-- migration-contract:v2 localId=MIG-002 -->
# MIG-002: Complete legacy inventory matrix (SQL/RLS/RPC/Edge/Storage/Realtime/Infra)

## Type

chore

## Intent

Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden.

## Goal

Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden. Zielpfade: .qa/intake/rpc-contracts, .qa/intake/edge-infra-contracts, .qa/evidence/stack-migration-prep/legacy-target-matrix.md.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`.
- Source Contracts: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `.qa/intake/rpc-contracts`
- `.qa/intake/edge-infra-contracts`
- `.qa/evidence/stack-migration-prep/legacy-target-matrix.md`

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

- SECURITY DEFINER, effektive EXECUTE-Rechte und Dispatcher-Erreichbarkeit getrennt prüfen. Unsichere Legacy-Semantik wird als Defekt erfasst und darf keine gewollte Nachfolger-Berechtigung werden.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Direkte RPC-Literale und typisierte Wrapper-Argumente im TypeScript-AST
- Wenn: das Inventar wird aus dem eingefrorenen Quellbaum regeneriert
- Dann: Alle 57 Frontend-RPC-Namen einschließlich promote_session_outcome_to_saga und promote_session_outcome_to_world sind mit Aufrufstelle und genau einem Primärverantwortlichen erfasst.
- Quelle: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`

### Fall 2

- Gegeben: 25 Edge-Verzeichnisse und 13 Infrastruktur-Bereiche (nach #879 inkl. ollama-settings)
- Wenn: Source-Snapshots und Dispatcher werden ausgewertet
- Dann: 25 Edge-Verträge und 13 Adapter-Verträge sind vollständig zugeordnet; neun erreichbare Worker, 15 nicht eingebundene Worker und main als Dispatcher werden getrennt gezählt; ollama-settings ist vorläufig MIG-402/#818 mitgebunden.
- Quelle: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`

### Fall 3

- Gegeben: Ein Vertrag mit einer geänderten SQL-/TypeScript-Quelldatei
- Wenn: der Fingerprint-Prüfer läuft
- Dann: Die Prüfung meldet den veralteten Vertragsnachweis mit Dateipfad; unaufgelöste Laufzeitaufrufe und nicht im Bootstrap enthaltene SQL-Dateien erscheinen ausdrücklich als offene Abdeckung.
- Quelle: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Alle 57 Frontend-RPC-Namen einschließlich promote_session_outcome_to_saga und promote_session_outcome_to_world sind mit Aufrufstelle und genau einem Primärverantwortlichen erfasst.
2. 25 Edge-Verträge und 13 Adapter-Verträge sind vollständig zugeordnet; neun erreichbare Worker, 15 nicht eingebundene Worker und main als Dispatcher werden getrennt gezählt; ollama-settings ist vorläufig MIG-402/#818 mitgebunden.
3. Die Prüfung meldet den veralteten Vertragsnachweis mit Dateipfad; unaufgelöste Laufzeitaufrufe und nicht im Bootstrap enthaltene SQL-Dateien erscheinen ausdrücklich als offene Abdeckung.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 57 Frontend-RPC-Namen einschließlich promote_session_outcome_to_saga und promote_session_outcome_to_world sind mit Aufrufstelle und genau einem Primärverantwortlichen erfasst.
- [ ] 25 Edge-Verträge und 13 Adapter-Verträge sind vollständig zugeordnet; neun erreichbare Worker, 15 nicht eingebundene Worker und main als Dispatcher werden getrennt gezählt; ollama-settings ist vorläufig MIG-402/#818 mitgebunden.
- [ ] Die Prüfung meldet den veralteten Vertragsnachweis mit Dateipfad; unaufgelöste Laufzeitaufrufe und nicht im Bootstrap enthaltene SQL-Dateien erscheinen ausdrücklich als offene Abdeckung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-002`
- Design: `.qa/design/migration-issues/stack-migration-mig-002.md`
- Status: waiting
- Reihenfolge: 3; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-003`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-002.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

