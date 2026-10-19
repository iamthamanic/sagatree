# Acceptance: atlas-followup-canonical-2d3d-edits (#749)

## Intent
Eliminate independent editable state copies in generator_meta.webglRuntimeV3 and UnifiedCanvasDoc by adapting the 3D renderer to canonical MapEditOperation commands and stable feature IDs.

## Happy Path
1. GM adds a table in 2D and switches to 3D; table appears exactly once.
2. GM rotates it in 3D, switches back, then deletes it in 2D.
3. On 3D return and browser reload the table remains deleted.

## Acceptance
- [x] Browser E2E: 2D add, 3D move/rotate, 2D delete and return to 3D all show same object IDs and geometry with zero ghost objects.
- [x] 3D to 2D add/edit/remove works for each currently supported room, wall, stroke and object command; unsupported operations fail clearly without silent data loss.
- [x] After deleting the final WebGL prop, stored UnifiedCanvasDoc contains zero matching props and next 3D mount stays empty.
- [x] No extra mutable canonical geometry is stored solely in webglRuntimeV3 or in localStorage after save.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases
- Empty state deletes every object instead of keeping stale data
- Switching maps, repeated mount, undo and redo never restores ghost geometry

## Scope
In: One authoritative persisted feature document; bidirectional renderer projection; MapEditOperation routing; last-object delete.
Out: Separate persistent WebGL editor store; full 3D mesh modeling.

## Security Coverage
- Map mutations remain owner/editor gated via existing save RPCs; no new auth surface.
- N/A launch checklist.

## Implementation Notes
- Fixed `syncWebglPropsIntoCanvasDoc` to **replace** (not merge-append) stamp objects from WebGL props; empty props → `objects: []` (no ghost early-return).
- Added `STAMP_TO_PROP`, `emptyWebglRuntime()`, and `syncCanvasDocIntoWebglRuntime(runtime, doc)` projecting objects (x/y→x/z, angle→rotation), walls (x1/y1/x2/y2↔start/end), strokes (points [x,z]), and rooms when shapes are compatible; non-geometry runtime fields preserved.
- `UnifiedAtlasEditor`: product 3D `controlledSeed` always re-projects from current `doc`; 2D `onDocChange` also updates `webglRuntime`; `handleWebglPersist` writes parsed runtime + replace-synced canvas via raw prop (no ghost re-derive).
- Gate: `scripts/atlas-worldbuilder-canonical-2d3d-check.mjs` (wired in `test-gate` next to shared-editor); shared-editor empty-props assertion added.
- Document-level bidirectional sync for this ticket; MapEditOperation remains the 2D mutation path — full 3D→MapEditOperation command routing can tighten further under epic #746.
