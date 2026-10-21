<!-- migration-contract:v2 localId=MIG-002 -->
# MIG-002: Complete legacy inventory matrix (SQL/RLS/RPC/Edge/Storage/Realtime/Infra)

## Type

Task

## Intent

Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden.

## Goal

Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden. Zielpfade: .qa/intake/rpc-contracts, .qa/intake/edge-infra-contracts, .qa/evidence/stack-migration-prep/legacy-target-matrix.md.

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: src/infrastructure, supabase/functions, supabase/migrations, src/supabase. Detaillierte Aufruf-/SQL-Nachweise: die unten referenzierten Anforderungen.

### Nachher und Verhalten

Alle produktiven Supabase-Aufrufstellen mit einer überprüften Quelloperation und einem verantwortlichen Migrationsticket verbinden. Zielpfade: .qa/intake/rpc-contracts, .qa/intake/edge-infra-contracts, .qa/evidence/stack-migration-prep/legacy-target-matrix.md.

## Scope

- Quellpfade: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`
- Änderbare Zielpfade: `.qa/intake/rpc-contracts`, `.qa/intake/edge-infra-contracts`, `.qa/evidence/stack-migration-prep/legacy-target-matrix.md`
- Quellverträge: `src/infrastructure`, `supabase/functions`, `supabase/migrations`, `src/supabase`

## Security & Data

SECURITY DEFINER, effektive EXECUTE-Rechte und Dispatcher-Erreichbarkeit getrennt prüfen. Unsichere Legacy-Semantik wird als Defekt erfasst und darf keine gewollte Nachfolger-Berechtigung werden.

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

## Acceptance

- [ ] Alle 57 Frontend-RPC-Namen einschließlich promote_session_outcome_to_saga und promote_session_outcome_to_world sind mit Aufrufstelle und genau einem Primärverantwortlichen erfasst.
- [ ] 25 Edge-Verträge und 13 Adapter-Verträge sind vollständig zugeordnet; neun erreichbare Worker, 15 nicht eingebundene Worker und main als Dispatcher werden getrennt gezählt; ollama-settings ist vorläufig MIG-402/#818 mitgebunden.
- [ ] Die Prüfung meldet den veralteten Vertragsnachweis mit Dateipfad; unaufgelöste Laufzeitaufrufe und nicht im Bootstrap enthaltene SQL-Dateien erscheinen ausdrücklich als offene Abdeckung.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #782 (MIG-001)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-002`
- Design: `.qa/design/migration-issues/stack-migration-mig-002.md`
- Status: blocked
- Reihenfolge: 3; Welle: 0
- Labels: `P0`, `migration-wave-0-evidence`, `migration-order-003`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-002.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: specified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
