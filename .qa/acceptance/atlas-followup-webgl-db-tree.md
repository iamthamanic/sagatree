# Acceptance: atlas-followup-webgl-db-tree (#747)

## Intent
In the default 3D atlas, display the same real WorldNode hierarchy and active primary-map selection as the persisted world model; eliminate prototype demo nodes and dimension actions from product navigation.

## Happy Path
1. GM opens Donalu Atlas in default 3D: sees the actual country/place tree from DB/RPC (stable place IDs).
2. GM selects a stored place: its persisted primary map opens; breadcrumb follows real IDs.
3. GM reloads: same tree and map selection; no localStorage-only prototype worlds as nav SoT.

## Acceptance
- [ ] Authenticated browser E2E on default 3D asserts names and stable IDs exactly match DB/RPC rows and no NAV_CHILDREN demo names occur in product tree.
- [ ] Click on an existing place opens matching primaryMapId; hard reload and Library/Saga navigation preserve identity; an empty world remains genuinely empty.
- [ ] User/role negative test proves non-editor view has only saga-visible nodes and no hidden IDs or names; loading, error and offline states are observable.
- [ ] Desktop/phone screenshots match #711 layout with real DOM tree controls; keyboard and touch tests pass.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases
- New empty world contains no seed people, fantasy landmasses or fake location names in the product nav.
- Revoked or archived places disappear on real reload; player never sees hidden ancestor labels.

## Scope
In: Typed controlled prop/event bridge for tree nodes into Native3d; remove demo nav in product mode; permission-scoped Library/Saga; loading/empty/error states.
Out: Second React tree overlay; deleting demo assets unrelated to product nav.

## Security Coverage
- F-03 / B-01 / B-04: owner-scoped RPC + RLS remain authority; client tree is projection only.
- No production migration in this ticket.

## Implementation Notes
- Domain: `buildAtlasWebglNavTree` projects authorized `world_places` + map links into WebGL nav kinds.
- Product path (`demoSeed === false`): `WorldAtlasWorkbench` → `UnifiedAtlasEditor` → `AtlasNative3dEditor` passes `externalNav`; runtime `#nav` uses DB ids (`data-atlas-nav-source="db"`), not `NAV_CHILDREN`.
- Select → `onNavSelect` → `editor.setActiveMapId(primaryMapId)`; rename → `rename_world_node` RPC.
- Gate: `scripts/atlas-worldbuilder-webgl-db-tree-check.mjs` (domain + Playwright mount/select/empty proofs).
- Demo mode (explicit demo seed) retains prototype NAV_CHILDREN.
