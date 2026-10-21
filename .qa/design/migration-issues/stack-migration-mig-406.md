<!-- migration-contract:v2 localId=MIG-406 -->
# MIG-406: Port Edge Function `characters` to Node host service/adapter

## Type

Task

## Intent

characters: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

characters: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/characters/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-characters.md, .qa/intake/edge-infra-contracts/source-contracts/edge-characters.json.

### Nachher und Verhalten

characters: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/characters/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-characters.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-characters.json`

## Security & Data

Dispatcher denies characters with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- addExperience sets const nextLevel/nextThreshold then while never advances either: XP reaching threshold can loop indefinitely.
- No user authentication; client supplies ownerId. level-up body can target a different path ID. Type assertions do not validate nested fields.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für characters und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für characters ausführt
- Dann: All characters methods stay dispatcher404, including cross-owner body and import payload.
- Quelle: `.qa/intake/edge-infra-contracts/edge-characters.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-characters.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für characters und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für characters ausführt
- Dann: Record that PUT can overwrite ownerId and level-up uses body.characterId in isolated fixture; neither becomes a successor authorization rule.
- Quelle: `.qa/intake/edge-infra-contracts/edge-characters.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-characters.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für characters und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für characters ausführt
- Dann: Source check identifies non-advancing addExperience loop; never execute XP-at-threshold fixture without hard timeout. Any retained progression must terminate and be separately tested.
- Quelle: `.qa/intake/edge-infra-contracts/edge-characters.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-characters.json`

## Acceptance

- [ ] All characters methods stay dispatcher404, including cross-owner body and import payload.
- [ ] Record that PUT can overwrite ownerId and level-up uses body.characterId in isolated fixture; neither becomes a successor authorization rule.
- [ ] Source check identifies non-advancing addExperience loop; never execute XP-at-threshold fixture without hard timeout. Any retained progression must terminate and be separately tested.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-406`
- Design: `.qa/design/migration-issues/stack-migration-mig-406.md`
- Status: blocked
- Reihenfolge: 48; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-048`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-406.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
