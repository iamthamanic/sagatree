<!-- migration-contract:v2 localId=MIG-303 -->
# MIG-303: Port infrastructure/inventory adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/inventory: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/inventory: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts`, `src/domains/character/domain/sagatree-profile.entity.ts`, `src/domains/character/inventory-v2/catalog.ts`, `src/domains/character/inventory-v2/core-catalog.ts`, `src/domains/character/inventory-v2/index.ts`, `src/domains/character/inventory-v2/migrate-legacy.ts`, `src/domains/character/inventory-v2/operations.ts`, `src/domains/character/inventory-v2/primitives.ts`, `src/domains/character/inventory-v2/state.ts`, `src/domains/character/inventory-v2/types.ts`, `src/domains/character/inventory-v2/validation.ts`, `src/domains/items/assets.ts`, `src/domains/items/definition.ts`, `src/domains/items/fork.ts`, `src/domains/items/icon-assets.ts`, `src/domains/items/index.ts`, `src/domains/items/library-query.ts`, `src/domains/items/model3d-assets.ts`, `src/domains/items/normalize.ts`, `src/domains/items/pack.ts`, `src/domains/items/packs/build-standard-item.ts`, `src/domains/items/packs/contemporary-basic.ts`, `src/domains/items/packs/context-packs.ts`, `src/domains/items/packs/core-snapshots.ts`, `src/domains/items/packs/fantasy-basic.ts`, `src/domains/items/packs/index.ts`, `src/domains/items/packs/scifi-basic.ts`, `src/domains/items/payload.ts`, `src/domains/items/taxonomy.ts`, `src/domains/items/validate.ts`, `src/domains/items/world-catalog.ts`, `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/resource-id/index.ts`, `src/domains/resource-id/public-resource-id.ts`, `src/domains/resource-id/screen-vs-modal.ts`, `src/domains/resource-id/session-routing.ts`, `src/domains/rules/sagatree/character-creation/index.ts`, `src/domains/rules/sagatree/items/carry-capacity.ts`, `src/domains/rules/sagatree/items/index.ts`, `src/domains/rules/sagatree/items/resource-affordability.ts`, `src/domains/rules/sagatree/items/tool-rules.ts`, `src/domains/rules/sagatree/items/types.ts`, `src/domains/rules/sagatree/items/validators.ts`, `src/domains/rules/sagatree/skill-progression/index.ts`, `src/domains/rules/sagatree/species-trait-options/index.ts`, `src/infrastructure/character/character.persistence.ts`, `src/infrastructure/inventory/host-inventory-adapter.ts`, `src/infrastructure/inventory/host-inventory-ports.contract.ts`, `src/infrastructure/inventory/inventory-persistence.ts`, `src/infrastructure/inventory/item-catalog-service.ts`, `src/infrastructure/inventory/item-catalog.persistence.ts`, `src/infrastructure/inventory/item-model3d-service.ts`, `src/infrastructure/inventory/item-thumbnail-service.ts`, `src/infrastructure/inventory/supabase-item-catalog.repository.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/lib/authenticatedUser.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:


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

- Der Adapter überträgt einen verifizierbaren Actor-Kontext und übernimmt keine privilegierten Client-Rollen. Serverseitige Policy, Projektion und Asset-Rechte müssen auch bei direkten Requests wirksam bleiben.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für inventory und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für inventory ausführt
- Dann: Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
- Quelle: `.qa/intake/edge-infra-contracts/infra-inventory.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-inventory.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
2. Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
3. Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- [ ] Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- [ ] Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/domain/character.entity.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #825 (MIG-409)
- Depends on #826 (MIG-410)
- Depends on #793 (MIG-014)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-303`
- Design: `.qa/design/migration-issues/stack-migration-mig-303.md`
- Status: done
- Reihenfolge: 69; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-069`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-303.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Integration peers

- #801 (MIG-302)
- #805 (MIG-306)

Gemeinsame Ports bleiben stabil, Integrationsabnahme in MIG-600; keine zyklischen Startverbote.

