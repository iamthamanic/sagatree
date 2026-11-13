# ECC Runner Loop Handoff — Atlas V2 (#1196)

- **paused:** false
- **epic:** #1196 ATL2 Spatial Atlas V2
- **last merged on main:** ATL2-D05 via #1216 (`b6542cfa`) — terrain meshes/coasts/water/LOD
- **current:** close PR #1258 / issue #1217 ATL2-D06 (branch `issue-1217-atl2-d06`, HEAD `a4f5f59c`)
  - Fixed: TS dioramaLight readonly JSDoc, Codex P2 batch split / view-space fog / Lite light profile, stack-migration infra-world fingerprints, renderer architecture audit
  - Kodus: credits exhausted on prior HEAD — post `ecc-kodus-skipped-credits` after push; wait ECC Merge Gate
- **architecture:** custom WebGL remains product SoT — see `.qa/design/atl2-renderer-architecture-audit.md` (no Three.js flip without parity)
- **next after D06 merge:** #1218 ATL2-D07 Gate D (Depends on #1212–#1217)
- **resume:** `@ecc-runner-loop continue`
- **handoffPath (Project store):** `/cursor/stores/self/internal/ecc-runner-loop-atl2-handoff.md`
