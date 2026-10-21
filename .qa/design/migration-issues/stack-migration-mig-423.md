<!-- migration-contract:v2 localId=MIG-423 -->
# MIG-423: Port Edge Function `spellbook` to Node host service/adapter

## Type

Task

## Intent

spellbook: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

spellbook: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/spellbook/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-spellbook.md, .qa/intake/edge-infra-contracts/source-contracts/edge-spellbook.json.

### Nachher und Verhalten

spellbook: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/spellbook/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-spellbook.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-spellbook.json`

## Security & Data

spellbook: Dispatcher denies spellbook404 before JWT/worker creation. Isolated historical worker has no identity, owner or role authorization; characterId in path is trusted. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No owner check; cast ignores spellId and known/prepared state, uses fixed slot table independent of character/class. No persistent spell ownership.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für spellbook und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für spellbook ausführt
- Dann: All spellbook routes remain dispatcher404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-spellbook.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-spellbook.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für spellbook und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für spellbook ausführt
- Dann: Isolated GET creates empty book, repeated learn deduplicates spellId, prepare only changes known record and restore resets all used slots.
- Quelle: `.qa/intake/edge-infra-contracts/edge-spellbook.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-spellbook.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für spellbook und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für spellbook ausführt
- Dann: Explicitly capture cast accepting unknown/unprepared spells; a retained successor must test its chosen game rule and owner scope independently before any activation.
- Quelle: `.qa/intake/edge-infra-contracts/edge-spellbook.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-spellbook.json`

## Acceptance

- [ ] All spellbook routes remain dispatcher404.
- [ ] Isolated GET creates empty book, repeated learn deduplicates spellId, prepare only changes known record and restore resets all used slots.
- [ ] Explicitly capture cast accepting unknown/unprepared spells; a retained successor must test its chosen game rule and owner scope independently before any activation.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-423`
- Design: `.qa/design/migration-issues/stack-migration-mig-423.md`
- Status: blocked
- Reihenfolge: 65; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-065`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-423.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
