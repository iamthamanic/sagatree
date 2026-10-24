# Acceptance — stack-migration-mig-502 (#843)

## Intent

Versioned world/saga export bundles with validated import and a restore drill under `server/src/migration/bundles`.

## Acceptance tier

`isolated-contract` — SLICE DONE only. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

Deferred integration: TBD by dependency successors: MIG-500/#841, MIG-503/#844, MIG-020/#795.

## Edge Cases

1. Export→import preserves domain/public IDs, relations, asset hashes; missing atlas geometry reported, not invented
2. Unknown format version / path traversal / checksum mismatch abort before publish; no partial authoritative rows
3. Restore drill on empty host: owner remapped; stranger owns nothing; payload checksum verified

## Security Coverage

| ID | How |
| --- | --- |
| B-01/B-04 | Foreign overwrite denied; owner remapped on restore |
| Path | Asset storage keys must be safe tokens (`path-traversal-denied`) |
| Integrity | SHA-256 payload + per-asset checksums before writes |

## Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- Module: `server/src/migration/bundles`
- Self-test: `scripts/mig-502-export-import-bundles.self-test.mjs`


## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-stack-migration-mig-502.md`
- HEAD_SHA: c834dacc85a926c87aea01118332b7a6c6ac27c7
- Deferred integration: TBD by dependency successors: MIG-500/#841, MIG-503/#844, MIG-020/#795
