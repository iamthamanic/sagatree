# ADR-ST-10 — Atlas productive 3D renderer remains Custom WebGL (R01 NO-GO)

- **Status:** Accepted
- **Date:** 2026-11-14
- **Decision issue:** [#1266](https://github.com/iamthamanic/sagatree/issues/1266) (ATL2-R01, completed)
- **Merged evidence PR:** [#1273](https://github.com/iamthamanic/sagatree/pull/1273)
- **Authoritative design ADR:** [`.qa/design/atl2-r01-renderer-decision.md`](../../.qa/design/atl2-r01-renderer-decision.md)
- **Domain lock:** `src/domains/world/atlas/atlas-renderer-target.ts` (`ATLAS_R01_RENDERER_HYBRID_DECISION.verdict = NO-GO`; `atlasR01AllowsFollowOnRendererWork() === false`)
- **Epic context:** [#1196](https://github.com/iamthamanic/sagatree/issues/1196) (steering; historical Three.js target wording retained)

## Context

Master Epic #1196 historically named Three.js as the Atlas V2 productive 3D projection (Phase D / Design). Gate D and subsequent Atlas work shipped on the **Custom WebGL** product path (`AtlasGL` / `AtlasLite3D` / `atlas-prototype-runtime`). R01 measured product Custom-WebGL against a Three inventory PoC under identical fixtures and recorded an explicit **NO-GO** for an incremental Three.js **product** backend swap.

This ADR does **not** silently rewrite epic history. It records the superseding architecture decision so agents and humans do not treat #1196 wording as a live GO for Three.js migration.

## Decision

1. **Productive 3D source of truth** remains Custom WebGL (`custom-webgl-prototype-runtime` / AtlasGL + AtlasLite3D).
2. **No Three.js product migration** (adapter, lighting/instancing product path, editor switch, or Gate-R activation) without a **new explicit GO-ADR** that supersedes R01 (#1266 / #1273).
3. **Do not remove or replace** the Custom WebGL renderer as part of R02–R05 cleanup.
4. Follow-ons **#1267–#1270 (R02–R05)** are **not_planned** under R01 NO-GO (closed 2026-11-14). Reopen only after a superseding GO-ADR + parity CLEAR.

## Consequences

### Binding

- Epic #1196 remains the Atlas V2 steering issue for non-superseded slices; renderer ownership for product 3D is Custom WebGL until a GO-ADR says otherwise.
- `AtlasSpatialViewport` / `three` inventory stays non-product unless explicitly re-scoped by a future GO-ADR.
- H01 (#1234) must not delete the productive Custom WebGL path under the false premise that Three.js already replaced it.

### Not approved by this ADR

- Any R02–R05 implementation work
- Dual productive 3D mounts
- Rewriting #1196 acceptance history to pretend Three.js was never the historical target

## Related

- Issue comment on epic: https://github.com/iamthamanic/sagatree/issues/1196#issuecomment-6881095649
- Closed not_planned: #1267, #1268, #1269, #1270
