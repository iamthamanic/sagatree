# Composition Gate — atlas-followup-canonical-2d3d-edits (#749)

**Status:** CLEAR  
**WORKTREE:** feat/issue-749-atlas-followup-canonical-2d3d-edits @ CLEAN (issue files only)  
**Date:** 2026-10-19

## Producer → consumer path

1. **2D producer:** `UnifiedAtlasEditor` canvas mutations → `onDocChange` → `syncCanvasDocIntoWebglRuntime` → `onWebglRuntimeChange`
2. **3D producer:** `AtlasNative3dEditor` persist → `handleWebglPersist` → `parseWebglRuntimeState` + `syncWebglPropsIntoCanvasDoc` (replace objects)
3. **3D consumer seed:** `controlledSeed = syncCanvasDocIntoWebglRuntime(webglRuntime ?? empty, doc)` on each product-3D mount
4. **Persist:** `useWorldAtlasEditor.saveCanvas` merges both `unifiedCanvas` and `webglRuntimeV3` from derived state

## Simulations

| Case | Result |
|------|--------|
| 2D add → 3D mount | Same object id in props (stamp→prop) |
| WebGL last prop delete | `doc.objects.length === 0`; remount props empty |
| Round-trip no ghost | empty props ↔ empty objects; placeNames preserved |

## Evidence

- `node scripts/atlas-worldbuilder-canonical-2d3d-check.mjs`
- `node scripts/atlas-worldbuilder-shared-editor-check.mjs` (empty-props clear)
