# Acceptance — ATL3-R01B Three.js equal-fidelity PoC + ADR (#1296)

**Slug:** `atl3-r01b-three-equal-fidelity-adr` · **Design:** `.qa/design/atl3-r01b-three-equal-fidelity-adr.md`
**ADR:** `docs/architecture/ADR-ST-11-atl3-r01b-three-renderer-go.md` · **Binding until gates pass:** ADR-ST-10

- [x] Same stored objects (host API, V01 fingerprints) and the V01 cameras/canvas sizes/profiles (28 captures).
- [x] Real browser screenshots + perf/memory/draw-call comparison with environment limits (SwiftShader informational; hardware budgets enforced by the spec on real GPUs).
- [x] Custom GLSL (`ShaderMaterial` water) + `CanvasTexture`, PBR, shadow maps, `InstancedMesh`.
- [x] 2D/3D ID stability (13/13, 201/201), picking, edit path (2D stamp → same ID in 3D, no DB write), render reset (context loss/restore), load error.
- [x] Mobile/low-GPU: phone/tablet captures; lite/no-WebGL stays AtlasLite3D.
- [x] ADR with technical/commercial benefit, migration risks, rollback, camera/tool parity cost, reopen conditions for #1267–#1270 and follow-up PR gates.
- [x] ADR supersedes ADR-ST-10 only on a proven GO: conditional GO, `atlasR01bAllowsFollowOnRendererWork() === false` until owner approval + hardware evidence.
- [x] R02–R05 stay closed; no productive switch, no dual mounts, no map write path, no DB schema.
- [x] `retireParallelIn` updated with the ADR (H01-3).
- [x] V01 leftovers (perspective fog, z-fighting, plaza triangle) fixed; V01 matrix re-pinned.
- [x] Zero type escape hatches.

## Open (owner)

- [ ] Ben approves ADR-ST-11 (gate 1).
- [ ] Hardware-WebGL run of `e2e/atl3-r01b-three-poc.spec.ts` within `hardwareBudgets` (gate 2).
- [ ] V8 texture provenance/licence.
