<!-- migration-contract:v2 localId=MIG-302 -->
# MIG-302: Port infrastructure/character adapters from Supabase to host repositories

## Type

feature

## Intent

src/infrastructure/character: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten.

## Goal

src/infrastructure/character: bestehende Aufrufer über den freigegebenen Host transportieren und die vollständige RPC-/Tabellen-/Storage-/Realtime-Abhängigkeit erhalten. Zielpfade: .

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/character/avatar/animation-contract.ts`, `src/domains/character/avatar/asset-authoring-contract-v1.ts`, `src/domains/character/avatar/avatar-artifact-contract-v2.ts`, `src/domains/character/avatar/avatar-import.ts`, `src/domains/character/avatar/avatar-save-export.ts`, `src/domains/character/avatar/avatar-source.ts`, `src/domains/character/avatar/avatar-structure-analyzer-v2.ts`, `src/domains/character/avatar/base-body-contract.ts`, `src/domains/character/avatar/body-conversion-flow-v1.ts`, `src/domains/character/avatar/body-family-variant-resolver-v1.ts`, `src/domains/character/avatar/body-profile-contract-v1.ts`, `src/domains/character/avatar/body-region-mask-v1.ts`, `src/domains/character/avatar/canonical-body-families-v1.ts`, `src/domains/character/avatar/composition-contract-v2.ts`, `src/domains/character/avatar/content-pack-v1.ts`, `src/domains/character/avatar/custom-creature-flow-v1.ts`, `src/domains/character/avatar/custom-rig-decision-v1.ts`, `src/domains/character/avatar/editor-surface-resolver-v1.ts`, `src/domains/character/avatar/equipment-visual-contract.ts`, `src/domains/character/avatar/face-anchor-agent-review-v1.ts`, `src/domains/character/avatar/face-anchor-contract.ts`, `src/domains/character/avatar/face-mapping-authoring-contract.ts`, `src/domains/character/avatar/face-mapping-auto-surface-select-v1.ts`, `src/domains/character/avatar/face-mapping-auto-v1.ts`, `src/domains/character/avatar/face-mapping-draft-v1.ts`, `src/domains/character/avatar/face-mapping-guide-geometry.ts`, `src/domains/character/avatar/face-mapping-surface-semantics-v1.ts`, `src/domains/character/avatar/face-tracking-contract.ts`, `src/domains/character/avatar/facial-contract.ts`, `src/domains/character/avatar/final-acceptance-matrix-v1.ts`, `src/domains/character/avatar/fit-range-contract.ts`, `src/domains/character/avatar/generate-product-flow-v1.ts`, `src/domains/character/avatar/generation/index.ts`, `src/domains/character/avatar/generation/meshy-adapter.ts`, `src/domains/character/avatar/generation/resolve-settings.ts`, `src/domains/character/avatar/generation/types.ts`, `src/domains/character/avatar/identity-transfer-v1.ts`, `src/domains/character/avatar/import-original-flow-v1.ts`, `src/domains/character/avatar/index.ts`, `src/domains/character/avatar/item-avatar-fit-defaults.ts`, `src/domains/character/avatar/liveact-golden-reference-avatar-v1.ts`, `src/domains/character/avatar/meshy-avatar-job.ts`, `src/domains/character/avatar/modular-generate-decomposition-v1.ts`, `src/domains/character/avatar/modular-generate-flow-v1.ts`, `src/domains/character/avatar/modular-glb-contract-v1.ts`, `src/domains/character/avatar/morph-contract.ts`, `src/domains/character/avatar/mtoon-profile.ts`, `src/domains/character/avatar/rig-capability-contract-v2.ts`, `src/domains/character/avatar/rig-contract.ts`, `src/domains/character/avatar/rigging-provider-contract.ts`, `src/domains/character/avatar/rigid-equipment-plan.ts`, `src/domains/character/avatar/saga-human-canonical-v1.ts`, `src/domains/character/avatar/shared-avatar-surface.ts`, `src/domains/character/avatar/skinned-wearable-plan.ts`, `src/domains/character/avatar/species-template-ingress-v1.ts`, `src/domains/character/avatar/species-template-models-v1.ts`, `src/domains/character/avatar/species-template-pack-v1.ts`, `src/domains/character/avatar/starter-wardrobe-manifest-v1.ts`, `src/domains/character/avatar/trait-catalog.ts`, `src/domains/character/avatar/trait-layers.ts`, `src/domains/character/avatar/trait-lifecycle-registry.ts`, `src/domains/character/avatar/types.ts`, `src/domains/character/contracts/character-adventure-arc.types.ts`, `src/domains/character/contracts/character-lore.types.ts`, `src/domains/character/contracts/character-preset.types.ts`, `src/domains/character/contracts/character.commands.ts`, `src/domains/character/contracts/character.views.ts`, `src/domains/character/domain/character.entity.ts`, `src/domains/character/domain/sagatree-profile.entity.ts`, `src/domains/character/index.ts`, `src/domains/character/inventory-v2/catalog.ts`, `src/domains/character/inventory-v2/core-catalog.ts`, `src/domains/character/inventory-v2/index.ts`, `src/domains/character/inventory-v2/migrate-legacy.ts`, `src/domains/character/inventory-v2/operations.ts`, `src/domains/character/inventory-v2/primitives.ts`, `src/domains/character/inventory-v2/state.ts`, `src/domains/character/inventory-v2/types.ts`, `src/domains/character/inventory-v2/validation.ts`, `src/domains/character/liveact/index.ts`, `src/domains/character/liveact/liveact-calibration.ts`, `src/domains/character/liveact/liveact-capabilities.ts`, `src/domains/character/liveact/liveact-capability-inspector.ts`, `src/domains/character/liveact/liveact-channel-target-aliases.ts`, `src/domains/character/liveact/liveact-contract.ts`, `src/domains/character/liveact/liveact-dense-face-features-contour-metric.ts`, `src/domains/character/liveact/liveact-dense-face-features-contract.ts`, `src/domains/character/liveact/liveact-dense-face-features-extract.ts`, `src/domains/character/liveact/liveact-dense-face-features-fixtures.ts`, `src/domains/character/liveact/liveact-dense-face-features-normalize.ts`, `src/domains/character/liveact/liveact-diagnostics-peaks.ts`, `src/domains/character/liveact/liveact-diagnostics-v2.ts`, `src/domains/character/liveact/liveact-face-asset-contract.ts`, `src/domains/character/liveact/liveact-face-contract.ts`, `src/domains/character/liveact/liveact-face-diagnostics.ts`, `src/domains/character/liveact/liveact-face-metrics.ts`, `src/domains/character/liveact/liveact-gaze-path.ts`, `src/domains/character/liveact/liveact-hybrid-face-ab.ts`, `src/domains/character/liveact/liveact-hybrid-face-contract.ts`, `src/domains/character/liveact/liveact-hybrid-face-fixtures.ts`, `src/domains/character/liveact/liveact-hybrid-face-fusion.ts`, `src/domains/character/liveact/liveact-hybrid-face-solve.ts`, `src/domains/character/liveact/liveact-iris-gaze-ab.ts`, `src/domains/character/liveact/liveact-iris-gaze-contract.ts`, `src/domains/character/liveact/liveact-iris-gaze-fixtures.ts`, `src/domains/character/liveact/liveact-iris-gaze-solve.ts`, `src/domains/character/liveact/liveact-iris-gaze-sphere.ts`, `src/domains/character/liveact/liveact-mediapipe-sample.ts`, `src/domains/character/liveact/liveact-motion-test.ts`, `src/domains/character/liveact/liveact-network-frame.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-capture.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-contract.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-evaluate.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-fixtures.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-math.ts`, `src/domains/character/liveact/liveact-perfect-fidelity-v2-e2e.ts`, `src/domains/character/liveact/liveact-performance-face-aliases.ts`, `src/domains/character/liveact/liveact-performance-face-contract.ts`, `src/domains/character/liveact/liveact-performance-face-drive.ts`, `src/domains/character/liveact/liveact-performance-face-validate.ts`, `src/domains/character/liveact/liveact-personal-calibration-ab.ts`, `src/domains/character/liveact/liveact-personal-calibration-contract.ts`, `src/domains/character/liveact/liveact-personal-calibration-fixtures.ts`, `src/domains/character/liveact/liveact-personal-calibration-solve.ts`, `src/domains/character/liveact/liveact-personal-calibration-store.ts`, `src/domains/character/liveact/liveact-remote-consumer.ts`, `src/domains/character/liveact/liveact-retarget-profile.ts`, `src/domains/character/liveact/liveact-runtime-policy.ts`, `src/domains/character/liveact/liveact-temporal-ab.ts`, `src/domains/character/liveact/liveact-temporal-contract.ts`, `src/domains/character/liveact/liveact-temporal-fixtures.ts`, `src/domains/character/liveact/liveact-temporal-solve.ts`, `src/domains/character/liveact/liveact-video-viewport-transform.ts`, `src/domains/character/use-cases/assert-character-persistence.ts`, `src/domains/character/use-cases/avatar-presets.ts`, `src/domains/character/use-cases/character-lore-examples.ts`, `src/domains/character/use-cases/character-lore-traits.ts`, `src/domains/character/use-cases/dornhain-pregen-sheets.ts`, `src/domains/character/use-cases/genderReading.ts`, `src/domains/character/use-cases/normalize-character.ts`, `src/domains/character/use-cases/sagatree-native-gm-presence.ts`, `src/domains/items/assets.ts`, `src/domains/items/definition.ts`, `src/domains/items/fork.ts`, `src/domains/items/icon-assets.ts`, `src/domains/items/index.ts`, `src/domains/items/library-query.ts`, `src/domains/items/model3d-assets.ts`, `src/domains/items/normalize.ts`, `src/domains/items/pack.ts`, `src/domains/items/packs/build-standard-item.ts`, `src/domains/items/packs/contemporary-basic.ts`, `src/domains/items/packs/context-packs.ts`, `src/domains/items/packs/core-snapshots.ts`, `src/domains/items/packs/fantasy-basic.ts`, `src/domains/items/packs/index.ts`, `src/domains/items/packs/scifi-basic.ts`, `src/domains/items/payload.ts`, `src/domains/items/taxonomy.ts`, `src/domains/items/validate.ts`, `src/domains/items/world-catalog.ts`, `src/domains/look/advanced-adaption.ts`, `src/domains/look/advanced-look-capability-status.ts`, `src/domains/look/advanced-look-provider-registry.ts`, `src/domains/look/capability-metadata.ts`, `src/domains/look/index.ts`, `src/domains/look/invariants.ts`, `src/domains/look/library-query.ts`, `src/domains/look/parse.ts`, `src/domains/look/persistence-contracts.ts`, `src/domains/look/personal-look-override.ts`, `src/domains/look/reference-analysis.ts`, `src/domains/look/resolve.ts`, `src/domains/look/system-default.ts`, `src/domains/look/types.ts`, `src/domains/look/write-draft.ts`, `src/domains/media/index.ts`, `src/domains/media/optimization-contract.ts`, `src/domains/media/optimization-policy.ts`, `src/domains/project/contracts/project.types.ts`, `src/domains/rules/sagatree/attribute-progression/index.ts`, `src/domains/rules/sagatree/background-templates/index.ts`, `src/domains/rules/sagatree/character-creation/index.ts`, `src/domains/rules/sagatree/items/carry-capacity.ts`, `src/domains/rules/sagatree/items/index.ts`, `src/domains/rules/sagatree/items/resource-affordability.ts`, `src/domains/rules/sagatree/items/tool-rules.ts`, `src/domains/rules/sagatree/items/types.ts`, `src/domains/rules/sagatree/items/validators.ts`, `src/domains/rules/sagatree/skill-progression/index.ts`, `src/domains/rules/sagatree/species-trait-options/index.ts`, `src/domains/rules/sagatree/starting-templates/catalog.ts`, `src/domains/rules/sagatree/starting-templates/index.ts`, `src/domains/rules/sagatree/starting-templates/types.ts`, `src/domains/rules/sagatree/starting-templates/validate.ts`, `src/domains/session/contracts/live-session-access.ts`, `src/domains/session/media/media-plane-contract.ts`, `src/infrastructure/character/avatar/avatar-animation-runtime.ts`, `src/infrastructure/character/avatar/avatar-asset-manifests.ts`, `src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts`, `src/infrastructure/character/avatar/avatar-facial-runtime.ts`, `src/infrastructure/character/avatar/avatar-rigid-equipment-runtime.ts`, `src/infrastructure/character/avatar/avatar-skinned-wearable-runtime.ts`, `src/infrastructure/character/avatar/avatar-structure-scanner.ts`, `src/infrastructure/character/avatar/base-body-catalog.ts`, `src/infrastructure/character/avatar/body-profile-metrics.ts`, `src/infrastructure/character/avatar/character-avatar-artifact-service.ts`, `src/infrastructure/character/avatar/character-avatar-export-service.ts`, `src/infrastructure/character/avatar/character-avatar-import-service.ts`, `src/infrastructure/character/avatar/character-avatar-meshy-service.ts`, `src/infrastructure/character/avatar/character-studio-manifest.ts`, `src/infrastructure/character/avatar/character-studio-runtime.ts`, `src/infrastructure/character/avatar/face-anchor-runtime.ts`, `src/infrastructure/character/avatar/face-mapping-auto-pipeline.ts`, `src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts`, `src/infrastructure/character/avatar/face-mapping-raycast.ts`, `src/infrastructure/character/avatar/mtoon-style-applier.ts`, `src/infrastructure/character/avatar/rig-analyzer.ts`, `src/infrastructure/character/avatar/rig-bone-aliases.ts`, `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts`, `src/infrastructure/character/avatar/trait-asset-allowlist.ts`, `src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts`, `src/infrastructure/character/character-adventure-arc-service.ts`, `src/infrastructure/character/character-lore-service.ts`, `src/infrastructure/character/character-preset-service.ts`, `src/infrastructure/character/character-service.ts`, `src/infrastructure/character/character.persistence.ts`, `src/infrastructure/character/host-character-adapter.ts`, `src/infrastructure/character/host-character-ports.contract.ts`, `src/infrastructure/character/liveact/face-anchors-manifest-url.ts`, `src/infrastructure/character/liveact/gltf-liveact-avatar-output.ts`, `src/infrastructure/character/liveact/index.ts`, `src/infrastructure/character/liveact/liveact-avatar-output.ts`, `src/infrastructure/character/liveact/liveact-camera-claim.ts`, `src/infrastructure/character/liveact/liveact-character-face-debug.ts`, `src/infrastructure/character/liveact/liveact-engine.ts`, `src/infrastructure/character/liveact/liveact-eye-bone-aliases.ts`, `src/infrastructure/character/liveact/liveact-face-diagnostics.ts`, `src/infrastructure/character/liveact/liveact-morph-target-index.ts`, `src/infrastructure/character/liveact/liveact-pose-drive.ts`, `src/infrastructure/character/liveact/liveact-retarget-profile-registry.ts`, `src/infrastructure/character/liveact/liveact-rig-debug.ts`, `src/infrastructure/character/liveact/liveact-session-transport.ts`, `src/infrastructure/character/liveact/mediapipe-dense-semantic-points-v1.ts`, `src/infrastructure/character/liveact/mediapipe-face-image-landmarker.ts`, `src/infrastructure/character/liveact/mediapipe-face-source.ts`, `src/infrastructure/character/liveact/mediapipe-iris-geometry-v1.ts`, `src/infrastructure/character/liveact/mediapipe-sagatree-face-anchor-map-v1.ts`, `src/infrastructure/character/liveact/vrm-liveact-avatar-output.ts`, `src/infrastructure/character/supabase-character.repository.ts`, `src/infrastructure/inventory/inventory-persistence.ts`, `src/infrastructure/inventory/item-catalog.persistence.ts`, `src/infrastructure/inventory/supabase-item-catalog.repository.ts`, `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts`, `src/infrastructure/look/adapters/toonlab-look-adapter.ts`, `src/infrastructure/look/host-look-adapter.ts`, `src/infrastructure/look/host-look-ports.contract.ts`, `src/infrastructure/look/index.ts`, `src/infrastructure/look/look-material-roles.ts`, `src/infrastructure/look/look-reference-analysis-service.ts`, `src/infrastructure/look/look-runtime-types.ts`, `src/infrastructure/look/look-runtime.ts`, `src/infrastructure/look/look-service.ts`, `src/infrastructure/look/look.persistence.ts`, `src/infrastructure/look/supabase-look.repository.ts`, `src/infrastructure/media/optimizer/engines/audio/index.ts`, `src/infrastructure/media/optimizer/engines/image/image.worker.ts`, `src/infrastructure/media/optimizer/engines/image/index.ts`, `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`, `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`, `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`, `src/infrastructure/media/optimizer/engines/image/types.ts`, `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`, `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`, `src/infrastructure/media/optimizer/engines/model3d/index.ts`, `src/infrastructure/media/optimizer/engines/video/index.ts`, `src/infrastructure/media/optimizer/index.ts`, `src/infrastructure/media/optimizer/media-optimizer.ts`, `src/infrastructure/project/project-member-service.ts`, `src/infrastructure/project/project-service.ts`, `src/infrastructure/session/media/livekit-media-plane-adapter.ts`, `src/infrastructure/session/media/media-plane-adapter.ts`, `src/infrastructure/session/media/media-token-client.ts`, `src/infrastructure/session/media/memory-media-plane-adapter.ts`, `src/infrastructure/session/media/memory-media-plane-bus.ts`, `src/infrastructure/session/media/session-media-plane.ts`, `src/lib/authenticatedUser.ts`, `src/lib/entityCache.ts`, `src/lib/localAdmin.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`.
- Source Contracts: `.qa/intake/edge-infra-contracts/infra-character.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-character.json`.
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

- Gegeben: Der eingefrorene Quellvertrag für character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character ausführt
- Dann: Create/read/edit/delete own complete/draft character and reload; foreign owner and cross-owner FK writes denied.
- Quelle: `.qa/intake/edge-infra-contracts/infra-character.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-character.json`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character ausführt
- Dann: Portrait/avatar upload, generation,poll/export and lore draft retain full shapes; creator rendering utilities are not moved to server merely because under infrastructure.
- Quelle: `.qa/intake/edge-infra-contracts/infra-character.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-character.json`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für character und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für character ausführt
- Dann: Presets/public catalog reads are preserved with current RLS; generated artifacts cannot resolve a foreign owner path.
- Quelle: `.qa/intake/edge-infra-contracts/infra-character.md`, `.qa/intake/edge-infra-contracts/source-contracts/infra-character.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Create/read/edit/delete own complete/draft character and reload; foreign owner and cross-owner FK writes denied.
2. Portrait/avatar upload, generation,poll/export and lore draft retain full shapes; creator rendering utilities are not moved to server merely because under infrastructure.
3. Presets/public catalog reads are preserved with current RLS; generated artifacts cannot resolve a foreign owner path.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Create/read/edit/delete own complete/draft character and reload; foreign owner and cross-owner FK writes denied.
- [ ] Portrait/avatar upload, generation,poll/export and lore draft retain full shapes; creator rendering utilities are not moved to server merely because under infrastructure.
- [ ] Presets/public catalog reads are preserved with current RLS; generated artifacts cannot resolve a foreign owner path.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `src/domains/character/avatar/animation-contract.ts`, `src/domains/character/avatar/asset-authoring-contract-v1.ts`, `src/domains/character/avatar/avatar-artifact-contract-v2.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-602 feature E2E |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #791 (MIG-012)
- Depends on #792 (MIG-013)
- Depends on #795 (MIG-020)
- Depends on #820 (MIG-404)
- Depends on #821 (MIG-405)
- Depends on #841 (MIG-500)
- Depends on #793 (MIG-014)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-302`
- Design: `.qa/design/migration-issues/stack-migration-mig-302.md`
- Status: done
- Reihenfolge: 68; Welle: 4
- Labels: `P1`, `migration-wave-4-adapter-ports`, `migration-order-068`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-302.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).

## Integration peers

- #802 (MIG-303)
- #803 (MIG-304)
- #805 (MIG-306)
- #807 (MIG-308)
- #810 (MIG-311)

Gemeinsame Ports bleiben stabil, Integrationsabnahme in MIG-600; keine zyklischen Startverbote.

