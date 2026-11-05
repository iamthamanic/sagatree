# Composition Gate — cut-12-port-existing-avatar-import-and (#1147)

- HEAD_SHA: PLACEHOLDER
- BASE_SHA: PLACEHOLDER
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration

## Event

Under host-first, Avatar Import/Export uploads GLB/VRM bytes through existing
`/api/v1/assets` with `purpose=avatar-model`, then binds provenance via CUT-11
avatar-artifact ports. Soft-DENY removed. No Supabase Storage on host path.

## Hop chain

1. **Producer (UI):** AvatarImportPanel / CharacterEditor save
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `publishHostAvatarModel` → `/api/v1/assets`
4. **Authorize:** AssetPorts owner policy; stranger → 403/404
5. **Persist:** LocalAssetStore + CharacterPorts artifacts
6. **Consumer:** same panels via credentialed asset URL + activate

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read owner model | Fail-closed 403/404 | pass |
| Invalid/missing | Non-glTF as avatar-model | 400 | pass |
| Dual-path | Flag off → Supabase storage | Exclusive | pass |
| Two consumers / crash | Restart keeps bytes + active artifact | Shared AssetPorts + CharacterPorts | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; covered by cut-12-avatar-transfer.self-test.
