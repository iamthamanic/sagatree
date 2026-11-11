# Composition Gate — atlas-hierarchy-locate-tool

## Verdict

**SKIPPED**

## Reason

Single-actor owner authoring: create child maps / locate parentAnchor via existing
owner-scoped upsert + place-link paths. No new multi-actor hop chain.

## HEAD

Stamped at commit time for Steps 3+4 on `feat/atlas-3d-product-terrain`.

## Scope

- `locateChildMapFrame` / `parentAnchorFromParentRect`
- `useWorldAtlasEditor.locateChildOnParent`
- UnifiedAtlasEditor locate session + WorldAtlasWorkbench chrome
