# Feature: ATL2-B05 Gate B — Canonical data / authz / legacy migration (#1205)

<!-- atlas-v2-epic: #1196; slice: B05; slug: atl2-b05 -->

## Intent

Independent evidence that Phase B (B01–B04) delivers one geometry write path,
owner-scoped CAS, lossless V1↔V2 adaptation, and write-retired WebGL sidecar —
before Phase C editor expansion.

## Preconditions

- #1201 / #1202 / #1203 / #1204 merged to `main`.

## Happy Path

- [ ] PR stack #1242 / #1243 / #1244 / #1245 present on `main` (documented SHAs)
- [ ] Golden reference canvas entity IDs/counts survive V2 adapt + wire roundtrip
- [ ] Persist strips `webglRuntimeV3` geometry; backup restore documented
- [ ] Gate report `.qa/runs/atl2-b05-gate-b.md` CLEAR

## Edge Cases

- [ ] Competing tabs: stale `expectedRevision` → 40001
- [ ] Non-owner write → 42501
- [ ] Present empty `unifiedCanvas` does not resurrect stale sidecar geometry

## Security Coverage

- Owner CAS + stranger deny (host world atlas upsert)
- No new auth surface

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-b05-gate-b.md`)

## Implementation Notes

- Protocol: `scripts/atl2-b05-gate-b.self-test.mjs` → `.qa/runs/atl2-b05-gate-b.md`
- Depends on domain modules from B01–B04 + host upsert CAS
