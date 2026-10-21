<!-- migration-contract:v2 localId=MIG-408 -->
# MIG-408: Port Edge Function `export` to Node host service/adapter

## Type

Task

## Intent

export: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

export: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/export/index.ts, supabase/functions/main/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-export.md, .qa/intake/edge-infra-contracts/source-contracts/edge-export.json.

### Nachher und Verhalten

export: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/export/index.ts`, `supabase/functions/main/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-export.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-export.json`

## Security & Data

export: Dispatcher denies export with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- No authentication, arbitrary typed-as-any content and minimal PDF serializer; current PDF is not a validated document pipeline.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für export und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für export ausführt
- Dann: export/import routes remain dispatcher404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-export.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-export.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für export und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für export ausführt
- Dann: Isolated fixture compares JSON indentation, Markdown output, PDF header/content and filename for each format; invalid format/content returns400.
- Quelle: `.qa/intake/edge-infra-contracts/edge-export.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-export.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für export und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für export ausführt
- Dann: Successor import must not treat parsed JSON as persisted resource; format conversion and persistence are separate explicit contracts.
- Quelle: `.qa/intake/edge-infra-contracts/edge-export.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-export.json`

## Acceptance

- [ ] export/import routes remain dispatcher404.
- [ ] Isolated fixture compares JSON indentation, Markdown output, PDF header/content and filename for each format; invalid format/content returns400.
- [ ] Successor import must not treat parsed JSON as persisted resource; format conversion and persistence are separate explicit contracts.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-408`
- Design: `.qa/design/migration-issues/stack-migration-mig-408.md`
- Status: blocked
- Reihenfolge: 50; Welle: 3
- Labels: `P2`, `migration-wave-3-edge-services`, `migration-order-050`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-408.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
