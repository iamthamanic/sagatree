# Feature: Atlas prototype 3D exact mount

## Intent

Show the Unified Atlas **exactly** as in `sagatree_unified_atlas_3d_v3.html`: tilted WebGL (or software-3D fallback), stacked world/region/city/dungeon maps, hotspots, tools, LOD — not a flat Canvas2D approximation.

## Happy Path

1. Opening the product Weltkarte mounts the prototype 3D stage as the primary viewport.
2. Visual parity: tilted plane, multi-scale maps, hotspots, action tools, scale widget.
3. Zoom/pan/shift-tilt behave as in the HTML file.
4. Demo Eldoria flat path unchanged when `demoSeed !== false`.

## Edge Cases

- WebGL unavailable → prototype’s software 3D fallback (same meshes).
- Mobile: prototype side/inspector drawers still work inside the mount.

## Scope

- In: vendored HTML + host in UnifiedAtlasEditor product path.
- Out: rewriting persistence into the HTML localStorage model this ticket.

## Implementation Notes

- Runtime (editable): `src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs` — WebGL AtlasGL + Lite3D + LOD/tools from HTML v3.
- Host: `AtlasNative3dEditor` mounts runtime into SagaTree DOM (no iframe); CSS remapped to theme tokens; duplicate brand bar hidden.
- `UnifiedAtlasEditor` uses native host when `demoSeed === false`.
- Reference HTML kept at `public/atlas-prototype-3d.html`.
- Self-test: `scripts/atlas-prototype-3d-embed.self-test.mjs`.
