# Acceptance — CUT-11 (#1146)

- Issue: #1146
- Slug: cut-11-port-avatar-artifact-crud-and-ow
- Epic: #1135

## Delivered

Host-first Avatar V2 artifact CRUD: migration `0034_character_avatar_artifacts_v2.sql`;
`CharacterAvatarArtifactStore` + CharacterPorts; `/api/v1/library/avatar-artifacts*`;
FE dual-path; Soft-DENY removed.

## Checks

- [x] scripts/cut-11-avatar-artifacts.self-test.mjs
- [x] Positive create/list/get/activate/analysis
- [x] Negative stranger 404 + path traversal reject
- [x] Idempotent create
- [x] `npm run test-gate` (includes CUT-11)

## Composition Gate

See `.qa/runs/composition-gate-cut-11-port-avatar-artifact-crud-and-ow.md`.
