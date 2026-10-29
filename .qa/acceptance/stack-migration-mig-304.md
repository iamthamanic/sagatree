# Acceptance — MIG-304 LookProfile host adapters (#803)

## Intent
Port `src/infrastructure/look` LookProfile persistence callers onto approved host repository ports while Supabase remains the live default (no production cutover). Reference-analysis quarantine stays MIG-412; local runtime style adapters stay browser-side.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-600/#845 feature E2E cutover; FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Look profile create/edit/duplicate/archive/reload returns same public IDs and payload semantics.
- [x] Reference analysis includes original1..10 refs and error/degraded states; no foreign storage path can be fetched.
- [x] Local look runtime adapters remain unchanged by persistence transport replacement.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-304-look-adapter.self-test.mjs` → PASS

## Security Coverage
- Owner-scoped profiles: host ports DENY foreign actor list/mutate (B-01 / SC-01).
- No client-claimed owner elevation; actor from host identity only (B-07/B-08).
- Draft rejects provider blobs / invalid enums before persist (B-04).
- Reference analysis: foreign storage path DENY remains MIG-412 host ports (no new fetch surface).
- Launch SC-01…SC-07: N/A — not a launch ticket; inline SC-01/SC-02/SC-03/SC-06 covered above.

## Evidence
`node --experimental-strip-types scripts/mig-304-look-adapter.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-304.md`.

## Implementation Notes
- Host migration `0023_look_profiles.sql` + TABLE_OWNERSHIP `look_*` → look module.
- `createLookPorts` / `createLookPortsStub` wired in `create-host`.
- FE dual-path seam: `host-look-ports.contract.ts` + `createHostLookAdapter` (Supabase look-service default unchanged).
- No HTTP mount; Edge `look-reference-analysis` remains allowlisted.
