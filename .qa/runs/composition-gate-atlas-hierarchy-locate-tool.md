# Composition Gate — atlas-hierarchy-locate-tool

## Verdict

**SKIPPED**

## Reason

Single-actor owner authoring: create child maps / locate parentAnchor via existing
owner-scoped upsert + place-link paths. No new multi-actor hop chain.

## HEAD

`582810dfcbe9f98133286a6b26ac027824e1eedb`

## Scope

- `locateChildMapFrame` / `parentAnchorFromParentRect`
- `useWorldAtlasEditor.locateChildOnParent`
- UnifiedAtlasEditor locate session + WorldAtlasWorkbench chrome
