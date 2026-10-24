# Acceptance — stack-migration-mig-501 (#842)

## Intent

Optionalen fortsetzbaren Großdatei-Upload (tus-style) an denselben Asset-Publish-Pfad (MIG-500) anschließen unter `server/src/assets/uploads`.

## Acceptance tier

`isolated-contract` — SLICE DONE only. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Happy Path

- Gegeben: Host mit `SAGATREE_LARGE_UPLOADS=1` und Actor mit `asset.publish`
- Wenn: Upload-Session erstellt, Chunks mit korrektem Offset gesendet, Länge erreicht
- Dann: Genau ein Asset via MIG-500 publish mit erwarteter SHA-256; Staging-Bytes entfernt

## Edge Cases

1. Resume am bestätigten Offset nach Unterbrechung → ein Asset, Checksumme korrekt
2. Falscher Offset / fremder Actor / Limit überschritten → Chunk denied, keine unvollständige Publish
3. Capability aus → kleiner `assets.publish` OK; resumable `create` → `capability-disabled`

## Required Tests

- [ ] `node --experimental-strip-types scripts/mig-501-resumable-uploads.self-test.mjs`
- [ ] Touched files: zero type escape hatches

## Security Coverage

| ID | How satisfied |
| --- | --- |
| B-01 / B-04 | Upload-IDs owner-bound; each chunk re-authorizes `asset.publish`; foreign actor → `not-authorized` |
| B-07 | Path resolve only under `dataDir/assets/.uploads` via safe tokens; no caller paths |
| B-08 / B-09 | Finalize goes through Policy Service + LocalAssetStore; no elevated origins |
| P-04 | Capability flag default off (`SAGATREE_LARGE_UPLOADS` unset) |
| F-03 | N/A — no new frontend surface in this slice |

## Launch Checklist (SC)

N/A — not a launch ticket. Inline: SC-01/02/03/06 covered by actor binding + deny codes + size limits.

## Implementation Notes

- Ports: `createResumableUploadPorts` / host `uploads` field
- Migration: `0006_asset_uploads.sql` → `asset_upload_sessions`
- Raise publish ceiling only via `PublishInput.maxBytes` clamped to 64 MiB when finalizing resumable uploads
