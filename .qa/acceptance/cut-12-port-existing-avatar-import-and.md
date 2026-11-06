# Acceptance — CUT-12 (#1147)

- Issue: #1147
- Slug: cut-12-port-existing-avatar-import-and
- Epic: #1135

## Delivered

Host-first avatar import/export over existing AssetPorts + CUT-11 artifact ports:

- `POST /api/v1/assets` accepts `purpose=avatar-model` (glTF/VRM sniff)
- FE dual-path in import/export services (Soft-DENY removed)
- Credentialed model URL via `/api/v1/assets/:id`
- Legacy Supabase path retained when host library flag is off

## Checks

- [x] scripts/cut-12-avatar-transfer.self-test.mjs
- [x] Positive publish / download / artifact activate / restart
- [x] Negative stranger deny + non-glTF reject
- [x] Idempotent republish
- [x] `npm run test-gate` (includes CUT-12)

## Composition Gate

See `.qa/runs/composition-gate-cut-12-port-existing-avatar-import-and.md`.

## Review

- Codex P1/P2 addressed on host size/credentials/materialize fail-closed.
CUT-12 babysit: 2026-11-06T00:56:05Z
