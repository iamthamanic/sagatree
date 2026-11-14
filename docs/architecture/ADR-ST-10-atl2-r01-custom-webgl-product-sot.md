# ADR-ST-10 — ATL2-R01: Custom WebGL remains productive 3D SoT

- **Status:** Accepted (NO-GO for product Three.js backend)
- **Date:** 2026-11-14
- **Decision issue:** [#1266](https://github.com/iamthamanic/sagatree/issues/1266) (ATL2-R01) — closed COMPLETED
- **Decision PR:** [#1273](https://github.com/iamthamanic/sagatree/pull/1273)
- **Epic clarified:** [#1196](https://github.com/iamthamanic/sagatree/issues/1196)
- **Measured ADR (canonical detail):** [`.qa/design/atl2-r01-renderer-decision.md`](../../.qa/design/atl2-r01-renderer-decision.md)
- **Domain lock:** `ATLAS_R01_RENDERER_HYBRID_DECISION.verdict = NO-GO` → `atlasR01AllowsFollowOnRendererWork() === false`

## Context (history preserved)

Master Epic #1196 originally described a high-quality **Three.js** 3D projection of the same Saved Maps (one productive 3D path), sequenced under Phase D. Gate D (#1218) accepted the **Custom WebGL** product runtime (`AtlasGL` / `AtlasLite3D`). That created an apparent contradiction: epic wording vs shipped product owner.

ATL2-R01 (#1266) was the explicit GO/NO-GO measurement between:

| Option | Meaning |
| --- | --- |
| A | Keep productive Custom-WebGL (`atlas-prototype-runtime.mjs`) |
| B | Incremental Three.js product 3D backend (reuse domain; no big-bang) |
| C | Full rewrite / dual productive mounts — rejected Non-Goal |

## Decision

**NO-GO (Option A).** Productive Atlas 3D owner remains **Custom WebGL**:

`AtlasNative3dEditor` → `src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs` (`ATLAS_PRODUCT_3D_TARGET` / `custom-webgl-prototype-runtime`).

`AtlasSpatialViewport` / installed `three` stay **inventory / non-product** chrome unless a future ADR says otherwise.

## Consequences

1. **Do not remove or replace** the Custom WebGL renderer under epic #1196 without a **new explicit GO-ADR** that supersedes this document and R01.
2. Follow-on slices **R02–R05** (#1267, #1268, #1269, #1270) are **not_planned** (closed). Completing #1266 does **not** greenlight them.
3. Epic #1196 intent language that named Three.js as the 3D target is **historical**; the binding product SoT after R01 is Custom WebGL. Do not silently rewrite the original epic body as if Three.js never was the stated target — record supersession here and on the epic issue thread instead.
4. No second productive 3D mount. No Three.js product migration without superseding GO-ADR + parity CLEAR.

## Links

| Artifact | Role |
| --- | --- |
| [#1266](https://github.com/iamthamanic/sagatree/issues/1266) / [#1273](https://github.com/iamthamanic/sagatree/pull/1273) | R01 decision + merge |
| `.qa/design/atl2-r01-renderer-decision.md` | Full measured ADR |
| `.qa/design/atl2-r01-reuse-matrix.md` | Reuse / gap matrix |
| `.qa/runs/atl2-r01-renderer-decision.*` | Gate evidence |
| [#1196](https://github.com/iamthamanic/sagatree/issues/1196) comment `atlas-v2-r01-epic-supersession` | Epic clarification thread |
