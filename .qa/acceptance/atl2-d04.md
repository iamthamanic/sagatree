# Feature: ATL2-D04 — Editable heightfields (#1215)

<!-- atlas-v2-epic: #1196; slice: D04; slug: atl2-d04 -->

## Intent

Hills, valleys and slopes are stored as a versioned heightfield chunk on
`UnifiedCanvasDoc` and edited with raise / lower / smooth / flatten brushes —
not faked only in the view matrix.

## Preconditions

- #1205 Gate B + #1211 Gate C CLEAR (canonical doc + tools)

## Happy Path

- [ ] Domain `atlas-heightfield.ts`: chunk format, parse/serialize, brush ops,
      shore/water rule, mesh triangles, fingerprint
- [ ] `UnifiedCanvasDoc.heightfield` optional; legacy docs without field parse OK
- [ ] MapEditOps: `ensure_heightfield` / `paint_heightfield` / `clear_heightfield` /
      `set_heightfield`
- [ ] Tool `height` in registry + WebGL chrome; 2D editor + 3D runtime paint
- [ ] Bridge mirrors heightfield into ephemeral WebGL seed
- [ ] Product geometry fingerprint includes heightfield; mesh `product_heightfield`
- [ ] Gate report `.qa/runs/atl2-d04-heightfield.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Imagination-First (IV)

- [ ] **IV-01** Authority: heights are document SoT, not decorative shadow meshes
- [ ] **IV-18** Canonical linkage: save/reload restores the same heights; polygons unchanged

## Edge Cases

- [ ] Missing / invalid heightfield dropped without failing the whole canvas doc
- [ ] Extreme heights outside ± clamp rejected on parse
- [ ] Shore rule keeps submerged cells below waterLevel unless leaveWater

## Security Coverage

- No new auth surface; persist remains host upsert / owner policy

## Composition Gate

SKIPPED — heightfield is an optional UnifiedCanvasDoc field + view mesh; no new
producer→consumer hop (see `.qa/runs/composition-gate-atl2-d04.md`)

## Implementation Notes

- Domain: `atlas-heightfield.ts`, `map-edit-ops.ts`, `unified-canvas-doc.ts`
- Runtime: `atlas-prototype-runtime.mjs` (height tool + product_heightfield mesh)
- Editor: `UnifiedAtlasEditor.tsx` (Höhe tool)
- Self-test: `scripts/atl2-d04-heightfield.self-test.mjs`
