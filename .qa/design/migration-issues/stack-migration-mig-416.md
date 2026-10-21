<!-- migration-contract:v2 localId=MIG-416 -->
# MIG-416: Port Edge Function `media` to Node host service/adapter

## Type

Task

## Intent

media: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert.

## Goal

media: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Non-Goals

- Unapproved framework choice
- Production cutover
- Silent retirement of an operation

## Context

Epic #773. Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. 

### Vorher

Baseline 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248; Quellpfade: supabase/functions/_shared/cors.ts, supabase/functions/_shared/edge-dispatcher-allowlist.ts, supabase/functions/_shared/edge-jwt-gate.ts, supabase/functions/main/index.ts, supabase/functions/media/index.ts. Detaillierte Aufruf-/SQL-Nachweise: .qa/intake/edge-infra-contracts/edge-media.md, .qa/intake/edge-infra-contracts/source-contracts/edge-media.json.

### Nachher und Verhalten

media: Den nicht eingebundenen Legacy-Worker erfassen; der produktive Host behält die 404-Grenze, bis eine gesonderte Freigabe einen sicheren Nachfolger aktiviert. Zielpfade: .

## Scope

- Quellpfade: `supabase/functions/_shared/cors.ts`, `supabase/functions/_shared/edge-dispatcher-allowlist.ts`, `supabase/functions/_shared/edge-jwt-gate.ts`, `supabase/functions/main/index.ts`, `supabase/functions/media/index.ts`
- Änderbare Zielpfade: 
- Quellverträge: `.qa/intake/edge-infra-contracts/edge-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-media.json`

## Security & Data

media: Dispatcher denies media with404 before JWT check/worker creation. Historical worker itself has no end-user authentication or owner/GM/member authorization. Do not expose it or invent RLS for its local Maps. Dispatcher-Status: {"kind":"legacy-unmounted","dispatcherAllowed":false,"publicActivationAuthorized":false,"decision":"Preserve external 404; no automatic host route or public activation."}. Provider-Schlüssel bleiben serverseitig; die vollständigen request-/response-/quota-spezifischen Regeln stehen im Quellvertrag.

### Bekannte Legacy-Defekte / offene Verifikation

- Upload response points at an object that this worker never creates; content is not decoded/validated, and uploadedBy is client-controlled.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für media und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für media ausführt
- Dann: media worker stays404.
- Quelle: `.qa/intake/edge-infra-contracts/edge-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-media.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für media und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für media ausführt
- Dann: Isolated metadata upload records calculated URL/MIME/size but makes zero storage calls; delete never claims physical object deletion.
- Quelle: `.qa/intake/edge-infra-contracts/edge-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-media.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für media und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für media ausführt
- Dann: Filename/path and spoofed uploadedBy are unvalidated historical inputs; successor storage API requires its independent owner-path contract.
- Quelle: `.qa/intake/edge-infra-contracts/edge-media.md`, `.qa/intake/edge-infra-contracts/source-contracts/edge-media.json`

## Acceptance

- [ ] media worker stays404.
- [ ] Isolated metadata upload records calculated URL/MIME/size but makes zero storage calls; delete never claims physical object deletion.
- [ ] Filename/path and spoofed uploadedBy are unvalidated historical inputs; successor storage API requires its independent owner-path contract.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #793 (MIG-014)
- Depends on #841 (MIG-500)

Status: **blocked**. Abschluss benötigt ausgeführte fachliche Nachweise; ein Source-Snapshot genügt dafür nicht.

## Runner

- Feature slug: `stack-migration-mig-416`
- Design: `.qa/design/migration-issues/stack-migration-mig-416.md`
- Status: blocked
- Reihenfolge: 57; Welle: 3
- Labels: `P1`, `migration-wave-3-edge-services`, `migration-order-057`, `agent-blocked`
- Checks: `npm run test-gate`; die im Quellvertrag genannten Integrationsfälle sind zusätzlich vor dem Abschluss auszuführen.

## Design

`.qa/design/migration-issues/stack-migration-mig-416.md`

Source-Verifikation ist keine Implementierungsabnahme. Offene Vorgänger, Architekturentscheidungen und ausgewiesene Defekte sperren Ausführung/Abschluss. Keine produktive Migration durch diesen Vorbereitungsauftrag.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture approval: **not granted by this contract**
