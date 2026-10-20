# Infrastructure `character`

## VORHER
- Area root: `src/infrastructure/character/`
  - `src/infrastructure/character/avatar/avatar-animation-runtime.ts`
  - `src/infrastructure/character/avatar/avatar-asset-manifests.ts`
  - `src/infrastructure/character/avatar/avatar-face-tracking-runtime.ts`
  - `src/infrastructure/character/avatar/avatar-facial-runtime.ts`
  - `src/infrastructure/character/avatar/avatar-rigid-equipment-runtime.ts`
  - `src/infrastructure/character/avatar/avatar-skinned-wearable-runtime.ts`
  - `src/infrastructure/character/avatar/avatar-structure-scanner.ts`
  - `src/infrastructure/character/avatar/base-body-catalog.ts`
  - `src/infrastructure/character/avatar/body-profile-metrics.ts`
  - `src/infrastructure/character/avatar/character-avatar-artifact-service.ts`
  - `src/infrastructure/character/avatar/character-avatar-export-service.ts`
  - `src/infrastructure/character/avatar/character-avatar-import-service.ts`
  - `src/infrastructure/character/avatar/character-avatar-meshy-service.ts`
  - `src/infrastructure/character/avatar/character-studio-manifest.ts`
  - `src/infrastructure/character/avatar/character-studio-runtime.ts`
  - `src/infrastructure/character/avatar/face-anchor-runtime.ts`
  - `src/infrastructure/character/avatar/face-mapping-auto-pipeline.ts`
  - `src/infrastructure/character/avatar/face-mapping-base-face-capture-visibility.ts`
  - `src/infrastructure/character/avatar/face-mapping-raycast.ts`
  - `src/infrastructure/character/avatar/mtoon-style-applier.ts`
  - `src/infrastructure/character/avatar/rig-analyzer.ts`
  - `src/infrastructure/character/avatar/rig-bone-aliases.ts`
  - `src/infrastructure/character/avatar/toonlab-compatibility-spike.ts`
  - `src/infrastructure/character/avatar/trait-asset-allowlist.ts`
  - `src/infrastructure/character/avatar/trait-lifecycle-three-adapter.ts`
  - `src/infrastructure/character/character-adventure-arc-service.ts`
  - `src/infrastructure/character/character-lore-service.ts`
  - `src/infrastructure/character/character-preset-service.ts`
  - `src/infrastructure/character/character-service.ts`
  - `src/infrastructure/character/character.persistence.ts`
  - `src/infrastructure/character/liveact/face-anchors-manifest-url.ts`
  - `src/infrastructure/character/liveact/gltf-liveact-avatar-output.ts`
  - `src/infrastructure/character/liveact/index.ts`
  - `src/infrastructure/character/liveact/liveact-avatar-output.ts`
  - `src/infrastructure/character/liveact/liveact-camera-claim.ts`
  - `src/infrastructure/character/liveact/liveact-character-face-debug.ts`
  - `src/infrastructure/character/liveact/liveact-engine.ts`
  - `src/infrastructure/character/liveact/liveact-eye-bone-aliases.ts`
  - `src/infrastructure/character/liveact/liveact-face-diagnostics.ts`
  - `src/infrastructure/character/liveact/liveact-morph-target-index.ts`
  - … +11 files
- RPCs: n/a
- Tables `.from`: `character_avatar_artifacts`, `character_avatar_export_assets`, `character_avatar_import_assets`, `characters`, `project_members`, `projects`, `sessions`
- Edge invokes: `character-avatar-meshy`, `character-lore`

## NACHHER
- src/infrastructure/character/** → HTTP/client to server/src/application/character/
- Depends: GATE-01, EDGE:character-avatar-meshy, EDGE:character-lore
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- Edge invoke parity for: character-avatar-meshy, character-lore

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports
