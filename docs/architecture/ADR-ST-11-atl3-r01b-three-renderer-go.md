# ADR-ST-11 — ATL3-R01B: Three.js as the future single Atlas 3D renderer (conditional GO)

- **Status:** Proposed — **GO (conditional)**. Not yet in force: ADR-ST-10 stays the binding renderer SoT until both gates in §Gates are `passed`.
- **Date:** 2026-11-16
- **Decision issue:** [#1296](https://github.com/iamthamanic/sagatree/issues/1296) (ATL3-R01B, slug `atl3-r01b-three-equal-fidelity-adr`)
- **Supersedes (only once gates pass):** [ADR-ST-10](./ADR-ST-10-atl2-r01-custom-webgl-product-sot.md). ADR-ST-10 and #1266 stay immutable (not rewritten).
- **Domain lock:** `ATLAS_R01B_RENDERER_DECISION` (`verdict: 'GO'`, `gates: { ownerApproval: 'pending', hardwareEvidence: 'pending' }`) → `atlasR01bAllowsFollowOnRendererWork() === false` until both gates are `passed`.
- **Measured detail:** [`.qa/design/atl3-r01b-three-equal-fidelity-adr.md`](../../.qa/design/atl3-r01b-three-equal-fidelity-adr.md) · evidence [`.qa/evidence/atl3-r01b-three-poc/results.json`](../../.qa/evidence/atl3-r01b-three-poc/results.json)

## Context

ADR-ST-10 (#1266) kept the custom WebGL runtime because a Three.js backend showed no decisive measured gain and the old
`AtlasSpatialViewport` lacked heightfield/diorama/lite parity. ATL3-V01 (#1295) then fixed a visual quality contract
(24 criteria). The owner's own Three.js prototype "Atlas V8" (`.qa/research/atl3-r01b/atlas-v8-reference.html`) shows the
target look (PBR material atlas, PCF shadows, fog, ACES). #1296 asks for an isolated equal-fidelity PoC on the same
stored Golden data and V01 cameras, measured, before any migration.

## What was built (isolated, test-only)

`src/infrastructure/world/atlas-r01b-three-poc/` — not imported by any product module, not mounted, no map write path, no DB schema.
It consumes the domain `buildAtlasProductGeometryPlan` (same rooms/walls/doors/objects/strokes/heightfield as the product),
the V01 camera formula (identical eye/up/distance per camera mode), V8's PBR atlas (map/normal/roughness × 10 kinds),
`MeshStandardMaterial`, PCF shadow maps, ACES tone mapping, `InstancedMesh` (door jambs), a custom GLSL water `ShaderMaterial`
and a `CanvasTexture` torch halo. Browser spec: `e2e/atl3-r01b-three-poc.spec.ts`.

## Evidence (real browser; CI/box = SwiftShader software WebGL)

| Check | Result |
| --- | --- |
| Same stored objects | Dornhain + Krypta loaded from the host API; data fingerprints == V01 contract (`3ec9b21f…`, `a44b49a7…`) |
| Same cameras | every high/balanced V01 capture mirrored (ortho/diorama/perspective × Z0–Z2, desktop/tablet/phone) at the exact actual V01 camera + canvas size — 28 captures |
| 2D/3D ID parity | Dornhain 13/13, Krypta 201/201 canonical IDs identical |
| Picking | 8/8 (Dornhain props/houses), 2/2 (Krypta lamp/chest) |
| Edit path | 2D surface `Haus` stamp → held PUT body (no DB write) → PoC: new ID present, centroid planar offset 0, IDs 13 → 14 |
| Context loss/restore | lost + restored, 85 ms / 128 ms, non-blank after restore |
| Load error | corrupt PBR texture → rejects in 16 ms (no hang, no partial scene) |
| Quantitative A/B per pair (28) | gradient-structure correlation with the paired custom frame ≥ 0.25 (min 0.273), ≥ 0.10 above any frame of the other scene (min margin 0.130), and higher than every other camera/zoom of the same scene (pair identified 28/28, min margin 0.010 — near views are similar) |
| Image richness vs custom (same view, 28 pairs) | edge density 1.0–13× (median 3.8×), distinct colours 2–12× (median 5.2×) — custom is flat-albedo |
| Draw calls / triangles | 14–28 calls vs 14 custom meshes; ≈ 2× triangles (box walls, roofs) |
| Load (software) | cold load 10–25 ms, texture decode 3–10 ms, shader compile 2–8 ms, first frame 63–256 ms |
| Frames (software, informational) | Three p50/p95 16.7–66.6 / 16.7–100.1 ms over two runs vs custom 16.6–26.5 / 19.8–70.3 ms (run-to-run variance on SwiftShader up to ±40 %) |
| JS heap | ≈ 31.6 MB |

SwiftShader frame times measure the CPU rasteriser, not a GPU; per #1296 software WebGL is **never** sole proof. The spec
classifies a run as `hardware-webgl` only on a positive GPU-vendor match; unknown renderers are `unverified-webgl` (informational, never gate evidence). No
hardware perf claim is made here — that is gate 2.

Side-by-side (custom | Three | V8): `.qa/evidence/atl3-r01b-three-poc/ab/*.jpg`.

## Decision

**GO (conditional) for Three.js as the single future Atlas 3D renderer**, delivered through the closed slices
R02 (#1267) → R03 (#1268) → R04 (#1269) → R05 (#1270), each with its own PR gate (§Follow-up gates).

Reasons:
1. **Fidelity:** on identical data and cameras Three closes the V01 material/light/shadow gaps (D-MAT-01, K-MAT-01,
   D-SHD-01, K-SHD-01, D-GEO-03 shading) that the custom runtime cannot close without building its own engine layer
   (PBR + normal/roughness maps, PCF shadow pass, tone mapping, instancing, texture pipeline, restore): estimated
   ≥ 1,100 LOC of renderer engine we would own forever.
2. **Parity is cheap where it matters:** geometry builders mapped 1:1 onto the domain plan, camera math is identical,
   IDs/picking/edit path hold — data, 2D editors and game systems stay untouched.
3. **Commercial:** the owner-requested V8 look becomes reachable with a maintained MIT library that is already a repo
   dependency (`three@0.186.1`, character studio) — no new vendor, no licence change for the engine.

Not a reason: a pretty reference. Much of V8's striking look is **content density** (hand-authored trees, flowers,
pebbles, fences) — that is a data/content gap and needs its own content work regardless of renderer.

## Gates (both required before ADR-ST-11 is in force)

1. **Owner approval** — Ben explicitly approves this ADR (`gates.ownerApproval = 'passed'` in the same PR that reopens #1267).
2. **Hardware evidence** — `e2e/atl3-r01b-three-poc.spec.ts` run on a real GPU (`measurementClass: hardware-webgl`) where
   the spec enforces the V01 `hardwareBudgets` desktop-reference values (high: p95 ≤ 16.7 ms, draw calls ≤ 150,
   first frame ≤ 1500 ms); results committed (`gates.hardwareEvidence = 'passed'`). A tablet-tier run is part of R05.

Until then: R02–R05 stay closed `not_planned`; custom WebGL remains the only productive renderer.

## Consequences

1. **One productive renderer at any time.** No dual product mounts, no second map store. Custom WebGL stays productive
   until the R04 switch; afterwards it is rollback only, removed after R05 + #1300 CLEAR.
2. **`AtlasSpatialViewport` is not the reuse vehicle** — `ATLAS_RENDERER_DECISION.retireParallelIn = 'atl3-r02-adapter'`:
   R02 starts from the R01B scene module and deletes SpatialViewport.
3. **AtlasLite3D stays** the lite / no-WebGL fallback (Three has no Canvas2D path).
4. The R01B PoC stays test-only; it is never wired to the quality switch or product chrome.

## Rollback

Before R04: nothing to roll back (product unchanged). After R04: one switch back to the custom runtime host
(`AtlasNative3dEditor` → `atlas-prototype-runtime.mjs`), kept intact until R05/#1300 CLEAR; 2D Canvas stays the authoring
source in all cases. If gate 2 fails, set `hardwareEvidence: 'failed'` → verdict reverts to NO-GO in a follow-up ADR;
ADR-ST-10 remains in force.

## Reopen conditions for #1267–#1270

| Issue | Reopen only when | PR gate |
| --- | --- | --- |
| #1267 R02 scene/geometry adapter | both gates `passed` | domain plan → Three scene module, ID parity + picking for all Golden maps, SpatialViewport deleted, test-only |
| #1268 R03 PBR/light/shadow/instancing | R02 merged | texture provenance cleared, quality profiles (high/balanced) with budgets, V01 MAT/SHD criteria ≥ PARTIAL on hardware |
| #1269 R04 product integration / E2E parity | R03 merged | single host swap behind the renderer target, camera/tool/nav/WorldNode/selection/restore parity, V01/G04/G05/H03 green, rollback switch |
| #1270 R05 acceptance | R04 merged | hardware runs per tier, V01 matrix re-evaluated, #1300 independent gate, then custom-WebGL retirement |

## Links

| Artifact | Role |
| --- | --- |
| [#1296](https://github.com/iamthamanic/sagatree/issues/1296) | Decision issue |
| [ADR-ST-10](./ADR-ST-10-atl2-r01-custom-webgl-product-sot.md) | Binding renderer SoT until gates pass |
| `.qa/design/atl3-r01b-three-equal-fidelity-adr.md` | Measured detail, port cost, risks |
| `.qa/acceptance/atl3-r01b-three-equal-fidelity-adr.md` | Acceptance checklist |
| `e2e/atl3-r01b-three-poc.spec.ts` | Browser A/B + metrics + parity |
| `.qa/research/atl3-r01b/atlas-v8-reference.html` | Owner's V8 reference |
