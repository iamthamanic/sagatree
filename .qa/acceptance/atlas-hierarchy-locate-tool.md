# Feature: Atlas hierarchy + Ausschnitt verorten (Steps 3+4)

<!-- Golden Steps 3+4 — see .qa/design/atlas-golden-steps-2-6-pm.md -->

## Intent

GMs create canonical hierarchy nodes (each with an independent primary map) and
locate unlocated child maps on the parent via a drag rectangle. LOD/drill stays
fail-closed until a grounded `parentAnchor` exists. 2D and 3D share the same
persisted frame.

Classification: **SETUP** / Workstation. AU-* for locate chrome; IV honest
unlocated until locate commits.

## Preconditions

- Steps 1–2 product terrain + coast polygons present
- `createWorldNodeWithMaps` / CreateWorldNodeDialog product path available
- Owner `canEdit` on the world

## Happy Path

- [x] Sidebar / WebGL `+` creates continent→…→room via existing create path; each node has own primary map (`unlocated` until locate) _(Detailkarte verknüpfen + CreateWorldNodeDialog path)_
- [x] Unlocated child: no LOD-drill; unverortet badge + hint visible _(browser: hint + Ausschnitt verorten)_
- [x] „Ausschnitt verorten“ opens parent in locate mode; drag rect commits `parentAnchor` + `mapStatus: unsketched` _(browser SA-RR25A)_
- [x] Overview pin on parent gets center anchor so pins / nav `located` flip true _(linkMap overview in locateChildOnParent)_
- [x] After locate: drill Parent→Child allowed; reload keeps anchor _(domain canLodEnterChildMap + upsert; browser: hint cleared after drag)_
- [x] Invalid rect (extent ≤ 0) → DE error, no partial write _(self-test)_
- [x] Self-tests + `npm run test-gate` pass

## Edge Cases

- [x] Cancel locate mode (Esc / Abbrechen) leaves child unlocated _(chrome + Escape handler)_
- [x] Non-owner / no canEdit: no locate write _(locateChildOnParent early return)_
- [x] Missing parentMapId: locate button disabled / DE feedback _(button only when parentMapId)_

## Regression

- [x] Existing unlocated hint + createChildMap path unchanged for rect-less detail maps
- [x] Steps 1–2 product paint / Fläche still work _(Draufsicht polygons still visible)_
- [x] Eldoria demoSeed path unchanged

## Assumptions

- Golden continent/country names deferred to Step 5 (placeholders OK if created manually)
- metersPerUnit stays null
- Locate chrome is a session mode (not a paint tool in the registry)

## Composition Gate

SKIPPED — single-actor authoring locate + hierarchy create (owner upsert only);
see `.qa/runs/composition-gate-atlas-hierarchy-locate-tool.md`

## Security Coverage

- Owner-scoped map upsert + place link only
- Client cannot invent cross-world parentMapId without host checks on upsert
