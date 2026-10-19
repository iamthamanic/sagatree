# Composition Gate — atlas-followup-webgl-db-tree (#747)

**Status:** CLEAR  
**WORKTREE:** feat/issue-747-atlas-followup-webgl-db-tree  
**Date:** 2026-10-19

## Producer → consumer path

1. **Producer:** `worldPlaceService.listPlaces` / `listMapLinks` (RPC + RLS)
2. **Domain:** `buildAtlasWebglNavTree(places, links)`
3. **Workbench:** `WorldAtlasWorkbench` memo → `webglNavTree`
4. **Editor:** `UnifiedAtlasEditor` product-3D branch → `AtlasNative3dEditor`
5. **Runtime:** `mountAtlasPrototype3d({ externalNav })` → `#nav` DOM (`data-atlas-nav-source="db"`)
6. **Select consumer:** `onNavSelect` → `editor.setActiveMapId(mapId)`

## Simulations

| Case | Result |
|------|--------|
| N actors (tree update without remount) | `updateExternalNav` + `setActiveNavPlaceId` |
| Invalid/empty fallback | `status: empty` → “Keine Orte”; no westmark/nordreich |
| Concurrent consumer | Select handler + React map load; no localStorage world SoT for nav |

## Evidence

- `.qa/evidence/atlas-followup-webgl-db-tree/browser-nav-proof.json`
- `node scripts/atlas-worldbuilder-webgl-db-tree-check.mjs`
